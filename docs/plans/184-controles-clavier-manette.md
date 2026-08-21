# Plan 184 — Contrôles clavier & manette (Lot 2)

> **Statut** : done (2026-08-21 — étapes A→E livrées, gate local vert, **validé à la main** : clavier, manette Switch Pro, téléphone, téléphone + manette)
> **Créé** : 2026-08-20
> **Phase** : 6.5 « Client jouable », Lot 2 (clavier / manette) — **dernier lot de la phase**
> **Cadre** : `docs/plans/173-phase-client-jouable-ui-controles.md` § « Lot 2 — Config clavier + manette » + § « Architecture — couche d'input device-agnostique »
> **Recherche préalable** : WebSearch 2026-08-20 (Gamepad API : polling rAF, geste utilisateur requis, deadzone circulaire, `mapping === "standard"` ; pattern *last-input-wins* ; `KeyboardEvent.code` vs `key` et l'API Keyboard Map) — sources en fin de document.

## Motivation

Les Lots 3 (UI) et 1 (tactile) sont clos. Ce lot ferme la phase, et il ne s'agit pas d'un confort marginal : **au clavier seul, le combat n'est pas jouable**, et à la manette il ne l'est pas du tout.

Cartographie vérifiée dans le code le 2026-08-20 :

| Interaction | Souris | Doigt (plan 183) | Clavier | Manette |
|---|---|---|---|---|
| Déplacer le curseur / inspecter une case | `pointermove` → `applyHover` | 1er tap | ❌ **rien** | ❌ |
| Sélectionner une case | `pointerup` → `pickTile` | tap | ❌ **rien** | ❌ |
| Menu d'actions / liste d'attaques | clic | tap | ⚠️ `Tab` natif, sans liseré ni ordre pensé | ❌ |
| Confirmer | clic | tap | ✅ Espace / Entrée | ❌ |
| Annuler | bouton « Annuler » | bouton « Annuler » | ✅ Échap | ❌ |
| Cible suivante (multi-cibles) | survol | tap | ✅ `Tab` / `Maj+Tab` | ❌ |
| Rotation caméra | ❌ | boussole tapable | ✅ ←/→ | ❌ |
| Zoom | molette | pinch | ❌ | ❌ |
| Pan caméra | glissé | glissé | ❌ | ❌ |

Le trou central est le **curseur** : il n'existe que comme conséquence d'une position de pointeur (`onTileHover`) ou d'un tap. Sans pointeur, il n'y a aucun moyen de désigner une case — donc ni inspection, ni déplacement, ni attaque. Tout le Lot 3 (InfoPanel, panneau de case, prévision de combat) est invisible au clavier pour la même raison qu'il l'était au doigt avant le plan 183.

Trois autres dettes convergent ici, toutes explicitement renvoyées à ce lot :

1. **Input dispersé** — 5 `window.addEventListener("keydown")` dans 4 fichiers (`combat-scene.ts:812`, `combat-screen.ts:374`, `placement-flow.ts:326`, `elements.ts:44`, plus `map-select-screen.ts:101`), sans notion de contexte : chacun teste `event.key` et devine s'il est concerné. `combat-scene.ts:517` doit déjà appeler `stopImmediatePropagation()` pour empêcher qu'un seul Échap annule **et** défasse un placement — symptôme d'une absence d'arbitrage central.
2. **Focus perdu au re-rendu** (rapatrié du Lot 3, décision #752) — `settings-screen.ts` fait `root.remove()` + `render()` à chaque bascule ; `battle-chrome.ts` fait `menu.replaceChildren(...)` à chaque phase. Dans les deux cas le focus retombe sur `<body>`. Ce n'est pas une faveur d'accessibilité : c'est ce qui rend la navigation clavier/manette impossible en pratique.
3. **Dette du plan 183** — les gestes tactiles (table de pointeurs, seuils, pinch, arbitrage tap/glissé) sont codés **en direct** dans `combat-scene.ts`. Le plan 183 dit : le Lot 2 devra les **rapatrier**, pas les envelopper.

Enfin, un constat de style : il n'existe **qu'une seule** règle `:focus-visible` dans tout le CSS (`battle-chrome.css:279`, les lignes d'attaque). Un focus invisible est un focus inutilisable.

## Acquis — à ne pas retoucher

- **Les menus sont déjà des `<button>`** (`battle-chrome.ts:125` `button()`, `elements.ts:22` `menuButton()`) : focusables et activables au clavier par construction. La navigation manette n'a donc pas à réinventer une pile de widgets — elle pilote le focus DOM réel (décision humaine, § Décisions).
- **`BattleInstruction` + la ligne d'instruction** (plan 183 / chantier glyphes) : le point d'accroche pour dire *comment* agir existe déjà, glyphe compris (`input-prompt-glyph.ts`).
- **La feuille Kenney `input-prompts-pixel-1-bit` est intégrée** (16×16, CC0, `packages/app/public/assets/ui/input-prompts/tilemap-1bit.png`) et documentée tuile par tuile : `docs/references/kenney-input-prompts-tileset.md`. Les lignes 0-1 et 2-5 portent les boutons A/B/X/Y et les touches clavier, les lignes 18-23 les manettes. **Rien à télécharger, rien à découper.**
- `TilePointerSource` (`"pointer" | "touch"`) circule déjà du renderer vers l'orchestrateur (plan 183) : le canal « d'où vient ce press » existe, il suffira de l'élargir.
- La caméra se recentre seule sur le Pokemon actif à chaque tour (`battle-orchestrator.ts:518` → `panCameraTo`) : un curseur clavier n'a donc pas à gérer « où suis-je » au changement de tour.

## Décisions humaines (2026-08-20)

1. **Pas d'écran de remapping dans ce lot.** Bindings **fixes**, documentés. Le remapping complet (clavier **et** manette : capture de touche, persistance, détection de conflits, glyphes par binding) part dans un **plan dédié** immédiatement après celui-ci. Motif : rendre le jeu jouable à la manette d'abord ; l'UI de config est un chantier à part entière qui n'a de sens qu'une fois la couche d'actions posée.
2. **Curseur du plateau sur les flèches ↑↓←→ *et* ZQSD** (les deux, pas l'un ou l'autre). La rotation caméra quitte donc les flèches → `A` / `E`, qui encadrent le pavé ZQSD en AZERTY sans le recouvrir.
3. **Navigation des menus = focus DOM natif.** La manette et les flèches déplacent le focus réel (`:focus-visible` pour le liseré), Entrée / A active. Pas de curseur maison à index. Motif : réutilise les `<button>` existants, un seul état à maintenir, et le harnais e2e peut l'asserter directement (`toBeFocused`).
4. **Bindings clavier par position physique de touche, pas par caractère produit** (`KeyboardEvent.code`, pas `.key`). Un seul jeu de bindings sert AZERTY et QWERTY sans table par disposition. Détail et limites : § « Bindings par position ».
5. **La couche d'actions logiques vit dans `packages/app/src/input/`** — pas de nouveau package. L'app est la racine de composition (elle possède le canvas via `game-stage`, elle câble orchestrateur + scène). Le port `CombatScene` gagne les primitives caméra/curseur ; le renderer ne garde que le picking et la caméra. Extractible en package plus tard si un second renderer arrive.

## Périmètre

**Dans ce lot :**

- Couche d'actions logiques + tracker de source active (*last-input-wins*) dans `packages/app/src/input/`.
- Curseur de plateau piloté au clavier et à la manette (le trou central).
- Navigation clavier/manette des menus de combat **et** des écrans DOM, focus qui survit au re-rendu.
- Gamepad API : polling, détection de front, deadzone, `mapping === "standard"`.
- Liseré de focus visible (token de design), glyphes de prompt clavier/manette selon la source active.
- Rapatriement des gestes tactiles de `combat-scene.ts` derrière la couche (dette plan 183).

**Hors de ce lot :**

- **Écran de remapping** → plan dédié suivant (décision 1).
- Overlay de contrôles tactiles on-screen (sticks/boutons dessinés) : **n'existe pas** — le plan 183 a tranché en faveur des gestes directs plutôt que d'un overlay. Le point d'accroche « masquer l'overlay quand la manette est active » du plan-cadre 173 est donc **sans objet** ; ce qui reste vrai, c'est le basculement des **glyphes de prompt**, qui est bien dans ce lot.
- `cursor-pixel-pack` (curseurs d'UI DOM pixel-art) : toujours non intégré, toujours non nécessaire. Sort du périmètre — à rouvrir seulement si le liseré de focus ne suffit pas.
- Raccourcis « confort desktop » nouveaux (avance rapide, journal au clavier, réglages) : rien qui n'existe pas déjà comme action.

## Architecture

```
packages/app/src/input/
  logical-action.ts     # l'énumération des actions + le type d'événement
  input-source.ts       # tracker last-input-wins (pointer | touch | keyboard | gamepad)
  keyboard-source.ts    # KeyboardEvent → action logique (table de bindings fixes)
  gamepad-source.ts     # polling rAF + fronts + deadzone → action logique
  pointer-source.ts     # gestes souris/doigt (rapatriés de combat-scene.ts, étape E)
  input-router.ts       # contexte actif → qui consomme l'action
  index.ts
```

### Les actions logiques

```ts
export const LogicalAction = {
  CursorUp, CursorDown, CursorLeft, CursorRight,   // écran-relatif, voir ci-dessous
  Confirm, Cancel,
  CycleTargetNext, CycleTargetPrevious,
  RotateCameraLeft, RotateCameraRight,
  ZoomIn, ZoomOut,
  MenuNext, MenuPrevious,                          // focus dans le menu courant
} as const;
```

Les consommateurs écoutent des actions, plus des events bruts. Trois consommateurs seulement : l'**orchestrateur** (`Confirm`/`Cancel`/`CycleTarget*`), la **scène** (caméra + curseur), le **focus DOM** (`MenuNext`/`MenuPrevious`).

### ⚠️ Le curseur est écran-relatif, pas grille-relatif

La caméra iso tourne par **quarts de tour** : `AZIMUTH_STEP = Math.PI / 2` (`packages/view-core/src/constants.ts:40`), **4 azimuts** seulement (`isometric-camera.ts:26`, décision #476). « ↑ » doit déplacer le curseur **vers le haut de l'écran**, pas vers `y-1` de la grille — sinon après une rotation les flèches deviennent incohérentes avec ce qu'on voit. La conversion (azimut caméra → direction de grille) se fait **dans la scène**, qui connaît l'azimut, pas dans l'app.

✅ **Et comme il n'y a que 4 azimuts, « haut de l'écran » tombe toujours exactement sur un des 4 axes de grille** : une simple permutation par azimut, pas d'arrondi, pas de diagonale, aucune gestion de 8 directions à écrire. (Un précédent état de ce plan disait « crans de 45° » — c'était faux, et l'erreur aurait fait sur-concevoir cette conversion.)

→ Le port reçoit `moveCursor(screenDirection)`, pas `setCursorTile(x, y)`.

### Ajouts au port `CombatScene`

| Méthode | Pourquoi |
|---|---|
| `moveCursor(direction: ScreenDirection): void` | Déplace le curseur d'une case dans la direction **écran**, clampé à la grille, et émet le `onTileHover` correspondant (le même chemin que le survol souris — donc InfoPanel, panneau de case et prévision suivent gratuitement). |
| `cursorTile(): TilePick \| null` | Ce que `Confirm` doit valider. |
| `rotateCamera(step: -1 \| 1): void` | Aujourd'hui interne à `onKeyDown` (`isoCamera.rotateByStep`). |
| `zoomCamera(step: -1 \| 1): void` | Aujourd'hui interne à `onWheel` (`isoCamera.zoomByWheel`). |
| `setZoomLevel(index: number): void` | Zoom absolu (touches `1`/`2`/`3`). `IsometricCamera` garde déjà son `zoomIndex` privé et la table `ZOOM_LEVELS` : il ne manque que l'entrée qui pose l'index au lieu de l'incrémenter (clampée comme `zoomByWheel` le fait). |

`panCameraTo(tile)` existe déjà et sert au recentrage — rien à ajouter pour le pan.

Le `keydown` de rotation caméra (`combat-scene.ts:523-527`) **disparaît** du renderer : il devient une action logique routée par l'app. Le `wheel` reste **où il est** (il est déjà scopé au canvas pour ne pas voler la molette aux panneaux DOM défilables — cf. le commentaire ligne 813 : une scène embarquée, comme l'aperçu du choix de carte, ne doit pas la capter).

### Routage par contexte

L'arbitrage central que les 5 `keydown` dispersés n'ont pas. Le contexte se déduit de la phase de l'orchestrateur :

| Contexte | Quand | ↑↓←→ / ZQSD / croix / stick | Confirm | Cancel |
|---|---|---|---|---|
| `menu` | `action_menu`, `attack_submenu` | focus DOM dans le menu | active le bouton focalisé | remonte d'un cran (`onEscape`) |
| `board` | `select_move_destination`, `select_attack_target`, `confirm_attack`, `select_retreat_target`, `select_direction` | curseur de plateau | valide la case sous le curseur | `onEscape` |
| `screen` | hors combat (menus DOM) | focus DOM dans l'écran | active | retour (`bindEscape`) |
| `locked` | `animating`, `battle_over` | rien | rien | rien (le dialogue de victoire a son propre focus) |

`InputState` est privé dans `battle-orchestrator.ts`. → nouvel accesseur étroit `inputContext(): "menu" | "board" | "locked"` (dérivé de la phase, pas une nouvelle source de vérité), plus un `onInputContextChanged` pour que le routeur sache quand le contexte bascule sans interroger à chaque touche.

**Cas particulier du placement** : `placement-flow.ts` a son propre Échap (défaire) et son propre `onTileClick`. Il devient un consommateur de plus (contexte `board`, `Cancel` = défaire), ce qui supprime le `stopImmediatePropagation()` de `combat-scene.ts:517` — l'arbitrage devient explicite au lieu d'être un ordre d'écoute.

**Un seul consommateur par (contexte, action) — pas de priorité à arbitrer.** Le placement et le combat ne coexistent jamais : `placement-flow.ts` appelle `finish()` (qui retire son propre `keydown`) **avant** que l'orchestrateur ne démarre, et l'orchestrateur ne quitte `animating` qu'après. Le routeur n'a donc pas à trancher entre deux candidats pour un même `Cancel` : il a **une** cible par contexte, et le contexte de placement est distinct de `board`.

⚠️ **C'est un invariant, pas une évidence** : il doit être couvert par un test (une action logique n'atteint jamais deux consommateurs), sinon un futur mode « replacer en cours de combat » réintroduirait silencieusement l'ambiguïté que le `stopImmediatePropagation()` masquait.

**⚠️ Perte assumée : pas d'inspection du plateau pendant `action_menu` / `attack_submenu`** (décision humaine, 2026-08-20). À la souris, survoler un ennemi pendant ces deux phases peint ses cases atteignables — la lecture des menaces avant de choisir Bouger/Attaquer (`updateEnemyRangeHover`, `battle-orchestrator.ts:359-394`, phases `action_menu`, `select_move_destination`, `attack_submenu`). Au clavier/manette les flèches vont au menu, donc cette lecture est perdue sur les deux phases de menu (elle reste disponible sur `select_move_destination`, qui est en contexte `board`).

Options écartées : une bascule d'inspection (`Tab` / `Y`) en bascule ou en maintien — les deux ajoutaient un mode à comprendre pour une lecture qu'on peut obtenir en sortant du menu. À rouvrir si le test montre que ça manque vraiment ; le point d'accroche existe (le curseur est gelé, pas détruit, donc une bascule serait peu coûteuse à ajouter plus tard).

**Curseur gelé, pas effacé, en contexte `menu`.** Ouvrir le menu d'actions au clavier ne doit pas perdre la position du curseur : il reste affiché à sa case, les flèches pilotent alors le focus du menu, et il repart d'où il était au retour en contexte `board`. Le remettre à zéro forcerait à re-traverser la carte à chaque aller-retour menu ↔ plateau.

### Tracker de source active

`last-input-wins` : la source active est celle du dernier input **délibéré** (pas de debounce temporel — un `pointermove` parasite ne compte pas, un press oui ; un axe manette sous la deadzone non plus).

🔴 **« Parasite » doit être un filtre écrit, pas une intention.** Chrome émet un `pointermove` de delta **0** au `pointerdown` — constaté sur cette stack précise (forum Babylon.js : « Google Chrome started firing pointermove events for pointerdown »). Sans filtre explicite, un simple appui suffirait à faire repasser la source sur `pointer` juste après une entrée clavier/manette, et les glyphes de prompt se remettraient à clignoter sur la mauvaise modalité. Le filtre : comparer aux **dernières coordonnées connues** et ignorer un mouvement nul — ne pas se fier à `movementX/movementY`, dont le comportement varie selon le verrouillage du pointeur.

Elle est publiée de deux façons :

- `data-input-source="pointer|touch|keyboard|gamepad"` sur la racine du stage → le CSS choisit le glyphe et l'affichage du liseré sans re-rendu JS.
- Un observateur pour l'unique décision JS : quel glyphe de prompt afficher dans la ligne d'instruction.

Le module `input-prompt-glyph.ts` choisit aujourd'hui souris vs doigt en pur CSS (`@media (pointer: coarse)`). On **garde** ce média comme **valeur par défaut** et on laisse `[data-input-source]` la surcharger : brancher une manette sur un téléphone doit basculer les glyphes, sans casser le cas « aucune source encore observée » au premier affichage.

## Bindings par position (`code`), pas par caractère (`key`)

`KeyboardEvent.key` donne le **caractère produit** (dépend de la disposition), `KeyboardEvent.code` donne la **touche physique** — indépendant de la disposition, de la locale et des modificateurs. Les noms de `code` sont libellés d'après les légendes **QWERTY** mais désignent des **positions** : `"KeyW"` est « la touche qui porte W en QWERTY », c'est-à-dire **Z en AZERTY**.

C'est le pattern standard des jeux web, et il résout tout seul le problème AZERTY/QWERTY : une seule table de bindings, pas de détection de disposition, pas de doublon `ZQSD || WASD`.

### La table

| `code` | AZERTY | QWERTY | Action |
|---|---|---|---|
| `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight` | ↑↓←→ | ↑↓←→ | Curseur de case (contexte `board`) / focus (contextes `menu`, `screen`) |
| `KeyW` / `KeyA` / `KeyS` / `KeyD` | **Z Q S D** | **W A S D** | Idem — le pavé de déplacement, à la position attendue dans les deux dispositions |
| `KeyQ` / `KeyE` | **A** / **E** | **Q** / **E** | Rotation caméra −90° / +90° (un des 4 azimuts iso) |
| `Digit1` / `Digit2` / `Digit3` (+ `Numpad1-3`) | 1 / 2 / 3 | 1 / 2 / 3 | Zoom **absolu** : les 3 crans de `ZOOM_LEVELS` (`[0.7, 1.1, 1.8]`) directement |
| `KeyR` / `KeyF` | R / F | R / F | Zoom **relatif** : un cran plus près / plus loin |
| `Space` / `Enter` / `NumpadEnter` | Espace / Entrée | Espace / Entrée | Confirmer |
| `Escape` | Échap | Échap | Annuler |
| `Tab` (+ `shiftKey`) | Tab | Tab | Cible suivante / précédente (existant, inchangé) |
| `PageUp` / `PageDown` | idem | idem | Défiler le **journal de combat** |
| `Maj` + `PageUp` / `PageDown` | idem | idem | Défiler la **timeline CT** |

Aucun conflit : `KeyA` (curseur gauche) et `KeyQ` (rotation gauche) sont deux touches physiques distinctes — voisines dans les deux dispositions, ce qui est l'agencement habituel du genre (validé humain, 2026-08-20).

### Le zoom : 3 crans, donc 3 touches — et pas `+` / `−`

`ZOOM_LEVELS` ne compte que **3 valeurs** (`[0.7, 1.1, 1.8]`, défaut au milieu). Un zoom à 3 crans n'a pas besoin d'un axe incrémental : `1` / `2` / `3` désignent **directement** le cran voulu (décision humaine, 2026-08-20), et `R` / `F` gardent le pas relatif pour qui préfère tâtonner. Les deux coexistent sans conflit.

⚠️ **`+` / `−` étaient un piège**, écartés : en AZERTY la position `Minus` porte `)` et la position `Equal` porte `=` — binder ces positions donnerait « zoomer avec la parenthèse fermante ». Binder le **caractère** `"+"` aurait marché, mais aurait introduit une seconde façon de lire une touche pour une seule paire de bindings.

Et le chiffre est un **argument de plus pour `code`** : en AZERTY la rangée du haut ne produit des chiffres qu'avec `Maj` (une frappe nue donne `& é " '`). `event.key === "1"` exigerait donc `Maj+&` en AZERTY ; `code === "Digit1"` est l'appui nu, dans les deux dispositions.

**Conséquence : tous les bindings du lot se lisent sur `code`, sans exception.** La règle « position pour le déplacement et les actions, caractère pour une touche-symbole » reste écrite ici comme garde-fou pour un binding futur — mais **aucun chemin `key` n'est implémenté**, ce serait du code jamais exécuté.

### ⚠️ Afficher un libellé de touche est un problème non résolu par le web

Binder par position est facile ; **dire au joueur quelle touche appuyer** ne l'est pas. `code` vaut `"KeyW"`, et afficher « W » à quelqu'un dont la touche porte « Z » est faux.

L'API prévue pour ça — `navigator.keyboard.getLayoutMap()` (Keyboard Map) — est **Chromium uniquement** (Chrome 69+, Edge 79+, Chrome Android), **absente de Firefox et de Safari**, et porte une **position standard négative** d'au moins un vendeur : elle ne deviendra pas Baseline. Le navigateur de l'humain étant Firefox, elle ne sert même pas à valider le résultat en local.

**Conséquence assumée pour ce lot : aucun prompt ne nomme une lettre.**

- Le curseur se marche aussi bien aux **flèches** → le glyphe de prompt montre les **flèches** (Kenney en a, et elles sont identiques dans toutes les dispositions).
- La rotation a déjà son **glyphe d'anneau fléché** sur la boussole (chantier précédent) — aucun libellé de touche à écrire.
- `ZQSD`/`WASD`, `A`/`E` restent des raccourcis **non annoncés** dans l'UI : découvrables par convention du genre, documentés au cahier de recette et dans le futur écran de remapping.

Le problème du libellé est donc **déplacé, pas ignoré** : il appartient au plan de remapping, qui doit de toute façon afficher une table de bindings. Piste à instruire là-bas (pas ici) : apprentissage opportuniste — chaque `keydown` livre `code` **et** `key` ensemble, donc la correspondance de la disposition réelle se construit à l'usage et se met en cache, `getLayoutMap()` servant seulement d'accélérateur là où elle existe.

## Mapping manette (`mapping === "standard"`, indices W3C)

| Entrée | Index | Action |
|---|---|---|
| Croix directionnelle | 12-15 | Curseur / focus (avec répétition : délai initial puis cadence) |
| Stick gauche | axes 0-1 | Idem, en pas discrets (un cran par franchissement de deadzone, pas un défilement continu) |
| A | 0 | Confirmer |
| B | 1 | Annuler |
| X | 2 | Cible suivante (l'équivalent de Tab) |
| LB / RB | 4 / 5 | Rotation caméra −90° / +90° (un des 4 azimuts iso) |
| LT / RT | 6 / 7 | Zoom − / + (relatif ; pas d'équivalent manette au zoom absolu — 3 crans se parcourent en 2 pressions au pire) |
| Stick droit | axes 2-3 | Pan caméra libre |

| `Y` **maintenu** + croix ↑/↓ | 3 + 12/13 | Défiler le journal de combat |
| `Y` **maintenu** + croix ←/→ | 3 + 14/15 | Défiler la timeline CT |

Start/Select (8-9) laissés **libres** : rien à leur donner qui ne soit pas déjà atteignable, et un binding gratuit est du bruit pour le futur écran de remapping. `Y` sert de **modificateur maintenu** plutôt que de bascule — pas de mode dans lequel on puisse rester coincé.

### Les deux zones défilables (décision humaine, 2026-08-20)

La timeline CT (`turn-timeline.css:36-44`) et le journal de combat (`battle-log.css:132`) défilent aujourd'hui **à la molette et au glissé uniquement** ; aucune n'a de `tabindex`, donc ni le clavier ni la manette ne les atteint. Un joueur clavier ne voit jamais au-delà des ~11 premières entrées de l'ordre CT prédit.

Retenu : **bindings dédiés** (table ci-dessus), 4 actions logiques (`ScrollLogUp/Down`, `ScrollTimelineUp/Down`), la vue exposant un port de défilement par zone.

Écarté : rendre les deux zones focalisables (`tabindex="0"`) et laisser le défilement natif du navigateur opérer quand elles ont le focus. Plus économe en bindings, mais ça insère deux arrêts de tabulation dans un HUD de combat et fait dépendre le défilement de qui a le focus — moins direct à piloter.

### Gotchas Gamepad API (recherche 2026-08-20)

1. **Aucun event de bouton n'existe** (seuls `gamepadconnected`/`disconnected`). Il faut **poller** dans une boucle `requestAnimationFrame` et **détecter les fronts** soi-même (`pressed` maintenant && !`pressed` avant) — sinon un appui vaut N actions, une par frame.
2. **`navigator.getGamepads()` renvoie une liste vide jusqu'au premier geste manette** sur la page focalisée (exigence de la spec W3C, protection contre le *fingerprinting*). Conséquence directe : impossible d'afficher « manette détectée » avant que le joueur ait appuyé. La source `gamepad` ne peut donc devenir active qu'à partir du premier appui — ce qui tombe bien, c'est exactement *last-input-wins*.
3. **Deadzone circulaire, pas par axe** : `Math.hypot(x, y) < DEADZONE`, sinon une poussée diagonale déclenche deux directions et le curseur part en escalier.
4. **Filtrer `mapping === "standard"`** avant de croire aux indices de boutons. Une manette non standard tombe dans le futur écran de remapping, pas dans un devinage d'indices.
5. **La boucle de polling ne tourne que quand elle sert** : démarrée au premier `gamepadconnected`, arrêtée quand plus aucune manette n'est branchée. Pas de rAF permanent en plus de la boucle de rendu Babylon.
6. 🔴 **Les objets `Gamepad`/`GamepadButton` sont mutés en place par Chrome à chaque frame.** Garder une **référence** à l'objet de la frame précédente pour comparer `pressed` avant/après compare donc l'objet avec lui-même : la détection de front ne marche **jamais**, sans erreur ni symptôme lisible. Il faut copier les **valeurs primitives** (`pressed`, `value`) dans un tableau propre à chaque frame. C'est le piège d'implémentation le plus coûteux de l'étape D — à écrire dans le code, pas seulement ici.
7. ⚠️ **Firefox ne renvoie pas `mapping === "standard"` pour toute manette standard** : il retourne une chaîne **vide** pour tout contrôleur absent de sa table interne, même physiquement conforme (Bugzilla #952773, #1542893), et des mappings faux existent encore sur des manettes reconnues (DualSense, #1922925). Conséquence directe : sur Firefox — **le navigateur de l'humain** — une manette réelle peut être **silencieusement invisible**, sans écran de remapping pour s'en sortir (hors périmètre). À écrire au cahier de recette comme **limite connue**, pas à corriger dans ce lot. Si ça tombe pendant le human-testing, tester aussi sous Chromium avant de conclure à un bug de notre code.

## Étapes

### A — Couche d'actions + tracker de source (fondation)

Deux morceaux :

1. `logical-action.ts`, `input-source.ts`, `input-router.ts` dans `packages/app/src/input/`.
2. **L'accesseur de contexte sur l'orchestrateur** (`packages/view-core/src/battle-orchestrator.ts`) : `inputContext(): "menu" | "board" | "locked"` dérivé des 9 phases de `InputState` (privé, il reste privé), plus `onInputContextChanged` pour notifier la bascule. Sans lui le routeur ne sait rien router — c'est la moitié de la fondation, pas un détail d'une étape ultérieure.

⚠️ **La couche n'est branchée sur aucun consommateur à cette étape** — elle est construite et couverte en unit, rien de plus. Pas de « double chemin » transitoire où la couche et les `keydown` existants traiteraient la même touche : une action jouée deux fois (deux crans de rotation, deux annulations) serait un bug invisible en lecture de diff. Le basculement se fait d'un coup à l'étape B, listener par listener.

Tests unit : routeur (table contexte × action), tracker (séquences de sources), `inputContext()` pour les 9 phases.

### B — Clavier : curseur de plateau + rotation/zoom

Port : `moveCursor`, `cursorTile`, `rotateCamera`, `zoomCamera`. Le `keydown` de rotation quitte `combat-scene.ts`. Les 5 `keydown` dispersés sont **remplacés** par la couche (pas doublés) : `combat-screen.ts`, `placement-flow.ts`, `elements.ts` (`bindEscape`), `map-select-screen.ts`. Le `stopImmediatePropagation()` de `combat-scene.ts:517` disparaît.

La table de bindings est un objet `Record<code, LogicalAction>` unique — c'est elle que le futur écran de remapping viendra réécrire.

Filet de transition : les 4 actions clavier qui existent déjà (Échap, Espace/Entrée, Tab, ←/→) ont chacune des e2e. Elles doivent rester vertes **listener par listener**, avant de passer au suivant — sauf ←/→ qui change de rôle assumé (rotation → curseur) et dont les e2e sont réécrites en même temps.

**Résultat attendu à l'écran** : au clavier seul, les flèches (ou `ZQSD` en AZERTY / `WASD` en QWERTY, mêmes positions physiques) déplacent le curseur FFTA de case en case — l'InfoPanel, le panneau de case et la prévision de combat suivent comme au survol souris. `A`/`E` (AZERTY) ou `Q`/`E` (QWERTY) font tourner la vue d'un quart de tour (4 azimuts iso). Espace valide la case sous le curseur.

### C — Focus : liseré visible + survie au re-rendu

1. **Liseré** : une règle `:focus-visible` globale (token de design, `docs/design-system.md`). Aujourd'hui il n'y en a **qu'une** dans tout le CSS (`battle-chrome.css:279`, les lignes d'attaque) — un focus invisible est un focus inutilisable.

   ⚠️ **Ne pas gater ce liseré sur `[data-input-source]`.** C'est exactement le travail que `:focus-visible` fait déjà, avec l'heuristique du navigateur (qui connaît la dernière modalité d'interaction, y compris pour un focus posé par script). Ajouter un `[data-input-source="pointer"] :focus-visible { outline: none }` par-dessus **casserait** un cas réel : cliquer un bouton puis naviguer au clavier — le navigateur montrerait le liseré, notre CSS le retirerait jusqu'au prochain `keydown`. On s'appuie sur le natif ; notre tracker de source ne sert qu'à décider **si on pose le focus par script** (point 3), pas à peindre.
2. **`settings-screen.ts`** : ne plus reconstruire le sous-arbre pour changer un libellé. Les 3 bascules (Langue, Prévisualisation dégâts, Plein écran) mettent à jour **leur propre texte** ; le `render(host)` complet ne reste que pour un changement de langue (qui retraduit tout l'écran) et **restaure alors le focus** sur la ligne d'origine.
3. **`battle-chrome.ts`** : `menu.replaceChildren(...)` reste (le menu change vraiment de contenu à chaque phase), mais quand la source active est `keyboard`/`gamepad`, le premier bouton du nouveau menu **prend le focus**. Au pointeur, personne ne prend le focus — sinon un liseré apparaîtrait sous la souris.
4. `MenuNext`/`MenuPrevious` déplacent le focus dans le menu courant (ordre DOM, bouclé, en sautant les `disabled` — « Objet » et « Statut » le sont).

**Choix assumé sur les patterns ARIA : ni *roving tabindex*, ni `role="menu"`.** Les deux référentiels divergent selon le cadrage — web.dev tient le *roving tabindex* pour de la sur-ingénierie sur un groupe de `<button>` natifs, l'APG W3C (patterns Toolbar / Menu) veut un **arrêt de tabulation unique** pour un groupe qui se présente comme un seul widget. On garde l'hybride : **Tab reste séquentiel** (chaque bouton est un arrêt, comme aujourd'hui) et **les flèches sont un raccourci en plus**. Motif : `role="menu"`/`menuitem"` supposent une interaction entièrement au clavier et conviendraient mal à un HUD de combat persistant, et le support lecteur d'écran n'est pas visé (décision #752). C'est un choix, pas un oubli — ne pas « corriger » vers un roving tabindex sans raison nouvelle.

### D — Manette

`gamepad-source.ts` : polling rAF, fronts, deadzone circulaire, `mapping === "standard"`, répétition de la croix. Branchée sur les mêmes actions logiques que le clavier — aucune logique de jeu nouvelle, donc rien à re-décider.

**Glyphes de prompt** : la ligne d'instruction affiche le bouton A (ou la croix pour les phases directionnelles) au lieu de la souris/main quand la manette est active. Le choix des tuiles Kenney suit la leçon du chantier précédent (`docs/references/kenney-input-prompts-tileset.md`) : **choisir sur la scène réelle, pas sur la planche d'aperçu** — la tuile qui *paraît* juste sur la feuille s'est déjà révélée fausse une fois. Donc : proposition en capture, validation humaine, puis figée dans le tableau du fichier de référence.

### E — Rapatriement des gestes tactiles (dette plan 183)

**Déplacement, pas enveloppe** (exigence explicite du plan 183). Les ≈180 lignes de `combat-scene.ts` (`onPointerDown/Up/Move/Cancel`, la `Map<pointerId>`, les seuils `BABYLON_PICK_DRAG_THRESHOLD_*`, le pinch, l'arbitrage tap/glissé) sont **coupées** de `combat-scene.ts` et **collées** dans `pointer-source.ts`, qui lie ses écouteurs sur le canvas — l'app le possède déjà (`game-stage` le crée, `combat-screen.ts:786` le passe à la scène). Fin de l'étape : plus aucun `addEventListener("pointer*")` dans `render-babylon`. Si un adaptateur subsiste dans le renderer, l'étape est ratée, pas terminée.

Le renderer ne garde que ce qui exige la scène : `pickTile`, le hit-test de la boussole, `directionFromPointer`, et les opérations caméra.

**Le tap sur la boussole passe aussi par la couche.** Il appelle aujourd'hui `isoCamera.rotateByStep(1)` en direct (`combat-scene.ts:679`). Il doit émettre `RotateCameraRight` comme n'importe quelle autre entrée — sinon la source active ne bascule pas et les glyphes de prompt restent sur la modalité précédente. Même remarque pour le pinch (→ `ZoomIn`/`ZoomOut`) : la scène exécute, elle ne décide plus.

**En dernier, volontairement** : le tactile a été validé sur téléphone réel il y a un jour, et c'est le comportement le plus coûteux à revalider. On le déplace une fois la couche prouvée par le clavier et la manette, avec pour filet les ~419 tests e2e (dont `tapTile`) — et **une revalidation sur téléphone réel obligatoire** avant le commit définitif (cf. mémoire « WIP commit + re-test avant final » : la chaîne de finalisation a déjà écrasé un rendu validé une fois).

Si l'étape E dérape (régression tactile non triviale), elle est **coupable du plan** : on livre A-D et la dette reste notée. Les étapes A-D n'en dépendent pas.

## Tests

- **Unit** (`packages/app`) : routeur (contexte × action → consommateur), tracker de source (séquences), table de bindings clavier, `gamepad-source` (fronts sur snapshots de `Gamepad` factices, deadzone circulaire, filtre `standard`).
- **Unit `view-core`** : `inputContext()` pour chacune des 9 phases de `InputState`.
- **Unit d'invariant** : une action logique n'atteint **jamais** deux consommateurs (le garde-fou qui remplace le `stopImmediatePropagation()` supprimé).
- **e2e** (`test-writer`) : au clavier — déplacer le curseur et vérifier que l'InfoPanel de la case suit ; naviguer le menu d'actions aux flèches et vérifier `toBeFocused` ; bascule d'un réglage et vérifier que le focus **reste** sur la ligne ; rotation `A`/`E` (azimut via le hook de scène). Manette : `navigator.getGamepads` n'est pas pilotable par Playwright → **couverture unit uniquement**, à noter explicitement dans `docs/test-plan.md` (case 👁 assumée, pas un oubli).
- **Cahier de recette** : nouvelle section « Contrôles clavier & manette » + mise à jour des cases existantes devenues automatisables.
- ⚠️ **Aucun override de `Math.random`** et aucun nouveau non-déterminisme : la règle dure e2e reste le seed du moteur.

## Risques

| Risque | Parade |
|---|---|
| Le curseur écran-relatif se désynchronise de la rotation | La conversion vit dans la scène (seule à connaître l'azimut), pas dans l'app. Test e2e : rotation puis ↑ → la case attendue change de sens. |
| Remplacer les 5 `keydown` casse un raccourci existant | Les 4 actions clavier actuelles (Échap, Espace/Entrée, Tab, ←/→) sont couvertes par des e2e existants. Passer par la couche ne doit rien changer pour elles ; `←/→` **change de rôle** (rotation → curseur), c'est le seul changement assumé, et il touche des e2e qui asserteront désormais un déplacement de curseur. |
| L'étape E régresse le tactile validé | Étape en dernier, filet `tapTile` + 419 e2e, revalidation téléphone obligatoire, coupable sans bloquer A-D. |
| Le focus automatique fait apparaître un liseré au pointeur | Le focus n'est pris que si la source active est `keyboard`/`gamepad`. |
| `code` vaut `""` / `"Unidentified"` : claviers virtuels Android, **et aussi clavier physique avec une IME active** (japonais, coréen, chinois) pendant la composition | Sans objet en pratique — un appareil tactile joue au doigt, et une IME n'intercepte pas les flèches / ZQSD / chiffres hors d'un champ texte. Le repli sur `key` n'est pas implémenté : ce serait du code jamais exécuté (zéro tolérance à la dette). À rouvrir si un vrai clavier Bluetooth sur Android, ou un utilisateur sous IME, remonte le cas. |
| Le joueur ne devine pas `ZQSD`/`A`-`E`, non annoncés dans l'UI | Assumé : les flèches (annoncées, elles) couvrent le curseur, la boussole porte son glyphe de rotation. Les libellés de touches viennent avec l'écran de remapping. |
| Manette sur mobile non testable en CI | Human-testing sur la manette USB-C réelle de l'humain (Android). Si elle n'est pas disponible, on livre en best-effort et on le **dit** dans le rapport plutôt que de le supposer. |

## Décisions à trancher pendant l'implémentation

1. **Tuiles Kenney** des glyphes clavier/manette (bouton A, croix, touches) — sur capture, validation humaine, comme au chantier précédent.
2. **Répétition de la croix / des flèches** : délai initial et cadence (valeurs à sentir en jeu, pas à décider ici).
3. **Pan au stick droit** : utile ou parasite ? À garder seulement s'il sert vraiment en test.

## Suite

Plan dédié suivant : **écran de remapping clavier & manette** (décision 1) — capture de touche, persistance, conflits, glyphes par binding. La couche posée ici en est le prérequis : remapper, c'est réécrire la table qui traduit une entrée brute en action logique.

## Livraison (2026-08-21)

Ce qui a changé par rapport au plan tel qu'écrit, et pourquoi.

### Un trou trouvé en cours d'exécution : le sélecteur d'orientation

`onTileClick` n'a **aucun cas** pour la phase `select_direction` — la seule façon de répondre au choix
d'orientation est le sélecteur lui-même (position du pointeur, ou tap). Au clavier, « Attendre »
ouvrait donc une phase sans issue, et le **placement** était pire : c'est le même sélecteur, donc
aucun Pokemon n'aurait pu être placé sans souris.

Corrigé par deux primitives : `aimDirectionPicker(screenDirection)` (les flèches visent le sélecteur
quand il est ouvert, avant de bouger le curseur) et `confirmDirectionPicker()` (Confirm est offert au
sélecteur d'abord). Le trou n'était pas dans le plan : il vient de ce que la phase se résout hors de
`onTileClick`, ce que la cartographie initiale n'avait pas relevé.

### Écarts d'implémentation

- **La conversion écran→grille est un helper unique** (`bestNeighborForScreenVector`) partagé par les
  trois usages : le pointeur qui vise une orientation, la flèche qui déplace le curseur, la flèche
  qui vise une orientation. C'était trois fois le même best-dot ; le plan n'en prévoyait qu'un.
- **Le zoom absolu est arrivé au port** (`setZoomLevel`) comme prévu, `IsometricCamera.setZoomIndex`
  posant l'index au lieu de l'incrémenter.
- **Étape E faite en déplacement réel** : `packages/app/src/input/pointer-source.ts` porte les ~180
  lignes de gestes, et `render-babylon` ne contient plus **aucun** `addEventListener("pointer*")`
  (critère de réussite du plan, vérifié). Le renderer a gagné 9 primitives d'entrée en échange
  (`pickTileAt`, `isCompassHitAt`, `setCursor`, `dispatchTileClick`, les 4 du sélecteur,
  `panCameraByPixels`) : c'est le prix du découpage « l'app décide, le renderer mesure ».
- **`dispatchTileClick` sur le port** : le hook e2e (`clickTile`/`hoverTile`) court-circuite
  volontairement la couche d'entrée et ~419 tests en dépendent. La scène garde donc son slot de
  callback, et la source pointeur y **dispatch** au lieu d'appeler l'orchestrateur en direct — sinon
  le handoff placement → combat (un seul slot, échangé) se serait dédoublé.

### Ce que le gate couvre, et ce qu'il ne couvre pas

- **Couvert** : 13 e2e clavier (`combat/keyboard-controls.spec.ts`), les 7 e2e tactiles du plan 183
  **inchangés et verts après le déplacement**, 45 unit sur la couche (routeur, tracker, bindings,
  manette), 5 unit `inputContext()`. Gate local complet vert.
- **Non couvert, à valider à la main** : le **pinch et le pan à deux doigts** (aucun signal e2e — le
  hook ne synthétise qu'un pointeur), la **manette** (`navigator.getGamepads()` n'est pas
  instrumentable par Playwright), et le **glyphe de prompt manette**. Le tactile a été déplacé, pas
  réécrit, mais un déplacement de code validé sur téléphone se revalide sur téléphone.

### Retours de la validation humaine (2026-08-21) — 14 correctifs

La recette a été faite scénario par scénario (clavier, caméra, menus, orientation, placement,
manette, téléphone + manette). Elle a produit **plus de corrections que l'implémentation initiale**,
et deux d'entre elles étaient des blocages francs. Ce qui a été appris, par famille :

**Ce qui était structurellement faux, pas mal réglé**

1. **Le menu principal ignorait le clavier** : seul écran sans registration, parce qu'il n'a pas de
   « retour » à brancher — or navigation au focus et retour sont deux besoins distincts.
   `bindScreenInput` accepte désormais un retour **optionnel**. Les 8 écrans sont couverts par
   `dom/screen-keyboard.spec.ts` pour que ça ne reparte pas à la dérive.
2. **À la manette, aucune activation native ne suit un appui** : `confirm` renvoyait « non consommé »
   en comptant sur le navigateur, donc A ne faisait **rien** sur les menus (décision #792). Une
   manette n'a pas de comportement natif de formulaire — tout ce qui reposait implicitement sur le
   navigateur doit être explicite pour elle.
3. **Le focus était piégé** dans les contrôles de formulaire (règle binaire « un champ = on se
   tait »). Règle retenue : chacun garde l'axe qu'il **utilise** (décision #785).
4. **Navigation en ordre DOM** dans une mise en page 2D : ← → morts, ↓ en diagonale. Remplacée par une
   navigation **spatiale** (décision #786).
5. **Le bouton « Terminer » du placement était inatteignable** : le placement tournait en contexte
   `board`, où les flèches ne déplacent aucun focus DOM — donc une équipe incomplète ne pouvait pas
   être validée. L'étape « choix du Pokemon » est devenue un contexte de **menu** (décision #788).
6. **Le dialogue de victoire était classé `locked`** : inatteignable à la manette (décision #794).
7. **Le placement n'avait aucune origine de curseur** : elle vient de `panCameraTo`, appelé par
   l'orchestrateur… qui n'existe pas encore pendant le placement.

**Ce que seul un humain pouvait voir**

8. **Un liseré de focus sur « Annuler »** promettait qu'Espace allait annuler. Corrigé
   structurellement : le focus n'est repris que par les deux menus que les flèches naviguent
   (décision #790) — le garde-fou par contexte ne suffisait pas, le chrome étant rendu **avant** que
   la phase ne bascule.
9. **« Annuler le déplacement » en tête de menu** = annulations accidentelles, et un ordre de menu qui
   changeait d'un tour à l'autre (décision #796).
10. **Le curseur ne repartait pas du Pokemon actif**, et restait affiché pendant le tour adverse en
    montrant la fiche du mon précédent (décision #789).
11. **Annuler Plénitude ne faisait rien** (motif statique → retour vers une phase qui se re-confirme)
    et **annuler Destruction** laissait la zone clignoter (décision #795).
12. **A/B inversés sur manette Nintendo** — fait matériel, donc détecté par l'identifiant plutôt que
    réglé (décision #793).
13. **Pan au stick droit inversé** : un stick parle le langage du regard, `panCamera` celui du glissé
    (décision #794).
14. **Glyphes mal calés**, et deux tentatives rejetées avant la bonne (décision #791).

**Ce que ça dit du plan** : la partie « câblage » était juste, la partie « ce que le joueur comprend »
ne pouvait pas l'être sans manette et sans téléphone en main. Les cas 5, 6 et 7 ont un point commun —
**une phase classée dans le mauvais contexte d'entrée rend une UI entière inatteignable**, sans
erreur, sans test rouge. C'est le risque propre à cette architecture, et le prix de son avantage.

**Validé sur** : clavier (AZERTY, Firefox), manette **Switch Pro** filaire (reconnue `standard` par
Firefox), **téléphone réel**, et **téléphone + manette** — le cas que le plan-cadre 173 voulait
first-class, qui marche effectivement sans code spécifique.

### Suites ouvertes

1. **Écran de remapping** (décision 1) — plan dédié, à faire **avec la légende de contrôles**
   ci-dessous : les deux répondent à « le joueur sait-il ce qu'il peut faire ? ».
2. **Légende de contrôles près de la boussole** (demandé par l'humain 2026-08-21) : aucun raccourci
   caméra n'est annoncé nulle part. Glyphe de la boussole → souris / doigt selon la source, puis
   rotation ← → avec sa touche, puis zoom + − avec sa touche ou pinch. À faire en **DOM** (la boussole
   est un mesh Babylon épinglé ; `chrome-insets.ts` fournit déjà l'ancrage partagé).
3. **Refonte de l'écran de sélection d'équipe** (demandé par l'humain 2026-08-21) : aplatir les
   formats, clarifier Humain / IA, rendre lisible le comportement du joueur actif. Le câblage clavier a
   rendu ces problèmes visibles, mais ce sont des problèmes de **conception d'écran** — plan à part,
   pas de rafistolage au coup par coup.
4. **Inspection du plateau pendant les phases de menu** (décision #780) : perte assumée, rouvrable à
   peu de frais — le curseur est gelé, pas détruit.
5. **Sortir d'un champ texte demande `Tab`** : la couche laisse volontairement tout le clavier à un
   champ de saisie (sinon impossible d'écrire), donc les flèches n'en sortent pas. Les autres contrôles
   ont une sortie (§ « Contrôles qui gardent un axe »). À revoir si la manette doit atteindre le
   Team Builder.

## Sources

- [Gamepad API — polling, mapping standard, deadzone (guide 2026)](https://gamepadtester.pro/the-html5-gamepad-api-a-developers-guide-to-browser-controllers/)
- [Jumping the hurdles with the Gamepad API — web.dev](https://web.dev/doodles-gamepad/)
- [Gamepad Event-Driven Input API (explainer MSEdge — pourquoi il faut encore poller)](https://microsoftedge.github.io/MSEdgeExplainers/GamepadEventDrivenInputAPI/explainer.html)
- [Last-input-wins device detection (Godot / Unity)](https://tang3cko.com/posts/dynamic-input-device-detection)
- [Gamepad.mapping — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/mapping)
- [WASD Controls on the Web: don't use `KeyboardEvent.key`, use `KeyboardEvent.code`](https://www.bram.us/2022/03/31/wasd-controls-on-the-web/)
- [KeyboardEvent.code — MDN](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code) (« sans tenir compte de la disposition, de la locale ni des modificateurs » ; exemple explicite du pavé WASD)
- [What's new with KeyboardEvents? Keys and codes! — Chrome for Developers](https://developer.chrome.com/blog/keyboardevent-keys-codes)
- [Keyboard Map — Web platform features explorer](https://web-platform-dx.github.io/web-features-explorer/features/keyboard-map/) (support limité, position standard négative)
- [Keyboard.getLayoutMap() — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Keyboard/getLayoutMap) (absent de Firefox et Safari)
- [Implementing controls using the Gamepad API — MDN](https://developer.mozilla.org/en-US/docs/Games/Techniques/Controls_Gamepad_API) (les objets `Gamepad` sont mutés en place : copier les valeurs primitives)
- Firefox et `mapping` : [Bugzilla #952773](https://bugzilla.mozilla.org/show_bug.cgi?id=952773), [#1542893](https://bugzilla.mozilla.org/show_bug.cgi?id=1542893), [#1922925](https://bugzilla.mozilla.org/show_bug.cgi?id=1922925) (DualSense)
- [Chrome émet un `pointermove` au `pointerdown` — forum Babylon.js](https://forum.babylonjs.com/t/google-chrome-started-firing-pointermove-events-for-pointerdown/3202)
- [Control focus with tabindex — web.dev](https://web.dev/articles/control-focus-with-tabindex) et [Toolbar Pattern — APG W3C](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) (les deux lectures du *roving tabindex*)
- [« Isometric tactics game devs: fix your gamepad controls » — ResetEra](https://www.resetera.com/threads/isometric-tactics-game-devs-im-begging-you-fix-your-gamepad-controls.589740/) (retours joueurs : le mapping grille-relatif sous rotation est le défaut n°1 du genre)
