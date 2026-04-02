---
status: done
created: 2026-04-01
updated: 2026-04-02
---

# Plan 026 — Nouvelles mécaniques core : badly_poisoned, confusion tactique, bind, knockback, multi-hit

## Objectif

Implémenter 6 nouvelles mécaniques core + 17 nouveaux moves qui les utilisent. Compléter les tâches Phase 1 ouvertes de `roadmap.md` (statuts volatils, poison grave, stat changes +2, moves AoE variés, recharge).

Les 8 nouveaux Pokemon et sprites sont dans le plan 027 (séparé).

## Contexte

Le plan 025 a posé l'infrastructure de tests d'intégration par move. Le socle est solide : 9 patterns, 5 statuts majeurs, stat stages, 8 moves défensifs. `StatusType.Confused` et `StatusType.BadlyPoisoned` existent déjà dans l'enum mais ne sont pas branchés.

**Source traductions FR** : `packages/data/src/i18n/moves.fr.json` — 938 moves officiels (source PokeAPI).

## Décisions techniques validées

| # | Décision | Choix | Raison |
|---|----------|-------|--------|
| D1 | Stockage statuts volatils | Champ `volatileStatuses: VolatileStatus[]` sur `PokemonInstance` | Séparé des statuts majeurs, extensible pour flinch/provoc futurs |
| D2 | Stockage compteur toxic | Champ `toxicCounter: number` sur `PokemonInstance` | Cohérent avec le pattern existant (`leechSeedSource`) |
| D3 | Bind : LinkType ou EffectKind ? | Extension `LinkType.Bind` via `EffectKind.Link` existant. Ajouter `immobilize?: boolean` et `drainToSource?: boolean` sur `ActiveLink` | Bind EST un lien (lanceur↔cible, rupture distance/KO). Vampigraine a `drainToSource: true`, Bind a `immobilize: true`. Extensible pour futurs liens. Les dégâts de bind ne heal PAS le lanceur. |
| D4 | Confusion : où intercepter ? | Dans `submitAction`, avant `executeUseMove` | Modifie l'action soumise (cible/direction) puis exécute normalement. Events émis pour le renderer |
| D5 | Knockback + corps KO | Bloqué (corps KO = tile non-stoppable) | Cohérent avec plan 011 : les corps sont traversables mais on ne peut pas s'y arrêter |
| D6 | VolatileStatus enum | Réutiliser `StatusType` existant (confused est déjà dedans) | La distinction majeur/volatil se fait par le stockage (`status` vs `volatileStatuses[]`), pas par l'enum |
| D7 | Ultralaser recharge | Après utilisation, le Pokemon ne peut pas attaquer (Act) au tour suivant, mais peut se déplacer (Move) | Flag `recharging: boolean` sur `PokemonInstance`, bloque les actions `use_move` dans `getLegalActions`, reset en EndTurn du tour de recharge |

## Nouveaux moves — tableau complet

### Nouvelles mécaniques core

| Move ID | Nom FR | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Effet |
|---------|--------|------|------|--------|-------|----|--------|---------|-------|
| `toxic` | Toxik | Poison | Statut | — | 90 | 10 | 1-2 | single | **badly_poisoned** 100% |
| `supersonic` | Ultrason | Normal | Statut | — | 55 | 20 | 1-3 | single | **confused** 100% |
| `swords-dance` | Danse-Lames | Normal | Statut | — | 100 | 20 | self | self | **+2 Attaque** |
| `iron-defense` | Mur de Fer | Acier | Statut | — | 100 | 15 | self | self | **+2 Défense** |
| `double-kick` | Double Pied | Combat | Phys | 30 | 100 | 30 | 1 | single | **multi-hit x2 fixe** |
| `fury-swipes` | Combo-Griffe | Normal | Phys | 18 | 80 | 15 | 1 | single | **multi-hit 2-5** (35/35/15/15%) |
| `hyper-beam` | Ultralaser | Normal | Spé | 150 | 90 | 5 | ligne 5 | ligne | nuke ligne longue, **recharge** (pas d'Act au tour suivant) |
| `dragon-tail` | Draco-Queue | Dragon | Phys | 60 | 90 | 10 | 1 | slash | arc frontal + **knockback 1 case** |
| `wrap` | Ligotage | Normal | Phys | 15 | 90 | 20 | 1 | single | **bind** : immobilise 2-3 tours, 1/16 HP/tour, brise si lanceur s'éloigne (adj. requis) |

### Debuffs AoE

| Move ID | Nom FR | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Effet |
|---------|--------|------|------|--------|-------|----|--------|---------|-------|
| `growl` | Rugissement | Normal | Statut | — | 100 | 40 | 1-3 | cône | -1 Atk ennemis |
| `roar` | Hurlement | Normal | Statut | — | 100 | 20 | 1-3 | cône | -1 Atk ennemis |
| `flash` | Flash | Normal | Statut | — | 100 | 20 | self | zone r2 | -1 Précision, **friendly fire** |
| `acid` | Acide | Poison | Spé | 40 | 100 | 20 | 1-2 | cône | dégâts + -1 Déf Spé 10% |

### Moves physiques

| Move ID | Nom FR | Type | Cat. | Puiss. | Préc. | PP | Portée | Pattern | Effet |
|---------|--------|------|------|--------|-------|----|--------|---------|-------|
| `earthquake` | Séisme | Sol | Phys | 100 | 100 | 10 | self | zone r2 | AoE massive, friendly fire |
| `mega-punch` | Ultimapoing | Normal | Phys | 80 | 85 | 20 | 1 | single | mêlée puissante |
| `slash` | Tranche | Normal | Phys | 70 | 100 | 20 | 1 | slash | arc frontal 3 cases |
| `poison-sting` | Dard-Venin | Poison | Phys | 15 | 100 | 35 | 1 | single | poison 30% |

## Nouvelles mécaniques core — spécifications détaillées

### 1. Badly Poisoned (`badly_poisoned`)

**Statut majeur** (exclusif avec les autres statuts majeurs).

- Compteur `toxicCounter` sur `PokemonInstance`, démarre à 1, +1 par tour, plafonne à 15
- Dégâts par tour = `max(1, floor(maxHp * toxicCounter / 16))`
- Le compteur se reset à 0 si le statut est retiré
- Seule source actuelle : Toxik (Tentacool)

| Tour | Dégâts | % HP max |
|------|--------|----------|
| 1 | 1/16 | 6.25% |
| 2 | 2/16 | 12.5% |
| 3 | 3/16 | 18.75% |
| 4 | 4/16 | 25% |
| 5 | 5/16 | 31.25% |

**Contremesures futures (hors scope)** : Repos, Régénération, Glas de Soin, Psycho-Transfert.

### 2. Confusion tactique (`confused`)

**Statut volatil** — stocké dans `volatileStatuses[]` sur `PokemonInstance`. Coexiste avec un statut majeur.

Dure 2-5 tours. Chaque tour : 50% de chance que l'action déraille.

| Situation | Comportement si confusion déclenche |
|-----------|--------------------------------------|
| Attaque single/dash | Cible redirigée vers un **allié aléatoire à portée** (le vrai move est utilisé) |
| Attaque AoE (cône, ligne, slash) | **Direction aléatoire** |
| Attaque zone self | Exécutée normalement (le friendly fire gère) |
| Aucun allié à portée | **Tour perdu** |
| Buff self | Fonctionne normalement |
| Déplacement | Direction aléatoire, 1-2 cases |

**Interception** : dans `submitAction`, avant `executeUseMove`. L'action soumise est modifiée (cible/direction) puis exécutée normalement via le pipeline existant.

**Events pour le renderer** :

| Event | Quand | Données |
|-------|-------|---------|
| `ConfusionTriggered` | La confusion se déclenche | `{ pokemonId }` |
| `ConfusionRedirected` | L'attaque est redirigée | `{ pokemonId, originalTarget, newTarget }` ou `{ pokemonId, originalDirection, newDirection }` |
| `ConfusionResisted` | Le Pokemon résiste (50% chance) | `{ pokemonId }` |
| `ConfusionFailed` | Aucun allié à portée, tour perdu | `{ pokemonId, reason: "no_ally_in_range" }` |

Seule source actuelle : Ultrason (Nidoran♂), précision 55%.

### 3. Bind (immobilisation via Ligotage)

**Extension de `LinkType`** : ajouter `LinkType.Bind`.

Utilise `EffectKind.Link` existant avec les paramètres :
- `linkType: LinkType.Bind`
- `duration: { min: 2, max: 3 }` (tours)
- `maxRange: 1` (adjacence requise)
- `damagePerTurn: 1/16 HP max`
- `immobilize: true` (bloque le Move action dans `getLegalActions`)

Comportement :
- Empêche le déplacement (Move action) de la cible
- Dégâts passifs 1/16 HP en EndTurn
- **Brise si** : lanceur > distance 1, lanceur KO, durée expirée
- Ne bloque pas l'Act (la cible peut encore attaquer)

**Events** :

| Event | Quand | Données |
|-------|-------|---------|
| `BindApplied` | Ligotage posé | `{ sourceId, targetId }` |
| `BindDamage` | Dégâts passifs en EndTurn | `{ targetId, damage }` |
| `BindBroken` | Lien brisé | `{ sourceId, targetId, reason: "distance" \| "ko" \| "expired" }` |

### 4. Knockback (poussée via Draco-Queue)

**Nouveau `EffectKind.Knockback`** dans l'union Effect :
```typescript
{ kind: typeof EffectKind.Knockback; distance: number }
```

Comportement :
- S'exécute **après** les dégâts dans le pipeline d'effets
- Pousse chaque cible de N cases dans la direction opposée au lanceur
- **Bloqué si** : bord de grille, tile occupée (allié, ennemi, corps KO)
- Si bloqué : pas de déplacement, les dégâts sont infligés normalement
- Avec le pattern slash : chaque cible est poussée individuellement selon sa position relative au lanceur

**Events** :

| Event | Quand | Données |
|-------|-------|---------|
| `KnockbackApplied` | Cible poussée | `{ pokemonId, from, to }` |
| `KnockbackBlocked` | Poussée bloquée | `{ pokemonId, reason: "edge" \| "occupied" }` |

### 5. Multi-hit

**Nouveau champ optionnel `hits`** sur le variant `Damage` de l'union Effect :
```typescript
{ kind: typeof EffectKind.Damage; hits?: number | { min: number; max: number } }
```

Comportement :
- `hits: 2` → fixe (Double Pied) : 2 events de dégâts
- `hits: { min: 2, max: 5 }` → variable (Combo-Griffe) : roll 35/35/15/15%
- Un seul accuracy check au début (pas par hit)
- Chaque hit = event `DamageDealt` séparé (peut trigger Riposte/Voile Miroir)
- Stop si cible KO avant la fin des hits

**Events** :

| Event | Quand | Données |
|-------|-------|---------|
| `DamageDealt` | Chaque hit (existant) | `{ attackerId, targetId, damage, ... }` |
| `MultiHitComplete` | Fin de la séquence | `{ attackerId, targetId, totalHits }` |

### 6. Recharge (Ultralaser)

**Flag `recharging: boolean`** sur `PokemonInstance` (défaut `false`).

Comportement :
- Après utilisation d'un move avec `recharge: true`, le flag est mis à `true`
- Au tour suivant : `getLegalActions` ne retourne aucune action `use_move` (le Pokemon ne peut pas attaquer)
- Le Pokemon **peut** se déplacer (Move action) et choisir sa direction de fin de tour
- Le flag est reset à `false` en EndTurn du tour de recharge
- Si le Pokemon est KO pendant la recharge, le flag est sans effet

**Nouveau champ optionnel sur le move** (dans `tacticalOverrides`) : `recharge: true`

**Events** :

| Event | Quand | Données |
|-------|-------|---------|
| `RechargeStarted` | Après exécution du move | `{ pokemonId }` |
| `RechargeEnded` | Fin du tour de recharge | `{ pokemonId }` |

## Étapes

### Étape 1 — Badly poisoned (core + move + test)

- Ajouter `toxicCounter: number` (défaut 0) sur `PokemonInstance`
- Modifier `statusTickHandler` : gérer `StatusType.BadlyPoisoned` (formule, incrément compteur)
- Vérifier que `isMajorStatus` inclut `badly_poisoned`
- Ajouter le move `toxic` dans `baseMoves` + `tacticalOverrides`
- Tests mécaniques dans `packages/core/src/battle/mechanics/poison-status.test.ts`
- Test d'intégration `packages/core/src/battle/moves/toxic.test.ts`

### Étape 2 — Confusion tactique (core + move + test)

- Ajouter `volatileStatuses: VolatileStatus[]` sur `PokemonInstance` (type à créer)
- Créer le type `VolatileStatus` : `{ type: StatusType; remainingTurns: number }`
- Modifier `submitAction` : check confusion avant `executeUseMove`, rediriger l'action
- Émettre les events : `ConfusionTriggered`, `ConfusionRedirected`, `ConfusionResisted`, `ConfusionFailed`
- Gérer le décrément et le retrait en fin de tour
- Ajouter le move `supersonic` dans `baseMoves` + `tacticalOverrides`
- Tests mécaniques dans `packages/core/src/battle/mechanics/confusion-status.test.ts`
  - Confusion sur un Pokemon avec allié à portée → redirige
  - Confusion sur un Pokemon seul → tour perdu
  - Confusion + AoE directionnel → direction aléatoire
  - Confusion + buff self → fonctionne normalement
  - Confusion expire après N tours
  - Confusion coexiste avec statut majeur (paralysie + confusion)
  - Confusion + déplacement → direction aléatoire
- Test d'intégration `packages/core/src/battle/moves/supersonic.test.ts`

### Étape 3 — Bind (core + move + test)

- Ajouter `LinkType.Bind` à l'enum
- Étendre `linkDrainHandler` (ou créer section dédiée) pour gérer le bind :
  - Dégâts 1/16 en EndTurn
  - Durée 2-3 tours, décrément
  - Rupture par distance > 1 ou KO lanceur
- Modifier `getLegalActions` : bloquer le Move action si la cible est bound
- Émettre les events `BindApplied`, `BindDamage`, `BindBroken`
- Ajouter le move `wrap` dans `baseMoves` + `tacticalOverrides`
- Tests dans `packages/core/src/battle/mechanics/bind-status.test.ts`
  - Bind empêche le déplacement
  - Bind n'empêche pas l'attaque
  - Bind brise si lanceur s'éloigne
  - Bind brise si lanceur KO
  - Bind inflige 1/16 HP par tour
  - Bind expire après durée
- Test d'intégration `packages/core/src/battle/moves/wrap.test.ts`

### Étape 4 — Knockback (core + move + test)

- Ajouter `EffectKind.Knockback` à l'enum
- Ajouter le variant dans l'union `Effect`
- Implémenter `handle-knockback.ts` : calcul direction, déplacement, blocage
- Enregistrer le handler dans `EffectHandlerRegistry`
- Émettre les events `KnockbackApplied`, `KnockbackBlocked`
- Ajouter le move `dragon-tail` dans `baseMoves` + `tacticalOverrides`
- Tests dans `packages/core/src/battle/mechanics/knockback.test.ts`
  - Knockback pousse 1 case direction opposée
  - Knockback bloqué par bord de grille
  - Knockback bloqué par tile occupée (allié, ennemi, corps KO)
  - Knockback avec pattern slash (multi-cibles, directions individuelles)
  - Dégâts infligés même si knockback bloqué
- Test d'intégration `packages/core/src/battle/moves/dragon-tail.test.ts`

### Étape 5 — Multi-hit (core + moves + tests)

- Ajouter le champ optionnel `hits` sur le variant Damage de `Effect`
- Modifier `handle-damage.ts` ou `effect-processor.ts` : boucle hits, stop si KO
- Implémenter le roll variable (35/35/15/15%) pour `{ min, max }`
- Émettre `DamageDealt` x N + `MultiHitComplete`
- Ajouter les moves `double-kick` et `fury-swipes` dans `baseMoves` + `tacticalOverrides`
- Tests dans `packages/core/src/battle/mechanics/multi-hit.test.ts`
  - Multi-hit fixe x2 (Double Pied)
  - Multi-hit variable 2-5 (Combo-Griffe), distribution correcte
  - Stop si cible KO avant fin des hits
  - Chaque hit trigger individuellement Riposte/Voile Miroir
  - Un seul accuracy check au début
- Tests d'intégration `packages/core/src/battle/moves/double-kick.test.ts` et `fury-swipes.test.ts`

### Étape 6 — Recharge (core + move + test)

- Ajouter `recharging: boolean` (défaut `false`) sur `PokemonInstance`
- Modifier `getLegalActions` : si `recharging === true`, exclure toutes les actions `use_move`
- Après exécution d'un move avec `recharge: true` : mettre le flag à `true`, émettre `RechargeStarted`
- En EndTurn : si `recharging`, reset à `false`, émettre `RechargeEnded`
- Ajouter le move `hyper-beam` dans `baseMoves` + `tacticalOverrides` avec `recharge: true`
- Tests dans `packages/core/src/battle/mechanics/recharge.test.ts`
  - Après Ultralaser, le Pokemon ne peut pas attaquer au tour suivant
  - Le Pokemon peut se déplacer pendant la recharge
  - La recharge se termine en fin de tour
  - Si KO pendant la recharge, pas d'erreur
- Test d'intégration `packages/core/src/battle/moves/hyper-beam.test.ts`

### Étape 7 — Moves restants (données + tests d'intégration)

Moves sans nouvelle mécanique core — données uniquement :

- `swords-dance` : self, +2 Atk → test `swords-dance.test.ts`
- `iron-defense` : self, +2 Déf → test `iron-defense.test.ts`
- `growl` : cône 1-3, -1 Atk → test `growl.test.ts`
- `roar` : cône 1-3, -1 Atk → test `roar.test.ts`
- `flash` : zone r2 self, -1 Précision → test `flash.test.ts`
- `acid` : cône 1-2, dégâts + -1 Déf Spé 10% → test `acid.test.ts`
- `earthquake` : zone r2 self, 100 puiss. → test `earthquake.test.ts`
- `mega-punch` : single 1, 80 puiss. → test `mega-punch.test.ts`
- `slash` : slash 1, 70 puiss. → test `slash.test.ts`
- `poison-sting` : single 1, poison 30% → test `poison-sting.test.ts`

### Étape 8 — Documentation

- `docs/game-design.md` : sections confusion tactique, badly_poisoned, bind, knockback, multi-hit
- `docs/decisions.md` : décisions D1-D5 + confusion tactique (redirection alliés), Flash zone r2, Draco-Queue/Tranche slash, Combo-Griffe remplace Jackpot, Ligotage bind
- `docs/roadmap.md` : cocher les tâches Phase 1 concernées

## Critères de complétion

- [ ] `statusTickHandler` gère `badly_poisoned` (dégâts croissants)
- [ ] Confusion tactique implémentée (redirection alliés, direction aléatoire, skip si aucun allié)
- [ ] `volatileStatuses[]` sur `PokemonInstance`
- [ ] Bind implémenté via `LinkType.Bind` (immobilisation + dégâts/tour + rupture distance)
- [ ] Knockback implémenté (poussée, blocage obstacles, events)
- [ ] Multi-hit implémenté (fixe x2 + variable 2-5 avec probabilités)
- [ ] Recharge implémenté (bloque Act, autorise Move, reset en EndTurn)
- [ ] Events renderer-ready pour chaque mécanique
- [ ] 17 nouveaux moves dans `packages/data`
- [ ] 17 fichiers de tests d'intégration moves
- [ ] `pnpm test` passe — aucune regression

## Risques

- **Confusion + stabilité du pipeline** : rediriger une attaque dans `submitAction` nécessite de re-résoudre le targeting avec une nouvelle cible. Risque de double émission d'events ou PP consommés deux fois. Mitigation : modifier l'action AVANT l'exécution, pas pendant.
- **Confusion + paralysie** : si le Pokemon est paralysé ET confus, quel check se fait en premier ? Réponse : paralysie d'abord (comme dans les jeux). Si paralysé, skip le tour sans check confusion.
- **ID earthquake** : Machop utilise `seismic-toss` (Frappe Atlas), pas `earthquake`. Pas de conflit.
- **Bind + Vampigraine factorisation** : le handler `linkDrainHandler` va grossir. Prévoir des sous-fonctions propres par type de lien.

## Dépendances

- **Avant** : plan 025 terminé (infrastructure tests d'intégration) — OK
- **Après** : plan 027 (8 nouveaux Pokemon + sprites + doc roster)
