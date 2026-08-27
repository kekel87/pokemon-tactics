import type {
  AuraKind,
  BattleEvent,
  Direction,
  EntryHazardKind,
  FieldGlobalKind,
  FieldTerrain,
} from "@pokemon-tactic/core";
import {
  AbilityChangeReason,
  BattleEventType,
  HitAndRunRetreatFallbackReason,
  MoveFailedReason,
  ProtectionReason,
  StatusImmuneReason,
  StatusType,
  SubstituteFailedReason,
  TerrainType,
  TypeChangeReason,
  Weather,
} from "@pokemon-tactic/core";
import { getTypeName } from "@pokemon-tactic/data";
import type { I18nContext } from "@pokemon-tactic/render-ports";
import {
  BATTLE_LOG_COLOR_ABILITY,
  BATTLE_LOG_COLOR_BATTLE_ENDED,
  BATTLE_LOG_COLOR_CRITICAL,
  BATTLE_LOG_COLOR_DAMAGE,
  BATTLE_LOG_COLOR_DEFENSE,
  BATTLE_LOG_COLOR_EFFECTIVENESS,
  BATTLE_LOG_COLOR_HEAL,
  BATTLE_LOG_COLOR_ITEM,
  BATTLE_LOG_COLOR_ITEM_CONSUMED,
  BATTLE_LOG_COLOR_KNOCKBACK,
  BATTLE_LOG_COLOR_KO,
  BATTLE_LOG_COLOR_MISS,
  BATTLE_LOG_COLOR_MOVE,
  BATTLE_LOG_COLOR_MULTI_HIT,
  BATTLE_LOG_COLOR_RECHARGE,
  BATTLE_LOG_COLOR_STAT_DOWN,
  BATTLE_LOG_COLOR_STAT_UP,
  BATTLE_LOG_COLOR_STATUS,
  BATTLE_LOG_COLOR_TURN,
} from "./constants.js";

function fieldTerrainLabel(kind: FieldTerrain, translate: Translate): string {
  return translate(`battleLog.fieldTerrain.${kind}`);
}

function fieldGlobalLabel(kind: FieldGlobalKind, translate: Translate): string {
  return translate(`battleLog.fieldGlobal.${kind}`);
}

function directionLabel(direction: Direction, translate: Translate): string {
  return translate(`battleLog.direction.${direction}`);
}

function entryHazardLabel(kind: EntryHazardKind, translate: Translate): string {
  return translate(`battleLog.entryHazard.${kind}`);
}

function auraKindLabel(kind: AuraKind, translate: Translate): string {
  return translate(`battleLog.aura.${kind}`);
}

/** UI language — seul `getTypeName` (paquet `data`) la consomme encore. */
type Language = "en" | "fr";

/**
 * Localisateur injecté par l'hôte — même forme que `I18nContext.translate` (`render-ports`).
 *
 * Depuis le plan 190, ce formateur ne connaît plus AUCUNE chaîne de langue naturelle : il émet des
 * clés `battleLog.*`, dont les valeurs FR/EN vivent avec les autres dans `packages/app/src/i18n/`.
 * `packages/ui-dom` est un paquet réutilisable et ne peut pas importer l'i18n de l'app (`app`
 * dépend de `ui-dom`, l'inverse serait circulaire) — d'où l'injection.
 */
type Translate = I18nContext["translate"];

export interface BattleLogEntry {
  readonly message: string;
  readonly color: string;
  readonly pokemonIds: readonly string[];
}

export interface BattleLogContext {
  readonly getPokemonName: (id: string) => string;
  readonly getMoveName: (moveId: string) => string;
  readonly getAbilityName: (abilityId: string) => string | null;
  readonly getItemName: (itemId: string) => string | null;
  readonly language: Language;
  /** Localisateur de l'hôte pour les clés `battleLog.*` (plan 190). */
  readonly translate: Translate;
}

export const BattleLogColors = {
  turn: BATTLE_LOG_COLOR_TURN,
  move: BATTLE_LOG_COLOR_MOVE,
  damage: BATTLE_LOG_COLOR_DAMAGE,
  effectiveness: BATTLE_LOG_COLOR_EFFECTIVENESS,
  miss: BATTLE_LOG_COLOR_MISS,
  status: BATTLE_LOG_COLOR_STATUS,
  statUp: BATTLE_LOG_COLOR_STAT_UP,
  statDown: BATTLE_LOG_COLOR_STAT_DOWN,
  ko: BATTLE_LOG_COLOR_KO,
  defense: BATTLE_LOG_COLOR_DEFENSE,
  knockback: BATTLE_LOG_COLOR_KNOCKBACK,
  multiHit: BATTLE_LOG_COLOR_MULTI_HIT,
  recharge: BATTLE_LOG_COLOR_RECHARGE,
  ability: BATTLE_LOG_COLOR_ABILITY,
  item: BATTLE_LOG_COLOR_ITEM,
  itemConsumed: BATTLE_LOG_COLOR_ITEM_CONSUMED,
  critical: BATTLE_LOG_COLOR_CRITICAL,
  heal: BATTLE_LOG_COLOR_HEAL,
  battleEnded: BATTLE_LOG_COLOR_BATTLE_ENDED,
} as const;

/**
 * Statuts et terrains que le journal commente — clés `battleLog.status.<valeur>.{applied,removed}`
 * et `battleLog.terrainStatus.<valeur>`.
 *
 * Ce n'est PAS de la langue, c'est un périmètre : tout `StatusType` n'a pas de ligne de journal, et
 * seuls deux terrains infligent un statut nommé. Avant la migration i18n (plan 190) ce filtre était
 * porté par l'absence de la clé dans les tables `STATUS_LOG_KEY` / `TERRAIN_STATUS_LOG_KEY`
 * (`if (!statusEntry) return null`). Il doit survivre explicitement : `translate` retombe sur la
 * clé brute quand elle est inconnue, donc sans ce garde-fou le journal afficherait
 * « battleLog.status.roosted.applied » au lieu de ne rien écrire.
 */
const LOGGED_STATUSES: ReadonlySet<StatusType> = new Set([
  StatusType.AquaRing,
  StatusType.Asleep,
  StatusType.BadlyPoisoned,
  StatusType.Burned,
  StatusType.Charged,
  StatusType.Confused,
  StatusType.DestinyBond,
  StatusType.Disabled,
  StatusType.Encored,
  StatusType.Flinch,
  StatusType.Frozen,
  StatusType.Grudge,
  StatusType.HealBlocked,
  StatusType.Infatuated,
  StatusType.Ingrain,
  StatusType.Paralyzed,
  StatusType.Poisoned,
  StatusType.Seeded,
  StatusType.Taunted,
  StatusType.Trapped,
]);

const LOGGED_TERRAIN_STATUSES: ReadonlySet<TerrainType> = new Set([
  TerrainType.Magma,
  TerrainType.Swamp,
]);

export function formatBattleEvent(
  event: BattleEvent,
  context: BattleLogContext,
): BattleLogEntry | BattleLogEntry[] | null {
  const lang = context.language;
  const translate = context.translate;

  switch (event.type) {
    case BattleEventType.TurnStarted: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.turnStarted", { name });
      return { message, color: BattleLogColors.turn, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.MoveStarted: {
      const name = context.getPokemonName(event.attackerId);
      const moveName = context.getMoveName(event.moveId);
      const message = translate("battleLog.moveStarted.used", { moveName, name });
      const usedEntry: BattleLogEntry = {
        message,
        color: BattleLogColors.move,
        pokemonIds: [event.attackerId],
      };
      // B4 morph: Nature Power transforms into another move; Terrain Pulse changes type.
      const morphEntries: BattleLogEntry[] = [];
      if (event.resolvedMoveId !== undefined) {
        const resolvedName = context.getMoveName(event.resolvedMoveId);
        morphEntries.push({
          message: `${moveName} → ${resolvedName}`,
          color: BattleLogColors.move,
          pokemonIds: [event.attackerId],
        });
      }
      if (event.resolvedType !== undefined) {
        const typeName = getTypeName(event.resolvedType, lang);
        morphEntries.push({
          message: translate("battleLog.moveStarted.morphType", {
            moveName,
            typeName,
          }),
          color: BattleLogColors.move,
          pokemonIds: [event.attackerId],
        });
      }
      return morphEntries.length === 0 ? usedEntry : [usedEntry, ...morphEntries];
    }

    case BattleEventType.DamageDealt: {
      if (event.effectiveness === 0) {
        return null;
      }
      const name = context.getPokemonName(event.targetId);
      const damageMessage = translate("battleLog.damageDealt", { amount: event.amount, name });
      const entries: BattleLogEntry[] = [
        { message: damageMessage, color: BattleLogColors.damage, pokemonIds: [event.targetId] },
      ];

      const effectivenessText = getEffectivenessText(event.effectiveness, translate);
      if (effectivenessText) {
        entries.push({
          message: effectivenessText,
          color: BattleLogColors.effectiveness,
          pokemonIds: [],
        });
      }
      return entries;
    }

    case BattleEventType.MoveMissed: {
      const name = context.getPokemonName(event.attackerId);
      const message = translate("battleLog.moveMissed", { name });
      return { message, color: BattleLogColors.miss, pokemonIds: [event.attackerId] };
    }

    case BattleEventType.StatusApplied: {
      if (!LOGGED_STATUSES.has(event.status)) {
        return null;
      }
      const name = context.getPokemonName(event.targetId);
      const message = translate(`battleLog.status.${event.status}.applied`, { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.targetId] };
    }

    case BattleEventType.StatusImmune: {
      const name = context.getPokemonName(event.targetId);
      if (event.reason === StatusImmuneReason.Weather && event.status === StatusType.Frozen) {
        const message = translate("battleLog.statusImmune.sunPreventsFreeze", { name });
        return { message, color: BattleLogColors.status, pokemonIds: [event.targetId] };
      }
      const message = translate("battleLog.statusImmune.noEffect", { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.targetId] };
    }

    case BattleEventType.TerrainStatusApplied: {
      const hasTerrainLine = LOGGED_TERRAIN_STATUSES.has(event.terrain);
      if (!hasTerrainLine && !LOGGED_STATUSES.has(event.status)) {
        return null;
      }
      const name = context.getPokemonName(event.pokemonId);
      const message = hasTerrainLine
        ? translate(`battleLog.terrainStatus.${event.terrain}`, { name })
        : translate(`battleLog.status.${event.status}.applied`, { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.StatusRemoved: {
      if (!LOGGED_STATUSES.has(event.status)) {
        return null;
      }
      const name = context.getPokemonName(event.targetId);
      const message = translate(`battleLog.status.${event.status}.removed`, { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.targetId] };
    }

    case BattleEventType.StatChanged: {
      const name = context.getPokemonName(event.targetId);
      const statName = translate(`battleLog.stat.${event.stat}`);
      const isUp = event.stages > 0;
      const message = isUp
        ? translate("battleLog.statChanged.raised", { name, statName })
        : translate("battleLog.statChanged.lowered", { name, statName });
      return {
        message,
        color: isUp ? BattleLogColors.statUp : BattleLogColors.statDown,
        pokemonIds: [event.targetId],
      };
    }

    case BattleEventType.PokemonKo: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.pokemonKo", { name });
      return { message, color: BattleLogColors.ko, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.DefenseActivated: {
      const name = context.getPokemonName(event.pokemonId);
      const defenseName = translate(`battleLog.defense.${event.defenseKind}`);
      const message = translate("battleLog.defenseActivated", {
        defenseName,
        name,
      });
      return { message, color: BattleLogColors.defense, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.DefenseTriggered: {
      const name = context.getPokemonName(event.defenderId);
      const defenseName = translate(`battleLog.defense.${event.defenseKind}`);
      const message = event.blocked
        ? translate("battleLog.defenseTriggered.protected", {
            defenseName,
            name,
          })
        : translate("battleLog.defenseTriggered.reflected", { defenseName });
      return { message, color: BattleLogColors.defense, pokemonIds: [event.defenderId] };
    }

    case BattleEventType.ConfusionTriggered: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.confusionTriggered", { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.Flinched: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.flinched", { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.KnockbackApplied: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.knockbackApplied", { name });
      return { message, color: BattleLogColors.knockback, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.MultiHitComplete: {
      const message = translate("battleLog.multiHitComplete", { totalHits: event.totalHits });
      return { message, color: BattleLogColors.multiHit, pokemonIds: [] };
    }

    case BattleEventType.RechargeStarted: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.rechargeStarted", { name });
      return { message, color: BattleLogColors.recharge, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.BattleEnded: {
      const message =
        event.winnerId === null
          ? translate("battleLog.battleEnded.draw")
          : translate("battleLog.battleEnded.winner", { winnerId: event.winnerId });
      return { message, color: BattleLogColors.battleEnded, pokemonIds: [] };
    }

    case BattleEventType.AbilityActivated: {
      const abilityName = context.getAbilityName(event.abilityId);
      if (!abilityName) {
        return null;
      }
      const pokemonName = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.abilityActivated", {
        abilityName,
        pokemonName,
      });
      return { message, color: BattleLogColors.ability, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.HeldItemActivated: {
      const itemName = context.getItemName(event.itemId);
      if (!itemName) {
        return null;
      }
      const pokemonName = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.heldItemActivated", {
        itemName,
        pokemonName,
      });
      return { message, color: BattleLogColors.item, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.HeldItemConsumed: {
      const itemName = context.getItemName(event.itemId);
      if (!itemName) {
        return null;
      }
      const pokemonName = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.heldItemConsumed", {
        itemName,
        pokemonName,
      });
      return { message, color: BattleLogColors.itemConsumed, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.ItemKnockedOff: {
      const itemName = context.getItemName(event.itemId) ?? event.itemId;
      const pokemonName = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.itemKnockedOff", {
        itemName,
        pokemonName,
      });
      return { message, color: BattleLogColors.itemConsumed, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.ItemStolen: {
      const itemName = context.getItemName(event.itemId) ?? event.itemId;
      const thiefName = context.getPokemonName(event.thiefId);
      const victimName = context.getPokemonName(event.victimId);
      const message = translate("battleLog.itemStolen", {
        itemName,
        thiefName,
        victimName,
      });
      return {
        message,
        color: BattleLogColors.item,
        pokemonIds: [event.thiefId, event.victimId],
      };
    }

    case BattleEventType.ItemsSwapped: {
      const pokemonName = context.getPokemonName(event.pokemonId);
      const otherName = context.getPokemonName(event.otherId);
      const message = translate("battleLog.itemsSwapped", {
        otherName,
        pokemonName,
      });
      return {
        message,
        color: BattleLogColors.item,
        pokemonIds: [event.pokemonId, event.otherId],
      };
    }

    case BattleEventType.ItemBurned: {
      const itemName = context.getItemName(event.itemId) ?? event.itemId;
      const pokemonName = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.itemBurned", {
        itemName,
        pokemonName,
      });
      return { message, color: BattleLogColors.itemConsumed, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.BerryEaten: {
      const itemName = context.getItemName(event.itemId) ?? event.itemId;
      const eaterName = context.getPokemonName(event.eaterId);
      const message = translate("battleLog.berryEaten", {
        eaterName,
        itemName,
      });
      return { message, color: BattleLogColors.item, pokemonIds: [event.eaterId] };
    }

    case BattleEventType.ItemRecycled: {
      const itemName = context.getItemName(event.itemId) ?? event.itemId;
      const pokemonName = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.itemRecycled", {
        itemName,
        pokemonName,
      });
      return { message, color: BattleLogColors.item, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.ItemFlung: {
      const itemName = context.getItemName(event.itemId) ?? event.itemId;
      const pokemonName = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.itemFlung", {
        itemName,
        pokemonName,
      });
      return { message, color: BattleLogColors.itemConsumed, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.ItemMoveFailed: {
      const message = translate("battleLog.itemMoveFailed");
      return { message, color: BattleLogColors.miss, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.CriticalHit: {
      const pokemonName = context.getPokemonName(event.targetId);
      const message = translate("battleLog.criticalHit", { pokemonName });
      return { message, color: BattleLogColors.critical, pokemonIds: [event.targetId] };
    }

    case BattleEventType.HpRestored: {
      const pokemonName = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.hpRestored", {
        amount: event.amount,
        pokemonName,
      });
      return { message, color: BattleLogColors.heal, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.WishPosted: {
      const caster = context.getPokemonName(event.casterId);
      const message = translate("battleLog.wishPosted", { caster });
      return { message, color: BattleLogColors.heal, pokemonIds: [event.casterId, event.targetId] };
    }

    case BattleEventType.WishHealed: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.wishHealed", { amount: event.amount, name });
      return { message, color: BattleLogColors.heal, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.MoveFailed: {
      const name = context.getPokemonName(event.attackerId);
      let message: string;
      if (event.reason === MoveFailedReason.Focus) {
        message = translate("battleLog.moveFailed.focusLost", { name });
      } else if (event.reason === MoveFailedReason.ShellTrap) {
        message = translate("battleLog.moveFailed.trapNotTriggered", { name });
      } else {
        message = translate("battleLog.moveFailed.generic", { name });
      }
      return { message, color: BattleLogColors.miss, pokemonIds: [event.attackerId] };
    }

    case BattleEventType.FocusInterrupted: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.focusInterrupted", { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.BeakBlastBurn: {
      const targetName = context.getPokemonName(event.targetId);
      const message = translate("battleLog.beakBlastBurn", { targetName });
      return { message, color: BattleLogColors.status, pokemonIds: [event.targetId] };
    }

    case BattleEventType.ShellTrapArmed: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.shellTrapArmed", { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.Imprisoned: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.imprisoned", { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.HealPrevented: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.healPrevented", { name });
      return { message, color: BattleLogColors.miss, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.SpiteApplied: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.spiteApplied", { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.FutureSightPosted: {
      const caster = context.getPokemonName(event.casterId);
      const message = translate("battleLog.futureSightPosted", { caster });
      return { message, color: BattleLogColors.status, pokemonIds: [event.casterId] };
    }

    case BattleEventType.FutureSightFailed: {
      const name = context.getPokemonName(event.attackerId);
      const message = translate("battleLog.futureSightFailed", { name });
      return { message, color: BattleLogColors.miss, pokemonIds: [event.attackerId] };
    }

    case BattleEventType.FutureSightStruck: {
      const total = event.hits.reduce((sum, hit) => sum + hit.damage, 0);
      const message =
        event.hits.length === 0
          ? translate("battleLog.futureSightStruck.missed")
          : translate("battleLog.futureSightStruck.struck", { total });
      return {
        message,
        color: BattleLogColors.damage,
        pokemonIds: event.hits.map((hit) => hit.pokemonId),
      };
    }

    case BattleEventType.PerishAuraPosted: {
      const name = context.getPokemonName(event.casterId);
      const message = translate("battleLog.perishAuraPosted", { name, turns: event.turns });
      return { message, color: BattleLogColors.status, pokemonIds: [event.casterId] };
    }

    case BattleEventType.PerishKo: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.perishKo", { name });
      return { message, color: BattleLogColors.ko, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.PainSplitApplied: {
      const caster = context.getPokemonName(event.casterId);
      const target = context.getPokemonName(event.targetId);
      const message = translate("battleLog.painSplitApplied", {
        caster,
        pooledHp: event.pooledHp,
        target,
      });
      return {
        message,
        color: BattleLogColors.heal,
        pokemonIds: [event.casterId, event.targetId],
      };
    }

    case BattleEventType.EndeavorApplied: {
      const target = context.getPokemonName(event.targetId);
      const message = translate("battleLog.endeavorApplied", {
        damage: event.damage,
        target,
      });
      return { message, color: BattleLogColors.damage, pokemonIds: [event.targetId] };
    }

    case BattleEventType.EndeavorFailed: {
      const name = context.getPokemonName(event.attackerId);
      const message = translate("battleLog.endeavorFailed", { name });
      return { message, color: BattleLogColors.miss, pokemonIds: [event.attackerId] };
    }

    case BattleEventType.SuperFangApplied: {
      const target = context.getPokemonName(event.targetId);
      const message = translate("battleLog.superFangApplied", {
        damage: event.damage,
        target,
      });
      return { message, color: BattleLogColors.damage, pokemonIds: [event.targetId] };
    }

    case BattleEventType.SmackedDown: {
      const target = context.getPokemonName(event.targetId);
      const message = translate("battleLog.smackedDown", { target });
      return { message, color: BattleLogColors.status, pokemonIds: [event.targetId] };
    }

    case BattleEventType.HelpingHandPosted: {
      const caster = context.getPokemonName(event.casterId);
      const target = context.getPokemonName(event.targetId);
      const message = translate("battleLog.helpingHandPosted", { caster, target });
      return {
        message,
        color: BattleLogColors.status,
        pokemonIds: [event.casterId, event.targetId],
      };
    }

    case BattleEventType.TypeChanged: {
      const name = context.getPokemonName(event.pokemonId);
      let message: string;
      if (event.reason === TypeChangeReason.BurnUp) {
        message = translate("battleLog.typeChanged.burnUp", { name });
      } else if (event.newTypes.length === 0) {
        message = translate("battleLog.typeChanged.typeless", { name });
      } else {
        const typeLabel = event.newTypes
          .map((type) => getTypeName(type, lang))
          .join(translate("battleLog.typeChanged.typeSeparator"));
        message = translate("battleLog.typeChanged.becomes", { name, typeLabel });
      }
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.AbilityChanged: {
      const name = context.getPokemonName(event.pokemonId);
      const abilityName = event.abilityId ? context.getAbilityName(event.abilityId) : null;
      let message: string;
      if (event.reason === AbilityChangeReason.GastroAcid || abilityName === null) {
        message = translate("battleLog.abilityChanged.suppressed", { name });
      } else if (event.reason === AbilityChangeReason.RolePlay) {
        message = translate("battleLog.abilityChanged.copied", {
          abilityName,
          name,
        });
      } else {
        // SetByMove (Soucigraine) + SkillSwap (Échange) : le talent devient un autre.
        message = translate("battleLog.abilityChanged.becomes", {
          abilityName,
          name,
        });
      }
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.Cursed: {
      const caster = context.getPokemonName(event.casterId);
      const target = context.getPokemonName(event.targetId);
      const message = translate("battleLog.cursed", {
        caster,
        hpLost: event.hpLost,
        target,
      });
      return {
        message,
        color: BattleLogColors.status,
        pokemonIds: [event.casterId, event.targetId],
      };
    }

    case BattleEventType.CurseDamage: {
      const target = context.getPokemonName(event.targetId);
      const message = translate("battleLog.curseDamage", { amount: event.amount, target });
      return { message, color: BattleLogColors.damage, pokemonIds: [event.targetId] };
    }

    case BattleEventType.Drowsy: {
      const target = context.getPokemonName(event.targetId);
      const message = translate("battleLog.drowsy", { target });
      return { message, color: BattleLogColors.status, pokemonIds: [event.targetId] };
    }

    case BattleEventType.BellyDrumUsed: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.bellyDrumUsed", { hpLost: event.hpLost, name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.MagnetRisePosted: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.magnetRisePosted", { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.MagnetRiseEnded: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.magnetRiseEnded", { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.DrewAttention: {
      const name = context.getPokemonName(event.casterId);
      const message = translate("battleLog.drewAttention", { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.casterId] };
    }

    case BattleEventType.PromotedToActNext: {
      const target = context.getPokemonName(event.targetId);
      const message = translate("battleLog.promotedToActNext", { target });
      return { message, color: BattleLogColors.status, pokemonIds: [event.targetId] };
    }

    case BattleEventType.AlliesSwapped: {
      const caster = context.getPokemonName(event.casterId);
      const ally = context.getPokemonName(event.allyId);
      const message = translate("battleLog.alliesSwapped", { ally, caster });
      return { message, color: BattleLogColors.status, pokemonIds: [event.casterId, event.allyId] };
    }

    case BattleEventType.Transformed: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.transformed", { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.Stockpiled: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.stockpiled", { count: event.count, name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.StockpileReleased: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.stockpileReleased", { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.GuardSplit: {
      const casterName = context.getPokemonName(event.casterId);
      const targetName = context.getPokemonName(event.targetId);
      const message = translate("battleLog.guardSplit", {
        casterName,
        targetName,
      });
      return {
        message,
        color: BattleLogColors.status,
        pokemonIds: [event.casterId, event.targetId],
      };
    }

    case BattleEventType.MoveCopied: {
      const name = context.getPokemonName(event.pokemonId);
      const copiedName = context.getMoveName(event.copiedMoveId);
      const message = translate("battleLog.moveCopied", { copiedName, name });
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.MoveCopyFailed: {
      const name = context.getPokemonName(event.pokemonId);
      const moveName = context.getMoveName(event.moveId);
      const message = translate("battleLog.moveCopyFailed", { moveName, name });
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.WeatherSet: {
      const message = formatWeatherSet(event.weather, translate);
      if (!message) {
        return null;
      }
      return { message, color: BattleLogColors.turn, pokemonIds: [] };
    }

    case BattleEventType.WeatherCleared: {
      const message = formatWeatherCleared(event.weather, translate);
      if (!message) {
        return null;
      }
      return { message, color: BattleLogColors.turn, pokemonIds: [] };
    }

    case BattleEventType.WeatherDamage: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.weatherDamage", { amount: event.amount, name });
      return { message, color: BattleLogColors.damage, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.WeatherWar: {
      const message = translate("battleLog.weatherWar");
      return { message, color: BattleLogColors.turn, pokemonIds: [] };
    }

    case BattleEventType.MoveCharging: {
      const name = context.getPokemonName(event.pokemonId);
      const moveName = context.getMoveName(event.moveId);
      const message = translate("battleLog.moveCharging", { moveName, name });
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.LockInStarted: {
      const name = context.getPokemonName(event.pokemonId);
      const moveName = context.getMoveName(event.moveId);
      const message = translate("battleLog.lockInStarted", { moveName, name });
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.CritStageRaised: {
      const name = context.getPokemonName(event.targetId);
      const message = translate("battleLog.critStageRaised", { name });
      return { message, color: BattleLogColors.move, pokemonIds: [event.targetId] };
    }

    case BattleEventType.GuaranteedCritArmed: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.guaranteedCritArmed", { name });
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.AuraPosted: {
      const name = context.getPokemonName(event.casterId);
      const auraLabel = auraKindLabel(event.kind, translate);
      const message = translate("battleLog.auraPosted", {
        auraLabel,
        durationRounds: event.durationRounds,
        name,
      });
      return { message, color: BattleLogColors.move, pokemonIds: [event.casterId] };
    }

    case BattleEventType.AuraDissipated: {
      const name = context.getPokemonName(event.casterId);
      const auraLabel = auraKindLabel(event.kind, translate);
      const message = translate("battleLog.auraDissipated", { auraLabel, name });
      return { message, color: BattleLogColors.turn, pokemonIds: [event.casterId] };
    }

    case BattleEventType.AuraBroken: {
      const breakerName = context.getPokemonName(event.breakerId);
      const casterName = context.getPokemonName(event.casterId);
      const auraLabel = auraKindLabel(event.kind, translate);
      const message = translate("battleLog.auraBroken", {
        auraLabel,
        breakerName,
        casterName,
      });
      return {
        message,
        color: BattleLogColors.damage,
        pokemonIds: [event.breakerId, event.casterId],
      };
    }

    case BattleEventType.StatChangeBlocked: {
      const targetName = context.getPokemonName(event.pokemonId);
      let message: string;
      if (event.reason === ProtectionReason.Substitute) {
        message = translate("battleLog.statChangeBlocked.substitute", { targetName });
      } else if (event.reason === ProtectionReason.HeldItem) {
        message = translate("battleLog.statChangeBlocked.item", { targetName });
      } else {
        message = translate("battleLog.statChangeBlocked.mist", { targetName });
      }
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.StatusBlocked: {
      const targetName = context.getPokemonName(event.pokemonId);
      let message: string;
      if (event.reason === ProtectionReason.Substitute) {
        message = translate("battleLog.statusBlocked.substitute", { targetName });
      } else if (event.reason === ProtectionReason.MistyTerrain) {
        message = translate("battleLog.statusBlocked.mistyTerrain", { targetName });
      } else if (event.reason === ProtectionReason.ElectricTerrain) {
        message = translate("battleLog.statusBlocked.electricTerrain", { targetName });
      } else if (event.reason === ProtectionReason.UproarNoise) {
        message = translate("battleLog.statusBlocked.uproar", { targetName });
      } else if (event.reason === ProtectionReason.HeldItem) {
        message = translate("battleLog.statusBlocked.item", { targetName });
      } else {
        message = translate("battleLog.statusBlocked.safeguard", { targetName });
      }
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.FieldTerrainPosted: {
      const name = context.getPokemonName(event.casterId);
      const label = fieldTerrainLabel(event.kind, translate);
      const message = translate("battleLog.fieldTerrainPosted", {
        durationTurns: event.durationTurns,
        label,
        name,
      });
      return { message, color: BattleLogColors.move, pokemonIds: [event.casterId] };
    }

    case BattleEventType.FieldTerrainExpired: {
      const label = fieldTerrainLabel(event.kind, translate);
      const message = translate("battleLog.fieldTerrainExpired", { label });
      return { message, color: BattleLogColors.turn, pokemonIds: [] };
    }

    case BattleEventType.DashBlockedByPsychicTerrain: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.dashBlockedByPsychicTerrain", { name });
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.DistortionPosted: {
      const name = context.getPokemonName(event.casterId);
      const message = translate("battleLog.distortionPosted", {
        durationTurns: event.durationTurns,
        name,
      });
      return { message, color: BattleLogColors.move, pokemonIds: [event.casterId] };
    }

    case BattleEventType.DistortionExpired: {
      const message = translate("battleLog.distortionExpired");
      return { message, color: BattleLogColors.turn, pokemonIds: [] };
    }

    case BattleEventType.FieldGlobalPosted: {
      const name = context.getPokemonName(event.casterId);
      const label = fieldGlobalLabel(event.kind, translate);
      const message = translate("battleLog.fieldGlobalPosted", {
        durationTurns: event.durationTurns,
        label,
        name,
      });
      return { message, color: BattleLogColors.move, pokemonIds: [event.casterId] };
    }

    case BattleEventType.FieldGlobalExpired: {
      const label = fieldGlobalLabel(event.kind, translate);
      const message = translate("battleLog.fieldGlobalExpired", { label });
      return { message, color: BattleLogColors.turn, pokemonIds: [] };
    }

    case BattleEventType.TailwindSet: {
      const name = context.getPokemonName(event.casterId);
      const direction = directionLabel(event.direction, translate);
      const message = translate("battleLog.tailwindSet", {
        direction,
        name,
        turns: event.turns,
      });
      return { message, color: BattleLogColors.move, pokemonIds: [event.casterId] };
    }

    case BattleEventType.TailwindEnded: {
      const message = translate("battleLog.tailwindEnded");
      return { message, color: BattleLogColors.turn, pokemonIds: [] };
    }

    case BattleEventType.GravityMoveBlocked: {
      const name = context.getPokemonName(event.pokemonId);
      const move = context.getMoveName(event.moveId);
      const message = translate("battleLog.gravityMoveBlocked", { move, name });
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.EntryHazardPosted: {
      const label = entryHazardLabel(event.kind, translate);
      const layerSuffix = event.layers > 1 ? ` ×${event.layers}` : "";
      const message = translate("battleLog.entryHazardPosted", {
        label,
        layerSuffix,
      });
      return { message, color: BattleLogColors.move, pokemonIds: [] };
    }

    case BattleEventType.EntryHazardTriggered: {
      const name = context.getPokemonName(event.pokemonId);
      const label = entryHazardLabel(event.kind, translate);
      if (event.damage !== undefined) {
        const message = translate("battleLog.entryHazardTriggered.damage", {
          damage: event.damage,
          label,
          name,
        });
        return { message, color: BattleLogColors.damage, pokemonIds: [event.pokemonId] };
      }
      if (event.status !== undefined) {
        const badly = event.status === StatusType.BadlyPoisoned;
        const message = badly
          ? translate("battleLog.entryHazardTriggered.badlyPoisoned", { name, label })
          : translate("battleLog.entryHazardTriggered.poisoned", { name, label });
        return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
      }
      const message = translate("battleLog.entryHazardTriggered.slowed", {
        label,
        name,
      });
      return { message, color: BattleLogColors.statDown, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.EntryHazardAbsorbed: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.entryHazardAbsorbed", { name });
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.EntryHazardRemoved: {
      const message = translate("battleLog.entryHazardRemoved");
      return { message, color: BattleLogColors.turn, pokemonIds: [] };
    }

    case BattleEventType.SubstitutePosted: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.substitutePosted", { name });
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.SubstituteDamaged: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.substituteDamaged", {
        damage: event.damage,
        name,
      });
      return { message, color: BattleLogColors.damage, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.SubstituteBroken: {
      const name = context.getPokemonName(event.pokemonId);
      const breakerName = context.getPokemonName(event.breakerId);
      const message = translate("battleLog.substituteBroken", {
        breakerName,
        name,
      });
      return {
        message,
        color: BattleLogColors.damage,
        pokemonIds: [event.pokemonId, event.breakerId],
      };
    }

    case BattleEventType.SubstituteFailed: {
      const name = context.getPokemonName(event.pokemonId);
      const message =
        event.reason === SubstituteFailedReason.AlreadyActive
          ? translate("battleLog.substituteFailed.alreadyHas", { name })
          : translate("battleLog.substituteFailed.notEnoughHp", { name });
      return { message, color: BattleLogColors.turn, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.TauntBlocked: {
      const name = context.getPokemonName(event.pokemonId);
      const moveName = context.getMoveName(event.moveId);
      const message = translate("battleLog.tauntBlocked", { moveName, name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.MoveDisabled: {
      const name = context.getPokemonName(event.pokemonId);
      const moveName = context.getMoveName(event.moveId);
      const message = translate("battleLog.moveDisabled", { moveName, name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.MoveEncored: {
      const name = context.getPokemonName(event.pokemonId);
      const moveName = context.getMoveName(event.moveId);
      const message = translate("battleLog.moveEncored", { moveName, name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.DisableBlocked:
    case BattleEventType.EncoreBlocked: {
      const name = context.getPokemonName(event.pokemonId);
      const moveName = context.getMoveName(event.moveId);
      const message = translate("battleLog.encoreBlocked", { moveName, name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.DisableFailed:
    case BattleEventType.EncoreFailed:
    case BattleEventType.ImprisonFailed:
    case BattleEventType.SpiteFailed: {
      const message = translate("battleLog.spiteFailed");
      return { message, color: BattleLogColors.turn, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.Teleported: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.teleported", { name });
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.HitAndRunRetreat: {
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.hitAndRunRetreat", { name });
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.HitAndRunRetreatFallback: {
      if (event.reason === HitAndRunRetreatFallbackReason.Miss) {
        return null;
      }
      const name = context.getPokemonName(event.pokemonId);
      const message = translate("battleLog.hitAndRunRetreatFallback", { name });
      return { message, color: BattleLogColors.move, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.BatonPassed: {
      const casterName = context.getPokemonName(event.casterId);
      const targetName = context.getPokemonName(event.targetId);
      const message = translate("battleLog.batonPassed", {
        casterName,
        targetName,
      });
      return {
        message,
        color: BattleLogColors.move,
        pokemonIds: [event.casterId, event.targetId],
      };
    }

    case BattleEventType.StatStagesReset: {
      const message = translate("battleLog.statStagesReset");
      return { message, color: BattleLogColors.status, pokemonIds: event.pokemonIds };
    }

    case BattleEventType.StatStagesCopied: {
      const casterName = context.getPokemonName(event.casterId);
      const targetName = context.getPokemonName(event.targetId);
      const message = translate("battleLog.statStagesCopied", {
        casterName,
        targetName,
      });
      return {
        message,
        color: BattleLogColors.status,
        pokemonIds: [event.casterId, event.targetId],
      };
    }

    case BattleEventType.StatStagesInverted: {
      const name = context.getPokemonName(event.targetId);
      const message = translate("battleLog.statStagesInverted", { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.targetId] };
    }

    case BattleEventType.StatStagesSwapped: {
      const casterName = context.getPokemonName(event.casterId);
      const targetName = context.getPokemonName(event.targetId);
      const statLabels = event.stats
        .map((stat) => translate(`battleLog.stat.${stat}`))
        .join(translate("battleLog.statStagesSwapped.statSeparator"));
      const message = translate("battleLog.statStagesSwapped.swapped", {
        casterName,
        statLabels,
        targetName,
      });
      return {
        message,
        color: BattleLogColors.status,
        pokemonIds: [event.casterId, event.targetId],
      };
    }

    case BattleEventType.SpeedSwapped: {
      const casterName = context.getPokemonName(event.casterId);
      const targetName = context.getPokemonName(event.targetId);
      const message = translate("battleLog.speedSwapped", {
        casterName,
        targetName,
      });
      return {
        message,
        color: BattleLogColors.status,
        pokemonIds: [event.casterId, event.targetId],
      };
    }

    case BattleEventType.FinalGambitApplied: {
      const name = context.getPokemonName(event.attackerId);
      const message = translate("battleLog.finalGambitApplied", { name });
      return { message, color: BattleLogColors.damage, pokemonIds: [event.attackerId] };
    }

    case BattleEventType.PokemonRevived: {
      const name = context.getPokemonName(event.pokemonId);
      const message = event.revived
        ? translate("battleLog.pokemonRevived.revived", { name })
        : translate("battleLog.pokemonRevived.restored", { name });
      return { message, color: BattleLogColors.heal, pokemonIds: [event.pokemonId] };
    }

    case BattleEventType.ReviveOrHealFailed: {
      const name = context.getPokemonName(event.casterId);
      const message = translate("battleLog.reviveOrHealFailed", { name });
      return { message, color: BattleLogColors.miss, pokemonIds: [event.casterId] };
    }

    case BattleEventType.DestinyBondPosted: {
      const name = context.getPokemonName(event.casterId);
      const message = translate("battleLog.destinyBondPosted", { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.casterId] };
    }

    case BattleEventType.DestinyBondTriggered: {
      const victim = context.getPokemonName(event.victimId);
      const message = translate("battleLog.destinyBondTriggered", { victim });
      return { message, color: BattleLogColors.ko, pokemonIds: [event.casterId, event.victimId] };
    }

    case BattleEventType.GrudgePosted: {
      const name = context.getPokemonName(event.casterId);
      const message = translate("battleLog.grudgePosted", { name });
      return { message, color: BattleLogColors.status, pokemonIds: [event.casterId] };
    }

    case BattleEventType.GrudgeTriggered: {
      const attacker = context.getPokemonName(event.attackerId);
      const moveName = context.getMoveName(event.moveId);
      const message = translate("battleLog.grudgeTriggered", {
        attacker,
        moveName,
      });
      return { message, color: BattleLogColors.status, pokemonIds: [event.attackerId] };
    }

    case BattleEventType.OneHitKo: {
      const message = translate("battleLog.oneHitKo");
      return { message, color: BattleLogColors.ko, pokemonIds: [event.targetId] };
    }

    default:
      return null;
  }
}

function formatWeatherSet(weather: Weather, translate: Translate): string | null {
  switch (weather) {
    case Weather.Sun:
      return translate("battleLog.weather.sunSet");
    case Weather.Rain:
      return translate("battleLog.weather.rainSet");
    case Weather.Sandstorm:
      return translate("battleLog.weather.sandstormSet");
    case Weather.Snow:
      return translate("battleLog.weather.snowSet");
    default:
      return null;
  }
}

function formatWeatherCleared(weather: Weather, translate: Translate): string | null {
  switch (weather) {
    case Weather.Sun:
      return translate("battleLog.weather.sunCleared");
    case Weather.Rain:
      return translate("battleLog.weather.rainCleared");
    case Weather.Sandstorm:
      return translate("battleLog.weather.sandstormCleared");
    case Weather.Snow:
      return translate("battleLog.weather.snowCleared");
    default:
      return null;
  }
}

function getEffectivenessText(effectiveness: number, translate: Translate): string | null {
  if (effectiveness >= 4) {
    return translate("battleLog.effectiveness.extremely");
  }
  if (effectiveness >= 2) {
    return translate("battleLog.effectiveness.super");
  }
  if (effectiveness <= 0.25) {
    return translate("battleLog.effectiveness.barely");
  }
  if (effectiveness <= 0.5) {
    return translate("battleLog.effectiveness.notVery");
  }
  return null;
}
