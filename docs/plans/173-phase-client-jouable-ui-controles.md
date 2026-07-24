# Plan 173 — Phase « Client jouable : contrôles & UI » (consolidation)

> **Statut** : ready (plan-cadre validé — le détail de chaque lot va dans son propre plan avant code)
> **Créé** : 2026-07-24
> **Nature** : plan-cadre d'une phase entière. Chaque lot sera détaillé dans son propre plan au moment de l'attaquer. Ce document consolide le périmètre, l'ordre et les décisions.

## Motivation

**Seul retour de vrais utilisateurs de tout le backlog** : les proches de l'humain ont dit le jeu **injouable sur mobile**. Précisé (2026-07-24) : la douleur = **contrôles tactiles** (pas le layout, pas la perf, pas la compréhension). Un multijoueur n'a de valeur que sur un client jouable ; cette phase est donc **prioritaire, avant la Phase 7 (Multijoueur)**.

Cette phase **consolide des items aujourd'hui dispersés** :
- **Phase 7 (Multijoueur)** → on rapatrie **« Support manette »**. (`Tutoriel interactif`, `Speed controls`, écran victoire enrichi **restent** en Phase 7 : compréhension/confort, hors périmètre contrôles.)
- **Phase 9 (Polish)** → on rapatrie **« UI revamps »**, **« Tooltips type chart »**, **a11y** (`Biome HTML/CSS lint a11y`).
- **Backlog `next.md` (§ UI/UX en attente)** :
  - Affichage **nature** dans l'InfoPanel (mécanique core livrée plan 072, UI absente).
  - Pistes best-practices overlay restantes : (2) modales `<dialog>` top-layer → publier `--stage-scale` sur `:root` via ResizeObserver ; (3) cap ultrawide optionnel `min(100cqw/1920, 100cqh/1080)` ; (4) `--ui-scale` sur les barres PV monde (4K).
  - Backlog visuel « **affichage des modificateurs terrain** » + « **auras — 1 rond par aura empilable** » (aussi listé Polish visuel 2D-HD).

## Décisions humaines déjà actées (2026-07-24)

1. **On consolide le plan avant de coder** (ce document).
2. Périmètre : rapatrier manette (Phase 7) + UI revamps (Phase 9) + backlog UI/UX.
3. **Démarrage par le Lot 3 (compléter l'UI)**, pas par le tactile.
4. **Intégrer les assets Kenney** (voir § Assets).
5. **Manette branchée sur téléphone doit fonctionner** (voir § Architecture — c'est quasi gratuit via la couche d'input device-agnostique).

## Architecture — couche d'input device-agnostique (fondation transverse)

Constat (cartographie 2026-07-24) : **aucune abstraction d'input**. Tout est capté en dur et dispersé :
- `packages/render-babylon/src/combat-scene.ts` : `pointerdown/up/move` (canvas/window), `wheel` (canvas), `keydown` (window, rotation caméra `←/→`), `resize`. **Déjà en `PointerEvent`** (donc le touch génère déjà des events) mais **zéro multi-touch**, zoom **molette uniquement** (rien au doigt), rotation caméra **clavier seul**.
- `packages/app/src/babylon/combat-screen.ts` + `placement-flow.ts` : `keydown` (window) pour Escape/Space/Enter (actions), câblés en dur.
- `packages/ui-dom/*` + `packages/app/src/ui/*` : menus = **DOM `<button>`** (donc cliquables au doigt) mais **pas dimensionnés touch** (pas de `@media (pointer:coarse)`, pas de cibles 44px garanties).
- `packages/ui-dom/src/game-stage.ts` : `ResizeObserver` → `--ui-scale = min(w/1920, h/1080)` (viewport/échelle, déjà central).
- **Zéro Gamepad API** (confirmé).

**Fondation proposée : une couche d'actions logiques + un tracker de source active.** Les sources d'input brutes (pointeur/tactile, clavier, manette) alimentent un petit ensemble d'**actions logiques** (`select`, `cancel`, `confirm`, `rotate-cam-left/right`, `zoom-in/out`, `pan`, `cycle-target`, `wait`…). Les consommateurs (orchestrateur combat, caméra, menus) écoutent les actions, plus les events bruts.

**Source active « last-input-wins » (first-class).** La couche suit la **dernière source utilisée** (`touch` / `pointer` / `keyboard` / `gamepad`), comme les jeux Steam. Cette source pilote deux choses transverses :
- **Visibilité de l'overlay tactile** : les sticks/boutons on-screen (Lot 1) sont **masqués automatiquement quand la manette (ou clavier/souris) est active**, ré-affichés au premier toucher. Sinon un joueur avec une manette a des sticks parasites à l'écran.
- **Style des prompts** : glyphes **manette** (Kenney) quand la manette pilote, glyphes/hints **tactiles** au doigt, **clavier** au clavier.

- **Cas mobile + manette (first-class, ex. manette USB-C clipsée type Backbone/GameSir)** : c'est exactement « appareil tactile + source `gamepad` active ». La Gamepad API navigateur détecte la manette USB-C/Bluetooth appairée à un téléphone **comme sur desktop** → **zéro code spécial** si (a) la couche est device-agnostique et (b) l'overlay tactile est masquable par la source active. **À tester sur la manette USB-C réelle de l'humain** (Android Chrome OK ; iOS Safari = manettes standard/MFi).
- **Portée core** : cette couche vit côté **rendu/app/view-core**, pas dans `packages/core` (input = UI). Respecte le découplage.

> **Décision à trancher** : poser cette couche *maintenant* (fondation avant Lot 3) ou l'introduire au Lot 2 quand on branche clavier+manette. L'humain a choisi de **démarrer par le Lot 3** ; on peut donc soit (a) faire le Lot 3 sur l'existant puis poser la couche au Lot 2, soit (b) poser une couche minimale d'abord. **Reco** : Lot 3 d'abord sur l'existant (l'UI DOM est déjà tactile-cliquable), poser la couche au Lot 2 — évite de sur-architecturer avant d'en avoir besoin.

## Assets — packs Kenney (CC0, committables)

Tous **CC0 / domaine public** (vérifié 2026-07-24) → OK à committer (respecte l'interdit « assets non libres »). Spritesheets PNG.
- **input-prompts** (64×64, ~1500 fichiers) — glyphes clavier/souris/**touch**/toutes manettes (Xbox, PlayStation, Switch, Steam Deck…). Base des prompts de la config clavier/manette + hints on-screen.
- **input-prompts-pixel-1-bit** (16×16) — variante pixel-art des mêmes glyphes.
- **mobile-controls** (PNG) — boutons on-screen / dpad / HUD tactile. Base de l'overlay de contrôles du Lot 1.
- **cursor-pixel-pack** (180 curseurs 16×16) — curseurs pixel-art.

> **Décision à trancher (style)** : le jeu est **2D-HD full-res** (pixel-art abandonné, décision #486). Le pack **normal 64×64** colle probablement mieux à la chrome actuelle que le **1-bit 16×16**. L'humain a pris les deux → choisir **un** style cohérent avec l'UI (reco : normal 64×64 pour les prompts ; curseur pixel = à évaluer vs le curseur voxel `.glb` in-world déjà en place — le pack curseur est un **curseur d'UI DOM**, pas le curseur de sélection de tuile). Pipeline via agent `asset-manager` (download, découpe spritesheet, atlas/manifest façon `pack-sprites`/`extract-item-icons`).

## Lot 3 — Compléter l'UI *(DÉMARRAGE)*

But : l'UI que verront les joueurs mobiles ramenés par la promo. Items :
- **InfoPanel** : afficher la **nature** (plan 072, `natureOverrides` déjà prêt côté données) ; passe de complétude générale de l'InfoPanel.
- **Info terrain / modificateurs** : afficher les modificateurs de la case (hauteur, terrain, DoT, effets) — backlog « affichage des modificateurs terrain ».
- **Auras** : « 1 rond par aura empilable » au sol (backlog Polish visuel 2D-HD + UI).
- **Preview combat** : previews d'attaque/dégâts/issue lisibles (état actuel à auditer).
- **Info move** : tooltips complets + **tooltips type chart** (efficacités au hover, ex-Phase 9).
- **Responsive** : brancher les pistes overlay restantes — `--stage-scale` pour modales `<dialog>` top-layer, cap ultrawide optionnel, `--ui-scale` barres PV monde.
- **a11y** : passe (headings, aria, focus) + activer le lint a11y Biome HTML/CSS (ex-Phase 9).

> Lot 3 sera détaillé dans un plan dédié (174 ?) au moment de l'attaquer. Certains items sont indépendants (nature, tooltips) et livrables vite ; d'autres (auras, info terrain) touchent au rendu → `best-practices` + refs avant.

## Lot 1 — Contrôles tactiles

But : rendre le combat pilotable au doigt (la douleur n°1).
- **Sélection** : le tap génère déjà un `PointerEvent` → picking OK ; vérifier ergonomie (taille de hit tuile, feedback).
- **Zoom** : **pinch** (2 doigts) — aujourd'hui zoom = molette uniquement.
- **Pan** : **glissé 2 doigts** (le 1 doigt = sélection/drag-pan actuel à arbitrer).
- **Rotation caméra** : **boutons on-screen** (assets mobile-controls Kenney) — aujourd'hui clavier `←/→` seul.
- **Cibles tactiles** : `@media (pointer:coarse)`, cibles ≥44px sur les menus DOM (déjà `<button>`, à redimensionner).
- **Direction picker** : déjà une grande zone de hit plein écran (`directionFromPointer`) → valider au doigt.
- **Overlay masquable dès la conception** : les boutons on-screen doivent être **source-aware** (cachés quand la source active est `gamepad`/clavier, ré-affichés au toucher). Le toggle est piloté par le tracker de source active (Lot 2), mais l'overlay doit exposer ce point d'accroche dès le Lot 1 — **cas mobile + manette USB-C**.

## Lot 2 — Config clavier + manette

But : confort desktop + manette (y compris **sur mobile**).
- **Couche d'input logique + tracker de source active** (cf. Architecture) : actions remappables, `last-input-wins`.
- **Gamepad API** : navigation menus + combat à la manette ; prompts contextuels (glyphes Kenney selon la source active).
- **Source active pilote l'UI** : masque l'overlay tactile (Lot 1) quand la manette/clavier est active, bascule le style des prompts.
- **Écran de config** : remapping clavier + manette, dans Settings.
- **Manette sur mobile (first-class)** : gratuit si la couche est device-agnostique + overlay masquable ; **tester la manette USB-C réelle de l'humain** (Android) + iOS Safari.

## Séquence

**Lot 3 (UI) → Lot 1 (tactile) → Lot 2 (clavier/manette).**
(L'humain a choisi Lot 3 en premier. La couche d'input est posée au Lot 2, sauf si le Lot 1 en a besoin pour le tactile — à réévaluer à l'entame du Lot 1.)

## Hors périmètre (restent où ils sont)

- Multijoueur, écran victoire enrichi, speed controls, **tutoriel interactif** → Phase 7.
- Masquer objet ennemi (info cachée) → Phase 7 / backend matchmaking.
- Son/Musique, auto-save, décors → Phase 9.
- Éditeur de niveau → Phase 6.

## Décisions à trancher

**Niveau plan-cadre (peuvent être tranchées maintenant) :**
1. **Style Kenney** : normal 64×64 vs pixel 1-bit 16×16 (reco : **normal 64×64** pour les prompts, cohérent 2D-HD full-res). Curseur pixel-pack : curseur d'**UI DOM** (le curseur de sélection de tuile in-world reste le voxel `.glb` existant, sauf choix visuel contraire).
2. **Couche d'input** : minimale dès maintenant vs au Lot 2 (reco : **Lot 2** — l'UI DOM est déjà tactile-cliquable, ne pas sur-architecturer).
3. **Ordre interne du Lot 3** (reco : **quick-wins d'abord**) — nature InfoPanel + tooltips type chart (indépendants, faible risque) **puis** auras + info terrain (touchent au rendu → `best-practices` + refs 2D-HD avant).

**Renvoyées au plan détaillé du Lot 3 (plan 174), car elles cadrent son scope :**
4. **Modificateurs terrain / DoT / auras — affichage InfoPanel (liste des effets/hazards actifs) vs rendu (icônes/anneaux sur les tuiles) vs les deux ?** Détermine la complexité et le moment d'appeler `best-practices` (tout ce qui touche le rendu Babylon).
5. **Responsive `--stage-scale` (modales `<dialog>` top-layer)** : fondation à poser en tête du Lot 3, ou nice-to-have en fin de Lot 3 ?
6. **Cible min-width responsive** du design Lot 3 (ex. 320px mobile) — contrainte à fixer pour l'InfoPanel élargi (nature + terrain + auras).
7. **Découpe des packs Kenney** : ~1500 fichiers input-prompts — quels device/glyphes garde-t-on ? (via `asset-manager` + validation humaine à l'entame.)

## Gate & process

- Chaque lot = son plan détaillé + gate CI full + human-testing (mobile réel pour Lot 1/2).
- `best-practices` + refs avant tout chantier rendu non trivial (auras, info terrain).
- Assets Kenney via `asset-manager`.
