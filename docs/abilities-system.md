# Système de Talents (Abilities)

> Documentation de référence pour ajouter, modifier ou tester un talent.
> À lire avant de toucher à `packages/data/src/abilities/` ou aux hooks d'ability dans le core.

## Architecture

### Vue d'ensemble

- **Source de vérité du nom + description** : `packages/data/reference/abilities.json` (Showdown, regenéré via `pnpm data:update`)
- **Code des handlers** : `packages/data/src/abilities/ability-definitions.ts` (un objet par talent)
- **Fusion automatique** : `packages/data/src/loaders/load-abilities.ts` injecte le nom/description depuis Showdown dans le handler
- **Registry runtime** : `packages/core/src/battle/ability-handler-registry.ts` (`AbilityHandlerRegistry`)
- **Types et hooks** : `packages/core/src/types/ability-definition.ts`

### Schéma `AbilityHandler` (côté code, sans nom/desc)

```ts
interface AbilityHandler {
  id: string;  // kebab-case (ex: "early-bird")

  // Hooks "blocants" : retournent { blocked, events }
  // L'ability est responsable d'émettre AbilityActivated quand elle bloque réellement.
  onStatusBlocked?: (ctx: StatusBlockContext) => BlockResult;
  onStatChangeBlocked?: (ctx: StatChangeBlockContext) => BlockResult;
  onTypeImmunity?: (ctx: TypeImmunityContext) => BlockResult;

  // Hook modifieur de durée : retourne { duration, events }
  onStatusDurationModify?: (ctx: StatusDurationContext) => DurationModifyResult;

  // Hook multiplier de dégâts : retourne un number (silencieux par convention)
  onDamageModify?: (ctx: DamageModifyContext) => number;

  // Hooks "réactifs" : retournent BattleEvent[]
  onAfterDamageReceived?: (ctx: AfterDamageContext) => BattleEvent[];
  onAfterStatusReceived?: (ctx: AfterStatusContext) => BattleEvent[];
  onBattleStart?: (ctx: BattleStartContext) => BattleEvent[];
  onAuraCheck?: (ctx: AuraCheckContext) => BattleEvent[];
}
```

### Pattern d'émission de `AbilityActivated`

**Inspiré de Pokemon Showdown** : chaque ability émet ses propres événements depuis ses hooks. Le call-site agrège, ne décide pas.

| Type de hook | Émission |
|---|---|
| **Blocant** (`onStatusBlocked`, `onStatChangeBlocked`, `onTypeImmunity`) | Émettre `AbilityActivated` **dans** `events` quand `blocked === true` (ne pas émettre quand `blocked === false`) |
| **Modifieur de durée** (`onStatusDurationModify`) | Émettre quand la valeur change réellement (ex: ne pas émettre si `Math.ceil(1/2) === 1`) |
| **Multiplier dégâts** (`onDamageModify`) | **Silencieux** par convention. La visibilité passe par `onAfterDamageReceived` (côté receveur) ou `onAfterStatusReceived` (Cran), avec un flag de premier déclenchement si nécessaire |
| **Réactif actif** (`onAfterDamageReceived`, `onAuraCheck`, etc.) | Retourner les events directement |

### Anti-spam : flag `abilityFirstTriggered`

Pour les talents qui se déclenchent à chaque dégât (Engrais, Brasier, Torrent), on émet **uniquement à la première traversée du seuil** (ex: HP qui passe sous 1/3). Le flag `pokemonInstance.abilityFirstTriggered: boolean` mémorise l'état. Réinitialisé si la condition redevient fausse.

Helper dans `ability-definitions.ts` :
```ts
function checkPinchThresholdCross(
  pokemon: PokemonInstance,
  abilityId: string,
): BattleEvent[] {
  const ratio = pokemon.currentHp / pokemon.maxHp;
  if (ratio > PINCH_THRESHOLD) {
    pokemon.abilityFirstTriggered = false;
    return [];
  }
  if (pokemon.abilityFirstTriggered) {
    return [];
  }
  pokemon.abilityFirstTriggered = true;
  return [{ type: BattleEventType.AbilityActivated, pokemonId: pokemon.id, abilityId, targetIds: [pokemon.id] }];
}
```

Branché sur `onAfterDamageReceived` (déclenchement par dégâts) **et** `onBattleStart` (cas où le Pokemon démarre déjà sous le seuil — ex: sandbox).

### Aura permanente (`onAuraCheck`)

Pour les talents qui imposent un effet de proximité (Intimidation, Magnépiège), `onAuraCheck` est appelé :
- Au démarrage du combat (`triggerBattleStart`)
- Après chaque action (`emitPositionLinkedChecks` dans `BattleEngine`)

Le retrait de l'effet quand la source s'éloigne est géré par `position-linked-statuses.ts` (`checkPositionLinkedStatuses`).

Pour Intimidation, le statut volatile `Intimidated` mémorise `statChangeApplied: boolean` — true si le -1 Atk a réellement été appliqué (pas plafonné à -6). Lors du retrait, on ne ré-up Atk que si applied (pas de buff fantôme).

### Position-linked statuses

Les statuts `Intimidated`, `Infatuated`, `Trapped` (avec `remainingTurns === -1`) ont un `sourceId`. Ils sont retirés quand la source meurt ou s'éloigne (Chebyshev > 1). `checkPositionLinkedStatuses` est appelé après chaque action, mouvement annulé, ou mouvement de confusion.

## Branchements (call sites)

| Hook | Call site |
|---|---|
| `onDamageModify` | `damage-calculator.ts` (attacker + defender) |
| `onAfterDamageReceived` | `handle-damage.ts` (après application des dégâts) |
| `onAfterStatusReceived` | `handle-status.ts` (après application d'un statut majeur) |
| `onStatusBlocked` | `handle-status.ts` (avant application) |
| `onStatusDurationModify` | `handle-status.ts` (sur volatile et major) |
| `onStatChangeBlocked` | `handle-stat-change.ts` (avant application) |
| `onTypeImmunity` | `effect-processor.ts` (avant tout effet) |
| `onBattleStart` | `BattleEngine.triggerBattleStart()` |
| `onAuraCheck` | `BattleEngine.triggerBattleStart()` + `emitPositionLinkedChecks` |

## Sandbox

Pour les statuts pré-appliqués via la config sandbox (`SandboxSetup.applyConfigToInstance`), la durée passe par `ability.onStatusDurationModify` afin que Matinal et autres durées soient honorés. Sinon le sandbox bypassait le pipeline normal.

## Lévitation et terrains

Une ability peut rendre un Pokemon "effectivement volant" pour les terrains. Implémenté via `BattleEngine.isEffectivelyFlying(pokemon)` qui vérifie `abilityId === "levitate"` ou type Flying. Tous les helpers de `terrain-effects.ts` acceptent un paramètre `isFlying = false` :
- `isTerrainImmune(terrain, types, isFlying)`
- `getImmuneTerrains(types, isFlying)`
- `getMovementPenalty(terrain, types, isFlying)`
- `getTerrainTypeBonusFactor(terrain, moveType, attackerTypes, isFlying)`
- `getTerrainStatusOnStop(terrain, types, isFlying)`

Si `isFlying` est `true`, le Pokemon est immune à tous les effets de terrain. **Mais** `canStopOn` n'autorise pas un Flying à atterrir sur lava/deep water (par design — il faut une tile solide).

## Comment ajouter un talent

1. **Vérifier que l'ID existe dans Showdown** : ouvrir `packages/data/reference/abilities.json` et chercher l'`id` (kebab-case)
2. **Écrire le handler** dans `packages/data/src/abilities/ability-definitions.ts` :
   - Définir un `AbilityHandler` avec les hooks nécessaires
   - Pour les hooks de blocage/durée : retourner `{ blocked/duration, events }`
   - Pour les multiplicateurs passifs : émettre via un hook réactif
3. **L'ajouter au tableau `abilityHandlers`** en bas du fichier
4. **L'attacher à un Pokemon** dans `packages/data/src/roster/roster-poc.ts` (`abilityId: "..."`)
5. **Écrire les tests d'intégration** dans `packages/core/src/battle/abilities.integration.test.ts` :
   - Effet gameplay (le multiplier/blocage est appliqué)
   - Émission `AbilityActivated` (le visuel se déclenche)
6. **Vérifier le visuel** : floating text via `GameController.handleEvent` (déjà branché pour tous les `AbilityActivated`)
7. **Vérifier le battle log** : `BattleLogFormatter.ts` formate déjà tous les `AbilityActivated` en "X de Pokemon s'active !" — pas de modif sauf cas spéciaux

## Format des messages utilisateur

- **Floating text** : `"NomDuTalent !"` (court, animation au-dessus du Pokemon)
- **Battle log** : `"NomDuTalent de NomDuPokemon s'active !"` (FR) / `"Pokemon's Ability activated!"` (EN)

Les noms (FR/EN) viennent de `abilities.json` (Showdown), pas hardcodés.

## Précisions VGC pour les talents existants

| Talent | Mécanique exacte |
|---|---|
| **Cran (Guts)** | ×1.5 sur l'Attaque effective quand statut majeur. **Pas de stat boost visible** (pas de "Attack rose!"). Ignore aussi le -50% de la brûlure. |
| **Engrais/Brasier/Torrent** | ×1.5 sur les dégâts du type concerné quand HP ≤ 1/3 |
| **Adaptabilité** | STAB ×2.0 au lieu de ×1.5 (silencieux — pas de visuel) |
| **Technicien** | ×1.5 sur les moves de puissance ≤ 60 (silencieux — pas de visuel) |
| **Joli Sourire (Cute Charm)** | 30% Charmé sur attaquant en contact (genres requis officiellement, **stub temporaire** : tout Pokemon = cible valide jusqu'à l'implémentation des genres) |
| **Charmé (Infatuation)** | 50% chance de ne pas pouvoir attaquer chaque tour. Permanent tant que la source est sur le terrain (**pas de compteur de tours**, retiré quand la source faint). |
| **Intimidation** | -1 Atk + statut volatile en aura permanente (1 case Chebyshev). Notre design diverge de VGC où c'est un one-shot à l'entrée — chez nous c'est permanent tant que Caninos est adjacent. |
| **Matinal (Early Bird)** | Sommeil halve : `Math.ceil(duration / 2)`. Sample Champions [2,3,3] → [1,2,2] avec Early Bird. **Émission au réveil** (pas à l'application) — `StatusEffect.shortenedByAbilityId` mémorise l'ability qui a halve, le tick handler émet `AbilityActivated` quand `remainingTurns === 0`. |

## Tests d'intégration existants

Voir `packages/core/src/battle/abilities.integration.test.ts`. Couverture par talent :

| Talent | Tests gameplay | Test émission `AbilityActivated` |
|---|---|---|
| Engrais | Boost ×1.5 sur Razor Leaf à HP bas | Première traversée du seuil 1/3 + battle start si déjà sous |
| Brasier | Boost ×1.5 sur Ember à HP bas | (couvert par helper `checkPinchThresholdCross`) |
| Torrent | Boost ×1.5 sur Water Gun à HP bas | (idem) |
| Regard Vif | Bloque baisse Accuracy par Kinesis | (couvert par hook `onStatChangeBlocked`) |
| Statik | Paralyse 30% au contact | ✅ |
| Cran | Boost ×1.5 brûlé + ignore burn -50% | Émission quand statut majeur reçu |
| Synchro | Reflète brûlure/poison/paralysie sur la source | ✅ |
| Lévitation | Immunité Sol | Émission au blocage Earthquake |
| Fermeté | Survit OHKO à plein PV | Émission dans `handle-damage` |
| Intimidation | -1 Atk à l'arrivée + retrait quand source s'éloigne + cap -6 sans rebound | ✅ |
| Joli Sourire | Charmé 30% au contact | ✅ |
| Isograisse | -50% dégâts Feu/Glace | (couverte par `onDamageModify`, hook `onAfterDamageReceived` pour le visuel) |
| Adaptabilité | STAB ×2.0 | (silencieux, pas de test d'émission) |
| Corps Sain | Bloque -Atk par Growl | Émission au blocage |
| Point Poison | Empoisonne 30% au contact | ✅ |
| Technicien | ×1.5 sur moves ≤60 puissance | (silencieux, pas de test d'émission) |
| Magnépiège | Trap Steel à l'arrivée | ✅ |
| Voile Sable | (dormant — Phase 9 météo) | smoke test no-crash |
| Tempo Perso | Bloque Confusion + Intimidation | Émission via blocage Intimidate aura |
| Matinal | Halve durée sommeil (ceil) | Émission `early-bird` |

## Talents non visibles (par design)

- **Adaptabilité, Technicien** : multiplicateurs always-on. Silencieux par design — pas de message in-battle (cohérent avec Showdown).
- **Isograisse** : émet quand dégâts Feu/Glace effectivement reçus.

## Buffer des events au démarrage

Les events `onBattleStart` et `onAuraCheck` sont émis dans le **constructeur** de `BattleEngine`, **avant** que le renderer ait branché ses listeners ou créé ses sprites. Ils sont bufférisés dans `BattleEngine.startupEvents` puis drainés via `consumeStartupEvents()` après l'initialisation des sprites (appelé par `controller.processStartupEvents()` dans `BattleScene`). Sinon les floating texts (Engrais qui démarre sous 1/3, Intimidation aura au spawn) seraient perdus.

## Documentation Showdown

Pour vérifier la mécanique exacte d'un talent :
- `packages/data/reference/abilities.json` : nom + description Showdown
- Bulbapedia : pages des talents (mécanique détaillée Gen 9)
- Pokemon Showdown source : `data/abilities.ts` (référence implémentation)
