# Plan 076 — Roster Batch B (19 Pokemon) — Phase 4

> Statut : done
> Phase : 4

## Objectif

Ajouter 19 Pokemon Gen 1 finaux au roster jouable. Stratégie identique à Batch A : movesets 4 moves tactiques, abilities pertinentes. 10 nouveaux moves, 8 nouvelles abilities, 3 nouveaux hooks AbilityHandler.

**Roster après Batch B** : 15 (Batch A) + 19 (Batch B) = **34 Pokemon jouables**.

---

## Note de nommage

`next.md` listait "Starmie, Staross" — doublon : `starmie #121` a pour nom FR "Staross", et staryu #120 (FR "Stari") est une forme non-finale. Seul Starmie inclus. Total : 19 (pas 20).

---

## Pokemon — Batch B

| # | ID | Nom FR | Types | Ability | Status |
|---|---|---|---|---|---|
| 031 | nidoqueen | Nidoqueen | Poison/Sol | poison-point ✓ | |
| 034 | nidoking | Nidoking | Poison/Sol | poison-point ✓ | |
| 057 | primeape | Colossinge | Combat | vital-spirit ★ | |
| 059 | arcanine | Arcanin | Feu | intimidate ✓ | |
| 062 | poliwrath | Tartard | Eau/Combat | water-absorb ✓ | |
| 076 | golem | Grolem | Roche/Sol | sturdy ✓ | |
| 080 | slowbro | Flagadoss | Eau/Psy | own-tempo ✓ | |
| 094 | gengar | Ectoplasma | Spectre/Poison | cursed-body ★ | sprites ✓ |
| 097 | hypno | Hypnomade | Psy | insomnia ★ | |
| 103 | exeggutor | Noadkoko | Plante/Psy | — | chlorophyll Phase 9 |
| 105 | marowak | Ossatueur | Sol | rock-head ★ | |
| 106 | hitmonlee | Kicklee | Combat | limber ★ | |
| 107 | hitmonchan | Tygnon | Combat | iron-fist ★ | |
| 112 | rhydon | Rhinoféros | Sol/Roche | lightning-rod ✓ | |
| 121 | starmie | Staross | Eau/Psy | natural-cure ★ | |
| 123 | scyther | Insécateur | Insecte/Vol | technician ✓ | FlyingIdle = Walk fallback |
| 127 | pinsir | Scarabrute | Insecte | moxie ✓ | |
| 141 | kabutops | Kabutops | Roche/Eau | battle-armor ★ | |
| 142 | aerodactyl | Ptéra | Roche/Vol | rock-head ★ | FlyingIdle = Walk fallback |

`✓` = ability déjà implémentée — `★` = nouvelle ability

Sprites : tous ont "Faint abs." dans PMDCollab → fallback anim (identique Batch A). Gengar a tous ses sprites.

---

## Movesets

| ID | Move 1 | Move 2 | Move 3 | Move 4 |
|---|---|---|---|---|
| nidoqueen | earthquake | ice-beam | toxic | body-slam |
| nidoking | earthquake | sludge-bomb | ice-beam | thunderbolt |
| primeape | close-combat | seismic-toss | cross-chop ★ | bulk-up |
| arcanine | flamethrower | extreme-speed | crunch | close-combat |
| poliwrath | surf | dynamic-punch | bulk-up | hypnosis |
| golem | earthquake | rock-slide ★ | defense-curl | rollout |
| slowbro | surf | psychic | amnesia | thunder-wave |
| gengar | shadow-ball | sludge-bomb | hypnosis | confuse-ray ★ |
| hypno | psychic | hypnosis | calm-mind | thunder-wave |
| exeggutor | psychic | hypnosis | earthquake | energy-ball ★ |
| marowak | earthquake | double-edge ★ | swords-dance | bonemerang ★ |
| hitmonlee | close-combat | double-kick | bulk-up | blaze-kick ★ |
| hitmonchan | counter | thunder-punch ★ | ice-punch ★ | fire-punch ★ |
| rhydon | earthquake | rock-slide ★ | iron-defense | crunch |
| starmie | surf | psychic | ice-beam | recover |
| scyther | slash | wing-attack | swords-dance | air-slash |
| pinsir | close-combat | earthquake | swords-dance | quick-attack |
| kabutops | waterfall | slash | rock-slide ★ | swords-dance |
| aerodactyl | double-edge ★ | rock-slide ★ | agility | dragon-claw |

---

## Nouveaux moves (9)

| ID | Nom FR | Type | Cat | Puiss | Préc | PP | Pattern tactique | EffectTier | Effet |
|---|---|---|---|---|---|---|---|---|---|
| cross-chop | Coup Croix | Combat | Phys | 100 | 80 | 5 | single r1 | `MinorSingle` | High crit (`critRatio: 1`) |
| rock-slide | Éboulement | Roche | Phys | 75 | 90 | 10 | cône r1–2 | — | Pas d'effet secondaire (flinch → Phase 9) |
| confuse-ray | Onde Folie | Spectre | Statut | — | 100 | 10 | single r1–3 | `MajorStatus` | Confusion 100% |
| energy-ball | Boule Énergie | Plante | Spé | 90 | 100 | 10 | single r1–4 | — | — |
| bonemerang | Osmerang | Sol | Phys | 50 | 90 | 10 | single r1 | — | 2 hits fixes (même pattern que double-kick) |
| blaze-kick | Flammepied | Feu | Phys | 85 | 90 | 10 | single r1 | — | High crit (`critRatio: 1`), brûlure 10% |
| thunder-punch | Poing Éclair | Électrique | Phys | 75 | 100 | 15 | single r1 | — | Paralysie 10%. Flag `punch`. |
| ice-punch | Poing Glace | Glace | Phys | 75 | 100 | 15 | single r1 | — | Gel 10%. Flag `punch`. |
| fire-punch | Poing de Feu | Feu | Phys | 75 | 100 | 15 | single r1 | — | Brûlure 10%. Flag `punch`. |
| double-edge | Damoclès | Normal | Phys | 120 | 100 | 15 | single r1 | — | Recul 1/3 HP max. `EffectKind.Recoil, fraction: 1/3`. |

### Notes tactical.ts

- `cross-chop` → `effectTier: EffectTier.MinorSingle` (précision réduite compense)
- `rock-slide` → `targeting: { kind: TargetingKind.Cone, range: { min: 1, max: 2 } }`
- `confuse-ray` → identique à supersonic (`StatusType.Confused, chance: 100`) mais Ghost type
- `bonemerang` → identique à double-kick (`MultiHit: { min: 2, max: 2 }`)
- `blaze-kick` → `effects: [Damage, { kind: Status, status: Burned, chance: 10 }]`, `critRatio` dans moves.json déjà = 1
- `thunder-punch / ice-punch / fire-punch` → même pattern, effet statut 10% chacun
- Mutation directe `statusEffects.push()` / `statusEffects.filter()` = pattern standard codebase (voir `handle-status.ts`, `BattleEngine.ts` ligne 1249/1283)
- `extreme-speed` (Arcanine) → déjà implémenté Batch A : `dash r2` (vérifier tactical.ts)

---

## Nouvelles abilities (8)

| ID | Nom FR | Implémentation | Hook(s) |
|---|---|---|---|
| vital-spirit | Esprit Vital | Immune au sommeil | `onStatusBlocked`: si `Asleep` → blocked |
| insomnia | Insomnie | Immune au sommeil | identique vital-spirit |
| cursed-body | Corps Maudit | 30% chance confusion sur attaque contact | `onAfterDamageReceived`: si `move.flags.contact`, 30% → StatusConfused sur attaquant |
| rock-head | Tête de Roc | Annule dégâts de recul moves | `blocksRecoil: true` → check dans `handle-recoil.ts` |
| limber | Souplesse | Immune à la paralysie | `onStatusBlocked`: si `Paralyzed` → blocked |
| iron-fist | Poing de Fer | ×1.2 dégâts moves poing | `onDamageModify`: si `move.flags.punch && isAttacker` → return 1.2 |
| natural-cure | Soin Naturel | Soigne statut majeur fin de tour | `onEndTurn` (**nouveau hook**) → clear statusEffect si majeur |
| battle-armor | Armure Dure | Immunise aux coups critiques | `preventsCrit: true` (**nouveau champ**) → check dans `damage-calculator.ts` |

### Modifications AbilityHandler requises

Trois ajouts à `packages/core/src/types/ability-definition.ts` :

```ts
// Champ existant (déjà là) :
blocksIndirectDamage?: boolean;  // magic-guard

// Nouveaux :
blocksRecoil?: boolean;          // rock-head
preventsCrit?: boolean;          // battle-armor
onEndTurn?: (context: AbilityEndTurnContext) => BattleEvent[];  // natural-cure
```

`AbilityEndTurnContext` (nouveau type dans `ability-definition.ts`) :
```ts
export interface AbilityEndTurnContext {
  self: PokemonInstance;
  state: BattleState;
}
```

### Câblage dans le core

- **`handle-recoil.ts`** : ajouter `|| ability?.blocksRecoil` dans le check existant (ligne ~12)
- **`damage-calculator.ts`** (ligne 73) : insérer `const defenderAbility = abilityRegistry?.getForPokemon(defender);` avant le calcul crit, puis `const isCrit = defenderAbility?.preventsCrit ? false : random() < getCritChance(totalCritStage);`
- **`BattleEngine.ts`** : après le bloc `item?.onEndTurn` (~ligne 1433), ajouter le même pattern pour ability :

```ts
// Après le bloc item.onEndTurn existant (ligne ~1432) :
const ability = this.abilityRegistry?.getForPokemon(activePokemon);
if (ability?.onEndTurn) {
  const abilityEvents = ability.onEndTurn({ self: activePokemon, state: this.state });
  for (const event of abilityEvents) {
    this.emit(event);
    events.push(event);
  }
}
```

### natural-cure — implémentation détaillée

```ts
onEndTurn: (context) => {
  const major = [StatusType.Burned, StatusType.Frozen, StatusType.Paralyzed, StatusType.Poisoned, StatusType.BadlyPoisoned, StatusType.Asleep];
  const hasMajor = context.self.statusEffects.some(s => major.includes(s.type));
  if (!hasMajor) return [];
  context.self.statusEffects = context.self.statusEffects.filter(s => !major.includes(s.type));
  return [{
    type: BattleEventType.AbilityActivated,
    pokemonId: context.self.id,
    abilityId: "natural-cure",
    targetIds: [context.self.id],
  }];
}
```

### cursed-body — implémentation détaillée

```ts
onAfterDamageReceived: (context) => {
  // Guard KO : si Gengar est tué par ce coup, ne pas déclencher
  if (context.self.currentHp <= 0) return [];
  if (!context.move.flags?.contact) return [];
  if (context.random() >= 0.30) return [];
  const alreadyConfused = context.attacker.statusEffects.some(s => s.type === StatusType.Confused);
  if (alreadyConfused) return [];
  context.attacker.statusEffects.push({ type: StatusType.Confused });
  return [{
    type: BattleEventType.AbilityActivated,
    pokemonId: context.self.id,
    abilityId: "cursed-body",
    targetIds: [context.attacker.id],
  }, {
    type: BattleEventType.StatusEffect,
    pokemonId: context.attacker.id,
    status: StatusType.Confused,
  }];
}
```

---

## Étapes d'implémentation

### Étape 1 — AbilityHandler interface + câblage core

`packages/core/src/types/ability-definition.ts` : ajouter `blocksRecoil`, `preventsCrit`, `AbilityEndTurnContext`, `onEndTurn`.

`packages/core/src/battle/handlers/handle-recoil.ts` : ajouter check `blocksRecoil`.

`packages/core/src/battle/damage-calculator.ts` : ajouter check `preventsCrit`.

`packages/core/src/battle/battle-engine.ts` : câbler `onEndTurn` ability dans la boucle end-of-turn.

### Étape 2 — Nouveaux moves dans `tactical.ts`

Ajouter les 9 entrées dans `packages/data/src/overrides/tactical.ts`.

**effectTier** :
- `cross-chop` → `EffectTier.MinorSingle`
- `rock-slide` → aucun (dégâts purs)
- `confuse-ray` → `EffectTier.MajorStatus`
- `energy-ball` → aucun
- `bonemerang` → aucun
- `blaze-kick` → aucun
- `thunder-punch / ice-punch / fire-punch` → aucun

### Étape 3 — Nouvelles abilities dans `ability-definitions.ts`

Ajouter les 8 handlers dans `packages/data/src/abilities/ability-definitions.ts`.
Exporter dans `abilityHandlers[]`.

### Étape 4 — Roster

Modifier `packages/data/src/roster/roster-poc.ts` : ajouter les 19 nouvelles entrées.

### Étape 5 — Tests

**Règle** : minimum 1 test par nouveau move ET par nouvelle ability.

#### Moves — 1 fichier par move dans `packages/core/src/battle/moves/`

| Fichier | Test minimal |
|---|---|
| `cross-chop.test.ts` | Dégâts normaux + vérifier critRatio=1 (1/8 chance avec mock random=0.1) |
| `rock-slide.test.ts` | Touche toutes les cibles dans le cône |
| `confuse-ray.test.ts` | 100% confusion appliquée (même pattern que `supersonic.test.ts`) |
| `energy-ball.test.ts` | Dégâts corrects en ranged (pattern `thunderbolt.test.ts`) |
| `bonemerang.test.ts` | 2 hits confirmés via DamageDealt events (pattern `double-kick.test.ts`) |
| `blaze-kick.test.ts` | Brûlure 10% (mock random=0.05) + critRatio=1 |
| `thunder-punch.test.ts` | Paralysie 10% (mock random=0.05) |
| `ice-punch.test.ts` | Gel 10% (mock random=0.05) |
| `fire-punch.test.ts` | Brûlure 10% (mock random=0.05) |
| `double-edge.test.ts` | Recul 1/3 HP max attaquant (pattern `volt-tackle.test.ts`) |

#### Abilities — nouveaux `it()` dans `packages/core/src/battle/abilities.integration.test.ts`

| Ability | Test minimal |
|---|---|
| vital-spirit | hypnosis bloqué sur Colossinge (Asleep blocked) |
| insomnia | sleep-powder bloqué sur Hypnomade |
| cursed-body | 30% confusion sur attaque contact (mock random=0.1 vs 0.5) |
| rock-head | double-edge sans recul sur Ossatueur (0 DamageDealt sur attaquant) |
| limber | thunder-wave bloqué sur Kicklee |
| iron-fist | thunder-punch ×1.2 vs tackle (sans flag punch) même niveau |
| natural-cure | brûlure effacée fin de tour sur Staross |
| battle-armor | random=0 → pas de CriticalHit event sur Kabutops |

### Étape 6 — Sprites + Gate CI + doc

Vérifier présence sprites PMDCollab pour les 19 Pokemon avant téléchargement :
- Tous ont "Faint abs." → fallback anim existant (voir Batch A)
- Scyther, Aerodactyl : FlyingIdle absent → fallback Walk (identique Gyarados/Charizard/Dragonite)
- Gengar : tous sprites présents ✓

```bash
pnpm extract-sprites  # télécharger sprites Batch B depuis PMDCollab
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration
```

Mettre à jour :
- `docs/implementations.md` (19 Pokemon ✓, moves, abilities, compteurs)
- `README.md#Progression`
- `docs/next.md`

---

## Décisions à trancher

1. **Exeggutor sans ability** — chlorophyll nécessite le système météo (Phase 9). Accepté : ability absente pour Batch B. Documenter décision #XXX.
2. **cursed-body = confusion** vs disable canon — confusion réutilise la mécanique existante. Disable réel (champ `disabledMoveId`) reporté Phase 9. Documenter décision #XXX.
3. **rock-slide sans flinch** — flinch nécessite un nouveau StatusType volatile. Reporté Phase 9. Documenter décision #XXX.
4. **Scyther / Aerodactyl FlyingIdle** — pas de FlapAround dans PMDCollab → fallback Walk (identique Gyarados/Charizard/Dragonite Batch A). Décision #XXX.
5. ~~rock-head dormant~~ — résolu : `double-edge` ajouté à Marowak et Aerodactyl. rock-head actif.
6. **Golem vs Rhydon** — Golem (earthquake + rock-slide + defense-curl + rollout) vs Rhydon (earthquake + rock-slide + iron-defense + crunch). Distinction snowball vs tank statique. Ajustable post-release.

---

## Risques

- **natural-cure vs statuts actifs** : vérifier que le clear ne s'applique pas aux statuts volatils (confusion, infatuation) — seulement les statuts majeurs listés dans l'implémentation ci-dessus.
- **iron-fist + technician** : hitmonchan a technician dans ses données officielles mais on lui donne iron-fist (canonical et plus intéressant). Pas de conflit.
- **battle-armor dans damage-calculator** : `abilityRegistry` doit être passé jusqu'à la ligne crit (déjà dans la signature de `calculateDamageWithCrit`). Vérifier que `defender` est accessible à ce point.
- **Replay golden** : ajout de 19 Pokemon au roster change la sélection random en sandbox. Régénérer le replay après étape 4.
- **Gengar traversée ennemis** : Gengar est type Spectre → traverse les ennemis (même règle que Fantominus dans `game-design.md`). Non-mentionné dans le plan car automatique via le système de types existant. Vérifier que `pokemonTypesMap` contient ghost pour Gengar.
- **Starmie natural-cure + recover** : double résistance aux neutralisations (statuts + PV). Compétitif mais gérable vu 60 Def de base. Surveiller en sandbox.
- **Surplus sommeil** : 4 Pokemon avec hypnosis dans ce Batch (Gengar, Hypno, Exeggutor, Poliwrath) + Fantominus (POC existant). Meta risque d'être sleep-dominant. Surveiller à la phase playtest.

---

## Dépendances

- **Plan 075 DONE** — réutilise `EffectTier` enum, `TacticalOverride` interface, `AbilityHandler` registration pattern, format `RosterEntry`.
- `defense-curl` et `rollout` implémentés depuis plan POC (Golem).

---

## Critères de complétion

- [x] 19 Pokemon présents dans `roster-poc.ts`
- [x] 10 nouveaux moves dans `tactical.ts` + 10 fichiers `*.test.ts` dans `packages/core/src/battle/moves/`
- [x] 8 nouvelles abilities dans `ability-definitions.ts` + 8 `it()` dans `abilities.integration.test.ts`
- [x] 3 nouveaux hooks AbilityHandler câblés dans le core : `blocksRecoil`, `preventsCrit`, `onEndTurn`
- [x] Sprites Batch B téléchargés (`pnpm extract-sprites`)
- [x] Gate CI verte : `pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`
- [x] `docs/implementations.md` mis à jour (compteurs, ✓)
