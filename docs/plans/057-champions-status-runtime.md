---
status: done
created: 2026-04-15
updated: 2026-04-15
---

# Plan 057 — Champions status runtime

## Objectif

Faire que le moteur de combat (`packages/core/`) lise les règles de statuts depuis `reference/champions-status.json` (généré par le plan 056) et applique les vraies valeurs Pokemon Champions :

- **Paralysie** : 25% skip → **12.5% skip** (`randomChance(1, 8)` côté Showdown)
- **Gel** : 20% thaw, durée illimitée → **25% thaw + max 3 tours garantis** (`randomChance(1, 4)` + `startTime = 3`)
- **Sommeil** : 1-3 tours uniforme → **sample([2, 3, 3])** = 1/3 de 2 tours, 2/3 de 3 tours

Aujourd'hui, le plan 056 a livré `champions-status.json` mais aucun consumer côté core. Ce plan referme la boucle.

## Contexte

Code actuel (toutes valeurs **classiques Gen 9**, pas Champions) :

| Mécanique | Fichier | Ligne |
|-----------|---------|-------|
| Paralysie skip 25% | `packages/core/src/battle/handlers/status-tick-handler.ts` | 114 (`if (procRoll < 0.25)`) |
| Gel thaw 20%, sans cap | `packages/core/src/battle/handlers/status-tick-handler.ts` | 100 (`if (thawRoll < 0.2)`) |
| Sommeil 1-3 uniforme | `packages/core/src/battle/handlers/handle-status.ts` | 114 (`Math.floor(random() * 3) + 1`) |

Multiplicateur de vitesse paralysie (-50%) : déjà OK Champions → pas à toucher (`packages/core/src/battle/initiative-calculator.ts:12`).

## Décisions prises

1. **Pas de dépendance core → data** : le core définit le type `StatusRules`, le data package fournit le loader. L'injection se fait à la construction de `BattleEngine`.
2. **Champions par défaut** : les tests sont mis à jour pour refléter Champions (source de vérité). Pas de mode "classic" gardé en parallèle.
3. **Fallback hardcodé** dans `BattleEngine` quand `statusRules` n'est pas fourni : valeurs Champions baked in (mêmes que celles transcrites dans `CHAMPIONS_STATUS_MANUAL`). Évite que les tests core dépendent du fichier JSON de data, et garantit que core marche sans data.
4. **Sleep `sampleTurns`** : on utilise la liste exacte `[2, 3, 3]` côté core via un sample uniforme. Si Champions change la distribution un jour, seul `champions-status.json` change — le sample reste générique.
5. **Pas de "compat layer"** : pas de toggle "classique vs Champions". Champions = vérité, point.

## Architecture

```
champions-status.json  ──→  loadStatusRules()  ──→  StatusRules object
   (data package)            (data package)             │
                                                         ▼
                                            BattleEngine ctor (opt param)
                                                         │
                                                         ▼
                                ┌───────────────────────┴────────────────┐
                                ▼                                        ▼
              createStatusTickHandler(random, rules)        handle-status.ts
              ────────────────────────────────────         (getStatusDuration)
              - paralysis skip rate                           - sleep duration sample
              - freeze thaw rate + maxTurns
```

Si `BattleEngine` est construit sans `statusRules`, fallback hardcodé Champions baked in (`DEFAULT_STATUS_RULES` constante dans core).

## Étapes

### Étape 1 — Type `StatusRules` dans le core

Créer `packages/core/src/types/status-rules.ts` :

```typescript
export interface StatusRules {
  paralysis: {
    /** Probabilité qu'un Pokemon paralysé skip son action (Champions: 1/8) */
    skipRate: number;
    /** Multiplicateur de vitesse (Champions: 0.5) — non consommé encore mais livré pour cohérence */
    speedMult: number;
  };
  freeze: {
    /** Probabilité de dégeler chaque tour (Champions: 1/4) */
    thawRate: number;
    /** Durée max garantie avant dégel forcé (Champions: 3) */
    maxTurns: number;
  };
  sleep: {
    /** Distribution exacte des tours possibles. Champions: [2, 3, 3]. */
    sampleTurns: number[];
  };
}

/**
 * Valeurs Champions baked in. Source de vérité = packages/data/reference/champions-status.json,
 * loader = packages/data/src/loaders/load-status-rules.ts.
 *
 * Ces constantes existent comme fallback pour les tests et pour le découplage core/data.
 * Si Champions change un de ces taux, MAJ ici ET dans CHAMPIONS_STATUS_MANUAL (fetch-champions.ts).
 */
export const DEFAULT_STATUS_RULES: StatusRules = {
  paralysis: { skipRate: 1 / 8, speedMult: 0.5 },
  freeze: { thawRate: 1 / 4, maxTurns: 3 },
  sleep: { sampleTurns: [2, 3, 3] },
};
```

Exporter depuis `packages/core/src/index.ts`.

### Étape 2 — Loader dans data

Créer `packages/data/src/loaders/load-status-rules.ts` :

```typescript
import type { StatusRules } from "@pokemon-tactic/core";

interface ChampionsStatusFile {
  source: string;
  fetchedAt: string;
  status: {
    paralysis?: { skipRate?: number; speedMult?: number };
    freeze?: { thawRate?: number; maxTurns?: number };
    sleep?: { minTurns?: number; maxTurns?: number; sampleTurns?: number[] };
  };
}

export function loadStatusRulesFromReference(file: ChampionsStatusFile): StatusRules {
  const s = file.status;
  return {
    paralysis: {
      skipRate: s.paralysis?.skipRate ?? 1 / 8,
      speedMult: s.paralysis?.speedMult ?? 0.5,
    },
    freeze: {
      thawRate: s.freeze?.thawRate ?? 1 / 4,
      maxTurns: s.freeze?.maxTurns ?? 3,
    },
    sleep: {
      sampleTurns: s.sleep?.sampleTurns ?? [2, 3, 3],
    },
  };
}
```

Exporter depuis `packages/data/src/loaders/index.ts`. Pas de chargement automatique de `champions-status.json` dans `loadData()` — c'est l'appelant (renderer/tests) qui décide.

Tests unitaires `load-status-rules.test.ts` : valeurs Champions complètes, valeurs partielles avec fallback, fichier vide.

### Étape 3 — `createStatusTickHandler` accepte les rules

Modifier `packages/core/src/battle/handlers/status-tick-handler.ts` :

```typescript
import { DEFAULT_STATUS_RULES, type StatusRules } from "../../types/status-rules";

export function createStatusTickHandler(
  random: RandomFn = () => Math.random(),
  rules: StatusRules = DEFAULT_STATUS_RULES,
): PhaseHandler {
  return (pokemonId, state) => statusTickHandler(pokemonId, state, random, rules);
}

export function statusTickHandler(
  pokemonId: string,
  state: BattleState,
  random: RandomFn = () => Math.random(),
  rules: StatusRules = DEFAULT_STATUS_RULES,
): PhaseResult {
  // …
  case StatusType.Frozen: {
    const thawRoll = random();
    // Champions: thaw forcé si on a atteint maxTurns
    const turnsFrozen = (status.turnsApplied ?? 0) + 1;
    if (thawRoll < rules.freeze.thawRate || turnsFrozen >= rules.freeze.maxTurns) {
      // … remove status, emit StatusRemoved
    }
    status.turnsApplied = turnsFrozen;
    return { …, skipAction: true };
  }

  case StatusType.Paralyzed: {
    const procRoll = random();
    if (procRoll < rules.paralysis.skipRate) {
      return { events, skipAction: false, restrictActions: true, pokemonFainted: false };
    }
    return emptyResult;
  }
  // …
}
```

**Note** : pour le gel, il faut compter les tours. On ajoute `turnsApplied?: number` dans `StatusEffect` (`packages/core/src/types/status-effect.ts`). C'est sémantiquement différent de `remainingTurns` (qui décrémente vers 0 pour le sommeil) — `turnsApplied` incrémente depuis 0 pour le gel. Pour le gel, `remainingTurns` reste `null` (pas de durée initiale), seul `turnsApplied` est utilisé.

### Étape 4 — Sleep duration via `sampleTurns`

Modifier `packages/core/src/battle/handlers/handle-status.ts` :

```typescript
function getStatusDuration(
  status: StatusType,
  random: () => number,
  rules: StatusRules = DEFAULT_STATUS_RULES,
): number | null {
  switch (status) {
    case StatusTypeEnum.Asleep: {
      const samples = rules.sleep.sampleTurns;
      const idx = Math.floor(random() * samples.length);
      return samples[idx] ?? samples[0] ?? 1;
    }
    case StatusTypeEnum.Confused:
      return Math.floor(random() * 4) + 1;
    case StatusTypeEnum.Seeded:
      return -1;
    case StatusTypeEnum.Trapped:
      return Math.floor(random() * 2) + 4;
    default:
      return null;
  }
}
```

Le caller (`handleStatus`) passe les rules → propager via la signature de `handleStatus` qui est appelée depuis `effect-processor.ts`.

### Étape 5 — Wiring dans BattleEngine + setup

**Chaîne de propagation complète :**

```
BattleEngine (this.statusRules)
  ├─→ createStatusTickHandler(this.random, this.statusRules)   [étape 3]
  └─→ processEffects(…, this.statusRules)                      [effect-processor.ts]
        └─→ handleStatus(…, statusRules)                        [handle-status.ts]
              └─→ getStatusDuration(…, statusRules)             [étape 4]
```

Concrètement :
- `EffectContext` (interface publique dans `effect-handler-registry.ts`) : ajouter `statusRules: StatusRules`
- `processEffects` (dans `effect-processor.ts`) : reçoit `statusRules` en param (default `DEFAULT_STATUS_RULES`), le propage dans le `EffectContext` passé à chaque handler
- `handleStatus` (dans `handle-status.ts`) : lit `context.statusRules` au lieu d'un hardcode

Ajouter `statusRules?: StatusRules` au constructeur de `BattleEngine` (default `DEFAULT_STATUS_RULES`). Stocker dans `this.statusRules`. Passer aux handlers :

```typescript
this.turnPipeline.registerStartTurn(
  createStatusTickHandler(this.random, this.statusRules),
  100,
);
```

Et propager aux appels `handleStatus` (via `effect-processor`).

Côté **renderer** (`packages/renderer/src/game/BattleSetup.ts` et `SandboxSetup.ts`) :
- Charger `champions-status.json` au démarrage de la scène (via fetch ou import statique du JSON)
- Appeler `loadStatusRulesFromReference(file)` → obtenir `StatusRules`
- Passer à `new BattleEngine(..., statusRules)`

Côté **test-engine builders** (`packages/core/src/testing/`) :
- `buildTestEngine`, `buildMoveTestEngine`, etc. — par défaut, ne pas passer de `statusRules` → utilise les defaults (= Champions). C'est le comportement voulu.
- Pour les tests qui veulent overrider (ex: tester avec skipRate=1.0 pour un proc forcé) : nouveau param optionnel.

### Étape 6 — Mise à jour des tests existants

Tests à auditer et corriger :

| Fichier | Assertion à changer |
|---------|---------------------|
| `status-tick-handler.test.ts` (paralysie) | `procRoll === 0.25` (limit) → `procRoll === 0.125` (limit). Tests "procs at 25% chance" → "procs at 12.5% chance". |
| `status-tick-handler.test.ts` (gel) | `thawRoll === 0.2` → `< 0.25`. Ajouter test "thaws automatically at turn 3". |
| `mechanics/paralysis-status.test.ts` | Idem paralysie. |
| `mechanics/freeze-status.test.ts` | Idem gel + nouveau cas garanti. |
| `mechanics/sleep-status.test.ts` | Adapter à `sampleTurns` au lieu de range 1-3. |
| `BattleEngine.use-move.test.ts:216` | "applies Asleep status" — vérifier que la durée appliquée est dans [2, 3]. |
| `effect-processor.test.ts:54` | Sleep effect application — durée [2, 3]. |
| `golden-replay.test.ts` | **Probable régénération du snapshot** si les RNG draws changent l'ordre des actions. |

Approche : lancer `pnpm test` après chaque modif d'étape, fixer ce qui casse au fur et à mesure. Pas de gros refactor des tests — juste les valeurs assertées.

### Étape 7 — Tests nouveaux (Champions)

Ajouter dans `status-tick-handler.test.ts` :
- "paralysis skips at 12.5% rate (Champions)" — mock random retournant 0.124 → skip, 0.126 → no skip
- "freeze thaws at 25% rate" — mock 0.249 → thaw, 0.251 → no thaw
- "freeze thaws guaranteed at turn 3" — `turnsApplied = 2` → tick → thaw même si random retourne 0.99
- "freeze counter increments each turn"

Ajouter dans `handle-status.test.ts` :
- "sleep duration uses sampleTurns [2,3,3]" — random → idx 0 = 2 turns, idx 1 = 3, idx 2 = 3
- "sleep duration with custom rules respects sampleTurns"

### Étape 8 — Run final + intégration renderer

1. `pnpm typecheck`, `pnpm test` — tout vert
2. `pnpm dev` — lancer le jeu, tester paralysie/gel/sommeil dans un combat sandbox
3. Vérifier que la timeline CT et les compteurs reflètent les nouvelles durées (max 3 sleep, max 3 freeze)
4. Si renderer pas adapté pour charger `champions-status.json` : il utilisera les defaults Champions (DEFAULT_STATUS_RULES) → comportement OK même sans wiring complet renderer

## Fichiers impactés

**Nouveaux** :
- `packages/core/src/types/status-rules.ts`
- `packages/core/src/types/status-rules.test.ts` (optionnel — peu de logique à tester)
- `packages/data/src/loaders/load-status-rules.ts`
- `packages/data/src/loaders/load-status-rules.test.ts`

**Modifiés** :
- `packages/core/src/battle/handlers/status-tick-handler.ts` — accepte `rules`, applique paralysis/freeze
- `packages/core/src/battle/handlers/handle-status.ts` — accepte `rules`, sleep via `sampleTurns`
- `packages/core/src/battle/effect-processor.ts` — propage `rules` à handleStatus
- `packages/core/src/battle/BattleEngine.ts` — param ctor `statusRules`, passe aux handlers
- `packages/core/src/types/status-effect.ts` — ajoute `turnsApplied?: number` dans `StatusEffect`
- `packages/core/src/index.ts` — exports `StatusRules`, `DEFAULT_STATUS_RULES`
- `packages/data/src/loaders/index.ts` — export `loadStatusRulesFromReference`
- `packages/renderer/src/game/BattleSetup.ts` — charge + passe rules à BattleEngine
- `packages/renderer/src/game/SandboxSetup.ts` — idem
- Tests listés dans étape 6
- `docs/decisions.md` — entrée plan 057 (statuts Champions runtime)
- `docs/game-design.md` (si mention des taux 25%/20% qq part)

## Vérifications end-to-end

1. `pnpm typecheck` clean
2. `pnpm test` — 1033+ tests passent (ajouts inclus)
3. `pnpm test:integration` — le test cassé `PlacementPhase.integration` reste cassé (hors scope, voir backlog) mais pas de nouvelle régression
4. Sandbox : Pokemon paralysé skip rarement (12.5%), Pokemon gelé fond après max 3 tours, Pokemon endormi reste 2 ou 3 tours
5. `champions-status.json` est consommé : si on le modifie manuellement et relance le jeu, le comportement change (preuve que le wiring fonctionne)

## Hors scope (futures plans)

- Formule stats Champions (IV=31, SP, nature) — plan séparé quand on est prêt à toucher `stat-calculator.ts`
- Pokemon Legends Z-A integration — backlog
- Refactor `getStatusDuration` pour piloter Confused / Trapped via rules — pas demandé, garde les valeurs hardcodées actuelles

## Agents déclenchés

| Moment | Agent |
|--------|-------|
| Après étape 1 (types) | `core-guardian` |
| Après étape 3 (status-tick-handler) | `test-writer` (audit tests existants) |
| Après étape 6 (tests update) | `code-reviewer` |
| Étape 8 (run renderer) | `visual-tester` (background, vérifier qu'un combat passe) |
| Fin du plan | `doc-keeper` + `commit-message` |

## Risques

1. **Régression silencieuse de balance** : avec paralysie 12.5% au lieu de 25%, les Pokemon paralysés deviennent moins handicapants → certains moves de paralysie (Thunder Wave) sont moins forts. C'est intentionnel (Champions a fait ce choix de design). À surveiller en playtest.
2. **Snapshot golden replay** : très probable régénération nécessaire. Attendu, géré dans étape 6.
3. **Sleep `sampleTurns` vs ancien `remainingTurns: 0` early-exit** : vérifier que l'ancien comportement (sleep retiré quand `remainingTurns === 0`) reste correct avec les nouvelles durées 2 ou 3.
