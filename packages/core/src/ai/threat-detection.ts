import type { BattleEngine } from "../battle/BattleEngine";
import { getEffectivePowerFloor } from "../battle/dynamic-power-system";
import { effectiveMoveIds } from "../battle/effective-move-ids";
import { Category } from "../enums/category";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";

const ENEMY_STAT_DECREASE_MOVES: ReadonlySet<string> = new Set([
  "growl",
  "tail-whip",
  "string-shot",
  "charm",
  "screech",
  "leer",
  "smokescreen",
  "sand-attack",
  "feather-dance",
  "scary-face",
  "metal-sound",
  "kinesis",
  "flash",
  "cotton-spore",
  "fake-tears",
  "memento",
  "iron-tail",
  "crunch",
  "shadow-ball",
  "psychic",
  "rock-tomb",
  "icy-wind",
  "mud-shot",
]);

const ENEMY_STATUS_MOVES: ReadonlySet<string> = new Set([
  "spore",
  "thunder-wave",
  "will-o-wisp",
  "toxic",
  "lovely-kiss",
  "confuse-ray",
  "sleep-powder",
  "stun-spore",
  "poison-powder",
  "supersonic",
  "glare",
  "hypnosis",
  "sing",
  "poison-gas",
  "sweet-kiss",
  "dark-void",
  "grass-whistle",
]);

export function enemyHasStatDecreaseMoveInRange(
  enemies: readonly PokemonInstance[],
  caster: PokemonInstance,
  range: number,
): boolean {
  for (const enemy of enemies) {
    if (enemy.currentHp <= 0) {
      continue;
    }
    const dx = Math.abs(enemy.position.x - caster.position.x);
    const dy = Math.abs(enemy.position.y - caster.position.y);
    if (dx + dy > range) {
      continue;
    }
    for (const moveId of effectiveMoveIds(enemy)) {
      if (ENEMY_STAT_DECREASE_MOVES.has(moveId)) {
        return true;
      }
    }
  }
  return false;
}

export function enemyHasStatusMoveInRange(
  enemies: readonly PokemonInstance[],
  caster: PokemonInstance,
  range: number,
): boolean {
  for (const enemy of enemies) {
    if (enemy.currentHp <= 0) {
      continue;
    }
    const dx = Math.abs(enemy.position.x - caster.position.x);
    const dy = Math.abs(enemy.position.y - caster.position.y);
    if (dx + dy > range) {
      continue;
    }
    for (const moveId of effectiveMoveIds(enemy)) {
      if (ENEMY_STATUS_MOVES.has(moveId)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * La derniere move utilisee par la cible est-elle une attaque offensive ?
 * Sert au scoring Disable (couper une move menacante). Faux si pas de derniere move.
 */
export function lastMoveIsThreat(
  target: PokemonInstance,
  moveRegistry: Map<string, MoveDefinition>,
): boolean {
  const moveId = target.lastUsedMoveId;
  if (moveId === undefined) {
    return false;
  }
  const move = moveRegistry.get(moveId);
  return (
    move !== undefined && move.category !== Category.Status && getEffectivePowerFloor(move) > 0
  );
}

/**
 * La derniere move utilisee par la cible est-elle un move de statut / faible valeur offensive ?
 * Sert au scoring Encore (verrouiller l'adversaire sur une action faible). Faux si pas de derniere move.
 */
export function lastMoveIsLowValue(
  target: PokemonInstance,
  moveRegistry: Map<string, MoveDefinition>,
): boolean {
  const moveId = target.lastUsedMoveId;
  if (moveId === undefined) {
    return false;
  }
  const move = moveRegistry.get(moveId);
  return move !== undefined && move.category === Category.Status;
}

export function statusMoveRatio(
  pokemon: PokemonInstance,
  moveRegistry: Map<string, MoveDefinition>,
): number {
  const moveIds = effectiveMoveIds(pokemon);
  if (moveIds.length === 0) {
    return 0;
  }
  let statusCount = 0;
  for (const moveId of moveIds) {
    const move = moveRegistry.get(moveId);
    if (move && move.category === Category.Status) {
      statusCount++;
    }
  }
  return statusCount / moveIds.length;
}

/**
 * Meilleur dégât estimé de `enemy` sur `self` en bouclant son moveset effectif (proxy de menace,
 * ignore portée/LoS). O(M) appels `estimateDamage`.
 */
export function bestEnemyDamageAgainst(
  enemy: PokemonInstance,
  self: PokemonInstance,
  engine: BattleEngine,
): number {
  let best = 0;
  for (const moveId of effectiveMoveIds(enemy)) {
    const estimate = engine.estimateDamage(enemy.id, moveId, self.id);
    if (estimate && estimate.max > best) {
      best = estimate.max;
    }
  }
  return best;
}

/**
 * L'ennemi vivant au plus fort potentiel offensif contre `self` (cible naturelle du « déni »).
 * O(N×M). N, M ≤ ~24, négligeable par tour.
 */
export function highestThreatEnemy(
  enemies: readonly PokemonInstance[],
  self: PokemonInstance,
  engine: BattleEngine,
): PokemonInstance | null {
  let best: PokemonInstance | null = null;
  let bestDamage = -1;
  for (const enemy of enemies) {
    if (enemy.currentHp <= 0) {
      continue;
    }
    const damage = bestEnemyDamageAgainst(enemy, self, engine);
    if (damage > bestDamage) {
      bestDamage = damage;
      best = enemy;
    }
  }
  return best;
}

/** Un ennemi vivant peut-il nous mettre KO d'un de ses moves ? O(N×M). */
export function wouldKoUs(
  enemies: readonly PokemonInstance[],
  self: PokemonInstance,
  engine: BattleEngine,
): boolean {
  return enemies.some(
    (enemy) => enemy.currentHp > 0 && bestEnemyDamageAgainst(enemy, self, engine) >= self.currentHp,
  );
}

/** Cible « en forme » : PV ratio ≥ `ratio` (défaut 0.7). */
export function isHealthyTarget(mon: PokemonInstance, ratio = 0.7): boolean {
  return mon.currentHp / mon.maxHp >= ratio;
}
