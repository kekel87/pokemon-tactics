# Plan 092 — HitAndRun (u-turn / volt-switch / flip-turn)

> Statut : **done**
> Livré : 2026-05-21
> Créé : 2026-05-21
> Auteur : Claude
> Révisions : plan-reviewer + game-designer audits intégrés 2026-05-21 — miss bloque retreat (parité Showdown), retreat 1-4 uniforme, volt-switch hitRange 1-2 non-contact, fallback = silent + event, Wide Guard non-interaction, knockback/Substitute clarifiés, ordre étapes corrigé.

## Objectif

Nouvelle catégorie targeting `TargetingKind.HitAndRun` : caster frappe une cible Single (contact), puis se replie sur une tile vide choisie par le joueur dans une range de recul autour de sa position actuelle. Contrepartie inverse du plan 088 (Teleport : choisir target, landing auto) — ici le hit est imposé, le repli est choisi.

Livraison : nouvelle variante `TargetingPattern`, resolver dédié pour la phase hit, helper validation retreat, extension `ActionUseMove` avec `retreatPosition?: Position`, flow renderer 2-phase (target → retreat), 3 moves data, AI scoring greedy + retreat heuristique.

## Pourquoi maintenant

- Plan 088 (Teleport) livre le moteur "déplacement TP atomique post-effect" (bypass LoS/terrain/hauteur, snapshot `occupied`, terrain triggers landing). HitAndRun réutilise le même primitif d'atterrissage atomique, juste avec position choisie par client au lieu de calculée par engine.
- 3 moves canon Gen 9, simples, exposés automatiquement aux Pokemon dont le learnset les inclut (plan 087 dérivé).
- Pas de blocage data (BP/accuracy alignés reference Showdown).
- Renderer : 2-phase targeting déjà précédent côté UI (AoE preview lock → confirm), pattern réutilisé.

## Hors scope

- **Switch out** (changer de Pokemon comme Showdown classique) : pas de banc en mode tactique. Le caster reste, seule sa position change.
- **MoveCharging visible** (Skull Bash, Razor Wind) — plan séparé.
- **Baton Pass** — plan séparé.
- Animation dédiée (saut + retour, particules) — placeholder instantané MVP. Polish ultérieur.
- Modificateurs spécifiques (Eject Button / Eject Pack) — pas de tels items en roster Phase 4.
- Composition avec Pursuit (qui exploite le switch out adverse) — non implémenté, hors scope.

## Décisions actées

1. **Nouveau `TargetingKind.HitAndRun`** dans `packages/core/src/enums/targeting-kind.ts` + variant `TargetingPattern` :
   ```ts
   | { kind: typeof TargetingKind.HitAndRun; hitRange: RangeConfig; retreatRange: RangeConfig }
   ```
2. **Hit phase** : pattern Single classique, range définie par `hitRange` (généralement r1 contact). LoS standard, terrain standard, hauteur standard (parité Single). Resolver dédié `resolveHitAndRun(caster, target, hitRange, grid, occupied)` retourne `[target]` si tile in-range ET occupée par Pokemon vivant (peut être allié — friendly hit possible, mais ne sera pas exposé par `getLegalActions` côté ennemis pour cohérence Single).
3. **Retreat phase** : tile vide dans `retreatRange` Chebyshev autour de la **position actuelle du caster** (pas autour de la target). Mêmes règles bypass que Teleport :
   - LoS bypassé (pas de check)
   - Terrain bypassé (peut atterrir sur lava/deep_water si non immune → terrain triggers s'appliquent)
   - Hauteur bypassée (saut/jump implicite)
   - Tile doit être vide (pas de Pokemon vivant occupant)
4. **Si retreat impossible** (toutes tiles in-retreat-range occupées ou hors grille) : caster **reste sur place**. Le move ne fail pas — hit s'applique normalement, juste pas de TP.
5. **Si hit miss (accuracy check fail)** : **retreat NE s'applique PAS** (parité Showdown — U-turn/Volt-Switch/Flip-Turn ne switchent pas sur miss). Caster reste sur place. Event `HitAndRunRetreatFallback` émis avec `reason: "miss"`.
6. **Si target KO par hit** : retreat s'applique normalement (parité Showdown — switch après KO).
7. **`ActionUseMove` étendu** : ajout champ optionnel `retreatPosition?: Position`.
   - Client (humain) renseigne via flow 2-phase UI.
   - Client (AI) calcule via heuristique avant `submitAction`.
   - Si `retreatPosition` manquant ou invalide pour un move HitAndRun → engine choisit tile la plus éloignée des ennemis (fallback safe).
   - Si move n'est pas HitAndRun → champ ignoré.
8. **Validation engine** : avant exécution, vérifier `retreatPosition` ∈ retreatRange (Chebyshev distance OK), in-bounds, non-occupée par Pokemon vivant. Validation utilise `occupied` snapshot **post-KO** (après éventuel KO de la target). Si invalide ou absente → silent skip (ne pas bloquer le tour, caster reste) + émettre `HitAndRunRetreatFallback` event avec `reason: "invalid" | "missing" | "no-tile-available"`.
9. **Ordre exécution dans `BattleEngine.executeUseMove`** :
   - Accuracy check standard. Si **miss** → skip effects + skip retreat + emit `HitAndRunRetreatFallback { reason: "miss" }`. Tour termine normalement.
   - Effects pipeline (damage).
   - `handleKo` sur targets si nécessaire.
   - Si `pattern.kind === HitAndRun` ET hit succeeded : compute `occupied` snapshot **post-KO**, valider `action.retreatPosition`. Si valide → update `caster.position`, émettre `HitAndRunRetreat` event, déclencher `applyTerrainOnEnter` (burn lava / fall damage deep_water / ice slide). Sinon → emit `HitAndRunRetreatFallback { reason: "invalid" | "missing" }`, caster reste.
10. **Events** :
    - `BattleEventType.HitAndRunRetreat` :
      ```ts
      { type: "HitAndRunRetreat"; pokemonId: PokemonId; fromPosition: Position; toPosition: Position }
      ```
      Renderer log : "Insécateur recule." / "Scyther falls back."
    - `BattleEventType.HitAndRunRetreatFallback` :
      ```ts
      { type: "HitAndRunRetreatFallback"; pokemonId: PokemonId; reason: "miss" | "invalid" | "missing" | "no-tile-available" }
      ```
      Renderer log : "Insécateur n'a pas pu reculer." / "Scyther couldn't fall back." (uniquement reason ≠ "miss" — miss déjà loggé par accuracy fail).
11. **AI scoring** :
    - `action-scorer.ts` : pour move HitAndRun, score = score Single classique (hit) + bonus retreat safety.
    - Heuristique retreat : pour chaque tile valide retreatRange autour de caster, score = `min(distance to nearest enemy)`. Pick max. Tie-break déterministe (rng injecté).
    - **Fallback AI** : si aucun tile valide trouvé → `retreatPosition` omis dans action. Engine émettra `HitAndRunRetreatFallback { reason: "no-tile-available" }`.
    - **Dette balance documentée** : heuristique greedy max-distance, risque corner-camping. Refinement post-playtest (pondération terrain favorable) — hors scope Phase 4.
    - Pré-calcul : génère candidate tiles avant `submitAction`, choisit best, ajoute à `action.retreatPosition`.
12. **PRNG injecté** : `BattleEngine.rng` (réutilisé pour tie-break AI). Replay déterministe.
13. **Renderer flow 2-phase** :
    - **Phase 1 (target)** : après confirm move HitAndRun, highlight Single targets in `hitRange`. Joueur clique target → lock.
    - **Phase 2 (retreat)** : highlight tiles vides in `retreatRange` autour caster (couleur distincte, ex bleu cyan). Click empty tile → lock retreat.
    - **Confirm** : submit `ActionUseMove` avec `targetPosition` + `retreatPosition`.
    - **Cancel** : escape ou clic droit → revient phase 1 (re-pick target) ou phase 0 (action menu).
14. **Compatibilité Substitute / Protect** :
    - Target sous Substitute : sub absorbe dégâts, retreat applique (sub-hit = hit successful).
    - Target sous Protect : Protect bloque dégâts (les 3 moves n'ont pas `bypassProtect`). **Décision** : Protect block = considéré comme hit-fail → **retreat NE s'applique PAS** (parité Showdown : Protect annule l'effet de switch). Émet `HitAndRunRetreatFallback { reason: "miss" }` ou variant dédiée `"blocked"`.
    - Caster sous Substitute : pas d'interaction spéciale, retreat applique normalement (le sub du caster est un volatile, pas un binding).
15. **Wide Guard interaction** : HitAndRun = Single target (pas AoE multi-target). Wide Guard **ne bloque pas** HitAndRun. Pas de check spécial nécessaire.
16. **Knockback hit phase** : les 3 moves n'ont pas d'effet `Knockback`. Mais si futur move HitAndRun combine Knockback déplaçant le caster (effet recoil-position), `retreatRange` est calculée depuis **caster.position post-effects** (au moment de la validation retreat, pas pré-effects). Documenter le contrat.
17. **Recoil / Drain** : pas dans les 3 moves data. Architecture supporte si futurs moves combinent.
18. **Friendly fire** : Single ne cible pas allié par défaut côté UI, mais resolver l'accepte. HitAndRun n'introduit pas de spec — comportement standard Single (allié ciblable techniquement via override config, pas en flow normal).
19. **`getLegalActions`** : pour move HitAndRun, génère les couples `(targetPosition, retreatPosition)` ? Non, trop combinatoire (target × retreat = O(n²)). Pour AI/UI : génère uniquement les `targetPosition` valides. L'AI/UI complète `retreatPosition` post-pick. Engine valide à l'exécution.
    - **UI Phase 2** : tiles retreat candidates calculées dynamiquement à partir de `caster.position` au moment du lock target (pas pré-calculées dans `getLegalActions`).

## Étapes

### 1. Enum + type

**Fichiers** :
- `packages/core/src/enums/targeting-kind.ts` — ajouter `HitAndRun: "hit-and-run"`.
- `packages/core/src/types/targeting-pattern.ts` — ajouter variant `{ kind: typeof TargetingKind.HitAndRun; hitRange: RangeConfig; retreatRange: RangeConfig }`.

### 2. Resolver hit phase

**Fichier** :
- `packages/core/src/grid/resolve-hit-and-run.ts` (nouveau) — `resolveHitAndRun(caster, target, hitRange, grid, occupied): Position[]`. Retourne `[target]` si Chebyshev ∈ hitRange ET target occupée par Pokemon vivant ennemi. Sinon `[]`.
- `packages/core/src/grid/targeting.ts` :
  - `computeIgnoresLoS` retourne `false` pour `kind === HitAndRun` (hit phase = LoS classique).
  - `resolveTargeting` switch case `HitAndRun` → délègue.

**Test** : `resolve-hit-and-run.test.ts` — in-range valid, out-range vide, target vide rejetée, target obstacle rejetée, LoS bloqué vide.

### 3. Retreat validation helper

**Fichier** :
- `packages/core/src/grid/validate-hit-and-run-retreat.ts` (nouveau) — `validateHitAndRunRetreat(caster, retreatPosition, retreatRange, grid, occupied): boolean`. Vérifie Chebyshev distance ∈ retreatRange, in-bounds, non-occupée par Pokemon vivant.

**Test** : `validate-hit-and-run-retreat.test.ts` — range OK, range trop loin, out-bounds, tile occupée alliée, occupée ennemie, occupée par caster lui-même (autorisé — caster ne bouge pas).

### 4. Action extension + engine intégration

**4a. Action** :
- `packages/core/src/types/action.ts` :
  ```ts
  | { kind: typeof ActionKind.UseMove; pokemonId: string; moveId: string; targetPosition: Position; retreatPosition?: Position }
  ```

**4b. Events** :
- `packages/core/src/enums/battle-event-type.ts` — ajouter `HitAndRunRetreat: "HitAndRunRetreat"` + `HitAndRunRetreatFallback: "HitAndRunRetreatFallback"`.
- `packages/core/src/types/battle-event.ts` — variants :
  ```ts
  | { type: typeof BattleEventType.HitAndRunRetreat; pokemonId: PokemonId; fromPosition: Position; toPosition: Position }
  | { type: typeof BattleEventType.HitAndRunRetreatFallback; pokemonId: PokemonId; reason: "miss" | "invalid" | "missing" | "no-tile-available" }
  ```

**4c. `BattleEngine.executeUseMove`** :
- Après pipeline effects + `handleKo` :
  - Si `pattern.kind === HitAndRun` :
    - Snapshot `occupied` post-KO.
    - Valider `action.retreatPosition` via `validateHitAndRunRetreat`.
    - Si valide : update caster position, emit `HitAndRunRetreat`, appel terrain triggers (`applyTerrainOnEnter`).
    - Si invalide ou absent : silent skip (le caster reste). Aucune erreur, juste pas d'event retreat.

**4d. AI** (helper `pickAiRetreatPosition` créé étape 8, référencé ici) :
- `packages/core/src/ai/action-scorer.ts` — détecter HitAndRun avant scoring. Pour chaque target valide :
  - Score base = scoring Single classique.
  - Appel helper `pickAiRetreatPosition(caster, retreatRange, grid, occupied, enemyPositions, rng)` → retourne `Position | null`.
  - Si `null` → action proposed sans `retreatPosition` (engine émettra fallback event).
- Heuristique helper : tile max `min(distance to nearest enemy)`. Tie-break stable via shuffle PRNG.

**Test** : `hit-and-run-engine.integration.test.ts` —
- Hit + retreat valide : caster bouge, target prend dégâts.
- **Hit miss (accuracy fail)** : retreat **PAS appliqué**, event `HitAndRunRetreatFallback { reason: "miss" }`.
- **Hit bloqué par Protect** : pas de dégâts, retreat **PAS appliqué**, event fallback.
- Target sous Substitute : sub absorbe dégâts, retreat applique.
- Target KO par hit : retreat applique (post-KO occupied snapshot).
- retreatPosition manquante : caster reste, hit OK, event `HitAndRunRetreatFallback { reason: "missing" }`.
- retreatPosition invalide (occupée par allié vivant) : silent skip, event fallback `"invalid"`.
- Landing lava : burn déclenchée via `applyTerrainOnEnter`.
- Landing deep_water non-Vol : fall damage / KO létal terrain.
- Landing ice : slide déclenché.
- retreatPosition hors retreatRange Chebyshev : silent skip, event fallback `"invalid"`.

### 5. Moves data

**Fichier** : `packages/data/src/overrides/tactical.ts` — ajouter 3 entrées.

```ts
"u-turn": {
  targeting: { kind: TargetingKind.HitAndRun, hitRange: { min: 1, max: 1 }, retreatRange: { min: 1, max: 4 } },
  effects: [{ kind: EffectKind.Damage }],
},
"volt-switch": {
  targeting: { kind: TargetingKind.HitAndRun, hitRange: { min: 1, max: 2 }, retreatRange: { min: 1, max: 4 } },
  effects: [{ kind: EffectKind.Damage }],
  flags: { contact: false },
},
"flip-turn": {
  targeting: { kind: TargetingKind.HitAndRun, hitRange: { min: 1, max: 1 }, retreatRange: { min: 1, max: 4 } },
  effects: [{ kind: EffectKind.Damage }],
},
```

**Validation reference** (confirmé via `packages/data/reference/moves.json`) :
- u-turn : 70 BP / 100 acc / Bug / Physical / **contact:true**
- volt-switch : 70 BP / 100 acc / Electric / Special / **contact:false** (vérifié ligne ~31169)
- flip-turn : 60 BP / 100 acc / Water / Physical / **contact:true**

Pas de balance override nécessaire (BP/acc alignés).

**Décision range/contact** :
- hitRange = 1 strict pour u-turn / flip-turn (contact Showdown).
- hitRange = 1-2 pour volt-switch (non-contact, "electric discharge at distance" — différenciation tactique réelle).
- retreatRange = 1-4 uniforme 3 moves (aligné phantom-force, évite over-power vs Teleport random landing).

### 6. Renderer flow 2-phase

**6a. State machine** :
- `packages/renderer/src/scenes/battle/BattleScene.ts` — étendre state machine UI pour étape `awaitingRetreatPick`.
- Sub-states : `idle → action_menu → attack_targeting (phase 1: target) → attack_retreat (phase 2: retreat) → confirm → execute`.

**6b. Highlight retreat range** :
- `packages/renderer/src/scenes/battle/pattern-preview.ts` — case `HitAndRun` :
  - Phase 1 : highlight Single classique (cibles in hitRange).
  - Phase 2 : highlight tiles vides in retreatRange (couleur cyan distincte). Tile target lock affichée en orange tonique.
- `packages/renderer/src/constants.ts` — ajouter `HIGHLIGHT_RETREAT_COLOR` (ex `0x55ccff`).

**6c. Cursor input** :
- Click sur target valide phase 1 → lock target, switch phase 2.
- Click sur tile retreat valide phase 2 → submit action.
- Escape phase 2 → revient phase 1.

**6d. AI** : pas de flow UI, AI compute `retreatPosition` directement (étape 4d). Renderer reçoit `HitAndRunRetreat` event et anime sprite move.

### 6e. Event handler renderer

- `packages/renderer/src/scenes/battle/GameController.ts` — handler `HitAndRunRetreat` :
  - `pokemonSprite.setIsoPosition(toPosition)` instantané (parité MVP Teleport).
  - Optionnel polish ultérieur : tween rapide arc parabolique.
- `BattleLogFormatter.ts` — case `HitAndRunRetreat` : `t("battle.hitAndRunRetreat", { pokemonName })`.

**i18n** :
- fr : `"battle.hitAndRunRetreat": "{pokemonName} recule."`, `"battle.hitAndRunRetreatFallback": "{pokemonName} ne peut pas reculer."`
- en : `"battle.hitAndRunRetreat": "{pokemonName} falls back."`, `"battle.hitAndRunRetreatFallback": "{pokemonName} can't fall back."`
- Fallback `reason: "miss"` non loggé (déjà couvert par accuracy fail).

### 7. Tests intégration par move

**Fichiers** :
- `packages/core/src/battle/moves/u-turn.integration.test.ts`
- `packages/core/src/battle/moves/volt-switch.integration.test.ts`
- `packages/core/src/battle/moves/flip-turn.integration.test.ts`

Pattern `buildMoveTestEngine({ random: createPrng(seed) })`.

Scénarios par move :
- Hit baseline + retreat tile vide.
- Hit miss + retreat applique.
- Target KO + retreat applique.
- Retreat tile occupée → silent skip.
- Retreat sur lava (volt-switch sur Electric immune → testable scenario sandbox).
- Range max boundary.

### 8. AI scoring + tests

**Fichier** : `packages/core/src/ai/pick-hit-and-run-retreat.ts` (nouveau) — helper extracté.

**Test** : `pick-hit-and-run-retreat.test.ts` — 4 tiles libres, choisit la plus éloignée ennemi. Cas tile la plus éloignée occupée → fallback 2e plus éloignée. Tous tiles bloqués → retourne `null`.

**Smoke AI** : `scored-ai-smoke.test.ts` — vérifier qu'AI avec u-turn dans movepool joue correctement (pas de crash, retreatPosition fournie).

### 9. `getLegalActions`

**Fichier** : `packages/core/src/battle/BattleEngine.ts` — pour pattern HitAndRun, énumère uniquement `targetPosition` valides (pas le couple). Le retreat est laissé au client.

**Test** : `BattleEngine.legal-actions.hit-and-run.test.ts` — caster avec u-turn, vérifier que `legalActions` retourne 1 entry par cible ennemie in-range, sans `retreatPosition`.

### 10. Mise à jour `docs/implementations.md`

Ajouter 3 moves. Compteur global moves : 152 → **155**.

### 11. Mise à jour `docs/decisions.md`

Décisions #335-#345 :
- #335 — `TargetingKind.HitAndRun` introduit (hit Single + retreat TP choisi par joueur).
- #336 — `retreatRange` autour position caster, pas autour target.
- #337 — Hit miss / Protect block → retreat **NE s'applique PAS** (parité Showdown). Target KO par hit → retreat applique.
- #338 — `retreatPosition` invalide/manquante → silent skip + event `HitAndRunRetreatFallback`.
- #339 — AI heuristique retreat = max distance ennemi le plus proche. Dette balance documentée (corner-camping risque), refinement post-playtest.
- #340 — `getLegalActions` énumère seulement targetPosition (pas combinaison O(n²)).
- #341 — Animation retreat = placeholder instantané MVP.
- #342 — Retreat range 1-4 uniforme 3 moves (aligné phantom-force, évite over-power vs Teleport random landing).
- #343 — volt-switch hitRange 1-2 + `contact:false` (parité reference Showdown, différenciation tactique).
- #344 — Wide Guard ne bloque pas HitAndRun (Single target, pas AoE).
- #345 — Retreat validation utilise `occupied` snapshot **post-KO**.

### 12. Gate CI + golden replay

`pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration`.

Régénérer golden replay si IA pioche u-turn/volt-switch/flip-turn (probable — Scyther/Beedrill ont u-turn, Magneton/Zapdos ont volt-switch).

Commande : `pnpm tsx scripts/regenerate-golden-replay.ts`.

## Tests

- **Unit** :
  - `resolve-hit-and-run.test.ts`
  - `validate-hit-and-run-retreat.test.ts`
  - `pick-hit-and-run-retreat.test.ts`
- **Intégration** :
  - `hit-and-run-engine.integration.test.ts` (flow complet)
  - 3 fichiers `<move>.integration.test.ts`
- **Golden replay** : régénération si nécessaire.

## Risques connus

1. **Flow UI 2-phase confus** : joueur peut s'attendre à 1 clic. Indicateur visuel clair phase 2 (couleur tile distincte + texte hint "Choisir tile de repli").
2. **AI tile choice triviale** : heuristique max-distance peut pousser caster en coin de map sans valeur tactique. Acceptable MVP, raffinement post-playtest.
3. **Composition avec terrain ice slide** : si retreat tile = ice, slide se déclenche-t-il ? **Décision** : oui, `applyTerrainOnEnter` standard appliqué post-retreat. Documenter dans test.
4. **Range retreat 1-4 sur grandes maps** : sur maps 12×20, retreat r4 = ~80 tiles candidates côté distance Chebyshev — assez large pour vraie échappée tactique sans casser le tactique de map. Sur 6×6 sandbox, couvre quasi-tout (comportement attendu bac à sable).
5. **Friendly fire HitAndRun** : si target = allié, dégâts appliqués (parité Single). UI bloque par défaut (curseur n'accepte pas allié comme target). OK.
6. **Substitute interaction** : target sub absorbe dégâts, retreat applique (sub-hit = hit OK). Caster sub : pas d'impact, retreat applique. Tests dédiés.
7. **Knockback hit phase** : si futur move HitAndRun combine Knockback (déplace caster pré-retreat), validation retreatRange utilise `caster.position` **post-effects**. Documenter le contrat dans handler engine.
8. **Compteur events** : `HitAndRunRetreatFallback` rejoint la liste avec `reason` 4-variant (miss/invalid/missing/no-tile-available). Renderer affiche un texte i18n générique sauf miss (déjà loggé par accuracy fail).

## Migration data

Aucune migration nécessaire — ajouts purs. Les Pokemon dont le learnset inclut `u-turn` / `volt-switch` / `flip-turn` via reference Showdown verront ces moves apparaître automatiquement dans `movepool` (plan 087 dérivé).

Vérification post-impl learnsets exposent :
- u-turn : Scyther, Beedrill, Pidgeot, Mew (TM)
- volt-switch : Magneton, Zapdos, Raichu, Electrode (TM Gen 9)
- flip-turn : Starmie, Tentacruel, Lapras, Vaporeon (TM Gen 9)

## Compteurs prévus post-livraison

- Moves : 152 → **155**
- Targeting kinds : 10 → **11**
- BattleEventType : +1 (HitAndRunRetreat)
- Pokemon ayant accès à au moins 1 move HitAndRun : ~10 (à confirmer via learnset intersection).
