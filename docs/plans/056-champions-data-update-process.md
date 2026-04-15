---
status: done
created: 2026-04-15
updated: 2026-04-15
---

# Plan 056 — Processus de mise à jour des données Champions

## Objectif

Faire de **Pokemon Champions** la source de vérité pour les données du jeu (stats, PP, puissance, type, effets) par-dessus une base Showdown. Automatiser la mise à jour avec une commande simple, un diff humainement reviewable, et un layering clair pour que les valeurs Champions priment sur les valeurs classiques.

**Hors scope** (reporté) :
- IV fixes à 31 / SP / nature → plan séparé quand on sera prêt à toucher `stat-calculator.ts` et la formule d'initiative
- Watcher automatique des patches Champions → pas demandé
- CI de vérification de staleness → jugé over-engineering

## Contexte

Aujourd'hui :
- `packages/data/scripts/build-reference.ts` fetch Showdown Gen 9 SV + PokeAPI → `reference/*.json`
- Zéro donnée Champions intégrée
- Le plan 054 a laissé explicitement une section "Changements de statuts Champions (à intégrer)" qui n'a jamais été faite
- Les PP du jeu sont classiques (5-40) au lieu de Champions (8-20), ce qui **déséquilibre le système CT** déjà en place (le `ppCost` tombe sur les mauvais paliers)
- Le game design (coûts CT, balance) a été calibré avec les valeurs Champions en tête → il faut aligner les données

Contraintes :
- L'humain ne code pas — le process doit être fiable et le diff lisible
- Claude doit pouvoir exécuter le script sans intervention
- Le fichier `reference/*.json` est committé (~8 MB) → un diff massif cassera la review

## Décisions déjà prises (ne pas rediscuter)

- **Layering** : option B — base Showdown Gen 9 + override Champions fetché. Source primaire confirmée : **Showdown mod `champions`** (voir étape 1).
- **Cadence** : déclenchement manuel par l'humain via `pnpm data:update`, pas de CI
- **Review** : `pnpm data:diff` avant commit, reviewé par l'humain
- **Formule stats** : reportée — on ne touche pas à `stat-calculator.ts` dans ce plan
- **Pokemon Champions est sorti le 8 avril 2026**, mod Showdown mergé le 11 avril 2026 → source stable à ce jour

## Architecture cible

```
┌──────────────────────────────────────────────────────────────────┐
│  FETCH (scripts/fetch/)                                          │
│                                                                  │
│  fetch-showdown.ts   → .cache/showdown/*.{json,ts}               │
│  fetch-pokeapi.ts    → .cache/pokeapi/*.json                     │
│  fetch-champions.ts  → .cache/champions/*.json   (NOUVEAU)       │
└───────────────┬──────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────┐
│  BUILD (scripts/build-reference.ts)                              │
│                                                                  │
│  1. Transform Showdown + PokeAPI → entries                       │
│  2. Apply Champions overrides     → entries (muté)               │
│  3. Validate schemas              → fail fast si invalide        │
│  4. Write reference/*.json + indexes + champions-status.json     │
└───────────────┬──────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────┐
│  DIFF (scripts/data-diff.ts)                                     │
│                                                                  │
│  git diff reference/*.json → résumé lisible :                    │
│   • "Thunderbolt PP 15 → 16, power 90 → 90"                      │
│   • "Paralysie skip 25% → 12.5%"  (si status data versionnée)    │
│   • "Pikachu baseStats inchangé"                                 │
└──────────────────────────────────────────────────────────────────┘
```

**Point clé** : les overrides Champions ne sont **pas** un fichier JSON brut recopié ailleurs — ils sont appliqués **pendant** la transformation, donc `reference/moves.json` contient directement les valeurs Champions. Aucune couche supplémentaire côté loaders.

**Audit trail** : pas de fichier dédié. La trace des overrides est :
- `.cache/champions/*.ts` (gitignored) — source brute du dernier fetch, consultable localement
- Le repo Showdown en ligne — source historique (`git log data/mods/champions/` côté Showdown)
- `pnpm data:diff` — changements depuis le dernier commit de `reference/*.json`

Pas besoin de dupliquer ces informations dans un fichier généré.

## Étapes

### Étape 1 — Sources Champions (confirmées)

#### Source primaire : Showdown mod `champions`

URL racine : `https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/champions/`

| Fichier | Taille | Contenu | Ce qu'on en extrait |
|---------|--------|---------|---------------------|
| `moves.ts` | 19 KB | Overrides partiels (basePower, pp, effects) + marquage "Past" des moves retirés | `ChampionsOverride.moves` |
| `formats-data.ts` | 75 KB | Tier par Pokemon (OU / Illegal / Past) → indique le roster | Filtre `isInChampions` (pas obligatoire pour notre POC Gen 1) |
| `learnsets.ts` | 278 KB | Learnsets complets Champions (pas d'inherit) | `ChampionsOverride.learnsets` |
| `abilities.ts` | 2 KB | Overrides d'abilities | `ChampionsOverride.abilities` |
| `items.ts` | 16 KB | Overrides d'items | `ChampionsOverride.items` |
| `conditions.ts` + `scripts.ts` | — | Mécaniques modifiées (Mega, **statuts**, etc.) | `ChampionsOverride.status` — parsing spécifique (TS logic, pas data) |

**Point clé** : le mod Champions utilise le pattern Showdown `inherit: true` + champs modifiés. C'est **exactement le format d'override** qu'on veut produire côté projet — le parsing est quasi 1:1.

Les fichiers sont du **TypeScript** (comme `data/abilities.ts` déjà parsé par `build-reference.ts` via regex). Stratégie : extraire les entrées via regex ou `@typescript/vfs` parser (à décider à l'implémentation — regex suffira probablement pour des objets plats).

#### Source secondaire (fallback + cross-validation) : projectpokemon/champout

URL : `https://raw.githubusercontent.com/projectpokemon/champout/main/masterdata/*.json`

- `personal.json` — stats de base des 323 espèces (HP, Atk, Def, SpAtk, SpDef, Speed, types, abilities) par ID numérique
- `waza.json` — 918 moves avec power/accuracy/pp/type/category/priority
- `waza_learn.json` — learnsets par ID numérique
- Mapping noms dans `rom-txt/usa/wazaname.json` et `monsname_syn.json`

**Utilité** : validation des stats de base (Showdown ne les override pas dans le mod car elles sont héritées de Gen 9 sans changement, donc on reste sur la base Showdown Gen 9 — champout sert juste de double-check optionnel).

#### Sources écartées

- **PokeAPI** : a un `version-group/32/` Champions mais les données sont vides. PokeAPI est toujours en retard de plusieurs mois. On garde PokeAPI uniquement pour les noms FR (usage actuel), pas pour Champions.
- **pauloarayasantiago/pokemon-champions-data** : CSV scrapés Serebii/Pikalytics — incomplet et instable.

#### Ce qui manque

- **Stats de base** : Showdown mod `champions` ne les override pas (héritage Gen 9). Si Champions change des stats (peu probable mais possible), on ne les verra pas via Showdown. → Validation croisée avec champout si on veut être paranoïaque, sinon on accepte le risque.
- **Noms FR** : aucune source Champions FR. On continue d'utiliser PokeAPI pour les noms FR existants, et on ajoutera les nouveaux moves/Pokemon Champions en EN seulement jusqu'à ce que PokeAPI rattrape. → Acceptable pour nous.

#### Documentation

Tout ceci est documenté dans `.claude/agents/data-miner-knowledge.md` à l'étape 7.

### Étape 2 — Structure de l'override Champions

Définir un type `ChampionsOverride` dans `packages/data/scripts/types/champions-override.ts` :

```typescript
export interface ChampionsOverride {
  version: string;         // ex: "2026-03-patch-4"
  fetchedAt: string;        // ISO date
  source: string;           // URL d'origine
  moves: Record<string, MoveOverride>;
  pokemon: Record<string, PokemonOverride>;
  abilities: Record<string, AbilityOverride>;
  items: Record<string, ItemOverride>;
  learnsets: Record<string, LearnsetOverride>;  // pokemonId → learnset Champions
  status: StatusOverrides;
  // Note : rosterTiers (formats-data.ts) volontairement absent — ignoré pour notre POC Gen 1
}

export interface MoveOverride {
  pp?: number;
  // maxPp NON listé ici : dérivé de pp par applyChampionsMovesOverride
  power?: number;
  accuracy?: number;
  type?: string;
  category?: 'physical' | 'special' | 'status';
  secondary?: SecondaryEffect | null;  // null = supprimé par Champions
  // … autres champs connus pour changer (priority, target, flags)
}

export interface AbilityOverride {
  shortDescription?: { en: string; fr?: string };
  longDescription?: { en: string; fr?: string };
  // flags si Champions ajoute/change breakable/ignorable
}

export interface ItemOverride {
  shortDescription?: { en: string; fr?: string };
  // champs à découvrir au parsing
}

export interface LearnsetOverride {
  levelUp?: Array<{ level: number; move: string }>;
  tm?: string[];
  tutor?: string[];
}

export interface StatusOverrides {
  paralysis?: { skipRate?: number; speedMult?: number };
  freeze?: { thawRate?: number; maxTurns?: number };
  sleep?: { minTurns?: number; maxTurns?: number; guaranteedWakeAt?: number };
  // burn / poison / badly-poisoned : inchangés en Champions, pas d'entry
}
```

Les champs **optionnels** sont cruciaux : l'override ne liste que ce qui change. Si Champions ne modifie pas un move, il n'apparaît pas → diff minimal.

### Étape 3 — `fetch-champions.ts`

Nouveau script `packages/data/scripts/fetch/fetch-champions.ts`. Structure :

```typescript
const CHAMPIONS_BASE = "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/champions";

export async function fetchChampionsData(): Promise<ChampionsOverride> {
  const [movesTs, abilitiesTs, itemsTs, learnsetsTs, formatsDataTs, conditionsTs] = await Promise.all([
    cachedFetchText(`${CHAMPIONS_BASE}/moves.ts`, "champions/moves.ts"),
    cachedFetchText(`${CHAMPIONS_BASE}/abilities.ts`, "champions/abilities.ts"),
    cachedFetchText(`${CHAMPIONS_BASE}/items.ts`, "champions/items.ts"),
    cachedFetchText(`${CHAMPIONS_BASE}/learnsets.ts`, "champions/learnsets.ts"),
    cachedFetchText(`${CHAMPIONS_BASE}/formats-data.ts`, "champions/formats-data.ts"),
    cachedFetchText(`${CHAMPIONS_BASE}/conditions.ts`, "champions/conditions.ts"),
  ]);

  return {
    version: "showdown-champions",
    fetchedAt: new Date().toISOString(),
    source: CHAMPIONS_BASE,
    moves: parseChampionsMoves(movesTs),
    pokemon: parseChampionsPokemon(movesTs),  // Champions n'override pas les stats aujourd'hui — parser vide attendu
    abilities: parseChampionsAbilities(abilitiesTs),
    items: parseChampionsItems(itemsTs),
    learnsets: parseChampionsLearnsets(learnsetsTs),
    status: CHAMPIONS_STATUS_MANUAL,  // transcription manuelle, cf. décision
  };
}
```

**Parsing** :
- `moves.ts`, `abilities.ts`, `items.ts`, `learnsets.ts` : regex sur les objets plats (réutiliser `parseShowdownAbilityFlags` comme modèle)
- `formats-data.ts` : fetché mais **non parsé** (décision roster tiers ignorés)
- `conditions.ts` : fetché pour traçabilité mais **non parsé** — les valeurs statuts sont transcrites à la main dans une constante `CHAMPIONS_STATUS_MANUAL` co-localisée dans `fetch-champions.ts`. À mettre à jour manuellement à chaque patch Champions majeur (événement rare, ~10 lignes).

### Étape 4 — Application dans `build-reference.ts`

Refactor minimal de `build-reference.ts` :

```typescript
// Après transformShowdown + transformPokeApi
const moves = transformMoves(showdown, pokeapi.moves);
const pokemon = transformPokemon(showdown, pokeapi);

// NOUVEAU
const overrides = await fetchChampionsData();
const movesFinal = applyChampionsMovesOverride(moves, overrides.moves);
const pokemonFinal = applyChampionsPokemonOverride(pokemon, overrides.pokemon);

// Status overrides → écrits dans un fichier dédié (consommé par plan 057)
await writeJson("champions-status.json", overrides.status);
```

Les fonctions `applyChampionsMovesOverride` / `applyChampionsPokemonOverride` (+ `applyChampionsAbilitiesOverride`, `applyChampionsItemsOverride`, `applyChampionsLearnsetsOverride`) :
- Itèrent sur chaque entrée override
- Mutent **seulement les champs listés** dans l'override
- **Recalculent `maxPp`** automatiquement quand `pp` change (`maxPp = Math.floor(override.pp * 1.6)`) — non listé dans `MoveOverride` car dérivé
- Échouent si un override cible un ID inexistant (typo-protection — évite les silent breakages si Showdown renomme un ID)
- Affichent un résumé console `Applied N move overrides, M pokemon overrides, …` à la fin du run

Le fichier `reference/champions-status.json` est consommé par le core via un nouveau loader `loadStatusRules()` (à créer dans un plan ultérieur — **pas ce plan**). Pour l'instant on l'écrit, le core l'ignore.

### Étape 5 — `data-diff.ts`

Nouveau script `packages/data/scripts/data-diff.ts` :
- Lit `git show HEAD:packages/data/reference/moves.json` et `reference/moves.json` (current)
- Pour chaque move : diff champ par champ, filtre les champs inchangés
- Output console : tableau lisible
  ```
  === Moves modifiés (12) ===
  thunderbolt          pp: 15 → 16
  flamethrower         pp: 15 → 16
  earthquake           pp: 10 → 12
  hyper-beam           power: 150 → 150  (recharge inchangé)
  …
  === Pokemon modifiés (0) ===
  === Statuts modifiés ===
  paralysis.skipRate   0.25 → 0.125
  freeze.thawRate      0.20 → 0.25
  freeze.maxTurns      null → 3
  ```
- Idem pour pokemon.json, abilities.json, items.json

**Edge cases** :
- Si `git show HEAD:...` échoue (fichier absent de l'historique, ex: premier run après un `git rm`) → afficher `N/A (first run — no previous reference in HEAD)` et continuer
- Si les deux fichiers sont identiques → `=== No changes ===`
- Si `.git/` est absent (script lancé hors repo) → erreur claire `Not in a git repository` + exit 1

Sortie : stdout + code de retour 0 en cas normal. Ce n'est pas un gate CI, c'est un outil d'audit humain.

### Étape 6 — Scripts npm

Ajouter dans `packages/data/package.json` :
```json
{
  "scripts": {
    "data:update": "tsx scripts/build-reference.ts",
    "data:diff": "tsx scripts/data-diff.ts",
    "data:update:fetch-only": "tsx scripts/build-reference.ts --fetch-only",
    "data:update:skip-fetch": "tsx scripts/build-reference.ts --skip-fetch"
  }
}
```

Et dans le root `package.json` (pour éviter `--filter`) :
```json
{
  "scripts": {
    "data:update": "pnpm --filter @pokemon-tactic/data run data:update",
    "data:diff": "pnpm --filter @pokemon-tactic/data run data:diff"
  }
}
```

### Étape 7 — Documentation

Créer `docs/process-data-update.md` :
- **Quand** lancer `pnpm data:update` (patch Champions repéré, initialisation, nouveau Pokemon ajouté au roster)
- **Comment** : `pnpm data:update` → `pnpm data:diff` → review → commit
- **Sources utilisées** : Showdown, PokeAPI, Champions (+ URL)
- **Cas d'échec** : source Champions down, schéma invalide, override sur ID inconnu
- **Contact humain** : si le diff dépasse N lignes, signaler dans le message de commit

Mettre à jour :
- `packages/data/reference/README.md` — ajouter la source Champions
- `.claude/agents/data-miner-knowledge.md` — ajouter URL Champions + gotchas
- `.claude/rules/data.md` — ajouter note "Les valeurs dans reference/ sont alignées Champions, pas classique"
- `docs/decisions.md` — entrée pour la décision Champions source de vérité

### Étape 8 — Run initial + validation + commit

1. `pnpm data:update` (premier run avec Champions)
2. `pnpm data:diff` → review humaine du diff
3. **Lancer la suite complète de tests** — certains risquent de casser :
   - `packages/core/src/battle/golden-replay.test.ts` — utilise les PP réels pour initialiser `currentPp`. Si les PP changent (ex: thunderbolt 15→16), le CT cost change (`ppCost(16)=600` au lieu de `ppCost(15)=700`), l'ordre CT diverge, le replay ne matche plus la référence. **Action** : régénérer le snapshot golden après validation humaine du nouveau comportement.
   - `packages/core/src/ai/scored-ai-smoke.test.ts` — initialise aussi les PP depuis les données. Même risque.
   - Tests de moves spécifiques (`thunderbolt.test.ts`, etc.) — vérifier qu'aucun n'asserte `currentPp === 15` en dur.
4. Ajuster les tests qui doivent accepter les nouvelles valeurs (pas de contournement — si un test échoue parce que la PP a changé, c'est légitime).
5. Commit `reference/*.json` + `reference/champions-status.json` + tests mis à jour.

Attention : ce commit peut être gros (200+ moves touchés, 1-2 snapshots golden régénérés). On accepte.

**Hors scope de l'étape 8** : toucher le gameplay pour aligner paralysie 12.5% / gel / sommeil. C'est le plan 057.

## Fichiers impactés

**Nouveaux** :
- `packages/data/scripts/fetch-champions.ts` (tout : fetch + parsers + `CHAMPIONS_STATUS_MANUAL` constante + fonctions `applyChampions*Override`)
- `packages/data/scripts/champions-override.types.ts` (types `ChampionsOverride`, `MoveOverride`, etc.)
- `packages/data/scripts/data-diff.ts`
- `packages/data/reference/champions-status.json` (généré)
- `docs/process-data-update.md`

**Note architecture** : pas d'extraction préalable de `fetch-showdown.ts` / `fetch-pokeapi.ts` depuis `build-reference.ts`. Ce serait un refactor orthogonal, hors scope. `fetch-champions.ts` réutilise les helpers existants (`cachedFetchText`) en les important depuis `build-reference.ts` (qu'on rend importable au passage : déplacer les utilities dans un `scripts/fetch-utils.ts` ou exporter depuis `build-reference.ts`).

**Modifiés** :
- `packages/data/scripts/build-reference.ts` (apply overrides, write new files)
- `packages/data/package.json` (scripts npm)
- `package.json` racine (scripts npm proxy)
- `packages/data/reference/README.md`
- `.claude/agents/data-miner-knowledge.md`
- `.claude/rules/data.md`
- `docs/decisions.md`

**Regénérés (diff attendu massif)** :
- `packages/data/reference/moves.json` (PP 5-40 → 8-20, **`maxPp` recalculé**, power ajustements)
- `packages/data/reference/pokemon.json` (aucun changement attendu — Champions n'override pas les stats aujourd'hui)
- `packages/data/reference/abilities.json` (descriptions possibles)
- `packages/data/reference/items.json` (descriptions possibles)
- Les 19 fichiers d'index (re-dérivés automatiquement)
- Potentiellement 1-2 snapshots de `golden-replay.test.ts` régénérés

## Ce que ce plan NE fait PAS

- **Ne modifie pas le core** (`status-tick-handler.ts` paralysie 25%→12.5%, etc.) — le fichier `champions-status.json` est généré mais le core ne le lit pas encore. Un plan 057 s'en chargera, en lisant ce fichier.
- **Ne touche pas à `stat-calculator.ts`** — IV/SP/nature plus tard.
- **Ne modifie pas les loaders existants** (`load-moves.ts`, `load-pokemon.ts`) — ils lisent `reference/*.json` qui contient déjà les valeurs Champions.

## Vérifications end-to-end

1. `pnpm data:update` s'exécute sans erreur
2. `reference/moves.json` contient les PP Champions (ex: thunderbolt.pp === 16)
3. `reference/champions-status.json` existe, contient paraSkipRate, etc.
4. `pnpm data:diff` affiche un résumé lisible (pas un blob JSON)
5. `pnpm test` dans packages/core passe, **avec éventuellement snapshot golden régénéré** si PP ont changé (cf. étape 8)
6. `pnpm test` dans packages/data passe — ajouter tests unitaires pour `applyChampionsMovesOverride` (cas nominal + recalc `maxPp` + override sur ID inconnu qui throw)
7. Le diff Git de `reference/moves.json` est grand (~200 moves touchés probablement) ; `pnpm data:diff` doit rendre la review faisable
8. `maxPp` est cohérent avec `pp` partout dans `moves.json` (règle : `maxPp === Math.floor(pp * 1.6)` pour tous les moves overridés)

## Agents déclenchés

| Moment | Agent |
|--------|-------|
| Après étape 2 (types) | `core-guardian` (pas de dep UI dans data) |
| Après étape 4 (build-reference refactor) | `code-reviewer` |
| Après étape 5 (data-diff) | `test-writer` (test unitaire sur le diff) |
| Après étape 8 (commit) | `doc-keeper` + `commit-message` |
| Run initial qui casse des tests | `debugger` |

## Décisions validées par l'humain

1. **Parsing de `conditions.ts` Champions** : transcription manuelle dans `ChampionsOverride.status` basée sur la lecture humaine du fichier. Les statuts Champions changent très rarement (~10 lignes à maintenir). Regex écartée (trop fragile si Showdown renomme).
2. **Roster tiers Champions** : ignoré. Notre POC Gen 1 est entièrement couvert par Champions, pas de filtrage nécessaire.
3. **Chaînage 056 → 057** : confirmé. Ce plan livre les données (`champions-status.json` + overrides dans `moves.json`). Le plan 057 fera que le core consomme `champions-status.json` pour aligner paralysie (25%→12.5%), gel (20%→25%, max 3 tours), sommeil (garanti au 3e tour).
