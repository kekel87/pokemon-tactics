---
status: done
created: 2026-03-22
updated: 2026-03-22
---

# Plan 009 — UI FFT-like : menu d'action, curseur, panel info, timeline

## Objectif

Refondre l'UI du renderer pour s'inspirer de Final Fantasy Tactics (Ivalice Chronicles) et FFTA. Remplacer les boutons d'attaque en ligne par un menu d'action contextuel, ajouter un curseur de tile visible, un panel d'info dynamique, et une timeline d'ordre des tours.

## Contexte

L'UI actuelle est fonctionnelle mais peu lisible : boutons d'attaque en bas, texte brut pour les infos, hover semi-transparent. Le créateur veut s'inspirer de FFT/FFTA pour plus de clarté tactique. Le renderer est en Phaser 4, sprites placeholder (cercles colorés).

Décisions prises avec le créateur :
- Menu d'action FFT-like : Deplacement, Attaque, Objet (grisé), Attendre, Status (grisé)
- Sous-menu Attaque avec liste des 4 attaques + Annuler
- Curseur de tile animé (remplace le hover highlight actuel)
- 1 panel info (bas-gauche) qui suit le curseur — affiche le Pokemon sous le curseur, revient au Pokemon actif sinon. Fond coloré par équipe (bleu/rouge)
- Timeline d'ordre des tours côté gauche (style Ivalice Chronicles remaster) : portraits/cercles des Pokemon dans l'ordre d'initiative, highlight du Pokemon actif, couleur d'équipe
- Retirer les noms de Pokemon au-dessus des sprites (en attendant les vrais sprites)
- Pas d'outline sur les sprites pour distinguer les équipes — la distinction passe par le panel info + timeline
- Status et Objet grisés pour le moment (phases futures)
- Pas de preview de dégâts (phase future)

Quick fixes inclus :
- roundNumber sur l'écran de victoire
- Fix panel info pas mis à jour après dégâts mid-tour
- Camera pan vers le Pokemon actif au début de chaque tour
- Pulse tween sur le Pokemon actif

## Étapes

### Étape 1 — Curseur de tile animé

Remplacer le hover highlight semi-transparent par un vrai curseur :
- Losange avec contour brillant (blanc ou jaune), épaisseur 2px
- Animation pulse subtile (alpha oscille entre 0.7 et 1.0, ou scale léger)
- Remplace `highlightHover()` dans IsometricGrid
- Le curseur suit le pointermove comme avant

Fichiers : `IsometricGrid.ts`, `constants.ts`

Critère : le curseur est visuellement distinct des tiles de la grille, animé, et suit la souris.

### Étape 2 — Panel d'info (bas-gauche)

Créer un panel d'info Pokemon en bas à gauche, style FFT :
- Fond semi-transparent coloré par équipe (bleu pour Player 1, rouge pour Player 2)
- Contenu : nom du Pokemon, barre de PV (graphique), statut si applicable
- Dimensions : ~220x80px, coins arrondis
- Par défaut affiche le Pokemon actif
- Au hover sur un Pokemon (allié ou ennemi) : affiche ce Pokemon à la place
- Quand le curseur quitte le Pokemon : revient au Pokemon actif
- Le hover doit détecter qu'on est sur la tile d'un Pokemon (screenToGrid → chercher dans state.pokemon)
- Note : `BattleUI` a déjà une méthode `updatePokemonInfo()` non utilisée (code mort). La supprimer, le panel remplace ce rôle.
- `GameController` doit exposer deux helpers : `getActivePokemon(): PokemonInstance | null` et `getPokemonAtPosition(x, y): PokemonInstance | null` — à ajouter sans toucher à la state machine (étape 5 s'en occupe)

Fichiers : nouveau `ui/InfoPanel.ts`, `BattleScene.ts` (hover detection), `GameController.ts` (expose active pokemon + pokemon par position), `constants.ts`

Critère : panel visible en bas à gauche, change au hover, fond coloré par équipe.

### Étape 3 — Menu d'action contextuel (UI uniquement)

Créer la classe `ActionMenu` sans encore câbler la state machine (l'étape 5 s'en occupe) :
- Menu vertical FFT-like, position fixe côté droit (évite les complications de coordonnées isométriques — voir Risques)
- Entrées : **Deplacement**, **Attaque**, **Objet** (grisé), **Attendre**, **Status** (grisé)
- Style : fond sombre semi-transparent, texte blanc, entrée survolée = highlight, grisé = alpha 0.4
- L'`ActionMenu` expose : `show(options: ActionMenuOptions)` et `hide()`
- `ActionMenuOptions` contient : `canMove: boolean`, `canAct: boolean`, et des callbacks `onMove`, `onAttack`, `onWait`
- À ce stade, le menu est intégré dans `BattleUI` mais les anciens boutons d'attaque et le bouton EndTurn restent (supprimés à l'étape 5)

Fichiers : nouveau `ui/ActionMenu.ts`, `BattleUI.ts` (instanciation du menu, sans retirer les anciens éléments)

Critère : menu vertical rendu visible en jeu, entrées grisées/actives selon les options passées. Clics loggés en console (branchement réel = étape 5).

### Étape 4 — Sous-menu Attaque

Quand on clique sur Attaque dans le menu d'action :
- Le menu d'action se cache
- Un sous-menu apparaît à la même position avec :
  - Les 4 attaques (nom, PP restants, couleur par type)
  - Entrée **Annuler** en bas
  - Attaques grisées si 0 PP ou pas de cible légale
- Clic sur une attaque → entre en mode select_attack_target avec les tiles d'attaque highlightées (rouge)
- Clic sur Annuler → revient au menu d'action principal
- Clic sur une tile invalide en mode ciblage → revient au sous-menu Attaque (pas au menu principal)

Fichiers : `ui/ActionMenu.ts` (sous-menu), `GameController.ts` (nouveau state `attack_submenu` entre `action_menu` et `select_attack_target`)

Critère : sous-menu avec les 4 attaques + Annuler, navigation fluide entre les menus.

### Étape 5 — Refactor InputState + intégration menu

Refactorer la state machine d'input dans `GameController` et brancher le menu :
- Nouveaux états (remplacent `select_action` et `select_move_target`) :
  - `action_menu` — menu principal visible
  - `attack_submenu` — sous-menu attaques visible
  - `select_move_destination` — tiles bleues actives (clic sur tile = move)
  - `select_attack_target` — tiles rouges actives (clic sur tile = use_move)
  - `animating` et `battle_over` — inchangés
- Le flow complet :
  1. Tour commence → `action_menu`
  2. Deplacement cliqué → `select_move_destination` → clic tile valide → animation → retour `action_menu` (avec `canMove: false`)
  3. Attaque cliquée → `attack_submenu` → choix attaque → `select_attack_target` → clic tile valide → animation → retour `action_menu` (avec `canAct: false`)
  4. Attendre cliqué → EndTurn → tour suivant → `action_menu`
  5. Annuler (sous-menu) → retour `action_menu`
  6. Clic tile invalide en ciblage → retour `attack_submenu` (pas au menu principal)
- **Rupture de comportement à gérer explicitement** : l'état `select_action` actuel auto-highlight les tiles de déplacement — ce comportement est supprimé. Désormais les highlights n'apparaissent qu'en `select_move_destination` ou `select_attack_target`.
- Retirer les anciens boutons d'attaque et le bouton EndTurn de `BattleUI` (remplacés par `ActionMenu`)

Fichiers : `GameController.ts`, `BattleUI.ts` (suppression anciens boutons)

Critère : toute la navigation menu fonctionne, move puis act dans le même tour, aucun highlight parasite en `action_menu`.

### Étape 6 — Timeline d'ordre des tours

Ajouter une timeline verticale côté gauche de l'écran (style Ivalice Chronicles remaster) :
- Liste verticale des Pokemon dans l'ordre d'initiative (state.turnOrder)
- Chaque entrée : petit cercle coloré par type + bordure colorée par équipe (bleu/rouge)
- Le Pokemon actif est highlight (plus gros, ou fond plus lumineux, ou contour doré)
- Les Pokemon KO sont retirés de la timeline
- Mise à jour à chaque début de tour
- Position : côté gauche, centré verticalement
- Depth élevé pour rester au-dessus de la grille

Fichiers : nouveau `ui/TurnTimeline.ts`, `GameController.ts` (update timeline dans refreshUI)

Critère : timeline visible à gauche, ordre correct, Pokemon actif highlight, couleurs d'équipe visibles.

### Étape 7 — Polish sprites + camera

Items visuels sur les sprites et la caméra :
- Retirer les noms (`nameText`) des `PokemonSprite` (le panel info suffit)
- Ajouter un pulse tween sur le Pokemon actif : scale yoyo entre 1.0 et 1.1, lancé dans `setActive(true)`, stoppé dans `setActive(false)`
- Camera pan doux vers le Pokemon actif au début de chaque tour : `scene.cameras.main.pan(screenX, screenY, 300, 'Power2')` dans `refreshUI()`

Fichiers : `PokemonSprite.ts`, `GameController.ts`

Critère : sprites sans nom, pulse visible sur le Pokemon actif, caméra se centre au changement de tour.

### Étape 8 — Nettoyage final et fix écran de victoire

Nettoyage du code mort et fixes restants :
- Ajouter le `roundNumber` sur l'écran de victoire : "Player X wins! (Round Y)" — utiliser `this.state.roundNumber` déjà disponible dans `executeAction` au moment de `BattleEnded`
- Fix : mettre à jour le panel info (`InfoPanel`) après `DamageDealt` et `LinkDrained` mid-tour (dans `processEvent` de `GameController`)
- Retirer `pokemonInfoText` et `updatePokemonInfo()` de `BattleUI` (remplacés par `InfoPanel`, déjà supprimés à l'étape 2 si fait proprement)
- Vérifier qu'il ne reste aucun import inutilisé, aucune méthode orpheline, aucun objet Phaser créé mais jamais détruit

Fichiers : `BattleUI.ts`, `GameController.ts`

Critère : écran de victoire avec rounds, panel info mis à jour mid-tour, aucun code mort détectable par Biome ou coverage.

## Structure de fichiers cible

```
packages/renderer/src/
├── main.ts
├── constants.ts                    # + couleurs d'équipe, tailles panel/menu/timeline
├── scenes/
│   └── BattleScene.ts              # + hover Pokemon detection
├── grid/
│   └── IsometricGrid.ts            # curseur animé (remplace hover highlight)
├── sprites/
│   └── PokemonSprite.ts            # sans nom, avec pulse
├── ui/
│   ├── ActionMenu.ts               # NOUVEAU — menu FFT-like + sous-menu attaque
│   ├── InfoPanel.ts                # NOUVEAU — panel info Pokemon (bas-gauche)
│   ├── TurnTimeline.ts             # NOUVEAU — timeline ordre des tours (gauche)
│   ├── BattleUI.ts                 # simplifié (turn info header, victory overlay)
│   └── VictoryScreen.ts            # (si extrait de BattleUI)
├── game/
│   ├── GameController.ts           # refactored input state machine
│   ├── AnimationQueue.ts
│   └── BattleSetup.ts
└── enums/
    └── highlight-kind.ts
```

## Ce que ce plan ne fait PAS

- Pas de vrais sprites (placeholder cercles colorés)
- Pas d'Objet (grisé, Phase 2+)
- Pas de Status détaillé (grisé, Phase future)
- Pas de preview de dégâts
- Pas de clavier/manette (souris uniquement)
- Pas de son

## Risques / Questions

- **Menu d'action positionné près du Pokemon** : la position en coordonnées isométriques est non triviale — un Pokemon en bord de grille peut faire sortir le menu du canvas. Décision : menu à position fixe côté droit de l'écran (plus simple, cohérent avec FFT/FFTA qui garde les menus hors de la grille). Le plan retient cette solution dès l'étape 3.
- **State machine complexifiée** : le passage de 2 états à 6 états augmente le nombre de transitions. Tester manuellement après l'étape 5 : move puis attack, attack puis move, cancel en sous-menu, clic invalide en ciblage, EndTurn, battle_over.
- **Phaser 4 containers et depth** : les containers Phaser héritent du depth de leur parent, mais les GameObjects enfants ont leur propre depth local. S'assurer que `ActionMenu`, `InfoPanel` et `TurnTimeline` ont des depth absolus (ex: 1000, 1100, 1200) et non relatifs à leur container pour éviter les problèmes de rendu.
- **Destruction des GameObjects Phaser** : chaque composant UI créé (menus, textes, graphics) doit avoir une méthode `destroy()` appelée lors du restart de scène — sinon des fuites mémoire apparaissent. Vérifier dans `BattleScene` que tous les objets sont nettoyés.

## Agents à lancer

| Étape | Agents |
|-------|--------|
| Après étape 5 | Test manuel de toutes les transitions de la state machine (move puis attack, attack puis move, cancel, clic invalide, EndTurn, battle_over) |
| Après étape 8 | `code-reviewer`, `core-guardian` (vérifier que le core n'est pas touché) |
| Fin | `doc-keeper` (mettre à jour STATUS.md, marquer plan 007 done et plan 009 done dans plans/README.md) |

## Critères de complétion

- Le curseur de tile est animé et visible
- Le panel info affiche le bon Pokemon selon le hover, fond coloré par équipe
- Le menu d'action vertical remplace les anciens boutons
- La navigation menu fonctionne : Deplacement, Attaque (sous-menu), Attendre, Annuler
- Les entrées grisées (Objet, Status, actions déjà faites) sont non-cliquables
- La timeline affiche l'ordre correct des tours, avec le Pokemon actif highlight
- Les sprites n'ont plus de noms flottants
- Le pulse tween et le camera pan sont en place
- L'écran de victoire affiche le numéro de round
- Le panel info se met à jour après DamageDealt et LinkDrained mid-tour
- Pas de code mort (anciens boutons, `pokemonInfoText`, `updatePokemonInfo()` retirés)

## Dépendances

- **Avant ce plan** : Plan 008 (Move+Act) — done
- **Plan 007** : les étapes restantes (7-8) sont absorbées par ce plan — marquer 007 comme `done` dans `plans/README.md` en fin de ce plan
- **Ce plan débloque** : intégration des vrais sprites PMDCollab, système de sons, clavier/manette
