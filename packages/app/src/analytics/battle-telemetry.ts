/**
 * Collecteur de télémétrie de partie (plan 196, étape 4).
 *
 * Observe le flux d'événements du moteur et en tire le payload de `battle_ended`. Le calcul vit
 * ICI et pas dans `packages/core` : le core ne connaît pas la télémétrie, et n'a pas à l'apprendre.
 *
 * Ne suit que les camps dont on a la composition — les équipes `human-built`. Sans leur
 * composition, le détail des attaques ne se rattache à rien (§ `battle_ended` du plan).
 */

import { type BattleEvent, BattleEventType } from "@pokemon-tactic/core";
import { type BattleEndedPayload, KnockOutCause, type TelemetryMemberOutcome } from "./telemetry";

/** `p1-pikachu` ou `p1-m0-pikachu` → `pikachu`. Même règle que le chrome et le placement. */
function speciesOf(pokemonId: string): string {
  return pokemonId.replace(/^p\d+-(?:m\d+-)?/, "");
}

/** `p1-pikachu` → camp 0. Le préfixe est 1-indexé, les camps de la télémétrie 0-indexés. */
function sideOf(pokemonId: string): number | null {
  const prefix = /^p(\d+)-/.exec(pokemonId);
  if (!prefix?.[1]) {
    return null;
  }
  return Number(prefix[1]) - 1;
}

/** `player-2` → camp 1. */
function sideOfPlayer(playerId: string): number | null {
  const match = /^player-(\d+)$/.exec(playerId);
  if (!match?.[1]) {
    return null;
  }
  return Number(match[1]) - 1;
}

interface KnockOutRecord {
  turn: number;
  cause: KnockOutCause;
}

export interface BattleTelemetryCollector {
  observe(event: BattleEvent): void;
  /**
   * Construit le payload final. Rend `null` si le combat ne s'est pas terminé — une partie quittée
   * en cours n'émet **pas** `battle_ended`, et c'est cette absence qui donne le taux d'abandon.
   */
  buildEndedPayload(): BattleEndedPayload | null;
}

export function createBattleTelemetryCollector(input: {
  battleId: string;
  /** Camps dont la composition a été envoyée à `battle_started`. */
  trackedSides: ReadonlySet<number>;
  startedAt: number;
  now: () => number;
}): BattleTelemetryCollector {
  const moveCounts = new Map<string, Map<string, number>>();
  const knockOuts = new Map<string, KnockOutRecord>();
  /** Dernière cause de dégâts subie, qui qualifie le K.O. qui suit. */
  const pendingCause = new Map<string, KnockOutCause>();
  let turns = 0;
  let ended = false;
  let winnerSide: number | null = null;
  let draw = false;

  function isTracked(pokemonId: string): boolean {
    const side = sideOf(pokemonId);
    return side !== null && input.trackedSides.has(side);
  }

  function recordKnockOut(pokemonId: string, cause: KnockOutCause): void {
    if (!isTracked(pokemonId) || knockOuts.has(pokemonId)) {
      return;
    }
    knockOuts.set(pokemonId, { turn: turns, cause });
  }

  return {
    observe(event: BattleEvent): void {
      switch (event.type) {
        case BattleEventType.TurnStarted:
          turns += 1;
          break;

        case BattleEventType.MoveStarted: {
          // `moveId` et non `resolvedMoveId` : on mesure l'attaque que le joueur a choisie, pas
          // celle en quoi elle s'est morphée (Vibra Soin, Pouvoir Antique).
          if (!isTracked(event.attackerId)) {
            break;
          }
          const perMove = moveCounts.get(event.attackerId) ?? new Map<string, number>();
          perMove.set(event.moveId, (perMove.get(event.moveId) ?? 0) + 1);
          moveCounts.set(event.attackerId, perMove);
          break;
        }

        case BattleEventType.FallDamageDealt:
          pendingCause.set(event.pokemonId, KnockOutCause.Fall);
          break;

        case BattleEventType.TerrainDamageDealt:
          pendingCause.set(event.pokemonId, KnockOutCause.LethalTerrain);
          break;

        case BattleEventType.DamageDealt:
          pendingCause.set(event.targetId, KnockOutCause.Damage);
          break;

        // Mort immédiate par terrain létal (lave, eau profonde) : pas de `PokemonKo` derrière.
        case BattleEventType.LethalTerrainKo:
          recordKnockOut(event.pokemonId, KnockOutCause.LethalTerrain);
          break;

        case BattleEventType.PokemonKo:
          recordKnockOut(
            event.pokemonId,
            pendingCause.get(event.pokemonId) ?? KnockOutCause.Damage,
          );
          break;

        // Éliminé sans K.O. préalable = sorti de l'arène (« Le Mur », projection hors grille).
        case BattleEventType.PokemonEliminated:
          recordKnockOut(event.pokemonId, KnockOutCause.RingOut);
          break;

        case BattleEventType.BattleEnded:
          ended = true;
          draw = event.winnerId === null;
          winnerSide = event.winnerId === null ? null : sideOfPlayer(event.winnerId);
          break;

        default:
          break;
      }
    },

    buildEndedPayload(): BattleEndedPayload | null {
      if (!ended) {
        return null;
      }
      const trackedIds = new Set([...moveCounts.keys(), ...knockOuts.keys()]);
      const outcomes: TelemetryMemberOutcome[] = [...trackedIds].map((pokemonId) => {
        const knockOut = knockOuts.get(pokemonId);
        return {
          species: speciesOf(pokemonId),
          moves: Object.fromEntries(moveCounts.get(pokemonId) ?? []),
          knockedOutTurn: knockOut?.turn ?? null,
          knockedOutCause: knockOut?.cause ?? null,
        };
      });

      return {
        battleId: input.battleId,
        winnerSide,
        draw,
        durationMs: input.now() - input.startedAt,
        turns,
        outcomes,
      };
    },
  };
}
