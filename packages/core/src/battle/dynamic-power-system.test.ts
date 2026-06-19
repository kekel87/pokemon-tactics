import { describe, expect, it } from "vitest";
import type { DynamicPowerKind as DynamicPowerKindT } from "../enums/dynamic-power-kind";
import { DynamicPowerKind } from "../enums/dynamic-power-kind";
import { HeldItemId } from "../enums/held-item-id";
import { PlayerId } from "../enums/player-id";
import { StatName } from "../enums/stat-name";
import type { StatusType as StatusTypeT } from "../enums/status-type";
import { StatusType } from "../enums/status-type";
import { MockBattle } from "../testing/mock-battle";
import { MockMove } from "../testing/mock-move";
import { MockPokemon } from "../testing/mock-pokemon";
import type { PokemonInstance } from "../types/pokemon-instance";
import { resolveDynamicPower } from "./dynamic-power-system";

function pokemon(overrides: Partial<PokemonInstance> = {}): PokemonInstance {
  return {
    ...MockPokemon.base,
    statStages: { ...MockPokemon.base.statStages },
    statusEffects: [],
    ...overrides,
  };
}

function withStatus(...types: StatusTypeT[]): PokemonInstance {
  return pokemon({
    statusEffects: types.map((type) => ({ type, remainingTurns: null })),
  });
}

function move(kind: DynamicPowerKindT, power: number) {
  return MockMove.fresh(MockMove.physical, { power, dynamicPower: { kind } });
}

function resolvedPower(
  kind: DynamicPowerKindT,
  power: number,
  attacker: PokemonInstance,
  target: PokemonInstance,
): number {
  return resolveDynamicPower(move(kind, power), attacker, target).power;
}

describe("resolveDynamicPower", () => {
  it("returns the move unchanged when no dynamicPower is set", () => {
    const m = MockMove.physical;
    expect(resolveDynamicPower(m, pokemon(), pokemon())).toBe(m);
  });

  it("never returns a power below 1", () => {
    const attacker = pokemon({ currentHp: 0, maxHp: 100 });
    expect(resolvedPower(DynamicPowerKind.SelfHpScaled, 150, attacker, pokemon())).toBe(1);
  });

  describe("SelfStatusDouble (facade)", () => {
    it("doubles when the user has a major status", () => {
      expect(
        resolvedPower(
          DynamicPowerKind.SelfStatusDouble,
          70,
          withStatus(StatusType.Burned),
          pokemon(),
        ),
      ).toBe(140);
    });
    it("stays at base without a major status", () => {
      expect(resolvedPower(DynamicPowerKind.SelfStatusDouble, 70, pokemon(), pokemon())).toBe(70);
    });
    it("ignores volatile-only status (confused)", () => {
      expect(
        resolvedPower(
          DynamicPowerKind.SelfStatusDouble,
          70,
          withStatus(StatusType.Confused),
          pokemon(),
        ),
      ).toBe(70);
    });
  });

  describe("TargetStatusDouble (hex)", () => {
    it("doubles when the target has any major status", () => {
      expect(
        resolvedPower(
          DynamicPowerKind.TargetStatusDouble,
          65,
          pokemon(),
          withStatus(StatusType.Asleep),
        ),
      ).toBe(130);
    });
    it("stays at base when the target is healthy", () => {
      expect(resolvedPower(DynamicPowerKind.TargetStatusDouble, 65, pokemon(), pokemon())).toBe(65);
    });
    it("ignores a volatile-only status on the target", () => {
      expect(
        resolvedPower(
          DynamicPowerKind.TargetStatusDouble,
          65,
          pokemon(),
          withStatus(StatusType.Confused),
        ),
      ).toBe(65);
    });
  });

  describe("TargetPoisonedDouble (venoshock)", () => {
    it("doubles for poison", () => {
      expect(
        resolvedPower(
          DynamicPowerKind.TargetPoisonedDouble,
          65,
          pokemon(),
          withStatus(StatusType.Poisoned),
        ),
      ).toBe(130);
    });
    it("doubles for badly poisoned", () => {
      expect(
        resolvedPower(
          DynamicPowerKind.TargetPoisonedDouble,
          65,
          pokemon(),
          withStatus(StatusType.BadlyPoisoned),
        ),
      ).toBe(130);
    });
    it("stays at base for burn", () => {
      expect(
        resolvedPower(
          DynamicPowerKind.TargetPoisonedDouble,
          65,
          pokemon(),
          withStatus(StatusType.Burned),
        ),
      ).toBe(65);
    });
  });

  describe("NoHeldItemDouble (acrobatics)", () => {
    it("doubles when holding no item", () => {
      expect(
        resolvedPower(
          DynamicPowerKind.NoHeldItemDouble,
          55,
          pokemon({ heldItemId: undefined }),
          pokemon(),
        ),
      ).toBe(110);
    });
    it("stays at base when holding an item", () => {
      const holding = pokemon({ heldItemId: HeldItemId.Leftovers });
      expect(resolvedPower(DynamicPowerKind.NoHeldItemDouble, 55, holding, pokemon())).toBe(55);
    });
  });

  describe("StoredPower", () => {
    it("is 20 with no boosts", () => {
      expect(resolvedPower(DynamicPowerKind.StoredPower, 20, pokemon(), pokemon())).toBe(20);
    });
    it("adds 20 per positive stage and ignores negatives", () => {
      const attacker = pokemon();
      attacker.statStages[StatName.Attack] = 2;
      attacker.statStages[StatName.Speed] = 1;
      attacker.statStages[StatName.Defense] = -3;
      expect(resolvedPower(DynamicPowerKind.StoredPower, 20, attacker, pokemon())).toBe(
        20 + 20 * 3,
      );
    });
  });

  describe("SpeedRatio (electro-ball)", () => {
    function speeds(self: number, target: number) {
      const attacker = pokemon();
      attacker.combatStats = { ...attacker.combatStats, speed: self };
      const t = pokemon();
      t.combatStats = { ...t.combatStats, speed: target };
      return resolvedPower(DynamicPowerKind.SpeedRatio, 0, attacker, t);
    }
    it("150 when 4x or faster", () => expect(speeds(200, 50)).toBe(150));
    it("120 when 3x", () => expect(speeds(150, 50)).toBe(120));
    it("80 when 2x", () => expect(speeds(100, 50)).toBe(80));
    it("60 when faster or equal", () => expect(speeds(60, 50)).toBe(60));
    it("40 when slower", () => expect(speeds(40, 50)).toBe(40));
    it("150 when target speed is 0", () => expect(speeds(50, 0)).toBe(150));
  });

  describe("SpeedRatioInverse (gyro-ball)", () => {
    function speeds(self: number, target: number) {
      const attacker = pokemon();
      attacker.combatStats = { ...attacker.combatStats, speed: self };
      const t = pokemon();
      t.combatStats = { ...t.combatStats, speed: target };
      return resolvedPower(DynamicPowerKind.SpeedRatioInverse, 0, attacker, t);
    }
    it("includes the +1 at equal speed", () => expect(speeds(50, 50)).toBe(26));
    it("caps at 150", () => expect(speeds(10, 100)).toBe(150));
    it("returns 1 when the user has 0 speed", () => expect(speeds(0, 50)).toBe(1));
  });

  describe("LowHpSelf (flail / reversal)", () => {
    function hp(current: number, max = 100) {
      return resolvedPower(
        DynamicPowerKind.LowHpSelf,
        0,
        pokemon({ currentHp: current, maxHp: max }),
        pokemon(),
      );
    }
    it("200 at critical HP", () => expect(hp(1)).toBe(200));
    it("150 just above", () => expect(hp(8)).toBe(150));
    it("100 at low HP", () => expect(hp(15)).toBe(100));
    it("80 below a third", () => expect(hp(30)).toBe(80));
    it("40 around two thirds", () => expect(hp(60)).toBe(40));
    it("20 at full HP", () => expect(hp(100)).toBe(20));
  });

  describe("TargetHpHalfDouble (brine)", () => {
    it("doubles at or below half HP", () => {
      expect(
        resolvedPower(
          DynamicPowerKind.TargetHpHalfDouble,
          65,
          pokemon(),
          pokemon({ currentHp: 50, maxHp: 100 }),
        ),
      ).toBe(130);
    });
    it("stays at base above half HP", () => {
      expect(
        resolvedPower(
          DynamicPowerKind.TargetHpHalfDouble,
          65,
          pokemon(),
          pokemon({ currentHp: 51, maxHp: 100 }),
        ),
      ).toBe(65);
    });
  });

  describe("TargetHpScaled (hard-press)", () => {
    it("is 100 at full target HP", () => {
      expect(
        resolvedPower(
          DynamicPowerKind.TargetHpScaled,
          0,
          pokemon(),
          pokemon({ currentHp: 100, maxHp: 100 }),
        ),
      ).toBe(100);
    });
    it("scales down with target HP", () => {
      expect(
        resolvedPower(
          DynamicPowerKind.TargetHpScaled,
          0,
          pokemon(),
          pokemon({ currentHp: 40, maxHp: 100 }),
        ),
      ).toBe(40);
    });
    it("clamps to 1 at minimal HP", () => {
      expect(
        resolvedPower(
          DynamicPowerKind.TargetHpScaled,
          0,
          pokemon(),
          pokemon({ currentHp: 1, maxHp: 1000 }),
        ),
      ).toBe(1);
    });
  });

  describe("SelfHpScaled (water-spout)", () => {
    it("is 150 at full HP", () => {
      expect(
        resolvedPower(
          DynamicPowerKind.SelfHpScaled,
          150,
          pokemon({ currentHp: 100, maxHp: 100 }),
          pokemon(),
        ),
      ).toBe(150);
    });
    it("scales down with HP", () => {
      expect(
        resolvedPower(
          DynamicPowerKind.SelfHpScaled,
          150,
          pokemon({ currentHp: 50, maxHp: 100 }),
          pokemon(),
        ),
      ).toBe(75);
    });
  });

  describe("TargetWeight (low-kick / grass-knot)", () => {
    function weight(kg: number) {
      return resolvedPower(DynamicPowerKind.TargetWeight, 0, pokemon(), pokemon({ weight: kg }));
    }
    it("120 at 200kg or more", () => expect(weight(200)).toBe(120));
    it("100 from 100kg", () => expect(weight(100)).toBe(100));
    it("80 from 50kg", () => expect(weight(50)).toBe(80));
    it("60 from 25kg", () => expect(weight(25)).toBe(60));
    it("40 from 10kg", () => expect(weight(10)).toBe(40));
    it("20 below 10kg", () => expect(weight(4)).toBe(20));
  });

  describe("WeightRatio (heavy-slam / heat-crash)", () => {
    function ratio(attackerKg: number, targetKg: number) {
      return resolvedPower(
        DynamicPowerKind.WeightRatio,
        0,
        pokemon({ weight: attackerKg }),
        pokemon({ weight: targetKg }),
      );
    }
    it("120 when target is below a fifth of the user", () => expect(ratio(500, 50)).toBe(120));
    it("100 below a quarter", () => expect(ratio(400, 90)).toBe(100));
    it("80 below a third", () => expect(ratio(300, 90)).toBe(80));
    it("scores 80 exactly at one third (integer parity)", () => expect(ratio(300, 100)).toBe(80));
    it("60 below a half", () => expect(ratio(200, 90)).toBe(60));
    it("40 at half or above", () => expect(ratio(100, 60)).toBe(40));
    it("40 when the user has no weight", () => expect(ratio(0, 50)).toBe(40));
    it("120 when the target has no weight", () => expect(ratio(50, 0)).toBe(120));
  });

  describe("AllyFaintCountScaled (last-respects)", () => {
    function scaledPower(attacker: PokemonInstance, others: PokemonInstance[]): number {
      const state = MockBattle.stateFrom([attacker, ...others]);
      return resolveDynamicPower(
        move(DynamicPowerKind.AllyFaintCountScaled, 50),
        attacker,
        attacker,
        state,
      ).power;
    }

    it("returns the base power with no fainted allies", () => {
      const attacker = pokemon({ id: "a", playerId: PlayerId.Player1 });
      const ally = pokemon({ id: "b", playerId: PlayerId.Player1, currentHp: 50 });
      expect(scaledPower(attacker, [ally])).toBe(50);
    });

    it("scales by 50 per fainted ally", () => {
      const attacker = pokemon({ id: "a", playerId: PlayerId.Player1 });
      const ally1 = pokemon({ id: "b", playerId: PlayerId.Player1, currentHp: 0 });
      const ally2 = pokemon({ id: "c", playerId: PlayerId.Player1, currentHp: 0 });
      expect(scaledPower(attacker, [ally1, ally2])).toBe(150);
    });

    it("ignores fainted foes and the user's own faint", () => {
      const attacker = pokemon({ id: "a", playerId: PlayerId.Player1, currentHp: 0 });
      const foe = pokemon({ id: "b", playerId: PlayerId.Player2, currentHp: 0 });
      expect(scaledPower(attacker, [foe])).toBe(50);
    });

    it("falls back to base power without battle state (preview)", () => {
      expect(resolvedPower(DynamicPowerKind.AllyFaintCountScaled, 50, pokemon(), pokemon())).toBe(
        50,
      );
    });
  });

  describe("TargetIdleSinceLastAction (fishious-rend / bolt-beak)", () => {
    function idle(attackerStamp: number | undefined, targetStamp: number | undefined) {
      return resolvedPower(
        DynamicPowerKind.TargetIdleSinceLastAction,
        80,
        pokemon({ lastActedAtAction: attackerStamp }),
        pokemon({ lastActedAtAction: targetStamp }),
      );
    }

    it("doubles when the target has not acted since the user's last action", () => {
      expect(idle(5, 3)).toBe(160);
    });

    it("doubles when the target has never acted", () => {
      expect(idle(5, undefined)).toBe(160);
    });

    it("doubles when both are fresh", () => {
      expect(idle(undefined, undefined)).toBe(160);
    });

    it("stays base when the target acted after the user", () => {
      expect(idle(3, 5)).toBe(80);
    });
  });
});
