/**
 * Le mode d'une partie, tel qu'il voyage dans `battle_started` (plan 196, étape 4).
 *
 * 🔴 **Module volontairement PUR** — aucun import, aucune dépendance au DOM. Il est extrait de
 * `battle-telemetry-session.ts` pour une raison précise (plan 204) : le paquet du Worker de
 * télémétrie le lit dans un test de parité, et il **ne dépend d'aucun paquet du jeu** (contrat en
 * tête de `report.ts`). Importer le module de session y tirait toute la chaîne DOM du jeu —
 * `document`, `window`, `localStorage` — dans un tsconfig qui n'a pas la bibliothèque DOM, et le
 * typecheck du Worker tombait. Même forme que `maps-registry.ts`, que ce même test importe déjà.
 *
 * Donc : **rien n'entre ici qui ne soit une valeur pure**.
 */

/**
 * Les modes de la V1. `story` viendra avec la Phase 9.
 *
 * `online` gouverne un CALCUL et pas seulement un affichage depuis le plan 204 : c'est sur lui que
 * l'agrégation reconnaît les deux lignes d'une même partie en ligne. Le renommer sans toucher au
 * Worker ferait cesser la déduplication en silence — d'où le test de parité côté Worker.
 */
export const BattleMode = {
  Online: "online",
  LocalHotseat: "local-hotseat",
  LocalVsAi: "local-vs-ai",
} as const;

/**
 * Le mode d'une partie.
 *
 * `online` se reconnaît à la présence d'une **place locale** (plan 201) et non au décompte
 * d'humains : une partie en ligne à un humain et une IA en face porte `humans: 2` — la place
 * distante est rabattue sur `human` dans le setup — donc le décompte seul l'aurait rangée en
 * hot-seat, exactement l'inverse de ce qu'on veut mesurer.
 */
export function modeOf(humans: number, localSeat: number | undefined): string {
  if (localSeat !== undefined) {
    return BattleMode.Online;
  }
  return humans >= 2 ? BattleMode.LocalHotseat : BattleMode.LocalVsAi;
}
