import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { Action } from "../../types/action";

function usableMoveIds(actions: Action[]): Set<string> {
  const ids = new Set<string>();
  for (const action of actions) {
    if (action.kind === ActionKind.UseMove) {
      ids.add(action.moveId);
    }
  }
  return ids;
}

describe("psychic-noise (Dissonance Psy)", () => {
  it("deals damage and applies Heal Block for 2 turns", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["psychic-noise"],
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
    });
    const { engine, state } = buildMoveTestEngine([attacker, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "psychic-noise",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.DamageDealt)).toBe(true);
    const healBlock = state.pokemon
      .get("target")
      ?.volatileStatuses.find((v) => v.type === StatusType.HealBlocked);
    expect(healBlock?.remainingTurns).toBe(2);
  });

  it("hides healing moves from a Heal-Blocked mon", () => {
    const blocked = MockPokemon.fresh(MockPokemon.base, {
      id: "blocked",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["recover", "ember"],
      volatileStatuses: [{ type: StatusType.HealBlocked, remainingTurns: 2 }],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
    });
    const { engine } = buildMoveTestEngine([blocked, enemy]);

    const usable = usableMoveIds(engine.getLegalActions(PlayerId.Player1));

    expect(usable.has("recover")).toBe(false);
    expect(usable.has("ember")).toBe(true);
  });

  it("suppresses the heal of a drain move but keeps the damage", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: 40,
      moveIds: ["leech-life"],
      volatileStatuses: [{ type: StatusType.HealBlocked, remainingTurns: 2 }],
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
    });
    const { engine, state } = buildMoveTestEngine([attacker, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "leech-life",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.events.some((e) => e.type === BattleEventType.DamageDealt)).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.HealPrevented)).toBe(true);
    expect(state.pokemon.get("attacker")?.currentHp).toBe(40);
  });

  it("bypasses Substitute (sound move): damages real HP and still applies Heal Block", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["psychic-noise"],
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
      substituteHp: 25,
    });
    const { engine, state } = buildMoveTestEngine([attacker, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "psychic-noise",
      targetPosition: { x: 1, y: 0 },
    });

    const updated = state.pokemon.get("target");
    expect(updated?.substituteHp).toBe(25);
    expect(updated?.currentHp).toBeLessThan(updated?.maxHp ?? 0);
    expect(updated?.volatileStatuses.some((v) => v.type === StatusType.HealBlocked)).toBe(true);
  });
});
