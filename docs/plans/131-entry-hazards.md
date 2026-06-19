# Plan 131 — Entry Hazards (Pièges au sol)

**Statut : done (2026-06-19)**
**Phase 4 — Mécaniques restantes (moves complexes), famille « Hazards ».**

## But

Porter les **entry hazards** Pokemon (Picots / Pièges de Roc / Pics Toxik / Toile Gluante) dans un jeu **tactique sur grille** sans switch-in. Adaptation : **pièges posés une case à la fois, à distance**, qui se déclenchent quand un **ennemi du lanceur entre** sur une case piégée. Un vrai champ de mines se **construit sur plusieurs tours** (investissement tactique).

### Décisions de design (tranchées avec l'humain, 2026-06-18)

| Axe | Choix |
|-----|-------|
| **Placement** | **1 lancer = 1 case** (la case visée, ≤ `HAZARD_AIM_RANGE` Manhattan). Pas de diamant : pour couvrir une zone, le lanceur dépense plusieurs tours. |
| **Couches (stacking)** | Re-lancer le **même piège sur la même case** = **+1 couche** (cap par kind). **Picots** 3, **Pics Toxik** 2, **Pièges de Roc** & **Toile Gluante** 1 (canon). Au cap → no-op. |
| **Déclenchement** | **À l'ENTRÉE** d'une case piégée pendant un déplacement. Cumul sur cases distinctes traversées. **Pas** à la sortie ; un piège **posé sous un Pokémon déjà présent ne le touche pas** (il faut pénétrer la case). |
| **Durée** | **Permanent** jusqu'à retrait (pas de timer, pas d'horloge fantôme — plus simple que Champs). |
| **Tir ami** | **Ennemis du lanceur seulement.** Chaque piège porte `ownerPlayerId` ; même `playerId` = traverse sans danger. |
| **Retrait** | **Tour Rapide** (`rapid-spin`) et **Anti-Brume** (`defog`) nettoient les pièges **≤ r2 (Manhattan) autour de l'utilisateur**. |
| **Périmètre v1** | Les **4** pièges + 2 removers. |

### Réglages par défaut (mineurs, override humain possible)

- `HAZARD_AIM_RANGE = 4` (Manhattan). Pose-and-forget faible car 1 case/lancer.
- Coût CT des setters : **standard move statut (~500 CT)**, pas `major-status` — bâtir une zone coûte déjà plusieurs tours.

### Règles canon (tranchées par Claude)

- **Picots** / **Pics Toxik** / **Toile Gluante** : **sol uniquement** — `isEffectivelyFlying` (Vol / Lévitation / semi-invul aérien) ⇒ immunisé.
- **Pièges de Roc** : touche **tout le monde** (même les Vol), dégâts de **type Roche** modulés par l'efficacité de type vs cible.

## Mécanique cœur — déclenchement à l'entrée

### Sémantique d'entrée

- On déclenche pour chaque case piégée sur laquelle le Pokémon **pénètre** pendant son déplacement → dans `resolveHazardTraversal`, on **ignore la case de départ** du chemin (on n'« entre » pas là où on était).
- Un piège posé sur un Pokémon stationnaire **ne déclenche pas** (pas d'entrée) ; il déclenchera s'il sort puis revient.

### Modèle de cumul

- **Dégâts** (Picots, Pièges de Roc) : **cumulatifs par case piégée distincte traversée** (entrer sur 3 cases piégées → 3 hits, chacun selon la couche de SA case).
- **Stat-drop** (Toile Gluante → Vitesse −1) : **cumulatif par case** (« au joueur de faire gaffe » ; bâtir 3 cases coûte 3 tours). Recompute `derivedStats.movement` à chaque application.
- **Statut** (Pics Toxik) : **idempotent** — la 1ʳᵉ case applicable empoisonne, les suivantes ne re-déclenchent rien.

### Dégâts / effet par couche

- **Picots** : `floor(maxHp / D)` par case, `D` selon la couche de la case : **1→8, 2→6, 3→4**.
- **Pièges de Roc** : `floor(maxHp / 8) × typeMultiplier(Roche → types cible)` par case (×0.25 à ×4). 1 couche.
- **Pics Toxik** : couche **1 = Poison**, couche **2 = Empoisonnement grave (Toxik)**. Pas de dégât direct, idempotent.
- **Toile Gluante** : **Vitesse −1** par case. 1 couche.

### Absorption Pics Toxik (canon)

Un Pokémon **de type Poison au sol** qui **entre** sur une case Pics Toxik la **dissout** (retire la case de l'état, toutes couches) au lieu d'être empoisonné — mirror canon « Poison-types absorb Toxic Spikes ». La case dissoute n'affecte plus personne ensuite. (Acier = immunisé au poison mais ne dissout pas.)

### Point d'intégration

Helper `resolveHazardTraversal(state, pokemon, types, pathTiles, prng)` :
- itère les tuiles du chemin **en sautant la case de départ** ;
- pour chaque case piégée entrée dont `ownerPlayerId !== pokemon.playerId` et applicable (gate sol selon kind) → applique dégât / statut / stat-drop, émet `EntryHazardTriggered`, gère l'absorption Pics Toxik ;
- vérifie l'HP **après chaque case déclenchée** → KO → `break` (mirror exact de la boucle Magma).

Branché dans :
- **`executeMove(pokemon, path)`** (BattleEngine ~1954) : `path` complet → cas principal (déplacement normal).
- **Atterrissage** dash / hit-and-run / knockback : passe la **case finale** (réutilise `applyLandingTerrainEffects`). Énumération fine du chemin de dash/knockback = **refinement hors-scope v1**.

## Modèle d'état — case piégée à couches

- Enum `EntryHazardKind` (`enums/entry-hazard-kind.ts`, const-object) : `Spikes` / `StealthRock` / `ToxicSpikes` / `StickyWeb`.
- Type `EntryHazardCell { kind; ownerPlayerId; tile: Position; layers: number }` (`types/entry-hazard-cell.ts`). Pas de `remainingTurns` (permanent). `ownerPlayerId` stocké directement (survit au KO du lanceur).
- `state.entryHazards: EntryHazardCell[]`.
- `entry-hazard-system.ts` :
  - constantes `HAZARD_AIM_RANGE = 4`, `HAZARD_REMOVAL_RADIUS = 2`, caps couches (`SPIKES_MAX_LAYERS = 3`, `TOXIC_SPIKES_MAX_LAYERS = 2`), table fractions Picots `{1:8, 2:6, 3:4}`, `STEALTH_ROCK_DAMAGE_FRACTION = 8`.
  - `maxLayersFor(kind)` → 3 / 2 / 1 / 1.
  - `postEntryHazard(state, ownerPlayerId, kind, tile)` : si une case **même kind + même tile + même owner** existe → `layers = min(layers+1, maxLayersFor(kind))` (no-op si déjà au cap) ; sinon push `{kind, ownerPlayerId, tile, layers:1}`.
  - `getEntryHazardsAt(state, position)` : cases piégées à cette tuile (plusieurs kinds peuvent coexister sur la même case).
  - `removeEntryHazardsNear(state, position, radius)` : retire toutes les cases à ≤ radius (Manhattan) ; retourne les retirées (event).
  - helpers dégât/statut/stat par kind + couche.

## EffectKind / handlers

- `EffectKind.PostEntryHazard { hazardKind }` → `handle-post-entry-hazard.ts` : pose à la **case-cible de l'action** (`ActionUseMove.targetPosition`) ; `ownerPlayerId = caster.playerId` ; émet `EntryHazardPosted` (avec `layers` résultant). **Ne déclenche aucun dégât** sur l'occupant éventuel (sémantique entrée).
- `EffectKind.RemoveEntryHazards { radius }` → `handle-remove-entry-hazards.ts` : `removeEntryHazardsNear(state, caster.position, radius)` (autour de **l'utilisateur**, canon) ; émet `EntryHazardRemoved`.
- Registres dans `effect-processor.ts`.

## Targeting — viser une case au sol à distance

Besoin : viser **une case** au sol (toute tuile traversable, occupant indifférent) dans `HAZARD_AIM_RANGE`. Précédent : `TargetingKind.Teleport` (sélection d'une tuile à distance).

- `TargetingKind.GroundTarget` + variant `{ range }`. **Réutiliser le resolver de Teleport** en relâchant « tuile vide » → « tuile traversable, occupant indifférent ». Vérifier l'impl Teleport avant de coder ; ne pas dupliquer Blast/Zone.
- `ActionUseMove.targetPosition` porte la case visée (champ déjà utilisé par Teleport/earth-power — vérifier).
- **Preview** : la case visée est surlignée (single tile). Hook `targetPreviewRadius(move)` (view-core `move-intent.ts`) = 0 pour `PostEntryHazard` → highlight de la seule case du curseur (≠ `selfPreviewRadius` caster-centré). Afficher la couche déjà présente si re-pose.

## Data (`overrides/tactical.ts`)

Setters (targeting `GroundTarget` range 4, effet `PostEntryHazard{kind}`) :
- `spikes` (Sol, statut) → Picots.
- `stealth-rock` (Roche, statut) → Pièges de Roc.
- `toxic-spikes` (Poison, statut) → Pics Toxik.
- `sticky-web` (Insecte, statut) → Toile Gluante.

Removers :
- `rapid-spin` (Normal, **physique** — garde ses dégâts Single 1-1) + effet self `RemoveEntryHazards{radius:2}` après le hit.
- `defog` (Vol, statut, Self/Single) + `RemoveEntryHazards{radius:2}`. Baisse d'Esquive cible canon : **optionnelle** (si triviale via stat-change existant, l'ajouter ; sinon hors-scope v1).

`op-sets.json` : sets porteurs sur Pokémon du roster **apprenant réellement** ces moves (vérif learnset → déléguer `data-miner` / `move-pattern-designer`). Patterns targeting → `move-pattern-designer`.

## Renderer

- `render-babylon/babylon-entry-hazards.ts` (mirror `babylon-field-terrains.ts`) : 1 mesh sol par case piégée, teinté **couleur équipe owner**, **indicateur de couches** (pips/teinte selon `layers`, pertinent pour Picots/Pics Toxik), **hover icon par kind** (🔻 Picots / 🪨 Pièges de Roc / ☠️ Pics Toxik / 🕸 Toile Gluante — emoji provisoires).
- `combat-scene.ts` : hook `setEntryHazards(specs)` ; `battle-board-view.ts` + `render-ports` étendus.
- `view-core/battle-orchestrator.ts` : `refreshEntryHazardVisuals()` sur `EntryHazardPosted/Removed/Triggered` + `PokemonMoved`.
- `view-core/constants.ts` : couleurs hazards.
- `floating-text-content.ts` : texte flottant sur `EntryHazardTriggered` (dégât = nombre rouge ; statut/stat = libellé).
- `ui-dom/BattleLogFormatter.ts` : cas Posted (+couche) / Triggered (dmg/poison/toxic/speed) / Removed / Absorbed.
- `ui-dom/move-tooltip.ts` : tags (`Piège : dégâts à l'entrée`, `Piège : poison`, `Piège : Vitesse −1`, `Touche les Vol`, `Empilable`, `Retire les pièges`).

## i18n (`app/i18n/{fr,en,types}.ts`)

`entryHazard.posted/triggered/removed/absorbed` (×kind), `moveTooltip.tag.hazard*`. Noms FR officiels : Picots / Pièges de Roc / Pics Toxik / Toile Gluante / Tour Rapide / Anti-Brume.

## IA (`ai/action-scorer.ts`)

- **Setters** (`PostEntryHazard`) : score = base × (proximité de la case visée aux ennemis / chokepoints likely-traversed). Bonus si re-pose sur une case déjà piégée < cap (stacking). 0 si aucun ennemi susceptible d'entrer. Pas besoin d'éviter ses propres pièges.
- **Removers** : score positif si des pièges ennemis existent ≤ r2 de l'utilisateur (ou sur son chemin) ; sinon valeur nominale (Tour Rapide garde sa valeur offensive).

## Init state

`BattleSetup` + fixtures de test : `entryHazards: []`.

## Tests

- `entry-hazard-system.test.ts` : post (1 case, couche 1), re-pose même case → +1 couche, cap (Picots 3 / Pics Toxik 2 / autres 1) → no-op au cap, kinds différents coexistent sur une case, `getEntryHazardsAt`, `removeEntryHazardsNear` (r2 Manhattan), gate sol (Vol immunisé sauf Pièges de Roc), absorption Pics Toxik (1ᵉʳ type Poison dissout → suivant non empoisonné).
- `resolve-hazard-traversal` : **entrée only** (case de départ ignorée ; piège posé sous un mon stationnaire ne touche pas), cumul dégâts sur cases distinctes (3 cases → 3 hits), dégâts Picots par couche (1/8, 1/6, 1/4), Toile −1 Vit cumulatif par case, Pics Toxik idempotent (poison 1×) + couche 2 = Toxik, ennemis-only (allié non touché), KO mid-path stoppe, Pièges de Roc type-multiplier (×0.25 / ×1 / ×2).
- `moves/{spikes,stealth-rock,toxic-spikes,sticky-web}.test.ts` : pose via GroundTarget à distance, déclenchement à l'entrée ennemie, immunité Vol, stacking par re-pose.
- `moves/{rapid-spin,defog}.test.ts` : retrait r2, Tour Rapide garde ses dégâts.
- Gate CI : `pnpm build && lint:fix && typecheck && test && test:integration && test:e2e`.

## Bilan (done 2026-06-19)

- Gate CI vert. 394 → 400 moves (+6). 179 → 183 OP sets (+4).
- Modèles voxel GLB empilés par couche (`packages/render-babylon/src/babylon-entry-hazards.ts`), assets `packages/app/public/assets/ui/hazards/`, source `assets-src/voxel/hazards.vxb`.
- Technique de placement documentée dans `docs/references/voxel-tile-placement.md`.
- OP sets data-miner : leads Crustabri/Ptéra, spinner Staross, Anti-Brume Rapasdepic.
- Design team-agnostic acté (décision #529) : pièges touchent alliés et ennemis.
- Bob idle flottant sur Pièges de Roc uniquement (décision #530).

## Hors scope v1 (refinements notés)

- Énumération fine du chemin dash / knockback / ice-slide (v1 = case d'atterrissage seulement pour mouvements forcés).
- Baisse d'Esquive d'Anti-Brume (à trancher).
- Équilibrage fin (fractions, portée, caps couches) → playtest + `game-designer`.

## Découpage suggéré (exécution)

1. **Core fondation** : enum + type `EntryHazardCell` + state + `entry-hazard-system.ts` (post/stack/cap/get/remove) + tests système.
2. **Targeting GroundTarget** (réutilise resolver Teleport) + tests.
3. **Effects/handlers** PostEntryHazard / RemoveEntryHazards + register.
4. **Déclenchement** `resolveHazardTraversal` (entrée-only, KO mid-path) branché dans `executeMove` (+ atterrissages) + tests traversée.
5. **Data** : 6 moves tactical.ts + patterns + op-sets (learnset-checked).
6. **Renderer + i18n + log + tooltip** (couches visibles).
7. **IA** setters/removers.
8. Gate CI + recette humaine.
