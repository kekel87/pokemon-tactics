# Plan 072 — Natures / Stat Alignment

> Statut : done
> Phase : 4 (suite des plans 069 + 070 + 071)
> Créé : 2026-04-29
> Terminé : 2026-04-29

## Contexte

Pokemon Champions renomme **Nature** en **Stat Alignment** — mécanique conservée à l'identique côté formule (boost +10 % sur une stat, malus -10 % sur une autre, HP exclu, 25 combinaisons dont 5 neutres). Bulbapedia / Showdown emploient toujours « nature » dans l'UI ; on garde **Nature** côté code (terme plus court, conventions Showdown) et on affichera « Stat Alignment » comme libellé i18n EN si besoin (Champions UI parity).

Aujourd'hui :
- `PokemonInstance` n'a pas de champ `nature`.
- `computeCombatStats(baseStats, level)` calcule les stats de combat sans modifieur de nature.
- Aucune donnée de nature dans `packages/data/reference/`.
- `createPokemonInstance` accepte déjà `genderRng` et `genderOverride` (plan 071) — étendre proprement à `nature`.

C'est le prérequis le plus léger de la roadmap Phase 4 : pas de nouveau hook combat, pas de nouvelle catégorie d'item, juste un multiplicateur dans la chaîne de calcul des stats. Idéal avant Objets tenus / EV→SP.

## Objectif

1. **Core** : `Nature` enum (25), `PokemonInstance.nature` non-optionnel, `applyNatureModifier(combatStats, nature)` appliqué dans `computeCombatStats`.
2. **Core** : helper `rollNature(rng)` déterministe (replay-safe).
3. **Core/Renderer** : `createPokemonInstance` accepte `nature` (override Team Builder futur), sinon roll.
4. **Renderer** : afficher la nature dans `InfoPanel` avec indication visuelle des stats boostée/réduite.
5. **i18n FR/EN** : 25 noms de natures.

Hors scope : items qui modifient natures (Mints — pas dans roster), choix manuel via Team Builder (futur), Hyper Training (Phase 5+).

## Décisions à acter avec l'humain

- **Roll aléatoire** (option A retenue, 2026-04-29) : nature rollée uniformément à la création. Variance ±10 % Atk/Def/SpA/SpD/Speed entre deux instances du même Pokemon assumée comme bruit canon Pokemon. À noter dans `decisions.md` (#284-289).
- **Nom code** : `Nature` (Showdown) ou `StatAlignment` (Champions) ? → Reco : `Nature` (concision, alignement Bulbapedia/Showdown). Libellé i18n peut être « Stat Alignment » côté EN si on veut suivre Champions strict.
- **Données natures** : pas de `natures.json` dans `reference/`. Reco : table en dur dans `packages/core/src/enums/nature.ts` + `packages/core/src/battle/nature-modifier.ts` (25 entrées, immutables, jamais update). Pas de fetch Showdown — simple comme un type chart.
- **Roll** : roll uniforme sur 25 natures via `Math.floor(rng() * 25)`. Pas de pondération (canon Pokemon).
- **HP** : aucune nature ne touche HP (canon Gen 3+).
- **Overrides Team Builder** : ajouter `natureOverrides?: Record<string, Nature>` à `BattleSetupConfig` (parallèle à `genderOverrides`).
- **Display InfoPanel** :
  - Reco : sous le nameText / genderText, ligne `"{natureName}"` (e.g. `"Adamant"`), avec couleur boosted (vert) / lowered (rouge) discrète pour les 2 stats concernées dans la liste de stats.
  - Stats neutres (Hardy/Docile/etc.) : juste le nom, pas de coloration.
- **Détermination via seed replay** : passer `natureRng` en plus de `genderRng` dans `BattleSetupConfig`, ou un seul `creationRng` partagé ? → Reco : un seul `creationRng` (renommer `genderRng` → `creationRng` ; rolls ordonnés gender → nature pour stabilité). **Breaking change mineur** sur `BattleSetupConfig` mais zéro caller hors renderer.

## Étapes d'implémentation

### Étape 1 — Enum + table modificateurs (packages/core)

- `packages/core/src/enums/nature.ts` :
  ```ts
  export const Nature = {
    Hardy: "hardy",
    Lonely: "lonely",
    Brave: "brave",
    Adamant: "adamant",
    Naughty: "naughty",
    Bold: "bold",
    Docile: "docile",
    Relaxed: "relaxed",
    Impish: "impish",
    Lax: "lax",
    Timid: "timid",
    Hasty: "hasty",
    Serious: "serious",
    Jolly: "jolly",
    Naive: "naive",
    Modest: "modest",
    Mild: "mild",
    Quiet: "quiet",
    Bashful: "bashful",
    Rash: "rash",
    Calm: "calm",
    Gentle: "gentle",
    Sassy: "sassy",
    Careful: "careful",
    Quirky: "quirky",
  } as const;
  export type Nature = typeof Nature[keyof typeof Nature];
  ```
- `packages/core/src/battle/nature-modifier.ts` :
  ```ts
  type NatureEffect = { boost: StatName | null; lowered: StatName | null };
  export const NATURE_BOOST_MULTIPLIER = 1.1;
  export const NATURE_LOWER_MULTIPLIER = 0.9;
  export function getNatureEffect(nature: Nature): NatureEffect { ... }
  export function applyNatureModifier(stats: BaseStats, nature: Nature): BaseStats { ... }
  ```
- 1 fichier = 1 type → `nature-effect.ts` séparé pour le type `NatureEffect`.
- HP jamais affecté (vérifier dans tests).
- `applyNatureModifier` est une fonction pure qui prend les stats déjà calculées au niveau (sortie de `computeCombatStats` Gen 3+) et applique `floor(stat × 1.1)` ou `floor(stat × 0.9)` sur la stat boostée / lowered. **Pas sur la baseStat brute** — formule canon = stat at level × natureMod.

Table complète (Bulbapedia, Gen 3+) :

| Nature    | Boost   | Lowered |
|-----------|---------|---------|
| Hardy     | —       | —       |
| Lonely    | Atk     | Def     |
| Brave     | Atk     | Speed   |
| Adamant   | Atk     | SpAtk   |
| Naughty   | Atk     | SpDef   |
| Bold      | Def     | Atk     |
| Docile    | —       | —       |
| Relaxed   | Def     | Speed   |
| Impish    | Def     | SpAtk   |
| Lax       | Def     | SpDef   |
| Timid     | Speed   | Atk     |
| Hasty     | Speed   | Def     |
| Serious   | —       | —       |
| Jolly     | Speed   | SpAtk   |
| Naive     | Speed   | SpDef   |
| Modest    | SpAtk   | Atk     |
| Mild      | SpAtk   | Def     |
| Quiet     | SpAtk   | Speed   |
| Bashful   | —       | —       |
| Rash      | SpAtk   | SpDef   |
| Calm      | SpDef   | Atk     |
| Gentle    | SpDef   | Def     |
| Sassy     | SpDef   | Speed   |
| Careful   | SpDef   | SpAtk   |
| Quirky    | —       | —       |

Neutres (5) : Hardy / Docile / Serious / Bashful / Quirky → `boost === null && lowered === null`.

### Étape 2 — Roll + intégration stats

- `packages/core/src/battle/roll-nature.ts` :
  ```ts
  const ALL_NATURES: readonly Nature[] = Object.values(Nature);
  export function rollNature(rng: () => number): Nature {
    return ALL_NATURES[Math.floor(rng() * ALL_NATURES.length)] ?? Nature.Hardy;
  }
  ```
- `packages/core/src/battle/stat-calculator.ts` : `computeCombatStats(baseStats, level, nature?)` — signature étendue, paramètre optionnel pour rétrocompat tests. Si `nature` fourni → applique multiplicateur après floor de chaque stat (canon : `floor(baseStat × natureMod)`).
- `packages/core/src/types/pokemon-instance.ts` : `nature: Nature;` (non-optionnel).
- `packages/core/src/testing/mock-pokemon.ts` : default `nature: Nature.Hardy` (neutre — zéro impact tests existants).

### Étape 3 — Création d'instance (renderer)

- `packages/renderer/src/game/BattleSetup.ts` :
  - Renommer `genderRng` → `creationRng` dans `BattleSetupConfig`. Mettre à jour tous les callers (grep `genderRng` → 1 site renderer + tests).
  - Ajouter `natureOverrides?: Record<string, Nature>`.
  - Dans `createPokemonInstance` : `const nature = natureOverride ?? rollNature(rng);` puis passer à `computeCombatStats(definition.baseStats, BATTLE_LEVEL, nature)`.
  - Ordre des rolls dans la fonction : gender → nature (stable pour replay).
- `SandboxSetup.ts` : idem si présent.
- ⚠ Ordre de création des instances ne doit pas changer entre runs.

### Étape 4 — InfoPanel renderer — REPORTÉ

> **Reporté 2026-04-30** — affichage différé jusqu'à la refonte complète de l'InfoPanel. Mécanique core livrée, nature stockée sur l'instance et appliquée aux stats, mais aucun rendu UI. Aucune nouvelle constante visuelle, aucune i18n nature. À reprendre quand l'InfoPanel sera revu globalement (layout, stats list, etc.).

### Étape 5 — i18n — REPORTÉ

> **Reporté 2026-04-30** — voir Étape 4.

### Étape 6 — Tests + CI

- Unitaires `nature-modifier.test.ts` :
  - 25 natures couvertes : 5 neutres → stats inchangées. 20 non-neutres → boost = base × 1.1 floored, lowered = base × 0.9 floored.
  - HP jamais affecté (assertion explicite sur Hardy/Adamant/Bold/Modest/Timid/Calm).
- Unitaires `roll-nature.test.ts` :
  - `rng = () => 0` → première nature.
  - `rng = () => 0.999` → dernière nature.
  - Distribution sur 1000 rolls avec seed fixe = stable.
- Intégration : sandbox 4 Pokemon avec natures override → vérifier que combatStats reflète le modificateur.
- Aucun test existant ne doit casser : default `Nature.Hardy` neutre dans MockPokemon.
- Lint zéro warning, typecheck strict, `pnpm test:integration` vert.

## Validation visuelle

- Lancer combat avec natures variées : InfoPanel affiche le nom, les stats colorées.
- Hover Pokemon avec Adamant → Attack vert / SpAttack rouge.
- Hover Pokemon Hardy → texte gris italique, aucune coloration stat.
- Battle log (optionnel) : aucune entrée — natures sont stat-time, pas runtime.

## Risques

- **Ordre des rolls determinism** : si on swap gender ↔ nature dans `createPokemonInstance`, les replays existants divergent. Verrouiller : gender en premier (compat plan 071), nature ensuite.
- **Tests existants** : `MockPokemon.fresh` doit fournir `nature: Nature.Hardy` (neutre) sinon ~1100 tests cassent. Idem `mock-battle.ts`.
- **Calcul HP** : vérifier que `computeStatAtLevel(..., isHp=true)` n'est jamais multiplié par `natureMod`. Risque de régression masqué : tester Hardy vs Adamant → HP identique.
- **Floor avant ou après modificateur** : canon Gen 3+ = `floor(stat × natureMod)` (pas l'inverse). Tester avec valeurs connues (Garchomp niveau 50 Adamant : Atk 130 base → 152 vs 138 sans nature).

## Effort estimé

½ journée. Plan court, similaire au 071.

## Décisions documentées (à acter)

- #284 — `PokemonInstance.nature` rolled à la création via `rollNature(rng)`, déterministe via seed replay.
- #285 — `Nature` enum 25 valeurs, table de modificateurs en dur dans le core (pas de fichier `reference/natures.json`).
- #286 — `computeCombatStats(baseStats, level, nature?)` applique `floor(stat × natureMod)`. HP exclu.
- #287 — `BattleSetupConfig.genderRng` renommé `creationRng` (rolls partagés gender → nature).
- ~~#288 — InfoPanel : nom de nature affiché~~ → reporté à la refonte InfoPanel.
