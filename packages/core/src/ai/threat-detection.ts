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
    for (const moveId of enemy.moveIds) {
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
    for (const moveId of enemy.moveIds) {
      if (ENEMY_STATUS_MOVES.has(moveId)) {
        return true;
      }
    }
  }
  return false;
}
