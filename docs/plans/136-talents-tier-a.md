# Plan 136 — Talents Tier A (batch 11 talents)

> **Statut** : `implémenté` — 11 talents livrés. Brise Moule (mold-breaker) exclu → plan séparé. Multi-Coups (skill-link) initialement différé, finalement inclus dans ce plan.
> **Branche/worktree** : `talents-tier-a` (port 5183)
> **Scope** : 11 talents Gen 1 manquants. **Exclut Brise Moule** (mold-breaker, refacto transverse ~20-30 call-sites → plan séparé).

## Contexte

52 talents implémentés. 61 talents Gen 1 manquants (cf. feasibility session). On attaque le "Tier A" (les plus autonomes). La classif initiale supposait un moteur standard ; le feasibility montre 3 sous-groupes par coût réel.

Régé-Force (regenerator) canon = soin 1/3 PV **au retrait**. Le jeu tactique n'a **pas de switch/banc** (seul un repositionnement hit-and-run existe). Décision humain : **option C** — réinterpréter en soin passif fin de tour (~1/16 PV) via `onEndTurn`.

## Découpage par coût moteur

### Groupe 1 — Drop-in (0 change moteur) — 4 talents
Hooks existants (`onDamageModify`, `onEndTurn`), data déjà présente.

| Talent FR | id | Hook | Effet |
|-----------|-----|------|-------|
| Téméraire | reckless | `onDamageModify` (attaquant) | +20% si move a effet `EffectKind.Recoil` |
| Rivalité | rivalry | `onDamageModify` (attaquant) | ×1.25 même genre, ×0.75 genre opposé, ×1 si un genderless (`self.gender`/`opponent.gender` présents) |
| Lentiteintée | tinted-lens | `onDamageModify` (attaquant) | si `effectiveness < 1` → ×2 (0.5→1.0) |
| Régé-Force | regenerator | `onEndTurn` | soin `ceil(maxHp/16)`, émet `AbilityActivated` + `HpRestored` |

### Groupe 2 — Plomberie `isCrit` (petit change moteur) — 2 talents
Le flag `isCrit` est calculé dans `damage-calculator.ts` mais **pas exposé** aux contextes d'ability.

**Change moteur** :
- Ajouter `isCrit: boolean` à `DamageModifyContext` (→ Sniper) et `AfterDamageContext` (→ Colérique).
- Threader la valeur depuis `damage-calculator.ts` / `handle-damage.ts` jusqu'aux call-sites des hooks.

| Talent FR | id | Hook | Effet |
|-----------|-----|------|-------|
| Sniper | sniper | `onDamageModify` (attaquant) | si `isCrit` → ×1.5 (stack multiplicatif : 1.5×1.5 = 2.25) |
| Colérique | anger-point | `onAfterDamageReceived` | si `isCrit` → Attaque à +6 stages, émet `AbilityActivated` + `StatChanged` |

### Groupe 3 — Nouveau hook `onAfterStatLowered` — 2 talents
Aucun hook "ma stat vient d'être baissée par l'adversaire" (existe pour items via `loweredPokemonIds`, pas pour abilities).

**Change moteur** :
- Nouveau type `StatLoweredContext { self, stat, stages, source }`.
- Nouveau hook `onAfterStatLowered?: (ctx) => BattleEvent[]` sur `AbilityHandler`.
- Invoqué dans `handle-stat-change.ts` **après** application réussie d'une baisse d'origine adverse (`source && source.playerId !== self.playerId`).

| Talent FR | id | Effet |
|-----------|-----|-------|
| Acharné | defiant | baisse de stat par adversaire → Attaque +2 |
| Battant | competitive | baisse de stat par adversaire → Atq. Spé +2 |

### Groupe 4 — Modérés isolés — 3 talents

| Talent FR | id | Change moteur |
|-----------|-----|---------------|
| Inconscient | unaware | `damage-calculator` : param `ignoreOpponentStatStages`. Si l'attaquant a unaware → ignore les stages Déf/DéfSpé de la cible ; si le défenseur a unaware → ignore les stages Atq/AtqSpé de l'attaquant. Lu via registry avant calc. |
| Querelleur | scrappy | bypass immunité **côté attaquant** : `effect-processor.ts`, si attaquant=scrappy et `moveType ∈ {Normal, Fighting}` et cible=Ghost → forcer effectiveness non-nul (ignore l'immunité de type Spectre). Nouveau hook attaquant `onIgnoreTypeImmunity?` ou check inline. |
| Multi-Coups | skill-link | moves multi-frappes = max de hits. `handle-damage.ts` `rollMultiHitCount` : si attaquant=skill-link → retourner `max`. Hook `onHitCountModify?` ou check inline du registry. Moves concernés existent (Charge-Os, Balle Graine, Furie, Combo-Griffe, Picanon, Lance-Roc, Météores, Pilonnage…). |

## Assignation = automatique (pas d'override)

Le team builder (`team-builder-catalog.ts`) expose les **3 slots** de chaque Pokemon (`primary`, `secondary`, `hidden`, l.203-206), chacun gaté par `implemented = isAbilityImplemented(id, abilityHandlers)` (l.98).

**→ Implémenter le handler suffit.** Le talent devient sélectionnable dans le team builder pour tout Pokemon qui l'a dans un slot (Tauros→Colérique en slot2, Flagadoss→Régé-Force en caché, etc.). Aucun override `custom.abilityId`, aucune décision balance.

## Ordre d'implémentation

1. **Groupe 1** (drop-in) — 4 handlers + tests intégration. Aucun risque moteur.
2. **Groupe 2** (isCrit) — change contextes + threading, puis 2 handlers + tests.
3. **Groupe 3** (onAfterStatLowered) — nouveau hook + call-site, puis 2 handlers + tests.
4. **Groupe 4** (unaware, scrappy, skill-link) — 3 changes moteur isolés + handlers + tests.
5. Enregistrer les 11 dans `abilityHandlers[]` → auto-exposés dans le team builder.
6. Doc : `docs/implementations.md` (+11), `docs/abilities-system.md` (tableau tests + précisions VGC).

## Tests (test-first par mécanique)

`packages/core/src/battle/abilities.integration.test.ts` — par talent :
- effet gameplay (multiplicateur/blocage/heal/stat appliqué)
- émission `AbilityActivated` quand visible (drop-in dégâts = silencieux par convention ; Colérique/Acharné/Battant/Régé-Force = visibles)

## Risques / points ouverts
- Querelleur/Multi-Coups : confirmer movepool réel des Pokemon porteurs (sinon talent sélectionnable mais jamais déclenché en pratique).
- `onAfterStatLowered` : ne pas déclencher sur auto-baisses (Coup-Bas etc.) ni baisses alliées → gate sur `source.playerId !== self.playerId`.
- Inconscient : bien gérer les 2 sens (attaque ET défense).
