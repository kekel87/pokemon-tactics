---
status: done
created: 2026-04-11
updated: 2026-04-12 (phase 1 implementee — 1025 especes, 850 moves, 311 abilities, 948 items, 19 indexes)
---

# Plan 048 — Pokedex Reference Knowledge Base

## Contexte

Actuellement le projet a **21 Pokemon** et **74 moves** hardcodés dans `packages/data/src/base/pokemon.ts` et `moves.ts` — tout ce qui est nécessaire pour le POC. Quand Claude conçoit un nouveau move, évalue un équilibrage, ou répond à une question sur un Pokemon, il doit aller chercher sur Showdown / Bulbapedia / Pokepedia / PokeAPI à chaque fois. C'est lent, dépendant du réseau, et rien n'est versionné avec le repo.

**Objectif** : construire une base de connaissance JSON exhaustive dans le repo, consultable offline, couvrant **toutes les générations** (Gen 1 → Gen 9 + Legends ZA + Pokemon Champions si dispo). Cette base sert d'abord de **référence pour Claude** (phase 1). Elle pourra devenir la **source de vérité du jeu** plus tard (phase 2), en remplaçant progressivement les fichiers hardcodés.

Le scope couvre les 151 Gen 1 (décision #92) et bien au-delà — le jeu reste limité au roster Gen 1 pour le POC, mais la référence couvre tout pour que Claude puisse concevoir en connaissance de cause.

## Décisions déjà prises (ne pas rediscuter)

- **Learnsets** : latest only (SV + ZA + Champions si dispo). Pas d'historique par jeu. **Pas d'egg moves** (mécanique d'œuf exclue du scope).
- **Langues** : EN + FR uniquement.
- **Formes** : forme de base + `forms[]` imbriqué. **Gardé** : formes régionales (Alolan/Galarian/Hisuian/Paldean), Paradox, Méga. **Exclus** : Gigantamax (détesté), Z-Moves, Terastallisation (cristaux Téra). La seule mécanique « extra » supportée est la Mégaévolution.
- **Flavor text** : 1 entrée par génération (le dernier jeu de la gen fait foi), EN + FR.
- **Assets visuels** : pas de sprites dans la référence. **Gardé** : URL des cris (`cry`) pour l'audio.
- **Reproduction** : tout ce qui concerne les œufs est exclu (eggGroups, eggCycles, egg moves).
- **Index de catégorisation** : en plus des fichiers bruts, générer des JSON d'index (par type, par flag, par catégorie) pour accélérer les requêtes sémantiques du `move-pattern-designer` et de Claude lui-même.

## Modèle de données

### `pokemon.json` — espèces et formes

Chaque entrée de l'array est une espèce de base. Formes imbriquées sous `forms[]`.

```jsonc
{
  "dexNumber": 6,
  "id": "charizard",
  "generation": 1,
  "names": { "en": "Charizard", "fr": "Dracaufeu" },
  "genus": { "en": "Flame Pokémon", "fr": "Pokémon Flamme" },
  "types": ["fire", "flying"],
  "height": 1.7,           // m
  "weight": 90.5,          // kg
  "color": "red",
  "shape": "upright",
  "habitat": "mountain",
  "genderRatio": { "male": 87.5, "female": 12.5 },
  "catchRate": 45,
  "baseFriendship": 50,
  "baseExperience": 267,
  "growthRate": "medium-slow",
  "evYields": { "spa": 3 },
  "baseStats": { "hp": 78, "atk": 84, "def": 78, "spa": 109, "spd": 85, "spe": 100 },
  "abilities": {
    "ability1": "blaze",
    "ability2": null,
    "hidden": "solar-power"
  },
  "learnset": {
    "levelUp": [
      { "level": 1, "move": "dragon-claw" },
      { "level": 17, "move": "flamethrower" }
    ],
    "tm": ["fire-blast", "earthquake", "..."],
    "tutor": ["..."]
  },
  "evolvesFrom": "charmeleon",
  "evolutions": [],
  "pokedexEntries": {
    "gen1": { "en": "...", "fr": "..." },  // Yellow
    "gen2": { "en": "...", "fr": "..." },  // Crystal
    // ...
    "gen9": { "en": "...", "fr": "..." }   // Scarlet/Violet (ou ZA si dispo)
  },
  "flags": {
    "isLegendary": false,
    "isMythical": false,
    "isUltraBeast": false,
    "isParadox": false
  },
  "cry": "https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/6.ogg",
  "forms": [
    {
      "id": "charizard-mega-x",
      "formName": "Mega X",
      "formType": "mega",          // "mega" | "regional" | "paradox" | "other"
      "types": ["fire", "dragon"],
      "baseStats": { "hp": 78, "atk": 130, "def": 111, "spa": 130, "spd": 85, "spe": 100 },
      "abilities": { "ability1": "tough-claws", "ability2": null, "hidden": null },
      "height": 1.7,
      "weight": 110.5
      // Champs non-override omis (héritent de la forme de base)
    },
    { "id": "charizard-mega-y", "formType": "mega", "...": "..." }
    // PAS de charizard-gmax (Gigantamax exclu)
  ]
}
```

### `moves.json` — tous les moves de toutes les gens

```jsonc
{
  "id": "flamethrower",
  "generation": 1,
  "names": { "en": "Flamethrower", "fr": "Lance-Flammes" },
  "type": "fire",
  "category": "special",
  "power": 90,
  "accuracy": 100,
  "pp": 15,
  "maxPp": 24,
  "priority": 0,
  "target": "normal",        // Showdown-style
  "shortDescription": { "en": "10% chance to burn.", "fr": "10% de chance de brûler." },
  "longDescription": {
    "en": "The target is scorched with an intense blast of fire. This may also leave the target with a burn.",
    "fr": "..."
  },
  "secondary": {
    "chance": 10,
    "status": "brn"
  },
  "drain": null,
  "recoil": null,
  "critRatio": 1,
  "flags": {
    "contact": false,
    "sound": false,
    "bullet": false,
    "protect": true,
    "mirror": true
    // … liste complète
  },
  "ignoresAbility": false,
  "isSignatureOf": null
  // Pas de isZMove / isMaxMove : Z-moves et Max moves exclus du scope.
  // Les moves Z/Max sont filtrés à la génération — ils n'entrent pas dans moves.json.
}
```

### `abilities.json`

```jsonc
{
  "id": "blaze",
  "generation": 3,
  "names": { "en": "Blaze", "fr": "Brasier" },
  "shortDescription": { "en": "At 1/3 HP, Fire moves +50%.", "fr": "..." },
  "longDescription": { "en": "...", "fr": "..." },
  "flags": {
    "breakable": false,
    "ignorable": false,
    "unsuppressable": false
  }
}
```

### `items.json`

```jsonc
{
  "id": "oran-berry",
  "generation": 3,
  "names": { "en": "Oran Berry", "fr": "Baie Oran" },
  "category": "berry",              // berry | heldItem | evolution | medicine | tm | keyItem | battle | mega-stone
  "shortDescription": { "en": "Restores 10 HP.", "fr": "..." },
  "longDescription": { "en": "...", "fr": "..." },
  "flingPower": 10,
  "flingEffect": null,
  "naturalGift": { "type": "poison", "power": 80 },
  "consumable": true,
  "price": 20
}
```

**Catégories exclues** : `z-crystal`, `tera-shard`, `dynamax-crystal` (Z-moves, Téra, Dynamax hors scope). Les mega-stones sont conservées.

### `type-chart.json`

Table 18×18 actuelle + variantes par génération (Gen 1 : pas de Dark/Steel/Fairy ; Gen 6 : Fairy ajouté).

### Fichiers d'index (dérivés, regénérés par le script)

Ces JSON sont des **index inversés** calculés depuis les fichiers bruts. Ils existent pour que Claude puisse répondre instantanément à « donne-moi tous les moves de type Eau avec le flag `bullet` » sans scanner tout `moves.json`, et pour que `move-pattern-designer` puisse proposer des patterns tactiques basés sur la sémantique (sound, fist, slicing, bullet…).

```
reference/indexes/
│
│ # --- MOVES (9) ---
├── moves-by-type.json              # { "fire": ["flamethrower", "ember", ...], ... }
├── moves-by-category.json          # { "physical": [...], "special": [...], "status": [...] }
├── moves-by-flag.json              # { "sound": [...], "punch": [...], "bullet": [...], "slicing": [...], "pulse": [...], "bite": [...], "wind": [...], "powder": [...], "contact": [...] }
├── moves-by-target.json            # { "normal": [...], "allAdjacentFoes": [...], "self": [...], ... }
├── moves-by-secondary-status.json  # { "burn": [...], "paralysis": [...], "sleep": [...], "freeze": [...], "poison": [...], "toxic": [...], "flinch": [...], "confusion": [...] }
├── moves-by-stat-change.json       # { "atk+1": [...], "atk+2": [...], "atk-1": [...], ..., "acc-1": [...], "eva+2": [...] }
├── moves-by-power-bracket.json     # { "status": [...], "1-40": [...], "41-70": [...], "71-90": [...], "91-110": [...], "111+": [...], "variable": [...] }
├── moves-by-priority.json          # { "+4": [...], "+3": [...], "+2": [...], "+1": [...], "0": [...], "-1": [...], "-6": [...] }
├── moves-by-generation.json        # { "1": [...], "2": [...], ..., "9": [...] }
│
│ # --- POKEMON (8) ---
├── pokemon-by-type.json            # { "fire": ["charizard", "arcanine", ...], ... } — inclut les formes
├── pokemon-by-ability.json         # { "intimidate": ["gyarados", "mightyena", ...], ... }
├── pokemon-by-move.json            # { "earthquake": ["rhydon", "golem", ...], ... } — LEARNSET INVERSÉ
├── pokemon-by-generation.json      # { "1": [...], ..., "9": [...] }
├── pokemon-by-flag.json            # { "legendary": [...], "mythical": [...], "ultraBeast": [...], "paradox": [...] }
├── pokemon-by-top-stat.json        # { "hp": [...], "atk": [...], "def": [...], "spa": [...], "spd": [...], "spe": [...] } — stat dominant de la forme de base
├── pokemon-by-bst-bracket.json     # { "<350": [...], "350-450": [...], "450-525": [...], "525-600": [...], "600+": [...] }
├── pokemon-with-mega.json          # [ "charizard", "mewtwo", "lucario", ... ] — liste plate
│
│ # --- ITEMS & ABILITIES (2) ---
├── items-by-category.json          # { "berry": [...], "heldItem": [...], "mega-stone": [...], ... }
└── abilities-by-flag.json          # { "breakable": [...], "ignorable": [...], "unsuppressable": [...] }
```

**19 index au total.** Toujours régénérés depuis les fichiers bruts — jamais édités à la main. Taille totale négligeable (juste des listes d'IDs).

**Règles de dérivation** :
- Les index sur les Pokemon incluent les formes imbriquées (ex. Charizard Mega X apparaît dans `pokemon-by-type.dragon`).
- Pour `pokemon-by-top-stat` : seule la forme de base compte (sinon Ditto transformed fausserait tout).
- Pour `pokemon-by-move` : on parcourt le learnset de la forme de base ET des formes (une Méga peut avoir son propre learnset via Ability si besoin — à vérifier).
- Pour `moves-by-stat-change` : granularité `stat+N` et `stat-N` (ex. `atk+1`, `atk+2`, `spe-1`). Si un move boost plusieurs stats, il apparaît dans chaque clé.
- Pour `moves-by-power-bracket` : status = power null ou 0. Un move avec power variable (Gyro Ball, Electro Ball) va dans `variable`.

## Organisation des fichiers

```
packages/data/
├── src/                          # INCHANGÉ en phase 1
│   └── base/                     # pokemon.ts, moves.ts restent comme aujourd'hui
├── reference/                    # NOUVEAU — référence brute
│   ├── README.md                 # Schéma, sources, comment régénérer, taille
│   ├── pokemon.json
│   ├── moves.json
│   ├── abilities.json
│   ├── items.json
│   ├── type-chart.json
│   ├── indexes/                  # 19 index inversés, régénérés depuis les JSON bruts
│   │   │                         # Voir section "Fichiers d'index" pour la liste complète
│   │   ├── moves-by-*.json       (9 fichiers)
│   │   ├── pokemon-by-*.json     (8 fichiers)
│   │   ├── items-by-category.json
│   │   └── abilities-by-flag.json
│   └── schema/                   # JSON Schema par entité
│       ├── pokemon.schema.json
│       ├── move.schema.json
│       ├── ability.schema.json
│       └── item.schema.json
└── scripts/
    └── build-reference.ts        # NOUVEAU — script one-shot de génération
```

**Pourquoi `reference/` hors de `src/`** : ce n'est pas du code compilé, ce sont des données brutes. Les garder hors de `src/` évite que tsc/Biome les scanne et signale clairement leur rôle de « source documentaire ».

## Sources et stratégie de fetch

**Ordre de priorité par champ** (cf. `data-miner-knowledge.md`) :

| Donnée | Source primaire | Source secondaire |
|---|---|---|
| Base stats, types, abilities | Showdown `pokedex.ts` | PokeAPI (verif) |
| Movepool (latest gen) | Showdown `learnsets.ts` | Bulbapedia (verif) |
| Moves (power, accuracy, flags, target) | Showdown `moves.ts` | PokeAPI |
| Abilities | Showdown `abilities.ts` | PokeAPI |
| Items | Showdown `items.ts` | PokeAPI |
| Height, weight, dexNumber | PokeAPI `/pokemon/{id}` | Bulbapedia |
| Genus, color, shape, habitat, growth rate | PokeAPI `/pokemon-species/{id}` | — |
| Noms FR | PokeAPI `names` (langue `fr`) | — |
| Flavor text FR/EN | PokeAPI `flavor_text_entries` | — |
| Cris (URL) | PokeAPI `cries.latest` | — |

**Showdown URLs stables** (déjà documentées dans `packages/data/.claude/agents/data-miner-knowledge.md`) :
- `https://play.pokemonshowdown.com/data/pokedex.json`
- `https://play.pokemonshowdown.com/data/moves.json`
- `https://play.pokemonshowdown.com/data/abilities.json`
- `https://play.pokemonshowdown.com/data/items.json`
- `https://play.pokemonshowdown.com/data/learnsets.json`
- `https://play.pokemonshowdown.com/data/typechart.json`

**PokeAPI** : `https://pokeapi.co/api/v2/` — stable, pas de rate limit dur.

## Étapes Phase 1 (référence uniquement)

### Étape 1 — Scripts de fetch bruts
Créer `packages/data/scripts/build-reference.ts` (Node TS, exécutable via `pnpm tsx`) qui :
1. Télécharge les 6 fichiers Showdown dans `.cache/showdown/` (gitignored).
2. Télécharge les données PokeAPI par espèce dans `.cache/pokeapi/` (un fichier JSON par Pokemon).
3. Pas de parsing encore — juste download + cache.

**Vérification** : le script tourne, les caches sont remplis, aucune erreur HTTP.

### Étape 2 — Schéma JSON + validation
Écrire les 4 JSON Schemas dans `reference/schema/`. Ajouter `ajv` comme devDep de `packages/data`. Valider les schemas à vide (pas encore de données).

**Vérification** : `pnpm --filter @pokemon-tactic/data run validate-schemas` passe.

### Étape 3 — Génération de `pokemon.json`
Le script parse les caches, produit `pokemon.json` conforme au schéma :
- Itère sur chaque entrée Showdown `pokedex`.
- Détermine la forme de base vs variante (`baseSpecies`, `forme`).
- **Filtre** : exclut les formes Gigantamax (`-gmax`), les formes Totem, les formes avec `forme === 'Gmax'`.
- Merge avec PokeAPI pour height/weight/dex#/flavor/FR/cry.
- Nest les formes conservées sous `forms[]` avec `formType` dérivé (`mega` / `regional` / `paradox` / `other`).
- Applique learnset Showdown (latest gen : SV — + ZA si détecté), **exclut les egg moves**.
- Valide contre `pokemon.schema.json`.

**Vérification** : `reference/pokemon.json` existe, `ajv validate` passe, `jq '. | length'` retourne ~1025, aucune entrée avec `formType: "gmax"`, aucune entrée `learnset.egg`.

### Étape 4 — Génération de `moves.json`, `abilities.json`, `items.json`, `type-chart.json`
Même logique, chacun son parseur. Tous validés contre leur schéma.
- `moves.json` : **exclut** les moves flaggés Z-Move ou Max Move côté Showdown (`isZ`, `isMax`).
- `items.json` : **exclut** les Z-crystals, Tera shards, Dynamax crystals. **Conserve** les mega-stones.

**Vérification** : 4 fichiers JSON valides, taille réaliste (~1-3 MB chacun). Aucun item `z-crystal` ou `tera-shard`. Aucun move avec `isZ` ou `isMax`.

### Étape 4bis — Génération des 19 index inversés
Une fois les fichiers bruts validés, générer les 19 index en un seul pass :

**Moves (9)** — dérivés de `moves.json` :
- `moves-by-type` : groupBy `type`.
- `moves-by-category` : groupBy `category`.
- `moves-by-flag` : pour chaque flag à `true`, pousser l'id.
- `moves-by-target` : groupBy `target`.
- `moves-by-secondary-status` : inspecte `secondary.status` et `secondary.volatileStatus`.
- `moves-by-stat-change` : inspecte `secondary.boosts` et les self-boosts (granularité `stat±N`).
- `moves-by-power-bracket` : bracketing `power` (status / 1-40 / 41-70 / 71-90 / 91-110 / 111+ / variable).
- `moves-by-priority` : groupBy `priority`.
- `moves-by-generation` : groupBy `generation`.

**Pokemon (8)** — dérivés de `pokemon.json` (incluant formes) :
- `pokemon-by-type` : pour chaque type de chaque forme, pousser l'id.
- `pokemon-by-ability` : pour chaque ability (1, 2, hidden), pousser l'id.
- `pokemon-by-move` : **learnset inversé**. Itère sur chaque Pokemon × chaque move de son learnset (levelUp, tm, tutor) → pousse l'id du Pokemon dans la liste du move.
- `pokemon-by-generation` : groupBy `generation`.
- `pokemon-by-flag` : pour chaque flag à `true` (legendary/mythical/ultraBeast/paradox), pousser l'id.
- `pokemon-by-top-stat` : calcule le stat max de `baseStats` (forme de base uniquement), pousse l'id dans la clé.
- `pokemon-by-bst-bracket` : calcule BST = somme des baseStats, bracket, pousse l'id.
- `pokemon-with-mega` : itère sur les Pokemon qui ont au moins une forme avec `formType: "mega"`.

**Items (1)** — `items-by-category` : groupBy `category`.

**Abilities (1)** — `abilities-by-flag` : pour chaque flag à `true`, pousser l'id.

**Vérification** :
- 19 index existent, valides JSON.
- Spot-checks : `moves-by-type.fire` contient `flamethrower`, `pokemon-by-type.fire` contient `charizard`, `pokemon-by-move.earthquake` contient `groudon`, `pokemon-with-mega` contient `charizard`, `moves-by-secondary-status.burn` contient `flamethrower`.

### Étape 5 — README et intégration mémoire Claude
Écrire `packages/data/reference/README.md` :
- Schéma de chaque entité (lien vers JSON Schema).
- Sources et date de génération.
- Comment régénérer (`pnpm --filter @pokemon-tactic/data run build-reference`).
- Taille totale, disclaimer « ZA/Champions : dispo sous réserve que Showdown l'ait indexé ».

Ajouter dans `.claude/rules/data.md` ou `CLAUDE.md` une ligne : « Avant d'aller chercher sur Showdown/Bulbapedia/PokeAPI, consulter `packages/data/reference/*.json` ».

**Vérification** : le README est lisible et suffit pour repartir de zéro 6 mois plus tard.

### Étape 6 — Décision # et doc
Ajouter une entrée dans `docs/decisions.md` documentant le choix de format (forms imbriquées, latest-only learnsets, EN/FR, flavor par gen, exclusions Gmax/Z/Téra). Mentionner plan 048 dans `docs/plans/README.md`.

**Vérification** : `doc-keeper` content.

## Phase 2 — Migration code jeu (plus tard)

Non couverte par ce plan. Sketch pour mémoire :
- Remplacer `packages/data/src/base/pokemon.ts` et `moves.ts` par un loader qui lit `reference/*.json` et filtre sur le roster POC.
- Les couches `tactical` et `balance` (overrides projet) restent séparées.
- Migration progressive : un Pokemon à la fois.
- Tests de non-régression : snapshot des stats/movepools avant/après.

Créera un `docs/plans/049-migrate-game-data-to-reference.md` le moment venu.

## Questions ouvertes (à décider pendant l'implémentation)

1. **Pokemon Legends Z-A et Pokemon Champions** : statut Showdown à vérifier empiriquement au moment de la génération. Si pas encore indexé, TODO dans le README, pas de blocage — on commite avec ce que Showdown a.
2. **Target/range des moves** : gardé brut tel que Showdown l'expose (`normal`, `allAdjacentFoes`, `self`…). Utile pour `move-pattern-designer` qui s'en sert pour proposer des patterns tactiques.
3. **Taille totale et git-lfs** : estimation ~6-12 MB JSON après filtrage (Gmax/Z/egg moves exclus). À vérifier empiriquement étape 4. Si trop lourd pour du text checked-in classique, on discutera de **Git LFS** pour `reference/*.json`. Décision reportée à l'après-génération quand on a une taille concrète.
4. **gitignore `.cache/`** : confirmé. Le cache de fetch local n'est pas commité.

## Fichiers critiques à lire avant exécution

- `packages/data/src/base/pokemon.ts` — format actuel (pour comparer)
- `packages/data/src/base/moves.ts` — idem
- `packages/data/src/base/move-flags.ts` — flags déjà alignés Showdown (décision #239)
- `packages/data/src/load-data.ts` — pour comprendre les couches base + tactical + balance
- `packages/data/.claude/agents/data-miner.md` + `data-miner-knowledge.md` — sources et gotchas
- `docs/decisions.md` — décisions #92 (Gen 1), #182 (stats latest gen), #239 (flags)
- `docs/roster-poc.md` — pour vérifier qu'on ne casse pas le POC

## Vérification end-to-end

1. `pnpm --filter @pokemon-tactic/data run build-reference` s'exécute sans erreur, < 5 min.
2. `packages/data/reference/` contient : 5 fichiers JSON bruts (`pokemon`, `moves`, `abilities`, `items`, `type-chart`) + 19 index + 4 schemas + README.
3. `ajv validate -s reference/schema/pokemon.schema.json -d reference/pokemon.json` passe (idem pour les 3 autres entités).
4. Claude peut répondre à « quelle est la stat Def de Dragapult ? » via `jq` sans ouvrir de browser.
5. Claude peut répondre à « donne-moi tous les moves sound de type Normal » via `jq` sur `indexes/moves-by-flag.json` croisé avec `indexes/moves-by-type.json`.
6. `pnpm build` + `pnpm lint` + `pnpm typecheck` + `pnpm test` passent (rien ne touche `src/`, zéro régression attendue).
7. Spot-check manuel : 5 Pokemon aléatoires (un par gen) — stats et types corrects vs Showdown. Vérifier qu'aucun Gmax / Z-move / Tera n'apparaît. Vérifier que la Méga de Charizard est bien présente.
