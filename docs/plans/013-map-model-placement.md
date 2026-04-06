# Plan 013 — Modele de carte + phase de placement

> **Statut** : in-progress
> **Cree** : 2026-03-25
> **Objectif** : Les cartes portent les zones de spawn. Les joueurs placent leurs Pokemon en alternance avant le combat. Mode random disponible.

---

## Contexte

Aujourd'hui les positions de spawn sont en dur dans `BattleSetup.ts` (4 Pokemon, positions fixes). La grille est toujours 12x12. Pour supporter des formats varies (2v2, 3v3, 4v4) et des cartes de tailles differentes, il faut un modele de carte et une phase de placement interactive.

## Decisions

- **La carte porte tout** : dimensions, tiles, zones de spawn par format, formats supportes
- **Taille de grille libre** : chaque carte definit sa propre taille (`width` x `height`)
- **Zones = tiles arbitraires** : `Position[]` par equipe, pas des rectangles (permet formes irregulieres)
- **Formats explicites** : la carte declare les formats qu'elle supporte (ex: 2v2, 3v3)
- **12 Pokemon max** sur le terrain, toujours
- **Placement alterne serpent** (defaut) : P1-P2-P2-P1-P1-P2... (le dernier a placer est le premier au tour suivant). Plus equitable que l'alternance simple car l'avantage informationnel s'inverse a chaque paire.
- **Placement random** : positions tirees sans remise dans les zones, seed injectable pour reproductibilite (replay)
- **Placement blind** : hors scope (plus tard si besoin)
- **Repositionnement** : uniquement le Pokemon qu'on vient de placer pendant son alternance courante
- **Direction** : choix apres chaque placement (reutiliser `DirectionPicker`), sauf random -> auto vers le centre
- **2 joueurs seulement** pour ce plan. Le modele supporte N joueurs mais l'implementation est limitee a 2 (refactor PlayerId -> plan 014)
- **Roster fixe** : on arrive avec des Pokemon predetermines, pas de team select
- **IA** : placement random instantane quand c'est son tour d'alternance (flag `controlledBy` sur le joueur)
- **Phase placement = avant BattleEngine** : PlacementPhase est un objet separe, BattleEngine est cree apres avec les positions finales
- **Sprites au placement** : les sprites crees pendant la phase de placement sont **detruits** a la transition, puis recrees par `BattleSetup` avec les positions finales. Plus simple que le transfert, pas de sprites orphelins.

---

## Modele de donnees

### MapDefinition (nouveaux types core — 1 fichier par type)

```typescript
// map-definition.ts
interface MapDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: TileState[][];
  formats: MapFormat[];
}

// map-format.ts
interface MapFormat {
  teamCount: number;           // 2, 3, 4, 6, 12
  maxPokemonPerTeam: number;   // 6, 4, 3, 2, 1
  spawnZones: SpawnZone[];     // length === teamCount
}

// spawn-zone.ts
interface SpawnZone {
  positions: Position[];       // tiles disponibles, length >= maxPokemonPerTeam
}
```

### PlacementMode (const enum)

```typescript
// enums/placement-mode.ts
const PlacementMode = {
  Alternating: "alternating",
  Random: "random",
} as const;
type PlacementMode = (typeof PlacementMode)[keyof typeof PlacementMode];
```

### PlayerController (const enum)

```typescript
// enums/player-controller.ts
const PlayerController = {
  Human: "human",
  Ai: "ai",
} as const;
type PlayerController = (typeof PlayerController)[keyof typeof PlayerController];
```

### PlacementTeam

```typescript
// placement-team.ts
interface PlacementTeam {
  playerId: PlayerId;
  pokemonIds: string[];
  controller: PlayerController;
}
```

### PlacementEntry (resultat d'un placement)

```typescript
// placement-entry.ts
interface PlacementEntry {
  pokemonId: string;
  position: Position;
  direction: Direction;
}
```

---

## Etapes

### Etape 1 — Core : types carte et placement

**Fichiers** : nouveaux dans `packages/core/src/types/` et `packages/core/src/enums/`

1. `types/map-definition.ts` : `MapDefinition`
2. `types/map-format.ts` : `MapFormat`
3. `types/spawn-zone.ts` : `SpawnZone`
4. `types/placement-team.ts` : `PlacementTeam`
5. `types/placement-entry.ts` : `PlacementEntry`
6. `enums/placement-mode.ts` : const enum `PlacementMode`
7. `enums/player-controller.ts` : const enum `PlayerController`
8. Exporter depuis `index.ts`

**Tests** : pas de logique, compilation = validation

### Etape 2 — Core : validation de carte

**Fichiers** : nouveau `packages/core/src/battle/validate-map.ts` + tests

Test-first : le validateur existe avant la premiere carte.

1. `validateMapDefinition(map: MapDefinition): ValidationResult`
   - Dimensions > 0
   - Toutes les tiles de spawn sont dans les bornes de la grille
   - Toutes les tiles de spawn sont passables
   - Chaque zone a assez de positions pour `maxPokemonPerTeam`
   - Pas de chevauchement entre zones d'equipes differentes
   - `teamCount` correspond au nombre de `spawnZones`

**Tests** : cas valide + chaque erreur de validation

### Etape 3 — Core : premiere carte (flat 12x12)

**Fichiers** : nouveau `packages/data/src/maps/` + `poc-arena.ts`

1. Creer `MapDefinition` pour la carte POC :
   - `id: "poc-arena"`, `name: "POC Arena"`, 12x12, flat
   - Format 2 joueurs, 2 Pokemon par equipe (comme actuellement)
   - Zone P1 : coin sud-ouest (~8-10 tiles)
   - Zone P2 : coin nord-est (~8-10 tiles)
2. Exporter depuis `packages/data/src/index.ts`
3. Valider avec `validateMapDefinition` dans les tests

### Etape 4 — Core : PlacementPhase

**Fichiers** : nouveau `packages/core/src/battle/PlacementPhase.ts` + tests

Classe qui orchestre le placement sans dependance UI :

```typescript
class PlacementPhase {
  constructor(
    mapDefinition: MapDefinition,
    teams: PlacementTeam[],
    format: MapFormat,
    mode: PlacementMode,
    randomSeed?: number,        // seed injectable pour reproductibilite (replay)
  )

  // Etat courant
  getNextToPlace(): { playerId: PlayerId; pokemonId: string } | null
  isComplete(): boolean
  getPlacements(): PlacementEntry[]
  getPlacedPositions(): Position[]   // positions deja occupees

  // Actions
  submitPlacement(pokemonId: string, position: Position, direction: Direction): PlacementResult
  undoLastPlacement(): boolean   // repositionnement du dernier place

  // Auto (tirage sans remise dans les positions disponibles)
  autoPlaceAll(gridCenter: Position): PlacementEntry[]   // mode random
  autoPlaceForPlayer(playerId: PlayerId, gridCenter: Position): PlacementEntry[]  // IA
}
```

**Logique alternance serpent** :
- Ordre : P1, P2, P2, P1, P1, P2... (le sens s'inverse apres chaque paire)
- En 2v2 : P1-P2-P2-P1. En 3v3 : P1-P2-P2-P1-P1-P2.
- Si equipes de tailles inegales, le joueur avec moins skip ses tours restants

**Validation** :
- Position dans la zone de spawn du joueur
- Position non occupee par un autre Pokemon deja place
- Pokemon appartient bien au joueur et n'est pas deja place

**Random** :
- Tirage sans remise : chaque position n'est utilisee qu'une fois
- Seed injectable : si fournie, utiliser un PRNG deterministe (pour replay). Si absente, utiliser `Math.random()`
- Direction auto vers le centre via `directionFromTo`

**Tests** :
- Alternance serpent correcte (P1, P2, P2, P1...)
- Rejet position hors zone
- Rejet position deja occupee
- Rejet Pokemon deja place
- Undo retire le dernier placement uniquement
- `autoPlaceAll` remplit toutes les positions (sans doublons)
- `autoPlaceAll` avec seed donne un resultat deterministe
- `isComplete` true quand tous places
- Equipes de tailles inegales : alternance correcte avec skip

### Etape 5 — Core : test d'integration PlacementPhase -> BattleEngine

**Fichiers** : nouveau test d'integration

Test end-to-end qui couvre le flow complet :
1. Creer `PlacementPhase` avec carte POC + 2 equipes
2. Placer tous les Pokemon (ou `autoPlaceAll`)
3. Passer les `PlacementEntry[]` a `createBattle()`
4. Verifier que le `BattleEngine` est pret : positions correctes, `getLegalActions` fonctionne

### Etape 6 — Renderer : refactor BattleSetup

**Fichiers** : `packages/renderer/src/game/BattleSetup.ts`

Refactorer `createBattle()` pour :
1. Accepter un `MapDefinition` et un `MapFormat` en parametre (au lieu de tout hardcoder)
2. Construire la grille depuis `map.tiles` — copie profonde pour eviter la mutation de la carte source (plus de `buildFlatGrid`)
3. Accepter les `PlacementEntry[]` (positions finales)
4. Creer les `PokemonInstance` avec les positions des placements
5. Construire et retourner le `BattleEngine` normalement

Signature : `createBattle(map, format, placements, teams) -> BattleSetupResult`

La carte POC est chargee par defaut.

### Etape 7 — Renderer : etat `placement` dans la state machine

**Fichiers** : `GameController.ts`

1. Ajouter `{ phase: "placement" }` et `{ phase: "placement_direction" }` au type `InputState`
2. `GameController` recoit la `PlacementPhase` via un objet options (refactor constructeur si > 9 params)
3. Nouveau flow :
   - `enterPlacement()` : affiche les zones, le roster, highlight les positions valides
   - Clic sur portrait dans le roster -> selectionne le Pokemon a placer
   - Clic sur tile valide -> place le Pokemon (sprite apparait)
   - -> entre dans `placement_direction` (DirectionPicker)
   - Direction confirmee -> `placementPhase.submitPlacement()` -> prochain tour
   - Si le prochain joueur est IA (`controller === "ai"`) -> `autoPlaceForPlayer` instantane, sprite apparait, prochain tour
   - Quand `placementPhase.isComplete()` -> detruire les sprites de placement, appeler `createBattle()`, recreer les sprites via `BattleSetup`, transition vers `action_menu`
4. Escape pendant `placement` : undo le dernier placement (si possible)
5. Le Pokemon selectionne est mis en surbrillance dans le roster

### Etape 8 — Renderer : panel roster de placement

**Fichiers** : nouveau `packages/renderer/src/ui/PlacementRosterPanel.ts`

Panel en bas de l'ecran (inspire du InfoPanel existant) :
1. Fond semi-transparent, hauteur ~80px
2. Affiche les portraits des Pokemon a placer pour le joueur actif
3. Portrait cliquable -> selectionne le Pokemon
4. Pokemon deja places : portrait grise / coche
5. Indicateur du joueur actif ("Tour de Joueur 1" / "Tour de Joueur 2")
6. Le panel se met a jour a chaque alternance

### Etape 9 — Renderer : highlight des zones de spawn

**Fichiers** : `GameController.ts`, `IsometricGrid.ts` (ajouter methode `highlightPositions(positions[], color)` si absente)

1. Quand on entre en phase placement :
   - Colorer les tiles de spawn de l'equipe active (bleu pour P1, rouge pour P2)
   - Les tiles de l'autre equipe en gris clair (zone visible mais pas interactive)
   - Les tiles deja occupees : couleur plus sombre
2. Mettre a jour les highlights a chaque placement

### Etape 10 — Renderer : mode random

**Fichiers** : `BattleScene.ts`

1. Si `placementMode === "random"` : appeler `placementPhase.autoPlaceAll(gridCenter)` avant d'entrer dans le GameController
2. Skip toute la phase de placement, passer directement au combat
3. Les directions sont auto-calculees vers le centre

### Etape 11 — Integration : flow complet BattleScene

**Fichiers** : `BattleScene.ts`

Recoller le flow :
1. `preload()` : charger la carte + data (comme avant)
2. `create()` : creer `PlacementPhase` avec carte + equipes + mode + seed optionnelle
3. Si random -> auto-place, creer engine, setupBattle directement
4. Si alternating -> lancer la phase placement dans le GameController
5. Quand placement termine -> `createBattle(map, format, placements, teams)` -> engine -> setupBattle -> premier tour

---

## Hors scope

- Support > 2 joueurs (plan 014 — refactor PlayerId)
- Team select (ecran de choix d'equipe avant le placement)
- Placement blind (ecran de transition)
- Editeur de carte
- Deniceles / terrains speciaux sur les tiles
- Tailles de grille autres que 12x12 (le modele le supporte mais on ne cree qu'une seule carte)
- Alternance serpent (plan 014, pour formats 4v4+)
- Raccourci "orienter vers le centre" dans le DirectionPicker (amelioration future)

## Risques

- **Complexite renderer** : la state machine passe de 7 a 9 etats. Gerer les transitions proprement.
- **PlacementPhase vs BattleEngine** : deux objets separes. La transition detruit les sprites placement et recree via BattleSetup — pas de sprites orphelins.
- **PRNG deterministe** : pour la seed du mode random, il faut un generateur simple (ex: mulberry32). Pas de dependance externe, quelques lignes suffisent.

## Notes pour le futur

- Plan 014 : refactor PlayerId pour N joueurs, support formats 3+, IA placement strategique
- Le modele `MapFormat.spawnZones` est pret pour N equipes
- `PlayerController` servira aussi pour le tour de jeu (pas que le placement)
- La seed du placement random sera integree dans le systeme de replay (decision 94)
