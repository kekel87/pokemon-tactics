import { EffectKind, type MoveDefinition, StatName, StatusType } from "@pokemon-tactic/core";
import type { PresentationContext, TileInfoChip } from "@pokemon-tactic/render-ports";

/**
 * Secondary-effect chip (plan 175, shared by plan 178) — the move's first chance-based side effect
 * as a chip (`30 %` + status icon, or `Vitesse 1↓ · 20 %`).
 *
 * Lives in its own module because BOTH the confirm-phase forecast and the move tooltip show it, and
 * a duplicated builder drifts: plan 175 found `estimateDamage` and `handle-damage` had silently
 * diverged for months (weather morphs, rain penalty, Coup d'Main), skewing both the displayed figure
 * and ~10 AI heuristics — hence `damage-context.ts`. One builder, two callers.
 *
 * Derived from the definition alone (no battle state), so the tooltip can call it while merely
 * hovering a move, before any target exists.
 */

/**
 * Statuses that ship `label-<status>.png` chip art → localisation key of their name (for a11y, since
 * the visible name is baked into the image). A status absent from this map has no chip art (ex.
 * Confusion) and falls back to the bare `icon-*` glyph rather than requesting a missing file.
 */
const STATUS_CHIP_LABEL_KEY: Partial<Record<StatusType, string>> = {
  [StatusType.Burned]: "status.burned",
  [StatusType.Paralyzed]: "status.paralyzed",
  [StatusType.Poisoned]: "status.poisoned",
  [StatusType.BadlyPoisoned]: "status.badlyPoisoned",
  [StatusType.Frozen]: "status.frozen",
  [StatusType.Asleep]: "status.asleep",
};

const STAT_LABEL: Record<string, string> = {
  [StatName.Attack]: "stat.atk",
  [StatName.Defense]: "stat.def",
  [StatName.SpAttack]: "stat.spA",
  [StatName.SpDefense]: "stat.spD",
  [StatName.Speed]: "stat.spd",
  [StatName.Accuracy]: "stat.acc",
  [StatName.Evasion]: "stat.eva",
};

export function buildSecondaryEffectChip(
  context: PresentationContext,
  move: MoveDefinition,
): TileInfoChip | null {
  for (const effect of move.effects) {
    if (effect.kind === EffectKind.Status && effect.chance > 0 && effect.chance < 100) {
      const status = "status" in effect ? effect.status : effect.statuses[0];
      // Status CHIP (plan 178), not the bare glyph: the `label-*` art names the status itself, so the
      // player reads "BRÛLÉ 10 %" instead of decoding a pictogram. Statuses without chip art keep the
      // glyph — better a pictogram than a request for a file that does not exist.
      const chipLabelKey = STATUS_CHIP_LABEL_KEY[status];
      return {
        ...(chipLabelKey === undefined
          ? { iconUrls: [context.getStatusIconUrl(status)] }
          : {
              statusLabelUrl: context.getStatusLabelUrl(status),
              statusLabelAlt: context.translate(chipLabelKey),
            }),
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
