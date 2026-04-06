---
status: done
created: 2026-04-04
updated: 2026-04-04
---

# Plan 037 — Battle Log Panel

## Objectif

Ajouter un panneau de log de combat en haut à droite de l'écran qui affiche en temps réel les événements de la bataille sous forme de messages textuels, avec support i18n FR/EN et clic sur les noms de Pokemon pour recentrer la caméra.

## Contexte

Le système de `BattleEvent` est complet et bien structuré. Le `GameController` traite déjà chaque event dans `processEvent()`. Il manque un moyen pour le joueur de suivre ce qui se passe — surtout lors de combats IA vs IA ou quand plusieurs effects se déclenchent en chaîne. La roadmap Phase 2 liste le battle log comme tâche non cochée.

## Dépendances

- Plan 036 (layout de la scène BattleUIScene, constants de profondeur d'affichage)
- `packages/core/src/types/battle-event.ts` — structures d'events stables
- `packages/core/src/enums/battle-event-type.ts` — enum des types d'events
- Système i18n avec `t()` et fichiers de locales dans `packages/renderer/src/i18n/locales/`

Ce plan débloque : le replay (plan 028 a posé le PRNG, la barre de replay sera visuellement réservée ici)

## Étapes

- [ ] Étape 1 — Créer le `BattleLogFormatter` avec tests unitaires
  - Créer `packages/renderer/src/ui/BattleLogFormatter.ts`
  - Interface `BattleLogEntry` : `{ message: string; color: string; pokemonIds: string[] }`
    - `message` : texte brut avec placeholders `{name}` déjà résolus
    - `color` : couleur hexadécimale du message
    - `pokemonIds` : ids des Pokemon mentionnés (pour le clic caméra)
  - Exporter la fonction `formatBattleEvent(event: BattleEvent, context: BattleLogContext): BattleLogEntry | null`
    - `BattleLogContext` : `{ getPokemonName: (id: string) => string; getPlayerIdForPokemon: (id: string) => string; getMoveName: (id: string) => string; language: Language }`
    - Retourne `null` pour les events ignorés (voir liste ci-dessous)
  - Events à formater (avec couleurs constantes dans `BattleLogColors`) :
    - `TurnStarted` → `"Tour de {name}"` / `"{name}'s turn"` — `#aaaaaa`
    - `MoveStarted` → `"{name} utilise {move} !"` / `"{name} used {move}!"` — `#ffffff`
    - `DamageDealt` (amount > 0, effectiveness > 0) → `"{name} perd {n} PV !"` / `"{name} lost {n} HP!"` — `#ff6666`
    - `DamageDealt` (effectiveness >= 2) → ligne supplémentaire `"(Super efficace)"` / `"(Super effective)"` — `#ffdd00`
    - `DamageDealt` (effectiveness >= 4) → `"(Extrêmement efficace)"` / `"(Extremely effective)"` — `#ffdd00`
    - `DamageDealt` (effectiveness <= 0.5 et > 0) → `"(Pas très efficace)"` / `"(Not very effective)"` — `#ffdd00`
    - `DamageDealt` (effectiveness <= 0.25) → `"(Presque inefficace)"` / `"(Barely effective)"` — `#ffdd00`
    - `DamageDealt` (effectiveness === 0) → ignoré (déjà couvert visuellement par "immunisé")
    - `MoveMissed` → `"{name} rate son attaque !"` / `"{name}'s attack missed!"` — `#ffffff`
    - `StatusApplied` → `"{name} est {status} !"` / `"{name} was {status}!"` — `#ffaa44` (réutilise les clés `status.*` i18n existantes)
    - `StatusRemoved` → `"{name} n'est plus {status}"` / `"{name} is no longer {status}"` — `#ffaa44`
    - `StatChanged` (stages > 0) → `"L'Attaque de {name} augmente !"` / `"{name}'s Attack rose!"` — `#4488ff`
    - `StatChanged` (stages < 0) → `"La Défense de {name} baisse !"` / `"{name}'s Defense fell!"` — `#ff4444`
    - `PokemonKo` → `"{name} est K.O. !"` / `"{name} fainted!"` — `#ff2222`
    - `DefenseActivated` → `"{name} se protège avec {move} !"` / `"{name} protected itself!"` — `#44cc66`
    - `DefenseTriggered` (blocked: true) → `"{defense} protège {name} !"` / `"{name}'s {defense} blocked!"` — `#44cc66`
    - `DefenseTriggered` (blocked: false) → `"{defense} renvoie les dégâts !"` / `"{defense} reflected damage!"` — `#44cc66`
    - `ConfusionTriggered` → `"{name} est confus..."` / `"{name} is confused..."` — `#ffaa44`
    - `KnockbackApplied` → `"{name} est repoussé !"` / `"{name} was knocked back!"` — `#ffffff`
    - `MultiHitComplete` → `"Touché {n} fois !"` / `"Hit {n} times!"` — `#ffffff`
    - `RechargeStarted` → `"{name} doit se recharger"` / `"{name} must recharge"` — `#aaaaaa`
    - `BattleEnded` → `"Joueur {n} remporte le combat !"` / `"Player {n} wins!"` — `#ffee00`
  - Events ignorés : `TurnEnded`, `PokemonMoved`, `PokemonDashed`, `DefenseCleared`, `RechargeEnded`, `ConfusionRedirected`, `ConfusionResisted`, `ConfusionFailed`, `KnockbackBlocked`, `PokemonEliminated`, `PokemonRevived`, `DamageDealt` avec effectiveness === 0
  - Créer `packages/renderer/src/ui/BattleLogFormatter.test.ts` — tester chaque event formatable avec des fixtures de context
  - `pnpm test`

- [ ] Étape 2 — Ajouter les clés i18n pour le battle log
  - Dans `packages/renderer/src/i18n/types.ts` ajouter les clés :
    - `"log.turnStarted"`, `"log.moveStarted"`, `"log.damageDealt"`, `"log.moveMissed"`
    - `"log.statusApplied"`, `"log.statusRemoved"`
    - `"log.statRose"`, `"log.statFell"`
    - `"log.pokemonKo"`, `"log.defenseActivated"`, `"log.defenseBlocked"`, `"log.defenseReflected"`
    - `"log.confusionTriggered"`, `"log.knockbackApplied"`, `"log.multiHit"`, `"log.rechargeStarted"`, `"log.battleEnded"`
    - `"log.title"` (label du header "Battle Log")
    - Pour les effectivités : `"log.superEffective"`, `"log.extremelyEffective"`, `"log.notVeryEffective"`, `"log.barelyEffective"`
  - Remplir `packages/renderer/src/i18n/locales/fr.ts` et `en.ts` avec les valeurs correspondant au tableau du design
  - Les noms de stats réutilisent les clés `"stat.*"` existantes (atk, def, etc.)
  - Les statuts réutilisent les clés `"status.*"` existantes
  - `pnpm build && pnpm test`

- [ ] Étape 3 — Créer le composant `BattleLogPanel` (affichage Phaser)
  - Créer `packages/renderer/src/ui/BattleLogPanel.ts`
  - Constantes de layout dans `packages/renderer/src/constants.ts` :
    - `BATTLE_LOG_WIDTH = 300`, `BATTLE_LOG_VISIBLE_LINES = 6`, `BATTLE_LOG_LINE_HEIGHT = 20`
    - `BATTLE_LOG_PADDING = 8`, `BATTLE_LOG_HEADER_HEIGHT = 28`, `BATTLE_LOG_ACTIONS_HEIGHT = 32`
    - `BATTLE_LOG_BG_ALPHA = 0.7`
  - Classe `BattleLogPanel` avec :
    - `constructor(scene: Phaser.Scene, x: number, y: number)` — positionné en haut à droite via les constants CANVAS_WIDTH
    - `addEntry(entry: BattleLogEntry): void` — ajoute une entrée, conserve max 50 lignes en mémoire, auto-scroll vers le bas
    - `toggle(): void` — bascule entre état déplié et replié
    - `destroy(): void` — nettoyage des GameObjects Phaser
  - Rendu Phaser (pas de DOM) :
    - Fond semi-transparent : `scene.add.rectangle()` avec `setAlpha(0.7)`
    - Header : texte "☰ Battle Log ▾" / "☰" en état replié — `scene.add.text()`
    - Zone de texte : tableau de `Phaser.GameObjects.Text`, une ligne par entry visible
    - Barre d'actions en bas : 5 boutons grisés (⏮ ⏪ ▶ ⏩ ⏭) — `scene.add.text()` avec couleur `#555555`, non interactifs
    - Clic sur le header → `toggle()`
  - En état replié : seul le fond du header + "☰" restent visibles
  - Depth : `DEPTH_UI_BASE + 10` (au-dessus des autres éléments UI)
  - `pnpm build`

- [ ] Étape 4 — Rendre les noms de Pokemon cliquables (clic → caméra)
  - Dans `BattleLogPanel`, chaque `BattleLogEntry` qui contient des `pokemonIds` affiche le nom en couleur d'équipe
  - Bleu pour Joueur 1 (`TEAM_COLOR_PLAYER_1`), rouge pour Joueur 2 (`TEAM_COLOR_PLAYER_2`)
  - Stratégie : chaque ligne de texte est un `Phaser.GameObjects.Text` unique ; utiliser `setInteractive()` sur la zone de la ligne + callback `onClickPokemonId`
  - `BattleLogPanel` expose : `onPokemonClick: ((pokemonId: string) => void) | null`
  - Le callback est appelé avec l'id du Pokemon mentionné en premier dans la ligne (simplification : un clic = premier Pokemon de la ligne)
  - `pnpm build`

- [ ] Étape 5 — Intégrer `BattleLogPanel` dans `BattleUIScene` et `GameController`
  - Dans `packages/renderer/src/scenes/BattleUIScene.ts` (ou équivalent) :
    - Instancier `BattleLogPanel` positionné en haut à droite (CANVAS_WIDTH - BATTLE_LOG_WIDTH - 8, 8)
    - Passer la référence au `GameController`
  - Dans `GameController.ts` :
    - Ajouter `private readonly battleLogPanel: BattleLogPanel | null` (optionnel pour ne pas casser le sandbox)
    - Dans `processEvent()`, après chaque traitement existant, appeler `formatBattleEvent()` et si non null, `battleLogPanel?.addEntry(entry)`
    - Brancher `battleLogPanel.onPokemonClick` → `this.scene.cameras.main.pan(spriteX, spriteY, 300)` (utiliser la position du sprite Phaser)
  - `pnpm build && pnpm test`

- [ ] Étape 6 — Vérifications finales
  - Vérifier que le panel ne bloque pas les clics sur la grille (Phaser input priority)
  - Vérifier l'affichage sur écran 4K (responsive via les constants de layout, pas de taille fixe pixel)
  - `pnpm build && pnpm test`

## Critères de complétion

- Le panel s'affiche en haut à droite, fond semi-transparent, header "☰ Battle Log ▾"
- Chaque event de la liste génère le message attendu en FR et EN
- Les messages s'ajoutent au fil du combat avec auto-scroll vers le bas
- Le panel est pliable/dépliable via clic sur le header
- Les noms de Pokemon sont en couleur d'équipe et cliquables → la caméra se recentre sur le Pokemon
- La barre d'actions replay est visible mais grisée et non fonctionnelle
- Tests unitaires du `BattleLogFormatter` couvrent tous les events formatables
- Build et tests passent

## Risques / Questions

- **Phaser text multicolore** : Phaser 4 supporte le `RichText` ou les `TextStyle` par segment. Si non disponible facilement, simplifier : nom en couleur d'équipe = ligne entière colorée, ou nom entre brackets `[Pikachu]` sans couleur différente dans un premier temps.
- **Scroll interne en Phaser** : pas de `div` scrollable, le scroll doit être simulé manuellement en décalant l'index d'affichage. Garder 50 entrées max en mémoire, afficher les 6 dernières.
- **Clic sur le panel vs. clic sur la grille** : s'assurer que `setInteractive()` sur le fond du panel absorbe les clics (éviter le click-through sur la grille).
- **Performance** : éviter de recréer les `Text` Phaser à chaque entry. Utiliser un pool fixe de 6 Text objects, mettre à jour le contenu.

## Hors scope

- Implémentation du replay (les boutons sont là mais grisés)
- Filtrage par type d'event
- Export du log en texte
- Historique entre les rounds
