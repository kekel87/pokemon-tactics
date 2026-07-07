import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function damageWithOrientation(orientation: Direction): number {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["pursuit"],
    currentPp: { pursuit: 5 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    orientation,
    currentHp: 200,
    maxHp: 200,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { engine, state } = buildMoveTestEngine([caster, foe], { random: () => 0.5 });
  engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: "caster",
    moveId: "pursuit",
    targetPosition: { x: 1, y: 0 },
  });
  return 200 - (state.pokemon.get("foe")?.currentHp ?? 0);
}

describe("pursuit", () => {
  it("deals ×2 more when hitting the target from behind than from the front", () => {
    const backDamage = damageWithOrientation(Direction.East);
    const frontDamage = damageWithOrientation(Direction.West);

    expect(backDamage).toBeGreaterThan(frontDamage * 2);
  });
});
