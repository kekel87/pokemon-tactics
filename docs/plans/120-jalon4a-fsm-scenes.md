# Plan 120 — Jalon 4a : FSM scènes DOM + écrans menu + boucle combat jouable

> **Statut : ✅ TERMINÉ** — étapes 1–10 validées (passe gate minimale : flux combat +
> Rejouer, équipes, écrans, retours, sandbox ; route `?map=` preview abandonnée).
> Repasse gate complète prévue à l'iso-Phaser (4b/4c). Worktree `phase5-babylon`, port 5220.

## Objectif

Remplacer l'orchestration de scènes Phaser (`scene.launch/sleep/stop`) par une **FSM
d'écrans DOM** pilotant le canvas Babylon, et rendre un combat **jouable de bout en
bout** : MainMenu → … → placement → combat → victoire → retour menu.

**Gate (plan 119)** : navigation complète entre écrans, placement→combat→victoire
jouable, toutes les transitions testées.

> ⚠️ Le gate 4a évalue la **jouabilité** (flux sans blocage), PAS la lisibilité :
> les feedbacks (textes flottants, log, timeline) sont volontairement absents
> (→ 4b/4c). Tester de préférence en **Round-Robin** (sans TurnTimeline, le mode
> CT paraît imprévisible).

## Dépendances

- **Pré-requis** : J1–J3f ✅ (terrain, sprites, caméra, picking, highlights, curseur).
- **Débloque** : 4b (chrome complet), 4c (animations/textes), 4d (écrans hors-combat complets).

## Diagramme de transitions (exigé avant code)

États de la FSM (1 état = 1 écran). `⇄` = aller-retour (bouton retour/Échap).

```
                              ┌─────────────┐
                              │  main-menu  │◄──────────────────────────┐
                              └──┬──┬──┬──┬─┘                           │
            ┌────────────────────┘  │  │  └───────────┐                 │
            ▼                       ▼  ▼              ▼                 │
     ┌─────────────┐    ┌──────────┐  ┌──────────┐  ┌──────────┐        │
     │ battle-mode │    │ my-teams │  │ settings │  │ credits  │        │
     └──────┬──────┘    └────┬─────┘  └────┬─────┘  └────┬─────┘        │
            │ ⇄              │ ⇄ team-edit │ ⇄           │ ⇄            │
            ▼                ▼                                          │
     ┌─────────────┐    ┌───────────┐                                   │
     │ map-select  │    │ team-edit │                                   │
     │ (+ preview  │    └───────────┘                                   │
     │   live)     │                                                    │
     └──────┬──────┘                                                    │
            │ ⇄  (mapUrl)                                               │
            ▼                                                           │
     ┌─────────────┐         ┌────────────────────────────────────┐     │
     │ team-select │────────►│              combat                │─────┘
     └─────────────┘ (teams, │  placement → battle → victory      │  (retour
            ▲        mapUrl, │  (sous-états internes, overlay     │   menu)
            │        options)│   victoire = fin d'état)           │
   sandbox ─┘                └────────────────────────────────────┘
   (boot direct, config JSON)
```

- **Pas d'état `loading` dédié** : le chargement d'assets est un **overlay** posé par
  l'écran cible pendant son `mount()` asynchrone (remplace `LoadingScene` Phaser qui
  n'était qu'une transition générique).
- **Preview map** : sous-composant de `map-select` (mini-stage Babylon), pas un état
  FSM — détruit avec l'écran (remplace `MapSelectPreviewScene` parallèle).
- **Victoire** : overlay DOM interne à l'état `combat` (pas un état FSM). Deux
  sorties : **« Retour menu »** (`combat → main-menu`) et **« Rejouer »** (re-mount
  interne de l'état `combat` avec la même config — PAS une transition FSM, nommé
  explicitement pour ne pas improviser).
- **Échap niveau FSM dans `combat`** : **ignoré** (pas de sortie accidentelle d'un
  combat ; l'abandon passe par l'action Abandonner du menu d'action, comme
  aujourd'hui). Menu pause éventuel → hors scope. Échap reste contextuel DANS la
  machine d'input (chaîne `handleEscapeKey` portée telle quelle).
- **Sandbox** (`VITE_SANDBOX`) : boot direct sur `combat` avec config JSON
  (court-circuite menus, comme aujourd'hui).
- **`?map=<name>`** (preview seule) : **branche du bootstrap** (pas un état FSM
  supplémentaire) → monte `map-select` en mode preview.
- **Dette UX assumée** : pas de chemin `team-select → my-teams` (empty state → CTA
  texte « Crée ton équipe depuis le menu principal », cf. game-design §2c). Version
  complète : 4d.
- **Sous-états de `combat`** (machine d'input portée, PAS des états FSM) : les 11
  phases existantes de `GameController` (le plan 119 dit « 10 états » — le code
  réel en compte 11) : (`placement`, `placement_direction`,
  `action_menu`, `select_move_destination`, `attack_submenu`, `select_attack_target`,
  `confirm_attack`, `select_retreat_target`, `select_direction`, `animating`,
  `battle_over`).

### Contrat d'état

```ts
interface Screen {
  /** Construit le DOM (et le canvas Babylon pour combat/preview). Peut être async (assets). */
  mount(host: HTMLElement, params: ScreenParams): Promise<void> | void;
  /** Détruit DOM + ressources Babylon (contrat babylon-asset-lifecycle.md). */
  dispose(): void;
}
```

- `ScreenManager.navigate(id, params)` : `dispose()` de l'écran courant **puis**
  `mount()` du suivant. Pas de sleep/wake : un écran quitté est détruit (les menus
  DOM se reconstruisent en <1 frame ; combat recharge ses assets via cache HTTP).
- Transitions illégales (ex: `settings → combat`) = throw en dev, ignore en prod.

## Architecture fichiers

| Fichier | Rôle |
|---------|------|
| `src/app/screen-manager.ts` | FSM : registre d'écrans, `navigate()`, garde transitions, tests unitaires |
| `src/app/screens.ts` | Table des transitions légales (source du diagramme ci-dessus) |
| `src/ui/dom/screens/main-menu.ts` etc. | 1 fichier par écran DOM (mêmes tokens cqw que info-panel/team-builder) |
| `src/babylon/combat-screen.ts` | Écran combat : monte `game-stage` + `combat-scene` + orchestrateur |
| `src/game/battle-orchestrator.ts` | **Port découplé de `GameController`** (machine input 11 états, `onTurnReady`, AnimationQueue, IA) — zéro import Phaser/Babylon, parle à des interfaces |
| `babylon-boot.ts` | Devient : init i18n/settings → `ScreenManager.start()` (routes sandbox/`?map=`) |

### Découplage `GameController` (2796 lignes, god class Phaser)

**Pas de port brut.** Extraction en `BattleOrchestrator` agnostique + 3 ports :

| Port (interface) | Impl 4a | Complété en |
|------------------|---------|-------------|
| `BoardView` (highlights, curseur, sprites, picking, caméra) | Babylon (existant J3 : `babylon-tile-highlights`, `babylon-picking`, `directional-billboard`…) | — |
| `BattleChrome` (action menu, confirm, direction picker, **roster placement minimal** — compteur placés/restants obligatoire pour ne pas désorienter, victoire) | **Minimal DOM** (listes brutes stylées tokens, fonctionnel pas beau) | **4b** (panneaux finaux) |
| `BattleFeedback` (textes flottants, log) | No-op + `console.debug` | **4c** (BattleText DOM) |

Les **signatures exactes** des 3 ports sont définies au démarrage de l'étape 7,
après audit phase par phase du mapping `InputState` Phaser → appels orchestrateur
(livrable d'analyse AVANT extraction — évite un refactor mi-étape).

La logique pure (résolution targeting, retraite Hit&Run, prédiction timeline CT…)
reste dans le core — l'orchestrateur ne fait que séquencer.

**Sprites temporaires de placement** : créés/détruits par `BoardView`
(`directional-billboard` existant, teinte/alpha placement) — cycle de vie possédé
par l'écran combat, undo = dispose du billboard + retour roster.

## Étapes

1. ✅ **FSM + tests** — `screen-manager.ts`, table de transitions, 9 tests Vitest
   (table transitions complète, sérialisation async, rejets illégaux). Aucun visuel.
2. ✅ **Écrans simples** — `main-menu` (5 boutons, `menu.adventure` désactivé),
   `battle-mode`, `settings` (3 toggles), `credits`. i18n existant réutilisé.
   Navigation clavier/souris + Échap = retour. Placeholders navigables : `map-select`,
   `team-select`, `my-teams`/`team-edit`. `combat-screen.ts` wrappe la démo J3
   (12 Pokemon, highlights, 2 Champs) + bouton retour menu. `babylon-boot.ts` bootée
   via FSM (routes : défaut → main-menu, `?combat=1` → combat direct, `?preview=1`
   → harnais inchangé). Fix bug latent : `BabylonHoverCursor.dispose()` crashait sur
   tableau sparse de textures (jamais déclenché avant — la scène n'était jamais
   disposée). Checkpoint : navigation complète chemins A/B/C/D, 2 montages combat
   successifs sans fuite ni erreur console.
3. ✅ **`map-select` + preview live** — liste DOM 8 cartes depuis `maps-registry`,
   détails nom/taille/tags/description. Preview Babylon live via `map-preview-stage.ts`
   = `createCombatScene` sans Pokemon ni curseur (option `showHoverCursor`), 1 moteur
   par carte affichée. Navigation ↑/↓/Entrée/Échap clavier. Fallback image statique
   non nécessaire. Fix collatéral : wheel zoom déplacé `window` → `canvas` dans
   `combat-scene` (la preview embarquée ne volait plus le scroll des panneaux DOM).
4. ✅ **`team-select` minimal** — écran DOM port de `TeamSelectScene` : format picker,
   slots joueurs (toggle Humain/IA, assignation équipes), Placement auto, CT/RR, Remplir IA,
   bouton Lancer → combat (config équipes/options transmise aux étapes 6–7). Réutilise
   `FormatPicker`/`PlayersColumn`/`TeamList` + classes CSS `ts-*` existantes. Logique slots
   extraite dans `slot-state.ts` (partagée scène Phaser ↔ écran DOM, `TeamSelectScene` −100 lignes).
   Fix UX : scrollbars fines globales (`base.css`) + `flex-wrap` sur `.ts-team-row-portraits`.
   (Version complète : 4d.)
5. ✅ **`my-teams` / `team-edit`** — extraction `MyTeamsView` + `TeamEditView`
   (`ui/team/`) depuis les scènes Phaser ; vues DOM partagées Phaser ↔ FSM jusqu'à
   suppression J5. Scènes Phaser réduites à wrappers ~25 lignes (−560 lignes nettes).
   Nouveaux écrans FSM `my-teams-screen.ts` / `team-edit-screen.ts` ; `team-edit`
   avec `teamId: null` crée une équipe vide avant édition. `placeholder-screens.ts`
   supprimé ; `babylon-boot.ts` branché sur les écrans réels. `bindEscape`
   (elements.ts) : guard `dialog[open]` — Échap ferme les modales (pickers team-edit)
   sans déclencher la navigation retour. Validé humain : menu → Mes équipes →
   création/édition/suppression/export, Échap, parité visuelle Phaser.
6. ✅ **Écran combat : placement** — `babylon/placement-flow.ts` : pilote le core
   `PlacementPhase` (mode Alternating), tours alternés humain/IA (IA auto-place),
   pose interactive (clic zone spawn → picker direction → `submitPlacement`), undo
   Échap (retire la dernière pose du joueur courant), option Placement auto
   (`autoPlaceAll`). À la complétion, billboards restent sur le terrain, la boucle
   combat prend le relais (étape 7). Nouvelle API `CombatScene` : `ready` Promise,
   `addPokemon`/`removePokemon`, `setSpawnZoneHighlights`, `projectTile`.
   `babylon-tile-highlights.ts` étendu : `setSpawnZones` (quads par zone,
   couleur/alpha). Composants DOM `ui/dom/combat/` : `placement-roster.ts` (bandeau
   bas portraits + compteur placés/max + Terminer + couleur équipe) +
   `direction-picker.ts` (4 flèches projetées sur les tuiles voisines = iso-correct,
   suit rotation caméra, hover preview, clic confirme, Échap annule). CSS
   `styles/components/placement.css`. Paramètres FSM `combat` étendus
   `{ mapUrl, setup?: CombatSetup }` ; `buildTeamSelections`+`PLAYER_IDS` extraits
   dans `slot-state.ts`. Constantes : `TILE_SPAWN_ZONE_INACTIVE_ALPHA` /
   `TILE_SPAWN_ZONE_OCCUPIED_ALPHA`. i18n FR/EN `placement.counter` +
   `placement.direction.*`. Fix bug Dardargnan (Beedrill) : alias `<CopyOf>`
   `extracteur fetchait PNG inexistant → atlas sans Idle → rendu bruit. Fix :
   `scripts/extract-sprites.ts` résout PNG source des alias CopyOf. Validé humain.
7. **Boucle combat** — `battle-orchestrator`, en 4 sous-étapes :
   - ✅ **7a — Audit + interfaces** : mapping des 9 phases combat → ports, Échap
     contextuel, signatures `BoardView`/`BattleChrome`/`BattleFeedback` +
     API `BattleOrchestrator`. Livrable : section « Livrable 7a » ci-dessous.
     Picker direction = voxel in-engine (#487), DOM `direction-picker.ts` abandonné.
   - ✅ **7b — Machine input + onTurnReady** : port de la machine 11 états,
     `AnimationQueue` réutilisée telle quelle, chrome minimal (`BattleChrome`),
     undo déplacement (verrouillé après attaque, cf. game-design §8b), chaîne
     Échap contextuelle complète (dont Hit&Run `select_retreat_target` →
     `select_attack_target`).
   - ✅ **7c — IA** : IA EASY seedée câblée en 7b (`onTurnReady` →
     `AiTeamController` + `EASY_PROFILE`, PRNG `createPrng`). IA dummy
     (`DummyAiController`, immobile) existe déjà mais est un construct **sandbox**
     (Player2 hardcodé) → son branchement sur le chemin Babylon se fait à
     l'étape 9 (boot sandbox). Gate joué contre IA EASY.
   - ✅ **7d — Systèmes de tour + startup** : le moteur pilote `turnOrder` /
     `currentTurnIndex` pour **Round-Robin ET Charge-Time** ; l'orchestrateur lit
     `state` sans logique spécifique au système → les deux marchent via l'impl
     générique 7b. `team-select-screen` expose déjà le picker CT/RR (défaut CT).
     Events startup (météo/talents) drainés dans `start()` via
     `consumeStartupEvents()`. Seule spécificité CT restante = la **TurnTimeline**
     (`predictCtTimeline`), volontairement différée à **4b** (note du plan : tester
     de préférence en RR tant que la timeline n'est pas là).
8. ✅ **Fin de combat** — overlay victoire DOM avec **« Rejouer »** (re-mount
   interne de l'état combat, même config — `mountContent`/`teardown` dans
   `combat-screen.ts`, PAS une transition FSM) + **« Retour menu »**. `AbortController`
   recréé à chaque (re)montage pour un disposal propre des listeners clavier.
   Vérif fuites (2 combats d'affilée) = au gate manuel (étape 10).
9. ✅ **Routes boot** (`babylon-boot.ts`) — **sandbox** (`VITE_SANDBOX` via `pnpm dev:sandbox`)
   → `mountSandboxCombat` : combat player-vs-dummy direct (sans placement), engine via
   `createSandboxBattle(config, map)` (map = tmj chargé, même source que le rendu → tuiles
   alignées), billboards spawnés depuis l'état, `DummyAiController` si `dummyControl: "ai"`.
   `?combat=1`/`?preview=1` inchangés. Cœur board/chrome/orchestrateur factorisé
   (`runBattle`) entre chemin placement et sandbox. Fix : `babylon/load-tiled-map.ts` skippe
   `requireAllFormats` sur les maps dev (`/maps/dev/`), comme le loader Phaser.
   **Route `?map=<name>` → preview abandonnée** (décision humaine : pas nécessaire).
10. ✅ **Gate** (passe minimale, 2026-06-12) — A (combat + Rejouer) + E (sandbox) validés
    en direct ; B/C/D + disposal validés rapidement par l'humain. Route `?map=` preview
    retirée (non nécessaire). Repasse complète à l'iso-Phaser (après 4b/4c). Parcours :
    - (A) main-menu → battle-mode → map-select(+preview) → team-select → combat
      (placement→victoire) → « Rejouer » → victoire → « Retour menu ».
    - (B) main-menu → my-teams → team-edit → my-teams → main-menu.
    - (C) main-menu → settings → main-menu → credits → main-menu.
    - (D) retours arrière (Échap/bouton) à chaque niveau de (A).
    - (E) boot sandbox JSON → combat direct ; boot `?map=` → preview.
    - Critère : aucun blocage, disposal propre (2 combats d'affilée sans fuite).

## Livrable 7a — Audit FSM + ports (validé humain)

Audit de `GameController.ts` (2798 lignes). FSM `InputState` = 11 phases ;
`placement` + `placement_direction` déjà portées (étape 6, `placement-flow.ts`).
**9 phases combat** restantes ci-dessous. Frontière des ports réconciliée avec
**décision #487** (hybride par ancrage) : picker direction = flèches voxel
in-engine (BoardView, réutilise étape 6) ; textes flottants = `BattleFeedback`
mais impl moteur en 4c (no-op 7b). Le DOM `direction-picker.ts` n'est PAS reporté.

### Mapping phases combat → transitions / Échap / ports

| Phase | Entrée → transition | Échap → | BoardView | BattleChrome | Core |
|-------|--------------------|---------|-----------|--------------|------|
| `action_menu` | Move→`select_move_destination` ; Attack→`attack_submenu` ; Wait(Espace)→`select_direction` ; UndoMove→exec | (rien) | clearHighlights, pan caméra→actif, setActive | actionMenu.show, infoPanel, turnTimeline, weatherHud | getLegalActions, predictCtTimeline |
| `select_move_destination` | clic tuile valide→exec→`animating` ; invalide→`action_menu` | `action_menu` | highlightTiles(Move) | actionMenu.hide | filtre legalActions(Move) |
| `attack_submenu` | move choisi→`select_attack_target` ; Cancel→`action_menu` | `action_menu` | clearHighlights | actionMenu.showAttackSubmenu (PP/Taunt/Disable/Encore) | filtre legalActions(UseMove) |
| `select_attack_target` | hover→preview ; clic valide→`confirm_attack` (ou exec direct) | `attack_submenu` (clearPreview) | highlightTilesOutline, showPreview, curseur→direction | actionMenu.showSelectedMove | getEffectiveMove, resolveTargeting, resolveBlastImpactTile |
| `confirm_attack` | clic : HitAndRun→`select_retreat_target` ; sinon→exec→`animating` | `select_attack_target` (stopFlash) | flash confirm (tuiles+cibles) | updateInstruction(confirm), turnTimeline scroll si CT | estimateDamage (preview) |
| `select_retreat_target` | clic tuile retreat valide→exec(+retreatPosition)→`animating` ; hors zone→rien | `select_attack_target` (clearHighlights) | highlightTiles(Retreat) | updateInstruction(selectTarget) | enumerateHitAndRunRetreatTiles |
| `select_direction` | picker onConfirm→exec(EndTurn)→`animating` ; onCancel→`action_menu` | `action_menu` | **showDirectionPicker voxel**, faceSprite preview, HP bar off | actionMenu.hide | action EndTurn{direction} |
| `animating` | (inputs ignorés) | (rien) | drain events : moveAlongPath, playAttack, updateHp, semiInvul, flash… | updateInfoPanel | (events du core) |
| `battle_over` | (terminal) | (rien) | (rien) | showVictory | (engine stoppé) |

`onTurnReady(activePokemonId) → BattleEvent[] | false` : hook IA. `false` = IA
délibère (skip refresh) ; tableau = enqueue dans AnimationQueue puis `refreshUI`
(ou `battle_over` si `BattleEnded`). Startup : `consumeStartupEvents()` →
AnimationQueue (météo/talents) avant le premier `action_menu`.

### Signatures des 3 ports (interfaces, zéro import moteur)

```ts
// L'orchestrateur parle à ces 3 interfaces + au core. Le combat-screen câble
// le picking Babylon + clavier sur les entrées de l'orchestrateur.

/** Rendu ancré-monde (impl Babylon : highlights, sprites, curseur, picker voxel). */
interface BoardView {
  // Highlights & preview ciblage
  highlightTiles(tiles: readonly Position[], kind: HighlightKind): void;
  highlightTilesOutline(tiles: readonly Position[]): void;
  showPreview(tiles: readonly Position[], kind: HighlightKind): void;
  clearPreview(): void;
  clearHighlights(): void;
  // Sprites de combat (Promise = anim bloquante drainée par l'AnimationQueue)
  moveSpriteAlongPath(pokemonId: string, path: readonly Position[], options: { isJump: boolean }): Promise<void>;
  faceSprite(pokemonId: string, direction: Direction): void;
  playAnimation(pokemonId: string, animation: string): Promise<void>;
  playAttackAnimation(pokemonId: string, category: MoveCategory, attackName: string): Promise<void>;
  playFaint(pokemonId: string): Promise<void>;
  updateHp(pokemonId: string, current: number, max: number): void;
  updateStatus(pokemonId: string, statuses: readonly StatusEffect[]): void;
  setSemiInvulnerable(pokemonId: string, state: SemiInvulnerableState | null): void;
  setChargingIndicator(pokemonId: string, charging: boolean): void;
  flashDamage(pokemonId: string): void;
  setActive(pokemonId: string | null): void;
  removeSprite(pokemonId: string): void;
  // Curseur + confirm flash
  setCursor(tile: Position | null): void;
  startConfirmFlash(tiles: readonly Position[], targetPokemonIds: readonly string[]): void;
  stopConfirmFlash(): void;
  // Caméra + projection
  panCameraTo(tile: Position): void;
  projectTile(tile: Position): { x: number; y: number };
  // Picker direction voxel (réutilise étape 6 — flèches in-engine, détection souris)
  showDirectionPicker(center: Position, initial: Direction, callbacks: DirectionPickerCallbacks): DirectionPickerHandle;
}

/** Chrome ancré-écran (impl DOM minimal 4a ; panneaux finaux 4b). */
interface BattleChrome {
  showActionMenu(options: ActionMenuOptions): void;          // Move/Attack/Wait/UndoMove + flags can*
  showAttackSubmenu(options: AttackSubmenuOptions): void;    // moves[] + PP + Taunt/Disable/Encore
  showSelectedMove(move: SelectedMoveView, instruction: string): void;
  updateInstruction(text: string): void;
  hideMenus(): void;
  updateTurnInfo(info: TurnInfoView): void;                  // tour/round/actif (infoPanel + battleUI)
  updateTimeline(timeline: TimelineView): void;              // turnTimeline (predictCtTimeline)
  updateWeather(weather: WeatherView | null): void;          // weatherHud
  showVictory(winnerId: string, roundNumber: number): void;
}

/** Feedback. floatingText : no-op 7b → billboards moteur 4c (#487). log : DOM. */
interface BattleFeedback {
  floatingText(pokemonId: string, text: string, kind: FloatingTextKind): void;
  appendLog(entries: readonly BattleLogEntry[]): void;
}
```

### API `BattleOrchestrator` (séquenceur pur — FSM + core + drain queue)

```ts
class BattleOrchestrator {
  constructor(
    engine: BattleEngine,            // core (déjà instancié, post-placement)
    board: BoardView,
    chrome: BattleChrome,
    feedback: BattleFeedback,
    config: { confirmAttack: boolean; damagePreview: boolean },
  );
  onTurnReady: ((activePokemonId: string) => BattleEvent[] | false) | null;
  start(): void;                     // consumeStartupEvents → queue → premier tour
  // Entrées brutes câblées par combat-screen (picking Babylon + clavier) :
  onTileClick(tile: Position): void;
  onTileHover(tile: Position | null): void;
  onEscape(): void;
  onConfirmKey(): void;              // Espace/Entrée = Wait en action_menu
  dispose(): void;
}
```

Découpage 7b/7c/7d inchangé. 7b implémente FSM + ports `BoardView`/`BattleChrome`
réels (Babylon + DOM minimal) ; `BattleFeedback` = no-op + `console.debug`.

## Hors scope (rappel plan 119)

- Panneaux combat finaux (ActionMenu stylé, MoveTooltip, InfoPanel complet,
  TurnTimeline, BattleLog, previews de ciblage) → **4b**.
- Tweens déplacement/impacts + textes flottants → **4c**.
- Team Builder complet, Team Select complet, Sandbox Studio → **4d**.
- Suppression code Phaser → **J5** (coexistence pendant J4).

## Risques

- **Volume** : étape 7 est le gros morceau (extraction depuis 2796 lignes). Mitigé
  par les ports + sous-étapes 7a–7d : on ne porte QUE la machine + le séquencement,
  pas les visuels.
- **Parité comportement** : la machine input portée doit réagir comme Phaser
  (undo, Échap contextuels…). Sous-arbre le plus délicat : **Hit&Run**
  (`select_retreat_target` + Échap retour). Test humain par chemin au gate.
- **Contrat `BattleChrome` sous-spécifié** → refactor mi-étape. Mitigation : 7a
  (audit + signatures) AVANT extraction.
- **Imports cycliques** `screen-manager` ↔ écrans/Babylon : le manager ne connaît
  que l'interface `Screen` ; le registre concret vit dans `babylon-boot.ts`.
  Vérifier à l'étape 1.
- **Disposal Babylon entre écrans** : suivre `docs/babylon/babylon-asset-lifecycle.md`
  (qui crée dispose) ; vérifier avec 2 montages successifs de combat.
