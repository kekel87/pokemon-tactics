---
status: done
created: 2026-03-20
updated: 2026-03-20
---

# Plan 004 — Résolution des effets d'attaque

## Objectif

Implémenter `submitAction(use_move)` dans le BattleEngine : formule de dégâts, type effectiveness, STAB, accuracy check, application des 4 types d'effets (damage, status, stat_change, link), déduction de PP, et activation de `use_move` dans `getLegalActions`. À la fin de ce plan, deux Pokemon peuvent se battre sur la grille avec les 16 attaques du roster POC.

## Contexte

Le Plan 003 a posé le BattleEngine avec move + skip_turn, le package data avec les 16 moves complets (targeting + effects), et la validation. Le `use_move` retourne actuellement `ActionError.NotImplemented`. Les targeting resolvers existent déjà (Plan 002). Ce plan branche la résolution d'effets sur le pipeline existant : `resolveTargeting` → `resolveEffects` → `emit(events)`.

### Règles (décisions prises)

- **Statuts** : règles Pokemon — 1 statut majeur max (burn, paralysis, poison, freeze, sleep), volatils illimités (confusion)
- **Durées** : comme Pokemon (sleep 1-3 tours aléatoire, freeze = chance de dégel chaque tour, burn/poison/paralysis = permanent jusqu'à guérison, confusion = 1-4 tours)
- **Paralysie tactique** : -50% initiative permanent. Chaque tour, 25% de chance de proc → quand ça proc, le Pokemon ne peut pas **bouger** (move action interdit) ni utiliser un **dash** (c'est un déplacement-attaque), mais peut toujours use_move (non-dash) et skip.
- **Stat stages** : -6 à +6, multiplicateurs Pokemon standards
- **Friendly fire complet** : les AoE appliquent **tous** les effets aux alliés dans la zone (dégâts ET statuts secondaires, ex: Bombe-Beurk empoisonne aussi les alliés)
- **Interaction terrain** : burn + eau = guéri (prévu mais implémenté en Phase 2)
- **Formule de dégâts** : formule Pokemon Gen 5+ simplifiée (pas de critiques pour le POC)
- **Tick statuts** (burn damage/tour, sleep countdown, freeze dégel) : hors scope — Plan 005

## Étapes

### Étape 1 — Stat stage multiplier + isMajorStatus helper

**Fichier** : `packages/core/src/battle/stat-modifier.ts`

- `getStatMultiplier(stages: number): number` — retourne le multiplicateur Pokemon pour un nombre de stages (-6 à +6)
- `getEffectiveStat(baseStat: number, stages: number): number` — applique le multiplicateur
- `clampStages(current: number, change: number): number` — clamp entre -6 et +6
- `isMajorStatus(status: StatusType): boolean` — retourne true pour burn, paralysis, poison, badly_poisoned, freeze, sleep. False pour confusion.

**Tests** :
- Stage 0 → multiplicateur 1
- Stage +1 → 1.5, +2 → 2, +6 → 4
- Stage -1 → 0.67, -2 → 0.5, -6 → 0.25
- clamp ne dépasse pas -6/+6
- isMajorStatus : burn/paralysis/poison/freeze/sleep = true, confusion = false

### Étape 2 — Formule de dégâts

**Fichier** : `packages/core/src/battle/damage-calculator.ts`

- `calculateDamage(attacker, defender, move, typeChart): number`
  - Formule : `(((2 * level / 5 + 2) * power * atk / def) / 50 + 2) * modifiers`
  - Level = 50 pour le POC (tous les Pokemon sont niveau 50)
  - `atk` = Attack ou SpAttack selon `move.category` (physical/special), ajusté par stat stages
  - `def` = Defense ou SpDefense selon `move.category`, ajusté par stat stages
  - Burn = halve physical attack (attacker brûlé → dégâts physiques /2)
  - Moves de catégorie `status` (power 0) → ne pas appeler `calculateDamage`, retourner 0 directement
- `getTypeEffectiveness(moveType, defenderTypes, typeChart): number` — produit des multiplicateurs
- `getStab(moveType, attackerTypes): number` — 1.5 si le type de l'attaque match un type de l'attaquant, 1 sinon
- Pas de critiques pour le POC
- Pas de randomness pour le POC (pas de roll 85-100%)

**Dépendance** : le `typeChart` doit être injecté dans le `BattleEngine` via le constructeur. Restaurer `moveRegistry` comme propriété privée (retirer le `_` prefix). Ajouter `typeChart` comme second paramètre de données.

**Tests** :
- Dégâts neutres (effectiveness 1x)
- Super effective (2x) et not very effective (0.5x)
- Immunité (0x) → 0 dégâts
- STAB (1.5x)
- Burn réduit les dégâts physiques
- Move status (power 0) → 0 dégâts, processDamage non appelé
- Stat stages affectent le calcul

### Étape 3 — Accuracy check

**Fichier** : `packages/core/src/battle/accuracy-check.ts`

- `checkAccuracy(move, attacker, defender): boolean`
  - Formule Pokemon : `moveAccuracy * accuracyMultiplier(attacker) / evasionMultiplier(defender)`
  - Si accuracy = 100 et pas de modifs de stages → toujours touche
  - Sinon → random check
- Pour le POC : les attaques à 100% accuracy touchent toujours. Les autres (Sleep Powder 75%, Razor Leaf 95%) utilisent `Math.random()`, seed-based viendra avec le replay.

**Tests** :
- Accuracy 100, pas de stages → toujours hit
- Accuracy < 100 → peut miss (mock Math.random)
- Evasion +1 sur le defender → taux réduit
- Accuracy +1 sur l'attacker → taux augmenté

### Étape 4 — Effect processors

**Fichier** : `packages/core/src/battle/effect-processor.ts`

Chaque `kind` d'Effect a un processor. Un processor prend l'état du combat et retourne des `BattleEvent[]`.

- `processDamage(attacker, targets, move, state, typeChart): BattleEvent[]`
  - Ignoré si `move.category === Category.Status` (pas d'appel à calculateDamage)
  - Pour chaque cible : calcule les dégâts, réduit les HP, émet `DamageDealt`
  - Si HP ≤ 0 : émet `PokemonKo` (pas de countdown pour le POC, juste KO)
  - Continue le traitement des autres cibles même si une meurt (KO mid-AoE)

- `processStatus(attacker, targets, effect, state): BattleEvent[]`
  - Check chance (roll aléatoire via Math.random)
  - Si la cible a déjà un statut majeur (`isMajorStatus`) et le nouveau statut est aussi majeur → skip
  - Sinon : applique le statut, émet `StatusApplied`
  - Durée : sleep = random 1-3 tours, confusion = random 1-4 tours, autres = null (permanent)
  - S'applique aussi aux alliés en zone (friendly fire complet)

- `processStatChange(attacker, targets, effect, state): BattleEvent[]`
  - Applique les stages (clamp -6/+6) sur self ou targets selon `effect.target`
  - Émet `StatChanged` pour chaque modification

- `processLink(attacker, targets, effect, state): BattleEvent[]`
  - Crée un `ActiveLink` dans `BattleState.activeLinks`
  - Émet `LinkCreated`

**Tests** :
- Damage réduit les HP, émet DamageDealt avec le bon montant
- Damage KO → émet PokemonKo
- Damage KO mid-AoE → continue sur les autres cibles
- Status respecte le 1-majeur-max (pas d'override d'un statut majeur existant)
- Status respecte la chance (30% → ne s'applique pas toujours, mock Math.random)
- Status s'applique aux alliés en friendly fire
- StatChange clamp à -6/+6
- StatChange sur self vs targets
- Link crée un ActiveLink dans l'état
- Move status ne déclenche pas processDamage

### Étape 5 — executeUseMove dans BattleEngine

**Dans** `BattleEngine.ts`

- Restaurer `moveRegistry` comme `private readonly` (retirer le `_` prefix du constructeur)
- Ajouter `typeChart` au constructeur : `constructor(state, moveRegistry, typeChart)`
- Implémenter `executeUseMove(pokemon, moveId, targetPosition): ActionResult`
  - Valide : le Pokemon possède ce move, PP > 0, target valide
  - Déduit 1 PP
  - Résout le targeting : `resolveTargeting(move.targeting, caster, targetPos, grid, traversalContext)`
  - Pour chaque tile affectée : collecte les Pokemon présents (alliés ET ennemis — friendly fire)
  - Check accuracy pour chaque cible
  - Pour chaque effect du move, appelle le processor correspondant (dans l'ordre du tableau `effects`)
  - Émet les events dans l'ordre : MoveStarted, (DamageDealt | StatusApplied | StatChanged | LinkCreated | MoveMissed)*, TurnEnded, TurnStarted
  - Met à jour l'orientation du caster vers la cible

**Nouveaux ActionError** :
- `UnknownMove`
- `NoPpLeft`
- `InvalidTarget`

**Tests** :
- Use move valide → dégâts appliqués, PP déduit, events émis
- Use move sans PP → rejeté
- Use move avec move inconnu → rejeté
- Use move sur cible hors de portée → rejeté
- Attaque status (Sleep Powder) → statut appliqué, pas de dégâts
- Attaque AoE (Sludge Bomb cross) → touche plusieurs cibles
- Friendly fire → alliés touchés par dégâts ET statuts
- Miss → MoveMissed émis, pas de dégâts

### Étape 6 — Activer use_move dans getLegalActions

**Dans** `BattleEngine.ts`

- Pour chaque move du Pokemon actif avec PP > 0 :
  - Générer les positions de cible valides selon le targeting pattern :
    - `single` : toutes les positions dans la range (occupées ou non — on peut viser une tile vide qui sera occupée au moment de l'action)
    - `self` : une seule action (la position du caster)
    - `zone` : une seule action (centrée sur le caster)
    - `cone` : 4 actions (une par direction cardinale)
    - `line` : 4 actions (une par direction cardinale)
    - `dash` : 4 actions (une par direction cardinale)
    - `cross` : toutes les positions dans la range (comme single — le centre de la croix)
  - Ajouter une action `use_move` par position/direction valide
- **Paralysie** : si la paralysie proc ce tour, les actions `move` (déplacement) ET `dash` (use_move avec targeting dash) sont retirées. Les autres use_move restent.

**Tests** :
- Pokemon avec 4 moves → actions use_move listées pour chaque move
- Move sans PP → pas listé
- Single range 1-3 → positions à distance 1, 2 et 3
- Self → une seule action
- Cone → 4 actions (une par direction)
- Dash → 4 actions (une par direction)
- Pokemon paralysé (proc) → pas de move ni de dash, mais use_move non-dash OK

### Étape 7 — Test d'intégration combat complet

**Fichier** : `packages/core/src/battle/combat.integration.test.ts`

Test d'intégration qui simule un combat entre Bulbasaur et Charmander :
1. Charger les données via `loadData()` + `typeChart`
2. Placer les deux Pokemon sur une grille 8x8
3. Charmander utilise Ember sur Bulbasaur → vérifier les dégâts (super effective Feu > Plante)
4. Bulbasaur utilise Razor Leaf sur Charmander → vérifier les dégâts (pas très efficace Plante > Feu)
5. Vérifier les events émis, les HP restants, les PP déduits
6. Vérifier que les stat stages sont à 0 après des attaques normales

## Critères de complétion

- `submitAction(use_move)` fonctionne avec les 16 attaques du roster
- `getLegalActions` retourne les `use_move` avec les positions valides
- Formule de dégâts conforme à Pokemon (type effectiveness, STAB, stat stages)
- Statuts : 1 majeur max, durées Pokemon, friendly fire complet
- Stat stages : -6 à +6, multiplicateurs Pokemon
- Links (Vampigraine) créés dans l'état
- PP déduits après chaque attaque
- Paralysie bloque move + dash mais pas les autres use_move
- 100% coverage maintenu sur le core
- Test d'intégration prouve un combat fonctionnel

## Risques / Questions

- **Random** : pour le POC, `Math.random()` suffit. Le système de seed pour les replays viendra plus tard. Les tests qui dépendent du random doivent mocker `Math.random`.
- **KO** : dans ce plan, KO = le Pokemon est retiré du jeu. Le countdown FFTA viendra dans un plan ultérieur.
- **Interaction terrain/statut** : prévue (brûlure + eau = guéri) mais implémentée en Phase 2.
- **Critiques** : pas dans ce plan. Les dégâts sont déterministes (pas de roll 85-100%, pas de crit).
- **Ordre des effets** : dans l'ordre du tableau `effects` du move. Si un futur move a besoin d'un ordre différent, on ajoutera un champ `priority` par effect.
- **Tick statuts** (burn damage/tour, sleep countdown, freeze dégel) : Plan 005. Ce plan applique les statuts mais ne les résout pas en début de tour.
- **BadlyPoisoned** : l'enum existe mais aucune attaque du roster POC ne l'utilise. Hors scope — à discuter quand on ajoutera des attaques qui l'infligent.
- **Confusion** : l'enum existe, pas dans le roster POC. Idée future : le Pokemon confus exécute une action aléatoire (attaque alliés, bouge n'importe où).
- **Combo Poudre Dodo + Vampigraine** : cible endormie ne peut pas fuir le lien → 3 tours de drain garanti. Premier combo fort à surveiller lors des tests headless.
- **Signature BattleEngine** : le constructeur change (`moveRegistry` et `typeChart` ajoutés). Les tests existants qui passent `new Map()` devront être mis à jour.

## Dépendances

- **Avant ce plan** : Plan 003 (BattleEngine, data, targeting resolvers)
- **Ce plan débloque** :
  - Plan 005 — Boucle de combat complète (tick statuts, condition de victoire, KO countdown)
  - Phase 1 — Multiples Pokemon par équipe, hot-seat
  - IA random (peut itérer getLegalActions et soumettre des use_move)
