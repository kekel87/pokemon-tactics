# Plan 163 — Content-fill : 7 derniers talents Gen 1

**Statut : done** (2026-07-18)

## Contexte

Recompté sur la source (via le vrai tableau `abilityHandlers`, pas un regex `id:"..."` qui rate les talents factory/const) : sur les 114 talents portés par le roster Gen 1, **107 sont implémentés, 7 restent**. Les objets tenus sont **100 % faits** (117/117 `HeldItemId`). Les 6 talents que je croyais manquants (Engrais/Brasier/Torrent/Essaim/Cuvette/Corps Gel) étaient **déjà implémentés** (factory `pinchBooster` / `makeWeatherHeal`).

## Les 7 talents

| FR | ID | Porteurs | Mécanique |
|----|----|----------|-----------|
| Récolte | `harvest` | Noeunoeuf, Noadkoko | Fin de tour : recrée la dernière baie consommée (100 % au Soleil, 50 % sinon) |
| Délestage | `unburden` | Kicklee | Vitesse ×2 (mvt + CT) tant que le porteur a perdu/consommé son objet tenu |
| Piège Sable | `arena-trap` | Taupiqueur, Triopikeur | Les ennemis **au sol adjacents (Chebyshev r1)** ne peuvent plus **se déplacer** |
| Gaz Inhibiteur | `neutralizing-gas` | Smogo, Smogogo | Neutralise les talents des Pokémon dans un rayon **Manhattan r2** (sauf lui-même) |
| Fouille | `frisk` | Grodoudou | Révèle l'**objet** des ennemis (badge InfoPanel) |
| Prédiction | `forewarn` | Soporifik, Hypnomade, Lippoutou | Révèle la **capacité la plus puissante** des ennemis (badge) |
| Anticipation | `anticipation` | Évoli | Révèle le **talent** des ennemis (badge, **non-canon** — choix humain, plus simple) |

## Décisions design (humain, 2026-07-18)

- **Piège Sable** : adaptation grille — bloque le **déplacement** des ennemis au sol **adjacents (r1)**, pas un switch (inexistant). Exceptions canon (pokepedia) : types **Vol** et **Spectre**, **Lévitation**, **Fuite** (Run Away — gagne enfin un effet réel), **Gaz Inhibiteur**, + notre **Carapace Mue** (`immuneToTrapping`, plan 158). « Au sol » = `isEffectivelyGrounded` (donc Vol Magnétik / Ballon échappent aussi).
- **Gaz Inhibiteur** : rayon **Manhattan r2** (choix humain, pas field-wide). Exceptions canon = talents hors-Gen1 uniquement → en pratique neutralise tout sauf un autre Gaz Inhibiteur. Fin d'effet à la mort/départ du porteur.
- **Fouille/Prédiction/Anticipation** : vraies **révélations** (flags `revealed*` sur `PokemonInstance`, badges InfoPanel au survol). Valeur latente en solo plein-info, **scaffolding multijoueur** (info cachée à venir). Anticipation → révèle le talent (non-canon assumé).

## Infra core

- **PokemonInstance** : `unburdenActive?`, `abilitySuppressedByGas?`, `revealedItem?`, `revealedTopMoveId?`, `revealedAbility?` (booléens/ids de révélation).
- **effective-ability.ts** : `abilitySuppressedByGas` neutralise le talent (avant `abilityIdOverride`), sauf pour le talent `neutralizing-gas` lui-même.
- **Gaz Inhibiteur** : helper `recomputeGasSuppression(state, registry)` recalcule `abilitySuppressedByGas` de chaque mon vivant (∃ porteur Gaz vivant à Manhattan ≤ 2, ≠ self, self n'est pas Gaz). Appelé aux hooks : début `advanceTurn`, après `PokemonMoved`, après KO, à l'init du combat.
- **Piège Sable** : helper `isArenaTrapped(state, pokemon, registry)` (∃ ennemi vivant adjacent Chebyshev r1 avec `arena-trap` effectif, self grounded, self non-exempt) → étend le gate Move de `getLegalActions` + garde `submitAction`.
- **Délestage** : `effectiveBaseSpeed` ×2 si `unburdenActive` ; flag posé quand le porteur consomme/perd son objet (hooks item-transfer), recompute `derivedStats.movement`. Reset KO.
- **Récolte** : `onEndTurn` — si `consumedItemId` est une baie et roll (100 % Soleil / 50 %) → `recycleConsumedItem`.
- **Révélations** : posées à l'entrée en combat (init) par les porteurs, consommées par `battle-views.ts` en badges.

## Renderer / i18n

- InfoPanel : badges « Objet : {obj} » (Fouille), « Menace : {capacité} » (Prédiction), « Talent : {talent} » (Anticipation) sur les ennemis révélés.
- Badge « Gaz » / indicateur suppression (optionnel), badge « Piège » sur ennemi bloqué (optionnel).
- i18n FR/EN des nouveaux badges. Noms de talents déjà en base.

## Tests

- Unit par talent (harvest restore, unburden speed×2 + reset, arena-trap gate + exceptions, gas r2 suppression + exceptions + fin à la mort, frisk/forewarn/anticipation flags).
- Gate CI complet + human-testing.

## Reporté

- e2e Playwright (via test-writer).
- Fog-of-war multijoueur (les révélations prennent tout leur sens quand l'info ennemie sera cachée).
- Interaction fine Gaz Inhibiteur vs auras d'entrée (Intimidation) à l'init : traitée au mieux, edge-case timing noté.
