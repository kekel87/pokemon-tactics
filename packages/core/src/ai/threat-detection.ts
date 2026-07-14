import type { BattleEngine } from "../battle/BattleEngine";
import { getEffectivePowerFloor } from "../battle/dynamic-power-system";
import { effectiveAbilityId } from "../battle/effective-ability";
import { effectiveMoveIds } from "../battle/effective-move-ids";
import { Category } from "../enums/category";
import { PokemonType } from "../enums/pokemon-type";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import { manhattanDistance } from "../utils/manhattan-distance";
import { getMoveMaxReach } from "./move-reach";

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

/**
 * Talents « continus » à forte valeur défensive / survie : les neutraliser (Suc Digestif / Soucigraine)
 * ou les retirer d'une menace vaut la peine. Uniquement les talents IMPLÉMENTÉS du roster. Valeur = poids
 * relatif (3 = survie/immunité dure, 1 = protection mineure).
 */
const NEUTRALIZE_WORTHY_ABILITIES: ReadonlyMap<string, number> = new Map([
  ["sturdy", 3],
  ["filter", 3],
  ["thick-fat", 3],
  ["levitate", 3],
  ["unaware", 3],
  ["regenerator", 3],
  ["marvel-scale", 2],
  ["dry-skin", 2],
  ["immunity", 2],
  ["limber", 2],
  ["water-veil", 2],
  ["vital-spirit", 2],
  ["insomnia", 2],
  ["natural-cure", 2],
  ["shed-skin", 2],
  ["hydration", 2],
  ["shell-armor", 2],
  ["battle-armor", 2],
  ["clear-body", 2],
  ["own-tempo", 1],
  ["oblivious", 1],
  ["leaf-guard", 1],
  ["hyper-cutter", 1],
  ["keen-eye", 1],
  ["big-pecks", 1],
  ["shield-dust", 1],
  ["overcoat", 1],
  ["soundproof", 1],
  ["wonder-skin", 1],
  ["liquid-ooze", 1],
  ["competitive", 1],
  ["defiant", 1],
  ["anger-point", 1],
  ["solar-power", 1],
]);

/**
 * Talents « continus » offensifs / vitesse : bons à COPIER (Imitation) ou à recevoir par Échange.
 * Les talents à déclenchement UNIQUE à l'entrée (Intimidation, Télécharge, Sécheresse, Calque, Imposteur)
 * ne se re-déclenchent pas mid-combat → valeur de copie nulle (absents de cette table = 0).
 */
const OFFENSIVE_COPY_ABILITIES: ReadonlyMap<string, number> = new Map([
  ["adaptability", 3],
  ["technician", 3],
  ["sheer-force", 3],
  ["tinted-lens", 3],
  ["iron-fist", 2],
  ["sniper", 2],
  ["skill-link", 2],
  ["reckless", 2],
  ["analytic", 2],
  ["hustle", 2],
  ["guts", 2],
  ["quick-feet", 2],
  ["swift-swim", 2],
  ["chlorophyll", 2],
  ["sand-rush", 2],
  ["sand-force", 2],
  ["scrappy", 2],
  ["infiltrator", 2],
  ["mold-breaker", 2],
  ["compound-eyes", 2],
  ["rivalry", 1],
]);

/** Valeur de neutralisation d'un talent (0 si inconnu / sans intérêt défensif). O(1). */
export function abilityNeutralizeValue(abilityId: string | undefined): number {
  if (abilityId === undefined) {
    return 0;
  }
  return NEUTRALIZE_WORTHY_ABILITIES.get(abilityId) ?? 0;
}

/** Valeur de copie d'un talent sur un attaquant (0 si battle-start-only / inconnu). O(1). */
export function abilityCopyValue(abilityId: string | undefined): number {
  if (abilityId === undefined) {
    return 0;
  }
  return OFFENSIVE_COPY_ABILITIES.get(abilityId) ?? 0;
}

/**
 * Un ennemi vivant a-t-il un move offensif à portée d'attaque de `self` depuis sa position ? Proxy du
 * risque « on va se faire frapper » (charge-réaction). Ignore la ligne de vue (borne haute). O(N×M).
 */
export function anyEnemyCanStrike(
  enemies: readonly PokemonInstance[],
  self: PokemonInstance,
  moveRegistry: Map<string, MoveDefinition>,
): boolean {
  return enemyStrikeExists(enemies, self, moveRegistry, undefined);
}

/** Idem `anyEnemyCanStrike` mais restreint aux moves PHYSIQUES (armement Carapiège). O(N×M). */
export function anyEnemyPhysicalStriker(
  enemies: readonly PokemonInstance[],
  self: PokemonInstance,
  moveRegistry: Map<string, MoveDefinition>,
): boolean {
  return enemyStrikeExists(enemies, self, moveRegistry, Category.Physical);
}

function enemyStrikeExists(
  enemies: readonly PokemonInstance[],
  self: PokemonInstance,
  moveRegistry: Map<string, MoveDefinition>,
  categoryFilter: (typeof Category)[keyof typeof Category] | undefined,
): boolean {
  for (const enemy of enemies) {
    if (enemy.currentHp <= 0) {
      continue;
    }
    const distance = manhattanDistance(enemy.position, self.position);
    for (const moveId of effectiveMoveIds(enemy)) {
      const move = moveRegistry.get(moveId);
      if (!move || getEffectivePowerFloor(move) === 0) {
        continue;
      }
      if (categoryFilter !== undefined && move.category !== categoryFilter) {
        continue;
      }
      if (distance <= getMoveMaxReach(move.targeting)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Meilleure fraction de PV que nous ferait perdre un move de type SOL d'un ennemi (menace au sol que
 * Vol Magnétik / Gravité annulent). O(N×M) `estimateDamage`.
 */
export function bestGroundThreatFraction(
  enemies: readonly PokemonInstance[],
  self: PokemonInstance,
  engine: BattleEngine,
  moveRegistry: Map<string, MoveDefinition>,
): number {
  let best = 0;
  for (const enemy of enemies) {
    if (enemy.currentHp <= 0) {
      continue;
    }
    for (const moveId of effectiveMoveIds(enemy)) {
      const move = moveRegistry.get(moveId);
      if (!move || move.type !== PokemonType.Ground || getEffectivePowerFloor(move) === 0) {
        continue;
      }
      const estimate = engine.estimateDamage(enemy.id, moveId, self.id);
      if (estimate) {
        const fraction = estimate.max / self.maxHp;
        if (fraction > best) {
          best = fraction;
        }
      }
    }
  }
  return best;
}

/**
 * La cible survit-elle à un coup létal grâce à un objet / talent de survie à 1 PV ? `estimateDamage`
 * ignore ces clamps → sans ce garde-fou l'IA « croit tuer » et gâche son meilleur move. O(1).
 */
export function survivesLethalHit(target: PokemonInstance): boolean {
  const atFullHp = target.currentHp >= target.maxHp;
  const item = target.heldItemId;
  if (item === "focus-sash" && atFullHp) {
    return true;
  }
  if (item === "focus-band") {
    return true;
  }
  if (item === "sitrus-berry" && target.consumedItemId !== "sitrus-berry") {
    return true;
  }
  return atFullHp && effectiveAbilityId(target) === "sturdy";
}

/**
 * Immunité de type que `estimateDamage` NE VOIT PAS (appliquée dans `effect-processor`, pas dans le
 * calcul de dégâts). Pour le roster actuel : move de type Sol contre une cible aéroportée (type Volant /
 * Lévitation / Ballon / Vol Magnétik). Limite connue : sous Gravité l'aéroporté redevient touchable — on
 * reste conservateur (l'IA sous-évalue alors le move Sol, pas de blunder dur). O(1).
 */
export function isImmuneToMoveType(
  target: PokemonInstance,
  move: MoveDefinition,
  engine: BattleEngine,
): boolean {
  return move.type === PokemonType.Ground && engine.isAirborneIgnoringGravity(target.id);
}

/**
 * Occupant d'une tuile — vivant prioritaire, sinon KO (miroir du handler Vœu Soin, seul cas où l'IA doit
 * « voir » un allié KO pour le ressusciter). O(N).
 */
export function occupantAt(state: BattleState, position: Position): PokemonInstance | undefined {
  let knockedOut: PokemonInstance | undefined;
  for (const pokemon of state.pokemon.values()) {
    if (pokemon.position.x !== position.x || pokemon.position.y !== position.y) {
      continue;
    }
    if (pokemon.currentHp > 0) {
      return pokemon;
    }
    knockedOut = pokemon;
  }
  return knockedOut;
}
