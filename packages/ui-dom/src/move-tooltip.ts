import type { FieldTerrain, MoveDefinition } from "@pokemon-tactic/core";
import {
  AttackStatSource,
  CallMoveSourceKind,
  ChargeReaction,
  EffectKind,
  EffectTarget,
  StatusType,
  TargetingKind,
} from "@pokemon-tactic/core";
import {
  type BlockedMoveTag,
  type MoveIntent,
  moveIntent,
  selfPreviewRadius,
} from "@pokemon-tactic/view-core";
import type { UiDomConfig } from "./config.js";
import { el } from "./dom-helpers.js";
import { buildPatternPreview, type PatternCell } from "./pattern-preview.js";

/**
 * MoveTooltip — DOM/CSS move tooltip (plan 121 step
 * 4b-2). Hover over a move in the attack submenu shows its category, power,
 * accuracy, targeting pattern (+ a mini grid preview) and any special tags.
 * Reads the `MoveDefinition` directly; pure view, no state.
 */

const FIELD_TERRAIN_TOOLTIP_KEY: Record<FieldTerrain, string> = {
  grassy: "moveTooltip.tag.fieldTerrain.grassy",
  electric: "moveTooltip.tag.fieldTerrain.electric",
  misty: "moveTooltip.tag.fieldTerrain.misty",
  psychic: "moveTooltip.tag.fieldTerrain.psychic",
};

const PATTERN_TRANSLATION_KEY: Record<string, string> = {
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
  [TargetingKind.GroundTarget]: "pattern.ground-target",
};

const BLOCKED_TAG_KEY: Record<BlockedMoveTag, string> = {
  taunt: "moveTooltip.tag.tauntBlocked",
  disable: "moveTooltip.tag.disableBlocked",
  encore: "moveTooltip.tag.encoreBlocked",
};

export interface MoveTooltip {
  readonly element: HTMLElement;
  show(move: MoveDefinition, blockedTag?: BlockedMoveTag): void;
  hide(): void;
}

function rangeLabel(move: MoveDefinition): string | null {
  const targeting = move.targeting;
  switch (targeting.kind) {
    case TargetingKind.Single:
      return targeting.range.max > 1 ? `${targeting.range.min}-${targeting.range.max}` : null;
    case TargetingKind.Blast:
    case TargetingKind.Teleport:
    case TargetingKind.GroundTarget:
      return `${targeting.range.min}-${targeting.range.max}`;
    case TargetingKind.HitAndRun:
      return targeting.hitRange.max > 1
        ? `${targeting.hitRange.min}-${targeting.hitRange.max}`
        : null;
    default:
      return null;
  }
}

/** All localised tag lines for a move. */
function tagLines(move: MoveDefinition, config: UiDomConfig): string[] {
  const keys: string[] = [];

  if (move.twoTurnCharge) {
    if (move.chargeReaction === ChargeReaction.Focus) {
      keys.push("moveTooltip.tag.chargeReactionFocus");
    } else if (move.chargeReaction === ChargeReaction.Beak) {
      keys.push("moveTooltip.tag.chargeReactionBeak");
    } else if (move.chargeReaction === ChargeReaction.Shell) {
      keys.push("moveTooltip.tag.chargeReactionShell");
    } else {
      keys.push(
        move.sunSkipsCharge ? "move.tooltip.twoTurnChargeSunSkip" : "move.tooltip.twoTurnCharge",
      );
    }
  }
  if (move.firstActionOnly === true) {
    keys.push("moveTooltip.tag.firstActionOnly");
  }
  if (move.failsUnlessTargetAggressive === true) {
    keys.push("moveTooltip.tag.suckerPunch");
  }
  if (move.isOhko === true) {
    keys.push("moveTooltip.tag.ohko");
  }
  if (move.cannotKo === true) {
    keys.push("moveTooltip.tag.cannotKo");
  }
  if (move.pursuitBackstab === true) {
    keys.push("moveTooltip.tag.pursuitBackstab");
  }
  if (move.bypassProtect === true) {
    keys.push("moveTooltip.tag.bypassProtect");
  }
  if (move.bypassAccuracy === true) {
    keys.push("moveTooltip.tag.neverMiss");
  }
  for (const effect of move.effects) {
    if (effect.kind === EffectKind.RaiseCritStage) {
      keys.push(
        effect.target === EffectTarget.Self
          ? "moveTooltip.tag.focusEnergy"
          : "moveTooltip.tag.dragonCheer",
      );
    } else if (effect.kind === EffectKind.ArmGuaranteedCrit) {
      keys.push("moveTooltip.tag.laserFocus");
    } else if (effect.kind === EffectKind.HalveTargetHp) {
      keys.push("moveTooltip.tag.superFang");
    } else if (effect.kind === EffectKind.SmackDown) {
      keys.push("moveTooltip.tag.smackDown");
    } else if (effect.kind === EffectKind.SetAbility) {
      keys.push("moveTooltip.tag.setAbility");
    } else if (effect.kind === EffectKind.SuppressAbility) {
      keys.push("moveTooltip.tag.suppressAbility");
    } else if (effect.kind === EffectKind.CopyAbility) {
      keys.push("moveTooltip.tag.copyAbility");
    } else if (effect.kind === EffectKind.SwapAbility) {
      keys.push("moveTooltip.tag.swapAbility");
    } else if (effect.kind === EffectKind.Curse) {
      keys.push("moveTooltip.tag.curse");
    } else if (effect.kind === EffectKind.BellyDrum) {
      keys.push("moveTooltip.tag.bellyDrum");
    } else if (effect.kind === EffectKind.Yawn) {
      keys.push("moveTooltip.tag.yawn");
    } else if (effect.kind === EffectKind.RaiseRandomStat) {
      keys.push("moveTooltip.tag.acupressure");
    } else if (effect.kind === EffectKind.Attract) {
      keys.push("moveTooltip.tag.attract");
    } else if (effect.kind === EffectKind.MagnetRise) {
      keys.push("moveTooltip.tag.magnetRise");
    } else if (effect.kind === EffectKind.DrawAttention) {
      keys.push(
        move.flags?.powder === true
          ? "moveTooltip.tag.drawAttentionPowder"
          : "moveTooltip.tag.drawAttention",
      );
    } else if (effect.kind === EffectKind.ActAfterUser) {
      keys.push("moveTooltip.tag.actAfterUser");
    } else if (effect.kind === EffectKind.SwapAllyPositions) {
      keys.push("moveTooltip.tag.swapAllyPositions");
    }
  }
  if (move.alwaysCrit === true) {
    keys.push("moveTooltip.tag.alwaysCrit");
  }
  if (move.ignoresDefensiveStages === true) {
    keys.push("moveTooltip.tag.ignoresDefensiveStages");
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
  if (move.effects.some((effect) => effect.kind === EffectKind.PostDistortion)) {
    keys.push("moveTooltip.tag.distortion");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.PostEntryHazard)) {
    keys.push("moveTooltip.tag.hazardSetter");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.RemoveEntryHazards)) {
    keys.push("moveTooltip.tag.hazardRemover");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.PostImprison)) {
    keys.push("moveTooltip.tag.imprison");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.SpiteCtTax)) {
    keys.push("moveTooltip.tag.spite");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.RemoveItem)) {
    keys.push("moveTooltip.tag.removesItem");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.StealItem)) {
    keys.push("moveTooltip.tag.stealsItem");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.SwapItems)) {
    keys.push("moveTooltip.tag.swapsItem");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.FlingItem)) {
    keys.push("moveTooltip.tag.fling");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.EatTargetBerry)) {
    keys.push("moveTooltip.tag.eatsBerry");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.BurnTargetItem)) {
    keys.push("moveTooltip.tag.burnsItem");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.RecycleItem)) {
    keys.push("moveTooltip.tag.recycleItem");
  }
  if (move.requiresEatenBerry === true) {
    keys.push("moveTooltip.tag.requiresBerry");
  }
  if (
    move.effects.some(
      (effect) =>
        effect.kind === EffectKind.Status &&
        (("status" in effect && effect.status === StatusType.HealBlocked) ||
          ("statuses" in effect && effect.statuses.includes(StatusType.HealBlocked))),
    )
  ) {
    keys.push("moveTooltip.tag.healBlock");
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
  if (
    move.callMove === CallMoveSourceKind.RandomAll ||
    move.callMove === CallMoveSourceKind.RandomOwnAsleep
  ) {
    keys.push("moveTooltip.tag.callMoveRandom");
  } else if (
    move.callMove === CallMoveSourceKind.TargetLast ||
    move.callMove === CallMoveSourceKind.GlobalLast
  ) {
    keys.push("moveTooltip.tag.callMoveCopy");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.CopyMoveToSlot)) {
    keys.push("moveTooltip.tag.copyMoveToSlot");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.ResetStatStages)) {
    keys.push("moveTooltip.tag.statManipReset");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.CopyStatStages)) {
    keys.push("moveTooltip.tag.statManipCopy");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.InvertStatStages)) {
    keys.push("moveTooltip.tag.statManipInvert");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.SwapStatStages)) {
    keys.push("moveTooltip.tag.statManipSwap");
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.SwapRawSpeed)) {
    keys.push("moveTooltip.tag.statManipSpeedSwap");
  }
  if (move.lockIn !== undefined) {
    keys.push(
      move.lockIn.confuseOnEnd ? "moveTooltip.tag.lockInConfuse" : "moveTooltip.tag.lockIn",
    );
  }
  if (move.uproarAura === true) {
    keys.push("moveTooltip.tag.uproarAura");
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

  const lines = keys.map((key) => config.translate(key));
  if (move.typeEffectivenessOverride !== undefined) {
    const { against, multiplier } = move.typeEffectivenessOverride;
    lines.push(
      config.translate("moveTooltip.tag.typeEffectivenessOverride", {
        multiplier,
        type: config.translate(`pokemonType.${against}`),
      }),
    );
  }
  return lines;
}

function renderGrid(cells: PatternCell[][], intent: MoveIntent): HTMLElement {
  const grid = el("div", "mt-grid", "move-tooltip-grid");
  grid.dataset.intent = intent;
  grid.style.setProperty("--mt-cols", String(cells[0]?.length ?? 0));
  for (const row of cells) {
    for (const cell of row) {
      const node = el("span", "mt-cell", "move-tooltip-cell");
      node.dataset.cell = cell;
      grid.append(node);
    }
  }
  return grid;
}

export function createMoveTooltip(config: UiDomConfig): MoveTooltip {
  const root = el("div", "mt-tooltip", "move-tooltip");
  root.hidden = true;

  return {
    element: root,
    show: (move: MoveDefinition, blockedTag?: BlockedMoveTag) => {
      root.replaceChildren();

      const category = el("img", "mt-category");
      category.alt = move.category;
      category.loading = "lazy";
      category.decoding = "async";
      category.src = config.getCategoryIconUrl(move.category);
      root.append(category);

      const power = move.power > 0 ? `${move.power}` : "—";
      const accuracy = move.accuracy > 0 ? `${move.accuracy}` : "—";
      const stats = el("div", "mt-line", "move-tooltip-stats");
      stats.textContent = `${config.translate("move.power", { value: power })}  ${config.translate("move.accuracy", { value: accuracy })}`;
      root.append(stats);

      const patternKey = PATTERN_TRANSLATION_KEY[move.targeting.kind];
      const patternName = patternKey ? config.translate(patternKey) : move.targeting.kind;
      const range = rangeLabel(move);
      const patternLine = el("div", "mt-line");
      patternLine.textContent = range
        ? `${patternName}  ${config.translate("move.range", { value: range })}`
        : patternName;
      root.append(patternLine);

      for (const line of tagLines(move, config)) {
        const node = el("div", "mt-line");
        node.textContent = line;
        root.append(node);
      }

      if (blockedTag) {
        const blocked = el("div", "mt-line mt-blocked");
        blocked.textContent = config.translate(BLOCKED_TAG_KEY[blockedTag]);
        root.append(blocked);
      }

      root.append(
        renderGrid(buildPatternPreview(move.targeting, selfPreviewRadius(move)), moveIntent(move)),
      );
      root.hidden = false;
    },
    hide: () => {
      root.hidden = true;
      root.replaceChildren();
    },
  };
}
