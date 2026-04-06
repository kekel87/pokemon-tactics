import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { TargetingKind } from "../../enums/targeting-kind";
import { MockBattle, MockPokemon } from "../../testing";
import { BattleEngine } from "../BattleEngine";

function makeConfusedEngine(options?: {
  allyPosition?: { x: number; y: number };
  hasAlly?: boolean;
}) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 2, y: 2 },
    orientation: Direction.East,
    moveIds: ["ember"],
    currentPp: { ember: 25 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
    volatileStatuses: [{ type: StatusType.Confused, remainingTurns: 3 }],
  });

  const enemy = MockPokemon.fresh(MockPokemon.base, {
    id: "enemy",
    playerId: PlayerId.Player2,
    position: { x: 4, y: 2 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });

  const pokemon = [attacker, enemy];

  if (options?.hasAlly !== false) {
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: options?.allyPosition ?? { x: 1, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    pokemon.push(ally);
  }

  const state = MockBattle.stateFrom(pokemon, 6, 6);
  const moveRegistry = new Map();
  moveRegistry.set("ember", {
    id: "ember",
    name: "Ember",
    type: "fire",
    category: "special",
    power: 40,
    accuracy: 100,
    pp: 25,
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
    effects: [{ kind: "damage" }],
  });
  const engine = new BattleEngine(state, moveRegistry);
  return { engine, state, attacker, enemy };
}

describe("confusion status", () => {
  describe("confusion triggered (50% roll)", () => {
    it("redirects single target attack to random ally when confusion triggers", () => {
      // Math.random: 0.1 for confusion check (< 0.5 = triggers), 0.0 for ally selection
      const calls = [0.1, 0.0];
      let callIndex = 0;
      vi.spyOn(Math, "random").mockImplementation(() => calls[callIndex++] ?? 0.5);

      const { engine, state } = makeConfusedEngine();

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "ember",
        targetPosition: { x: 4, y: 2 },
      });

      expect(result.success).toBe(true);
      expect(result.events.map((e) => e.type)).toContain(BattleEventType.ConfusionTriggered);
      expect(result.events.map((e) => e.type)).toContain(BattleEventType.ConfusionRedirected);
      // Ally should have taken damage, not the enemy
      expect(state.pokemon.get("ally")?.currentHp).toBeLessThan(100);
      expect(state.pokemon.get("enemy")?.currentHp).toBe(100);

      vi.restoreAllMocks();
    });

    it("loses turn when no ally in range", () => {
      const calls = [0.1];
      let callIndex = 0;
      vi.spyOn(Math, "random").mockImplementation(() => calls[callIndex++] ?? 0.5);

      const { engine } = makeConfusedEngine({ hasAlly: false });

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "ember",
        targetPosition: { x: 4, y: 2 },
      });

      expect(result.success).toBe(true);
      expect(result.events.map((e) => e.type)).toContain(BattleEventType.ConfusionTriggered);
      expect(result.events.map((e) => e.type)).toContain(BattleEventType.ConfusionFailed);

      vi.restoreAllMocks();
    });
  });

  describe("confusion resisted (50% roll)", () => {
    it("acts normally when confusion is resisted", () => {
      // Math.random: 0.6 for confusion check (>= 0.5 = resists)
      vi.spyOn(Math, "random").mockReturnValue(0.6);

      const { engine, state } = makeConfusedEngine();

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "attacker",
        moveId: "ember",
        targetPosition: { x: 4, y: 2 },
      });

      expect(result.success).toBe(true);
      expect(result.events.map((e) => e.type)).toContain(BattleEventType.ConfusionResisted);
      expect(state.pokemon.get("enemy")?.currentHp).toBeLessThan(100);

      vi.restoreAllMocks();
    });
  });

  describe("confusion expiry", () => {
    it("removes confusion when remainingTurns reaches 0", () => {
      const attacker = MockPokemon.fresh(MockPokemon.base, {
        id: "p1",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["ember"],
        currentPp: { ember: 25 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        volatileStatuses: [{ type: StatusType.Confused, remainingTurns: 1 }],
      });
      const enemy = MockPokemon.fresh(MockPokemon.base, {
        id: "p2",
        playerId: PlayerId.Player2,
        position: { x: 4, y: 4 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });

      const state = MockBattle.stateFrom([attacker, enemy]);
      const moveRegistry = new Map();
      moveRegistry.set("ember", {
        id: "ember",
        name: "Ember",
        type: "fire",
        category: "special",
        power: 40,
        accuracy: 100,
        pp: 25,
        targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
        effects: [{ kind: "damage" }],
      });
      const engine = new BattleEngine(state, moveRegistry);

      // Submit a move action — lazy confusion check runs, remainingTurns 1 → 0, confusion removed
      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.Move,
        pokemonId: "p1",
        path: [{ x: 1, y: 0 }],
      });

      expect(result.events.map((e) => e.type)).toContain(BattleEventType.StatusRemoved);
      expect(attacker.volatileStatuses).toHaveLength(0);
      // Should have moved normally (no confusion, it expired)
      expect(attacker.position).toEqual({ x: 1, y: 0 });
    });
  });

  describe("confusion coexists with major status", () => {
    it("can be confused and paralyzed at the same time", () => {
      const pokemon = MockPokemon.fresh(MockPokemon.base, {
        id: "p1",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: null }],
        volatileStatuses: [{ type: StatusType.Confused, remainingTurns: 3 }],
      });
      const enemy = MockPokemon.fresh(MockPokemon.base, {
        id: "p2",
        playerId: PlayerId.Player2,
        position: { x: 4, y: 4 },
        derivedStats: { movement: 3, jump: 1, initiative: 10 },
      });

      const _state = MockBattle.stateFrom([pokemon, enemy]);

      expect(pokemon.statusEffects).toHaveLength(1);
      expect(pokemon.statusEffects[0]?.type).toBe(StatusType.Paralyzed);
      expect(pokemon.volatileStatuses).toHaveLength(1);
      expect(pokemon.volatileStatuses[0]?.type).toBe(StatusType.Confused);
    });
  });

  describe("confused movement", () => {
    it("moves in random direction when confused", () => {
      // Math.random calls: confusion check (0.1 = triggers), direction (0.0 = North), steps (0.0 = 1)
      const calls = [0.1, 0.0, 0.0];
      let callIndex = 0;
      vi.spyOn(Math, "random").mockImplementation(() => calls[callIndex++] ?? 0.5);

      const { engine, state } = makeConfusedEngine();

      const result = engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.Move,
        pokemonId: "attacker",
        path: [{ x: 3, y: 2 }],
      });

      expect(result.success).toBe(true);
      // The pokemon moved but not to the requested position
      const movedPokemon = state.pokemon.get("attacker")!;
      expect(movedPokemon.position).not.toEqual({ x: 3, y: 2 });

      vi.restoreAllMocks();
    });
  });
});
