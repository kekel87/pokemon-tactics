import {
  type BattleEngine,
  type BattleState,
  EffectKind,
  type MoveDefinition,
  type MovePreview,
  type PokemonInstance,
  type Position,
  StatName,
  SurvivalGuardKind,
} from "@pokemon-tactic/core";
import { getMoveName, getPokemonName } from "@pokemon-tactic/data";
import type {
  CombatPreviewOutcome,
  InfoPanelAttack,
  InfoPanelData,
  PresentationContext,
  TileInfoChip,
} from "@pokemon-tactic/render-ports";
import { buildInfoPanelView } from "./battle-views.js";

/** The two halves of the forecast: the arrow card, and the cursor card showing the victim. */
export interface CombatPreviewResult {
  readonly attack: InfoPanelAttack;
  readonly target: InfoPanelData;
}

/** Localisation key naming the survival guard appended to a lethal verdict. */
const SURVIVAL_GUARD_LABEL: Record<SurvivalGuardKind, string> = {
  [SurvivalGuardKind.Endure]: "combatPreview.guard.endure",
  [SurvivalGuardKind.Sturdy]: "combatPreview.guard.sturdy",
  [SurvivalGuardKind.FocusSash]: "combatPreview.guard.focusSash",
};

/** Short stat names, shared with the InfoPanel stat block so the two never drift apart. */
const STAT_LABEL: Record<string, string> = {
  [StatName.Attack]: "stat.atk",
  [StatName.Defense]: "stat.def",
  [StatName.SpAttack]: "stat.spA",
  [StatName.SpDefense]: "stat.spD",
  [StatName.Speed]: "stat.spd",
  [StatName.Accuracy]: "stat.acc",
  [StatName.Evasion]: "stat.eva",
};

function teamNumberOf(playerId: string): number {
  return Number(playerId.match(/(\d+)/)?.[1] ?? "1");
}

/**
 * Whether the player is allowed to KNOW about the guard that would save the target (human decision
 * 2026-07-25: nuance the verdict only when the source is visible).
 *
 * Ténacité is always known — the player watched the target spend its action bracing. Fermeté and
 * Ceinture Force are an ability and a held item: today nothing is hidden, so this is `true`, but the
 * predicate exists so plan 176 only has to swap in its perspective check instead of retrofitting the
 * whole verdict path. Without it the preview would happily reveal a Ceinture Force the fog hides.
 */
function isGuardKnownToPlayer(guard: SurvivalGuardKind, target: PokemonInstance): boolean {
  if (guard === SurvivalGuardKind.Endure) {
    return true;
  }
  // Plan 176 hook: gate on the same visibility the InfoPanel uses (`revealedItem` & co).
  return target.currentHp >= 0;
}

/** Crit odds as displayed: the two certainties read as words, everything else as a whole percent. */
function critValueOf(context: PresentationContext, critChance: number): string {
  if (critChance === 1) {
    return context.translate("combatPreview.crit.guaranteed");
  }
  if (critChance === 0) {
    return context.translate("combatPreview.crit.impossible");
  }
  return `${Math.round(critChance * 100)} %`;
}

/** Percentage of max HP a damage bound represents, rounded to the nearest whole point. */
function hpPercent(amount: number, maxHp: number): number {
  return maxHp <= 0 ? 0 : Math.round((amount / maxHp) * 100);
}

function buildModifierChips(context: PresentationContext, preview: MovePreview): TileInfoChip[] {
  const chips: TileInfoChip[] = [];
  const damage = preview.damage;
  if (!damage) {
    return chips;
  }
  if (damage.effectiveness !== 1) {
    chips.push({
      iconUrls: [context.getTypeIconUrl(damage.resolvedMoveType)],
      text: `×${damage.effectiveness}`,
      title: context.translate("combatPreview.modifier.type"),
      tone: damage.effectiveness > 1 ? "buff" : "danger",
    });
  }
  // Named rather than pictogrammed: a bare 🎯 ×0.85 told the player nothing (human 2026-07-25).
  if (damage.facingModifier !== 1) {
    chips.push({
      text: `${context.translate(
        damage.facingModifier > 1 ? "combatPreview.facing.back" : "combatPreview.facing.front",
      )} ×${damage.facingModifier}`,
      title: context.translate("combatPreview.modifier.facing"),
      tone: damage.facingModifier > 1 ? "buff" : "danger",
    });
  }
  if (damage.heightModifier !== 1) {
    chips.push({
      text: `${context.translate("combatPreview.modifier.height")} ×${damage.heightModifier}`,
      title: context.translate("combatPreview.modifier.height"),
      tone: damage.heightModifier > 1 ? "buff" : "danger",
    });
  }
  if (damage.terrainModifier !== 1) {
    chips.push({
      text: `${context.translate("combatPreview.modifier.terrain")} ×${damage.terrainModifier}`,
      title: context.translate("combatPreview.modifier.terrain"),
      tone: damage.terrainModifier > 1 ? "buff" : "danger",
    });
  }
  if (damage.weatherModifier !== 1) {
    chips.push({
      text: `${context.translate("combatPreview.modifier.weather")} ×${damage.weatherModifier}`,
      title: context.translate("combatPreview.modifier.weather"),
      tone: damage.weatherModifier > 1 ? "buff" : "danger",
    });
  }
  if (damage.screenModifier !== 1) {
    chips.push({
      text: `${context.translate("combatPreview.modifier.screen")} ×${damage.screenModifier}`,
      title: context.translate("combatPreview.modifier.screen"),
      tone: "danger",
    });
  }
  return chips;
}

/** The move's first chance-based secondary effect, as a chip (status or stat drop). */
function buildEffectChip(context: PresentationContext, move: MoveDefinition): TileInfoChip | null {
  for (const effect of move.effects) {
    if (effect.kind === EffectKind.Status && effect.chance > 0 && effect.chance < 100) {
      const status = "status" in effect ? effect.status : effect.statuses[0];
      return {
        iconUrls: [context.getStatusIconUrl(status)],
        text: `${effect.chance} %`,
        title: context.translate("combatPreview.secondaryEffect"),
        tone: "info",
      };
    }
    if (
      effect.kind === EffectKind.StatChange &&
      effect.chance !== undefined &&
      effect.chance > 0 &&
      effect.chance < 100
    ) {
      // Names the stat and the direction: a lone "⬇ 20 %" left the player guessing what dropped.
      const statKey = STAT_LABEL[effect.stat];
      const stat = statKey ? context.translate(statKey) : effect.stat;
      const arrow = effect.stages > 0 ? "↑" : "↓";
      return {
        text: `${stat} ${Math.abs(effect.stages)}${arrow} · ${effect.chance} %`,
        title: context.translate("combatPreview.secondaryEffect"),
        tone: effect.stages > 0 ? "buff" : "danger",
      };
    }
  }
  return null;
}

/**
 * Lethality + the only text worth printing next to it.
 *
 * The three K.O. states are conveyed by `outcome` alone (the DOM colours the damage figure with
 * it); `verdictLabel` stays empty for them. It is filled only when colour cannot say it: an
 * immunity, and a known survive-at-1-HP guard that would otherwise make a red "this kills" lie.
 */
function buildVerdict(
  context: PresentationContext,
  preview: MovePreview,
  target: PokemonInstance,
): { outcome: CombatPreviewOutcome; verdictLabel: string } {
  const damage = preview.damage;
  if (damage && damage.effectiveness === 0) {
    return { outcome: "no-effect", verdictLabel: context.translate("combatPreview.noEffect") };
  }
  if (!damage || damage.max <= 0) {
    return { outcome: "survives", verdictLabel: "" };
  }
  if (damage.max < target.currentHp) {
    return { outcome: "survives", verdictLabel: "" };
  }

  const guard =
    preview.survivalGuard !== null && isGuardKnownToPlayer(preview.survivalGuard, target)
      ? preview.survivalGuard
      : null;
  const caveat = guard
    ? context.translate("combatPreview.verdict.unless", {
        guard: context.translate(SURVIVAL_GUARD_LABEL[guard]),
      })
    : "";

  return {
    outcome: damage.min >= target.currentHp ? "guaranteed-ko" : "possible-ko",
    verdictLabel: caveat,
  };
}

/**
 * Build the combat-preview view-model (plan 175) for the focused target of a locked-in attack.
 *
 * `targetIds` is the whole footprint (allies included — friendly fire is a real cost here), and
 * `focusIndex` selects which one the panel details; the caller cycles it. Returns null when the
 * focused target no longer exists, so a stale index simply clears the panel.
 *
 * `moveId` is the move as SELECTED (the engine re-resolves any Force Nature / Champlification morph
 * itself), while `displayMove` is that already-morphed definition — used only to read the secondary
 * effect, so the chip describes what will actually land.
 */
export function buildCombatPreviewView(
  context: PresentationContext,
  engine: BattleEngine,
  state: BattleState,
  attackerId: string,
  moveId: string,
  displayMove: MoveDefinition,
  targetIds: readonly string[],
  focusIndex: number,
  targetPosition?: Position,
): CombatPreviewResult | null {
  const attacker = state.pokemon.get(attackerId);
  const targetId = targetIds[focusIndex];
  const target = targetId === undefined ? undefined : state.pokemon.get(targetId);
  if (!attacker || !target) {
    return null;
  }
  const preview = engine.previewMove(attackerId, moveId, target.id, targetPosition);
  if (!preview) {
    return null;
  }

  const language = context.getLanguage();
  const isAlly = target.playerId === attacker.playerId;
  const damage = preview.damage;
  const hasDamage = damage !== null && damage.max > 0;
  const { outcome, verdictLabel } = buildVerdict(context, preview, target);

  // Predicted HP left, expressed as the share of max HP — the worst case first, mirroring how the
  // damage range reads. A lethal hit collapses to a flat 0 %.
  const remainingLabel = hasDamage
    ? damage.max >= target.currentHp
      ? context.translate("combatPreview.remaining", { percent: "0" })
      : context.translate("combatPreview.remaining", {
          percent: `${hpPercent(target.currentHp - damage.max, target.maxHp)}–${hpPercent(
            target.currentHp - damage.min,
            target.maxHp,
          )}`,
        })
    : "";

  return {
    attack: {
      moveName: getMoveName(displayMove.id, language),
      moveTypeIconUrl: context.getTypeIconUrl(damage?.resolvedMoveType ?? displayMove.type),
      accuracyText: context.translate("combatPreview.accuracy.short", {
        value:
          preview.accuracy === null
            ? context.translate("combatPreview.accuracy.guaranteed")
            : `${Math.round(preview.accuracy)} %`,
      }),
      // Rounded to a whole percent (human decision 2026-07-25): the genre standard is a percentage,
      // but a decimal like "6.25 %" is false precision next to this panel's short numbers.
      critText: context.translate("combatPreview.crit.short", {
        value: critValueOf(context, preview.critChance),
      }),
      damageValue: hasDamage ? `${damage.min}–${damage.max}` : "—",
      damageUnitLabel: hasDamage ? context.translate("combatPreview.damageUnit") : "",
      outcome,
      modifierChips: buildModifierChips(context, preview),
      effectChip: hasDamage ? buildEffectChip(context, displayMove) : null,
    },
    // The victim's readout is a normal InfoPanel view with the forecast layered on, so the cursor
    // card is literally the same component as the active-Pokémon panel (human 2026-07-25).
    target: {
      ...buildInfoPanelView(context, target, state, isAlly),
      // The forecast card never shows the stat block, even for an ally (human 2026-07-25): it is a
      // damage readout, and the attacker's own panel already carries the detailed stats.
      stats: undefined,
      preview: {
        damage: hasDamage ? { min: damage.min, max: damage.max } : null,
        remainingLabel,
        outcome,
        verdictLabel,
        focusIndex,
        totalTargets: targetIds.length,
      },
    },
  };
}
