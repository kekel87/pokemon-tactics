# Plan 193 — Verrouiller le typecheck des fichiers de test

- **Statut** : `done` (2026-08-27) — **les 8 paquets sont verrouillés**, `packages/core` compris. Aucun `tsconfig` n'exclut plus les tests.
- **Origine** : entrée « `packages/*/tsconfig.json` exclut les `*.test.ts` du typecheck » de `docs/backlog.md` (2026-08-03, plan 178). Reprise sur demande de l'humain le 2026-08-27 (« finir ça avant la release »), option choisie : « Tout, et on verrouille ».

## 1. Le problème

Chaque `tsconfig.json` de paquet portait `"exclude": ["src/**/*.test.ts"]` : une erreur de type dans un fichier de test n'était **jamais** détectée par `pnpm typecheck`, seulement par Vitest à l'exécution — qui passe volontiers si la valeur mal typée fonctionne quand même au runtime.

Conséquence concrète : les mocks de test dérivent de leur interface sans que rien ne le signale, jusqu'au jour où quelqu'un ajoute un membre et voit 7 tests exploser sur un `TypeError`.

## 2. Le champ fantôme, 84 % du problème

La mesure de 2026-08-03 annonçait ~2000 erreurs dont **1662 d'une seule cause** : `currentPp`, un champ posé par les tests du core sur des littéraux `Partial<PokemonInstance>`… alors qu'il **n'existe pas** sur `PokemonInstance`.

Vérifié avant de toucher quoi que ce soit : **0 référence en production**, y compris dans `src/testing/`. Purement fantôme — cohérent avec le fait que les PP ne sont pas consommés en combat (ils ne servent qu'à calculer le coût en CT, ce que le commentaire de `mechanics/pp-consumption.test.ts` documente déjà).

Purge **scriptée** : **1733 occurrences retirées dans 507 fichiers**, quatre formes syntaxiques différentes (objet sur une ligne, objet multi-lignes, propriété finale sans virgule, propriété abrégée), plus deux variables locales devenues orphelines.

**Les 3955 tests passent sans une seule retouche de logique.** C'était bien du code mort, et c'est la preuve que la purge n'a rien changé au sens des tests.

## 3. La dépendance

`@types/node` ajouté en `devDependency` racine (validé par l'humain, la convention interdit de décider seul d'une dépendance), plus `"types": ["node"]` sur les tsconfig de **`core`, `data` et `app`** — les trois seuls paquets dont des tests importent `node:fs` / `node:path` / `node:url`.

**Pas dans `tsconfig.base.json`** volontairement : ça rendrait `process` et compagnie typables depuis du code navigateur, ce qui invite précisément le genre de fuite que l'architecture cherche à éviter.

Étape d'égarement à noter : j'ai d'abord annoncé « `@types/node` n'est finalement pas nécessaire » après un typecheck sans erreur `node:`. **Faux** — le typecheck parallèle s'arrête au premier paquet en échec, et ces erreurs étaient simplement masquées derrière d'autres. Corrigé dès la mesure suivante ; leçon : compter les erreurs paquet par paquet, jamais sur la sortie parallèle agrégée.

## 4. Ce que le verrou a attrapé — première vague, hors `core`

Les sept paquets hors `core` (`ui-dom`, `view-core`, `app`, `data`, `render-ports`, `render-babylon`, `render-canvas2d`) ont été verrouillés d'abord. Voici ce que le typecheck y a trouvé — **que des vraies dérives**, aucune fausse alerte :

| Défaut | Nature |
|---|---|
| `updateCombatPreview` sur le mock de `BattleChrome` | Propriété qui **n'existe plus nulle part** — ligne de mock morte. En la retirant, elle **démasquait** 5 membres manquants qu'une erreur de propriété en trop cachait |
| `updateCameraAzimuth`, `focusMenuStep`, `isMenuFocused`, `activateFocusedMenuItem`, `scrollTimeline` | Absents du mock de `BattleChrome` |
| `setGroundedByGravity` | Absent du mock de `BoardView` |
| `getStatusLabelUrl` | Absent de deux mocks de `PresentationContext` |
| `controls` | Écran absent du type de test de `ScreenParamsById` |
| `appliedAtAction` | Absent d'un littéral `ActiveDefense` |
| `toggleLog`, `openCombatMenu` | Absents du mock de `BoardInputConsumer` |
| `createInputSystem(null)` × **7 appels** | La signature ne prend **aucun** argument. Le test n'avait jamais suivi le changement |
| Littéraux d'événement incomplets, `TerrainType.Grass` inventé | **Dans mes propres fichiers de test du jour** (plans 190 et 192) |

Ce dernier point mérite d'être dit : le verrou a attrapé ma propre négligence **quelques heures** après l'avoir écrite. `TerrainType.Grass` n'existe pas — les vraies valeurs sont `normal`, `tall_grass`, `lava`, `snow`… C'est la **troisième fois** dans cette session que je devine une valeur d'enum au lieu de la lire (après « Terrain Herbu » contre « Champ Herbu », et les membres de `TerrainType` dans `battle-log-keys.test.ts`). La règle est désormais écrite dans les trois plans concernés.

Et le plan 192 en a fourni la démonstration parfaite : ajouter une méthode à `BattleEngine` a cassé 7 tests avec `TypeError: previewCasterMoveContext is not a function`, sans que le typecheck n'ait rien vu — le mock ne suivait pas son interface. C'est exactement ce que ce plan ferme.

## 5. `packages/core` : les 290 erreurs, traitées

L'humain a demandé qu'il ne reste rien. C'est fait. Voici comment les 290 se sont réduites, parce que la répartition est la vraie information — elles n'étaient ni uniformes ni aléatoires.

| Étape | Erreurs restantes |
|---|---|
| Départ | 290 |
| Une table d'objets typée en `Partial<Record<HeldItemId, string>>` | **173** |
| Champs fantômes `turnIndexApplied` / `postedRound` purgés + `appliedAtAction` rétabli | 146 |
| Deux fabriques de `ProcessContext` complétées | 130 |
| Le vrai `typeChart` au lieu de `{}` | 127 |
| Assignations mortes `state.turnOrder` / `.currentTurnIndex` | 121 |
| 82 déclarations `const xBefore = …?.currentHp` → `!.` | **60** |
| 9 littéraux `TeamAura` re-complétés | 51 |
| 23 accès `estimate?.min/max` → `!.` | 43 |
| `DamageModifyContext`, `EffectContext`, `activePokemonId`, `weight`… | 21 → 4 |
| Quatre cas uniques (arité de `makeAttacker`, `direction` sur `EndTurn`, prédicats de type sur `filter`) | **0** |

**Le premier gain est le plus instructif** : **115 erreurs venaient d'une seule ligne**. Un `getItemName: (id) => ({ deux clés })[id] ?? id` où `id` est typé sur l'union complète de `HeldItemId` produit **une erreur par membre de l'enum**. Un `Partial<Record<>>` les efface toutes. C'est ce qui explique pourquoi ma première estimation (« long chantier de plusieurs heures ») était fausse : le comptage brut d'erreurs ne dit rien de la quantité de travail — il fallait regarder la **distribution par fichier**, où un seul fichier portait 40 % du total.

### Catégories de vraies dérives trouvées dans le core

- **Champs fantômes** (0 usage en production) : `currentPp`, `roundApplied`, `postedRound`, `currentTurnIndex`, `roundNumber`, `lastEndureRound`, `turnIndexApplied`, `turnOrder`, `predictedNextRoundOrder`, `decoration`, `slope`, `hp` sur `Partial<PokemonInstance>`. Tous vestiges de refontes passées, dont le système de tour d'avant le Charge Time.
- **Signatures qui ont bougé sans que les tests suivent** : `makeAttacker()` (0 argument, appelé avec 1), `BattleEngine` (10 paramètres, appelé avec 11), `EndTurn` (exige une `direction`).
- **Mocks incomplets** : `EffectContext` (8 membres), `DamageModifyContext` (3), `HeldItemDefinition` (3), `BattleState` (`activePokemonId`), `PokemonInstance` (`weight`).
- **`filter` à prédicat booléen** au lieu d'un prédicat de type, qui laissait `targetPosition` invisible sur une union d'actions (3 sites).
- **Accès indexés non gardés** sous `noUncheckedIndexedAccess`.

### Effet de bord utile

`ZERO_STAT_STAGES` est désormais **exporté** par `packages/core/src/testing` — il existait, privé, dans `mock-pokemon.ts`, et deux tests le réinventaient partiellement. Conforme à `.claude/rules/tests.md` (« utiliser les factories de `packages/core/src/testing/` »).

## 6. Vérification

| Suite | Résultat |
|---|---|
| `typecheck` (**8 paquets** verrouillés + scenarios + e2e) | **0 erreur** ✅ |
| Unitaires | 3955 ✅ |
| Intégration | 388 ✅ |
| Scénario | 23 ✅ |
| Lint (binaire natif) | propre ✅ |

## 7. Un mot sur le `console.warn` du plan 190

L'avertissement i18n ajouté en même temps déclenchait `lint/suspicious/noConsole`, que le gate traite comme une erreur. Plutôt que de toucher à la règle — ce que la convention m'interdit sans accord — j'ai suivi le **précédent du dépôt** : cinq `// biome-ignore lint/suspicious/noConsole:` justifiés existent déjà en production pour exactement cet usage diagnostique (`fullscreen.ts`, `wake-lock.ts`, `gamepad-source.ts`, `babylon-boot.ts`, `combat-screen.ts`).
