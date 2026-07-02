# Plan 146 — Famille Stat/state manip (reset / copie / inversion / échange de crans)

**Statut** : done
**Date** : 2026-07-02
**Worktree suggéré** : `stat-state-manip`
**Périmètre** : 8 moves — 444 → 452

## Objectif

Implémenter la manipulation des **crans de stats** (stat stages) partagés entre
Pokémon : reset, copie, inversion, échange. Aucune de ces primitives n'existe
aujourd'hui — le seul précédent structurel est **Baton Pass**
(`handleTransferStatStages`, plan 093) qui lit/écrit `statStages` des deux
Pokémon et recompute `derivedStats.movement`. Permuvitesse introduit en plus un
**override de la stat Vitesse brute** par-instance (mirror `typeOverride` du
plan 143).

Moves livrés :

| FR | ID | Cat | Cible | Effet | Learners roster |
|----|----|-----|-------|-------|-----------------|
| Buée Noire | `haze` | Statut Glace | zone r3 auto-centrée | reset les crans de **tous** les Pokemon (alliés+ennemis+lanceur) dans un diamant Manhattan r3 | 32 |
| Boost | `psych-up` | Statut Normal | ennemi 1-3 | le lanceur **copie** les crans de la cible | 23 |
| Bain de Smog | `clear-smog` | Poison Spé 50 | ennemi (offensif) | dégâts **puis** reset les crans de la cible | 5 |
| Renversement | `topsy-turvy` | Statut Ténèbres | ennemi 1-3 | **inverse** le signe de tous les crans de la cible (+2 → −2) | 0 (hors-pool) |
| Permugarde | `guard-swap` | Statut Psy | ennemi 1-3 | **échange** les crans Déf + Déf Spé lanceur↔cible | 5 |
| Permuforce | `power-swap` | Statut Psy | ennemi 1-3 | **échange** les crans Atq + Atq Spé lanceur↔cible | 7 |
| Permuvitesse | `speed-swap` | Statut Psy | ennemi r1 | **échange la Vitesse brute** lanceur↔cible (Gen 7, pas les crans) | 3 |
| Permucœur | `heart-swap` | Statut Psy | ennemi r1 | **échange** les 7 crans lanceur↔cible | 0 (hors-pool) |

**Décisions validées humain (2026-07-02)** :
- Périmètre = 8 moves (garder les 2 hors-pool pour couverture Team Builder libre).
- Permuvitesse = **canon** (échange la stat Vitesse réelle, pas le cran).
- Buée Noire = **zone diamant r3 auto-centrée** (mirror « pleine arène » → r3
  du plan 145 ; seule la météo reste full-arène).

## Infra core existante (à réutiliser)

- `PokemonInstance.statStages: Record<StatName, number>` (`types/pokemon-instance.ts:29`).
  `StatName` = `hp | attack | defense | spAttack | spDefense | speed | accuracy | evasion`
  (`enums/stat-name.ts`) — 7 stats crantées (hp jamais).
- `clampStages(current, change)` −6..+6 (`battle/stat-modifier.ts:22`).
- `TRANSFERABLE_STATS` = les 7 stats non-HP (`battle/handlers/baton-pass-stats.ts:3`).
- `handleTransferStatStages` (`battle/handlers/handle-transfer-stat-stages.ts`) —
  **template** : lit/écrit les deux `statStages`, émet `StatChanged` par delta,
  recompute `computeMovement` si Vitesse touchée.
- `computeMovement(baseSpeed, speedStages)` (`stat-modifier.ts:42`). À rappeler
  après toute mutation du cran ou de la Vitesse : `pokemon.derivedStats.movement =
  computeMovement(<base>, pokemon.statStages[Speed])`.
- **ctGain n'est PAS stocké** : recalculé au scheduling (`BattleEngine.ts:3130-3140`
  via `computeCtGain` lisant `baseStats.speed` + cran Vitesse frais + inversion
  Distorsion). Un changement de cran Vitesse ou de Vitesse brute y coule
  automatiquement — seule `derivedStats.movement` demande un recompute manuel.
- `EffectKind.StatChange` + `handleStatChange` (`handlers/handle-stat-change.ts`)
  gèrent déjà le pipeline de blocage (talents défensifs, Clear Amulet, aura Brume,
  Clone) + riposte Défiant/Rivalité. **Ne pas dupliquer** ce pipeline pour un
  reset/swap/copy — voir § Blocage ci-dessous.

## Nouveau champ d'instance — override Vitesse brute (Permuvitesse)

`PokemonInstance.speedStatOverride?: number` (`types/pokemon-instance.ts`).
- Mirror du pattern `typeOverride` (plan 143) : override par-instance, persistant
  jusqu'à la fin du combat (pas de switch dans le jeu → survit à la téléportation
  forcée), reset au KO.
- **2 chemins de lecture de la Vitesse brute à router** via un helper
  `effectiveBaseSpeed(pokemon) = pokemon.speedStatOverride ?? pokemon.baseStats.speed` :
  1. `computeMovement(effectiveBaseSpeed(p), p.statStages[Speed])` — appelé après
     tout changement de Vitesse, **3 sites** : Entry Hazards (`BattleEngine.ts:2329`),
     Baton Pass (`handle-transfer-stat-stages.ts:59-63`), StatChange générique
     (`handle-stat-change.ts:98`). Les nouveaux handlers stat-manip ajoutent leurs
     propres appels.
  2. `getCtGainForPokemon` → `computeCtGain(baseStat, stages)`
     (`BattleEngine.ts:3129-3137`) : remplacer la lecture `baseStats.speed`
     (ligne 3129) par `effectiveBaseSpeed`.
  Audit grep `baseStats.speed` en clôture pour confirmer 0 lecture directe
  résiduelle sur ces deux chemins (les autres usages de `baseStats.speed`, ex.
  affichage InfoPanel, restent sur la valeur de base — l'override n'affecte que
  déplacement + ordre de tour, canon).
- **À la pose** : Permuvitesse échange `effectiveBaseSpeed(caster)` ↔
  `effectiveBaseSpeed(target)` en posant `speedStatOverride` sur les deux, puis
  recompute `derivedStats.movement` des deux.

## EffectKinds + handlers

Nouveaux `EffectKind` (`enums/effect-kind.ts`) + variantes `Effect`
(`types/effect.ts`). Regrouper les handlers dans `battle/handlers/stat-manip/`
(1 EffectKind = 1 handler, règle `core.md`) + helper partagé
`applyStageWrite(pokemon, stat, value) → BattleEvent[]` (écrit le cran clampé,
émet `StatChanged` avec le delta, recompute `movement` si Speed).

| EffectKind | Move | Variante | Comportement |
|-----------|------|----------|--------------|
| `ResetStatStages` | Buée Noire, Bain de Smog | `{ target: EffectTarget; area?: { radius } }` | met à 0 tous les crans de la/des cible(s). `area` présent → itère les occupants du diamant r3 (Buée Noire) ; absent → cible unique (Bain de Smog) |
| `CopyStatStages` | Boost | `{}` | `caster.statStages ← { ...target.statStages }` (les 7) |
| `InvertStatStages` | Renversement | `{}` | `target.statStages[s] = -target.statStages[s]` (les 7) |
| `SwapStatStages` | Permugarde / Permuforce / Permucœur | `{ stats: StatName[] }` | échange `caster.statStages[s] ↔ target.statStages[s]` pour `s ∈ stats`. guard = `[defense, spDefense]`, power = `[attack, spAttack]`, heart = les 7 |
| `SwapRawSpeed` | Permuvitesse | `{}` | échange `effectiveBaseSpeed` via `speedStatOverride`, recompute movement des deux |

**Buée Noire — accès plateau depuis le handler.** Le handler `ResetStatStages`
avec `area` a besoin de la liste des Pokémon vivants + leurs positions dans le
rayon. Vérifier ce que `EffectContext` (`effect-handler-registry.ts:22`) expose
déjà (le pipeline stat-change accède au registry ; les zones/hazards sont des
systèmes engine-level, pas des handlers). **Deux options, à trancher au refacto** :
- (a) étendre `EffectContext` avec `pokemonInRadius(center, radius) →
  PokemonInstance[]` (helper Manhattan réutilisant `enumerateZoneTiles` /
  `field-terrain-system.ts:37`, itère `state.pokemon`, **filtre les vivants
  `currentHp > 0`**) ; `EffectContext` expose déjà `state: BattleState`
  (grille + `pokemon: Map`), donc aucune nouvelle dépendance ;
- (b) router Buée Noire comme les zones (marqueur `PostFieldGlobal`-like + travail
  côté engine). **Préférence (a)** : reset instantané, pas de persistance → un
  helper de voisinage suffit, pas besoin d'un système de zone. Team-agnostic
  (inclut alliés + lanceur, précédent #526).

**`SwapRawSpeed` / `SwapStatStages` / `CopyStatStages` = read-both/write-both** →
calquer exactement `handle-transfer-stat-stages.ts` (émission `StatChanged` par
delta pour les deux Pokémon + recompute movement conditionnel).

Enregistrer les 5 handlers dans `effect-processor.ts` (mirror familles récentes).

## Blocage (Clone / Brume / talents)

Ces moves n'utilisent **pas** `EffectKind.StatChange` → ils **court-circuitent**
le pipeline de blocage de `handle-stat-change.ts` (talents défensifs, aura Brume,
riposte Défiant). Décision de parité, cohérente et simple :

- **Buée Noire** (reset zone) : **ignore le Clone (Substitut) et la Brume** —
  c'est un reset de terrain, pas un débuff ciblé (canon Haze ignore le Substitut).
  N'émet pas de riposte Défiant/Rivalité (reset ≠ baisse infligée).
- **Bain de Smog** : move offensif → interaction Clone standard (le Clone encaisse
  les dégâts ; si Clone actif, **pas de reset** de la cible — le reset ne
  traverse pas le Substitut). Réutiliser `shouldSubstituteBlock`.
- **Boost / Renversement / Permugarde / Permuforce / Permuvitesse / Permucœur**
  (manip mono-cible ennemie) : **bloqués par le Clone** (`shouldSubstituteBlock`,
  aucun n'a le flag `sound`/`bypasssub`) → `StatChangeBlocked`/no-op, cohérent
  avec Détrempage (#586). **Non concernés par la Brume/Défiant** : ils
  n'« infligent » pas une baisse de cran au sens du pipeline (copie/échange/
  inversion peuvent monter comme baisser) → pas de garde Brume, pas de riposte.
  À noter en playtest si un cas paraît abusif.

## Targeting (`battle/tactical.ts`)

- Buée Noire : **auto-centrée diamant r3** (réutiliser le pattern AoE r3 des zones
  plan 145 / Distorsion ; inclut la tuile du lanceur — attention à l'exclusion de
  la tuile-lanceur des AoE dégâts, ici le lanceur DOIT être inclus).
- Bain de Smog : Single offensif standard (portée référence).
- **Portée tranchée par move** (revue game-designer 2026-07-02 — les statuts
  mono-cible du roster sont **1-3**, pas r1 pur ; ne pas généraliser à tort) :
  - **Boost, Renversement, Permugarde, Permuforce** : Single **1-3** ennemi
    (aligné sur Kinésie/Cage-Éclair/Toxik/Hypnose du roster).
  - **Permuvitesse, Permucœur** : Single **r1** ennemi (**prime au risque** :
    effets les plus puissants — vol de tempo/mobilité, échange des 7 crans →
    exiger la mêlée est la contrepartie).

Move-pattern-designer si doute sur les portées.

**Ciblage allié (émergent, validé playtest 2026-07-02)** : les 6 moves mono-cible
sont des `Single` sans flag → le moteur ne filtre pas ami/ennemi (BattleEngine
`getValidTargetPositions` retourne toutes les tuiles à portée ; la boucle
d'application `BattleEngine.ts:1476` ne skippe que le lanceur). **On peut donc
cibler un allié** : Boost copie le setup d'un allié, les Permu* redistribuent les
stats dans l'équipe. Renversement/Bain de Smog sur allié = auto-sabotage possible
(choix joueur, gate par le confirm — cohérent avec Séisme & co. qui touchent déjà
les alliés). Aucun garde-fou ajouté.

## Events + renderer + i18n

- Réutiliser `StatChanged { targetId, stat, stages }` pour les deltas (HUD +
  flottants existants suivent gratuitement — mirror Baton Pass).
- Nouveaux events « chapeau » pour la ligne de journal (headline lisible) :
  `StatStagesReset { pokemonIds }`, `StatStagesCopied { casterId, targetId }`,
  `StatStagesInverted { targetId }`, `StatStagesSwapped { casterId, targetId,
  stats }`, `SpeedSwapped { casterId, targetId }`. (Ou un event générique
  `StatStagesManipulated { reason, pokemonIds }` — au choix à l'impl, garder
  simple.)
- `BattleLogFormatter` : un cas par event chapeau. Ex. « Les changements de stats
  de tous les Pokemon sont annulés ! » (Buée Noire), « Ectoplasma copie les
  changements de stats de Mewtwo ! » (Boost), « Les changements de stats de X
  sont inversés ! » (Renversement), « X et Y échangent leur Défense ! »
  (Permugarde), « X et Y échangent leur Vitesse ! » (Permuvitesse). Noms FR.
- `MoveTooltip` : tags génériques (« Annule les changements de stats »,
  « Copie les stats », « Inverse les stats », « Échange les stats », « Échange la
  Vitesse »).
- InfoPanel : les crans affichés doivent refléter `statStages` post-effet (déjà le
  cas — lecture live). Vérifier que la Vitesse d'affichage éventuelle tient compte
  ou non de `speedStatOverride` (décision : InfoPanel montre la Vitesse de base,
  l'override n'impacte que déplacement/tour — cf § champ).
- i18n FR/EN pour toutes les nouvelles clés (log + tooltips).

## Cleanup

- `handleKo` : `pokemon.speedStatOverride = undefined` (reset à la mort, à côté de
  `typeOverride`/`substituteHp`). Les `statStages` sont déjà remis à 0 au KO
  (vérifier ; sinon aligner).
- Téléportation forcée (`ejectToSpawn`) : **conserver** `speedStatOverride` (même
  instance).

## IA

Heuristiques dédiées **différées** (cohérent avec les familles récentes) :
- Bain de Smog = move offensif → déjà joué via le scoring dégâts standard.
- Buée Noire / Boost / Renversement / Permu* : scorés en statuts génériques.
  L'IA ne raisonne pas sur « annuler les boosts adverses », « copier un setup
  ennemi », « voler la Vitesse d'un sweeper ». À ajouter en passe IA dédiée (même
  lot que type-manip / item-interaction / pièges purs).
- **À reporter** dans `docs/next.md` § Reporté.

**Garde-fou IA minimal — EN SCOPE (revue game-designer)** : les 5 nouveaux
`EffectKind` ne matchent aucune branche de `action-scorer.ts` → score neutre (0),
donc l'IA les ignore… sauf en tie-break sur score nul, où elle peut jouer un
**contresens visible** (Renversement sur une cible déjà à somme de crans ≤ 0 →
la buffe ; Copie/Échange quand la somme des crans du lanceur > celle de la cible
→ s'auto-débuffe). Ajouter un **score légèrement négatif** dans `action-scorer.ts`
quand l'effet net est clairement défavorable au lanceur (somme des crans) — coût
faible, évite le cas le plus visible « l'IA joue n'importe quoi ». Le scoring
*positif* fin (valoriser activement ces moves) reste différé.

## Tests

Core intégration (`stat-state-manip.test.ts` groupé ou 1 fichier/move) :
- **Buée Noire** : monte des crans sur 3 mons (2 équipes) dans/hors du diamant r3
  → seuls ceux dans r3 sont remis à 0 (lanceur inclus), les hors-zone intacts.
  Recompute movement OK sur un mon dont le cran Vitesse est effacé.
- **Boost** : cible +2 Atq / −1 Déf → lanceur devient exactement +2 Atq / −1 Déf ;
  movement recomputé si cran Vitesse copié.
- **Bain de Smog** : dégâts appliqués **avant** reset ; crans cible remis à 0 ;
  Clone actif → dégâts au Clone, **pas** de reset.
- **Renversement** : +2/−1 → −2/+1 ; 0 reste 0.
- **Permugarde** : échange Déf/DéfSpé uniquement (Atq/Vitesse intacts).
- **Permuforce** : échange Atq/AtqSpé uniquement.
- **Permucœur** : échange les 7 crans ; movement des deux recomputé.
- **Permuvitesse** : échange la Vitesse brute (pas le cran) → `speedStatOverride`
  posé sur les deux, `derivedStats.movement` recomputé, ordre de tour (ctGain)
  reflète la nouvelle Vitesse ; le cran Vitesse reste inchangé sur chacun.
- **Blocage** : les 6 manip mono-cible bloquées par le Clone ; Buée Noire ignore
  le Clone.
- `handleKo` reset `speedStatOverride`.
- Audit `baseStats.speed` → 0 lecture directe résiduelle sur movement/ctGain.

e2e Playwright : scénario dans `docs/test-plan.md` §5 (crans observables via
badges InfoPanel + ligne de journal). Non bloquant (logique testée en unit) →
peut être reporté comme move-copy.

## OP sets

Optionnel non bloquant : variantes Alakazam (Permuvitesse/Permuforce),
Mewtwo (Boost), Smogogo (Bain de Smog + Buée Noire), Ectoplasma (Boost).
À l'appréciation du data-miner.

## Décisions à journaliser (`docs/decisions.md`, à partir de #595)

- #595 : Famille Stat/state manip = 8 moves (2 hors-pool gardés pour Team Builder
  libre).
- #596 : Buée Noire = reset zone diamant r3 auto-centrée, team-agnostic (inclut
  lanceur + alliés), ignore le Clone/Brume (reset de terrain, pas débuff ciblé).
  **Coût CT = PP-driven (Haze PP30 → 500, palier plancher) assumé** malgré
  l'ampleur (25 cases, annule le setup des 2 équipes) : la contrepartie est
  **positionnelle** (sortir ses alliés buffés du rayon r3 avant de caster), pas
  un surcoût CT. Point de vigilance playtest.
- #597 : Permuvitesse = canon (échange la Vitesse brute via `speedStatOverride`
  par-instance, persistant fin de combat, reset au KO ; impacte déplacement +
  ctGain, pas l'affichage de base). **Contre-jeu émergent** : l'ancien
  propriétaire (ou un allié) peut recaster Permuvitesse sur le voleur pour
  reprendre sa Vitesse (au prix d'un trajet en mêlée + 900 CT) — pas de mécanique
  de réversion dédiée, la contrepartie est positionnelle. Point de vigilance
  playtest (visible surtout avec un roster à spread Vitesse extrême type Alakazam).
- #598 : Manip mono-cible (Boost/Renversement/Permu*) bloquées par le Clone,
  hors pipeline Brume/Défiant (ni baisse ni hausse « infligée » au sens standard).
- #599 : Bain de Smog applique les dégâts avant le reset ; reset non traversant le
  Clone.

## Checklist clôture

- [ ] `pnpm build && lint:fix && typecheck && test && test:integration` verts
- [ ] Audit `baseStats.speed` sur movement/ctGain → 0 lecture directe résiduelle
- [ ] `docs/implementations.md` (8 moves, compteur 444 → 452)
- [ ] `docs/next.md` (fait récemment + report IA stat-manip)
- [ ] `docs/plans/README.md` (entrée 146)
- [ ] `docs/decisions.md` (#595–#599)
