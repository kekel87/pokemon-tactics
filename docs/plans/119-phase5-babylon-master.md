# Plan 119 — Phase 5 : migration renderer Babylon.js 2D-HD (plan-maître)

> **Statut : in-progress** — **Jalon 3 terminé** (3a→3f, 3d partiel — 2026-06-10) : gate 60fps PASS, gate parité Phaser reporté à combat fonctionnel (J4+, décision humaine). **Jalon 3.5 abandonné** (2026-06-10 — 4 essais pixel-art rejetés, rendu full-res conservé). Prochain : **Jalon 4a**. Tints terrain, texte chute et barrière Psychique reportés (polish/J4).
> Créé : 2026-06-08 | Renommé plan 119 : 2026-06-09 (rebase sur main — plans 117-118 pris par Champs/B4)
> Branche : `phase5-babylon` (worktree long-lived, `.worktrees/phase5-babylon/`, port Vite 5220)
> Remplace : renderer Phaser 4 isométrique (`packages/renderer/` partie rendu)

---

## 1. But

Remplacer le renderer **Phaser 4 isométrique 2D** par un renderer **Babylon.js 2D-HD** : sprites billboards directionnels sur terrain 3D extrudé, caméra orthographique dimetric, style Tactics Ogre PSP / Triangle Strategy / FFTIC.

À la sortie, le jeu tourne **uniquement sur Babylon + overlay DOM**. Phaser n'existe plus dans le repo.

## 2. Definition of Done (critères de sortie)

**Phaser disparaît totalement :**
- [ ] Dépendance `phaser` retirée de tous les `package.json`
- [ ] Code renderer Phaser supprimé (scenes Phaser, state machine, `IsometricGrid`, `PokemonSprite` Phaser, `OcclusionFader`, caméra Phaser…)
- [ ] `grep -ri phaser packages/` → **0 résultat**
- [ ] Bundle ≤ 220 kB gzip (cible 180-220, vs ~273 kB spike / actuel Phaser à mesurer)

**Parité features (rien perdu) :**
- [ ] Combat complet jouable : placement → tours CT → KO → victoire
- [ ] Écrans : menu principal, sélection équipe, sélection map + preview, combat, victoire, sandbox, Team Builder
- [ ] UI combat : timeline CT, InfoPanel, ActionMenu, sous-menu attaque, battle log, preview AoE/dégâts
- [ ] Rendu : terrain extrudé + types (lave/eau/herbe), hauteurs + dégâts chute, occlusion native, sprites directionnels PMDCollab animés (Idle/Walk/Attack/Hurt/Faint/Shoot/Charge/Hop), curseur FFTA, décorations
- [ ] Animations combat : direction dynamique, catégorie de move (Contact/Shoot/Charge), knockback, confusion wobble, textes flottants
- [ ] Mobile tactile fonctionnel (navigateur tactile) — **nouveau**, gratuit avec DOM

**Intact (jamais touché) :**
- [ ] `packages/core`, `packages/data`, IA, LoS 3D, CT, statuts, format Tiled, i18n, tokens CSS
- [ ] `core-guardian` vert (zéro dep rendu dans core)

**Bonus non-bloquants parité** (reportables Phase 6 si ça traîne) : herbes hautes billboards animées. ~~Rotation caméra 4 angles~~ : livrée en Jalon 3a (décision #476).

## 3. Décisions verrouillées (validées 2026-06-08)

| # | Décision | Détail |
|---|----------|--------|
| D1 | **Stack = Babylon.js 8.x** | Spikes 062 (Three.js) + 063 (Babylon) déjà faits. Babylon retenu (décision #269). Pas de re-spike. |
| D2 | **Worktree unique long-lived** | Tous les jalons sur `phase5-babylon`. **Pas de merge partiel sur main.** Merge `--ff-only` sur main **seulement à parité atteinte** (DoD validée visuellement). Override assumé du gate roadmap "pas de branche longue" (contexte #272 changé). |
| D3 | **Tiled gardé** | `loadTiledMap` → `MapDefinition` inchangé. Format 3D custom = Phase 6, déjà prévu. Renderer adapte l'extrusion 3D, le core ne voit rien. |
| D4 | **UI = HTML/CSS overlay** | Pas `@babylonjs/gui`. Décidé par la contrainte multi-plateforme (navigateur clavier/souris/tactile + mobile). Réutilise les 12 modules CSS + helpers `ui/dom/` du Team Builder. Babylon ne rend QUE la scène 3D. |
| D5 | **Contrat overlay UI (anti-dérive)** | Toute l'UI DOM vit sous un root overlay aligné au pixel sur le canvas Babylon. Résout la dérive actuelle du Team Builder (DOM plein navigateur, hors-cadre). Voir §4. **MAJ 2c** : canvas = plein viewport (décision #472), zéro bande noire. Le contrat cqw/`.ui-world`/`.ui-screen` reste valide — le scaling se résout contre le viewport plein au lieu d'une boîte 16:9. |

## 4. Architecture — Contrat de couche UI (cœur de la migration)

Deux catégories d'UI, deux règles d'alignement :

### A. UI ancrée-monde (suit le canvas pixel-près)
Barres PV au-dessus des sprites, surbrillances de tile, dégâts flottants, curseur, badges statut.
- Projection par frame : `Vector3.Project(worldPos, Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(w, h))` → px écran → `transform: translate()` sur l'élément DOM, dans la render loop.
- ⚠️ Gotcha spike : `Matrix.Identity()` en 2ᵉ arg, **pas** `camera.getWorldMatrix()` (collapse tous les points).

### B. UI chrome (panneaux écran)
InfoPanel, timeline CT, ActionMenu, battle log, menus.
- Ancrée aux bords du root overlay.
- Échelle via container queries (`cqw`/`cqi`) sur le root → scale proportionnel à la **taille du jeu**, pas du navigateur.

### Le root overlay (mécanisme central)
```
<div id="game-stage">           ← zone de jeu (letterbox), ratio fixe
  <canvas id="babylon-canvas">  ← Babylon rend ici
  <div id="game-overlay">       ← position:absolute, = bounding-rect du canvas au pixel
    <div class="ui-world">      ← cat. A, transform par frame
    <div class="ui-screen">     ← cat. B, ancré bords + container queries
```
- `ResizeObserver` sur le canvas → overlay matche sa bounding-box. En letterbox, l'overlay couvre la **zone de jeu**, pas la fenêtre → chrome ne peut plus déborder.
- `--ui-scale` dérivé d'une **résolution design de référence** (à figer : ex. 1280×720) → tous les tokens d'espacement/font scalent ensemble.
- **Mobile** : sous breakpoint, **reflow** des panneaux (style PokeRogue) via media queries, pas shrink illisible.

### Harmonisation
- `docs/design-system.md` étendu : résolution design de référence + `--ui-scale` + règles overlay.
- **Team Builder rapatrié** sous ce contrat (fin du DOM hors-cadre).

## 5. Jalons (milestones internes au worktree)

> Chaque jalon = commit(s) sur `phase5-babylon`. Aucun ne merge sur main seul. Validation visuelle par l'humain à chaque jalon.

### Jalon 1 — Spike → production : terrain + 1 billboard + caméra ✅ DONE (2026-06-08)

**Livré :**
- Spike Babylon 063 extrait et porté dans `packages/renderer/src/babylon/`.
- `terrain-extruder.ts` : extrusion terrain depuis `MapDefinition` (hauteurs, types).
- `directional-billboard.ts` : 1 sprite PMDCollab directionnel animé.
- Caméra orthographique dimetric + curseur tile.
- 15 textures tiles PMD copiées dans `public/assets/tilesets/terrain-3d/`. `VisualTerrainGroup` résout le GID → texture.
- Ombres par `shadowSize` PMD (3 tailles : 0.14/0.2/0.3).
- Sprites `renderingGroupId 1` (au-dessus terrain, pas de clipping).
- Docs de référence : `docs/babylon/babylon-2d-overlay-scaling.md`, `docs/babylon/babylon-asset-lifecycle.md`.
- Plan parité 307 items : `docs/plans/119-parity-checklist.md`.

**Bonus tirés en avance (findings review intégrés) :**
- Orientation grille→monde transposée figée (gridX→worldZ, gridY→worldX) — décision #457.
- Hauteurs 2:1 (full=1/half=0.5) figées — décision #456.
- Terrain visuel ≠ terrain gameplay (`VisualTerrainGroup`) — décision #458.
- Jalon 3.5 pixel-art créé comme jalon dédié (RTT + integer scaling) — décision #461, doc `babylon-pixel-art-pipeline.md`.

**Fix ancrage sprite (livré post-Jalon 1, avant Jalon 2) :**
- Bug : sprites flottaient / n'étaient pas centrés sur leur ombre. Cause racine : `footAnchor = 0.34` constant inventé, jamais branché sur les données PMD. Une première tentative de correction (lift d'une unité pour "poser les pieds") aggravait le flottement.
- Correction : `directional-billboard.ts` lit désormais `footOffsetY` depuis `offsets.json` (`BABYLON_SPRITE_GROUND_OFFSET_PX = 5` comme fallback). `footOffsetY` est constant (4 px) sur tous les sprites — le pixel BLANC du marqueur PMD est toujours à `centerY + 4`. Ancrage HUD : `headOffsetY` + `BABYLON_HUD_ANCHOR_MARGIN_PX = 20`.
- Décisions : #462 (ancrage sprite), #463 (ancrage HUD). Doc : `docs/babylon/babylon-2d-overlay-scaling.md`.

**Gate** : terrain volcano rendu, 1 Pokemon animé, caméra navigable. Bundle : à mesurer (audit prévu Jalon 5 ou si dérive détectée).

### Jalon 2 — Contrat overlay UI + harmonisation design-system ✅ DONE (2026-06-08)

> **Pivot majeur Jalon 2c** : abandon du letterbox 16:9 → canvas plein viewport (décision #472). Les décisions #464-468 décrivaient un stage letterboxé 16:9 ; le contrat overlay reste valide (cqw, `.ui-world`/`.ui-screen`, projection) mais le scaling cqw se résout désormais contre le viewport plein. Voir §3 décision D5 (mis à jour).

#### 2a — Fondation overlay ✅ DONE (2026-06-08)

**Livré :**
- `game-stage.ts` : `mountGameStage(root)` construit `#game-root > #game-stage > (canvas + #game-overlay > .ui-world + .ui-screen)`. Letterbox CSS `aspect-ratio`/`min()` (supprimé en 2c — voir pivot). Constantes `DESIGN_REFERENCE_WIDTH = 1920`, `DESIGN_REFERENCE_HEIGHT = 1080`. `ResizeObserver` publie `--ui-scale`.
- `world-projection.ts` : `projectAnchors(scene, camera, anchors, cssWidth, cssHeight)` — projection par frame `Vector3.ProjectToRef`, viewport CSS (pas backing-store), batch read→write, pixel-snap `Math.round`, visibility z∈[0,1]. Décision #464.
- `game-overlay.css` : layers `@layer reset,base,components,utilities`, `pointer-events:none` root / `auto` sur `.ui-screen > *`, `touch-action:none` canvas, `contain:layout` `.ui-world`, `will-change:transform` éléments cat. A. Décision #465.
- Tokens `tokens.css` étendus : `--blue-1000` + `--color-letterbox`. `babylon-boot` importe `tokens.css` + `game-overlay.css`.
- Demo HP bars (une par sprite, ancrée tête) : valide projection + perf 60fps N éléments DOM transformés — check bloquant plan §4 validé. 0 erreur console.
- Grille debug touche `g` (wireframe arêtes tiles via `createTileGrid`). Décision #466.
- Décisions : #464, #465, #466.

#### 2b — Démonstrateur chrome InfoPanel DOM ✅ DONE (2026-06-08)

**Livré :**
- `packages/renderer/src/ui/dom/info-panel.ts` : composant DOM InfoPanel, port du `ui/InfoPanel.ts` Phaser. View-model `InfoPanelData` (name, level, gender, hp, team, portraitUrl, badges). Pas de dépendance `@pokemon-tactic/core` (adapter core→view-model reporté Jalon 4). Sémantique HTML : `img` (alt vide, decoding/loading), `role=progressbar` + aria-valuenow/min/max, `ul/li` badges, `textContent`.
- `packages/renderer/src/styles/info-panel.css` : scaling cat. B via **container-query units** — `--ip-px = calc(100cqw / 1920)` (1 px design @1920, résolu contre `#game-stage`, `container-type:size`). Reflow mobile `@container stage (width < 768px)` → barre bas pleine largeur, scale sur ref 768. Badges `flex-wrap` + panneau ancré bas (grandit vers le haut, jamais coupé). Décision #467.
- `tokens.css` enrichi : tokens équipe `--team-1`..`--team-12` (miroir `TEAM_COLORS`), `--color-badge-{buff,debuff,volatile}-bg` (miroir `STAT_BADGE_*_BG`), `--color-border-faint`. `@font-face` PokemonEmeraldPro déplacé ici (était inline `index.html` uniquement → `babylon.html` tombait en monospace). `index.html` garde sa copie jusqu'au Jalon 5.
- **Rename contrat** : `.ui-chrome` → `.ui-screen` (et `chromeLayer` → `screenLayer` dans `game-stage.ts`) — "chrome" ambigu (confusion navigateur Chrome). Paire claire `.ui-world` / `.ui-screen`. Décision #468.
- Wire démo dans `babylon-preview.ts` (InfoPanel Pikachu team 1 dans `screenLayer`) + import CSS dans `babylon-boot.ts`.
- Validé visuellement : desktop + mobile reflow + 10 badges wrap. 0 erreur console.
- Décisions : #467, #468, #469.

#### 2c — Team Builder + pivot plein-écran ✅ DONE (2026-06-08)

**Livré :**
- `team-edit-harness.ts` (NOUVEAU) : assembleur Phaser-free réutilisant les sous-composants prod `SlotCardsRow`/`EditLeftPanel`/`EditRightPanel` + `generateRandomTeam` (RNG seedé mulberry32). Placeholder : équipe seedée en dur, panneaux read-only, callbacks no-op, topbar inerte. Clic slot = switch du Pokemon prévisualisé. Jetable (supprimé Jalon 5). L'extraction d'un `TeamEditView` partagé depuis le `TeamEditScene` Phaser = Jalon 4.
- `team-builder-overlay.css` (NOUVEAU) : adapter contrat. `.tb-root` fixed→absolute dans `.ui-screen` ; override des tokens spacing/font/radius/pad/target + vars tb-locales en unités cqw (`--tb-px = calc(100cqw/1920)`) sous `@container stage`, reflow mobile `<768px` (ref 768), restauration `[hidden]`. **Prod-safe** : overrides cloisonnés dans `@container stage` (ne matche que dans le stage) + raw px wrappés `var(--tb-*, <px-original>)` → l'app Phaser prod (body-mount, hors stage) garde son rendu px d'origine. Vérifié live.
- CSS prod `components/{edit-panels,slot-card,stat-bar,topbar,set-op}.css` : raw px wrappés en `var(--tb-*, <px>)` (fallback = comportement prod inchangé).
- Wire harness dans `babylon-preview.ts` (toggle clavier `t`) + imports CSS dans `babylon-boot.ts`.
- **Pivot canvas plein viewport** : `#game-stage` perd `aspect-ratio:16/9` + `width:min(...)` → `width/height:100%`. `#game-root` perd le flex-centering. Option `aspectRatio` supprimée de `game-stage.ts`. Caméra ortho dimetric comble le ratio (montre plus/moins de scène selon ratio). Zéro bande noire. Décision #472.
- Légende debug `#hint` (babylon.html) déplacée en haut (collait l'InfoPanel bottom-left) + masquée quand Team Builder affiché.

**Gate Jalon 2** : Team Builder + InfoPanel alignés au canvas, responsive, mobile reflow OK, 60fps tenu. Validé visuellement.

**Pistes différées (best-practices agent) :**
- Plancher font-size `max(calc(N*var(--px)), Xpx)` pour la zone 480-767px (lisibilité mobile entre desktop-ref et reflow 768).
- Modales `<dialog>` top-layer : ne voient pas le `@container stage` → publier `--stage-scale` sur `:root` via ResizeObserver (Jalon 4).
- Cap optionnel ultrawide via `min(100cqw/1920, 100cqh/1080)` sur `--px` (décision design : agrandir vs plafonner).
- `--ui-scale` des barres PV monde encore statique à 1 (à brancher si besoin 4K).

**Décisions Jalon 2c** : #470, #471, #472.

### Jalon 3 — Port core renderer (parité scène combat)

> Jalon 3 découpé en 6 sous-jalons (3a→3f). Chaque sous-jalon = commit(s) sur `phase5-babylon`.

#### 3a — Caméra combat + occlusion native + silhouette X-ray + extrusion multi-niveaux ✅ DONE (2026-06-09)

**Livré :**
- `combat-scene.ts` (NOUVEAU) : scène combat prod (caméra dimetric orthographique rotative ←/→ par snaps 90°, zoom molette, pan clic-glisser). Pas de FSM (Jalon 4). Harness dev `babylon-preview` toujours accessible via `?preview=1` ; `?map=<nom>` change la carte.
- **Occlusion native depth-buffer** (`SpriteDepthPlugin`, `MaterialPluginBase`) : sprites et terrain en `renderingGroupId 0` partagé. Le plugin écrit `gl_FragDepth` = profondeur des pieds du sprite (calculée CPU en ortho), biais `BABYLON_SPRITE_DEPTH_BIAS = 0.0025`. Résout l'auto-occultation (le billboard n'est plus enterré dans son propre cube de tile). Technique bgolus HD-2D. Décision #473.
- **Silhouette X-ray** : 2e plane partageant la texture atlas, peinte en couleur d'équipe (masque alpha), `depthFunction = GREATER`, pas d'écriture depth, rendu en `renderingGroupId 1` (depth buffer préservé via `scene.setRenderingAutoClearDepthStencil(1, false)`). Affiche la partie occultée du Pokémon par-dessus l'obstacle. `BABYLON_SILHOUETTE_ALPHA = 1`. Décision #474.
- **Extrusion terrain multi-niveaux** : `load-tiled-map.ts` empile désormais les `elevationLayers` (`terrain_2`/`terrain_4`/…) — avant, seul le layer `terrain` de base était lu (reliefs/ruines plats sur maps ex: desert). Désormais toutes les couches de hauteur sont extrudées correctement.
- **Constantes centralisées** : `babylon-constants.ts` — caméra, depth, silhouette (voir section design-system.md).
- **Rotation caméra 4 angles** : livrée ici (←/→ snaps 90°). Feature centrale de la Phase 5 (décision #476) — n'est plus un "bonus reportable".

**Gate 3a** : terrain multi-niveaux extrudé, occlusion native opérationnelle, silhouette équipe visible derrière reliefs, rotation caméra 4 angles fonctionnelle.

> Chaque sous-jalon liste les **items de parité couverts** (réf. `119-parity-checklist.md` §section). Voir la **matrice de couverture** en fin de §5 pour la vue d'ensemble.

#### 3b — Picking multi-niveaux + surbrillances de portée ✅ DONE (2026-06-09)

**Livré :**
- `babylon-picking.ts` (NOUVEAU) : `pickTile(scene, x, y)` ray-cast Babylon → coordonnée grille via `metadata.tile` des tuiles extrudées. En 3D ortho la surface frontale visible est retournée automatiquement → "colonne la plus haute gagne" gratuit, sans tri diamant.
- **Pas de désambiguïsation Alt** : en 3D, une cellule cachée par un pilier se révèle en tournant la caméra (feature livrée en 3a). `preferLower`/`hasPickingAmbiguity` du 2D iso sont donc inutiles et non portés — décision #477.
- `babylon-tile-highlights.ts` (NOUVEAU) : surbrillances de tuiles (move bleu / attack rouge / retreat cyan / enemy orange) en quads plats + contour de portée (arêtes externes) + curseur de survol. Les fills sont posés **flush sur la face top** de chaque tuile, profondeur résolue via `material.zOffset` (polygon offset `BABYLON_TILE_HIGHLIGHT_Z_OFFSET = -2`) — pas de lift world-Y (un lift décalait le quad en projection ortho et faisait baver la couleur sur l'arête des murs). Contour = lignes avec micro-lift Y (`BABYLON_TILE_OUTLINE_Y_OFFSET = 0.02`). Bornage à la grille. Décision #478.
- `terrain-extruder.ts` : tuiles `isPickable = true` + `metadata = { tile: {x,y} }`.
- `combat-scene.ts` : hover (curseur) + clic (sélection, distinct du pan via seuil de drag `BABYLON_PICK_DRAG_THRESHOLD_PX = 5`), API `setTileHighlights / setTileOutline / clearHighlights / onTileHover / onTileClick`.
- `babylon-boot.ts` : démo (clic → portée Manhattan r3 + contour + anneau attaque) — wiring jetable.
- Nouvelles constantes dans `babylon-constants.ts` : `BABYLON_TILE_HIGHLIGHT_Z_OFFSET`, `BABYLON_TILE_OUTLINE_Y_OFFSET`, `BABYLON_TILE_HIGHLIGHT_ALPHA`, `BABYLON_PICK_DRAG_THRESHOLD_PX`. Curseur tuile = contour jaune stroké (parité 2D), pas un fill.

**Gate 3b** : clic correct sur tuile derrière/sous un relief (rotation caméra = désambiguïsation) ; surbrillances move/attack/retreat/enemy alignées flush sur terrain extrudé multi-niveaux.

#### 3c — Curseur FFTA 2D ✅ DONE (2026-06-09) — curseur seul ; previews de ciblage déplacées en Jalon 4

> **Scope livré : curseur uniquement.** Les previews de ciblage (cône/ligne/slash/dash/blast/self-radius/spawn-zones/flash/auras) sont **explicitement repoussées en Jalon 4** — elles dépendent du move sélectionné, donc de la FSM (livrée en J4a).

**Livré :**
- `babylon-hover-cursor.ts` (NOUVEAU) : curseur FFTA de sélection = billboard 2D `BILLBOARDMODE_ALL` (facing caméra), flotte au-dessus de **chaque tuile survolée**. Monté à la hauteur de la tête quand un Pokémon est présent (`spriteTopOffsetY`). 4 variantes cyclables (touche H) réutilisant les PNG curseur Phaser existants (`HOVER_CURSOR_OPTIONS`), persistées en localStorage.
- Rendering group dédié **2** (au-dessus terrain 0 / silhouettes 1) → toujours lisible.
- `combat-scene.ts` : wiring hover (curseur suit la tuile, lift tête si occupant), touche H cycle, lookup tuile→billboard.
- `babylon-constants.ts` : `BABYLON_HOVER_CURSOR_GAP = 0.35`, `BABYLON_HOVER_CURSOR_RENDERING_GROUP = 2`.
- Décision #479.

**Previews de ciblage déplacées en Jalon 4** (section 4b "Chrome combat") :
- Preview de cible (fill buff/attaque suivant le curseur)
- Preview directionnelle (Cône/Ligne/Slash/Dash selon angle souris↔caster)
- Preview impact Blast (interception)
- Preview self-radius (diamant Manhattan)
- Surbrillance zones de spawn pendant placement (couleur équipe)
- Flash de preview sur sprites ciblés
- Icônes d'aura d'équipe au survol

**Gate 3c** : curseur FFTA billboard 2D visible au-dessus de la tuile survolée / levé à la tête du Pokémon si présent ; 4 variantes cyclables touche H.

#### 3d — Animations directionnelles + états sprite complets ✅ PARTIEL (2026-06-09)

> **Livré (renderer-only, zéro changement core) :**
> - **Système animation billboard complet** dans `directional-billboard.ts` : `LOOPING_ANIMATIONS` (Idle/Walk/Sleep/FlapAround/Hover/Special0/Special10/FlyingIdle) ; `setAnimation` (looping, pas de reset sur même clé) ; `playOnce` (one-shot → revient au resting, ou freeze pour Faint/KO) ; `setRestingAnimation` ; `playFirstAvailable` (chaîne glide) ; `advanceFrame` (wrap looping vs clamp one-shot).
> - **Synthèse FlyingIdle** : `synthesizeFlyingIdle` extrait les frames 0-1 de FlapAround — portage fidèle du SpriteLoader 2D (décision #480).
> - **Chaîne glide volants** : `FLYING_GLIDE_CANDIDATES = [FlyingIdle, Hover, Special0, Special10]`, fallback **Walk** (décision #480 — annule feedback playtest 2026-04 "Hop").
> - **États sprite intrinsèques** : `setActive` (pulse respiration, période `BABYLON_PULSE_PERIOD_MS = 900`) ; `flashDamage` (clignotement emissive, gris `BABYLON_DAMAGE_FLASH_DIM_EMISSIVE = 0.25`) ; `setKnockedOut` (teinte sombre + freeze) ; `setSemiInvulnerable` (vol = lift `BABYLON_SEMI_INVULNERABLE_LIFT = 1.5` tiles + glide / creuse = caché mais ombre gardée). `SemiInvulnerableDisplay` = type d'affichage renderer ("flying"|"underground"|null), distinct du core enum (décision #481).
> - **Ré-extraction sprites** : `scripts/sprite-config.json` + ajout anims `Hover`, `Special0`, `Special10` → `pnpm extract-sprites` a régénéré ~208 fichiers (atlas/offsets). Nouvelles anims : Hover (golbat/aerodactyl/fearow/moltres/mewtwo/beedrill), Special0 (dragonite/golem), FlapAround déjà présent (pidgey/butterfree/pidgeot/venomoth). Aucune régression (décision #481).
> - **Roster démo** `babylon-boot.ts` ajusté : butterfree (FlyingIdle synthétique), golbat (Hover), dragonite (Special0), charizard/gyarados (Walk fallback).
> - **Touches debug** dans `combat-scene.ts` (z/x/c/b/n/,/u/k/p/o/i) sur le Pokémon survolé — à retirer au câblage moteur J4.
>
> **Différé (refonte 3D-depth, pass dédié) :**
> - Wobble confusion : conflit billboard Y-lock → différé.
> - Enveloppe de profondeur d'attaque : le sprite passe sous les tuiles same-level → ghost silhouette → différé.
> - Overlay Substitut : swap atlas dummy → différé.

Couvre **checklist §4 (partiel)** — items cochés : voir `119-parity-checklist.md` §4. Items non couverts : barre HP world-space (J4), wobble confusion (pass 3D-depth), enveloppe attaque (pass 3D-depth), overlay Substitut (pass 3D-depth), indicateurs/badges statut/charge/auras (J4).

- Cercle de couleur fallback par type si pas d'atlas (§20 edge-case).
- **Gate** : Pokémon animé toutes directions selon caméra ; états intrinsèques livrés (pulse/flash/KO/semi-invul). Items différés documentés.

#### 3e — Décorations + tints terrain + dégâts chute + **rendu Champs**

Couvre **checklist §2 (reste)** + **Champs (NOUVEAU, absent de la checklist d'origine)** + visuels chute.

##### 3e-décorations ✅ DONE (2026-06-09)

**Livré :**
- `babylon-decorations.ts` (NOUVEAU) : décorations 2D billboards `BILLBOARDMODE_Y` (face caméra) — rochers (`rock_1`, `rock_2x2`), arbres (`tree`), depuis le Tiled `decorations` object-layer ; tall-grass auto-placée sur chaque tuile `TallGrass` libre.
- Placement centré sur le footprint (rocher 2×2 au milieu de ses 4 tuiles), bottom-anchor descendu vers le sommet-avant de la tile (`BABYLON_DECORATION_FOOT_DROP`) → planté.
- Matériau PAR INSTANCE (pas partagé) → chaque `SpriteDepthPlugin` porte son foot-depth (sinon depth cassé). Textures cachées par type.
- Rochers/arbres : ALPHATEST + depth write (occluent) + foot-depth (`BABYLON_DECORATION_DEPTH_BIAS` = un peu plus fort que les sprites → une déco passe devant un Pokémon de la MÊME tile).
- Tall-grass : ALPHABLEND + `disableDepthWrite` (n'occulte rien, ne déclenche JAMAIS la silhouette X-ray) + `alphaIndex` (`BABYLON_GRASS_ALPHA_INDEX`) → dessinée après l'ombre.
- `directional-billboard.ts` : l'ombre au sol du Pokémon reçoit un `alphaIndex` (`BABYLON_SHADOW_ALPHA_INDEX = 0` < herbe) → l'herbe de la même tile la couvre. L'ombre garde sa profondeur géométrique (PAS de foot-depth flatten — sinon elle passerait à travers le sprite à profondeur égale).
- `load-tiled-map.ts` : expose `decorationObjects`. `combat-scene.ts` : wiring + update per-frame + dispose.
- Picking : les planes déco sont `isPickable = false` → le ray tape la tuile de terrain dessous (sol brut) → curseur/picking se pose sur la tuile sous une déco.
- Best-practices validées (agent) : approche idiomatique Babylon (`gl_FragDepth` foot-depth = seule option WebGL2 ; ALPHATEST/ALPHABLEND split correct ; matériau par instance obligatoire). Convention enregistrée : tout nouvel ALPHABLEND doit avoir un `alphaIndex` explicite.
- Nouvelles constantes `babylon-constants.ts` : `BABYLON_DECORATION_FOOT_DROP`, `BABYLON_DECORATION_DEPTH_BIAS`, `BABYLON_SHADOW_ALPHA_INDEX`, `BABYLON_GRASS_ALPHA_INDEX`.

**Reportés :**
- Tints terrain (lave/eau/eau-profonde/magma/marais/sable/neige/obstacle) → reporté polish.
- Texte flottant chute "Chute -N" / "Impact -N" → reporté Jalon 4 (overlay DOM).
- Curseur au sommet d'une déco pour un volant survolant → reporté J4 (couplé moteur).

##### 3e-Champs ✅ DONE (2026-06-10) — démo statique

**Livré :**
- `babylon-field-terrains.ts` (NOUVEAU) : `createFieldTerrains(scene, camera, worldLayer, heightAt, mapWidth, mapHeight)` → API `set(specs)/update(cssWidth,cssHeight)/dispose()`. `FieldTerrainSpec` miroir du `FieldTerrainRenderSpec` 2D (tiles, anchor, color, teamColor, remainingTurns).
- **Fill** : quads `CreateGround` par tile, blend **alpha standard 0.3** (`BABYLON_FIELD_TERRAIN_FILL_ALPHA`). Le blend additif 2D a été testé et écarté : trop violent sur les textures claires (désert/arène). `zOffset = BABYLON_TILE_HIGHLIGHT_Z_OFFSET = -2`. `alphaIndex = BABYLON_FIELD_TERRAIN_ALPHA_INDEX = 2` (au-dessus ombre 0 et herbe 1). Décision #483.
- **Périmètre** : `GreasedLine` sur les arêtes externes de la zone, largeur `BABYLON_FIELD_TERRAIN_OUTLINE_WIDTH = 0.04` world units. Tracé **insetté d'une demi-largeur vers l'intérieur** de la tile pour ne pas clipper dans les murs des tiles voisines plus hautes. Le curseur de survol (`babylon-tile-highlights.ts`) a reçu le même inset (half = 0.5 - width/2). `GreasedLine` retenu pour extensibilité future (glow, flottement animé). Décision #484.
- **Pastille compteur** : **DOM projeté** (`.field-terrain-pill`) dans `.ui-world` (`game-stage`), positionnée par frame via `projectAnchors` (`world-projection.ts`) — première utilisation réelle de cette infra (Jalon 2). 44px, bordure 5px couleur du Champ, fond couleur équipe, compteur de tours restants. Limitation assumée : la pastille DOM passe toujours devant les sprites (pas de depth 3D pour les éléments DOM) ; compensé par `opacity: 0.5`. Même traitement prévu pour les icônes murs/écrans (Jalon 4). Décision #485.
- **Démo statique** `babylon-boot.ts` : 2 zones disjointes (ancre {4,4} Champ Herbu, ancre {10,10} Champ Électrifié), Onix posé sur l'ancre Électrifié. Wiring moteur (set/update depuis événements core) = Jalon 4.
- `babylon-color.ts` (NOUVEAU) : `hexToColor3`/`hexToCss` partagés — extraction de la duplication entre `babylon-tile-highlights.ts` et `babylon-field-terrains.ts` (finding code-reviewer).
- `combat-scene.ts` : option `worldLayer` obligatoire, API `setFieldTerrains(specs)`, pattern pending/replay avant chargement map, update par frame, dispose.
- CSS : `.field-terrain-pill` dans `game-overlay.css` (custom properties runtime `--field-terrain-pill-bg/border`).

**Reportés (inchangés) :**
- Tints terrain (lave/eau/eau-profonde/magma/marais/sable/neige/obstacle) → polish.
- Texte flottant chute "Chute -N" / "Impact -N" → Jalon 4 (overlay DOM).
- Curseur au sommet d'une déco pour volant survolant → Jalon 4.
- Barrière Champ Psychique (feedback visuel d'impact anti-dash) → Jalon 4 (couplé moteur/FSM).

**Gate 3e-complet** : décorations ✅ ; Champs (fill+contour+pastille) ✅. Tints/texte chute/barrière Psychique reportés.

#### 3f — Tests + gate parité scène ✅ DONE (2026-06-10)

**Livré (sweep chrome-devtools, scène démo 12 sprites + 2 Champs) :**
- **Tests renderer** : 8 maps balayées (desert, volcano, cramped-cave, forest, swamp, toundra, naval-arena, le-mur) — rendu OK partout, zéro erreur console. `le-mur` (multi-niveaux, écartée du roster en attendant Babylon) rend correctement.
- **Picking multi-niveaux** (le-mur) : clic plateau haut + clic pied de mur → portée + anneau d'attaque sur les bonnes tiles, drapés sur les marches.
- **Occlusion** : rotation 90° → silhouettes couleur équipe derrière falaise (Onix, Léviator, Dracaufeu).
- **Champs sur relief** : fill/contour suivent les hauteurs (falaise le-mur, eau swamp, lave volcano) ; pastilles DOM projetées suivent la rotation caméra.
- **Gate 60fps PASS** : desert 59.9 fps (p95 18.0 ms), le-mur 60.3 fps, le-mur **pendant rotation caméra** (pire cas silhouettes) p95 17.9 ms / max 18.5 ms / 0 frame >20 ms.

**Reporté :**
- **Gate parité visuelle Phaser** (volcano + desert) → décision humaine : comparaison quand le combat complet sera fonctionnel (J4+). Le visuel est déjà jugé au fil de l'eau ; J3.5 pixel-art changera le look de toute façon.
- Idée exploratoire humaine : remplacer les décorations par des assets **voxel** — recherche en cours côté humain, à revoir plus tard.

### Jalon 3.5 — Pipeline pixel-art ❌ ABANDONNÉ (2026-06-10, décision humaine)
> Besoin réel clarifié en cours de route : « contrôler le crénelage des bords de blocs » (gros pixels sur les arêtes, textures/sprites intacts). 4 approches implémentées et rejetées le même jour : pipeline plein-écran RTT+NEAREST (dégrade tout), liseré baké tileset (grille partout), liserés géométriques (trait ajouté ≠ crénelage), spike crénelage contrôlé `edge-pixelate` (le plus proche, « pas mal mais ça le fait pas partout »). Verdict final : « c'est un détail, ça rend déjà super bien comme c'était » — rendu pleine résolution conservé tel quel.
> Historique complet + enseignements + piste de reprise (essai 4 + normales) : `docs/babylon/babylon-pixel-art-pipeline.md`. **Ne pas rouvrir sans décision humaine explicite.**

### Jalon 4 — Port chrome combat + interactions

> Aussi gros que J3 (~100 items, sections 1, 5, 6, 7-13, 15, 16, 17, 18). Découpé en 4 sous-jalons (4a→4d).

#### 4a — State machine de scène DOM + écrans menu (à faire)

Couvre **checklist §1 (scènes/navigation)** + **§15 (phases & orchestration)** :
- Orchestrateur FSM remplaçant `scene.launch/sleep/stop` Phaser : MainMenu → BattleMode → TeamSelect → MapSelect(+preview) → Combat → Victory → retour. Restack/resume + disposal assets entre écrans. **Diagramme de transitions écrit avant de coder** ; test chaque chemin.
- Écrans menu : MainMenu (5 boutons), BattleMode, MapSelect + preview live, Settings, Credits.
- Phases combat : placement alterné (+ auto/aléatoire, undo, sprites temporaires), transition placement→combat, `AnimationQueue` séquentielle, machine d'input (10 états), IA d'équipe (EASY seedé) + IA dummy, `onTurnReady`, events startup (météo/talents), fin combat + overlay victoire, Round-Robin ET Charge-Time.
- **Gate** : navigation complète entre écrans, placement→combat→victoire jouable, toutes transitions testées.

#### 4b — Chrome combat (panneaux UI DOM) + previews de ciblage (à faire)

Couvre **checklist §7-13** (ActionMenu, MoveTooltip, InfoPanel, TurnTimeline, BattleLog, HUD, DirectionPicker/preview dégâts) + **previews de ciblage §3 (déplacées depuis 3c)** :
- ActionMenu + sous-menu attaque (moves, type, PP/CT, tags blocage Provoc/Entrave/Encore). MoveTooltip (catégorie, puissance/précision, pattern + grille preview, tags). InfoPanel complet (adapter core→view-model, étend le démonstrateur 2b). TurnTimeline CT prédictive scrollable. BattleLog + formatter. WeatherHud, PlacementRosterPanel. DirectionPicker (orientation fin de tour + placement) + preview dégâts (overlay barre HP, range, modificateur face).
- **Previews de ciblage (depuis 3c)** : preview de cible (fill buff/attaque), preview directionnelle (Cône/Ligne/Slash/Dash selon angle souris↔caster), preview impact Blast, preview self-radius, surbrillance zones de spawn (couleur équipe), flash sprites ciblés, icônes d'aura d'équipe au survol. Ces previews dépendent du move sélectionné → FSM (4a).
- **Gate** : tous les panneaux combat fonctionnels et alignés au contrat overlay (cqw), reflow mobile.

#### 4c — Animations combat + textes flottants (à faire)

Couvre **checklist §5 (déplacements & impacts)** + **§6 (textes flottants, 30 items)** :
- Tweens déplacement le long du chemin (direction recalculée/pas), saut (Hop easing), durées différenciées, glide volant, Ghost traverse, knockback (+ bloqué = shake), glissade glace, téléportation, retraite Hit&Run, dash, annulation move. Depth recalculé à l'arrivée.
- Animations combat : direction dynamique, catégorie Contact/Shoot/Charge, enveloppe profondeur attaque.
- Textes flottants DOM i18n : dégâts/soin/immunisé/KO/efficacité (4 seuils)/raté/critique/stat ±/confus/séduit/apeuré/bloqué/×N coups/recharge/chute/impact mur/terrain/météo/KO terrain/talent/objet/charge/aura posée-cassée-bloquée/Substitut/Provoc-Entrave-Encore. File par cible + stagger.
- **Gate** : un combat complet rejoue toutes les animations + textes flottants sans superposition.

#### 4d — Écrans DOM hors-combat (Team Builder, Team Select, Sandbox) (à faire)

Couvre **checklist §16, §17, §18** :
- Team Builder complet (wire réel au-delà du placeholder 2c) : MyTeams, éditeur (slots, pickers Pokemon/move/objet, talent, nature, stats/presets, Set OP, import/export Showdown, persistance localStorage).
- Team Select : format picker, colonnes joueurs, toggle Humain/IA, liste équipes, footer (placement auto, CT/RR, lancer), préchargement sprites engagés.
- Sandbox Studio (panneaux joueur/dummy, bande combat, export/import JSON, reset sans reload) — partie outil-dev, peut déborder J5.
- **Gate** : créer une équipe, l'assigner, lancer un combat depuis l'UI bout-en-bout.

### Jalon 5 — Nettoyage Phaser + parité finale + merge
- Suppression totale Phaser (deps + code). `grep -ri phaser packages/` = 0 + `pnpm why phaser` = absent (deps transitives).
- Audit bundle (`rollup-plugin-visualizer`), cible ≤ 220 kB gzip.
- Shim type Inspector → tester `skipLibCheck: false` (devDep + import dynamique).
- Validation visuelle finale humaine sur tous les écrans + mobile.
- **Gate final** : DoD §2 complète → merge `--ff-only` sur main.

### Matrice de couverture parité (checklist `119-parity-checklist.md` → jalons)

> **Garantie anti-oubli** : chaque section de la checklist (307 items + Champs) est assignée à un jalon. Un item sans jalon = trou. Le gate de chaque jalon vérifie ses sections. À parité finale, les 307 cases sont cochées.

| # | Section checklist (items) | Jalon(s) | Statut |
|---|---------------------------|----------|--------|
| 1 | Scènes & navigation (24) | J4 (FSM scènes/menus) + J5 (LoadingScene/preload) | ⬜ |
| 2 | Terrain / grille / hauteurs (20) | **3a** (extrusion, types, hauteurs, occlusion ✅) + **3e-déco** (décorations, tall-grass ✅) + **3e-reste** (tints — reporté polish) | 🟦 partiel |
| 3 | Curseur / surbrillances / previews (16) | **3b** (surbrillances portée ✅) + **3c** (curseur FFTA ✅) + **J4b** (previews ciblage — déplacées : dépendent move sélectionné/FSM) | 🟦 partiel |
| 4 | Sprites & animations (30) | **3a** (ombre/offsets/scale/billboard ✅) + **3d** (anims looping/one-shot/resting/FlyingIdle synthèse/glide/pulse/flash/KO/semi-invul ✅ partiel) + **J4** (HP bar, statuts, indicateurs) + **pass 3D-depth** (wobble, attaque-depth, substitut) | 🟦 partiel |
| 5 | Déplacements & impacts (13) | **J4** (tweens combat-event : knockback, ice-slide, dash, hop path) | ⬜ |
| 6 | Textes flottants combat (30) | **J4** (BattleText DOM) | ⬜ |
| 7 | ActionMenu & sous-menus (12) | **J4** | ⬜ |
| 8 | MoveTooltip (8) | **J4** | ⬜ |
| 9 | InfoPanel (11) | **J4** (démonstrateur DOM livré 2b) | 🟦 partiel |
| 10 | TurnTimeline CT (12) | **J4** | ⬜ |
| 11 | BattleLog (10) | **J4** | ⬜ |
| 12 | Autres HUD (5) | **J4** | ⬜ |
| 13 | DirectionPicker & preview dégâts (8) | **J4** | ⬜ |
| 14 | Caméra & input (17) | **3a** (zoom/pan/rotation/bounds ✅) + **3b** (picking ray-cast ✅, Alt écarté → rotation caméra) + **J4** (Échap/Espace/undo contextuels) | 🟦 partiel |
| 15 | Phases & orchestration (18) | **J4** (FSM scènes, placement, IA tour) | ⬜ |
| 16 | Team Builder (19) | **J4** (placeholder contrat livré 2c) | 🟦 partiel |
| 17 | Team Select (9) | **J4** | ⬜ |
| 18 | Sandbox Studio (9) | **J4** + **J5** | ⬜ |
| 19 | Loading / FOUC / i18n / settings / analytics (12) | **J5** (boot final) | ⬜ |
| 20 | Edge-cases & détails (24) | **réparti** — chaque edge-case suit la feature qui le porte (3a-f / J4 / J5) | 🟦 partiel |
| — | **🆕 Rendu Champs** (~5, hors checklist d'origine) | **3e** | 🟦 partiel (fill+contour+pastille ✅ ; barrière Psychique → J4) |
| — | Pipeline pixel-art (transverse) | **J3.5** | ❌ abandonné (2026-06-10 — rendu full-res conservé, décision humaine) |
| — | Gate 60fps (transverse) | **3f** | ✅ (2026-06-10 — 60 fps verrouillé, pire cas rotation+silhouettes 0 frame >20 ms) |

**Lecture** : Jalon 3 (scène combat) = sections **2, 3, 4, 14** (+ Champs §3e). Jalon 4 (chrome + interactions) = sections **1, 5, 6, 7-13, 15, 16, 17, 18**. Jalon 5 (nettoyage) = section **19** + suppression Phaser. Section **20** transverse. À chaque sous-jalon livré, cocher les items correspondants dans `119-parity-checklist.md`.

## 6. Réutilisation spike 063

`packages/renderer-babylon-spike/` (commit `706e638`, branche `plan-063-babylon-spike`) :
- `terrain-extruder.ts` (83 l.), `directional-billboard.ts` (212 l.), `load-tiled-map.ts` (60 l.), `hud.ts` (115 l.), `main.ts` (184 l.).
- Deps : `@babylonjs/core ^8`, `/gui`, `/loaders`, `/materials ^8.56.2`, `/inspector`.
- ⚠️ Branche très en retard sur main → extraire les fichiers, pas merger la branche.

## 7. Risques & points à valider

- **Perf projection 60fps** (cat. A, N éléments DOM transformés/frame) — mesurer tôt (jalon 2). Fallback : throttle ou batch.
- **Bundle Babylon** — deep imports + omission side-effects. Inspector en devDep + import dynamique uniquement.
- **Pixel-art net** — `hardwareScalingLevel=1` + NEAREST + assets PMDCollab, pas de downsampling global.
- **Occlusion** — terrain + sprites sur `renderingGroupId=0` obligatoire.
- **ShaderMaterial flat-shading custom** (cohérence FFTA, gain bundle) — à valider jalon 3, sinon `StandardMaterial` sans lumière.

**Hors scope (clarifications) :**
- **Audio** : aucun son dans le jeu actuel (Phase 9 « Son / Musique »). Rien à migrer. Quand ajouté → Web Audio API natif, découplé de Babylon.
- **Herbes hautes animées** : bonus, reportable Phase 6. ~~Rotation caméra 4 angles~~ : livrée en Jalon 3a.
- **Format map 3D custom / éditeur in-game** : Phase 6.

## 8. Gates CI

- Gate CI standard à chaque jalon (`pnpm build && lint:fix && typecheck && test && test:integration`).
- `core-guardian` à chaque jalon touchant le rendu (vérifie découplage core).
- Pas de merge main avant DoD complète + validation visuelle humaine.

## 9. Paramètres figés (validés 2026-06-08)

- [x] **Emplacement code** : `packages/renderer/src/babylon/` — cohabite avec Phaser pendant la migration, réutilise assets/config/vite. Suppression Phaser au jalon 5.
- [x] **Résolution design de référence** : **1920×1080** (base de `--ui-scale`). Mobile géré par breakpoint séparé (reflow).
- [x] **Map de référence parité** : **volcano** (hauteurs variées + tiles lave → teste extrusion hauteur + type terrain liquide + occlusion).
