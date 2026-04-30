# Plan 073 — Objets Tenus — Phase 4

> Statut : done
> Phase : 4

## Objectif

Implémenter 12 objets tenus pour le roster PoC. Nouveau système `HeldItemDefinition` (miroir `AbilityDefinition`), 8 hooks d'injection, mini-système critiques, verrou move Choice piloté par `onMoveLock`, UI sélection objet en TeamSelect.

Contrainte gameplay : 2 Pokémon d'une même équipe ne peuvent pas porter le même objet.

---

## Liste des 12 objets

| ID | Nom FR | Effet |
|----|--------|-------|
| `leftovers` | Restes | +1/16 HP max en fin de tour (passif) |
| `life-orb` | Orbe Vie | ×1.3 dégâts infligés + −10% HP max du porteur après chaque attaque |
| `choice-band` | Bandeau Choix | Atk ×1.5 (moves physiques) + verrou 1 move jusqu'en fin de combat |
| `choice-scarf` | Mouchoir Choix | Vitesse ×1.5 (→ gain CT) + verrou 1 move jusqu'en fin de combat |
| `focus-sash` | Ceinture Force | Survit à 1 HP si HP max avant le coup — consumé |
| `expert-belt` | Ceinture Pro | ×1.2 dégâts si super-efficace |
| `rocky-helmet` | Casque Brut | Inflige 1/6 HP max de l'attaquant si move de contact reçu |
| `weakness-policy` | Vulné-Assurance | +2 Atk ET +2 SpAtk si super-efficace reçu — consumé |
| `scope-lens` | Lentilscope | +1 stage critique (nécessite mini-système crit) |
| `sitrus-berry` | Baie Sitrus | Soigne +1/4 HP max quand HP ≤ 1/2 max — consumé |
| `heavy-duty-boots` | Grosses Bottes | Immunité aux dégâts et effets de terrain (magma, marais, sable, etc.). Ne permet pas la traversée. Futurs hazards : immunité aussi. |
| `light-ball` | Balle Lumière | ×2 Atk ET ×2 SpAtk — uniquement si porteur = Pikachu |

---

## Architecture

### Nouveaux types — `packages/core/src/`

**`enums/held-item-id.ts`**
```typescript
export const HeldItemId = {
  Leftovers: "leftovers",
  LifeOrb: "life-orb",
  ChoiceBand: "choice-band",
  ChoiceScarf: "choice-scarf",
  FocusSash: "focus-sash",
  ExpertBelt: "expert-belt",
  RockyHelmet: "rocky-helmet",
  WeaknessPolicy: "weakness-policy",
  ScopeLens: "scope-lens",
  SitrusBerry: "sitrus-berry",
  HeavyDutyBoots: "heavy-duty-boots",
  LightBall: "light-ball",
} as const;
export type HeldItemId = (typeof HeldItemId)[keyof typeof HeldItemId];
```

**`types/held-item-definition.ts`** — interfaces + union `HeldItemHandler`

| Hook | Signature | Items concernés |
|------|-----------|-----------------|
| `onDamageModify` | `(ctx: DamageModifyContext) => number` | Restes, Orbe Vie, Bandeau Choix, Ceinture Pro, Balle Lumière |
| `onCritStageBoost` | `(ctx: CritStageContext) => number` | Lentilscope |
| `onAfterMoveDamageDealt` | `(ctx: AfterMoveDamageDealtContext) => BattleEvent[]` | Orbe Vie (recoil) |
| `onAfterDamageReceived` | `(ctx: AfterItemDamageContext) => ItemReactionResult` | Ceinture Force, Vulné-Assurance, Casque Brut |
| `onEndTurn` | `(ctx: ItemEndTurnContext) => BattleEvent[]` | Restes, Baie Sitrus |
| `onTerrainTick` | `(ctx: ItemTerrainContext) => ItemBlockResult` | Grosses Bottes |
| `onCtGainModify` | `(ctx: ItemCtGainContext) => number` | Mouchoir Choix |
| `onMoveLock` | `(ctx: MoveLockContext) => boolean` | Bandeau Choix, Mouchoir Choix (retourne true → verrou move) |

Réutilise `DamageModifyContext` de `ability-definition.ts` (même structure, même fichier source).

```typescript
export interface ItemReactionResult {
  events: BattleEvent[];
  consumeItem: boolean;
}

export interface ItemBlockResult {
  blocked: boolean;
  events: BattleEvent[];
}

export interface HeldItemHandler {
  id: string;
  onDamageModify?: (context: DamageModifyContext) => number;
  onCritStageBoost?: (context: CritStageContext) => number;
  onAfterMoveDamageDealt?: (context: AfterMoveDamageDealtContext) => BattleEvent[];
  onAfterDamageReceived?: (context: AfterItemDamageContext) => ItemReactionResult;
  onEndTurn?: (context: ItemEndTurnContext) => BattleEvent[];
  onTerrainTick?: (context: ItemTerrainContext) => ItemBlockResult;
  onCtGainModify?: (context: ItemCtGainContext) => number;
  onMoveLock?: (context: MoveLockContext) => boolean;
}

export interface HeldItemDefinition extends HeldItemHandler {
  name: { fr: string; en: string };
  shortDescription: { fr: string; en: string };
}
```

**`battle/held-item-handler-registry.ts`** — clone `ability-handler-registry.ts` pour items

**`types/pokemon-instance.ts`** — 2 nouveaux champs :
```typescript
heldItemId?: HeldItemId;    // null si consumé (item retiré = null)
lockedMoveId?: string | null; // verrou Choice items (null = pas de verrou)
```

**`enums/battle-event-type.ts`** — 3 nouveaux :
- `HeldItemActivated: "held_item_activated"`
- `HeldItemConsumed: "held_item_consumed"`
- `CriticalHit: "critical_hit"`

**`types/battle-event.ts`** — 3 variants :
```typescript
| { type: typeof BattleEventType.HeldItemActivated; pokemonId: string; itemId: string; targetIds: string[] }
| { type: typeof BattleEventType.HeldItemConsumed; pokemonId: string; itemId: string }
| { type: typeof BattleEventType.CriticalHit; targetId: string }
```

---

## Mini-système critiques

Intégré dans `damage-calculator.ts`.

**Probabilités** (Gen 6+ simplifié) :
| Stage | Prob |
|-------|------|
| 0 | 1/24 ≈ 4.2% |
| 1 | 1/8 = 12.5% |
| 2 | 1/2 = 50% |
| 3+ | 100% |

**Effet** : ×1.5 dégâts + ignore stages défense négatifs (clamp `defenseStage = max(0, stage)` — ne bonifie pas l'attaquant en ignorant les stages positifs). HP exclu des crits.

**Crit stage natif des moves** : certains moves ont un `critRatio` élevé (Tranche, Karaté Chop = `critRatio: 1` dans Showdown → stage 1 natif). La `MoveDefinition` doit exposer `critRatio?: number`. Dans `calculateDamage`, `baseCritStage = move.critRatio ?? 0`. Lentilscope ajoute `+1` via `onCritStageBoost`. Vérifier que `MoveDefinition` a bien ce champ (sinon ajouter dans l'interface).

**Impl** : `calculateDamage` retourne `{ damage: number; isCrit: boolean }` (au lieu de `number` seul). Stage critique total = `baseCritStage + (attackerItem?.onCritStageBoost?.({...}) ?? 0)`. Roll via `random()`. Si crit : multiplicateur ×1.5, clamp defense stage.

L'émission de `CriticalHit` se fait dans **`handle-damage.ts`** après appel `calculateDamage`, si `isCrit === true` :
```typescript
if (isCrit) {
  events.push({ type: BattleEventType.CriticalHit, targetId: target.id });
}
```

**Migration call sites** : `calculateDamage` retourne désormais un objet — tous les call sites existants (`handle-damage.ts`, `BattleEngine.estimateDamage`, tests) doivent être mis à jour. Regrouper dans Étape 2.

**`estimateDamage`** : affiche `[min–max]*` si crit possible (note visuelle renderer, pas bloquant MVP).

---

## Injection hooks

### `effect-handler-registry.ts`
```typescript
export interface EffectContext {
  // ... existant ...
  itemRegistry?: HeldItemHandlerRegistry;  // AJOUT
}
```

### `damage-calculator.ts`
Signature étendue :
```typescript
export function calculateDamage(
  ...,
  abilityRegistry?: AbilityHandlerRegistry,
  itemRegistry?: HeldItemHandlerRegistry,   // AJOUT
): number
```
Appel après `attackerMod`/`defenderMod` :
```typescript
const attackerItemMod = itemRegistry?.getForPokemon(attacker)?.onDamageModify?.({...}) ?? 1.0;
const defenderItemMod = itemRegistry?.getForPokemon(defender)?.onDamageModify?.({...}) ?? 1.0;
```
Crit roll avant le `Math.floor` final, si crit → ×1.5 + ajuste defenseStage.

Même extension pour `estimateDamage`.

### `handle-damage.ts`
Après `target.currentHp -= actualDamage` (et après events ability) :

```typescript
// Item réaction défenseur
const targetItem = context.itemRegistry?.getForPokemon(target);
if (targetItem?.onAfterDamageReceived && actualDamage > 0 && target.currentHp > 0) {
  const result = targetItem.onAfterDamageReceived({ ... });
  events.push(...result.events);
  if (result.consumeItem) { target.heldItemId = undefined; }
}

// Item réaction attaquant (recoil Orbe Vie)
const attackerItem = context.itemRegistry?.getForPokemon(context.attacker);
if (attackerItem?.onAfterMoveDamageDealt && actualDamage > 0) {
  events.push(...attackerItem.onAfterMoveDamageDealt({ ... }));
}
```

### `terrain-tick-handler.ts`
Avant `applyTerrainDot` et `applyTerrainStatus` :
```typescript
const item = pokemonItemRegistry?.getForPokemon(pokemon);
const terrainResult = item?.onTerrainTick?.({ pokemon, terrain });
if (terrainResult?.blocked) {
  events.push(...terrainResult.events);
  return;  // skip dot et status
}
```
`terrain-tick-handler.ts` accepte `pokemonItemRegistry?: HeldItemHandlerRegistry` en paramètre de `createTerrainTickHandler`.

### `BattleEngine.getCtGainForPokemon`
```typescript
private getCtGainForPokemon(pokemonId: string): number {
  const pokemon = this.state.pokemon.get(pokemonId);
  if (!pokemon) return 0;
  const baseStat = pokemon.baseStats.speed;
  const stages = pokemon.statStages[StatName.Speed] ?? 0;
  const baseGain = computeCtGain(baseStat, stages);
  const item = this.itemRegistry?.getForPokemon(pokemon);
  const modifier = item?.onCtGainModify?.({ pokemon }) ?? 1.0;
  return Math.floor(baseGain * modifier);  // floor pour éviter fractions
}
```

### `BattleEngine.ts` — EndTurn items
`turn-pipeline.ts` ne connaît pas `itemRegistry`. Le hook `onEndTurn` est appelé directement dans `BattleEngine`, après l'exécution de la phase `EndTurn` (après les handlers status tick existants), avant la fin du tour :
```typescript
// Après les phases EndTurn (status tick, terrain tick...) :
for (const [pokemonId, pokemon] of this.state.pokemon) {
  if (pokemon.currentHp <= 0) continue;
  const item = this.itemRegistry?.getForPokemon(pokemon);
  if (item?.onEndTurn) {
    const events = item.onEndTurn({ pokemon, state: this.state });
    // dispatcher les events + gérer KO si HP <= 0 après heal/recoil
  }
}
```

### `BattleEngine.ts` — Choice lock
1. `BattleEngine` constructor : `itemRegistry: HeldItemHandlerRegistry | null = null` (comme abilityRegistry)
2. Dans `executeUseMove` : si porteur item Choice et `lockedMoveId === null` → `pokemon.lockedMoveId = moveId`
3. Dans `getLegalActions` : si `lockedMoveId !== null` → filtrer `AttackAction` aux seules actions avec `moveId === lockedMoveId` (ou `skip_turn` si PP épuisé)

```typescript
private applyChoiceLock(pokemon: PokemonInstance, moveId: string): void {
  const CHOICE_ITEMS = new Set([HeldItemId.ChoiceBand, HeldItemId.ChoiceScarf]);
  if (pokemon.heldItemId && CHOICE_ITEMS.has(pokemon.heldItemId) && !pokemon.lockedMoveId) {
    pokemon.lockedMoveId = moveId;
  }
}
```

---

## Définitions items — `packages/data/src/items/`

**`item-definitions.ts`** — 12 handlers implémentés

Exemples représentatifs :

```typescript
// Restes — heal end-turn
{ id: "leftovers", onEndTurn: ({ pokemon }) => {
  const heal = Math.max(1, Math.floor(pokemon.maxHp / 16));
  if (pokemon.currentHp >= pokemon.maxHp) return [];
  pokemon.currentHp = Math.min(pokemon.maxHp, pokemon.currentHp + heal);
  return [{ type: BattleEventType.HeldItemActivated, pokemonId: pokemon.id, itemId: "leftovers", targetIds: [pokemon.id] }];
}}

// Orbe Vie — ×1.3 + recoil 10%
{ id: "life-orb",
  onDamageModify: (ctx) => ctx.isAttacker ? 1.3 : 1.0,
  onAfterMoveDamageDealt: ({ attacker, damageDealt }) => {
    if (damageDealt <= 0 || attacker.currentHp <= 0) return [];
    const recoil = Math.max(1, Math.floor(attacker.maxHp / 10));
    attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
    return [
      { type: BattleEventType.DamageDealt, targetId: attacker.id, amount: recoil, effectiveness: 1 },
      ...(attacker.currentHp <= 0 ? [{ type: BattleEventType.PokemonKo, pokemonId: attacker.id, countdownStart: 0 }] : []),
      { type: BattleEventType.HeldItemActivated, pokemonId: attacker.id, itemId: "life-orb", targetIds: [attacker.id] },
    ];
  }
}

// Ceinture Force — survive 1HP à HP max
{ id: "focus-sash", onAfterDamageReceived: ({ target, damageDealt, wasAtMaxHp }) => {
  if (!wasAtMaxHp || target.currentHp > 0) return { events: [], consumeItem: false };
  target.currentHp = 1;
  return {
    consumeItem: true,
    events: [
      { type: BattleEventType.HeldItemActivated, pokemonId: target.id, itemId: "focus-sash", targetIds: [target.id] },
      { type: BattleEventType.HeldItemConsumed, pokemonId: target.id, itemId: "focus-sash" },
    ],
  };
}}

// Grosses Bottes — block terrain dot + status
{ id: "heavy-duty-boots", onTerrainTick: ({ pokemon }) => ({
  blocked: true,
  events: [],  // pas de notification visuelle (passif silencieux)
})}

// Balle Lumière — ×2 Pikachu seulement
{ id: "light-ball", onDamageModify: (ctx) => {
  if (!ctx.isAttacker) return 1.0;
  if (ctx.self.definitionId !== "pikachu") return 1.0;
  return 2.0;
}}
```

**`load-items.ts`** — `loadItemsFromReference(referenceItems, handlers)` (même pattern que `load-abilities.ts`).

Note : Baie Sitrus a `category: "medicine"` dans items.json — le loader tolère n'importe quelle catégorie (cherche par id uniquement).

---

## Intégration BattleSetup + loadData

**`BattleSetupConfig`** (renderer/src/game/BattleSetup.ts) :
```typescript
heldItemOverrides?: Record<string, HeldItemId>; // pokemonId → itemId
```

**`createPokemonInstance`** (BattleSetup.ts) — ajouter param :
```typescript
heldItemId?: HeldItemId
```
Posé sur `PokemonInstance.heldItemId`.

**`loadData()`** (packages/data/src/load-data.ts) — exporter `itemRegistry: HeldItemHandlerRegistry`.

**`BattleSetup.createBattleFromPlacements`** — passer `itemRegistry` à `BattleEngine` (comme `abilityRegistry`).

---

## TeamSelectScene — UI sélection objet

- Chaque carte Pokémon dans TeamSelectScene reçoit un sélecteur d'objet (dropdown Phaser texte ou liste simple).
- Contient les 12 items + "Aucun" (valeur `null`).
- Validation : si 2 Pokémon d'une même équipe ont le même item → message d'erreur, bouton Valider bloqué.
- Item sélectionné = `heldItemId` dans `PlacementEntry`, passe dans `BattleSetupConfig.heldItemOverrides`.
- Affichage : nom FR dans une petite ligne sous le portrait. Icône différée (Phase 8 polish).

---

## Renderer — Feedback visuel

**Floating text via `BattleScene`/`GameController`** :
- `HeldItemActivated` → texte flottant vert `#7cf08c` avec nom FR de l'item (ex: `"Restes"`)
- `HeldItemConsumed` → texte flottant gris `#aaaaaa` `"[item] épuisé"` (seulement si consumé séparément)
- `CriticalHit` → texte flottant orange `#ff8800` `"Critique!"` sur la cible

**Battle log i18n** — entrées FR/EN pour les 3 nouveaux event types.

---

## Tests

1 fichier `.test.ts` par item dans **`packages/core/src/battle/items/`** (nouveau dossier, parallèle à `battle/moves/`).

**Helper** : `packages/core/src/testing/` — ajouter `buildItemTestEngine(config)` clone de `buildMoveTestEngine` mais acceptant `itemRegistry?: HeldItemHandlerRegistry`. Si les besoins sont identiques, simplement étendre `buildMoveTestEngine` avec un paramètre optionnel `itemRegistry`.

Scénarios obligatoires par item :

| Item | Test minimal |
|------|-------------|
| Restes | HP restaurés en fin de tour ; pas de soin si HP max |
| Orbe Vie | Dégâts ×1.3 ; recoil 10% ; KO porteur si recoil fatal |
| Bandeau Choix | +Atk ; 2e move différent bloqué ; skip_turn autorisé |
| Mouchoir Choix | CT gain augmenté ; verrou move |
| Ceinture Force | Survive 1HP à HP max ; pas d'effet si pas HP max ; consumé |
| Ceinture Pro | ×1.2 super eff ; ×1.0 neutre |
| Casque Brut | Dégâts en retour sur contact ; pas de retour move non-contact |
| Vulné-Assurance | +2 Atk/SpAtk si super eff ; consumé ; pas d'effet si neutre |
| Lentilscope | Crit stage +1 ; calcul probabilité cohérent |
| Baie Sitrus | Soin ≤1/2 HP ; consumé ; pas de soin si HP > 1/2 |
| Grosses Bottes | Pas de dégâts magma ; pas de brûlure terrain ; traversée toujours bloquée |
| Balle Lumière | ×2 Pikachu ; ×1.0 autre espèce |

Critiques (mécaniques) :
- Crit ignore defense stages négatifs
- Probabilité correcte par stage (0→1/24, 1→1/8, 2→1/2)

Scénario intégration : équipe 2 Pokemon → même item → validation rejette.

---

## Étapes d'implémentation

### Étape 1 — Types core
- `enums/held-item-id.ts`
- `types/held-item-definition.ts` (tous contextes + interfaces)
- `battle/held-item-handler-registry.ts`
- `enums/battle-event-type.ts` : +`HeldItemActivated`, `HeldItemConsumed`, `CriticalHit`
- `types/battle-event.ts` : 3 variants
- `types/pokemon-instance.ts` : +`heldItemId?: HeldItemId`, +`lockedMoveId?: string | null`
- `types/move-definition.ts` : vérifier/ajouter `critRatio?: number` (crit stage natif Tranche/Karaté-Chop)
- `index.ts` core — ajouter exports :
  ```typescript
  export { HeldItemHandlerRegistry } from "./battle/held-item-handler-registry";
  export type { HeldItemDefinition, HeldItemHandler } from "./types/held-item-definition";
  export { HeldItemId } from "./enums/held-item-id";
  export type { HeldItemId as HeldItemIdType } from "./enums/held-item-id";
  ```

### Étape 2 — Mini-système critiques
- `damage-calculator.ts` : crit stage + roll + ×1.5 + `CriticalHit` event
- Tests `damage-calculator.test.ts` : crit proba, ×1.5, ignore stages négatifs

### Étape 3 — Injection hooks
- `effect-handler-registry.ts` : +`itemRegistry?`
- `damage-calculator.ts` : +`itemRegistry?`, appels `onDamageModify` + `onCritStageBoost`
- `handle-damage.ts` : `onAfterDamageReceived`, `onAfterMoveDamageDealt`, consume logic
- `terrain-tick-handler.ts` : `onTerrainTick` avant dot/status
- `BattleEngine.ts` : +`itemRegistry`, `getCtGainForPokemon` modifier, choice lock, propagation EffectContext
- `turn-pipeline.ts` : handler `onEndTurn` items

### Étape 4 — Définitions 12 items (packages/data)
- `packages/data/src/items/item-definitions.ts` : 12 handlers
- `packages/data/src/items/load-items.ts` : loader depuis reference
- `packages/data/src/load-data.ts` : exporte `itemRegistry`

### Étape 5 — BattleSetup + validation équipe
- `BattleSetup.ts` : +`heldItemOverrides`, `createPokemonInstance` + `heldItemId`, itemRegistry passé à BattleEngine
- `team-validator.ts` : règle "pas de doublons item par équipe"

### Étape 6 — TeamSelectScene UI
- Sélecteur objet par Pokemon (dropdown texte Phaser)
- Validation doublons + feedback visuel erreur
- Persistance dans config

### Étape 7 — Renderer feedback
- `GameController` : handlers `HeldItemActivated`, `HeldItemConsumed`, `CriticalHit`
- Floating text couleurs + i18n battle log

### Étape 8 — Tests intégration
- 12 fichiers tests items + mécanique critiques
- Tests `team-validator.ts` item duplicates

---

## Décisions à documenter

- #288 — `lockedMoveId` reset à `null` uniquement à la création d'instance (fin de combat) — pas de "switch choix" en cours de combat, cohérent avec gameplay tactique
- #289 — Baie Sitrus check en `onEndTurn` (pas immédiat après dégâts) — simplifie le pipeline pour MVP
- #290 — Grosses Bottes bloquent terrain damage + status, pas la traversée — séparation traversabilité / effets
- #291 — Balle Lumière : check `definitionId === "pikachu"` (pas le type, pas l'ability) — espèce stricte
- #292 — Critiques MVP : ×1.5 + ignore stages défensifs négatifs uniquement (pas de bonus attaque sur stages positifs annulés — simplifié vs Showdown)
- #293 — 12 items max par roster initial, contrainte unicité intra-équipe
- #294 — Sturdy (Racaillou) implémenté vide dans plan 069 — si Sturdy activé futur, il devra vérifier l'absence de Focus Sash pour éviter double protection OHKO (ou les deux se cumulent délibérément — à trancher)
- #295 — `critRatio` des moves (Tranche=1, Karaté Chop=1 Gen 6+) exposé dans `MoveDefinition.critRatio?: number`, lu par `calculateDamage` comme crit stage de base avant item
