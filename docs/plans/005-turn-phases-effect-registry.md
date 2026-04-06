---
status: done
created: 2026-03-21
updated: 2026-03-21
---

# Plan 005 — Refactor : phases de tour + effect handler registry

## Objectif

Restructurer le BattleEngine pour supporter un cycle de tour en phases explicites et un système d'effets extensible par registry. Aucune nouvelle mécanique — uniquement du refactor. Les 172 tests existants doivent passer à l'identique.

## Pourquoi maintenant

Le code actuel a deux points de rigidité qui bloqueront l'ajout de mécaniques :

1. **Effect processing = switch case fermé** : ajouter un nouvel effet (Heal, Recoil, Flinch, Protect...) oblige à modifier le type `Effect`, l'enum `EffectKind`, et le switch dans `effect-processor.ts`. Ça ne scale pas.
2. **Pas de phases de tour** : dans Pokemon, un tour a un ordre précis (status ticks → action → residuals). Tout est codé en dur dans `advanceTurn` / `executeUseMove` sans structure.
3. **Ordre des tours figé** : le `TurnManager` calcule l'ordre une seule fois. La paralysie (-50% vitesse) et les stat stages Speed n'ont aucun effet.

Ce refactor pose les fondations pour que le Plan 006 (mécaniques de combat) et toute la Phase 1+ s'appuient sur une architecture extensible.

## Principes de design

Inspiré de Pokemon Showdown (pattern event hooks) adapté à notre contexte :

- **Effect handlers enregistrés** : chaque type d'effet est un handler dans une registry. Ajouter un effet = enregistrer un handler, sans toucher au moteur.
- **Phases de tour explicites** : `StartTurn → Action → EndTurn`. Chaque phase peut avoir des handlers enregistrés (residuals, status ticks, etc.).
- **Residuals** : les effets de fin/début de tour (burn, poison, drain) sont des handlers enregistrés avec une priorité et traités dans l'ordre de vitesse effective des Pokemon.
- **Initiative dynamique** : recalculée à chaque round en tenant compte des stat stages et statuts.

## Étapes

### Étape 1 — Effect handler registry

**Remplacer le switch case par une registry pluggable.**

**Nouveau fichier** : `packages/core/src/battle/effect-handler-registry.ts`

```ts
interface EffectContext {
  attacker: PokemonInstance;
  targets: PokemonInstance[];
  move: MoveDefinition;
  effect: Effect;
  state: BattleState;
  typeChart: TypeChart;
  attackerTypes: PokemonType[];
  targetTypesMap: Map<string, PokemonType[]>;
}

type EffectHandler = (context: EffectContext) => BattleEvent[];

class EffectHandlerRegistry {
  private handlers: Map<EffectKind, EffectHandler>;

  register(kind: EffectKind, handler: EffectHandler): void;
  process(context: EffectContext): BattleEvent[];
}
```

**Modifier** `effect-processor.ts` :
- Supprimer le switch case
- `processEffects` prend la registry en paramètre (ou la registry est injectée dans le BattleEngine)
- Itère sur `move.effects`, appelle `registry.process(context)` pour chaque effet
- Les 4 handlers existants (damage, status, statChange, link) sont enregistrés comme handlers dans la registry

**Enregistrement des handlers par défaut** :
```ts
function createDefaultRegistry(): EffectHandlerRegistry {
  const registry = new EffectHandlerRegistry();
  registry.register(EffectKind.Damage, handleDamage);
  registry.register(EffectKind.Status, handleStatus);
  registry.register(EffectKind.StatChange, handleStatChange);
  registry.register(EffectKind.Link, handleLink);
  return registry;
}
```

Les fonctions `handleDamage`, `handleStatus`, etc. sont les mêmes `processDamage`, `processStatus`, etc. actuelles, juste extraites et adaptées à la signature `EffectHandler`.

**Impact sur les tests** : aucun changement de comportement. Les tests existants de `effect-processor.test.ts` doivent passer tels quels (sauf ajustement de l'API si nécessaire).

**Tests nouveaux** :
- Registry sans handler pour un kind → erreur explicite ou skip silencieux (à décider)
- Registry avec handler custom → le handler est appelé
- Ordre des effets respecté (même que l'ordre dans `move.effects[]`)

### Étape 2 — Turn phase enum + cycle de phases

**Nouveau fichier** : `packages/core/src/enums/turn-phase.ts`

```ts
const TurnPhase = {
  StartTurn: "start_turn",
  Action: "action",
  EndTurn: "end_turn",
} as const;
```

**Nouveau fichier** : `packages/core/src/battle/turn-pipeline.ts`

```ts
type PhaseHandler = (pokemonId: string, state: BattleState) => PhaseResult;

interface PhaseResult {
  events: BattleEvent[];
  skipAction: boolean;      // si true, le Pokemon ne peut pas agir (sleep, freeze)
  restrictActions: boolean;  // si true, filtrer certaines actions (paralysis proc)
  pokemonFainted: boolean;
}

class TurnPipeline {
  private startTurnHandlers: PhaseHandler[];
  private endTurnHandlers: PhaseHandler[];

  registerStartTurn(handler: PhaseHandler, priority: number): void;
  registerEndTurn(handler: PhaseHandler, priority: number): void;

  executeStartTurn(pokemonId: string, state: BattleState): PhaseResult;
  executeEndTurn(pokemonId: string, state: BattleState): PhaseResult;
}
```

Les handlers sont exécutés par priorité (plus petit = premier). Pour le POC, les priorités sont fixées dans le code. Plus tard, elles pourront être dynamiques (abilities qui modifient l'ordre).

**Pour le moment** : le TurnPipeline est créé vide. Aucun handler n'est enregistré (les mécaniques viendront au Plan 006). Le BattleEngine l'appelle mais il ne fait rien — les tests existants passent toujours.

**Intégration dans BattleEngine** :
- Le constructeur crée un `TurnPipeline`
- `advanceTurn` appelle `pipeline.executeStartTurn()` après `TurnStarted`
- Les méthodes `execute*` appellent `pipeline.executeEndTurn()` avant de passer au tour suivant
- Le résultat de `executeStartTurn` détermine si le Pokemon peut agir (`skipAction`, `restrictActions`)

**Tests** :
- TurnPipeline sans handlers → résultat neutre (tout autorisé, pas de faint)
- TurnPipeline avec un handler StartTurn → exécuté au bon moment
- Handlers exécutés dans l'ordre de priorité
- PhaseResult propagé correctement au BattleEngine

### Étape 3 — Initiative dynamique + recalcul

**Nouveau fichier** : `packages/core/src/battle/initiative-calculator.ts`

```ts
function getEffectiveInitiative(pokemon: PokemonInstance): number
```

- Part de `pokemon.derivedStats.initiative`
- Applique le stat stage multiplier de Speed : `getStatMultiplier(pokemon.statStages[StatName.Speed])`
- Applique le malus paralysie : ×0.5 si `statusEffects` contient `StatusType.Paralyzed`
- Retourne `Math.floor(résultat)`

**Modifier `TurnManager`** :
- Ajouter `recalculateOrder(pokemon: PokemonInstance[], getInitiative: (p: PokemonInstance) => number): void`
- Re-trie `turnOrder` par initiative effective décroissante, tie-breaker par `id`
- Le constructeur accepte `getInitiative` en paramètre optionnel avec valeur par défaut `(p) => p.derivedStats.initiative` — les tests existants ne cassent pas

**Modifier `BattleEngine.advanceTurn`** :
- Quand `isRoundComplete()`, appeler `turnManager.recalculateOrder(alivePokemon, getEffectiveInitiative)` avant `startNewRound()`

**Tests** :
- `getEffectiveInitiative` : base, avec paralysie (-50%), avec stat stages, cumulés
- `recalculateOrder` : re-trie correctement
- Round complet → nouvel ordre reflète les changements d'initiative
- Tie-breaker stable par id

### Étape 4 — Refactor BattleEngine : endCurrentTurn + boucle while

**Modifier `BattleEngine.ts`** pour utiliser les nouvelles structures :

**Extraire `endCurrentTurn(pokemonId)`** :
1. Appelle `turnPipeline.executeEndTurn(pokemonId, state)` (vide pour l'instant)
2. Appelle `advanceTurn()`

**Modifier `advanceTurn`** :
```
advanceTurn:
  1. turnManager.advance()
  2. Si round complet → recalculateOrder + startNewRound + roundNumber++
  3. syncTurnState
  4. while (true):
     a. Émet TurnStarted
     b. startTurnResult = turnPipeline.executeStartTurn(currentPokemon)
     c. Si pokemonFainted → handleKo (à implémenter en Plan 006), continue
     d. Si skipAction → émet TurnEnded, continue
     e. Si restrictActions → stocker le flag pour getLegalActions, break
     f. Sinon → break (tour normal)
     g. Garde-fou : compteur d'itérations. Si > nombre total de Pokemon dans le combat → throw Error (cas impossible en pratique, mais protège d'une boucle infinie si tous les Pokemon sont skip)
```

**Modifier les 3 méthodes `execute*`** pour appeler `endCurrentTurn` au lieu de `advanceTurn` directement.

**Ajouter le stub `handleKo`** (appelé mais la logique complète viendra au Plan 006) :
- Pour l'instant : ne fait rien (le pipeline ne retourne jamais `pokemonFainted: true` sans handlers)

**Tests** :
- Le cycle de tour reste identique (pas de handlers enregistrés = comportement actuel)
- `endCurrentTurn` appelle les phases dans le bon ordre
- La boucle while fonctionne (test avec un handler mock qui skip un tour)
- Tous les 172 tests existants passent

### Étape 5 — Corrections de données

**Modifier `ActiveLink`** (`packages/core/src/types/active-link.ts`) :
- `remainingTurns: number` → `remainingTurns: number | null` (null = permanent)

**Modifier `leech-seed`** dans `tactical.ts` :
- `duration: 3` → `duration: null` (permanent, comme Pokemon)

**Modifier `processLink`** dans `effect-processor.ts` (maintenant dans le handler Link) :
- Supporter `duration: null` → pas de countdown

**Modifier le type `Effect` Link variant** :
- `duration: number` → `duration: number | null`

**Impact sur les tests existants** : les tests de `processLink` et `effect-processor` qui créent des `ActiveLink` avec `remainingTurns: number` devront être mis à jour pour supporter `number | null`. Vérifier aussi `mock-battle.ts` si des liens y sont construits.

**Tests** :
- Lien avec duration null → pas de countdown
- Lien avec duration 3 → countdown (pour de futurs liens à durée)
- Tests existants des links adaptés au nouveau type

### Étape 6 — Vérification + nettoyage

- Tous les 172 tests passent
- 100% coverage maintenu
- Pas de changement de comportement observable
- Le switch case dans `effect-processor.ts` n'existe plus
- Le `TurnManager` supporte le recalcul dynamique
- Le `BattleEngine` a un cycle de phases explicite
- La registry est prête à recevoir de nouveaux handlers

## Critères de complétion

- `EffectHandlerRegistry` remplace le switch case — 4 handlers enregistrés
- `TurnPipeline` en place avec `executeStartTurn` / `executeEndTurn`
- `getEffectiveInitiative` calcule correctement avec stat stages et paralysie
- `TurnManager.recalculateOrder` appelé à chaque nouveau round
- `endCurrentTurn` centralise la fin de tour
- Boucle while dans `advanceTurn` prête (fonctionne avec des handlers mock)
- `ActiveLink.remainingTurns` supporte `null` (permanent)
- Leech Seed permanent dans les données
- **Aucun changement de comportement** — les 172 tests passent
- 100% coverage maintenu

## Extensions futures (hors scope de ce plan)

Ce plan pose les fondations. Les extensions suivantes s'appuieront dessus naturellement :

- **Damage modifiers** : actuellement la brûlure (-50% dégâts physiques) est codée en dur dans `damage-calculator.ts`. En Phase 2+, quand on ajoutera Rain/Terrain/Items, on créera un `DamageModifierPipeline` (chaîne de callbacks qui modifient le damage comme Showdown's `runEvent("ModifyDamage")`). Le handler Burn sera migré dedans. Pour le POC, le check en dur suffit.
- **TryMove interceptors** : hooks qui bloquent un move avant exécution (Disable, Taunt, Encore...). Même pattern que les phase handlers.
- **Residuals ordonnés par vitesse** : dans Pokemon, les effets de fin de tour s'exécutent dans l'ordre de vitesse des Pokemon porteurs. Le `TurnPipeline` actuel exécute par priorité statique. L'ordonnancement par vitesse viendra quand on aura besoin de cet ordre (Phase 1+).

Design inspiré de [Pokemon Showdown](https://github.com/smogon/pokemon-showdown) (pattern event hooks), simplifié pour notre contexte TypeScript strict.

## Risques

- **Refactor sans changement de comportement** : le risque principal est de casser les tests existants. Procéder étape par étape, valider les tests après chaque étape.
- **Sur-ingénierie** : le TurnPipeline et la registry sont simples volontairement. Pas de système de middleware complexe, pas de DSL. Juste des Maps et des tableaux triés.
- **Signature du BattleEngine** : le constructeur pourrait changer (ajout de la registry). Vérifier que tous les tests et mocks sont mis à jour.

## Dépendances

- **Avant ce plan** : Plan 004 (code existant à refactorer)
- **Ce plan débloque** : Plan 006 (mécaniques de combat — status ticks, drain, KO, victoire)
