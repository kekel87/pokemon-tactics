# Plan 083 — Content Batch F (gap-fill plan 082) — Phase 4

> Statut : done
> Phase : 4
> Créé : 2026-05-12

## Objectif

**Combler le gap content identifié par plan 082** pour faire passer les 32 sets `partial` → `full` un maximum.

**Pas de nouveaux Pokemon** (roster Gen 1 complet plan 079). Pure content additions : moves + items + ajustements `op-sets.json` pour les items irréalisables.

Gap analysis source : `docs/op-sets-gap-analysis.md`.

---

## Scope retenu

### Moves à implémenter (2)

| Move | Type | Cat | Sets impactés | Mécanique core |
|---|---|---|---|---|
| `giga-drain` | Plante | Spé | 2 | `EffectKind.Drain` existant (Batch E) |
| `focus-blast` | Combat | Spé | 1 | standard (BP 120, Préc 70%, 10% −1 DéfSpé) |

### Moves différés au plan 084 (Météo)

| Move | Sets | Plan |
|---|---|---|
| `weather-ball` | 2 | 084 — Météo (type/BP variables) |
| `solar-beam` | 1 | 084 — Météo (charge 2-tours, instant en Soleil) |

**Action `op-sets.json`** : laisser intact. Plan 084 les débloque.

### Items à implémenter (5 simples + 4 nouvelles mécaniques = 9)

#### Simples (mirror patterns existants)

| Item | Sets | Mécanique | Hook |
|---|---|---|---|
| `choice-specs` | 8 | ×1.5 SpA + lock move (mirror ChoiceBand) | `onDamageModify` + `onMoveLock` |
| `eviolite` | 7 | ×1.5 Def + ×1.5 SpD pour NFE Gen 2+ — mirror défensif (return 1/1.5 sur dégâts reçus) | `onDamageModify` (isAttacker=false) |
| `black-sludge` | 4 | +1/16 HP si Poison, −1/8 si non-Poison (mirror Leftovers conditionnel) | `onEndTurn` |
| `leek` | 2 | +2 stages crit (Farfetch'd only) — mirror ScopeLens + check pokemonDefinitionId | `onCritStageBoost` |
| `thick-club` | 2 | ×2 Atk (Marowak/Cubone) — Cubone hors roster donc Marowak only | `onDamageModify` |

#### Liste NFE Gen 2+ pour eviolite

Hardcoded dans `item-definitions.ts` (constante `EVIOLITE_NFE_POKEMON_IDS`) :
- `chansey` (→ blissey)
- `electabuzz` (→ electivire)
- `lickitung` (→ lickilicky)
- `magmar` (→ magmortar)
- `onix` (→ steelix)
- `porygon` (→ porygon2)
- `rhydon` (→ rhyperior)
- `scyther` (→ scizor)
- `seadra` (→ kingdra)
- `tangela` (→ tangrowth)

#### Items avec nouvelles mécaniques (4)

| Item | Sets | Mécanique | Hook requis |
|---|---|---|---|
| `white-herb` | 3 | Restore stat baissé une fois, consume | **Nouveau** `onStatLowered` |
| `flame-orb` | 1 | Inflige Brûlure à fin tour 1 au porteur | Existing `onEndTurn` + flag `hasActivated` sur l'item |
| `salac-berry` | 1 | À ≤25% HP, +1 Vit, consume | Existing `onAfterDamageReceived` (mirror FocusSash + stat event) |
| `normal-gem` | 1 | ×1.3 prochain move Normal, consume | Existing `onDamageModify` + flag consume |

### Items différés (1)

| Item | Sets | Raison du report |
|---|---|---|
| `heat-rock` | 1 | Différé au plan 084 (Météo). Laisser intact dans op-sets — débloqué par plan 084. |

### Abilities

**0 ability manquante** dans la gap analysis. Aucun ajout.

---

## Architecture

### `packages/core/src/types/held-item-definition.ts`
- Ajouter optionnel `onStatLowered?: (context: StatLoweredContext) => ItemReactionResult`
- `StatLoweredContext { pokemon, stat: StatName, stages: number }`

### `packages/core/src/battle/effect-processor.ts`
- Après une application de stat lowering, appeler `onStatLowered` du held item du target si présent
- Si `consumeItem === true`, retirer l'item

### `packages/core/src/enums/held-item-id.ts`
- Ajouter `ChoiceSpecs`, `Eviolite`, `BlackSludge`, `Leek`, `ThickClub`, `WhiteHerb`, `FlameOrb`, `SalacBerry`, `NormalGem`

### `packages/data/src/items/item-definitions.ts`
- 9 nouveaux handlers
- Constantes : `BLACK_SLUDGE_HEAL_FRACTION = 16`, `BLACK_SLUDGE_DAMAGE_FRACTION = 8`, `CHOICE_SPECS_MOD = 1.5`, `EVIOLITE_DEFENSE_MOD = 1 / 1.5`, `EVIOLITE_NFE_POKEMON_IDS = new Set([...])`, `LEEK_CRIT_STAGES = 2`, `THICK_CLUB_MOD = 2.0`, `SALAC_THRESHOLD = 0.25`, `NORMAL_GEM_MOD = 1.3`, `FARFETCH_D_DEFINITION_ID = "farfetch-d"`, `MAROWAK_DEFINITION_ID = "marowak"`

### `packages/data/src/i18n/`
- 9 items × {fr, en} name + shortDescription

### `packages/data/src/overrides/tactical.ts`
- 2 nouveaux entries : `giga-drain`, `focus-blast`

### `packages/data/op-sets/op-sets.json`
- Mise à jour ciblée :
  - Remplacer `eviolite` (7 sets) → `leftovers`
- **NE PAS remplacer** `heat-rock` / `weather-ball` / `solar-beam` (4 sets total) — débloqués par plan 084 (Météo).
- Re-run `pnpm op-sets:analyze` après : cible **~155/160 full** (≥96%) post-083. 100% atteint post-084.

### `packages/data/reference/items.json` / `moves.json`
- **Ne pas éditer manuellement** (rule `data.md`). Si entries manquent, regen via `pnpm data:update`. **Vérifier d'abord** que ces IDs existent dans reference.

---

## Étapes d'exécution

### Étape 1 — Pré-check reference + regen si besoin
- `grep -E "choice-specs|black-sludge|leek|thick-club|white-herb|flame-orb|salac-berry|normal-gem" packages/data/reference/items.json` (8 IDs items)
- `grep -E "giga-drain|focus-blast" packages/data/reference/moves.json` (2 IDs moves)
- **Si l'un manque** : `pnpm data:update` (fetch Showdown auto, regen complet)
- **JAMAIS éditer manuellement** `reference/items.json` ni `reference/moves.json` (rule `data.md`)
- Si après `pnpm data:update` un ID reste absent → signaler humain (data Showdown incomplète)

### Étape 2 — Core hook `onStatLowered` (test-writer co-pilote)
- **Tests d'abord** : appeler `test-writer` pour scenarios
  - (a) `white-herb` sur −1 Atk → restore +1 Atk, consomme, event `HeldItemConsumed`
  - (b) No item → noop, pas de crash
  - (c) White-herb déjà consommé → noop second trigger
- Ensuite impl :
  - `held-item-definition.ts` : ajouter interface `StatLoweredContext { pokemon, stat, stages }` + champ `onStatLowered?` dans `HeldItemHandler`
  - `effect-processor.ts` : invoquer `onStatLowered` après application stat-lowering, consume si `result.consumeItem === true`

### Étape 3 — 9 items handlers
- Tests d'intégration par item (mécanique + edge cases)
- `item-definitions.ts` : 9 nouveaux handlers
- `held-item-id.ts` : 9 nouveaux IDs (enum)
- i18n: 9 entries × {fr, en}
- Test spécifique eviolite : Pokemon NFE list (chansey/electabuzz/etc.) → damage reçu ×0.667. Pokemon final → noop.

### Étape 4 — 2 moves
- Tests intégration (giga-drain Drain effect, focus-blast standard low-acc)
- `tactical.ts` : 2 entries

### Étape 5 — MAJ op-sets.json
- **Laisser intact** : `eviolite` (7 sets — débloqués par étape 3) / `heat-rock` (1) / `weather-ball` (2) / `solar-beam` (1)
- `pnpm op-sets:analyze` → confirmer **≥97% `full`** (les 4 weather-related restent `partial` jusqu'à plan 084), 100% atteint post-084
- MAJ `docs/op-sets-gap-analysis.md` (regénéré)

### Étape 6 — Sprites
- Aucun (pas de nouveaux Pokemon)

### Étape 7 — Gate CI
- `pnpm build && pnpm lint:fix && pnpm typecheck && pnpm test && pnpm test:integration`
- `pnpm op-sets:analyze` exit 0

### Étape 8 — Validation visuelle sandbox
- Tester en sandbox chaque nouvel item (4 simples + 4 complexes) sur 1 Pokemon test
- Tester `giga-drain` (heal visible) + `focus-blast` (préc 70%, 10% −1 SpD)

---

## Critères d'acceptation

- [ ] 2 moves implémentés (giga-drain, focus-blast) avec tests intégration verts
- [ ] 9 items implémentés (choice-specs, eviolite, black-sludge, leek, thick-club, white-herb, flame-orb, salac-berry, normal-gem) avec tests intégration verts
- [ ] Nouveau hook `onStatLowered` ajouté à `HeldItemHandler` + tests core
- [ ] `op-sets.json` inchangé (eviolite débloqué via impl, weather-related débloqué plan 084)
- [ ] `pnpm op-sets:analyze` → **≥97% sets `full`** (les 4 weather-related restent `partial` jusqu'à plan 084)
- [ ] `docs/op-sets-gap-analysis.md` regénéré
- [ ] Gate CI verte
- [ ] Validation visuelle sandbox : 8 items + 2 moves OK

---

## Risques

- **`onStatLowered` hook impact effect-processor** : nouvelle invocation point, risk regressions tests existants. Mitigation : test-writer écrit scenarios avant impl, tests existants doivent rester verts.
- **`thick-club` Marowak only — RISQUE ÉQUILIBRAGE** (review game-designer) : ×2 Atk sur 80 base = 160 effectif (~218 stat combat niveau 50). Earthquake STAB 100 BP + Marowak 110 Def = potentiellement le meilleur attaquant physique du roster. **Action** : tracer dans `docs/backlog.md` post-impl pour review playtest. Garder ×2 canonique pour fidelité Pokemon.
- **`choice-specs` Mewtwo/Alakazam/Gengar — surveiller** : Mewtwo 154 SpA + verrou + ×1.5 = nuke spec single-type. Règle doublon item (1/équipe) limite. Playtest Mewtwo en priorité.
- **`black-sludge` non-Poison damage** : −1/8 HP si porteur n'est pas Poison. **Vérifier validation `team-validator`** bloque l'attribution à un non-Poison (sinon edge case build accidentel). Si non bloqué, ajout warning import Showdown.
- **`flame-orb` apply burn first end-turn** : edge case si Pokemon meurt avant fin tour 1. Mitigation : tester KO avant trigger.
- **`flame-orb` + Magic-Guard (Alakazam)** : Brûlure appliquée mais `blocksIndirectDamage` ignore le DOT. Le malus Atk physique de Brûlure n'affecte pas Alakazam (pas d'Atk). Combo inutile mais pas crash. À documenter dans i18n description.
- **`normal-gem` consume flow** : nouveau pattern one-shot move-type bonus. Vérifier interaction `onDamageModify` + `consumeItem`. Mitigation : isoler dans handler avec `wasConsumed` flag dans state. Test : multi-hit move (Double Dard) → consume après 1er hit ou 2e ?

---

## Hors scope (plans ultérieurs)

- **Système Météo** (Soleil/Pluie/Sable/Grêle) → Phase 9 ou plan dédié
- **Système Charge 2-tours** (solar-beam, sky-attack, dig) → plan dédié si jeu requiert
- **`eviolite` Gen 2+** → si on étend roster Gen 2 (NFE Chansey/Magmar/Electabuzz...)
- **Loader runtime OP sets** → plan 084
- **TeamEditScene** → plan 085
- **TeamSelectScene refonte** → plan 086

---

## Décisions

| # | Décision | Justification |
|---|---|---|
| 1 | 2 moves seulement (giga-drain, focus-blast), différer weather-ball + solar-beam | Pas de météo/charge dans le core. Implémenter ces 2 moves seuls = 2 sets, vs créer 2 systèmes = scope creep majeur. |
| 2 | 9 items dont eviolite (NFE Gen 2+ hardcoded), différer heat-rock | Eviolite : 10 mons roster sont NFE en Gen 2+ (chansey, electabuzz, etc.). Hardcoder la liste évite d'élargir le schema Pokemon. Heat-rock dépend météo → plan 084. |
| 3 | Nouveau hook `onStatLowered` au lieu d'élargir un hook existant | White-herb seul use case Gen 1 actuel. Alternatives explorées : (a) hook existant `onEndTurn` scan stats turn précédent → coupling fort sur state timing et perd la réactivité immédiate, (b) appel `onStatChange` (n'existe pas) → ajout équivalent mais signature plus large incorrecte sémantiquement (raise ≠ lowered). Décision : `onStatLowered` spécialisé, pattern réutilisable futur (Defiant ability, Mental Herb-like, etc.). |
| 4 | MAJ `op-sets.json` post-impl pour atteindre 100% `full` | Élimine la friction `partial` pour plans 084-086 (random team gen pioche full). |
| 5 | HeldItemId `stick` (pas `leek`) | Reference `items.json` utilise `stick` (id canonique Gen 3+). Reference est la single source of truth pour les IDs (rule data.md). Op-sets.json (généré par data-miner) initialement contenait `leek` (rename Gen 8) → corrigé en `stick` (2 sets). HeldItemId enum entry `Leek` (TS name) mappe sur `"stick"` (id runtime), display name "Leek" / "Poireau" via reference i18n. |
