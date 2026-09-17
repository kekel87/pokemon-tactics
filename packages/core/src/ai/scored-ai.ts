import type { BattleEngine } from "../battle/BattleEngine";
import { ActionKind } from "../enums/action-kind";
import { CallMoveSourceKind } from "../enums/call-move-source-kind";
import { TargetingKind } from "../enums/targeting-kind";
import type { Action } from "../types/action";
import type { AiProfile } from "../types/ai-profile";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { RandomFn } from "../utils/prng";
import { scoreAction } from "./action-scorer";
import { pickAiHitAndRunRetreat } from "./pick-hit-and-run-retreat";
import { MAX_REPETITION_SIGNAL } from "./repetition-guard";

/**
 * Nombre de passages par la MÊME position toléré avant que le filet ne dévie le choix.
 *
 * 2 et non 1 : repasser une fois par une position est banal — deux Pokemon qui se croisent, un tour de
 * recharge. C'est la TROISIÈME occurrence qui dit qu'on tourne, et c'est le seuil des échecs (triple
 * répétition).
 *
 * ⚠️ Doit rester STRICTEMENT inférieur à `MAX_REPETITION_SIGNAL`, sinon le filet ne dévie jamais —
 * son signal plafonné n'atteindrait pas ce seuil. Un test tient ce contrat : les deux constantes
 * vivent dans des fichiers différents et rien d'autre ne les relie.
 */
const TOLERATED_REPEATS = 2;

export function pickScoredAction(
  legalActions: Action[],
  state: BattleState,
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  profile: AiProfile,
  random: RandomFn,
  /**
   * Signal du filet anti-boucle (`RepetitionGuard.observe`), déjà plafonné à
   * `MAX_REPETITION_SIGNAL`. Au-delà de `TOLERATED_REPEATS`, le choix se décale dans le classement :
   * l'IA joue autre chose au lieu de rejouer l'optimum qui l'a ramenée ici. Omis : aucun filet,
   * comportement d'avant le plan 214.
   */
  repetitions = 0,
): Action {
  const first = legalActions[0];
  if (!first) {
    throw new Error("No legal actions available");
  }

  if (legalActions.length === 1) {
    return enrichHitAndRunRetreat(
      enrichCalledMove(first, state, moveRegistry, engine, random),
      state,
      moveRegistry,
      engine,
      random,
    );
  }

  const scored = legalActions
    .map((action) => ({
      action,
      score: scoreAction(action, state, moveRegistry, engine, profile),
    }))
    .sort((a, b) => b.score - a.score);

  const viable = scored.filter((entry) => entry.score >= 0);
  const topN = (viable.length > 0 ? viable : scored).slice(0, Math.max(1, profile.topN));

  let picked: Action;
  if (repetitions > TOLERATED_REPEATS) {
    /*
     * 🔴 On tourne en rond : on DÉVIE, au lieu de rejouer l'optimum qui nous a ramenés ici.
     *
     * Le décalage se prend sur le classement COMPLET et non sur `topN` : à Difficile `topN` vaut 1,
     * donc dévier à l'intérieur n'aurait aucun effet — or c'est justement Difficile contre Difficile
     * qui bouclait le plus.
     *
     * 🔴 **Il est BORNÉ**, parce que la première version ne l'était pas : le signal brut montait à 10
     * et poussait le choix jusqu'à 8 rangs plus bas, sur 341 actions d'une même partie — sans la
     * débloquer. Une IA qui joue de plus en plus mal ALLONGE les parties. Le plafond vit sur
     * `MAX_REPETITION_SIGNAL`, du côté du filet, donc un seul endroit le fixe.
     *
     * Déterministe de bout en bout : aucun appel à `random`, un simple index dans une liste triée.
     * Les deux pairs d'une partie en ligne dévient donc au même tour, vers la même action.
     */
    const ranking = viable.length > 0 ? viable : scored;
    /*
     * Re-plafonné ICI et pas seulement dans le filet, et ce n'est pas de la redondance : la signature
     * accepte n'importe quel entier, donc un appelant qui passerait un compteur brut contournerait la
     * borne. Le contrat « on ne descend jamais de plus de N rangs » doit tenir depuis cette fonction,
     * seule responsable du choix.
     */
    const signal = Math.min(repetitions, MAX_REPETITION_SIGNAL);
    const shift = Math.min(signal - TOLERATED_REPEATS, ranking.length - 1);
    picked = ranking[shift]?.action ?? first;
  } else if (profile.randomWeight <= 0) {
    picked = topN[0]?.action ?? first;
  } else if (random() < profile.randomWeight) {
    const index = Math.floor(random() * topN.length);
    picked = topN[index]?.action ?? first;
  } else {
    picked = topN[0]?.action ?? first;
  }

  return enrichHitAndRunRetreat(
    enrichCalledMove(picked, state, moveRegistry, engine, random),
    state,
    moveRegistry,
    engine,
    random,
  );
}

/**
 * Move-copy (plan 144): resolve a call-move the AI committed to (Métronome / Blabla Dodo / Mimique /
 * Photocopie) and re-target it. `prepareCalledMove` rolls / reads the called move and pins it on the
 * caster (so the subsequent submitAction swaps to it); the action's target is then re-pointed at the
 * called move's best legal tile — an enemy when the rolled move can reach one, otherwise its first
 * valid tile. Target-last (Mimique) anchors on the nearest enemy that has acted. A failed resolution
 * leaves the action as-is (it fizzles at execution — turn still spent, no crash).
 */
function enrichCalledMove(
  action: Action,
  state: BattleState,
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  random: RandomFn,
): Action {
  if (action.kind !== ActionKind.UseMove) {
    return action;
  }
  const move = moveRegistry.get(action.moveId);
  if (!move || move.callMove === undefined) {
    return action;
  }
  const caster = state.pokemon.get(action.pokemonId);
  if (!caster) {
    return action;
  }

  let selectedTargetId: string | undefined;
  if (move.callMove === CallMoveSourceKind.TargetLast) {
    selectedTargetId = nearestEnemyWithLastMove(caster, state);
    if (selectedTargetId === undefined) {
      return action;
    }
  }

  const prepared = engine.prepareCalledMove(caster.id, action.moveId, selectedTargetId);
  if ("failed" in prepared) {
    return action;
  }

  const candidates = engine
    .getLegalActions(caster.playerId)
    .filter(
      (candidate): candidate is Extract<Action, { kind: typeof ActionKind.UseMove }> =>
        candidate.kind === ActionKind.UseMove && candidate.moveId === action.moveId,
    );
  if (candidates.length === 0) {
    return action;
  }
  const enemyTargeted = candidates.find((candidate) => {
    const occupantId = engine.getGrid().getOccupant(candidate.targetPosition);
    const occupant = occupantId === null ? undefined : state.pokemon.get(occupantId);
    return (
      occupant !== undefined && occupant.playerId !== caster.playerId && occupant.currentHp > 0
    );
  });
  const chosen =
    enemyTargeted ?? candidates[Math.floor(random() * candidates.length)] ?? candidates[0];
  return chosen ?? action;
}

/** Nearest living enemy that has used a move (drives Mimique's target-last resolution). */
function nearestEnemyWithLastMove(caster: PokemonInstance, state: BattleState): string | undefined {
  let bestId: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const pokemon of state.pokemon.values()) {
    if (
      pokemon.playerId === caster.playerId ||
      pokemon.currentHp <= 0 ||
      pokemon.lastUsedMoveId === undefined
    ) {
      continue;
    }
    const distance =
      Math.abs(pokemon.position.x - caster.position.x) +
      Math.abs(pokemon.position.y - caster.position.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = pokemon.id;
    }
  }
  return bestId;
}

function enrichHitAndRunRetreat(
  action: Action,
  state: BattleState,
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  random: RandomFn,
): Action {
  if (action.kind !== ActionKind.UseMove) {
    return action;
  }
  const move = moveRegistry.get(action.moveId);
  if (!move || move.targeting.kind !== TargetingKind.HitAndRun) {
    return action;
  }
  const caster = state.pokemon.get(action.pokemonId);
  if (!caster) {
    return action;
  }
  const enemies: PokemonInstance[] = [];
  for (const pokemon of state.pokemon.values()) {
    if (pokemon.playerId !== caster.playerId && pokemon.currentHp > 0) {
      enemies.push(pokemon);
    }
  }
  const retreatPosition = pickAiHitAndRunRetreat(
    caster.position,
    move.targeting.retreatRange,
    engine.getGrid(),
    enemies,
    random,
  );
  if (retreatPosition === null) {
    return action;
  }
  return { ...action, retreatPosition };
}
