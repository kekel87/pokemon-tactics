# Plan 151 — Misc Batch A : manipulation de coups critiques

**Statut : done** (implémenté 2026-07-05)
**Créé : 2026-07-05**
**Objectif : 475 → 480 moves** (5 nouveaux) — atteint

## Contexte

Premier des 5 batches du chantier **Misc volatile / utility** (~25 moves restants, roadmap
§Phase 4). Découpage validé humain 2026-07-05 : 1 batch = 1 cluster d'infra, 1 plan, 1 commit,
validation entre chaque. Ordre : **A crit → B dégâts utilitaires → C manip talent → D buff/statut →
E grille-problématiques**.

Batch A = tous les moves dont l'identité repose sur les **coups critiques** : booster son taux de
crit, garantir un crit, ignorer les défenses adverses, frapper toujours critique. Cluster naturel
car ils touchent tous le même point du `damage-calculator` (bloc crit, lignes 154-161).

L'infra crit **existe déjà partiellement** :
- `PokemonInstance.critStageBoost?: number` (volatile, posé aujourd'hui **uniquement** par la Baie
  Lansat via le hook item `onCritStageBoost` — jamais par un move), lu en `damage-calculator.ts:156`.
- Table `CRIT_THRESHOLDS = [1/24, 1/8, 1/2, 1.0]` → cran 0 = 1/24, cran 1 = 1/8, cran 2 = 1/2,
  cran 3 = garanti.
- Crit ignore déjà les crans défensifs **négatifs** de la cible : `critDefenseStage = isCrit ?
  Math.max(0, defenseStageForCalc) : defenseStageForCalc` (ligne 159).

## 5 moves

| Move (FR) | id EN | Type | Cat. | BP | Ciblage | Mécanique |
|-----------|-------|------|------|----|---------|-----------|
| **Puissance** | `focus-energy` | Normal | Statut | — | Self | crans de crit **+2** (volatile persistant) |
| **Affilage** | `laser-focus` | Normal | Statut | — | Self | **prochain coff. offensif = crit garanti** (one-shot) |
| **Cri Draconique** | `dragon-cheer` | Dragon | Statut | — | Ally r? | allié : crans de crit **+1** (**+2 si l'allié est de type Dragon**) — one-shot |
| **Yama Arashi** | `storm-throw` | Combat | Phys | 60 | Single 1-1 contact | **crit garanti** (`alwaysCrit`) |
| **Dark Lariat** | `darkest-lariat` | Ténèbres | Phys | 85 | Single 1-1 contact | **ignore les crans défensifs de la cible** (Déf/Déf.Spé, les 2 signes) |

> Ciblages/portées à **figer par `move-pattern-designer`** (notamment la portée allié de Cri
> Draconique, et confirmer Single 1-1 contact pour Yama Arashi / Dark Lariat).

## In-pool vs hors-pool (Gen 1)

- **Puissance / `focus-energy`** = move Gen 1 (TM48 RBY) → **in-pool**, nombreux learners du roster.
- **Affilage / `laser-focus`** (Gen 7), **Cri Draconique / `dragon-cheer`** (Gen 9),
  **Yama Arashi / `storm-throw`** (Gen 5), **Dark Lariat / `darkest-lariat`** (Gen 7) = **0 learner
  Gen 1** → codés par complétude (injouables en Team Builder pour l'instant, prêts futures gens).
  Précédent : Bec-Canon / Carapiège (plan 150).

## Décisions design (à valider humain)

1. **Cri Draconique — variance Dragon** : +1 crans par défaut, **+2 si l'allié ciblé est de type
   Dragon** (canon Gen 9). Le handler lit le type effectif de l'allié (respecte `typeOverride`).
2. **Affilage vs Puissance — lifetime distinct** : Puissance = crans persistants (`critStageBoost`,
   empilable, survit jusqu'au KO). Affilage = **one-shot** consommé au prochain move offensif du
   lanceur, quel que soit son crit stage → **volatile booléen dédié** `guaranteedCritArmed`, PAS un
   cran de crit (sinon il persisterait / s'empilerait mal avec Puissance).
3. **Empilement Puissance + Affilage** : compatibles. Affilage garantit le prochain coup ; Puissance
   reste posée pour les suivants. (Canon : idem.)
4. **Dark Lariat** : ignore les crans Déf/Déf.Spé de la cible **dans les deux sens** (annule un −2
   défensif *et* un +2 défensif). Canon = ignore les *changements* de stat défensive. Implémenté en
   forçant `defenseStageForCalc = 0` avant le calcul crit.
5. **Yama Arashi `alwaysCrit`** : crit forcé, mais **`preventsCrit` (Coque Armure / Muscle Coque)
   annule toujours** (l'immunité au crit prime, canon).
6. **OP sets** : Puissance est niche compétitivement (support). **Pas d'OP set** dans ce plan (les 4
   autres sont hors-pool). Couverture Team Builder libre suffit. `data-miner` pourra en ajouter plus
   tard si besoin.

## Infra core à ajouter

### Types / enums
- `PokemonInstance.guaranteedCritArmed?: boolean` (volatile one-shot, Affilage).
- `MoveDefinition.alwaysCrit?: boolean` (Yama Arashi).
- `MoveDefinition.ignoresDefensiveStages?: boolean` (Dark Lariat).
- 2 `EffectKind` :
  - `RaiseCritStage` (`raise_crit_stage`) — `{ stages: number }`, cible self (Puissance) ou ally
    (Cri Draconique, avec bonus Dragon calculé dans le handler).
  - `ArmGuaranteedCrit` (`arm_guaranteed_crit`) — pose `guaranteedCritArmed = true` sur le lanceur
    (Affilage).

### Handlers
- `battle/handlers/raise-crit-stage.ts` — incrémente `target.critStageBoost` de `stages`
  (cap raisonnable, ex. 6 comme les crans de stat) ; pour Cri Draconique, +1 supplémentaire si la
  cible allié est Dragon (type effectif).
- `battle/handlers/arm-guaranteed-crit.ts` — `caster.guaranteedCritArmed = true`.

### damage-calculator.ts (bloc crit, ~ligne 154-161)
- **Dark Lariat** : avant le calcul, si `move.ignoresDefensiveStages` → `defenseStageForCalc = 0`.
- **Crit forcé** : `isCrit = defenderAbility?.preventsCrit ? false : (move.alwaysCrit ||
  attacker.guaranteedCritArmed || random() < getCritChance(totalCritStage))`.

### BattleEngine
- **Consommation Affilage** : après un move offensif (`power > 0`) du lanceur qui a résolu des
  dégâts, remettre `guaranteedCritArmed = undefined`. Site : à côté de la consommation des autres
  volatiles one-shot post-move.
- **Cleanup KO** : ajouter `pokemon.guaranteedCritArmed = undefined` là où `critStageBoost` est déjà
  réinitialisé (`BattleEngine.ts:3311`).

## Renderer / UX
- **InfoPanel** : badge volatile « Puissance » si `critStageBoost > 0` (n° de crans) ;
  « Affilage » si `guaranteedCritArmed`.
- **MoveTooltip** : tags — `☆ Crit +2` (Puissance), `☆ Crit garanti` (Affilage / Yama Arashi),
  `☆ Crit allié` (Cri Draconique), `⚔ Ignore défenses` (Dark Lariat). (Icônes à finaliser.)
- **BattleLog / floating** : ligne à l'application des crans crit (réutiliser le pattern des autres
  volatiles). Le crit lui-même est déjà rendu (« Coup critique ! »).
- i18n FR/EN : clés move name/desc (déjà dans `moves.*.json`), tooltip tags, badges InfoPanel,
  ligne journal.

## IA
- `scoreSelfMove` : Puissance / Affilage = léger bonus en ouverture (comme les setups), malus si
  déjà posé. Cri Draconique = bonus si allié offensif adjacent. Yama Arashi / Dark Lariat passent
  par le scoring dégâts standard (crit garanti / ignore-défense = déjà valorisés via les dégâts
  estimés si `estimateDamage` en tient compte — sinon garde-fou minimal, heuristique fine reportée
  passe IA groupée). **Reporté** : valorisation fine (déni de setup défensif adverse pour Dark
  Lariat, etc.).

## Tests
- Unit core : `moves/{focus-energy,laser-focus,dragon-cheer,storm-throw,darkest-lariat}.test.ts`
  + `crit-manip.integration.test.ts` (Puissance empile → 1/2 puis garanti ; Affilage one-shot
  consommé ; Cri Draconique +1/+2 Dragon ; Yama Arashi toujours crit sauf `preventsCrit` ; Dark
  Lariat ignore +2/−2 Déf cible ; cleanup KO).
- e2e Playwright : **reporté** (via `test-writer` + cahier `docs/test-plan.md` §5), non bloquant.

## Ordre d'implémentation
1. Types/enums (`guaranteedCritArmed`, `alwaysCrit`, `ignoresDefensiveStages`, 2 EffectKind).
2. Handlers `raise-crit-stage` + `arm-guaranteed-crit` (enregistrés dans le registry).
3. damage-calculator : Dark Lariat + crit forcé (`alwaysCrit` / `guaranteedCritArmed`).
4. BattleEngine : consommation Affilage post-move + cleanup KO.
5. tactical.ts : 5 entrées (targeting figé par `move-pattern-designer`).
6. Renderer : tooltip tags + badges InfoPanel + journal + i18n.
7. IA : garde-fous scoreSelfMove.
8. Tests unit + intégration. Gate CI.

## Reporté
- e2e Playwright (test-writer).
- Heuristiques IA fines (passe IA groupée).
- OP sets Puissance (data-miner, si besoin).
