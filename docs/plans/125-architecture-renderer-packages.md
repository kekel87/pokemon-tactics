# Plan 125 — Architecture renderer : découpage en packages + contrat de rendu

> **Statut : `done` (impl)** — 2026-06-14. Phases 0→5 implémentées, gate complet vert (typecheck ×7, biome, unit 2654, integ 251, build). 6 packages : `core`, `data`, `renderer-contract`, `presentation`, `render-babylon`, `ui-dom` + app-shell `renderer`. **Reste** : recette visuelle humaine + co-location CSS différée (cosmétique) + sync fin doc (architecture.md arbre de structure, STATUS.md). Détail par phase dans « 🔖 État / reprise » ci-dessous.
>
> Objectif : rendre un futur changement de moteur de rendu **mécanique** (et non douloureux/aléatoire comme la migration Phaser→Babylon), en formalisant la frontière agnostique/moteur déjà présente mais implicite. Extraire l'UI HTML dans un package réutilisable.
>
> Issu de 5 audits parallèles (fuite logique→core, duplication Phaser/Babylon, périmètre extraction UI DOM, best-practices abstraction renderer, inventaire GameController→agnostique).
>
> Plans liés : [`124-parity-recette-lot3.md`](124-parity-recette-lot3.md) (recette parité, base de validation comportementale), [`119-phase5-babylon-master.md`](119-phase5-babylon-master.md).
>
> **Légende statut** : `[ ]` à traiter · `[~]` en cours · `[x]` fait+validé · `[–]` écarté.

---

## Décisions verrouillées (humain, 2026-06-13)

1. **Découpage complet en 4 nouveaux packages** : `presentation`, `renderer-contract`, `render-babylon`, `ui-dom`.
2. **Conformance test suite = cœur** : suite de tests partagée qu'un backend doit passer. C'est la recette de parité automatisée.
3. **Phaser d'abord** : supprimer Phaser (Jalon 5) AVANT le découpage, pour ne pas refactorer du code condamné. Dé-risqué par l'audit GameController (cf. ci-dessous).
4. **i18n par injection (DI)** : `presentation` et `ui-dom` restent purs (zéro dep i18n) ; ils reçoivent une fonction `translate(key, params?)` injectée par l'app-shell `renderer` au boot. Pas d'i18n dans core, pas de package i18n dédié.
5. **Ports impératifs conservés (PAS de `RenderEvent` union)** : on garde l'archi existante — l'orchestrator traduit les `BattleEvent` du core en appels impératifs sur `BoardView` (`board.moveAlongPath`, `board.playAttack`, `board.flashDamage`…). C'est déjà du Humble Object, déjà testé, zéro réécriture du câblage. Le contrat = les 3 ports + types view-models. Pas de nouvelle couche d'événements déclaratifs.

---

## 🔖 État / reprise (nuit → matin 2026-06-14)

**Fait + vert + committé** (dédié, amend de `1f70c8a`, séparé du squash migration `4dee9f9`) :
- **Phase 0** — Phaser supprimé.
- **Phase 1** — package `renderer-contract` (ports + view-models + `PresentationContext`).
- **Phase 2a** — DI **in place** : `battle-orchestrator` + `battle-views` découplés d'i18n/settings/portraits via `PresentationContext` (`{ translate, getLanguage, getPortraitUrl, isDamagePreviewEnabled }`). Injecté au seul site de construction (`runBattle` dans `combat-screen.ts`) + 2 tests (`battle-orchestrator.test`, `battle-views.test`). Gate complet vert (2654 + 251).

**Décision humaine constantes (2026-06-14)** : domaine présentation (couleurs Champs, symboles aura/charge, délai texte) → dans `presentation` ; partagé (TEAM_COLORS/getTeamColor) → dans `renderer-contract`.
✅ **Déjà fait** : `TEAM_COLORS` + `teamColorByIndex` + `getTeamColorByPlayerId` déplacés dans `renderer-contract/src/team-colors.ts` ; `renderer/constants.ts` les re-exporte (importeurs renderer inchangés). Gate vert.

✅ **Phase 2b FAIT (2026-06-14)** : package `@pokemon-tactic/presentation` créé (deps core/data/renderer-contract, `tsconfig` lib `["ES2022","WebWorker"]` → timers sans surface DOM, garde la pureté). Déplacés dedans : `battle-orchestrator(.test)`, `battle-views(.test)`, `floating-text-content(.test)`, `movement-animation(.test)`, `AnimationQueue`, `BattleSetup`, `SandboxSetup(.test)`, `AiTeamController(.test)`, `DummyAiController(.test)`, `constants.ts` (couleurs Champs + symboles aura/charge + durées tween + cluster BATTLE_TEXT), `sandbox-config.ts` (SandboxConfig). `floating-text-content` DI-découplé d'i18n (`translate`/`getLanguage` ajoutés à `FloatingTextContext`). `renderer/constants.ts` re-exporte les constantes presentation (sites babylon `../constants.js` inchangés) ; `renderer/types/SandboxConfig.ts` re-exporte. Imports renderer → `@pokemon-tactic/presentation`. Pureté vérifiée (seulement core/data/renderer-contract). Gate complet vert (typecheck ×5, biome, unit 2654, integ 251, build).

✅ **Phase 3 FAIT (2026-06-14)** : package `@pokemon-tactic/render-babylon` (deps core/data/presentation/renderer-contract + Babylon ; tsconfig lib DOM). Déplacés dedans (25 fichiers) : tous les `babylon-*` (sauf `babylon-preview`), `battle-board-view`, `combat-scene`, `game-stage`, `load-tiled-map`, `map-preview-stage`, `sprite-depth-plugin`, `terrain-extruder`, `world-facing(.test)`, `world-projection`, `directional-billboard(.test)`, `floating-text-spawner`, + `constants.ts` (32 constantes visuelles babylon propres + re-export des 5 presentation/contract utilisées). `HighlightKind` → contract. **`RenderBackend`** (contrat de cycle de vie DOM-free = `dispose()`, le maillon implicite/douloureux passé) ajouté au contract ; `GameStage` le satisfait à la compilation (typecheck = conformance lifecycle ; conformance runtime Babylon infaisable en unit env sans WebGL). **Restent dans renderer/babylon/** (niveau app-shell/écran) : `combat-screen`, `placement-flow`, `team-edit-harness`, `babylon-preview` (utilise `createInfoPanel` DOM + n'est consommé que par `babylon-boot`). Imports renderer → `@pokemon-tactic/render-babylon`. Pureté vérifiée. Gate complet vert (typecheck ×6, biome, unit 2654, integ 251, build).

**Clarification archi (Phase 3)** : le contrat backend = **les 3 ports data** (`BoardView`/`BattleChrome`/`BattleFeedback`) déjà présents + `RenderBackend` (lifecycle). Le `BattleChrome`/`BattleFeedback` étant DOM (→ `ui-dom`), un `RenderBackend` qui *fournirait les 3 ports* (specs initiale) n'a pas de sens : le backend babylon fournit le host/lifecycle (`GameStage`) + la `BoardView` ; chrome/feedback restent DOM/app-shell. Pas de réécriture du câblage `combat-screen` (fonctionnel) — adoption éventuelle au Phase 5.

✅ **Phase 4 FAIT (2026-06-14)** : package `@pokemon-tactic/ui-dom` (deps core/data/presentation/renderer-contract ; tsconfig lib DOM). **Scope = combat-chrome réutilisable cross-renderer** (11 fichiers) : `battle-chrome`, `battle-log`, `move-tooltip`, `placement-roster`, `turn-timeline`, `weather-hud`, `info-panel`, `BattleLogFormatter(.test)`, `pattern-preview`, + `config.ts` (`UiDomConfig`), `constants.ts` (`BATTLE_LOG_COLOR_*`). DI via **`UiDomConfig`** = `{ translate, getLanguage, getTypeIconUrl, getCategoryIconUrl, getPortraitUrl }`, injecté au montage (`createBattleChrome({config})`, `createBattleLog({translate})`, `new PlacementRoster(config)`). `teamColorToHex` → contract (util pur). `info-panel` reste pur (rend `InfoPanelData`, pas de DI). Wiring : `combat-screen` (uiConfig) + `placement-flow` (PLACEMENT_UI_CONFIG). Pureté vérifiée (core/data/presentation/contract only). Gate complet vert (typecheck ×7, biome, unit 2654, integ 251, build).

**Décisions de scope (Phase 4)** :
- **Primitives génériques déplacées dans `ui-dom` (2026-06-14, post-Phase 5)** : `Modal` (i18n retiré → `closeAriaLabel?: string` DI, défaut "Close" ; les 5 modales team passent `t("teamBuilder.aria.close")`), `Stepper`, `form-controls` (purs). Importeurs renderer (SandboxPanel + 5 modales team) → `@pokemon-tactic/ui-dom`.
- **UI team/écrans reste dans renderer (app-shell)** : `MovesList`, `MovePickerModal`/pickers, `screens/elements`, `SandboxPanel` (orchestration), team-builder — couplées aux écrans FSM + au type `AvailableMove`, pas réutilisées par le chemin combat cross-renderer.
- **CSS des composants `ui-dom` co-localisé (2026-06-14, post-Phase 5)** : `battle-chrome`, `battle-log`, `move-tooltip`, `turn-timeline`, `weather-hud`, `placement`, `modal`, `info-panel` → `ui-dom/src/styles/` + `ui-dom/src/styles/index.css` (re-déclare l'ordre `@layer`). Exposé via `exports` `"./styles/*"`, importé une fois au boot : `import "@pokemon-tactic/ui-dom/styles/index.css"` dans `babylon-boot`. Vérifié au build (Vite résout le sous-chemin paquet, 58 règles bundlées). **Fondations design-system** (`tokens`/`reset`/`base`/`button.css` — `tb-btn` partagé par 11 fichiers app-shell) restent fournies par l'app-shell : modèle lib de composants (le composant embarque son CSS spécifique, l'hôte fournit tokens + base).

**Reprise = Phase 5** (app-shell + câblage final + cross-cutting docs/gate). _(Détails 2b conservés ci-dessous pour historique.)_ Reste à faire (2b, fait) :
- **`presentation/src/constants.ts`** : y déplacer `FIELD_TERRAIN_COLOR_*` (4) + `AURA_INDICATOR_SYMBOL` + `CHARGING_INDICATOR_SYMBOL`/`_ID`. ⚠️ **Cluster BATTLE_TEXT** : `BATTLE_TEXT_QUEUE_DELAY_MS` (= `round(BATTLE_TEXT_DURATION_MS × 0.5)`) utilisé par orchestrator **ET** `babylon/floating-text-spawner`; `floating-text-content` importe d'autres `BATTLE_TEXT_*` (couleurs). → déplacer tout le cluster `BATTLE_TEXT_*` dans `presentation` ; babylon spawner l'importera depuis `presentation`. Re-exporter depuis `renderer/constants.ts` si d'autres renderer-files en dépendent.
- **`floating-text-content.ts`** : importe `getLanguage`/`t` (i18n) + `TranslationKey` → même DI `PresentationContext` que `battle-views` (loosen `TranslationKey`→`string`). Vérifier qui l'appelle (`babylon/floating-text-spawner` ?) pour threader le contexte.
- **`SandboxSetup.ts`** : importe le type `SandboxConfig` (`../types/SandboxConfig`) → déplacer `SandboxConfig` dans `presentation` (ou l'injecter).
- **`BattleSetup` / `AiTeamController` / `DummyAiController` / `movement-animation` / `AnimationQueue`** : imports core/data only (à confirmer) → move direct.
- À déplacer dans `presentation/src/` : `battle-orchestrator(.test)`, `battle-views(.test)`, `floating-text-content(.test)`, `movement-animation(.test)`, `AnimationQueue`, `BattleSetup`, `SandboxSetup(.test)`, `AiTeamController(.test)`, `DummyAiController(.test)` + le nouveau `constants.ts`. Créer le package (`exports → src/index.ts`, deps core/data/renderer-contract), ajouter aux `tsconfig.base` paths, `pnpm install`. Mettre à jour les imports renderer (`babylon/combat-screen`, `babylon/floating-text-spawner`, `app/*`) vers `@pokemon-tactic/presentation`.
- Ensuite **Phase 3** `render-babylon` (`babylon/*`), **Phase 4** `ui-dom` (`ui/dom/*` + styles, DI), **Phase 5** app-shell.
- Rappel infra : `vitest`/`vite` resolvent via `exports` + symlinks pnpm + `tsconfig.base` paths (pas de project references). Ajouter chaque package aux `paths` + pnpm install.

**Validé visuellement (2026-06-14)** : app boot Babylon-only OK (menu → mode → carte → équipe → combat). Combat complet rendu : terrain 3D, timeline, banner tour, action menu, info panel localisé (DI `PresentationContext` confirmé en vrai), burger journal. Zéro erreur console.

---

## Constats des audits (synthèse)

### Fuite logique → core : quasi nulle ✅
Le renderer ne recode **aucune règle de jeu**. `resolveTargeting`, `getTilesInRange`, `submitPlacement`, `pickScoredAction`, `AURA_RADIUS`, `FIELD_TERRAIN_RADIUS` sont tous importés du core. 2 micro-points :
- `TIMELINE_PREDICTION_SLOTS` défini 3× (`constants.ts`, `GameController`, `CT_TIMELINE_SLOTS` orchestrator) → exposer une source unique (core ou contract).
- Pré-validation placement (`isInZone`/`isOccupied`, `GameController.ts:2487`) = pré-check UI ; la vraie validation est déléguée au core. Mineur.

### La douleur de migration venait de l'absence de **frontière formelle**, pas d'un oubli de réutilisation
`battle-orchestrator.ts` (1394 L) est déjà 100% agnostique et définit 3 ports : `BoardView` (~35 méthodes), `BattleChrome` (~10), `BattleFeedback`. Modules agnostiques déjà réutilisables : `battle-views.ts`, `floating-text-content.ts`, `movement-animation.ts`, `AnimationQueue.ts`, `BattleLogFormatter.ts`. **Tout le commun est déjà extrait** — il manque juste l'isolation physique (packages) + le contrat exhaustif + les tests de conformité.

### Audit GameController (48 méthodes) — suppression Phaser SÛRE
- **A (22)** déjà miroir agnostique → supprimable sans perte.
- **B (23)** pur rendu Phaser → supprimable.
- **C (3)** logique sans miroir → **toutes faux positifs** : `processEvents`/`processEvent` possédés par `applyEvents`+`floating-text-content`, `animateAlongPath` par `movement-animation` + port `BoardView.moveAlongPath`. Validés au plan 124.
- **Types exportés** : `GameController` + `PlacementConfig`, importés **uniquement par `BattleScene.ts`** (Phaser). Rien d'agnostique/Babylon n'en dépend.

→ **Aucune logique partagée n'est prisonnière de GameController.**

---

## Architecture cible

```
@pokemon-tactic/core              # état + règles (déjà propre, inchangé)
@pokemon-tactic/data              # données (inchangé)
@pokemon-tactic/presentation      # orchestrator + builders + view-models — AGNOSTIQUE, zéro dep moteur
@pokemon-tactic/renderer-contract # ports (BoardView/BattleChrome/BattleFeedback) + types view-models + CONFORMANCE SUITE
@pokemon-tactic/render-babylon    # implémentation Babylon des ports
@pokemon-tactic/ui-dom            # UI HTML/CSS pure (DI : translate, getPortraitUrl, getTypeIconUrl…)
```

Dépendances : `presentation` → `core`/`data`/`renderer-contract` (types) · `render-babylon` → `renderer-contract`/`presentation` (types) · `ui-dom` → `renderer-contract` (types) + DI · `renderer` (app shell restant) → tout, câble les morceaux.

### Pattern : Humble Object + Presenter/ViewModel
- `presentation` (l'orchestrator) consomme les `BattleEvent` du core, calcule les view-models (DTO purs) et **pilote impérativement** le backend via les ports (`board.moveAlongPath`, `chrome.updateTimeline`, `feedback.report`…).
- Le backend est « humble » : il exécute les appels du port et **affiche**, ne décide rien.
- **Coordonnées grille logiques** dans les view-models (`gridX/gridY/height`), jamais d'écran pré-calculé (chaque backend projette).

### Mécanismes « force à ne rien oublier »
1. **Interface des ports = contrat exhaustif** : `BoardView`/`BattleChrome`/`BattleFeedback` listent toutes les capacités visuelles. TypeScript force un backend à implémenter **chaque méthode** (sinon erreur compile). Ajouter une capacité = ajouter une méthode au port → tous les backends cassent à la compilation tant qu'ils ne la fournissent pas.
2. **`never` sur les unions discriminées existantes** : `switch` exhaustifs (`default: const _x: never = …`) là où le code mappe une union — `applyEvents` (BattleEvent → appels ports), `BoardHighlight`/`AttackPreviewKind` kinds, etc. Oublier un cas = erreur compile.
3. **Conformance suite** : `runRendererConformanceTests(() => new Backend())` dans `renderer-contract/src/conformance/`. Chaque backend l'importe et doit la passer. Couvre : appels de chaque méthode de port (move, dégât, KO, statut, highlights par kind), cycle de vie (`initialize`/`resize`/`destroy`), résolution des Promises d'animation.
4. **Golden tests** sur les view-models (`toMatchSnapshot`) côté `presentation` : verrouille le format des DTO.

### Animations async
Les méthodes de port qui jouent une animation renvoient `Promise<void>` qui résout à la fin (déjà le cas : `board.moveAlongPath`, `board.playAttack`, `board.impactGlide`…). L'orchestrator séquence via `AnimationQueue` (déjà agnostique). Le backend décide de la durée réelle ; `presentation` ne connaît pas le timing moteur.

---

## Phases

### Phase 0 — Jalon 5 : suppression Phaser `[x]`

✅ **DONE** (nuit 2026-06-13) — gate vert : build (entrée unique `index.html`→`babylon-boot`), typecheck, 2654 tests, 251 integration, lint 0. Supprimé : `main.ts`, `babylon.html`, `scenes/`, `grid/`, `sprites/`, `GameController.ts`, 13 `ui/*.ts` Phaser, dep `phaser`, script `dev:map`. Conservés (consommés par DOM/Babylon) : `BattleLogFormatter`, `pattern-preview`, `SandboxPanel`, `constants.ts`. `index.html` promu sur `babylon-boot.ts` ; `vite.config` entrée unique. Audit `iso-math`/`sprite-bounds` : aucun vrai import Babylon (commentaires only) → supprimés avec `grid/`. Smoke navigateur reporté (chrome-devtools MCP HS) — recette visuelle humaine demain.

Préalable dé-risqué par l'audit. Découpage méthodique pour chaque fichier.

#### Phase 0.1 — Inventaire & vérification de sécurité `[ ]`
- `[ ]` Lister tous les fichiers Phaser `packages/renderer/src/` à supprimer :
  - **Scenes** : `scenes/BattleScene.ts`, `scenes/BattleUIScene.ts`, `scenes/LoadingScene.ts`, `scenes/MainMenuScene.ts`, `scenes/SettingsScene.ts`, `scenes/CreditsScene.ts`, `scenes/MyTeamsScene.ts`, `scenes/TeamEditScene.ts`, `scenes/TeamSelectScene.ts`, `scenes/MapPreviewScene.ts`, `scenes/MapSelectScene.ts`, etc.
  - **Game** : `game/GameController.ts`
  - **UI Phaser** : `ui/TurnTimeline.ts`, `ui/InfoPanel.ts`, `ui/ActionMenu.ts`, `ui/WeatherHud.ts`, `ui/BattleLogPanel.ts`, `ui/MoveTooltip.ts`, `ui/DirectionPicker.ts`, `ui/HoverCursor.ts`, `ui/PlacementRosterPanel.ts`, `ui/BattleUI.ts`, `ui/LoadingOverlay.ts`, `ui/SandboxPanel.ts`, `ui/BattleText.ts`, etc.
  - **Grid Phaser** : `grid/IsometricGrid.ts`, `grid/DecorationsLayer.ts`, `grid/OcclusionFader.ts`
  - **Sprites Phaser** : `sprites/PokemonSprite.ts`, `sprites/SpriteLoader.ts`
- `[ ]` **Vérification de sécurité** : pour chaque fichier, `grep -r "import.*{fichier}" packages/ --include="*.ts"` → confirmer que **aucun consommateur agnostique/Babylon n'en dépend**.
  - Consommateurs attendus : seulement d'autres fichiers Phaser.
  - Si un consommateur Babylon/agnostique trouvé : **STOP**, documenter la dépendance manquée, reporter à l'humain avant suppression.
- `[ ]` **Fichiers à CONSERVER** (agnostiques, réutilisés par DOM) : `BattleLogFormatter.ts`, `pattern-preview.ts`, tout ce qui est importé par Phase 2.

#### Phase 0.2 — Suppression par catégorie `[ ]`
- `[ ]` Supprimer `scenes/*` complètement (tous les fichiers .ts + réfs dans imports).
- `[ ]` Supprimer `game/GameController.ts` (confirmé seulement BattleScene dépendait).
- `[ ]` Supprimer `ui/*.ts` Phaser (garder liste blanche conservative).
- `[ ]` Supprimer `grid/*.ts` Phaser (vérifier `iso-math.ts` / `sprite-bounds.ts` : si réutilisés par Babylon, déplacer en shared utilitaire d'abord).
- `[ ]` Supprimer `sprites/PokemonSprite.ts`, `sprites/SpriteLoader.ts`.
- `[ ]` Supprimer l'import `phaser` de `main.ts` ; router uniquement vers `babylon-boot.ts`.
- `[ ]` Retirer dépendance `phaser` de `packages/renderer/package.json`.

#### Phase 0.3 — Validation `[ ]`
- `[ ]` `grep -ri phaser packages/ --include="*.ts"` = 0 (zéro match).
- `[ ]` Build : `pnpm build` pass.
- `[ ]` Typecheck : `pnpm typecheck` pass (aucune ref vers types Phaser).
- `[ ]` Gate CI : `pnpm lint:fix && pnpm test && pnpm test:integration` pass.
- `[ ]` Babylon boot (`babylon.html`) lance sans erreur (Sandbox studio ou preview mode).

### Phase 1 — `renderer-contract` `[x]`

✅ **DONE** (nuit 2026-06-13) — package `@pokemon-tactic/renderer-contract` créé (consommé en source, `exports → src/index.ts`, dep `core`). Types extraits : `ports.ts` (BoardView, BattleChrome, BattleFeedback + BoardHighlight/AttackPreviewKind/SemiInvulnerableDisplay/DirectionPicker*/BoardDamageEstimate/BoardFieldTerrain/BoardAuraIndicator/ActionMenuView/BlockedMoveTag/AttackSubmenu*/SelectedMoveView/TurnInfoView/BattleInstruction/BattleOrchestratorConfig) ; `view-models.ts` (WeatherKind/WeatherView/TimelineEntryView/TimelineView/InfoPanelData/InfoPanelBadge/InfoPanelBadgeVariant). `battle-orchestrator.ts`, `battle-views.ts`, `ui/dom/info-panel.ts` re-exportent depuis le contract (consommateurs inchangés). `tsconfig.base` paths += contract ; path `renderer` corrigé (`main.ts`→`babylon-boot.ts`). Gate vert : build, typecheck, 2654 tests, 251 integration, lint 0.

Établit le contrat de rendu + infrastructure de test avant d'implémenter un backend.

- `[ ]` **Setup packages** : créer `packages/renderer-contract/` avec `package.json` (dépend `@pokemon-tactic/core`, `@pokemon-tactic/data`), `tsconfig.json`, `src/` + `src/__tests__/`.
- `[ ]` **Déplacer interfaces ports** : depuis `battle-orchestrator.ts` vers `renderer-contract/src/ports/` :
  - `BoardView` (~35 méthodes)
  - `BattleChrome` (~10 méthodes)
  - `BattleFeedback` (textes flottants, logs)
- `[ ]` **Déplacer types view-models** : créer `renderer-contract/src/view-models/` et y placer :
  - `TimelineView`, `TimelineSlot`, `TimelineSlotKind`
  - `InfoPanelData`, `StatBadge`, `VolatileBadge`, `HeldItemBadge`
  - `WeatherView`, `ActionMenuView`, `MoveView`
  - `BoardDamageEstimate`, `BoardFieldTerrain`, `BoardAuraIndicator`, etc.
  - Copier d'abord depuis renderer pour les identifier toutes, puis extraire progressivement.
- `[ ]` **Pas de `RenderEvent` union** (décision #5) : on conserve `BattleEvent` du core, consommé par l'orchestrator qui pilote les ports impérativement. Le contrat = les 3 ports + view-models, rien de plus. Conserver les `switch` exhaustifs `never` existants (`applyEvents`, kinds de highlight) — ils restent côté `presentation`.
- `[ ]` **Scaffolding conformance suite** : créer `renderer-contract/src/conformance/suite.ts` (signature `export function runRendererConformanceTests(createBackend: () => RenderBackend): void`). `RenderBackend` = type agrégeant les 3 ports + cycle de vie (`initialize`/`resize`/`destroy`).
- `[ ]` **Gate intermédiaire** : `pnpm build` + `pnpm typecheck` pass (même si conformance suite n'a pas de tests encore).

### Phase 2 — `presentation` `[~]`

✅ **2a fait (nuit)** : découplage DI `PresentationContext` de `battle-orchestrator` + `battle-views` (in place, vert). ⏳ **2b à faire** : créer le package `presentation` + y déplacer `game/*` (cf. couplage restant en tête de plan « 🔖 État / reprise »).

Extrait la logique agnostique moteur : orchestrator + builders + IA. **Gros découpage** — peut être splitté en 2-3 commits par catégorie.

#### Phase 2.1 — Core extraction `[ ]`
- `[ ]` Créer `packages/presentation/` avec `package.json` (dépend `@pokemon-tactic/core`, `@pokemon-tactic/data`, `@pokemon-tactic/renderer-contract`), `tsconfig.json`, `src/` + `src/__tests__/`.
- `[ ]` Extraire `battle-orchestrator.ts` → `presentation/src/battle-orchestrator.ts`. Retirer tout import moteur Phaser/Babylon → injecter `BoardView`, `BattleChrome`, `BattleFeedback` via constructeur.
- `[ ]` Extraire `battle-views.ts` (builders view-models) → `presentation/src/battle-views.ts`.
- `[ ]` Extraire `AnimationQueue.ts`, `movement-animation.ts`, `floating-text-content.ts` → `presentation/src/`.
- `[ ]` **Dépendance i18n** : au lieu d'importer `renderer/i18n`, injecter une fonction `translate: (key: string, lang?: string) => string` dans le constructeur ou en DI global. Documenter la signature en `renderer-contract`.
- `[ ]` Gate : `pnpm build` + `pnpm typecheck` pass (aucun import Phaser).

#### Phase 2.2 — Builders et setup `[ ]`
- `[ ]` Extraire `BattleSetup.ts`, `SandboxSetup.ts` → `presentation/src/`.
- `[ ]` Extraire contrôleurs IA `AiTeamController`, `DummyAiController` → `presentation/src/ai/`.
- `[ ]` Vérifier que toutes les dépendances core/data sont satisfaites.

#### Phase 2.3 — Tests et golden tests `[ ]`
- `[ ]` Migrer tests existants (déjà nombreux pour orchestrator) dans `presentation/src/__tests__/`.
- `[ ]` Ajouter golden tests sur les view-models : `toMatchSnapshot()` sur les DTO générés (TimelineView, InfoPanelData, etc.) pour verrouiller le format.
- `[ ]` Gate : `pnpm test` + `pnpm test:integration` pass. Couverture maintenue ≥ niveau précédent.

#### Phase 2.4 — Mettre à jour imports du renderer `[ ]`
- `[ ]` Fichiers renderer qui importaient les modules extraits : remplacer `from "./battle-orchestrator"` par `from "@pokemon-tactic/presentation"`.
- `[ ]` Gate : `pnpm build` pass. Vérif zéro cycle import.

### Phase 3 — `render-babylon` `[ ]`

Implémente le backend Babylon contre le contrat de rendu.

- `[ ]` Créer `packages/render-babylon/` avec `package.json` (dépend `@pokemon-tactic/renderer-contract`, `@pokemon-tactic/presentation`, `babylon.js`), `tsconfig.json`.
- `[ ]` Déplacer `packages/renderer/src/babylon/*` → `render-babylon/src/`.
- `[ ]` **Implémenter `RenderBackend`** : `BabylonRenderBackend` fournissant les 3 ports (`BoardView`, `BattleChrome`, `BattleFeedback`) + cycle de vie explicite : `initialize(): Promise<void>`, `resize(width, height): void`, `destroy(): void`. (Le cycle de vie manquait — cause probable de douleur passée.)
- `[ ]` Créer `render-babylon/src/__tests__/conformance.test.ts` : `runRendererConformanceTests(() => new BabylonRenderBackend())`.
- `[ ]` Gate : conformance suite passe (sera minimal au départ, puis riche en Phase 4+).

### Phase 4 — `ui-dom` `[ ]`

Extrait composants UI HTML réutilisables, avec dépendance injectée pour ressources (translate, URLs).

#### Phase 4.1 — Extraction Tier 1 (trivial, zéro DI) `[ ]`
- `[ ]` Créer `packages/ui-dom/` avec `package.json` (dépend `@pokemon-tactic/renderer-contract`, `@pokemon-tactic/data`), `tsconfig.json`, `src/components/` + `src/styles/`.
- `[ ]` Extraire composants sans dépendance i18n/ressources :
  - `form-controls/`, `Stepper.ts`, `elements/` → `ui-dom/src/components/`.
  - Modal (retirer dépendance i18n pour le moment, rendre accessible en paramètre).

#### Phase 4.2 — Extraction Tier 2 + DI setup `[ ]`
- `[ ]` Créer `ui-dom/src/config.ts` : interface `UiDomConfig = { translate, getTypeIconUrl, getCategoryIconUrl, getMoveInfo, getPortraitUrl, teamColorToHex, trackEvent? }`.
- `[ ]` Extraire composants + enfants : `battle-chrome/`, `turn-timeline/`, `weather-hud/`, `move-tooltip/`, `battle-log/`, `placement-roster/`, `MovesList.ts`, `pattern-preview.ts`, `BattleLogFormatter.ts`.
  - Chaque composant qui a besoin de `translate` ou ressources : le paramètre via DI (injecté en mountage).
- `[ ]` CSS : migrer `tokens.css`, `reset.css`, `base.css`, `utilities.css`, `components/*.css` → `ui-dom/src/styles/`.

#### Phase 4.3 — Tests et validation `[ ]`
- `[ ]` Créer `ui-dom/src/__tests__/` : tests composants critiques (Modal, battle-chrome layout, etc.).
- `[ ]` Gate : `pnpm build` pass, types vérifiés.

#### Phase 4.4 — Mettre à jour imports du renderer `[ ]`
- `[ ]` Fichiers renderer qui importaient les composants extraits : remplacer `from "./ui/dom/..."` par `from "@pokemon-tactic/ui-dom"`.
- `[ ]` **Câblage DI au boot** : `babylon-boot.ts` / `main.ts` initialise `UiDomConfig` et le passe aux composants.

#### Note — Reste dans renderer
- **Screens** (`ui/dom/screens/*`) : `main-menu-screen.ts`, `battle-mode-screen.ts`, `team-select-screen.ts`, etc. = couplés au `app/screen-manager.ts` FSM → restent dans renderer/app-shell.
- **Map-select-screen** : couplé au Babylon renderer (preview live) → reste aussi.

### Phase 5 — App-shell + câblage final `[ ]`

Transforme le monolithe `packages/renderer` en conteneur sans logique (wiring uniquement).

- `[ ]` **Refactorer `packages/renderer/`** : supprimer tout code métier extrait, conserver seulement :
  - `main.ts` : entrypoint unique boot → Babylon
  - `babylon.html` : page host
  - `src/babylon-boot.ts` : initialisation Babylon, DI setup
  - `src/app/` : FSM écrans (inchangé)
  - `src/styles/` : styles racines seulement
  - `src/babylon/` : implémentation Babylon backend
  - Dépendances : `@pokemon-tactic/presentation`, `@pokemon-tactic/render-babylon`, `@pokemon-tactic/ui-dom`, `@pokemon-tactic/renderer-contract` (types).
- `[ ]` **Mettre à jour pnpm-workspace.yaml** : ajouter `packages/presentation`, `packages/render-babylon`, `packages/ui-dom`, `packages/renderer-contract`.
- `[ ]` **Mettre à jour tsconfig.json** (monorepo) : ajouter `references` vers les 4 nouveaux packages.
- `[ ]` **Créer TS path aliases** si utilisées : `@pokemon-tactic/presentation/*` etc. dans `tsconfig.json`.
- `[ ]` **Validation build** : `pnpm build` = 0 erreur. Aucun cycle import.
- `[ ]` **Babylon entrypoint fonctionne** : `pnpm dev` + ouvrir `/babylon.html` = no-op OU une scène Babylon lancée (selon état courant).

### Cross-cutting — Validation & documentation
- `[ ]` **Nettoyage constants** : `TIMELINE_PREDICTION_SLOTS` fusionné en source unique (core ou contract, au choix).
- `[ ]` **Documentations mises à jour** :
  - `docs/architecture.md` : section "Packages renderer" avec diagramme dépendances + exports publiques.
  - `docs/decisions.md` : ajouter décisions #XXX (pattern Humble Object, conformance suite, split packages).
- `[ ]` **`core-guardian` vert à chaque phase** : vérifier zéro dépendance moteur/rendu dans `@pokemon-tactic/presentation`.
- `[ ]` **Pas de régression** : plan 124 recette parité rejouée (Babylon doit passer les mêmes scénarios).
- `[ ]` **Regenerer U-A knowledge-graph** : `.understand-anything/knowledge-graph.json` auto-update post-commit, mais vérifier la topologie réduite 5 packages au lieu de monolithe.
- `[ ]` **Gate CI complet** : `pnpm lint:fix && pnpm typecheck && pnpm build && pnpm test && pnpm test:integration` = 0 erreur.

---

## Critères de complétion (DoD)

Le plan 125 est complet quand :

1. **5 packages structurés** :
   - `@pokemon-tactic/renderer-contract` (types, ports, conformance scaffolding)
   - `@pokemon-tactic/presentation` (orchestrator, builders, IA — zéro import moteur)
   - `@pokemon-tactic/render-babylon` (implémentation Babylon IRenderBackend)
   - `@pokemon-tactic/ui-dom` (composants DOM réutilisables, DI config)
   - `packages/renderer` (app-shell minimal + FSM écrans)

2. **Zéro régression fonctionnelle** :
   - Babylon lance : `pnpm dev`, `/babylon.html` fonctionne
   - Plan 124 recette parité relancée = résultats inchangés
   - Aucun bug nouveau par rapport à Phase 5 parité Babylon

3. **Contrat formalisé** :
   - `RenderBackend` = 3 ports (BoardView, BattleChrome, BattleFeedback) + cycle de vie
   - Ports impératifs (pas de `RenderEvent` union — décision #5) ; `switch` exhaustifs `never` conservés côté `presentation`
   - Conformance suite scaffoldée (peut être peu dense au départ, mais structure en place)

4. **Dépendances propres** :
   - `grep -ri "import.*renderer" @pokemon-tactic/presentation --include="*.ts"` = 0 (sauf types)
   - `grep -ri "import.*babylon" @pokemon-tactic/presentation --include="*.ts"` = 0
   - `pnpm typecheck` pass
   - `pnpm build` pass = aucun cycle import

5. **Documentation** :
   - `docs/architecture.md` section "Packages renderer" avec dépendances
   - `docs/decisions.md` entries pour les décisions du plan

6. **CI green** :
   - `pnpm lint:fix && pnpm typecheck && pnpm build && pnpm test && pnpm test:integration` = 0 erreur

---

## Pièges à éviter (best-practices)
- **Sur-abstraction** : l'API du contrat est au niveau *entités de jeu* (`playMoveAnimation`, `highlightTile`), jamais primitives GPU.
- **Leaky coords** : view-models = grille logique, pas écran. Backend projette. Exposer `getScreenPosition(grid)` dans le contrat pour l'UI DOM qui se positionne.
- **Backend = second core** : toute décision sans API moteur va dans `presentation`.
- **Cycle de vie** : `initialize/resize/destroy` contractuels et testés (manquait, cause probable de douleur passée).

## Dépendances & séquençage

### Prérequis avant Phase 0
- **Plan 119 (Babylon master) Jalons 1-4 complétés** : Babylon render fonctionnel (terrain, sprites, UI DOM basique).
- **Plan 124 (recette parité lot 3) validée** : comportements fondamentaux testés, base stable.

### Dépendances inter-phases
- **Phase 0 → Phase 1** : Phase 0 complétée avant Phase 1 (no-op si on refactorise code mort). Phaser supprimé = terrain propre pour extraire les types.
- **Phase 1 → Phase 2** : Phase 1 doit scaffolder `conformance/` avant Phase 2 (sinon Phase 3 n'a rien à passer).
- **Phase 2 → Phase 3** : `presentation` compilable (même minimal) avant d'y importer en render-babylon. Typechecking fait en Phase 2.
- **Phase 3 → Phase 4** : render-babylon est le "proof of concept" du contrat — doit compiler + passer conformance avant extraire ui-dom.
- **Phase 4 → Phase 5** : Tous les imports du renderer doivent être redirigés avant de valider l'app-shell.

### Bloquants critiques
- ✅ **i18n (tranché, décision #4)** : injection (DI) au boot par l'app-shell `renderer`. `presentation`/`ui-dom` reçoivent `translate(key, params?)`, restent purs.
- ✅ **RenderEvent (tranché, décision #5)** : pas d'union dédiée. On garde `BattleEvent` core + ports impératifs. Zéro réécriture du câblage orchestrator→board.
- **Audit `iso-math.ts` / `sprite-bounds.ts` (Phase 0.1)** : vérifier lesquels sont Babylon-dépendants avant suppression. **Seul bloquant restant** (à lever en début de Phase 0).

---

## Sources
Humble Object (Fowler/Clean Architecture), Presentation Model (Fowler), conformance suite (chinedufn/conformer), async/await animations, TS exhaustiveness `never`, openage renderer levels, Pokemon Showdown ARCHITECTURE.
