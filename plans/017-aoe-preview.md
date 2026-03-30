# Plan 017 — Prévisualisation AoE sur la grille

**Statut** : done
**Créé** : 2026-03-30
**Terminé** : 2026-03-30
**Prérequis** : Plan 016 (terminé)

---

## Objectif

Quand le joueur est en état `select_attack_target`, afficher en temps réel les tiles qui seront affectées par l'attaque. La direction suit la souris (algo quadrant du DirectionPicker) pour les moves directionnels. Flow en 2 étapes de confirmation (style FFTA) : preview → verrouillage avec clignotement → confirmation ou annulation.

## Flow d'interaction (2 étapes)

### Étape A — Preview (hover)
Le joueur survole la grille, la preview AoE suit la souris (tiles orange). Les tiles affectées sont visibles en temps réel.

### Étape B — Verrouillage + confirmation
1. **Premier clic** = verrouille la cible. Les sprites des Pokemon touchés clignotent (alpha oscillant). Plus tard : affichage preview dégâts.
2. **Deuxième clic** = confirme l'exécution de l'attaque.
3. **Escape** (à n'importe quel moment) = annule et retourne au sous-menu attaque.

### Paramètre `confirmAttack`

Le flow 2 étapes est contrôlé par un paramètre de partie `confirmAttack: boolean` :
- `true` (défaut) : flow complet — preview → verrouillage (clignotement) → confirmation
- `false` : flow direct — preview → premier clic exécute immédiatement (pas de clignotement)

Ce paramètre sera dans la config de `BattleScene` / `GameController`, extensible pour accueillir d'autres options (ex: `showDamagePreview` plus tard).

## Comportement par pattern

| Pattern | Preview (hover) | Verrouillage (1er clic) | Confirmation (2e clic) |
|---------|-----------------|-------------------------|------------------------|
| **Single** | Tile survolée si dans targets valides | Clic sur tile valide | Clic pour confirmer |
| **Self** | Tile du caster, affichée dès l'entrée | Clic n'importe où | Clic pour confirmer |
| **Cone** | Direction suit la souris → cone complet | Clic n'importe où = verrouille direction | Clic pour confirmer |
| **Line** | Direction suit la souris → ligne complète | Clic n'importe où = verrouille direction | Clic pour confirmer |
| **Slash** | Direction suit la souris → arc complet | Clic n'importe où = verrouille direction | Clic pour confirmer |
| **Cross** | Zone fixe en +, affichée dès l'entrée | Clic n'importe où | Clic pour confirmer |
| **Zone** | Zone fixe circulaire, affichée dès l'entrée | Clic n'importe où | Clic pour confirmer |
| **Blast** | Rayon d'explosion autour du centre survolé | Clic sur tile valide | Clic pour confirmer |
| **Dash** | Direction suit la souris → chemin + impact | Clic sur tile valide | Clic pour confirmer |

Escape = annuler à tout moment (preview ou verrouillage) → retour au sous-menu attaque.

## Étapes d'implémentation

### Étape 1 — Constantes + layer de preview dans IsometricGrid

**Fichiers** : `constants.ts`, `IsometricGrid.ts`

Ajouter dans `constants.ts` :
- `DEPTH_GRID_PREVIEW = 120` (entre `DEPTH_GRID_HIGHLIGHT = 100` et `DEPTH_GRID_CURSOR = 150`)
- `TILE_PREVIEW_COLOR = 0xff8844` (orange, distinct du rouge targets)
- `TILE_PREVIEW_FRIENDLY_COLOR = 0xffaa00` (orange vif, warning allié en danger)
- `TILE_PREVIEW_ALPHA = 0.5`

Ajouter dans `IsometricGrid` :
- `previewGraphics` : nouveau `Phaser.GameObjects.Graphics` à depth `DEPTH_GRID_PREVIEW`
- `showPreview(positions: Position[], color: number, alpha: number)` : dessine les tiles de preview
- `clearPreview()` : efface uniquement le preview (ne touche pas aux highlights)

### Étape 2 — Extraire `getDirectionFromPointer` en utilitaire

**Fichier** : nouveau `packages/renderer/src/utils/screen-direction.ts`

Extraire la logique quadrant de `DirectionPicker.getDirectionFromPointer` (actuellement `private`) en fonction exportée :

```ts
export function getDirectionFromScreenPosition(
  worldX: number, worldY: number,
  centerX: number, centerY: number,
): Direction
```

Refactorer `DirectionPicker` pour utiliser cette fonction au lieu de sa copie privée.

### Étape 3 — Getter public `grid` sur BattleEngine

**Fichier** : `packages/core/src/battle/BattleEngine.ts`

`grid` est actuellement `private`. Ajouter un getter public `getGrid(): Grid` (lecture seule) pour que le renderer puisse appeler `resolveTargeting` avec la grid. Re-export depuis `index.ts` si nécessaire (Grid est déjà exporté).

### Étape 4 — Type `BattleConfig` + paramètre `confirmAttack`

**Fichier** : nouveau type dans `packages/renderer/src/types/` ou inline dans `GameController.ts`

```ts
interface BattleConfig {
  confirmAttack: boolean; // true = flow 2 étapes, false = clic direct
}
```

Passer `BattleConfig` au constructeur de `GameController`. Défaut : `{ confirmAttack: true }`.

### Étape 5 — Nouveaux états dans la state machine

**Fichier** : `GameController.ts`

Ajouter un nouvel état `InputState` :

```ts
| { phase: "confirm_attack"; moveId: string; targetPosition: Position; affectedTiles: Position[] }
```

Flow :
- `select_attack_target` → (1er clic) → `confirm_attack` (verrouillage, sprites clignotent)
- `confirm_attack` → (2e clic) → `animating` (exécution)
- `confirm_attack` → (Escape) → `select_attack_target` (retour preview) ou `attack_submenu`

Si `confirmAttack === false` : skip `confirm_attack`, le 1er clic passe directement à `animating`.

### Étape 6 — `handleTileHover` dans GameController

**Fichier** : `GameController.ts`

Nouvelle méthode publique :

```ts
handleTileHover(
  gridPosition: { x: number; y: number } | null,
  worldPosition: { x: number; y: number },
): void
```

- `gridPosition` : tile survolée (null si hors grille)
- `worldPosition` : coords monde de la souris (pour l'algo directionnel)

Actif uniquement en phase `select_attack_target` (pas en `confirm_attack` — preview verrouillée).

Logique :

1. Si `gridPosition` null → `clearPreview()` + return
2. Récupérer le `TargetingPattern` du move via `moveDefinitions`
3. Classifier le pattern :
   - **Directionnel (Cone, Line, Slash)** : calculer direction via `getDirectionFromScreenPosition(worldX, worldY, casterScreenX, casterScreenY)`. Construire `targetPosition` adjacente correspondante. Appeler `resolveTargeting(pattern, caster, targetPosition, grid)`.
   - **Dash** : même calcul directionnel pour la preview. Construire `targetPosition` = tile survolée si valide.
   - **Point-target (Single, Blast)** : si tile survolée dans les targets valides → `resolveTargeting(pattern, caster, gridPosition, grid)`. Sinon `clearPreview()`.
   - **Self-centered (Self, Cross, Zone)** : ignoré ici (géré à l'étape 7).
4. Calculer les tiles de preview
5. Pour chaque tile : vérifier si un allié vivant s'y trouve (`state.pokemon` avec `playerId === activePlayerId` et `currentHp > 0`) → couleur `TILE_PREVIEW_FRIENDLY_COLOR`, sinon `TILE_PREVIEW_COLOR`
6. Appeler `isometricGrid.showPreview()` avec les deux groupes de tiles

Stocker `currentPreviewDirection: Direction | null` et `currentPreviewTiles: Position[]` pour la phase de verrouillage.

### Étape 7 — Preview statique pour Self/Cross/Zone

**Fichier** : `GameController.ts`, dans `enterAttackTarget()`

Pour les patterns self-centered, calculer le preview une seule fois à l'entrée :
- Appeler `resolveTargeting(pattern, caster, caster.position, grid)`
- Afficher via `showPreview()` immédiatement
- Warning friendly fire immédiat si des alliés vivants sont dans la zone
- `clearPreview()` appelé dans `enterAttackSubmenu()` (cancel) et `executeAction()` (confirm)

Pas de highlight rouge des "targets valides" — juste le preview orange + clic pour verrouiller/confirmer.

### Étape 8 — Modification de `handleTileClick` (verrouillage + confirmation)

**Fichier** : `GameController.ts`

**Phase `select_attack_target`** — Premier clic = verrouillage :

Pour les **directionnels (Cone, Line, Slash)** :
- Utiliser `currentPreviewDirection` pour construire la `targetPosition` adjacente
- Trouver l'action via `findUseMoveAction(moveId, adjacentX, adjacentY)`
- Si `confirmAttack` → passer en `confirm_attack` avec les tiles affectées + lancer clignotement
- Si `!confirmAttack` → exécuter directement

Pour **Self/Cross/Zone** :
- Trouver l'action via `findUseMoveAction(moveId, caster.x, caster.y)`
- Même logique `confirmAttack` / direct

Pour **Dash/Single/Blast** :
- Clic sur tile valide, trouver l'action existante
- Même logique `confirmAttack` / direct

**Phase `confirm_attack`** — Deuxième clic = exécution :
- Récupérer l'action stockée dans l'état
- Appeler `executeAction()`
- Arrêter le clignotement, `clearPreview()`

### Étape 9 — Clignotement des sprites touchés (style FFTA)

**Fichier** : `GameController.ts`

Actif uniquement en phase `confirm_attack` (après verrouillage).

- Identifier les `PokemonSprite` des Pokemon vivants dans `affectedTiles`
- Appliquer un tween `alpha: 0.3 ↔ 1.0` (yoyo, repeat -1, duration ~300ms)
- Alliés ET ennemis clignotent
- Stocker dans `private previewFlashTweens: Phaser.Tweens.Tween[]`
- Nettoyage (arrêt tweens + restauration alpha 1.0) dans :
  - `executeAction()` (confirmation)
  - `handleEscapeKey()` (annulation)
  - Toute sortie de `confirm_attack`

### Étape 10 — Intégrer le hover dans BattleScene.setupInput

**Fichier** : `packages/renderer/src/scenes/BattleScene.ts`

Dans le handler `pointermove`, ajouter :

```ts
controller.handleTileHover(
  grid, // { x, y } | null
  { x: pointer.worldX, y: pointer.worldY },
);
```

Appeler sur chaque pointermove (pas seulement quand la tile change) car pour les directionnels, la direction peut changer sans changer de tile.

### Étape 11 — Escape pour annuler

**Fichier** : `GameController.ts`, dans `handleEscapeKey()`

Ajouter deux cas :
- `select_attack_target` → `clearPreview()` + `enterAttackSubmenu()`
- `confirm_attack` → arrêter clignotement + `clearPreview()` + retour à `select_attack_target` (on reste sur le même move, on revient juste à la preview libre)

---

## Edge cases documentés

- **Cone/Line/Slash face à un bord de map** : `resolveTargeting` clippe déjà aux limites de la grille (`grid.isInBounds`). La preview affiche uniquement les tiles valides.
- **Blast en bord de grille** : même chose, `resolveBlast` → `getTilesInRadius` clippe via `isInBounds`.
- **Corps KO dans la zone** : ne pas afficher le warning friendly fire pour les Pokemon KO (`currentHp <= 0`) — ils ne prennent pas de dégâts. Ne pas les faire clignoter non plus.
- **Dash dans le vide** : la preview montre la tile de destination. Pas de distinction visuelle spéciale (le joueur voit qu'il n'y a pas d'ennemi).
- **Dash : preview vs clic** : la preview suit la direction de la souris, mais le clic doit être sur une tile valide (highlight rouge). Si le joueur clique hors des tiles valides → ignoré.
- **`confirmAttack: false`** : le clignotement et la phase `confirm_attack` sont entièrement skippés. Aucun code ne doit dépendre de `confirm_attack` pour fonctionner.

## Exports core

- `resolveTargeting` — déjà exporté ✓
- `Grid` — déjà exporté ✓
- `BattleEngine.getGrid()` — à ajouter (étape 3)

---

## Note : compatibilité manette (Phase 2)

Le flow actuel est souris-first mais ne bloque pas un portage manette :
- Directionnels : le stick analogique remplacerait `worldPosition` pour le calcul de direction
- Point-target : un curseur grille déplaçable au D-pad remplacerait le hover souris
- Confirmation : bouton A au lieu du clic, bouton B au lieu d'Escape

À garder en tête : ne pas hard-coder de dépendance à `pointer.worldX/worldY` dans la logique métier. Passer des coordonnées abstraites.

## Non-scope

- Pas de preview de dégâts estimés (Phase 1 ultérieure — le slot est prêt dans `confirm_attack`)
- Pas de couleur spéciale pour Self/buffs (orange standard, cohérent FFTA)
- Pas d'implémentation manette (Phase 2)

## Tests

- Étape 3 (getter grid) : un test unitaire minimal dans le core
- Étapes renderer : vérification visuelle via `visual-tester`
- Les resolvers core sont déjà testés à 100%
