import { loadAllPokemonTypes, loadData, typeChart } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { BattleEngine } from "../battle/BattleEngine";
import { ActionKind } from "../enums/action-kind";
import { EffectKind } from "../enums/effect-kind";
import { PlayerId } from "../enums/player-id";
import { PokemonGender } from "../enums/pokemon-gender";
import { StatName } from "../enums/stat-name";
import { TerrainType } from "../enums/terrain-type";
import { MockBattle } from "../testing/mock-battle";
import { MockMove } from "../testing/mock-move";
import { MockPokemon } from "../testing/mock-pokemon";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { createPrng } from "../utils/prng";
import { scoreAction } from "./action-scorer";
import { EASY_PROFILE, HARD_PROFILE } from "./ai-profiles";

function buildEngine(
  attackerOverrides: Partial<PokemonInstance> = {},
  defenderOverrides: Partial<PokemonInstance> = {},
) {
  const data = loadData();
  const moveRegistry = new Map<string, MoveDefinition>();
  for (const move of data.moves) {
    moveRegistry.set(move.id, move);
  }
  const pokemonTypesMap = loadAllPokemonTypes();

  const attacker = MockPokemon.fresh(MockPokemon.charmander, {
    id: "p1-charmander",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    ...attackerOverrides,
  });
  const defender = MockPokemon.fresh(MockPokemon.bulbasaur, {
    id: "p2-bulbasaur",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    ...defenderOverrides,
  });

  const random = createPrng(42);
  const state = MockBattle.stateFrom([attacker, defender], 6, 6);
  const engine = new BattleEngine(
    state,
    moveRegistry,
    typeChart,
    pokemonTypesMap,
    undefined,
    random,
    42,
  );
  return { engine, moveRegistry };
}

describe("scoreAction", () => {
  it("scores a KO move higher than a non-KO move on the same target", () => {
    const { engine, moveRegistry } = buildEngine({}, { currentHp: 10, maxHp: 105 });
    const state = engine.getGameState(PlayerId.Player1);
    const legalActions = engine.getLegalActions(PlayerId.Player1);

    const useMoveActions = legalActions.filter(
      (a) => a.kind === ActionKind.UseMove && (moveRegistry.get(a.moveId)?.power ?? 0) > 0,
    );

    if (useMoveActions.length === 0) {
      return;
    }

    const scores = useMoveActions.map((action) => ({
      action,
      score: scoreAction(action, state, moveRegistry, engine, EASY_PROFILE),
    }));

    const koScore = scores.find((s) => {
      if (s.action.kind !== ActionKind.UseMove) {
        return false;
      }
      const estimate = engine.estimateDamage("p1-charmander", s.action.moveId, "p2-bulbasaur");
      return estimate && estimate!.min >= 10;
    });

    const nonKoScore = scores.find((s) => {
      if (s.action.kind !== ActionKind.UseMove) {
        return false;
      }
      const estimate = engine.estimateDamage("p1-charmander", s.action.moveId, "p2-bulbasaur");
      return estimate && estimate!.min < 10;
    });

    if (koScore && nonKoScore) {
      expect(koScore.score).toBeGreaterThan(nonKoScore.score);
    }
  });

  it("scores a super-effective move higher than a neutral move of similar power", () => {
    const { engine, moveRegistry } = buildEngine();
    const state = engine.getGameState(PlayerId.Player1);
    const legalActions = engine.getLegalActions(PlayerId.Player1);

    const useMoveActions = legalActions.filter(
      (a) => a.kind === ActionKind.UseMove && (moveRegistry.get(a.moveId)?.power ?? 0) > 0,
    );

    const scores = useMoveActions.map((action) => ({
      action,
      score: scoreAction(action, state, moveRegistry, engine, EASY_PROFILE),
    }));

    const superEffective = scores.find((s) => {
      if (s.action.kind !== ActionKind.UseMove) {
        return false;
      }
      const estimate = engine.estimateDamage("p1-charmander", s.action.moveId, "p2-bulbasaur");
      return estimate && estimate.effectiveness > 1;
    });

    const neutral = scores.find((s) => {
      if (s.action.kind !== ActionKind.UseMove) {
        return false;
      }
      const estimate = engine.estimateDamage("p1-charmander", s.action.moveId, "p2-bulbasaur");
      return estimate && estimate.effectiveness === 1;
    });

    if (superEffective && neutral) {
      expect(superEffective.score).toBeGreaterThan(neutral.score);
    }
  });

  it("scores EndTurn as 0", () => {
    const { engine, moveRegistry } = buildEngine();
    const state = engine.getGameState(PlayerId.Player1);
    const endTurnAction = engine
      .getLegalActions(PlayerId.Player1)
      .find((a) => a.kind === ActionKind.EndTurn);
    if (!endTurnAction) {
      return;
    }
    expect(scoreAction(endTurnAction, state, moveRegistry, engine, EASY_PROFILE)).toBe(0);
  });

  it("scores movement towards enemy positively", () => {
    const { engine, moveRegistry } = buildEngine(
      { position: { x: 0, y: 0 } },
      { position: { x: 5, y: 5 } },
    );
    const state = engine.getGameState(PlayerId.Player1);
    const moveActions = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.Move);

    const scores = moveActions.map((action) => ({
      action,
      score: scoreAction(action, state, moveRegistry, engine, EASY_PROFILE),
    }));

    const positive = scores.filter((s) => s.score > 0);
    expect(positive.length).toBeGreaterThan(0);
  });

  it("penalizes movement onto dangerous terrain for non-immune Pokemon", () => {
    const data = loadData();
    const moveRegistry = new Map<string, MoveDefinition>();
    for (const move of data.moves) {
      moveRegistry.set(move.id, move);
    }
    const pokemonTypesMap = loadAllPokemonTypes();

    const attacker = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "p1-bulbasaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "p2-charmander",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 2 },
    });

    const state = MockBattle.stateFrom([attacker, defender], 6, 5);
    MockBattle.setTile(state, 1, 3, { terrain: TerrainType.Magma });

    const engine = new BattleEngine(state, moveRegistry, typeChart, pokemonTypesMap);
    const gameState = engine.getGameState(PlayerId.Player1);
    const legalMoves = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.Move);

    const moveToNormal = legalMoves.find(
      (a) =>
        a.kind === ActionKind.Move &&
        a.path[a.path.length - 1]?.x === 1 &&
        a.path[a.path.length - 1]?.y === 2,
    );
    const moveToMagma = legalMoves.find(
      (a) =>
        a.kind === ActionKind.Move &&
        a.path[a.path.length - 1]?.x === 1 &&
        a.path[a.path.length - 1]?.y === 3,
    );

    if (moveToNormal && moveToMagma) {
      const normalScore = scoreAction(moveToNormal, gameState, moveRegistry, engine, EASY_PROFILE);
      const magmaScore = scoreAction(moveToMagma, gameState, moveRegistry, engine, EASY_PROFILE);
      expect(normalScore).toBeGreaterThan(magmaScore);
    }
  });

  it("does not penalize movement onto dangerous terrain for immune Pokemon", () => {
    const data = loadData();
    const moveRegistry = new Map<string, MoveDefinition>();
    for (const move of data.moves) {
      moveRegistry.set(move.id, move);
    }
    const pokemonTypesMap = loadAllPokemonTypes();

    const attacker = MockPokemon.fresh(MockPokemon.charmander, {
      id: "p1-charmander",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
    });
    const defender = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "p2-bulbasaur",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 2 },
    });

    const state = MockBattle.stateFrom([attacker, defender], 6, 5);
    MockBattle.setTile(state, 1, 1, { terrain: TerrainType.Normal });
    MockBattle.setTile(state, 1, 3, { terrain: TerrainType.Magma });

    const engine = new BattleEngine(state, moveRegistry, typeChart, pokemonTypesMap);
    const gameState = engine.getGameState(PlayerId.Player1);
    const legalMoves = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.Move);

    const moveToNormal = legalMoves.find(
      (a) =>
        a.kind === ActionKind.Move &&
        a.path[a.path.length - 1]?.x === 1 &&
        a.path[a.path.length - 1]?.y === 1,
    );
    const moveToMagma = legalMoves.find(
      (a) =>
        a.kind === ActionKind.Move &&
        a.path[a.path.length - 1]?.x === 1 &&
        a.path[a.path.length - 1]?.y === 3,
    );

    if (moveToNormal && moveToMagma) {
      const normalScore = scoreAction(moveToNormal, gameState, moveRegistry, engine, EASY_PROFILE);
      const magmaScore = scoreAction(moveToMagma, gameState, moveRegistry, engine, EASY_PROFILE);
      expect(magmaScore).toBeCloseTo(normalScore, 5);
    }
  });

  it("prefers movement toward reachable enemy over movement blocked by obstacle", () => {
    const data = loadData();
    const moveRegistry = new Map<string, MoveDefinition>();
    for (const move of data.moves) {
      moveRegistry.set(move.id, move);
    }
    const pokemonTypesMap = loadAllPokemonTypes();

    const attacker = MockPokemon.fresh(MockPokemon.charmander, {
      id: "p1-charmander",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
    });
    const defender = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "p2-bulbasaur",
      playerId: PlayerId.Player2,
      position: { x: 6, y: 2 },
    });

    const state = MockBattle.stateFrom([attacker, defender], 7, 5);
    MockBattle.setTile(state, 3, 2, { terrain: TerrainType.Obstacle });

    const engine = new BattleEngine(state, moveRegistry, typeChart, pokemonTypesMap);
    const gameState = engine.getGameState(PlayerId.Player1);
    const legalMoves = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.Move);

    const scores = legalMoves.map((a) =>
      scoreAction(a, gameState, moveRegistry, engine, EASY_PROFILE),
    );
    expect(scores.some((s) => s > 0)).toBe(true);
  });

  it("scores Grondement positively (allies in radius) and Magné-Contrôle 0 without Plus/Minus", () => {
    const data = loadData();
    const moveRegistry = new Map<string, MoveDefinition>();
    for (const move of data.moves) {
      moveRegistry.set(move.id, move);
    }
    const pokemonTypesMap = loadAllPokemonTypes();

    const caster = MockPokemon.fresh(MockPokemon.charmander, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["howl", "magnetic-flux"],
    });
    const ally = MockPokemon.fresh(MockPokemon.charmander, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 5 },
    });
    const state = MockBattle.stateFrom([caster, ally, enemy], 6, 6);
    const engine = new BattleEngine(
      state,
      moveRegistry,
      typeChart,
      pokemonTypesMap,
      undefined,
      createPrng(42),
      42,
    );
    const gameState = engine.getGameState(PlayerId.Player1);

    const howlScore = scoreAction(
      {
        kind: ActionKind.UseMove,
        pokemonId: caster.id,
        moveId: "howl",
        targetPosition: caster.position,
      },
      gameState,
      moveRegistry,
      engine,
      EASY_PROFILE,
    );
    const fluxScore = scoreAction(
      {
        kind: ActionKind.UseMove,
        pokemonId: caster.id,
        moveId: "magnetic-flux",
        targetPosition: caster.position,
      },
      gameState,
      moveRegistry,
      engine,
      EASY_PROFILE,
    );

    expect(howlScore).toBeGreaterThan(0);
    expect(fluxScore).toBe(0);
  });

  it("scores a knockback move higher when it rings a foe off a ledge (fall KO) than on flat ground", () => {
    const data = loadData();
    const moveRegistry = new Map<string, MoveDefinition>();
    for (const move of data.moves) {
      moveRegistry.set(move.id, move);
    }
    const pokemonTypesMap = loadAllPokemonTypes();

    function scoreDragonTail(ledge: boolean): number {
      const attacker = MockPokemon.fresh(MockPokemon.charmander, {
        id: "p1",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["dragon-tail"],
      });
      const defender = MockPokemon.fresh(MockPokemon.bulbasaur, {
        id: "p2",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
      });
      const state = MockBattle.stateFrom([attacker, defender], 6, 3);
      MockBattle.setTile(state, 1, 0, { height: 4.5 });
      MockBattle.setTile(state, 2, 0, { height: ledge ? 0.5 : 4.5 });
      const engine = new BattleEngine(state, moveRegistry, typeChart, pokemonTypesMap);
      state.activePokemonId = "p1";
      const gameState = engine.getGameState(PlayerId.Player1);
      return scoreAction(
        {
          kind: ActionKind.UseMove,
          pokemonId: "p1",
          moveId: "dragon-tail",
          targetPosition: { x: 1, y: 0 },
        },
        gameState,
        moveRegistry,
        engine,
        EASY_PROFILE,
      );
    }

    expect(scoreDragonTail(true)).toBeGreaterThan(scoreDragonTail(false));
  });
});

/*
 * 🔴 Ces tests passent en HARD_PROFILE au plan 214, et ce n'est pas un ajustement de confort.
 *
 * Le positionnement préparatoire de l'éjection (volets A3/A4) est devenu une CAPACITÉ de palier
 * (`AiCapabilities.ringOutSetup`) et non plus un comportement commun : la mesure avait montré que les
 * trois niveaux étaient indiscernables parce que tous les volets tactiques tournaient à l'identique.
 * Facile et Moyenne jouent désormais l'éjection quand elle tombe, sans la CHERCHER — c'est
 * précisément ce qui doit se voir en jouant. Ces deux tests vérifient la capacité, donc le palier qui
 * la porte.
 */
describe("ring-out positioning (plan 172)", () => {
  it("A3: scores moving to an aligning tile higher when the knockback would ring a foe out", () => {
    const data = loadData();
    const moveRegistry = new Map<string, MoveDefinition>();
    for (const move of data.moves) {
      moveRegistry.set(move.id, move);
    }
    const pokemonTypesMap = loadAllPokemonTypes();

    function scoreMoveToAlign(ledge: boolean): number {
      const attacker = MockPokemon.fresh(MockPokemon.charmander, {
        id: "p1",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["dragon-tail"],
      });
      const defender = MockPokemon.fresh(MockPokemon.bulbasaur, {
        id: "p2",
        playerId: PlayerId.Player2,
        position: { x: 2, y: 0 },
      });
      const state = MockBattle.stateFrom([attacker, defender], 6, 3);
      MockBattle.setTile(state, 0, 0, { height: 4.5 });
      MockBattle.setTile(state, 1, 0, { height: 4.5 });
      MockBattle.setTile(state, 2, 0, { height: 4.5 });
      MockBattle.setTile(state, 3, 0, { height: ledge ? 0.5 : 4.5 });
      const engine = new BattleEngine(state, moveRegistry, typeChart, pokemonTypesMap);
      state.activePokemonId = "p1";
      const gameState = engine.getGameState(PlayerId.Player1);
      return scoreAction(
        { kind: ActionKind.Move, pokemonId: "p1", path: [{ x: 1, y: 0 }] },
        gameState,
        moveRegistry,
        engine,
        HARD_PROFILE,
      );
    }

    expect(scoreMoveToAlign(true)).toBeGreaterThan(scoreMoveToAlign(false));
  });

  it("A4: penalizes moving to a tile where an enemy knockback would ring us out fatally", () => {
    const data = loadData();
    const moveRegistry = new Map<string, MoveDefinition>();
    for (const move of data.moves) {
      moveRegistry.set(move.id, move);
    }
    const pokemonTypesMap = loadAllPokemonTypes();

    function scoreMoveNearEnemy(exposed: boolean): number {
      const self = MockPokemon.fresh(MockPokemon.charmander, {
        id: "p1",
        playerId: PlayerId.Player1,
        position: { x: 1, y: 1 },
        moveIds: ["ember"],
      });
      const enemy = MockPokemon.fresh(MockPokemon.bulbasaur, {
        id: "p2",
        playerId: PlayerId.Player2,
        position: { x: 2, y: 0 },
        moveIds: ["dragon-tail"],
      });
      const state = MockBattle.stateFrom([self, enemy], 6, 3);
      MockBattle.setTile(state, 0, 0, { height: exposed ? 0.5 : 4.5 });
      MockBattle.setTile(state, 1, 0, { height: 4.5 });
      MockBattle.setTile(state, 2, 0, { height: 4.5 });
      const engine = new BattleEngine(state, moveRegistry, typeChart, pokemonTypesMap);
      state.activePokemonId = "p1";
      const gameState = engine.getGameState(PlayerId.Player1);
      return scoreAction(
        { kind: ActionKind.Move, pokemonId: "p1", path: [{ x: 1, y: 0 }] },
        gameState,
        moveRegistry,
        engine,
        HARD_PROFILE,
      );
    }

    expect(scoreMoveNearEnemy(true)).toBeLessThan(scoreMoveNearEnemy(false));
  });
});

function scoreMoveOn(
  moveId: string,
  attackerOverrides: Partial<PokemonInstance> = {},
  defenderOverrides: Partial<PokemonInstance> = {},
): number {
  const { engine, moveRegistry } = buildEngine(attackerOverrides, defenderOverrides);
  const state = engine.getGameState(PlayerId.Player1);
  return scoreAction(
    {
      kind: ActionKind.UseMove,
      pokemonId: "p1-charmander",
      moveId,
      targetPosition: { x: 1, y: 0 },
    },
    state,
    moveRegistry,
    engine,
    EASY_PROFILE,
  );
}

describe("scoreAction — grouped AI pass (plan 160)", () => {
  it("Croc Fatal now scores positively on a high-HP target", () => {
    expect(scoreMoveOn("super-fang", {}, { currentHp: 200, maxHp: 200 })).toBeGreaterThan(0);
  });

  it("Tout ou Rien scores positively when it secures a KO", () => {
    expect(
      scoreMoveOn("final-gambit", { currentHp: 200, maxHp: 200 }, { currentHp: 30, maxHp: 100 }),
    ).toBeGreaterThan(0);
  });

  it("Vent Arrière scores positively (was rejected by the generic path)", () => {
    const { engine, moveRegistry } = buildEngine();
    const state = engine.getGameState(PlayerId.Player1);
    const score = scoreAction(
      {
        kind: ActionKind.UseMove,
        pokemonId: "p1-charmander",
        moveId: "tailwind",
        targetPosition: { x: 0, y: 1 },
      },
      state,
      moveRegistry,
      engine,
      EASY_PROFILE,
    );
    expect(score).toBeGreaterThan(0);
  });

  it("Bâillement scores positively on a healthy enemy, rejected on an already-statused one", () => {
    expect(scoreMoveOn("yawn", {}, { currentHp: 100, maxHp: 100 })).toBeGreaterThan(0);
    expect(scoreMoveOn("yawn", {}, { drowsyTurns: 1, currentHp: 100, maxHp: 100 })).toBeLessThan(0);
  });

  it("Suc Digestif scores positively against a REVEALED defensive ability", () => {
    expect(
      scoreMoveOn("gastro-acid", {}, { abilityId: "levitate", revealedAbility: true }),
    ).toBeGreaterThan(0);
  });

  it("Suc Digestif is not worth playing against an ability the fog still hides", () => {
    expect(scoreMoveOn("gastro-acid", {}, { abilityId: "levitate" })).toBeLessThanOrEqual(0);
  });

  it("faux-KO: a lethal hit scores lower against a REVEALED Ceinture Force at full HP", () => {
    const withSash = scoreMoveOn(
      "fire-blast",
      {},
      { currentHp: 10, maxHp: 10, heldItemId: "focus-sash", revealedItem: true },
    );
    const without = scoreMoveOn("fire-blast", {}, { currentHp: 10, maxHp: 10 });
    expect(withSash).toBeLessThan(without);
  });

  it("faux-KO: an UNREVEALED Ceinture Force fools a palier blinded by the fog", () => {
    const hidden = scoreMoveOn(
      "fire-blast",
      {},
      { currentHp: 10, maxHp: 10, heldItemId: "focus-sash" },
    );
    const without = scoreMoveOn("fire-blast", {}, { currentHp: 10, maxHp: 10 });
    expect(hidden).toBe(without);
  });
});

function scoreManipMove(
  moveId: string,
  mutateEnemy?: (enemy: PokemonInstance) => void,
  mutateCaster?: (caster: PokemonInstance) => void,
): number {
  const data = loadData();
  const moveRegistry = new Map<string, MoveDefinition>();
  for (const move of data.moves) {
    moveRegistry.set(move.id, move);
  }
  const pokemonTypesMap = loadAllPokemonTypes();
  const caster = MockPokemon.fresh(MockPokemon.charmander, {
    id: "p1",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
  });
  const enemy = MockPokemon.fresh(MockPokemon.bulbasaur, {
    id: "p2",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
  });
  mutateCaster?.(caster);
  mutateEnemy?.(enemy);
  const state = MockBattle.stateFrom([caster, enemy], 6, 6);
  const engine = new BattleEngine(
    state,
    moveRegistry,
    typeChart,
    pokemonTypesMap,
    undefined,
    createPrng(42),
    42,
  );
  state.activePokemonId = "p1";
  return scoreAction(
    {
      kind: ActionKind.UseMove,
      pokemonId: "p1",
      moveId,
      targetPosition: { x: 1, y: 0 },
    },
    engine.getGameState(PlayerId.Player1),
    moveRegistry,
    engine,
    EASY_PROFILE,
  );
}

describe("scoreAction — Phase 3 heuristics (plan 161)", () => {
  it("Boost (psych-up) scores positively on a boosted target, negatively on a debuffed one", () => {
    expect(
      scoreManipMove("psych-up", (enemy) => {
        enemy.statStages[StatName.Attack] = 3;
      }),
    ).toBeGreaterThan(0);
    expect(
      scoreManipMove("psych-up", (enemy) => {
        enemy.statStages[StatName.Attack] = -3;
      }),
    ).toBeLessThan(0);
  });

  it("Renversement (topsy-turvy) scores positively on a boosted target, negatively on a debuffed one", () => {
    expect(
      scoreManipMove("topsy-turvy", (enemy) => {
        enemy.statStages[StatName.SpAttack] = 4;
      }),
    ).toBeGreaterThan(0);
    expect(
      scoreManipMove("topsy-turvy", (enemy) => {
        enemy.statStages[StatName.SpAttack] = -2;
      }),
    ).toBeLessThan(0);
  });

  it("Permuforce (power-swap) scores positively when the target holds attack boosts we lack", () => {
    expect(
      scoreManipMove("power-swap", (enemy) => {
        enemy.statStages[StatName.Attack] = 2;
        enemy.statStages[StatName.SpAttack] = 2;
      }),
    ).toBeGreaterThan(0);
  });

  it("Buée Noire (haze) scores positively when a boosted enemy shares the zone", () => {
    expect(
      scoreManipMove("haze", (enemy) => {
        enemy.statStages[StatName.Attack] = 3;
      }),
    ).toBeGreaterThan(0);
    expect(scoreManipMove("haze")).toBeLessThan(0);
  });

  it("Recyclage (recycle) scores positively only when an item was consumed", () => {
    expect(scoreMoveOn("recycle", { consumedItemId: "sitrus-berry" })).toBeGreaterThan(0);
    expect(scoreMoveOn("recycle", {})).toBeLessThan(0);
  });

  it("Attraction (attract) scores positively on an opposite-gender threat, rejected on same gender", () => {
    expect(
      scoreMoveOn("attract", { gender: PokemonGender.Male }, { gender: PokemonGender.Female }),
    ).toBeGreaterThan(0);
    expect(
      scoreMoveOn("attract", { gender: PokemonGender.Male }, { gender: PokemonGender.Male }),
    ).toBeLessThan(0);
  });

  it("Cognobidon (belly-drum) is rejected when a foe would KO us, valued when safe", () => {
    expect(scoreMoveOn("belly-drum", { currentHp: 15, maxHp: 15 })).toBeLessThan(0);
    expect(scoreMoveOn("belly-drum", { currentHp: 300, maxHp: 300 })).toBeGreaterThan(0);
  });
});

describe("CT-aware scoring (plan 165)", () => {
  function buildCtEngine(defenderOverrides: Partial<PokemonInstance> = {}) {
    const moveRegistry = new Map<string, MoveDefinition>();
    const fast = MockMove.fresh(MockMove.special, { id: "ct-fast", pp: 20, power: 60 });
    const slow = MockMove.fresh(MockMove.special, { id: "ct-slow", pp: 8, power: 60 });
    moveRegistry.set(fast.id, fast);
    moveRegistry.set(slow.id, slow);

    const pokemonTypesMap = loadAllPokemonTypes();
    const attacker = MockPokemon.fresh(MockPokemon.charmander, {
      id: "p1-charmander",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["ct-fast", "ct-slow"],
    });
    const defender = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "p2-bulbasaur",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      ...defenderOverrides,
    });

    const state = MockBattle.stateFrom([attacker, defender], 6, 6);
    const engine = new BattleEngine(
      state,
      moveRegistry,
      typeChart,
      pokemonTypesMap,
      undefined,
      createPrng(42),
      42,
    );
    return { engine, moveRegistry };
  }

  function scoreByMoveId(defenderOverrides: Partial<PokemonInstance>, moveId: string): number {
    const { engine, moveRegistry } = buildCtEngine(defenderOverrides);
    const state = engine.getGameState(PlayerId.Player1);
    const action = engine
      .getLegalActions(PlayerId.Player1)
      .find((a) => a.kind === ActionKind.UseMove && a.moveId === moveId);
    if (!action) {
      throw new Error(`No legal UseMove action for ${moveId}`);
    }
    return scoreAction(action, state, moveRegistry, engine, EASY_PROFILE);
  }

  it("prefers the fast move (CT 500) over the slow move (CT 900) at equal damage, non-KO target", () => {
    const fastScore = scoreByMoveId({ currentHp: 105, maxHp: 105 }, "ct-fast");
    const slowScore = scoreByMoveId({ currentHp: 105, maxHp: 105 }, "ct-slow");
    expect(fastScore).toBeGreaterThan(slowScore);
  });

  it("keeps full value on a slow KO move (CT weighting never divides a kill)", () => {
    const koScore = scoreByMoveId({ currentHp: 1, maxHp: 105 }, "ct-slow");
    expect(koScore).toBeGreaterThanOrEqual(EASY_PROFILE.scoringWeights.killPotential);
  });

  it("keeps full value on a slow move that secures a lethal ring-out (not just a direct KO)", () => {
    const moveRegistry = new Map<string, MoveDefinition>();
    const knock = MockMove.fresh(MockMove.physical, {
      id: "ct-knock",
      pp: 8,
      power: 40,
      effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Knockback, distance: 1 }],
    });
    moveRegistry.set(knock.id, knock);

    const pokemonTypesMap = loadAllPokemonTypes();
    const attacker = MockPokemon.fresh(MockPokemon.charmander, {
      id: "p1-charmander",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["ct-knock"],
    });
    const defender = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "p2-bulbasaur",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 150,
      maxHp: 150,
    });

    const state = MockBattle.stateFrom([attacker, defender], 6, 6);
    MockBattle.setTile(state, 2, 0, { terrain: TerrainType.Lava });
    const engine = new BattleEngine(
      state,
      moveRegistry,
      typeChart,
      pokemonTypesMap,
      undefined,
      createPrng(42),
      42,
    );

    const gameState = engine.getGameState(PlayerId.Player1);
    const action = engine
      .getLegalActions(PlayerId.Player1)
      .find((a) => a.kind === ActionKind.UseMove && a.moveId === "ct-knock");
    if (!action) {
      throw new Error("No legal UseMove action for ct-knock");
    }
    const score = scoreAction(action, gameState, moveRegistry, engine, EASY_PROFILE);
    expect(score).toBeGreaterThanOrEqual(EASY_PROFILE.scoringWeights.killPotential);
  });
});

/**
 * Le ciblage en mêlée générale, vu depuis le scoreur entier (plan 213, lot G).
 *
 * `camp-bias.test.ts` éprouve la pondération elle-même ; ici on vérifie ce qu'elle DEVIENT une fois
 * composée avec la létalité, l'efficacité de type et le reste du barème — c'est-à-dire ce que
 * l'arbitrage de l'humain exigeait : un départage, jamais une domination.
 */
describe("scoreAction — pondération de camp en mêlée générale", () => {
  /**
   * Trois camps, dont deux CIBLES RIGOUREUSEMENT IDENTIQUES.
   *
   * 🔴 La vigueur des camps se règle par leur SECOND Pokemon, jamais par la cible elle-même. C'est
   * la seule façon d'obtenir une « situation tactique équivalente » : baisser les PV de la cible
   * pour affaiblir son camp la rendrait du même coup plus facile à achever, et on mesurerait la
   * létalité en croyant mesurer le biais. Un premier jet de ce test est tombé exactement là-dessus.
   */
  function buildFreeForAll(secondBackupHp: number, thirdBackupHp: number) {
    const data = loadData();
    const moveRegistry = new Map<string, MoveDefinition>();
    for (const move of data.moves) {
      moveRegistry.set(move.id, move);
    }

    const self = MockPokemon.fresh(MockPokemon.charmander, {
      id: "p1-charmander",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    // Deux cibles RIGOUREUSEMENT équivalentes — même espèce, mêmes PV max, même distance — pour que
    // le camp soit la seule différence qui reste.
    const leaderTarget = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "p2-bulbasaur",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
    });
    const trailerTarget = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "p3-bulbasaur",
      playerId: PlayerId.Player3,
      position: { x: 1, y: 2 },
    });
    // Les deux réserves sont hors de portée, au fond de la carte : elles ne pèsent que sur la
    // VIGUEUR de leur camp, jamais sur le choix de cible.
    const leaderBackup = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "p2-squirtle",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      currentHp: secondBackupHp,
    });
    const trailerBackup = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "p3-squirtle",
      playerId: PlayerId.Player3,
      position: { x: 0, y: 5 },
      currentHp: thirdBackupHp,
    });

    const state = MockBattle.stateFrom(
      [self, leaderTarget, trailerTarget, leaderBackup, trailerBackup],
      6,
      6,
    );
    const engine = new BattleEngine(
      state,
      moveRegistry,
      typeChart,
      loadAllPokemonTypes(),
      undefined,
      createPrng(42),
      42,
    );
    return { engine, moveRegistry };
  }

  /** Le meilleur score d'attaque visant une case donnée. */
  function bestScoreAgainst(
    engine: BattleEngine,
    moveRegistry: Map<string, MoveDefinition>,
    target: { x: number; y: number },
  ): number {
    const state = engine.getGameState(PlayerId.Player1);
    const scores = engine
      .getLegalActions(PlayerId.Player1)
      .filter(
        (action) =>
          action.kind === ActionKind.UseMove &&
          action.targetPosition?.x === target.x &&
          action.targetPosition?.y === target.y,
      )
      .map((action) => scoreAction(action, state, moveRegistry, engine, EASY_PROFILE));
    return scores.length === 0 ? 0 : Math.max(...scores);
  }

  it("🔴 préfère la cible du camp qui mène, à situation équivalente", () => {
    // Réserve du camp 2 intacte, réserve du camp 3 à terre. Les deux CIBLES sont identiques : même
    // espèce, mêmes PV, même distance. Seule la vigueur de leur camp diffère.
    const { engine, moveRegistry } = buildFreeForAll(100, 1);

    const againstLeader = bestScoreAgainst(engine, moveRegistry, { x: 3, y: 2 });
    const againstTrailer = bestScoreAgainst(engine, moveRegistry, { x: 1, y: 2 });

    expect(againstLeader).toBeGreaterThan(againstTrailer);
  });

  it("🔴 ne départage rien quand les trois camps sont à égalité", () => {
    // Même montage, réserves identiques : personne ne mène, les deux cibles doivent scorer pareil.
    // Sinon c'est l'ordre d'itération qui a tranché.
    const { engine, moveRegistry } = buildFreeForAll(100, 100);

    const left = bestScoreAgainst(engine, moveRegistry, { x: 1, y: 2 });
    const right = bestScoreAgainst(engine, moveRegistry, { x: 3, y: 2 });

    expect(left).toBe(right);
  });

  it("🔴 laisse un K.O. garanti l'emporter sur la cible du meneur", () => {
    /*
     * La cible du TRAÎNARD est à un point de vie ; celle du MENEUR est intacte. Le biais pousse vers
     * le meneur, la létalité vers le traînard — et la létalité doit gagner. C'est la contrainte que
     * l'humain a posée en écartant la version forte du biais.
     *
     * Ce cas est né d'un échec : le premier jet du test de départage utilisait ce montage-là en
     * croyant mesurer autre chose.
     */
    const { engine, moveRegistry } = buildFreeForAll(100, 1);
    const state = engine.getGameState(PlayerId.Player1);
    const trailerTarget = state.pokemon.get("p3-bulbasaur");
    if (trailerTarget !== undefined) {
      trailerTarget.currentHp = 1;
    }

    const againstLeader = bestScoreAgainst(engine, moveRegistry, { x: 3, y: 2 });
    const againstLethal = bestScoreAgainst(engine, moveRegistry, { x: 1, y: 2 });

    expect(againstLethal).toBeGreaterThan(againstLeader);
  });
});
