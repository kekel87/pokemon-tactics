import type { FieldTerrain, MoveDefinition } from "@pokemon-tactic/core";
import { AttackStatSource, EffectKind, TargetingKind } from "@pokemon-tactic/core";
import type { BlockedMoveTag } from "../../../game/battle-orchestrator.js";
import { t } from "../../../i18n/index.js";
import type { TranslationKey } from "../../../i18n/types.js";
import { getCategoryIconUrl } from "../../../team/asset-paths.js";
import { buildPatternPreview, type PatternCell } from "../../pattern-preview.js";

/**
 * MoveTooltip — DOM/CSS port of the Phaser `ui/MoveTooltip.ts` (plan 121 step
 * 4b-2). Hover over a move in the attack submenu shows its category, power,
 * accuracy, targeting pattern (+ a mini grid preview) and any special tags.
 * Reads the `MoveDefinition` directly (faithful port); pure view, no state.
 */

const FIELD_TERRAIN_TOOLTIP_KEY: Record<FieldTerrain, TranslationKey> = {
  grassy: "moveTooltip.tag.fieldTerrain.grassy",
  electric: "moveTooltip.tag.fieldTerrain.electric",
  misty: "moveTooltip.tag.fieldTerrain.misty",
  psychic: "moveTooltip.tag.fieldTerrain.psychic",
};

const PATTERN_TRANSLATION_KEY: Record<string, TranslationKey> = {
  [TargetingKind.Single]: "pattern.single",
  [TargetingKind.Self]: "pattern.self",
  [TargetingKind.Line]: "pattern.line",
  [TargetingKind.Cone]: "pattern.cone",
  [TargetingKind.Slash]: "pattern.slash",
  [TargetingKind.Cross]: "pattern.cross",
  [TargetingKind.Zone]: "pattern.zone",
  [TargetingKind.Dash]: "pattern.dash",
  [TargetingKind.Blast]: "pattern.blast",
  [TargetingKind.Teleport]: "pattern.teleport",
  [TargetingKind.HitAndRun]: "pattern.hit-and-run",
};

const BLOCKED_TAG_KEY: Record<BlockedMoveTag, TranslationKey> = {
  taunt: "moveTooltip.tag.tauntBlocked",
  disable: "moveTooltip.tag.disableBlocked",
  encore: "moveTooltip.tag.encoreBlocked",
};

export interface MoveTooltip {
  readonly element: HTMLElement;
  show(move: MoveDefinition, blockedTag?: BlockedMoveTag): void;
  hide(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function rangeLabel(move: MoveDefinition): string | null {
  const targeting = move.targeting;
  switch (targeting.kind) {
    case TargetingKind.Single:
      return targeting.range.max > 1 ? `${targeting.range.min}-${targeting.range.max}` : null;
    case TargetingKind.Blast:
    case TargetingKind.Teleport:
      return `${targeting.range.min}-${targeting.range.max}`;
    case TargetingKind.HitAndRun:
      return targeting.hitRange.max > 1
        ? `${targeting.hitRange.min}-${targeting.hitRange.max}`
        : null;
    default:
      return null;
  }
}

/** All localised tag lines for a move (mirror of the Phaser tooltip's tag block). */
function tagLines(move: MoveDefinition): string[] {
  const keys: TranslationKey[] = [];

  if (move.twoTurnCharge) {
    keys.push(
      move.sunSkipsCharge ? "move.tooltip.twoTurnChargeSunSkip" : "move.tooltip.twoTurnCharge",
    );
  }
  if (move.dynamicPower !== undefined) {
    keys.push("moveTooltip.tag.dynamicPower");
  }
  if (move.attackStatSource !== undefined) {
    keys.push(
      move.attackStatSource === AttackStatSource.UserDefense
        ? "moveTooltip.tag.statSourceDefense"
        : "moveTooltip.tag.statSourceTargetAttack",
    );
  }
  if (move.hitsPhysicalDefense === true) {
    keys.push("moveTooltip.tag.hitsPhysicalDefense");
  }
  if (move.typeEffectivenessOverride !== undefined) {
    keys.push("moveTooltip.tag.superVsWater");
  }
  if (
    move.effects.some(
      (effect) => effect.kind === EffectKind.Damage && effect.escalatingHitPower !== undefined,
    )
  ) {
    keys.push("moveTooltip.tag.escalatingHits");
  }
  if (move.crashOnMiss !== undefined) {
    keys.push("moveTooltip.tag.crashOnMiss");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.PostHealOverTime)) {
    keys.push("moveTooltip.tag.healOverTime");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.PostWish)) {
    keys.push("moveTooltip.tag.wish");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.CureTeamStatus)) {
    keys.push("moveTooltip.tag.cureTeamStatus");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.HealByTargetStat)) {
    keys.push("moveTooltip.tag.healByTargetAttack");
  }
  if (move.requiresTargetAsleep === true) {
    keys.push("moveTooltip.tag.requiresTargetAsleep");
  }
  if (move.dashRangeBonusOnFieldTerrain !== undefined) {
    keys.push("moveTooltip.tag.grassyGlideDash");
  }
  if (move.fieldTerrainPowerBonus?.who === "target") {
    keys.push("moveTooltip.tag.risingVoltageTerrain");
  }
  if (move.fieldTerrainTargetingOverride !== undefined) {
    keys.push("moveTooltip.tag.expandingForceTerrain");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.Recoil && effect.fraction >= 999)) {
    keys.push("moveTooltip.tag.mistyExplosionSelfKo");
  }
  if (move.fieldTerrainBoostedType === true) {
    keys.push("moveTooltip.tag.terrainPulseMorph");
  }
  if (move.naturePowerMorph === true) {
    keys.push("moveTooltip.tag.naturePowerMorph");
  }
  const fieldTerrainEffect = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.PostFieldTerrain }> =>
      effect.kind === EffectKind.PostFieldTerrain,
  );
  if (fieldTerrainEffect) {
    keys.push(FIELD_TERRAIN_TOOLTIP_KEY[fieldTerrainEffect.terrain]);
  }
  if (move.flags?.sound) {
    keys.push("moveTooltip.tag.sound");
  } else if (move.flags?.bypasssub) {
    keys.push("moveTooltip.tag.bypasssub");
  }

  return keys.map((key) => t(key));
}

function renderGrid(cells: PatternCell[][]): HTMLElement {
  const grid = el("div", "mt-grid");
  grid.style.setProperty("--mt-cols", String(cells[0]?.length ?? 0));
  for (const row of cells) {
    for (const cell of row) {
      const node = el("span", "mt-cell");
      node.dataset.cell = cell;
      grid.append(node);
    }
  }
  return grid;
}

export function createMoveTooltip(): MoveTooltip {
  const root = el("div", "mt-tooltip");
  root.hidden = true;

  return {
    element: root,
    show: (move: MoveDefinition, blockedTag?: BlockedMoveTag) => {
      root.replaceChildren();

      const category = el("img", "mt-category");
      category.alt = move.category;
      category.loading = "lazy";
      category.decoding = "async";
      category.src = getCategoryIconUrl(move.category);
      root.append(category);

      const power = move.power > 0 ? `${move.power}` : "—";
      const accuracy = move.accuracy > 0 ? `${move.accuracy}` : "—";
      const stats = el("div", "mt-line");
      stats.textContent = `${t("move.power", { value: power })}  ${t("move.accuracy", { value: accuracy })}`;
      root.append(stats);

      const patternKey = PATTERN_TRANSLATION_KEY[move.targeting.kind];
      const patternName = patternKey ? t(patternKey) : move.targeting.kind;
      const range = rangeLabel(move);
      const patternLine = el("div", "mt-line");
      patternLine.textContent = range
        ? `${patternName}  ${t("move.range", { value: range })}`
        : patternName;
      root.append(patternLine);

      for (const line of tagLines(move)) {
        const node = el("div", "mt-line");
        node.textContent = line;
        root.append(node);
      }

      if (blockedTag) {
        const blocked = el("div", "mt-line mt-blocked");
        blocked.textContent = t(BLOCKED_TAG_KEY[blockedTag]);
        root.append(blocked);
      }

      root.append(renderGrid(buildPatternPreview(move.targeting)));
      root.hidden = false;
    },
    hide: () => {
      root.hidden = true;
      root.replaceChildren();
    },
  };
}
