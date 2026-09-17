#!/usr/bin/env tsx
import {
  type AiProfile,
  BattleEngine,
  BattleEventType,
  type BattleState,
  computeCombatStats,
  computeMovement,
  createPrng,
  createRepetitionGuard,
  Direction,
  EASY_PROFILE,
  HARD_PROFILE,
  MEDIUM_PROFILE,
  type MoveDefinition,
  Nature,
  PlacementMode,
  PlacementPhase,
  type PlacementTeam,
  PlayerId,
  PokemonGender,
  type PokemonInstance,
  type PokemonType,
  pickScoredAction,
  StatName,
  type TileState,
  TurnPipeline,
  Weather,
} from "../packages/core/src/index.js";
/**
 * ai-bench — fait jouer l'IA contre elle-même et mesure ce que valent RÉELLEMENT les niveaux.
 *
 * 🔴 Né du plan 214, d'un constat que personne n'avait mesuré : les trois profils d'IA
 * (`EASY_PROFILE`, `MEDIUM_PROFILE`, `HARD_PROFILE`) existent depuis le plan 029 et **se valent en
 * pratique**. La margin de victoire — les Pokemon encore debout chez le gagnant — est la même partout :
 * 3,2/6 quand Facile bat Facile, 3,3/6 quand Difficile bat Facile. Le taux de victoire seul cachait
 * ça : c'est la MARGE qui le révèle, et c'est pourquoi elle est la colonne centrale de ce relevé.
 *
 * Deuxième chose qu'il mesure, et qui a confirmé un bug rapporté par l'humain : en **miroir**
 * (équipes identiques des deux côtés) jusqu'à 8 battles sur 40 **ne se terminent jamais**. Les
 * paliers de stats atteignent +6 partout et plus personne ne peut blesser personne.
 *
 * ⚠️ **Pas dans la suite de tests, et c'est délibéré** : 480 battles prennent des minutes. Le gate
 * doit rester rapide. On lance ce banc à la main quand on touche au scorer ou aux profils.
 *
 * Imports RELATIFS vers les sources, et non `@pokemon-tactic/core` : `scripts/tsconfig.json` ne
 * configure aucune résolution d'espace de travail, et lui en ajouter une serait un changement
 * structurel pour un seul script. Les chemins relatifs typechecent et tournent sous tsx sans rien
 * toucher d'autre.
 *
 *   pnpm ai:bench            # 40 parties par affrontement
 *   pnpm ai:bench 200        # plus de parties = moins de bruit (±8 points à 40, ±4 à 200)
 *
 * Lecture : une différence de moins de ~0,3 survivant, ou de moins de ~8 points de victoire à
 * 40 battles, est du BRUIT. Ne rien conclure d'un écart plus petit.
 */
import { loadData, pocArena, typeChart } from "../packages/data/src/index.js";

const BATTLE_LEVEL = 50;
const MAX_ACTIONS = 4000;

const ZERO_STAT_STAGES = {
  [StatName.Hp]: 0,
  [StatName.Attack]: 0,
  [StatName.Defense]: 0,
  [StatName.SpAttack]: 0,
  [StatName.SpDefense]: 0,
  [StatName.Speed]: 0,
  [StatName.Accuracy]: 0,
  [StatName.Evasion]: 0,
};

interface Outcome {
  winner: string | null;
  actions: number;
  stalled: boolean;
  highestStage: number;
  /** Pokemon encore debout dans chaque camp à la ended — c'est la MARGE, pas le simple verdict. */
  survivorsOne: number;
  survivorsTwo: number;
}

const donnees = loadData();
const moveRegistry = new Map<string, MoveDefinition>(donnees.moves.map((m) => [m.id, m]));
const pokemonTypesMap = new Map<string, PokemonType[]>(donnees.pokemon.map((p) => [p.id, p.types]));
const pokemonDefs = new Map(donnees.pokemon.map((p) => [p.id, p]));
const roster = donnees.pokemon.map((p) => p.id);

function drawTeam(random: () => number): string[] {
  const picked: string[] = [];
  while (picked.length < 6) {
    const candidate = roster[Math.floor(random() * roster.length)];
    if (candidate !== undefined && !picked.includes(candidate)) {
      picked.push(candidate);
    }
  }
  return picked;
}

function playOneBattle(
  profileOne: AiProfile,
  profileTwo: AiProfile,
  seed: number,
  mirrorTeams: boolean,
): Outcome {
  const draw = createPrng(seed);
  const teamOne = drawTeam(draw);
  const teamTwo = mirrorTeams ? teamOne : drawTeam(draw);

  const teams: PlacementTeam[] = [
    {
      playerId: PlayerId.Player1,
      availablePokemonIds: teamOne.map((id) => `p1-${id}`),
      controller: "ai" as const,
    },
    {
      playerId: PlayerId.Player2,
      availablePokemonIds: teamTwo.map((id) => `p2-${id}`),
      controller: "ai" as const,
    },
  ];

  const map = pocArena;
  const format = map.formats[0];
  if (!format) {
    throw new Error("pas de format");
  }
  const gridCentre = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  const placements = new PlacementPhase(
    map,
    teams,
    format,
    PlacementMode.Random,
    seed,
  ).autoPlaceAll(gridCentre);

  const grid: TileState[][] = map.tiles.map((row) =>
    row.map((tile) => ({ ...tile, occupantId: null })),
  );
  const pokemonMap = new Map<string, PokemonInstance>();
  for (const placement of placements) {
    const definitionId = placement.pokemonId.replace(/^p\d+-/, "");
    const definition = pokemonDefs.get(definitionId);
    const team = teams.find((t) => t.availablePokemonIds.includes(placement.pokemonId));
    if (!definition || !team) {
      throw new Error(`introuvable : ${placement.pokemonId}`);
    }
    const combatStats = computeCombatStats(definition.baseStats, BATTLE_LEVEL);
    const instance: PokemonInstance = {
      id: placement.pokemonId,
      definitionId: definition.id,
      playerId: team.playerId,
      level: BATTLE_LEVEL,
      currentHp: combatStats.hp,
      maxHp: combatStats.hp,
      baseStats: { ...definition.baseStats },
      combatStats,
      derivedStats: {
        movement: computeMovement(definition.baseStats.speed, 0),
        jump: 1,
        initiative: combatStats.speed,
      },
      statStages: { ...ZERO_STAT_STAGES },
      statusEffects: [],
      position: placement.position,
      orientation: Direction.South,
      moveIds: definition.movepool.slice(0, 4),
      activeDefense: null,
      toxicCounter: 0,
      volatileStatuses: [],
      recharging: false,
      gender: PokemonGender.Genderless,
      nature: Nature.Hardy,
      weight: 50,
      lastEndureAtAction: null,
    };
    pokemonMap.set(instance.id, instance);
    const tile = grid[placement.position.y]?.[placement.position.x];
    if (tile) {
      tile.occupantId = instance.id;
    }
  }

  const state: BattleState = {
    grid,
    pokemon: pokemonMap,
    weather: Weather.None,
    weatherTurnsRemaining: 0,
    auras: [],
    fieldTerrains: [],
    distortionZones: [],
    fieldGlobalZones: [],
    entryHazards: [],
    pendingStrikes: [],
    activePokemonId: "",
  };

  const engine = new BattleEngine(
    state,
    moveRegistry,
    typeChart,
    pokemonTypesMap,
    new TurnPipeline(),
    createPrng(seed),
    seed,
  );

  const randomOne = createPrng(seed * 7 + 1);
  const randomTwo = createPrng(seed * 13 + 2);
  // Un filet par camp, comme dans le vrai jeu (`AiTeamController`) — sinon le banc ne mesurerait pas
  // ce que le joueur subit.
  const guardOne = createRepetitionGuard();
  const guardTwo = createRepetitionGuard();

  let actions = 0;
  let winner: string | null = null;
  let highestStage = 0;

  while (actions < MAX_ACTIONS) {
    const gameState = engine.getGameState(PlayerId.Player1);
    const activeId = gameState.activePokemonId;
    if (!activeId) {
      break;
    }
    const active = gameState.pokemon.get(activeId);
    if (!active) {
      break;
    }
    const playerId = active.playerId;
    const legalActions = engine.getLegalActions(playerId);
    if (legalActions.length === 0) {
      break;
    }

    const isSideOne = playerId === PlayerId.Player1;
    const action = pickScoredAction(
      legalActions,
      gameState,
      moveRegistry,
      engine,
      isSideOne ? profileOne : profileTwo,
      isSideOne ? randomOne : randomTwo,
      (isSideOne ? guardOne : guardTwo).observe(gameState),
    );

    const result = engine.submitAction(playerId, action);
    actions++;

    for (const mon of gameState.pokemon.values()) {
      for (const palier of Object.values(mon.statStages)) {
        highestStage = Math.max(highestStage, palier);
      }
    }

    const ended = result.events.find((e) => e.type === BattleEventType.BattleEnded);
    if (ended && ended.type === BattleEventType.BattleEnded) {
      winner = ended.winnerId;
      break;
    }
  }

  let survivorsOne = 0;
  let survivorsTwo = 0;
  for (const mon of state.pokemon.values()) {
    if (mon.currentHp <= 0) {
      continue;
    }
    if (mon.playerId === PlayerId.Player1) {
      survivorsOne++;
    } else {
      survivorsTwo++;
    }
  }

  return {
    winner,
    actions,
    stalled: actions >= MAX_ACTIONS,
    highestStage,
    survivorsOne,
    survivorsTwo,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

const MATCHUPS: [string, AiProfile, string, AiProfile][] = [
  ["Facile", EASY_PROFILE, "Moyenne", MEDIUM_PROFILE],
  ["Facile", EASY_PROFILE, "Difficile", HARD_PROFILE],
  ["Moyenne", MEDIUM_PROFILE, "Difficile", HARD_PROFILE],
  ["Facile", EASY_PROFILE, "Facile", EASY_PROFILE],
  ["Moyenne", MEDIUM_PROFILE, "Moyenne", MEDIUM_PROFILE],
  ["Difficile", HARD_PROFILE, "Difficile", HARD_PROFILE],
];

function report(mirrorTeams: boolean, battles: number): void {
  console.log(
    `\n=== ÉQUIPES ${mirrorTeams ? "IDENTIQUES (miroir)" : "ALÉATOIRES"} — ${battles} parties par affrontement ===`,
  );
  for (const [nameOne, profileOne, nameTwo, profileTwo] of MATCHUPS) {
    let v1 = 0;
    let v2 = 0;
    let stalled = 0;
    const durations: number[] = [];
    const winnerMargins: number[] = [];
    let sweeps = 0;

    for (let i = 0; i < battles; i++) {
      const outcome = playOneBattle(profileOne, profileTwo, 1000 + i * 37, mirrorTeams);
      durations.push(outcome.actions);
      if (outcome.stalled) {
        stalled++;
        continue;
      }
      if (outcome.winner === "player-1") {
        v1++;
        winnerMargins.push(outcome.survivorsOne);
        if (outcome.survivorsTwo === 0 && outcome.survivorsOne === 6) {
          sweeps++;
        }
      } else if (outcome.winner === "player-2") {
        v2++;
        winnerMargins.push(outcome.survivorsTwo);
        if (outcome.survivorsOne === 0 && outcome.survivorsTwo === 6) {
          sweeps++;
        }
      }
    }

    const decided = v1 + v2;
    const margin =
      winnerMargins.length > 0
        ? (winnerMargins.reduce((a, b) => a + b, 0) / winnerMargins.length).toFixed(1)
        : "-";
    console.log(
      `${nameOne.padEnd(9)} vs ${nameTwo.padEnd(9)} | victoires ${String(v1).padStart(3)}-${String(v2).padStart(3)}` +
        ` | survivants du gagnant ${margin}/6` +
        ` | 6-0 : ${String(sweeps).padStart(3)}/${String(decided).padStart(3)}` +
        ` | jamais finies ${String(stalled).padStart(3)}/${battles}` +
        ` | médiane ${String(median(durations)).padStart(4)} actions`,
    );
  }
}

const battles = Number(process.argv[2] ?? "40");
if (!Number.isInteger(battles) || battles < 1) {
  console.error("Usage : pnpm ai:bench [nombre de parties par affrontement]");
  process.exit(1);
}
report(false, battles);
report(true, battles);
