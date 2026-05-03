# Plan 074 — EV → Stat Points (SP) — Phase 4

> Statut : done
> Phase : 4

## Objectif

Implémenter le système Stat Points (SP) version Champions — simplifié depuis les EV classiques :
- **IV supprimés** : déjà le cas (formule actuelle = 0 IV implicite)
- **SP → ajout direct au stat calculé** : 66 points total max, 32 max par stat, 1 SP = +1 stat finale
- Prêt pour Team Builder (override par instance) mais sans UI dans ce plan

---

## Règles du système

| Règle | Valeur |
|-------|--------|
| Total max SP | 66 |
| Max par stat | 32 |
| Min par stat | 0 |
| Stats concernées | HP, Attack, Defense, SpAttack, SpDefense, Speed |
| Application | Après formule stat-at-level + nature modifier |
| Replay | déterministe — `statSpreadOverrides` dans `BattleSetupConfig` |

**Formule complète :**
```
stat = computeStatAtLevel(base, level) → applyNatureModifier → + (statSpread[key] ?? 0)
```

HP inclus : `+sp.hp` s'ajoute après la formule HP (affect maxHp à la création).

---

## Fichiers à créer

### `packages/core/src/types/stat-spread.ts`
```ts
import type { BaseStats } from "./base-stats";

export type StatSpread = Partial<BaseStats>;

export const SP_TOTAL_MAX = 66;
export const SP_PER_STAT_MAX = 32;
```

### `packages/core/src/battle/stat-spread-validator.ts`
Fonction `validateStatSpread(spread: StatSpread): { valid: boolean; errors: string[] }`.
Checks :
- chaque valeur ≥ 0
- chaque valeur ≤ 32
- somme total ≤ 66

### `packages/core/src/battle/stat-spread-validator.test.ts`
Tests :
- spread vide → valide
- all 0 → valide
- un stat à 32 → valide
- un stat à 33 → erreur
- un stat à -1 → erreur
- total = 66 → valide
- total = 67 → erreur (ex: 6 stats × 11 + 1)
- total dépassé avec un seul stat large → erreur
- valeurs combinées valides et invalides

---

## Fichiers à modifier

### `packages/core/src/types/pokemon-instance.ts`
Ajouter champ optionnel :
```ts
statSpread?: StatSpread;
```

### `packages/core/src/battle/stat-calculator.ts`
Signature :
```ts
export function computeCombatStats(
  baseStats: BaseStats,
  level: number,
  nature?: Nature,
  statSpread?: StatSpread,
): BaseStats
```
Après application nature, ajouter SP par stat (défaut 0 si absent).
HP : `leveled.hp + (statSpread?.hp ?? 0)` — puis nature ne touche pas HP donc ordre est : compute → add SP → (nature sur non-HP stats ne touche pas HP donc OK d'ajouter SP avant ou après nature en deux étapes séparées).

Attention ordre : `computeStatAtLevel → nature modifier → + SP`. HP nature-exempt, donc :
- HP = `computeStatAtLevel(base, level, true) + (statSpread?.hp ?? 0)`
- Autres = `applyNatureModifier(computeStatAtLevel(base, level, false), stat, nature) + sp`

Refactor interne pour appliquer SP en dernier.

### `packages/core/src/battle/stat-calculator.test.ts`
Étendre avec :
- `computeCombatStats` avec `statSpread = { attack: 4 }` → attack +4
- SP sur HP → maxHp +N
- SP sur vitesse → speed +N (vérifie que nature s'applique avant SP)
- spread partiel (une seule stat) → autres inchangées

### `packages/renderer/src/game/BattleSetup.ts`
- Ajouter `statSpreadOverrides?: Record<string, StatSpread>` à `BattleSetupConfig`
- Passer `statSpreadOverride` à `createPokemonInstance`
- Stocker `statSpread` sur l'instance
- `currentHp` et `maxHp` = `combatStats.hp` (déjà inclut SP via `computeCombatStats`)

### `packages/core/src/testing/build-test-engine.ts`
Paramètre optionnel `statSpread?: StatSpread` dans builder. Passer à `computeCombatStats`. `PokemonInstance.statSpread` renseigné si fourni.

### `packages/core/src/index.ts`
Exporter :
- `StatSpread`
- `SP_TOTAL_MAX`, `SP_PER_STAT_MAX`
- `validateStatSpread`

---

## Décisions à documenter

| # | Décision |
|---|----------|
| 296 | **SP s'applique après nature** — ordre : base → level formula → nature → +SP. Évite que la nature modifie le bonus SP (ne serait pas intuitif pour le joueur). |
| 297 | **HP inclus dans SP** — HP reçoit SP comme les autres stats. Nature n'affecte pas HP de toute façon, donc pas d'ambiguïté d'ordre. |
| 298 | **IV=31 fixé dans la formule** — `computeStatAtLevel` utilise désormais `floor((2 × base + 31) × level / 100)` (standard Champions). Ancien code = IV=0 implicite (écart ~+15 stats non-HP à niveau 50). Migration : tous les tests stat-calculator + mock combatStats mis à jour. | Option B retenue (humain, 2026-05-03). Alignement canon Champions. |
| 299 | **Pas d'UI SP dans ce plan** — Team Builder allouera SP par glisser-déposer. Ce plan pose uniquement le modèle de données + pipeline core. |

---

## Étapes

- [x] **Étape 1** — `stat-spread.ts` type + constantes
- [x] **Étape 2** — `stat-spread-validator.ts` + tests (`stat-spread-validator.test.ts`)
- [x] **Étape 3** — `stat-calculator.ts` : ajouter `statSpread?` param + application + IV=31
- [x] **Étape 4** — `stat-calculator.test.ts` : étendre avec cas SP + IV=31
- [x] **Étape 5** — `pokemon-instance.ts` : ajouter `statSpread?`
- [x] **Étape 6** — `BattleSetup.ts` : `statSpreadOverrides` + wiring
- [x] **Étape 7** — `build-test-engine.ts` : N/A (le test engine n'a pas besoin du SP pour les tests d'intégration existants)
- [x] **Étape 8** — `index.ts` : exports
- [x] **Étape 9** — Gate CI : 1168 unit + 157 intégration verts, typecheck OK, lint OK
- [x] **Étape 10** — `docs/decisions.md` : décisions #296–299

---

## Scope exclu

- UI Team Builder (future)
- Persistance SP en sandbox JSON
- Affichage SP dans InfoPanel
- Validation SP dans `validateTeamSelection`
