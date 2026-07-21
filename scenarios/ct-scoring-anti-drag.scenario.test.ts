import {
  BattleEventType,
  createPrng,
  HARD_PROFILE,
  type MoveDefinition,
  PlacementMode,
  PlacementPhase,
  type PlacementTeam,
  PlayerController,
  PlayerId,
  pickScoredAction,
} from "@pokemon-tactic/core";
import { buildTestEngineFromPlacements } from "@pokemon-tactic/core/testing";
import { loadData, pocArena } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";

const MEASURE_SEEDS = [1, 7, 13, 42, 99, 123, 777, 2024];

describe("scenario — CT-aware scorer stays anti-drag (plan 165)", () => {
  it.each(
    MEASURE_SEEDS,
  )("6v6 Charge Time battle with the scorer on both sides ends well under the drag ceiling (seed %i)", (seed) => {
    /*
        Given une arène POC et deux équipes complètes 6v6, placées automatiquement
        And le moteur en mode Charge Time (seul système de tours du moteur)
        And le scorer IA (profil Hard, greedy déterministe) qui joue LES DEUX camps
        When on déroule le combat action par action jusqu'à une issue
        Then le combat se termine sur un vainqueur
        And le nombre total d'actions reste bien en dessous du plafond anti-drag
             (le bug historique du fix CT naïf, plan 068, produisait >5000 actions ;
              un combat sain se règle en ~80-300 actions — mesuré 83..303 sur ces 8
              seeds. Le plafond est fixé à 1000 : ~3× la marge au-dessus du pire cas
              sain observé (donc pas de flakiness), et 5× SOUS le drag connu (>5000),
              donc n'importe quelle rechute vers le débit-sans-KO serait attrapée)
      */
    const data = loadData();
    const moveRegistry = new Map<string, MoveDefinition>();
    for (const move of data.moves) {
      moveRegistry.set(move.id, move);
    }

    const teams: PlacementTeam[] = [
      {
        playerId: PlayerId.Player1,
        availablePokemonIds: [
          "p1-venusaur",
          "p1-blastoise",
          "p1-raichu",
          "p1-machamp",
          "p1-alakazam",
          "p1-snorlax",
        ],
        controller: PlayerController.Ai,
      },
      {
        playerId: PlayerId.Player2,
        availablePokemonIds: [
          "p2-charizard",
          "p2-gyarados",
          "p2-dragonite",
          "p2-vaporeon",
          "p2-flareon",
          "p2-jolteon",
        ],
        controller: PlayerController.Ai,
      },
    ];

    const map = pocArena;
    const format = map.formats[0];
    if (!format) {
      throw new Error("No format defined");
    }
    const gridCenter = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
    const phase = new PlacementPhase(map, teams, format, PlacementMode.Random, seed);
    const placements = phase.autoPlaceAll(gridCenter);

    const { engine, state } = buildTestEngineFromPlacements(placements, teams);

    const player1Random = createPrng(seed);
    const player2Random = createPrng(seed + 1);

    const DRAG_CEILING = 1000;
    let totalActions = 0;
    let winner: string | null = null;

    while (totalActions < DRAG_CEILING) {
      const activePokemonId = state.activePokemonId;
      if (!activePokemonId) {
        break;
      }
      const activePokemon = state.pokemon.get(activePokemonId);
      if (!activePokemon) {
        break;
      }
      const playerId = activePokemon.playerId;
      const legalActions = engine.getLegalActions(playerId);
      if (legalActions.length === 0) {
        break;
      }

      const random = playerId === PlayerId.Player1 ? player1Random : player2Random;
      const action = pickScoredAction(
        legalActions,
        state,
        moveRegistry,
        engine,
        HARD_PROFILE,
        random,
      );

      const result = engine.submitAction(playerId, action);
      totalActions++;

      const battleEnded = result.events.find((e) => e.type === BattleEventType.BattleEnded);
      if (battleEnded && battleEnded.type === BattleEventType.BattleEnded) {
        winner = battleEnded.winnerId;
        break;
      }
    }

    expect(winner).not.toBeNull();
    expect(totalActions).toBeGreaterThan(0);
    expect(totalActions).toBeLessThan(DRAG_CEILING);
  }, 30_000);
});
