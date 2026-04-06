# Plan 024 — Bugfixes sandbox + relocalisation menu d'attaque

> Statut : **done**
> Créé : 2026-04-01

## Contexte

Trois problemes remontés lors de la session précédente (test sandbox + combat normal) :

1. **Bug Vampigraine HP bar** : les dégâts de Leech Seed s'affichent dans l'InfoPanel (texte HP) mais la barre de vie sur le sprite Pokemon ne se met pas à jour visuellement.
2. **Bug status burn au spawn** : quand on lance le sandbox avec `?status=burned`, le statut brûlure n'apparaît pas à côté de la barre de vie du sprite. Le core l'applique, mais le renderer ne l'affiche pas au démarrage.
3. **Souhait UX** : déplacer le menu d'action (Deplacement/Attaque/Objet/Attendre/Status) et le sous-menu attaque en bas à gauche, au-dessus de l'InfoPanel. Actuellement en haut à droite (X=1050, Y=300).

## Analyse

### Bug 1 — Vampigraine HP bar

Le flow : `linkDrainHandler` mute `target.currentHp` dans le state → émet `LinkDrained` → `GameController.processEvent` lit `this.state.pokemon.get(event.targetId).currentHp` → appelle `targetSprite.updateHp(currentHp, maxHp)` → `drawHpBar()` clear + redraw les Graphics.

Le code semble correct en théorie (`GameController.ts:656-669`). Hypothèses à vérifier :
- **Hypothèse A** : le Graphics `clear()` + `fillRoundedRect()` de Phaser 4 ne rafraîchit pas visuellement dans certains cas (bug Phaser 4 RC ?). Vérifier si d'autres appels à `updateHp` (DamageDealt) fonctionnent correctement — si oui, c'est pas ça.
- **Hypothèse B** : le `targetId`/`sourceId` dans l'event LinkDrained ne correspond pas aux sprites attendus (inversion source/target dans le renderer).
- **Hypothèse C** : le drain se produit en EndTurn phase, et le `processEvents` des events EndTurn a un chemin différent de celui de `submitAction`. Vérifier comment les events de turnPipeline sont propagés.

→ Approche : ajouter un `console.log` temporaire dans le handler `LinkDrained` du GameController pour vérifier les valeurs, puis corriger.

### Bug 2 — Status burn au spawn

Cause identifiée : le constructeur de `PokemonSprite` (`PokemonSprite.ts:75-122`) n'appelle jamais `updateStatus()` avec les `statusEffects` initiaux du `PokemonInstance`. Il initialise le HP ratio et les animations, mais ignore les statuts pré-existants.

Fix direct : appeler `this.updateStatus(pokemon.statusEffects)` dans le constructeur après la création de la HP bar (avant `this.container = ...`). Pareil pour l'animation sleep (`setStatusAnimation`).

### Souhait 3 — Menu en bas à gauche

Le menu est positionné via les constantes `ACTION_MENU_X = 1050` et `ACTION_MENU_Y = 300` (`constants.ts:99-100`). Tous les éléments du menu (ActionMenu, MoveTooltip) utilisent ces constantes.

Nouvelle position : au-dessus de l'InfoPanel (X=16, Y=606), aligné à gauche avec la timeline et le panel info. Le menu grandit vers le haut (Y = InfoPanel.Y - menuHeight) pour ne pas chevaucher.

Le MoveTooltip (actuellement à gauche du menu) devra passer à droite du menu.

## Étapes

### Étape 1 — Fix status burn au spawn (PokemonSprite constructor)

**Fichier** : `packages/renderer/src/sprites/PokemonSprite.ts`

- Dans le constructeur, après `this.drawHpBar()` et avant `this.container = scene.add.container(...)` :
  - Appeler `this.updateStatus(pokemon.statusEffects)` pour afficher l'icône statut initiale
  - Appeler `this.setStatusAnimation(pokemon.statusEffects[0]?.type === 'asleep')` si le pokemon est endormi au spawn
- Problème : `updateStatus` et `setStatusAnimation` utilisent `this.container` qui n'existe pas encore. Il faut soit :
  - (a) Créer le container plus tôt et ajouter les children après, soit
  - (b) Extraire la logique d'initialisation du status icon pour qu'elle retourne le GameObject à ajouter aux children, soit
  - (c) Appeler `updateStatus` juste après la création du container
- Option (c) est la plus simple : appeler après `this.container = scene.add.container(...)` et `this.updatePosition(...)`.

**Test** : lancer `?sandbox&status=burned` et vérifier que l'icône brûlure apparaît sur le sprite dès le spawn.

### Étape 2 — Fix Vampigraine HP bar

**Fichiers** : `packages/renderer/src/game/GameController.ts`, potentiellement `PokemonSprite.ts`

- Investiguer le bug :
  1. Vérifier comment les events de la `turnPipeline` (EndTurn) sont retournés par `submitAction` et passés à `processEvents` — s'assurer que `LinkDrained` est bien dans la liste des events
  2. Ajouter un log temporaire dans le case `LinkDrained` pour vérifier que `targetPokemon.currentHp` a bien diminué et que `targetSprite` existe
  3. Vérifier si le bug est spécifique au sandbox ou reproductible en combat normal
- Appliquer le fix selon la cause trouvée
- Retirer les logs temporaires

**Test** : en sandbox, donner Vampigraine au joueur, lancer sur le Dummy, finir le tour, vérifier que la HP bar du Dummy descend.

### Étape 3 — Relocaliser le menu d'action en bas à gauche

**Fichiers** :
- `packages/renderer/src/constants.ts` : modifier `ACTION_MENU_X` et `ACTION_MENU_Y`
- `packages/renderer/src/ui/ActionMenu.ts` : le menu doit grandir vers le haut (le Y de référence = bas du menu, pas haut)
- `packages/renderer/src/ui/MoveTooltip.ts` : tooltip à droite du menu (au lieu de gauche)

Détails :
- Nouvelle position X : `INFO_PANEL_X` (= 16) — aligné avec InfoPanel et Timeline
- Nouvelle position Y : calculée dynamiquement. Le bas du menu = `INFO_PANEL_Y - gap` (8px d'espace). Le haut = bas - (nbItems * itemHeight). Le menu grandit vers le haut.
- Largeur : garder `ACTION_MENU_WIDTH = 210`
- Remplacer les constantes `ACTION_MENU_X`/`ACTION_MENU_Y` par `ACTION_MENU_BOTTOM_Y` (= INFO_PANEL_Y - 8). Le Y du haut est calculé par le menu lui-même selon le nombre d'items.

**Tooltip/hover — points d'attention** :
- MoveTooltip passe à **droite** du menu : `x = menuX + ACTION_MENU_WIDTH + 8` (au lieu de `menuX - TOOLTIP_WIDTH - 8`)
- **Clamp vertical** : si un item de move est haut dans la liste, le tooltip peut dépasser le bas de l'écran. Clamper le Y du tooltip pour qu'il reste dans le canvas (`Math.min(menuItemY, canvasHeight - tooltipHeight)`).
- **Pas de chevauchement avec l'InfoPanel** : le menu est AU-DESSUS de l'InfoPanel (8px de gap). Les hitboxes/zones interactives du menu ne doivent pas descendre dans la zone InfoPanel. Vérifier que les `zone` Phaser dans `createMenuItem`/`createMoveItem` respectent les bounds.
- **showSelectedMove** (mini-panneau pendant le ciblage) : même logique — positionné en bas à gauche au-dessus de l'InfoPanel, 2 items de haut (header instruction + move).
- Le hover du sous-menu attaque déclenche le tooltip ET peut coexister avec le hover de la grille (qui met à jour l'InfoPanel). Pas de changement ici — l'InfoPanel suit le hover grid indépendamment, le tooltip est sur la UI scene.

**Calcul** :
- InfoPanel Y = 606, gap = 8 → bas du menu = 598
- Menu principal 5 items × 32px = 160px → haut = 598 - 160 = 438
- Sous-menu attaque 4 moves + Annuler = 5 items × 32px = 160px → haut = 438
- Tooltip à droite : x = 16 + 210 + 8 = 234, width = 160 → occupe 234-394, bien dans le canvas
- Avec 12 Pokemon, la timeline fait ~12×(36+10) + séparateur ≈ 560px max → pas de chevauchement

**Test** : lancer un combat normal, vérifier :
- Menu en bas à gauche, sous-menu attaque, tooltip à droite
- Hover sur chaque move → tooltip visible, pas tronqué
- showSelectedMove pendant le ciblage → bien positionné
- Aucun chevauchement avec InfoPanel ni timeline

### Étape 4 — Test visuel global

- Vérifier en combat normal (hot-seat) : menu, sous-menu, tooltip, directions
- Vérifier en sandbox : status au spawn, Vampigraine, menu position
- Vérifier le `showSelectedMove` (instruction + move affiché pendant le ciblage)
- 0 régressions attendues (pas de changement core)

## Fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `packages/renderer/src/sprites/PokemonSprite.ts` | Init status au constructeur |
| `packages/renderer/src/game/GameController.ts` | Fix LinkDrained (selon investigation) |
| `packages/renderer/src/constants.ts` | Nouvelles coordonnées menu |
| `packages/renderer/src/ui/ActionMenu.ts` | Menu grandit vers le haut |
| `packages/renderer/src/ui/MoveTooltip.ts` | Tooltip à droite du menu |

## Risques

- Le menu en bas à gauche pourrait chevaucher la timeline si beaucoup de Pokemon sont en jeu → vérifier avec 12 Pokemon (6v6)
- Phaser 4 RC peut avoir des comportements inattendus avec les Graphics redraw → le bug Vampigraine pourrait nécessiter un workaround
- Le tooltip pourrait sortir du canvas verticalement si le move hovered est en bas de la liste → clamp Y impératif
- Les zones interactives du menu pourraient capturer les events avant la grille → vérifier que le hover grid fonctionne toujours normalement quand le menu est affiché
