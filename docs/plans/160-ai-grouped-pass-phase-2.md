# Plan 160 — Passe IA groupée Phase 2 (toutes les familles restantes)

> **Statut** : done
> **Créé** : 2026-07-14
> **Clôturé** : 2026-07-14
> **Décision humain** : « fait toute l'IA » — traiter en un seul plan TOUTES les familles d'heuristiques différées (au lieu d'itérer batch par batch sur 40 sessions). 1 commit final.
> **Suite de** : plan 159 (Phase 1, 5 heuristiques haut-impact + ring-out Le Mur).
> **Archi (rappel plan 159)** : heuristiques COMMUNES à tous les niveaux (pas de branche par difficulté ; la difficulté module `randomWeight`/`topN` uniquement). Scorer = `packages/core/src/ai/action-scorer.ts`, primitives = `packages/core/src/ai/threat-detection.ts`. Poids : `killPotential=10`, `typeAdvantage=3-5`, `positioning=2-3`, `statChanges=1-2`.

## Diagnostic (5 agents recherche, 2026-07-14)

Beaucoup de moves ne sont pas « mal raffinés » mais **jamais joués** (scorés ~0/−1 → choisis seulement en tie-break/aléatoire). Bugs de valorisation confirmés :

| Move (FR / EN) | Score actuel | Cause |
|---|---|---|
| Croc Fatal (`super-fang`) | **0** | pas de power floor, pas de branche `HalveTargetHp` |
| Tout ou Rien (`final-gambit`) | **0** | power 0, pas de branche `FinalGambit` |
| Vœu Soin (`healing-wish`) | **−1** | cible une tuile alliée/KO → `targetsHit=0`, allié KO absent de `getAliveAllies` |
| Vent Arrière (`tailwind`) | **≈ −1** | `GroundTarget` case vide → `targetsHit=0` → `-1` |
| Après Vous / Interversion (`after-you`/`ally-switch`) | **0** | `scoreAllyTargetMove` sans branche |
| Gravité / Zone Étrange / Zone Magique (`gravity`/`wonder-room`/`magic-room`) | **0** | `scoreSelfMove` non matché |
| Manip talent ×4 (`worry-seed`/`gastro-acid`/`role-play`/`skill-swap`) | **0** | aucun `Status`/`StatChange` → chemin générique inerte |
| Bâillement / Vol Magnétik (`yawn`/`magnet-rise`) | **0** | pas de branche |
| Acupression (`acupressure`) self-cast | **−1** | mauvais routage `scoreAllyTargetMove` (self exclu de `allies`) |
| Lien du Destin / Rancune (`destiny-bond`/`grudge`) | **0** | `scoreSelfMove` non matché |
| Cyclone / Hurlement (`whirlwind`/`roar`) | **0** | `PhazeToSpawn` non matché |
| Call-moves (`metronome`/`sleep-talk`/`mirror-move`/`copycat`) | **0** | `effects:[]`, pas de branche |
| Type-manip (`conversion`/`conversion-2`/`reflect-type`/`soak`) | **0** | non matché (garde-fou implicite, basse prio) |

**Faux-KO transverse (haut impact)** : `estimateDamage` renvoie les dégâts bruts sans clamp de survie ni immunité de type → l'IA « croit tuer » un porteur de **Ceinture Force** (`focus-sash`) / **Bandeau** (`focus-band`) / **Baie Sitrus** (`sitrus-berry`) / talent **Fermeté** (`sturdy`), et sur-évalue un move Sol contre **Lévitation** (`levitate`) / **Ballon** (`air-balloon`). Corrigé **côté scorer** (pas de modif `damage-calculator` — non structurel).

## Primitives partagées (`threat-detection.ts`)

Toutes O(1) ou O(N×M) (N,M ≤ ~24, négligeable/tour). Testées unitairement.

1. `anyEnemyCanStrike(enemies, self, moveRegistry, engine): boolean` — un ennemi a-t-il un move offensif à portée de nous (portage de `evaluateAttacksFromPosition` sans calcul de dégâts).
2. `anyEnemyPhysicalStriker(enemies, self, moveRegistry, engine): boolean` — idem filtré `Category.Physical`.
3. `abilityNeutralizeValue(abilityId?): number` — table curée (talents défensifs/survie implémentés).
4. `abilityCopyValue(abilityId?): number` — table curée (talents offensifs/vitesse continus ; 0 pour battle-start-only : `intimidate`/`download`/`drought`/`trace`/`imposter`).
5. `bestGroundThreatFraction(enemies, self, engine, moveRegistry): number` — meilleure fraction de dégâts d'un move de type Sol qu'un ennemi peut nous infliger (Vol Magnétik).
6. `survivesLethalHit(target): boolean` — porteur `focus-sash`/`sturdy` à PV pleins, `focus-band`, `sitrus-berry` non consommée (faux-KO).
7. `isImmuneToMoveType(target, move, engine): boolean` — immunité de type non vue par `estimateDamage` (Sol vs `levitate`/`air-balloon`/effectivement volant ; absorptions non implémentées en talent → uniquement Sol pour le roster actuel).
8. `occupantAt(state, position): PokemonInstance | undefined` — occupant vivant prioritaire sinon KO (Vœu Soin — seule primitive qui doit voir les KO).

## Volets (tous dans `action-scorer.ts` sauf primitives)

### Volet A — Faux-KO / immunité (transverse, haut impact)
Dans `scoreDamagingMove`, `evaluateAttacksFromPosition`, `scoreOhko`, `scoreKnockbackRingOut` : avant de créditer un KO plein (`estimate.min >= currentHp`), si `survivesLethalHit(target)` → dégrader en crédit dégât partiel (cap `(currentHp-1)/maxHp`). Si `isImmuneToMoveType` → dégât/efficacité = 0.

### Volet B — Sacrifice / Self-KO
- `scoreExplosion` (`isExplosion`) : `killPotential × koCount − killPotential × selfValue` (selfValue = `currentHp/maxHp`) ; coût annulé si `wouldKoUs` ; ×1.5 si un KO = `highestThreatEnemy` ; **−killPotential** si `koCount=0` ou allié KO en zone.
- `scoreMemento` (`selfKo` + StatChange target<0) : valeur ∝ `bestEnemyDamageAgainst(target)` normalisé, ×1.5 si menace n°1, − coût sacrifice ; −killPotential si cible déjà à −6/−6.
- `scoreFinalGambit` (`FinalGambit`) : `effectiveness=0` (Spectre) → −killPotential ; dégâts prédits = `floor(currentHp × effectiveness)` ; KO → `killPotential − coût` ; sinon ratio ; coût annulé si `wouldKoUs`.
- `scoreReviveOrHeal` (`ReviveOrHeal`, ciblage tuile via `occupantAt`) : tuile vide/ennemi/allié plein → −killPotential ; allié KO → `killPotential × 0.5 − coût` ; allié blessé → `missing × killPotential × 0.8 − coût`.
- `scoreDestinyBondGrudge` (`PostDestinyBond`/`PostGrudge`, dans `scoreSelfMove`) : outil de désespoir — `killPotential × desperation × 0.6` seulement si `wouldKoUs` ; −1 si déjà actif ou pas d'ennemi à portée.

### Volet C — Lock-in multi-tour
Bonus/malus additif quand `move.lockIn !== undefined` (après dégâts) : malus d'engagement (`confuseOnEnd` → plus fort), quasi nul pour Brouhaha (`uproar` : bonus AoE si `targetsHit ≥ 2` + bonus anti-sommeil). `RolloutStreak` (Ball'Glace) : bonus de continuité `× (1 + rolloutStreak × k)` si streak déjà engagé.

### Volet D — Priorité / timing
- Bluff (`fake-out`) : remplacer le `+statChanges` forfaitaire du flinch par pondération menace (`highestThreatEnemy` → ×1.5, `wouldKoUs` → ×2.5).
- Coup Bas (`sucker-punch`) : après le garde-fou existant, `+killPotential × (wouldKoUs ? 0.8 : 0.4)` sur la cible agressive = menace n°1.
- Charge-réaction : Mitra-Poing (`focus-punch`) `× (anyEnemyCanStrike ? 0.3 : 1)` ; Bec-Canon (`beak-blast`) `+statChanges` si `anyEnemyCanStrike` ; Carapiège (`shell-trap`) **−1** si `!anyEnemyPhysicalStriker`.

### Volet E — Dégâts utilitaires
- `scoreHalveTargetHp` (`HalveTargetHp`, Croc Fatal) : `(floor(hp/2)/maxHp) × killPotential × accuracy`, ×1.5 si menace n°1, jamais de KO plein.
- Faux-Chage (`cannotKo`) : chemin dégâts sans branche KO (jamais `killPotential` plein).
- Ruse (`bypassProtect`) : `+typeAdvantage` si `target.activeDefense !== null`.
- Anti-Air (`SmackDown`) : `+statChanges × 1.5` si cible aéroportée (`isAirborneIgnoringGravity`) non `smackedDown` ; `+killPotential × 0.3` si `semiInvulnerableState` volant.
- Poursuite (`pursuitBackstab`) : si cible dans zone Dos (`directionFromTo(self,target) === target.orientation`) → dégâts ×2 avant test KO ; ×1.5 si menace n°1.

### Volet F — Manip talent
Branches avant `isSelfTargeting` : `scoreAbilitySuppress` (Suc Digestif/Soucigraine → `abilityNeutralizeValue(effectiveAbilityId(target)) × statChanges`, ×1.5 si menace n°1, garde-fou −1 si pas de talent / Soucigraine sur endormi), `scoreCopyAbility` (Imitation → `(copyValue(cible) − copyValue(soi)) × statChanges`, −1 si gain ≤ 0), `scoreSwapAbility` (Échange → symétrique, −1 si l'échange favorise l'adversaire).

### Volet G — Buff / statut
- Bâillement (`Yawn`) : garde-fou (−1 si cible ne peut dormir/déjà statut/déjà `drowsyTurns`), sinon `statChanges` ×1.8 si menace n°1, ×0.3 si cible <30% PV.
- Acupression (`RaiseRandomStat`) : **corriger le routage self-cast** (branche dédiée avant `targetsAllyOrSelf`) ; `statChanges × 0.8` décroissant avec `sumStatStages`, ×1.5 si cible offensive & `!wouldKoUs`, ×1.2 early-game ; −1 si toutes stats à +6.
- Vol Magnétik (`MagnetRise`, dans `scoreSelfMove`) : −1 si déjà actif/`smackedDown` ; sinon `bestGroundThreatFraction × killPotential × 0.6` + bonus si sur terrain dangereux/hazards.

### Volet H — Grille
- Par Ici / Poudre Fureur (`DrawAttention`) : garder plancher garde-fou ; ajouter bonus back-setup — pour chaque ennemi exposé, si un allié offensif frappe son dos post-pivot (`getFacingZone`) → `+typeAdvantage × 0.5`.
- Après Vous (`ActAfterUser`, branche dédiée amont) : `bestAllyStrikeValue(ally)` (meilleure frappe dispo de l'allié promu) ; −1 si l'allié n'a aucune frappe en portée.
- Interversion (`SwapAllyPositions`, branche dédiée) : esquive — `killPotential × 0.5` si `wouldKoUs(self)` ET la case d'arrivée éloigne de la menace n°1 (proxy distance) ; symétrique pour un allié menacé ; ~0 sinon.

### Volet I — Field global
- `scorePostFieldGlobal` (dans `scoreSelfMove`, miroir `PostFieldTerrain`) : −1 si `isInFieldGlobalZone` déjà ; Gravité = nb ennemis volants en `FIELD_GLOBAL_RADIUS` ; Zone Étrange = nb ennemis à défense déséquilibrée ; Zone Magique = nb porteurs d'objet en zone ; × `setterDurabilityMultiplier`.
- `scoreTailwind` (`SetTailwind`, **branche dédiée en tête**, corrige le routage) : nb alliés vivants (self inclus) × `positioning` × `setterDurabilityMultiplier` × bonus early ; −1 si déjà actif.

### Volet J — Phazing
`scorePhazing` (`PhazeToSpawn`, additif après `targetsHit`) : par ennemi éjecté, base `positioning` + `statChanges × sommeStagesPositifs` (déni de setup) + ×1.5 si menace n°1. Compatible Projection (`circle-throw` = Damage + Phaze).

### Volet K — Move-copy
`scoreCallMove` (`move.callMove !== undefined`, avant routage) : `sleep-talk`/`RandomOwnAsleep` = −1 si lanceur pas endormi sinon `statChanges` ; `GlobalLast`/`TargetLast` = −1 si pas de source résoluble sinon `typeAdvantage × 0.5` ; `RandomAll` (Métronome) = `typeAdvantage × 0.5`.

### Volet L — Type-manip (basse prio)
`scoreConversionFamily` minimal : gain défensif via `bestEnemyEffectivenessAgainstTypes` si dispo ; sinon garde-fou conservateur (0, déjà inerte). Downside `burn-up` (`RemoveType`) : petit malus si autres moves Feu offensifs. **Peut être réduit au strict minimum si le budget serre** (le garde-fou implicite 0 évite déjà le blunder).

## Tests
- `threat-detection.test.ts` : 8 primitives.
- `action-scorer.test.ts` : ≥1 cas par volet (jouer le move dans la bonne situation > l'alternative ; garde-fou négatif dans la mauvaise).
- Intégration : non requis (scorer pur, pas de nouveau chemin moteur). e2e reporté (`test-writer`, après validation) → `docs/next.md`.

## Gate & human-testing
Gate CI full. Human-testing : 1 scénario par volet à fort impact observable (Croc Fatal joué, Explosion suicide-value, Vœu Soin revive, Vent Arrière, manip-talent sur talent clé, Bâillement sur menace, faux-KO Ceinture Force).

## Reporté (hors périmètre)
- Immunité de type dans `estimateDamage`/`damage-calculator` (structurel — géré côté scorer ici via `isImmuneToMoveType`, limité au type Sol du roster).
- `engine.canPhaze` (fiabiliser le fizzle phazing) — valorisation approximative acceptable v1.
- Mémoire de cible / anti-oscillation (changement d'archi, différé plan 159 D3).
- e2e Playwright des nouvelles heuristiques.
- Familles non couvertes par ce plan (aucun volet dédié) : Stat/state manip (plan 146 — Buée Noire/Boost/Bain de Smog/Renversement/Permugarde/Permuforce/Permuvitesse/Permucœur), item-interaction utilitaires (plan 142 — Tour de Magie/Passe-Passe/Recyclage/Gaz Corrosif), pièges purs position-linked (Barrage/Regard Noir), crit-manip Batch A (plan 151 — Puissance/Affilage/Cri Draconique/Yama Arashi/Dark Lariat), Cognobidon/Attraction (plan 154), objets légers (plan 158, passifs neutres pour l'IA).

## Résultats de validation

- **Typecheck monorepo** : vert.
- **Tests core** : **3435 verts (+20 vs plan 159)**.
- **Biome** : non exécutable dans cette session (contrainte environnement) — `biome ci packages/` à lancer au prochain `/ci-gate` avant merge.
- **e2e Playwright** : reporté (`test-writer`, après validation) — voir `docs/next.md`.
- **Human-testing** : scénarios du § « Gate & human-testing » ci-dessus à dérouler avant merge définitif.
- Tous les volets A→L ont été implémentés ; le Volet L (Type-manip) a été gardé au strict minimum, comme prévu par le plan (basse priorité).
