#!/usr/bin/env tsx
/**
 * ai-bench — fait jouer l'IA contre elle-même et mesure ce que valent RÉELLEMENT les niveaux.
 *
 * 🔴 Né du plan 214, d'un constat que personne n'avait mesuré : les trois profils d'IA
 * (`EASY_PROFILE`, `MEDIUM_PROFILE`, `HARD_PROFILE`) existent depuis le plan 029 et **se valent en
 * pratique**. La marge de victoire — les Pokemon encore debout chez le gagnant — est la même partout :
 * 3,2/6 quand Facile bat Facile, 3,3/6 quand Difficile bat Facile. Le taux de victoire seul cachait
 * ça : c'est la MARGE qui le révèle, et c'est pourquoi elle est la colonne centrale de ce relevé.
 *
 * Deuxième chose qu'il mesure, et qui a confirmé un bug rapporté par l'humain : en **miroir**
 * (équipes identiques des deux côtés) jusqu'à 8 parties sur 40 **ne se terminent jamais**. Les
 * paliers de stats atteignent +6 partout et plus personne ne peut blesser personne.
 *
 * ⚠️ **Pas dans la suite de tests, et c'est délibéré** : 480 parties prennent des minutes. Le gate
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
 * 40 parties, est du BRUIT. Ne rien conclure d'un écart plus petit.
 */
import { loadData, pocArena, typeChart } from "../packages/data/src/index.js";
import {
  type AiProfile,
  BattleEngine,
  BattleEventType,
  type BattleState,
  computeCombatStats,
  computeMovement,
  createPrng,
  Direction,
  EASY_PROFILE,
  HARD_PROFILE,
  MEDIUM_PROFILE,
  type MoveDefinition,
  Nature,
  pickScoredAction,
  PlacementMode,
  PlacementPhase,
  type PlacementTeam,
  PlayerId,
  PokemonGender,
  type PokemonInstance,
  type PokemonType,
  StatName,
  type TileState,
  TurnPipeline,
  Weather,
} from "../packages/core/src/index.js";

const BATTLE_LEVEL = 50;
const MAX_ACTIONS = 4000;
const PARTIES_PAR_AFFRONTEMENT = 40;

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

interface Issue {
  vainqueur: string | null;
  actions: number;
  statuQuo: boolean;
  paliersMax: number;
  /** Pokemon encore debout dans chaque camp à la fin — c'est la MARGE, pas le simple verdict. */
  survivants1: number;
  survivants2: number;
}

const donnees = loadData();
const moveRegistry = new Map<string, MoveDefinition>(donnees.moves.map((m) => [m.id, m]));
const pokemonTypesMap = new Map<string, PokemonType[]>(donnees.pokemon.map((p) => [p.id, p.types]));
const pokemonDefs = new Map(donnees.pokemon.map((p) => [p.id, p]));
const roster = donnees.pokemon.map((p) => p.id);

function tirerEquipe(random: () => number): string[] {
  const choisis: string[] = [];
  while (choisis.length < 6) {
    const candidat = roster[Math.floor(random() * roster.length)];
    if (candidat !== undefined && !choisis.includes(candidat)) {
      choisis.push(candidat);
    }
  }
  return choisis;
}

function jouerUnePartie(
  profil1: AiProfile,
  profil2: AiProfile,
  graine: number,
  memeEquipe: boolean,
): Issue {
  const tirage = createPrng(graine);
  const equipe1 = tirerEquipe(tirage);
  const equipe2 = memeEquipe ? equipe1 : tirerEquipe(tirage);

  const teams: PlacementTeam[] = [
    {
      playerId: PlayerId.Player1,
      availablePokemonIds: equipe1.map((id) => `p1-${id}`),
      controller: "ai" as const,
    },
    {
      playerId: PlayerId.Player2,
      availablePokemonIds: equipe2.map((id) => `p2-${id}`),
      controller: "ai" as const,
    },
  ];

  const map = pocArena;
  const format = map.formats[0];
  if (!format) {
    throw new Error("pas de format");
  }
  const centre = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  const placements = new PlacementPhase(
    map,
    teams,
    format,
    PlacementMode.Random,
    graine,
  ).autoPlaceAll(centre);

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
    createPrng(graine),
    graine,
  );

  const random1 = createPrng(graine * 7 + 1);
  const random2 = createPrng(graine * 13 + 2);

  let actions = 0;
  let vainqueur: string | null = null;
  let paliersMax = 0;

  while (actions < MAX_ACTIONS) {
    const gameState = engine.getGameState(PlayerId.Player1);
    const actifId = gameState.activePokemonId;
    if (!actifId) {
      break;
    }
    const actif = gameState.pokemon.get(actifId);
    if (!actif) {
      break;
    }
    const playerId = actif.playerId;
    const legales = engine.getLegalActions(playerId);
    if (legales.length === 0) {
      break;
    }

    const estUn = playerId === PlayerId.Player1;
    const action = pickScoredAction(
      legales,
      gameState,
      moveRegistry,
      engine,
      estUn ? profil1 : profil2,
      estUn ? random1 : random2,
    );

    const resultat = engine.submitAction(playerId, action);
    actions++;

    for (const mon of gameState.pokemon.values()) {
      for (const palier of Object.values(mon.statStages)) {
        paliersMax = Math.max(paliersMax, palier);
      }
    }

    const fin = resultat.events.find((e) => e.type === BattleEventType.BattleEnded);
    if (fin && fin.type === BattleEventType.BattleEnded) {
      vainqueur = fin.winnerId;
      break;
    }
  }

  let survivants1 = 0;
  let survivants2 = 0;
  for (const mon of state.pokemon.values()) {
    if (mon.currentHp <= 0) {
      continue;
    }
    if (mon.playerId === PlayerId.Player1) {
      survivants1++;
    } else {
      survivants2++;
    }
  }

  return {
    vainqueur,
    actions,
    statuQuo: actions >= MAX_ACTIONS,
    paliersMax,
    survivants1,
    survivants2,
  };
}

function mediane(valeurs: number[]): number {
  const tri = [...valeurs].sort((a, b) => a - b);
  return tri[Math.floor(tri.length / 2)] ?? 0;
}

const AFFRONTEMENTS: [string, AiProfile, string, AiProfile][] = [
  ["Facile", EASY_PROFILE, "Moyenne", MEDIUM_PROFILE],
  ["Facile", EASY_PROFILE, "Difficile", HARD_PROFILE],
  ["Moyenne", MEDIUM_PROFILE, "Difficile", HARD_PROFILE],
  ["Facile", EASY_PROFILE, "Facile", EASY_PROFILE],
  ["Moyenne", MEDIUM_PROFILE, "Moyenne", MEDIUM_PROFILE],
  ["Difficile", HARD_PROFILE, "Difficile", HARD_PROFILE],
];


function relever(memeEquipe: boolean, parties: number): void {
  console.log(`\n=== ÉQUIPES ${memeEquipe ? "IDENTIQUES (miroir)" : "ALÉATOIRES"} — ${parties} parties par affrontement ===`);
  for (const [nom1, profil1, nom2, profil2] of AFFRONTEMENTS) {
    let v1 = 0;
    let v2 = 0;
    let statuQuo = 0;
    const durees: number[] = [];
    const margesVainqueur: number[] = [];
    let balayages = 0;

    for (let i = 0; i < parties; i++) {
      const issue = jouerUnePartie(profil1, profil2, 1000 + i * 37, memeEquipe);
      durees.push(issue.actions);
      if (issue.statuQuo) {
        statuQuo++;
        continue;
      }
      if (issue.vainqueur === "player-1") {
        v1++;
        margesVainqueur.push(issue.survivants1);
        if (issue.survivants2 === 0 && issue.survivants1 === 6) balayages++;
      } else if (issue.vainqueur === "player-2") {
        v2++;
        margesVainqueur.push(issue.survivants2);
        if (issue.survivants1 === 0 && issue.survivants2 === 6) balayages++;
      }
    }

    const decides = v1 + v2;
    const marge =
      margesVainqueur.length > 0
        ? (margesVainqueur.reduce((a, b) => a + b, 0) / margesVainqueur.length).toFixed(1)
        : "-";
    console.log(
      `${nom1.padEnd(9)} vs ${nom2.padEnd(9)} | victoires ${String(v1).padStart(3)}-${String(v2).padStart(3)}` +
        ` | survivants du gagnant ${marge}/6` +
        ` | 6-0 : ${String(balayages).padStart(3)}/${String(decides).padStart(3)}` +
        ` | jamais finies ${String(statuQuo).padStart(3)}/${parties}` +
        ` | médiane ${String(mediane(durees)).padStart(4)} actions`,
    );
  }
}

const parties = Number(process.argv[2] ?? "40");
if (!Number.isInteger(parties) || parties < 1) {
  console.error("Usage : pnpm ai:bench [nombre de parties par affrontement]");
  process.exit(1);
}
relever(false, parties);
relever(true, parties);
