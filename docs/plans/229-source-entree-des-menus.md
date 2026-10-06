# Plan 229 — Relever la source d'entrée dès les menus

**Statut** : done
**Origine** : faille de mesure constatée le 2026-10-06 à la première lecture de la télémétrie
v2026.10.2 (observation ajoutée à `decision-1117`, plan 224). Choix de l'humain au même tour.

## Ce que tu verras à l'écran

1. Rien de neuf à l'œil dans le jeu : la légende des contrôles et les indices du combat suivent
   l'appareil dès le premier clic ou tap **dans les menus**, au lieu d'attendre le premier geste sur
   le plateau. Sur téléphone comme au PC, ils affichent déjà la bonne variante — le changement ne doit
   rien déplacer.
2. Dans `pnpm stats`, le tableau « Abandons rapides par source d'entrée » se met à compter des parties
   **Tactile** et **Souris** ; la ligne « Inconnue » ne garde que les parties lancées sans aucun geste
   (cas marginal), à partir de la release suivante.

## Constat

- `battle_started` relève `data-input-source` au lancement, avant tout geste sur le plateau.
- Seule `pointer-source.ts` (canvas du combat) note Souris/Tactile ; les clics et taps dans les
  menus DOM ne notent rien.
- `createInputSourceTracker` ne publie qu'au **changement** : la source initiale (`pointer`) n'est
  jamais publiée, même quand une souris la confirme.

D'où « Inconnue » pour tout joueur souris ou tactile n'ayant utilisé que les menus, et « Souris »
seulement après un passage au clavier.

## Étapes

1. `input-source.ts` — le tracker publie la **première** observation même si elle égale la source
   initiale (drapeau « rien d'observé encore »). Avant toute observation, rien n'est publié : la
   règle CSS « rien d'observé » (`:not([data-input-source])` + `pointer: coarse`) reste intacte.
   Ajouter un drapeau `hasObserved` au tracker ; première observation publie, puis retour au
   comportement standard (publier sur changement).
   Mettre à jour `input-source.test.ts` : renommer le test « notifies only on an actual change »
   en « notifies on first observation even if it equals initial », ajouter « publishes nothing before
   any observation », ajouter « continues to only notify on change after first observation ».
   Mettre à jour le docstring de `createInputSourceTracker` ligne 33.
2. `input-system.ts` — un écouteur `pointerdown` sur `window`, en phase de capture, passif :
   `pointerType === "touch"` → Tactile, sinon (souris, stylet) → Souris, comme `pointer-source.ts`.
   Bouton principal seulement (`button === 0`), comme le relevé du plateau. Retiré dans `dispose()`.
   **Écart au plan (passe `/simplify`)** : le relevé propre de `pointer-source.ts` est retiré — la
   capture sur `window` voit chaque `pointerdown` du canvas, tap synthétique des e2e compris
   (`combat-scene.ts` le dispatche avec `bubbles: true`). Une seule règle souris/doigt au lieu de deux.
3. Commentaire de `telemetry.ts` : la JSDoc d'`activeInputSource` dit que `null` = aucun geste. Le
   bloc « Relevé UNE fois » reste juste tel quel (il porte sur le rejeu au départ, inchangé).

## Hors périmètre

- Pas de redéploiement du Worker, pas de changement de `report.ts` : les libellés existent déjà.
- Pas de réécriture des lignes déjà en base (restent « Inconnue »).
- Le `pointermove` n'est pas relevé hors du plateau (un survol n'est pas un choix d'appareil).

## Risques

- Un clavier ou une manette qui ouvre le jeu puis clique une fois bascule l'anneau de focus et la
  légende sur la souris — c'est déjà le comportement voulu (*last-input-wins*), aujourd'hui limité
  au plateau.
- La règle CSS `:not([data-input-source])` sous `@media (pointer: coarse)` cesse de matcher une
  fois la première source observée. Sur tactile, les indices clavier et le pan disparaissent aussitôt
  — c'est voulu, mais doit être validé en recette tactile et 4K tactile (à mesurer si ce retrait
  gêne).
