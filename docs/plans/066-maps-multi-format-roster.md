---
status: in-progress
created: 2026-04-20
updated: 2026-04-21 (v4 pivot — 1 layer de spawns par format, remplissage manuel Tiled)
---

# Plan 066 — Roster de maps multi-format + générateur IA

> Dernier morceau de Phase 3 avant Phase 4. L'UI de sélection des maps est sortie dans le **plan 067** (séparé).

## Objectif

Construire un roster de cartes jouables, toutes **multi-format** (supportant les 5 configurations `teamCount ∈ {2, 3, 4, 6, 12}`), exploitant tout ce que la Phase 3 a posé (dénivelés, terrain types, LoS, décorations, occlusion fade).

Trois livrables imbriqués :

1. **Cleanup** de `assets/maps/` — séparer les maps de dev/test de celles destinées au roster joueur.
2. **Extension de `validateTiledMap`** — la présence des 5 formats devient une **erreur** si absente, plus un warning.
3. **Migration + génération** — 2 maps vivantes (`simple-arena`, `highlands`) repassent en multi-format ; `river-crossing` est **supprimée** et **regénérée** en arène naval au batch IA. L'agent `level-designer` produit un batch de 7 arènes thématiques (6 nouvelles + river-crossing refaite).

## Contexte

- Plans 043-065 livrés. Renderer iso stable, Tiled parseur stable, validation de base en place.
- L'humain veut des **formats principaux 1v1 et 1v1v1** (teamCount=2 et 3 avec 1 pokemon chacun), mais **toutes les maps doivent supporter tous les formats** jusqu'à 12 teams (décision humain 2026-04-20).
- Loader `parse-spawns-layer.ts` dérive déjà `maxPokemonPerTeam = min(positions zone, floor(12/teamCount))`.
- **Pivot 2026-04-21 soir (v4)** : après 2 itérations d'agent (v2, v3) qui généraient des spawns mal placés / chevauchants, l'humain **préfère remplir les zones à la main dans Tiled**. Le format de fichier passe à **1 objectgroup par format** (`spawns_1v1`, `spawns_3p`, `spawns_4p`, `spawns_6p`, `spawns_12p`). Le teamCount est déduit du nom du layer, chaque objet ne porte plus que `teamIndex`. 12 Object Classes colorées (`spawn_team_0`..`spawn_team_11`) inlinées dans `pokemon-tactics.tiled-project` pour visualiser facilement les équipes dans Tiled. Voir section 3.2.
- Maps actuelles : seule `teamCount=2` est déclarée dans tous les `.tmj` vivants. Les `sandbox-*.tmj` et `debug-*.tmj` sont des outils de dev (testing visuel + validation de mécaniques), pas du contenu joueur.
- `river-crossing` actuelle (simple pont + eau) sera **supprimée** étape 1 et remplacée en étape 4 par `naval-arena` (deep_water + pontons wood — parti pris platform fighting). La refonte est totale : nouvelle topologie, nouveaux terrains dominants, nouveau gameplay. Gain de lisibilité vs tentative de migration.
- Agent `level-designer` mis à jour 2026-04-20 avec les règles dures (slopes south/east only, 5 formats obligatoires, taille ≥ 10×10, tileset externe partagé).

## Décisions arrêtées

- **Numéro de plan : 066**. UI de sélection = **plan 067 séparé**.
- **Répertoire `dev/`** dans `assets/maps/` pour ranger les outils de test. Les maps racine = roster joueur.
- **Renommage** `test-arena.tmj` → `simple-arena.tmj` (+ propriété interne `id: "simple-arena"`).
- **Maps vivantes migrées** : `simple-arena`, `highlands`. `river-crossing` est **supprimée** avant le batch IA et reconstruite en arène naval/pontons (parti pris totalement différent — refonte ≠ migration).
- **Multi-format obligatoire** = erreur dure dans `validateTiledMap` (pas warning). Chaque map doit déclarer les 5 `teamCount ∈ {2, 3, 4, 6, 12}`.
- **Générateur IA = agent `level-designer`** (Sonnet, règles déjà encodées dans `.claude/agents/level-designer.md`). Pas de LLM tierce à intégrer.
- **Format de sortie imposé** : Tiled `.tmj` (round-trip éditeur obligatoire, décision humain 2026-04-20).

## ⚠️ Ordre d'exécution (≠ numérotation du plan)

Les sections 1-4 ci-dessous sont présentées dans l'**ordre logique / dépendance**, mais l'exécution doit suivre un ordre différent pour ne pas casser la CI :

1. ✅ **Étape 1 livrée** (2026-04-20, cleanup `dev/`, renommage `simple-arena`, suppression `river-crossing.tmj`)
2. 🔁 **Étape 3 en pivot v4** (v2 & v3 rejetées par humain : agent produisait des zones chevauchantes / mal centrées et consommait trop de tokens. **Nouveau plan** : format de fichier passe à 5 objectgroups séparés — voir 3.2 — et l'humain remplit manuellement dans Tiled. Maps actuelles = **gabarits vides**.)
3. ✅ **Étape 2 livrée** (2026-04-21, `REQUIRED_TEAM_COUNTS` + option `requireAllFormats` dans `validateTiledMap`, décision #274)
4. ⏳ **Étape 4** (batch IA 7 maps thématiques, dont `naval-arena` qui remplace `river-crossing`)

Voir section 2.3 pour la justification.

## Scope — in / out

**In** :
- Déplacement fichiers `sandbox-*`, `debug-*`, `decorations-demo`, `tile-palette` → `maps/dev/`.
- Renommage `test-arena` → `simple-arena`.
- **Suppression de `river-crossing.tmj`** (refonte totale = regénération IA, pas migration).
- Mise à jour de **toutes** les références code + doc (BattleScene hardcoded, SandboxPanel, scripts, tests, STATUS, architecture, backlog).
- Extension `validateTiledMap` pour vérifier la présence des 5 formats.
- Migration des 2 maps vivantes (`simple-arena`, `highlands`) en multi-format.
- Batch IA : **7 arènes thématiques** (forest, cramped-cave, ice-cliffs, volcano, swamp, desert, naval-arena).

**Out** :
- **UI de sélection** des maps (plan 067 séparé).
- **Éditeur in-game** (reste en Phase 3.6 post-Babylon).
- **Modification runtime du terrain par les attaques** (déplacée Phase 9).
- Mécaniques nouvelles de gameplay.
- Refonte du tileset (on se sert de l'existant).

## Étape 1 — Cleanup `assets/maps/`

### 1.1 Arborescence cible

```
packages/renderer/public/assets/maps/
├── simple-arena.tmj       (ex-test-arena, migrée multi-format étape 3)
├── highlands.tmj          (migrée multi-format étape 3)
│                          (river-crossing.tmj SUPPRIMÉE — regénérée étape 4 en naval-arena)
└── dev/
    ├── decorations-demo.tmj
    ├── tile-palette.tmj
    ├── sandbox-flat.tmj
    ├── sandbox-slopes.tmj
    ├── sandbox-melee-block.tmj
    ├── sandbox-fall-1.tmj
    ├── sandbox-fall-2.tmj
    ├── sandbox-fall-3.tmj
    ├── sandbox-fall-4.tmj
    ├── sandbox-los.tmj
    ├── debug-4x4.tmj
    ├── debug-6x6.tmj
    ├── debug-6x6-slop.tmj
    ├── debug-10x10.tmj
    ├── debug-floating.tmj
    ├── debug-full-tile.tmj
    ├── debug-half-tile.tmj
    ├── debug-stack-2full.tmj
    ├── debug-stack-2half.tmj
    ├── debug-stack-3full.tmj
    ├── debug-stack-4full.tmj
    └── debug-stack-full-half.tmj
```

### 1.2 Références à mettre à jour

Fichiers à supprimer :
- `packages/renderer/public/assets/maps/river-crossing.tmj` — **suppression physique** (regénérée étape 4 en `naval-arena.tmj`). **Vérifié 2026-04-20 : aucune référence runtime dans `packages/`**. Seules occurrences : doc (`STATUS.md`, `docs/next.md`, `.claude/agents/level-designer.md`) — à mettre à jour pour remplacer par `naval-arena` (référence future).

Code :
- `packages/renderer/src/scenes/BattleScene.ts:173` — fallback sandbox : `"assets/maps/sandbox-flat.tmj"` → `"assets/maps/dev/sandbox-flat.tmj"`
- `packages/renderer/src/scenes/BattleScene.ts:273` — chemin principal : `loadTiledMap("assets/maps/test-arena.tmj")` → `"assets/maps/simple-arena.tmj"`
- `packages/renderer/src/ui/SandboxPanel.ts:84-92` — préfixer `assets/maps/dev/` pour chaque sandbox map **et pour `decorations-demo.tmj`**
- `packages/renderer/src/types/SandboxConfig.ts:30,52` — doc et default `mapUrl` → `"assets/maps/dev/sandbox-flat.tmj"`
- `packages/renderer/scripts/map-preview.js:17` — exemple CLI mis à jour (`packages/renderer/public/assets/maps/simple-arena.tmj`)
- `packages/renderer/scripts/map-preview.js:40` — **bug à corriger** : le script fait `filePath.split("/").pop()` pour dériver l'URL servie, donc `dev/debug-4x4.tmj` passera à l'URL `assets/maps/debug-4x4.tmj` (404). Fix concret :
  ```js
  const relativePath = filePath.includes("/public/")
    ? filePath.split("/public/")[1]
    : (() => {
        const afterMaps = filePath.split("/assets/maps/")[1] ?? filePath.split("/").pop();
        return `assets/maps/${afterMaps}`;
      })();
  ```
  **Test à faire en fin d'étape 1** : lancer `pnpm dev:map packages/renderer/public/assets/maps/dev/sandbox-flat.tmj` — doit charger sans 404.
- `packages/data/src/tiled/load-tiled-map.test.ts:9` — path de test (`test-arena.tmj` → `simple-arena.tmj`)
- Propriété `"id"` à l'intérieur du `.tmj` de `simple-arena` : `"value": "simple-arena"` (actuellement `"test-arena"`)

Doc :
- `STATUS.md` ligne 639 — mention `test-arena.tmj`
- `docs/backlog.md` ligne 42 — mention `test-arena.tmj`
- `docs/architecture.md` ligne 107 — diagramme arbo maps
- `docs/roadmap.md` ligne 116 — mention historique plan 045 (on peut laisser `test-arena.tmj` en tant que souvenir historique ou updater, à voir)

Plans historiques (045, 046, 047, 055, 064) : **ne pas toucher** (archive, référence historique).

### 1.3 Critères

- Tous les `git mv` effectués, tous les imports / hardcoded paths mis à jour.
- `pnpm build` + `pnpm typecheck` passent.
- `pnpm test` passe (tests de sandbox + load-tiled-map).
- `pnpm dev:sandbox` charge toujours correctement les maps dev.
- Lancer un combat via `pnpm dev` → `simple-arena.tmj` charge sans erreur.

## Étape 2 — Extension `validateTiledMap`

### 2.1 Règle

Ajouter dans `packages/data/src/tiled/validate-tiled-map.ts` une vérification dure :

```ts
const REQUIRED_TEAM_COUNTS = [2, 3, 4, 6, 12] as const;

// Après la boucle existante sur map.formats :
const declaredTeamCounts = new Set(map.formats.map((f) => f.teamCount));
for (const required of REQUIRED_TEAM_COUNTS) {
  if (!declaredTeamCounts.has(required)) {
    errors.push(`Map does not declare required format teamCount=${required}. Required set: ${REQUIRED_TEAM_COUNTS.join(", ")}`);
  }
}
for (const declared of declaredTeamCounts) {
  if (!REQUIRED_TEAM_COUNTS.includes(declared as (typeof REQUIRED_TEAM_COUNTS)[number])) {
    warnings.push(
      `Map declares unsupported format teamCount=${declared} (UI only proposes ${REQUIRED_TEAM_COUNTS.join(", ")})`,
    );
  }
}
```

**Décision permissif vs strict** : les formats **hors `{2,3,4,6,12}`** sont tolérés (warning, pas erreur). L'UI `TeamSelectScene` ne propose que les 5 valeurs canoniques, donc les formats extras ne seraient jamais sélectionnables — mais on ne verrouille pas le format côté validation pour laisser la porte ouverte à des modes futurs (5v5, 8v8 custom, challenge) sans casser les maps existantes.

### 2.2 Critères

- Test unit : une map avec les 5 formats passe. Une map avec 4 formats erreur.
- Tous les tests existants de `validate-tiled-map.test.ts` passent.
- Commenter dans la doc `packages/data/src/tiled/validate-tiled-map.ts` la décision et son rationale.
- Synchroniser `docs/plans/045-*.md` ? Non, c'est un plan archivé. On crée la trace dans `decisions.md`.

### 2.3 Impact attendu

À ce stade, les 3 maps vivantes (non migrées) échouent la validation. Les `dev/*.tmj` ne sont pas validés au runtime du jeu, donc pas d'impact sur eux.

**Ordre d'exécution — contrainte CI** : pour ne **pas** casser la gate CI entre étape 2 et étape 3, on adopte un ordre strict :

1. Étape 1 (cleanup) → commit dédié, CI verte.
2. Étape 3 (migration des 3 maps vivantes) → commit dédié, CI verte (la règle multi-format n'est pas encore activée, donc les 3 maps valides en multi-format passent le parser actuel).
3. Étape 2 (activation du durcissement) → commit dédié, CI verte (les 3 maps sont déjà conformes).
4. Étape 4 (batch IA) → commits incrémentaux, CI verte à chaque nouvelle map.

**Donc l'ordre de rédaction ≠ l'ordre d'exécution.** La numérotation dans le plan reflète la dépendance logique (on ne peut activer la règle qu'après avoir rendu les maps conformes), mais on exécute "migration" avant "activation".

## Étape 3 — Préparation `simple-arena`, `highlands` (v4 — remplissage manuel Tiled)

### 3.1 Décision de pivot (2026-04-21 soir)

Après deux tentatives d'agent `level-designer` (v2 puis v3), l'humain a constaté :
- des zones de spawn qui se chevauchent entre formats (mêmes tiles utilisées par `tc=2` et `tc=12`),
- un non-respect de la symétrie et des règles "hors peak",
- une consommation de tokens disproportionnée à la qualité produite.

**Décision** : l'humain remplira les spawns lui-même dans Tiled. Claude fournit :
- un **format de fichier** qui minimise l'erreur manuelle,
- des **aides visuelles** (Object Classes colorées par `teamIndex`),
- un **parser** qui tolère aussi bien le nouveau format que le legacy.

### 3.2 Format de fichier — 1 objectgroup par format

Le layer unique `spawns` est remplacé par **5 objectgroups nommés** :

| Layer               | teamCount | Objets attendus (cible indicative) |
|---------------------|-----------|-------------------------------------|
| `spawns_1v1`        | 2         | 2 zones, ≥ 6 points/zone            |
| `spawns_3p`         | 3         | 3 zones, ≥ 4 points/zone            |
| `spawns_4p`         | 4         | 4 zones, ≥ 3 points/zone            |
| `spawns_6p`         | 6         | 6 zones, ≥ 2 points/zone            |
| `spawns_12p`        | 12        | 12 zones, ≥ 1 point/zone            |

Chaque objet dans un de ces layers peut être :
- un **Point** Tiled (1 tile couverte),
- un **Rectangle** (toutes les tiles du rectangle sont enrôlées dans la zone),
- un **Polygon** (toutes les tiles dont le centre tombe dans le polygone sont enrôlées).

Seule la propriété `teamIndex: int` (0-basée) est requise. Le `teamCount` est **déduit du nom du layer** (plus besoin de `formatTeamCount` sur chaque objet). Le parser déduplique les tiles partagées entre deux objets de la même équipe.

**Rect/Polygon recommandés** : pour une zone de 15 tiles, dessiner 1 rectangle ou 1 polygone est beaucoup plus rapide et propre que de poser 15 Points. Le mode Point reste supporté pour les tiles isolées (spawn FFA 12-teams par exemple).

**Aides Tiled (classes inlinées dans `pokemon-tactics.tiled-project`)** : 12 Object Classes `spawn_team_0`..`spawn_team_11`, chacune avec une couleur distincte et `teamIndex` pré-rempli, définies sous la clé `propertyTypes` du `.tiled-project`. L'humain dessine une forme, choisit la classe, la couleur s'applique automatiquement, `teamIndex` est configuré.

**Chargement dans Tiled** : `File > Open File or Project` sur `pokemon-tactics.tiled-project`. Panneau `View > Views and Toolbars > Project` pour voir les classes. **Ne PAS** ouvrir `propertytypes.json` en direct — Tiled 1.10+ n'honore plus l'attribut `propertyTypesFile` (vérifié via source `project.cpp` 1.12.1, seule la clé `propertyTypes` inline du `.tiled-project` est lue).

### 3.3 Parser — compat nouveau + legacy

`parse-spawns-layer.ts` exporte :
- `SPAWN_LAYER_TO_TEAM_COUNT = { spawns_1v1: 2, spawns_3p: 3, spawns_4p: 4, spawns_6p: 6, spawns_12p: 12 }` et `SPAWN_LAYER_NAMES`, `isSpawnLayerName(name)`.
- `parseSpawnsLayers(layers, ...)` : itère sur les layers nommés, déduit `teamCount` du nom, ne lit que `teamIndex`. Supporte Point / Rectangle / Polygon (rasterisation des tiles couvertes, dédup par équipe).
- `parseLegacySpawnsLayer(layer, ...)` : conservé pour les 22 maps `dev/` qui utilisent encore `spawns` avec `teamIndex + formatTeamCount`. Même rasterisation shape → tiles. Émet un warning "legacy".

`parseTiledMap` détecte d'abord les 5 nouveaux layers ; à défaut, tombe sur `spawns` legacy avec warning ; à défaut, erreur "Missing spawn layers".

### 3.4 État des maps (2026-04-21)

- `simple-arena` (12×20) : **remplie manuellement par l'humain dans Tiled**. 5 formats valides (tc=2 → 2×18 tiles, tc=3 → 3 zones 10-12 tiles, tc=4 → 4×8, tc=6 → 6×4, tc=12 → 12×2). Parse OK, validation verte.
- `highlands` (12×12, v0 restaurée — plateau central h2, rampes, sommet) : **gabarit vide** — 5 objectgroups présents mais sans objets. Remplissage manuel à faire par l'humain.

**Contraintes de placement que l'humain respectera lui-même** (documentées ici comme référence, pas vérifiées par code) :
- **Pas de spawn sur `h ≥ 3`** (`highlands` : la montagne reste objectif tactique).
- Zones **centrées/symétriques** par rapport au centre de la map ; `highlands` = symétrie E/O (nord occupé par la montagne).
- Zones **contigues** (bloc de tiles 4-connexe) idéalement.
- Pas de chevauchement entre zones d'un même layer (chaque tile n'a qu'un `teamIndex`).

### 3.5 Critères

- Les 2 maps **parsent** sans erreur (5 layers présents, tile dimensions correctes). CI passe même avec les layers vides (`parseSpawnsLayers` retourne un tableau vide → `validateTiledMap` échoue si `requireAllFormats=true`, donc les maps racine sont **exemptées** tant que le remplissage manuel n'est pas fait).
- Une fois remplies par l'humain : `validateTiledMap` avec `requireAllFormats=true` passe sur les 2 maps.
- Tests unitaires `parse-spawns-layer.test.ts` et `parse-tiled-map.test.ts` couvrent nouveau format + fallback legacy + erreurs (`teamIndex` manquant, `formatTeamCount` manquant en legacy).

## Étape 4 — Premier batch de génération IA

### 4.1 Arènes thématiques à générer

**Décision humain 2026-04-20** : les maps du roster sont des **arènes thématiques** (ambiance + parti pris tactique imbriqués, pas de map "neutre thématiquement"). Les maps iso Pokemon Stadium / Colosseum / Pokken sont la référence d'inspiration.

Partis pris **déjà couverts** par les 2 migrées (étape 3) :
- `simple-arena` — neutre (réf)
- `highlands` — high-ground control

Batch cible (**7 maps**, l'humain a validé les 7 — le plan peut être scindé en 2 sous-batches si le débit IA ne suit pas) :

| # | Nom court | Parti pris tactique | Palette terrain | Référence |
|---|-----------|---------------------|-----------------|-----------|
| 1 | **forest** | Tall grass dense + arbres en obstacles — ambush / LoS coupée | `tall_grass`, `normal`, arbres (décor haut 3) | Zone de Safari, Route 20 |
| 2 | **cramped-cave** | Combat serré en corridors anneau autour d'un bloc central d'obstacles | `normal`, `obstacle` (rochers), light | Cave interior, Mt. Moon |
| 3 | **ice-cliffs** | **Falaises mortelles (fall damage)** + `ice` (glissant, quand implémenté) — zone haute dangereuse mais stratégique | `ice`, `snow`, dénivelés 2-3 niveaux | Sommet Sommet-Couronné |
| 4 | **volcano** | Lava hazard — patchs `lava` impassable + `magma` marchable, knockback tactique | `lava`, `magma`, `normal`, dénivelés | Victory Road / Mt. Chimney |
| 5 | **swamp** | Terrain `swamp` qui ralentit + patchs `tall_grass` en îlots — zones mouvantes difficiles à tenir | `swamp`, `tall_grass`, `water` | Marais de Ronflex / Galar bog |
| 6 | **desert** | Grande map plate sable + dunes (dénivelés doux) + quelques oasis `water` — duels à distance ouverts | `sand`, `normal`, `water`, dénivelés 1 | Désert de Hoenn / Chemin 111 |
| 7 | **naval-arena** | **Platform fighting** — `deep_water` partout, pontons `wood` connectés. Knockback hors ponton = KO létal (`LethalTerrainKo`). Water-types immunisés, Flying survole. **Remplace `river-crossing`** (supprimée étape 1) | `deep_water`, `wood` (tile_id 42-46), dénivelés 0-1 | Pokemon Stadium naval stage |

**Tous les terrains listés existent déjà dans `TerrainType`** (vérifié `packages/core/src/enums/terrain-type.ts`). Aucun ajout core requis.

**Points à arbitrer avant lancement** :
- **Ice slipping** pas implémenté (mécanique Phase 9 ?). Pour `ice-cliffs`, la glace sert d'abord d'habillage + les falaises font le gameplay. À documenter : "ice = visuel pour l'instant".
- **Knockback vers lava / deep_water** : `LethalTerrainKo` est déjà implémenté (confirmé `handle-knockback.ice-slide.test.ts:262`). Reste à vérifier que le roster actuel contient assez de moves knockback pour que `volcano` et `naval-arena` soient jouables autrement que "on évite le hasard".
- **Swamp ralentissement** — le terrain `swamp` applique-t-il un malus de move cost ? Vérifier `packages/core/src/terrain/terrain-modifiers.ts` avant génération.
- **Ordre de génération** : commencer par `forest` (le plus simple, terrains déjà familiers) pour calibrer le workflow agent. Puis `cramped-cave` (test topologie anneau). Puis `naval-arena` (test pontons). Puis les 4 autres en parallèle possible.

### 4.2 Workflow de génération

1. Humain donne le brief : taille, format dominant visé, parti pris, ambiance.
2. Invocation agent `level-designer` — produit `.tmj` + résumé validation.
3. Review humain : ouvrir dans Tiled desktop, vérifier layout, corriger si besoin.
4. Validation automatique `validateTiledMap`.
5. Test visuel `pnpm dev` + smoke test combat 1v1 et 1v1v1.
6. Commit.

### 4.3 Critères

- Cible **7 maps** thématiques livrées (voir tableau 4.1). Scindable en 2 sous-batches (3+4 ou 4+3) si nécessaire.
- Toutes passent `validateTiledMap` sans erreur.
- Chaque map a un parti pris tactique identifiable en une phrase (colonne tableau 4.1).
- Chaque map a une **identité visuelle** (palette de terrain cohérente, décor thématique).
- Chaque map a été testée en combat 1v1 et 1v1v1.
- **Pour `naval-arena`** : smoke test dédié d'un knockback hors ponton = KO vérifié.

## Plan de tests

### Tests unitaires

- `validate-tiled-map.test.ts` : cas "map avec 5 formats → OK", "map avec 4 formats → erreur", "map avec 0 formats → erreur".
- Tests existants continuent de passer (les 3 maps migrées doivent passer aussi).

### Tests d'intégration

- Smoke test : charger chaque map du roster racine, lancer un combat 1v1, vérifier que le combat se termine sans crash.
- Smoke test : charger chaque map, lancer un combat 1v1v1, vérifier fin sans crash.

### Tests visuels

- Screenshots de chaque map du roster (format 1v1, 1v1v1, 12-teams) — snapshot avant / après migration pour celles existantes.

### Gate CI

`pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration` — **bloquant avant commit**.

## Risques identifiés

- **Taille des `.tmj`** : 60 objets spawn × 5 maps = 300 objets. Les fichiers grossissent (chacun passe de ~1.3k lignes à ~2k). Acceptable.
- **Topologie 12-teams sur petite map** : si la map ne peut pas accueillir 12 zones disjointes, on arbitre — soit agrandir, soit fusionner certains formats. Ma reco : **agrandir** plutôt que sacrifier la règle multi-format. À trancher avec l'humain si un cas se présente.
- **Prompts IA instables** : le premier jet du `level-designer` peut ne pas passer la validation. Prévoir 2-3 itérations par map. L'agent expose les erreurs de `validateTiledMap` et corrige.
- **Migration `river-crossing`** : si la rivière occupe la ligne centrale, les spawns 3-team et 4-team doivent être répartis sans se marcher dessus. Si besoin, revoir la topologie de l'eau.
- **Antagonisme parti pris ↔ multi-format** : certains partis pris (cramped cave 8×8, duel 1v1 serré) ne sont plus possibles tels quels — ils deviennent « cramped à l'intérieur d'une 14×14 » (mur d'obstacles au centre, périphérie ouverte pour loger les spawns). Accepter que quelques concepts soient dilués, ou les écarter du roster multi-format.
- **Rush inévitable en FFA 12 teams** : sur une map 10×10, 12 zones disjointes = ≈ 8 tiles par zone, impossible d'éviter un rush T1-T2. Accepté : le FFA est chaotique par nature, on ne cherche pas à équilibrer la distance inter-spawns autant qu'en 1v1.
- **Map-preview script** : le script `map-preview.js` déduit l'URL servie avec `filePath.split("/").pop()` — il faut l'adapter pour préserver le préfixe `dev/` (voir étape 1.2). Si oublié, toutes les maps `dev/*.tmj` renvoient 404 en mode preview. **Test obligatoire avant commit de l'étape 1** : `pnpm dev:map packages/renderer/public/assets/maps/dev/sandbox-flat.tmj` doit charger sans 404.

## Non-objectifs explicites

- Pas de nouvel outil de génération LLM externe (on s'appuie sur l'agent `level-designer` Claude Code).
- Pas de migration des `dev/*.tmj` en multi-format (ce sont des outils de test, ils gardent leur mono-format).
- Pas d'UI de sélection des maps (plan 067).
- Pas de refonte de `parseTiledMap` ni du loader.
- Pas de nouveau terrain ni de nouveau type de slope.

## Dépendances / Pré-requis

- Agent `level-designer` à jour (fait 2026-04-20).
- Plan 045 (loader Tiled) livré.
- Plan 065 (occlusion fade) livré.

## Références

- `docs/next.md` — ordre de livraison cadré 2026-04-20.
- `docs/roadmap.md` Phase 3 — items remontés.
- `.claude/agents/level-designer.md` — règles dures encodées.
- `docs/tileset-mapping.md` — tile IDs du tileset partagé.
- `docs/isometric-height-rendering.md` — convention layers + slopes.
- `packages/data/src/tiled/validate-tiled-map.ts` — module à étendre étape 2.
- `packages/data/src/tiled/parse-spawns-layer.ts` — dérivation `maxPokemonPerTeam`.
- `packages/data/src/tiled/load-tiled-map.ts` — loader principal (test path à migrer étape 1).
- Maps références existantes : `test-arena`, `highlands`, `river-crossing`.

## Questions ouvertes (à escalader)

- **Orientation initiale des spawns en FFA multi-centre (teamCount ≥ 4)** : en 1v1 et 1v1v1, les spawns pointent par convention vers le centre de la map (barycentre des zones adverses). En 4/6/12 teams, le barycentre est **proche du centre géométrique pour toutes les équipes** → toutes pointent vers la même zone, ce qui crée un convergent T1 artificiel et visuellement peu lisible. Trois options : (a) pointer chaque zone vers son **voisin le plus proche** (favorise les duels locaux), (b) orientation aléatoire déterministe (seed map-id), (c) laisser l'agent `level-designer` décider par map. Décision à prendre **avant la génération batch IA** (étape 4) — trace dans `docs/decisions.md` et appliquée par l'agent. Reco Claude : (a), cohérent avec les 1v1/1v1v1 en multipliant les barycentres locaux.

## Succès

- 2 maps vivantes migrées + 7 arènes thématiques IA livrées = **9 maps** dans le roster racine (scindable en 2 jalons : 2 migrées + batch-A, puis batch-B).
- Toutes passent `validateTiledMap` avec la règle multi-format activée.
- `dev/` isolé, roster racine propre.
- Agent `level-designer` validé comme outil de production (produit des maps qui passent la validation du premier ou second coup).
- Gate CI vert sur commit final.
