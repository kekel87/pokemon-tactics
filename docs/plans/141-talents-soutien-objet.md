# Plan 141 — Talents soutien & couplage objet (batch 5)

> **Statut** : `ready`
> **Branche/worktree** : `talents` (port 5183)
> **Scope** : 5 talents Gen-1 restants à effet combat réel → **98 → 103 talents.**
> **Suite de** : plans 136/137/138 (Tiers A/B/C), 139 (Sans Limite/Sérénité), 140 (Brise Moule).

## Contexte

Après les plans 136–140, il reste 98 talents implémentés. Parmi les talents portés par le roster Gen-1, ceux à effet **combat réel + porteur Gen-1 légal vérifié** (data-miner 2026-06-22) :

| Talent (id) | Porteurs Gen-1 (slot) |
|---|---|
| **Gloutonnerie** (`gluttony`) | Chétiflor/Boustiflor/Empiflor/Ronflex (hidden) |
| **Tension** (`unnerve`) | Abo/Arbok/Miaouss/Persian/Ptéra/Mewtwo (hidden) |
| **Moiteur** (`damp`) | Psykokwak/Akwakwak (ability1), lignée Ptitard (ability2), Paras/Parasect/Hypotrempe/Hypocéan (hidden) |
| **Cœur Soin** (`healer`) | Leveinard (hidden) |
| **Garde Amie** (`friend-guard`) | Mélofée/Rondoudou (hidden) |

**Hors batch** (inchangé) : info/overworld (Anticipation/Prédiction/Fouille/Fuite/Ramassage/Récolte/Piège — faible valeur 1v1 ou inutiles sans switch) ; Glu (`sticky-hold`, vol d'objet non implémenté) ; Imposteur (`imposter`, batch Métamorph) ; Gaz Inhibiteur (`neutralizing-gas`, aucun porteur Gen-1).

## Décisions de design (validées humain 2026-06-22)

- **D1 — Portée soutien (Cœur Soin, Garde Amie)** : **rayon Manhattan r2** autour du porteur (cohérent avec les auras mobiles existantes ; positionnement compte ; inerte en 1v1). Helper `manhattanDistance` (`packages/core/src/utils/`).
- **D2 — Cœur Soin déclenchement** : **30% aléatoire** par fin de tour (canon), roll **indépendant par allié éligible** dans le rayon (parité Showdown « chance de soigner un allié adjacent »).
- **D3 — Moiteur** : **relationnel (pas field-wide — divergence assumée vs canon, choix humain 2026-06-22)**. Destruction (`self-destruct`) échoue entièrement seulement si un porteur de Moiteur vivant est **parmi les cibles** de l'explosion (`findDampInTargets`). Boom Final (`aftermath`, plan 138) : recul annulé seulement si **l'attaquant qui le subirait** porte Moiteur.
- **D4 — Visuel** : talents marqueurs déclencheurs émettent `AbilityActivated` quand l'effet se produit (Cœur Soin soigne, Moiteur bloque, Gloutonnerie/baie via l'event objet existant). Tension est silencieux (absence d'effet, pas d'activation visible — comme un blocage).

## Implémentation par talent

### 1. Gloutonnerie (`gluttony`) — **data-only, zéro core**

Seuil de la baie de pincement passe de 25% → **50%** PV si le porteur a Gloutonnerie.

- `packages/data/src/items/item-definitions.ts` : dans `pinchStatBerry`, `isInPinch` lit `pokemon.abilityId === "gluttony"` → seuil `0.5` sinon `PINCH_BERRY_THRESHOLD` (0.25). Nouvelle constante `GLUTTONY_BERRY_THRESHOLD = 0.5`.
- N'affecte que les baies de pincement stat (Lichii/Lingan/Pitaye/Abriko/Sailak) — seules baies à seuil PV implémentées (pas de baie soin-PV type Sitrus dans le roster d'objets).
- `abilityId` est déjà un champ de `PokemonInstance` → aucune dépendance au registre.
- `packages/data/src/abilities/ability-definitions.ts` : handler marqueur `const gluttony: AbilityHandler = { id: "gluttony" };` + ajout au tableau `abilityHandlers`.

### 2. Tension (`unnerve`) — gate consommation de baie (core)

Tant qu'un ennemi vivant porte Tension, le porteur d'une baie ne peut pas la manger.

- `packages/core/src/types/held-item-definition.ts` : ajout `isBerry?: boolean` à `HeldItemHandler`.
- `packages/data/src/items/item-definitions.ts` : `isBerry: true` sur les 3 factories baies (`typeResistBerry`, `pinchStatBerry`, `cureBerry`).
- **Nouveau** `packages/core/src/battle/berry-suppression.ts` : `areBerriesSuppressed(state, holder): boolean` = il existe un Pokémon `currentHp > 0`, `playerId !== holder.playerId`, `abilityId === "unnerve"`.
- Gate aux **sites d'appel** des hooks objet baie dans `effect-processor.ts` (et tout handler invoquant `onAfterDamageReceived`/`onEndTurn` objet) : si `handler.isBerry && areBerriesSuppressed(state, holder)` → ne pas déclencher (skip silencieux, pas de consommation).
- `packages/data/src/abilities/ability-definitions.ts` : handler marqueur `unnerve` + tableau.
- ⚠️ Vérifier que tous les sites passent `state` au gate (le hook objet `onAfterDamageReceived` reçoit `AfterItemDamageContext` sans `state` → le gate s'applique **au site d'appel** dans le core qui, lui, a `state`, pas dans le handler data).

### 3. Moiteur (`damp`) — gate move explosion + aftermath (core)

- **Pas de flag explosion existant** (vérifié) : ajouter `isExplosion?: boolean` à `MoveDefinition` (`packages/core/src/types/move-definition.ts`) + override `isExplosion: true` sur `self-destruct` (et `misty-explosion` si présente) dans `packages/data/src/overrides/tactical.ts`.
- **Nouveau helper** `packages/core/src/battle/damp-system.ts` : `isFieldDampActive(state): boolean` = un Pokémon `currentHp > 0` avec `abilityId === "damp"` ; renvoie aussi/expose le porteur bloquant (premier dans l'ordre d'ID, déterministe) pour l'`AbilityActivated`.
- `executeUseMove` (engine) : avant exécution, si `move.isExplosion && isFieldDampActive(state)` → échec du move, émettre `MoveFailed` (+ `AbilityActivated` damp sur le **premier** porteur trouvé par ordre d'ID — déterministe, évite le floating text dupliqué en multi-Moiteur). Coût CT payé (move tenté).
- `aftermath` handler (`ability-definitions.ts`, `onAfterKO`) : si `isFieldDampActive(context.state)` → pas de dégâts de recul (return []). `AfterKOContext` expose bien `state` (vérifié).
- Handler marqueur `damp` + tableau.

### 4. Cœur Soin (`healer`) — ability `onEndTurn` (data, patron shed-skin)

- `packages/data/src/abilities/ability-definitions.ts` : nouveau handler `healer`, `onEndTurn(context)` :
  - Scanner `context.state.pokemon` : alliés = `playerId === self.playerId && id !== self.id && currentHp > 0 && manhattanDistance(self.position, ally.position) <= 2`.
  - Pour chaque allié éligible portant un statut majeur (`MAJOR_STATUSES_FOR_CURE`) : `context.random() < 0.3` (roll indépendant par allié) → retirer les statuts majeurs, émettre `StatusRemoved` (par statut) + `AbilityActivated` (healer, targetIds=[ally.id]).
  - Ne soigne **que** les statuts majeurs (`MAJOR_STATUSES_FOR_CURE`) ; les volatils (Confusion, Provoc…) restent — test explicite « allié majeur+volatil → seul le majeur soigné ».
  - Réutiliser `MAJOR_STATUSES_FOR_CURE` (déjà défini pour shed-skin/hydration).
- `manhattanDistance` est exporté depuis `@pokemon-tactic/core` utils → importable côté data (vérifié plan-reviewer, frontière `data → core` respectée).

### 5. Garde Amie (`friend-guard`) — multiplicateur dégâts (core)

- Le multiplicateur s'applique **dans `handle-damage.ts`** (le call-site qui a `state`), **pas** dans `calculateDamageWithCrit` (qui ne reçoit pas `state`). Après le calcul des dégâts, multiplier par le résultat de `friendGuardMultiplier`.
- **Nouveau helper** `packages/core/src/battle/friend-guard-system.ts` : `friendGuardMultiplier(state, defender): number` = `0.75` s'il existe un **allié vivant du défenseur** (même `playerId`, `id !== defender.id`, `abilityId === "friend-guard"`, `manhattanDistance(defender.position, ally.position) <= 2`), sinon `1`.
- Appliqué **après tous les autres modificateurs** (STAB/type/crit/barrières). Multiplicatif avec Reflet/Mur Lumière → plancher possible ×0.375 (physique sous Mur Lumière + Garde Amie). **Choix assumé** (tracé `decisions.md`) : coûteux à maintenir (2 conditions positionnelles + porteur KO-able), à surveiller en playtest 6v6 ; correction de repli si trop fort = non-cumul avec écrans.
- **Pas d'interaction Brise Moule** : Garde Amie est sur l'allié, pas sur la cible ; `mold-breaker` n'ignore que les talents **de la cible**. Aucun appel à `resolveDefensiveAbility`.
- Handler marqueur `friend-guard` + tableau.

## Tests

- **Unit core** :
  - `berry-suppression.test.ts` : ennemi Tension vivant → suppressed true ; mort → false ; allié Tension → false (n'affecte pas son camp).
  - `damp-system.test.ts` : terrain avec/ sans Moiteur.
  - `friend-guard-system.test.ts` (ou dans damage-calculator.test) : ×0.75 si allié r2, ×1 si r3/absent/KO.
- **Intégration** (`abilities.integration.test.ts`) :
  - Gloutonnerie : baie pincement déclenche à 50% PV (pas à 26% sans le talent).
  - Tension : baie anti-type/pincement/soin **ne se déclenche pas** face à un ennemi Tension.
  - Moiteur : Destruction échoue si un Pokémon Moiteur sur le terrain ; Boom Final ne fait pas de recul.
  - Cœur Soin : allié empoisonné à r2 soigné (seed fixe pour le 30%), allié r3 non soigné.
  - Garde Amie : dégâts ×0.75 sur allié r2.
- **e2e** (`mechanics-talents-*.spec.ts`) + cahier `docs/test-plan.md` : 1 scénario observable par talent jouable (a minima Gloutonnerie + Garde Amie + Cœur Soin, pilotables via journal).

## Étapes transverses (ne pas oublier)

- **Enregistrement registre** : chaque nouveau handler (`gluttony`, `unnerve`, `damp`, `healer`, `friend-guard`) ajouté au tableau final `abilityHandlers` de `ability-definitions.ts` (oubli courant).
- **i18n talents** : noms + descriptions FR/EN des 5 talents dans `packages/data/src/i18n/abilities.{fr,en}.json` (ou source équivalente).
- **`decisions.md`** : tracer #557+ — D1 portée r2, D2 Cœur Soin 30%, D3 Moiteur+aftermath, **Garde Amie ×0.75 cumul écrans assumé (plancher ×0.375, repli = non-cumul si trop fort)**, Gloutonnerie hors baie Sitrus (limitation).
- **`docs/abilities-system.md`**, **`docs/implementations.md`** (98→103), **STATUS.md**, **next.md** : MAJ via doc-keeper.

## Hors-scope / différé

- OP sets : non requis (talents niche/hidden ; couverts par override sandbox + team-builder). Pas d'ajout OP set.
- **Gloutonnerie hors baie Sitrus** : Gloutonnerie n'affecte que les baies de pincement stat (seuil PV paramétrable). La baie Sitrus (`onEndTurn`, seuil ≤50% non paramétré) n'est pas touchée — limitation assumée (canoniquement Gloutonnerie devrait l'affecter), à revoir au plan « items complexes ».
- **Tension — réévaluer si baies soin ajoutées** : impact actuel limité (5 baies de pincement stat). Si le roster d'objets ajoute des baies soin (Figy/Wiki/…), Tension monte en puissance → réévaluer l'équilibrage. Note à porter dans `next.md`.
- Glu, Imposteur, Gaz Inhibiteur : voir § Contexte.

## Risques

- **Tension** : recensement exhaustif des sites d'appel des hooks baie dans le core (sinon une baie passe à travers le gate). Grep `onAfterDamageReceived`/`onEndTurn` côté items.
- **Garde Amie / Cœur Soin** : threading de `state`/positions jusqu'au damage-calculator et import `manhattanDistance` côté data — vérifier la frontière core/data.
- **Moiteur** : présence d'un flag explosion en reference ; sinon override `tactical.ts`. Contexte `AfterKOContext` doit exposer `state`.
