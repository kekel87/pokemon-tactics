import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";
import type { PokemonInstance } from "../../types/pokemon-instance";

function fire(foeX: number, allies: PokemonInstance[] = []) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 2, y: 2 },
    moveIds: ["last-respects"],
    currentPp: { "last-respects": 5 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: foeX, y: 2 },
  });
  const { engine } = buildMoveTestEngine([attacker, ...allies, foe], {
    gridSize: 8,
    random: () => 0.5,
  });
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: attacker.id,
    moveId: "last-respects",
    targetPosition: { x: 3, y: 2 },
  });
}

function faintedAlly(id: string, x: number): PokemonInstance {
  return MockPokemon.fresh(MockPokemon.base, {
    id,
    playerId: PlayerId.Player1,
    position: { x, y: 5 },
    currentHp: 0,
  });
}

describe("last-respects", () => {
  it("deals damage to an adjacent foe", () => {
    expect(damageTo(fire(3).events, "foe")).toBeGreaterThan(0);
  });

  it("does not reach a foe two tiles away", () => {
    expect(damageTo(fire(4).events, "foe")).toBe(0);
  });

  it("hits harder as more allies have fainted", () => {
    const none = damageTo(fire(3).events, "foe");
    const one = damageTo(fire(3, [faintedAlly("ally1", 1)]).events, "foe");
    const two = damageTo(fire(3, [faintedAlly("ally1", 1), faintedAlly("ally2", 0)]).events, "foe");
    expect(one).toBeGreaterThan(none);
    expect(two).toBeGreaterThan(one);
  });
});
