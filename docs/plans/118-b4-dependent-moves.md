# Plan 118 — B4 « Terrains » (suite) : 6 moves dépendants des Champs

> **Statut : implémenté** (2026-06-09 — 7 moves livrés, 386→393, B4 clos 10/10 ; gate vert : 2630 unit + 269 intégration ; décisions #440–#447. Design tranché humain 2026-06-09 ; reviews plan-reviewer + game-designer + delta canon intégrées)
>
> **Notes d'implémentation** : (1) les 6 moves dépendants + Boue-Bombe + les 10 cibles de morph (energy-ball/thunderbolt/moonblast/psychic/tri-attack/hydro-pump/lava-plume/ice-beam/earth-power/power-gem) étaient déjà présents dans `reference/moves.json` ET `tactical.ts` (thunderbolt/moonblast/psychic en clés non-quotées) → aucune entrée reference ni `learnset-extensions` ajoutée (les 6 dépendants sont apprenables nativement par le roster). (2) **Vaste Pouvoir morph = `Blast { range 1–4, radius 2 }`** (centré sur la cible) et non `Zone` (centré sur le lanceur), pour coller à « AoE r2 autour de la cible ». (3) Champ power bonus via `fieldTerrainPowerBonus` (décision #447) — pas `DynamicPowerKind`. (4) #445 (Mewtwo) : `expanding-force` n'était dans aucun op-set/custom → rien retiré.
> Suite directe du **plan 117** (moteur de Champs zonés + 4 poseurs). Achève le batch B4 de la roadmap maître **plan 112** (10/10 moves).
> Total moves visé : 386 → **393** (+6 dépendants + 1 sous-livrable **Boue-Bombe** requis par le mapping canon de Force Nature).
> Worktree : `plan-118-b4-dependent` (port Vite 5216).

## Objectif

Livrer les **6 moves qui exploitent/scalent selon le Champ actif** posé par le plan 117. Chaque move ajoute une sous-mécanique distincte, **réinterprétée grid-native** (pas de calque sur la priorité Showdown, qui n'existe pas dans notre système CT/tour-par-tour) :

| Nom FR | id | Type | Cat. | Sous-mécanique nouvelle |
|--------|-----|------|------|-------------------------|
| **Gliss'Herbe** | `grassy-glide` | Plante | Phys | Dash dont la **portée s'étend** sur Champ Herbu (2 → 4) |
| **Monte-Tension** | `rising-voltage` | Élec | Spé | Puissance **×2 si la cible** est sur Champ Électrifié |
| **Vaste Pouvoir** | `expanding-force` | Psy | Spé | **Ciblage dynamique** : Single → Zone r2 + ×1.5 sur Champ Psychique |
| **Explo-Brume** | `misty-explosion` | Fée | Spé | **Self-KO** (explosion) + ×1.5 sur Champ Brumeux |
| **Champlification** | `terrain-pulse` | Normal→morph | Spé | **Type morph** selon le Champ sous le lanceur + ×2 |
| **Force Nature** | `nature-power` | Normal→morph | — | **Move morph** complet selon Champ **ou tuile de map** |

Les noms FR officiels sont **déjà présents** dans `packages/data/src/i18n/moves.{fr,en}.json` (vérifié 2026-06-09). Les moves-cibles de Force Nature / Champlification sont **tous déjà implémentés** dans `tactical.ts`.

## Décisions design (tranchées humain 2026-06-09)

| # | Décision |
|---|----------|
| **#439** | **Gliss'Herbe = move Dash, pas priorité.** Le système de tour est CT/RoundRobin tactique : aucune priorité move-level (la vraie priorité = chantier B9, hors-scope). Réinterprétation grid-native : Gliss'Herbe est un **Dash de portée 2** (contact, Plante, Phys) ; sur Champ Herbu, sa **portée passe à 4**. La portée est **calculée au point de départ** (case du lanceur au moment de l'action) → un Gliss'Herbe lancé depuis l'intérieur d'une zone Herbu peut **sortir de la zone** (porte jusqu'à 4 cases). Le boost Plante terrain (×1.3, plan 117) s'applique en plus si le lanceur part de la zone. |
| **#440** | **Vaste Pouvoir : Single → Zone r2 + ×1.5 sur Champ Psychique.** Hors-zone : Single (range 1-4), 80 BP. Si le lanceur est sur une zone Psychique (au sol) : devient **AoE Zone rayon 2** autour de la cible **et** 120 BP (×1.5). Vraie montée en puissance tactique qui récompense les ennemis groupés. |
| **#441** | **Force Nature : mapping canon Gen 7/8 étendu aux TerrainType de map** (pas seulement les Champs). Précédence : **(1)** Champ-zone sous le lanceur (décision #429) > **(2)** `TerrainType` de la tuile sous le lanceur > **(3)** défaut Triplattaque. Référence = dernière géné jouable (Gen 9 a retiré le move). Choix actés : volcan/magma/lave → **Ébullilave** (Feu) ; neige **et** glace → **Laser Glace** (Glace, canon Gen 7/8) ; marais → **Boue-Bombe** (Sol, **nouveau move à implémenter**) ; rocheux/obstacle → Rayon Gemme. Table complète §6. |
| **#442** | **Découpage maintenu** : ce plan = les 6 dépendants, 1 commit, livrable seul. Clôt B4 (10/10). |
| **#443** | **Champlification exemptée du boost-type terrain** (review game-designer). Le morph ×2 (50→100) est déjà l'identité du move ; empiler le ×1.3 `getFieldTerrainBpModifier` par-dessus (~130 BP effectif) crée deux multiplications invisibles au même instant — opaque. `terrain-pulse` ne passe **pas** par `getFieldTerrainBpModifier`. |
| **#444** | **Vaste Pouvoir exemptée du boost-type terrain** (review game-designer). Sur Champ Psychique : ×1.5 Zone uniquement, **pas** de ×1.3 supplémentaire. Sinon Alakazam atteint ~234 BP effectif en AoE r2 sans recharge (120 ×1.5 STAB ×1.3). Le ×1.5 Zone + STAB suffit comme récompense. `expanding-force` ne passe **pas** par `getFieldTerrainBpModifier`. |
| **#445** | **Vaste Pouvoir retirée du moveset de Mewtwo** (override tactique, review game-designer). 154 Atk Spé base + AoE r2 sur son propre Champ Psy = trop dominant. Lippoutou/Alakazam/Staross etc. suffisent comme porteurs. |

> Numérotation `decisions.md` : à recaler à l'écriture (le dernier acté plan 117 = #438). Ces #439–#445 sont indicatifs.

> **Surveillance playtest (game-designer, pas d'ajustement pré-impl)** : **Raichu apprend à la fois Champ Électrifié ET Monte-Tension** → combo 140 BP ×1.5 STAB = ~210 BP single r4 dans une même équipe. Combo intentionnel acceptable (Raichu a déjà Voltacle 120). Si dominant en playtest → retirer Champ Électrifié de Raichu (déléguer le poseur à Voltali, garder Monte-Tension sur Raichu).

## Pré-requis (déjà livrés plan 117)

- `FieldTerrain` enum + `FieldZone` + `state.fieldTerrains[]`.
- `field-terrain-system.ts` : `getFieldTerrainAt(state, pos)`, `isOnFieldTerrain(state, mon, kind)` (double porte position + au-sol), `enumerateZoneTiles`, etc.
- `damage-calculator` : `getFieldTerrainBpModifier` / `getFieldTerrainDefenseModifier` (boost/réduction de type) + signature étendue.
- Patterns moteur réutilisables :
  - **`weatherBoostedType` + `resolveWeatherBallMove`** (`handle-damage.ts`) → modèle pour Champlification (type morph).
  - **`self-destruct`** (`{ Zone radius 2 } + Recoil fraction: 999`) → modèle pour Explo-Brume (self-KO + AoE).
  - **`dynamicPower` + `DynamicPowerKind`** → modèle pour Monte-Tension (×2 conditionnel).
  - **`TargetingKind.Dash { maxDistance }`** → modèle pour Gliss'Herbe.

## Sous-mécaniques à construire

### 1. Gliss'Herbe — Dash à portée variable selon terrain (#439)

- Move data : `{ TargetingKind.Dash, maxDistance: 2 }`, Plante, Phys, contact, 55 BP, effet `Damage`.
- **Nouveau champ** `MoveDefinition.dashRangeBonusOnFieldTerrain?: { terrain: FieldTerrain; bonus: number }` (générique, réutilisable). Pour Gliss'Herbe : `{ terrain: Grassy, bonus: 2 }`.
- **Résolution de portée** : au calcul des cases de dash atteignables (`resolveDash` / `getDashPositions` dans `grid/targeting.ts`), si `isOnFieldTerrain(state, caster, terrain)` au **point de départ** → `maxDistance + bonus`. Sinon `maxDistance`.
  - La portée est figée par la case de départ : un dash de 4 peut traverser le bord de la zone et atterrir hors zone (intentionnel #439).
  - Cohérence preview/`getLegalActions`/exécution : le helper de portée est appelé partout → bonus visible en preview (le joueur voit les 4 cases).
- **Interaction barrière Psy (plan 117)** : Gliss'Herbe est un Dash → reste soumis à `isEnemyPsychicBarrierAt` en exécution (`dashMoveCaster`). Cohérent.
- Tag MoveTooltip FR/EN : « Dash portée 2 → 4 sur Champ Herbu ».

### 2. Monte-Tension — ×2 si la cible est sur Champ Électrifié

- Move data : `{ TargetingKind.Single, range: { min: 1, max: 4 } }`, Élec, Spé, 70 BP.
- **Nouveau `DynamicPowerKind.TargetOnFieldTerrain`** (paramétré) — resolver dans `dynamic-power-system.ts` : ×2 si `isOnFieldTerrain(state, target, Electric)`. Spec `dynamicPower: { kind: TargetOnFieldTerrain, terrain: Electric, multiplier: 2 }`.
  - Lit la **position de la cible** (pas du lanceur). `DynamicPowerInput` expose déjà `target` + `state`.
- Tag MoveTooltip : « Puissance ×2 si la cible est sur Champ Électrifié ».

### 3. Vaste Pouvoir — ciblage dynamique Single → Zone r2 (#440)

- Move data de base : `{ TargetingKind.Single, range: { min: 1, max: 4 } }`, Psy, Spé, 80 BP.
- **Nouveau champ** `MoveDefinition.fieldTerrainTargetingOverride?: { terrain: FieldTerrain; targeting: Targeting; powerMultiplier: number }`. Pour Vaste Pouvoir : `{ terrain: Psychic, targeting: { Zone, radius: 2 }, powerMultiplier: 1.5 }`.
- **Résolution** : si `isOnFieldTerrain(state, caster, Psychic)` au moment de l'action → on substitue le `targeting` (Single → Zone r2) **et** on applique le `powerMultiplier` (80 → 120).
  - **⚠️ Source de vérité = position du lanceur à l'exécution** (pas un snapshot figé à la sélection). Le `targeting` morphé est calculé par le helper **`resolveEffectiveTargeting(move, caster, state): Targeting`** (morph de ciblage local, retourne un `Targeting`) appelé à **3 endroits qui doivent rester cohérents** : (a) `getLegalActions` (légalité + IA scoring), (b) le preview renderer, (c) la résolution de ciblage à l'exécution. La case du lanceur étant connue à chaque appel, la résolution est déterministe et toujours alignée sur la position courante → pas de décalage temporel.
  - **Audit pré-requis (étape 6)** : repérer le point unique où `getLegalActions` (`action-availability.ts`) dérive les cibles depuis `move.targeting`, et l'exécution dans `BattleEngine.executeUseMove` — y router `resolveEffectiveTargeting` plutôt que `move.targeting` brut. Sans ça l'IA voit Single et lance Zone (bug imprévisible). C'est le point de risque n°1 du plan.
  - Le `powerMultiplier` (×1.5) passe par le pipeline `dynamicPower` via `DynamicPowerKind.CasterOnFieldTerrain { terrain: Psychic, multiplier: 1.5 }` (kind générique partagé avec Explo-Brume, §4). Le targeting-override (`fieldTerrainTargetingOverride`) est **séparé** (résolu par `resolveEffectiveTargeting`, pas par dynamicPower).
  - **Pas de boost-type terrain** (décision #444 : `expanding-force` exempté de `getFieldTerrainBpModifier`).
- Tag MoveTooltip : « Sur Champ Psychique : touche une zone (rayon 2) + ×1.5 ».

### 4. Explo-Brume — self-KO + ×1.5 sur Champ Brumeux

- Move data : `{ TargetingKind.Zone, radius: 2 }`, Fée, Spé, 100 BP, effets `[Damage, Recoil { fraction: 999 }]` (modèle `self-destruct` → le lanceur tombe KO).
- **`DynamicPowerKind.CasterOnFieldTerrain`** (générique) : ×1.5 si `isOnFieldTerrain(state, caster, Misty)`. Spec `dynamicPower: { kind: CasterOnFieldTerrain, terrain: Misty, multiplier: 1.5 }`.
- Centrage : comme `self-destruct`, l'explosion est centrée sur la case du lanceur (zone r2). Le lanceur subit le Recoil 999 → KO en fin d'effet.
- Tag MoveTooltip : « Le lanceur tombe K.O. · ×1.5 sur Champ Brumeux ».

> `DynamicPowerKind.CasterOnFieldTerrain` et `TargetOnFieldTerrain` sont **deux kinds paramétrés** (terrain + multiplier dans la spec) → couvrent Monte-Tension (§2, target/Electric/×2), Explo-Brume (§4, caster/Misty/×1.5), et le ×1.5 de Vaste Pouvoir (§3, caster/Psychic). Réutilisables pour de futurs moves terrain.

### 5. Champlification — type morph (modèle weather-ball)

- Move data : `{ TargetingKind.Single, range: { min: 1, max: 4 } }`, Normal (type de base), Spé, 50 BP.
- **Nouveau flag** `MoveDefinition.fieldTerrainBoostedType?: true` (miroir exact de `weatherBoostedType`).
- **Nouveau resolver** `resolveFieldTerrainPulseMove(move, caster, state)` dans `handle-damage.ts` (à côté de `resolveWeatherBallMove`) : si `fieldTerrainBoostedType` ET le lanceur est sur une zone (`getFieldTerrainAt(state, caster.position)` au sol) →
  - type = type du Champ (Grassy→Plante, Electric→Élec, Misty→Fée, Psychic→Psy),
  - power = 100 (×2).
  - Sinon : Normal, 50.
- **Ordre** : `resolveFieldTerrainPulseMove` s'enchaîne avec `resolveWeatherBallMove` + `resolveDynamicPower` dans `dealSingleHit`.
- **Pas de cumul avec le boost-type terrain** (décision #443) : `terrain-pulse` est **exempté de `getFieldTerrainBpModifier`** (le morph ×2 est déjà la récompense ; empiler ×1.3 = opaque). Implémentation : `getFieldTerrainBpModifier` retourne ×1.0 si `move.fieldTerrainBoostedType === true`, ou le call-site skip pour ce flag.
- Tag MoveTooltip : « Type et puissance varient selon le Champ sous le lanceur ».

### 6. Force Nature — move morph complet (#441)

- Move data : `{ TargetingKind.Self }` nominal + **flag** `MoveDefinition.naturePowerMorph?: true`. (Self n'est qu'un placeholder : le ciblage réel vient du move morphé.)
- **Résolution `resolveNaturePowerMove(move, caster, state, grid): MoveDefinition`** (nouveau, `handle-damage.ts` ou module dédié `nature-power-system.ts`) :
  1. **Champ-zone** sous le lanceur (`getFieldTerrainAt(state, caster.position)`, au sol) prioritaire (mapping §6-A).
  2. Sinon **`TerrainType`** de la tuile de map sous le lanceur (mapping §6-B).
  3. Sinon **Triplattaque** (`tri-attack`).
  - **Mapping canon Gen 7/8** (Bulbapedia ; Gen 9 a retiré le move → on prend la dernière géné jouable, validé humain 2026-06-09).
  - Renvoie la `MoveDefinition` complète du move résolu (type, catégorie, power, **targeting**, effets) — full swap, conserve l'id source pour le log (« Force Nature → Psyko ! »).
- **⚠️ Deux helpers distincts — ne pas confondre** (clarif review) :
  - `resolveEffectiveTargeting(move, caster, state): Targeting` — §3, Vaste Pouvoir : morphe **localement** le `targeting` d'un move donné (Single→Zone). Retourne un `Targeting`.
  - `resolveNaturePowerMove(move, caster, state, grid): MoveDefinition` — §6, Force Nature : **remplace le move entier**. Retourne une `MoveDefinition`.
  - Ils ne sont **pas** fusionnés. Pour Force Nature, `getLegalActions`/preview/exécution doivent d'abord appeler `resolveNaturePowerMove` pour obtenir le move résolu, **puis** utiliser **son** `targeting` (le `resolveEffectiveTargeting` de §3 ne s'applique pas à Force Nature).
- **Ciblage** : source de vérité = position du lanceur **à chaque appel** (même principe que §3 — pas de snapshot figé). Comme la case du lanceur est connue à `getLegalActions` / preview / exécution, le morph est déterministe et cohérent. Le même point d'injection que §3 (audit étape 6) route `resolveNaturePowerMove` en amont.
- **Edge case Champ expiré entre sélection et exécution** : le morph est **re-résolu à l'exécution** sur l'état courant. Si le Champ a disparu (décrément fin de round, ou KO/déplacement), Force Nature redevient Triplattaque à l'exécution. Comportement assumé (cohérent avec « source de vérité = état courant ») → **test dédié**.
- **PP** : on dépense les PP de `nature-power` (pas du move morphé).

#### §6-A — Mapping Champ (priorité 1)

| Champ | Move résolu (FR) | id | Type |
|-------|------------------|-----|------|
| Herbu | Éco-Sphère | `energy-ball` | Plante |
| Électrifié | Tonnerre | `thunderbolt` | Élec |
| Brumeux | Pouvoir Lunaire | `moonblast` | Fée |
| Psychique | Psyko | `psychic` | Psy |

#### §6-B — Mapping `TerrainType` (priorité 2, canon Gen 7/8 — validé #441)

| TerrainType | Move résolu (FR) | id | Type | Note |
|-------------|------------------|-----|------|------|
| `normal` | Triplattaque | `tri-attack` | Normal | défaut (bâtiment/plaine) |
| `tall_grass` | Éco-Sphère | `energy-ball` | Plante | grass |
| `water` | Hydrocanon | `hydro-pump` | Eau | water |
| `deep_water` | Hydrocanon | `hydro-pump` | Eau | underwater (flyer au-dessus) |
| `magma` | Ébullilave | `lava-plume` | Feu | volcano |
| `lava` | Ébullilave | `lava-plume` | Feu | volcano (flyer au-dessus, infranchissable) |
| `ice` | Laser Glace | `ice-beam` | Glace | ice |
| `snow` | Laser Glace | `ice-beam` | Glace | snow (Gen 7/8 — choix canon récent #441) |
| `sand` | Telluriforce | `earth-power` | Sol | sand/desert |
| `swamp` | **Boue-Bombe** | `mud-bomb` | Sol | marsh — **move à implémenter (sous-livrable §7)** |
| `obstacle` | Rayon Gemme | `power-gem` | Roche | cave/rocheux (flyer au-dessus, infranchissable) |

- **Tuiles infranchissables** (`lava`/`deep_water`/`obstacle`) : un lanceur **au sol** ne peut s'y tenir → cas atteignable seulement par un **flyer positionné au-dessus**. Le mapping reste défini pour ce cas (et la complétude canon). `getFieldTerrainAt` n'intervient pas ici (priorité 2 = `TerrainType` de la tuile, lu directement depuis la grille sous le lanceur).
- Tag MoveTooltip : « Devient une attaque selon le Champ ou le terrain sous le lanceur ».

## Couche de données (`tactical.ts`)

```ts
"grassy-glide":     { Dash maxDistance:2, dashRangeBonusOnFieldTerrain:{Grassy,+2}, effects:[Damage] },        // Plante Phys 55
"rising-voltage":   { Single 1-4, dynamicPower:{TargetOnFieldTerrain, Electric, ×2}, effects:[Damage] },        // Élec Spé 70
"expanding-force":  { Single 1-4, fieldTerrainTargetingOverride:{Psychic, Zone r2, ×1.5},
                      dynamicPower:{CasterOnFieldTerrain, Psychic, ×1.5}, effects:[Damage] },                   // Psy Spé 80
"misty-explosion":  { Zone radius:2, dynamicPower:{CasterOnFieldTerrain, Misty, ×1.5},
                      effects:[Damage, Recoil{fraction:999}] },                                                // Fée Spé 100
"terrain-pulse":    { Single 1-4, fieldTerrainBoostedType:true, effects:[Damage] },                            // Normal Spé 50
"nature-power":     { Self, naturePowerMorph:true, effects:[] },                                               // morph complet
"mud-bomb":         { Single 1-4, effects:[Damage, StatChange{Accuracy -1, chance:30, target}] },               // Sol Spé 65 acc85 — sous-livrable Force Nature
```

### Sous-livrable — Boue-Bombe (`mud-bomb`)

Requis par le mapping canon §6-B (marais → Boue-Bombe). Move standard Gen 4, zéro mécanique nouvelle (Damage + secondaire baisse Précision, déjà supporté). Stats canon : **Sol, Spé, 65 BP, 85 acc, 10 PP, 30 % baisse Précision -1**. Single range 1-4. Noms FR/EN déjà en i18n (Boue-Bombe / Mud Bomb). Apprenabilité : pas besoin d'être dans un moveset roster (cible de morph uniquement) — mais le meta-test de couverture impose un `mud-bomb.test.ts`. Compte comme +1 move implémenté (→ 393).

- **Type/catégorie/BP** des 6 : à figer depuis les valeurs canon (Gen 8/9) — non présentes dans `reference/moves.json` (Gen 1 only). À renseigner en dur dans `tactical.ts` (comme les batches G). Valeurs proposées ci-dessus (BP : grassy-glide 55, rising-voltage 70, expanding-force 80, misty-explosion 100, terrain-pulse 50).
- **Learners** : ces 6 moves sont Gen 8/9, absents des learnsets Gen 1 natifs. L'index `pokemon-by-move.json` les liste (cross-roster confirmé 2026-06-09) :
  - Gliss'Herbe : Florizarre, Ortide, Empiflor, Noadkoko, Saquedeneu, Mew (6)
  - Monte-Tension : Raichu, Voltali (2)
  - Vaste Pouvoir : Grodoudou, Alakazam, Flagadoss, Hypnomade, Noadkoko, Staross, M. Mime, Lippoutou, Mewtwo, Mew (10)
  - Explo-Brume : Mélodelfe, Grodoudou, Mew (3)
  - Champlification : Florizarre, Tortank, Excelangue, Kangourex, Ronflex (5)
  - Force Nature : Parasect (1)
  - **À trancher impl** : vérifier que l'index suffit à les rendre apprenables (sinon `learnset-extensions.ts` comme plan 094). Aucun move mort.

## Événements / state

- **Pas de nouveau state.** Tout est dérivé à la volée depuis `state.fieldTerrains` (plan 117) + position du lanceur/cible.
- Nouveaux `BattleEventType` éventuels :
  - `MoveMorphed { sourceMoveId, resolvedMoveId }` (Force Nature, Champlification) — pour le log « Force Nature → Psyko ! ». **À trancher** : ou réutiliser un champ sur `MoveUsed`. Reco : champ optionnel `resolvedMoveId?` sur l'event d'usage existant plutôt qu'un nouveau type.

## IA (scoring)

- **Monte-Tension / Vaste Pouvoir / Explo-Brume / Champlification** : passent par `estimateDamage` → le pipeline `dynamicPower` + type morph est déjà routé pour l'IA (cf. plan 109). Vérifier que `estimateDamage` résout bien le type morphé (Champlification) et le targeting morphé (Vaste Pouvoir) pour un scoring correct.
- **Gliss'Herbe** : Dash → scoré par le pattern Dash existant ; la portée étendue est vue via le helper de portée commun.
- **Explo-Brume (self-KO)** : réutiliser le scoring de `self-destruct` (l'IA ne se sacrifie que si le gain ≫ coût). Bonus si lanceur sur Champ Brumeux (×1.5).
- **Force Nature** : scoré comme le move résolu (l'IA évalue le morph déterministe sous sa case). Si Self/no-terrain → Triplattaque.
- **Synergie positionnement** : hors-scope (l'IA ne se place pas exprès dans une zone — cohérent plan 117).

## Renderer + i18n

- **Aucun nouveau layer.** Les Champs sont déjà rendus (plan 117, `FieldTerrainLayer`).
- **Preview** :
  - Gliss'Herbe : preview Dash standard, portée 2 ou 4 selon zone (le helper de portée commun gère).
  - Vaste Pouvoir : preview Single ou Zone r2 selon la case du lanceur (targeting morphé résolu à la sélection).
  - Force Nature : preview du **move résolu** (la pastille/zone change selon la tuile sous le lanceur). MoveTooltip affiche « → {move résolu} ».
- **MoveTooltip** : tags FR/EN pour les 6 (descriptions ci-dessus). Pour Force Nature/Champlification : afficher dynamiquement le move/type résolu si la case du lanceur est connue.
- **BattleLogFormatter** : « Force Nature se transforme en Psyko ! », « Champlification devient de type Psy ! » (réutilise `resolvedMoveId`).
- **i18n** : noms FR déjà présents. Clés à ajouter (FR/EN), 1 tag par move + 2 log morph :
  - `moveTooltip.tag.grassyGlideDash` — « Dash portée 2 → 4 sur Champ Herbu »
  - `moveTooltip.tag.risingVoltageTerrain` — « Puissance ×2 si la cible est sur Champ Électrifié »
  - `moveTooltip.tag.expandingForceTerrain` — « Sur Champ Psychique : zone (rayon 2) + ×1.5 »
  - `moveTooltip.tag.mistyExplosionSelfKo` — « Le lanceur tombe K.O. · ×1.5 sur Champ Brumeux »
  - `moveTooltip.tag.terrainPulseMorph` — « Type et puissance varient selon le Champ »
  - `moveTooltip.tag.naturePowerMorph` — « Devient une attaque selon le Champ ou le terrain »
  - `battle.move.morphed` — « {source} se transforme en {resolved} ! » (Force Nature)
  - `battle.move.typeChanged` — « {move} devient de type {type} ! » (Champlification)

## Tests (test-writer) — 1 fichier `{id}.test.ts` par move + système

- **grassy-glide** : dash portée 2 hors zone ; portée 4 si lanceur part d'une zone Herbu ; portée calculée au départ (atterrissage hors zone OK) ; bloqué par barrière Psy ennemie en exécution ; boost Plante ×1.3 si départ sur zone.
- **rising-voltage** : 70 BP si cible hors zone Électrifié ; 140 si cible **au sol sur** zone Électrifié ; cible flyer sur zone → **pas** de ×2 (double porte).
- **expanding-force** : Single 80 hors zone Psychique ; sur zone Psychique (lanceur au sol) → Zone r2 + 120 ; preview/`getLegalActions` reflète le morph de ciblage ; lanceur flyer sur zone → pas de morph.
- **misty-explosion** : Zone r2 centrée lanceur ; lanceur KO après usage (Recoil 999) ; 100 BP hors zone, 150 si lanceur sur Champ Brumeux.
- **terrain-pulse** : Normal 50 hors zone ; sur Herbu → Plante 100 ; Électrifié → Élec 100 ; Brumeux → Fée 100 ; Psychique → Psy 100 ; cumul/exemption boost terrain (selon décision game-designer §5).
- **nature-power** : Triplattaque hors terrain ; morph Champ §6-A (4 kinds) ; morph `TerrainType` §6-B (tall_grass→energy-ball, water/deep_water→hydro-pump, magma/lava→lava-plume, ice/snow→ice-beam, sand→earth-power, swamp→mud-bomb, obstacle→power-gem) ; précédence Champ > tuile > défaut ; targeting du move résolu appliqué ; PP de nature-power dépensé ; **edge case** : Champ Psychique sous le lanceur puis expiré avant l'exécution → redevient Triplattaque (re-résolu sur état courant) ; **barrière Psy** : Force Nature morphée en Éco-Sphère (Single, pas un Dash) lancée près d'une zone Psy ennemie → **passe** (la barrière ne bloque que les Dash).
- **mud-bomb** : `mud-bomb.test.ts` standard (dégâts Single + baisse Précision 30 %).
- **Système** : `resolveNaturePowerMove` (précédence), `resolveFieldTerrainPulseMove` (type+BP, exempt boost-type), `resolveEffectiveTargeting` (Vaste Pouvoir Single→Zone — cohérence légalité/preview/exécution), helper de portée Dash terrain, `DynamicPowerKind.{CasterOnFieldTerrain, TargetOnFieldTerrain}`. Tests **round ET CT** si un décrément de Champ intervient.

## Étapes

1. `test-writer` : specs des 6 moves + système (échouent d'abord).
2. **Enums / types** :
   - `DynamicPowerKind.CasterOnFieldTerrain` + `TargetOnFieldTerrain` (kinds paramétrés terrain+multiplier).
   - `MoveDefinition` : `dashRangeBonusOnFieldTerrain?`, `fieldTerrainTargetingOverride?`, `fieldTerrainBoostedType?`, `naturePowerMorph?`.
   - (Éventuel) champ `resolvedMoveId?` sur l'event d'usage de move.
3. **`dynamic-power-system.ts`** : resolvers `CasterOnFieldTerrain` / `TargetOnFieldTerrain` (lisent `isOnFieldTerrain`). **Tests isolés des 2 kinds** dans `dynamic-power-system.test.ts` (chacun ×mult quand on/off zone, caster vs target) — éviter qu'un kind oublié passe inaperçu.
4. **`handle-damage.ts`** : `resolveFieldTerrainPulseMove` (Champlification, après `resolveWeatherBallMove`) ; chaînage avec `resolveDynamicPower`. Exempter `terrain-pulse` (#443) + `expanding-force` (#444) de `getFieldTerrainBpModifier`.
5. **`nature-power-system.ts`** (helper dédié) : `resolveNaturePowerMove(move, caster, state, grid): MoveDefinition` (précédence Champ > TerrainType > Triplattaque) + table de mapping §6.
6. **Audit + ciblage dynamique** (point de risque n°1) : auditer `getLegalActions` (`action-availability.ts`) + `BattleEngine.executeUseMove` + le preview renderer pour identifier le point unique où le ciblage dérive de `move.targeting`. Y router : (a) `resolveEffectiveTargeting(move, caster, state): Targeting` pour Vaste Pouvoir (Single→Zone) ; (b) `resolveNaturePowerMove(...).targeting` pour Force Nature. Garantir que les 3 sites (légalité/IA, preview, exécution) lisent la **position courante** du lanceur (pas de snapshot figé).
7. **Portée Dash terrain** (Gliss'Herbe) : auditer si la portée Dash vient de `resolveDash` ou d'un `getDashPositions` séparé, puis **mutation localisée** du calcul de `maxDistance` effectif = `move.maxDistance + (isOnFieldTerrain(caster, terrain) ? bonus : 0)`, lu au **point de départ**. Helper de portée commun à preview + `getLegalActions` + exécution.
8. **Data `tactical.ts`** : 6 entrées dépendants + **Boue-Bombe** (sous-livrable, valeurs canon ci-dessus) + valeurs canon (type/cat/BP) des 6. **Pré-valider l'apprenabilité** des 6 dépendants (`pokemon-by-move.json` cross-roster ; ajouter `learnset-extensions.ts` si l'index ne suffit pas — comme plan 094) **avant de marquer ready**. Boue-Bombe n'a pas besoin de learner (cible de morph).
9. **IA** : vérifier routage `estimateDamage` (type+targeting morphés) ; réutiliser scoring `self-destruct` pour Explo-Brume.
10. **Renderer** : previews morphés (Vaste Pouvoir, Force Nature, Gliss'Herbe portée) ; MoveTooltip tags + résolution dynamique ; BattleLogFormatter morph. i18n FR/EN (tags + log).
11. Gate CI verte.
12. **Docs** : `implementations.md` 386 → **393** (6 dépendants + Boue-Bombe) ; `plan 112` B4 **10/10 ✅** ; `decisions.md` #439–#445 ; `next.md` (B4 clos → prochain batch vague 2 = B5 Objet tenu) ; `STATUS.md`.

## Risques / surveillance

- **Cumul Champlification** → **résolu** (décision #443 : exempté du boost-type). Sur Champ assorti = ×2 morph seul, ~100 BP effectif. OK.
- **Vaste Pouvoir Alakazam/Mewtwo** → **résolu** (#444 exempt boost-type, #445 retiré de Mewtwo). Reste fort sur Alakazam (120 ×1.5 STAB = 180 AoE r2) mais nécessite poser + se tenir sur Champ Psy → coût d'action. Surveiller playtest.
- **Monte-Tension + Raichu** (combo poseur+tireur même équipe, ~210 BP STAB single r4) → surveillance playtest, garde-fou = retirer Champ Électrifié de Raichu si dominant (voir frontmatter).
- **Force Nature full swap** = mécanique la plus lourde (résolution targeting variable, preview dynamique). Risque de complexité UI (le joueur doit comprendre ce que devient le move). Mitigation : MoveTooltip affiche le move résolu sous la case courante.
- **Gliss'Herbe portée 4** : un Dash contact de portée 4 (depuis zone Herbu) est mobile + agressif. Vérifier qu'il ne casse pas l'équilibre des dashers (cf. roster ~5 dashers). Acceptable a priori (nécessite Champ Herbu posé + Plante-type).
- **Explo-Brume self-KO** : déjà cadré par le modèle `self-destruct` (l'IA et les tests existent). Le ×1.5 Brumeux ne change pas le profil de risque.

## Hors-scope

- **Priorité move-level réelle** (vrai champ `priority` intégré au CT) → batch **B9** (Priorité & ordre conditionnel).
- **IA de positionnement** (se placer exprès dans une zone) → amélioration ultérieure du scoring de mouvement (cohérent plan 117).
- **Interaction Champs × abilities** (Grassy Surge, etc.) → hors roster Gen 1.
