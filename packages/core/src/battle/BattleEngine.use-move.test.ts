import { loadData, typeChart } from "@pokemon-tactic/data";
import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../enums/action-error";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Category } from "../enums/category";
import { EffectKind } from "../enums/effect-kind";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import { TargetingKind } from "../enums/targeting-kind";
import { MockBattle } from "../testing/mock-battle";
import { MockPokemon } from "../testing/mock-pokemon";
import { MockValidation } from "../testing/mock-validation";
import type { BattleEvent } from "../types/battle-event";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { BattleEngine } from "./BattleEngine";

const HIGH_INIT = { movement: 3, jump: 1, initiative: 100 };
const LOW_INIT = { movement: 3, jump: 1, initiative: 10 };

function freshPokemon(
  base: PokemonInstance,
  overrides?: Partial<PokemonInstance>,
): PokemonInstance {
  return {
    ...base,
    position: { ...base.position },
    baseStats: { ...base.baseStats },
    derivedStats: { ...base.derivedStats },
    statStages: { ...base.statStages },
    statusEffects: [...base.statusEffects],
    moveIds: [...base.moveIds],
    currentPp: { ...base.currentPp },
    ...overrides,
    ...(overrides?.position ? { position: { ...overrides.position } } : {}),
  };
}

const pokemonTypes = new Map<string, PokemonType[]>([
  ["bulbasaur", [PokemonType.Grass, PokemonType.Poison]],
  ["charmander", [PokemonType.Fire]],
  ["squirtle", [PokemonType.Water]],
  ["pidgey", [PokemonType.Normal, PokemonType.Flying]],
]);

function buildMoveRegistry(moves: MoveDefinition[]): Map<string, MoveDefinition> {
  return new Map(moves.map((m) => [m.id, m]));
}

describe("BattleEngine.executeUseMove — valid move hits and deals damage", () => {
  it("applies damage to the target, deducts PP, and emits MoveStarted, DamageDealt, TurnEnded, TurnStarted", () => {
    const { moves } = loadData();
    const registry = buildMoveRegistry(moves);

    const attacker = freshPokemon(MockPokemon.bulbasaur, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { ...MockPokemon.bulbasaur.derivedStats, initiative: 100 },
      moveIds: ["razor-leaf"],
      currentPp: { "razor-leaf": 25 },
    });
    const defender = freshPokemon(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { ...MockPokemon.charmander.derivedStats, initiative: 10 },
    });

    const state = MockBattle.stateFrom([attacker, defender]);
    const pokemonTypes = new Map([
      ["bulbasaur", [PokemonType.Grass, PokemonType.Poison]],
      ["charmander", [PokemonType.Fire]],
    ]);
    const engine = new BattleEngine(state, registry, typeChart, pokemonTypes);

    const hpBefore = state.pokemon.get("defender")?.currentHp ?? 0;
    const ppBefore = state.pokemon.get("attacker")?.currentPp["razor-leaf"] ?? 0;

    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "razor-leaf",
      targetPosition: { x: 1, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);

    const hpAfter = state.pokemon.get("defender")?.currentHp ?? 0;
    expect(hpAfter).toBeLessThan(hpBefore);

    const ppAfter = state.pokemon.get("attacker")?.currentPp["razor-leaf"] ?? 0;
    expect(ppAfter).toBe(ppBefore - 1);

    const eventTypes = result.events.map((e) => e.type);
    expect(eventTypes).toContain(BattleEventType.MoveStarted);
    expect(eventTypes).toContain(BattleEventType.DamageDealt);
    expect(eventTypes).not.toContain(BattleEventType.TurnEnded);
    expect(eventTypes).not.toContain(BattleEventType.TurnStarted);
  });
});

describe("BattleEngine.executeUseMove — no PP left", () => {
  it("rejects the action with NoPpLeft when the move has 0 PP remaining", () => {
    const scratchMove: MoveDefinition = {
      ...MockValidation.validMove,
      id: "scratch",
      targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    };
    const registry = new Map([["scratch", scratchMove]]);

    const attacker = freshPokemon(MockPokemon.charmander, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: HIGH_INIT,
      moveIds: ["scratch"],
      currentPp: { scratch: 0 },
    });
    const defender = freshPokemon(MockPokemon.bulbasaur, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: LOW_INIT,
    });

    const state = MockBattle.stateFrom([attacker, defender]);
    const engine = new BattleEngine(state, registry, typeChart, pokemonTypes);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.NoPpLeft);
  });
});

describe("BattleEngine.executeUseMove — unknown move", () => {
  it("rejects the action with UnknownMove when the moveId is not in the registry", () => {
    const attacker = freshPokemon(MockPokemon.charmander, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["nonexistent-move"],
      currentPp: { "nonexistent-move": 10 },
    });
    const defender = freshPokemon(MockPokemon.bulbasaur, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
    });

    const state = MockBattle.stateFrom([attacker, defender]);
    const engine = new BattleEngine(state, new Map(), typeChart, pokemonTypes);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "nonexistent-move",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.UnknownMove);
  });
});

describe("BattleEngine.executeUseMove — target out of range", () => {
  it("rejects the action with InvalidTarget when the target position is outside move range", () => {
    const scratchMove: MoveDefinition = {
      ...MockValidation.validMove,
      id: "scratch",
      targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    };
    const registry = new Map([["scratch", scratchMove]]);

    const attacker = freshPokemon(MockPokemon.charmander, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
    });
    const defender = freshPokemon(MockPokemon.bulbasaur, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
    });

    const state = MockBattle.stateFrom([attacker, defender]);
    const engine = new BattleEngine(state, registry, typeChart, pokemonTypes);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
  });
});

describe("BattleEngine.executeUseMove — status move hits", () => {
  it("applies Asleep status on hit, emits StatusApplied, emits no DamageDealt", () => {
    const { moves } = loadData();
    const registry = buildMoveRegistry(moves);

    const attacker = freshPokemon(MockPokemon.bulbasaur, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: HIGH_INIT,
      moveIds: ["sleep-powder"],
      currentPp: { "sleep-powder": 15 },
    });
    const defender = freshPokemon(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: LOW_INIT,
    });

    const state = MockBattle.stateFrom([attacker, defender]);
    const engine = new BattleEngine(state, registry, typeChart, pokemonTypes);

    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "sleep-powder",
      targetPosition: { x: 1, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);

    const eventTypes = result.events.map((e) => e.type);
    expect(eventTypes).toContain(BattleEventType.StatusApplied);
    expect(eventTypes).not.toContain(BattleEventType.DamageDealt);

    const statusApplied = result.events.find(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.StatusApplied }> =>
        e.type === BattleEventType.StatusApplied,
    );
    expect(statusApplied?.targetId).toBe("defender");
    expect(statusApplied?.status).toBe(StatusType.Asleep);
  });
});

describe("BattleEngine.executeUseMove — AoE cross hits multiple targets", () => {
  it("deals damage to all pokemon in the cross pattern, emits DamageDealt for each", () => {
    const crossMove: MoveDefinition = {
      id: "bubble-beam",
      name: "Bubble Beam",
      type: PokemonType.Water,
      category: Category.Special,
      power: 65,
      accuracy: 100,
      pp: 20,
      targeting: { kind: TargetingKind.Cross, size: 3 },
      effects: [{ kind: EffectKind.Damage }],
    };
    const registry = new Map([["bubble-beam", crossMove]]);

    const attacker = freshPokemon(MockPokemon.bulbasaur, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      derivedStats: HIGH_INIT,
      moveIds: ["bubble-beam"],
      currentPp: { "bubble-beam": 20 },
    });
    const targetNorth = freshPokemon(MockPokemon.charmander, {
      id: "target-north",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 1 },
      derivedStats: LOW_INIT,
    });
    const targetSouth = freshPokemon(MockPokemon.charmander, {
      id: "target-south",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 3 },
      derivedStats: LOW_INIT,
    });

    const state = MockBattle.stateFrom([attacker, targetNorth, targetSouth], 5, 5);
    const engine = new BattleEngine(state, registry, typeChart, pokemonTypes);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "bubble-beam",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);

    const damageEvents = result.events.filter(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt,
    );
    const damagedIds = damageEvents.map((e) => e.targetId);
    expect(damagedIds).toContain("target-north");
    expect(damagedIds).toContain("target-south");
  });
});

describe("BattleEngine.executeUseMove — friendly fire on AoE", () => {
  it("deals damage to allies caught in the AoE zone", () => {
    const crossMove: MoveDefinition = {
      id: "bubble-beam",
      name: "Bubble Beam",
      type: PokemonType.Water,
      category: Category.Special,
      power: 65,
      accuracy: 100,
      pp: 20,
      targeting: { kind: TargetingKind.Cross, size: 3 },
      effects: [{ kind: EffectKind.Damage }],
    };
    const registry = new Map([["bubble-beam", crossMove]]);

    const attacker = freshPokemon(MockPokemon.bulbasaur, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      derivedStats: HIGH_INIT,
      moveIds: ["bubble-beam"],
      currentPp: { "bubble-beam": 20 },
    });
    const ally = freshPokemon(MockPokemon.bulbasaur, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 1 },
      derivedStats: LOW_INIT,
    });
    const enemy = freshPokemon(MockPokemon.charmander, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 3 },
      derivedStats: LOW_INIT,
    });

    const state = MockBattle.stateFrom([attacker, ally, enemy], 5, 5);
    const engine = new BattleEngine(state, registry, typeChart, pokemonTypes);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "bubble-beam",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);

    const damageEvents = result.events.filter(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt,
    );
    const damagedIds = damageEvents.map((e) => e.targetId);
    expect(damagedIds).toContain("ally");
    expect(damagedIds).toContain("enemy");
  });

  it("applies status effects to allies caught in the AoE zone", () => {
    const aoeStatusMove: MoveDefinition = {
      id: "sludge-bomb",
      name: "Sludge Bomb",
      type: PokemonType.Poison,
      category: Category.Special,
      power: 90,
      accuracy: 100,
      pp: 10,
      targeting: { kind: TargetingKind.Blast, range: { min: 2, max: 4 }, radius: 1 },
      effects: [
        { kind: EffectKind.Damage },
        { kind: EffectKind.Status, status: StatusType.Poisoned, chance: 100 },
      ],
    };
    const registry = new Map([["sludge-bomb", aoeStatusMove]]);

    const attacker = freshPokemon(MockPokemon.bulbasaur, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      derivedStats: HIGH_INIT,
      moveIds: ["sludge-bomb"],
      currentPp: { "sludge-bomb": 10 },
    });
    const ally = freshPokemon(MockPokemon.squirtle, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 1 },
      derivedStats: LOW_INIT,
    });

    const state = MockBattle.stateFrom([attacker, ally], 5, 5);
    const engine = new BattleEngine(state, registry, typeChart, pokemonTypes);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "sludge-bomb",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);

    const statusEvents = result.events.filter(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.StatusApplied }> =>
        e.type === BattleEventType.StatusApplied,
    );
    const poisonedIds = statusEvents
      .filter((e) => e.status === StatusType.Poisoned)
      .map((e) => e.targetId);
    expect(poisonedIds).toContain("ally");
  });
});

describe("BattleEngine.executeUseMove — miss", () => {
  it("emits MoveMissed and no DamageDealt when the accuracy roll fails", () => {
    const { moves } = loadData();
    const registry = buildMoveRegistry(moves);

    const attacker = freshPokemon(MockPokemon.bulbasaur, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { ...MockPokemon.bulbasaur.derivedStats, initiative: 100 },
      moveIds: ["razor-leaf"],
      currentPp: { "razor-leaf": 25 },
    });
    const defender = freshPokemon(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { ...MockPokemon.charmander.derivedStats, initiative: 10 },
    });

    const state = MockBattle.stateFrom([attacker, defender]);
    const pokemonTypes = new Map([
      ["bulbasaur", [PokemonType.Grass, PokemonType.Poison]],
      ["charmander", [PokemonType.Fire]],
    ]);
    const engine = new BattleEngine(state, registry, typeChart, pokemonTypes);

    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "razor-leaf",
      targetPosition: { x: 1, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);

    const eventTypes = result.events.map((e) => e.type);
    expect(eventTypes).toContain(BattleEventType.MoveMissed);
    expect(eventTypes).not.toContain(BattleEventType.DamageDealt);

    const hpAfter = state.pokemon.get("defender")?.currentHp;
    expect(hpAfter).toBe(defender.currentHp);
  });
});
