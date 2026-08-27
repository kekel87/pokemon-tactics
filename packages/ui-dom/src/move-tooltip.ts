import type { FieldTerrain, MoveDefinition } from "@pokemon-tactic/core";
import {
  AttackStatSource,
  CallMoveSourceKind,
  ChargeReaction,
  CT_TEMPO_MAX,
  EffectKind,
  EffectTarget,
  StatusType,
  TargetingKind,
} from "@pokemon-tactic/core";
import { getTypeName } from "@pokemon-tactic/data";
import type { AttackSubmenuMoveView } from "@pokemon-tactic/render-ports";
import {
  type BlockedMoveTag,
  type MoveIntent,
  moveIntent,
  selfPreviewRadius,
} from "@pokemon-tactic/view-core";
import { createChip } from "./chip.js";
import type { UiDomConfig } from "./config.js";
import { el } from "./dom-helpers.js";
import { buildPatternPreview, type PatternCell } from "./pattern-preview.js";
import { createTypeChip } from "./type-chip.js";

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
  /** Takes the whole submenu view-model (plan 178): the tooltip also reads its CT cost + tempo. */
  show(move: AttackSubmenuMoveView): void;
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

/**
 * All localised tag lines for a move. Exported for unit testing: this is the plan's real logic
 * (which mechanical facts a move advertises), and it is pure — no DOM, so it runs in the node test
 * environment while the rendered result is covered e2e.
 */
export function tagLines(move: MoveDefinition, config: UiDomConfig): string[] {
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
    } else if (effect.kind === EffectKind.MarkDefenseCurl) {
      keys.push("moveTooltip.tag.markDefenseCurl");
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
  // Self-KO family (plan 147) — three distinct rules, none of which had a tag before plan 178.
  // `isExplosion` is the only one Moiteur (damp) can cancel, so it gets its own wording.
  if (move.isExplosion === true) {
    keys.push("moveTooltip.tag.selfKoExplosion");
  } else if (move.selfKo === true) {
    keys.push("moveTooltip.tag.selfKo");
  } else if (move.selfKoOnConnect === true) {
    keys.push("moveTooltip.tag.selfKoOnConnect");
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
        type: getTypeName(against, config.getLanguage()),
      }),
    );
  }
  // Recoil / drain carry a fraction, so they are built here rather than pushed as bare keys.
  // "Contrecoup" deliberately, not "recul": that word already means the knockback ejection, and
  // `crashOnMiss` ("Recul si échec") can show on the same move (plan 178).
  for (const effect of move.effects) {
    if (effect.kind === EffectKind.Recoil) {
      lines.push(
        config.translate(
          effect.ofMaxHp === true
            ? "moveTooltip.tag.recoilMaxHp"
            : "moveTooltip.tag.recoilFraction",
          { percent: toPercent(effect.fraction) },
        ),
      );
    } else if (effect.kind === EffectKind.Drain) {
      lines.push(
        config.translate("moveTooltip.tag.drain", { percent: toPercent(effect.fraction) }),
      );
    }
  }
  return lines;
}

/** A `0..1` effect fraction as a whole percentage (1/3 → 33), for the recoil / drain tags. */
function toPercent(fraction: number): number {
  return Math.round(fraction * 100);
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

/** One `Label value` cell of the numbers row — label bold, value regular (human 2026-08-03). */
function statCell(label: string, value: string, effective?: number): HTMLElement {
  const cell = el("span", "mt-stat");
  const name = el("span", "mt-stat-label");
  name.textContent = label;
  const figure = el("span", "mt-stat-value");
  figure.textContent = value;
  cell.append(name, figure);
  if (effective === undefined) {
    return cell;
  }
  /*
   * Valeur du contexte (plan 192) : la fiche reste lisible mais barrée, l'effective prend la place
   * du chiffre qui compte. Deux éléments plutôt qu'un texte « 90 → 135 » pour que le style puisse
   * distinguer les deux, et pour que le lecteur voie d'un coup lequel s'applique.
   */
  figure.classList.add("mt-stat-superseded");
  const actual = el("span", "mt-stat-value", "mt-stat-effective");
  actual.textContent = String(effective);
  actual.dataset.tone = effective > Number(value) ? "buff" : "danger";
  cell.append(actual);
  return cell;
}

export function createMoveTooltip(config: UiDomConfig): MoveTooltip {
  const root = el("div", "mt-tooltip", "move-tooltip");
  root.hidden = true;

  return {
    element: root,
    show: (view: AttackSubmenuMoveView) => {
      const move = view.definition;
      const blockedTag = view.blockedTag;
      root.replaceChildren();

      // Layout (reworked in human-testing, 2026-08-03): the first pass stacked one line per fact and
      // split the pattern from its own grid, which read as noise and ate vertical space. Now three
      // bands — identity, numbers, then targeting with the grid BESIDE its name — and the qualitative
      // rows (effect, tags) last.

      // Left column — identity then the numbers, one fact per line so the values align vertically.
      const main = el("div", "mt-main");

      main.append(
        createTypeChip(move.type, getTypeName(move.type, config.getLanguage()), {
          iconUrl: config.getTypeIconUrl(move.type),
        }),
      );

      // Category NAMED, not icon-only: the pictogram alone left the player guessing physique/spécial.
      const categoryRow = el("div", "mt-category-row");
      const category = el("img", "mt-category");
      category.alt = "";
      category.loading = "lazy";
      category.decoding = "async";
      category.src = config.getCategoryIconUrl(move.category);
      const categoryName = el("span");
      categoryName.textContent = config.translate(`moveCategory.${move.category}`);
      categoryRow.append(category, categoryName);
      main.append(categoryRow);

      const stats = el("div", "mt-stats", "move-tooltip-stats");
      const contextual = view.contextual;
      stats.append(
        statCell(
          config.translate("move.power.label"),
          move.power > 0 ? `${move.power}` : "—",
          contextual?.power?.effective,
        ),
        statCell(
          config.translate("move.accuracy.label"),
          move.accuracy > 0 ? `${move.accuracy}` : "—",
          contextual?.accuracy?.effective,
        ),
      );
      // CT: pips coloured by weight (light → green, heavy → red, same language as the move row's
      // gauge) then the raw figure the 5-step gauge compresses.
      const ctCell = el("div", "mt-stat", "move-tooltip-ct");
      const ctLabel = el("span", "mt-stat-label");
      ctLabel.textContent = config.translate("move.ctCost.label");
      const tempo = el("span", "mt-ct-tempo");
      tempo.dataset.tempo = String(view.costTempo);
      tempo.textContent =
        "●".repeat(view.costTempo) + "○".repeat(Math.max(0, CT_TEMPO_MAX - view.costTempo));
      tempo.setAttribute("aria-hidden", "true");
      const ctValue = el("span", "mt-stat-value");
      ctValue.textContent = String(view.ctCost);
      // Chiffre AVANT les pastilles (humain 2026-08-03) : la valeur s'aligne alors avec celles de
      // Puis/Préc au-dessus, et la jauge se lit comme sa qualification.
      ctCell.append(ctLabel, ctValue, tempo);
      stats.append(ctCell);
      main.append(stats);

      /*
       * Pourquoi les chiffres diffèrent, et la brûlure (plan 192).
       *
       * La brûlure est annoncée en clair au lieu d'être pliée dans la puissance : elle divise la
       * statistique d'Attaque du lanceur, pas la puissance du move — écrire « Puis 100 → 50 »
       * mentirait sur la grandeur concernée. Elle vaut quand même sa mention ici parce qu'elle
       * change le classement entre un move physique et un move spécial.
       */
      if (contextual !== null) {
        const notes: string[] = [];
        if (contextual.causes.length > 0) {
          notes.push(
            `${config.translate("moveContext.effective")} : ${contextual.causes.join(", ")}`,
          );
        }
        if (contextual.burnHalvesDamage) {
          notes.push(config.translate("moveContext.burnHalves"));
        }
        if (notes.length > 0) {
          const context = el("div", "mt-context");
          context.textContent = notes.join(" · ");
          main.append(context);
        }
      }

      // Right column — the pattern grid fills the space the text column leaves empty (layout B,
      // human 2026-08-03), so it costs no vertical band of its own; its name sits right under it.
      const patternKey = PATTERN_TRANSLATION_KEY[move.targeting.kind];
      const patternName = patternKey ? config.translate(patternKey) : move.targeting.kind;
      const range = rangeLabel(move);
      const gridColumn = el("div", "mt-gridcol");
      gridColumn.append(
        renderGrid(buildPatternPreview(move.targeting, selfPreviewRadius(move)), moveIntent(move)),
      );
      const patternLabel = el("span", "mt-pattern-name");
      patternLabel.textContent = patternName;
      gridColumn.append(patternLabel);
      if (range) {
        const rangeLine = el("span", "mt-pattern-range");
        rangeLine.textContent = config.translate("move.range", { value: range });
        gridColumn.append(rangeLine);
      }

      const body = el("div", "mt-body");
      body.append(main, gridColumn);
      root.append(body);

      // Secondary effect (plan 178): the confirm-phase forecast already showed it, but only AFTER
      // committing to a move and clicking a target — so it was invisible while choosing.
      if (view.effectChip) {
        const effect = el("div", "mt-line mt-effect", "move-tooltip-effect");
        effect.append(createChip(view.effectChip, "mt"));
        root.append(effect);
      }

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

      root.hidden = false;
    },
    hide: () => {
      root.hidden = true;
      root.replaceChildren();
    },
  };
}
