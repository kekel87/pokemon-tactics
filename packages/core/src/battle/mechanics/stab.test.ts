import { describe, expect, it } from "vitest";
import { MockPokemon, buildMoveTestEngine } from "../../testing";
import { PlayerId } from "../../enums/player-id";

describe("STAB", () => {
  it("Charmander Ember (Fire move, Fire Pokemon) deals more damage than non-STAB", () => {
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const { engine: charmanderEngine } = buildMoveTestEngine([charmander, bulbasaur]);
    const stabEstimate = charmanderEngine.estimateDamage("charmander-1", "ember", "bulbasaur-1");

    const squirtle = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["ember"],
      currentPp: { ember: 25 },
    });
    const bulbasaur2 = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const { engine: squirtleEngine } = buildMoveTestEngine([squirtle, bulbasaur2]);
    const noStabEstimate = squirtleEngine.estimateDamage("squirtle-1", "ember", "bulbasaur-1");

    expect(stabEstimate).not.toBeNull();
    expect(noStabEstimate).not.toBeNull();
    expect(stabEstimate!.min).toBeGreaterThan(noStabEstimate!.min);
    expect(stabEstimate!.max).toBeGreaterThan(noStabEstimate!.max);
    expect(stabEstimate!.min / noStabEstimate!.min).toBeCloseTo(1.5, 0);
  });

  it("Pidgey Wing Attack (Flying move, Normal/Flying Pokemon) has STAB", () => {
    const pidgey = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const squirtle = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["wing-attack"],
      currentPp: { "wing-attack": 35 },
    });
    const charmander2 = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const { engine: pidgeyEngine } = buildMoveTestEngine([pidgey, charmander]);
    const stabEstimate = pidgeyEngine.estimateDamage("pidgey-1", "wing-attack", "charmander-1");

    const { engine: squirtleEngine } = buildMoveTestEngine([squirtle, charmander2]);
    const noStabEstimate = squirtleEngine.estimateDamage("squirtle-1", "wing-attack", "charmander-1");

    expect(stabEstimate).not.toBeNull();
    expect(noStabEstimate).not.toBeNull();
    expect(stabEstimate!.min).toBeGreaterThan(noStabEstimate!.min);
    expect(stabEstimate!.min / noStabEstimate!.min).toBeCloseTo(1.5, 0);
  });

  it("Charmander Scratch (Normal move, Fire Pokemon) has no STAB", () => {
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const nonFireAttacker = MockPokemon.fresh(MockPokemon.charmander, {
      id: "attacker-nofire",
      definitionId: "test",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
    });
    const bulbasaur2 = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const { engine: charmanderEngine } = buildMoveTestEngine([charmander, bulbasaur]);
    const charmanderEstimate = charmanderEngine.estimateDamage("charmander-1", "scratch", "bulbasaur-1");

    const { engine: noFireEngine } = buildMoveTestEngine([nonFireAttacker, bulbasaur2]);
    const noFireEstimate = noFireEngine.estimateDamage("attacker-nofire", "scratch", "bulbasaur-1");

    expect(charmanderEstimate).not.toBeNull();
    expect(noFireEstimate).not.toBeNull();
    expect(charmanderEstimate!.min).toBe(noFireEstimate!.min);
    expect(charmanderEstimate!.max).toBe(noFireEstimate!.max);
  });
});
