---
status: done
created: 2026-04-02
updated: 2026-04-02
---

# Plan 029 — IA jouable avec niveaux de difficulté

## Objectif

Rendre le jeu jouable solo contre une IA en mode normal (pas sandbox), en commençant par un niveau
"facile" qui fait des choix raisonnables mais pas optimaux. L'architecture doit permettre d'ajouter
des profils de difficulté (medium, hard) sans refactoring.

## Contexte

Phase 2 — Démo jouable. L'objectif est un lien partageable où quelqu'un peut jouer seul contre une
IA. Actuellement le mode normal est hot-seat 2 joueurs humains. Il faut brancher une IA sur Player 2.

L'IA agressive (`aggressive-ai.ts`) existe déjà dans le core pour le système de replay (plan 028).
Elle fonce toujours et frappe le plus fort — trop prévisible pour un joueur. L'IA "facile" doit
faire des choix raisonnables (type advantage, kill potential, positionnement) mais avec du bruit
intentionnel pour rester accessible et imprévisible.

Le `DummyAiController` dans le renderer gère déjà le pattern `onTurnReady` pour le mode sandbox.
On réutilise ce pattern pour brancher une IA sur toute une équipe.

`getLegalActions` et `estimateDamage` sont déjà disponibles sur `BattleEngine`.
Les deux IAs existantes (`random-ai.ts`, `aggressive-ai.ts`) sont dans `packages/core/src/ai/`.

## Étapes

- [ ] Étape 1 — Créer `AiDifficulty` enum et interface `AiProfile` dans le core
  - Fichier : `packages/core/src/enums/ai-difficulty.ts`
    ```
    export const AiDifficulty = { Easy: "easy", Medium: "medium", Hard: "hard" } as const;
    export type AiDifficulty = ...
    ```
  - Fichier : `packages/core/src/types/ai-profile.ts`
    - Interface `AiProfile` avec au moins : `difficulty: AiDifficulty`, `randomWeight: number` (0–1),
      `scoringWeights: { killPotential, typeAdvantage, positioning, statChanges }`
  - Fichier : `packages/core/src/ai/ai-profiles.ts`
    - Exporter `EASY_PROFILE`, `MEDIUM_PROFILE`, `HARD_PROFILE` (seul Easy est implémenté dans ce plan,
      Medium et Hard peuvent être des clones d'Easy pour l'instant — ils seront affinés plus tard)
  - Exporter les nouveaux symboles dans `packages/core/src/ai/index.ts` et `packages/core/src/index.ts`

- [ ] Étape 2 — Créer `action-scorer.ts` : score une `Action` selon un `AiProfile`
  - Fichier : `packages/core/src/ai/action-scorer.ts`
  - Fonction : `scoreAction(action, state, moveRegistry, engine, profile): number`
  - Scoring pour les `UseMove` :
    - `killPotential` : si `estimateDamage` min >= HP restants de la cible → score élevé
    - `typeAdvantage` : `estimateDamage.effectiveness > 1` → bonus, `< 1` → malus
    - `statChanges` : move avec effets de stat → score fixe selon profil
  - Scoring pour les `Move` (déplacement) :
    - `positioning` : récompenser se rapprocher de l'ennemi le plus faible
  - `EndTurn` : score neutre (0)
  - Pas de score pour `UseMove` sans cible valide (déjà filtré par `getLegalActions`)
  - Test : `packages/core/src/ai/action-scorer.test.ts`
    - Un move qui KO doit scorer plus haut qu'un move non-KO sur la même cible
    - Un move efficace (type x2) doit scorer plus haut qu'un move neutre de même puissance

- [ ] Étape 3 — Créer `scored-ai.ts` : sélecteur d'action pondéré par score
  - Fichier : `packages/core/src/ai/scored-ai.ts`
  - Fonction : `pickScoredAction(legalActions, state, moveRegistry, engine, profile, random): Action`
  - Algorithme :
    1. Scorer toutes les actions avec `scoreAction`
    2. Selon `profile.randomWeight` : mélanger aléatoirement parmi les top-N (ex: top 3) plutôt que
       prendre systématiquement le meilleur → l'IA "facile" rate parfois le coup optimal
    3. Pour Easy : `randomWeight = 0.4` → 40% de chance de prendre une action sous-optimale dans le top 3
    4. Toujours retourner une action légale (fallback sur la première si score vide)
  - Test : `packages/core/src/ai/scored-ai.test.ts`
    - Avec seed fixe + randomWeight = 0 → doit toujours prendre le meilleur score
    - Avec seed fixe + randomWeight = 1 → doit prendre une action aléatoire parmi les légales
    - Toujours retourner une action contenue dans `legalActions`

- [ ] Étape 4 — Créer `AiTeamController` dans le renderer
  - Fichier : `packages/renderer/src/game/AiTeamController.ts`
  - Classe `AiTeamController` avec :
    - Constructeur : `(engine, playerId, profile, random)`
    - Méthode `isAiTurn(): boolean` — vérifie si le Pokemon actif appartient au `playerId`
    - Méthode `playTurn(): BattleEvent[]` — joue un tour complet :
      1. Si pas le tour de l'IA → retourner `[]`
      2. Récupérer `legalActions = engine.getLegalActions(playerId)`
      3. Appeler `pickScoredAction(...)` pour choisir Move ou UseMove
      4. `submitAction` → collecter les events
      5. Répéter jusqu'à `EndTurn` (même pattern que `DummyAiController`)
      6. Choisir direction EndTurn vers l'ennemi le plus proche (même logique que `aggressive-ai`)
  - Test : `packages/renderer/src/game/AiTeamController.test.ts`
    - Joue un tour complet sans crash avec EASY_PROFILE
    - Retourne `[]` quand c'est le tour du joueur humain
    - Retourne des events après avoir joué
    - Utiliser `createDefaultBattleConfig` + `createBattleFromPlacements` comme setup

- [ ] Étape 5 — Brancher `AiTeamController` dans `BattleScene` pour le mode normal
  - Modifier `packages/renderer/src/game/BattleSetup.ts` :
    - `defaultTeams` : passer `controller: PlayerController.Ai` pour Player2
    - Ou ajouter un paramètre optionnel `p2Controller?: PlayerController` dans `createDefaultBattleConfig`
  - Modifier `packages/renderer/src/scenes/BattleScene.ts` :
    - Dans la branche non-sandbox : si Player2 est `PlayerController.Ai`, instancier
      `AiTeamController(engine, PlayerId.Player2, EASY_PROFILE, createPrng(Date.now()))`
    - Brancher sur `controller.onTurnReady` (même pattern que DummyAiController dans sandbox)
    - Le joueur humain (Player1) garde le flow interactif normal — aucun changement

- [ ] Étape 6 — Test de smoke headless : combat complet Human vs Easy AI
  - Fichier : `scenarios/human-vs-easy-ai.scenario.test.ts`
  - Simuler un combat complet où Player1 joue aussi en IA agressive (pour accélérer) vs Easy AI
  - Vérifier : le combat se termine (victoire détectée), aucun crash, aucune boucle infinie
  - Format 6v6, équipes `defaultTeams`, seed fixe
  - Ce test doit rester dans `scenarios/` (combats headless, non inclus dans le coverage normal)

## Critères de complétion

- `pnpm test` passe (659 tests existants + nouveaux tests des étapes 2, 3, 4)
- Le mode normal démarre avec Player2 contrôlé par l'IA Easy
- Le joueur peut jouer ses tours normalement ; l'IA joue seule les tours de Player2
- L'IA prend des décisions : elle utilise des moves efficaces, tente des KO, se déplace vers les ennemis
- L'IA n'est pas parfaite : elle rate parfois le coup optimal (visible en jouant plusieurs parties)
- Le scenario test `human-vs-easy-ai` se termine sans boucle infinie en < 30s
- Aucun `any` implicite, `pnpm lint` passe

## Risques / Questions

- **Boucle infinie IA** : si l'IA ne joue jamais `EndTurn` → ajouter un failsafe (compteur max
  d'actions par tour, ex: 10) dans `AiTeamController.playTurn()`
- **`estimateDamage` dans le scorer** : `BattleEngine` est passé en paramètre à `scoreAction` pour
  accéder à `estimateDamage`. Cela signifie que le scorer a une dépendance sur le type `BattleEngine`
  du core. Acceptable puisque `action-scorer.ts` est dans `packages/core/`.
- **Équipe fixe en Phase 2** : on ne fait pas de sélection d'équipe dans ce plan. Les équipes sont
  les `defaultTeams` du `BattleSetup`. La sélection d'équipe est une feature Phase 2 séparée.
- **Profils Medium/Hard non balancés** : dans ce plan ils sont des clones d'Easy. Un plan ultérieur
  (Phase 2) les affinera quand la sélection d'équipe et l'UI settings seront là.

## Dépendances

- Nécessite : Plan 028 terminé (PRNG seedé, IAs existantes comme référence) ✅
- Débloque : sélection d'équipe (le choix du niveau de difficulté s'y greffera naturellement),
  mode headless d'équilibrage (Phase 5 — `EASY_PROFILE`, `HARD_PROFILE` déjà exportés)
