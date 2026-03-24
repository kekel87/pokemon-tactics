# Plan 011 — KO définitif avec corps bloquant + suppression koCountdown

> **Statut** : done
> **Date** : 2026-03-24
> **Objectif** : Un Pokemon KO reste sur la tile (traversable mais non-stoppable), supprimer koCountdown, préparer le terrain pour Second Souffle

---

## Contexte

Décisions #24 (révisée), #63, #92, #93 :
- KO = définitif. Pas de countdown FFTA.
- Le corps reste sur la tile : on peut **traverser** mais pas **s'arrêter** dessus.
- Seule revival possible : Second Souffle (Revival Blessing, 1 PP) — hors scope de ce plan.
- Roster cible : 151 premiers Pokemon (Gen 1) — la config sprites est extensible, pas d'action code ici.

### Changement principal dans le core

Actuellement `handleKo` fait `this.grid.setOccupant(pokemon.position, null)` — le Pokemon disparaît de la grille. Il faut :
1. Garder l'occupant sur la tile
2. Modifier le BFS et `validateMove` pour traiter un occupant KO comme **traversable** (comme un allié) mais **non-stoppable** (la tile reste occupée)
3. Modifier `dashMoveCaster` pour traverser les corps KO
4. Adapter le renderer : le sprite KO reste visible (Faint animation + immobile), pas de fadeOut

---

## Étape 1 — Supprimer `koCountdown` de `PokemonInstance`

**Fichiers** :
- `packages/core/src/types/pokemon-instance.ts` — retirer le champ
- `packages/core/src/testing/mock-pokemon.ts` — retirer des 5 mocks
- `packages/core/src/testing/mock-battle.ts` — retirer des 3 mocks
- `packages/renderer/src/game/BattleSetup.ts` — retirer de la factory

**Tests** : `npx vitest run` — doit rester à 244 tests, 100% coverage.

---

## Étape 2 — `handleKo` ne retire plus l'occupant + mise à jour tests existants

**Fichier** : `packages/core/src/battle/BattleEngine.ts`

**Changement** : supprimer `this.grid.setOccupant(pokemon.position, null)` dans `handleKo`.

Le reste de `handleKo` (retrait du turn order, rupture des liens, event Eliminated, checkVictory) ne change pas.

**Note** : `checkVictory` et `getAlivePokemon` filtrent sur `currentHp > 0`, pas sur l'occupation de la grille — aucun impact.

**Tests existants à vérifier/adapter** :
- Chercher tous les tests qui vérifient `grid.getOccupant(position) === null` après un KO — ils doivent maintenant vérifier que l'occupant reste présent
- Les tests d'intégration battle-loop (poison kill, sleep+drain, etc.) peuvent casser si ils vérifient la libération de la tile

**Tests à ajouter** :
- Un Pokemon KO reste occupant de sa tile (`grid.getOccupant(position)` retourne son id)
- `checkVictory` fonctionne toujours (basé sur `currentHp > 0`, pas sur l'occupation de la grille)

---

## Étape 3 — BFS pathfinding traverse les corps KO

**Fichier** : `packages/core/src/battle/BattleEngine.ts`

### 3a — `getLegalMoveActions` (BFS)
Condition actuelle (ligne ~431) : un occupant ennemi bloque la traversée.
Nouvelle condition : un occupant KO (`currentHp <= 0`) est traversable quel que soit le joueur.
La tile n'est pas ajoutée aux destinations valides (ligne ~404 : `occupant === null`) — inchangé, un corps KO bloque l'arrêt.

### 3b — `validateMove`
Condition actuelle (ligne ~516) :
- Occupant ennemi vivant → `BlockedByEnemy` (bloque la traversée)
- Occupant allié sur dernière case → `DestinationOccupied`

Nouvelle condition :
- Occupant KO (ennemi ou allié, `currentHp <= 0`) → traversable, mais `DestinationOccupied` si dernière case
- Occupant ennemi vivant → `BlockedByEnemy` (inchangé)
- Occupant allié vivant sur dernière case → `DestinationOccupied` (inchangé)

### 3c — `dashMoveCaster`
Condition actuelle (ligne ~362) : le dash s'arrête devant tout occupant non-self.
Nouvelle condition : le dash traverse les occupants KO (`currentHp <= 0`) et s'arrête devant les vivants.

**Tests à ajouter** :
- Un Pokemon peut traverser un corps KO ennemi (BFS retourne des tiles au-delà du corps)
- Un Pokemon ne peut pas s'arrêter sur une tile avec un corps KO (ni allié, ni ennemi)
- Un dash traverse un corps KO et continue jusqu'à un vivant ou la distance max
- Un dash s'arrête normalement devant un ennemi vivant (comportement inchangé)
- Un AoE ne cible pas un corps KO (déjà garanti par `target.currentHp <= 0` dans `executeUseMove`, mais vérifier avec un test explicite)

---

## Étape 4 — Renderer : sprite KO reste visible

**Fichiers** :
- `packages/renderer/src/sprites/PokemonSprite.ts`
- `packages/renderer/src/game/GameController.ts`

### Changement dans GameController.ts

Actuellement `PokemonKo` et `PokemonEliminated` partagent le même `case` (lignes 378-386) qui appelle `sprite.fadeOut()` puis `sprite.destroy()` et retire le sprite de la map.

**Dissocier les deux events** :
- `PokemonKo` : **supprimer le case** (ou laisser vide avec `break`). L'animation Hurt est déjà jouée par `DamageDealt` via `flashDamage()`. Rien à faire ici.
- `PokemonEliminated` : jouer `playFaintAndStay()`, **ne pas** `destroy()`, **ne pas** retirer de `this.sprites`. Le sprite reste sur la grille avec alpha réduit.

**Confirmation** : le filtre `currentHp > 0` dans `getPokemonAtPosition` est conservé tel quel — on ne peut pas cibler/sélectionner un corps KO via l'UI.

### Changement dans PokemonSprite.ts

Ajouter une méthode `playFaintAndStay()` :
- Appelle `setActive(false)` (arrête le pulse si actif)
- Joue l'animation Faint jusqu'à la dernière frame
- Reste visible avec alpha réduit (~0.5)
- Ne fait pas de tween fadeAlpha

---

## Étape 5 — Vérifications finales

- [ ] `npx vitest run` : tous les tests passent, 100% coverage
- [ ] Pas de tests existants cassés (grep `getOccupant.*null` dans les tests)
- [ ] `core-guardian` : pas de dépendance UI dans core
- [ ] `visual-tester` : vérifier visuellement qu'un KO laisse le sprite sur la grille (alpha réduit)
- [ ] Les tests d'intégration battle-loop (poison kill, sleep+drain, etc.) passent toujours
- [ ] `doc-keeper` : mettre à jour STATUS.md (prochaine étape, questions ouvertes)

---

## Hors scope

- Second Souffle (Revival Blessing) — plan dédié quand on ajoutera ce move
- Extension du roster aux 151 Pokemon — plan dédié pour le pipeline d'extraction
- Interactions tile occupée par un corps + AoE targeting — garanti par le filtre `currentHp <= 0` existant, vérifié par un test en étape 3
