import { describe, expect, it } from "vitest";
import { PlayerId } from "../enums/player-id";
import { buildMoveRegistry, MockPokemon } from "../testing";
import { MockBattle } from "../testing/mock-battle";
import {
  abilityCopyValue,
  abilityNeutralizeValue,
  anyEnemyCanStrike,
  anyEnemyPhysicalStriker,
  enemyHasStatDecreaseMoveInRange,
  enemyHasStatusMoveInRange,
  lastMoveIsLowValue,
  lastMoveIsThreat,
  occupantAt,
  survivesLethalHit,
} from "./threat-detection";

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

describe("threat-detection — last move classification (Disable/Encore scoring)", () => {
  const registry = buildMoveRegistry();

  it("lastMoveIsThreat: true for an offensive last move", () => {
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      lastUsedMoveId: "tackle",
    });
    expect(lastMoveIsThreat(target, registry)).toBe(true);
  });

  it("lastMoveIsThreat: false for a status last move", () => {
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      lastUsedMoveId: "recover",
    });
    expect(lastMoveIsThreat(target, registry)).toBe(false);
  });

  it("lastMoveIsThreat: false when no move has been used", () => {
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
    });
    expect(lastMoveIsThreat(target, registry)).toBe(false);
  });

  it("lastMoveIsLowValue: true for a status last move", () => {
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      lastUsedMoveId: "recover",
    });
    expect(lastMoveIsLowValue(target, registry)).toBe(true);
  });

  it("lastMoveIsLowValue: false for an offensive last move", () => {
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
      lastUsedMoveId: "tackle",
    });
    expect(lastMoveIsLowValue(target, registry)).toBe(false);
  });

  it("lastMoveIsLowValue: false when no move has been used", () => {
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 0 },
    });
    expect(lastMoveIsLowValue(target, registry)).toBe(false);
  });
});

describe("threat-detection — ability value tables", () => {
  it("rates a defensive ability as worth neutralizing", () => {
    expect(abilityNeutralizeValue("levitate")).toBeGreaterThan(0);
    expect(abilityNeutralizeValue("sturdy")).toBeGreaterThan(0);
  });

  it("rates an unknown / offensive ability as not worth neutralizing", () => {
    expect(abilityNeutralizeValue("technician")).toBe(0);
    expect(abilityNeutralizeValue(undefined)).toBe(0);
  });

  it("rates a continuous offensive ability as worth copying", () => {
    expect(abilityCopyValue("technician")).toBeGreaterThan(0);
    expect(abilityCopyValue("adaptability")).toBeGreaterThan(0);
  });

  it("rates a battle-start-only ability as worthless to copy", () => {
    expect(abilityCopyValue("intimidate")).toBe(0);
    expect(abilityCopyValue("trace")).toBe(0);
    expect(abilityCopyValue(undefined)).toBe(0);
  });
});

describe("threat-detection — survivesLethalHit", () => {
  it("detects Ceinture Force at full HP", () => {
    const target = MockPokemon.fresh(MockPokemon.base, {
      currentHp: 100,
      maxHp: 100,
      heldItemId: "focus-sash",
    });
    expect(survivesLethalHit(target)).toBe(true);
  });

  it("Ceinture Force does not save below full HP", () => {
    const target = MockPokemon.fresh(MockPokemon.base, {
      currentHp: 50,
      maxHp: 100,
      heldItemId: "focus-sash",
    });
    expect(survivesLethalHit(target)).toBe(false);
  });

  it("Bandeau saves at any HP", () => {
    const target = MockPokemon.fresh(MockPokemon.base, {
      currentHp: 30,
      maxHp: 100,
      heldItemId: "focus-band",
    });
    expect(survivesLethalHit(target)).toBe(true);
  });

  it("Baie Sitrus already consumed no longer saves", () => {
    const target = MockPokemon.fresh(MockPokemon.base, {
      currentHp: 100,
      maxHp: 100,
      heldItemId: "sitrus-berry",
      consumedItemId: "sitrus-berry",
    });
    expect(survivesLethalHit(target)).toBe(false);
  });

  it("Fermeté saves at full HP", () => {
    const target = MockPokemon.fresh(MockPokemon.base, {
      currentHp: 100,
      maxHp: 100,
      abilityId: "sturdy",
    });
    expect(survivesLethalHit(target)).toBe(true);
  });

  it("returns false for a plain target", () => {
    const target = MockPokemon.fresh(MockPokemon.base, { currentHp: 100, maxHp: 100 });
    expect(survivesLethalHit(target)).toBe(false);
  });
});

describe("threat-detection — anyEnemyCanStrike / anyEnemyPhysicalStriker", () => {
  const registry = buildMoveRegistry();

  it("detects an adjacent enemy with a reachable offensive move", () => {
    const self = MockPokemon.fresh(MockPokemon.base, {
      id: "self",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
    });
    expect(anyEnemyCanStrike([enemy], self, registry)).toBe(true);
  });

  it("returns false when the offensive move is out of reach", () => {
    const self = MockPokemon.fresh(MockPokemon.base, {
      id: "self",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 8, y: 0 },
      moveIds: ["tackle"],
    });
    expect(anyEnemyCanStrike([enemy], self, registry)).toBe(false);
  });

  it("physical striker ignores an adjacent special-only attacker", () => {
    const self = MockPokemon.fresh(MockPokemon.base, {
      id: "self",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["ember"],
    });
    expect(anyEnemyCanStrike([enemy], self, registry)).toBe(true);
    expect(anyEnemyPhysicalStriker([enemy], self, registry)).toBe(false);
  });
});

describe("threat-detection — occupantAt", () => {
  it("returns a KO ally standing on the tile", () => {
    const living = MockPokemon.fresh(MockPokemon.base, {
      id: "living",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const koAlly = MockPokemon.fresh(MockPokemon.base, {
      id: "ko",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      currentHp: 0,
    });
    const state = MockBattle.stateFrom([living, koAlly], 6, 6);
    expect(occupantAt(state, { x: 3, y: 3 })?.id).toBe("ko");
    expect(occupantAt(state, { x: 5, y: 5 })).toBeUndefined();
  });
});
