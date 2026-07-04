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
  // StatusBlockContext expose weather: Weather (ajouté plan 138 pour Feuille Garde)
  onStatusBlocked?: (ctx: StatusBlockContext) => BlockResult;
  onStatChangeBlocked?: (ctx: StatChangeBlockContext) => BlockResult;
  onTypeImmunity?: (ctx: TypeImmunityContext) => BlockResult;
  // Nouveau plan 138 : gate d'immunité de move (avant tout effet) — requis pour Anti-Bruit (sonore) et Envelocape (poudre)
  onMoveImmunity?: (ctx: MoveImmunityContext) => BlockResult;

  // Hook modifieur de durée : retourne { duration, events }
  onStatusDurationModify?: (ctx: StatusDurationContext) => DurationModifyResult;

  // Hook multiplier de dégâts : retourne un number (silencieux par convention)
  // DamageModifyContext expose isCrit: boolean (ajouté plan 136 pour Sniper)
  // DamageModifyContext expose weather: Weather (ajouté plan 138 pour Force Soleil/Peau Sèche/Force Sable)
  // DamageModifyContext expose targetAlreadyActed: boolean (ajouté plan 138 pour Analyste)
  onDamageModify?: (ctx: DamageModifyContext) => number;

  // Hooks "réactifs" : retournent BattleEvent[]
  // AfterDamageContext expose isCrit: boolean (ajouté plan 136 pour Colérique)
  onAfterDamageReceived?: (ctx: AfterDamageContext) => BattleEvent[];
  onAfterStatusReceived?: (ctx: AfterStatusContext) => BattleEvent[];
  // StatLoweredContext { self, stat, stages, source } — ajouté plan 136 pour Acharné/Battant
  onAfterStatLowered?: (ctx: StatLoweredContext) => BattleEvent[];
  // AbilityEndTurnContext expose random: () => number (pour Mue 33%) et weather: Weather
  // (météo effective via getEffectiveWeather — honore Ciel Gris) — ajouté plan 137
  onEndTurn?: (ctx: AbilityEndTurnContext) => BattleEvent[];
  onBattleStart?: (ctx: BattleStartContext) => BattleEvent[];
  onAuraCheck?: (ctx: AuraCheckContext) => BattleEvent[];
  // Hook flinch — ajouté plan 137 pour Impassible (steadfast)
  // AbilityFlinchContext { self, state } — invoqué dans processFlinch après pose de flinchedThisTurn
  // NOTE : le flinch EST câblé dans le core (StatusType.Flinch) — le stub inner-focus
  // ("pas de mécanique flinch") est désormais obsolète.
  onFlinch?: (ctx: AbilityFlinchContext) => BattleEvent[];

  // Nouveaux hooks plan 138
  // Modificateur de précision côté ability attaquante (retourne un multiplicateur)
  // Ajouté pour Agitation (×0.8 sur moves physiques). Câblé dans accuracy-check.ts en parallèle du hook objet.
  onAccuracyModify?: (ctx: AccuracyModifyContext) => number;
  // Modificateur d'évasion côté ability défensive (retourne un multiplicateur appliqué sur la précision entrante)
  // Ajouté pour Pieds Confus (×0.5 si confus) et Peau Miracle (×0.5 si move statut entrant).
  // Câblé dans accuracy-check.ts côté défenseur, multiplicatif avec les hooks objet.
  onEvasionModify?: (ctx: EvasionModifyContext) => number;
  // Hook drain côté défenseur drainé — retourne { redirect: boolean; events }
  // Si redirect=true, l'attaquant subit lastDamageDealt × fraction au lieu de soigner.
  // Ajouté pour Suintement (liquid-ooze). Câblé dans handle-drain.ts.
  onDrainAttempt?: (ctx: DrainAttemptContext) => DrainRedirectResult;

  // Champ déclaratif plan 138 : bonus de vitesse CT quand statut majeur
  // Miroir de weatherSpeedBoost. Câblé dans initiative-calculator.ts.
  statusSpeedBoost?: { multiplier: number };
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

## Suppression de talent (Brise Moule)

### Principe

Brise Moule (`mold-breaker`) est un talent **relationnel** : pendant l'attaque du porteur, les talents `breakable` de la **cible** sont ignorés. La suppression ne s'applique qu'au moment de l'exécution de l'attaque (pas en dehors du tour du porteur).

### Mécanisme : `resolveDefensiveAbility`

Module `packages/core/src/battle/ability-suppression.ts` :

```ts
export function resolveDefensiveAbility(
  registry: AbilityHandlerRegistry | undefined,
  target: PokemonInstance,
  attacker: PokemonInstance,
): AbilityDefinition | undefined {
  const ability = registry?.getForPokemon(target);
  if (!ability) return undefined;
  if (attacker.abilityId === "mold-breaker" && ability.breakable) return undefined;
  return ability;
}
```

Tous les **sites défensifs** (lecture du talent de la cible pendant l'attaque) utilisent ce helper au lieu d'appeler directement `registry.getForPokemon(target)`. Miroir du pattern `scrappy` (id-check sans wrapper global).

### Flag `breakable`

Champ `breakable?: boolean` ajouté à `AbilityHandler`/`AbilityDefinition`. Injecté par `load-abilities.ts` depuis `packages/data/reference/abilities.json` (champ `entry.flags.breakable`). 80 talents sont `breakable: true` dans la référence Showdown (Lévitation, Fermeté, Isograisse, Écran Poudre, Filtre, Multiécaille, Corps Sain, Vaccin, Voile Sable, Pieds Confus…).

### Sites migrés (9)

| Site | Talents cassables couverts |
|------|---------------------------|
| `effect-processor.ts` `onMoveImmunity` | Anti-Bruit, Envelocape |
| `effect-processor.ts` `onTypeImmunity` | Lévitation, Absorbe-Eau/Volt, Torche, Peau Sèche (Eau), Paratonnerre |
| `effect-processor.ts` shield-dust filtre secondaires | Écran Poudre (décision #554) |
| `damage-calculator.ts` `defenderAbility` | Isograisse, Filtre, Multiécaille, Écaille Spéciale, Peau Sèche (Feu), Armurbaston/Coque Armure (crit) |
| `handle-damage.ts` `targetAbility` | Fermeté, Multiécaille (survie à un coup fatal à 1 PV) |
| `battle/ohko.ts` `ohkoImmunityReason` | Fermeté — immunité totale face aux moves `isOhko` (Abîme/Guillotine/Empal'Korne/Glaciation), site distinct du précédent (plan 148, décision #609) |
| `handle-status.ts` `targetAbility` | Vaccin, Échauffement, Ignifu-Voile, Esprit Vital, Insomnia, Feuille Garde, Benêt |
| `handle-stat-change.ts` `onStatChangeBlocked` | Corps Sain, Regard Vif, Hyper Cutter, Cœur de Coq, Tempo Perso |
| `accuracy-check.ts` `onEvasionModify` déf + weatherEvasionBoost | Voile Sable, Rideau Neige, Pieds Confus, Peau Miracle |

### Non-cassables (par design)

Les talents réactifs `breakable: false` continuent de se déclencher même quand Brise Moule est actif : Statik, Corps Ardent, Synchro, Boom Final. Canonique : Mold Breaker n'empêche que les talents qui gênent l'exécution du move, pas les ripostes au contact.

### Silencieux

Brise Moule ne génère aucun `AbilityActivated`. Cohérent avec Querelleur et Infiltration. Décision #555.

## Branchements (call sites)

| Hook | Call site |
|---|---|
| `onDamageModify` | `damage-calculator.ts` (attacker + defender) — contexte enrichi plan 138 : `weather: Weather` + `targetAlreadyActed: boolean` |
| `onAfterDamageReceived` | `handle-damage.ts` (après application des dégâts) |
| `onAfterStatusReceived` | `handle-status.ts` (après application d'un statut majeur) |
| `onStatusBlocked` | `handle-status.ts` (avant application) — contexte enrichi plan 138 : `weather: Weather` |
| `onStatusDurationModify` | `handle-status.ts` (sur volatile et major) |
| `onStatChangeBlocked` | `handle-stat-change.ts` (avant application) |
| `onAfterStatLowered` | `handle-stat-change.ts` (après application d'une baisse adverse réussie) — ajouté plan 136 |
| `onTypeImmunity` | `effect-processor.ts` (avant tout effet) |
| `onMoveImmunity` | `effect-processor.ts` (gate d'immunité de move, après `onTypeImmunity`) — **ajouté plan 138** pour Anti-Bruit (flag `sound`) et Envelocape (flag `powder`) |
| `onEndTurn` | `BattleEngine` tick de fin de tour — contexte enrichi plan 137 : `random: () => number` (threadé depuis `this.random`) + `weather: Weather` (météo effective via `getEffectiveWeather`, honore Ciel Gris) |
| `onBattleStart` | `BattleEngine.triggerBattleStart()` — plan 137 : câble aussi `weatherAutoSetter` (pour Sécheresse/drought : `setWeather(state, weather, turns, pokemonId)` + push events) |
| `onAuraCheck` | `BattleEngine.triggerBattleStart()` + `emitPositionLinkedChecks` |
| `onFlinch` | `processFlinch` (après pose de `flinchedThisTurn`) — ajouté plan 137 pour Impassible |
| `onAccuracyModify` | `accuracy-check.ts` (côté attaquant porteur) — **ajouté plan 138** pour Agitation (×0.8 phys). Câblé en parallèle du hook objet, multiplicatif |
| `onEvasionModify` | `accuracy-check.ts` (côté défenseur porteur) — **ajouté plan 138** pour Pieds Confus + Peau Miracle. Miroir du hook objet |
| `onDrainAttempt` | `handle-drain.ts` (côté défenseur drainé) — **ajouté plan 138** pour Suintement. Si `redirect=true`, l'attaquant subit les dégâts |
| `statusSpeedBoost` | `initiative-calculator.ts` (champ déclaratif, miroir `weatherSpeedBoost`) — **ajouté plan 138** pour Pied Véloce (×1.5 si statut majeur, ignore malus paralysie) |
| `infiltratorBypass` | `substitute-system.ts` + `aura-system.ts` (flag `abilityId === "infiltrator"`) — **ajouté plan 138** : bypass Substitut, Mur Lumière, Protection, Voile Sacré, Brume |

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
| **Régé-Force (Regenerator)** | Canon VGC = soin 1/3 PV **à l'échange**. Inapplicable ici (pas de banc/switch en combat tactique). **Divergence intentionnelle** : réinterprété en soin passif `ceil(maxHp/16)` à chaque fin de tour via `onEndTurn`. Décidé lors du plan 136. |
| **Sniper** | ×1.5 additionnel si coup critique. Multiplicatif avec le bonus crit standard (×1.5) → total ×2.25 sur un crit. Requiert `isCrit: boolean` exposé dans `DamageModifyContext`. |
| **Colérique (Anger Point)** | Déclenché par `isCrit` dans `AfterDamageContext`. Monte l'Attaque à +6 (plafond de stages — pas +6 depuis la valeur courante, mais fixé à +6). |
| **Acharné (Defiant) / Battant (Competitive)** | Déclenchés via `onAfterStatLowered`. Le hook ne se déclenche que si `source.playerId !== self.playerId` (pas sur auto-baisses comme Close Combat, pas sur baisses alliées). |
| **Inconscient (Unaware)** | Deux sens : (1) attaquant = ignore Déf/DéfSpé de la cible ; (2) défenseur = ignore Atq/AtqSpé de l'attaquant. Géré par param `ignoreOpponentStatStages` dans `damage-calculator`. |
| **Querelleur (Scrappy)** | Bypass Normal/Combat vs Spectre côté attaquant uniquement. Bug résolu lors du plan 136 : l'effectivité retournée au call-site doit correspondre au type sans l'immunité Ghost (fix `effect-processor.ts`). |
| **Multi-Coups (Skill Link)** | Garantit toujours le maximum de coups pour les moves multi-frappes (2–5 ou 2–3). Marker vérifié dans `handle-damage.ts → rollMultiHitCount`. Moves concernés : Combo-Griffe, Éclat Roc, Balle Graine, Stalactite, Dard-Aiguille, Gifle Fion, Ruée d'Os, Écaille Canon, Double Battue. |
| **Mue (Shed Skin)** | 33% de chance de soigner le statut majeur en fin de tour. Requiert `random: () => number` dans `AbilityEndTurnContext` (plan 137). |
| **Hydratation (Hydration)** | Soigne le statut majeur en fin de tour si météo Pluie active. Requiert `weather: Weather` dans `AbilityEndTurnContext` (plan 137). |
| **Cuvette (Rain Dish) / Corps Gel (Ice Body)** | Soin passif `max(1, ceil(maxHp/16))` par tour sous la météo correspondante. Pattern miroir Régé-Force. |
| **Écaille Spéciale (Marvel Scale)** | ×0.667 dégâts physiques reçus (÷1.5) si le porteur a un statut majeur. `onDamageModify` défenseur. Silencieux. |
| **Sécheresse (Drought)** | Active le Soleil (5 tours) à l'entrée. Champ déclaratif `weatherAutoSetter` désormais câblé dans `triggerBattleStart` (était présent mais inopérant avant le plan 137). |
| **Impassible (Steadfast)** | +1 Vitesse quand le porteur subit un flinch. Requiert le hook `onFlinch` (plan 137). Le flinch est câblé dans le core (`StatusType.Flinch`, `processFlinch`) — le commentaire obsolète sur `inner-focus` a été corrigé. |
| **Engrais / Brasier / Torrent / Essaim** (plan 138) | Factory `pinchTypeBoost(abilityId, type)` : ×1.5 sur moves du type concerné quand HP ≤ 1/3. Utilise le flag `abilityFirstTriggered` (anti-spam, même pattern Engrais/Brasier/Torrent, désormais unifiés via factory). |
| **Force Soleil (Solar Power)** (plan 138) | `onDamageModify` : ×1.5 moves spéciaux si météo Soleil. **Cumul plein assumé** (décision #547) : ×1.5 talent × ×1.5 météo Feu = ×2.25 sur Feu spécial au Soleil. Contrepoids : `onEndTurn` perte 1/8 PV max tant que Soleil actif. |
| **Force Sable (Sand Force)** (plan 138) | `onDamageModify` : ×1.3 sur moves Roche/Sol/Acier si météo Tempête de Sable. Immunité au chip sable partagée via `blocksIndirectDamage`-like (pattern Envelocape). |
| **Peau Sèche (Dry Skin)** (plan 138) | `onEndTurn` : Pluie → soin 1/8 ; Soleil → perte 1/8. `onDamageModify` défenseur : move Feu reçu × 1.25. `onTypeImmunity` : move Eau → bloqué + soin 1/4 (miroir `water-absorb`). |
| **Feuille Garde (Leaf Guard)** (plan 138) | `onStatusBlocked` : bloque tout infliction de statut majeur si météo Soleil (`weather === Weather.Sun`). Requiert `weather: Weather` dans `StatusBlockContext`. |
| **Envelocape (Overcoat)** (plan 138) | `onMoveImmunity` : bloque les moves avec flag `powder` (Poudre Dodo, Poudre Toxik, etc.). Immunité au chip sable/neige en fin de tour via `onEndTurn`. |
| **Armurouillée (Weak Armor)** (plan 138) | `onAfterDamageReceived` : si move **physique** → Déf −1, Vitesse +2. Volontairement pénalisant défensivement, fort offensivement (gain CT). |
| **Pieds Confus (Tangled Feet)** (plan 138) | `onEvasionModify` défenseur : ×0.5 précision entrante si le porteur est confus (`volatileStatuses` contient `Confusion`). Cumulatif avec stages d'évasion. |
| **Pied Véloce (Quick Feet)** (plan 138) | Champ déclaratif `statusSpeedBoost: { multiplier: 1.5 }` : ×1.5 à l'initiative CT si statut majeur. Ignore le malus −50% de la paralysie (câblé dans `initiative-calculator.ts`). **Surveiller combo « statut auto-induit »** — décision #548. |
| **Anti-Bruit (Soundproof)** (plan 138) | `onMoveImmunity` : bloque les moves avec flag `sound` (Berceuse, Chant Canon, Dissonance Psy, Ronflement…). |
| **Télécharge (Download)** (plan 138) | `onBattleStart` : compare Déf/DéfSpé de l'adversaire le plus proche — si Déf ≤ DéfSpé → +1 Atk, sinon → +1 AtqSpé. Pattern miroir `drought`/`onBattleStart`. |
| **Peau Miracle (Wonder Skin)** (plan 138) | `onEvasionModify` défenseur : ×0.5 précision effective si le move est de catégorie Statut. Réduit à 50% la précision des moves de statut entrants. |
| **Agitation (Hustle)** (plan 138) | `onDamageModify` : ×1.5 sur moves physiques. `onAccuracyModify` ability : ×0.8 précision sur moves physiques (−20%). Net : +50% dégâts phys, −20% fiabilité. |
| **Analyste (Analytic)** (plan 138) | `onDamageModify` : ×1.3 si `targetAlreadyActed === true` (porteur agit après la cible). Réutilise `lastActedAtAction` (même logique que Branchicrok). |
| **Puanteur (Stench)** (plan 138) | `onAfterDamageDealt` : 10% d'apeurer la cible sur tout move offensif. Émet `AbilityActivated` + pose `Flinch` si tirage réussi. |
| **Suintement (Liquid Ooze)** (plan 138) | `onDrainAttempt` défenseur : redirige le drain — l'attaquant subit `lastDamageDealt × fraction` au lieu de soigner. Émet `AbilityActivated` + event dégâts sur l'attaquant. |
| **Boom Final (Aftermath)** (plan 138) | `onAfterDamageReceived` : si le porteur est mis K.O. par un move contact → l'attaquant perd 1/4 PV max. Émet `AbilityActivated` + event dégâts. |
| **Infiltration (Infiltrator)** (plan 138) | Bypass via flag `abilityId === "infiltrator"` câblé point par point : Abri-Substitut (`substitute-system.ts`), Mur Lumière/Protection Lumière (`screenMultiplier`), Voile Sacré/Brume (`handle-status.ts`). Pas de hook unique — le plus dispersé du batch. |
| **Brise Moule (Mold Breaker)** (plan 140) | Pendant l'attaque du porteur, les talents `breakable` de la cible sont ignorés. Implémenté via `resolveDefensiveAbility(registry, target, attacker)` (voir § Suppression de talent). 8 sites défensifs migrés. Silencieux (pas d'`AbilityActivated`). Talents non-cassables (Statik, Corps Ardent, Synchro, Boom Final) toujours actifs. Porteur Gen 1 : Scarabrute (`pinsir`). |
| **Gloutonnerie (Gluttony)** (plan 141) | Abaisse le seuil de déclenchement des baies de pincement stat (Baie Lichii/Lingan/Pitaye/Abriko/Sailak) de 25% PV à **50% PV**. La Baie Sitrus (soin 25% PV) n'est pas concernée — limitation assumée (décision #561). `breakable: false`. Porteurs Gen 1 : Chétiflor (`oddish`), Boustiflor (`gloom`), Empiflor (`vileplume`), Ronflex (`snorlax`, hidden). |
| **Tension (Unnerve)** (plan 141) | Tant que le porteur est vivant sur le terrain, les ennemis dans n'importe quelle position **ne peuvent pas manger leur baie tenue**. Bloque tous les hooks `onEndTurn` et `onAfterDamageReceived` des baies consommables ennemies. `breakable: false`. Porteurs Gen 1 : Abo (`ekans`), Arbok (`arbok`), Miaouss (`meowth`), Persian (`persian`), Ptéra (`aerodactyl`), Mewtwo (`mewtwo`, hidden). Note rééquilibrage : à réévaluer si des baies de soin sont ajoutées en quantité au roster d'objets (voir `docs/next.md`). |
| **Moiteur (Damp)** (plan 141) | **Relationnel (pas field-wide — divergence assumée vs canon, décision #559).** Destruction (`self-destruct`) **échoue entièrement** seulement si un porteur de Moiteur vivant est **parmi les cibles** de l'explosion (`findDampInTargets` côté engine, gate dans `executeUseMove` — la 1ʌre cible Moiteur émet `AbilityActivated`). Un Moiteur hors zone ne bloque rien. En 1v1 = « la cible a Moiteur ». Bloque aussi le recul de Boom Final (`aftermath`) **uniquement si l'attaquant qui le subirait porte Moiteur** (relationnel, miroir explosion). `breakable: false`. Porteurs Gen 1 : Psykokwak (`psyduck`, ability1), Akwakwak (`golduck`, ability1), lignée Ptitard — Ptitard/Têtarte/Tartard/Tarpaud (`poliwag`/`poliwhirl`/`poliwrath`/`politoed`, ability2), Paras (`paras`, hidden), Parasect (`parasect`, hidden), Hypotrempe (`horsea`, hidden), Hypocéan (`seadra`, hidden). |
| **Cœur Soin (Healer)** (plan 141) | En fin de tour, pour chaque allié dans un rayon Manhattan r2, effectue un roll de **30%** indépendant — si réussi, soigne le statut majeur de l'allié (Sommeil, Paralysie, Brûlure, Poison, Gel). Roll distinct par allié (décision #558). Utilise `onEndTurn` + `random: () => number`. `breakable: false`. Porteur Gen 1 : Leveinard (`chansey`, hidden). |
| **Garde-Ami (Friend Guard)** (plan 141) | Les alliés dans un rayon Manhattan r2 subissent **×0.75 dégâts** de toutes les sources (physiques et spéciaux). Multiplicateur défensif passif câblé dans `damage-calculator.ts` (côté allié défenseur). Cumulable avec Reflet/Mur Lumière — plancher combiné possible ×0.375 (décision #560). **N'interagit PAS avec Brise Moule** : Garde-Ami est un talent du porteur (allié), non de la cible attaquée — `resolveDefensiveAbility` n'est pas invoqué sur le porteur de Garde-Ami lors d'un coup sur son allié. `breakable: false`. Porteurs Gen 1 : Mélofée (`clefairy`, hidden), Rondoudou (`jigglypuff`, hidden). |

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
| Fermeté | Survit à un coup fatal à plein PV (1 PV) ; **immunité totale** face aux moves de la famille K.O. en un coup (`isOhko` — plan 148), bypassée par Brise Moule | Émission dans `handle-damage` (survie) / `ohko.ts` + `BattleEngine` (immunité totale, décision #609) |
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
| Téméraire | Boost ×1.2 sur moves à recul (Rapace, Aquatacle…) | (silencieux, pas de test d'émission) |
| Rivalité | ×1.25 même genre / ×0.75 genre opposé / ×1 genderless | (silencieux, pas de test d'émission) |
| Lentiteintée | Effectivité < 1 → ×2 (0.5→1.0) | (silencieux, pas de test d'émission) |
| Régé-Force | Soin `ceil(maxHp/16)` en fin de tour | ✅ émission `AbilityActivated` + `HpRestored` |
| Sniper | Coup critique → ×1.5 multiplicatif (total ×2.25). Flag `isCrit` dans `DamageModifyContext`. | (silencieux, pas de test d'émission) |
| Colérique | Reçoit un coup critique → Attaque +6 stages. Flag `isCrit` dans `AfterDamageContext`. | ✅ émission `AbilityActivated` |
| Acharné | Stat abaissée par adversaire → +2 Attaque. Hook `onAfterStatLowered`. | ✅ émission `AbilityActivated` |
| Battant | Stat abaissée par adversaire → +2 Atq. Spé. Hook `onAfterStatLowered`. | ✅ émission `AbilityActivated` |
| Inconscient | Ignore stages Déf/DéfSpé adverses (attaque) + stages Atq/AtqSpé adverses (défense). | (silencieux, marker inline `damage-calculator`) |
| Querelleur | Normal/Combat ignorent immunité Spectre. Fix inclus : effectivité retournée correcte. | ✅ test bypass + effectivité |
| Multi-Coups | Moves multi-frappes = toujours le maximum de coups (`rollMultiHitCount`). | (silencieux, marker inline `handle-damage`) |
| Engrais / Brasier / Torrent / Essaim | ×1.5 boost type sous seuil 1/3 PV. Factory `pinchTypeBoost`. | Premier passage sous seuil (anti-spam `abilityFirstTriggered`) |
| Force Soleil | ×1.5 AtqSpé au Soleil + perte 1/8 PV/tour | ✅ émission `AbilityActivated` au tick + au boost spé |
| Force Sable | ×1.3 Roche/Sol/Acier en Tempête de Sable | (silencieux — multiplicateur) |
| Peau Sèche | Pluie soin / Soleil perte / Feu ×1.25 / Eau immunité+soin | ✅ émission sur immunité Eau |
| Feuille Garde | Bloque statut majeur au Soleil | ✅ émission `AbilityActivated` quand blocked |
| Envelocape | Immunité moves poudre | ✅ émission `AbilityActivated` quand blocked |
| Armurouillée | Touché physique → Déf −1, Vit +2 | ✅ émission via `StatChanged` |
| Pieds Confus | Confus → précision entrante ×0.5 | (silencieux — évasion modifier) |
| Pied Véloce | Statut majeur → Vit ×1.5 CT (init-calculator) | (silencieux — champ déclaratif) |
| Anti-Bruit | Immunité moves sonores | ✅ émission `AbilityActivated` quand blocked |
| Télécharge | Entrée → +1 Atk ou AtqSpé selon Déf/DéfSpé adversaire | ✅ émission `AbilityActivated` + `StatChanged` |
| Peau Miracle | Moves statut entrants précision ×0.5 | (silencieux — évasion modifier) |
| Agitation | ×1.5 Atk phys, −20% précision phys | (silencieux — modificateurs) |
| Analyste | ×1.3 si agit après la cible | (silencieux — multiplicateur) |
| Puanteur | 10% apeurer sur coup offensif | ✅ émission `AbilityActivated` si tirage réussi |
| Suintement | Drain retourné en dégâts sur l'attaquant | ✅ émission `AbilityActivated` + dégâts attaquant |
| Boom Final | K.O. par contact → attaquant −1/4 PV | ✅ émission `AbilityActivated` + dégâts attaquant |
| Infiltration | Bypass Substitut/écrans/Voile Sacré/Brume | (silencieux — bypass technique) |
| Brise Moule | (a) Lévitation ignorée → Séisme touche un porteur Lévitation ennemi ; (b) Fermeté ignorée → OHKO passe ; (c) Corps Sain ignoré → baisse stat appliquée ; (d) talent non-cassable (Statik) toujours actif → paralysie au contact malgré Brise Moule ; (e) attaquant sans Brise Moule → Lévitation bloque (témoin). Unit `ability-suppression.test.ts` : `resolveDefensiveAbility` (4 cas). | (silencieux — suppression technique) |

## Talents non visibles (par design)

- **Adaptabilité, Technicien** : multiplicateurs always-on. Silencieux par design — pas de message in-battle (cohérent avec Showdown).
- **Isograisse** : émet quand dégâts Feu/Glace effectivement reçus.
- **Téméraire, Rivalité, Lentiteintée, Sniper, Inconscient** : modificateurs de dégâts silencieux par design (cohérent avec Adaptabilité/Technicien).

## Buffer des events au démarrage

Les events `onBattleStart` et `onAuraCheck` sont émis dans le **constructeur** de `BattleEngine`, **avant** que le renderer ait branché ses listeners ou créé ses sprites. Ils sont bufférisés dans `BattleEngine.startupEvents` puis drainés via `consumeStartupEvents()` après l'initialisation des sprites (appelé par `controller.processStartupEvents()` dans `BattleScene`). Sinon les floating texts (Engrais qui démarre sous 1/3, Intimidation aura au spawn) seraient perdus.

## Documentation Showdown

Pour vérifier la mécanique exacte d'un talent :
- `packages/data/reference/abilities.json` : nom + description Showdown
- Bulbapedia : pages des talents (mécanique détaillée Gen 9)
- Pokemon Showdown source : `data/abilities.ts` (référence implémentation)
