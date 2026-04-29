# Plan 070 — Polish des talents (visuels + bugs)

> Statut : done
> Phase : 4 (suite du plan 069)

## Contexte

Suite au playtest du plan 069, l'humain a remonté 11 issues sur les talents : visuels manquants, gameplay incorrect, tests d'intégration trop minces.

## Objectif

1. **Bugs gameplay** : Lévitation, Tempo Perso, Matinal, Engrais/Brasier/Torrent.
2. **Visuels** : floating text + battle log pour CHAQUE activation de talent.
3. **Tests d'intégration** : couvrir les 20 talents avec des scénarios Gherkin.

## Issues remontées

| # | Talent | Issue | Type |
|---|--------|-------|------|
| 1 | Cran (Guts) | Pas de visuel quand boost se déclenche | Visuel |
| 2 | Engrais/Brasier/Torrent | Pas de diff de dégâts visible avec PV bas | Vérif + Visuel |
| 3 | Regard Vif | Bloque mais pas de floating text | Visuel |
| 4 | Lévitation | Bloque mouvement vers lava/deep water, brûle sur magma | Bug |
| 5 | Corps Sain | Bloque mais pas de floating text | Visuel |
| 6 | Fermeté | Sauve à 1 PV mais pas de floating text | Visuel |
| 7 | Adaptabilité, Technicien | Aucune visibilité, dur à tester | Visuel |
| 8 | Tempo Perso | Ne bloque pas Intimidation, pas de floating text | Bug + Visuel |
| 9 | Matinal | Sommeil = 3 tours en sandbox au lieu de réduit | Bug + Visuel |
| 10 | Tous | Pas d'entrée dans le journal de combat | Visuel |
| 11 | Tous | Tests d'intégration insuffisants | Tests |

## Architecture — émission de `AbilityActivated` pour les passifs

**Problème** : les hooks passifs (`onDamageModify`, `onStatChangeBlocked`, `onAccuracyModify`, `onStatusBlocked`, `onStatusDurationModify`, `onTypeImmunity`) retournent un `number` ou `boolean` — pas de canal d'événement. Donc aucun `AbilityActivated` n'est émis pour Engrais, Brasier, Torrent, Cran, Adaptabilité, Technicien, Isograisse, Regard Vif, Corps Sain, Tempo Perso, Matinal, Lévitation, Fermeté.

**Solution choisie (best-practices, pattern Showdown)** : **return type unifié** — chaque hook passif retourne `{ value, events: BattleEvent[] }`. Cohérent avec les hooks actifs (`onAfterDamageReceived` retourne déjà `BattleEvent[]`). Chaque ability décide elle-même quand émettre ses événements. Future-proof : ajouter un 7e hook suit le même pattern. Validé par le code source de Pokemon Showdown (chaque ability émet ses propres messages depuis le hook).

**Format des nouveaux types** :
```ts
interface DamageModifyResult { multiplier: number; events: BattleEvent[]; }
interface BlockResult { blocked: boolean; events: BattleEvent[]; }
interface DurationModifyResult { duration: number; events: BattleEvent[]; }
interface AccuracyModifyResult { multiplier: number; events: BattleEvent[]; }
```

**Format battle log + floating text** : "Engrais de Bulbizarre s'active !" (FR) / "Bulbasaur's Overgrow activated!" (EN)

**Anti-spam pour Engrais/Brasier/Torrent** : émettre `AbilityActivated` **uniquement à la première fois où le seuil 1/3 PV est franchi**. Ajouter un flag `pinchAbilityTriggered: boolean` sur `PokemonInstance` pour mémoriser. Réinitialisé si HP repasse au-dessus du seuil (le talent peut re-déclencher si on perd du PV à nouveau).

**Call sites concernés** :
- `damage-calculator.ts` ligne 64 + 75 — si `attackerAbility.onDamageModify(ctx) !== 1.0` ou `defenderAbility.onDamageModify(ctx) !== 1.0` → push `AbilityActivated`
- `handle-stat-change.ts` ligne 21 — si `onStatChangeBlocked` retourne `true` → push `AbilityActivated`
- `handle-status.ts` ligne 75 — si `onStatusBlocked` retourne `true` → push `AbilityActivated`
- `handle-status.ts` ligne 100/122 — si `onStatusDurationModify` change la valeur → push `AbilityActivated`
- `handle-damage.ts` (à vérifier) — si `onTypeImmunity` retourne `true` → push `AbilityActivated`
- `damage-calculator.ts` (Sturdy) — si l'ability réduit à 1 HP → push `AbilityActivated`

**Note** : pour `onDamageModify`, accumuler les events pendant le calcul (un par ability qui modifie) et les renvoyer dans un `damageContext.events` collecté par `processEffects`.

## Bugs spécifiques

### Lévitation (#4)

`canEnterTerrain`/`canStopOn` dans `height-traversal.ts` ignorent `isFlying` pour les terrains non-passable (lava, deep water). Fix :

```ts
// Avant
if (!isTerrainPassable(terrain)) return immuneTerrains?.has(terrain) ?? false;
// Après
if (!isTerrainPassable(terrain)) return isFlying || (immuneTerrains?.has(terrain) ?? false);
```

Magma burn dans `BattleEngine.executeMove` ligne 1170 : ajouter `|| this.isEffectivelyFlying(pokemon)` au check d'immunité. Idem `terrain-tick-handler.ts` ligne 48 et `getTerrainStatusOnStop`.

### Tempo Perso (#8)

`onStatusBlocked` ne couvre que les statuts qui passent par le pipeline. Intimidate applique son volatile **directement** dans `intimidate.onAuraCheck`. Fix : dans `intimidate.onAuraCheck`, vérifier `target.abilityId === "own-tempo"` et skip + émettre `AbilityActivated` côté Tempo Perso.

Ajouter aussi `Intimidated` dans la condition de `ownTempo.onStatusBlocked` (au cas où Intimidate passe par le pipeline status à l'avenir).

### Matinal (#9)

À vérifier : pourquoi le sommeil dure 3 tours alors que `earlyBird.onStatusDurationModify` retourne `Math.ceil(duration / 2)`. Hypothèses :
- Le hook n'est pas appelé pour ce statut
- La durée passée est déjà la durée réduite par-tour (ex: `remainingTurns` décrémenté)
- L'ability n'est pas chargée correctement sur le Pokemon

À investiguer : ajouter un log temporaire ou un test d'intégration.

Recherche Champions : sleep `sample([2,3,3])` = 2 ou 3 tours (équiprobable 50/50 puisque trois entrées avec 3 doublé). Early Bird en VGC moderne = halve sleep. Donc 2 tours → 1 tour, 3 tours → 2 tours.

### Engrais/Brasier/Torrent (#2)

À vérifier : le seuil 1/3 HP est-il atteint dans le sandbox de l'humain ? Le multiplier 1.5x est-il bien appliqué dans le calcul de dégâts ? Test d'intégration explicite avec assertion sur le ratio de dégâts.

## Étapes

### Étape 1 — Bugs gameplay (sans visuels)

- [ ] Lévitation : `canEnterTerrain`, `canStopOn`, magma burn, terrain-tick-handler
- [ ] Tempo Perso : skip dans `intimidate.onAuraCheck`
- [ ] Matinal : investigation, fix selon root cause
- [ ] Engrais/Brasier/Torrent : tests d'intégration pour confirmer ou infirmer le bug

### Étape 2 — Émission `AbilityActivated` pour les passifs

- [ ] Refactor : `damage-calculator.ts` retourne `{ damage, events: BattleEvent[] }` (events accumulés des hooks)
- [ ] `handle-stat-change.ts` : émettre `AbilityActivated` quand block
- [ ] `handle-status.ts` : émettre `AbilityActivated` quand `onStatusBlocked` ou `onStatusDurationModify`
- [ ] `handle-damage.ts` : émettre quand `onTypeImmunity`
- [ ] Sturdy : émettre dans le damage calculator (déjà spécial)

### Étape 3 — Visuel renderer

- [ ] Vérifier que `GameController` traite `AbilityActivated` pour tous les call sites
- [ ] Battle log entries (FR/EN) : "X active <Talent> !"
- [ ] Floating text déjà en place — confirmer qu'il s'affiche pour tous

### Étape 4 — Tests d'intégration

Un fichier `abilities-polish.integration.test.ts` ou étendre l'existant. Pour chaque talent :
- Activation correcte (gameplay)
- Émission de `AbilityActivated`
- Bonus/blocage chiffrable (ex: dégâts ×1.5 pour Engrais à PV bas)

Couverture cible : 1-2 tests par talent (20 + edge cases) → ~30 tests scénario.

### Étape 5 — Validation playtest

Sandbox JSON pour chaque talent, l'humain confirme visuellement.

## Risques

- Refactor `onDamageModify` peut toucher beaucoup de code. Alternative : émettre dans `damage-calculator.ts` directement (events séparés du return type).
- Battle log : la structure i18n peut nécessiter des clés par ability.
- Matinal : si le bug est dans le pipeline de statut (ex: durée écrasée ailleurs), le fix peut être plus large.

## Ordre d'exécution proposé

1. Bugs gameplay simples (Lévitation, Tempo Perso) — petits, non controversés
2. Investigation Matinal — log si nécessaire
3. Refactor émission `AbilityActivated` (gros morceau)
4. Battle log
5. Tests d'intégration
6. Validation humain
