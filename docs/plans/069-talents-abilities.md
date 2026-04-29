# Plan 069 — Talents (Abilities) — Phase 4

> Statut : done
> Phase : 4

## Objectif

Implémenter les 20 talents du roster PoC. Nouveau système : `AbilityDefinition` (objet plat à hooks optionnels, modèle Showdown), 6 hooks dans le moteur, 2 nouveaux `VolatileStatus`, floating text via `AbilityActivated`.

---

## Architecture

### Nouveaux hooks — point d'injection

| Hook | Signature | Fichier cible | Abilities concernées |
|------|-----------|---------------|----------------------|
| `onDamageModify` | `(ctx: DamageModifyContext) => number` | `damage-calculator.ts` | blaze, overgrow, torrent, guts, thick-fat, adaptability, technician |
| `onAfterDamageReceived` | `(ctx: AfterDamageContext) => BattleEvent[]` | `handle-damage.ts` (après apply) | static, poison-point, cute-charm, sturdy, rough-skin, synchronize |
| `onStatusBlocked` | `(ctx: StatusBlockContext) => boolean` | `handle-status.ts` (avant apply) | own-tempo (confusion) |
| `onStatChangeBlocked` | `(ctx: StatChangeBlockContext) => boolean` | `handle-stat-change.ts` (avant apply) | keen-eye, clear-body |
| `onTypeImmunity` | `(ctx: TypeImmunityContext) => boolean` | `handle-damage.ts` (avant calcul) | levitate (Ground) |
| `onBattleStart` | `(ctx: BattleStartContext) => BattleEvent[]` | `BattleEngine` (init après placement) | intimidate, magnet-pull |

Un hook supplémentaire : `onAccuracyModify` pour sand-veil — **implémenté à l'Étape 3 mais condition `sandstormActive` toujours `false`** jusqu'à la Phase 9 météo.

### Nouveaux types

**`packages/core/src/`**

- `types/ability-definition.ts` — interface `AbilityDefinition` avec tous les hooks optionnels
- `battle/ability-handler-registry.ts` — `Map<string, AbilityDefinition>` + méthode `dispatch(hook, ctx)`
- `enums/status-type.ts` — +`Intimidated`, +`Infatuated`
- `enums/battle-event-type.ts` — +`AbilityActivated`
- `types/battle-event.ts` — variant `AbilityActivated { pokemonId: string; abilityId: string; targetIds: string[] }`
- `types/pokemon-definition.ts` — +`abilityId?: string`
- `types/pokemon-instance.ts` — +`abilityId?: string`

### Position-linked statuses

Nouvelle fonction `checkPositionLinkedStatuses(state: BattleState): BattleEvent[]` dans `battle/position-linked-statuses.ts`.

Logique :
1. Pour chaque Pokémon vivant
2. Pour chaque `VolatileStatus` de type `Intimidated` ou `Trapped` avec `sourceId`
3. Si la source est KO ou n'est plus adjacente (Chebyshev distance > 1) → retrait silencieux
4. Pour `Intimidated` : émettre `StatChanged +1 Attack` pour annuler le –1 initial
5. Pour `Trapped` : émettre `StatusRemoved`

Appelée **3 fois** :
- `BattleEngine` — après résolution d'une action Déplacement
- `handle-knockback.ts` — en fin de knockback (source ou cible projetée)
- `BattleEngine` — après `PokemonKo` (nettoyage immédiat)

### Levitate = vol mécanique

Helper `isEffectivelyFlying(instance: PokemonInstance): boolean` :

```typescript
return types.includes(PokemonType.Flying) || instance.abilityId === 'levitate';
```

Remplace les 4 occurrences `pokemonTypes.includes(PokemonType.Flying)` dans `BattleEngine.ts` (mouvements, knockback, fall damage). Gastly gagne ainsi : traversée obstacles, pas de pénalité terrain, pas de chute, immunité Ground (via `onTypeImmunity`), immunité terrain (via les immuneTerrains existantes).

---

## 20 Abilities

| # | Pokémon | Ability | Mécanique dans notre jeu | Hook |
|---|---------|---------|--------------------------|------|
| 1 | Bulbasaur | **overgrow** | ×1.5 Grass si HP ≤ 1/3 max | `onDamageModify` |
| 2 | Charmander | **blaze** | ×1.5 Fire si HP ≤ 1/3 max | `onDamageModify` |
| 3 | Squirtle | **torrent** | ×1.5 Water si HP ≤ 1/3 max | `onDamageModify` |
| 4 | Pidgey | **keen-eye** | Bloque baisses de Précision ennemies | `onStatChangeBlocked` |
| 5 | Pikachu | **static** | 30% Paralysé sur l'attaquant si contact reçu | `onAfterDamageReceived` |
| 6 | Machop | **guts** | ×1.5 Atk si porteur d'un statut majeur | `onDamageModify` |
| 7 | Abra | **synchronize** | Statut majeur reçu → même statut infligé à la source (pas de boucle si source a Synchro) | `onAfterDamageReceived` |
| 8 | Gastly | **levitate** | Immunité Ground + mécaniques vol complètes (terrain, obstacle, chute) | `onTypeImmunity` + `isEffectivelyFlying` |
| 9 | Geodude | **sturdy** | Si HP max avant le coup et damage ≥ HP courant → ramené à 1 HP | `onAfterDamageReceived` |
| 10 | Growlithe | **intimidate** | Entrée : VolatileStatus `Intimidated` (–1 Atk) sur tous les ennemis adjacents. Retire si source s'éloigne/knockback/KO | `onBattleStart` + `checkPositionLinkedStatuses` |
| 11 | Jigglypuff | **cute-charm** | 30% VolatileStatus `Infatuated` sur l'attaquant si contact reçu. Retire si source s'éloigne/KO | `onAfterDamageReceived` |
| 12 | Seel | **thick-fat** | ×0.5 dégâts Feu et Glace reçus | `onDamageModify` (côté défenseur) |
| 13 | Eevee | **adaptability** | STAB 1.5 → 2.0 | `onDamageModify` |
| 14 | Tentacool | **clear-body** | Bloque toutes les baisses de stat infligées par un ennemi | `onStatChangeBlocked` |
| 15 | Nidoran-m | **poison-point** | 30% Empoisonné sur l'attaquant si contact reçu | `onAfterDamageReceived` |
| 16 | Meowth | **technician** | ×1.5 si puissance du move ≤ 60 | `onDamageModify` |
| 17 | Magnemite | **magnet-pull** | Entrée : VolatileStatus `Trapped` sur ennemis Acier adjacents. Retire si source s'éloigne/knockback/KO | `onBattleStart` + `checkPositionLinkedStatuses` |
| 18 | Sandshrew | **sand-veil** | +1 évasion si tempête de sable active. **Dormant** — condition `sandstormActive` jamais vraie jusqu'à implémentation météo (Phase 9) | `onAccuracyModify` (dormant) |
| 19 | Lickitung | **own-tempo** | Immunité Confusion | `onStatusBlocked` |
| 20 | Kangaskhan | **early-bird** | Durée sommeil ÷2 (arrondie à l'entier supérieur, min 1) | `startTurn` handler |

### Règles importantes

- **Cap statStages** : Intimidate ne s'applique pas si la cible est déjà à –6 Atk → pas de VolatileStatus Intimidated créé
- **Synchronize** : si l'attaquant a aussi Synchronize, le statut ne se propage pas (anti-boucle)
- **Infatuated** : même règle de retrait que Intimidated (source KO ou s'éloigne)
- **Floating text** : uniquement à l'application, jamais au retrait
- **Rough Skin** ne s'applique pas à Sandshrew — uniquement sand-veil canonique

---

## Étapes

### Étape 1 — Core : types fondamentaux

- `StatusType` : +`Intimidated`, +`Infatuated`
- `BattleEventType` : +`AbilityActivated`
- `BattleEvent` : +variant `AbilityActivated`
- `PokemonDefinition` : +`abilityId?: string`
- `PokemonInstance` : +`abilityId?: string`
- `types/ability-definition.ts` : interface `AbilityDefinition`

### Étape 2 — Core : AbilityHandlerRegistry

- `battle/ability-handler-registry.ts`
- Exposé en tant que dépendance injectée dans `BattleEngine` (comme `typeChart`)

### Étape 3 — Core : hooks dans le moteur

- `damage-calculator.ts` : accepter `abilityRegistry?` + appeler `onDamageModify` (attaquant puis défenseur)
- `handle-damage.ts` : `onTypeImmunity` avant calcul + `onAfterDamageReceived` après apply
- `handle-status.ts` : `onStatusBlocked` avant apply
- `handle-stat-change.ts` : `onStatChangeBlocked` avant apply
- `BattleEngine.ts` : helper `isEffectivelyFlying` + appel `onBattleStart` + appels `checkPositionLinkedStatuses`

### Étape 4 — Core : position-linked statuses

- `battle/position-linked-statuses.ts` : `checkPositionLinkedStatuses(state): BattleEvent[]`
- Injection dans `handle-knockback.ts` en fin de résolution

### Étape 5 — Data : 20 AbilityDefinition

- `packages/data/src/abilities/ability-definitions.ts` : les 20 objets `AbilityDefinition`
- `packages/data/src/abilities/index.ts` : exports

### Étape 6 — Data : roster & loader

- `packages/data/src/roster/roster-poc.ts` : +`abilityId` sur les 19 entrées (Sandshrew = `'sand-veil'`, les autres idem)
- `load-data.ts` : charger et passer l'`abilityRegistry` au `BattleEngine`
- `loaders/load-pokemon.ts` : copier `abilityId` dans `PokemonDefinition`

### Étape 7 — Tests

- 1 test scénario Gherkin par ability (fichier `scenarios/abilities/`)
- Tests unitaires `checkPositionLinkedStatuses` : move source, knockback source, knockback cible, KO source, déjà à –6 (pas d'application)
- Tests unitaires `isEffectivelyFlying` : types Flying, levitate, ni l'un ni l'autre

### Étape 8 — Renderer : floating text

- Écouter `AbilityActivated` → texte flottant `"{abilityName}!"` au-dessus de chaque `targetId`
- Même style que les autres floating texts existants

### Étape 9 — Doc & roadmap

- `docs/decisions.md` : décision abilities system (registry, hooks, sand-veil dormant)
- `docs/roadmap.md` : ajouter en Phase 9 "Météo (Tempête de Sable, Soleil, Pluie, Grêle) + capacités/talents associés" et "Champs (Herbeux, Psy, Électrique, Brumeux, Distorsion)"
- `docs/next.md` : mise à jour

---

## Checklist fin de plan

- [x] Gate CI verte : `pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`
- [x] `core-guardian` : aucune dépendance UI dans packages/core
- [ ] `code-reviewer`
- [x] `doc-keeper`
- [ ] Proposer `visual-tester` (floating text à valider visuellement)
