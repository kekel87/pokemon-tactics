---
status: done
created: 2026-04-12
updated: 2026-04-12 (migration terminee — 4 fichiers hardcodes supprimes, 839 tests verts)
---

# Plan 049 — Migrer les donnees de jeu vers la reference JSON (Phase 2 du plan 048)

## Contexte

Le plan 048 a livre `packages/data/reference/` — une knowledge base de 1025 especes, 850 moves, etc. Actuellement, le jeu utilise des fichiers TS hardcodes (`base/pokemon.ts`, `base/moves.ts`) avec ~21 Pokemon et ~74 moves. Les stats y sont recopiees a la main depuis Showdown, ce qui est fragile et non-DRY.

**Objectif** : faire de `reference/*.json` la **source de verite** pour les stats officielles Pokemon, tout en conservant la curation gameplay (roster, movepools de 4 moves, targeting tactique, overrides d'equilibrage).

## Probleme a resoudre

Les donnees "reference" et les donnees "jeu" ont des roles differents :

| | Reference (`reference/pokemon.json`) | Jeu (`base/pokemon.ts` actuel) |
|---|---|---|
| Stats | Officielles (tous les 1025 Pokemon) | Identiques (recopiees) |
| Movepool | Learnset complet (levelUp + TM + tutor) | 4 moves cures pour le gameplay |
| Targeting | Absent (concept du jeu, pas de Pokemon officiel) | Obligatoire par move |
| Effects | Absent | Obligatoire par move |
| Flags | Showdown bruts | Utilises directement |
| Roster | Tous les 1025 | 21 Pokemon POC |

La migration consiste a **eliminer la recopie des stats** et a **puiser les donnees officielles depuis la reference** tout en gardant la curation tactique separee.

## Clarification : `reference/` ne remplace pas `src/base/`

| Dossier | Role | Contenu |
|---------|------|---------|
| `reference/` | Dictionnaire officiel Pokemon (read-only, regenerable) | 1025 especes, 850 moves, champs Showdown, pas game-specific |
| `src/roster/` (nouveau) | Curation gameplay — la "liste de course" | Quels Pokemon sont dans le jeu, quels 4 moves ils ont |
| `src/loaders/` (nouveau) | Transformation reference → types core | Mapping champs, filtrage par roster |
| `src/overrides/` | Tactique et equilibrage (inchange) | Targeting, effects, balance — 100% game-specific |

`src/base/` disparait quasi-entierement (seul `animation-category.ts` survit).

## Architecture cible

```
packages/data/src/
├── roster/
│   ├── roster-poc.ts          # NOUVEAU — liste des Pokemon du POC + movepools cures
│   └── roster.ts              # Re-exporte le roster actif
├── overrides/
│   ├── tactical.ts            # INCHANGE — targeting + effects par move
│   └── balance-v1.ts          # INCHANGE — overrides d'equilibrage
├── base/
│   ├── pokemon.ts             # SUPPRIME — remplace par le loader
│   ├── moves.ts               # SUPPRIME — remplace par le loader
│   ├── move-flags.ts          # SUPPRIME — les flags viennent de reference/moves.json
│   ├── type-chart.ts          # SUPPRIME — vient de reference/type-chart.json
│   └── animation-category.ts  # CONSERVE (specifique au jeu)
├── loaders/
│   ├── load-pokemon.ts        # NOUVEAU — lit reference/pokemon.json, filtre par roster
│   ├── load-moves.ts          # NOUVEAU — lit reference/moves.json, filtre par movepool
│   ├── load-type-chart.ts     # NOUVEAU — lit reference/type-chart.json
│   └── load-flags.ts          # NOUVEAU — extrait flags de reference/moves.json
├── load-data.ts               # MODIFIE — orchestre loaders + overrides
├── merge.ts                   # INCHANGE
└── index.ts                   # INCHANGE (meme API publique)
```

### Fichier roster (`roster/roster-poc.ts`)

Ce fichier remplace la partie "curation" de `base/pokemon.ts`. Il definit QUELS Pokemon sont dans le jeu et QUELS moves ils ont :

```typescript
// Chaque entree : id du Pokemon (doit exister dans reference/pokemon.json) + movepool curee
export const rosterPoc: RosterEntry[] = [
  { id: "bulbasaur", movepool: ["razor-leaf", "sleep-powder", "leech-seed", "sludge-bomb"] },
  { id: "charmander", movepool: ["ember", "scratch", "smokescreen", "dragon-breath"] },
  { id: "squirtle", movepool: ["water-gun", "tackle", "withdraw", "bubble-beam"] },
  // ... 21 entrees
];
```

Les stats (baseStats, types, weight, abilities) sont tirees automatiquement de `reference/pokemon.json` par `load-pokemon.ts`. Plus de recopie manuelle.

### Loader Pokemon (`loaders/load-pokemon.ts`)

```typescript
// Recoit les donnees deja fetchees (le fetch est fait par le renderer, pas par le loader)
function loadPokemonFromReference(
  referenceData: ReferencePokemons,
  roster: RosterEntry[]
): PokemonDefinition[] {
  // 1. Pour chaque entree du roster, trouver le Pokemon par id dans referenceData
  // 2. Mapper les champs : { hp, atk, def, spa, spd, spe } → { hp, attack, defense, spAttack, spDefense, speed }
  // 3. Mapper les types : "fire" → PokemonType.Fire
  // 4. Retourner PokemonDefinition[] avec le movepool du roster (pas le learnset complet)
}
```

### Loader Moves (`loaders/load-moves.ts`)

```typescript
function loadMovesFromReference(
  referenceData: ReferenceMoves,
  moveIds: string[]
): BaseMoveData[] {
  // 1. Filtrer les moves par ids utilises dans les movepools du roster
  // 2. Mapper les champs vers BaseMoveData (id, name, type, category, power, accuracy, pp)
  // 3. Extraire les flags de reference/moves.json (remplace move-flags.ts)
  // 4. Retourner BaseMoveData[] pret pour merge avec tactical overrides
}
```

**Note** : les loaders sont des fonctions pures (donnees en entree, `PokemonDefinition[]`/`BaseMoveData[]` en sortie). Ils ne font PAS de fetch — le fetch est la responsabilite du renderer (`BattleSetup`) qui passe les donnees chargees a `loadData()`. Le core reste pur (zero I/O).

### Chargement JSON statique

Pour eviter un `fs.readFile` au runtime (le jeu tourne dans le navigateur), les JSON de reference seront importes statiquement :

```typescript
// Option A : import JSON (Vite supporte nativement)
import pokemonRef from "../../reference/pokemon.json";

// Option B : pre-process au build time
// Un script extrait les Pokemon du roster en un fichier plus leger
```

**Decision** : **Lazy-load au runtime**. Les JSON de reference sont servis comme des assets statiques par Vite (dans `public/` ou via URL import) et fetches au demarrage du jeu. Zero impact bundle, les fichiers sont charges uniquement quand necessaire. Vite sert les fichiers de `public/` directement et les reference JSON y seront copies ou symlinkes.

Concretement :
- Les loaders utilisent `fetch()` pour charger les JSON au runtime
- `loadData()` devient async (ou passe par un cache pre-charge)
- Les JSON de reference sont copies dans `packages/renderer/public/data/` (ou symlink) pour etre servis par Vite
- En production, les JSON sont des assets statiques CDN-friendly (cache longue duree)
- Le core reste pur (pas de fetch) — c'est le renderer/setup qui fetch et passe les donnees au core

## Etapes

### Etape 1 — Creer le format roster

Creer `packages/data/src/roster/roster-poc.ts` avec les 21 Pokemon actuels et leurs movepools. Extraire les donnees de `base/pokemon.ts` en ne gardant que `{ id, movepool }`. Creer le type `RosterEntry`.

**Verification** : le fichier compile, les 21 ids existent dans reference/pokemon.json.

### Etape 2 — Creer les loaders

Creer `loaders/load-pokemon.ts` et `loaders/load-moves.ts` qui lisent les JSON de reference et produisent les memes types que les fichiers actuels (`PokemonDefinition[]` sans targeting/effects, `BaseMoveData[]`).

**Verification** : tests unitaires — les loaders produisent des donnees identiques aux fichiers actuels pour les 21 Pokemon et 74 moves du POC.

### Etape 3 — Migrer load-data.ts

Modifier `load-data.ts` pour utiliser les loaders au lieu des imports directs de `base/pokemon.ts` et `base/moves.ts`. Le flow devient :

1. Lire le roster actif
2. `loadPokemonFromReference(roster)` → `PokemonDefinition[]`
3. Collecter tous les move IDs des movepools
4. `loadMovesFromReference(moveIds)` → `BaseMoveData[]`
5. Merge avec `tacticalOverrides` (inchange)
6. Merge avec `balanceOverrides` (inchange)
7. Appliquer flags depuis reference (remplace move-flags.ts)
8. Retourner `GameData`

**Verification** : `loadData()` retourne exactement les memes donnees qu'avant. Test de snapshot (JSON.stringify avant/apres).

### Etape 4 — Supprimer les fichiers hardcodes

Supprimer `base/pokemon.ts`, `base/moves.ts`, `base/move-flags.ts`, `base/type-chart.ts`. Verifier que rien n'importe ces fichiers directement.

**Verification** : `pnpm build` + `pnpm typecheck` + `pnpm test` — 839 tests verts, zero regression.

### Etape 5 — Servir les JSON comme assets statiques

- Copier (ou symlinker) les fichiers de `packages/data/reference/` vers `packages/renderer/public/data/` pour que Vite les serve
- Ajouter un script ou un hook de build pour maintenir la copie a jour
- Configurer le cache headers pour les assets statiques (en production)

**Verification** : `http://localhost:5173/data/pokemon.json` repond avec le JSON complet. Le bundle JS ne contient pas les donnees Pokemon.

### Etape 6 — Doc et decisions

- Mettre a jour `docs/architecture.md` (nouveau flow de chargement)
- Ajouter decision dans `decisions.md`
- Mettre a jour le plan 049

## Mapping des champs

### Pokemon : reference → core

| Reference (`pokemon.json`) | Core (`PokemonDefinition`) | Transformation |
|---|---|---|
| `id` | `id` | Direct |
| `names.en` | `name` | Direct |
| `types[]` | `types: PokemonType[]` | `"fire"` → `PokemonType.Fire` (capitalize first letter) |
| `baseStats.hp` | `baseStats.hp` | Direct |
| `baseStats.atk` | `baseStats.attack` | Rename |
| `baseStats.def` | `baseStats.defense` | Rename |
| `baseStats.spa` | `baseStats.spAttack` | Rename |
| `baseStats.spd` | `baseStats.spDefense` | Rename |
| `baseStats.spe` | `baseStats.speed` | Rename |
| `weight` | `weight` | Direct |
| — | `movepool` | Vient du roster, pas de la reference |

### Moves : reference → jeu

| Reference (`moves.json`) | Jeu (`BaseMoveData`) | Transformation |
|---|---|---|
| `id` | `id` | Direct |
| `names.en` | `name` | Direct |
| `type` | `type: PokemonType` | `"fire"` → `PokemonType.Fire` |
| `category` | `category: Category` | `"physical"` → `Category.Physical` |
| `power` | `power` | `null` → `0` |
| `accuracy` | `accuracy` | `null` → `0` (status moves) |
| `pp` | `pp` | Direct |
| `flags` | `flags: MoveFlags` | Mapping des cles Showdown vers MoveFlags |
| — | `targeting` | Vient des tactical overrides |
| — | `effects` | Vient des tactical overrides |

## Dependance : plan 050 (preload & loading screen)

Le lazy-load rend le demarrage async. Un plan dedie (050) couvrira la scene de preload Phaser qui charge les JSON de reference, les sprites, tilesets, sons, et affiche une barre de progression. Le plan 049 peut etre implemente avant le 050 (avec un simple `await fetch()` dans BattleSetup), mais le 050 devra etre fait avant une release jouable.

## Risques

1. **Regression de stats** : si le mapping est incorrect, les combats changent silencieusement. Mitigation : test de snapshot comparant avant/apres.
2. **Temps de chargement** : les JSON (3.6 MB + 0.9 MB) sont fetches au demarrage. Mitigation : les fichiers sont cacheables (HTTP cache), et on peut ne fetch que `pokemon.json` + `moves.json` (les 2 necessaires au jeu). Avec gzip, ~1 MB total.
3. **Noms FR** : actuellement le jeu n'utilise que les noms EN. La reference a les noms FR. Pas de risque mais opportunite d'i18n.

## Fichiers critiques a lire avant execution

- `packages/data/src/load-data.ts` — pipeline actuel
- `packages/data/src/base/pokemon.ts` — donnees a migrer (21 Pokemon)
- `packages/data/src/base/moves.ts` — donnees a migrer (74+ moves)
- `packages/data/src/base/move-flags.ts` — flags a migrer
- `packages/data/src/overrides/tactical.ts` — ne pas toucher
- `packages/core/src/types/pokemon-definition.ts` — contrat de type
- `packages/core/src/types/move-definition.ts` — contrat de type
- `packages/data/reference/pokemon.json` — source de verite cible
- `packages/data/reference/moves.json` — source de verite cible

## Verification end-to-end

1. `pnpm build` + `pnpm typecheck` + `pnpm test` — 839+ tests verts.
2. Test snapshot : `JSON.stringify(loadData())` avant et apres migration produit le meme resultat (aux champs pres : meme stats, memes types, memes movepools).
3. Les fichiers `base/pokemon.ts`, `base/moves.ts`, `base/move-flags.ts` n'existent plus.
4. Le roster POC est defini dans `roster/roster-poc.ts` avec 21 entrees.
5. Ajouter un nouveau Pokemon au jeu = ajouter une ligne dans le roster (plus besoin de recopier des stats).
