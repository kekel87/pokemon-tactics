---
status: done
created: 2026-04-03
updated: 2026-04-03
---

# Plan 033 — Écran de sélection d'équipe (Team Select)

## Objectif

Remplacer les équipes hardcodées dans `BattleSetup.ts` par un écran interactif de sélection d'équipe. Chaque joueur choisit jusqu'à 6 Pokemon depuis le roster complet, configure son contrôleur (humain ou IA), et valide son équipe avant de passer à la phase de placement. Le flow devient : TeamSelectScreen → PlacementPhase → Combat.

## Contexte

Actuellement, `defaultTeams` dans `BattleSetup.ts` et `startPlacementPhase` dans `BattleScene.ts` hardcodent les équipes et les contrôleurs. Le roster compte désormais 20+ Pokemon. La roadmap Phase 2 cible une démo jouable avec sélection d'équipe. L'utilisateur a validé ces contraintes : format fixe 6v6, pas de doublon par équipe, toggle humain/IA par joueur, pas de menu principal (on arrive directement sur le team select), bouton "placement auto" reporté à la PlacementPhase (hors scope de ce plan).

## Étapes

- [ ] Étape 1 — Créer la logique de validation d'équipe dans le core
  - Créer `packages/core/src/types/team-selection.ts` : interface `TeamSelection { playerId: PlayerId; pokemonDefinitionIds: string[]; controller: PlayerController; }`
  - Créer `packages/core/src/battle/team-validator.ts` avec la fonction `validateTeamSelection(selection: TeamSelection, allDefinitionIds: string[], maxTeamSize: number): { valid: boolean; errors: string[] }`
    - Valider que `pokemonDefinitionIds` n'est pas vide
    - Valider qu'il n'y a pas de doublon dans la même équipe (un Pokemon unique par équipe)
    - Valider que la taille est ≤ `maxTeamSize` (6 pour le format 6v6)
    - Valider que chaque `definitionId` existe dans `allDefinitionIds`
  - Créer `packages/core/src/battle/team-validator.test.ts` avec les cas :
    - Équipe valide (6 Pokemon distincts)
    - Équipe valide avec moins de 6 Pokemon (ex: 3)
    - Équipe vide → erreur
    - Équipe avec doublon → erreur
    - Équipe de 7 → erreur (dépasse maxTeamSize)
    - Pokemon inexistant dans le roster → erreur
  - Exporter `TeamSelection` et `validateTeamSelection` depuis `packages/core/src/index.ts`
  - Vérification : `pnpm test` dans `packages/core` doit passer

- [ ] Étape 2 — Créer la scène Phaser TeamSelectScene (structure de base)
  - Créer `packages/renderer/src/scenes/TeamSelectScene.ts` : classe Phaser.Scene `"TeamSelectScene"`
  - La scène reçoit en paramètre de `init()` : la liste des `PokemonDefinition` disponibles (chargée depuis `loadData()`)
  - Structure HTML-like en Phaser :
    - Fond plein écran semi-transparent sur fond noir
    - Titre centré "Sélection d'équipe" / "Team Selection" (via `t()` i18n)
    - Deux colonnes : Joueur 1 (gauche, couleur équipe bleue) et Joueur 2 (droite, couleur équipe rouge)
    - Chaque colonne contient : toggle Humain/IA, grille de portraits Pokemon sélectionnés (6 slots), bouton "Valider"
  - La scène émet un événement Phaser `"teamSelectComplete"` avec les deux `TeamSelection` quand les deux équipes sont validées
  - Pas encore de grille de choix (ajoutée étape 3) — afficher un placeholder "roster ici" pour tester la structure
  - Créer `packages/renderer/src/types/TeamSelectResult.ts` : `interface TeamSelectResult { teams: [TeamSelection, TeamSelection] }`
  - Vérification manuelle : la scène s'affiche correctement au démarrage

- [ ] Étape 3 — Grille de sélection des Pokemon (roster grid)
  - Dans `TeamSelectScene`, ajouter une grille fixe de portraits Pokemon (4x5 ou 5x4) (portrait-normal.png de chaque espèce) au centre de l'écran, partagée par les deux joueurs
  - Chaque portrait est un bouton cliquable : `Phaser.GameObjects.Image` avec fond coloré selon le type primaire du Pokemon, nom via i18n dessous
  - Logique de sélection : cliquer sur un portrait ajoute ce Pokemon à l'équipe active (le dernier joueur ayant cliqué "Edit" ou le joueur 1 par défaut)
    - Si le Pokemon est déjà dans l'équipe active → le retirer (toggle)
    - Un Pokemon peut être sélectionné par les deux équipes (pas de restriction inter-équipes)
    - Si 6 Pokemon déjà sélectionnés dans l'équipe active → clic ignoré + feedback visuel (slot complet)
  - Les 6 slots de l'équipe de chaque colonne affichent : portrait miniature + bouton croix pour retirer
  - Indicateur de slot actif : outline colorée sur la colonne en cours d'édition
  - Vérification manuelle : sélection/désélection fonctionne pour les deux joueurs

- [ ] Étape 4 — Toggle Humain/IA et bouton Valider
  - Toggle Humain/IA : bouton texte "Humain" / "IA" qui bascule `controller: PlayerController.Human | PlayerController.Ai` pour chaque colonne
    - Style visuel distinct : fond vert pour Humain, fond violet pour IA
    - Les deux joueurs peuvent être IA → mode spectateur "IA vs IA"
  - Bouton "Valider" par colonne : actif seulement si l'équipe a au moins 1 Pokemon
    - Appelle `validateTeamSelection()` du core — affiche les erreurs en rouge sous le bouton si invalide
    - Quand validé : colonne grisée + cadenas visuel, bouton devient "Modifier" pour déverrouiller
  - Bouton "Lancer le combat" au centre : actif seulement si les deux équipes sont validées
    - Émet l'événement `"teamSelectComplete"` avec les deux `TeamSelection`
  - Vérification manuelle : impossible de lancer sans 2 équipes validées, les erreurs s'affichent

- [ ] Étape 5 — Intégrer TeamSelectScene dans le flow principal
  - Modifier `packages/renderer/src/main.ts` : ajouter `TeamSelectScene` à la liste des scènes Phaser avant `BattleScene` et `BattleUIScene`
  - Modifier `packages/renderer/src/scenes/BattleScene.ts` : supprimer `startPlacementPhase` qui appelle `defaultTeams` et `pocArena` hardcodés
    - Remplacer par une méthode `startFromTeamSelection(teamSelectResult: TeamSelectResult)` qui reçoit les équipes validées
    - `BattleScene` démarre désormais uniquement via le signal de `TeamSelectScene`
  - Modifier `TeamSelectScene` : à la réception de `"teamSelectComplete"`, appeler `this.scene.start("BattleScene", { teamSelectResult })` et passer `this.scene.stop("TeamSelectScene")`
  - Modifier `BattleScene.create()` : lire `teamSelectResult` depuis `this.scene.settings.data`, construire les `PlacementTeam[]` depuis les `TeamSelection[]`, puis lancer la PlacementPhase avec les bonnes équipes et contrôleurs
    - Si `controller === PlayerController.Ai` pour une équipe → instancier `AiTeamController` avec le profil `EASY_PROFILE` (comportement actuel conservé)
  - Supprimer `defaultTeams` et `createDefaultBattleConfig()` de `BattleSetup.ts` (code mort)
  - Vérification : le flow complet fonctionne de bout en bout : sélection → placement → combat

- [ ] Étape 6 — Préchargement des assets dans TeamSelectScene
  - `TeamSelectScene.preload()` : charger tous les portraits `portrait-normal.png` de chaque Pokemon disponible
    - Utiliser `preloadPokemonAssets` de `SpriteLoader.ts` en mode portrait uniquement (ou créer un helper dédié si le preload des atlas est trop coûteux ici)
    - Charger les icônes de types (déjà chargés dans BattleScene — vérifier si partageables via cache Phaser ou à recharger)
  - `TeamSelectScene.create()` : déclencher `create()` uniquement après `preload()` complet (comportement standard Phaser)
  - Vérification : les portraits s'affichent sans erreur de texture manquante en console

- [ ] Étape 7 — Adaptation i18n et mode sandbox
  - Ajouter les clés i18n manquantes dans `packages/renderer/src/i18n/locales/fr.ts` et `en.ts` :
    - `teamSelect.title`, `teamSelect.player1`, `teamSelect.player2`, `teamSelect.human`, `teamSelect.ai`, `teamSelect.validate`, `teamSelect.modify`, `teamSelect.launch`, `teamSelect.slotEmpty`, `teamSelect.teamFull`, `teamSelect.errorEmpty`, `teamSelect.errorDuplicate`, `teamSelect.errorTooLarge`
  - Vérifier que le mode sandbox (`?sandbox=...`) contourne toujours le `TeamSelectScene` et arrive directement sur `BattleScene` (comportement existant conservé)
    - Dans `TeamSelectScene.create()` : vérifier `parseSandboxQueryParams()` — si présent, passer directement à `BattleScene` avec les équipes sandbox par défaut
  - Vérification : `pnpm test` dans `packages/renderer` doit passer (notamment `i18n/index.test.ts`)

## Critères de complétion

- `validateTeamSelection()` existe dans le core avec tests couvrant doublons, taille max, ids invalides
- On arrive directement sur le `TeamSelectScene` au démarrage (plus d'équipes hardcodées dans `BattleScene`)
- On peut sélectionner jusqu'à 6 Pokemon distincts par équipe depuis le roster complet
- Les portraits Pokemon s'affichent dans la grille de sélection
- Le toggle Humain/IA fonctionne pour chaque joueur (IA vs IA possible)
- Impossible de lancer sans valider les deux équipes (au moins 1 Pokemon chacune)
- Les erreurs de validation du core s'affichent à l'écran
- Le bouton "Valider" par équipe permet de verrouiller/déverrouiller
- Le flow complet TeamSelect → Placement → Combat fonctionne sans régression
- Le mode sandbox (`?sandbox=`) bypass le TeamSelectScene et fonctionne toujours
- Aucun `defaultTeams` hardcodé restant dans le code de production
- `pnpm build && pnpm test` passe au niveau racine sans régression

## Risques / Questions

- **Chargement des assets** : `BattleScene` charge déjà tous les atlas Pokemon dans son `preload()`. Si `TeamSelectScene` est une scène séparée, elle doit aussi charger les portraits — vérifier si le cache Phaser est partagé entre scènes pour éviter un double chargement. Alternative : charger les portraits dans `TeamSelectScene` uniquement (sans atlas) et laisser `BattleScene` charger les atlas complets.
- **Grille fixe** : avec 20 Pokemon, une grille 4x5 ou 5x4 tient à l'écran sans scroll. Si le roster dépasse 20, on ajoutera du scroll/pagination plus tard.
- **Couleurs de type** : la grille de portraits peut utiliser les type icons déjà disponibles pour indiquer le type de chaque Pokemon. Vérifier la disponibilité des assets de type dans la scène.
- **IA vs IA** : quand les deux équipes sont en mode IA, le combat doit démarrer directement sans attente d'input humain. Ce cas est déjà géré par le GameController (chaque tour IA est joué automatiquement) — vérifier que la PlacementPhase en mode IA est aussi automatique (actuellement `PlacementMode.Random` est utilisé pour le placement auto).
- **Pas de `PlacementMode.Auto` pour IA** : il faudra décider si une équipe IA passe en `PlacementMode.Random` automatiquement ou si l'humain place pour elle. Hors scope de ce plan — utiliser `PlacementMode.Random` pour les équipes IA.

## Dépendances

- Dépend de : Plan 013 (PlacementPhase + PlacementTeam), Plan 027 (roster 20 Pokemon + portraits), Plan 029 (AiTeamController + profils IA), Plan 030 (système i18n)
- Débloque : "Hot-seat 1v1 + multi-équipes" (roadmap Phase 2), formats variables (autres que 6v6), sélection de difficulté IA dans l'UI
