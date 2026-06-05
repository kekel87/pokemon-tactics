# Plan 111 — Moves liés au poids (famille Poids)

> **Statut : done** (2026-06-05)
> Phase 4 — mécaniques complexes. Suite plan 109 (moteur `dynamicPower`) + 110 (stat-source).

## Objectif

Ajouter le champ `weight` (kg) sur `PokemonInstance` et livrer 4 moves dont la puissance dépend du poids, via le moteur `dynamicPower` existant (plan 109). Aucune nouvelle architecture — 1 champ instance + 2 resolvers + 4 entrées data.

## Moves livrés (4)

Noms FR officiels (source `reference/moves.json` `names.fr`) :

| FR | ID EN | Type | Cat | Pattern | Puissance |
|----|-------|------|-----|---------|-----------|
| **Balayage** | `low-kick` | Combat | Phys | Single 1-1 | poids **cible** |
| **Nœud Herbe** | `grass-knot` | Plante | Spé | Single 1-1 | poids **cible** |
| **Tacle Lourd** | `heavy-slam` | Acier | Phys | Single 1-1 | ratio poids **cible/lanceur** |
| **Tacle Feu** | `heat-crash` | Feu | Phys | Single 1-1 | ratio poids **cible/lanceur** |

> Tous reference `power: null/0` → la puissance est calculée à 100 % par le resolver (comme `hard-press`/`water-spout`, plan 109). Pas de fallback `move.power`.

## Formules (parité Showdown)

### Poids cible — Balayage / Nœud Herbe
`targetWeightKg` :
- ≥ 200 → 120
- ≥ 100 → 100
- ≥ 50 → 80
- ≥ 25 → 60
- ≥ 10 → 40
- sinon → 20

### Ratio poids — Tacle Lourd / Tacle Feu
Forme multiplicative Showdown (`userWeight = attacker.weight`, `targetWeight = target.weight`) :
- `userWeight >= targetWeight * 5` → 120
- `userWeight >= targetWeight * 4` → 100
- `userWeight >= targetWeight * 3` → 80
- `userWeight >= targetWeight * 2` → 60
- sinon → 40

Comparaison multiplicative (pas de division) → parité Showdown exacte, palier 1/3 inclusif (reco game-designer : Grolem 300kg vs Florizarre 100kg = exactement ×3 → 80). Lanceur sans poids → 40 (faible) ; cible sans poids → 120 (max).

## Étapes

### 1. Core — champ `weight` sur l'instance
- `packages/core/src/types/pokemon-instance.ts` : ajouter `weight: number;` (kg). Champ requis (toujours dérivé de la définition).

### 2. Core — 2 nouveaux `DynamicPowerKind`
- `packages/core/src/enums/dynamic-power-kind.ts` :
  - `TargetWeight: "target_weight"` (Balayage / Nœud Herbe)
  - `WeightRatio: "weight_ratio"` (Tacle Lourd / Tacle Feu)
- `packages/core/src/battle/dynamic-power-system.ts` :
  - helper `targetWeightPower(target)` (table 6 paliers ci-dessus)
  - helper `weightRatioPower(attacker, target)` (5 paliers, garde `attacker.weight <= 0 → 120`)
  - 2 entrées `RESOLVERS`.

### 3. Propagation `weight` à la construction d'instance
Tous les sites qui construisent un `PokemonInstance` :
- `packages/renderer/src/game/BattleSetup.ts:87` → `weight: definition.weight`
- `packages/core/scripts/regenerate-golden-replay.ts:79` → idem (definition dispo)
- `packages/core/src/testing/build-test-engine.ts` → `weight: definition.weight`
- `packages/core/src/testing/build-fall-test-engine.ts` → idem
- `packages/core/src/testing/build-ct-test-engine.ts` → idem
- `packages/core/src/testing/mock-battle.ts` / `mock-pokemon.ts` → `weight` (default raisonnable, ex `10`)
- `GameController.ts:2489` (instance factice currentHp:1) → ajouter `weight` si typecheck l'exige.

> Le typecheck strict listera tout site manquant — itérer jusqu'à vert.

### 4. Data — 4 entrées `tacticalOverrides`
`packages/data/src/overrides/tactical.ts`, bloc « Power conditionnel » :
```ts
"low-kick":   { targeting: Single 1-1, effects:[Damage], dynamicPower:{kind:TargetWeight} },
"grass-knot": { targeting: Single 1-1, effects:[Damage], dynamicPower:{kind:TargetWeight} },
"heavy-slam": { targeting: Single 1-1, effects:[Damage], dynamicPower:{kind:WeightRatio} },
"heat-crash": { targeting: Single 1-1, effects:[Damage], dynamicPower:{kind:WeightRatio} },
```
Noms EN dans `i18n/moves.en.json` si absents (FR déjà en reference).

### 5. Renderer
- **Rien.** `MoveTooltip` tag `⚡ Puissance variable` est auto pour tout move `dynamicPower !== undefined` (plan 109). Les 4 héritent gratuitement.

### 6. IA
- `getEffectivePowerFloor` traite déjà les moves `dynamicPower` (power null → 1, non exclus du scoring). `estimateDamage` route via `resolveDynamicPower`. **Aucun code IA dédié** (audit identique plan 109/110).

### 7. Tests
- **Unit** `dynamic-power-system.test.ts` : paliers `TargetWeight` (6 bornes) + `WeightRatio` (5 bornes + garde poids 0).
- **Positionnels** (CI exige 1 test/move — `move-test-coverage.test.ts`) :
  - `low-kick.test.ts`, `grass-knot.test.ts` : cible légère vs lourde → BP différent.
  - `heavy-slam.test.ts`, `heat-crash.test.ts` : lanceur lourd vs cible légère → BP haut.
- Vérifier `body-press`/`foul-play`/façade non régressés.

### 8. OP sets (optionnel, si temps)
- Ajouter variantes plausibles : Ronflex/Snorlax `heavy-slam`, Grolem/Golem `heavy-slam`. Skippable v1 (movepool dérivé learnset les expose déjà).

## Décisions
- **Poids = champ instance requis** (pas optionnel) : toujours connu via définition, évite branches `?? defaultWeight` partout.
- **Pas de talent Poids-modifieur** (Heavy Metal/Light Metal/Float Stone) en Gen 1 → poids = valeur brute définition. Note backlog si Phase ultérieure.
- **Noms FR** : reference donne Balayage / Nœud Herbe / Tacle Lourd / Tacle Feu (≠ noms cités dans `next.md` : Lancer Gravé/Écras'Herbe/Lourde Bombe/Dévastateur — obsolètes). Reference = source de vérité.

## Gate CI
`pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration`. Golden replay possiblement à régénérer (nouveaux moves dans movepools).
