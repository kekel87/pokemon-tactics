---
status: done
created: 2026-04-03
updated: 2026-04-03
---

# Plan 032 — Portée de déplacement variable par Pokemon

## Objectif

Remplacer le mouvement hardcodé à 3 par une valeur calculée à partir de la base speed du Pokemon selon la formule documentée en section 6b du game-design. Le mouvement doit être recalculé dynamiquement quand les speed stages changent.

## Contexte

Actuellement, `BattleSetup.ts` hardcode `movement: 3` pour tous les Pokemon à la création d'une `PokemonInstance`. La décision #179-182 dans `decisions.md` acte de baser le mouvement sur la base speed. La formule et les paliers sont documentés dans `docs/game-design.md` section 6b. `BattleEngine.getReachableTiles` consomme déjà `pokemon.derivedStats.movement` — il suffit que la valeur soit correcte et maintenue à jour.

## Étapes

- [ ] Étape 1 — Créer `computeMovement(baseSpeed, speedStages)` dans `packages/core/src/battle/stat-modifier.ts`
  - Formule : `effectiveSpeed = floor(baseSpeed × getStatMultiplier(speedStages))`
  - Paliers : ≤20 → 2 / 21–45 → 3 / 46–85 → 4 / 86–170 → 5 / 171–340 → 6 / ≥341 → 7
  - Plancher 2, plafond 7 (la table des paliers couvre déjà l'intégralité, mais clamp explicite pour sécurité)
  - Exporter la fonction depuis `packages/core/src/index.ts`
  - Créer `packages/core/src/battle/stat-modifier.movement.test.ts` avec :
    - Un test par seuil de palier (valeurs limites : 20, 21, 45, 46, 85, 86, 170, 171, 340, 341)
    - Vérification avec stages = 0 (pas de buff)
    - Vérification avec stages positifs (ex: baseSpeed=45, stages=+2 → effectiveSpeed=67 → move 4)
    - Vérification avec stages négatifs (ex: baseSpeed=86, stages=-2 → effectiveSpeed=57 → move 4)
    - Cas limite plancher : baseSpeed=1, stages=-6 → move 2
    - Cas limite plafond : baseSpeed=341, stages=+6 → move 7

- [ ] Étape 2 — Utiliser `computeMovement` dans `BattleSetup.ts` et les helpers de testing
  - Modifier `packages/renderer/src/game/BattleSetup.ts` ligne 64 :
    - Remplacer `movement: 3` par `movement: computeMovement(definition.baseStats.speed, 0)`
    - Importer `computeMovement` depuis `@pokemon-tactic/core`
  - Modifier `packages/core/src/testing/build-test-engine.ts` ligne 71 :
    - Remplacer `movement: 3` par `movement: computeMovement(baseStats.speed, 0)`
    - Le `buildTestEngine` reçoit des `baseStats` → utiliser `baseStats.speed`
  - Modifier `packages/core/src/ai/scored-ai-smoke.test.ts` ligne 114 :
    - Même remplacement que `build-test-engine.ts`
  - Modifier `packages/core/src/battle/golden-replay.test.ts` ligne 82 :
    - Même remplacement
  - Vérification : `pnpm test` dans `packages/core` doit passer sans régression

- [ ] Étape 3 — Mettre à jour les mocks Pokemon dans `packages/core/src/testing/mock-pokemon.ts`
  - Pour chaque mock, recalculer `movement` selon la base speed réelle :
    - `MockPokemon.base` : `baseStats.speed = 50` → move 4
    - `MockPokemon.bulbasaur` : `baseStats.speed = 45` → move 3
    - `MockPokemon.charmander` : `baseStats.speed = 65` → move 4
    - `MockPokemon.squirtle` : `baseStats.speed = 43` → move 3
    - `MockPokemon.pidgey` : `baseStats.speed = 56` → move 4 (actuellement codé à 4, déjà correct)
  - Les tests qui utilisent `movement: 3` explicitement via `MockPokemon.fresh(base, { derivedStats: ... })` ne sont pas impactés — ils overrident intentionnellement
  - Vérification : `pnpm test` dans `packages/core` doit passer

- [ ] Étape 4 — Recalcul dynamique du mouvement après changement de speed stages dans `BattleEngine`
  - Identifier où les stat stages sont appliqués dans `packages/core/src/battle/BattleEngine.ts` (traitement des effets `stat_change` sur `Speed`)
  - Après chaque modification d'un speed stage, recalculer `pokemon.derivedStats.movement` via `computeMovement(pokemon.baseStats.speed, pokemon.statStages[StatName.Speed])`
  - Localiser le point d'application dans `effect-processor.ts` ou dans la méthode qui traite `processStatChange` — ajouter le recalcul juste après la mise à jour de `statStages`
  - Créer un test d'intégration `packages/core/src/battle/mechanics/movement-stages.test.ts` :
    - Scénario Gherkin : un Pokemon utilise Hâte sur lui-même (stat_change speed +2), puis ses `getLegalActions` exposent un mouvement agrandi
    - Scénario symétrique : un Pokemon reçoit Rugissement (speed -1), mouvement réduit
    - Vérifier que le plancher 2 est respecté même avec stages = -6
  - Vérification : `pnpm test` dans `packages/core` doit passer

- [ ] Étape 5 — Adapter les tests directs avec `movement: 3` hardcodé dans les fichiers de test hors mocks
  - Fichiers concernés (ceux qui passent `movement: 3` en `derivedStats` explicitement sans passer par les mocks) :
    - `packages/core/src/battle/battle-loop.integration.test.ts`
    - `packages/core/src/battle/BattleEngine.test.ts`
    - `packages/core/src/battle/BattleEngine.use-move.test.ts` (constantes `HIGH_INIT`, `LOW_INIT`)
    - `packages/core/src/battle/mechanics/bind-status.test.ts`
    - `packages/core/src/battle/mechanics/confusion-status.test.ts`
    - `packages/core/src/battle/mechanics/freeze-status.test.ts`
    - `packages/core/src/battle/mechanics/knockback.test.ts`
    - `packages/core/src/battle/mechanics/multi-hit.test.ts`
    - `packages/core/src/battle/mechanics/pp-consumption.test.ts`
    - `packages/core/src/battle/mechanics/recharge.test.ts`
  - Stratégie : ces tests ne testent pas le mouvement, ils ont un `derivedStats` arbitraire. Laisser les valeurs hardcodées en l'état — les tests resteront valides. Seuls les tests qui testent `getLegalActions` avec des `Move` actions et qui comptent exactement le nombre de tuiles accessibles pourraient échouer si le movement attendu change.
  - Vérifier `pnpm test` complet et ajuster si des assertions de count de tiles cassent.
  - Vérification finale : `pnpm build && pnpm test` au niveau racine du monorepo

## Critères de complétion

- `computeMovement(baseSpeed, stages)` existe dans `stat-modifier.ts` avec des tests couvrant tous les seuils
- `BattleSetup.ts` n'utilise plus `movement: 3` — la valeur est calculée depuis `definition.baseStats.speed`
- Les mocks `MockPokemon` ont des valeurs de `movement` cohérentes avec leur base speed réelle
- Après un buff/debuff de Speed, `derivedStats.movement` est recalculé et `getReachableTiles` retourne le bon nombre de tuiles
- `pnpm build && pnpm test` passe au niveau racine sans régression
- Aucun `movement: 3` hardcodé dans du code de production (hors tests où c'est intentionnel)

## Risques / Questions

- **Tests avec count exact de tiles** : certains tests BattleEngine comptent peut-être le nombre exact de `Move` actions dans `getLegalActions`. Si un mock passe de movement 3 à movement 4, le nombre de tuiles accessibles change et le test casse. Repérer ces assertions à l'étape 5.
- **`MockBattle` non listé** : `packages/core/src/testing/mock-battle.ts` a aussi `movement: 3` hardcodé (lignes 63, 86, 109). Ces mocks n'ont pas de `baseStats.speed` exploitable sans contexte — décider si on ajoute un `baseStats` cohérent ou si on garde les valeurs arbitraires (acceptable si ces mocks ne testent pas le pathfinding).
- **`mock-battle.ts` vs `mock-pokemon.ts`** : les deux fichiers coexistent. `mock-battle.ts` semble avoir des Pokemon anonymes (pas de vraies espèces) — garder `movement: 3` ou recalculer selon le `baseStats.speed` présent.
- **Hâte et moves dans la même session** : si le recalcul est déclenché mid-tour (après l'acte d'un Pokemon), vérifier que `hasMoved` empêche un double mouvement.

## Dépendances

- Dépend de : Plan 004 (`stat-modifier.ts` avec `getStatMultiplier` déjà implémenté), Plan 015 (stats niveau 50 et `computeCombatStats`)
- Débloque : une implémentation fidèle du game-design pour la démo jouable (phase 2 roadmap)
