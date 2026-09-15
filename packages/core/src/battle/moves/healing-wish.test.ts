import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("healing-wish", () => {
  it("revives a KO'd ally to 50% HP, clears status, and KOs the caster", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["healing-wish"],
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
      currentHp: 0,
      maxHp: 200,
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 1 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "healing-wish",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("ally")?.currentHp).toBe(100);
    expect(state.pokemon.get("ally")?.statusEffects).toEqual([]);
    expect(state.pokemon.get("user")?.currentHp).toBe(0);
    expect(result.events.some((e) => e.type === BattleEventType.PokemonRevived)).toBe(true);
  });

  it("fully heals a living ally to 100% and KOs the caster", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["healing-wish"],
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
      currentHp: 40,
      maxHp: 200,
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 1 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "healing-wish",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("ally")?.currentHp).toBe(200);
    expect(state.pokemon.get("user")?.currentHp).toBe(0);
  });

  it("whiffs on an empty tile but the caster still faints", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["healing-wish"],
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 1 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "healing-wish",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.ReviveOrHealFailed)).toBe(true);
    expect(state.pokemon.get("user")?.currentHp).toBe(0);
  });
});

describe("Vœu Soin — un camp rayé ne revient pas (plan 210, lot D0)", () => {
  function scene(options: { reviveDefeatedCamps: boolean }) {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["healing-wish"],
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      currentHp: 0,
      maxHp: 200,
    });
    const third = MockPokemon.fresh(MockPokemon.base, {
      id: "third",
      playerId: PlayerId.Player3,
      position: { x: 6, y: 6 },
      derivedStats: { movement: 3, jump: 1, initiative: 1 },
    });
    const built = buildMoveTestEngine([caster, foe, third]);
    built.state.reviveDefeatedCamps = options.reviveDefeatedCamps;
    return built;
  }

  it("en ligne, viser le dernier mort d'un camp rayé échoue", () => {
    const { engine, state } = scene({ reviveDefeatedCamps: false });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "healing-wish",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBe(0);
    expect(result.events.some((e) => e.type === BattleEventType.PokemonRevived)).toBe(false);
    expect(result.events.some((e) => e.type === BattleEventType.ReviveOrHealFailed)).toBe(true);
  });

  it("le lanceur meurt quand même — le sacrifice est payé d'avance", () => {
    const { engine, state } = scene({ reviveDefeatedCamps: false });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "healing-wish",
      targetPosition: { x: 3, y: 2 },
    });

    expect(state.pokemon.get("user")?.currentHp).toBe(0);
  });

  it("en local, le même geste ramène le camp rayé", () => {
    const { engine, state } = scene({ reviveDefeatedCamps: true });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "healing-wish",
      targetPosition: { x: 3, y: 2 },
    });

    expect(state.pokemon.get("foe")?.currentHp).toBe(100);
  });

  it("réanimer son propre dernier coéquipier reste permis, le lanceur comptant pour son camp", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["healing-wish"],
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
      currentHp: 0,
      maxHp: 200,
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 6, y: 6 },
      derivedStats: { movement: 3, jump: 1, initiative: 1 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally, foe]);
    state.reviveDefeatedCamps = false;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "healing-wish",
      targetPosition: { x: 3, y: 2 },
    });

    expect(state.pokemon.get("ally")?.currentHp).toBe(100);
  });
});
