#!/usr/bin/env tsx
import {
  type Action,
  ActionKind,
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
  profileOne: AiProfile | typeof MAX_POWER,
  profileTwo: AiProfile | typeof MAX_POWER,
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
    const profile = isSideOne ? profileOne : profileTwo;
    const action =
      profile === MAX_POWER
        ? pickMaxPowerAction(legalActions, moveRegistry, gameState, activeId)
        : pickScoredAction(
            legalActions,
            gameState,
            moveRegistry,
            engine,
            profile,
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

/**
 * 🔴 L'ÉTALON, et il vaut mieux que « une IA qui joue au hasard ».
 *
 * Mesure du plan 214 : **toute** heuristique cohérente écrase le hasard pur 60-0, parce que le hasard
 * perd son tour à taper dans le vide. Même une IA réglée à 95 % de coups sous-optimaux dans un top 12
 * le battait encore 59-1. Ce baseline ne mesurait donc RIEN.
 *
 * Celui-ci est **cohérent mais borné** — il frappe toujours le plus fort qu'il peut, sans jamais lire
 * l'efficacité de type, sans se repositionner, sans rien d'autre. C'est le patron
 * `MaxBasePowerPlayer` de `poke-env`, la bibliothèque de référence des IA Pokemon, où la hiérarchie
 * admise est Hasard < MaxPuissance < Heuristique simple < entraîné.
 *
 * Et c'est bien plus proche de « un enfant » que du hasard : un enfant voit le plateau, comprend
 * « tape le plus fort », mais ne calcule ni les types ni le placement.
 */
const MAX_POWER = "max-power" as const;

function pickMaxPowerAction(
  legalActions: Action[],
  moveRegistry: Map<string, MoveDefinition>,
  state: BattleState,
  selfId: string,
): Action {
  const first = legalActions[0];
  if (first === undefined) {
    throw new Error("Aucune action légale");
  }

  /*
   * 🔴 Il VISE un ennemi. Deuxième correction de cet étalon, et la plus décisive.
   *
   * La version précédente prenait la capacité la plus puissante sans regarder QUI elle touchait : elle
   * tirait donc dans le vide ou sur ses propres alliés. C'est sous le niveau d'un enfant, qui vise au
   * moins l'adversaire — et ça faussait toute la mesure, notre IA la plus dégradée le battant encore
   * 58-2.
   *
   * Ce qu'il ne fait toujours pas, et c'est voulu : lire l'efficacité de type, choisir entre plusieurs
   * ennemis, évaluer le terrain, se protéger. Il frappe le plus fort sur quelqu'un d'en face.
   */
  const self = state.pokemon.get(selfId);
  const enemyAt = (position: { x: number; y: number }): boolean =>
    [...state.pokemon.values()].some(
      (mon) =>
        mon.currentHp > 0 &&
        mon.playerId !== self?.playerId &&
        mon.position.x === position.x &&
        mon.position.y === position.y,
    );

  let best: Action | undefined;
  let bestPower = 0;
  for (const action of legalActions) {
    if (action.kind !== ActionKind.UseMove) {
      continue;
    }
    if (!enemyAt(action.targetPosition)) {
      continue;
    }
    const power = moveRegistry.get(action.moveId)?.power ?? 0;
    if (power > bestPower) {
      bestPower = power;
      best = action;
    }
  }
  if (best !== undefined) {
    return best;
  }

  /*
   * 🔴 Rien à portée : il AVANCE vers l'ennemi le plus proche, il ne se contente pas de bouger.
   *
   * C'est la correction qui rend cet étalon crédible. La première version prenait la première action
   * de déplacement venue — et se sabordait donc sur le placement, qui fait la moitié d'un jeu
   * tactique. Résultat : même un Facile massacré le battait 56-0, ce qui ne mesurait plus rien.
   *
   * Le patron d'origine (`MaxBasePowerPlayer`, poke-env) vient de Showdown, où il n'y a AUCUN
   * placement — il n'avait donc pas ce problème. Un enfant, lui, sait avancer vers l'adversaire même
   * s'il ne calcule ni les types ni le terrain.
   */
  const moves = legalActions.filter((action) => action.kind === ActionKind.Move);
  if (moves.length === 0) {
    return first;
  }
  const enemies = [...state.pokemon.values()].filter(
    (mon) => mon.currentHp > 0 && mon.playerId !== state.pokemon.get(selfId)?.playerId,
  );
  if (enemies.length === 0) {
    return moves[0] ?? first;
  }
  const distanceToNearestEnemy = (position: { x: number; y: number }): number =>
    Math.min(
      ...enemies.map(
        (enemy) =>
          Math.abs(enemy.position.x - position.x) + Math.abs(enemy.position.y - position.y),
      ),
    );

  let closest = moves[0] as Extract<Action, { kind: typeof ActionKind.Move }>;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const action of moves) {
    if (action.kind !== ActionKind.Move) {
      continue;
    }
    const destination = action.path.at(-1);
    if (destination === undefined) {
      continue;
    }
    const distance = distanceToNearestEnemy(destination);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = action;
    }
  }
  return closest;
}

const MATCHUPS: [string, AiProfile | typeof MAX_POWER, string, AiProfile | typeof MAX_POWER][] = [
  ["MaxPuiss", MAX_POWER, "Facile", EASY_PROFILE],
  ["MaxPuiss", MAX_POWER, "Moyenne", MEDIUM_PROFILE],
  ["MaxPuiss", MAX_POWER, "Difficile", HARD_PROFILE],
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
