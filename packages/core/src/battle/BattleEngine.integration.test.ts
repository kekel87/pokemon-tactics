import { loadData, typeChart } from "@pokemon-tactic/data";
import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { PokemonType } from "../enums/pokemon-type";
import { MockBattle } from "../testing/mock-battle";
import { MockPokemon } from "../testing/mock-pokemon";
import type { BattleEvent } from "../types/battle-event";
import type { MoveDefinition } from "../types/move-definition";
import { BattleEngine } from "./BattleEngine";
import { validateBattleData } from "./validate";

describe("BattleEngine integration", () => {
  it("loads and validates POC data successfully", () => {
    const data = loadData();
    const result = validateBattleData(data);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(data.pokemon.length).toBe(4);
    expect(data.moves.length).toBe(16);
  });

  it("runs a full headless combat cycle", () => {
    const data = loadData();

    const moveRegistry = new Map<string, MoveDefinition>();
    for (const move of data.moves) {
      moveRegistry.set(move.id, move);
    }

    // Bulbasaur (player-1) vs Charmander (player-2) on 8x8 grid
    const bulbasaur = {
      ...MockPokemon.bulbasaur,
      playerId: "player-1",
      position: { x: 1, y: 1 },
    };
    const charmander = {
      ...MockPokemon.charmander,
      playerId: "player-2",
      position: { x: 6, y: 6 },
    };

    const state = MockBattle.stateFrom([bulbasaur, charmander], 8, 8);
    const engine = new BattleEngine(state, moveRegistry);

    // Charmander has higher initiative (65 > 45)
    const gameState = engine.getGameState("player-2");
    expect(gameState.turnOrder[0]).toBe("charmander-1");

    const events: BattleEvent[] = [];
    engine.on(BattleEventType.PokemonMoved, (e) => events.push(e));
    engine.on(BattleEventType.TurnStarted, (e) => events.push(e));
    engine.on(BattleEventType.TurnEnded, (e) => events.push(e));

    const actions = engine.getLegalActions("player-2");
    expect(actions.length).toBeGreaterThan(0);

    const moveActions = actions.filter((a) => a.kind === ActionKind.Move);
    expect(moveActions.length).toBeGreaterThan(0);

    const moveAction = moveActions[0]!;
    expect(moveAction.kind).toBe(ActionKind.Move);

    const result = engine.submitAction("player-2", moveAction);
    expect(result.success).toBe(true);

    const destination = (moveAction as { path: Array<{ x: number; y: number }> }).path.at(-1);
    expect(charmander.position).toEqual(destination);

    // EndTurn for Charmander (Move doesn't end the turn anymore)
    engine.submitAction("player-2", {
      kind: ActionKind.EndTurn,
      pokemonId: "charmander-1",
    });

    // Bulbasaur EndTurn
    const endTurnResult = engine.submitAction("player-1", {
      kind: ActionKind.EndTurn,
      pokemonId: "bulbasaur-1",
    });
    expect(endTurnResult.success).toBe(true);

    expect(state.roundNumber).toBe(2);

    const movedEvents = events.filter((e) => e.type === BattleEventType.PokemonMoved);
    expect(movedEvents.length).toBe(1);
  });

  it("Charmander Ember vs Bulbasaur then Bulbasaur Razor Leaf vs Charmander", () => {
    const data = loadData();
    const moveRegistry = new Map<string, MoveDefinition>();
    for (const move of data.moves) {
      moveRegistry.set(move.id, move);
    }

    const pokemonTypesMap = new Map<string, PokemonType[]>([
      ["bulbasaur", [PokemonType.Grass, PokemonType.Poison]],
      ["charmander", [PokemonType.Fire]],
    ]);

    // Adjacent on 8x8 grid so they can attack each other
    // Bulbasaur gets extra HP to survive Ember (super effective STAB deals ~54 damage)
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: "player-2",
      position: { x: 1, y: 0 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: "player-1",
      position: { x: 0, y: 0 },
      currentHp: 200,
      maxHp: 200,
    });

    const state = MockBattle.stateFrom([bulbasaur, charmander], 8, 8);
    const engine = new BattleEngine(state, moveRegistry, typeChart, pokemonTypesMap);

    // Mock random so accuracy checks always hit
    vi.spyOn(Math, "random").mockReturnValue(0);

    // -- Charmander has higher initiative (65 > 45), plays first --
    expect(state.turnOrder[0]).toBe("charmander-1");

    const bulbasaurHpBefore = state.pokemon.get("bulbasaur-1")!.currentHp;
    const charmanderEmberPpBefore = state.pokemon.get("charmander-1")!.currentPp.ember!;

    // Charmander uses Ember on Bulbasaur (Fire > Grass+Poison = super effective)
    const emberResult = engine.submitAction("player-2", {
      kind: ActionKind.UseMove,
      pokemonId: "charmander-1",
      moveId: "ember",
      targetPosition: { x: 0, y: 0 },
    });

    expect(emberResult.success).toBe(true);

    const emberEvents = emberResult.events.map((e) => e.type);
    expect(emberEvents).toContain(BattleEventType.MoveStarted);
    expect(emberEvents).toContain(BattleEventType.DamageDealt);
    expect(emberEvents).not.toContain(BattleEventType.TurnEnded);
    expect(emberEvents).not.toContain(BattleEventType.TurnStarted);

    // EndTurn for Charmander to advance to Bulbasaur's turn
    engine.submitAction("player-2", {
      kind: ActionKind.EndTurn,
      pokemonId: "charmander-1",
    });

    const bulbasaurHpAfterEmber = state.pokemon.get("bulbasaur-1")!.currentHp;
    expect(bulbasaurHpAfterEmber).toBeLessThan(bulbasaurHpBefore);

    const charmanderEmberPpAfter = state.pokemon.get("charmander-1")!.currentPp.ember!;
    expect(charmanderEmberPpAfter).toBe(charmanderEmberPpBefore - 1);

    const emberDamageEvent = emberResult.events.find(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt,
    );
    // Fire vs Grass+Poison: Fire>Grass = 2x, Fire>Poison = 1x → total 2x
    expect(emberDamageEvent?.effectiveness).toBe(2);
    const emberDamage = emberDamageEvent?.amount;

    // -- Now it's Bulbasaur's turn --
    const charmanderHpBefore = state.pokemon.get("charmander-1")!.currentHp;
    const razorLeafPpBefore = state.pokemon.get("bulbasaur-1")!.currentPp["razor-leaf"]!;

    // Bulbasaur uses Razor Leaf on Charmander (Grass > Fire = not very effective)
    const razorLeafResult = engine.submitAction("player-1", {
      kind: ActionKind.UseMove,
      pokemonId: "bulbasaur-1",
      moveId: "razor-leaf",
      targetPosition: { x: 1, y: 0 },
    });

    expect(razorLeafResult.success).toBe(true);

    const charmanderHpAfter = state.pokemon.get("charmander-1")!.currentHp;
    expect(charmanderHpAfter).toBeLessThan(charmanderHpBefore);

    const razorLeafPpAfter = state.pokemon.get("bulbasaur-1")!.currentPp["razor-leaf"]!;
    expect(razorLeafPpAfter).toBe(razorLeafPpBefore - 1);

    const razorLeafDamageEvent = razorLeafResult.events.find(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt,
    );
    // Grass vs Fire = 0.5x
    expect(razorLeafDamageEvent?.effectiveness).toBe(0.5);
    const razorLeafDamage = razorLeafDamageEvent?.amount;

    // Super effective Ember should deal more damage than not-very-effective Razor Leaf
    expect(emberDamage).toBeGreaterThan(razorLeafDamage);

    // Stat stages should still be at 0 (no boost/debuff used)
    const bulbasaurStages = state.pokemon.get("bulbasaur-1")?.statStages;
    const charmanderStages = state.pokemon.get("charmander-1")?.statStages;
    expect(Object.values(bulbasaurStages!).every((s) => s === 0)).toBe(true);
    expect(Object.values(charmanderStages!).every((s) => s === 0)).toBe(true);

    // EndTurn for Bulbasaur to complete round 1
    engine.submitAction("player-1", {
      kind: ActionKind.EndTurn,
      pokemonId: "bulbasaur-1",
    });

    // Round 2 should have started
    expect(state.roundNumber).toBe(2);

    vi.restoreAllMocks();
  });
});
