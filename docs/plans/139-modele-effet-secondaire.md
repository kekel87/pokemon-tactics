# Plan 139 — Modèle effet secondaire (Sans Limite + Sérénité)

> **Statut** : `implémenté`
> **Branche/worktree** : `talents` (port 5183)
> **Scope** : promouvoir la notion d'« effet secondaire » (déjà présente en runtime) en helper réutilisable, puis implémenter 2 talents attaquant qui la manipulent : **Sans Limite** (`sheer-force`) et **Sérénité** (`serene-grace`). **95 → 97 talents.**

## Contexte

Reporté du plan 138 (§Exclus) : « le moteur n'a pas d'objet secondaire ». **Faux en pratique** — un prédicat runtime existe déjà :

- `isSecondaryEffect(effect, moveHasDamage)` dans `effect-processor.ts:302` : un effet est *secondaire* ssi le move inflige des dégâts **et** l'effet est `Status`/`StatChange` ciblant l'adversaire (`EffectTarget.Targets`) avec `chance < 100`.
- Déjà consommé par **Écran Poudre** (`shield-dust`) via `filterShieldDustTargets` (l.321) : retire les cibles shield-dust des effets secondaires uniquement.

Donc pas de refacto de l'enum `EffectKind`. Le chantier = **extraire/exporter** le prédicat et **brancher 2 talents attaquant** sur lui.

### Les 2 talents

| FR | id | Effet canon (Showdown) | Porteurs Gen-1 |
|----|-----|------------------------|----------------|
| Sans Limite | `sheer-force` | Move avec ≥1 effet secondaire : secondaires **annulés**, puissance **×1.3** | Nidoqueen, Nidoking, Krabby, Krabboss, Tauros |
| Sérénité | `serene-grace` | **Double** la chance de chaque effet secondaire (cap 100 %) | Leveinard |

## Définition retenue de « effet secondaire »

On **réutilise le prédicat existant tel quel** (chance < 100, ciblant l'adversaire, move offensif). Cohérent avec Écran Poudre.

**Divergence assumée vs Showdown** (à acter en décision) : Showdown traite aussi comme « secondaire » (a) les secondaires à 100 % et (b) les auto-boosts secondaires (ex. Charge Beam +AtqSpé). Notre prédicat les **exclut**. Impact Gen-1 : **nul** — aucun move du roster Gen-1 n'a de secondaire 100 % adverse ni d'auto-boost secondaire (ceux-ci sont Gen 4+). On garde la définition étroite ; à élargir si un futur batch en introduit.

## Changements moteur (isolés)

1. **Nouveau module `packages/core/src/battle/secondary-effect.ts`** — extrait `isSecondaryEffect` de `effect-processor.ts` et expose :
   - `isSecondaryEffect(effect: Effect, moveHasDamage: boolean): boolean` (logique identique, déplacée)
   - `moveHasSecondaryEffect(move: MoveDefinition): boolean` (= `move.effects.some(e => isSecondaryEffect(e, moveHasDamage(move)))`, où `moveHasDamage` recalculé en interne)
   - `effect-processor.ts` importe depuis ce module (zéro changement de comportement, juste déplacement). Respecte la règle core « 1 export public = testé unitairement ».

2. **`effect-processor.ts` — accès au talent de l'attaquant** (déjà fait pour `scrappy` l.133) : lire `attackerAbilityId = context.abilityRegistry?.getForPokemon(context.attacker)?.id`.
   - **Sans Limite** : si `attackerAbilityId === "sheer-force"` → **sauter** chaque effet secondaire (vérifier `isSecondaryEffect(effect, moveHasDamage)`) dans la boucle `chanceGroup` (l.181-188) ET boucle d'application (l.190-222). Garder un booléen `hadSecondaryEffect` : si ≥1 secondaire a été sauté, émettre `AbilityActivated` une seule fois après la boucle. Les secondaires supprimés en amont → Écran Poudre n'est jamais atteint (pas de conflit).
   - **Sérénité** : si `attackerAbilityId === "serene-grace"` → **doubler** la `chance` de chaque effet secondaire avant la comparaison du roll, capped à 100. Appliquée à la boucle `chanceGroup` (l.184, doubler `chance` avant l.185) ET à la boucle d'application (l.190-222, doubler `effect.chance` avant vérification). Pas d'`AbilityActivated` (modificateur silencieux, convention multiplicateur).

3. **Talent Sans Limite — boost de puissance** : handler `onDamageModify` attaquant (hook existant, `DamageModifyContext` expose `move` + `isAttacker`) :
   - `if isAttacker && moveHasSecondaryEffect(move) → ×1.3`.
   - Le boost s'applique **que le secondaire ait pu procéder ou non** (canon : il dépend de l'existence du secondaire, pas de son tirage). Cohérent avec la suppression en (2) : on supprime le secondaire **et** on boost, sur le même critère `moveHasSecondaryEffect`.

> **Pattern id-check vs hook typé** : Sans Limite (suppression) et Sérénité (doublement) sont des portes **internes au processeur** sur le talent de l'attaquant — exactement analogues à `scrappy` (l.133) et `shield-dust` (l.334), déjà en id-check. On **mirror ce pattern** (id-check dans `effect-processor.ts`) plutôt qu'introduire de nouveaux hooks typés `onSecondary*`. Le seul vrai hook est `onDamageModify` pour le ×1.3 de Sans Limite. Décision à acter.

## Interactions tranchées

- **Sans Limite × Écran Poudre** : secondaire supprimé en amont (attaquant) → shield-dust jamais atteint. Pas de double comptage.
- **Sérénité × objet flinch** (Roche Royale / Croc Rasoir, l.260) : **non affecté** (canon Showdown — la chance d'apeurer des objets n'est pas doublée par Sérénité). Le bloc item flinch reste tel quel.
- **Sérénité × chanceGroup** : un seul roll partagé par le groupe (l.180-188) → doubler la `chance` avant le roll à l.184-185, memoïser le résultat. Lors de la boucle 2, relire le memoïsé (doublement appliqué une fois). Important : si plusieurs effects du même groupe sont secondaires, ils partagent le roll doublé.
- **Sans Limite × recul Vie/objets** (Life Orb…) : N/A — non implémenté dans le roster. Hors scope.

## Émission d'événements

- Sans Limite : `AbilityActivated` (attaquant) une fois si le move avait ≥1 secondaire (supprimé). Le ×1.3 reste silencieux (convention multiplicateur `onDamageModify`).
- Sérénité : silencieux (doublement de chance, convention multiplicateur).

## Tests (test-first par mécanique)

`packages/core/src/battle/abilities.integration.test.ts` :
- **Sérénité** : move 30 % flinch → flinch posé avec un PRNG à 0.5 (échouerait à 30 %, passe à 60 %) ; auto-effet (Self) **non** doublé ; secondaire d'allié non affecté. Test `chanceGroup` : move avec 2+ effects de StatChange dans le même groupe → chance doublée une seule fois.
- **Sans Limite** : move avec ≥1 secondaire → tous les secondaires jamais appliqués (jamais atteint même `filterShieldDustTargets`) + **une seule** `AbilityActivated` ; dégâts ×1.3 vs même move sans le talent ; move **sans** secondaire → ni boost ni `AbilityActivated`. Cas multi-secondaires : un move avec 2+ effets secondaires → **une seule** `AbilityActivated` (pas une par secondaire).
- Unitaire `secondary-effect.test.ts` : table de vérité du prédicat extrait + `moveHasSecondaryEffect` (move dégât+secondaire = true, move statut pur = false, secondaire 100 % = false, secondaire Self = false).
- Non-régression Écran Poudre (suite existante doit rester verte après extraction).

## e2e (observable)

1-2 scénarios sandbox : (a) Sans Limite — Nidoking frappe, dégâts visiblement supérieurs + jamais d'effet secondaire ; (b) Sérénité — Leveinard avec un move flinch, apeurement fréquent. Config minimale, Dummy en cible.

## OP sets

data-miner : ajouter les sets concernés si pertinents (Nidoking Sans Limite notamment). À évaluer en fin d'impl.

## Ordre d'implémentation

1. Extraire `secondary-effect.ts` + tests unitaires + non-régression Écran Poudre (core-guardian).
2. Talent Sérénité (doublement chance dans processeur + test intégration).
3. Talent Sans Limite (suppression processeur + `onDamageModify` ×1.3 + test intégration).
4. i18n FR/EN noms + descriptions des 2 talents.
5. e2e + gate complet + commit.

## Décisions de design à acter (decisions.md)

- **Définition étroite de « secondaire »** (chance < 100, adversaire) conservée vs Showdown (inclut 100 % + auto-boost). Justif : impact Gen-1 nul, cohérence Écran Poudre.
- **Pattern id-check** dans `effect-processor.ts` (mirror scrappy/shield-dust) plutôt que nouveaux hooks typés.
- **Sérénité n'affecte pas** la chance d'apeurer des objets (Roche Royale / Croc Rasoir).
