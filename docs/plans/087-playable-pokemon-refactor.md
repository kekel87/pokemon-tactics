# Plan 087 — Refactor roster-poc → playable-pokemon

> Statut : **done**
> Créé : 2026-05-19
> Auteur : Claude

## Objectif

Tuer le concept "POC roster". `roster-poc.ts` devient `playable-pokemon.ts` :
une simple liste de Pokemon **implémentés** (id only), plus un dummy custom pour la sandbox.

- `movepool` et `abilityId` disparaissent des entries du roster.
- `PokemonDefinition.movepool` est **dérivé** du learnset Showdown ∩ moves implémentés.
- `PokemonDefinition.abilityId` est **dérivé** de la première ability légale (`reference.abilities.ability1`).
- Toutes les valeurs custom par Pokemon (movepool curé + ability choisie) vivent désormais dans **OP sets** (curation contrôlée).
- Les défauts en combat passent par OP set 1 quand applicable, ou par le pool dérivé en fallback (sandbox, golden replay).

## Pourquoi maintenant

- Plan 086 termine la refonte TeamSelectScene + sous-pick. La data joueur transite par `TeamSet` → `BattleSetupConfig.moveOverrides/abilityOverrides`. Le `movepool` du roster n'est plus la source de vérité.
- OP sets 160/160 `full` (plan 084) couvrent tout le roster jouable. Plus besoin de doublonner.
- `audit-learnsets` script devient obsolète : si le pool est dérivé du learnset, par construction zéro violation.

## Hors scope

- Pas de modification d'UI (sandbox panel et team builder consomment déjà via helpers).
- Pas de re-curation OP sets (déjà fait plan 082).
- Bugs MapSelect noir + caméra 12v1 (sessions dédiées, cf. backlog 2026-05-19).
- Pas de refactor PlacementPhase ni TeamSet.

## Décisions actées

1. **Liste implémentés = `{ id, custom? }`**. `custom` réservé au dummy (sandbox).
2. **`PokemonDefinition.movepool` = learnset full ∩ moves implémentés** (= keys de `tacticalOverrides`).
   - Walk learnset (levelUp + tm + tutor) + chaîne `evolvesFrom`.
   - Reverse-map showdown id → kebab via `movesReference[].id` (kebab natif).
   - Filtré aux moves présents dans `tacticalOverrides`.
3. **Fallback learnset vide** : si `learnset ∩ implemented = []`, utiliser **union des OP sets** pour ce Pokemon (= `getOpSetsForPokemon(id).flatMap(s => s.moveIds)`). Concerne **3 Pokemon** confirmés (raticate, fearow, parasect — learnset reference vide même via chaîne `evolvesFrom`). Documenter ces 3 dans le code (commentaire pointant vers backlog).
4. **`PokemonDefinition.abilityId` = `reference.abilities.ability1`** (par défaut). Fallback null/undefined si null en reference.
5. **Default moves en combat** : `BattleSetup.createPokemonInstance` garde `definition.movepool.slice(0, 4)` comme fallback quand pas d'override. Plan 086 fournit toujours `moveOverrides` depuis TeamSet pour le flow normal.
6. **Dummy** : entry custom conserve `movepool` (sandbox preset) + `abilityId` (optionnel, null en pratique).
7. **`audit-learnsets` script supprimé** (devient une tautologie).

## Étapes

### 1. Nouveau module `packages/data/src/playable/`

Créer :
- `packages/data/src/playable/playable-pokemon-entry.ts` — type `PlayablePokemonEntry`
- `packages/data/src/playable/playable-pokemon.ts` — liste `playablePokemon`
- `packages/data/src/playable/index.ts` — re-exports

```ts
// playable-pokemon-entry.ts
import type { PokemonType } from "@pokemon-tactic/core";

export interface PlayablePokemonCustom {
  name: string;
  types: PokemonType[];
  baseStats: {
    hp: number;
    attack: number;
    defense: number;
    spAttack: number;
    spDefense: number;
    speed: number;
  };
  weight: number;
  movepool: string[];
  abilityId?: string;
}

export interface PlayablePokemonEntry {
  id: string;
  custom?: PlayablePokemonCustom;
}
```

```ts
// playable-pokemon.ts
import type { PlayablePokemonEntry } from "./playable-pokemon-entry";

export const playablePokemon: PlayablePokemonEntry[] = [
  { id: "venusaur" },
  { id: "charizard" },
  // ... 81 entries (ordre Pokédex via dexNumber, mais tri appliqué côté loaders)
  {
    id: "dummy",
    custom: {
      name: "Dummy",
      types: ["normal"],
      baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
      weight: 10.0,
      movepool: ["protect", "detect", "counter", "endure"],
    },
  },
];
```

### 2. Adapter `loadPokemonFromReference`

Fichier : `packages/data/src/loaders/load-pokemon.ts`.

Signature change :
```ts
export function loadPokemonFromReference(
  referenceData: ReferencePokemon[],
  entries: PlayablePokemonEntry[],
  implementedMoveIds: ReadonlySet<string>, // <-- nouveau param
): PokemonDefinition[]
```

Logique :
- Pour entry custom (dummy) : utilise `entry.custom.movepool` tel quel + `entry.custom.abilityId`.
- Pour entry non-custom :
  - Walk `ref.learnset.{levelUp[].move, tm, tutor}` + chaîne `ref.evolvesFrom`. Collect showdown ids.
  - Reverse-map → kebab via index `showdownId → kebabId` (construit depuis `movesReference[].id`).
  - Filtrer aux ids présents dans `implementedMoveIds` → `derivedPool`.
  - **Fallback** : si `derivedPool.length === 0` (learnset reference vide pour ce Pokemon ET ses pré-évos), prendre `Set(getOpSetsForPokemon(id).flatMap(s => s.moveIds))` comme pool. Logger un warning console (`[load-pokemon] empty learnset for ${id}, falling back to OP sets union`).
  - `abilityId = ref.abilities.ability1 ?? undefined`.

Helpers internes :
- `buildShowdownToKebabIndex(movesReference)` — map showdownId → kebabId.
- Signature étendue : `loadPokemonFromReference` reçoit aussi `opSetsByPokemonId: Map<string, OpSet[]>` (ou délègue lookup à `load-data.ts` qui pré-charge tout).

**Affectés connus du fallback** (3 Pokemon, learnset reference vide même via `evolvesFrom`) :
- raticate (Hyper Fang, Quick Attack, Swords Dance, Crunch)
- fearow (Drill Peck, Aerial Ace, Quick Attack, Agility)
- parasect (Spore, Razor Leaf, Sludge Bomb, Growth)

Ces 3 Pokemon ont OP sets `full` (vérifié plan 082 — 160/160). Le fallback les couvre.

### 3. Adapter `load-data.ts`

- `import { playablePokemon } from "./playable"` (au lieu de `rosterPoc`).
- `allMoveIds` n'est plus dérivé du movepool des entries. À la place : `new Set(Object.keys(tacticalOverrides))` (= tous les moves implémentés).
- Pré-charger OP sets : `const opSetsByPokemonId = loadOpSetsIndex()` (déjà disponible via `getOpSetsForPokemon`).
- Passer `allMoveIds` ET `opSetsByPokemonId` à `loadPokemonFromReference` pour le filtrage + fallback.

### 4. Adapter `validate.ts` core

Aucun changement. Le check `pokemon.movepool.length === 0` reste valide (un Pokemon implémenté a au moins 4 moves légaux, sinon bug data → erreur claire).

Edge case : si filtrage learnset ∩ implemented donne `[]` pour un Pokemon (ex: data gap learnset), `validateBattleData` plante explicitement. Mieux que silently empty.

### 5. Adapter `BattleSetup.ts`

- `definition.movepool.slice(0, 4)` reste tel quel (fallback quand `moveOverrides` absent).
- `definition.abilityId` reste utilisé comme fallback (toujours présent maintenant via ability1).

### 6. Adapter `regenerate-golden-replay.ts`

Aucun changement. `definition.movepool.slice(0, 4)` toujours valide.

### 7. Adapter `SandboxPanel.ts` renderer

Aucun changement immédiat. `getMovepoolFor(id)` lit déjà `PokemonDefinition.movepool` qui sera maintenant le pool learnset ∩ implemented (≥4 moves pour tout Pokemon implémenté, souvent beaucoup plus).

Suivi : SandboxPanel pourrait gagner à exposer toutes les options et trier par fréquence, mais hors scope.

### 8. Adapter `team-builder-registry.ts`

```ts
import { playablePokemon } from "../playable/playable-pokemon";
// ...
const rosterIds = new Set(playablePokemon.map((entry) => entry.id).filter((id) => id !== "dummy"));
```

Renommer `rosterIds` → `playableIds` localement pour cohérence.

### 9. Adapter `implementation-flags.ts`

```ts
export function isPokemonImplemented(pokemonId: string, entries: readonly PlayablePokemonEntry[]): boolean
```

Test fichier : import `playablePokemon` (au lieu de `rosterPoc`).

### 10. Adapter `team-builder-data.ts` renderer

```ts
import { playablePokemon } from "@pokemon-tactic/data";
// ...
for (const entry of playablePokemon) { ... }
```

### 11. Adapter `analyze-op-sets.ts` script

Remplacer `rosterPoc` par `playablePokemon`. Tests d'invariants identiques.

### 12. Supprimer `audit-learnsets.ts`

- Supprimer le script.
- Supprimer l'entrée `team:audit-learnsets` dans `packages/data/package.json`.
- Doc : retirer la mention de `pnpm team:audit-learnsets` (backlog + plan 081 historique conservé).

### 13. Updates exports `packages/data/src/index.ts`

- Drop `RosterEntry`, `rosterPoc` exports.
- Add `PlayablePokemonEntry`, `playablePokemon` exports.

### 14. Suppression `packages/data/src/roster/`

Une fois tous les call sites migrés, supprimer le dossier `roster/` complet (`roster-entry.ts`, `roster-poc.ts`, `index.ts`).

### 15. Tests

- Update test `implementation-flags.test.ts` : import `playablePokemon`.
- Update tout test qui import `rosterPoc` directement (grep avant).
- Vérifier que `pokemonReference` learnset n'a pas de gap bloquant pour les 81 Pokemon implémentés (sinon `validateBattleData` plante).
  - Backlog connu : 10 Pokemon avec learnset vide en reference. Si l'un d'eux est implémenté (peu probable — formes non-finales) → fallback nécessaire ou fix data.
  - Audit pré-implé : `pnpm test` + lancer dev pour confirmer.

### 16. Gate CI

`pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration`.

Particulièrement attentif : tests intégration moves qui pourraient s'appuyer sur movepool spécifique d'un Pokemon (peu probable, ils utilisent `buildMoveTestEngine` avec mocks).

### 17. Documentation

- Update `STATUS.md` : phase 4, plan 087.
- Update `docs/plans/README.md` : ajouter ligne 087.
- Update `docs/next.md` : item "Refactor roster-poc → playable-pokemon" → "Fait récemment".
- Update `CLAUDE.md` doc table : `docs/roster-poc.md` → noter dépréciation (concept mort).
- Update `docs/implementations.md` si référence rosterPoc.

## Risques

| Risque | Mitigation |
|--------|------------|
| Learnset reference vide → movepool dérivé vide → validate plante | Fallback OP sets union explicite dans `loadPokemonFromReference`. 3 cas connus (raticate/fearow/parasect) tous couverts par OP sets `full`. Warning console pour signaler. |
| OP sets vides pour un Pokemon ET learnset vide | Combo théorique : aucune occurrence aujourd'hui (160/160 `full`). Si arrive : validateBattleData plante avec message clair pointant le Pokemon. |
| Reverse map showdown→kebab perd des moves (collision) | Vérification au build : `tacticalOverrides` keys sont kebab uniques, `toShowdownId` est une fonction (pas bijective inverse mais OK direction unique) |
| OP sets référencent un move non implémenté car learnset gap | Déjà géré par `analyze-op-sets` (top moves manquants) — non régressé |
| SandboxPanel affiche trop de moves (full pool ≠ 4 curés) | Acceptable : sandbox = mode test, montre tout ce qui est jouable |
| Default ability legacy ne matche plus la curation OP set | Pour combat normal : `abilityOverrides` couvre. Pour sandbox : ability1 raisonnable. Fine. |

## Estimation

- Code : ~1h30 (rename mécanique + dérivation movepool + adaptation 8 call sites)
- Tests : ~30 min (re-imports + validation gate CI)
- Doc : ~15 min

Total : **~2h15**.

## Checklist exécution

- [x] Étape 1 : nouveau module `playable/`
- [x] Étape 2 : `loadPokemonFromReference` adapté + reverse-map
- [x] Étape 3 : `load-data.ts` adapté
- [x] Étape 5 : `BattleSetup.ts` (vérification, pas de change attendu)
- [x] Étape 7 : `SandboxPanel.ts` (vérification visuelle)
- [x] Étape 8 : `team-builder-registry.ts`
- [x] Étape 9 : `implementation-flags.ts` + test
- [x] Étape 10 : `team-builder-data.ts`
- [x] Étape 11 : `analyze-op-sets.ts`
- [x] Étape 12 : `audit-learnsets.ts` supprimé
- [x] Étape 13 : exports `index.ts`
- [x] Étape 14 : dir `roster/` supprimé
- [x] Étape 15 : tests passent (1514 unit + 189 intégration)
- [x] Étape 16 : gate CI verte (typecheck + build + lint)
- [x] Étape 17 : doc à jour (STATUS, next, plans README)
- [ ] Smoke test : MainMenu → TeamSelect → Combat 1v1 + Sandbox + Team Builder OK (à valider humain)
- [ ] Commit

## Notes d'exécution (2026-05-19)

- **Tweak vs plan** : `deriveMovepool` ordonne désormais **OP sets first** (curé) puis learnset legal restant. Permet `slice(0, 4)` de tomber sur OP set 1. Décision prise en cours d'exécution pour cohérence sandbox + golden replay.
- **Test casualties** : 2 tests adaptés (`SandboxSetup.test.ts` assert OP set 1, `scored-ai-smoke.test.ts` passe à `slice(0, 4)` au lieu de full movepool). Golden replay régénéré via `UPDATE_GOLDEN=1` (107 actions / round 11, contre 108 / 10 avant).
- **`console.warn` retiré** de la branche fallback OP sets (core typecheck refuse `console` global). Fallback reste silencieux — si OP sets ET learnset vides, `validateBattleData` plantera explicitement plus tard.
- **Doc update** : STATUS.md, docs/next.md, docs/plans/README.md mis à jour. `docs/roster-poc.md` (référencé dans CLAUDE.md table) à marquer obsolète dans une future session.
