/**
 * Collecteur de télémétrie de partie (plan 196, étape 4).
 *
 * Observe le flux d'événements du moteur et en tire le payload de `battle_ended`. Le calcul vit
 * ICI et pas dans `packages/core` : le core ne connaît pas la télémétrie, et n'a pas à l'apprendre.
 *
 * Suit **tous les camps tenus par un humain**, chacun étiqueté de sa provenance (plan 212, Lot E).
 * Ne suivre que les équipes bâties à la main affamait la mesure : 6 camps sur 44 en production, donc
 * une attaque lancée et une cause de K.O. en quatorze jours. Le drapeau porté par chaque issue est ce
 * qui permet au rapport de garder le **goût** (bâties à la main seules) séparé de la **force**
 * (toutes), sans jamais les additionner.
 */

import { type BattleEvent, BattleEventType } from "@pokemon-tactic/core";
import {
  type AbandonSource,
  type BattleAbandonedPayload,
  type BattleEndedPayload,
  BattleEndReason,
  KnockOutCause,
  type TeamSource,
  type TelemetryMemberOutcome,
} from "./telemetry";

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
   * Ce que l'écran de combat seul peut fournir, une fois le combat MONTÉ (plans 212, Lots E et F).
   *
   * 🔴 Porté par le collecteur et non par des variables de module, parce que le collecteur a
   * exactement la bonne durée de vie : il naît avec la partie et meurt avec elle. Trois variables
   * de module à côté laissaient le lecteur de PV de la partie PRÉCÉDENTE en place entre l'ouverture
   * d'une partie et son montage — un abandon tombé dans cette fenêtre rapportait les PV d'un autre
   * combat. Relevé en revue de code (2026-09-16).
   *
   * - `pokemonIds` sème le roster : sans lui, seuls les Pokemon qui agissent ou tombent existent,
   *   et la survie ne compte que les morts. Les camps non suivis sont ignorés comme partout.
   * - `localSide` dit de quel côté se tient celui qui partira. `null` en hot-seat.
   * - `readHealthRatios` est une FONCTION : l'abandon arrive à un moment qu'on ne choisit pas, et
   *   un instantané pris au montage ne dirait rien de l'état au départ.
   */
  attachRuntime(input: {
    pokemonIds: Iterable<string>;
    localSide: number | null;
    readHealthRatios: () => Record<string, number>;
  }): void;
  /**
   * Construit le payload final. Rend `null` si le combat ne s'est pas terminé — une partie quittée
   * en cours n'émet **pas** `battle_ended`, et c'est cette absence qui donne le taux d'abandon.
   */
  buildEndedPayload(): BattleEndedPayload | null;
  /**
   * Construit le payload d'un départ en cours de partie (plan 212, Lot F). Rend `null` si la partie
   * s'est **terminée** — c'est alors `battle_ended` qui parle, et les deux ne coexistent jamais.
   *
   * Le miroir de `buildEndedPayload` : celui-ci exige que la partie soit finie, celui-là exige
   * qu'elle ne le soit pas.
   */
  buildAbandonedPayload(from: AbandonSource): BattleAbandonedPayload | null;
}

export function createBattleTelemetryCollector(input: {
  battleId: string;
  /** Camps tenus par un humain, et la provenance de l'équipe de chacun. */
  trackedSources: ReadonlyMap<number, TeamSource>;
  startedAt: number;
  now: () => number;
}): BattleTelemetryCollector {
  const moveCounts = new Map<string, Map<string, number>>();
  const knockOuts = new Map<string, KnockOutRecord>();
  /**
   * Les Pokemon suivis, connus dès la pose (plan 212, Lot E).
   *
   * 🔴 Sans ce semis, `outcomes` ne contenait que les Pokemon ayant **agi ou chuté** — il se
   * construisait de `moveCounts` ∪ `knockOuts`. Un Pokemon posé, jamais activé et jamais touché
   * était donc **absent**, pas compté comme survivant : la statistique de survie ne comptait que
   * ceux qui étaient morts, ce qui la vidait de son sens. Trouvé par `game-designer` à la revue.
   */
  const roster = new Set<string>();
  /** Ce que l'écran de combat confie au montage — voir `attachRuntime`. */
  let localSide: number | null = null;
  let readHealthRatios: (() => Record<string, number>) | null = null;
  /** Dernière cause de dégâts subie, qui qualifie le K.O. qui suit. */
  const pendingCause = new Map<string, KnockOutCause>();
  let turns = 0;
  let ended = false;
  let winnerSide: number | null = null;
  let draw = false;
  let endReason: BattleEndReason = BattleEndReason.Combat;
  /** Camps qui ont quitté la partie : leurs K.O. sont des abandons, pas des dégâts (plan 201). */
  const forfeitedSides = new Set<number>();

  function isTracked(pokemonId: string): boolean {
    const side = sideOf(pokemonId);
    return side !== null && input.trackedSources.has(side);
  }

  function recordKnockOut(pokemonId: string, cause: KnockOutCause): void {
    if (!isTracked(pokemonId) || knockOuts.has(pokemonId)) {
      return;
    }
    // Le camp a quitté la partie : ses Pokemon ne sont pas tombés sous les coups, et les compter
    // ainsi fausserait la lecture de l'équilibrage.
    const side = sideOf(pokemonId);
    const effective = side !== null && forfeitedSides.has(side) ? KnockOutCause.Forfeit : cause;
    knockOuts.set(pokemonId, { turn: turns, cause: effective });
  }

  return {
    attachRuntime(input): void {
      for (const pokemonId of input.pokemonIds) {
        if (isTracked(pokemonId)) {
          roster.add(pokemonId);
        }
      }
      localSide = input.localSide;
      readHealthRatios = input.readHealthRatios;
    },

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

        case BattleEventType.PlayerForfeited: {
          endReason = BattleEndReason.Forfeit;
          const side = sideOfPlayer(event.playerId);
          if (side !== null) {
            forfeitedSides.add(side);
          }
          break;
        }

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
      const trackedIds = new Set([...roster, ...moveCounts.keys(), ...knockOuts.keys()]);
      const outcomes: TelemetryMemberOutcome[] = [...trackedIds].flatMap((pokemonId) => {
        const side = sideOf(pokemonId);
        if (side === null) {
          return [];
        }
        const source = input.trackedSources.get(side);
        // Injoignable — `isTracked` a déjà filtré sur cette même carte — mais une issue sans
        // provenance entrerait dans le rapport sans cohorte, donc sans bloc où la lire.
        if (source === undefined) {
          return [];
        }
        const knockOut = knockOuts.get(pokemonId);
        return [
          {
            species: speciesOf(pokemonId),
            source,
            side,
            moves: Object.fromEntries(moveCounts.get(pokemonId) ?? []),
            knockedOutTurn: knockOut?.turn ?? null,
            knockedOutCause: knockOut?.cause ?? null,
          },
        ];
      });

      return {
        battleId: input.battleId,
        winnerSide,
        draw,
        endReason,
        durationMs: input.now() - input.startedAt,
        turns,
        outcomes,
      };
    },

    buildAbandonedPayload(from): BattleAbandonedPayload | null {
      if (ended) {
        return null;
      }
      return {
        battleId: input.battleId,
        turns,
        durationMs: input.now() - input.startedAt,
        from,
        side: localSide,
        // Un abandon avant le montage part avec un relevé VIDE plutôt que pas du tout : mieux vaut
        // un champ manquant qu'une mesure perdue.
        healthRatios: readHealthRatios?.() ?? {},
      };
    },
  };
}
