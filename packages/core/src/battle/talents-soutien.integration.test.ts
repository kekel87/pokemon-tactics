import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import { HeldItemId } from "../enums/held-item-id";
import { PlayerId } from "../enums/player-id";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { buildItemTestEngine, MockPokemon } from "../testing";

describe("Plan 141 — talents soutien & couplage objet", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Gloutonnerie (gluttony)", () => {
    const holderInHalfPinch = (abilityId?: string) => {
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        currentHp: 40,
        maxHp: 100,
        heldItemId: HeldItemId.LiechiBerry,
        abilityId,
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 5, y: 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      return buildItemTestEngine([holder, foe]);
    };

    it("Given a Gloutonnerie holder at 40% HP, When end turn, Then the pinch berry triggers (Attack +1)", () => {
      const { engine } = holderInHalfPinch("gluttony");
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "holder",
        direction: Direction.East,
      });
      const holderAfter = engine.getGameState(PlayerId.Player1).pokemon.get("holder");
      expect(holderAfter?.statStages[StatName.Attack]).toBe(1);
      expect(holderAfter?.heldItemId).toBeUndefined();
    });

    it("Given the same holder without Gloutonnerie, When end turn, Then the berry stays (40% > 25%)", () => {
      const { engine } = holderInHalfPinch();
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "holder",
        direction: Direction.East,
      });
      const holderAfter = engine.getGameState(PlayerId.Player1).pokemon.get("holder");
      expect(holderAfter?.statStages[StatName.Attack]).toBe(0);
      expect(holderAfter?.heldItemId).toBe(HeldItemId.LiechiBerry);
    });
  });

  describe("Tension (unnerve)", () => {
    const holderInPinch = (foeAbility?: string) => {
      const holder = MockPokemon.fresh(MockPokemon.base, {
        id: "holder",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        currentHp: 20,
        maxHp: 100,
        heldItemId: HeldItemId.LiechiBerry,
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 5, y: 5 },
        abilityId: foeAbility,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      return buildItemTestEngine([holder, foe]);
    };

    it("Given a living enemy with Tension, When the holder ends its turn at 20% HP, Then the berry is not eaten", () => {
      const { engine } = holderInPinch("unnerve");
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "holder",
        direction: Direction.East,
      });
      const holderAfter = engine.getGameState(PlayerId.Player1).pokemon.get("holder");
      expect(holderAfter?.statStages[StatName.Attack]).toBe(0);
      expect(holderAfter?.heldItemId).toBe(HeldItemId.LiechiBerry);
    });

    it("Given no Tension on the field, When the holder ends its turn at 20% HP, Then the berry triggers", () => {
      const { engine } = holderInPinch();
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "holder",
        direction: Direction.East,
      });
      const holderAfter = engine.getGameState(PlayerId.Player1).pokemon.get("holder");
      expect(holderAfter?.statStages[StatName.Attack]).toBe(1);
    });
  });

  describe("Moiteur (damp)", () => {
    const detonatorAndTarget = (targetAbility?: string) => {
      const attacker = MockPokemon.fresh(MockPokemon.base, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 2, y: 2 },
        moveIds: ["self-destruct"],
        currentPp: { "self-destruct": 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const target = MockPokemon.fresh(MockPokemon.base, {
        id: "target",
        playerId: PlayerId.Player2,
        position: { x: 3, y: 2 },
        currentHp: 200,
        maxHp: 200,
        abilityId: targetAbility,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      return buildItemTestEngine([attacker, target]);
    };

    it("Given a Moiteur mon among the targets, When Destruction is used, Then it fizzles (no damage, no self-KO)", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const { engine } = detonatorAndTarget("damp");
      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "self-destruct",
        targetPosition: { x: 3, y: 2 },
      });
      const failed = result.events.some((e) => e.type === BattleEventType.MoveFailed);
      const dampActivated = result.events.some(
        (e) =>
          e.type === BattleEventType.AbilityActivated && "abilityId" in e && e.abilityId === "damp",
      );
      expect(failed).toBe(true);
      expect(dampActivated).toBe(true);
      const state = engine.getGameState(PlayerId.Player1);
      expect(state.pokemon.get("target")?.currentHp).toBe(200);
      const attacker = state.pokemon.get("attacker");
      expect(attacker?.currentHp).toBe(attacker?.maxHp);
    });

    it("Given no Moiteur, When Destruction is used, Then the target takes damage", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const { engine } = detonatorAndTarget();
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "self-destruct",
        targetPosition: { x: 3, y: 2 },
      });
      const state = engine.getGameState(PlayerId.Player1);
      expect(state.pokemon.get("target")?.currentHp).toBeLessThan(200);
    });

    it("Given a Moiteur mon outside the blast, When Destruction is used, Then it still hits (not field-wide)", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const attacker = MockPokemon.fresh(MockPokemon.base, {
        id: "attacker",
        playerId: PlayerId.Player1,
        position: { x: 2, y: 2 },
        moveIds: ["self-destruct"],
        currentPp: { "self-destruct": 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const target = MockPokemon.fresh(MockPokemon.base, {
        id: "target",
        playerId: PlayerId.Player2,
        position: { x: 3, y: 2 },
        currentHp: 200,
        maxHp: 200,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const bystander = MockPokemon.fresh(MockPokemon.base, {
        id: "bystander",
        playerId: PlayerId.Player2,
        position: { x: 5, y: 5 },
        abilityId: "damp",
        derivedStats: { movement: 3, jump: 1, initiative: 5 },
      });
      const { engine } = buildItemTestEngine([attacker, target, bystander]);
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "self-destruct",
        targetPosition: { x: 3, y: 2 },
      });
      const state = engine.getGameState(PlayerId.Player1);
      expect(state.pokemon.get("target")?.currentHp).toBeLessThan(200);
    });
  });

  describe("Cœur Soin (healer)", () => {
    const healerAndStatusedAlly = (allyPosition: { x: number; y: number }) => {
      const healerMon = MockPokemon.fresh(MockPokemon.base, {
        id: "healer",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        abilityId: "healer",
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const ally = MockPokemon.fresh(MockPokemon.base, {
        id: "ally",
        playerId: PlayerId.Player1,
        position: allyPosition,
        statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: null }],
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 5, y: 5 },
        derivedStats: { movement: 3, jump: 1, initiative: 5 },
      });
      return buildItemTestEngine([healerMon, ally, foe]);
    };

    it("Given a paralysed ally within r2 and a successful 30% roll, When the healer ends its turn, Then the ally is cured", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const { engine } = healerAndStatusedAlly({ x: 2, y: 0 });
      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "healer",
        direction: Direction.East,
      });
      const ally = engine.getGameState(PlayerId.Player1).pokemon.get("ally");
      expect(ally?.statusEffects.some((s) => s.type === StatusType.Paralyzed)).toBe(false);
      expect(
        result.events.some(
          (e) =>
            e.type === BattleEventType.AbilityActivated &&
            "abilityId" in e &&
            e.abilityId === "healer",
        ),
      ).toBe(true);
    });

    it("Given the roll fails (≥30%), When the healer ends its turn, Then the ally keeps its status", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.9);
      const { engine } = healerAndStatusedAlly({ x: 2, y: 0 });
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "healer",
        direction: Direction.East,
      });
      const ally = engine.getGameState(PlayerId.Player1).pokemon.get("ally");
      expect(ally?.statusEffects.some((s) => s.type === StatusType.Paralyzed)).toBe(true);
    });

    it("Given the ally sits beyond r2, When the healer ends its turn, Then the ally keeps its status", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const { engine } = healerAndStatusedAlly({ x: 4, y: 0 });
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "healer",
        direction: Direction.East,
      });
      const ally = engine.getGameState(PlayerId.Player1).pokemon.get("ally");
      expect(ally?.statusEffects.some((s) => s.type === StatusType.Paralyzed)).toBe(true);
    });
  });

  describe("Garde-Ami (friend-guard)", () => {
    const attackDefenderWithGuardian = (guardianAbility?: string) => {
      const attacker = MockPokemon.fresh(MockPokemon.base, {
        id: "attacker",
        playerId: PlayerId.Player2,
        position: { x: 2, y: 2 },
        moveIds: ["tackle"],
        currentPp: { tackle: 35 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const defender = MockPokemon.fresh(MockPokemon.base, {
        id: "defender",
        playerId: PlayerId.Player1,
        position: { x: 3, y: 2 },
        currentHp: 300,
        maxHp: 300,
        derivedStats: { movement: 3, jump: 1, initiative: 50 },
      });
      const guardian = MockPokemon.fresh(MockPokemon.base, {
        id: "guardian",
        playerId: PlayerId.Player1,
        position: { x: 4, y: 2 },
        abilityId: guardianAbility,
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });
      return buildItemTestEngine([attacker, defender, guardian], 6, "attacker");
    };

    it("Given a Garde-Ami ally within r2, When the defender is hit, Then it takes less damage than without", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const { engine: guardedEngine } = attackDefenderWithGuardian("friend-guard");
      guardedEngine.submitAction(PlayerId.Player2, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "tackle",
        targetPosition: { x: 3, y: 2 },
      });
      const guardedDefender = guardedEngine.getGameState(PlayerId.Player1).pokemon.get("defender");

      vi.spyOn(Math, "random").mockReturnValue(0);
      const { engine: plainEngine } = attackDefenderWithGuardian();
      plainEngine.submitAction(PlayerId.Player2, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "tackle",
        targetPosition: { x: 3, y: 2 },
      });
      const plainDefender = plainEngine.getGameState(PlayerId.Player1).pokemon.get("defender");

      expect(guardedDefender).toBeDefined();
      expect(plainDefender).toBeDefined();
      const guardedDamage = 300 - (guardedDefender?.currentHp ?? 0);
      const plainDamage = 300 - (plainDefender?.currentHp ?? 0);
      expect(guardedDamage).toBeLessThan(plainDamage);
      expect(guardedDamage).toBeGreaterThan(0);
    });
  });
});
