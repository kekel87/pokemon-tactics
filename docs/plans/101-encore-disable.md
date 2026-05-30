# Plan 101 — Encore + Disable (Encore / Entrave)

> Statut : **done**
> Créé : 2026-05-30
> Revu : 2026-05-30 (plan-reviewer + game-designer — 7 corrections appliquées)
> Livré : 2026-05-30
> Auteur : Claude
> Spec source : Showdown `sim/data/moves.ts` (Gen 5+), Bulbapedia Encore/Disable, reference `moves.json` (disable/encore présents), canon roster Gen 1.

## Objectif

Livrer **2 moves disruptors `move-locking`** complétant la suite Taunt (plan 100) :

- **`disable` (Entrave)** — Normal, statut, Single r3, acc 100, pp 20. Bloque pendant **4 tours** la **dernière move utilisée** par la cible. La cible ne peut plus la sélectionner.
- **`encore` (Encore)** — Normal, statut, Single r3, acc 100, pp 5. Force la cible à **répéter sa dernière move** pendant **3 tours**. La cible est verrouillée sur cette seule move.

Les deux référencent la **dernière move exécutée par la cible** — nouveauté vs Taunt (qui ne lit aucun état de la cible). Nécessite un champ persistant `lastUsedMoveId` sur `PokemonInstance`.

## Pourquoi maintenant

- **Suite directe Taunt** : même famille « contrôle du choix de move » (move-locking). Infra volatile + check `executeUseMove` + filtre `getLegalActions` déjà rodée plan 100. Réutilisation maximale.
- **Disruption tactique forte** : Encore lock un setup adverse (ex : forcer répétition d'un Calm Mind devenu inutile) ; Disable coupe la move clé (STAB, Recover, Substitute). Excellents en jeu tactique au tour-par-tour.
- **Roster Gen 1 large** : disable/encore appris par de nombreux mons via learnset/TM (alakazam, gengar, mew, mewtwo, starmie, jolteon, persian, slowbro...). OP sets enrichis.
- **Data déjà présente** : `disable`/`encore` dans `reference/moves.json` (type Normal, acc 100, pp 20/5, noms FR Entrave/Encore). Zéro fetch.

## Hors scope

- **Magic Coat / Magic Bounce** (reflect) : non implémentés.
- **Liste d'immunité Encore complète** (Metronome, Mimic, Sketch, Sleep Talk, Struggle, Mirror Move...) : ces moves ne sont pas dans le roster. On gère uniquement le cas générique + une immunité Encore-sur-Encore et Disable-sur-Disable (déjà couvert par « already affected »).
- **Cas Encore + Disable simultanés sur la même move** (target struggle) : edge rare ; comportement = la move encored devient injouable → on lève l'encore (fallback all-moves). Documenté, pas testé en priorité.
- **Encore sur move 2-tours en cours de charge** (Solar-Beam) : edge ; l'encore s'appliquera au `lastUsedMoveId` enregistré (la move de charge). Acceptable.
- **Z-A pipeline** : fonctionnera tel quel.

## Décisions actées

### 1. Champ persistant `lastUsedMoveId` sur `PokemonInstance`

`turnState.lastMoveId` est **transient par tour** (réinitialisé à `null`) → inutilisable pour lire la dernière move d'une autre unité. On ajoute un champ persistant.

```ts
// packages/core/src/types/pokemon-instance.ts
export interface PokemonInstance {
  // ... existants
  substituteHp?: number;
  lastUsedMoveId?: string; // nouveau — dernière move RÉELLEMENT exécutée (pour Encore/Disable)
}
```

**Écriture** : dans `executeUseMove` (`BattleEngine.ts`), deux points seulement, **une seule écriture par appel** :

```ts
// 1) Complétion normale (≈ ligne 1037, à côté de this.turnState.lastMoveId = moveId)
this.turnState.lastMoveId = moveId;
pokemon.lastUsedMoveId = moveId; // nouveau

// 2) Charge T1 (≈ ligne 828) — JUSTE AVANT le `return { success: true, events }`
pokemon.lastUsedMoveId = moveId; // la move de charge compte comme « dernière move »
```

**Critique** : l'écriture ne doit se faire **qu'une fois** par appel à `executeUseMove`, et **jamais sur les `return` précoces** (échec ciblage, Taunt/Disable/Encore bloqués, PP 0, move inconnue). Une move bloquée ou échouée n'a pas été exécutée → ne met pas à jour `lastUsedMoveId`. Vérifier que les deux points d'écriture sont bien après tous les gardes/`return` d'échec.

### 2. État volatile + extension `VolatileStatus.moveId`

Les deux volatiles doivent **mémoriser quelle move** est concernée. `VolatileStatus` n'a pas de champ move → extension :

```ts
// packages/core/src/types/volatile-status.ts
export interface VolatileStatus {
  type: StatusType;
  remainingTurns: number;
  sourceId?: string;
  damagePerTurn?: number;
  statChangeApplied?: boolean;
  moveId?: string; // nouveau — move disabled (Disabled) ou move verrouillée (Encored)
}
```

Nouveaux `StatusType` :

```ts
// packages/core/src/enums/status-type.ts
Disabled: "disabled", // nouveau
Encored: "encored",   // nouveau
```

Ajoutés à `VOLATILE_STATUSES` (`handle-status.ts`). **Durées** dans `getStatusDuration` : `Disabled → 4`, `Encored → 3`.

> **Note** : on N'utilise PAS le chemin générique `EffectKind.Status` pour ces deux moves (contrairement à Taunt), car l'application doit lire `target.lastUsedMoveId`, valider (move connue, PP > 0, pas déjà affectée) et **échouer proprement** si aucune dernière move. C'est le pattern Substitute (`EffectKind.PostSubstitute` + handler dédié). Voir §3.

### 3. Application — EffectKind dédiés (mirror Substitute)

Deux nouveaux `EffectKind` + handlers dédiés, ciblant le **défenseur** :

```ts
// packages/core/src/enums/effect-kind.ts
Disable: "disable", // nouveau
Encore: "encore",   // nouveau
```

```ts
// packages/core/src/battle/handlers/handle-disable.ts
export function handleDisable(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const target of context.targets) {
    const moveId = target.lastUsedMoveId;
    // FAIL si : pas de dernière move | move plus connue | PP 0 | déjà un move disabled
    if (
      moveId === undefined ||
      !target.moveIds.includes(moveId) ||
      (target.currentPp[moveId] ?? 0) <= 0 ||
      target.volatileStatuses.some((v) => v.type === StatusType.Disabled)
    ) {
      events.push({ type: BattleEventType.DisableFailed, pokemonId: target.id });
      continue;
    }
    const turns = getStatusDuration(StatusType.Disabled, context.random); // 4
    target.volatileStatuses.push({ type: StatusType.Disabled, remainingTurns: turns, moveId, sourceId: context.attacker.id });
    events.push({ type: BattleEventType.MoveDisabled, pokemonId: target.id, moveId, turns });
  }
  return events;
}
```

```ts
// packages/core/src/battle/handlers/handle-encore.ts
export function handleEncore(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const target of context.targets) {
    const moveId = target.lastUsedMoveId;
    // FAIL si : pas de dernière move | move plus connue | PP 0 | déjà encored | move = encore (self-immune)
    if (
      moveId === undefined ||
      !target.moveIds.includes(moveId) ||
      (target.currentPp[moveId] ?? 0) <= 0 ||
      moveId === "encore" ||
      target.volatileStatuses.some((v) => v.type === StatusType.Encored)
    ) {
      events.push({ type: BattleEventType.EncoreFailed, pokemonId: target.id });
      continue;
    }
    const turns = getStatusDuration(StatusType.Encored, context.random); // 3
    target.volatileStatuses.push({ type: StatusType.Encored, remainingTurns: turns, moveId, sourceId: context.attacker.id });
    events.push({ type: BattleEventType.MoveEncored, pokemonId: target.id, moveId, turns });
  }
  return events;
}
```

Enregistrement dans `effect-processor.ts` :
```ts
registry.register(EffectKind.Disable, handleDisable);
registry.register(EffectKind.Encore, handleEncore);
```

> **Substitute (tranché)** : un Substitute actif **bloque** Disable/Encore (canon — effets de statut ciblant le Pokémon, comme Taunt plan 100). L'absorption sub du flux `handle-status` ne s'applique PAS aux EffectKind dédiés → check explicite en tête de chaque handler :
>
> ```ts
> if (hasSubstitute(target) && context.attacker.id !== target.id) {
>   events.push({
>     type: BattleEventType.SubstituteBlocked,
>     pokemonId: target.id,
>     reason: ProtectionReason.Substitute,
>   });
>   continue; // non-bloquant pour auto-cible (Disable/Encore sur soi-même)
> }
> ```
>
> Réutilise le pattern Taunt plan 100 (statut bloqué même par sub) + `SubstituteBlocked`/`ProtectionReason.Substitute` existants (plan 098/099). Voir test #6.

### 4. Blocage côté sélection — `getLegalActions` + `executeUseMove`

**`getLegalActions`** (`BattleEngine.ts`, boucle `for (const moveId of currentPokemon.moveIds)`), juste après le check Taunt :

```ts
// Disable : retirer la move disabled
const disabled = currentPokemon.volatileStatuses.find((v) => v.type === StatusType.Disabled);
if (disabled?.moveId === moveId) continue;

// Encore : ne garder QUE la move encored (si PP > 0)
const encored = currentPokemon.volatileStatuses.find((v) => v.type === StatusType.Encored);
if (encored !== undefined && encored.moveId !== moveId) continue;
```

> Si la move encored est tombée à 0 PP, le tick handler (§5) aura déjà levé l'encore au tour précédent. Garde-fou : si `encored` actif mais `currentPp[encored.moveId] <= 0`, le `continue` PP existant filtre déjà → aucune move jouable → l'unité passe (Move/EndTurn). Le tick suivant nettoie. La **mobilité (`ActionKind.Move`) reste autorisée** sous Encore/Disable (canon : seul le choix de move est contraint).

**`executeUseMove`** (garde défensive, après le check Taunt) — bloque la move disabled si appelée directement (API/IA) :

```ts
const disabled = pokemon.volatileStatuses.find((v) => v.type === StatusType.Disabled);
if (disabled?.moveId === moveId) {
  const ev = { type: BattleEventType.DisableBlocked, pokemonId: pokemon.id, moveId };
  this.emit(ev);
  return { success: false, events: [ev], error: ActionError.InvalidAction };
}
const encored = pokemon.volatileStatuses.find((v) => v.type === StatusType.Encored);
if (encored !== undefined && encored.moveId !== moveId) {
  const ev = { type: BattleEventType.EncoreBlocked, pokemonId: pokemon.id, moveId };
  this.emit(ev);
  return { success: false, events: [ev], error: ActionError.InvalidAction };
}
```

### 5. Tick handlers — généralisation de `taunt-tick-handler`

`taunt-tick-handler.ts` est spécifique à un seul `StatusType`. Plutôt que dupliquer 2× (disable + encore), **généraliser** en un handler paramétré sur une liste de types volatiles à durée :

```ts
// packages/core/src/battle/handlers/timed-volatile-tick-handler.ts
const TIMED_VOLATILES = [StatusType.Taunted, StatusType.Disabled, StatusType.Encored] as const;

export const timedVolatileTickHandler: PhaseHandler = (pokemonId, state) => {
  const pokemon = state.pokemon.get(pokemonId);
  const events: BattleEvent[] = [];
  if (!pokemon) return { events, skipAction: false, restrictActions: false, pokemonFainted: false };

  for (const type of TIMED_VOLATILES) {
    const index = pokemon.volatileStatuses.findIndex((v) => v.type === type);
    if (index === -1) continue;
    const v = pokemon.volatileStatuses[index];
    if (!v) continue;

    // Encore : fin anticipée si la move verrouillée est épuisée (canon)
    if (type === StatusType.Encored && v.moveId !== undefined && (pokemon.currentPp[v.moveId] ?? 0) <= 0) {
      pokemon.volatileStatuses.splice(index, 1);
      events.push({ type: BattleEventType.StatusRemoved, targetId: pokemonId, status: type });
      continue;
    }

    v.remainingTurns--;
    if (v.remainingTurns <= 0) {
      pokemon.volatileStatuses.splice(index, 1);
      events.push({ type: BattleEventType.StatusRemoved, targetId: pokemonId, status: type });
    }
  }
  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
};
```

- Supprimer `taunt-tick-handler.ts` ; remplacer son enregistrement (`registerEndTurn(tauntTickHandler, 350)`) par `registerEndTurn(timedVolatileTickHandler, 350)`. Adapter les tests Taunt qui importent `tauntTickHandler`.

> **Risque régression (OBLIGATOIRE)** : chaque type de `TIMED_VOLATILES` est traité indépendamment → l'ordre d'itération ne doit PAS affecter les durées. Vérifier que Taunt décrémente/expire à l'identique (durée 3, même tour d'expiration qu'avant). Test #11 (Taunt non régressé) bloquant avant merge + faire tourner toute la suite Taunt existante.

### 6. Move data (`tactical.ts`)

```ts
// packages/data/src/overrides/tactical.ts
disable: {
  targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
  effects: [{ kind: EffectKind.Disable }],
  effectTier: EffectTier.MajorStatus,
},
encore: {
  targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
  effects: [{ kind: EffectKind.Encore }],
  effectTier: EffectTier.MajorStatus,
},
```

Base (type Normal, acc 100, pp 20/5, noms FR Entrave/Encore) dérivée de `reference/moves.json` — déjà présent. Vérifier que `losRequired`/range matchent les autres single-target statut (mirror taunt).

### 7. OP sets — disruptors canon (~173 → ~177)

Porteurs **validés** contre `reference/indexes/pokemon-by-move.json` (disable / encore) ∩ roster jouable (`playable-pokemon.ts`) — voir revue game-designer :

- **alakazam-disable** ✅ : Disable / Psychic / Shadow-Ball / Recover. Coupe la move clé adverse.
- **gengar-disable** ✅ : Disable / Shadow-Ball / Sludge-Wave / Substitute.
- **hypno-encore** ✅ : Encore / Hypnosis / Psychic / Amnesia. (remplace `slowbro-encore` — **Slowbro n'apprend PAS Encore**). Apprend Encore ET Disable, Psy cohérent disrupteur.
- **mr-mime-encore** ✅ : Encore / Reflect / Psychic / Barrier. (remplace `persian-encore` — **Persian n'apprend ni Encore ni Disable**). Fragile mais perturbateur, speed-control.

> ⚠️ Porteurs **invalides** écartés (n'apprennent pas la move) : `slowbro-encore`, `persian-encore`. Autres porteurs Encore valides en réserve si besoin : machamp, victreebel, hypno, jynx, snorlax, clefable, golduck, primeape, poliwrath. Movesets exacts à re-valider légalité (moves implémentés) à l'exécution ; `game-designer` revalide avant commit.

### 8. Renderer

- **InfoPanel** : badges volatiles `Entrave {turns}t` et `Encore {turns}t` (mirror `Provoc {turns}t`). `VOLATILE_LABELS` étendu. Idéalement afficher le **nom de la move** concernée en tooltip/sous-texte (`v.moveId` → nom localisé) — nice-to-have, fallback badge simple.
- **MoveSelector / radial** :
  - move disabled → grisée + non-cliquable (mirror PP=0).
  - sous Encore → toutes les moves sauf l'encored grisées.
  - Réutiliser/étendre le helper de sélectabilité introduit plan 100 (`isMoveSelectable`).
- **MoveTooltip** : tags rouges `Bloqué par Entrave` / `Bloqué par Encore` (mirror `Bloqué par Provoc`).
- **BattleLogFormatter** : nouveaux cas
  - `MoveDisabled` → « {move} de {pokemon} est mise sous Entrave ! »
  - `MoveEncored` → « {pokemon} doit répéter {move} ! »
  - `DisableBlocked`/`EncoreBlocked` → « {pokemon} ne peut pas utiliser {move} ! »
  - `DisableFailed`/`EncoreFailed` → « Mais ça échoue ! »
  - `StatusRemoved` filtré Disabled/Encored → « {pokemon} n'est plus sous Entrave/Encore. »
- **Floating text** : `"Entrave!"` / `"Encore!"` (texte orange/rouge) sur la cible à l'application (orchestration `GameController`).

### 9. IA — scoring disruption

`action-scorer.ts` (extension du dispatch statut, mirror `scoreTauntApplication`) :

- **Disable** : valoriser si la cible a une move dominante (fort BP STAB OU move de soin/setup). Score haut si `target.lastUsedMoveId` est une menace ; bas si HP cible < 30 % (KO direct prioritaire). Échoue si pas de last move → score ≈ 0.
- **Encore** : valoriser si `target.lastUsedMoveId` est une move **statut/setup** ou peu menaçante (lock l'adversaire sur une action faible). Score bas/nul si la dernière move est une grosse attaque (l'encore l'enfermerait sur du dégât). Inverse logique de Disable.

Helpers dans `threat-detection.ts` (mirror plan 098/100) : `lastMoveIsThreat(target, moveRegistry)`, `lastMoveIsLowValue(target, moveRegistry)`.

> **Garde-fou IA** : ces deux moves échouent si la cible n'a pas encore agi (début de combat) → le scorer doit retourner ~0 quand `lastUsedMoveId === undefined`, sinon l'IA gaspille un tour. Couvert par test `scored-ai-smoke`.

### 10. i18n FR/EN

```ts
status: {
  disabled: { fr: "Entrave", en: "Disabled" },
  encored:  { fr: "Encore",  en: "Encore" },
},
infoPanel: { volatile: {
  disabled: { fr: "Entrave {turns}t", en: "Disable {turns}t" },
  encored:  { fr: "Encore {turns}t",  en: "Encore {turns}t" },
}},
battle: {
  disable: {
    applied: { fr: "{move} de {pokemon} est sous Entrave !", en: "{pokemon}'s {move} was disabled!" },
    blocked: { fr: "{pokemon} ne peut pas utiliser {move} (Entrave) !", en: "{pokemon} can't use {move} (disabled)!" },
    failed:  { fr: "Mais ça échoue !", en: "But it failed!" },
    expired: { fr: "{pokemon} n'est plus sous Entrave.", en: "{pokemon} is no longer disabled." },
  },
  encore: {
    applied: { fr: "{pokemon} doit répéter {move} !", en: "{pokemon} got an encore!" },
    blocked: { fr: "{pokemon} est forcé de répéter sa move !", en: "{pokemon} must use its encored move!" },
    failed:  { fr: "Mais ça échoue !", en: "But it failed!" },
    expired: { fr: "L'Encore de {pokemon} se dissipe.", en: "{pokemon}'s encore ended." },
  },
},
moveTooltip: { tag: {
  disableBlocked: { fr: "Bloqué par Entrave", en: "Blocked by Disable" },
  encoreBlocked:  { fr: "Bloqué par Encore",  en: "Blocked by Encore" },
}},
```

## Étapes d'exécution

1. **Core — état & types**
   - `PokemonInstance.lastUsedMoveId?`.
   - `VolatileStatus.moveId?`.
   - `StatusType.Disabled` + `StatusType.Encored` + `VOLATILE_STATUSES` + `getStatusDuration` (4 / 3).
   - `EffectKind.Disable` + `EffectKind.Encore`.
   - `BattleEventType` : `MoveDisabled`, `MoveEncored`, `DisableBlocked`, `EncoreBlocked`, `DisableFailed`, `EncoreFailed` + types union `battle-event.ts`.
2. **Core — pipeline**
   - Écrire `lastUsedMoveId` dans `executeUseMove` (complétion + charge T1).
   - `handle-disable.ts` + `handle-encore.ts` (avec check Substitute en tête, §3/§10).
   - Enregistrer les 2 handlers dans `effect-processor.ts`.
   - `getLegalActions` : filtres disabled/encored.
   - `executeUseMove` : gardes DisableBlocked/EncoreBlocked.
   - Généraliser tick : `timed-volatile-tick-handler.ts`, supprimer `taunt-tick-handler.ts`, re-câbler `registerEndTurn(…, 350)`.
   - `handleKo` : cleanup volatiles déjà générique (vérifier).
3. **Data**
   - `disable` + `encore` dans `tactical.ts`.
   - ~4 OP sets.
   - Vérifier import reference FR/EN.
4. **Renderer**
   - `VOLATILE_LABELS` (2 badges).
   - MoveSelector grisé (disabled + non-encored).
   - MoveTooltip 2 tags.
   - BattleLogFormatter (applied/blocked/failed/expired ×2).
   - Floating text orchestration.
5. **IA**
   - Helpers `threat-detection.ts`.
   - `action-scorer.ts` dispatch Disable/Encore.
6. **i18n** : clés FR/EN ci-dessus.
7. **Tests**
   - `encore-disable.integration.test.ts` (scénarios ci-dessous).
   - Unit : `handle-disable.test.ts`, `handle-encore.test.ts`, extension `action-scorer.test.ts`, adapter tests Taunt (renommage tick handler).
8. **Gate CI** : `pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration`. Cible ≈ +20 tests.

## Tests intégration (scénarios)

**Disable**
1. Application + durée 4 tours : appliqué T1, expire T5 (StatusRemoved).
2. Blocage move disabled : cible utilise la move disabled → `DisableBlocked` + ActionError ; autres moves OK.
3. `getLegalActions` : la move disabled absente du retour ; mobilité conservée.
4. Échec si pas de last move : Disable sur cible n'ayant pas agi → `DisableFailed`.
5. Échec si déjà disabled : 2e Disable → `DisableFailed`.

**Encore**
6. Substitute bloque Encore/Disable : cible sous Substitute + source ≠ cible → emit `SubstituteBlocked` (canon, comme Taunt), aucun volatile ajouté. Cible sans sub → application normale.
7. Application + durée 3 tours : verrouillée sur last move, seules actions = move encored + Move/EndTurn.
8. `getLegalActions` sous Encore : retour = uniquement la move encored.
9. Fin anticipée PP 0 : move encored épuisée → encore levé au tick (StatusRemoved), toutes moves redeviennent jouables.
10. Échec si pas de last move / move = encore.

**Croisé / régression**
11. Taunt non régressé : durée 3, decrement/expire identiques (tick généralisé).
12. KO clear : cible disabled/encored KO → volatiles nettoyés.
13. Encore + Disable sur la même move (anti-stun-lock) : move encored aussi disabled → injouable → fallback all-moves actif (l'encore ne soft-lock pas l'unité ; au moins Move/EndTurn + autres moves dispo). Vérifie le fallback documenté §3/§4.

## Risques / pièges

- **Régression tick Taunt** : la généralisation doit conserver l'ordre/priorité (350) et le decrement. Couvrir test #11 + faire tourner toute la suite Taunt.
- **`lastUsedMoveId` timing** : ne doit PAS être écrit sur move bloquée/échouée. Vérifier les `return` précoces de `executeUseMove`.
- **Substitute × EffectKind dédié** : l'absorption sub n'est pas automatique hors `handle-status` → check explicite en tête de handler, sinon Disable/Encore traverseraient le sub (non canon). Test #6 obligatoire.
- **Encore + move 0 PP au moment du choix** : double garde (filtre PP existant + tick early-end). Vérifier qu'on ne soft-lock pas l'unité (toujours Move/EndTurn dispo).
- **IA gaspillage début de combat** : score ~0 si `lastUsedMoveId` undefined.
- **Double-Disable alterné** (2 porteurs, ex. alakazam + gengar) : non bloqué par la mécanique (casts indépendants), mais durée 4t > cooldown réaliste → Disable quasi-permanent possible. Acceptable en combat CT court ; surveiller en test IA, ne pas corriger sauf abus avéré.
- **UI cohérence** : grisé encore = tout sauf 1 move ; visuellement distinct du grisé Taunt (tout-statut). Tester sandbox post-impl.

## Validation post-impl

- Tests intégration verts (13 scénarios).
- Sandbox : Disable sur Alakazam IA → la move ciblée disparaît de ses choix 4 tours. Encore sur un setter → l'IA répète la même move 3 tours puis se libère.
- InfoPanel : `Entrave 4t`→`1t`, `Encore 3t`→`1t`, disparition.
- MoveSelector grisé correct (1 move pour Disable, N-1 pour Encore).
- Battle log lisible FR + EN (applied/blocked/failed/expired).
