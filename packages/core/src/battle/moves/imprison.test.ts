import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockBattle, MockPokemon } from "../../testing";
import type { Action } from "../../types/action";
import { collectImprisonedMoveIds } from "../imprison-system";

function usableMoveIds(actions: Action[]): Set<string> {
  const ids = new Set<string>();
  for (const action of actions) {
    if (action.kind === ActionKind.UseMove) {
      ids.add(action.moveId);
    }
  }
  return ids;
}

describe("imprison (Possessif)", () => {
  it("posts the persistent Imprisoning volatile on the caster", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["imprison", "tackle"],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      moveIds: ["tackle"],
    });
    const { engine, state } = buildMoveTestEngine([caster, enemy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "imprison",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.Imprisoned)).toBe(true);
    expect(
      state.pokemon.get("caster")?.volatileStatuses.some((v) => v.type === StatusType.Imprisoning),
    ).toBe(true);
  });

  it("fails when the caster is already imprisoning", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["imprison"],
      volatileStatuses: [{ type: StatusType.Imprisoning, remainingTurns: -1 }],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      moveIds: ["tackle"],
    });
    const { engine } = buildMoveTestEngine([caster, enemy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "imprison",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.events.some((e) => e.type === BattleEventType.ImprisonFailed)).toBe(true);
  });

  it("seals a shared move on the enemy but leaves non-shared moves usable", () => {
    const imprisoner = MockPokemon.fresh(MockPokemon.base, {
      id: "imprisoner",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      moveIds: ["ember"],
      volatileStatuses: [{ type: StatusType.Imprisoning, remainingTurns: -1 }],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      moveIds: ["ember", "tackle"],
    });
    const { engine } = buildMoveTestEngine([imprisoner, enemy], { activePokemonId: "enemy" });

    const usable = usableMoveIds(engine.getLegalActions(PlayerId.Player2));

    expect(usable.has("ember")).toBe(false);
    expect(usable.has("tackle")).toBe(true);
  });

  it("blocks the shared move at execution time", () => {
    const imprisoner = MockPokemon.fresh(MockPokemon.base, {
      id: "imprisoner",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      moveIds: ["ember"],
      volatileStatuses: [{ type: StatusType.Imprisoning, remainingTurns: -1 }],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      moveIds: ["ember"],
    });
    const { engine } = buildMoveTestEngine([imprisoner, enemy], { activePokemonId: "enemy" });

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "ember",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(false);
  });

  it("collectImprisonedMoveIds ignores a fainted imprisoner", () => {
    const imprisoner = MockPokemon.fresh(MockPokemon.base, {
      id: "imprisoner",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      currentHp: 0,
      moveIds: ["ember"],
      volatileStatuses: [{ type: StatusType.Imprisoning, remainingTurns: -1 }],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      moveIds: ["ember"],
    });
    const state = MockBattle.stateFrom([imprisoner, enemy], 6, 6);

    expect(collectImprisonedMoveIds(state, PlayerId.Player2).size).toBe(0);
  });
});
