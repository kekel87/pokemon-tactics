---
status: done
created: 2026-03-27
updated: 2026-03-27
---

# Plan 015 — Stats niveau 50

## Objectif

Remplacer l'utilisation brute des `baseStats` comme HP et stats de combat par des valeurs calculées via la formule Gen 5+ au niveau 50 (sans IV/EV). Afficher le niveau dans l'UI renderer.

## Contexte

Actuellement, `build-test-engine.ts` assigne `definition.baseStats.hp` directement à `currentHp`/`maxHp`, et `damage-calculator.ts` utilise `pokemon.baseStats.attack` directement. Les baseStats officiels (ex : Bulbizarre HP=45, Salamèche HP=39) sont trop bas pour un combat tactique équilibré. La formule Gen 5 au niveau 50 donne des valeurs plus réalistes (Bulbizarre ~110 HP, Salamèche ~98 HP) et des combats plus longs et tactiques.

Décision #122 : niveau 50, sans IV ni EV.

Formule Gen 5 officielle, niveau 50, IV=0, EV=0 :
- **HP** : `Math.floor((2 * base * 50) / 100) + 50 + 10`
- **Autres stats** : `Math.floor(((2 * base * 50) / 100 + 5) * 1.0)`

## Étapes

- [x] Étape 1 — Créer `packages/core/src/battle/stat-calculator.ts` avec `computeStatAtLevel`
  - Exporter `computeStatAtLevel(base: number, level: number, isHp: boolean): number`
  - Formule HP : `Math.floor((2 * base * level) / 100) + level + 10`
  - Formule autres stats : `Math.floor((2 * base * level) / 100) + 5`
  - Créer `packages/core/src/battle/stat-calculator.test.ts` avec des cas concrets :
    - Bulbizarre HP base 45, niveau 50 → 110
    - Bulbizarre Attaque base 49, niveau 50 → 63
    - Salamèche HP base 39, niveau 50 → 98
    - Pikachu Vitesse base 90, niveau 50 → 95
    - Abra HP base 25, niveau 50 → 80 (cas extrême, base très faible)
    - Machop Attaque base 80, niveau 50 → 105
  - Exporter la fonction depuis `packages/core/src/index.ts`

- [x] Étape 2 — Ajouter `level` à `PokemonInstance` et mettre à jour `build-test-engine.ts`
  - Ajouter `level: number` dans `packages/core/src/types/pokemon-instance.ts`
  - Dans `build-test-engine.ts`, importer `computeStatAtLevel` et calculer :
    - `const maxHp = computeStatAtLevel(definition.baseStats.hp, 50, true)`
    - `currentHp: maxHp`, `maxHp`
    - Toutes les stats de combat (`attack`, `defense`, `spAttack`, `spDefense`, `speed`) calculées au niveau 50
    - Conserver `baseStats` avec les valeurs officielles (non modifiées — sert à `computeStatAtLevel`)
    - `derivedStats.initiative = computeStatAtLevel(definition.baseStats.speed, 50, false)`
    - `level: 50`
  - Mettre à jour `mock-pokemon.ts` : ajouter `level: 50` sur tous les mocks statiques (`base`, `bulbasaur`, `charmander`, `squirtle`, `pidgey`) et recalculer `currentHp`/`maxHp` avec la formule niveau 50
    - `MockPokemon.bulbasaur` : `currentHp: 110, maxHp: 110` (base HP 45)
    - `MockPokemon.charmander` : `currentHp: 98, maxHp: 98` (base HP 39)
    - `MockPokemon.squirtle` : `currentHp: 108, maxHp: 108` (base HP 44)
    - `MockPokemon.pidgey` : `currentHp: 100, maxHp: 100` (base HP 40)
    - `MockPokemon.base` : `level: 50` (currentHp/maxHp restent à 100 — mock générique)

- [x] Étape 3 — Mettre à jour `damage-calculator.ts` pour utiliser les stats calculées
  - Dans `damage-calculator.ts`, remplacer `attacker.baseStats.attack` par une stat calculée au niveau 50
  - **Option choisie** : introduire un champ `combatStats` dans `PokemonInstance` (type `BaseStats`) portant les valeurs calculées au niveau 50, séparé de `baseStats` qui reste officiel
    - Ajouter `combatStats: BaseStats` dans `packages/core/src/types/pokemon-instance.ts`
    - `combatStats` est calculé dans `build-test-engine.ts` lors de la création de l'instance
    - `damage-calculator.ts` utilise `attacker.combatStats.attack` au lieu de `attacker.baseStats.attack`
    - `status-tick-handler.ts` et `link-drain-handler.ts` utilisent déjà `maxHp` — pas de changement nécessaire
  - Mettre à jour `mock-pokemon.ts` et `mock-battle.ts` pour ajouter `combatStats` sur tous les mocks

- [x] Étape 4 — Ajuster les tests impactés par les nouvelles valeurs
  - **Tests à ajuster** (valeurs de HP/dégâts vont changer) :
    - `battle-loop.integration.test.ts` : recalculer `turnsToKill` avec les nouveaux HP, ajuster les `currentHp` hardcodés (lignes 116-117, 274-275, 300-301)
    - `BattleEngine.integration.test.ts` : ajuster les HP hardcodés à 200 (ils sont fictifs, peuvent rester)
    - `status-tick-handler.test.ts` : tests avec HP 100/10 — ce sont des mocks génériques, pas de changement nécessaire
    - `link-drain-handler.test.ts` : tests avec HP 50/100 — mocks génériques, pas de changement nécessaire
    - `effect-processor.test.ts` : mocks génériques, pas de changement nécessaire
    - `damage-calculator.test.ts` : vérifie des relations (plus grand que, moins grand que) — pas de valeurs hardcodées, pas de changement
  - Vérifier que les assertions sur des valeurs de dégâts exactes (`toBe`) dans `BattleEngine.use-move.test.ts` et `BattleEngine.test.ts` sont toujours correctes ou à recalculer
  - S'assurer que `pnpm test` passe à 100% de coverage

- [x] Étape 5 — Afficher le niveau dans l'UI renderer
  - Dans `packages/renderer/src/ui/InfoPanel.ts` : afficher `Niv. 50` (ou `Lv. 50`) à côté du nom du Pokemon
  - La valeur est lue depuis `PokemonInstance.level`
  - Pas de test unitaire requis (renderer) — vérification via `visual-tester` après l'étape

## Critères de complétion

- `computeStatAtLevel` existe dans `packages/core/src/battle/stat-calculator.ts` avec tests couvrant HP et stats autres
- `PokemonInstance` possède `level: number` et `combatStats: BaseStats`
- `damage-calculator.ts` utilise `combatStats` au lieu de `baseStats`
- `build-test-engine.ts` calcule `maxHp`, `currentHp` et `combatStats` via `computeStatAtLevel` au niveau 50
- `mock-pokemon.ts` reflète les HP calculés au niveau 50
- `pnpm test` passe, coverage 100% sur `packages/core`
- L'UI renderer affiche `Niv. 50` dans le panel info
- Un combat IA headless (ou visuel) montre des HP dans les ~80-130+ HP selon le Pokemon

## Risques / Questions

- **Tests avec HP hardcodés** : les tests d'intégration `battle-loop.integration.test.ts` utilisent des HP derivés de `baseStats` directement (ex. `bulbasaur.maxHp / 8` pour le poison) — ces calculs fonctionneront toujours car ils lisent `maxHp` depuis l'instance, pas en dur. À vérifier.
- **`baseStats` vs `combatStats`** : le choix de garder `baseStats` officiel séparé de `combatStats` calculé permet de toujours pouvoir recalculer à un autre niveau sans perte d'information. C'est le bon design. Vérifier que `baseStats` n'est plus utilisé dans `damage-calculator.ts` après cette étape.
- **`initiative`** dans `derivedStats` : actuellement `initiative = baseStats.speed`. Après ce plan, il devrait être `computeStatAtLevel(baseStats.speed, 50, false)`. À faire dans l'étape 2.
- **Valeur `BATTLE_LEVEL = 50`** dans `damage-calculator.ts` : cette constante est déjà présente (pour la formule de dégâts) mais n'était pas utilisée pour les stats. Après ce plan, les stats entrant dans la formule seront déjà au niveau 50 — la constante reste correcte.
- **Étape 5 optionnelle** : si le renderer a des régressions visuelles, bloquer l'étape 5 et déclencher `visual-tester`.

## Dépendances

- **Prérequis** : Plan 014 terminé (done). Aucun autre prérequis.
- **Ce plan débloque** : équilibrage des movesets (décision #121), revue humain des dégâts avec des HP réalistes. Prérequis indirect pour les formules dérivées (Mouvement/Saut depuis Vitesse+Poids, Phase 3).
