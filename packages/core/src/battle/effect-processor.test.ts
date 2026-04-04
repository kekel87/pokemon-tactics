import { afterEach, describe, expect, it, vi } from "vitest";
import { BattleEventType } from "../enums/battle-event-type";
import { Category } from "../enums/category";
import { EffectKind } from "../enums/effect-kind";
import { EffectTarget } from "../enums/effect-target";
import { PokemonType } from "../enums/pokemon-type";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { TargetingKind } from "../enums/targeting-kind";
import { MockBattle } from "../testing/mock-battle";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { processEffects } from "./effect-processor";

const P1 = MockBattle.player1Fast;
const P2 = MockBattle.player2Slow;

function fresh(base: PokemonInstance, overrides?: Partial<PokemonInstance>): PokemonInstance {
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
  };
}

const damageMove: MoveDefinition = {
  id: "tackle",
  name: "Tackle",
  type: PokemonType.Normal,
  category: Category.Physical,
  power: 40,
  accuracy: 100,
  pp: 35,
  targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
  effects: [{ kind: EffectKind.Damage }],
};

const statusMove: MoveDefinition = {
  id: "sleep-powder",
  name: "Sleep Powder",
  type: PokemonType.Grass,
  category: Category.Status,
  power: 0,
  accuracy: 75,
  pp: 15,
  targeting: { kind: TargetingKind.Single, range: { min: 1, max: 2 } },
  effects: [{ kind: EffectKind.Status, status: StatusType.Asleep, chance: 100 }],
};

const statChangeMove: MoveDefinition = {
  id: "withdraw",
  name: "Withdraw",
  type: PokemonType.Water,
  category: Category.Status,
  power: 0,
  accuracy: 100,
  pp: 40,
  targeting: { kind: TargetingKind.Self },
  effects: [
    { kind: EffectKind.StatChange, stat: StatName.Defense, stages: 1, target: EffectTarget.Self },
  ],
};

const simpleChart = {
  [PokemonType.Normal]: { [PokemonType.Normal]: 1 },
} as Record<PokemonType, Record<PokemonType, number>>;

function makeContext(
  attackerPokemon: PokemonInstance,
  targets: PokemonInstance[],
  move: MoveDefinition,
  state?: Partial<BattleState>,
) {
  const fullState: BattleState = {
    grid: [],
    pokemon: new Map(),
    turnOrder: [],
    currentTurnIndex: 0,
    roundNumber: 1,
    predictedNextRoundOrder: [],
    ...state,
  };
  return {
    attacker: attackerPokemon,
    targets,
    move,
    state: fullState,
    typeChart: simpleChart,
    attackerTypes: [PokemonType.Normal] as PokemonType[],
    targetTypesMap: new Map(targets.map((t) => [t.id, [PokemonType.Normal] as PokemonType[]])),
    random: () => Math.random(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("processEffects — damage", () => {
  it("reduces HP and emits DamageDealt", () => {
    const target = fresh(P2, { currentHp: 100, maxHp: 100 });
    const context = makeContext(fresh(P1), [target], damageMove);

    const events = processEffects(context);

    expect(target.currentHp).toBeLessThan(100);
    const damageEvents = events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents.length).toBe(1);
  });

  it("emits PokemonKo when HP reaches 0", () => {
    const target = fresh(P2, { currentHp: 1, maxHp: 100 });
    const context = makeContext(fresh(P1), [target], damageMove);

    const events = processEffects(context);

    expect(target.currentHp).toBe(0);
    const koEvents = events.filter((e) => e.type === BattleEventType.PokemonKo);
    expect(koEvents.length).toBe(1);
  });

  it("continues processing after KO mid-AoE", () => {
    const target1 = fresh(P2, { id: "target-1", currentHp: 1 });
    const target2 = fresh(P2, { id: "target-2", currentHp: 100 });
    const context = makeContext(fresh(P1), [target1, target2], damageMove);

    const events = processEffects(context);

    const damageEvents = events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents.length).toBe(2);
    expect(target1.currentHp).toBe(0);
    expect(target2.currentHp).toBeLessThan(100);
  });

  it("skips damage for status moves", () => {
    const target = fresh(P2, { currentHp: 100 });
    const context = makeContext(fresh(P1), [target], statusMove);

    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const events = processEffects(context);

    expect(target.currentHp).toBe(100);
    const damageEvents = events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents.length).toBe(0);
  });
});

describe("processEffects — status", () => {
  it("applies status and emits StatusApplied", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const target = fresh(P2);
    const context = makeContext(fresh(P1), [target], statusMove);

    const events = processEffects(context);

    expect(target.statusEffects.length).toBe(1);
    expect(target.statusEffects[0]?.type).toBe(StatusType.Asleep);
    const statusEvents = events.filter((e) => e.type === BattleEventType.StatusApplied);
    expect(statusEvents.length).toBe(1);
  });

  it("respects 1-major-max rule", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const target = fresh(P2, {
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
    });
    const context = makeContext(fresh(P1), [target], statusMove);

    const events = processEffects(context);

    expect(target.statusEffects.length).toBe(1);
    expect(target.statusEffects[0]?.type).toBe(StatusType.Burned);
    const statusEvents = events.filter((e) => e.type === BattleEventType.StatusApplied);
    expect(statusEvents.length).toBe(0);
  });

  it("respects chance probability", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const chanceMove: MoveDefinition = {
      ...statusMove,
      effects: [{ kind: EffectKind.Status, status: StatusType.Poisoned, chance: 30 }],
    };
    const target = fresh(P2);
    const context = makeContext(fresh(P1), [target], chanceMove);

    processEffects(context);

    expect(target.statusEffects.length).toBe(0);
  });

  it("does not apply status when target is immune to move type", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const thunderbolt: MoveDefinition = {
      id: "thunderbolt",
      name: "Thunderbolt",
      type: PokemonType.Electric,
      category: Category.Special,
      power: 90,
      accuracy: 100,
      pp: 15,
      targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
      effects: [
        { kind: EffectKind.Damage },
        { kind: EffectKind.Status, status: StatusType.Paralyzed, chance: 100 },
      ],
    };
    const immuneChart = {
      [PokemonType.Electric]: { [PokemonType.Ground]: 0 },
    } as Record<PokemonType, Record<PokemonType, number>>;
    const target = fresh(P2, { currentHp: 100, maxHp: 100 });
    const context = {
      attacker: fresh(P1),
      targets: [target],
      move: thunderbolt,
      state: {
        grid: [],
        pokemon: new Map(),
        turnOrder: [],
        currentTurnIndex: 0,
        roundNumber: 1,
        predictedNextRoundOrder: [],
      } as BattleState,
      typeChart: immuneChart,
      attackerTypes: [PokemonType.Electric] as PokemonType[],
      targetTypesMap: new Map([[target.id, [PokemonType.Ground] as PokemonType[]]]),
    };

    const events = processEffects(context);

    expect(target.currentHp).toBe(100);
    expect(target.statusEffects.length).toBe(0);
    const damageEvents = events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents.length).toBe(1);
    expect(damageEvents[0]).toMatchObject({ amount: 0, effectiveness: 0 });
    const statusEvents = events.filter((e) => e.type === BattleEventType.StatusApplied);
    expect(statusEvents.length).toBe(0);
  });
});

describe("processEffects — statChange", () => {
  it("applies stat stages and emits StatChanged", () => {
    const attackerPokemon = fresh(P1);
    const context = makeContext(attackerPokemon, [], statChangeMove);

    const events = processEffects(context);

    expect(attackerPokemon.statStages[StatName.Defense]).toBe(1);
    const statEvents = events.filter((e) => e.type === BattleEventType.StatChanged);
    expect(statEvents.length).toBe(1);
  });

  it("clamps at +6", () => {
    const attackerPokemon = fresh(P1, { statStages: { ...P1.statStages, [StatName.Defense]: 6 } });
    const context = makeContext(attackerPokemon, [], statChangeMove);

    const events = processEffects(context);

    expect(attackerPokemon.statStages[StatName.Defense]).toBe(6);
    const statEvents = events.filter((e) => e.type === BattleEventType.StatChanged);
    expect(statEvents.length).toBe(0);
  });

  it("applies to targets when effect.target is Targets", () => {
    const target = fresh(P2);
    const targetDebuffMove: MoveDefinition = {
      ...statChangeMove,
      effects: [
        {
          kind: EffectKind.StatChange,
          stat: StatName.Accuracy,
          stages: -1,
          target: EffectTarget.Targets,
        },
      ],
    };
    const context = makeContext(fresh(P1), [target], targetDebuffMove);

    processEffects(context);

    expect(target.statStages[StatName.Accuracy]).toBe(-1);
  });
});
