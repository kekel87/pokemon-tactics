import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

// Boue-Bombe (mud-bomb) — Ground, Special, single + 30% Accuracy -1 (Nature Power swamp target)

function setup(random: () => number) {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 1, y: 1 },
    moveIds: ["mud-bomb"],
    currentPp: { "mud-bomb": 10 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const target = MockPokemon.fresh(MockPokemon.base, {
    id: "target",
    playerId: PlayerId.Player2,
    position: { x: 3, y: 1 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { engine, state } = buildMoveTestEngine([caster, target], { gridSize: 6, random });
  return { engine, state, caster, target };
}

describe("mud-bomb", () => {
  it("deals damage to a single target in range", () => {
    const { engine, state, caster, target } = setup(() => 0.5);
    const before = target.currentHp;
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "mud-bomb",
      targetPosition: { x: 3, y: 1 },
    });
    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(target.id)?.currentHp).toBeLessThan(before);
  });

  it("lowers the target's Accuracy by one stage on the 30% secondary (low roll)", () => {
    const { engine, state, caster } = setup(() => 0.01);
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "mud-bomb",
      targetPosition: { x: 3, y: 1 },
    });
    expect(state.pokemon.get("target")?.statStages[StatName.Accuracy]).toBe(-1);
  });

  it("does not lower Accuracy when the secondary fails (high roll)", () => {
    const { engine, state, caster } = setup(() => 0.99);
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "mud-bomb",
      targetPosition: { x: 3, y: 1 },
    });
    expect(state.pokemon.get("target")?.statStages[StatName.Accuracy]).toBe(0);
  });
});
