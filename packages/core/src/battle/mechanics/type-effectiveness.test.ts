import { describe, expect, it } from "vitest";
import { MockPokemon, buildMoveTestEngine } from "../../testing";
import { PlayerId } from "../../enums/player-id";

describe("type effectiveness", () => {
  it("super effective: Fire vs Grass/Poison deals x2", () => {
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const { engine } = buildMoveTestEngine([charmander, bulbasaur]);
    const estimate = engine.estimateDamage("charmander-1", "ember", "bulbasaur-1");

    expect(estimate).not.toBeNull();
    expect(estimate!.effectiveness).toBe(2);
  });

  it("not very effective: Grass vs Fire deals x0.5", () => {
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const { engine } = buildMoveTestEngine([bulbasaur, charmander]);
    const estimate = engine.estimateDamage("bulbasaur-1", "razor-leaf", "charmander-1");

    expect(estimate).not.toBeNull();
    expect(estimate!.effectiveness).toBe(0.5);
  });

  it("immune: Normal vs Ghost deals x0", () => {
    const squirtle = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const gastly = MockPokemon.fresh(MockPokemon.base, {
      id: "gastly-1",
      definitionId: "gastly",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const { engine } = buildMoveTestEngine([squirtle, gastly]);
    const estimate = engine.estimateDamage("squirtle-1", "tackle", "gastly-1");

    expect(estimate).not.toBeNull();
    expect(estimate!.effectiveness).toBe(0);
    expect(estimate!.min).toBe(0);
    expect(estimate!.max).toBe(0);
  });

  it("double super effective: Grass vs Rock/Ground (Geodude) deals x4", () => {
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const geodude = MockPokemon.fresh(MockPokemon.base, {
      id: "geodude-1",
      definitionId: "geodude",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const { engine } = buildMoveTestEngine([bulbasaur, geodude]);
    const estimate = engine.estimateDamage("bulbasaur-1", "razor-leaf", "geodude-1");

    expect(estimate).not.toBeNull();
    expect(estimate!.effectiveness).toBe(4);
  });

  it("resist: Fire vs Rock (0.5) — deals reduced damage", () => {
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const geodude = MockPokemon.fresh(MockPokemon.base, {
      id: "geodude-1",
      definitionId: "geodude",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const { engine } = buildMoveTestEngine([charmander, geodude]);
    const estimate = engine.estimateDamage("charmander-1", "ember", "geodude-1");

    expect(estimate).not.toBeNull();
    expect(estimate!.effectiveness).toBe(0.5);
  });

  it("immune trumps super effective: Normal vs Ghost/Poison deals x0", () => {
    const squirtle = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const gastly = MockPokemon.fresh(MockPokemon.base, {
      id: "gastly-1",
      definitionId: "gastly",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const { engine } = buildMoveTestEngine([squirtle, gastly]);
    const estimate = engine.estimateDamage("squirtle-1", "tackle", "gastly-1");

    expect(estimate).not.toBeNull();
    expect(estimate!.effectiveness).toBe(0);
    expect(estimate!.min).toBe(0);
  });
});
