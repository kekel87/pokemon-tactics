import { describe, expect, it } from "vitest";
import { Category } from "../enums/category";
import { DefensiveKind } from "../enums/defensive-kind";
import { Direction } from "../enums/direction";
import { TargetingKind } from "../enums/targeting-kind";
import { MockBattle, MockMove, MockPokemon } from "../testing";
import { checkDefense } from "./defense-check";

describe("checkDefense", () => {
  it("returns no effect when defender has no activeDefense", () => {
    const def = MockPokemon.fresh(MockBattle.player1Fast);
    const atk = MockPokemon.fresh(MockBattle.player2Slow, { position: { x: 3, y: 3 } });
    const result = checkDefense(atk, def, MockMove.physical, 30, atk.position);

    expect(result.blocked).toBe(false);
    expect(result.reflectDamage).toBe(0);
    expect(result.endureAtOne).toBe(false);
    expect(result.events).toHaveLength(0);
  });

  describe("Protect / Detect", () => {
    it("blocks attack from front", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        position: { x: 4, y: 3 },
        orientation: Direction.West,
        activeDefense: { kind: DefensiveKind.Protect, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow, { position: { x: 3, y: 3 } });
      const result = checkDefense(atk, def, MockMove.physical, 30, atk.position);

      expect(result.blocked).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        defenseKind: DefensiveKind.Protect,
        blocked: true,
      });
    });

    it("does NOT block attack from behind", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        position: { x: 4, y: 3 },
        orientation: Direction.East,
        activeDefense: { kind: DefensiveKind.Protect, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow, { position: { x: 3, y: 3 } });
      const result = checkDefense(atk, def, MockMove.physical, 30, atk.position);

      expect(result.blocked).toBe(false);
    });

    it("Detect works the same as Protect", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        position: { x: 4, y: 3 },
        orientation: Direction.West,
        activeDefense: { kind: DefensiveKind.Detect, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow, { position: { x: 3, y: 3 } });
      const result = checkDefense(atk, def, MockMove.physical, 30, atk.position);

      expect(result.blocked).toBe(true);
    });

    it("blocks AoE attack from front", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        position: { x: 4, y: 3 },
        orientation: Direction.West,
        activeDefense: { kind: DefensiveKind.Protect, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow, { position: { x: 3, y: 3 } });
      const move = MockMove.fresh(MockMove.physical, {
        targeting: { kind: TargetingKind.Zone, radius: 1 },
      });
      const result = checkDefense(atk, def, move, 50, atk.position);

      expect(result.blocked).toBe(true);
    });

    it("does NOT block Blast when explosion center is behind defender", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        position: { x: 3, y: 3 },
        orientation: Direction.South,
        activeDefense: { kind: DefensiveKind.Protect, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow, { position: { x: 3, y: 4 } });
      const move = MockMove.fresh(MockMove.special, {
        targeting: { kind: TargetingKind.Blast, range: { min: 2, max: 4 }, radius: 1 },
      });
      const blastCenter = { x: 3, y: 2 };
      const result = checkDefense(atk, def, move, 50, blastCenter);

      expect(result.blocked).toBe(false);
    });

    it("blocks Blast when explosion center is in front of defender", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        position: { x: 3, y: 3 },
        orientation: Direction.South,
        activeDefense: { kind: DefensiveKind.Protect, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow, { position: { x: 3, y: 0 } });
      const move = MockMove.fresh(MockMove.special, {
        targeting: { kind: TargetingKind.Blast, range: { min: 2, max: 4 }, radius: 1 },
      });
      const blastCenter = { x: 3, y: 4 };
      const result = checkDefense(atk, def, move, 50, blastCenter);

      expect(result.blocked).toBe(true);
    });
  });

  describe("Wide Guard", () => {
    it("blocks AoE zone attack", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        activeDefense: { kind: DefensiveKind.WideGuard, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow);
      const move = MockMove.fresh(MockMove.physical, {
        targeting: { kind: TargetingKind.Zone, radius: 1 },
      });
      const result = checkDefense(atk, def, move, 50, atk.position);

      expect(result.blocked).toBe(true);
    });

    it("blocks AoE cone attack", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        activeDefense: { kind: DefensiveKind.WideGuard, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow);
      const move = MockMove.fresh(MockMove.physical, {
        targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 3 } },
      });
      const result = checkDefense(atk, def, move, 50, atk.position);

      expect(result.blocked).toBe(true);
    });

    it("blocks AoE cross attack", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        activeDefense: { kind: DefensiveKind.WideGuard, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow);
      const move = MockMove.fresh(MockMove.physical, {
        targeting: { kind: TargetingKind.Cross, size: 3 },
      });
      const result = checkDefense(atk, def, move, 50, atk.position);

      expect(result.blocked).toBe(true);
    });

    it("blocks AoE slash attack", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        activeDefense: { kind: DefensiveKind.WideGuard, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow);
      const move = MockMove.fresh(MockMove.physical, {
        targeting: { kind: TargetingKind.Slash },
      });
      const result = checkDefense(atk, def, move, 50, atk.position);

      expect(result.blocked).toBe(true);
    });

    it("blocks AoE blast attack", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        activeDefense: { kind: DefensiveKind.WideGuard, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow);
      const move = MockMove.fresh(MockMove.physical, {
        targeting: { kind: TargetingKind.Blast, range: { min: 2, max: 4 }, radius: 1 },
      });
      const result = checkDefense(atk, def, move, 50, atk.position);

      expect(result.blocked).toBe(true);
    });

    it("does NOT block single target attack", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        activeDefense: { kind: DefensiveKind.WideGuard, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow);
      const result = checkDefense(atk, def, MockMove.physical, 30, atk.position);

      expect(result.blocked).toBe(false);
      expect(result.events).toHaveLength(0);
    });

    it("does NOT block self-targeting move", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        activeDefense: { kind: DefensiveKind.WideGuard, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow);
      const move = MockMove.fresh(MockMove.physical, {
        targeting: { kind: TargetingKind.Self },
      });
      const result = checkDefense(atk, def, move, 30, atk.position);

      expect(result.blocked).toBe(false);
    });
  });

  describe("Quick Guard", () => {
    it("blocks any attack and is consumed", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        activeDefense: { kind: DefensiveKind.QuickGuard, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow);
      const result = checkDefense(atk, def, MockMove.physical, 30, atk.position);

      expect(result.blocked).toBe(true);
      expect(result.consumeDefense).toBe(true);
    });

    it("blocks special attack too", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        activeDefense: { kind: DefensiveKind.QuickGuard, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow);
      const result = checkDefense(atk, def, MockMove.special, 30, atk.position);

      expect(result.blocked).toBe(true);
      expect(result.consumeDefense).toBe(true);
    });
  });

  describe("Counter", () => {
    it("reflects x2 on adjacent physical attack", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        position: { x: 4, y: 3 },
        activeDefense: { kind: DefensiveKind.Counter, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow, { position: { x: 3, y: 3 } });
      const result = checkDefense(atk, def, MockMove.physical, 30, atk.position);

      expect(result.blocked).toBe(false);
      expect(result.reflectDamage).toBe(60);
    });

    it("does NOT reflect on special attack", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        position: { x: 4, y: 3 },
        activeDefense: { kind: DefensiveKind.Counter, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow, { position: { x: 3, y: 3 } });
      const result = checkDefense(atk, def, MockMove.special, 30, atk.position);

      expect(result.reflectDamage).toBe(0);
    });

    it("does NOT reflect on non-adjacent physical attack", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        position: { x: 4, y: 3 },
        activeDefense: { kind: DefensiveKind.Counter, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow, { position: { x: 1, y: 3 } });
      const result = checkDefense(atk, def, MockMove.physical, 30, atk.position);

      expect(result.reflectDamage).toBe(0);
    });
  });

  describe("Mirror Coat", () => {
    it("reflects x2 on special attack at any range", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        position: { x: 4, y: 3 },
        activeDefense: { kind: DefensiveKind.MirrorCoat, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow, { position: { x: 0, y: 0 } });
      const result = checkDefense(atk, def, MockMove.special, 25, atk.position);

      expect(result.blocked).toBe(false);
      expect(result.reflectDamage).toBe(50);
    });

    it("does NOT reflect on physical attack", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        position: { x: 4, y: 3 },
        activeDefense: { kind: DefensiveKind.MirrorCoat, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow, { position: { x: 3, y: 3 } });
      const result = checkDefense(atk, def, MockMove.physical, 25, atk.position);

      expect(result.reflectDamage).toBe(0);
    });
  });

  describe("Metal Burst", () => {
    it("reflects x1.5 on physical attack", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        activeDefense: { kind: DefensiveKind.MetalBurst, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow);
      const result = checkDefense(atk, def, MockMove.physical, 40, atk.position);

      expect(result.reflectDamage).toBe(60);
    });

    it("reflects x1.5 on special attack", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        activeDefense: { kind: DefensiveKind.MetalBurst, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow);
      const result = checkDefense(atk, def, MockMove.special, 40, atk.position);

      expect(result.reflectDamage).toBe(60);
    });

    it("does NOT reflect on status move", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        activeDefense: { kind: DefensiveKind.MetalBurst, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow);
      const result = checkDefense(atk, def, MockMove.status, 0, atk.position);

      expect(result.reflectDamage).toBe(0);
    });
  });

  describe("Endure", () => {
    it("survives at 1 HP when damage would KO", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        currentHp: 20,
        activeDefense: { kind: DefensiveKind.Endure, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow);
      const result = checkDefense(atk, def, MockMove.physical, 50, atk.position);

      expect(result.endureAtOne).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it("does nothing when damage would not KO", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        currentHp: 100,
        activeDefense: { kind: DefensiveKind.Endure, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow);
      const result = checkDefense(atk, def, MockMove.physical, 30, atk.position);

      expect(result.endureAtOne).toBe(false);
      expect(result.events).toHaveLength(0);
    });

    it("triggers when damage equals current HP", () => {
      const def = MockPokemon.fresh(MockBattle.player1Fast, {
        currentHp: 30,
        activeDefense: { kind: DefensiveKind.Endure, roundApplied: 1, turnIndexApplied: 0 },
      });
      const atk = MockPokemon.fresh(MockBattle.player2Slow);
      const result = checkDefense(atk, def, MockMove.physical, 30, atk.position);

      expect(result.endureAtOne).toBe(true);
    });
  });
});
