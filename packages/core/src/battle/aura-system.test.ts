import { describe, expect, it } from "vitest";
import { AuraKind } from "../enums/aura-kind";
import { PlayerId } from "../enums/player-id";
import { buildMoveTestEngine, MockMove, MockPokemon } from "../testing";
import {
  computeBrickBreakInteraction,
  computeScreenMultiplier,
  findActiveAurasProtectingTarget,
  postAura,
} from "./aura-system";

const physicalMove = MockMove.physical;
const specialMove = MockMove.special;
const statusMove = MockMove.status;
const brickBreakMove = MockMove.fresh(MockMove.physical, {
  id: "brick-break",
  name: "Brick Break",
});

describe("computeScreenMultiplier — Reflect reduces Physical only", () => {
  it("returns 0.5 against a Physical move when target sits in Reflect aura", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 2 },
    });
    const { state } = buildMoveTestEngine([caster, enemy]);
    postAura(state, caster, AuraKind.Reflect);

    expect(computeScreenMultiplier(state, enemy, caster, physicalMove)).toBe(0.5);
  });

  it("returns 1.0 against a Special move when only Reflect is up", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 2 },
    });
    const { state } = buildMoveTestEngine([caster, enemy]);
    postAura(state, caster, AuraKind.Reflect);

    expect(computeScreenMultiplier(state, enemy, caster, specialMove)).toBe(1.0);
  });
});

describe("computeScreenMultiplier — Light Screen reduces Special only", () => {
  it("returns 0.5 against a Special move when target sits in Light Screen aura", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 2 },
    });
    const { state } = buildMoveTestEngine([caster, enemy]);
    postAura(state, caster, AuraKind.LightScreen);

    expect(computeScreenMultiplier(state, enemy, caster, specialMove)).toBe(0.5);
  });

  it("returns 1.0 against a Physical move when only Light Screen is up", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 2 },
    });
    const { state } = buildMoveTestEngine([caster, enemy]);
    postAura(state, caster, AuraKind.LightScreen);

    expect(computeScreenMultiplier(state, enemy, caster, physicalMove)).toBe(1.0);
  });
});

describe("computeScreenMultiplier — protected ally within radius", () => {
  it("returns 0.5 for an ally within r3 of caster", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 8, y: 8 },
    });
    const { state } = buildMoveTestEngine([caster, ally, enemy]);
    postAura(state, caster, AuraKind.Reflect);

    expect(computeScreenMultiplier(state, enemy, ally, physicalMove)).toBe(0.5);
  });
});

describe("computeScreenMultiplier — ally out of range", () => {
  it("returns 1.0 for an ally outside r3 of caster", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const farAlly = MockPokemon.fresh(MockPokemon.base, {
      id: "far-ally",
      playerId: PlayerId.Player1,
      position: { x: 9, y: 9 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 8, y: 8 },
    });
    const { state } = buildMoveTestEngine([caster, farAlly, enemy]);
    postAura(state, caster, AuraKind.Reflect);

    expect(computeScreenMultiplier(state, enemy, farAlly, physicalMove)).toBe(1.0);
  });
});

describe("computeScreenMultiplier — enemy aura excluded", () => {
  it("returns 1.0 when only an opposing-team aura covers the target zone", () => {
    const enemyCaster = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy-caster",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 1 },
    });
    const { state } = buildMoveTestEngine([enemyCaster, target, attacker]);
    postAura(state, enemyCaster, AuraKind.Reflect);

    expect(computeScreenMultiplier(state, attacker, target, physicalMove)).toBe(1.0);
  });
});

describe("computeScreenMultiplier — caster KO removes protection", () => {
  it("returns 1.0 once caster of aura is at 0 HP", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([caster, ally, enemy]);
    postAura(state, caster, AuraKind.Reflect);

    expect(computeScreenMultiplier(state, enemy, ally, physicalMove)).toBe(0.5);
    const liveCaster = state.pokemon.get(caster.id);
    if (liveCaster) {
      liveCaster.currentHp = 0;
    }
    expect(computeScreenMultiplier(state, enemy, ally, physicalMove)).toBe(1.0);
  });
});

describe("computeScreenMultiplier — multi-aura overlap", () => {
  it("returns 0.5 (not 0.25) when two allied Reflect auras overlap", () => {
    const casterA = MockPokemon.fresh(MockPokemon.base, {
      id: "caster-a",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 1 },
    });
    const casterB = MockPokemon.fresh(MockPokemon.base, {
      id: "caster-b",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 8, y: 8 },
    });
    const { state } = buildMoveTestEngine([casterA, casterB, ally, enemy]);
    postAura(state, casterA, AuraKind.Reflect);
    postAura(state, casterB, AuraKind.Reflect);

    expect(computeScreenMultiplier(state, enemy, ally, physicalMove)).toBe(0.5);
  });
});

describe("computeScreenMultiplier — status move bypasses", () => {
  it("returns 1.0 for a Status move regardless of aura presence", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 2 },
    });
    const { state } = buildMoveTestEngine([caster, enemy]);
    postAura(state, caster, AuraKind.Reflect);

    expect(computeScreenMultiplier(state, enemy, caster, statusMove)).toBe(1.0);
  });
});

describe("computeScreenMultiplier — allied attacker bypasses", () => {
  it("returns 1.0 when attacker is on the same team as target", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
    });
    const { state } = buildMoveTestEngine([caster, ally]);
    postAura(state, caster, AuraKind.Reflect);

    expect(computeScreenMultiplier(state, ally, caster, physicalMove)).toBe(1.0);
  });
});

describe("findActiveAurasProtectingTarget — caster protects itself", () => {
  it("includes caster's own aura when target is the caster", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const { state } = buildMoveTestEngine([caster]);
    postAura(state, caster, AuraKind.Reflect);

    const auras = findActiveAurasProtectingTarget(state, caster);
    expect(auras).toHaveLength(1);
    expect(auras[0]?.casterPokemonId).toBe(caster.id);
  });
});

describe("computeBrickBreakInteraction — vs caster", () => {
  it("returns ×2 multiplier and break flag when target is own caster (any distance)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
    });
    const { state } = buildMoveTestEngine([caster, attacker]);
    postAura(state, caster, AuraKind.Reflect);

    const result = computeBrickBreakInteraction(state, caster, brickBreakMove);
    expect(result.multiplier).toBe(2.0);
    expect(result.breakAuraCasterId).toBe(caster.id);
  });
});

describe("computeBrickBreakInteraction — vs protected ally (not caster)", () => {
  it("returns 1.0 multiplier and null break id (only caster of aura breaks it)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
    });
    const { state } = buildMoveTestEngine([caster, ally, attacker]);
    postAura(state, caster, AuraKind.Reflect);

    const result = computeBrickBreakInteraction(state, ally, brickBreakMove);
    expect(result.multiplier).toBe(1.0);
    expect(result.breakAuraCasterId).toBeNull();
  });
});

describe("computeBrickBreakInteraction — no aura present", () => {
  it("returns 1.0 multiplier and null break id when target has no protecting aura", () => {
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
    });
    const { state } = buildMoveTestEngine([target, attacker]);

    const result = computeBrickBreakInteraction(state, target, brickBreakMove);
    expect(result.multiplier).toBe(1.0);
    expect(result.breakAuraCasterId).toBeNull();
  });
});

describe("computeBrickBreakInteraction — non brick-break move", () => {
  it("returns 1.0 multiplier and null break id for a regular Physical move", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
    });
    const { state } = buildMoveTestEngine([caster, attacker]);
    postAura(state, caster, AuraKind.Reflect);

    const result = computeBrickBreakInteraction(state, caster, physicalMove);
    expect(result.multiplier).toBe(1.0);
    expect(result.breakAuraCasterId).toBeNull();
  });
});

describe("computeBrickBreakInteraction — double-protected target", () => {
  it("returns ×2 and breaks target's own aura when target carries its own (ally aura intact)", () => {
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally-caster",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 1 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
    });
    const { state } = buildMoveTestEngine([ally, target, attacker]);
    postAura(state, ally, AuraKind.Reflect);
    postAura(state, target, AuraKind.Reflect);

    const result = computeBrickBreakInteraction(state, target, brickBreakMove);
    expect(result.multiplier).toBe(2.0);
    expect(result.breakAuraCasterId).toBe(target.id);
  });
});
