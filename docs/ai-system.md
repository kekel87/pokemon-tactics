# Système IA — Pokemon Tactics

> Architecture, pipeline de scoring, et niveaux de difficulté.

## Architecture

Le système IA est composé de 3 couches, toutes dans `packages/core/src/ai/` :

```
BattleEngine.getLegalActions()     ← actions légales (Move, UseMove, EndTurn)
         │
         ▼
    scoreAction()                  ← score chaque action (action-scorer.ts)
         │
         ▼
    pickScoredAction()             ← choisit parmi les meilleures (scored-ai.ts)
         │
         ▼
BattleEngine.submitAction()        ← exécute l'action choisie
```

Le `AiTeamController` (renderer) orchestre le tour complet : il boucle sur ce pipeline
jusqu'à `EndTurn`.

**Tout le pipeline est commun à tous les niveaux de difficulté.** Seul l'`AiProfile` change.

## Pipeline de scoring

### 1. Collecte des données (`scoreAction`)

Pour chaque action légale, le scorer collecte :

- **Le Pokemon actif** : position, moves, PP restants
- **Les ennemis vivants** : position, HP, types
- **Les alliés vivants** : position (pour le friendly fire)

### 2. Scoring par type d'action

#### UseMove (attaque / buff / debuff)

**Self-targeting (buffs)** — traitement séparé :
- Score = `statChanges` (1) si ennemi proche, `statChanges × 3` si ennemi loin (>2 tiles)
- Logique : se buffer quand on ne peut pas encore frapper

**Attaques (power > 0)** :
1. Calcule les **tiles affectées** via `estimateAffectedTiles()` (miroir simplifié de `resolveTargeting`, sans Grid)
2. Filtre les ennemis **réellement touchés** (position sur une tile affectée)
3. Si aucun ennemi touché → **score = -1** (l'IA ne tire jamais dans le vide)
4. Pour chaque ennemi touché :
   - **Kill potential** : si `estimateDamage.min >= HP restants` → `killPotential` (10). Sinon → `(dégâts max / HP max) × killPotential × 0.5`
   - **Type advantage** : `effectiveness > 1` → +`typeAdvantage` (3). `< 1` → malus
5. **Friendly fire** : -30% de `killPotential` par allié dans la zone d'effet
6. **Effets secondaires** : +`statChanges × 1.5` pour les debuffs ennemis, +`statChanges` pour les statuts
7. **Ring-out par recul** (`scoreKnockbackRingOut`, moves à `EffectKind.Knockback` — Draco-Queue, Coud'Krâne, Draco-Charge) : pour chaque ennemi touché, `BattleEngine.predictKnockback` calcule l'issue (déplacement, glissade sur glace, chute, terrain létal) depuis la position **actuelle** de l'attaquant. Issue `lethal` (chute mortelle ou terrain létal) → `killPotential` (×1.5 si la cible est `highestThreatEnemy`). Sinon → dégâts directs + bonus `fallDamage / maxHp × killPotential × 0.5`. Un allié qui serait éjecté à mort → **malus dur** `-killPotential`. L'IA ne se repositionne pas encore exprès pour préparer un ring-out (Phase 2, différé)
8. **Faux-KO / immunité transverse** (Volet A, plan 160) : avant de créditer un KO plein (`estimate.min >= currentHp`), si `survivesLethalHit(target)` (porteur Ceinture Force/Fermeté à PV pleins, Bandeau, Baie Sitrus non consommée) → dégradé en crédit dégât partiel (cap `(currentHp-1)/maxHp`). Si `isImmuneToMoveType(target, move)` (move Sol vs Lévitation/Ballon/volant effectif) → dégât/efficacité = 0. Appliqué dans `scoreDamagingMove`, `evaluateAttacksFromPosition`, `scoreOhko`, `scoreKnockbackRingOut`.
9. **Sacrifice / Self-KO** (Volet B, plan 160) : Explosion/Destruction/Explo-Brume (coût de suicide déduit du score, annulé si `wouldKoUs`, ×1.5 si un KO touche `highestThreatEnemy`), Souvenir (valeur ∝ dégât adverse potentiel de la cible, ×1.5 si menace n°1), Tout ou Rien (dégâts prédits = PV actuels, KO → `killPotential` net du coût), Vœu Soin (ciblage tuile via `occupantAt` — revive un allié KO à `killPotential × 0.5`, soigne un blessé proportionnellement, garde-fou si tuile vide/ennemi/allié plein), Lien du Destin / Rancune (outil de désespoir valorisé seulement si `wouldKoUs`).
10. **Lock-in multi-tour** (Volet C, plan 160) : bonus/malus additif sur les moves à `lockIn` — malus d'engagement standard, quasi nul pour Brouhaha (bonus AoE + anti-sommeil), bonus de continuité croissant pour Ball'Glace (`RolloutStreak` déjà engagé).
11. **Priorité / timing** (Volet D, plan 160) : Bluff pondéré par la menace (`highestThreatEnemy` ×1.5, `wouldKoUs` ×2.5) au lieu du bonus `statChanges` forfaitaire ; Coup Bas bonus `killPotential` sur la menace n°1 ; charge-réaction — Mitra-Poing réduit si `anyEnemyCanStrike`, Bec-Canon bonus si risque de charge, Carapiège découragé si `!anyEnemyPhysicalStriker`.
12. **Dégâts utilitaires** (Volet E, plan 160) : Croc Fatal (`HalveTargetHp`, dégâts = moitié des PV actuels, jamais un KO plein), Ruse bonus si la cible a une défense active (Protection/Détection), Anti-Air bonus sur cible aéroportée ignorant la Gravité, Poursuite ×2 dégâts si la cible est prise de dos (`directionFromTo` = orientation cible).
13. **Manip talent** (Volet F, plan 160) : Suc Digestif/Soucigraine valorisés via `abilityNeutralizeValue(effectiveAbilityId(target))`, Imitation via le gain `abilityCopyValue(cible) − abilityCopyValue(soi)`, Échange symétrique — garde-fou négatif si le gain net est nul ou défavorable.
14. **Buff / statut** (Volet G, plan 160) : Bâillement pondéré par la menace de la cible (garde-fou si la cible ne peut pas dormir), Acupression self-cast (routage corrigé, décroissant avec les crans déjà posés), Vol Magnétik valorisé via `bestGroundThreatFraction` (fuite d'une menace Sol identifiée).
15. **Grille** (Volet H, plan 160) : Par Ici / Poudre Fureur bonus de back-setup (un allié offensif peut frapper le dos d'un ennemi exposé, `getFacingZone`), Après Vous valorise la meilleure frappe disponible de l'allié promu, Interversion valorisée comme esquive défensive quand elle éloigne de la menace n°1.
16. **Field global** (Volet I, plan 160) : `scorePostFieldGlobal` (Gravité/Zone Étrange/Zone Magique — nombre de cibles affectées en zone × `setterDurabilityMultiplier`), `scoreTailwind` valorisé par le nombre d'alliés vivants × `positioning` (bug de routage corrigé — était injouable).
17. **Phazing** (Volet J, plan 160) : `scorePhazing` — par ennemi éjecté, bonus `positioning` + `statChanges × sommeStagesPositifs` (déni de setup), ×1.5 si la cible est la menace n°1. Compatible Projection (dégâts + éjection).
18. **Move-copy** (Volet K, plan 160) : `scoreCallMove` — Blabla Dodo valorisé seulement si le lanceur est endormi, Mimique/Photocopie valorisés via l'efficacité de type du dernier move résolu, Métronome valorisé à un niveau conservateur (`typeAdvantage × 0.5`).
19. **Type-manip** (Volet L, plan 160, basse prio) : `scoreConversionFamily` — gain défensif minimal si résistance identifiable, sinon garde-fou conservateur (0, déjà inerte avant ce plan).

#### Pondération CT — heuristique KO-protégé (plan 165)

Le scorer est **greedy monoronde** (pas de lookahead) : le CT (Charge Time, coût de temps d'une action)
était totalement ignoré du scoring jusqu'au plan 165. Un premier essai naïf (plan 068 étape 2,
`score *= CT_REFERENCE_COST / ctCost` appliqué à tout le score) avait produit des combats **>5000 tours**
en charge : la division frappait aussi la composante KO, un KO lent devenait moins bien noté qu'un chip
rapide, aucun camp ne retirait de menace → drag.

**Formule retenue** — un KO retire une menace *définitivement* (step-change), il garde donc sa pleine
valeur quel que soit son coût CT ; seul le chip/utilitaire (un débit) est pondéré par le tempo :

```
ctFactor(move) = min(1, CT_REFERENCE_COST / computeMoveCost(move.pp, move.power, move.effectTier))
                 // CT_REFERENCE_COST = 500 (coût minimum) → cost 500 = 1.0, 900 = 0.55
                 // min(1, …) : ne pénalise que les coûts > 500, jamais de bonus

finalScore =
  securesKo ? rawScore                  // KO (dégât direct OU ring-out létal) : jamais divisé
            : rawScore <= 0 ? rawScore  // scores négatifs/nuls : pas de re-scaling
                            : rawScore * ctFactor
```

`damageScore × ctFactor` reste proportionnel aux **dégâts-par-CT** (`damageScore ∝ ratio de PV infligé`,
donc `damageScore × ref/cost ∝ ratio/cost`) : un move qui inflige plus n'est pas injustement pénalisé,
ses dégâts supérieurs sont déjà dans `damageScore`.

Implémentation (`action-scorer.ts`) : const `CT_REFERENCE_COST = 500` + fonction `applyCtWeight(score,
securesKo, move)`, appliquée en sortie du **chemin générique** de `scoreUseMove` (assemblage final des
points 1-19 ci-dessus). `securesKo` est accumulé depuis `scoreDamagingMove` (dégât direct, `estimate.min
>= currentHp`) et `scoreKnockbackRingOut` (issue `lethal`).

**Hors périmètre v1** (branches à `return` anticipé, scoring bespoke conservé tel quel, non pondéré CT) :
OHKO (Guillotine…), Explosion/Destruction, Tout ou Rien, Souvenir, Vœu Soin, Croc Fatal, Balance/Effort,
Transform, Buée Noire, stat-manip, self-buffs (`scoreSelfMove`), moves alliés (`scoreAllyTargetMove`).

Validé par un scénario de charge dédié 6v6 CT (`scenarios/ct-scoring-anti-drag.scenario.test.ts`, 8 seeds) :
83 à 303 actions par combat (plafond garde-fou fixé à 1000, largement sous le drag historique >5000).

#### Move (déplacement)

1. **Positionnement** : gain de distance (réelle, BFS) vers l'ennemi le plus proche × `positioning`
2. **Distance réelle (BFS)** : `engine.computePathDistance` remplace `manhattanDistance`. Un ennemi derrière un obstacle infranchissable retourne `Infinity` → l'IA ne se déplace plus vers des positions sans issue.
   **Fallback Manhattan** : quand `computePathDistance` retourne `Infinity` pour *tous* les ennemis (équipes séparées par un terrain infranchissable), `closestDistanceToEnemies` bascule sur la distance Manhattan. L'IA continue de se repositionner au lieu de rester figée.
3. **Aversion terrain dangereux** : si la tile de destination est Magma, Lava ou Swamp, et que le Pokemon n'est pas immun (`isTerrainImmune`), la destination est pénalisée de `DANGEROUS_TERRAIN_PENALTY = 8`. Les Pokemon immuns (ex: Fire/Flying sur Lava, Water/Flying sur DeepWater, Steel sur Swamp) ne sont pas pénalisés — et peuvent physiquement traverser ces terrains (voir `getImmuneTerrains` dans `terrain-effects.ts`). Cette pénalité couvre l'aversion **défensive** (l'IA évite de s'exposer elle-même) ; le pendant **offensif** — pousser un ennemi vers un ring-out (chute du Mur, glissade sur glace, terrain létal) — est couvert séparément par le ring-out par recul (§ Attaques, point 7), pas par cette pénalité de déplacement.
4. **Lookahead move+attack** : pour chaque move du Pokemon (avec PP) :
   - Calcule la portée max (`getMoveMaxReach`)
   - Vérifie si un ennemi serait à portée depuis la destination — hauteur/terrain/facing et ligne de vue calculés **depuis la position candidate** (`attackerPosition` sur `estimateDamage`, garde `hasLineOfSightFrom` dans `evaluateAttacksFromPosition` — élimine les positions « sniper fantôme » à travers un mur/relief)
   - Score le meilleur dégât possible × 0.8 (facteur d'estimation)
5. Le lookahead fait que l'IA **se déplace vers des positions d'attaque**, pas juste vers l'ennemi — y compris **grimper un plateau pour tirer en surplomb** quand ça améliore l'estimation de dégâts

#### EndTurn (fin de tour)

- Score = 1 si face à l'ennemi le plus proche, 0 sinon
- L'IA se tourne toujours vers la menace

### 3. Scores négatifs

Les actions à score < 0 (attaques sans cible) sont **filtrées** du pool de sélection.
L'IA ne gaspille jamais son tour sur une action inutile.

## Primitives de menace partagées (`ai/threat-detection.ts`)

Helpers réutilisés par plusieurs heuristiques (ring-out, OHKO, Malédiction, Transform) pour raisonner sur « qui est dangereux » sans dupliquer la logique :

| Fonction | Rôle |
|----------|------|
| `bestEnemyDamageAgainst(enemy, self, engine)` | Meilleur dégât estimé qu'un ennemi peut infliger à `self` (boucle ses moves) |
| `highestThreatEnemy(enemies, self, engine)` | L'ennemi le plus menaçant = celui qui maximise `bestEnemyDamageAgainst` |
| `wouldKoUs(enemies, self, engine)` | Vrai si un move d'un ennemi peut mettre `self` KO (`bestEnemyDamageAgainst ≥ currentHp`) |
| `isHealthyTarget(mon, ratio?)` | Cible « en forme » : `currentHp / maxHp ≥ ratio` (défaut 0.7) |
| `anyEnemyCanStrike(enemies, self, moveRegistry, engine)` | Un ennemi a-t-il un move offensif à portée de nous (portage sans calcul de dégâts, pour les charges Mitra-Poing/Bec-Canon) |
| `anyEnemyPhysicalStriker(enemies, self, moveRegistry, engine)` | Idem filtré `Category.Physical` (pour Carapiège, qui ne s'arme que sur un coup physique) |
| `abilityNeutralizeValue(abilityId?)` | Valeur de neutralisation d'un talent défensif (table curée) — Suc Digestif/Soucigraine |
| `abilityCopyValue(abilityId?)` | Valeur d'un talent offensif/vitesse continu à copier (table curée, 0 pour les talents battle-start-only) — Imitation/Échange |
| `bestGroundThreatFraction(enemies, self, engine, moveRegistry)` | Meilleure fraction de PV qu'un move Sol adverse peut infliger — Vol Magnétik (fuite de menace) |
| `survivesLethalHit(target)` | Vrai si la cible porte Ceinture Force/Fermeté à PV pleins, Bandeau, ou Baie Sitrus non consommée (faux-KO à déjouer) |
| `isImmuneToMoveType(target, move, engine)` | Immunité de type non vue par `estimateDamage` (Sol vs Lévitation/Ballon/volant effectif) |
| `occupantAt(state, position)` | Occupant d'une case : vivant prioritaire sinon KO — seule primitive qui doit voir les KO (Vœu Soin, ciblage tuile) |

Utilisées par (plan 159) : **OHKO** (déni de menace ×1.5 si la cible est `highestThreatEnemy` ou `wouldKoUs`), **Malédiction** (branche Spectre valorisée contre `isHealthyTarget`), **Transform** (préfère copier `highestThreatEnemy` à gap stat-total comparable), **ring-out par recul** (bonus ×1.5 si la cible éjectée est `highestThreatEnemy`).

Les 8 primitives supplémentaires (plan 160) alimentent la passe groupée Phase 2 — voir § Pipeline de scoring, point 8-19, pour le détail par famille.

## Sélection d'action (`pickScoredAction`)

```
1. Scorer toutes les actions légales
2. Trier par score décroissant
3. Filtrer les scores négatifs
4. Prendre le top-N (selon profil)
5. Selon randomWeight : prendre le meilleur OU piocher dans le top-N
```

C'est ici que la difficulté intervient. **Le scoring est identique** — seul le choix final change.

## Niveaux de difficulté

La difficulté est définie par un `AiProfile` :

```typescript
interface AiProfile {
  difficulty: AiDifficulty;    // easy | medium | hard
  randomWeight: number;        // 0-1, proba de choisir sous-optimal
  topN: number;                // nombre de candidats considérés
  scoringWeights: ScoringWeights;
}
```

### Ce qui change entre les niveaux

| Paramètre | Easy | Medium | Hard |
|-----------|------|--------|------|
| `randomWeight` | 0.4 (40% sous-optimal) | 0.15 (15%) | 0 (toujours optimal) |
| `topN` | 3 | 2 | 1 |
| `killPotential` | 10 | 10 | 10 |
| `typeAdvantage` | 3 | 3 | 5 |
| `positioning` | 2 | 2 | 3 |
| `statChanges` | 1 | 1 | 2 |

### Effet concret

- **Easy** : voit les bonnes actions mais en choisit une sous-optimale 40% du temps dans le top 3.
  Rate parfois un KO, se déplace un peu au hasard, ne maximise pas toujours le type advantage.
- **Medium** : plus cohérente, pioche rarement en dehors du meilleur. Quasi toujours le bon move.
- **Hard** : joue toujours le coup optimal. Mêmes poids que Medium mais `typeAdvantage` et `positioning` comptent plus — elle optimise chaque tile, chaque matchup.

### Ce qui est commun à tous les niveaux

- Le pipeline de scoring (collecte, tiles affectées, estimateDamage, lookahead)
- Le filtrage des scores négatifs
- L'orientation EndTurn vers l'ennemi
- La gestion du friendly fire
- Le `AiTeamController` (boucle Move → UseMove → EndTurn)

## Portée max par targeting (`getMoveMaxReach`, `ai/move-reach.ts`)

| Pattern | Portée | Exemple |
|---------|--------|---------|
| Single | `range.max` | Lanceflamme (3) |
| Cone | `range.max` | Flammèche (2) |
| Line | `length` | Ultralaser (5) |
| Slash | 1 (adjacence) | Tranche |
| Dash | `maxDistance` | Volt Tackle (4) |
| Zone | `radius` | Séisme (2) |
| Cross | `size / 2` | Onde de Choc |
| Blast | `range.max + radius` | Bombe Beurk |
| Self | 0 | Épée Danse |

## Limitations actuelles

- **Pas de mémoire** : l'IA n'apprend pas des tours précédents (pas de tracking des moves adverses)
- **Pas de prédiction** : ne prédit pas les actions du joueur au tour suivant
- ~~estimateDamage approximatif~~ **résolu (plan 159, 2026-07-14)** : `attackerPosition?` sur `estimateDamage` calcule hauteur/terrain/facing depuis la position candidate (plus depuis `attacker.position`), et `evaluateAttacksFromPosition` vérifie la ligne de vue (`hasLineOfSightFrom`) — plus de « sniper fantôme » à travers un mur. Reste une approximation résiduelle : le lookahead utilise toujours la **portée max** (`getMoveMaxReach`), pas la forme exacte du targeting (cône/ligne/zone).
- **Pas de coordination d'équipe** : chaque Pokemon joue indépendamment
- **Pas de positionnement préparatoire pour le ring-out** : l'IA joue un ring-out par recul quand la géométrie fonctionne déjà depuis sa case courante, mais ne se déplace pas exprès pour l'aligner, et ne protège pas sa propre position d'un ring-out adverse (Phase 2, plan 159, différé `docs/next.md`)
- **Movement = 3 pour tous** : hardcodé, pas lié aux stats du Pokemon (à corriger)
- ~~CT non intégré au scoring~~ **résolu (plan 165, 2026-07-21)** : heuristique KO-protégé — voir § Pondération CT ci-dessus. Reste hors périmètre v1 : les branches à `return` anticipé (OHKO, Explosion/Destruction, Tout ou Rien, Souvenir, Vœu Soin, Croc Fatal, Balance/Effort, Transform, Buée Noire, stat-manip, self-buffs, moves alliés) ne sont pas pondérées par le CT — leur scoring bespoke reflète déjà l'engagement. Un lookahead multi-tour (approche B envisagée puis écartée, voir plan 165) resterait un levier futur optionnel pour l'anticipation de l'IA difficile, à rouvrir seulement si un playtest le réclame.
- **Navigation long terme limitée** : `computePathDistance` évalue si une destination est atteignable, mais la navigation sur plusieurs tours (contournement de murs, emprunt de rampes) reste limitée par le BFS à budget du mouvement courant.
- ~~**Familles restantes sans heuristique fine (Phase 3, différé)**~~ **résolu (plan 161, 2026-07-14 ; dernier reliquat item-interaction utilitaires — Tour de Magie/Passe-Passe/Gaz Corrosif — clos par la décision #714, 2026-07-23)** : Stat/state manip, item-interaction utilitaires, pièges purs position-linked (Barrage/Regard Noir), crit-manip Batch A (Puissance/Affilage/Cri Draconique/Yama Arashi/Dark Lariat), Cognobidon/Attraction sont désormais toutes valorisées dans `action-scorer.ts`. **Seul reliquat IA restant** : objets tenus passifs légers (plan 158) — won't-fix documenté (décision #714), toujours-actifs et ne conditionnant aucune décision IA, un bonus dédié serait du bruit. Voir `docs/next.md`.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `core/src/ai/action-scorer.ts` | Scoring de chaque action (terrain penalty, path distance, ring-out, heuristiques haut-impact, passe groupée Phase 2, pondération CT KO-protégé plan 165) |
| `core/src/ai/threat-detection.ts` | Primitives de menace partagées (`highestThreatEnemy`, `wouldKoUs`, `isHealthyTarget`, `bestEnemyDamageAgainst`, + 8 primitives plan 160) |
| `core/src/ai/move-reach.ts` | `getMoveMaxReach` — portée max par targeting (extrait de `action-scorer.ts`, plan 160) |
| `core/src/ai/scored-ai.ts` | Sélection pondérée top-N |
| `core/src/ai/ai-profiles.ts` | Profils Easy / Medium / Hard |
| `core/src/types/ai-profile.ts` | Interface `AiProfile` + `ScoringWeights` |
| `core/src/enums/ai-difficulty.ts` | Enum `AiDifficulty` |
| `core/src/battle/knockback-prediction.ts` | Prédicteur pur du recul (déplacement/glissade/chute/terrain létal), source unique partagée avec `handle-knockback.ts` |
| `core/src/battle/BattleEngine.ts` | `getTileAt`, `getPokemonTypes`, `computePathDistance`, `estimateDamage` (param `attackerPosition?`), `hasLineOfSightFrom`, `predictKnockback` (API publique pour le scorer) |
| `renderer/src/game/AiTeamController.ts` | Orchestration du tour IA |
