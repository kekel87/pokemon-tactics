# Plan 093 — Baton Pass (transfert stat stages allié r1)

> Statut : **done**
> Livré : 2026-05-22
> Créé : 2026-05-22
> Auteur : Claude
> Révisions : audits `plan-reviewer` + `game-designer` intégrés 2026-05-22. Correction post-impl #362 : `ctGain` n'est PAS stocké (computé dynamiquement à chaque tour via `getCtGainForPokemon` → `computeCtGain` lit `statStages[Speed]` à la volée), donc seul `derivedStats.movement` à recompute. Audit game-designer a légèrement sur-estimé le risque sur ce point — code core déjà correct par construction.

## Objectif

Nouveau move support `baton-pass` (Normal, status, 40 PP) : caster transfère **tous ses stat stages** (Atk/Def/SpA/SpD/Spe/Eva/Acc — 7 stats) à un allié adjacent r1, puis reset ses propres stages à 0. Pas de dégâts, pas de statut, pas de switch (le caster reste sur place).

Livraison : nouveau `EffectKind.TransferStatStages` + handler dédié, nouveau flag `MoveDefinition.targetsAlly?: boolean` qui restreint `Single` à un allié vivant (filtre côté `getValidTargetPositions` et UI), 1 move data, 1 event log dédié, tests intégration.

## Pourquoi maintenant

- Pivot de roster : Baton Pass canon Showdown débloque builds setup-sweeper (Belly Drum / Swords Dance / Dragon Dance → BP → sweeper). Sans BP, Smeargle / Mr-Mime / Ninjask / Mew restent sous-optimaux.
- Mécanique simple isolée : zéro interaction avec terrain, météo, items pour la v1 (scope volatiles différé — voir Hors scope).
- Réutilise pipeline existant : `EffectProcessor`, registry, `StatChanged` event déjà routés côté renderer (badges Showdown plan 018). Pas besoin de nouveau pipeline.
- Pas de blocage data : reference Showdown `baton-pass.ts` aligné (status, 40 PP, target `self` en Showdown — adapté ici en `adjacentAlly`).

## Hors scope

- **Volatiles** : Substitute, Seeded (Leech Seed), Curse, Confusion, Trapped, Focus-Energy, LockedOn → **NON transférés**. Décision actée (cf. réponse utilisateur 2026-05-22 : stat stages seuls). Plan futur si besoin.
- **Switch out** (changer de Pokemon sur le banc) : pas de banc en mode tactique. Le caster reste actif, juste ses stages reset.
- **Animation dédiée** : placeholder instantané MVP (event `BatonPassed` + flottants `StatChanged` standards). Polish ultérieur (tween relais visuel) hors scope.
- **PP gauge interaction** : le PP de baton-pass se consomme normalement, pas d'interaction Choice Item.
- **AI scoring sophistiqué** : heuristique simple "score = somme stages positifs caster × bonus si target a moins de stages". Pas de lookahead multi-tour.
- **Mécaniques héritées par Baton Pass dans le jeu officiel** : Wish, Healing-Wish, Encore counter transfert — pas dans roster Phase 4.

## Décisions actées

1. **Nouveau `EffectKind.TransferStatStages`** dans `packages/core/src/enums/effect-kind.ts`.
2. **Nouveau variant `Effect`** dans `packages/core/src/types/effect.ts` :
   ```ts
   | {
       kind: typeof EffectKind.TransferStatStages;
     }
   ```
   Pas de champ `target` (toujours caster → unique target défini par targeting). Pas de `chance` (toujours appliqué si target valide).
3. **Targeting** : `TargetingKind.Single`, range `{ min: 1, max: 1 }`. Pas de nouveau `TargetingKind`.
4. **Filtre allié** : nouveau flag `MoveDefinition.targetsAlly?: boolean` (défaut `false`).
   - `getValidTargetPositions(caster, move, state, grid)` : si `move.targetsAlly === true`, filtre tiles où occupant est **allié vivant ET ≠ caster**.
   - `resolveTargeting` standard (résout position → tile). Le filtre vit côté legal-actions + UI.
   - **Décision** : pas de friendly fire baton-pass sur ennemi. Si UI/AI passe une target ennemie, engine rejette silencieusement (no-op + emit `BatonPassFallback`).
5. **Self-targeting** : interdit (no-op trivial). Caster filtré de `getValidTargetPositions`.
6. **Stats transférées** : les 7 stat stages — `Attack`, `Defense`, `SpecialAttack`, `SpecialDefense`, `Speed`, `Accuracy`, `Evasion`. **PAS** `HP` (HP n'est pas un stat stage).
7. **Algorithme handler** :
   - Pour chaque `StatName` ∈ 7 stats : `delta = caster.statStages[stat]`. Si `delta === 0`, skip.
   - `target.statStages[stat] = clampStages(target.statStages[stat], delta)` (utilise helper existant, respecte cap ±6).
   - `caster.statStages[stat] = 0`.
   - **Si Speed transféré** : recompute `caster.derivedStats.movement` ET `target.derivedStats.movement` via `computeMovement(baseSpeed, newSpeedStage)`. **Recompute `ctGain` côté caster ET target** via la formule CT (`packages/core/src/battle/ct-costs.ts` — `computeCtGain(baseStat, speedStages)`). Le CT impact instantané : caster perd son boost Speed → joue moins souvent, target gagne → joue plus souvent. Sans ce recalcul, la timeline CT prédictive devient incorrecte pour le reste du combat (bug silencieux).
   - Émettre 1 event `StatChanged` pour le **delta réel** sur target (post-clamp). Émettre 1 event `StatChanged` pour la **baisse** côté caster (delta négatif).
   - **Note clamp** : si target a déjà `+4` Atk et caster a `+6`, target devient `+6` (clamp), caster devient `0`. Delta réel target = `+2`, delta caster = `-6`. Showdown applique simple set (`target.boosts[stat] = caster.boosts[stat]`), pas un add. **Décision** : on suit Showdown — `target.statStages[stat] = caster.statStages[stat]` (clamp implicite déjà respecté par range -6/+6). Helper `clampStages` non utilisé ici (simple set).
   - **Reformulation algo final** :
     ```ts
     for (const stat of TRANSFERABLE_STATS) {
       const casterStage = caster.statStages[stat];
       if (casterStage === 0) continue;
       const previousTarget = target.statStages[stat];
       target.statStages[stat] = casterStage;  // set, pas add (parité Showdown)
       caster.statStages[stat] = 0;
       const targetDelta = casterStage - previousTarget;
       const casterDelta = -casterStage;
       if (targetDelta !== 0) emit StatChanged{target, stat, stages: targetDelta};
       if (casterDelta !== 0) emit StatChanged{caster, stat, stages: casterDelta};
     }
     ```
8. **Ability blocking** : `onStatChangeBlocked` côté target — **bypass** pour Baton Pass (parité Showdown : Clear Body / White Smoke ne bloquent pas Baton Pass car c'est self-applied côté Showdown). **Décision** : handler `handle-transfer-stat-stages.ts` n'invoque pas `onStatChangeBlocked`. Documenter dans #357.
9. **Si caster n'a aucun stat stage ≠ 0** : transfert no-op, mais move se résout normalement (PP consommé). Émet `BatonPassed` event sans events `StatChanged`. Battle log : "Untel relaie ! (aucun stat à transmettre)".
10. **Nouveau `BattleEventType.BatonPassed`** :
    ```ts
    | { type: typeof BattleEventType.BatonPassed; casterId: PokemonId; targetId: PokemonId }
    ```
    Émis avant les `StatChanged`. Renderer log : "Untel passe le relais à Untel !".
11. **Pas de `BatonPassFallback` event** : si UI/AI fournit target invalide (ennemi, vide, hors range), `getLegalActions` filtre déjà. Validation engine = défense en profondeur : si arrive quand même, silent skip + warning console (pas d'event log). Décision #358.
12. **AI scoring** : `action-scorer.ts` case `TransferStatStages` :
    - Score = somme `max(0, caster.statStages[stat])` × poids pour les 5 stats offensives/défensives (Atk/Def/SpA/SpD/Spe) + petit poids Eva/Acc.
    - Bonus multiplicatif si target.statStages cumulé < caster.statStages cumulé (cible "vierge" reçoit mieux).
    - Malus si caster.statStages sont déjà négatifs (BP transfère malus aussi → utile parfois mais rare).
    - Détail heuristique : `score = (sum positifs - sum négatifs/2) × 4` + `bonus 8 si target.cumulPos < caster.cumulPos`.
    - **Dette balance documentée** : pas de lookahead "is target sweeper potential". Refinement post-playtest hors scope.
13. **`getLegalActions`** : pour move avec `targetsAlly`, énumère tiles voisines occupées par allié vivant ≠ caster. Pas d'AoE → 1 entry par allié adjacent.
14. **Renderer flow** :
    - Sélection move baton-pass → highlight 4 voisines Manhattan (Chebyshev r1 = même set sur grille carrée r1).
    - Filtre rendu : seules tiles avec allié vivant sont cliquables (couleur verte allié, pas rouge ennemi).
    - Click → submit action standard.
    - Aucune phase supplémentaire (vs HitAndRun 2-phase).
15. **i18n** :
    - fr : `"battle.batonPassed": "{casterName} passe le relais à {targetName} !"`
    - en : `"battle.batonPassed": "{casterName} passed the baton to {targetName}!"`
    - Pas de message no-op spécifique : si zéro stage à transférer, log montre quand même `BatonPassed` (event émis). Les badges Showdown stat changes ne s'affichent simplement pas (zéro `StatChanged`).
16. **Compatibilité Protect / Wide Guard** :
    - Baton Pass = status move, ne déclenche pas Protect / Wide Guard côté target (parité Showdown : ces moves bloquent damaging/status moves ennemis, pas un buff allié).
    - **Décision** : `defense-check.ts` skip Protect/Detect/Wide Guard pour moves avec `targetsAlly === true`. Documenter dans #359.
17. **Composition avec Magic Bounce / Magic Coat** : pas dans roster Phase 4. Hors scope.
18. **Composition avec Snatch** : pas dans roster Phase 4. Hors scope.
19. **PRNG** : pas utilisé (transfert déterministe). Replay-safe trivialement.

## Étapes

### 1. Enum + type

**Fichiers** :
- `packages/core/src/enums/effect-kind.ts` — ajouter `TransferStatStages: "transfer_stat_stages"`.
- `packages/core/src/types/effect.ts` — ajouter variant `{ kind: typeof EffectKind.TransferStatStages }`.

### 2. MoveDefinition flag `targetsAlly`

**Fichier** : `packages/core/src/types/move-definition.ts` — ajouter `targetsAlly?: boolean`.

**Impact** :
- `packages/core/src/battle/BattleEngine.ts` `getLegalActions` / `getValidTargetPositions` : si `move.targetsAlly === true`, filtre tiles voisines occupées par allié vivant ≠ caster. Sinon comportement standard (ennemi targeting).
- `packages/core/src/battle/defense-check.ts` : si `move.targetsAlly === true`, skip Protect/Detect/Wide Guard (move = buff allié, pas une attaque).

**Test** : `BattleEngine.targets-ally.test.ts` — getLegalActions filtre allié vivant adjacent uniquement (pas ennemi, pas self, pas allié KO, pas allié r2).

### 3. Constante `TRANSFERABLE_STATS`

**Fichier** : `packages/core/src/battle/handlers/baton-pass-stats.ts` (nouveau) — `const TRANSFERABLE_STATS: readonly StatName[]` (7 entrées). Exporté pour réutilisation tests.

### 4. Handler `handle-transfer-stat-stages.ts`

**Fichier** : `packages/core/src/battle/handlers/handle-transfer-stat-stages.ts` (nouveau).

Signature : `function handleTransferStatStages(context: EffectContext): BattleEvent[]`.

Logique :
- Lire `caster = context.attacker`, `target = context.targets[0]`.
- Émettre `BatonPassed` event en tête.
- Pour chaque stat ∈ `TRANSFERABLE_STATS` :
  - Si `caster.statStages[stat] === 0` → skip.
  - `previousTarget = target.statStages[stat]`, `previousCaster = caster.statStages[stat]`.
  - `target.statStages[stat] = previousCaster` (set, parité Showdown).
  - `caster.statStages[stat] = 0`.
  - Émettre `StatChanged{target.id, stat, stages: previousCaster - previousTarget}` si delta ≠ 0.
  - Émettre `StatChanged{caster.id, stat, stages: -previousCaster}`.
- Recompute `caster.derivedStats.movement` ET `target.derivedStats.movement` via `computeMovement(baseSpeed, newSpeedStage)` si Speed transféré (parité `handle-stat-change.ts`).

**Registration** : `packages/core/src/battle/effect-handler-registry-default.ts` (ou équivalent — vérifier nom exact à l'impl) — `registry.register(EffectKind.TransferStatStages, handleTransferStatStages)`.

**Test unit** : `handle-transfer-stat-stages.test.ts`
- Transfère stages positifs intégralement.
- Reset caster à 0.
- Target avec stages préexistants : overwrite (pas additif).
- Caster zero stages : émet `BatonPassed` sans `StatChanged`.
- Caster Speed +2 → target movement recalculé.
- Stages négatifs transférés aussi (caster Atk -2 → target Atk -2, caster Atk = 0).

### 5. Event type

**Fichiers** :
- `packages/core/src/enums/battle-event-type.ts` — ajouter `BatonPassed: "BatonPassed"`.
- `packages/core/src/types/battle-event.ts` — variant :
  ```ts
  | { type: typeof BattleEventType.BatonPassed; casterId: PokemonId; targetId: PokemonId }
  ```

### 6. Move data

**Fichier** : `packages/data/src/overrides/tactical.ts` — ajouter :

```ts
"baton-pass": {
  targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
  effects: [{ kind: EffectKind.TransferStatStages }],
  targetsAlly: true,
},
```

**Validation reference** (`packages/data/reference/moves.json`) :
- baton-pass : 0 BP / 100% acc / Normal / Status / 40 PP / target `self` Showdown.
- Adaptation tactique : target `self` Showdown = "pass to next mon in party" — ici on mappe à `adjacentAlly` r1 (pas de party tactical, voisin physique fait office).

**Pas de balance override**.

**Coût CT** : pas d'`effectTier` assigné → coût CT pilote par `ppCost(40) = 500` (le minimum dans le système). C'est une décision consciente (cf. décision #364) : BP n'est pas un buff self pur, sa valeur dépend du contexte (qui reçoit, quel setup), donc pas de surcharge tier. **Levier d'équilibrage** : si combos setup→BP s'avèrent trop rapides post-playtest, assigner `effectTier: DoubleBuff` (550) ou `MajorBuff` (600) sans modifier la mécanique.

### 7. `defense-check.ts` skip `targetsAlly`

**Fichier** : `packages/core/src/battle/defense-check.ts` — si `move.targetsAlly === true`, skip toute la chaîne Protect/Detect/Wide Guard/Quick Guard/Counter/Mirror Coat. Retour direct "passe".

**Test** : `defense-check.targets-ally.test.ts` — Protect actif sur allié bloque pas Baton Pass.

### 8. AI scoring

**Fichier** : `packages/core/src/ai/action-scorer.ts` — case `EffectKind.TransferStatStages` :
- `casterPositiveSum = sum(max(0, caster.statStages[stat]))`.
- `casterNegativeSum = sum(min(0, caster.statStages[stat]))`.
- `targetPositiveSum = sum(max(0, target.statStages[stat]))`.
- `base = (casterPositiveSum * 4) + (casterNegativeSum * 2)`.  (négatifs = transfère malus, mauvais)
- Bonus `+8` si `targetPositiveSum < casterPositiveSum` (target "moins setup" reçoit mieux).
- Malus `-20` si caster a 0 stat positif (no-op trivial, l'IA ne devrait pas BP "à vide").

**Test** : `ai-baton-pass.test.ts` — IA priorise BP quand caster +4 Atk avec allié vierge adjacent, ignore BP si caster 0 stages.

### 9. Renderer

**Fichier** : `packages/renderer/src/scenes/battle/pattern-preview.ts` — case `Single` standard. Pas de logique nouvelle (filtre allié vit côté `getLegalActions`, le renderer affiche les tiles candidates en couleur allié).

**Fichier** : `packages/renderer/src/scenes/battle/GameController.ts` — handler `BatonPassed` event :
- Log via `BattleLogFormatter`.
- Pas d'animation custom MVP. (Les `StatChanged` qui suivent déclenchent les badges Showdown existants.)

**Fichier** : `packages/renderer/src/ui/BattleLogFormatter.ts` — case `BatonPassed` :
- `t("battle.batonPassed", { casterName, targetName })`.

**i18n clés** :
- `packages/renderer/src/i18n/fr.ts` + `en.ts` — `"battle.batonPassed"` (formats listés décision #5).

### 10. Test intégration move

**Fichier** : `packages/core/src/battle/moves/baton-pass.integration.test.ts`

Scénarios :
- Caster +2 Atk +1 Spe → BP allié adjacent → target +2 Atk +1 Spe, caster 0/0. Movement caster reset baseline, target movement boosted.
- Caster aucun stage → BP no-op, event `BatonPassed` seul, PP consommé.
- BP cible un allié à r2 → action invalide (rejected par `getLegalActions`).
- BP cible un ennemi r1 → action invalide.
- BP cible self → invalide.
- BP cible allié KO adjacent → invalide.
- BP via Protect/Detect du target → ne bloque pas (bypass `targetsAlly`).
- Caster -2 Atk → target reçoit -2 Atk (transfère malus aussi).
- Target +5 Atk, caster +3 Atk → target devient +3 Atk (set, pas add). Caster = 0.
- Speed transfer recalcule movement les 2 Pokemon.

### 11. Mise à jour `docs/implementations.md`

Ajouter 1 move. Compteur global : 155 → **156**.

### 12. Mise à jour `docs/decisions.md`

Décisions #356-#363 :
- #356 — `EffectKind.TransferStatStages` introduit (transfert atomique 7 stat stages caster→target, reset caster à 0).
- #357 — Baton Pass bypass `onStatChangeBlocked` (parité Showdown : self-applied côté caster, abilities défensives target n'interviennent pas).
- #358 — `MoveDefinition.targetsAlly?: boolean` introduit. Filtre allié vivant ≠ caster côté `getValidTargetPositions`. `defense-check` skip Protect/Detect/Wide Guard si flag actif.
- #359 — Baton Pass = simple set, pas add. `target.statStages[stat] = caster.statStages[stat]` (parité Showdown). Stages négatifs transférés aussi.
- #360 — Volatiles non transférés (Substitute/Seeded/Curse/Confusion/Trapped). Décision scope simplifié 2026-05-22 (réponse utilisateur). Plan futur possible.
- #361 — Pas de swap position / swap caster / KO caster. Caster reste sur place (mode tactique, pas de banc).
- #362 — Speed transfer recalcule `derivedStats.movement` **ET `ctGain`** caster ET target (parité `handle-stat-change.ts` + `ct-costs.ts`). Sans recalcul CT, timeline prédictive devient incorrecte (bug silencieux).
- #363 — AI scoring greedy : `casterPositiveSum × 4 + casterNegativeSum × 2 + bonus 8 si target vierge`. Dette balance documentée. **Pondération uniforme 7 stats** : Eva/Acc surévalués vs Atk/SpA (acceptable MVP, refinement post-playtest).
- #364 — Baton Pass **pas d'`effectTier`** : coût CT minimum (`ppCost(40) = 500`). Décision consciente, levier équilibrage si combos setup→BP trop rapides post-playtest (assigner `DoubleBuff` 550 ou `MajorBuff` 600).

### 13. Gate CI + golden replay

`pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration`.

Golden replay : régénération **probable** si IA pioche baton-pass (Smeargle / Mr-Mime / Mew / Ninjask roster). Vérifier via diff. Commande : `pnpm tsx scripts/regenerate-golden-replay.ts`.

## Tests

- **Unit** :
  - `handle-transfer-stat-stages.test.ts` (logique handler isolée)
  - `BattleEngine.targets-ally.test.ts` (filtre `targetsAlly`)
  - `defense-check.targets-ally.test.ts` (Protect bypass)
- **Intégration** :
  - `baton-pass.integration.test.ts` (10 scénarios)
  - `ai-baton-pass.test.ts` (scoring greedy)
- **Golden replay** : régénération conditionnelle.

## Risques connus

1. **Set vs add subtle bug** : algorithme parité Showdown = `target.stages = caster.stages` (set). Si target avait +5 et caster +3, target devient +3 (perd 2 stages). C'est canon mais surprenant. Documenter dans tests.
2. **Movement recompute double** : caster ET target voient leur movement changer si Speed transféré. Vérifier que `BattleEngine` re-trigger turn order si nécessaire (CT system). À tester explicitement.
3. **AI utilité limitée Phase 4** : sans lookahead, l'IA BP même quand le receveur n'est pas un sweeper. Acceptable MVP.
4. **`targetsAlly` flag conflit avec moves existants** : un seul move (BP) utilise ce flag pour la v1. Vérifier qu'aucun autre move tactique n'a un comportement ally-targeting non explicite.
5. **Friendly fire UI** : si joueur clique ennemi par erreur, action rejetée — assurer le feedback UX (tile bloquée, pas juste no-op silencieux). Highlight allié-only en vert clair, ennemi grisé.
6. **PP consommé même si target vide cliquée** : non, validation côté UI/engine rejette avant exécution. PP non touché si action invalide.
7. **Confusion / Sleep caster** : caster confus peut self-hit avant BP — comportement standard, pas spécial. KO self pré-BP = aucune exécution (KO = no action).

## Migration data

Aucune migration. Ajout pur.

Vérification post-impl : Pokemon dont le learnset inclut `baton-pass` via reference Showdown verront le move apparaître automatiquement dans `movepool` (plan 087 dérivé).

**Intersection roster Gen 1 (vérifiée via `packages/data/reference/indexes/pokemon-by-move.json` ligne 33591)** : porteurs de baton-pass dans le roster 80 mons jouables = **Mr-Mime, Vaporeon, Jolteon, Flareon, Butterfree, Beedrill, Zapdos, Mew**. Eevee non jouable (forme non finale retirée plan 075). Persian **n'a pas** baton-pass.

8 Pokemon avec accès → golden replay regen probable (IA pioche baton-pass dans `scored-ai-smoke.test.ts`).

## Compteurs prévus post-livraison

- Moves : 155 → **156**
- EffectKind : 9 → **10**
- BattleEventType : +1 (`BatonPassed`)
- MoveDefinition : +1 flag (`targetsAlly`)
- Pokemon ayant accès à baton-pass : **8** (Mr-Mime, Vaporeon, Jolteon, Flareon, Butterfree, Beedrill, Zapdos, Mew).

## Audits intégrés (2026-05-22)

**plan-reviewer** : `ready`. Structure approuvée, étapes exécutables. 3 points watchful : registry registration (pattern `createDefaultEffectRegistry`), golden replay regen (8 porteurs), test movement recalc explicite.

**game-designer** : `ajuster` → intégré. 3 ajustements appliqués :
1. **#362 étendu** : recalcul `ctGain` caster + target post-transfer Speed (était `derivedStats.movement` seul — risque bug silencieux timeline CT).
2. **#364 ajoutée** : `effectTier` absent documenté comme décision consciente, levier équilibrage explicite.
3. **Intersection roster confirmée** : 8 porteurs identifiés (Mr-Mime, Vaporeon, Jolteon, Flareon, Butterfree, Beedrill, Zapdos, Mew). Persian/Eevee écartés.

**Combos OP** : audit confirme aucun combo immédiat Phase 4. Belly Drum non implémenté. Mew + Nasty Plot +2 → BP à surveiller post-playtest (Mewtwo bénéficiaire potentiel).

**r1 strict validé** : skill check positionnement intentionnel. Pas de bascule r1-2.

**Set vs add validé** : parité Showdown documentée, tests prévus.

**Pondération AI uniforme** : dette balance acceptée MVP (Eva/Acc surévalués vs Atk/SpA).
