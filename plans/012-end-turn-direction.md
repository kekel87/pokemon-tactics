# Plan 012 — Direction de fin de tour

> **Statut** : done
> **Créé** : 2026-03-24
> **Terminé** : 2026-03-25
> **Objectif** : Le joueur choisit obligatoirement une direction avant de terminer son tour. Au démarrage, les Pokemon regardent le centre de la carte.

---

## Contexte

Le core supporte déjà `direction?: Direction` sur l'action `EndTurn` et `executeEndTurn` applique l'orientation. Mais le paramètre est optionnel, `getLegalActions` ne génère qu'un seul `EndTurn` sans direction, et le renderer n'a aucune UI de choix de direction.

## Décisions

- **Direction obligatoire** : le joueur choisit toujours sa direction, que ce soit après Move, Act, ou directement depuis "Attendre"
- **UI style FFT** : une flèche unique au-dessus du sprite indiquant la direction courante, le sprite pivote en temps réel
- **Interaction souris** : hover dans un quadrant autour du Pokemon → preview (sprite pivote + flèche tourne), clic gauche → confirme, Escape → retour au menu
- **Barre PV masquée** pendant le choix de direction (sprite plus lisible)
- **Orientation initiale** : chaque Pokemon regarde le centre de la grille au spawn (via `directionFromTo`)
- **Core** : `direction` devient obligatoire sur `EndTurn` (pas optionnel)

---

## Étapes

### Étape 1 — Core : direction obligatoire sur EndTurn

**Fichiers** : `action.ts`, `BattleEngine.ts`, tests existants

1. `action.ts` : `direction?: Direction` → `direction: Direction` (retirer le `?`)
2. `BattleEngine.executeEndTurn` : retirer le `if (direction)` guard, appliquer toujours
3. `BattleEngine.getLegalActions` : générer 4 actions `EndTurn` (une par direction) au lieu d'une seule
4. Ajouter `ActionError.MissingDirection` si jamais `direction` est absent à runtime (garde défensive)
5. Mettre à jour tous les tests existants qui créent des `EndTurn` actions → ajouter une direction

**Tests** :
- `EndTurn` sans direction → erreur de compilation (type)
- `EndTurn` avec direction → pokemon.orientation mise à jour
- `getLegalActions` retourne 4 `EndTurn` avec les 4 directions

### Étape 2 — Core : orientation initiale vers le centre

**Fichiers** : `BattleSetup.ts` (renderer), `BattleEngine.ts` ou setup core

1. Au lieu de `orientation: Direction.South`, calculer `directionFromTo(position, gridCenter)` pour chaque Pokemon
2. Le centre de la grille = `{ x: Math.floor(width / 2), y: Math.floor(height / 2) }`
3. S'applique dans `createPokemonInstance` (ou au moment du placement)

**Tests** :
- Pokemon P1 en (1, 10) sur grille 12x12 → regarde East (centre en 6,6 : deltaX=5, deltaY=-4, |5|>|4| → East)
- Pokemon P2 en (10, 1) → regarde West (deltaX=-4, deltaY=5, |5|>|4| → South... vérifier)
- Vérifier que `directionFromTo` donne le bon résultat pour chaque position de spawn

### Étape 3 — Renderer : état `select_direction` dans la state machine

**Fichiers** : `GameController.ts`

1. Ajouter l'état `{ phase: "select_direction" }` au type `InputState`
2. `handleEndTurn` ne crée plus l'action directement → entre dans `enterDirectionSelection()`
3. Après Move ou UseMove (si le tour n'est pas fini), entrer aussi dans `select_direction` quand il ne reste que EndTurn à faire
4. En fait : **tout EndTurn passe par `select_direction`**, peu importe l'état précédent
5. Quand la direction est confirmée → créer `{ kind: ActionKind.EndTurn, pokemonId, direction }` et exécuter

### Étape 4 — Renderer : UI de choix de direction (style FFT)

**Fichiers** : nouveau `DirectionPicker.ts` dans `packages/renderer/src/ui/`

**Principe** : comme FFT — une flèche unique au-dessus du sprite qui indique la direction courante. Le joueur pointe dans la direction voulue autour du Pokemon et clique pour confirmer.

1. Créer `DirectionPicker` attaché à la `BattleScene` (pas l'overlay UI)
2. Afficher une flèche unique (triangle/chevron) au-dessus du sprite actif, orientée dans la direction courante
3. Découper l'espace autour du Pokemon en 4 quadrants isométriques (les 4 diagonales de la tile)
4. **Hover** : détecter dans quel quadrant se trouve la souris → déterminer la direction correspondante → pivoter le sprite + tourner la flèche en temps réel
5. **Clic gauche** : confirme la direction, callback avec la `Direction` choisie
6. **Escape** : retour au menu d'action (annuler le choix de direction)

**Mapping quadrants iso → directions core** :
- Quadrant haut-droite (écran) → North (NorthEast iso)
- Quadrant bas-gauche (écran) → South (SouthWest iso)
- Quadrant bas-droite (écran) → East (SouthEast iso)
- Quadrant haut-gauche (écran) → West (NorthWest iso)

### Étape 5 — Renderer : masquer la barre PV pendant le choix

**Fichiers** : `PokemonSprite.ts`

1. Ajouter `setHpBarVisible(visible: boolean)` sur `PokemonSprite`
2. `enterDirectionSelection` → `sprite.setHpBarVisible(false)`
3. Quand la direction est confirmée → `sprite.setHpBarVisible(true)`
4. Si annulation (Escape) → `sprite.setHpBarVisible(true)`

### Étape 6 — Renderer : appliquer l'orientation sur TurnEnded

**Fichiers** : `GameController.ts`

1. Dans `processEvents`, quand on reçoit `TurnEnded` : lire `pokemon.orientation` et appeler `sprite.setDirection(orientation)` pour s'assurer que le sprite reflète la direction choisie
2. Vérifier que ça fonctionne aussi pour le tour suivant (le Pokemon garde sa direction)

---

## Hors scope

- Bonus de dégâts dos/face (Phase 2)
- Placement initial visuel (choix des positions par le joueur)
- Indicateur visuel permanent de la direction sur le sprite (flèche au sol, etc.)

## Risques

- **Aucun bloquant technique** : le core et les sprites supportent déjà les directions
- **UX** : le choix forcé à chaque tour peut être perçu comme lent → si besoin, on pourra ajouter un raccourci "garder la direction actuelle" plus tard
