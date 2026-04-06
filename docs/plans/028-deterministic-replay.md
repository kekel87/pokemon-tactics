---
status: done
created: 2026-04-02
updated: 2026-04-02
---

# Plan 028 — Replay déterministe avec PRNG seedé

## Objectif

Remplacer tous les `Math.random()` du core par un PRNG seedé injectable dans `BattleEngine`,
logger les actions jouées, et permettre de rejouer un combat à l'identique à partir d'un seed
et d'une séquence d'actions. Ajouter un replay "golden" de référence et un test de non-régression.

## Contexte

Dernière tâche de Phase 1. Le core est validé (plans 001–027) et toutes les mécaniques aléatoires
sont connues. Pour l'équilibrage headless (1000 combats) et les tests de non-régression stables,
le moteur doit être déterministe. Décisions prises avec l'humain :
- Pas de champ `version` dans le format replay (reporté)
- Replay golden généré automatiquement via script
- Si une mécanique change et casse le golden → le test pète → on regénère. C'est voulu.
- Pas de viewer visuel (headless uniquement)

## Étapes

- [x] **Étape 1** — Créer `packages/core/src/utils/prng.ts` : PRNG mulberry32 seedé
  - Exporter `type RandomFn = () => number` (même signature que `Math.random`)
  - Exporter `function createPrng(seed: number): RandomFn`
  - Implémenter mulberry32 : `state = seed | 0; return () => { state += 0x6D2B79F5; ... }`
  - Ajouter `prng.test.ts` : vérifier déterminisme (même seed → même séquence), différence entre seeds
  - Critère : `createPrng(42)()` retourne exactement la même valeur après deux appels à froid

- [x] **Étape 2** — Injecter `RandomFn` dans `BattleEngine` et tous les sites d'appel
  - Ajouter `private readonly random: RandomFn` dans `BattleEngine`
  - Ajouter `random?: RandomFn` en dernier paramètre du constructeur (défaut : `Math.random`)
  - Passer `this.random` aux 5 appels dans `BattleEngine.ts` (lignes 430, 431, 513, 573, 966)
  - Modifier `checkAccuracy(move, attacker, defender, random)` — ajouter paramètre `random`
    - Fichier : `packages/core/src/battle/accuracy-check.ts` (ligne 23)
  - Modifier `calculateDamage(..., rollFactor?, random?)` — `roll = rollFactor ?? random()`
    - Fichier : `packages/core/src/battle/damage-calculator.ts` (ligne 52)
    - Conserver `rollFactor` pour `estimateDamage` (min/max preview, pas de PRNG)
  - Modifier `handleStatus(context)` — passer `random` via `EffectContext`
    - Fichier : `packages/core/src/battle/handlers/handle-status.ts` (lignes 17, 55, 57)
  - Modifier `rollMultiHitCount(min, max, random)` dans `handle-damage.ts` (ligne 15)
  - Modifier `statusTickHandler` — passer `random` via contexte ou paramètre
    - Fichier : `packages/core/src/battle/handlers/status-tick-handler.ts` (lignes 90, 104)
  - Ajouter `random: RandomFn` dans `EffectContext` (fichier `effect-handler-registry.ts`)
  - Mettre à jour `build-test-engine.ts` et `build-move-test-engine.ts` pour passer `Math.random` par défaut
  - Critère : `pnpm test` passe sans régression ; aucun `Math.random` direct restant dans `packages/core/src/battle/`

- [x] **Étape 3** — Définir le type `BattleReplay` dans `packages/core/src/types/battle-replay.ts`
  - Interface minimale :
    ```ts
    export interface BattleReplay {
      seed: number;
      actions: Action[];
    }
    ```
  - Exporter depuis `packages/core/src/types/index.ts`
  - Pas de champ `version` (décision prise)
  - Critère : le type compile sans erreur

- [x] **Étape 4** — Ajouter l'enregistrement des actions dans `BattleEngine`
  - Ajouter `private readonly recordedActions: Action[] = []` (uniquement si seed fourni)
  - À chaque `submitAction` réussi : `this.recordedActions.push(action)`
  - Ajouter méthode `exportReplay(): BattleReplay` qui retourne `{ seed: this.seed, actions: [...this.recordedActions] }`
  - Stocker le seed dans `private readonly seed: number` (0 si `Math.random` utilisé, ou seed fourni)
  - Critère : `engine.exportReplay()` retourne un objet sérialisable JSON sans erreur

- [x] **Étape 5** — Implémenter la fonction de rejeu dans `packages/core/src/battle/replay-runner.ts`
  - Exporter `function runReplay(replay: BattleReplay, buildEngine: (seed: number) => BattleEngine): BattleEngine`
  - La fonction crée un `BattleEngine` avec le seed du replay, soumet les actions dans l'ordre, retourne l'engine en état final
  - Ajouter `replay-runner.test.ts` : créer un engine, jouer 5 actions, exporter le replay, rejouer, vérifier que l'état final est identique (HP, positions, statuts)
  - Critère : le test de rejeu passe de manière stable (sans flakiness)

- [x] **Étape 6** — Créer le dossier `packages/core/src/ai/` avec les IA scriptées
  - `packages/core/src/ai/random-ai.ts` : piocher une action légale au hasard (utilise `RandomFn`)
  - `packages/core/src/ai/aggressive-ai.ts` : IA basique "fonce et tape"
    - Si un move peut toucher un ennemi → utiliser celui avec la plus haute base power
    - Sinon → se déplacer vers l'ennemi le plus proche (distance BFS)
    - EndTurn orienté vers l'ennemi le plus proche
  - `packages/core/src/ai/index.ts` : barrel exports
  - Tests pour les deux IA (prend une décision valide parmi les actions légales)
  - Critère : les deux IA jouent des actions légales sans crash

- [x] **Étape 7** — Générer le replay golden via script
  - Créer `scripts/generate-golden-replay.ts`
  - Le script crée un `BattleEngine` avec seed fixe (ex: `12345`), lance un combat `aggressive-ai` vs `aggressive-ai` jusqu'à victoire ou 200 rounds max, puis écrit le résultat dans `fixtures/replays/golden-replay.json`
  - Ajouter le script dans le `package.json` racine : `"replay:generate": "tsx scripts/generate-golden-replay.ts"`
  - Commiter `golden-replay.json` dans le repo
  - Critère : le script tourne sans erreur et produit un fichier JSON valide

- [x] **Étape 8** — Test de non-régression golden
  - Créer `packages/core/src/battle/golden-replay.test.ts`
  - Le test lit `fixtures/replays/golden-replay.json`, appelle `runReplay`, compare l'état final avec un snapshot (HP de chaque Pokemon, vainqueur, round number)
  - En cas d'échec : message clair "Golden replay cassé — relancer `pnpm replay:generate` pour régénérer"
  - Critère : le test passe avec le golden actuel et échoue si on modifie une mécanique aléatoire

## Critères de complétion

- Zéro `Math.random()` direct dans `packages/core/src/battle/` (vérifié par grep)
- `pnpm test` passe avec 100% de coverage maintenu sur les fichiers modifiés
- `fixtures/replays/golden-replay.json` présent et commité dans le repo
- `packages/core/src/ai/` contient `random-ai.ts` et `aggressive-ai.ts` avec tests
- `pnpm replay:generate` tourne sans erreur et régénère un golden valide
- `golden-replay.test.ts` passe de manière stable

## Risques / Questions

- **Propagation du paramètre `random`** : `statusTickHandler` est appelé depuis `TurnPipeline` qui ne reçoit pas le PRNG aujourd'hui — nécessite d'adapter `TurnPipeline` ou de passer `random` dans le contexte de pipeline
- **EffectContext** : ajouter `random` dans `EffectContext` impacte tous les handlers — vérifier qu'aucun handler n'en a besoin directement (seul `handle-status.ts` et `handle-damage.ts` pour l'instant)
- **IA agressive** : doit utiliser `getLegalActions` pour ne jouer que des coups légaux — attention à ne pas réinventer le pathfinding, réutiliser les actions move existantes
- **Stabilité du golden** : si l'IA fait des choix basés sur `getLegalActions` qui dépend de l'état (ordonné ou non), s'assurer que l'ordre est déterministe aussi

## Dépendances

- Nécessite : plans 001–027 terminés (core complet avec toutes les mécaniques)
- Débloque : Phase 2 — équilibrage headless (1000 combats avec seeds variés), mode IA avancée, MCP server
