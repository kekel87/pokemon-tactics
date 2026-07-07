import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { SemiInvulnerableState } from "../../types/semi-invulnerable-state";
import { isEffectivelyGrounded } from "../field-global-system";

function setup(overrides: Partial<Parameters<typeof MockPokemon.fresh>[1]> = {}) {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["smack-down"],
    currentPp: { "smack-down": 5 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    definitionId: "pidgey",
    position: { x: 1, y: 0 },
    currentHp: 100,
    maxHp: 100,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
    ...overrides,
  });
  return buildMoveTestEngine([caster, foe]);
}

describe("smack-down", () => {
  it("grounds a Flying target and emits the event", () => {
    const { engine, state } = setup();

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "smack-down",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.SmackedDown);
    const foe = state.pokemon.get("foe");
    expect(foe?.smackedDown).toBe(true);
    expect(foe && isEffectivelyGrounded(state, foe)).toBe(true);
  });

  it("cancels a Flying charge fully, forcing the target back down without a stuck charge", () => {
    const { engine, state } = setup({
      semiInvulnerableState: SemiInvulnerableState.Flying,
      chargingMove: { moveId: "fly" },
      lockedMoveId: "fly",
    });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "smack-down",
      targetPosition: { x: 1, y: 0 },
    });

    const foe = state.pokemon.get("foe");
    expect(foe?.semiInvulnerableState).toBeUndefined();
    expect(foe?.chargingMove).toBeUndefined();
    expect(foe?.lockedMoveId).toBeUndefined();
  });
});
