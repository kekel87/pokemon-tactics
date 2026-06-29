# Plan 144 — Famille Move-copy

- **Statut** : `done` (2026-06-29 — core + renderer + IA + i18n livrés, 3566 unit verts)
- **Date** : 2026-06-28
- **Périmètre** : 6 moves qui appellent / copient un autre move. **434 → 440 moves.**
- **Prérequis** : aucun. S'appuie sur le pattern de substitution pré-exécution de Force Nature (`naturePowerMorph`), le pending d'état type charge (`chargingMove`), le 2-temps client de Hit & Run, et le gate sommeil de Ronflement (`requiresAsleep`).

---

## 1. Objectif

Implémenter la première vraie **réentrance moteur** : un move qui en exécute un autre choisi au runtime. Force Nature (`nature-power`, plan 118) défrichait déjà la substitution pré-exécution mais de façon déterministe (selon la tuile). Ici on généralise à 3 sources de move : aléatoire, dernier move d'une cible, dernier move global — plus 2 moves qui *apprennent* le move copié au lieu de l'utiliser.

## 2. Périmètre & noms FR

| Move (id) | Nom FR | Mécanique | In-pool Gen 1 | Flow |
|-----------|--------|-----------|---------------|------|
| `metronome` | **Métronome** | move **aléatoire** parmi tous les moves implémentés − exclusions | ✅ 30 apprenants | call-move, **2-temps nom masqué** |
| `sleep-talk` | **Blabla Dodo** | move **aléatoire** du **propre moveset** du lanceur − exclusions ; jouable **uniquement en dormant**, s'exécute malgré le sommeil | ✅ 118 apprenants | call-move, **2-temps nom masqué** |
| `mirror-move` | **Mimique** | exécute le **dernier move utilisé par la cible** (ennemi r1+) | ❌ 0 apprenant | call-move, 2-temps **nom visible** |
| `copycat` | **Photocopie** | exécute le **dernier move utilisé par n'importe qui** en combat | ❌ 0 apprenant | call-move, **nom visible** (1 placement) |
| `mimic` | **Copie** | **remplace son propre slot** par le dernier move de la cible (durée combat) | ❌ 0 apprenant | move ciblé standard (effet) |
| `sketch` | **Gribouille** | idem Copie mais « permanent » | ❌ 0 apprenant | move ciblé standard (effet) |

> **Hors-pool** (Mimique / Photocopie / Copie / Gribouille) : 0 apprenant Gen 1 légal → utilisables seulement via Team Builder libre. Inclus sur **décision humaine explicite** (2026-06-28), rupture assumée avec la règle « in-pool only ».

> **Copie ≡ Gribouille dans notre contexte** : pas de switch, pas de persistance cross-combat → la distinction « jusqu'au switch » vs « permanent » est sans effet. Mécanique partagée, flavor/learnset distincts. À documenter dans `decisions.md`.

## 3. Décisions design (tranchées avec l'humain, 2026-06-28)

1. **Scope** = les 6 moves (2 in-pool + 4 hors-pool).
2. **Pool Métronome** = tous les moves implémentés **− liste d'exclusion** (cf. §6). Chaos canon.
3. **Ciblage des aléatoires** = **2-temps avec révélation du pattern, nom masqué `???`** : on lance → l'engine tire → le renderer surligne le pattern (forme/portée) du move tiré sans révéler son identité → le joueur place la cible → exécution.
4. **Annuler (Échap) pendant le placement** = retour menu d'action, **ni PP ni tour consommés**. **MAIS le move tiré est verrouillé pour le tour** : re-sélectionner Métronome **ré-affiche le MÊME move** (aucun nouveau tirage). Anti-triche : pas de reroll-until-good. Le tirage n'est relancé qu'au tour suivant. Le verrou (`pendingCalledMove`) survit à l'annulation et n'est purgé qu'à l'exécution réelle, en fin de tour, ou au KO.

## 4. Deux sous-mécaniques

### 4.A — Call-move « exécution immédiate » (Métronome, Blabla Dodo, Mimique, Photocopie)

Réentrance via un **état pending sur l'instance** + résolution **mid-turn** (même tour, pas de tour adverse intercalé — contrairement à la charge).

**Modèle moteur**
- `PokemonInstance.pendingCalledMove?: { sourceMoveId: string; calledMoveId: string; reveal: boolean }`.
- `MoveDefinition.callMove?: CallMoveSource` (déclaratif) :
  ```ts
  type CallMoveSource =
    | { kind: "random-all" }          // Métronome
    | { kind: "random-own-asleep" }   // Blabla Dodo (gate requiresAsleep)
    | { kind: "target-last" }         // Mimique (lit cible.lastUsedMoveId)
    | { kind: "global-last" };        // Photocopie (state.lastMoveUsedGlobally)
  ```
- **Nouvelle méthode** `BattleEngine.prepareCalledMove(casterId, sourceMoveId, selectedTargetId?)` :
  - `random-all` : tire dans `implémentés − exclusions` (PRNG moteur), `reveal=false`.
  - `random-own-asleep` : tire dans `moveset propre − exclusions` (PP>0), `reveal=false`. Gate sommeil déjà vérifié par `getLegalActions` (cf. §4.A.sleep).
  - `target-last` : lit `target.lastUsedMoveId`, `reveal=true`. Échec si absent.
  - `global-last` : lit `state.lastMoveUsedGlobally`, `reveal=true`. Échec si absent.
  - **Idempotent** : si `pendingCalledMove` existe déjà pour ce lanceur ce tour-ci → **retourne l'existant sans re-tirer** (verrou anti-reroll, décision #4). Le PRNG n'avance qu'au **premier** appel du tour.
  - Retourne `{ calledMoveId, targeting, reveal } | { failed, reason }` et pose `pendingCalledMove`. **N'avance pas le tour** (résolution, pas action).
- **`submitAction(UseMove, sourceMoveId, targetPosition)`** : si `pendingCalledMove` est posé → swap `effectiveMove = calledMove`, `resolveTargeting(calledMove.targeting, …, targetPosition)`, exécution normale (`processEffects`), clear pending, **avance le tour**. **PP dépensé sur le move source** (Métronome), pas sur le move appelé — comme Force Nature.
- **Pas de `cancelCalledMove`** : annuler le placement (Échap) **ne purge pas** `pendingCalledMove`. Le verrou ne tombe qu'à l'exécution réelle, en **fin de tour** (cleanup), ou au **KO** (parité `chargingMove`). → re-sélection = même move.

**Lifecycle du pending (clarification plan-reviewer #1)**
`pendingCalledMove` est de l'**état moteur** posé par une **query** (`prepareCalledMove`), **pas** par une action de tour. Le tour n'avance **qu'au** `submitAction` final. Cycle de vie :
```
1. Renderer : clic Métronome → engine.prepareCalledMove(caster, metronome)
   → roll PRNG (1×), pose pendingCalledMove, retourne {calledMoveId, targeting, reveal}
   → renderer entre dans select_called_move_target. Tour PAS avancé.
2. Échap → renderer revient à action_menu. pendingCalledMove SURVIT.
3a. Re-clic Métronome → prepareCalledMove idempotent → même calledMoveId (pas de re-roll).
3b. Le joueur joue un AUTRE move (ex: Tonnerre) → submitAction(Tonnerre) s'exécute
    normalement ; pendingCalledMove (Métronome) reste posé mais inerte → purgé en
    fin de tour. Pas de combinaison, pas de blocage : submitAction n'agit sur le
    pending QUE si sourceMoveId === pendingCalledMove.sourceMoveId.
4. Clic cible → submitAction(Métronome, targetPosition) → swap, exécute, clear, tour avance.
```
- **Purge fin de tour** : dans le handler de fin de tour du lanceur (même endroit que le cleanup `chargingMove` non-tiré, `BattleEngine.ts:2444`).

**Garde-fous réentrance**
- Le move appelé ne peut **pas** être lui-même un `callMove` (déjà exclu par la liste §6) → pas de récursion.
- Cleanup `pendingCalledMove` dans `handleKo` + fin de tour (cf. lifecycle ci-dessus).
- **`lastUsedMoveId` du lanceur = move source** (Métronome), pas l'appelé (décision §13). **Site précis** : pour un `callMove`, appeler `recordLastUsedMove(caster, sourceMove)` — donc capturer le move source dans le pending et le passer à `recordLastUsedMove` **au lieu de** l'`effectiveMove` swappé. ⚠️ Ne pas laisser `executeUseMove` enregistrer l'`effectiveMove` par défaut (sinon `lastUsedMoveId` = move appelé).
- **Conséquence sur Copie/Mimique d'un lanceur de metamove** : `target.lastUsedMoveId` vaut donc le **move source** (ex: Métronome). Copie/Mimique copient alors un metamove → le slot devient Métronome (re-roll à l'usage). Edge hors-pool assumé, documenté.

**Gate sommeil Blabla Dodo (`requiresAsleep`)**
- Réutilise le flag `requiresAsleep` + `canActWhileAsleep()` (déjà en place pour Ronflement, `BattleEngine.ts:2477`). Move proposé par `getLegalActions` même endormi ; bloqué si éveillé.

**Flows d'interaction (renderer) — clarification plan-reviewer #2,#4**
Un **seul** InputState terminal `select_called_move_target` ; la différence est l'**amont** :
- **Métronome / Blabla Dodo / Photocopie** : pas de cible amont. Au clic du move source → `prepareCalledMove(caster, source)` (auto/global) → entrée directe dans `select_called_move_target`. Nom `???` (aléatoires) ou visible (Photocopie). 1 placement.
- **Mimique** : amont = sélection d'un ennemi. Le move source porte un `targeting = Single r1+` → flow normal `select_attack_target`. **Au clic ennemi, dans `tryPickTarget`, on n'appelle PAS `submitAction`** : on détecte `move.callMove.kind === "target-last"`, on appelle `prepareCalledMove(caster, mirror-move, enemyId)`, puis on bascule vers `select_called_move_target` (nom visible). Échec (`failed`) si l'ennemi n'a pas de dernier move → message + retour menu. 2 sélections, mais réutilise `select_attack_target` pour la 1re (pas de nouvel état amont).

### 4.B — Moveset-replace « apprend le move » (Copie, Gribouille)

Move ciblé standard (range 1 ennemi, statut), **pas** de pending ni 2-temps. Effet dédié.
- **Nouvel `EffectKind.CopyMoveToSlot`** + handler `handlers/move-copy/copy-move-to-slot.ts` :
  - Lit `target.lastUsedMoveId` ; échec si absent.
  - Remplace le slot du move source dans `caster.moves` par le move copié, **PP = 5 fixe** (canon mimic, décision §13).
  - Émet `BattleEventType.MoveCopied { casterId, slotMoveId, copiedMoveId }`.
- Le move copié devient jouable normalement aux tours suivants (slot muté). Persiste jusqu'à fin de combat.
- **Edge (plan-reviewer #3a)** : si la cible vient de jouer un metamove, `target.lastUsedMoveId` = le **move source** (cf. décision §13) → Copie/Gribouille recopient ce metamove dans le slot (re-roll à l'usage). Comportement documenté, non bloqué.

## 5. Tracking « dernier move global » (clarification plan-reviewer #3b)

- `BattleState.lastMoveUsedGlobally?: string` mis à jour dans `executeUseMove`, au moment de l'exécution effective.
- **Règle metamove** : on enregistre le **move appelé** (ex: Tonnerre), **jamais** le `callMove` source (Métronome/Photocopie/Mimique). Garde explicite : `if (!effectiveMove.callMove) state.lastMoveUsedGlobally = effectiveMove.id`. Le move source est filtré car, après swap, `effectiveMove` est le move appelé (qui, lui, n'a pas de `callMove`) ; on enregistre donc le bon. Le cas « move source non swappé » (échec de résolution) ne doit pas polluer le global-last.
- ⚠️ **Distinct de `caster.lastUsedMoveId`** (= move source, décision §13). Les deux champs divergent volontairement pour un metamove : `caster.lastUsedMoveId = Métronome`, `state.lastMoveUsedGlobally = Tonnerre`.

## 6. Liste d'exclusion (tirage Métronome / Blabla Dodo)

Exclure du tirage :
1. **Famille move-copy** : `metronome`, `sleep-talk`, `mirror-move`, `copycat`, `mimic`, `sketch`, `nature-power`, (`transform` si un jour). → anti-récursion.
2. **Moves 2-tours** (`twoTurnCharge === true`) : tireraient un move charge ingérable en 1 placement.
3. **Hit & Run** (`TargetingKind.HitAndRun`) : exigent une tuile de retraite, hors flow.
4. (À évaluer) lock-in multi-turn quand implémentés (`thrash`/`outrage`…), `focus-punch`-like.

Implémentation : helper `isMetronomeCallable(move)` + `isSleepTalkCallable(move)` dans `battle/move-copy/callable-moves.ts`. Filtrage data-driven sur les flags `MoveDefinition`. **Logguer** le nb de moves dans le pool (pas de cap silencieux).

## 6bis. Échecs & edge-cases (clarification plan-reviewer #5)

Tous échouent **proprement** (move « rate », ni PP ni tour perdus côté joueur ; côté moteur l'action est consommée comme un raté standard si déjà soumise) :
- **`target-last` / `global-last` sans dernier move** (`Mimique`/`Photocopie` au tour 1) → `prepareCalledMove` retourne `failed` → renderer : message + retour menu (rien consommé). IA : score 0.
- **Pool vide** : Métronome (impossible, >400 moves) ; **Blabla Dodo dont tous les moves sont exclus** (ex: moveset = uniquement charge/metamoves) → `failed` → move non proposé par `getLegalActions` (filtrer en amont : Blabla Dodo legal seulement si ≥1 move propre callable).
- **Move appelé sans cible légale au placement** (ex: tiré un move r1 mais aucun ennemi adjacent) : le pattern surligne 0 tuile valide → le joueur ne peut que Échap (pending verrouillé) ou ne rien placer ; en dernier recours le move appelé « rate » à l'exécution (parité no-target standard).
- **`global-last` qui pointe un metamove** : impossible par construction (§5 n'enregistre jamais un `callMove` comme global-last).

## 7. Renderer (packages/view-core + render-ports + render-babylon)

- **InputState** nouveau : `{ phase: "select_called_move_target"; sourceMoveId; calledMoveId; reveal; action; targeting; tiles }` (`battle-orchestrator.ts:113`).
- `resolveAttack()` détecte `move.callMove` → appelle `engine.prepareCalledMove` → entre dans le nouvel état, `board.setHighlights(...)` selon le pattern du move appelé, `chrome.showSelectedMove(...)` avec **nom masqué `???`** si `reveal === false`.
- `onTileClick` (nouvel état) → submit l'action finale avec `targetPosition`.
- `onEscape` (nouvel état) → retour `enterAttackSubmenu()` **sans purger le pending** (verrou anti-reroll, décision #4). Re-sélectionner le move source ré-entre dans `select_called_move_target` avec le **même** `calledMoveId`.
- **Masquage** (décision §13) : flag `masked: true` sur `SelectedMoveView` → chrome affiche **nom = `???`**, **type/catégorie/puissance = `—`** (placeholder neutre, pas d'icône type/catégorie). Seul le **pattern** (highlights tuiles) est révélé. Une seule clé i18n `moveTooltip.masked` pour le `???`.
- Événements à câbler : `MoveCallPending` (highlight pattern), `MoveCopied` (Copie/Gribouille — feedback journal), réutilise les flottants existants pour le move appelé.
- `HighlightKind` : réutiliser `PreviewAttack`/`Attack` selon intent du move appelé (pas de nouveau kind a priori).

## 8. IA (`action-scorer.ts`)

- **Métronome / Blabla Dodo** : l'IA tire via `prepareCalledMove` puis place via l'auto-ciblage existant (greedy best target sur le move appelé), score = score du move appelé × léger malus d'incertitude. Blabla Dodo : seulement si endormi (sinon non legal).
- **Mimique / Photocopie** : score = score du move copié (connu) ; échec → score 0.
- **Copie / Gribouille** : heuristique simple — bonus si la cible a un dernier move plus fort que le slot courant. *(Peut être reporté en passe IA dédiée, comme item-interaction/type-manip — non bloquant.)*

## 9. i18n (FR/EN)

- 6 noms de moves (déjà en référence) + descriptions.
- Clés : instruction `selectCalledMoveTarget`, nom masqué `???`, badge journal `MoveCalled`/`MoveCopied`, tooltips (« Tire un move au hasard », « Copie le dernier move de la cible »…).
- Tags MoveTooltip : `🎲 Aléatoire`, `🪞 Copie le dernier move`, `📋 Apprend le move`.

## 10. Données / learners / OP sets

- Métronome (30) + Blabla Dodo (118) : ajouter aux movepools dérivés (déjà via learnset ∩ implémenté). 1-2 OP sets gadget optionnels (non requis).
- Mimique / Photocopie / Copie / Gribouille : 0 learner → aucun OP set, dispo Team Builder libre uniquement.

## 11. Tests

- **Unit/intégration core** (`packages/core`) :
  - Métronome : tirage déterministe via PRNG seedé, exclusions respectées, PP sur source, exécution du move appelé, cleanup pending.
  - Blabla Dodo : non legal éveillé, legal+exécutable endormi, tirage own-set, exclusions.
  - Mimique : copie le dernier move de la cible, échec si cible n'a rien joué.
  - Photocopie : global-last, échec si rien joué, exclusion des metamoves du global-last.
  - Copie/Gribouille : remplace le slot, PP, persiste, échec si cible vierge.
  - Anti-récursion : un move appelé ne peut pas être un callMove.
- **e2e Playwright** (`docs/test-plan.md` §5.x + §11) : scénario Métronome (2-temps, pattern surligné, nom `???`, placement, exécution), scénario Copie (slot muté). Le reste = unit (logique non-observable triviale).

## 12. Découpage d'implémentation

1. Core — état & API : `pendingCalledMove`, `CallMoveSource`, `prepareCalledMove`/`cancelCalledMove`, `lastMoveUsedGlobally`, helpers callables + exclusions. Tests.
2. Core — `EffectKind.CopyMoveToSlot` + handler (Copie/Gribouille). Tests.
3. Core — 4 moves call-move + 2 moves replace dans les overrides data + flags. Tests intégration.
4. Renderer — InputState `select_called_move_target`, prepare/cancel, masquage nom, highlights, events.
5. IA — scoring des 6.
6. i18n + tooltips + journal.
7. e2e + test-plan + decisions.md + STATUS + roadmap.

## 13. Décisions finales (tranchées humain, 2026-06-28)

- **Échap = retour menu, move tiré verrouillé pour le tour** (re-sélection = même move, pas de reroll). Verrou tombe en fin de tour. Anti-triche.
- **Masquage Métronome / Blabla Dodo** : **tout masqué sauf le pattern**. Nom, type, catégorie, puissance → `???`. Seule la forme/portée des tuiles est révélée.
- **PP du slot après Copie / Gribouille** : **5 fixe** (canon mimic).
- **`lastUsedMoveId` après Métronome** = **move source** (Métronome), pas l'appelé (parité Showdown).

**Coût** : la sous-phase mid-turn (prepare sans avancer le tour) est le **seul concept moteur nouveau** ; le reste réutilise charge / Hit&Run / Force Nature / Ronflement. Plan le plus lourd de la Phase 4 (réentrance + renderer dédié). ~2 sessions.
