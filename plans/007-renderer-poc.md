---
status: in-progress
created: 2026-03-21
updated: 2026-03-21
---

# Plan 007 — Renderer POC : grille isométrique + premier combat visuel

## Objectif

Afficher un combat jouable en hot-seat 2 joueurs dans le navigateur. Grille isométrique, sprites placeholder (formes colorées), sélection d'unité, déplacement, attaque, UI minimale (PV, liste d'attaques). Le core tourne déjà — ce plan branche un rendu visuel dessus.

## Contexte

Le core est validé de bout en bout (224 tests, 100% coverage, combats headless IA). `BattleEngine` expose `getLegalActions`, `submitAction`, `getGameState` et un système d'events. Phaser 4 RC6 est déjà installé dans `packages/renderer`.

Le renderer est **asynchrone** : il reçoit les events du core, les empile, et les joue séquentiellement avec des animations. Le joueur humain attend la fin des animations avant d'agir.

### Décisions applicables

- Grille 12x12, plate (hauteur 0), pas de dénivelé (décision #18)
- Caméra fixe + zoom (décision #17)
- Sprites placeholder pour le POC (décision #20)
- Core sync, renderer async (décisions #38, #39)
- Hot-seat 2 joueurs (décision #3)
- 2v2 : 4 Pokemon du roster POC (Bulbasaur, Charmander, Squirtle, Pidgey)

## Étapes

### Étape 1 — Bootstrap Phaser + scène vide

**Fichier** : `packages/renderer/src/main.ts`

- Créer le `Phaser.Game` avec config minimale :
  - `type: Phaser.AUTO`
  - `width: 1280, height: 720`
  - `parent: document.body`
  - `backgroundColor: '#1a1a2e'`
  - `scene: [BattleScene]`
- Créer `BattleScene` (extends `Phaser.Scene`) avec `preload`, `create`, `update` vides
- Vérifier que le canvas Phaser s'affiche dans le navigateur (`pnpm --filter renderer dev`)

**Critère** : canvas noir visible dans le navigateur, pas d'erreur console.

### Étape 2 — Grille isométrique

**Fichier** : `packages/renderer/src/scenes/BattleScene.ts`

Coordonnées isométriques : la grille core (x, y) est projetée en iso.

```
screenX = (gridX - gridY) * (tileWidth / 2) + offsetX
screenY = (gridX + gridY) * (tileHeight / 2) + offsetY
```

- Constantes : `TILE_WIDTH = 64`, `TILE_HEIGHT = 32` (ratio 2:1 classique iso)
- Dessiner la grille 12x12 avec des losanges (Graphics ou sprites) :
  - Chaque tile = losange rempli d'une couleur de base (vert clair)
  - Bordure subtile pour voir la grille
- Centrer la grille dans le canvas (calculer les offsets)
- Helper `gridToScreen(x, y): { screenX, screenY }` et `screenToGrid(screenX, screenY): { x, y }` pour convertir dans les deux sens

**Critère** : grille isométrique 12x12 visible et centrée.

### Étape 3 — Affichage des Pokemon (placeholders)

**Fichier** : `packages/renderer/src/sprites/PokemonSprite.ts`

Chaque Pokemon = cercle coloré + texte (nom abrégé) positionné sur sa tile.

- Couleurs par type : Feu=rouge, Eau=bleu, Plante=vert, Normal=gris
- Cercle de ~20px de rayon positionné au centre de la tile iso
- Texte du nom au-dessus du cercle
- Barre de PV sous le cercle (rectangle vert/rouge proportionnel à currentHp/maxHp)

**Intégration core** :
- Initialiser un `BattleEngine` avec les 4 Pokemon du roster, grille 12x12 plate
- Placer team A en bas-gauche, team B en haut-droite
- Lire `getGameState()` pour positionner les sprites

**Critère** : 4 cercles colorés sur la grille, avec noms et barres de PV.

### Étape 4 — Sélection d'unité + highlight des tiles

**Fichier** : `packages/renderer/src/ui/InputHandler.ts`

- Clic sur une tile → `screenToGrid` → identifier le Pokemon
- Si c'est le Pokemon actif (celui dont c'est le tour) → le sélectionner
- Quand un Pokemon est sélectionné :
  - Appeler `getLegalActions(playerId)` sur le core
  - Highlighter les tiles de déplacement (bleu clair)
  - Highlighter les tiles d'attaque (rouge clair)
- Afficher l'indicateur de tour actif (contour brillant ou pulsation sur le Pokemon actif)

**Critère** : cliquer sur le Pokemon actif montre les déplacements/attaques possibles.

### Étape 5 — Exécution des actions (déplacement + attaque)

Clic sur une tile highlightée → soumettre l'action au core.

**Déplacement** :
- Clic sur tile bleue → `submitAction(playerId, { kind: 'move', pokemonId, path })`
- Animer le sprite le long du path (tween Phaser, ~200ms par step)
- Mettre à jour la position du sprite

**Attaque** :
- Quand le Pokemon est sélectionné, afficher la liste des attaques disponibles (UI panel en bas)
- Clic sur une attaque → mode ciblage → les tiles valides pour cette attaque sont highlightées
- Clic sur une tile cible → `submitAction(playerId, { kind: 'use_move', pokemonId, moveId, targetPosition })`
- Animer : flash sur la cible, mise à jour de la barre PV
- Si KO : faire disparaître le sprite (fadeout)

**Skip turn** :
- Bouton "Skip" ou raccourci

**Critère** : un joueur peut déplacer son Pokemon ou attaquer, les animations jouent.

### Étape 6 — Hot-seat 2 joueurs

**Fichier** : `packages/renderer/src/game/GameController.ts`

- `GameController` orchestre le flux : qui joue, transition entre les tours
- Il écoute les events du core (`TurnStarted`) pour savoir à qui c'est le tour
- Affichage du joueur actif ("Tour de Player 1" / "Tour de Player 2")
- Après `submitAction` → traiter les events retournés :
  - `PokemonMoved` → animer le déplacement
  - `DamageDealt` → flash + update barre PV
  - `StatusApplied` → icône de statut sur le sprite
  - `PokemonKo` / `PokemonEliminated` → fadeout sprite
  - `BattleEnded` → écran de victoire ("Player X wins!")
- Queue d'animations : les events sont joués séquentiellement, le joueur suivant ne peut agir qu'après la fin des animations

**Critère** : deux joueurs peuvent alterner sur le même écran, combat complet jusqu'à la victoire.

### Étape 7 — UI minimale

**Fichier** : `packages/renderer/src/ui/BattleUI.ts`

- **Panel d'info** (en bas) : nom du Pokemon actif, PV, statut, PP des attaques
- **Liste d'attaques** : 4 boutons avec nom, type (couleur), PP restants. Grisé si 0 PP
- **Indicateur de tour** : "Round X — Tour de [Pokemon]" en haut
- **Bouton Skip Turn**
- **Écran de victoire** : overlay "Player X wins!" + bouton restart

Style minimal : rectangles colorés, texte Phaser, pas de sprites UI.

**Critère** : l'UI est fonctionnelle et lisible.

### Étape 8 — Polish minimal

- Camera : centrer sur le Pokemon actif au début de chaque tour (tween doux)
- Hover : highlight de la tile survolée
- Feedback visuel : tile du Pokemon actif pulse doucement
- Ordre de rendu (depth sorting) : les sprites plus bas sur l'écran sont rendus devant
- Gestion du resize (responsive basique)

**Critère** : l'expérience est jouable sans friction majeure.

## Structure de fichiers cible

```
packages/renderer/src/
├── main.ts                    # Bootstrap Phaser.Game
├── scenes/
│   └── BattleScene.ts         # Scene principale, crée la grille et les sprites
├── grid/
│   └── IsometricGrid.ts       # Rendu de la grille iso, conversion coords, highlight
├── sprites/
│   └── PokemonSprite.ts       # Sprite placeholder (cercle + nom + barre PV)
├── ui/
│   ├── InputHandler.ts        # Gestion des clics, sélection, ciblage
│   ├── BattleUI.ts            # Panel d'info, liste attaques, indicateur tour
│   └── VictoryScreen.ts       # Overlay de fin de combat
├── game/
│   ├── GameController.ts      # Orchestrateur hot-seat, tour par tour
│   └── AnimationQueue.ts      # Queue d'animations séquentielles
└── constants.ts               # TILE_WIDTH, TILE_HEIGHT, couleurs, etc.
```

## Ce que ce plan ne fait PAS

- Pas de sprites PNG (placeholder colorés uniquement)
- Pas de son
- Pas de menus (le combat démarre directement)
- Pas d'IA (hot-seat uniquement)
- Pas de sélection d'équipe (équipes hardcodées)
- Pas de tests automatisés sur le renderer (tests visuels Playwright en Phase 1)
- Pas de dénivelé ni terrain

## Risques

- **API Phaser 4 RC6** : quelques APIs peuvent différer de la doc v3. Vérifier sur les exemples labs.phaser.io et la doc RC6 en cas de doute.
- **Performance grille 12x12** : 144 tiles = trivial pour Phaser, pas de risque.
- **Conversion iso ↔ grid au clic** : la formule inverse peut avoir des edge cases aux bords de la grille. Tester manuellement.
- **Queue d'animations** : si mal implémentée, les events peuvent se chevaucher. Pattern simple : Promise chain ou callback queue.
- **Phaser 4 + Vite** : déjà configuré et buildé (dist/ existe). Pas de risque de setup.

## Agents à lancer

| Étape | Agents |
|-------|--------|
| Après étape 1 | Vérif manuelle (canvas visible) |
| Après étape 3 | `core-guardian` (vérifier que le renderer n'a pas pollué le core) |
| Après étape 6 | Test manuel du combat complet |
| Après étape 8 | `code-reviewer` |

## Critères de complétion

- Grille isométrique 12x12 affichée dans le navigateur
- 4 Pokemon visibles avec barres de PV
- Sélection d'unité avec highlight des tiles accessibles
- Déplacement animé
- Attaque avec ciblage visuel et animation de dégâts
- Hot-seat 2 joueurs fonctionnel
- Combat se joue jusqu'à la victoire
- UI minimale lisible (PV, attaques, tour actif, victoire)

## Dépendances

- **Avant ce plan** : Plan 006 (boucle de combat complète) — done
- **Ce plan débloque** :
  - IA visuelle (voir l'IA jouer dans le renderer)
  - Sprites PMDCollab (remplacer les placeholders)
  - Phase 1 (hot-seat, multi-Pokemon, replay)
