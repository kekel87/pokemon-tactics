/**
 * Seed de combat forcé par l'URL, pour les scénarios de capture reproductibles (plan 194).
 *
 * Un combat normal tire son seed de `crypto.getRandomValues` : deux lancements donnent des dégâts,
 * des critiques et des ratés différents. C'est ce qu'on veut en jeu, et c'est ce qui rend une
 * séquence scriptée **inutilisable** pour produire des captures ou un gif — chaque run donnerait des
 * images différentes.
 *
 * `?seed=<entier>` force donc le seed du prochain combat. **Verrouillé sur `DEV` ou `VITE_E2E`**,
 * exactement comme le boot bac à sable par URL (`babylon-boot.ts`) : dans une version publiée, ce
 * module renvoie toujours `null`, et il n'existe aucun moyen d'injecter un seed depuis l'extérieur.
 *
 * ⚠️ Ce hook est branché dans `randomSeed()` (`combat-screen.ts`), que le **parcours normal** ET le boot
 * bac à sable en mode aléatoire consultent tous les deux. Un bac à sable lancé avec `?seed=` dans l'URL
 * n'est donc plus aléatoire — c'est cohérent (on a demandé un seed), mais ce n'est pas « distinct de la
 * route bac à sable » comme le disait la version précédente de ce commentaire.
 *
 * Il couvre aussi le PLACEMENT depuis le 2026-08-28 : le seed résolu ici est passé à `PlacementPhase`,
 * qui tirait sinon sur `Math.random` — les douze Pokemon se posaient ailleurs à chaque partie, et la
 * séquence n'était donc pas reproductible malgré ce hook.
 */
export function forcedBattleSeed(): number | null {
  if (!(import.meta.env.DEV || import.meta.env.VITE_E2E === "true")) {
    return null;
  }
  const raw = new URLSearchParams(window.location.search).get("seed");
  if (raw === null) {
    return null;
  }
  const parsed = Number(raw);
  // Un seed non numérique est une erreur d'appel silencieuse : mieux vaut retomber sur l'aléatoire
  // que de semer le PRNG avec `NaN`, qui produirait une suite constante sans le dire.
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}
