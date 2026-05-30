import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../enums/action-error";
import { ActionKind } from "../enums/action-kind";
import { AuraKind } from "../enums/aura-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { PlayerId } from "../enums/player-id";
import { StatusType } from "../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import { postAura } from "./aura-system";

describe("Taunt — disrupts status moves for 3 turns", () => {
  it("applies Taunted volatile with 3 remaining turns", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["taunt"],
      currentPp: { taunt: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["recover", "tackle"],
      currentPp: { recover: 10, tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });

    const { engine, state } = buildMoveTestEngine([attacker, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "taunt",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const statusEvent = result.events.find(
      (e) =>
        e.type === BattleEventType.StatusApplied &&
        e.targetId === "target" &&
        e.status === StatusType.Taunted,
    );
    expect(statusEvent).toBeDefined();

    const targetAfter = state.pokemon.get("target");
    const tauntVolatile = targetAfter?.volatileStatuses.find((v) => v.type === StatusType.Taunted);
    expect(tauntVolatile).toBeDefined();
    expect(tauntVolatile?.remainingTurns).toBe(3);

    vi.restoreAllMocks();
  });

  it("blocks status moves while Taunted", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
      volatileStatuses: [{ type: StatusType.Taunted, remainingTurns: 3 }],
    });
    const dummy = MockPokemon.fresh(MockPokemon.base, {
      id: "dummy",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 1 },
    });
    const tauntedCaster = MockPokemon.fresh(MockPokemon.base, {
      id: "taunted",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      moveIds: ["recover", "tackle"],
      currentPp: { recover: 10, tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Taunted, remainingTurns: 3 }],
    });

    const { engine } = buildMoveTestEngine([tauntedCaster, attacker, dummy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "taunted",
      moveId: "recover",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidAction);
    const blockedEvent = result.events.find(
      (e) => e.type === BattleEventType.TauntBlocked && e.pokemonId === "taunted",
    );
    expect(blockedEvent).toBeDefined();
  });

  it("allows offensive moves while Taunted", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const tauntedCaster = MockPokemon.fresh(MockPokemon.base, {
      id: "taunted",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Taunted, remainingTurns: 3 }],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });

    const { engine } = buildMoveTestEngine([tauntedCaster, enemy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "taunted",
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const damageEvent = result.events.find(
      (e) => e.type === BattleEventType.DamageDealt && e.targetId === "enemy",
    );
    expect(damageEvent).toBeDefined();

    vi.restoreAllMocks();
  });

  it("getLegalActions filters status moves when Taunted", () => {
    const tauntedCaster = MockPokemon.fresh(MockPokemon.base, {
      id: "taunted",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["recover", "tackle"],
      currentPp: { recover: 10, tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Taunted, remainingTurns: 3 }],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });

    const { engine } = buildMoveTestEngine([tauntedCaster, enemy]);
    const actions = engine.getLegalActions(PlayerId.Player1);

    const useMoveActions = actions.filter((a) => a.kind === ActionKind.UseMove);
    const recoverActions = useMoveActions.filter(
      (a) => a.kind === ActionKind.UseMove && a.moveId === "recover",
    );
    const tackleActions = useMoveActions.filter(
      (a) => a.kind === ActionKind.UseMove && a.moveId === "tackle",
    );

    expect(recoverActions.length).toBe(0);
    expect(tackleActions.length).toBeGreaterThan(0);
  });

  it("decrements remainingTurns at EndTurn and expires after 3 turns", () => {
    const tauntedCaster = MockPokemon.fresh(MockPokemon.base, {
      id: "taunted",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Taunted, remainingTurns: 3 }],
    });
    const dummy = MockPokemon.fresh(MockPokemon.base, {
      id: "dummy",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 1 },
    });

    const { engine, state } = buildMoveTestEngine([tauntedCaster, dummy]);

    for (let turn = 0; turn < 3; turn++) {
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "taunted",
        direction: tauntedCaster.orientation,
      });
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: "dummy",
        direction: dummy.orientation,
      });
    }

    const targetAfter = state.pokemon.get("taunted");
    const stillTaunted = targetAfter?.volatileStatuses.some((v) => v.type === StatusType.Taunted);
    expect(stillTaunted).toBe(false);
  });

  it("Taunt bypasses Substitute (canon — bypasssub flag)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["taunt"],
      currentPp: { taunt: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
      substituteHp: 25,
    });

    const { engine, state } = buildMoveTestEngine([attacker, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "taunt",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);

    const targetAfter = state.pokemon.get("target");
    const isTaunted = targetAfter?.volatileStatuses.some((v) => v.type === StatusType.Taunted);
    expect(isTaunted).toBe(true);
    expect(targetAfter?.substituteHp).toBe(25);

    vi.restoreAllMocks();
  });

  it("Safeguard does NOT block Taunt (canon Showdown)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const safeguardCaster = MockPokemon.fresh(MockPokemon.base, {
      id: "safeguard-caster",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["taunt"],
      currentPp: { taunt: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([attacker, target, safeguardCaster]);
    postAura(state, safeguardCaster, AuraKind.Safeguard);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "taunt",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const targetAfter = state.pokemon.get("target");
    const isTaunted = targetAfter?.volatileStatuses.some((v) => v.type === StatusType.Taunted);
    expect(isTaunted).toBe(true);

    vi.restoreAllMocks();
  });

  it("KO event fires when Taunted Pokemon is killed", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 1,
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
      volatileStatuses: [{ type: StatusType.Taunted, remainingTurns: 3 }],
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });

    const { engine, state } = buildMoveTestEngine([attacker, target, ally]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    const koEvent = result.events.find(
      (e) => e.type === BattleEventType.PokemonKo && e.pokemonId === "target",
    );
    expect(koEvent).toBeDefined();
    expect(state.pokemon.get("target")?.currentHp).toBe(0);

    vi.restoreAllMocks();
  });
});
