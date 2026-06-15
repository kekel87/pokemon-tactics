# Plan 126 — Extraction max logique hors renderer

**Statut : TERMINÉ (A–F) + revue archi/renommage paquets (2026-06-15) + retrait `render-three` (2026-06-15). Reste : merge `--ff-only` worktree → main (attente GO humain)**
**Branche : phase5-babylon**
**Suite de : plan 125 (découpage renderer), POC render-three validé**

## But

Sortir le **maximum** de logique engine-agnostic hors des renderers, pour qu'un futur
changement/essai de moteur soit le moins cher possible. Le POC render-three a servi à
**révéler** ce qui restait dupliqué après la migration Phaser→Babylon. On cash maintenant
ces extractions.

## Principe de sécurité — render-three = harnais de test (retiré)

`render-three` a servi de filet de sécurité pendant toute l'extraction : chaque hoist
devait laisser babylon ET three compiler + tourner, prouvant l'agnosticité. Mission
accomplie — le package est **retiré** (décision #508, 2026-06-15). La route `?engine=three`
est supprimée. Le seam reste : `RendererBackend` + `getRendererBackend()` dans
`packages/app/src/renderer-backend.ts`.

## Décision structure (validée humain)

Canvas2D (barres PV, badge Champ, texte) **ne rentre pas dans `presentation`** (headless,
`lib: ["ES2022","WebWorker"]`, pas de DOM). → **nouveau package `render-shared`** côté
navigateur (lib DOM), pour le dessin Canvas2D partagé. `presentation` reste headless.

## Lots

### Lot A — gains nets, risque ~nul ✅
- [x] A1 `floating-text-spawner` → `presentation` (interface `FloatingTextSink` structurelle).
      Sorti aussi du backend `RendererBackend` (logique agnostique, combat-screen l'appelle direct).
- [x] A2 Table rotation flèches direction + constantes → `presentation/direction-arrow-layout.ts`
- [ ] A3 Types render-surface → `renderer-contract` — **reporté** (regroupé avec F).

### Lot B — la grosse pièce (tests requis) ✅
- [x] B1 `PmdAnimationController` → `presentation` : machine à états anim sprite
      (frame loop, one-shot→resting, flying-glide, atlas indexing, pulse/flash/wobble,
      tint RGB). Les 2 billboards = coquilles qui écrivent les scalaires du controller.
      ~400 l. dédupliquées. 11 tests unitaires state machine (KO/Faint/one-shot/fallback).

### Lot C — calcul pur, risque moyen ✅
- [x] C1 `view-geometry` → `presentation` : `tileBodyHeight`, `gridToWorldXZ(handedness)`,
      `tileTopCenter`. Param `Handedness` explicite + 5 tests (piège miroir LH/RH).
- [x] C2 `decoration-layout` → `presentation` : `planDecorations` (scan herbe haute,
      footprint, occupation). Les 2 `decorations.ts` itèrent le plan partagé.
- [x] C3 `fieldTerrainBorderSegment` + réutilise `fieldTerrainBorderEdges` pour les
      contours de portée dans les 2 `tile-highlights` (supprime la 3e copie inline).

### Lot D — package render-shared (Canvas2D) ✅
- [x] D1 Package `render-shared` créé (lib DOM, consommé en source)
- [x] D2 `hp-bar-canvas.ts` (drawHpBar + roundRectPath) — 2 renderers branchés
- [x] D3 `champ-pill-canvas.ts` (drawChampPillBadge) — 2 renderers branchés
- [x] D4 `text-plane-canvas.ts` (measureTextPlane + drawTextGlyphs) — 2 renderers branchés

### Lot E — constantes mutualisées ✅
- [x] E1 ~55 tunables monde + palette + HUD → `presentation/constants.ts` (source unique).
      Chaque renderer ré-exporte (Babylon sous alias `BABYLON_*`) → call sites inchangés.
      Engine-specific gardés locaux : alphaIndex/rendering groups (babylon) vs renderOrder
      (three), clear-color shape, near/far, palette highlights, z-offset mécanisme.

### Lot F — leak archi ✅
- [x] F1 Contrat `CombatScene`/`CombatPokemonHandle`/`CombatSceneSpawn`/`TilePick`/
      `DirectionPicker*` + types render-surface (`TileHighlightPosition`, `SpawnZoneHighlight`,
      `FieldTerrainSpec`, `DamageEstimateView`, `AuraIndicatorSpec`) → `renderer-contract/combat-scene.ts`.
      Les 2 renderers ré-exportent + implémentent ; l'app-shell (combat-screen, placement-flow)
      importe du contrat, plus de render-babylon. `CombatSceneOptions` (canvas DOM) reste par
      renderer → contrat DOM-free préservé.
- [x] F2 `renderer-backend.ts` déplacé `renderer/src/babylon/` → `renderer/src/` (chemin neutre).
- [x] F3 `placement-flow.ts` importe le contrat neutre (plus de render-babylon). `map-select-screen`
      utilise `createMapPreviewStage` (preview babylon-only, hors contrat combat) — inchangé.
- [x] F4 `RenderBackend` (renderer-contract) **n'est pas mort** : contrat lifecycle étendu par
      `GameStage` (ui-dom) + `ThreeStage` (render-three). Aucune action.

## Revue archi finale (best-practices, 2026-06-15)

Pattern confirmé : Hexagonal/Ports&Adapters + Humble Object + Dependency Inversion,
correctement appliqués. Déviations mineures justifiées. Action prise : renommage paquets
(friction de reprise) + 1 fix de smell.

### Renommages appliqués (cohérence `<type>-<tech>`)
- `renderer-contract` → `render-ports` (terme hexagonal + aligne préfixe `render-*`)
- `presentation` → `view-core` (lève le faux-ami « presentation layer » = UI ; ici view-logic headless)
- `render-shared` → `render-canvas2d` (précise techno/contrainte DOM au lieu de « shared » vague)
- `renderer` → `app` (c'est le composition root Vite, pas un renderer ; reste dans `packages/`)
- Inchangés (déjà conformes) : `core`, `data`, `render-babylon`, `ui-dom`

### Smell corrigé
- `SemiInvulnerableDisplay` sorti du contrat de rendu → `core/types/semi-invulnerable-display.ts`
  (bucket display de `SemiInvulnerableState`). `render-ports` le ré-exporte (surface stable),
  le controller pur (`pmd-animation-controller`) l'importe désormais de `core` → plus de
  couplage logique-pure → contrat de rendu.

### Smells à surveiller (consignés, pas traités — acceptables projet 1 dev)
- **`BoardView` ~59 l. (render-ports/ports.ts)** : port fourre-tout latent. Parade si friction :
  ISP → `BoardMovementPort` / `BoardHudPort` / `BoardPickerPort`. Signal d'alerte : une méthode
  implémentée par Babylon mais jamais Three = leak d'un détail adapter dans le port.
- **`view-core` god-package latent** (8 responsabilités : anim, géométrie, orchestration, IA,
  déco, tilemap, floating text, sandbox). Split en sous-dossiers d'abord si point de friction.
- **`render-canvas2d` standalone** : sain tant que strictement « peintres Canvas2D purs ».
  Ne pas le laisser dériver en `utils/`.
- **`app` (ex `renderer`) idéalement dans `apps/`** (convention Nx/Turborepo entry-point vs lib).
  Déplacement structurel reporté (blast radius CI deploy) — `docs/next.md` si on y revient.

### Smells parité Three — clos par le retrait
Les gaps de parité du POC (Three `setActive` flèches pendant load async, `setAttacking`
no-op) disparaissent avec le retrait de `render-three` (décision #508). Plus d'objet.

## Gate
Gate CI complète (build + lint + typecheck + test + test:integration) avant commit.
Test humain visuel Babylon (seul moteur) à la fin.
