import { AURA_RADIUS } from "../battle/aura-system";
import type { BattleEngine } from "../battle/BattleEngine";
import { computeMoveCost } from "../battle/ct-costs";
import { DISTORTION_RADIUS, isInDistortionZone } from "../battle/distortion-system";
import { getEffectivePowerFloor } from "../battle/dynamic-power-system";
import { effectiveAbilityId } from "../battle/effective-ability";
import { effectiveBaseSpeed } from "../battle/effective-base-speed";
import { effectiveCombatStats } from "../battle/effective-combat-stats";
import { isEffectivelyFlying } from "../battle/effective-flying";
import { effectiveGender } from "../battle/effective-gender";
import { effectiveMoveIds } from "../battle/effective-move-ids";
import { HAZARD_REMOVAL_RADIUS, maxLayersFor } from "../battle/entry-hazard-system";
import { FacingZone, getFacingZone } from "../battle/facing-modifier";
import { FIELD_GLOBAL_RADIUS, isInFieldGlobalZone } from "../battle/field-global-system";
import { FIELD_TERRAIN_RADIUS, getFieldTerrainAt } from "../battle/field-terrain-system";
import { TRANSFERABLE_STATS } from "../battle/handlers/baton-pass-stats";
import { ohkoAccuracy } from "../battle/ohko";
import { isTerrainImmune } from "../battle/terrain-effects";
import { ActionKind } from "../enums/action-kind";
import { AuraKind } from "../enums/aura-kind";
import { CallMoveSourceKind } from "../enums/call-move-source-kind";
import { ChargeReaction } from "../enums/charge-reaction";
import { DynamicPowerKind } from "../enums/dynamic-power-kind";
import { EffectKind } from "../enums/effect-kind";
import { EffectTarget } from "../enums/effect-target";
import type { EntryHazardKind } from "../enums/entry-hazard-kind";
import { FieldGlobalKind } from "../enums/field-global-kind";
import { FieldTerrain } from "../enums/field-terrain";
import { HeldItemId } from "../enums/held-item-id";
import { PokemonGender } from "../enums/pokemon-gender";
import { PokemonType } from "../enums/pokemon-type";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { TargetingKind } from "../enums/targeting-kind";
import { TerrainType } from "../enums/terrain-type";
import type { Action } from "../types/action";
import type { AiProfile } from "../types/ai-profile";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { TargetingPattern } from "../types/targeting-pattern";
import { directionFromTo, getPerpendicularOffsets, stepInDirection } from "../utils/direction";
import { manhattanDistance } from "../utils/manhattan-distance";
import { getMoveMaxReach } from "./move-reach";
import {
  abilityCopyValue,
  abilityNeutralizeValue,
  anyEnemyCanStrike,
  anyEnemyPhysicalStriker,
  bestEnemyDamageAgainst,
  bestGroundThreatFraction,
  enemyHasStatDecreaseMoveInRange,
  enemyHasStatusMoveInRange,
  highestThreatEnemy,
  isHealthyTarget,
  isImmuneToMoveType,
  lastMoveIsLowValue,
  lastMoveIsThreat,
  occupantAt,
  statusMoveRatio,
  survivesLethalHit,
  wouldKoUs,
} from "./threat-detection";

const DANGEROUS_TERRAINS: ReadonlySet<TerrainType> = new Set([
  TerrainType.Magma,
  TerrainType.Lava,
  TerrainType.Swamp,
]);
const DANGEROUS_TERRAIN_PENALTY = 8;

/**
 * Objets à fort impact tactique dont la manipulation (Sabotage / Tour de Magie / Passe-Passe / Gaz
 * Corrosif) vaut nettement plus que la moyenne (heuristique fine plan 142). Priver l'ennemi d'un objet
 * de survie (Ceinture Force, Bandana), d'un item Choix, d'un boost offensif (Orbe Vie) ou de sustain
 * (Restes) change réellement l'échange ; les catch-all « toute baie » (`-berry`, réactif/consommable)
 * comptent aussi. Les objets passifs stat-sticks (Charbon, Cape Noire…) restent au bonus générique.
 */
const HIGH_VALUE_MANIP_TARGET_ITEMS: ReadonlySet<HeldItemId> = new Set([
  HeldItemId.FocusSash,
  HeldItemId.FocusBand,
  HeldItemId.Leftovers,
  HeldItemId.BlackSludge,
  HeldItemId.LifeOrb,
  HeldItemId.ChoiceBand,
  HeldItemId.ChoiceSpecs,
  HeldItemId.ChoiceScarf,
  HeldItemId.AssaultVest,
  HeldItemId.Eviolite,
  HeldItemId.ToxicOrb,
  HeldItemId.FlameOrb,
]);
const HIGH_VALUE_MANIP_MULTIPLIER = 2;

/** True si retirer/échanger cet objet à l'ennemi a une valeur tactique supérieure à la moyenne. */
function isHighValueManipTarget(itemId: HeldItemId): boolean {
  return HIGH_VALUE_MANIP_TARGET_ITEMS.has(itemId) || itemId.endsWith("-berry");
}

/**
 * CT-aware scoring (plan 165). Coût CT de référence = coût minimum d'un move (500). Le facteur tempo
 * `min(1, CT_REFERENCE_COST / ctCost)` pénalise les moves lents (cost > 500) sans jamais bonifier les
 * rapides (pas d'inflation de score). Appliqué au chemin générique de dégâts/statut de `scoreUseMove`,
 * SAUF quand le move sécurise un KO (dégât direct ou ring-out létal) : un KO retire une menace
 * définitivement (step-change) et garde sa pleine valeur quel que soit le coût. `damageScore × factor`
 * reste ∝ dégâts-par-CT — les gros moves ne sont pas injustement pénalisés (leurs dégâts supérieurs sont
 * déjà dans `damageScore`).
 */
const CT_REFERENCE_COST = 500;

/**
 * Applique le facteur tempo CT au score d'un move offensif générique. Les scores nuls/négatifs (friendly
 * fire, garde-fous) et les moves qui sécurisent un KO ne sont jamais re-scalés. Voir `CT_REFERENCE_COST`.
 */
function applyCtWeight(score: number, securesKo: boolean, move: MoveDefinition): number {
  if (securesKo || score <= 0) {
    return score;
  }
  const ctCost = computeMoveCost(move.pp, move.power, move.effectTier);
  const ctFactor = Math.min(1, CT_REFERENCE_COST / ctCost);
  return score * ctFactor;
}

/** Les 5 crans de stats de combat (hors Précision / Esquive) — base des heuristiques buff/setup. */
const BATTLE_STAT_STAGES: readonly StatName[] = [
  StatName.Attack,
  StatName.Defense,
  StatName.SpAttack,
  StatName.SpDefense,
  StatName.Speed,
];

/**
 * CT "tours du lanceur": weather / field / barrier durations count down on the setter's OWN turns,
 * so a slower setter makes its effect last longer in wall-clock — its setup is worth more. Maps base
 * Speed (~30..130) to a multiplier of 2.0 (very slow) .. 1.0 (very fast), clamped at the ends.
 */
function setterDurabilityMultiplier(setter: PokemonInstance): number {
  const t = Math.max(0, Math.min(1, (setter.baseStats.speed - 30) / 100));
  return 2 - t;
}

export function scoreAction(
  action: Action,
  state: BattleState,
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  profile: AiProfile,
): number {
  const currentPokemonId = state.activePokemonId;
  const currentPokemon = currentPokemonId ? state.pokemon.get(currentPokemonId) : undefined;
  if (!currentPokemon) {
    return 0;
  }

  const enemies = getAliveEnemies(state, currentPokemon);
  const allies = getAliveAllies(state, currentPokemon);

  switch (action.kind) {
    case ActionKind.UseMove:
      return scoreUseMove(
        action,
        currentPokemon,
        enemies,
        allies,
        moveRegistry,
        engine,
        profile,
        state,
      );
    case ActionKind.Move:
      return scoreMove(action, currentPokemon, enemies, moveRegistry, engine, profile);
    case ActionKind.EndTurn:
      return scoreEndTurn(action, currentPokemon, enemies);
    case ActionKind.UndoMove:
      return 0;
  }
}

function scoreUseMove(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  currentPokemon: PokemonInstance,
  enemies: PokemonInstance[],
  allies: PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  profile: AiProfile,
  state: BattleState,
): number {
  const move = moveRegistry.get(action.moveId);
  if (!move) {
    return 0;
  }

  const weights = profile.scoringWeights;
  const isSelfTargeting = move.targeting.kind === TargetingKind.Self;
  const hasDamageFloor = getEffectivePowerFloor(move) > 0;

  // Cognobidon guard-rail (belly-drum, plan 154): value it only at high HP with a low Attack stage;
  // hard negative when it would fail (HP ≤ 50% or Attack maxed) so the AI never suicides. Fine
  // valuation (win-condition behind a wall) deferred to the grouped AI pass.
  if (move.effects.some((effect) => effect.kind === EffectKind.BellyDrum)) {
    return scoreBellyDrum(currentPokemon, enemies, engine, weights);
  }

  // Par Ici / Poudre Fureur (draw-attention, plan 155): guard-rail only — worthless with no enemy in
  // range to pivot, otherwise a small score scaled by the number of enemies exposed. Fine valuation
  // (setting up an ally's backstab) is deferred to the grouped AI pass.
  const drawAttention = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.DrawAttention }> =>
      effect.kind === EffectKind.DrawAttention,
  );
  if (drawAttention !== undefined) {
    return scoreDrawAttention(
      currentPokemon,
      enemies,
      allies,
      drawAttention.radius,
      moveRegistry,
      weights,
    );
  }

  // Malédiction (curse, plan 154 ; heuristique fine plan 159) : ciblage conditionnel par type du
  // lanceur. Spectre → DoT illimité sur un ennemi (rentable sur cible en forme, dangereux à bas PV) ;
  // non-Spectre → self-buff sans coût.
  if (move.effects.some((effect) => effect.kind === EffectKind.Curse)) {
    return scoreCurse(action, currentPokemon, enemies, engine, weights);
  }

  // Move-copy (Métronome / Blabla Dodo / Mimique / Photocopie, plan 144) : effects vides → scorés 0.
  // Valorisation minimale + garde-fous (Blabla Dodo hors sommeil, fizzle sans move-source).
  if (move.callMove !== undefined) {
    return scoreCallMove(move, currentPokemon, enemies, weights);
  }

  // Vent Arrière (tailwind, plan 145) : ciblage GroundTarget → le chemin générique le rejetait (-1).
  if (move.effects.some((effect) => effect.kind === EffectKind.SetTailwind)) {
    return scoreTailwind(currentPokemon, allies, state, weights);
  }

  // Manip talent (Soucigraine / Suc Digestif / Imitation / Échange, plan 153) : Statuts sans branche →
  // scorés 0. Valoriser selon le talent effectif de la cible.
  const abilityManip = move.effects.find(
    (effect) =>
      effect.kind === EffectKind.SetAbility ||
      effect.kind === EffectKind.SuppressAbility ||
      effect.kind === EffectKind.CopyAbility ||
      effect.kind === EffectKind.SwapAbility,
  );
  if (abilityManip !== undefined) {
    return scoreAbilityManip(action, currentPokemon, enemies, abilityManip.kind, engine, weights);
  }

  // Bâillement (yawn, plan 154) : sommeil différé sur un ennemi.
  if (move.effects.some((effect) => effect.kind === EffectKind.Yawn)) {
    return scoreYawn(action, currentPokemon, enemies, engine, weights);
  }

  // Acupression (acupressure, plan 154) : +2 stat aléatoire self/allié — intercepter AVANT le routage
  // targetsAllyOrSelf (le self-cast y était mal scoré -1).
  if (move.effects.some((effect) => effect.kind === EffectKind.RaiseRandomStat)) {
    return scoreAcupressure(action, currentPokemon, allies, state, weights);
  }

  // Après Vous / Interversion (after-you / ally-switch, plan 155) : moves alliés sans branche → scorés 0.
  // Intercepter AVANT le routage targetsAlly générique.
  if (move.effects.some((effect) => effect.kind === EffectKind.ActAfterUser)) {
    return scoreAfterYou(action, currentPokemon, allies, enemies, moveRegistry, engine, weights);
  }
  if (move.effects.some((effect) => effect.kind === EffectKind.SwapAllyPositions)) {
    return scoreAllySwitch(action, currentPokemon, allies, enemies, engine, weights);
  }

  // Tout ou Rien (final-gambit, plan 147) : dégâts = PV du lanceur × efficacité, self-KO à la connexion.
  if (move.effects.some((effect) => effect.kind === EffectKind.FinalGambit)) {
    return scoreFinalGambit(action, currentPokemon, enemies, engine, weights);
  }

  // Vœu Soin (healing-wish → ReviveOrHeal, plan 147) : cible une tuile alliée (KO → revive, blessé →
  // soin) + self-KO. Le chemin générique le rejetait (tuile alliée / allié KO invisibles).
  const reviveOrHeal = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.ReviveOrHeal }> =>
      effect.kind === EffectKind.ReviveOrHeal,
  );
  if (reviveOrHeal !== undefined) {
    return scoreReviveOrHeal(action, currentPokemon, state, reviveOrHeal.revivePercent, weights);
  }

  // Souvenir (memento, plan 147) : self-KO + Atq/Atq Spé cible −2. Le générique ignore le coût de suicide.
  // (Vœu Soin, aussi selfKo, est déjà intercepté ci-dessus.)
  if (move.selfKo === true) {
    return scoreMemento(action, currentPokemon, enemies, engine, weights);
  }

  // Croc Fatal (super-fang → HalveTargetHp, plan 152) : dégâts fixes ⌊PV/2⌋, pas de power floor → 0.
  if (move.effects.some((effect) => effect.kind === EffectKind.HalveTargetHp)) {
    return scoreHalveTargetHp(action, currentPokemon, enemies, engine, weights);
  }

  // Explosion / Destruction / Explo-Brume (isExplosion, plan 147) : le générique compte les KO mais
  // jamais le suicide du lanceur.
  if (move.isExplosion === true) {
    return scoreExplosion(action, currentPokemon, enemies, allies, move, engine, weights);
  }

  // Vol Magnétik (magnet-rise, plan 154) : lévitation temporaire — ne vaut que face à une menace Sol.
  if (move.effects.some((effect) => effect.kind === EffectKind.MagnetRise)) {
    return scoreMagnetRise(currentPokemon, enemies, engine, moveRegistry, weights);
  }

  // Lien du Destin / Rancune (destiny-bond / grudge, plan 147) : outils de désespoir — ne valent que si
  // un ennemi peut nous mettre KO ce tour.
  if (
    move.effects.some(
      (effect) =>
        effect.kind === EffectKind.PostDestinyBond || effect.kind === EffectKind.PostGrudge,
    )
  ) {
    return scoreDestinyBondGrudge(currentPokemon, enemies, engine, weights);
  }

  // Field global (Gravité / Zone Étrange / Zone Magique → PostFieldGlobal, plan 145) : zone diamant r3.
  const fieldGlobal = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.PostFieldGlobal }> =>
      effect.kind === EffectKind.PostFieldGlobal,
  );
  if (fieldGlobal !== undefined) {
    return scorePostFieldGlobal(
      currentPokemon,
      enemies,
      fieldGlobal.fieldGlobalKind,
      state,
      engine,
      weights,
    );
  }

  // Buée Noire (haze → ResetStatStages zone, plan 146 ; heuristique fine plan 161) : reset team-agnostic
  // d'un diamant r3. Le chemin générique le voyait comme un move sans effet (0). Rentable quand on
  // efface plus de crans positifs ennemis (+ nos crans négatifs) qu'on ne perd des nôtres.
  const resetZone = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.ResetStatStages }> =>
      effect.kind === EffectKind.ResetStatStages && effect.area !== undefined,
  );
  if (resetZone?.area !== undefined) {
    return scoreHazeReset(currentPokemon, resetZone.area.radius, state, weights);
  }

  if (isSelfTargeting && !hasDamageFloor) {
    return scoreSelfMove(currentPokemon, enemies, move, moveRegistry, weights, state);
  }

  if (move.targetsAlly === true || move.targetsAllyOrSelf === true) {
    return scoreAllyTargetMove(action, currentPokemon, allies, move, weights);
  }

  // Targeted heal (heal-pulse): heal a wounded ally; never waste it on a full ally or an enemy.
  const targetedHeal = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.HealTarget }> =>
      effect.kind === EffectKind.HealTarget && effect.radius === undefined,
  );
  if (!hasDamageFloor && targetedHeal !== undefined) {
    return scoreTargetedHeal(action, allies, enemies, targetedHeal.percent, weights);
  }

  const hazardSetter = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.PostEntryHazard }> =>
      effect.kind === EffectKind.PostEntryHazard,
  );
  if (hazardSetter !== undefined) {
    return scoreEntryHazardSetter(action, enemies, allies, hazardSetter.hazardKind, weights, state);
  }

  // Balance (pain-split) / Effort (endeavor): HP manipulation, no power floor. Both shine when the
  // caster is low and the target is high — Balance steals HP, Effort chips the target down hard.
  const isHpManipulation = move.effects.some(
    (effect) => effect.kind === EffectKind.PainSplit || effect.kind === EffectKind.Endeavor,
  );
  if (isHpManipulation) {
    return scoreHpManipulation(action, currentPokemon, enemies, weights);
  }

  // Stat-manip (plan 146 ; heuristique fine plan 161) : Boost copie / Renversement inverse / Permu*
  // échange les crans d'un ennemi. Sans power floor ni StatChange, le chemin générique les scorait 0.
  // Valoriser le gain net quand la manip favorise le lanceur, malus quand elle avantage la cible.
  const hasStatManip = move.effects.some(
    (effect) =>
      effect.kind === EffectKind.CopyStatStages ||
      effect.kind === EffectKind.InvertStatStages ||
      effect.kind === EffectKind.SwapStatStages ||
      effect.kind === EffectKind.SwapRawSpeed,
  );
  if (hasStatManip) {
    return scoreStatManip(action, currentPokemon, enemies, move, engine, weights);
  }

  // OHKO guard-rail (plan 148): one-hit-KO moves carry no power floor → the generic damage path scores
  // them ~0 and the AI would never play them. Give a minimal valuation (accuracy × kill value, favouring
  // high-HP targets) and a hard negative on immune targets so the AI never plays into Fermeté / a type
  // or Ice immunity. Fine heuristics (setup denial, threat assessment) are deferred.
  if (move.isOhko === true) {
    return scoreOhko(action, currentPokemon, enemies, allies, move, engine, weights);
  }

  // Morphing garde-fou (transform, plan 157, #657): the move carries no power floor and matches no
  // status branch → the generic path scores it 0, so on a tie-break the AI could spend the heaviest
  // CT tier (900) to copy a WEAKER mon. Value it only when the target's combat-stat total clearly
  // beats the caster's; otherwise a hard negative excludes it. Fine heuristics (threat/setup denial)
  // are deferred.
  const isTransform = move.effects.some((effect) => effect.kind === EffectKind.Transform);
  if (isTransform) {
    return scoreTransformApplication(action, currentPokemon, enemies, engine, weights);
  }

  const affectedTiles = estimateAffectedTiles(
    move.targeting,
    currentPokemon.position,
    action.targetPosition,
  );
  const targetsHit = enemies.filter((enemy) => isOnTiles(enemy.position, affectedTiles));
  const alliesHit = allies.filter((ally) => isOnTiles(ally.position, affectedTiles));

  if (targetsHit.length === 0) {
    return -1;
  }

  // Coup Bas guard-rail (sucker-punch, plan 150): the move fizzles (0 damage, CT paid) unless a hit
  // target's LAST action was offensive. Exclude it when no target satisfies the freshness gate so the
  // AI never throws the turn away. Fine valuation (punishing an identified attacker) is deferred.
  if (move.failsUnlessTargetAggressive === true) {
    const anyAggressive = targetsHit.some(
      (target) =>
        target.lastActedAtAction !== undefined &&
        target.lastOffensiveActionAtAction === target.lastActedAtAction,
    );
    if (!anyAggressive) {
      return -1;
    }
  }

  // Attraction guard-rail (attract, plan 154): fails on same-gender / genderless / already-infatuated
  // targets. Exclude it when no hit target is a valid infatuation candidate so the AI never wastes the
  // turn. Fine valuation (infatuate an identified sweeper) deferred.
  if (move.effects.some((effect) => effect.kind === EffectKind.Attract)) {
    const casterGender = effectiveGender(currentPokemon);
    const anyValid = targetsHit.some(
      (target) =>
        casterGender !== PokemonGender.Genderless &&
        effectiveGender(target) !== PokemonGender.Genderless &&
        effectiveGender(target) !== casterGender &&
        !target.volatileStatuses.some((volatile) => volatile.type === StatusType.Infatuated),
    );
    if (!anyValid) {
      return -1;
    }
  }

  let score = 0;

  // CT-aware (plan 165) : un move qui sécurise un KO (dégât direct OU ring-out létal) garde sa pleine
  // valeur, jamais divisée par le facteur tempo. Voir `applyCtWeight`.
  let securesKo = false;

  let damageScore = 0;
  if (getEffectivePowerFloor(move) > 0) {
    const damage = scoreDamagingMove(currentPokemon, targetsHit, move, engine, weights);
    damageScore = damage.score;
    securesKo = damage.securesKo;
  }

  // Charge-réaction (Mitra-Poing / Bec-Canon / Carapiège, plan 150) : le générique voyait la pleine
  // puissance sans modéliser le risque d'interruption. Carapiège ne part QUE si un ennemi nous frappe
  // physiquement pendant la charge → tour gâché sinon (gate dur). Sinon décote/bonus selon l'agresseur.
  if (
    move.chargeReaction === ChargeReaction.Shell &&
    !anyEnemyPhysicalStriker(enemies, currentPokemon, moveRegistry)
  ) {
    return -1;
  }
  if (move.chargeReaction !== undefined) {
    damageScore = scoreChargeReaction(
      move,
      currentPokemon,
      enemies,
      damageScore,
      moveRegistry,
      weights,
    );
  }

  // Poursuite (pursuit, plan 152) : ×2 dans le dos, invisible pour estimateDamage (1.15 universel seul).
  if (move.pursuitBackstab === true) {
    damageScore += scorePursuitBackstab(
      currentPokemon,
      targetsHit,
      enemies,
      action.moveId,
      engine,
      weights,
    );
  }

  score += damageScore;

  if (alliesHit.length > 0) {
    score -= weights.killPotential * 0.3 * alliesHit.length;
  }

  const hasEnemyDebuff = move.effects.some(
    (effect) =>
      effect.kind === EffectKind.StatChange &&
      effect.target === EffectTarget.Targets &&
      effect.stages < 0,
  );
  const hasStatus = move.effects.some((effect) => effect.kind === EffectKind.Status);
  const isFlinchApplication = move.effects.some(
    (effect) =>
      effect.kind === EffectKind.Status &&
      "status" in effect &&
      effect.status === StatusType.Flinch,
  );
  const isTauntApplication = move.effects.some(
    (effect) =>
      effect.kind === EffectKind.Status &&
      "status" in effect &&
      effect.status === StatusType.Taunted,
  );
  const isDisableApplication = move.effects.some((effect) => effect.kind === EffectKind.Disable);
  const isEncoreApplication = move.effects.some((effect) => effect.kind === EffectKind.Encore);
  const isSpiteApplication = move.effects.some((effect) => effect.kind === EffectKind.SpiteCtTax);

  if (hasEnemyDebuff) {
    score += weights.statChanges * 1.5;
  }
  if (isDisableApplication) {
    score += scoreDisableApplication(targetsHit, moveRegistry, weights);
  } else if (isEncoreApplication) {
    score += scoreEncoreApplication(targetsHit, moveRegistry, weights);
  } else if (isTauntApplication) {
    score += scoreTauntApplication(targetsHit, moveRegistry, weights);
  } else if (isSpiteApplication) {
    score += scoreSpiteApplication(targetsHit, weights, state);
  } else if (isFlinchApplication) {
    // Bluff (fake-out, plan 150) : le flinch ne vaut que s'il prive la menace n°1 de son tour.
    score += scoreFlinch(targetsHit, enemies, currentPokemon, engine, weights);
  } else if (hasStatus) {
    score += weights.statChanges;
  }

  // Coup Bas (sucker-punch, plan 150) : après le garde-fou de fraîcheur, frapper préemptivement la
  // menace n°1 agressive vaut cher (surtout si elle peut nous mettre KO).
  if (move.failsUnlessTargetAggressive === true) {
    score += scoreSuckerPunchDenial(targetsHit, enemies, currentPokemon, engine, weights);
  }

  // Ruse (feint, plan 152) : bypassProtect ne vaut que contre une cible protégée.
  if (move.bypassProtect === true) {
    for (const target of targetsHit) {
      if (target.activeDefense !== null) {
        score += weights.typeAdvantage;
      }
    }
  }

  // Anti-Air (smack-down, plan 152) : clouer un Volant non encore cloué (retire immunité Sol / annule
  // une esquive en cours) — non valorisé par le seul calcul de dégâts.
  if (move.effects.some((effect) => effect.kind === EffectKind.SmackDown)) {
    score += scoreSmackDown(targetsHit, engine, weights);
  }

  // Lock-in multi-tour (plan 149) : le verrou retire la flexibilité (+ auto-confusion sauf Brouhaha).
  if (move.lockIn !== undefined) {
    score += scoreLockInCommitment(move, targetsHit, enemies, currentPokemon, engine, weights);
  }

  // Ball'Glace (rollout streak, plan 149) : bonus de continuité quand la boule de neige est lancée.
  if (move.dynamicPower?.kind === DynamicPowerKind.RolloutStreak) {
    score += Math.max(0, currentPokemon.rolloutStreak ?? 0) * weights.typeAdvantage * 0.5;
  }

  // Phazing (Cyclone / Hurlement / Projection → PhazeToSpawn, plans 146-147) : éjection vers le spawn =
  // board control + déni de setup (on éloigne un mon boosté / la menace n°1).
  if (move.effects.some((effect) => effect.kind === EffectKind.PhazeToSpawn)) {
    score += scorePhazing(targetsHit, enemies, currentPokemon, engine, weights);
  }

  // Ring-out (plan 159) : un move à recul peut éjecter la cible dans le vide / le terrain létal
  // (« Le Mur »). On prédit l'issue et on crédite un KO par déplacement même quand les dégâts directs
  // ne tuent pas ; on pénalise durement l'éjection fatale d'un allié.
  const knockback = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.Knockback }> =>
      effect.kind === EffectKind.Knockback,
  );
  if (knockback !== undefined) {
    const ringOut = scoreKnockbackRingOut(
      currentPokemon,
      targetsHit,
      alliesHit,
      action.moveId,
      knockback.distance,
      enemies,
      engine,
      weights,
    );
    score += ringOut.score;
    securesKo = securesKo || ringOut.securesLethalKo;
  }

  // Manipulation d'objet (Sabotage / Larcin / Tour de Magie / Passe-Passe / Gaz Corrosif, plan 142) :
  // ne vaut le coup que si la cible porte réellement un objet, pondéré par sa valeur tactique.
  const hasItemManip = move.effects.some(
    (effect) =>
      effect.kind === EffectKind.StealItem ||
      effect.kind === EffectKind.RemoveItem ||
      effect.kind === EffectKind.SwapItems ||
      effect.kind === EffectKind.BurnTargetItem,
  );
  if (hasItemManip) {
    for (const target of targetsHit) {
      if (target.heldItemId !== undefined) {
        // Heuristique fine (plan 142) : priver l'ennemi d'un objet à fort impact (survie / Choix /
        // Orbe Vie / Restes / baie réactive) vaut davantage que virer un stat-stick passif.
        const multiplier = isHighValueManipTarget(target.heldItemId)
          ? HIGH_VALUE_MANIP_MULTIPLIER
          : 1;
        score += weights.statChanges * multiplier;
      }
    }
  }

  // Bain de Smog (clear-smog → ResetStatStages cible, plan 146 ; heuristique fine plan 161) : les dégâts
  // sont déjà scorés ; bonus si la cible perd des crans positifs. (Buée Noire, ResetStatStages en zone,
  // est routée en amont.)
  if (move.effects.some((effect) => effect.kind === EffectKind.ResetStatStages)) {
    for (const target of targetsHit) {
      score += positiveStatStageSum(target) * weights.statChanges * 0.3;
    }
  }

  // Attraction (attract, plan 154 ; heuristique fine plan 161) : le garde-fou de validité est passé plus
  // haut. Attract ne porte pas d'effet Status → aucun crédit générique ; on ne valorise que l'infatuation
  // de la menace n°1 (souvent un sweeper), les autres cibles restent à 0 (valorisation différée).
  if (move.effects.some((effect) => effect.kind === EffectKind.Attract)) {
    const threat = highestThreatEnemy(enemies, currentPokemon, engine);
    if (targetsHit.some((target) => target.id === threat?.id)) {
      score += weights.statChanges * 0.8;
    }
  }

  // Barrage / Regard Noir (block / mean-look → Trapped position-linked, plan trapping ; heuristique fine
  // plan 161) : le statut générique est déjà crédité ; bonus pour épingler la menace n°1 (l'empêcher de
  // se repositionner / fuir), inutile sur une cible déjà piégée.
  const isPureTrap = move.effects.some(
    (effect) =>
      effect.kind === EffectKind.Status &&
      "status" in effect &&
      effect.status === StatusType.Trapped &&
      "positionLinked" in effect &&
      effect.positionLinked === true,
  );
  if (isPureTrap) {
    const threat = highestThreatEnemy(enemies, currentPokemon, engine);
    for (const target of targetsHit) {
      if (target.volatileStatuses.some((volatile) => volatile.type === StatusType.Trapped)) {
        continue;
      }
      if (target.id === threat?.id) {
        score += weights.statChanges;
      }
    }
  }

  return applyCtWeight(score, securesKo, move);
}

/**
 * Malédiction (curse) — heuristique fine (plan 159). Lanceur Spectre : DoT 25%/tour illimité contre un
 * ennemi, rentable sur une cible en forme (PV élevés), dangereux quand nous sommes bas (sacrifice 50%
 * PV max). Lanceur non-Spectre : self-buff sans coût (−1 Vit / +1 Atq / +1 Déf), meilleur loin des
 * ennemis (temps de setup).
 */
function scoreCurse(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  caster: PokemonInstance,
  enemies: readonly PokemonInstance[],
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const isGhost = engine.getPokemonTypes(caster.id).includes(PokemonType.Ghost);
  if (!isGhost) {
    const nearest = closestEnemyManhattanDistance(caster.position, enemies as PokemonInstance[]);
    return nearest > 2 ? weights.statChanges * 2 : weights.statChanges;
  }
  const target = enemies.find(
    (enemy) =>
      enemy.position.x === action.targetPosition.x && enemy.position.y === action.targetPosition.y,
  );
  if (!target) {
    return -1;
  }
  if (caster.currentHp / caster.maxHp <= 0.5) {
    return -1;
  }
  if (!isHealthyTarget(target)) {
    return 0;
  }
  return (target.currentHp / target.maxHp) * weights.killPotential * 0.8;
}

/**
 * Ring-out par recul (plan 159). Par ennemi touché, on prédit le déplacement + glissade + chute : un KO
 * par éjection vaut `killPotential` (× 1.5 si c'est la menace n°1), sinon la chute partielle est
 * créditée au prorata. On saute les cibles déjà tuées par les dégâts directs (déjà comptées) et on
 * pénalise l'éjection fatale d'un allié.
 */
function scoreKnockbackRingOut(
  caster: PokemonInstance,
  targetsHit: readonly PokemonInstance[],
  alliesHit: readonly PokemonInstance[],
  moveId: string,
  distance: number,
  enemies: readonly PokemonInstance[],
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): { score: number; securesLethalKo: boolean } {
  let score = 0;
  let securesLethalKo = false;
  const threat = highestThreatEnemy(enemies, caster, engine);
  for (const target of targetsHit) {
    const outcome = engine.predictKnockback(caster.id, target, distance);
    if (!outcome) {
      continue;
    }
    const direct = engine.estimateDamage(caster.id, moveId, target.id);
    if (direct && direct.min >= target.currentHp) {
      continue;
    }
    if (outcome.lethal) {
      score += weights.killPotential * (threat?.id === target.id ? 1.5 : 1);
      securesLethalKo = true;
    } else {
      score += (outcome.damage / target.maxHp) * weights.killPotential * 0.5;
    }
  }
  for (const ally of alliesHit) {
    const outcome = engine.predictKnockback(caster.id, ally, distance);
    if (outcome?.lethal) {
      score -= weights.killPotential;
    }
  }
  return { score, securesLethalKo };
}

/**
 * Balance (pain-split) / Effort (endeavor): both want a low-HP caster and a high-HP target. Score by
 * the HP gap (target fraction − caster fraction); negative or tiny gaps return ~0 so the AI does not
 * waste the move when it has nothing to gain.
 */
function scoreHpManipulation(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  currentPokemon: PokemonInstance,
  enemies: readonly PokemonInstance[],
  weights: AiProfile["scoringWeights"],
): number {
  const target = enemies.find(
    (enemy) =>
      enemy.position.x === action.targetPosition.x && enemy.position.y === action.targetPosition.y,
  );
  if (!target) {
    return -1;
  }
  const gap = target.currentHp / target.maxHp - currentPokemon.currentHp / currentPokemon.maxHp;
  if (gap <= 0.1) {
    return 0;
  }
  return gap * weights.killPotential;
}

/**
 * OHKO garde-fou (plan 148): minimal valuation for one-hit-KO moves (they carry no power floor, so the
 * generic damage path would score them ~0). Per enemy actually caught by the move's pattern: accuracy ×
 * kill value, scaled up for high-HP targets (an OHKO shines when a normal hit wouldn't KO). Immune
 * targets (Fermeté / type / Ice) subtract kill value so the AI never plays into them. Allies caught by a
 * Line/Cone subtract kill value (friendly-fire KO risk). Fine heuristics (setup/threat) are deferred.
 */
function scoreOhko(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  currentPokemon: PokemonInstance,
  enemies: readonly PokemonInstance[],
  allies: readonly PokemonInstance[],
  move: MoveDefinition,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const affectedTiles = estimateAffectedTiles(
    move.targeting,
    currentPokemon.position,
    action.targetPosition,
  );
  const targetsHit = enemies.filter((enemy) => isOnTiles(enemy.position, affectedTiles));
  if (targetsHit.length === 0) {
    return -1;
  }

  const accuracy = ohkoAccuracy(move, engine.getPokemonTypes(currentPokemon.id)) / 100;
  // Déni de menace (plan 159) : tuer d'un coup la menace n°1 vaut plus que le PV brut ; encore plus si
  // cette menace peut nous mettre KO.
  const threat = highestThreatEnemy(enemies, currentPokemon, engine);
  const threatCanKoUs = threat !== null && wouldKoUs(enemies, currentPokemon, engine);
  let score = 0;
  for (const target of targetsHit) {
    if (engine.ohkoImmunityAgainst(currentPokemon, move, target) !== null) {
      score -= weights.killPotential;
      continue;
    }
    const hpFraction = target.currentHp / target.maxHp;
    const denialMultiplier = target.id === threat?.id ? (threatCanKoUs ? 2 : 1.5) : 1;
    score += accuracy * weights.killPotential * (0.5 + hpFraction) * denialMultiplier;
  }

  const alliesHit = allies.filter((ally) => isOnTiles(ally.position, affectedTiles));
  score -= alliesHit.length * accuracy * weights.killPotential;
  return score;
}

/**
 * Morphing garde-fou (transform, plan 157, #657): worth a heavy-CT cast only when copying a clearly
 * stronger mon. Scores by the offensive+defensive stat-total gap (target − caster, HP excluded since
 * the morph keeps its own HP). A gap of ≤10% returns a hard negative so the AI never wastes 900 CT
 * copying a weaker / comparable target; otherwise the gap scales `statChanges`.
 */
function scoreTransformApplication(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  currentPokemon: PokemonInstance,
  enemies: readonly PokemonInstance[],
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const target = enemies.find(
    (enemy) =>
      enemy.position.x === action.targetPosition.x && enemy.position.y === action.targetPosition.y,
  );
  if (!target || target.transformState) {
    return -1;
  }
  const statTotal = (mon: PokemonInstance): number => {
    const stats = effectiveCombatStats(mon);
    return stats.attack + stats.defense + stats.spAttack + stats.spDefense + stats.speed;
  };
  const casterTotal = statTotal(currentPokemon);
  if (casterTotal <= 0) {
    return -1;
  }
  const gap = (statTotal(target) - casterTotal) / casterTotal;
  if (gap <= 0.1) {
    return -1;
  }
  // À gap comparable, copier la menace n°1 (le sweeper adverse) vaut mieux qu'un tank équivalent.
  const threatBonus =
    highestThreatEnemy(enemies, currentPokemon, engine)?.id === target.id ? 1.5 : 1;
  return gap * weights.statChanges * threatBonus;
}

/**
 * Cognobidon garde-fou (belly-drum, plan 154): the −50% HP cost makes it a potential blunder. Fail
 * cases (HP ≤ 50% or Attack already maxed) → hard negative; risky (HP ≤ 70%) → neutral; safe → value
 * the +6 Attack proportionally to the headroom actually gained.
 */
function scoreBellyDrum(
  currentPokemon: PokemonInstance,
  enemies: readonly PokemonInstance[],
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const hpRatio = currentPokemon.currentHp / currentPokemon.maxHp;
  if (hpRatio <= 0.5 || currentPokemon.statStages[StatName.Attack] >= 6) {
    return -1;
  }
  // Cognobidon sacrifie 50% PV max pour +6 Attaque (plan 161) : ne le jouer que si l'on survit au tour
  // pour en profiter — sinon on meurt avant d'avoir frappé, le boost est gâché.
  if (wouldKoUs(enemies, currentPokemon, engine)) {
    return -1;
  }
  if (hpRatio < 0.7) {
    return 0;
  }
  const headroom = (6 - currentPokemon.statStages[StatName.Attack]) / 6;
  return weights.killPotential * headroom;
}

function sumStatStages(pokemon: PokemonInstance, stats: readonly StatName[]): number {
  let total = 0;
  for (const stat of stats) {
    total += pokemon.statStages[stat];
  }
  return total;
}

/**
 * Stat-manip (plan 146 ; heuristique fine plan 161) : valorise le gain net de crans pour le lanceur.
 * Boost (copie) / Renversement (inversion) / Permu* (échange) rapportent quand la cible est mieux lotie
 * que nous ; malus net quand la manip l'avantage. ×1.5 sur la menace n°1 (on lui vole/casse son setup).
 */
function scoreStatManip(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  caster: PokemonInstance,
  enemies: readonly PokemonInstance[],
  move: MoveDefinition,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const target = enemies.find(
    (enemy) =>
      enemy.position.x === action.targetPosition.x && enemy.position.y === action.targetPosition.y,
  );
  if (!target) {
    return -1;
  }
  const penalty = -weights.statChanges;
  const threatMult = highestThreatEnemy(enemies, caster, engine)?.id === target.id ? 1.5 : 1;
  const value = (gain: number): number =>
    gain <= 0 ? penalty : gain * weights.statChanges * 0.5 * threatMult;

  for (const effect of move.effects) {
    if (effect.kind === EffectKind.InvertStatStages) {
      // Inverser une cible boostée transforme ses crans positifs en malus ; sur une cible ≤ 0 c'est un
      // cadeau (on lui rend un buff) → malus.
      return value(sumStatStages(target, TRANSFERABLE_STATS));
    }
    if (effect.kind === EffectKind.CopyStatStages) {
      // Copier les crans d'une cible mieux boostée que nous = gain net de setup.
      return value(
        sumStatStages(target, TRANSFERABLE_STATS) - sumStatStages(caster, TRANSFERABLE_STATS),
      );
    }
    if (effect.kind === EffectKind.SwapStatStages) {
      return value(sumStatStages(target, effect.stats) - sumStatStages(caster, effect.stats));
    }
    if (effect.kind === EffectKind.SwapRawSpeed) {
      // Échanger la Vitesse brute avec une cible plus rapide nous vole son tempo.
      const gap = effectiveBaseSpeed(target) - effectiveBaseSpeed(caster);
      return gap <= 0 ? penalty : Math.min(3, gap / 30) * weights.statChanges * threatMult;
    }
  }
  return 0;
}

/**
 * Buée Noire (haze → ResetStatStages zone, plan 146 ; heuristique fine plan 161) : reset team-agnostic
 * d'un diamant r3 centré sur le lanceur. Bilan signé — on gagne à effacer les crans positifs ennemis et
 * nos propres crans négatifs, on perd à effacer nos crans positifs (et à nettoyer les malus ennemis).
 */
function scoreHazeReset(
  caster: PokemonInstance,
  radius: number,
  state: BattleState | undefined,
  weights: AiProfile["scoringWeights"],
): number {
  if (!state) {
    return 0;
  }
  let net = 0;
  for (const mon of state.pokemon.values()) {
    if (mon.currentHp <= 0 || manhattanDistance(mon.position, caster.position) > radius) {
      continue;
    }
    const sum = sumStatStages(mon, TRANSFERABLE_STATS);
    net += mon.playerId === caster.playerId ? -sum : sum;
  }
  return net <= 0 ? -1 : net * weights.statChanges * 0.5;
}

/**
 * Dépit (spite): a CT tempo tax. Worth more on a target about to act (high CT), wasted on a mon
 * behind a Substitute. Flat statChanges baseline, ×1.5 when the target's CT is near its threshold.
 */
const SPITE_HIGH_CT = 800;
function scoreSpiteApplication(
  targets: readonly PokemonInstance[],
  weights: AiProfile["scoringWeights"],
  state?: BattleState,
): number {
  let total = 0;
  for (const target of targets) {
    if (target.substituteHp !== undefined) {
      continue;
    }
    let score = weights.statChanges;
    const targetCt = state?.ctSnapshot?.[target.id];
    if (targetCt !== undefined && targetCt >= SPITE_HIGH_CT) {
      score *= 1.5;
    }
    total += score;
  }
  return total;
}

/**
 * Score placing an entry-hazard trap on the aimed tile (plan 131). The AI enumerates every tile in
 * range, so we reward tiles near enemies (likely to be traversed) and reject useless placements: on
 * an enemy's current tile (entry-only, no trigger), too far from any enemy, or stacking at cap. Since
 * traps are team-agnostic, a tile adjacent to one of our OWN mons is penalised (self-sabotage risk).
 */
function scoreEntryHazardSetter(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  enemies: readonly PokemonInstance[],
  allies: readonly PokemonInstance[],
  kind: EntryHazardKind,
  weights: AiProfile["scoringWeights"],
  state: BattleState,
): number {
  const livingEnemies = enemies.filter((enemy) => enemy.currentHp > 0);
  if (livingEnemies.length === 0) {
    return -1;
  }
  const tile = action.targetPosition;
  const nearest = Math.min(
    ...livingEnemies.map((enemy) => manhattanDistance(tile, enemy.position)),
  );
  // On an enemy = no entry trigger; beyond 3 tiles = unlikely to be walked over soon.
  const proximityScore = nearest === 0 ? 0 : Math.max(0, 4 - nearest);
  if (proximityScore === 0) {
    return -1;
  }
  // Team-agnostic traps also bite our own mons: don't lay one right next to an ally.
  const nearestAlly = allies
    .filter((ally) => ally.currentHp > 0)
    .reduce(
      (min, ally) => Math.min(min, manhattanDistance(tile, ally.position)),
      Number.POSITIVE_INFINITY,
    );
  if (nearestAlly <= 1) {
    return -1;
  }
  const existing = state.entryHazards.find(
    (cell) => cell.kind === kind && cell.tile.x === tile.x && cell.tile.y === tile.y,
  );
  if (existing && existing.layers >= maxLayersFor(kind)) {
    return -1;
  }
  let score = weights.statChanges * 0.6 * proximityScore;
  if (existing) {
    score *= 0.7;
  }
  return score;
}

function scoreDisableApplication(
  targets: readonly PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  weights: AiProfile["scoringWeights"],
): number {
  let total = 0;
  for (const target of targets) {
    if (
      target.lastUsedMoveId === undefined ||
      target.volatileStatuses.some((v) => v.type === StatusType.Disabled)
    ) {
      continue;
    }
    let score = weights.statChanges;
    if (lastMoveIsThreat(target, moveRegistry)) {
      score *= 1.8;
    }
    const hpRatio = target.currentHp / target.maxHp;
    if (hpRatio < 0.3) {
      score *= 0.3;
    }
    total += score;
  }
  return total;
}

function scoreEncoreApplication(
  targets: readonly PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  weights: AiProfile["scoringWeights"],
): number {
  let total = 0;
  for (const target of targets) {
    if (
      target.lastUsedMoveId === undefined ||
      target.volatileStatuses.some((v) => v.type === StatusType.Encored)
    ) {
      continue;
    }
    let score = weights.statChanges;
    if (lastMoveIsLowValue(target, moveRegistry)) {
      score *= 1.8;
    } else if (lastMoveIsThreat(target, moveRegistry)) {
      score *= 0.3;
    }
    total += score;
  }
  return total;
}

function scoreTauntApplication(
  targets: readonly PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  weights: AiProfile["scoringWeights"],
): number {
  let total = 0;
  for (const target of targets) {
    if (target.volatileStatuses.some((v) => v.type === StatusType.Taunted)) {
      continue;
    }
    let score = weights.statChanges;
    const ratio = statusMoveRatio(target, moveRegistry);
    if (ratio >= 0.4) {
      score *= 1.8;
    }
    const hpRatio = target.currentHp / target.maxHp;
    if (hpRatio < 0.3) {
      score *= 0.3;
    }
    total += score;
  }
  return total;
}

function scoreAllyTargetMove(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  currentPokemon: PokemonInstance,
  allies: PokemonInstance[],
  move: MoveDefinition,
  weights: AiProfile["scoringWeights"],
): number {
  const target = allies.find(
    (ally) =>
      ally.position.x === action.targetPosition.x && ally.position.y === action.targetPosition.y,
  );
  if (!target) {
    return -1;
  }

  // Coup d'Main (helping-hand): buff an adjacent ally. Modest flat value; the payoff depends on the
  // ally landing an offensive move next, which the scorer cannot foresee, so keep it conservative.
  const hasHelpingHand = move.effects.some((effect) => effect.kind === EffectKind.HelpingHand);
  if (hasHelpingHand) {
    return weights.statChanges * 0.8;
  }

  // Cri Draconique (dragon-cheer): buff an ally's crit rate. Same conservative flat value as Coup
  // d'Main; wasteful on an ally already sitting at a guaranteed-crit stage.
  const hasAllyCritBuff = move.effects.some(
    (effect) => effect.kind === EffectKind.RaiseCritStage && effect.target === EffectTarget.Targets,
  );
  if (hasAllyCritBuff) {
    return (target.critStageBoost ?? 0) >= 3 ? -1 : weights.statChanges * 0.8;
  }

  // Wish (delayed heal) and ally-targeted heal: value by the recipient's missing HP.
  const wishEffect = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.PostWish }> =>
      effect.kind === EffectKind.PostWish,
  );
  if (wishEffect !== undefined) {
    const missing = 1 - target.currentHp / target.maxHp;
    if (missing <= 0.1) {
      return 0;
    }
    return missing * weights.killPotential * 0.7;
  }
  const allyHeal = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.HealTarget }> =>
      effect.kind === EffectKind.HealTarget && effect.radius === undefined,
  );
  if (allyHeal !== undefined) {
    const missing = 1 - target.currentHp / target.maxHp;
    return missing <= 0.1 ? 0 : missing * weights.killPotential * 0.8;
  }

  const hasTransfer = move.effects.some((effect) => effect.kind === EffectKind.TransferStatStages);
  if (!hasTransfer) {
    return 0;
  }

  let casterPositive = 0;
  let casterNegative = 0;
  let targetPositive = 0;
  for (const stat of TRANSFERABLE_STATS) {
    const cs = currentPokemon.statStages[stat];
    const ts = target.statStages[stat];
    if (cs > 0) {
      casterPositive += cs;
    } else {
      casterNegative += cs;
    }
    if (ts > 0) {
      targetPositive += ts;
    }
  }

  if (casterPositive === 0) {
    return -20;
  }

  let score = casterPositive * 4 + casterNegative * 2;
  if (targetPositive < casterPositive) {
    score += 8;
  }
  return score * (weights.statChanges / 10 + 1);
}

function scoreTargetedHeal(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  allies: PokemonInstance[],
  enemies: PokemonInstance[],
  percent: number,
  weights: AiProfile["scoringWeights"],
): number {
  const ally = allies.find(
    (candidate) =>
      candidate.position.x === action.targetPosition.x &&
      candidate.position.y === action.targetPosition.y,
  );
  if (ally !== undefined) {
    const missing = 1 - ally.currentHp / ally.maxHp;
    return missing <= 0.1 ? 0 : Math.min(missing, percent) * weights.killPotential * 0.8;
  }
  // Healing an enemy (heal-pulse can reach foes) is always a mistake for the AI.
  const enemy = enemies.find(
    (candidate) =>
      candidate.position.x === action.targetPosition.x &&
      candidate.position.y === action.targetPosition.y,
  );
  return enemy === undefined ? -1 : -weights.killPotential;
}

function scoreSelfMove(
  currentPokemon: PokemonInstance,
  enemies: PokemonInstance[],
  move: MoveDefinition,
  moveRegistry: Map<string, MoveDefinition>,
  weights: AiProfile["scoringWeights"],
  state?: BattleState,
): number {
  const hasSelfBuff = move.effects.some(
    (effect) =>
      effect.kind === EffectKind.StatChange &&
      effect.target === EffectTarget.Self &&
      effect.stages > 0,
  );

  // Recyclage (recycle → RecycleItem, plan 142 ; heuristique fine plan 161) : ne récupère un objet que
  // si le lanceur en a consommé un — sinon c'est un tour perdu.
  const hasRecycle = move.effects.some((effect) => effect.kind === EffectKind.RecycleItem);
  if (hasRecycle) {
    return currentPokemon.consumedItemId === undefined ? -1 : weights.statChanges;
  }

  const hasRemoveHazards = move.effects.some(
    (effect) => effect.kind === EffectKind.RemoveEntryHazards,
  );
  if (hasRemoveHazards) {
    if (!state) {
      return weights.statChanges;
    }
    const hazardNearby = state.entryHazards.some(
      (cell) => manhattanDistance(cell.tile, currentPokemon.position) <= HAZARD_REMOVAL_RADIUS,
    );
    return hazardNearby ? weights.statChanges * 1.5 : -1;
  }

  // Requiem (perish-song): hits the caster too, so it is a desperation / mutual-KO tool. Value it only
  // when the caster is hurt and there are healthy enemies to drag down; skip if already counting down.
  const hasPerishSong = move.effects.some((effect) => effect.kind === EffectKind.PostPerishSong);
  if (hasPerishSong) {
    if (currentPokemon.perishAura !== undefined) {
      return -1;
    }
    const healthyEnemies = enemies.filter((enemy) => enemy.currentHp / enemy.maxHp > 0.6).length;
    if (healthyEnemies === 0) {
      return 0;
    }
    const desperation = 1 - currentPokemon.currentHp / currentPokemon.maxHp;
    return desperation * healthyEnemies * weights.killPotential * 0.5;
  }

  const postAuraEffect = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.PostAura }> =>
      effect.kind === EffectKind.PostAura,
  );
  if (postAuraEffect) {
    if (!state) {
      return weights.statChanges;
    }
    const alreadyHasSameKind = state.auras.some(
      (aura) => aura.casterPokemonId === currentPokemon.id && aura.kind === postAuraEffect.aura,
    );
    if (alreadyHasSameKind) {
      return -1;
    }
    let alliesInRadius = 0;
    for (const candidate of state.pokemon.values()) {
      if (candidate.currentHp <= 0 || candidate.playerId !== currentPokemon.playerId) {
        continue;
      }
      if (candidate.id === currentPokemon.id) {
        continue;
      }
      const dx = Math.abs(candidate.position.x - currentPokemon.position.x);
      const dy = Math.abs(candidate.position.y - currentPokemon.position.y);
      if (dx + dy <= AURA_RADIUS) {
        alliesInRadius += 1;
      }
    }
    const earlyMultiplier = setterDurabilityMultiplier(currentPokemon);

    let threatBonus = 1.0;
    if (postAuraEffect.aura === AuraKind.Mist) {
      threatBonus = enemyHasStatDecreaseMoveInRange(enemies, currentPokemon, 5) ? 1.5 : 1.0;
    } else if (postAuraEffect.aura === AuraKind.Safeguard) {
      threatBonus = enemyHasStatusMoveInRange(enemies, currentPokemon, 5) ? 1.5 : 1.0;
    }

    return weights.statChanges * earlyMultiplier * (1 + alliesInRadius) * threatBonus;
  }

  const postFieldTerrainEffect = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.PostFieldTerrain }> =>
      effect.kind === EffectKind.PostFieldTerrain,
  );
  if (postFieldTerrainEffect) {
    if (!state) {
      return weights.statChanges;
    }
    // Re-posting the same terrain on a tile already covered by it is wasteful.
    if (getFieldTerrainAt(state, currentPokemon.position) === postFieldTerrainEffect.terrain) {
      return -1;
    }
    let groundedAlliesInRadius = 0;
    for (const candidate of state.pokemon.values()) {
      if (candidate.currentHp <= 0 || candidate.playerId !== currentPokemon.playerId) {
        continue;
      }
      const dx = Math.abs(candidate.position.x - currentPokemon.position.x);
      const dy = Math.abs(candidate.position.y - currentPokemon.position.y);
      if (dx + dy <= FIELD_TERRAIN_RADIUS) {
        groundedAlliesInRadius += 1;
      }
    }
    const earlyMultiplier = setterDurabilityMultiplier(currentPokemon);
    let threatBonus = 1.0;
    if (
      postFieldTerrainEffect.terrain === FieldTerrain.Electric ||
      postFieldTerrainEffect.terrain === FieldTerrain.Misty
    ) {
      // Electric blocks sleep, Misty blocks status: more valuable under an enemy status threat.
      threatBonus = enemyHasStatusMoveInRange(enemies, currentPokemon, 5) ? 1.5 : 1.0;
    }
    return weights.statChanges * earlyMultiplier * groundedAlliesInRadius * threatBonus;
  }

  const hasPostDistortion = move.effects.some(
    (effect) => effect.kind === EffectKind.PostDistortion,
  );
  if (hasPostDistortion) {
    if (!state) {
      return weights.statChanges;
    }
    // Re-posting where the caster already stands inside a zone is wasteful (mirror field terrains).
    if (isInDistortionZone(state, currentPokemon.position)) {
      return -1;
    }
    // Distorsion pays off when our SLOW mons share the zone with faster enemies. Estimate the
    // benefit as the count of allies (incl. self) inside the zone radius that are slower than the
    // median enemy speed; no slow beneficiaries → no value.
    const enemySpeeds = enemies
      .filter((enemy) => enemy.currentHp > 0)
      .map((enemy) => enemy.baseStats.speed)
      .sort((a, b) => a - b);
    if (enemySpeeds.length === 0) {
      return 0;
    }
    const medianEnemySpeed = enemySpeeds[Math.floor(enemySpeeds.length / 2)] ?? 0;
    let slowBeneficiaries = 0;
    for (const candidate of state.pokemon.values()) {
      if (candidate.currentHp <= 0 || candidate.playerId !== currentPokemon.playerId) {
        continue;
      }
      const dx = Math.abs(candidate.position.x - currentPokemon.position.x);
      const dy = Math.abs(candidate.position.y - currentPokemon.position.y);
      if (dx + dy <= DISTORTION_RADIUS && candidate.baseStats.speed < medianEnemySpeed) {
        slowBeneficiaries += 1;
      }
    }
    if (slowBeneficiaries === 0) {
      return 0;
    }
    return weights.statChanges * setterDurabilityMultiplier(currentPokemon) * slowBeneficiaries;
  }

  const hasPostSubstitute = move.effects.some(
    (effect) => effect.kind === EffectKind.PostSubstitute,
  );
  if (hasPostSubstitute) {
    if (currentPokemon.substituteHp !== undefined) {
      return -1;
    }
    const hpRatio = currentPokemon.currentHp / currentPokemon.maxHp;
    if (hpRatio <= 0.25) {
      return 0;
    }
    let multiplier = 1.0;
    if (
      enemyHasStatusMoveInRange(enemies, currentPokemon, 5) ||
      enemyHasStatDecreaseMoveInRange(enemies, currentPokemon, 5)
    ) {
      multiplier *= 1.5;
    }
    if (state && (state.actionCounter ?? 0) <= 6) {
      multiplier *= 1.2;
    }
    if (hpRatio < 0.4) {
      multiplier *= 0.5;
    }
    return weights.statChanges * 1.5 * multiplier;
  }

  // Self-heal (recover, soft-boiled, slack-off): value by missing HP.
  const healSelf = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.HealSelf }> =>
      effect.kind === EffectKind.HealSelf,
  );
  if (healSelf !== undefined) {
    const missing = 1 - currentPokemon.currentHp / currentPokemon.maxHp;
    return missing <= 0.1 ? 0 : Math.min(missing, healSelf.percent) * weights.killPotential * 0.9;
  }

  // Heal-over-time setup (ingrain, aqua-ring): worthwhile when hurt and not already active.
  const hotEffect = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.PostHealOverTime }> =>
      effect.kind === EffectKind.PostHealOverTime,
  );
  if (hotEffect !== undefined) {
    if (currentPokemon.volatileStatuses.some((v) => v.type === hotEffect.status)) {
      return -1;
    }
    const missing = 1 - currentPokemon.currentHp / currentPokemon.maxHp;
    return missing < 0.25 ? 0 : missing * weights.killPotential * 0.4;
  }

  // Life Dew (ally radius heal): sum of allies' missing HP within radius.
  const radiusHeal = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.HealTarget }> =>
      effect.kind === EffectKind.HealTarget && effect.radius !== undefined,
  );
  if (radiusHeal !== undefined) {
    if (!state) {
      return weights.killPotential * 0.5;
    }
    const radius = radiusHeal.radius ?? 0;
    let missingSum = 0;
    for (const candidate of state.pokemon.values()) {
      if (candidate.currentHp <= 0 || candidate.playerId !== currentPokemon.playerId) {
        continue;
      }
      const dx = Math.abs(candidate.position.x - currentPokemon.position.x);
      const dy = Math.abs(candidate.position.y - currentPokemon.position.y);
      if (dx + dy <= radius) {
        missingSum += 1 - candidate.currentHp / candidate.maxHp;
      }
    }
    return missingSum <= 0.1 ? 0 : missingSum * weights.killPotential * 0.6;
  }

  // Grondement / Magné-Contrôle (radius ally stat buff): value by the count of qualifying allies
  // (incl. self) inside the radius. An ability-gated buff (magnetic-flux) scores 0 when nobody in
  // range carries the gated ability — avoids a visible no-op blunder.
  const radiusBuff = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.StatChange }> =>
      effect.kind === EffectKind.StatChange && effect.radius !== undefined && effect.stages > 0,
  );
  if (radiusBuff !== undefined) {
    if (!state) {
      return weights.statChanges;
    }
    const radius = radiusBuff.radius ?? 0;
    let beneficiaries = 0;
    for (const candidate of state.pokemon.values()) {
      if (candidate.currentHp <= 0 || candidate.playerId !== currentPokemon.playerId) {
        continue;
      }
      if (manhattanDistance(candidate.position, currentPokemon.position) > radius) {
        continue;
      }
      if (radiusBuff.abilityGate !== undefined) {
        const ability = effectiveAbilityId(candidate);
        if (ability === undefined || !radiusBuff.abilityGate.includes(ability)) {
          continue;
        }
      }
      beneficiaries += 1;
    }
    return beneficiaries === 0 ? 0 : beneficiaries * weights.statChanges;
  }

  // Aromatherapy (team status cure): value by allies carrying a major status in radius.
  const cureEffect = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.CureTeamStatus }> =>
      effect.kind === EffectKind.CureTeamStatus,
  );
  if (cureEffect !== undefined) {
    if (!state) {
      return weights.statChanges;
    }
    let statusedAllies = 0;
    for (const candidate of state.pokemon.values()) {
      if (candidate.currentHp <= 0 || candidate.playerId !== currentPokemon.playerId) {
        continue;
      }
      const dx = Math.abs(candidate.position.x - currentPokemon.position.x);
      const dy = Math.abs(candidate.position.y - currentPokemon.position.y);
      if (dx + dy <= cureEffect.radius && candidate.statusEffects.length > 0) {
        statusedAllies += 1;
      }
    }
    return statusedAllies === 0 ? 0 : statusedAllies * weights.statChanges * 2;
  }

  // Possessif (imprison): worth it only when an enemy shares moves with us; best when it seals
  // several. -1 if already active or nothing to seal.
  const hasImprison = move.effects.some((effect) => effect.kind === EffectKind.PostImprison);
  if (hasImprison) {
    if (currentPokemon.volatileStatuses.some((v) => v.type === StatusType.Imprisoning)) {
      return -1;
    }
    const myMoves = new Set(effectiveMoveIds(currentPokemon));
    let maxShared = 0;
    for (const enemy of enemies) {
      if (enemy.currentHp <= 0) {
        continue;
      }
      const shared = enemy.moveIds.filter((id) => myMoves.has(id)).length;
      if (shared > maxShared) {
        maxShared = shared;
      }
    }
    if (maxShared === 0) {
      return -1;
    }
    const base = weights.statChanges * maxShared;
    return maxShared >= 2 ? base * 1.5 : base;
  }

  // Puissance (focus-energy) / Affilage (laser-focus): crit setup. Guard against restacking a
  // boost that is already maxed / already armed; otherwise value it like a generic self-buff.
  const hasCritSetup = move.effects.some(
    (effect) =>
      (effect.kind === EffectKind.RaiseCritStage && effect.target === EffectTarget.Self) ||
      effect.kind === EffectKind.ArmGuaranteedCrit,
  );
  if (hasCritSetup) {
    if (currentPokemon.guaranteedCritArmed === true || (currentPokemon.critStageBoost ?? 0) >= 3) {
      return -1;
    }
    // Le crit ne paie que derrière une vraie frappe : sans move offensif au moveset, c'est du vent
    // (plan 159).
    const hasOffensiveMove = effectiveMoveIds(currentPokemon).some((moveId) => {
      const candidate = moveRegistry.get(moveId);
      return candidate !== undefined && getEffectivePowerFloor(candidate) > 0;
    });
    if (!hasOffensiveMove) {
      return -1;
    }
    const nearestEnemyDist = closestEnemyManhattanDistance(currentPokemon.position, enemies);
    return nearestEnemyDist > 2 ? weights.statChanges * 3 : weights.statChanges;
  }

  if (!hasSelfBuff) {
    return 0;
  }

  const nearestEnemyDist = closestEnemyManhattanDistance(currentPokemon.position, enemies);
  return nearestEnemyDist > 2 ? weights.statChanges * 3 : weights.statChanges;
}

function findAt(list: readonly PokemonInstance[], position: Position): PokemonInstance | undefined {
  return list.find((mon) => mon.position.x === position.x && mon.position.y === position.y);
}

/** Coût de sacrifice d'un self-KO : proportionnel à la valeur du lanceur, annulé s'il mourait de toute façon. */
function sacrificeCost(
  caster: PokemonInstance,
  enemies: readonly PokemonInstance[],
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  if (wouldKoUs(enemies, caster, engine)) {
    return 0;
  }
  return weights.killPotential * (caster.currentHp / caster.maxHp);
}

/** Somme des crans de stats de combat POSITIFS d'un mon (déni de setup). */
function positiveStatStageSum(mon: PokemonInstance): number {
  let total = 0;
  for (const stat of BATTLE_STAT_STAGES) {
    const stage = mon.statStages[stat];
    if (stage > 0) {
      total += stage;
    }
  }
  return total;
}

/**
 * Move-copy (plan 144) : valorisation minimale + garde-fous. Blabla Dodo ne vaut que endormi ; Mimique /
 * Photocopie sont inutiles sans move-source résoluble ; Métronome a une espérance offensive.
 */
function scoreCallMove(
  move: MoveDefinition,
  caster: PokemonInstance,
  enemies: readonly PokemonInstance[],
  weights: AiProfile["scoringWeights"],
): number {
  switch (move.callMove) {
    case CallMoveSourceKind.RandomOwnAsleep:
      // Blabla Dodo : récupère un tour perdu par le sommeil → toujours bon quand endormi, sinon inutile.
      return caster.statusEffects.some((status) => status.type === StatusType.Asleep)
        ? weights.statChanges
        : -1;
    case CallMoveSourceKind.TargetLast:
      // Mimique : besoin d'un ennemi ayant déjà agi.
      return enemies.some((enemy) => enemy.currentHp > 0 && enemy.lastUsedMoveId !== undefined)
        ? weights.typeAdvantage * 0.5
        : -1;
    case CallMoveSourceKind.GlobalLast:
      // Photocopie : besoin d'un dernier move global joué (proxy : un ennemi a agi).
      return enemies.some((enemy) => enemy.lastUsedMoveId !== undefined)
        ? weights.typeAdvantage * 0.5
        : -1;
    default:
      // Métronome (RandomAll) : roll aléatoire d'espérance offensive.
      return weights.typeAdvantage * 0.5;
  }
}

/**
 * Vent Arrière (tailwind, plan 145) : le vent global booste le tempo de l'équipe orientée dans sa
 * direction. Valeur ∝ nb d'alliés vivants (self inclus), × durabilité du lanceur × bonus early ; −1 si
 * un vent est déjà actif (le recast ne fait que remplacer).
 */
function scoreTailwind(
  caster: PokemonInstance,
  allies: readonly PokemonInstance[],
  state: BattleState | undefined,
  weights: AiProfile["scoringWeights"],
): number {
  if (state?.tailwind !== undefined) {
    return -1;
  }
  const beneficiaries = 1 + allies.filter((ally) => ally.currentHp > 0).length;
  const early = state && (state.actionCounter ?? 0) <= 6 ? 1.3 : 1;
  return beneficiaries * weights.positioning * setterDurabilityMultiplier(caster) * early;
}

/**
 * Manip talent (plan 153) : valoriser selon le talent effectif de la cible. Suc Digestif / Soucigraine
 * neutralisent un talent défensif ; Imitation copie un talent offensif sur soi ; Échange échange les deux.
 */
function scoreAbilityManip(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  caster: PokemonInstance,
  enemies: readonly PokemonInstance[],
  kind: (typeof EffectKind)[keyof typeof EffectKind],
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const target = findAt(enemies, action.targetPosition);
  if (!target) {
    return -1;
  }
  const targetAbility = effectiveAbilityId(target);
  const isThreat = highestThreatEnemy(enemies, caster, engine)?.id === target.id;
  const threatMult = isThreat ? 1.5 : 1;

  if (kind === EffectKind.SetAbility || kind === EffectKind.SuppressAbility) {
    // Neutraliser un talent défensif. Soucigraine (SetAbility → insomnia) réveille : ne pas gâcher
    // notre propre sommeil adverse en cours.
    if (targetAbility === undefined) {
      return -1;
    }
    if (
      kind === EffectKind.SetAbility &&
      target.statusEffects.some((status) => status.type === StatusType.Asleep)
    ) {
      return -1;
    }
    const value = abilityNeutralizeValue(targetAbility);
    return value === 0 ? 0 : value * weights.statChanges * threatMult;
  }

  if (kind === EffectKind.CopyAbility) {
    const gain = abilityCopyValue(targetAbility) - abilityCopyValue(effectiveAbilityId(caster));
    return gain <= 0 ? -1 : gain * weights.statChanges;
  }

  // SwapAbility (Échange) : on prend le talent de la cible, on lui donne le nôtre.
  const gain = abilityCopyValue(targetAbility) - abilityCopyValue(effectiveAbilityId(caster));
  if (gain <= 0) {
    return -1;
  }
  return (
    gain * weights.statChanges + abilityNeutralizeValue(targetAbility) * weights.statChanges * 0.3
  );
}

/**
 * Bâillement (yawn, plan 154) : sommeil différé. Garde-fou (cible déjà endormie/statutée/somnolente),
 * puis fort contre la menace n°1, faible sur une cible à bas PV (autant la tuer).
 */
function scoreYawn(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  caster: PokemonInstance,
  enemies: readonly PokemonInstance[],
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const target = findAt(enemies, action.targetPosition);
  if (!target) {
    return -1;
  }
  if (target.drowsyTurns !== undefined && target.drowsyTurns > 0) {
    return -1;
  }
  if (target.statusEffects.length > 0) {
    return -1;
  }
  let score = weights.statChanges;
  if (highestThreatEnemy(enemies, caster, engine)?.id === target.id) {
    score *= 1.8;
  }
  if (target.currentHp / target.maxHp < 0.3) {
    score *= 0.3;
  }
  return score;
}

/**
 * Acupression (acupressure, plan 154) : +2 stat aléatoire self/allié. Corrige le self-cast (mal routé
 * -1). Buff gratuit → bon tôt sur un mon offensif sain à l'abri ; décroît avec les crans déjà posés.
 */
function scoreAcupressure(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  caster: PokemonInstance,
  allies: readonly PokemonInstance[],
  state: BattleState | undefined,
  weights: AiProfile["scoringWeights"],
): number {
  const target =
    action.targetPosition.x === caster.position.x && action.targetPosition.y === caster.position.y
      ? caster
      : findAt(allies, action.targetPosition);
  if (!target) {
    return -1;
  }
  const stages = sumStatStages(target, BATTLE_STAT_STAGES);
  if (stages >= 30) {
    return -1;
  }
  let score = weights.statChanges * 0.8 * Math.min(1, Math.max(0.2, 1 - stages / 20));
  if (state && (state.actionCounter ?? 0) <= 6) {
    score *= 1.2;
  }
  return score;
}

/**
 * Après Vous (after-you, plan 155) : promeut un allié en prochain acteur. Ne vaut que si l'allié a une
 * frappe forte disponible tout de suite.
 */
function scoreAfterYou(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  caster: PokemonInstance,
  allies: readonly PokemonInstance[],
  enemies: readonly PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const ally = findAt(allies, action.targetPosition);
  if (!ally || ally.id === caster.id) {
    return -1;
  }
  const strike = bestAllyStrikeValue(ally, enemies, moveRegistry, engine, weights);
  return strike <= 0 ? -1 : strike;
}

/** Meilleure valeur de frappe immédiate d'un allié (miroir de `evaluateAttacksFromPosition`). */
function bestAllyStrikeValue(
  ally: PokemonInstance,
  enemies: readonly PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  let best = 0;
  for (const moveId of effectiveMoveIds(ally)) {
    const move = moveRegistry.get(moveId);
    if (!move || getEffectivePowerFloor(move) === 0) {
      continue;
    }
    const reach = getMoveMaxReach(move.targeting);
    for (const enemy of enemies) {
      if (enemy.currentHp <= 0 || manhattanDistance(ally.position, enemy.position) > reach) {
        continue;
      }
      if (isImmuneToMoveType(enemy, move, engine)) {
        continue;
      }
      const estimate = engine.estimateDamage(ally.id, moveId, enemy.id);
      if (!estimate) {
        continue;
      }
      const value =
        estimate.min >= enemy.currentHp
          ? weights.killPotential
          : (estimate.max / enemy.maxHp) * weights.killPotential * 0.5;
      if (value > best) {
        best = value;
      }
    }
  }
  return best;
}

/**
 * Interversion (ally-switch, plan 155) : échange les positions lanceur↔allié. Esquive défensive quand
 * l'un des deux est menacé de KO et que l'échange l'éloigne de la menace n°1 (proxy distance).
 */
function scoreAllySwitch(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  caster: PokemonInstance,
  allies: readonly PokemonInstance[],
  enemies: readonly PokemonInstance[],
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const ally = findAt(allies, action.targetPosition);
  if (!ally || ally.id === caster.id) {
    return -1;
  }
  const threat = highestThreatEnemy(enemies, caster, engine);
  if (!threat) {
    return 0;
  }
  // Le lanceur arrive sur la case de l'allié et vice-versa.
  if (wouldKoUs(enemies, caster, engine)) {
    const before = manhattanDistance(caster.position, threat.position);
    const after = manhattanDistance(ally.position, threat.position);
    if (after > before) {
      return weights.killPotential * 0.5;
    }
  }
  if (wouldKoUs(enemies, ally, engine)) {
    const before = manhattanDistance(ally.position, threat.position);
    const after = manhattanDistance(caster.position, threat.position);
    if (after > before) {
      return weights.killPotential * 0.5;
    }
  }
  return 0;
}

/**
 * Tout ou Rien (final-gambit, plan 147) : dégâts fixes = PV du lanceur × efficacité de type (Combat),
 * self-KO à la connexion, sans effet sur une cible Spectre (immunité → pas de connexion).
 */
function scoreFinalGambit(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  caster: PokemonInstance,
  enemies: readonly PokemonInstance[],
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const target = findAt(enemies, action.targetPosition);
  if (!target) {
    return -1;
  }
  const estimate = engine.estimateDamage(caster.id, action.moveId, target.id);
  const effectiveness = estimate?.effectiveness ?? 1;
  if (effectiveness === 0) {
    return -1;
  }
  const predicted = Math.floor(caster.currentHp * effectiveness);
  const cost = sacrificeCost(caster, enemies, engine, weights);
  const threatMult = highestThreatEnemy(enemies, caster, engine)?.id === target.id ? 1.5 : 1;
  if (predicted >= target.currentHp) {
    return weights.killPotential * threatMult - cost;
  }
  return (predicted / target.maxHp) * weights.killPotential * 0.5 - cost;
}

/**
 * Vœu Soin (healing-wish → ReviveOrHeal, plan 147) : cible une tuile (allié KO → revive, allié blessé →
 * soin), self-KO. Jamais sur une tuile vide / un ennemi / un allié déjà plein.
 */
function scoreReviveOrHeal(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  caster: PokemonInstance,
  state: BattleState,
  revivePercent: number,
  weights: AiProfile["scoringWeights"],
): number {
  const occupant = occupantAt(state, action.targetPosition);
  if (!occupant || occupant.playerId !== caster.playerId || occupant.id === caster.id) {
    return -weights.killPotential;
  }
  if (occupant.currentHp <= 0) {
    // Allié KO ressuscité : un mon rendu au combat vaut presque un KO.
    return weights.killPotential * revivePercent + weights.killPotential * 0.3;
  }
  const missing = 1 - occupant.currentHp / occupant.maxHp;
  if (missing <= 0.1) {
    return -weights.killPotential;
  }
  return missing * weights.killPotential * 0.8;
}

/**
 * Souvenir (memento, plan 147) : self-KO + Atq/Atq Spé de la cible −2. Vaut d'autant plus que la cible
 * frappe fort ; inutile si elle est déjà au plancher. Coût de suicide déduit.
 */
function scoreMemento(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  caster: PokemonInstance,
  enemies: readonly PokemonInstance[],
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const target = findAt(enemies, action.targetPosition);
  if (!target) {
    return -1;
  }
  if (target.statStages[StatName.Attack] <= -6 && target.statStages[StatName.SpAttack] <= -6) {
    return -weights.killPotential;
  }
  const threatFraction = bestEnemyDamageAgainst(target, caster, engine) / Math.max(1, caster.maxHp);
  const threatMult = highestThreatEnemy(enemies, caster, engine)?.id === target.id ? 1.5 : 1;
  return (
    Math.min(1, threatFraction) * weights.killPotential * threatMult -
    sacrificeCost(caster, enemies, engine, weights)
  );
}

/**
 * Croc Fatal (super-fang → HalveTargetHp, plan 152) : dégâts fixes ⌊PV/2⌋, ne KO jamais. Excellent sur
 * une cible haute en PV ; ×1.5 sur la menace n°1.
 */
function scoreHalveTargetHp(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  caster: PokemonInstance,
  enemies: readonly PokemonInstance[],
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const target = findAt(enemies, action.targetPosition);
  if (!target) {
    return -1;
  }
  const predicted = Math.floor(target.currentHp / 2);
  const threatMult = highestThreatEnemy(enemies, caster, engine)?.id === target.id ? 1.5 : 1;
  return (predicted / target.maxHp) * weights.killPotential * threatMult;
}

/**
 * Explosion / Destruction / Explo-Brume (isExplosion, plan 147) : compter les KO réels dans la zone,
 * moins le coût de suicide du lanceur. Rejet net si aucun KO ou si un allié serait KO.
 */
function scoreExplosion(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  caster: PokemonInstance,
  enemies: readonly PokemonInstance[],
  allies: readonly PokemonInstance[],
  move: MoveDefinition,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const tiles = estimateAffectedTiles(move.targeting, caster.position, action.targetPosition);
  const targetsHit = enemies.filter((enemy) => isOnTiles(enemy.position, tiles));
  const alliesHit = allies.filter((ally) => isOnTiles(ally.position, tiles));

  const threat = highestThreatEnemy(enemies, caster, engine);
  let koScore = 0;
  let koCount = 0;
  for (const target of targetsHit) {
    const estimate = engine.estimateDamage(caster.id, move.id, target.id);
    if (estimate && estimate.min >= target.currentHp && !survivesLethalHit(target)) {
      koCount += 1;
      koScore += weights.killPotential * (threat?.id === target.id ? 1.5 : 1);
    }
  }
  for (const ally of alliesHit) {
    const estimate = engine.estimateDamage(caster.id, move.id, ally.id);
    if (estimate && estimate.min >= ally.currentHp) {
      return -weights.killPotential;
    }
  }
  if (koCount === 0) {
    return -weights.killPotential;
  }
  return koScore - sacrificeCost(caster, enemies, engine, weights);
}

/**
 * Vol Magnétik (magnet-rise, plan 154) : lévitation temporaire — annule les menaces Sol + le terrain
 * dangereux / pièges au sol. −1 si déjà actif ou cloué.
 */
function scoreMagnetRise(
  caster: PokemonInstance,
  enemies: readonly PokemonInstance[],
  engine: BattleEngine,
  moveRegistry: Map<string, MoveDefinition>,
  weights: AiProfile["scoringWeights"],
): number {
  if ((caster.magnetRiseTurns ?? 0) > 0 || caster.smackedDown === true) {
    return -1;
  }
  const groundThreat = bestGroundThreatFraction(enemies, caster, engine, moveRegistry);
  let score = groundThreat * weights.killPotential * 0.6;
  const tile = engine.getTileAt(caster.position);
  if (tile && DANGEROUS_TERRAINS.has(tile.terrain)) {
    score += weights.statChanges;
  }
  return score;
}

/**
 * Lien du Destin / Rancune (destiny-bond / grudge, plan 147) : outils de désespoir — ne valent que si un
 * ennemi peut nous mettre KO ce tour. Croît avec notre détresse ; ×1.5 sur une menace n°1 qui frappe fort.
 */
function scoreDestinyBondGrudge(
  caster: PokemonInstance,
  enemies: readonly PokemonInstance[],
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  if (!wouldKoUs(enemies, caster, engine)) {
    return 0;
  }
  const desperation = 1 - caster.currentHp / caster.maxHp;
  const threat = highestThreatEnemy(enemies, caster, engine);
  const threatMult =
    threat && bestEnemyDamageAgainst(threat, caster, engine) >= caster.currentHp ? 1.5 : 1;
  return desperation * weights.killPotential * 0.6 * threatMult;
}

/**
 * Field global (Gravité / Zone Étrange / Zone Magique, plan 145) : zone diamant r3 centrée sur le
 * lanceur. Valeur selon le nb d'ennemis en zone que l'effet pénalise ; −1 si déjà dans la zone.
 */
function scorePostFieldGlobal(
  caster: PokemonInstance,
  enemies: readonly PokemonInstance[],
  kind: FieldGlobalKind,
  state: BattleState | undefined,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  if (state && isInFieldGlobalZone(state, caster.position, kind)) {
    return -1;
  }
  const inZone = enemies.filter(
    (enemy) =>
      enemy.currentHp > 0 &&
      manhattanDistance(enemy.position, caster.position) <= FIELD_GLOBAL_RADIUS,
  );
  let beneficiaries = 0;
  for (const enemy of inZone) {
    if (kind === FieldGlobalKind.Gravity) {
      if (engine.isAirborneIgnoringGravity(enemy.id)) {
        beneficiaries += 1;
      }
    } else if (kind === FieldGlobalKind.WonderRoom) {
      const stats = effectiveCombatStats(enemy);
      if (Math.abs(stats.defense - stats.spDefense) >= 20) {
        beneficiaries += 1;
      }
    } else if (kind === FieldGlobalKind.MagicRoom) {
      if (enemy.heldItemId !== undefined) {
        beneficiaries += 1;
      }
    }
  }
  return beneficiaries === 0
    ? 0
    : beneficiaries * weights.statChanges * setterDurabilityMultiplier(caster);
}

/**
 * Par Ici / Poudre Fureur (draw-attention, plan 155) : garde-fou (−1 si personne en zone) + plancher
 * ×0.5, plus un bonus back-setup quand un allié offensif frappe le dos d'un ennemi réorienté vers nous.
 */
function scoreDrawAttention(
  caster: PokemonInstance,
  enemies: readonly PokemonInstance[],
  allies: readonly PokemonInstance[],
  radius: number,
  moveRegistry: Map<string, MoveDefinition>,
  weights: AiProfile["scoringWeights"],
): number {
  const exposed = enemies.filter(
    (enemy) => enemy.currentHp > 0 && manhattanDistance(enemy.position, caster.position) <= radius,
  );
  if (exposed.length === 0) {
    return -1;
  }
  let score = weights.statChanges * 0.5 * exposed.length;
  for (const enemy of exposed) {
    // Post-cast l'ennemi fait face au lanceur → son dos est à l'opposé.
    const reoriented: PokemonInstance = {
      ...enemy,
      orientation: directionFromTo(enemy.position, caster.position),
    };
    const backSetup = allies.some((ally) => {
      if (ally.currentHp <= 0) {
        return false;
      }
      if (getFacingZone(ally.position, reoriented) !== FacingZone.Back) {
        return false;
      }
      return effectiveMoveIds(ally).some((moveId) => {
        const move = moveRegistry.get(moveId);
        return move !== undefined && getEffectivePowerFloor(move) > 0;
      });
    });
    if (backSetup) {
      score += weights.typeAdvantage * 0.5;
    }
  }
  return score;
}

/**
 * Charge-réaction (plan 150). Mitra-Poing (Focus) est annulé si on est frappé pendant la charge → forte
 * décote quand un ennemi peut nous atteindre. Bec-Canon (Beak) frappe toujours (bonus brûlure au
 * contact). Carapiège (Shell) ne part QUE si un ennemi nous frappe physiquement → −1 sinon (renvoie ≤ −1
 * pour signaler le gating au caller).
 */
function scoreChargeReaction(
  move: MoveDefinition,
  caster: PokemonInstance,
  enemies: readonly PokemonInstance[],
  damageScore: number,
  moveRegistry: Map<string, MoveDefinition>,
  weights: AiProfile["scoringWeights"],
): number {
  switch (move.chargeReaction) {
    case ChargeReaction.Focus:
      // Mitra-Poing : annulé si on est frappé pendant la charge → forte décote.
      return anyEnemyCanStrike(enemies, caster, moveRegistry) ? damageScore * 0.3 : damageScore;
    case ChargeReaction.Beak:
      // Bec-Canon : frappe garantie ; bonus brûlure si un attaquant au contact nous frappe.
      return anyEnemyCanStrike(enemies, caster, moveRegistry)
        ? damageScore + weights.statChanges
        : damageScore;
    default:
      // Carapiège (Shell) : le gate dur est appliqué en amont ; ici l'armement est acquis.
      return damageScore;
  }
}

/**
 * Poursuite (pursuit, plan 152) : ×2 dans le dos, non vu par estimateDamage. On crédite le surplus de
 * dégâts (≈ le crédit de base à nouveau) pour les cibles frappées de dos ; ×1.5 sur la menace n°1.
 */
function scorePursuitBackstab(
  caster: PokemonInstance,
  targetsHit: readonly PokemonInstance[],
  enemies: readonly PokemonInstance[],
  moveId: string,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  let bonus = 0;
  const threat = highestThreatEnemy(enemies, caster, engine);
  for (const target of targetsHit) {
    if (directionFromTo(caster.position, target.position) !== target.orientation) {
      continue;
    }
    const estimate = engine.estimateDamage(caster.id, moveId, target.id);
    if (!estimate) {
      continue;
    }
    const doubled = Math.min(estimate.max * 2, target.currentHp);
    const value = (doubled / target.maxHp) * weights.killPotential * 0.5;
    bonus += value * (threat?.id === target.id ? 1.5 : 1);
  }
  return bonus;
}

/**
 * Bluff (fake-out → flinch, plan 150) : le flinch ne vaut que s'il prive un adversaire de son tour ; fort
 * sur la menace n°1 (×2.5 si elle peut nous mettre KO), sinon générique.
 */
function scoreFlinch(
  targetsHit: readonly PokemonInstance[],
  enemies: readonly PokemonInstance[],
  caster: PokemonInstance,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const threat = highestThreatEnemy(enemies, caster, engine);
  const hitsThreat = targetsHit.some((target) => target.id === threat?.id);
  if (hitsThreat) {
    return weights.statChanges * (wouldKoUs(enemies, caster, engine) ? 2.5 : 1.5);
  }
  return weights.statChanges * 0.8;
}

/**
 * Coup Bas (sucker-punch, plan 150) : bonus de frappe préemptive sur la menace n°1 agressive (le
 * garde-fou de fraîcheur a déjà validé la légalité en amont).
 */
function scoreSuckerPunchDenial(
  targetsHit: readonly PokemonInstance[],
  enemies: readonly PokemonInstance[],
  caster: PokemonInstance,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const threat = highestThreatEnemy(enemies, caster, engine);
  const aggressiveThreat = targetsHit.some(
    (target) =>
      target.id === threat?.id &&
      target.lastActedAtAction !== undefined &&
      target.lastOffensiveActionAtAction === target.lastActedAtAction,
  );
  if (!aggressiveThreat) {
    return 0;
  }
  return weights.killPotential * (wouldKoUs(enemies, caster, engine) ? 0.8 : 0.4);
}

/**
 * Anti-Air (smack-down, plan 152) : bonus si la cible est aéroportée et pas encore clouée (retire son
 * immunité Sol / annule une esquive en cours).
 */
function scoreSmackDown(
  targetsHit: readonly PokemonInstance[],
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  let bonus = 0;
  for (const target of targetsHit) {
    if (target.smackedDown === true) {
      continue;
    }
    if (engine.isAirborneIgnoringGravity(target.id)) {
      bonus += weights.statChanges * 1.5;
      if (target.semiInvulnerableState !== undefined && target.semiInvulnerableState !== null) {
        bonus += weights.killPotential * 0.3;
      }
    }
  }
  return bonus;
}

/**
 * Lock-in multi-tour (plan 149) : malus d'engagement (le verrou retire la flexibilité ; auto-confusion
 * sauf Brouhaha). Brouhaha : bonus AoE si ≥2 cibles + bonus anti-sommeil.
 */
function scoreLockInCommitment(
  move: MoveDefinition,
  targetsHit: readonly PokemonInstance[],
  enemies: readonly PokemonInstance[],
  caster: PokemonInstance,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  const confuses = move.lockIn?.confuseOnEnd === true;
  if (!confuses) {
    // Brouhaha : pas d'auto-confusion. Bonus AoE + anti-sommeil.
    let bonus = 0;
    if (targetsHit.length >= 2) {
      bonus += weights.typeAdvantage;
    }
    if (enemyHasStatusMoveInRange(enemies, caster, 3)) {
      bonus += weights.statChanges;
    }
    return bonus - weights.statChanges * 0.3;
  }
  // Familles à auto-confusion : malus d'engagement, aggravé si un ennemi peut nous punir.
  return wouldKoUs(enemies, caster, engine) ? -weights.statChanges * 2 : -weights.statChanges;
}

/**
 * Phazing (Cyclone / Hurlement / Projection → PhazeToSpawn, plans 146-147) : éjecter un ennemi vers son
 * spawn = board control + déni de setup (crans positifs) ; ×1.5 sur la menace n°1.
 */
function scorePhazing(
  targetsHit: readonly PokemonInstance[],
  enemies: readonly PokemonInstance[],
  caster: PokemonInstance,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  let score = 0;
  const threat = highestThreatEnemy(enemies, caster, engine);
  for (const target of targetsHit) {
    let value = weights.positioning + positiveStatStageSum(target) * weights.statChanges;
    if (target.id === threat?.id) {
      value *= 1.5;
    }
    score += value;
  }
  return score;
}

function scoreDamagingMove(
  currentPokemon: PokemonInstance,
  targetsHit: PokemonInstance[],
  move: MoveDefinition,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): { score: number; securesKo: boolean } {
  let totalScore = 0;
  let securesKo = false;

  for (const target of targetsHit) {
    // Immunité de type non vue par estimateDamage (Sol vs aéroporté) → aucun crédit.
    if (isImmuneToMoveType(target, move, engine)) {
      continue;
    }
    const estimate = engine.estimateDamage(currentPokemon.id, move.id, target.id);
    if (!estimate) {
      continue;
    }

    let targetScore = 0;

    // Faux-KO : un porteur Ceinture Force / Bandeau / Baie Sitrus / Fermeté survit à 1 PV, et Faux-Chage
    // (cannotKo) plafonne à 1 PV par conception. Ne pas créditer un KO plein (estimateDamage ignore ces
    // clamps) — dégât partiel plafonné à currentHp-1.
    const cannotKo = move.cannotKo === true || survivesLethalHit(target);
    if (estimate.min >= target.currentHp && !cannotKo) {
      targetScore += weights.killPotential;
      securesKo = true;
    } else {
      const cappedMax = cannotKo ? Math.min(estimate.max, target.currentHp - 1) : estimate.max;
      const damageRatio = Math.max(0, cappedMax) / target.maxHp;
      targetScore += damageRatio * weights.killPotential * 0.5;
    }

    if (estimate.effectiveness > 1) {
      targetScore += weights.typeAdvantage;
    } else if (estimate.effectiveness < 1 && estimate.effectiveness > 0) {
      targetScore -= weights.typeAdvantage * 0.5;
    }

    totalScore += targetScore;
  }

  return { score: totalScore, securesKo };
}

function estimateAffectedTiles(
  targeting: TargetingPattern,
  casterPosition: Position,
  targetPosition: Position,
): Position[] {
  switch (targeting.kind) {
    case TargetingKind.Single:
      return [targetPosition];

    case TargetingKind.Self:
      return [casterPosition];

    case TargetingKind.Dash:
      return [targetPosition];

    case TargetingKind.Line: {
      const direction = directionFromTo(casterPosition, targetPosition);
      const tiles: Position[] = [];
      for (let step = 1; step <= targeting.length; step++) {
        tiles.push(stepInDirection(casterPosition, direction, step));
      }
      return tiles;
    }

    case TargetingKind.Cone: {
      const direction = directionFromTo(casterPosition, targetPosition);
      const tiles: Position[] = [];
      for (let distance = targeting.range.min; distance <= targeting.range.max; distance++) {
        const center = stepInDirection(casterPosition, direction, distance);
        tiles.push(center);
        const halfWidth = distance - 1;
        const perpOffsets = getPerpendicularOffsets(direction);
        for (let offset = 1; offset <= halfWidth; offset++) {
          for (const perp of perpOffsets) {
            tiles.push({ x: center.x + perp.x * offset, y: center.y + perp.y * offset });
          }
        }
      }
      return tiles;
    }

    case TargetingKind.Slash: {
      const direction = directionFromTo(casterPosition, targetPosition);
      const center = stepInDirection(casterPosition, direction, 1);
      const tiles = [center];
      for (const perp of getPerpendicularOffsets(direction)) {
        tiles.push({ x: center.x + perp.x, y: center.y + perp.y });
      }
      return tiles;
    }

    case TargetingKind.Cross: {
      const tiles: Position[] = [];
      const halfSize = Math.floor(targeting.size / 2);
      for (let d = -halfSize; d <= halfSize; d++) {
        tiles.push({ x: casterPosition.x + d, y: casterPosition.y });
        if (d !== 0) {
          tiles.push({ x: casterPosition.x, y: casterPosition.y + d });
        }
      }
      return tiles;
    }

    case TargetingKind.Zone:
      return tilesInRadius(casterPosition, targeting.radius);

    case TargetingKind.Blast:
      return tilesInRadius(targetPosition, targeting.radius);

    case TargetingKind.Teleport:
      return [targetPosition];

    case TargetingKind.HitAndRun:
      return [targetPosition];

    case TargetingKind.GroundTarget:
      return [targetPosition];
  }
}

function tilesInRadius(center: Position, radius: number): Position[] {
  const tiles: Position[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (manhattanDistance(center, { x: center.x + dx, y: center.y + dy }) <= radius) {
        tiles.push({ x: center.x + dx, y: center.y + dy });
      }
    }
  }
  return tiles;
}

function isOnTiles(position: Position, tiles: Position[]): boolean {
  return tiles.some((tile) => tile.x === position.x && tile.y === position.y);
}

function scoreMove(
  action: Extract<Action, { kind: typeof ActionKind.Move }>,
  currentPokemon: PokemonInstance,
  enemies: PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  profile: AiProfile,
): number {
  if (enemies.length === 0) {
    return 0;
  }

  const weights = profile.scoringWeights;
  const destination = action.path[action.path.length - 1] ?? currentPokemon.position;
  const currentDistance = closestDistanceToEnemies(
    currentPokemon.position,
    enemies,
    currentPokemon.id,
    engine,
  );
  const newDistance = closestDistanceToEnemies(destination, enemies, currentPokemon.id, engine);
  const improvement = currentDistance - newDistance;

  let score = improvement > 0 ? improvement * weights.positioning : 0;

  const pokemonTypes = engine.getPokemonTypes(currentPokemon.id);
  const isFlying = isEffectivelyFlying(currentPokemon, pokemonTypes);
  const destinationTile = action.path.length > 0 ? engine.getTileAt(destination) : null;
  if (
    destinationTile &&
    DANGEROUS_TERRAINS.has(destinationTile.terrain) &&
    !isTerrainImmune(destinationTile.terrain, pokemonTypes, isFlying)
  ) {
    score -= DANGEROUS_TERRAIN_PENALTY;
  }

  const attackBonus = evaluateAttacksFromPosition(
    currentPokemon,
    destination,
    enemies,
    moveRegistry,
    engine,
    weights,
  );
  score += attackBonus;

  return score;
}

function evaluateAttacksFromPosition(
  pokemon: PokemonInstance,
  fromPosition: Position,
  enemies: PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  let bestAttackScore = 0;

  for (const moveId of effectiveMoveIds(pokemon)) {
    const move = moveRegistry.get(moveId);
    if (!move || getEffectivePowerFloor(move) === 0) {
      continue;
    }

    const reach = getMoveMaxReach(move.targeting);

    for (const enemy of enemies) {
      const dist = manhattanDistance(fromPosition, enemy.position);
      if (dist > reach) {
        continue;
      }

      // Reject « phantom sniper » spots the real targeting would deny (LoS blocked by the wall).
      if (!engine.hasLineOfSightFrom(fromPosition, enemy.position)) {
        continue;
      }

      if (isImmuneToMoveType(enemy, move, engine)) {
        continue;
      }

      // Estimate damage AS IF the mon stood on `fromPosition` (height / terrain from the destination).
      const estimate = engine.estimateDamage(pokemon.id, moveId, enemy.id, undefined, fromPosition);
      if (!estimate) {
        continue;
      }

      const cannotKo = move.cannotKo === true || survivesLethalHit(enemy);
      let attackScore = 0;
      if (estimate.min >= enemy.currentHp && !cannotKo) {
        attackScore = weights.killPotential;
      } else {
        const cappedMax = cannotKo ? Math.min(estimate.max, enemy.currentHp - 1) : estimate.max;
        attackScore = (Math.max(0, cappedMax) / enemy.maxHp) * weights.killPotential * 0.5;
      }
      if (estimate.effectiveness > 1) {
        attackScore += weights.typeAdvantage;
      }

      if (attackScore > bestAttackScore) {
        bestAttackScore = attackScore;
      }
    }
  }

  return bestAttackScore * 0.8;
}

function scoreEndTurn(
  action: Extract<Action, { kind: typeof ActionKind.EndTurn }>,
  currentPokemon: PokemonInstance,
  enemies: PokemonInstance[],
): number {
  if (enemies.length === 0) {
    return 0;
  }

  const closestEnemy = findClosestEnemy(currentPokemon.position, enemies);
  const desiredDirection = directionFromTo(currentPokemon.position, closestEnemy);

  return action.direction === desiredDirection ? 1 : 0;
}

function getAliveEnemies(state: BattleState, currentPokemon: PokemonInstance): PokemonInstance[] {
  return [...state.pokemon.values()].filter(
    (pokemon) => pokemon.playerId !== currentPokemon.playerId && pokemon.currentHp > 0,
  );
}

function getAliveAllies(state: BattleState, currentPokemon: PokemonInstance): PokemonInstance[] {
  return [...state.pokemon.values()].filter(
    (pokemon) =>
      pokemon.playerId === currentPokemon.playerId &&
      pokemon.id !== currentPokemon.id &&
      pokemon.currentHp > 0,
  );
}

function findClosestEnemy(from: Position, enemies: PokemonInstance[]): Position {
  let closest = enemies[0]?.position ?? from;
  let minDist = manhattanDistance(from, closest);
  for (let i = 1; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy) {
      continue;
    }
    const dist = manhattanDistance(from, enemy.position);
    if (dist < minDist) {
      minDist = dist;
      closest = enemy.position;
    }
  }
  return closest;
}

function closestEnemyManhattanDistance(from: Position, enemies: PokemonInstance[]): number {
  let minDistance = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    const distance = manhattanDistance(from, enemy.position);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }
  return minDistance;
}

function closestDistanceToEnemies(
  from: Position,
  enemies: PokemonInstance[],
  pokemonId: string,
  engine: BattleEngine,
): number {
  let minDistance = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    const pathDist = engine.computePathDistance(from, enemy.position, pokemonId);
    const dist =
      pathDist === Number.POSITIVE_INFINITY ? manhattanDistance(from, enemy.position) : pathDist;
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}
