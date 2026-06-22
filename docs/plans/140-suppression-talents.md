# Plan 140 — Brise Moule (suppression de talent relationnelle)

> **Statut** : `implémenté`
> **Branche/worktree** : `talents` (port 5183)
> **Scope** : implémenter **Brise Moule** (`mold-breaker`) — pendant l'attaque du porteur, les talents **cassables** (`breakable`) de la cible sont ignorés. **97 → 98 talents.**
> **Reportés hors-scope** :
> - **Gaz Inhibiteur** (`neutralizing-gas`) → reporté (aucun porteur Gen-1 natif légal — seul Smogogo de Galar, hors roster ; reprendre avec un porteur Gen 8+). Décision humaine 2026-06-22 → noté `docs/next.md`.
> - **Imposteur** (`imposter`) → batch Métamorph/Morphing dédié (clonage d'état).

## Contexte

Brise Moule (du plan 138 §Exclus) désactive les talents **cassables** de la cible le temps de l'attaque du porteur. Mécanique **relationnelle** (dépend de l'attaquant ET de la cible), pas globale → pas de wrapper de registry, juste un helper de résolution défensive (mirror du pattern `scrappy`).

### État du code (audit, validé plan-reviewer)

- **Point de résolution** : `AbilityHandlerRegistry.getForPokemon(pokemon)` (`ability-handler-registry.ts:15`). Les sites défensifs y passent via `context.abilityRegistry?.getForPokemon(target)`.
- **Précédent id-check** : `scrappy` (`effect-processor.ts:133`, `handle-damage.ts:262`) — pattern à mirror.
- **Flag `breakable` déjà correct** : `packages/data/reference/abilities.json` porte `flags.breakable` correctement renseigné (80/311 à `true` ; `levitate`/`sturdy`/`thick-fat`/`shield-dust` = `true`, `static`/`technician`/`adaptability` = `false`). ⚠️ Le flag est sous `entry.flags.breakable`, **pas** top-level. Reste juste à l'**injecter** dans `AbilityDefinition` via `load-abilities.ts` (comme nom/desc). Pas de fix d'extraction.

## Décisions de design (à acter dans decisions.md)

### D1 — id-check relationnel piloté par le flag `breakable`

À chaque **site défensif** où l'on lit le talent de la **cible pendant l'attaque**, si `attaquant a mold-breaker` ET `talent cible est breakable` → traiter le talent cible comme absent.

Helper dans nouveau module `packages/core/src/battle/ability-suppression.ts` :
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

⇒ **prérequis** : exposer `breakable` sur `AbilityHandler`/`AbilityDefinition` (champ déclaratif injecté par `load-abilities.ts` depuis la reference, comme nom/desc) **ET réparer l'extraction** (D2).

**Sites défensifs à migrer** (talent lu = CIBLE pendant l'attaque) — liste validée plan-reviewer :
| Site | Talents cassables touchés |
|------|---------------------------|
| `effect-processor.ts:118` `onMoveImmunity` | Anti-Bruit, Envelocape |
| `effect-processor.ts:144` `onTypeImmunity` | Lévitation, Absorbe-Eau/Volt, Torche, Peau Sèche (Eau), Paratonnerre |
| `effect-processor.ts:358/359` `shield-dust` (filtre Écran Poudre sur secondaires) | Écran Poudre — **option A**, voir ci-dessous |
| `damage-calculator.ts:82` `defenderAbility` (onDamageModify déf + `preventsCrit`) | Isograisse, Filtre, Multiécaille, Écaille Spéciale, Peau Sèche (Feu), Armurbaston/Coque Armure (crit) |
| `handle-damage.ts:246` `targetAbility` (Fermeté/Multiécaille survie) | Fermeté, Multiécaille |
| `handle-status.ts:82` `targetAbility` (onStatusBlocked) | Vaccin, Échauffement, Ignifu-Voile, Esprit Vital, Insomnia, Feuille Garde, Benêt |
| `handle-stat-change.ts:27` `onStatChangeBlocked` | Corps Sain, Regard Vif, Hyper Cutter, Cœur de Coq, Tempo Perso |
| `accuracy-check.ts:63/71` `onEvasionModify` déf + `weatherEvasionBoost` déf | Voile Sable, Rideau Neige, Pieds Confus, Peau Miracle |

**Écran Poudre (shield-dust) — option A retenue** : `effect-processor.ts:358-359` est une vraie lecture défensive mais utilise un id-check direct (`ability?.id === "shield-dust"`). On le convertit en `resolveDefensiveAbility(registry, target, attacker)` → cohérence + Écran Poudre devient cassable par Brise Moule (canon : shield-dust est `breakable`).

**Sites `getForPokemon(target)` à NE PAS migrer** (attacker-side ou contexte météo, non défensifs — plan-reviewer) :
- `initiative-calculator.ts:40`, `accuracy-check.ts:42`, `BattleEngine.ts:2586`, `handle-heal-self.ts:43` : suppression météo.
- `pressure.ts:32` : anti-Pression (attacker-side).

**Hors-scope Brise Moule (réactifs non cassables, automatique via flag)** : Statik, Corps Ardent, Pose Spore, Boom Final, Synchro — `breakable: false` ⇒ continuent de se déclencher (canon : Mold Breaker n'empêche que les talents qui *gênent l'exécution* du move, pas les ripostes au contact).

**Levitation directe** : `effective-flying.ts:33` lit `abilityId === "levitate"` hors registry. L'immunité Sol passe par `onTypeImmunity` (`effect-processor.ts:144`) — déjà couvert par `resolveDefensiveAbility` ⇒ Brise Moule + Séisme touche un Lévitation. **`effective-flying.ts` reste inchangé** (Brise Moule ne concerne que l'exécution du move offensif, pas le déplacement/terrain de la cible).

### D2 — Injecter le flag `breakable` (déjà correct dans la reference)

**Pas de fix d'extraction** : `abilities.json` porte déjà `flags.breakable` correct (vérifié data-miner : 80 talents `true`). Reste à exposer ce flag sur `AbilityDefinition` en l'injectant dans `load-abilities.ts` : `breakable: ref.flags.breakable`. Le helper `resolveDefensiveAbility` lit `ability.breakable`.

### D3 — Brise Moule silencieux

Pas d'`AbilityActivated` (décision humaine 2026-06-22). Cohérent avec scrappy/infiltrator (markers silencieux). Le joueur voit l'effet (le move touche/passe).

## Porteur Gen-1 (confirmé)

- **Brise Moule** : Scarabrute (`pinsir`) — talent 2 légal (`pokemon-by-ability.json`). data-miner ajoute un OP set si pertinent.

## Changements moteur

1. **Nouveau module `packages/core/src/battle/ability-suppression.ts`** : `resolveDefensiveAbility`. Tests unitaires (règle core : 1 export public = testé). Export depuis `index.ts`.
2. **Type** : ajouter `breakable?: boolean` à `AbilityHandler`/`AbilityDefinition` (`packages/core/src/types/ability-definition.ts`) + injection dans `load-abilities.ts` depuis la reference.
3. **Migration des 8 sites défensifs** vers `resolveDefensiveAbility` (D1, table ci-dessus), shield-dust inclus (option A).
4. **Handler data** : `moldBreaker: AbilityHandler = { id: "mold-breaker" }` (marker, logique en core). Ajout au tableau `abilityHandlers`. Retirer `mold-breaker` de l'exemple « unimplemented » de `implementation-flags.test.ts` (remplacer par `imposter`, toujours non implémenté).

## Tests (test-first)

`abilities.integration.test.ts` :
- **Brise Moule** : (a) Lévitation ignorée → Séisme touche un porteur Lévitation ennemi ; (b) Fermeté ignorée → OHKO passe ; (c) Corps Sain ignoré → baisse de stat appliquée ; (d) talent **non-cassable** (Statik) **toujours actif** → paralysie au contact malgré Brise Moule ; (e) attaquant **sans** Brise Moule → Lévitation bloque (témoin).
- **Unitaire `ability-suppression.test.ts`** : `resolveDefensiveAbility` (mold-breaker + breakable → undefined ; mold-breaker + non-breakable → présent ; pas de mold-breaker → présent ; registry/ability absent → undefined).
- **Non-régression** : suites scrappy/infiltrator/shield-dust vertes après migration.

## e2e (observable)

1 scénario sandbox : Brise Moule — Scarabrute frappe un Pokémon Lévitation avec un move Sol → dégâts infligés (vs normalement immunisé). Dummy en cible, config minimale.

## Ordre d'implémentation

1. data-miner : réparer extraction `breakable` + re-générer + vérifier échantillon (D2). Confirmer porteur Scarabrute + OP set.
2. Type `breakable` + injection `load-abilities` + module `ability-suppression.ts` + tests unitaires.
3. Migration 8 sites défensifs vers `resolveDefensiveAbility` + tests intégration + non-régression.
4. Handler `mold-breaker` + fix `implementation-flags.test.ts`.
5. i18n (auto via abilities.json) + e2e + gate + commit.

## Décisions de design à acter (decisions.md)

- **Brise Moule = id-check relationnel** (mirror scrappy) piloté par le flag `breakable`, pas de wrapper global.
- **Réparer l'extraction `breakable`** (bug `build-reference.ts`) plutôt que hardcoder (fallback liste curée si blocage).
- **Écran Poudre cassable par Brise Moule** (option A, conversion vers `resolveDefensiveAbility`).
- **Brise Moule silencieux** (pas d'`AbilityActivated`).
- **Gaz Inhibiteur reporté** (pas de porteur Gen-1 légal).
