---
status: done
created: 2026-04-11
updated: 2026-04-11 (implémentation terminée, 13 tests moves LoS, 5 maps sandbox, 840 tests unit verts)
---

# Plan 047 — Ligne de vue 3D et collisions terrain (Phase 3 — Terrain & Tactics)

## Objectif

Rendre les mécaniques d'attaque cohérentes avec le terrain 3D introduit en plan 046 : les moves à
distance respectent la ligne de vue, les dash s'arrêtent sur les murs, les explosions dévient sur
les piliers interceptés. Les 9 patterns core sont tous couverts.

## Contexte

Le plan 046 a livré les dénivelés côté déplacement (`canTraverse`, `isMeleeBlockedByHeight`,
`calculateFallDamage`, BFS asymétrique montée/descente, rendu surélevé). Mais la résolution des
cibles des moves (`packages/core/src/grid/targeting.ts`) ne tient pas compte de la hauteur : les
attaques traversent les piliers, les dash ignorent les murs, les zones explosent à travers les
obstacles. Ce comportement est identifié dans `docs/backlog.md` (section "Mécaniques d'attaque en
terrain 3D").

## Décisions de design

### Règle hauteur unifiée : `heightBlocks`

Une seule fonction `heightBlocks(obstacleHeight, referenceHeight): boolean` dont le résultat est
`obstacleHeight > referenceHeight + 1`. Elle est utilisée partout où un obstacle peut bloquer :

- **Mêlée** : `referenceHeight = hAttaquant` — unifie et remplace `isMeleeBlockedByHeight` (la
  logique est équivalente : diff ≥ 2 en absolu → obstacle bloque si hauteur > attaquant + 1).
- **LoS tireur→cible** : `referenceHeight = max(hTireur, hCible)` — un obstacle ne bloque que s'il
  dépasse le niveau des deux protagonistes.
- **Propagation depuis épicentre (zone/blast phase 2)** : `referenceHeight = hEpicentre`.

`canTraverse` (seuil 0.5 montée) reste distinct et n'est pas touché — physique du saut vs physique
du tir.

### Comportement LoS par pattern

| Pattern | Exemples | LoS ? | Comportement |
|---|---|---|---|
| single mêlée (range 1) | Charge, Ultimapoing | non | règle mêlée via `heightBlocks` — harmonisation avec la nouvelle fonction |
| single distance (range > 1) | Psyko, Éclair | oui | bloque si `heightBlocks(hObstacle, max(hTireur, hCible))` |
| self | Épée Danse, Abri | — | aucun check |
| cone | Flammèche, Hurlement | oui par case | raycast individuel tireur→case du cône |
| cross | — | oui par case | idem cone |
| line | Ultralaser, Hydrocanon | oui séquentiel | s'arrête au premier obstacle qui bloque ; cases suivantes épargnées ; **attaque ratée** si aucune cible avant le blocage, sauf bypass via flag |
| dash | Vive-Attaque, Charge | non | si la trajectoire heurte un mur (`heightDiff > 0.5` côté montée), arrêt sur la case devant le mur + **dégâts de chute équivalents** (réutiliser `calculateFallDamage` avec diff virtuelle = hauteur du mur) ; seule la tile d'arrivée touche la cible d'origine si elle est atteinte |
| zone | Séisme, Ampleur | propagation depuis épicentre | `heightBlocks(hObstacle, hEpicentre)` — un pilier projette une ombre ; ignoré si le move est tellurique (voir flags) |
| slash | Tranche, Draco-Queue | mêlée adjacente | pour chaque case de l'arc frontal, règle mêlée via `heightBlocks` |
| blast | Bomb-Beurk, Ball'Ombre | 2 phases | **Phase 1** : LoS tireur→épicentre (projectile balistique) — si intercepté, l'explosion a lieu sur la tile du pilier intercepté (pas de miss). **Phase 2** : propagation type zone depuis le nouvel épicentre |

### Flags de moves — alignés sur Showdown

On introduit `moveFlags?: MoveFlags` sur `MoveDefinition`. Structure alignée 1:1 sur Showdown
(source : `data/moves.ts` de pokemon-showdown). Tous les flags sont optionnels et booléens.

**Flags à créer dans le type :**

Nature physique (utilisés ou préparés) :
- `contact`, `sound`, `bullet`, `wind`, `powder`, `pulse`, `punch`, `bite`, `slicing`, `dance`

Mécaniques de jeu (stockés mais pas activés dans ce plan) :
- `protect`, `mirror`, `snatch`, `metronome`, `bypasssub`, `reflectable`, `charge`, `recharge`,
  `gravity`, `heal`

**Flags écartés** (non pertinents pour ce projet) : `distance`, `nonsky`, `futuremove`,
`cantusetwice`, tous les `fail*`, `nosleeptalk`, `noassist`, `nosketch`, `noparentalbond`,
`allyanim`, `minimize`.

**Sémantique LoS dans ce plan :**
- `sound: true` → ignore la LoS (traverse les murs)
- `bullet: true` → LoS stricte (défaut des moves balistiques ; flag stocké pour cohérence Showdown
  et talents futurs type Bulletproof)
- Autres flags physiques (`wind`, `powder`, `pulse`, etc.) : LoS normale dans ce plan

**Règle dérivée `ignoresLineOfSight`** dans le résolveur de targeting :

```typescript
ignoresLineOfSight = flags.sound === true || (pattern === 'zone' && move.type === 'ground')
```

La clause `zone + ground` couvre Séisme et Ampleur : une onde tellurique ignore la LoS. C'est
canonique Pokemon — pas besoin d'un flag custom maison.

### Data-mining des flags

Après implémentation du type, peupler `moveFlags` sur les ~80 moves du roster actuel dans
`packages/data/src/base/moves.ts`. Source : Showdown `data/moves.ts`. Inclus dans ce plan.

## Étapes

### Étape 1 — `heightBlocks` unifiée + refacto des call sites (core) (S)

- Ajouter dans `packages/core/src/battle/height-modifier.ts` la fonction pure :
  `heightBlocks(obstacleHeight: number, referenceHeight: number): boolean`
  → retourne `obstacleHeight > referenceHeight + 1`
- Refactoriser `isMeleeBlockedByHeight` pour qu'elle délègue à `heightBlocks` :
  - Mêlée : `heightBlocks(defenderHeight, attackerHeight) || heightBlocks(attackerHeight, defenderHeight)`
    (blocage symétrique pour la mêlée — une falaise bloque dans les deux sens)
  - Garder `isMeleeBlockedByHeight` exportée pour ne pas casser les call sites existants
- Ajouter les tests unitaires de `heightBlocks` dans `packages/core/src/battle/height-modifier.test.ts` :
  - obstacle 0, ref 0 → false (même niveau)
  - obstacle 2, ref 0 → true (bloque : 2 > 0 + 1)
  - obstacle 1, ref 0 → false (juste à la limite : 1 = 0 + 1)
  - obstacle 3, ref 1 → true (3 > 1 + 1)
  - obstacle 1, ref 1 → false (même niveau relatif)
- Vérifier que les tests existants de `isMeleeBlockedByHeight` passent toujours
- Critère : `pnpm test` green, `pnpm typecheck` clean

### Étape 2 — Type `MoveFlags` + extension `MoveDefinition` (core) (S)

- Créer `packages/core/src/types/move-flags.ts` avec l'interface :
  ```typescript
  export interface MoveFlags {
    // Nature physique
    contact?: boolean;
    sound?: boolean;
    bullet?: boolean;
    wind?: boolean;
    powder?: boolean;
    pulse?: boolean;
    punch?: boolean;
    bite?: boolean;
    slicing?: boolean;
    dance?: boolean;
    // Mécaniques (préparés pour Phase 4)
    protect?: boolean;
    mirror?: boolean;
    snatch?: boolean;
    metronome?: boolean;
    bypasssub?: boolean;
    reflectable?: boolean;
    charge?: boolean;
    recharge?: boolean;
    gravity?: boolean;
    heal?: boolean;
  }
  ```
- Ajouter `moveFlags?: MoveFlags` dans `packages/core/src/types/move-definition.ts`
- Exporter `MoveFlags` depuis `packages/core/src/types/index.ts`
- Aucun test nouveau requis ici (structure de données pure, pas de logique)
- Critère : `pnpm typecheck` clean, `MoveFlags` visible à l'extérieur du package

### Étape 3 — `hasLineOfSight` avec raycast 3D (core) (M)

- Créer `packages/core/src/grid/line-of-sight.ts` avec la fonction pure :
  ```typescript
  export function hasLineOfSight(
    grid: Grid,
    from: Position,
    to: Position,
    referenceHeight: number,
  ): boolean
  ```
  - Algorithme : Bresenham 2D (grille iso = grille 2D, pas de vrai raycasting 3D)
  - Pour chaque tile intermédiaire (hors `from` et `to`) sur la ligne :
    - Récupérer `tileHeight = grid.getTile(pos)?.height ?? 0`
    - Si `heightBlocks(tileHeight, referenceHeight)` → retourne `false`
  - Retourne `true` si aucune tile intermédiaire ne bloque
  - Tiles hors bounds : ignorées (le raycast continue)
- Créer `packages/core/src/grid/line-of-sight.test.ts` :
  - Ligne dégagée, même hauteur → true
  - Pilier hauteur 2 entre tireur h0 et cible h0 → false (ref=0, pilier 2 > 0+1)
  - Pilier hauteur 2 entre tireur h1 et cible h1 → false (ref=1, pilier 2 > 1+1 : false... attendre : 2 > 2 = false → true ! La LoS passe)
  - Pilier hauteur 3 entre tireur h1 et cible h1 → false (3 > 1+1 = 3 > 2 = true → bloque)
  - Tireur h2, cible h0, pilier h1 au milieu → ref=max(2,0)=2 → heightBlocks(1, 2)=1>3=false → LoS passe
  - Distance 1 (adjacent) → toujours true (pas de case intermédiaire)
  - Case hors bounds dans la trajectoire → ignorée, LoS continue
- Critère : ~8 tests unitaires passent, `pnpm typecheck` clean

### Étape 4 — Intégration LoS dans les resolvers : patterns single, cone, cross, slash (core) (M)

Modifier `packages/core/src/grid/targeting.ts` pour passer le contexte de hauteur à `resolveTargeting`.

- Modifier la signature de `resolveTargeting` :
  ```typescript
  export function resolveTargeting(
    targetingPattern: TargetingPattern,
    move: { moveFlags?: MoveFlags; type: PokemonType },
    caster: PokemonInstance,
    targetPosition: Position,
    grid: Grid,
    traversalContext?: TraversalContext,
  ): Position[]
  ```
- Calculer `ignoresLineOfSight` au début de `resolveTargeting` :
  `const ignoresLoS = move.moveFlags?.sound === true || (targetingPattern.kind === TargetingKind.Zone && move.type === PokemonType.Ground)`
- **`resolveSingle`** : si `range.min === 1` (mêlée), appliquer `isMeleeBlockedByHeight` ; sinon
  appliquer `hasLineOfSight(grid, from, to, max(hCaster, hTarget))` si `!ignoresLoS`
- **`resolveCone`** : pour chaque case du cône, filtrer par `hasLineOfSight(grid, origin, pos, hCaster)` si `!ignoresLoS`
- **`resolveCross`** : idem cone (raycast tireur→case)
- **`resolveSlash`** : pour chaque case de l'arc, appliquer `isMeleeBlockedByHeight` (arc frontal mêlée)
- Mettre à jour tous les call sites de `resolveTargeting` dans `BattleEngine.ts` (passer le move)
- Mettre à jour `packages/core/src/grid/targeting.integration.test.ts` :
  - Ajouter des cas avec `heightData` dans la grille (`Grid.createWithHeights` ou équivalent)
  - Tester que single distance avec pilier bloquant retourne `[]`
  - Tester que single distance avec `sound: true` passe quand même
  - Tester que cone filtre les cases derrière un pilier
- Critère : tous les tests existants passent, nouveaux tests verts, `pnpm typecheck` clean

### Étape 5 — Intégration LoS : pattern line (core) (S)

- Modifier `resolveLine` dans `targeting.ts` :
  - Pour chaque step, calculer `hCaster` depuis `grid.getTile(origin)?.height ?? 0`
  - Si la case courante a `heightBlocks(hCase, hCaster)` → stopper la ligne (cases suivantes épargnées)
  - Si la case est bloquée avant d'avoir touché la première cible valide → retourner `[]` (attaque ratée)
  - Note : `ignoresLoS` non applicable à `line` dans ce plan (pas de move Sound + Line dans le roster)
- Tests dans `targeting.integration.test.ts` :
  - Ligne dégagée → toutes les cases retournées
  - Pilier hauteur 2 en position 2 sur une ligne h0 → cases 1 retournée, cases 2+ épargnées
  - Pilier en position 1 → `[]` (attaque ratée avant la première cible)
  - Ligne sur plateau h2, pilier h3 → bloque (3 > 2+1)
  - Ligne sur plateau h2, obstacle h3 → bloque ; pilier h2 sur plateau h2 → ne bloque pas
- Critère : ~5 nouveaux tests verts

### Étape 6 — Intégration LoS : pattern zone (core) (S)

- Modifier `resolveZone` dans `targeting.ts` :
  - Ajouter paramètre `epicenterHeight: number` (hauteur de la tile épicentre du caster pour zone globale)
  - Pour chaque tile dans le rayon, filtrer par `heightBlocks(hTile, epicenterHeight)` si `!ignoresLoS`
  - `ignoresLoS` est déjà calculé en amont (zone + ground → true = Séisme passe toujours)
- Tests dans `targeting.integration.test.ts` :
  - Zone sol (type Normal) avec pilier h2 à portée → pilier et cases derrière exclus
  - Zone sol (type Ground / Séisme) avec pilier h2 → toutes les cases incluses
  - Zone depuis épicentre h2 : pilier h3 → bloque (3 > 2+1), pilier h2 → ne bloque pas
- Critère : ~4 nouveaux tests verts

### Étape 7 — Intégration LoS : pattern blast 2 phases (core) (M)

- Modifier `resolveBlast` dans `targeting.ts` :
  - **Phase 1** (projectile) : raycast `from` → `targetPosition`
    - Calculer `hCaster` depuis grid
    - Pour chaque tile intermédiaire sur le trajet : si `heightBlocks(hTile, hCaster)` → explosion
      redirigée sur cette tile (`interceptedEpicenter = position`) ; stopper le raycast
    - Si aucune interception → `interceptedEpicenter = targetPosition`
  - **Phase 2** (propagation) : appeler `getTilesInRadius(interceptedEpicenter, radius, grid)` avec
    filtre `heightBlocks(hTile, hEpicentre)` pour chaque tile du rayon
  - Retourner les tiles de la phase 2
- Ajouter dans `resolveTargeting` le passage du move à `resolveBlast` (pour `ignoresLoS` futur)
- Tests dans `targeting.integration.test.ts` :
  - Blast sans obstacle → explosion à l'épicentre cible, propagation normale
  - Blast avec pilier h2 sur la trajectoire h0 → explosion sur le pilier, propagation depuis le pilier
  - Blast avec pilier h2 derrière l'épicentre → non intercepté (pilier est après la cible)
  - Propagation de l'explosion bloquée par un second pilier derrière le premier
- Critère : ~5 nouveaux tests verts, `pnpm typecheck` clean

### Étape 8 — Intégration : dash contre mur (core) (S)

- Modifier `resolveDash` dans `targeting.ts` :
  - Pour chaque step du dash, récupérer `hNext = grid.getTile(position)?.height ?? 0` et
    `hCurrent = grid.getTile(previousPosition)?.height ?? 0`
  - Si `heightDiff = hNext - hCurrent > 0.5` (montée infranchissable) :
    - Arrêt sur `lastReachable` (case devant le mur)
    - Stocker `wallHeight = hNext - hCurrent` pour les dégâts de chute
    - Retourner `{ positions: [lastReachable], wallImpact: wallHeight }` — adapter le type de retour
  - Si `lastReachable` est null et mur dès le premier step → retourner `[]`
- Modifier l'appelant dans `BattleEngine.ts` (`executeDash` ou équivalent) :
  - Si `wallImpact > 0` : appliquer `calculateFallDamage(wallImpact, caster.maxHp)` à l'attaquant
  - Émettre `FallDamageDealt` pour le caster avec `heightDiff = wallImpact`
- Note : le type de retour de `resolveDash` doit être adapté ou la logique de chute déplacée dans
  le BattleEngine (à trancher à l'implémentation selon ce qui garde le core le plus pur)
- Tests dans `targeting.integration.test.ts` :
  - Dash dégagé → atteint la cible normale
  - Dash avec mur h2 sur trajectoire h0 → arrêt avant le mur
  - Dash Vol + mur h2 → passe quand même (flying = `canTraverse` toujours true)
- Tests dans les scénarios d'intégration (`packages/core/src/battle/scenarios/`) :
  - Scénario : `dash-wall-impact.test.ts`
    ```gherkin
    Given un Pokemon h0 qui fonce vers l'est
    And une tile h2 en position (3,0) sur sa trajectoire
    When le Pokemon utilise un move Dash
    Then le Pokemon s'arrête en (2,0) (case devant le mur)
    And FallDamageDealt est émis avec heightDiff=2
    And les dégâts au caster sont 33% maxHp
    ```
- Critère : scénario vert, `pnpm test` green

### Étape 8b — Tests d'intégration moves : cas LoS par fichier move (core) (M)

Ajouter dans chaque fichier de test move existant (`packages/core/src/battle/moves/`) les cas
bout-en-bout qui vérifient que le move se comporte correctement **après** la refacto LoS des étapes
4 à 8. Le pattern `buildMoveTestEngine` + `MockBattle.setTile` permet de positionner des tiles
haute sur la grille sans infrastructure supplémentaire.

Ces tests couvrent l'intégration verticale complète (le move est soumis à `BattleEngine`, le core
résout la LoS, la cible est atteinte ou non) — ils ne doublonnent pas les tests unitaires de
`hasLineOfSight` ni les tests de `targeting.integration.test.ts` qui couvrent les resolvers isolés.

**Remarque préalable** — les noms français ci-dessous (Psyko, Hydrocanon…) sont des exemples de
patterns. Les moves réels du roster sont vérifiés dans `packages/data/src/overrides/tactical.ts` :
`psychic`, `hydro-pump`, `shadow-ball`, `explosion` n'existent pas dans le roster Gen 1 actuel.
Les moves listés ci-dessous sont les moves réels du roster pour chaque pattern concerné.

---

**Pattern single distance (range > 1) — LoS bloquée par pilier h2 :**

- **`psybeam.test.ts`** — ajouter :
  `"LoS bloquée par pilier h2 : Psyko-Rayon ne touche pas la cible derrière le pilier"` —
  tireur h0 en (0,0), pilier h2 en (2,0) via `MockBattle.setTile`, cible h0 en (3,0) ;
  `submitAction` avec `psybeam` → `result.events` ne contient pas `DamageDealt`

- **`thunderbolt.test.ts`** — ajouter :
  `"LoS seuil +1 : Éclair passe au-dessus d'un bloc h1 depuis h0 vers h0"` —
  tireur h0 en (0,2), bloc h1 en (1,2) via `setTile`, cible h0 en (3,2) ;
  `submitAction` avec `thunderbolt` → `DamageDealt` présent (bloc h1 non bloquant : `heightBlocks(1, 0) = false`)

---

**Pattern line — stoppage par mur h2 :**

- **`hyper-beam.test.ts`** — ajouter :
  `"Line stoppée par un mur h2 : Ultralaser n'atteint pas la cible au-delà du mur"` —
  tireur h0 en (0,0), mur h2 en (3,0) via `setTile`, cible en (4,0) ;
  `submitAction` avec `hyper-beam` → `DamageDealt` absent

- **`thunderbolt.test.ts`** — ajouter (en complément du cas seuil ci-dessus) :
  `"Line stoppée : Éclair ne touche pas les cases après un mur h2"` —
  tireur h0 en (0,0), mur h2 en (2,0), ennemi en (1,0) et ennemi en (3,0) ;
  `submitAction` → un seul `DamageDealt` (ennemi en (1,0)), pas celui en (3,0)

---

**Pattern zone ground — ignore les piliers :**

- **`earthquake.test.ts`** — ajouter :
  `"Séisme (ground) ignore un pilier h2 dans sa zone : la cible derrière le pilier est atteinte"` —
  caster h0 en (2,2), pilier h2 en (3,2) via `setTile`, cible en (4,2) ;
  `submitAction` avec `earthquake` → `DamageDealt` présent (cible atteinte malgré le pilier)

- **`magnitude.test.ts`** — ajouter :
  `"Ampleur (ground) ignore un pilier h2 dans sa zone : toutes les cibles dans le rayon sont touchées"` —
  même géométrie que earthquake ; confirme la règle `ignoresLoS` par le flag `zone + ground`

---

**Pattern zone normal — ombre projetée par pilier :**

Aucun move zone Non-Ground dans le roster actuel n'a de fichier de test existant à modifier pour ce
cas — la couverture est assurée par `targeting.integration.test.ts` (étape 6).

---

**Pattern blast — interception sur pilier :**

- **`sludge-bomb.test.ts`** — ajouter :
  `"Bomb-Beurk interceptée : l'explosion se produit sur le pilier, la cible au-delà n'est pas touchée"` —
  caster en (0,0), pilier h2 en (2,0) via `setTile`, target en (3,0) ;
  `submitAction` avec `sludge-bomb`, targetPosition (3,0) → `DamageDealt` absent pour la cible en (3,0)
  (l'explosion a lieu sur la tile (2,0), pas sur la cible)

---

**Pattern cone + flag sound — traverse les murs :**

- **`growl.test.ts`** — ajouter :
  `"Rugissement (sound) traverse un pilier h2 dans le cône : la cible derrière le pilier reçoit le debuff"` —
  user en (0,0) orienté East, pilier h2 en (1,0) via `setTile`, foe en (2,0) ;
  `submitAction` avec `growl` → `StatChanged` présent pour `foe`

- **`roar.test.ts`** — ajouter :
  `"Hurlement (sound) traverse un pilier h2 dans le cône : la cible derrière le pilier reçoit le debuff"` —
  même géométrie

- **`supersonic.test.ts`** — ajouter :
  `"Ultrason (sound) traverse un mur h2 : la cible en (2,0) est affectée malgré le pilier en (1,0)"` —
  même géométrie ; vérifier que l'effet du move (confusion ou autre) est appliqué

- **`sing.test.ts`** — ajouter :
  `"Chant (sound) traverse un pilier h2 dans le cône"` — même pattern

---

**Pattern dash — arrêt contre mur :**

- **`quick-attack.test.ts`** — ajouter :
  `"Vive-Attaque stoppée par un mur h2 : le caster s'arrête devant le mur et reçoit des dégâts de chute"` —
  caster en (0,0), mur h2 en (3,0) via `setTile`, target fictif en (4,0) ;
  `submitAction` avec `quick-attack` →
  - `state.pokemon.get(caster.id)?.position` vaut `{ x: 2, y: 0 }` (arrêt avant le mur)
  - `result.events` contient `FallDamageDealt`
  - `state.pokemon.get(caster.id)?.currentHp` a diminué

Note : le scénario Gherkin complet `dash-wall-impact.test.ts` est prévu en étape 8 dans
`battle/scenarios/` (nouveau répertoire). Le cas ci-dessus dans `quick-attack.test.ts` est un test
move standard (pas Gherkin) qui vérifie le comportement observable depuis l'API publique.

---

Critère global : tous les fichiers listés ci-dessus ont au moins 1 nouveau cas LoS vert ;
`pnpm test` passe sans régression.

### Étape 9 — Data : peupler `moveFlags` sur les ~80 moves du roster (data) (M)

- Lire `packages/data/src/base/moves.ts` et `node_modules/pokemon-showdown/data/moves.ts` (ou
  l'équivalent disponible dans le repo) pour extraire les flags par move ID
- Pour chaque move du roster, ajouter `moveFlags: { ... }` avec les flags pertinents (ne pas mettre
  les flags à `false` — omettre suffit, tout est optionnel)
- Priorité sur les flags qui affectent la LoS dans ce plan :
  - `sound: true` : Chant (sing), Rugissement (growl), Hurlement (roar), Ultrason (supersonic),
    Hypnose si applicable, Cri Acide (acid-sound), etc.
  - `bullet: true` : Ball'Ombre, Dracosouffle ballistique, etc.
  - `contact: true` : tous les moves de contact physique (Charge, Tranche, etc.)
- Remplir aussi les autres flags de nature physique (`punch`, `bite`, `slicing`, `dance`, `powder`,
  `wind`, `pulse`) pour être Showdown-compatible dès maintenant
- Aucun test nouveau requis (données statiques) ; vérifier avec `pnpm typecheck` que les types sont
  respectés
- Critère : tous les moves du roster ont `moveFlags` correctement renseigné, `pnpm typecheck` clean

### Étape 10 — Renderer : preview AoE respectant la LoS (renderer) (M)

- Modifier la logique de preview AoE dans `packages/renderer/src/` (probablement dans
  `AoEPreview.ts` ou `GameController.ts`) :
  - Lors du calcul des tiles affichées en preview, appeler `resolveTargeting` avec le move réel
    (et donc avec le contexte de hauteur), pas une version simplifiée
  - Les tiles exclues par la LoS ne s'affichent pas en surbrillance
  - Pour blast : afficher l'épicentre intercepté (pilier) en couleur distincte pour indiquer que
    l'explosion a lieu là — utiliser la couleur `COLOR_AoE_BLAST_INTERCEPT` (nouvelle constante
    dans `constants.ts`, à documenter dans `docs/design-system.md`)
- Critère : dans `highlands.tmj`, un move blast visant derrière un pilier affiche l'explosion sur
  le pilier ; un cone ne colore pas les cases derrière un obstacle

### Étape 11 — Data : 5 maps sandbox dédiées aux scénarios LoS (data) (M)

Créer les maps dans `packages/renderer/public/assets/maps/`. Chaque map regroupe plusieurs
scénarios compatibles géographiquement. Charger avec `pnpm dev:map <nom>.tmj`.

**Note préalable — maps existantes :** Les maps sandbox existantes (`sandbox-melee-block`,
`sandbox-fall-X`, `sandbox-slopes`, `highlands`) ne couvrent aucun des scénarios LoS :
- `sandbox-melee-block` : plateau massif L-shape collé aux bords, pas de pilier isolé en couloir.
- `sandbox-fall-X` : falaise continue coupant la map en deux, un seul niveau de hauteur.
- `sandbox-slopes` : uniquement des rampes, pas de murs verticaux.
- `highlands` : map de jeu organique (12 lignes, 7 niveaux de hauteur), géométrie imprévisible.
Toutes les maps de cette étape sont donc nouvelles.

**Fusion sound + shots :** `sandbox-los-shots.tmj` couvre aussi le scénario sound — la config A
(tireur h0, pilier h2 isolé, cible h0 alignés) est exactement la géométrie des deux scénarios.
`sandbox-los-sound.tmj` est supprimée. Les 6 scénarios sont couverts par 5 maps.

Conventions communes :
- Format 8×6 (légèrement élargi pour permettre plusieurs configurations côte à côte)
- Tile 23 = sol h0.5 (couche `terrain`)
- Tile 115 empilée N fois dans `terrain_2`/`terrain_3`/… = hauteur N+0.5 (une couche = +1 unité)
- Spawns : `spawn-player` (équipe 0) et `spawn-dummy` (équipe 1), coordonnées en pixels iso
  (colonne × 32, ligne × 16)
- Valider avec le parser : `parseTiledMap(map)` produit un `MapDefinition` valide sans erreur

---

#### `sandbox-los-shots.tmj` — tir à distance + moves sonores (4 scénarios)

- **Géométrie** : 8×6, trois configurations de gauche à droite sur la même rangée (ligne 2) :
  - **Config A** (colonnes 0-2) : tireur h0 en (0,2), pilier h2 en (1,2), cible h0 en (2,2)
  - **Config B** (colonnes 3-5) : tireur h0 en (3,2), bloc h1 en (4,2), cible h0 en (5,2)
  - **Config C** (colonnes 6-8) : tireur h0 en (6,2), plateforme h2 en (8,0)→(8,4) avec cible h2
    en (8,2), bloc h1 en (7,2) entre les deux
- **Scénarios testés** :
  1. Config A — Psyko : LoS bloquée (pilier h2 > max(0,0)+1 = true) → cible non atteinte
  2. Config B — Éclair : LoS passe (bloc h1 = max(0,0)+1 → non bloquant) → cible atteinte
  3. Config C — Psyko : LoS passe malgré le bloc h1 (ref = max(0,2) = 2 → h1 non bloquant) →
     tireur au sol atteint la cible en hauteur
  4. Config A — Hurlement (flag `sound: true`) : `ignoresLoS = true` → traverse le pilier h2, cible
     atteinte malgré l'obstacle (même géométrie que le scénario 1, résultat opposé)
- **Comportements attendus** : 4 résultats distincts sur la même map ; config A seule illustre
  à la fois le blocage LoS (Psyko) et le bypass sonore (Hurlement)

---

#### `sandbox-los-line.tmj` — 2 couloirs parallèles comparatifs

- **Géométrie** : 8×6, deux couloirs horizontaux :
  - **Couloir Nord** (ligne 1) : sol h0, mur h2 en (4,1) — bloque le line
  - **Couloir Sud** (ligne 4) : sol h0, mur h1 en (4,4) — laisse passer (h1 = hCaster+1 non bloquant
    depuis un tireur h0 : `heightBlocks(1, 0) = 1 > 1 = false`)
  - Tireurs en (1,1) et (1,4), cibles en (7,1) et (7,4)
- **Scénarios testés** :
  1. Couloir Nord — Ultralaser : resolveLine s'arrête en (3,1) ; cases après le mur exclues
  2. Couloir Sud — Ultralaser : resolveLine passe le mur h1 et touche toutes les cases jusqu'à (7,4)
- **Comportements attendus** : comparaison directe mur bloquant vs mur non bloquant pour pattern line

---

#### `sandbox-los-zone.tmj` — zone normale vs zone tellurique sur même géométrie

- **Géométrie** : 8×6, pilier h2 en (4,3) (centre), tireur en (1,3), cible dummy en (7,3) (derrière
  le pilier depuis le tireur)
- **Scénarios testés** :
  1. Explosion (zone Normal, rayon 3, épicentre (4,3)) : `heightBlocks(2, 0) = true` → ombre
     projetée ; cases en (5,3), (6,3), (7,3) exclues du preview AoE
  2. Séisme (zone Ground, rayon 3, épicentre (4,3)) : `ignoresLoS = true` → toutes les cases
     incluses y compris derrière le pilier ; preview couvre tout le rayon
- **Comportements attendus** : même géométrie, résultat opposé selon le type de move

---

#### `sandbox-los-blast.tmj` — blast intercepté vs blast libre

- **Géométrie** : 8×6, deux configurations côte à côte :
  - **Config A** (colonnes 0-5, ligne 2) : tireur h0 en (0,2), pilier h2 en (3,2), cible visée en (5,2)
  - **Config B** (colonnes 0-5, ligne 5) : même tireur et cible, mais sans pilier (sol h0 uniforme)
- **Scénarios testés** :
  1. Config A — Ball'Ombre : projectile intercepté en (3,2) ; explosion recentrée sur le pilier ;
     preview AoE en `COLOR_AoE_BLAST_INTERCEPT` sur (3,2) et rayon depuis là
  2. Config B — Ball'Ombre : aucune interception ; explosion à l'épicentre cible (5,5) ; propagation
     normale
- **Comportements attendus** : comparaison directe blast intercepté vs blast libre

---

#### `sandbox-los-dash.tmj` — dash contre murs de hauteurs variées

- **Géométrie** : 8×6, trois couloirs horizontaux :
  - **Couloir Nord** (ligne 1) : sol h0, mur h1 en (4,1) — le dash passe (diff = 1, seuil
    `canTraverse` est 0.5 unité ; h1 = +1 depuis h0 → diff > 0.5 → arrêt et dégâts faibles)
  - **Couloir Centre** (ligne 3) : sol h0, mur h2 en (4,3) — arrêt + dégâts moyens (diff = 2 → 33% maxHp)
  - **Couloir Sud** (ligne 5) : sol h0, mur h3 en (4,5) — arrêt + dégâts élevés (diff = 3 → 50%+ maxHp)
  - Tireurs en (1,1), (1,3), (1,5) ; cibles initiales en (7,1), (7,3), (7,5) derrière les murs
- **Scénarios testés** :
  1. Couloir Nord — Vive-Attaque : arrêt en (3,1), `FallDamageDealt` avec heightDiff=1
  2. Couloir Centre — Vive-Attaque : arrêt en (3,3), `FallDamageDealt` avec heightDiff=2 (33% maxHp)
  3. Couloir Sud — Vive-Attaque : arrêt en (3,5), `FallDamageDealt` avec heightDiff=3
- **Comportements attendus** : escalade progressive des dégâts selon la hauteur du mur ; le joueur
  teste trois dash depuis les trois couloirs pour observer les trois cas

---

Critère global :
- Toutes les maps chargent sans erreur (`parseTiledMap` valide)
- Chaque map illustre au moins 2 comportements distincts et reproductibles dans le renderer
- L'ensemble des 5 maps couvre les 9 patterns core (single distance, line, zone, blast, dash, sound)

## Critères de complétion

- `pnpm test` passe — aucune régression, tous les nouveaux tests verts
- `pnpm typecheck` + `pnpm lint` : zéro erreur
- `heightBlocks` : la règle `obstacleHeight > referenceHeight + 1` est vérifiée pour les 4 usages
  (mêlée, LoS distance, propagation zone, blast phase 2)
- `hasLineOfSight` : Bresenham 2D avec filtre `heightBlocks`, ~8 cas unitaires
- `MoveFlags` : type créé, exporté, `moveFlags` sur `MoveDefinition`, ~80 moves peuplés
- `ignoresLineOfSight` : `sound === true` ou `(zone && type === Ground)` — Rugissement traverse les
  murs, Séisme ignore les piliers
- blast 2 phases : l'explosion se produit sur le premier pilier intercepté, preview AoE le montre
- dash contre mur : arrêt + `FallDamageDealt` sur le caster avec `heightDiff = hauteur du mur`
- 5 maps sandbox LoS : toutes valides au parser, chacune couvrant au moins 2 scénarios distincts et
  reproductibles dans le renderer (`sandbox-los-sound.tmj` supprimée — scénario sound fusionné dans
  config A de `sandbox-los-shots.tmj`)

## Hors scope

- Data-mining complet des flags **mécaniques** Phase 4 (`protect`, `mirror`, `snatch`, etc.) —
  les flags sont stockés mais leurs effets ne sont pas activés dans ce plan
- Effets gameplay des talents type Bulletproof (immunité bullet), Soundproof (immunité sound),
  Iron Fist (boost punch) — Phase 4
- Hauteur effective du sprite tireur : on part sur "hauteur tile du tireur" uniquement. La hauteur
  réelle du sprite (pokemon de grande taille = tir depuis plus haut) est hors scope.
- Gestion des tiles water/lava comme obstacle LoS — elles sont traitées comme tiles passables
  pour la LoS dans ce plan (seule la hauteur compte)

## Questions ouvertes

Aucune — tout a été tranché en discussion avec l'humain avant la rédaction de ce plan.

## Fichiers touchés (prévisionnels)

### Core (`packages/core/src/`)

- `battle/height-modifier.ts` — ajout `heightBlocks`, refacto `isMeleeBlockedByHeight`
- `battle/height-modifier.test.ts` — nouveaux cas `heightBlocks`
- `types/move-flags.ts` — nouveau fichier : interface `MoveFlags`
- `types/move-definition.ts` — ajout `moveFlags?: MoveFlags`
- `types/index.ts` — export `MoveFlags`
- `grid/line-of-sight.ts` — nouveau fichier : `hasLineOfSight`
- `grid/line-of-sight.test.ts` — nouveau fichier : tests unitaires
- `grid/targeting.ts` — signature étendue + LoS dans les 9 resolvers
- `grid/targeting.integration.test.ts` — nombreux cas avec hauteurs
- `battle/BattleEngine.ts` — call sites de `resolveTargeting` mis à jour + logique dash/wall
- `battle/scenarios/dash-wall-impact.test.ts` — nouveau fichier : scénario Gherkin (étape 8)
- `battle/moves/psybeam.test.ts` — +1 cas : LoS bloquée par pilier h2 (étape 8b)
- `battle/moves/thunderbolt.test.ts` — +2 cas : LoS seuil +1 passe, line stoppée par mur h2 (étape 8b)
- `battle/moves/hyper-beam.test.ts` — +1 cas : line stoppée par mur h2, cible au-delà non atteinte (étape 8b)
- `battle/moves/earthquake.test.ts` — +1 cas : zone ground ignore pilier h2 (étape 8b)
- `battle/moves/magnitude.test.ts` — +1 cas : zone ground ignore pilier h2 (étape 8b)
- `battle/moves/sludge-bomb.test.ts` — +1 cas : blast intercepté sur pilier, cible au-delà non atteinte (étape 8b)
- `battle/moves/growl.test.ts` — +1 cas : cone sound traverse pilier h2 (étape 8b)
- `battle/moves/roar.test.ts` — +1 cas : cone sound traverse pilier h2 (étape 8b)
- `battle/moves/supersonic.test.ts` — +1 cas : sound traverse mur h2 (étape 8b)
- `battle/moves/sing.test.ts` — +1 cas : sound traverse pilier h2 (étape 8b)
- `battle/moves/quick-attack.test.ts` — +1 cas : dash stoppé par mur h2, FallDamageDealt émis (étape 8b)

### Data (`packages/data/src/`)

- `base/moves.ts` — ajout `moveFlags` sur ~80 moves

### Renderer (`packages/renderer/src/`)

- `constants.ts` — nouvelle constante `COLOR_AoE_BLAST_INTERCEPT`
- `game/AoEPreview.ts` (ou fichier équivalent) — preview filtrée par LoS, épicentre intercepté

### Assets (`packages/renderer/public/assets/maps/`)

- `sandbox-los-shots.tmj` — 4 scénarios : LoS bloquée (pilier h2), LoS sur seuil (bloc h1), LoS
  hauteur relative (cible h2), + bypass sonore Hurlement sur config A (sound fusionné ici)
- `sandbox-los-line.tmj` — 2 couloirs : mur h2 bloque Ultralaser, mur h1 ne bloque pas
- `sandbox-los-zone.tmj` — Explosion (zone Normal, ombre projetée) vs Séisme (zone Ground, ignore pilier h2)
- `sandbox-los-blast.tmj` — Ball'Ombre interceptée sur pilier vs blast sans obstacle (2 configs)
- `sandbox-los-dash.tmj` — 3 couloirs : dash contre mur h1, h2, h3 avec dégâts progressifs
- ~~`sandbox-los-sound.tmj`~~ — supprimée : scénario sound couvert par config A de shots

### Documentation

- `docs/design-system.md` — documenter `COLOR_AoE_BLAST_INTERCEPT`

## Dépendances

- **Avant** : Plan 046 terminé (`canTraverse`, `calculateFallDamage`, `isMeleeBlockedByHeight`,
  `TileState.height`, rendu surélevé)
- **Débloque** :
  - Plan types de terrain tactiques (terrain feu/eau/glace avec effets et immunités LoS spécifiques)
  - Plan talents Phase 4 (Bulletproof, Soundproof, Iron Fist utilisent les flags posés ici)
  - Plan tileset custom (les shadows de piliers seront visuellement représentées avec les vraies
    tiles falaise)
