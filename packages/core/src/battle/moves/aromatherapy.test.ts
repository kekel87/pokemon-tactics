import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("aromatherapy", () => {
  it("cures major status of allies within radius 2 (including self)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["aromatherapy"],
      currentPp: { aromatherapy: 5 },
      statusEffects: [{ type: StatusType.Burned, remainingTurns: 3 }],
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const allyNear = MockPokemon.fresh(MockPokemon.base, {
      id: "ally-near",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
      statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: 3 }],
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      statusEffects: [{ type: StatusType.Poisoned, remainingTurns: 5 }],
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, allyNear, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "aromatherapy",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.StatusRemoved);
    expect(state.pokemon.get(caster.id)?.statusEffects).toHaveLength(0);
    expect(state.pokemon.get(allyNear.id)?.statusEffects).toHaveLength(0);
    // Foe's Poison untouched
    expect(state.pokemon.get(foe.id)?.statusEffects).toHaveLength(1);
  });

  it("does not cure volatile statuses like confusion", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["aromatherapy"],
      currentPp: { aromatherapy: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const allyConfused = MockPokemon.fresh(MockPokemon.base, {
      id: "ally-confused",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      statusEffects: [{ type: StatusType.Burned, remainingTurns: 3 }],
      volatileStatuses: [{ type: StatusType.Confused, remainingTurns: 2 }],
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, allyConfused, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "aromatherapy",
      targetPosition: { x: 0, y: 0 },
    });

    // Burn cured
    expect(state.pokemon.get(allyConfused.id)?.statusEffects).toHaveLength(0);
    // Confusion volatile still active
    expect(
      state.pokemon
        .get(allyConfused.id)
        ?.volatileStatuses.some((v) => v.type === StatusType.Confused),
    ).toBe(true);
  });

  it("does not affect allies outside radius 2", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["aromatherapy"],
      currentPp: { aromatherapy: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const allyFar = MockPokemon.fresh(MockPokemon.base, {
      id: "ally-far",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 0 },
      statusEffects: [{ type: StatusType.Burned, remainingTurns: 3 }],
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, allyFar, foe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "aromatherapy",
      targetPosition: { x: 0, y: 0 },
    });

    // allyFar at distance 3 — not cured
    expect(state.pokemon.get(allyFar.id)?.statusEffects).toHaveLength(1);
  });

  it("is a no-op when no ally has a major status", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["aromatherapy"],
      currentPp: { aromatherapy: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([caster, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "aromatherapy",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.StatusRemoved);
  });
});
