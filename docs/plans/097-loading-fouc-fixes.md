# Plan 097 — Loading screens + FOUC fixes

> Statut : **done**
> Créé : 2026-05-24
> Reviewed : 2026-05-24 (plan-reviewer : ready avec fixes lifecycle appliqués)
> Livré : 2026-05-24 (gate CI : 1616 unit + 220 intégration + build + lint + typecheck verts)
> Auteur : Claude
> Lié à : backlog playtest itch.io 2026-05-23 (2 bugs) + observation MapSelect preview noire 2026-05-19 (partial fix)

## Objectif

Éliminer 3 bugs de chargement remontés au playtest itch.io + un troisième sur MapSelect preview. Mettre en place un système de loading screen cohérent avec le design system (Pokemon-themed), réutilisable au boot + en combat + en preview map.

1. **FOUC font menu** : font Pokemon Emerald Pro charge après render → fallback `monospace` plus large → "Constructeur d'équipe" déborde des boutons.
2. **Écran noir combat** : `BattleScene.preload()` charge les 80 sprites Pokemon (~30 Mo / 502 PNG) au lancement → Phaser bloque `create()` sans progress visible.
3. **MapSelect preview noire** : tileset + map JSON chargés à la sélection → flash noir bref.

But : zéro flash visuel, progress bar honnête (X/Y fichiers), tips rotatifs gameplay pour combats, plus de "Constructeur d'équipe" qui déborde.

## Pourquoi maintenant

- Plan 096 itch.io live → exposition publique du jeu → première impression critique.
- 2 retours playtest itch directs (cold visite déçoivante).
- Pattern loader réutilisable utile pour features futures (Babylon 3.5, replays, multi).
- `document.fonts.ready` déjà utilisé une fois (`MapPreviewUIScene.ts:14`) → infra partielle existe.
- `preloadPokemonAssets` + `preloadPortraitsOnly` (`SpriteLoader.ts:39,46`) existent → split cold path UI / lourd combat évident.

## Hors scope

- Service worker / PWA offline cache (gros chantier, gain marginal vs preload tags).
- Re-encoding sprites en atlas géant (split actuel acceptable, plan séparé si butée 1 000 files itch).
- Animations entrée scènes (fade-in après loader). Limité à fade-out loader + cut scène.
- Sons UI (clic loader, ambiance). Audio backlog séparé.

## Décisions tranchées (humain)

| Décision | Choix |
|----------|-------|
| Sprite loading combat | **Lazy strict** (N mons engagés seulement, N = somme `team.slots[]` toutes équipes). Cache Phaser auto (`textures.exists` skip). |
| Style loader | **Progress bar simple** (pas de pokeball pour l'instant — polish visuel reporté). |
| Label loader combat | **`24 / 48 fichiers chargés`** via `loader.totalFiles - loader.pendingFiles` (pas de nom Pokemon). |
| Tips combat | **Activés** (loading 30 Mo = 3-5s sur cold itch, espace mental dispo). |
| MapSelect loader | **Fade CSS 150 ms** (load tileset léger, pas de scene Phaser dédiée). |
| BootScene | **Phaser scene dédiée** (vs DOM splash) — minimal : fonts + UI critique seulement, **pas de portraits**. |
| Portraits Pokemon | **Lazy par scène** (MyTeamsScene/TeamEditScene/MapSelect chargent à l'entrée). Cache survit cross-scenes. |
| Multi-joueur | **Même loader scale auto**. 12v1 = 13 mons engagés ≈ 52 fichiers. Cache gère duplicates. |
| Font strategy | **`font-display: block`** + **`<link rel="preload" crossorigin="anonymous">`** + **`await document.fonts.ready`** dans BootScene. |

## Best-practices appliquées (agent best-practices 2026-05-24)

- Pattern Phaser canonique **BootScene → MenuScene** (doc officielle Phaser confirme 2026).
- **`crossorigin="anonymous"` obligatoire** sur `<link rel="preload" as="font">` — sinon double fetch (preload ignoré). Gotcha le plus fréquent MDN.
- `font-display: block` préféré à `swap` pour pixel-art game UI (layout calibré font cible, FOIT court < layout shift).
- **DOM overlay vs Phaser scene** : BootScene = scene (avant Phaser ready, splash CSS minimal `index.html`). BattleLoading = scene Phaser parallèle `scene.launch()`. MapSelect = DOM fade.
- itch.io iframe crossorigin + CDN cold cache (hwcdn → nouveau domaine 2024) → preload encore plus critique vs Pages.

## Pré-requis humain — BLOQUANTS

- **Confirmer/uploader fonts** : `pokemon-emerald-pro.woff2` + `.ttf` référencées `index.html:12` mais introuvables `find` repo (gitignored ?). **Plan Étape 1 bloqué si paths invalides.** Humain doit confirmer location ou uploader.

## Étapes

### Étape 1 — Fix immédiat FOUC font (5 min, isolé)

**Objectif** : fix le plus visible des 3 bugs avant tout refacto.

`packages/renderer/index.html` :

```html
<!-- avant </head> -->
<link rel="preload" as="font" href="/assets/fonts/pokemon-emerald-pro.woff2" type="font/woff2" crossorigin="anonymous">
```

Changer `font-display: swap` → `font-display: block` dans `@font-face`.

**Test** : Hard refresh (`Ctrl+Shift+R`), DevTools Network throttle "Slow 3G", vérifier menu sans débord boutons.

**Validation** : déployable seul si urgence, indépendant du reste du plan.

### Étape 2 — Composant `LoadingOverlay` Phaser réutilisable

Nouveau fichier `packages/renderer/src/ui/LoadingOverlay.ts` :

```ts
export class LoadingOverlay {
  constructor(scene: Phaser.Scene, options: LoadingOverlayOptions);
  bindToLoader(loader: Phaser.Loader.LoaderPlugin): void;  // events: progress, fileprogress, complete
  setLabel(text: string): void;
  setTip(text: string | null): void;
  fadeOut(durationMs?: number): Promise<void>;
  destroy(): void;
}

interface LoadingOverlayOptions {
  showTips: boolean;        // false pour BootScene, true combat
  tipRotationMs?: number;   // default 3000
  language: SupportedLanguage;
}
```

Composants visuels (constantes `constants.ts` à ajouter) :

- `LOADING_OVERLAY_DEPTH = 5000` (au-dessus de tout)
- Progress bar `240 × 16 px`, fill `COLOR_HP_HIGH`, border `2 px COLOR_UI_BORDER`
- Label + tip : font `FONT_FAMILY`, taille body
- Tip icône `💡` (texte glyph Unicode, pas d'asset à créer)
- Background overlay : opaque `BACKGROUND_COLOR` (cache scène derrière pendant loading)

**Note polish** : pokeball spinning **reportée**. V1 = progress bar simple. Si UX jugée trop austère post-impl, ajouter asset dans plan séparé.

`bindToLoader` :
- `loader.on("progress", (value: number) => updateBar(value))`
- `loader.on("fileprogress", () => updateLabel(`${loaded}/${total} fichiers chargés`))`
- `loader.on("complete", () => emit `ready` event)`

### Étape 3 — Tips i18n + selector

Nouveau `packages/renderer/src/i18n/loading-tips.ts` :

```ts
export interface LoadingTip { id: string; category: "mechanic" | "strategy" | "lore"; }
export const LOADING_TIPS: LoadingTip[] = [
  { id: "facing-bonus", category: "mechanic" },
  { id: "terrain-effects", category: "mechanic" },
  { id: "height-damage", category: "mechanic" },
  { id: "weather-water-fire", category: "lore" },
  { id: "reflect-protection", category: "strategy" },
  { id: "brick-break", category: "strategy" },
  { id: "undo-movement", category: "mechanic" },
  { id: "ct-system", category: "mechanic" },
];

export function pickRandomTip(rng: Prng, lastShownIds: string[]): LoadingTip;
```

i18n FR/EN 8 clés × 2 langues (`loadingTip.facing-bonus`, etc.).

**Tips FR validés (humain 2026-05-24)** :

| ID | FR |
|----|----|
| facing-bonus | Frapper de dos inflige +15% de dégâts. Position-toi derrière l'ennemi. |
| terrain-effects | Le terrain affecte les déplacements : magma brûle, marécage ralentit, glace fait glisser. |
| height-damage | Frapper en hauteur : +10% de dégâts par niveau d'écart (max +50%). |
| weather-water-fire | Sous Pluie, les attaques Eau gagnent ×1.5 et les Feu ×0.5. |
| reflect-protection | Protection réduit ×0.5 les dégâts physiques autour du lanceur (rayon 3). |
| brick-break | Casse-Brique brise les barrières du lanceur et ignore leur protection. |
| undo-movement | Annule ton déplacement tant que tu n'as pas attaqué. |
| ct-system | Le CT détermine l'ordre des tours. Vitesse haute = tours plus fréquents. |

Noms moves canon vérifiés source `packages/data/src/i18n/moves.fr.json` :
- `reflect` → **Protection** (≠ Reflet qui est double-team)
- `brick-break` → **Casse-Brique**

### Étape 4 — BootScene Phaser dédiée (minimal)

Nouveau `packages/renderer/src/scenes/BootScene.ts` :

```ts
export class BootScene extends Phaser.Scene {
  constructor() { super("BootScene"); }
  preload(): void {
    // Strict minimum visuel pour le splash. Pas de portraits (lazy par scène).
    // UI critique seulement : tileset terrain commun, types/categories, status icons,
    // weather icons, cursor. Tout ce qui est partagé cross-scenes.
  }
  async create(): Promise<void> {
    const overlay = new LoadingOverlay(this, { showTips: false, language: getCurrentLanguage() });
    overlay.setLabel(t("loading.boot"));

    // 1. Attendre fonts (FOUC mitigation)
    await document.fonts.ready;

    // 2. Pré-charger UI shared seulement (pas de portraits)
    preloadSharedUiAssets(this);
    overlay.bindToLoader(this.load);
    this.load.start();
    await once(this.load, "complete");

    // 3. Fade + transition vers menu
    await overlay.fadeOut(200);
    this.scene.start("MainMenuScene");
  }
}
```

`main.ts` : BootScene en première position dans `scene[]` array, devient scene de démarrage automatique.

**Portraits Pokemon = lazy par scène** :
- `MyTeamsScene.preload()` : `preloadPortraitsOnly(this, allPlayableIds)` au début (~80 portraits, ~640 Ko, < 1s warm)
- `TeamEditScene.preload()` : idem (cache hit après MyTeams)
- `MapSelectScene` : pas de portraits requis (seulement maps).
- `BattleScene` : pas de portraits requis (sprites atlas suffisent).

**Métriques boot estimées** : font (~50-100 Ko) + UI shared (~200 Ko types/categories/status/weather/tileset terrain) = **~300 Ko**, boot < 1s warm, ~2s cold itch.

### Étape 5 — `BattleLoadingScene` parallèle à `BattleScene` (refactor lifecycle)

**⚠️ Phaser lifecycle = `init(data) → preload() → create()`**. `data` n'est accessible qu'à partir de `init()`. **Impossible** de récupérer `teamSelection` dans `preload()` directement.

**Stratégie révisée** :

`BattleScene.preload()` refactor :
- **Drop** `preloadPokemonAssets(allDefinitionIds)` (ne charge plus 80 mons).
- Charge seulement les assets non-Pokemon (arrows, types, categories, weather, cursors, status icons, tileset) — déjà fait, garder.
- Tileset terrain peut être bougé dans BootScene si chargé partout.

`BattleScene.init(data)` :
- Stocke `this.teamSelectData = data.teamSelectResult` (et autres params).

`BattleScene.create()` :
- `this.scene.launch("BattleLoadingScene")`.
- Computes `engagedPokemonIds` depuis `teamSelectData.teams[].slots[].pokemonId` (dédupliqué).
- `preloadPokemonAssets(this, engagedPokemonIds.map(id => ({ definitionId: id })))`.
- `this.load.once("complete", () => this.startBattleProper())`.
- `this.load.start()`.
- Sandbox mode fallback : si pas de `teamSelectData` (e.g. sandbox config JSON), fallback charge mons depuis `sandboxConfig.player.pokemonIds + sandboxConfig.dummy.pokemonId`.

Nouveau `packages/renderer/src/scenes/BattleLoadingScene.ts` :

```ts
export class BattleLoadingScene extends Phaser.Scene {
  constructor() { super("BattleLoadingScene"); }
  create(): void {
    const battleScene = this.scene.get("BattleScene") as BattleScene;
    const overlay = new LoadingOverlay(this, {
      showTips: true,
      tipRotationMs: 3000,
      language: getCurrentLanguage(),
    });
    overlay.bindToLoader(battleScene.load);
    battleScene.load.once("complete", async () => {
      await overlay.fadeOut(200);
      this.scene.stop("BattleLoadingScene");
    });
  }
}
```

**Cache hit (équipe répétée)** : `loader.totalFiles === 0` → `complete` fire immédiatement → loader skip naturel sans flash perceptible.

**Multi-joueur (12v1, 4v4v4)** : `engagedPokemonIds` agrégé sur toutes les équipes. Set dédupliqué (si même mon dans plusieurs équipes hot-seat). Cache scale auto.

**Race condition replay** : `runReplay` doit attendre `load.complete` avant `submitAction`. Vérifier `BattleScene.create()` séquentiel : preload → wait complete → start replay.

### Étape 6 — Fix MapSelect preview (fade CSS)

**Articulation** : MapSelectPreviewScene scène **indépendante** de BattleScene. Ne lance pas BattleLoadingScene. Charges légers (tileset déjà cached après BootScene + map JSON ~10 Ko).

`MapSelectPreviewScene.ts` :
- Ajouter overlay DOM `<div class="map-preview-fade">` enfant du conteneur Phaser canvas, opacity 1 par défaut.
- À `setCurrentMap(url)` : opacity 1 → load tileset + JSON → `Promise.all([loaderComplete, sceneCreate])` → opacity 0 transition 150 ms.
- CSS dans `styles/components/map-select.css` : `transition: opacity 150ms ease-out`.

Pas de loader Phaser ni tips (load < 200 ms, intrusif inutile).

### Étape 7 — Pré-impl checks + cleanup

- Vérifier que `BattleScene.preload()` ne dépende plus de `allDefinitionIds` ailleurs (search refs).
- Smoke test flow complet : Boot → Menu → MapSelect → TeamSelect → BattleSetup → Battle → fin → retour Menu (cache portraits OK).
- DevTools Network throttle "Slow 3G" + cold cache (`Disable cache` cocheé) → vérifier que :
  - Boot : font load complete avant menu visible.
  - Combat 1er : ~12 sprites téléchargés (pas 80).
  - Combat 2e même équipe : `loader.totalFiles === 0` (cache hit instantané).
  - MapSelect : fade fluide, pas de flash noir.

### Étape 8 — Tests

- **Unit** (`packages/renderer/src/i18n/loading-tips.test.ts`) :
  - `pickRandomTip` ne répète pas immédiatement (lastShownIds).
  - 8 tips × 2 langues, toutes les clés résolvent.
- **Unit** (`packages/renderer/src/scenes/BattleScene.engaged-ids.test.ts`) :
  - `extractEngagedPokemonIds(teamSelectData)` dédupliqué 1v1 / 12v1 / sandbox.
- **Integration smoke** (Playwright via visual-tester) :
  - Boot → menu visible sans débord boutons (regression FOUC).
  - Lancer combat 1v1 → BattleLoadingScene visible, progress bar avance, complete sans erreur, ~12 fichiers chargés.
  - 2e combat même équipe → loader skip ou très court (< 100 ms).
  - Combat 12v1 → loader scale (~52 fichiers), progress bar atteint 100%.
  - Sandbox mode → loader fonctionne avec fallback sandboxConfig.
  - Replay → pas de race condition (replay attend load complete).
  - Fenêtre redimensionnée pendant loading → overlay reste centré (CSS responsive ou Phaser re-center).

## Découpage commits

1. `fix(renderer): preload font + font-display block to kill FOUC` (étape 1 seule, déployable).
2. `feat(renderer): LoadingOverlay component + BootScene` (étapes 2-4).
3. `feat(renderer): BattleLoadingScene + lazy sprite loading` (étape 5).
4. `fix(renderer): MapSelect preview fade transition` (étape 6).
5. `test(renderer): loading tips + boot/battle loader smoke` (étape 8).

## Risques

- **Font path incorrect** (`pokemon-emerald-pro.woff2` introuvable repo) → Étape 1 bloquée. Mitigation : confirmer humain pre-impl.
- **`teamSelection` accessible dans `BattleScene.preload()`** ? Vérifier que `init(data)` reçoit bien les équipes avant `preload()` (Phaser lifecycle : `init` → `preload` → `create`).
- **Sandbox mode** : pas de `teamSelection` classique. Mitigation : fallback `preloadPokemonAssets(allPlayableIds)` en sandbox, lazy seulement en mode normal.
- **Replay déterministe** : si replay charge mons dynamiquement, vérifier pas de race condition loader vs `runReplay`.
- **Cold cache itch test** : difficile à reproduire localement (cache navigateur trop chaud). Mitigation : DevTools `Disable cache` + Network throttle, ou tester directement sur prod itch URL.

## Métriques de succès

- Plus de FOUC visible sur cold load itch.io (vérifié manuel sur prod).
- BattleScene cold load : `totalFiles` mesuré ≤ 60 (12 mons × ~4 fichiers + UI résiduelle), vs ~330 actuels (80 mons × 4 + UI).
- Temps moyen "click Launch → première frame combat" : < 3 s cold, < 500 ms warm (cache).
- Aucun écran noir > 200 ms sur boot, combat, mapselect.

## Suite (hors plan)

- Audio loader (sons UI / musique) : pattern identique à étendre quand audio arrive.
- Service worker offline cache : à étudier si retours playtest = "loading toujours trop long".
- Sprite atlas géant (compaction 502 PNG → 1-2 atlas) : si butée 1 000 files itch atteinte.
