import { describe, expect, it } from "vitest";
import { PlayerId } from "../enums/player-id";
import { MockPokemon } from "../testing";
import { enemyHasStatDecreaseMoveInRange, enemyHasStatusMoveInRange } from "./threat-detection";

describe("threat-detection — enemy stat decrease moves", () => {
  it("detects an enemy with growl within range", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      moveIds: ["growl"],
    });
    expect(enemyHasStatDecreaseMoveInRange([enemy], caster, 5)).toBe(true);
  });

  it("returns false when enemy out of range", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 10, y: 10 },
      moveIds: ["growl"],
    });
    expect(enemyHasStatDecreaseMoveInRange([enemy], caster, 5)).toBe(false);
  });

  it("returns false when enemy has only offensive moves", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      moveIds: ["tackle", "ember"],
    });
    expect(enemyHasStatDecreaseMoveInRange([enemy], caster, 5)).toBe(false);
  });

  it("ignores KO enemies", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      moveIds: ["growl"],
      currentHp: 0,
    });
    expect(enemyHasStatDecreaseMoveInRange([enemy], caster, 5)).toBe(false);
  });
});

describe("threat-detection — enemy status moves", () => {
  it("detects an enemy with spore", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 1 },
      moveIds: ["spore"],
    });
    expect(enemyHasStatusMoveInRange([enemy], caster, 5)).toBe(true);
  });

  it("detects thunder-wave", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      moveIds: ["thunder-wave"],
    });
    expect(enemyHasStatusMoveInRange([enemy], caster, 5)).toBe(true);
  });

  it("returns false for purely offensive enemy", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
    });
    expect(enemyHasStatusMoveInRange([enemy], caster, 5)).toBe(false);
  });
});
