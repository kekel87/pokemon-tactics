# Plan 089 — Normalisation IDs Showdown → kebab-case build-time

> Statut : **done** (2026-05-21)
> Créé : 2026-05-21
> Auteur : Claude
> Contexte : récurrence bugs ID mismatch Showdown/kebab (plan 081, 087, fix 2026-05-21 phantom-force invisible team builder)

## Livraison

- `build-reference.ts` : `buildRawMoveIdToKebabMap(showdown.moves)` construit mapping `compressedId → kebab` via `toKebabCase(move.name)`. Passé à `parseLearnset` + `applyLearnsetOverride` (Champions). Reference `pokemon.json` learnsets désormais 100% kebab (`leech-seed`, `phantom-force`, `close-combat`). Indexes `pokemon-by-move` régénérés en kebab.
- `packages/data/src/` : suppression `buildShowdownToKebabIndex` (load-pokemon), suppression param `showdownToKebab` de `LoadPokemonOptions`, `initializeLearnsetResolver`, `team-builder-registry`, `load-data`. `learnset-resolver.translateMoveId` supprimée. Zéro mention `showdown` côté packages/data/src/ (sauf io user-facing Showdown via core).
- Golden replay régénéré (107 actions / round 11) après normalisation — ordering Set d'iteration sur learnsets kebab vs compressed légèrement différent.
- Gate CI : 1542 unit + 191 intégration + build + lint clean.

## Résidu

- `moves.json[].secondary.volatileStatus = "leechseed"` (1 occurrence) + `indexes/moves-by-secondary-status.json` key `leechseed` (1 entrée) — hors scope (autre champ que learnset, n'impacte pas movepool/team builder).

## Objectif

Éliminer définitivement la classe de bugs liée au mismatch entre **IDs Showdown compressés** (`phantomforce`, `leechseed`) présents dans `packages/data/reference/*.json` et **IDs kebab-case** (`phantom-force`, `leech-seed`) utilisés partout ailleurs (overrides, core, renderer, i18n, sprites).

Solution choisie : **normalisation build-time** dans `build-reference.ts`. Le pipeline `pnpm data:update` produit des `reference/*.json` 100% kebab. Aucune translation runtime sauf à la frontière import/export Showdown user-facing (1-2 sites).

## Pourquoi maintenant

- 3 bugs identifiés et corrigés un par un dans 3 plans différents (081 normalizer + 087 buildShowdownToKebabIndex + fix 2026-05-21 learnset-resolver). Tous patches au lieu d'un fix racine.
- Récurrence garantie à chaque nouveau site d'utilisation reference oublié.
- Pipeline `pnpm data:update` est rare (manuel, contrôlé) — bon endroit pour normaliser.
- Effort modéré : 1 script + audit downstream + regen.

## Cause racine

Showdown utilise des IDs **compressés sans séparateurs** : `phantomforce`, `leechseed`, `closecombat`. Notre code utilise **kebab-case** standard : `phantom-force`, `leech-seed`, `close-combat`.

`build-reference.ts` télécharge les données depuis Showdown et les stocke **brutes** (Showdown format) dans `reference/*.json`. Les consommateurs downstream doivent ensuite traduire à chaque utilisation.

Sites de translation actuels (recensés) :
- `loadPokemonFromReference` (plan 087, via `buildShowdownToKebabIndex`)
- `team-builder-registry.buildTeamBuilderRegistry` (fix 2026-05-21)
- `learnset-resolver.initializeLearnsetResolver` (fix 2026-05-21, paramètre optionnel)
- `team-builder-catalog.getCatalogMoves` (utilise déjà kebab via overrides — pas concerné)
- Showdown import/export (`toShowdownId`/`fromShowdownId` dans team-builder-registry — frontière user-facing légitime)

Bugs historiques :
- Plan 081 : ID normalizer Showdown ajouté (TeamSet import/export)
- Plan 087 : `buildShowdownToKebabIndex` créé pour dériver `PokemonDefinition.movepool`
- 2026-05-21 : phantom-force / shadow-force / baton-pass invisibles team builder picker (translation manquante dans `getLegalMoves`)

## Hors scope

- Refonte du pipeline `pnpm data:update` (téléchargement Showdown reste tel quel)
- Refonte format reference (structure JSON inchangée, seuls les **valeurs** d'IDs sont normalisées)
- Refonte des Pokemon IDs (déjà kebab : `farfetch-d`, `mr-mime`, `nidoran-m`)
- Refonte type names (`fire`, `flying` — pas de tiret de toute façon)
- Ability IDs (déjà kebab dans reference : `compound-eyes`, `swift-swim`)
- Item IDs (déjà kebab : `choice-band`, `leftovers`)

## Décisions à acter (à valider avant impl)

1. **Quel champ normalise ?**
   - `reference/moves.json[].id` : `"phantomforce"` → `"phantom-force"`
   - `reference/pokemon.json[].learnset.levelUp[].move` : `"phantomforce"` → `"phantom-force"`
   - `reference/pokemon.json[].learnset.tm[]` : idem
   - `reference/pokemon.json[].learnset.tutor[]` : idem
   - `reference/indexes/pokemon-by-move.json` : keys deviennent kebab
   - `reference/indexes/moves-by-*.json` : valeurs deviennent kebab
   - `reference/indexes/learnsets-by-move.json` (si existe) : keys deviennent kebab
2. **Mapping Showdown → kebab** : générer via heuristique (couper en mots via dictionnaire ?) OU via la **clé `names.en`** déjà présente dans le JSON (transformer `"Phantom Force"` → kebab via slugify) ? Reco : **via `names.en`** (déterministe, déjà disponible, gère cas spéciaux comme `"Mr. Mime"` → `"mr-mime"`).
3. **Préserver l'ancien Showdown ID** : ajouter `showdownId?: string` field sur chaque move/pokemon entry, pour faciliter import/export Showdown. Reco : **oui** (1 ligne par entrée, évite recalcul). Sinon `toShowdownId(kebabId) = kebab.replace(/-/g, '')` reste suffisant.
4. **Reference JSON nouvelle structure** :
   ```json
   { "id": "phantom-force", "showdownId": "phantomforce", "names": {...}, ... }
   ```
5. **Migration tests** : tests qui mockent reference avec `phantomforce` → mettre à jour vers `phantom-force`. Audit grep `"phantomforce"`, `"leechseed"`, etc. dans tests.
6. **Translation runtime conservée** :
   - `toShowdownId(kebabId)` (kebab → Showdown) pour export Team showdown : reste utile
   - `fromShowdownId(showdownId)` (Showdown → kebab) pour import Team showdown : reste utile
   - `buildShowdownToKebabIndex` : **supprimé** (devient identité, donc inutile)
   - `learnset-resolver` translation : **supprimée** (reference déjà kebab)
7. **`loadPokemonFromReference` simplification** : `showdownToKebab` param retiré. `learnset` lu tel quel.
8. **Indexes regen** : `pnpm data:update` régénère indexes après normalisation IDs.

## Étapes

### 1. Script `build-reference.ts` — normalisation IDs

**Fichier** : `packages/data/scripts/build-reference.ts`

Ajouter étape post-fetch :
- Pour chaque move : `entry.id = slugify(entry.names.en)` (ou pré-calculer mapping `oldId → newId`)
- Pour chaque pokemon : translate `learnset.levelUp[].move`, `learnset.tm[]`, `learnset.tutor[]` via mapping
- Pour chaque ability : déjà kebab, no-op (vérifier)
- Pour chaque item : déjà kebab, no-op (vérifier)

Fonction utilitaire :
```ts
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

Maintenir mapping Showdown → kebab pour traduire les learnsets.

### 2. Régénération

```bash
pnpm data:update
# OU si skip fetch désiré (data déjà téléchargée) :
pnpm data:update:skip-fetch
```

Vérifier diff `git diff packages/data/reference/`.

### 3. Indexes

Indexes `reference/indexes/*.json` régénérés automatiquement par `build-reference.ts` (vérifier qu'ils utilisent les nouveaux kebab IDs).

### 4. Suppression `buildShowdownToKebabIndex`

**Fichier** : `packages/data/src/loaders/load-pokemon.ts`

Supprimer la fonction. Supprimer son usage dans `load-data.ts` :
```ts
// Avant
const showdownToKebab = buildShowdownToKebabIndex(...);
loadPokemonFromReference(..., { showdownToKebab, ... });

// Après
loadPokemonFromReference(..., { implementedMoveIds, getOpSetMoveIds });
```

Supprimer le champ `showdownToKebab` de l'interface du loader.

### 5. Simplification `learnset-resolver`

**Fichier** : `packages/data/src/team/learnset-resolver.ts`

Supprimer le paramètre `showdownToKebab` de `initializeLearnsetResolver`. Supprimer `translateMoveId` (devient identité).

### 6. Simplification `team-builder-registry`

**Fichier** : `packages/data/src/team/team-builder-registry.ts`

Supprimer construction map dans `buildTeamBuilderRegistry`. Appel direct `initializeLearnsetResolver(pokemonRef)`.

### 7. Audit `toShowdownId` / `fromShowdownId`

**Fichier** : `packages/core/src/team/showdown-id.ts` (ou équivalent)

Conserver — utilisé pour import/export user-facing Showdown. Vérifier que `toShowdownId(kebab) === kebab.replace(/-/g, "")` reste correct. Note : si on stocke `showdownId` field, simplifier : `toShowdownId = (id) => moveRef.find(m => m.id === id)?.showdownId ?? id.replace(/-/g, "")`.

### 8. Tests

- Tests `learnset-resolver` : assertions sur IDs deviennent kebab (`phantom-force`)
- Tests `team-validator` : idem
- Tests `loadData` : assertions sur movepool / learnset IDs deviennent kebab
- Tests Showdown io (TeamSet) : pas de changement (frontière user-facing reste Showdown raw)
- Régen golden replay si IA pioche moves dont l'ID change apparemment (improbable — overrides déjà kebab donc pas d'impact mais à vérifier)

### 9. Audit grep

Rechercher patterns Showdown-style restants :
```bash
grep -rn "phantomforce\|leechseed\|closecombat\|drainpunch\|focusblast" packages/ docs/ | grep -v "showdownId\|.cache/\|reference/"
```

### 10. Mise à jour docs

- `docs/decisions.md` : ajout décision plan 089
- `docs/process-data-update.md` : noter que reference est désormais kebab
- `docs/implementations.md` : pas d'impact compteurs

### 11. Gate CI

```bash
pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration
```

## Risques connus

1. **Cas spéciaux Showdown** : certains IDs Showdown ne mappent pas 1:1 vers slugify(names.en). Exemples potentiels : `"farfetchd"` vs `"farfetch'd"`, `"hydroplant"` vs `"hydro-plant"`. Vérifier exhaustivement via script de validation.
2. **Sets OP / op-sets.json** : Si curé avec Showdown raw IDs, à migrer vers kebab. Vérifier `packages/data/op-sets/op-sets.json` — sets utilisent kebab actuellement ?
3. **Golden replay** : Movepool dérivé inchangé (translation déjà appliquée avant) → IA pioche mêmes moves. Hypothèse à vérifier.
4. **Indexes** : Si indexes étaient consommés brutalement avec Showdown IDs, fix par cascade ; vérifier `reference/indexes/*.json` consumers.
5. **Pokemon IDs déjà kebab** (`nidoran-m`, `farfetch-d`, `mr-mime`) — pas concernés par normalisation, mais slugify de `names.en` doit produire le bon résultat (cas particulier `Nidoran♂` → `nidoran-m`). Probable need mapping override.

## Compteurs prévus post-livraison

- Sites de translation Showdown↔kebab : 3+ → **1-2** (uniquement import/export Team user-facing)
- Lignes code translation : ~50 → ~10
- Bugs futurs ID mismatch : éliminés

## Validation

Critère succès : `grep -r "phantomforce\|leechseed" packages/data/reference/` renvoie zéro résultat. `getLegalMoves(gengar)` retourne directement `phantom-force` sans translation runtime.
