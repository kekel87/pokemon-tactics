import type { CasterMoveContext, MoveDefinition } from "@pokemon-tactic/core";
import { getMoveName } from "@pokemon-tactic/data";
import type { MoveContextualView, PresentationContext } from "@pokemon-tactic/render-ports";

/**
 * Valeurs d'un move corrigées par le contexte du LANCEUR, pour l'infobulle d'attaque (plan 192).
 *
 * L'infobulle est consultée au survol, donc **avant** tout choix de cible : elle ne peut afficher
 * que ce qui ne dépend pas de la cible. C'est précisément le clivage qui rend ce périmètre tenable,
 * là où l'« efficacité contextuelle par move » avait été abandonnée le 2026-08-03 parce qu'elle
 * exigeait d'inventer une cible de référence.
 *
 * Le calcul lui-même vit dans le core (`resolveCasterMoveContext`), partagé avec la prévision de
 * dégâts — cette fonction ne fait que le mettre en mots.
 */
export function buildMoveContextualView(
  context: PresentationContext,
  caster: CasterMoveContext | null,
  definition: MoveDefinition,
): MoveContextualView | null {
  if (caster === null) {
    return null;
  }

  const basePower = definition.power;
  const effectivePower =
    basePower > 0
      ? Math.round(
          caster.resolvedMove.power *
            caster.weatherBpMultiplier *
            caster.fieldTerrainBpMultiplier *
            caster.helpingHandMultiplier,
        )
      : 0;

  const baseAccuracy = definition.accuracy;
  const effectiveAccuracy = caster.weatherAccuracyOverride ?? baseAccuracy;

  // Chaque cause sur la grandeur qu'elle change (plan 227). La météo seule peut toucher l'une, l'autre
  // ou les deux ; le reste ne corrige que la puissance.
  const powerCauses = caster.causes.filter(
    (cause) => cause.kind !== "weather" || caster.weatherBpMultiplier !== 1,
  );
  const accuracyCauses = caster.causes.filter(
    (cause) => cause.kind === "weather" && caster.weatherAccuracyOverride !== undefined,
  );
  const power =
    basePower > 0 && effectivePower !== basePower
      ? {
          base: basePower,
          effective: effectivePower,
          causes: powerCauses.map((cause) => describeCause(context, cause)),
        }
      : null;
  const accuracy =
    baseAccuracy > 0 && effectiveAccuracy !== baseAccuracy
      ? {
          base: baseAccuracy,
          effective: effectiveAccuracy,
          causes: accuracyCauses.map((cause) => describeCause(context, cause)),
        }
      : null;

  // Rien à dire : ni chiffre corrigé, ni brûlure. Null plutôt qu'une vue vide, pour que le chrome
  // n'ait aucune ligne à décider de masquer.
  if (power === null && accuracy === null && !caster.burnHalvesDamage) {
    return null;
  }

  return {
    power,
    accuracy,
    burnHalvesDamage: caster.burnHalvesDamage,
  };
}

function describeCause(
  context: PresentationContext,
  cause: CasterMoveContext["causes"][number],
): string {
  switch (cause.kind) {
    case "weather":
      return context.translate(`weather.${cause.weather}`);
    case "field-terrain":
      return context.translate(`battleLog.fieldTerrain.${cause.terrain}`);
    case "helping-hand":
      return context.translate("moveContext.helpingHand");
    case "charge":
      return context.translate("moveContext.charge");
    case "move-morph":
      return getMoveName(cause.resolvedMoveId, context.getLanguage());
  }
}
