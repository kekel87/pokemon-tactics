---
status: in-progress
created: 2026-03-31
updated: 2026-03-31
---

# Plan 023 — Mode Sandbox : training dummy, carte mini, panels config, moves défensifs

## Objectif

Ajouter un mode sandbox accessible via `?sandbox` (URL param) pour tester rapidement les mécaniques sans jouer un match complet : 1 Pokemon joueur vs 1 Dummy configurable sur une micro-carte 6x6, avec 8 nouveaux moves défensifs implémentés dans le core.

## Contexte

Le POC est fonctionnel avec un combat 6v6 complet et une phase de placement. Avant d'équilibrer les movesets et d'ajouter de nouvelles mécaniques de combat, on a besoin d'un outil de test rapide. Passer par le placement 6v6 pour tester un move défensif est trop lent. Le sandbox réutilise BattleEngine + BattleScene + GameController existants (pas un moteur parallèle).

## Étapes

### Partie 1 — Carte sandbox et infrastructure

- [ ] **Étape 1** — Créer la carte `sandbox-arena` dans `packages/data/src/maps/`
  - Fichier `packages/data/src/maps/sandbox-arena.ts` : `MapDefinition` 6x6
  - Format `TwoPlayer` uniquement, 1 spawn point par équipe
  - Spawn joueur : position `(1, 3)`, spawn dummy : position `(4, 3)` (face à face)
  - Export dans le barrel `packages/data/src/index.ts`
  - Test unitaire : `validateMapDefinition(sandboxArena)` doit passer

- [ ] **Étape 2** — Ajouter un mode `SandboxConfig` et un parser de query params
  - Fichier `packages/renderer/src/types/SandboxConfig.ts` : interface avec `pokemon`, `moves: string[]`, `hp: number`, `status`, `statStages`, `dummyPokemon`, `dummyMove`, `dummyDirection`, `dummyHp`, `dummyStatus`, `dummyStatStages`
  - Fichier `packages/renderer/src/utils/sandbox-query-params.ts` : `parseSandboxQueryParams(): SandboxConfig | null`
  - Retourne `null` si le param `sandbox` est absent, sinon parse et retourne avec valeurs par défaut
  - Valeurs par défaut : `pokemon: 'pikachu'`, `moves: []` (les 4 premiers moves du roster), `hp: 100%`, pas de statut, pas de stages, `dummyPokemon: 'machop'`, pas de dummyMove (passive), direction `south`
  - Tests unitaires dans `sandbox-query-params.test.ts` : cas complet, cas vide, cas partiels, cas invalides (pokemon inconnu → valeur par défaut)

- [ ] **Étape 3** — Créer `SandboxSetup.ts` dans `packages/renderer/src/game/`
  - `SandboxSetup.createSandboxBattle(config: SandboxConfig): BattleEngine` — instancie un combat 1v1 sur `sandbox-arena` sans passer par `PlacementPhase`
  - Applique les HP, statut et stat stages de la config directement sur les instances
  - Le dummy est en `PlayerController.Ai`, le joueur en `PlayerController.Human`
  - Tests : vérifie que le `BattleEngine` retourné a bien les 2 Pokemon sur leurs tiles respectives avec les paramètres configurés

- [ ] **Étape 4** — Brancher le mode sandbox dans `main.ts`
  - Si `parseSandboxQueryParams()` retourne non-null : `BattleScene` chargée avec `SandboxSetup.createSandboxBattle(config)` au lieu du flow placement normal
  - Si null : flow normal (inchangé)
  - Pas de test unitaire (bootstrap Phaser) — validation visuelle via Playwright

---

### Partie 2 — IA du dummy

- [ ] **Étape 5** — Implémenter `DummyAiController` dans `packages/renderer/src/game/`
  - `DummyAiController(engine: BattleEngine, dummyPokemonId: string, assignedMoveId: string | null)`
  - À chaque `TurnStarted` pour le dummy : si `assignedMoveId` est défini et que le move est légal → `submitAction(useMove)` ; sinon → `submitAction(EndTurn)`
  - Le DummyAiController s'insère dans `GameController` : si le Pokemon actif appartient au dummy, l'IA joue automatiquement
  - Direction fixe : `EndTurn` soumet toujours `dummyDirection` configuré
  - Tests unitaires : passive (EndTurn systématique), move assigné légal, move assigné illégal (fallback EndTurn)

---

### Partie 3 — 8 moves défensifs dans le core

> Tous les moves défensifs ont `targeting: { kind: 'self' }`. Ils durent "jusqu'au prochain tour du lanceur" sauf Prévention (1 coup). L'effet disparaît si le lanceur est KO.

- [ ] **Étape 6** — Infrastructure des effets défensifs dans le core
  - Nouveau type d'effet dans `packages/core/src/types/Effect.ts` : `{ kind: 'defensive'; defenseKind: DefensiveKind }`
  - Nouveau const enum `DefensiveKind` dans `packages/core/src/enums/DefensiveKind.ts` : `Protect | Detect | WideGuard | QuickGuard | Counter | MirrorCoat | MetalBurst | Endure`
  - Nouveau champ sur `PokemonInstance` : `activeDefense: ActiveDefense | null` avec type `ActiveDefense = { kind: DefensiveKind; usedAt: number }` (round + turnIndex pour savoir quand ça expire)
  - Méthode `clearExpiredDefenses(state: BattleState)` appelée au début du tour du défenseur — efface `activeDefense` si `usedAt` correspond au dernier tour du Pokemon
  - Tests unitaires : `ActiveDefense` correctement posé et effacé après 1 tour du lanceur, effacé sur KO

- [ ] **Étape 7** — Handler `defensive-effect-handler.ts` : Abri / Protect et Détection / Detect
  - Enregistre `activeDefense = { kind: Protect }` sur le lanceur
  - Dans `effect-processor.ts` : avant d'appliquer des dégâts/effets sur une cible, vérifier `activeDefense`
  - Protect/Detect : bloquer si l'attaque vient de face (direction de l'attaquant dans l'arc frontal 180° + côtés)
  - Émettre événement `DefenseTriggered` : `{ type: 'defense_triggered'; defenderId: string; defenseKind: DefensiveKind; blocked: boolean }`
  - Pas de spam penalty (contrairement au jeu principal — décision délibérée pour le tactique)
  - Tests unitaires : attaque bloquée de face, attaque non bloquée de dos, bloc AoE, expiration après tour

- [ ] **Étape 8** — Garde Large / Wide Guard
  - Bloque les attaques AoE (targeting kind `zone`, `cross`, `cone`, `slash`, `blast`) dans un rayon de 2 tiles autour du lanceur
  - Protège aussi les alliés dans ce rayon (les alliés avec `activeDefense = WideGuard` partagent la protection)
  - Dans `effect-processor.ts` : vérifier Wide Guard avant d'appliquer les effets AoE
  - Tests unitaires : AoE bloquée, single target non bloquée, protection alliés, expiration

- [ ] **Étape 9** — Prévention / Quick Guard
  - Bloque la prochaine attaque reçue (toute direction), consommée en 1 coup (pas durée = tour suivant)
  - `activeDefense` effacé après le premier coup reçu (dans `effect-processor.ts` après le bloc)
  - Tests unitaires : premier coup bloqué, deuxième coup non bloqué, expiration au prochain tour si non déclenché

- [ ] **Étape 10** — Riposte / Counter et Voile Miroir / Mirror Coat
  - Counter : prend les dégâts, renvoie x2 si l'attaque est de catégorie `physical` et que l'attaquant est adjacent (manhattanDistance = 1)
  - Mirror Coat : prend les dégâts, renvoie x2 si l'attaque est de catégorie `special` (toute portée)
  - Renvoi : appliquer `damage_dealt` sur l'attaquant après résolution du coup normal. Si le défenseur est KO du coup → pas de renvoi.
  - Tests unitaires : riposte physique contact, riposte ignorée si spéciale, mirror coat spéciale, mirror coat ignorée si physique, pas de renvoi si KO, expiration

- [ ] **Étape 11** — Fulmifer / Metal Burst
  - Renvoie x1.5 des dégâts reçus, contact ET distance (physique et spécial)
  - Même règle KO : si le défenseur meurt du coup → pas de renvoi
  - Tests unitaires : renvoi physique, renvoi spécial, pas de renvoi si KO, expiration

- [ ] **Étape 12** — Ténacité / Endure
  - Pose un flag `activeDefense = { kind: Endure }` sur le lanceur
  - Dans `effect-processor.ts` (processDamage) : si Endure actif et que les dégâts amèneraient à ≤ 0 HP → HP fixé à 1 au lieu de 0
  - Ne bloque PAS les dégâts de statut (burn/poison tick), terrain, chute — uniquement les dégâts d'attaque (`processDamage`)
  - Spam check : ne peut pas être utilisé 2 tours de suite. `ActionError.EndureSpam` si tentative. Implémenter `lastEndureRound` sur `PokemonInstance`.
  - Tests unitaires : HP bloqué à 1, statut tick passe quand même, spam rejeté, expiration

- [ ] **Étape 13** — Ajouter les 8 moves dans `packages/data`
  - `packages/data/src/base/moves.ts` : ajouter les 8 moves (power 0, accuracy 100, pp selon le jeu officiel, category `status`)
  - `packages/data/src/overrides/tactical.ts` : ajouter `targeting: { kind: 'self' }` et `effects: [{ kind: 'defensive', defenseKind: ... }]` pour chacun
  - `packages/data/src/overrides/balance-v1.ts` : PP ajustés si nécessaire pour l'équilibre tactique
  - Validation `validateBattleData()` doit passer avec les 8 nouveaux moves
  - Tests : les 8 moves passent la validation

---

### Partie 4 — Panels UI sandbox

- [ ] **Étape 14** — Créer `SandboxPanel.ts` dans `packages/renderer/src/ui/`
  - Panel overlay dans `BattleUIScene`, visible seulement si `isSandboxMode`, collapsible (toggle avec un bouton ou touche)
  - Positionné à côté de la TurnTimeline (colonne gauche, sous la timeline) pour ne pas empiéter sur la grille
  - **Section joueur** : dropdown Pokemon (12 du roster), 4 slots moves (dropdowns), HP slider 0–100%, dropdown statut (Aucun / Brûlure / Poison / Paralysie / Gel / Sommeil), stat stages -6/+6 par stat (Atk, Déf, AtkSpé, DéfSpé, Vit)
  - **Section dummy** : dropdown Pokemon, dropdown move (Aucun + les 8 moves défensifs + moves existants), dropdown direction (Nord/Est/Sud/Ouest), HP slider, statut, stat stages
  - Bouton "Réinitialiser" en bas : recrée le BattleEngine avec la config courante (appelle `SandboxSetup.createSandboxBattle`) et recharge la scène
  - Collapsé par défaut si l'écran est petit, expanded sur 4K — toggle visible en permanence
  - Pas de tests unitaires pour le rendu Phaser — validation visuelle Playwright

- [ ] **Étape 15** — Connecter les panels à la config live
  - `SandboxPanel` émet un event custom `SandboxConfigChanged` avec la nouvelle `SandboxConfig`
  - `GameController` (ou une couche sandbox dédiée) écoute `SandboxConfigChanged` et relance `SandboxSetup.createSandboxBattle` + réinitialise la scène
  - `DummyAiController` mis à jour avec le nouveau `dummyMove` et `dummyDirection` lors du reset
  - Validation visuelle : modifier le Pokemon joueur et cliquer Réinitialiser relance le combat avec le bon Pokemon

---

### Partie 5 — Validation visuelle finale

- [ ] **Étape 16** — Tests visuels Playwright du mode sandbox
  - Ouvrir `http://localhost:5173/?sandbox` : vérifier que la grille 6x6 charge, 2 Pokemon présents, panels visibles
  - Ouvrir `?sandbox&pokemon=bulbasaur&moves=vine-whip,razor-leaf&hp=50&dummy=charmander&dummyMove=protect` : vérifier la configuration
  - Jouer un tour : Protect sur le dummy → l'attaque est bloquée, event `DefenseTriggered` visible dans console si debug
  - Vérifier qu'aucun element UI ne chevauche la grille ou les autres panels

## Critères de complétion

- `?sandbox` charge un combat 1v1 sur une carte 6x6 sans passer par la phase de placement
- Le dummy joue passivement (EndTurn) ou un move assigné en boucle
- Les 8 moves défensifs sont dans `packages/data`, leurs handlers dans le core, validés par des tests unitaires
- Les panels joueur et dummy permettent de reconfigurer le combat et de le relancer
- Les query params `?sandbox&pokemon=...&dummyMove=protect` préconfigure correctement
- 100% coverage maintenu sur `packages/core`
- Aucun régression sur les 319 tests existants

## Risques / Questions

- **Positionnement du panel** : colonne gauche sous la timeline, collapsible. Sur 4K c'est confortable. Sur 1080p le collapse est essentiel — tester la lisibilité des deux états.
- **Reload vs reset** : relancer le BattleEngine en place (sans recharger Phaser) est plus rapide mais plus complexe — risque de state zombie. Privilégier un rechargement de scène Phaser (`scene.restart()`) pour la sécurité.
- **Moves défensifs et IA** : le `DummyAiController` joue le move défensif en boucle même si ça n'a pas de sens (pas de cible, etc.). C'est voulu — le dummy est un outil de test, pas un adversaire intelligent.
- **Interactions défensifs + AoE** : Wide Guard protège les alliés dans un rayon, mais en sandbox il n'y a qu'un seul Pokemon par équipe — à garder en tête pour les tests d'équilibre futurs.
- **Endure + statut tick** : Endure ne bloque pas le tick de statut, ce qui peut mener à une boucle infinie si le dummy a 1 HP + Endure + brûlure. Acceptable en sandbox (outil de test).
- **`lastEndureRound` sur `PokemonInstance`** : ajoute un champ au type partagé. Vérifier que les mocks et `BattleSetup` existants restent valides (valeur par défaut `null`).

## Dépendances

- **Avant ce plan** : plans 001–022 terminés (BattleEngine, BattleScene, BattleUIScene, GameController, PlacementPhase, carte poc-arena, moves système).
- **Ce plan débloque** :
  - Équilibrage des movesets (tester les moves défensifs en sandbox)
  - Plan futur "moves avancés" (Phase 1 : stat changes, Confusion) — l'infra `ActiveDefense` peut servir de modèle pour les effets volatils
  - Phase 1 : "Plus de moves stat changes" (Abri est l'un d'eux — déjà implémenté ici)
