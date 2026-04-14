---
status: done
created: 2026-04-14
updated: 2026-04-14
---

# Plan 052 — Orientation tactique (bonus/malus dégâts face/flanc/dos)

## Objectif

Ajouter un modificateur de dégâts basé sur l'orientation du défenseur : attaquer de dos inflige +15%, de face -15%, sur le flanc neutre. Afficher le modificateur dans le texte de preview dégâts existant.

## Contexte

Le plan 051 (terrain types + modifiers) vient d'être terminé. Le pattern de modificateur multiplicatif dans `calculateDamage()` est bien établi avec `heightModifier` et `terrainModifier`. L'orientation est déjà stockée sur `PokemonInstance.orientation` et `isAttackFromFront()` dans `defense-check.ts` contient déjà la logique de comparaison direction/orientation — mais uniquement pour Protect/Detect (bloque les attaques de face). Le facing modifier généralise ce calcul à 3 zones.

Décisions validées avec l'humain :
- Affect uniquement les dégâts (pas l'évasion, pas la résistance statut)
- 3 zones : face (0.85x), flanc (1.0x), dos (1.15x)
- Pas de nouvel indicateur visuel sur la grille — le sprite montre sa direction
- Preview dégâts : "(+15%)" ou "(-15%)" dans le texte flottant existant
- Panel preview dédié : tâche future, hors scope de ce plan

## Étapes

- [x] Étape 1 — Créer `packages/core/src/battle/facing-modifier.ts`
  - Exporter `FacingZone` const object : `Front = "front"`, `Flank = "flank"`, `Back = "back"` + type dérivé
  - Exporter `getFacingZone(attackOrigin: Position, defender: PokemonInstance): FacingZone`
    - `attackDirection = directionFromTo(attackOrigin, defender.position)`
    - Même direction que `defender.orientation` → `Back` (l'attaque arrive dans le dos)
    - Direction opposée → `Front` (l'attaquant est en face du défenseur)
    - Sinon → `Flank`
  - Exporter `getFacingModifier(zone: FacingZone): number`
    - `Front` → 0.85, `Flank` → 1.0, `Back` → 1.15
  - Note : les cases "même direction" et "direction opposée" utilisent les 4 `Direction` cardinales. L'opposé de North est South, l'opposé de East est West.

- [x] Étape 2 — Ajouter `facingModifier` à `DamageEstimate` et l'exposer dans le renderer
  - Modifier `packages/core/src/types/damage-estimate.ts` : ajouter `readonly facingModifier: number` (1.0 si neutre, 0.85 ou 1.15 sinon)
  - Vérifier que tous les sites qui construisent un `DamageEstimate` compilent (tests existants)

- [x] Étape 3 — Intégrer `facingModifier` dans `calculateDamage()` et `estimateDamage()`
  - Dans `packages/core/src/battle/damage-calculator.ts` :
    - Ajouter paramètre `facingModifier = 1.0` à `calculateDamage()` après `terrainModifier`
    - Multiplier dans le `Math.floor` final : `* facingModifier`
    - Ajouter paramètre `facingModifier = 1.0` à `estimateDamage()`, le propager aux deux appels `calculateDamage()`
    - Inclure `facingModifier` dans l'objet `DamageEstimate` retourné

- [x] Étape 4 — Résoudre le `facingModifier` dans `BattleEngine`
  - Dans `packages/core/src/battle/BattleEngine.ts`, méthode `executeUseMove()` :
    - Importer `getFacingZone`, `getFacingModifier` depuis `./facing-modifier`
    - Importer `getAttackOrigin` depuis `./defense-check` (déjà exportable — vérifier ou exporter)
    - Pour chaque cible dans la boucle `targets`, calculer `facingMod` avec `getFacingModifier(getFacingZone(getAttackOrigin(pokemon, move, targetPosition), target))`
    - Passer `facingMod` à `processEffects` → `processDamage` → `calculateDamage` (voir étape 5)
  - Dans la méthode `estimateDamage()` de `BattleEngine` :
    - Calculer `facingMod` via `getFacingModifier(getFacingZone(getAttackOrigin(attacker, move, defenderPosition), defender))`
    - Note : `estimateDamage()` reçoit actuellement `attackerId, moveId, defenderId` — l'origine est la position de l'attaquant (ou targetPosition pour Blast). Pour l'estimation, utiliser la position du défenseur comme `targetPosition` pour Blast.
    - Passer `facingMod` à la fonction `estimateDamage()` du calculator

- [x] Étape 5 — Propager `facingModifier` dans `processEffects` / `processDamage`
  - Dans `packages/core/src/battle/effect-processor.ts` :
    - Ajouter `facingModifier?: number` au type de contexte passé à `processEffects` (ou directement à `processDamage`)
    - Le propager jusqu'à l'appel `calculateDamage()` dans `processDamage`
  - Vérifier la signature exacte du contexte dans `effect-processor.ts` avant de modifier

- [x] Étape 6 — Exporter `getAttackOrigin` depuis `defense-check.ts`
  - Actuellement la fonction est locale (`function getAttackOrigin`). La passer en `export function getAttackOrigin`.
  - Aucun autre changement dans `defense-check.ts`.

- [x] Étape 7 — Tests unitaires `facing-modifier.test.ts`
  - Fichier : `packages/core/src/battle/facing-modifier.test.ts`
  - Couvrir `getFacingZone` : 4 orientations × 4 positions d'attaque = 16 combinaisons
    - Défenseur orienté North, attaque venant du North → Back
    - Défenseur orienté North, attaque venant du South → Front
    - Défenseur orienté North, attaque venant du East → Flank
    - Défenseur orienté North, attaque venant du West → Flank
    - Répéter pour South, East, West
  - Couvrir `getFacingModifier` : 3 zones → 3 valeurs

- [x] Étape 8 — Tests unitaires `damage-calculator.test.ts` (extension)
  - Ajouter des cas dans le fichier existant `packages/core/src/battle/damage-calculator.test.ts`
  - Vérifier que `facingModifier: 0.85` réduit les dégâts vs baseline
  - Vérifier que `facingModifier: 1.15` augmente les dégâts vs baseline
  - Vérifier que `facingModifier: 1.0` ne change rien (régression)

- [x] Étape 9 — Test scénario d'intégration `facing-modifier.test.ts` (scénario)
  - Fichier : `packages/core/src/battle/mechanics/facing-modifier.test.ts`
  - Utiliser `buildMoveTestEngine` avec Charmander (attaquant) vs Bulbasaur (défenseur)
  - Scénario 1 (attaque de dos) :
    - Given : Bulbasaur orienté North, Charmander au Nord de Bulbasaur
    - When : Charmander attaque avec Ember
    - Then : les dégâts reçus sont supérieurs au cas neutre
  - Scénario 2 (attaque de face) :
    - Given : Bulbasaur orienté South, Charmander au Nord de Bulbasaur
    - When : Charmander attaque avec Ember
    - Then : les dégâts reçus sont inférieurs au cas neutre
  - Scénario 3 (attaque de flanc) :
    - Given : Bulbasaur orienté North, Charmander à l'Est de Bulbasaur
    - When : Charmander attaque avec Ember
    - Then : les dégâts reçus sont égaux au cas neutre

- [x] Étape 10 — Renderer : afficher le modificateur dans `showDamageText()`
  - Dans `packages/renderer/src/sprites/PokemonSprite.ts`, méthode `showDamageText()` :
    - Lire `estimate.facingModifier`
    - Construire le suffixe : si `> 1.0` → `" (+15%)"`, si `< 1.0` → `" (-15%)"`, sinon aucun suffixe
    - Ajouter le suffixe au texte existant `"min-max"` → `"45-52 (+15%)"`
    - Pas de nouvelle couleur ni constante visuelle spécifique (utiliser les constantes de texte existantes)

## Critères de complétion

- `pnpm test` passe sans régression (tous les tests existants continuent de fonctionner)
- `pnpm typecheck` et `pnpm lint` retournent 0 erreur
- Un Pokemon attaqué de dos affiche `(+15%)` dans le preview dégâts
- Un Pokemon attaqué de face affiche `(-15%)` dans le preview dégâts
- Un Pokemon attaqué sur le flanc n'affiche aucun suffixe
- Les moves status (power=0) retournent `facingModifier: 1.0` sans calcul

## Out of scope

- Panel preview dédié montrant toutes les zones de facing autour du défenseur — tâche future
- Impact sur l'évasion ou la résistance aux statuts — décision validée
- Indicateur visuel sur la grille (flèches de direction, surbrillance de zone) — décision validée

## Risques / Questions

- `getAttackOrigin` est actuellement privée dans `defense-check.ts`. L'exporter ne casse rien mais c'est un changement d'API publique du module — vérifier qu'aucun test mock ne la shadowe.
- Pour `estimateDamage()` dans `BattleEngine`, le cas Blast nécessite `targetPosition` qui n'est pas dans la signature actuelle `(attackerId, moveId, defenderId)`. Solution proposée : utiliser la position du défenseur comme approximation de `targetPosition` pour l'estimation (acceptable, le défenseur est la cible du Blast).
- `processEffects` reçoit un contexte agrégé — vérifier si `facingModifier` doit être par-cible ou global. Comme chaque cible a sa propre orientation, le modifier doit être calculé par cible dans la boucle de `executeUseMove`.

## Dépendances

- Ce plan nécessite : Plan 051 terminé (terrainModifier dans calculateDamage — pattern identique)
- Ce plan débloque : Panel preview d'orientation tactique (tâche future)
