# Plan 169 — Purge des demi-blocs de liquide

- **Statut** : done
- **Date** : 2026-07-23
- **Type** : nettoyage rendu + data + assets (chantier visuel, vérif humaine map par map)
- **Origine** : backlog « Régression — demi-blocs de liquide obsolètes depuis le rendu volume liquide » (2026-07-23). Régression du rendu volume (plan 166/167) sur les tuiles liquides `half-a` (`height=0.5`), reliquat pré-décision #697.

## Problème

Le tileset définit pour chaque liquide une variante **`half-a` à `height=0.5`** (localIds 67 water, 70 deep_water, 73 lava, 76 swamp), ajoutée le 2026-04-23 pour cratères/cuvettes/marais peu profonds. La **décision #697** a acté que les liquides restent **toujours pleins (`height=1.0`)** — la sensation de « demi-bloc » vient de la **submersion** du Pokémon (enfoncé à 3/6), pas de la hauteur de la tuile. Depuis le rendu volume (plan 166), une tuile liquide à `0.5` rend une colonne liquide à moitié → cassé / incohérent.

La variante `half-a` liquide ne diffère du `full` que par la **propriété `height`** (même terrain, même texture PNG) → le nettoyage code/tileset est sans décalage d'ids.

## Maps affectées (scan des `.tmj`)

| Map (FR) | Fichier | Demi-liquides | Pleins présents |
|----------|---------|---------------|-----------------|
| Archipel des Pontons | `naval-arena.tmj` | water ×20, deep_water ×48 | **aucun** (100 % demi) |
| Tourbière | `swamp.tmj` | swamp ×20, deep_water ×12 | swamp ×64 |
| Volcan Actif | `volcano.tmj` | lava ×12 | lava ×8 |

Maps dev : aucune.

## Étapes

### 1. Data — remplacer `half-a` → `full` dans les 3 maps
Swap des gid (firstgid=1, gid = localId+1) dans les couches `tilelayer` : `68→67` (water), `71→70` (deep_water), `74→73` (lava), `77→76` (swamp). Gérer le flag de flip Tiled (bits hauts) si présent.
- ⚠️ Le swap remonte la surface liquide de `0.5`. **Archipel** (100 % demi, uniforme) → OK direct. **Tourbière / Volcan** (mixte) → risque de marche vs terrain/liquide adjacent → **vérif visuelle + ajustement éventuel de la couche d'élévation** (`level-designer`).
- Vérif : `validateTiledMap` passe sur les 3 maps.

### 2. Renderer — garde-fou invariant #697
`terrain-extruder.ts` : forcer tout groupe liquide à une hauteur de corps `≥ 1.0` (clamp), pour qu'un `0.5` résiduel ne puisse plus produire un demi-liquide. Enforce l'invariant « liquide toujours plein ».

### 3. Purge code + tileset (sans décalage d'ids)
- `packages/view-core/src/tiled-map.ts` : retirer les localIds `67/70/73/76` de `LIQUID_GROUP_BY_LOCAL_ID`.
- `packages/app/public/assets/tilesets/terrain/tileset.tsj` : supprimer les entrées de tuile `half-a` liquide (id 67/70/73/76).
- **PNG non re-coupé** : les 4 lignes deviennent des rangs morts réservés (re-couper décalerait tous les ids liquides + toutes les maps → gros ripple pour un gain cosmétique nul). Décision assumée.
- Garde validateur : une tuile liquide `half-a` (id purgé) dans une map future doit échouer `validateTiledMap`.

### 4. Docs
- `docs/tileset-mapping.md` : retirer les lignes `half-a` liquide du tableau (§ Terrains liquides), noter les rangs PNG morts réservés.
- `docs/decisions.md` : nouvelle décision (purge demi-liquides, garde-fou clamp, PNG non re-coupé).
- `docs/design-system.md` § Liquides : ajuster si mention du demi-bloc.

### 5. Validation
- `validateTiledMap` vert sur toutes les maps.
- **Vérif visuelle humaine map par map** (Archipel, Tourbière, Volcan) via sandbox — c'est le cœur du chantier (règle WIP + re-test humain).
- Gate CI complet.

### 6. Retours de cohérence humains (vérif visuelle 2026-07-23)
Deux ajustements demandés après validation visuelle des 3 maps :
- **Tourbière** : les 4 tuiles sous les arbres (cellules (0,4), (13,4), (0,9), (13,9)) passent de `swamp` (gid 76) à `herbe`/`normal` (gid 1) — les arbres reposent sur de l'herbe, pas sur le marécage.
- **Volcan Actif** : les 24 demi-blocs de **magma** (solide, gid 62 = localId 61 `half-a` `height=0.5`) passent en bloc plein (gid 61 = localId 60 `height=1`) — surface rocheuse uniforme. NB : la variante `half-a` magma reste dans le tileset (terrain solide légitime), seule la variante `half-a` **liquide** est purgée.

## Critères d'acceptation
- Zéro tuile liquide `half-a` dans les maps.
- Aucune colonne liquide à moitié en jeu.
- Les 3 maps rendues correctement (pas de marche/dépassement liquide vs terrain).
- Code/tileset ne permettent plus d'autoriser un demi-liquide.
