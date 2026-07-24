# Plan 171 — Zone Magique canonique complète

**Statut : done**

## Problème

Le chokepoint `effectiveHeldItem(state, pokemon, registry)` (`packages/core/src/battle/effective-held-item.ts`) neutralise l'objet tenu d'un mon sous Zone Magique (magic-room). Adoption partielle (décision #714) : seuls les effets audités passent par lui. ~16 lectures d'effet d'objet appellent encore `itemRegistry.getForPokemon(...)` en direct → **non neutralisées** par Zone Magique, alors qu'elles devraient l'être canoniquement.

## Audit (2026-07-24)

Recompté depuis la source. Réalité meilleure que le backlog — plusieurs sites soupçonnés étaient **déjà couverts** :
- `damage-calculator.ts:156/230`, `handle-damage.ts:326/343/739`, `accuracy-check.ts:93/99` → déjà gardés via `fieldGlobal.*ItemSuppressed` ou `isHeldItemSuppressed` inline. Rien à faire.

### À router — `state` déjà en scope (refacto mécanique)

| Fichier:ligne | Effet | Mon |
|---|---|---|
| `effect-processor.ts:265` | `onMoveImmunity` (Lunettes Filtre vs poudre) | target |
| `effect-processor.ts:303` | `onTypeImmunity` (Ballon, immunité Sol) | target |
| `effect-processor.ts:429` | `onStatLowered` | pokemon (loweredPokemonIds) |
| `effect-processor.ts:463` | `onFlinchChance` (Roche Royale/Croc Rasoir) | attacker |
| `effect-processor.ts:502` | `onAfterMoveUse` (Spray Gorge) | attacker |
| `handle-drain.ts:54` | `onDrainHealModify` (Grosse Racine) | pokemon |
| `weather-tick-handler.ts:71` | `immuneToWeatherDamage` (Lunettes Filtre) | pokemon |
| `handle-fling-item.ts:15` | `flingPower`/`onFling`/`isBerry` (Lancer/Dégommage) | attacker |
| `handle-stat-change.ts:52` | `onStatChangeBlocked` (Talisman Sain) | pokemon |
| `handle-damage.ts:675` | `maximizesMultiHit` (Dé Pipé) | attacker |
| `BattleEngine.ts:943` | `forbidsStatusMoves` (Veste de Combat) | currentPokemon |
| `BattleEngine.ts:1035` | `flingPower` (légalité Dégommage) | currentPokemon |
| `BattleEngine.ts:1496` | `forbidsStatusMoves` (guard submitAction) | pokemon |
| `BattleEngine.ts:1596` | `flingPower` (guard submitAction) | pokemon |
| `BattleEngine.ts:3039` | `onTerrainTick` (brûlure Magma en déplacement) | pokemon |
| `BattleEngine.ts:4118` | `onMoveLock` (verrou objet Choice) | pokemon |

### À router — changement de signature mineur (threader `state`)

- `terrain-tick-handler.ts:38/71` — ajouter `state` à `applyTerrainStatus`/`applyTerrainDot` (l'appelant l.~98 l'a en scope).
- `mental-herb.ts:32` — ajouter param `state` à `tryMentalHerbCure`. 4 appelants (`handle-status.ts`, `handle-disable.ts`, `handle-attract.ts`, `handle-encore.ts`), tous avec `context.state`.

### Carve-out — décision humaine 2026-07-24 : NE PAS router

Manipulation physique de baie ennemie. Canon : Zone Magique neutralise les *effets*, pas la présence physique — ces moves restent fonctionnels sous Zone Magique.
- `handle-burn-target-item.ts:23` — Calcination détruit la baie de la cible.
- `handle-eat-target-berry.ts:24` — Picore/Piqûre mange la baie ennemie.

→ Documenter explicitement ces 2 carve-outs dans `effective-held-item.ts` (mettre à jour l'avertissement d'adoption partielle en « adoption complète + carve-outs listés »).

## Exécution

1. Router les 16 sites directs : `X?.getForPokemon(mon)` → `effectiveHeldItem(state, mon, X)` avec le bon mon et l'import.
2. Threader `state` dans les 2 signatures (`terrain-tick-handler`, `mental-herb`) + mettre à jour les appelants.
3. Réécrire le JSDoc de `effective-held-item.ts` : adoption désormais complète, carve-outs baie-manip listés.
4. Tests : ajouter/étendre couverture Zone Magique par effet routé (unit core). e2e si observable.
5. Gate CI + human-testing.

## Notes

- Carve-outs stat purs inchangés : `effectiveWeight` (Pierrallégée, threade `state`), `effectiveBaseSpeed` (Poudre Vite, carve-out Métamorph documenté).
- Aucun changement de comportement hors Zone Magique (le chokepoint ne diffère de `getForPokemon` que si le mon est dans la zone).
