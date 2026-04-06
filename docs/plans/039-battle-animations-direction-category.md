---
status: done
created: 2026-04-05
updated: 2026-04-05
---

# Plan 039 — Animations de combat : direction, catégorie de move, pipeline sprites

## Objectif

Rendre les combats visuellement cohérents : les sprites se tournent vers leur cible avant d'attaquer, se déplacent dans la bonne direction, et jouent l'animation qui correspond au type de move utilisé (contact, projectile, buff).

## Contexte

Les sprites PMDCollab ont 3 animations disponibles sur 100% du roster qui ne sont pas encore extraites : **Shoot**, **Charge** et **Hop**. Sans elles, tous les moves jouent "Attack" — que ce soit un Lance-Flammes ou une Épée Danse. Par ailleurs, le déplacement et l'attaque ne tournent jamais le sprite vers la bonne direction, ce qui casse l'illusion tactique.

Ce plan couvre 4 axes indépendants qui peuvent être exécutés en séquence :
1. Pipeline sprites : extraire Shoot, Charge, Hop
2. Classifier chaque move par catégorie d'animation (Contact/Shoot/Charge)
3. Direction correcte pendant le déplacement
4. Direction + bonne animation pendant l'attaque

## Étapes

- [x] **Étape 1** — Ajouter Shoot, Charge, Hop au pipeline d'extraction sprites
  - Dans `scripts/sprite-config.json`, ajouter `"Shoot"`, `"Charge"`, `"Hop"` à la liste `"animations"`
  - Vérifier que `scripts/extract-sprites.ts` n'a pas de logique hard-codée sur les noms d'animations (doit être générique)
  - Lancer `pnpm --filter renderer extract-sprites` pour régénérer les atlas de tous les Pokemon du roster
  - Valider : les atlas PNG+JSON générés contiennent bien des frames `Shoot-SouthWest`, `Charge-SouthWest`, `Hop-SouthWest` pour au moins Bulbasaur et Charmander
  - Complexite : faible (config JSON + re-run script)

- [x] **Étape 2** — Définir le type `AnimationCategory` et classifier tous les moves dans `packages/data`
  - Créer `packages/data/src/base/animation-category.ts` avec le const object pattern :
    ```ts
    export const AnimationCategory = {
      Contact: "Contact",
      Shoot: "Shoot",
      Charge: "Charge",
    } as const;
    export type AnimationCategory = (typeof AnimationCategory)[keyof typeof AnimationCategory];
    ```
  - Créer `packages/data/src/base/move-animation-categories.ts` : un `Record<string, AnimationCategory>` qui associe chaque move ID à sa catégorie
    - **Contact** (animation Attack) : scratch, tackle, headbutt, body-slam, bite, karate-chop, seismic-toss, rock-smash, volt-tackle, wing-attack, quick-attack, lick, rollout, flame-wheel, magnitude, slash, mega-punch, double-kick, fury-swipes, pound, earthquake, wrap, dragon-tail, poison-sting
    - **Shoot** (animation Shoot) : razor-leaf, sludge-bomb, ember, water-gun, bubble-beam, gust, dragon-breath, thunderbolt, psybeam, confusion, night-shade, aurora-beam, blizzard, icy-wind, acid, flamethrower, rock-throw, hyper-beam, leech-seed, sleep-powder, thunder-wave, hypnosis, supersonic, toxic, kinesis, flash, sand-attack, roar, growl, smokescreen, stockpile
    - **Charge** (animation Charge) : withdraw, bulk-up, double-team, defense-curl, agility, calm-mind, minimize, swords-dance, iron-defense, protect, detect, wide-guard, quick-guard, counter, mirror-coat, metal-burst, endure
  - Exporter depuis `packages/data/src/index.ts`
  - Valider : `pnpm build` sans erreur TypeScript
  - Complexite : moyenne (classification manuelle de ~70 moves, pas de logique complexe)

- [x] **Étape 3** — Direction correcte à chaque step du déplacement
  - Dans `packages/renderer/src/game/GameController.ts`, handler `BattleEventType.PokemonMoved` (lignes 728-737) :
    - Importer `directionFromTo` depuis `@pokemon-tactic/core`
    - Avant chaque `sprite.animateMoveTo(step.x, step.y)`, récupérer la position courante du sprite sur la grille et calculer la direction vers `step` via `directionFromTo`
    - Appeler `sprite.setDirection(direction)` avant le tween
    - La position courante est disponible via l'état interne — utiliser le step précédent de la boucle (initialiser avec la position du Pokemon au début du handler via `this.state.pokemon.get(event.pokemonId)?.position`)
    - Appliquer le même fix au handler `BattleEventType.PokemonDashed` (lignes 798-806), même pattern
  - Valider visuellement : en sandbox, un Pokemon qui se déplace diagonalement ou en L change de direction à chaque step
  - Complexite : faible (2 handlers, même logique)

- [x] **Étape 4** — Direction vers la cible avant l'animation d'attaque
  - Dans `packages/renderer/src/game/GameController.ts`, handler `BattleEventType.MoveStarted` (lignes 720-726) :
    - L'event `MoveStarted` contient `attackerId` et `targetIds`. Vérifier la structure exacte de l'event dans `packages/core/src/events/`
    - Si `targetIds` est non vide (move offensif ou ciblé), récupérer la position de l'attaquant et du premier target depuis `this.state.pokemon`
    - Calculer la direction via `directionFromTo(attackerPosition, targetPosition)` et appeler `sprite.setDirection(direction)` avant `playAnimationOnce`
    - Si `targetIds` est vide ou le target est l'attaquant lui-même (move self/Charge), ne pas changer la direction
  - Complexite : faible (1 handler, même pattern que étape 3)

- [x] **Étape 5** — Jouer la bonne animation selon la catégorie du move
  - Dans `packages/renderer/src/game/GameController.ts`, handler `BattleEventType.MoveStarted` :
    - Importer `moveAnimationCategories` et `AnimationCategory` depuis `@pokemon-tactic/data`
    - Récupérer la catégorie du move via `moveAnimationCategories[event.moveId] ?? AnimationCategory.Contact`
    - Mapper la catégorie vers le nom d'animation PMD :
      - `Contact` → `"Attack"`
      - `Shoot` → `"Shoot"`
      - `Charge` → `"Charge"`
    - Appeler `sprite.playAnimationOnce(animationName)` avec le nom mappé
    - Fallback : si l'animation n'existe pas dans l'atlas (sprite sans atlas), `playAnimationOnce` retourne déjà `Promise.resolve()` — comportement existant conservé
  - Valider visuellement : Ember joue Shoot, Scratch joue Attack, Épée Danse joue Charge
  - Complexite : faible (ajout d'un lookup + mapping)

## Critères de complétion

- Les atlas sprites contiennent les frames Shoot, Charge et Hop pour les 20 Pokemon du roster
- Chaque move du jeu a une catégorie d'animation définie dans `move-animation-categories.ts`
- Lors d'un déplacement, le sprite change de direction à chaque step du path
- Avant d'attaquer, le sprite se tourne vers sa cible (sauf moves self/buff)
- La bonne animation parmi Attack/Shoot/Charge est jouée selon la catégorie du move
- `pnpm build` et `pnpm test` passent sans erreur

## Risques / Questions

- **Disponibilité des animations** : Shoot, Charge et Hop sont annoncées comme disponibles sur 100% du roster, mais certains Pokemon PMDCollab ont des spritesets incomplets. Si une animation manque dans l'atlas, `playAnimationOnce` retourne déjà silencieusement — pas de crash, mais on verra l'Idle au lieu de l'animation. A vérifier au step 1.
- **Taille des atlas** : ajouter 3 animations x 8 directions va tripler la taille des atlas. Impact sur le temps de chargement à mesurer. Si problématique, on peut limiter les directions extraites à 4 (South/SouthEast/NorthEast/NorthWest) pour Shoot et Charge — mais c'est déjà le cas actuellement pour les 4 directions cardinales PMD.
- **Structure de MoveStarted** : l'event contient-il `targetIds` ou `targetId` ? A vérifier dans `packages/core/src/events/` avant d'implémenter l'étape 4.
- **Hop** : cette animation n'est pas utilisée dans ce plan (Quick Attack serait un candidat) mais est extraite pour le futur. Pas de risque, juste du poids supplémentaire dans les assets.

## Dépendances

- Dépend de : aucun plan en cours (indépendant)
- Débloque : Plan futur sur les effets visuels des moves (particules, projectiles)
- Relation avec Plan 031 (feedbacks visuels) : complémentaire, les deux plans améliorent le ressenti combat sans se chevaucher
