import { describe, expect, it } from "vitest";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("Facing modifier — integration scenarios", () => {
  // Given: Charmander (attacker) is north of Bulbasaur (defender)
  // Bulbasaur's orientation determines the facing zone

  it("back attack deals more damage than flank", () => {
    // Given: Bulbasaur faces South (away from Charmander at north) → Back
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 1 },
    });
    const bulbasaurBack = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      orientation: Direction.South,
    });
    const { engine: backEngine } = buildMoveTestEngine([charmander, bulbasaurBack]);

    // Given: Bulbasaur faces East, Charmander is north → Flank
    const charmander2 = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 1 },
    });
    const bulbasaurFlank = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      orientation: Direction.East,
    });
    const { engine: flankEngine } = buildMoveTestEngine([charmander2, bulbasaurFlank]);

    // When: estimate damage for Ember
    const backEstimate = backEngine.estimateDamage("charmander-1", "ember", "bulbasaur-1");
    const flankEstimate = flankEngine.estimateDamage("charmander-1", "ember", "bulbasaur-1");

    // Then: back attack > flank
    expect(backEstimate).not.toBeNull();
    expect(flankEstimate).not.toBeNull();
    expect(backEstimate!.max).toBeGreaterThan(flankEstimate!.max);
    expect(backEstimate!.facingModifier).toBe(1.15);
    expect(flankEstimate!.facingModifier).toBe(1.0);
  });

  it("front attack deals less damage than flank", () => {
    // Given: Bulbasaur faces North (toward Charmander at north) → Front
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 1 },
    });
    const bulbasaurFront = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      orientation: Direction.North,
    });
    const { engine: frontEngine } = buildMoveTestEngine([charmander, bulbasaurFront]);

    // Given: Bulbasaur faces East, Charmander is north → Flank
    const charmander2 = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 1 },
    });
    const bulbasaurFlank = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      orientation: Direction.East,
    });
    const { engine: flankEngine } = buildMoveTestEngine([charmander2, bulbasaurFlank]);

    // When
    const frontEstimate = frontEngine.estimateDamage("charmander-1", "ember", "bulbasaur-1");
    const flankEstimate = flankEngine.estimateDamage("charmander-1", "ember", "bulbasaur-1");

    // Then: front attack < flank
    expect(frontEstimate).not.toBeNull();
    expect(flankEstimate).not.toBeNull();
    expect(frontEstimate!.max).toBeLessThan(flankEstimate!.max);
    expect(frontEstimate!.facingModifier).toBe(0.85);
  });

  it("flank attack has neutral modifier", () => {
    // Given: Bulbasaur faces West, Charmander is north → Flank
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 2, y: 1 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      orientation: Direction.West,
    });
    const { engine } = buildMoveTestEngine([charmander, bulbasaur]);

    // When
    const estimate = engine.estimateDamage("charmander-1", "ember", "bulbasaur-1");

    // Then
    expect(estimate).not.toBeNull();
    expect(estimate!.facingModifier).toBe(1.0);
  });
});
