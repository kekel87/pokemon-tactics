/**
 * La géométrie de la grille, partagée par les pilotes (plan 213, lot B).
 *
 * 🔴 `Tile` et `manhattan` vivaient en double — `e2e/capture/combat-pad.ts` et
 * `e2e/pages/online-duel.ts` — avec des corps rigoureusement identiques. Deux copies d'une même
 * définition ne se contredisent pas tout de suite ; elles attendent qu'on en corrige une seule.
 * C'est exactement ce qui est arrivé au clone de `castMove`, dans le même lot.
 */

export interface Tile {
  readonly x: number;
  readonly y: number;
}

/**
 * Distance de Manhattan entre deux cases.
 *
 * C'est la métrique du jeu, pas un choix du harnais : les portées de `tactical.ts` se comptent ainsi,
 * et les déplacements se font en pas orthogonaux.
 */
export function manhattan(from: Tile, to: Tile): number {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}
