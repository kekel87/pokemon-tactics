# Plan 081 — Team data model + validator + storage + Showdown io — Phase 4

> Statut : done
> Phase : 4
> Créé : 2026-05-12
> Validé : 2026-05-12 (plan-reviewer + game-designer + humain)
> Terminé : 2026-05-12 — CI verte (1379 unit + 189 intégration + lint + typecheck + build)

## Objectif

Poser les fondations du Team Builder : structure de données `TeamSet`, validateur réutilisable (jouable + multijoueur futur), persistance localStorage, et import/export au format Showdown.

**Ce plan ne touche pas au renderer/UI.** Que du core + data + storage adapter. Les écrans (`TeamEditScene`, `TeamSelectScene` refonte) viennent plans 085-086.

**Premier plan d'un méta-chantier 6 plans (081-086)** — voir `docs/next.md`.

---

## Décisions

| # | Décision | Justification |
|---|---|---|
| 1 | `TeamSet` core, validateur core | Réutilisable multijoueur (côté serveur futur) |
| 2 | IV fixé 31 (plan 074), jamais exporté Showdown | Aligné Champions, simplifie UX |
| 3 | SP↔EV : 1 SP = 8 EV (cap 252) | Ratio 510/66 ≈ 7.7, arrondi pratique. Total max 528 → clamp 510 |
| 4 | Niveau fixé 50 | Champions style |
| 5 | Learnset = `levelUp ∪ tm ∪ tutor` walkée chaîne `evolvesFrom` | Pattern Showdown (évolués héritent pré-évos) |
| 6 | ID normalizer bidirectionnel | Showdown compresse (`fireblast`), nous gardons kebab (`fire-blast`) |
| 7 | Storage `localStorage` (renderer uniquement) | Core reste pur. Adapter dans `packages/renderer/src/team/` |
| 8 | Flag `isImplementedInGame` dérivé (pas stocké) | Calculé depuis registres runtime (tactical, ability, item, roster) |
| 9 | `validateTeam` retourne `{ valid, errors[] }` jamais throw | Permet UI d'afficher erreurs slot par slot |

---

## Structure de données

### `TeamSet`

```ts
interface TeamSet {
  id: string;          // uuid local
  name: string;        // nommé par joueur
  format?: TeamFormat; // optionnel — équipe générique 6 mons
  slots: TeamSlot[];   // 1-6 (Team Builder force 6)
  createdAt: number;   // timestamp
  updatedAt: number;
}

interface TeamSlot {
  pokemonId: string;       // ex: "charizard"
  ability: string;          // ex: "blaze"
  heldItemId?: HeldItemId;  // optionnel
  nature: Nature;
  moveIds: string[];        // 1-4 moves
  statSpread: StatSpread;   // SP par stat (plan 074)
  gender?: PokemonGender;   // override (sinon roll au combat)
}

type TeamFormat = "1v1" | "2v2" | "3v3" | "4v4" | "6v6";
```

`TeamSet` ≠ `TeamSelection` existant. `TeamSelection` = ce qui rentre en combat (mons placés). `TeamSet` = équipe stockée builder.

### `TeamValidationResult`

```ts
interface TeamValidationResult {
  valid: boolean;
  errors: TeamValidationError[];
}

interface TeamValidationError {
  kind: TeamValidationErrorKind;
  slotIndex?: number;     // undefined = erreur globale (ex: doublon)
  message: string;        // i18n key path (ex: "team.error.duplicateMon")
  context?: Record<string, string>;
}

enum TeamValidationErrorKind {
  DuplicatePokemon = "DuplicatePokemon",      // basé sur espèce racine (evolvesFrom* root)
  DuplicateItem = "DuplicateItem",
  DuplicateMove = "DuplicateMove",
  IllegalAbility = "IllegalAbility",
  IllegalMove = "IllegalMove",
  IllegalNature = "IllegalNature",
  InvalidStatSpread = "InvalidStatSpread",    // context.reason: "totalExceeded" | "statExceeded"
  UnknownPokemon = "UnknownPokemon",
  UnknownMove = "UnknownMove",
  UnknownAbility = "UnknownAbility",
  UnknownItem = "UnknownItem",
  EmptyMoveList = "EmptyMoveList",
  TooManyMoves = "TooManyMoves",
  EmptyTeam = "EmptyTeam",
  TooManyMons = "TooManyMons",
  IllegalGender = "IllegalGender",
}

// Sous-cas StatSpread via context :
// { reason: "totalExceeded", total: "70", max: "66" }
// { reason: "statExceeded", stat: "attack", value: "34", max: "32" }
```

---

## Architecture fichiers

### `packages/core/src/team/` (nouveau)
- `team-set.ts` — types `TeamSet`, `TeamSlot`, `TeamFormat`
- `team-validation.ts` — `enum TeamValidationErrorKind`, `interface TeamValidationError`, `interface TeamValidationResult` (fusion : convention 1 fichier = 1 concept domaine)
- `team-validator.ts` — `validateTeam(team, options)` + helpers (`getSpeciesRoot`, `collectExistingItemIds`)
- `sp-ev-conversion.ts` — `spToEv(spread)` / `evToSp(ev)`
- `showdown-id.ts` — `toShowdownId(kebab)` / `fromShowdownId(compressed, registry)`
- `showdown-export.ts` — `exportTeamToShowdown(team, registry): string`
- `showdown-import.ts` — `importShowdownTeam(text, registry): { team, errors }`
- `index.ts` — réexports

### `packages/data/src/team/` (nouveau)
- `learnset-resolver.ts` — `getLegalMoves(pokemonId): Set<string>` walk `evolvesFrom`
- `implementation-flags.ts` — `isPokemonImplemented`, `isMoveImplemented`, `isAbilityImplemented`, `isItemImplemented`
- `team-validator-registry.ts` — adapter regroupe les registres pour passer à `validateTeam` (Pokemon, moves, abilities, items + learnset resolver)
- `index.ts`

### `packages/renderer/src/team/` (nouveau)
- `team-storage.ts` — adapter localStorage : `loadTeams()`, `saveTeam(team)`, `deleteTeam(id)`, `listTeamSummaries()`
- `team-storage-schema.ts` — version + migration future

### Tests
- `packages/core/src/team/__tests__/team-validator.test.ts`
- `packages/core/src/team/__tests__/sp-ev-conversion.test.ts`
- `packages/core/src/team/__tests__/showdown-id.test.ts` — **incluant cas nidoran-f / nidoran-m / mr-mime / farfetch-d (IDs avec tirets)**
- `packages/core/src/team/__tests__/showdown-export.test.ts`
- `packages/core/src/team/__tests__/showdown-import.test.ts`
- `packages/data/src/team/__tests__/learnset-resolver.test.ts` — **incluant cas chaîne hors Gen 1 (Pikachu/Raichu walk vers Pichu Gen 2)**
- `packages/data/src/team/__tests__/implementation-flags.test.ts`
- `packages/integration/src/team/team-builder.integration.test.ts` — round-trip import → validate → export → reimport
- `packages/renderer/src/team/__tests__/team-storage.test.ts` — localStorage mocké

### Fixture round-trip (étape 10)
- Fichier : `packages/core/src/team/__tests__/__fixtures__/showdown-team-roster.txt`
- Contenu : équipe 6 mons strictement issus du roster actuel (`packages/data/src/roster/roster-poc.ts`) avec moves légaux vérifiés : **Charizard + Snorlax + Alakazam + Gengar + Dragonite + Starmie**
- Mons exclus du test si leurs movesets actuels n'ont pas passé pré-validation (voir section "Préparation pré-exécution")
- Assertion : parse → validate (0 erreur) → export → reparse → identité approximative (tolérance SP/EV ±1 par stat dû à arrondi)

---

## Détails par module

### Module 1 — Types core (`team-set.ts`)
- Types purs, pas de logique
- `TeamSlot.moveIds` accepte 1-4 (validateur vérifie)
- `TeamSlot.statSpread` réutilise `StatSpread` existant (plan 074)
- Tests : aucun (que types)

### Module 2 — SP↔EV conversion (`sp-ev-conversion.ts`)

```ts
const SP_TO_EV_RATIO = 8;
const EV_PER_STAT_MAX = 252;
const EV_TOTAL_MAX = 510;

function spToEv(spread: StatSpread): EvSpread {
  // sp×8 par stat, clamp 252, total clamp 510 (priorité stat ordre HP/Atk/Def/SpA/SpD/Spe)
}

function evToSp(ev: EvSpread): StatSpread {
  // floor(ev/8), clamp 32 par stat, total clamp 66
}
```

Tests :
- Round-trip identité approximative (SP → EV → SP doit reretourner ~ spread original, pertes acceptables sur arrondi)
- Clamp 252 par stat
- Clamp 510 total avec priorité d'ordre
- Cas limites (0, max, mix)

### Module 3 — ID normalizer (`showdown-id.ts`)

```ts
function toShowdownId(kebab: string): string {
  return kebab.replace(/-/g, "").toLowerCase();
}

function fromShowdownId(
  compressed: string,
  knownKebabIds: Iterable<string>
): string | undefined {
  // build cache compressed→kebab première fois, puis lookup O(1)
  // retourne undefined si pas trouvé
}
```

Tests :
- `toShowdownId("fire-blast")` === `"fireblast"`
- `toShowdownId("Mr-Mime")` === `"mrmime"` (gère majuscules)
- `fromShowdownId("fireblast", moveIds)` retrouve `"fire-blast"`
- Collisions improbables Gen 1 mais test pour robustesse

### Module 4 — Learnset resolver (`learnset-resolver.ts`)

```ts
function getLegalMoves(pokemonId: string): Set<string> {
  const result = new Set<string>();
  const visited = new Set<string>();
  let current: string | null = pokemonId;
  while (current && !visited.has(current)) {
    visited.add(current);
    const ref = pokemonReference.find(p => p.id === current);
    if (!ref) break;
    for (const m of [...ref.learnset.levelUp, ...ref.learnset.tm, ...ref.learnset.tutor]) {
      result.add(m); // moves en format compressed Showdown
    }
    current = ref.evolvesFrom ?? null;
  }
  return result; // retour en format compressed — converti par validateur
}
```

Notes :
- Learnsets en format compressed Showdown (`fireblast`, sans tiret). Validateur compare en convertissant le move via `toShowdownId(moveId)`.
- Cache mémoïsé par Pokemon (build une fois au premier appel).
- **Walk traverse chaîne d'évolution complète, même hors Gen 1.** Ex : Raichu → Pikachu → Pichu (Gen 2). Le walk continue tant que `evolvesFrom` est défini dans `pokemon.json`, indépendamment du roster jouable. C'est le comportement canon Showdown (héritage des bébés Pokemon). Si on voulait tronquer à Gen 1 strict, il faudrait ajouter `if (ref.generation > 1) break` — **décision : NE PAS tronquer** (cohérence Showdown, pas d'impact négatif détecté).
- `Set<visited>` évite boucles infinies si `evolvesFrom` cyclique (impossible en data réelle mais robuste).

Tests :
- Charizard hérite de Charmeleon → Charmander
- Venusaur hérite chain complète Bulbasaur+Ivysaur+Venusaur
- Mewtwo (pas d'evolvesFrom) = sa propre liste
- Raichu → Pikachu → Pichu (chain Gen 2) — moves Pichu inclus
- Cache fonctionne (2e appel idem)
- Cycle artificiel mocké → pas de boucle infinie

### Module 5 — Implementation flags (`implementation-flags.ts`)

```ts
function isPokemonImplemented(id: string, roster: RosterEntry[]): boolean;
function isMoveImplemented(id: string, tacticalRegistry: Record<string, unknown>): boolean;
function isAbilityImplemented(id: string, abilityHandlers: Record<string, unknown>): boolean;
function isItemImplemented(id: HeldItemId, itemHandlers: Record<HeldItemId, unknown>): boolean;
```

Pas de logique exotique. Pour utiliser dans builder UI (grisé) et validator (warning soft).

Tests : simple existence registry.

### Module 6 — Team validator (`team-validator.ts`)

```ts
interface TeamValidatorRegistry {
  pokemonIds: ReadonlySet<string>;
  moveIds: ReadonlySet<string>;
  abilityIds: ReadonlySet<string>;
  itemIds: ReadonlySet<HeldItemId>;
  getLegalAbilities(pokemonId: string): readonly string[];  // depuis Pokemon.abilities
  getLegalMoves(pokemonId: string): ReadonlySet<string>;     // depuis learnset-resolver
}

interface ValidateTeamOptions {
  registry: TeamValidatorRegistry;
  format?: TeamFormat;
  allowUnimplemented?: boolean;  // false par défaut — refuse Pokemon/move/etc absent
  maxSlots?: number;             // default 6
}

function validateTeam(team: TeamSet, options: ValidateTeamOptions): TeamValidationResult;
function validateSlot(slot: TeamSlot, slotIndex: number, options: ValidateTeamOptions): TeamValidationError[];
```

Règles vérifiées :
- Team niveau :
  - Taille 1..6 (selon format)
  - Pas de doublon Pokemon — **comparaison sur espèce racine** via `getSpeciesRoot(id, registry)`. Walk `evolvesFrom` jusqu'à racine avec `Set<visited>` (garde-fou cycles).
  - Pas de doublon item (`DuplicateItem` levé uniquement si 2 slots ont le **même** `heldItemId` défini ; slots sans item OK même si plusieurs).
- Slot niveau :
  - `pokemonId` ∈ registry
  - `ability` ∈ `getLegalAbilities(pokemonId)` (ability1/ability2/hidden)
    - **Cas Pokemon sans abilityId attribué dans roster (ex: Exeggutor — plan 077 décision #301)** : `getLegalAbilities` retourne la liste depuis `pokemon.json` (ability1/ability2/hidden). Si la donnée reference manque l'ability1, slot avec ability quelconque → `IllegalAbility`. Pas de fallback "accepte tout".
  - `heldItemId` ∈ registry (si défini)
  - `moveIds` longueur 1-4, pas de doublon, chaque move ∈ `getLegalMoves(pokemonId)`
  - `nature` valide enum (`Object.values(Nature).includes(nature)`)
  - `statSpread` **obligatoire** (chaque slot doit avoir un spread défini, même si tous zéro). Utilise `validateStatSpread` existant plan 074. Default proposé builder = `{ hp:0, atk:0, def:0, spa:0, spd:0, spe:0 }` ; validateur ne bloque pas le tout-zéro (légal Showdown aussi).
  - `gender` (si défini) cohérent avec `genderRatio` du Pokemon :
    - Pokemon `genderless` (ratio `{male:0, female:0}`) — `gender` doit être `Genderless` ou `undefined`
    - Pokemon `male-only` (ex: Tauros) — `gender` doit être `Male` ou `undefined`
    - Pokemon `female-only` (ex: Chansey, Kangaskhan canon) — `gender` doit être `Female` ou `undefined`
    - Sinon `IllegalGender` (à ajouter dans enum `TeamValidationErrorKind`)

Tests :
- Team vide → `EmptyTeam`
- 7 mons → `TooManyMons`
- 2× Charizard → `DuplicatePokemon`
- 2× Leftovers → `DuplicateItem`
- Charizard avec ability `intimidate` → `IllegalAbility`
- Charmander avec move `hydro-pump` → `IllegalMove`
- Move dupliqué dans même slot → `DuplicateMove`
- 5 moves → `TooManyMoves`
- 0 move → `EmptyMoveList`
- Pokemon inconnu → `UnknownPokemon`
- Option `allowUnimplemented: true` ne bloque pas sur unknown (mais warning collecté en erreur soft)

### Module 7 — Showdown export (`showdown-export.ts`)

```ts
function exportTeamToShowdown(
  team: TeamSet,
  registry: ShowdownExportRegistry
): string;

interface ShowdownExportRegistry {
  getPokemonName(id: string): string;           // affichage anglais
  getAbilityName(id: string): string;
  getItemName(id: HeldItemId): string;
  getMoveName(id: string): string;
  getNatureName(nature: Nature): string;         // "Adamant", "Modest"...
}
```

Format produit :
```
Charizard @ Heavy-Duty Boots
Ability: Solar Power
Level: 50
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Fire Blast
- Air Slash
- Focus Blast
- Roost

Pikachu @ Light Ball
...
```

Règles :
- IVs jamais exportés (toujours 31)
- Level 50 toujours exporté (cohérence Champions)
- Tera Type jamais exporté
- Genre exporté si défini : `Charizard (M) @ ...` ou `(F)`
- EVs uniquement stats non-zéro (skip "0 HP / 0 Atk / 0 Def / 252 SpA / ..." → "252 SpA / 4 SpD / 252 Spe")
- Séparateur entre mons = ligne vide

Tests :
- Round-trip simple (1 mon complet)
- Multi-mons avec ligne vide
- EVs filtrés zéro
- Genre M/F/genderless (omis si genderless)
- Nature postfixée
- Item omis si `undefined` (ligne `@ Item` absente)

### Module 8 — Showdown import (`showdown-import.ts`)

```ts
function importShowdownTeam(
  text: string,
  registry: ShowdownImportRegistry
): { team: TeamSet | null; errors: ShowdownImportError[] };

interface ShowdownImportRegistry {
  pokemonByShowdownId: Map<string, string>;     // "charizard" → "charizard"
  abilityByShowdownId: Map<string, string>;     // "solarpower" → "solar-power"
  itemByShowdownId: Map<string, HeldItemId>;
  moveByShowdownId: Map<string, string>;
  natureByName: Map<string, Nature>;             // "Timid" → Nature.Timid
}
```

Parser tolérant :
- **Scanne par préfixe de ligne, pas par position** (`startsWith("Ability:")`, `startsWith("EVs:")`, etc.). Spec officielle Showdown ne garantit pas l'ordre strict. IVs peut précéder ou suivre EVs selon outil source.
- Accepte espaces variables
- Ignore lignes inconnues (warning collecté)
- **Champs consommés silencieusement (sans warning)** : `IVs:`, `Tera Type:`, `Happiness:`, `Shiny:`, `Pokeball:`, `Dynamax Level:`, `Gigantamax:`
- Genre `(M)`, `(F)`, ou absent
- **Nicknames optionnels** dans la ligne species, 4 variantes acceptées (selon Showdown TEAMS.md) :
  - `Charizard @ Item`
  - `Flame (Charizard) @ Item`  (nickname distinct)
  - `Charizard (M) @ Item`       (genre)
  - `Flame (Charizard) (M) @ Item` (nickname + genre)
  - Nickname jeté (non stocké dans `TeamSlot`)
- Convertit EVs → SP via `evToSp`
- **Si EVs total importés > 510 ou stat > 252 avant clamp** → erreur soft `InvalidStatSpread` avec `context.reason` (totalExceeded | statExceeded), valeurs clampées quand même
- Si nature manque → reroll random (warning : "Nature manquante, aléatoire générée")
- Si move/ability/item inconnu → erreur slot

Tests :
- Round-trip export → import (identité approximative — pertes SP/EV acceptables)
- Format minimal (juste species + moves)
- Format avec nickname
- IVs présents → ignorés sans erreur
- Tera Type présent → ignoré
- Ability mal orthographiée → erreur
- Champ inconnu → warning soft
- Multi-team avec lignes vides multiples
- Comments (lignes commençant par `# ` ou `//`) ignorés

### Module 9 — Team storage (`team-storage.ts`) — renderer uniquement

```ts
interface TeamStorage {
  listTeamSummaries(): TeamSummary[];
  loadTeam(id: string): TeamSet | null;
  saveTeam(team: TeamSet): void;
  deleteTeam(id: string): void;
  clearAll(): void;
}

interface TeamSummary {
  id: string;
  name: string;
  pokemonCount: number;
  updatedAt: number;
}

interface TeamStorageSchema {
  version: 1;
  teams: Record<string, TeamSet>;
}
```

Détails :
- Clé localStorage : `pokemon-tactics:teams`
- Wrapper schema versionné pour migrations futures
- `listTeamSummaries` parse sans charger slots détaillés (rapide)
- Pas de cap mémoire
- Si JSON corrompu → reset à empty + log warning

Tests (mock `localStorage` via `vitest`) :
- Save → load identité
- Save 2 teams → list 2 summaries
- Delete supprime, save resauvegarde
- JSON corrompu → reset gracieux
- Version mismatch → migration stub (pour l'instant : reset si > current)

---

## Préparation pré-exécution

**Avant de lancer le plan 081**, fixer les incohérences roster-poc.ts détectées lors de la review game-designer :

1. **Charizard movepool — `wing-attack` illégal** : move absent de `pokemon.json` learnset Charizard et chaîne Charmeleon/Charmander. Retirer du movepool `roster-poc.ts` ou remplacer par `air-slash` (déjà dans pool). Décision : **retirer `wing-attack`**, le pool reste à 6 moves (4 utilisés + 2 réservoir).
2. **Audit complet movepools 81 Pokemon** : script `pnpm team:audit-learnsets` à ajouter — pour chaque entrée roster, vérifier que chaque move du movepool ∈ `getLegalMoves(pokemonId)`. Liste les violations. À itérer sur les corrections (retirer move illégal ou ajouter au learnset reference).
3. **Cas Exeggutor (sans ability)** : roster-poc entrée `exeggutor` a champ `abilityId` absent. Soit assigner `chlorophyll` (handler stub Phase 9 — déjà en data abilities), soit garder `undefined` et le validateur skipera l'ability check pour Exeggutor en mode "roster legacy" — **décision : assigner `chlorophyll` avec stub handler** (cohérence).
4. **Pokemon Dummy** : exclure du registry passé au validateur (filtré dans `data:loaders` avant exposition au builder).

Ces fixes sont **bloquants pour les tests d'intégration round-trip** (étape 10).

---

## Étapes d'exécution

0. **Préparation roster-poc** : fixes pré-requis (Charizard wing-attack, audit movepools, Exeggutor ability, Dummy filtré) — voir section "Préparation pré-exécution"
1. **Types core** (`team-set.ts`, `team-validation.ts` fusion error+result+enum) — pas de tests
2. **SP↔EV conversion** + tests
3. **ID normalizer** + tests (cas nidoran-f / mr-mime / farfetch-d explicites)
4. **Learnset resolver** (data) + tests (chain Pichu hors Gen 1)
5. **Implementation flags** + tests
6. **Team validator** (core) + tests unit
7. **Showdown export** + tests
8. **Showdown import** + tests
9. **Team storage** (renderer) + tests
10. **Test intégration round-trip** : fixture `__fixtures__/showdown-team-roster.txt` (Charizard + Snorlax + Alakazam + Gengar + Dragonite + Starmie) → parser → valider → exporter → reparser → identité approximative
11. **Validation gate CI** : `pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration`

---

## Critères d'acceptation

- [ ] Préparation pré-exécution faite (roster-poc fixes : wing-attack, exeggutor, dummy)
- [ ] `pnpm team:audit-learnsets` zéro violation sur roster actuel
- [ ] `validateTeam` détecte les 16 erreurs listées dans `TeamValidationErrorKind` (incluant `IllegalGender`)
- [ ] `exportTeamToShowdown` produit du texte conforme (test sur fixture réaliste)
- [ ] `importShowdownTeam` reparse l'export → équipe identique (modulo arrondi SP/EV ±1/stat)
- [ ] `TeamStorage` round-trip save/load identique
- [ ] Learnset Charizard inclut moves de Charmeleon + Charmander
- [ ] Learnset Raichu inclut moves de Pikachu + Pichu (chain hors Gen 1 documentée)
- [ ] CI verte (unit + integration + lint + typecheck)
- [ ] Tests >= 95% coverage sur `team-validator.ts`, `showdown-import.ts`, `showdown-export.ts`
- [ ] Aucune dep UI dans `packages/core/src/team/` (core-guardian validé)

---

## Hors scope (plans ultérieurs)

- OP sets data + curation (082)
- Random team gen (084)
- Builder UI / TeamEditScene (085)
- TeamSelectScene refonte (086)
- Synchro cloud / multijoueur server-side
- Migration localStorage versions futures (stub seulement)
- Différenciation formats spéciaux (Doubles, VGC, etc.)

---

## Risques

- **Learnset compressed vs kebab** : risque d'oubli de conversion à un endroit. Mitigation : helper centralisé `toShowdownId` + tests round-trip.
- **EV/SP arrondi imparfait** : import Smogon set avec EVs 252/0/0/252/4/0 = SP 31/0/0/31/0/0 = 62 SP, pas 66. Petite perte. Acceptable car curation OP sets faite à la main (plan 082) directement en SP.
- **`evolvesFrom` cycles** : impossible en data réelle mais ajouter garde-fou (Set `visited`) pour éviter boucle infinie. Helper `getSpeciesRoot` utilise même garde.
- **localStorage quota** : 81 mons × 6 × ~500 bytes = ~250KB par équipe max. Quota typique 5-10MB → OK.

---

## Reviews intégrées (2026-05-12)

### plan-reviewer (OK avec ajustements)
- ✓ Fusion `team-validation-error.ts` + `team-validation-result.ts` → `team-validation.ts`
- ✓ `statSpread` obligatoire (default tout-zéro accepté)
- ✓ EV total > 510 import : **erreur soft** (collectée dans `errors[]`, valeurs clampées, team utilisable mais flag erreur)
- ✓ `getSpeciesRoot` documenté en Module 6 helpers internes
- ✓ Fixture round-trip explicite : 6 mons roster réel

### game-designer (Ajustements critiques)
- ✓ **Préparation pré-exécution** ajoutée : fix Charizard wing-attack, audit complet movepools, Exeggutor ability, Dummy filtré
- ✓ Walk `evolvesFrom` traverse chaîne complète **incluant Gen 2+** (Pichu pour Raichu/Pikachu) — documenté Module 4
- ✓ Tests ID normalizer : cas explicites `nidoran-f`, `nidoran-m`, `mr-mime`, `farfetch-d`
- ✓ Validation genre cohérent avec `genderRatio` (nouveau cas `IllegalGender`)
- ✓ Behavior Exeggutor sans abilityId : assigner `chlorophyll` (stub Phase 9) plutôt que cas particulier validateur

### Notes audit Showdown (best-practices, 2026-05-12)

Validateur Showdown (`sim/team-validator.ts`) audité. Confirmations + ajustements intégrés ci-dessus :
- Format texte spec officielle : `sim/TEAMS.md` Showdown
- Notre `TeamValidationError` plus riche que Showdown (kind enum + slotIndex + i18n key) — gardé
- Showdown applique `Species Clause` sur espèce racine → on copie via `getSpeciesRoot` (impact futur formes Mega)
- Pattern parser ligne-par-ligne par préfixe (pas positionnel) confirmé
- Champs ignorés silencieusement étendus (Happiness, Shiny, Pokeball, etc.)
- EV total > 510 import → warning soft `InvalidStatSpread` (au lieu de clamp silencieux)
- Hors scope : banlists, breeding moves, event moves, sketchable (non pertinents Champions mode)

---

## Notes pour `data-miner` / `test-writer`

Plan rédigé par Claude, à reviewer par `plan-reviewer` puis `game-designer` (légalité movesets) avant exécution.

Tests prioritaires : `team-validator.test.ts` (14 cas erreur) et `showdown-import.test.ts` (fixtures réelles Smogon).

Fixture Showdown à utiliser (à placer dans `__tests__/__fixtures__/showdown-team.txt`) : équipe 6 mons roster actuel, ex. Charizard + Snorlax + Alakazam + Gengar + Dragonite + Starmie.
