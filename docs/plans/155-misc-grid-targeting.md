# Plan 155 — Misc Batch E : grille-problématiques

> **Statut : done** — livré 2026-07-11 (496 → 500 moves). Décisions #639–#643.
> Cinquième et **dernier** des 5 batches du chantier « Misc volatile / utility »
> (A crit ✅ · B dégâts utilitaires ✅ · C manip talent ✅ · D buff/statut ✅ · **E grille-problématiques ✅**).
> **Chantier Misc clos (5/5). Clôture aussi la Phase 4 « mécaniques complexes ».**

## Périmètre — 4 moves

| Move (FR) | ID EN | Type | Cat | Ciblage (chez nous) |
|-----------|-------|------|-----|---------------------|
| **Par Ici** | `follow-me` | Normal | Statut | Self, zone diamant r4 auto-centrée |
| **Poudre Fureur** | `rage-powder` | Insecte | Statut | Self, zone diamant r4 auto-centrée, **flag `powder`** |
| **Après Vous** | `after-you` | Normal | Statut | Allié, r3 |
| **Interversion** | `ally-switch` | Psy | Statut | Allié, r3 |

**Transverse : les 4 sont Gen 3-5, `0 learner Gen 1`.** Codés **par complétude, hors-pool**
(injouables en Team Builder pour l'instant, prêts pour les futures gens) — précédent
Bec-Canon / Carapiège (plan 150). **Pas d'OP set** (pas de porteur en pool).

## Réinterprétations grille (validées humain)

Le nom « grille-problématiques » vient de là : chacun casse une hypothèse du canon
(doubles / priorité / banc) qu'on réinterprète sur notre modèle (grille + CT, pas de banc,
pas de priorité — le CT ordonnance seul).

### 1 & 2 — Par Ici / Poudre Fureur → **manip d'orientation** (pas de redirection de cible)

- **Canon** : « centre de l'attention » — toutes les attaques mono-cible adverses du tour
  sont redirigées sur le lanceur. Move de doubles.
- **Chez nous** : au cast, **tous les ennemis dans une zone diamant Manhattan r4
  auto-centrée sur le lanceur pivotent pour faire face au lanceur**
  (`orientation = directionFromTo(ennemi.position, lanceur.position)`).
  → exploite le back-attack ×1.15 (`facing-modifier.ts`) : leurs **dos sont exposés**
  aux alliés du lanceur.
- **Flow handler** (mirror `handle-phaze.ts`) : le ciblage `Zone` r4 résout déjà tous les
  occupants du diamant dans `context.targets` ; le handler **filtre les ennemis**
  (`playerId !== attacker.playerId`, skip alliés + lanceur) puis pivote chacun. Pas de
  `context.pokemonInRadius`.
- **One-shot, pas de volatile.** L'orientation d'un mon n'est réécrite qu'à sa **propre
  action** (attaque `BattleEngine:1539`, déplacement `:2798/:2961`). Donc « pivoter au
  cast » **persiste de fait jusqu'au tour de l'ennemi** = exactement la fenêtre canon
  1-tour, gratuitement, sans état persistant à gérer.
- **Poudre Fureur** = flag `powder` (déjà dans `move-flags.ts`). **Immunité poudre** :
  un ennemi **Plante**, **Envelocape** (`overcoat`) ou **Lunettes Filtre**
  (`safety-goggles`) **ne pivote pas**.
  - L'infra existante (`effect-processor.ts:197-223`) gate déjà Envelocape + Lunettes
    Filtre via `onMoveImmunity`, **mais PAS le type Plante**. Nouveau helper partagé
    `isImmuneToPowderMove(target, move, abilityRegistry, itemRegistry)` = Plante **OU**
    ability `onMoveImmunity` bloque **OU** item `onMoveImmunity` bloque.
  - ⚠️ **Note de cohérence à trancher séparément** : les moves poudre-statut existants
    (Spore, Poudre Dodo, Para-Spore…) ne gatent pas non plus le type Plante aujourd'hui.
    Gap latent hors périmètre de ce plan — je le signale, retrofit optionnel décidé à part.

### 3 — Après Vous → **promotion CT non-destructive**

- **Canon** : la cible agit immédiatement après le lanceur, quelle que soit sa Vitesse.
- **Chez nous** : la cible (allié r3) passe **strictement prochaine** dans le scheduler CT.
  Nouvelle méthode `ChargeTimeTurnSystem.promoteToImmediateNext(pokemonId)` :
  ```
  ct[pokemonId] = max(toutes les jauges courantes) + 1   // ne touche AUCUN autre CT
  ```
  → garantit le sommet **sans** reset des autres (contrairement à `forceActor` qui écrase
  tout à `CT_START`). **Non-destructif** : la cadence de tous les autres est préservée.
  Déterministe même en cas d'égalité de CT (le promu est +1 au-dessus du max, donc
  strictement premier — pas de dépendance au tie-break `id < bestId` de
  `findActorAboveThreshold`).
- **Chemin effet → moteur** (mirror Dépit `pendingCtPenalty`) : le handler pose un flag
  `PokemonInstance.pendingCtPromotion?: boolean` sur la cible (garde `effect-processor`
  pur, zéro dépendance moteur). **Point d'insertion exact** : au tout **début de
  `advanceTurn()`** (`BattleEngine.ts:3581`, avant la boucle `while`/`getNextActorId` à
  `:3587-3588`). À ce moment le coût du lanceur est déjà payé (`onActionComplete` tourne à
  `:3752`, avant `advanceTurn`). Le moteur scanne `state.pokemon`, pour chaque mon vivant
  avec `pendingCtPromotion` → `ctSystem.promoteToImmediateNext(id)` + clear le flag (avant
  le premier `getNextActorId`). Reset aussi au KO (`handleKo`).

### 4 — Interversion → **swap de positions physiques**

- **Canon** : le lanceur échange sa case avec celle d'un allié.
- **Chez nous** : cible = allié dans r3 ; `EffectKind.SwapAllyPositions` échange
  `lanceur.position ↔ allié.position`. Le plus grille-natif des 4.
- **Flow handler + terrain re-déclenché** (mirror exact `SmackedDown` / `AbilityChanged`,
  `BattleEngine.ts:1906-1941`) : le handler mute la grille + les 2 `position` (via
  `new Grid(context.state.grid...)` comme `handle-phaze.ts`) et émet `AlliesSwapped
  { casterId, allyId, casterPosition, allyPosition }`. Le moteur ajoute un bloc de scan
  post-effet dans `executeUseMove` : pour chaque `AlliesSwapped`, appliquer
  `applyGroundingTerrainTick` aux 2 mons (gardé `currentHp > 0 && !isEffectivelyFlying`)
  → lave / eau profonde / pièges s'appliquent selon la case d'arrivée ; un mon lévitant /
  Vol Magnétik survole. Orientations conservées.
- Pas de contrainte de « case libre » (les 2 cases sont déjà occupées, on permute).

## Infra core

- **3 `EffectKind`** :
  - `DrawAttention` (`draw_attention`) — Par Ici / Poudre Fureur.
  - `ActAfterUser` (`act_after_user`) — Après Vous.
  - `SwapAllyPositions` (`swap_ally_positions`) — Interversion.
- **1 champ `PokemonInstance`** : `pendingCtPromotion?: boolean` (reset au KO + à la
  consommation).
- **1 méthode CT** : `ChargeTimeTurnSystem.promoteToImmediateNext(pokemonId)`.
- **1 helper poudre** : `isImmuneToPowderMove(...)` (nouveau module ou dans
  `secondary-effect.ts` / `effect-processor` utils — à placer proprement).
- **Handlers** : `handlers/handle-draw-attention.ts`, `handle-act-after-user.ts`,
  `handle-swap-ally-positions.ts`.
- **Events** (`battle-event-type.ts`) : `DrewAttention`, `PromotedToActNext`,
  `AlliesSwapped`. Formatter FR/EN.
- **Aucune priorité** ajoutée (le CT ordonnance seul, cf. plan 150).

## Renderer

- **Par Ici / Poudre Fureur** : sur `DrewAttention`, rafraîchir le facing des sprites
  ennemis affectés (les billboards directionnels lisent `orientation` — vérifier que
  l'orchestrator re-projette le facing sur cet event, sinon câbler `refreshFacing`).
  Texte flottant « Par Ici ! » / « Poudre Fureur ! » sur le lanceur.
- **Après Vous** : sur `PromotedToActNext`, texte flottant sur la cible ; la timeline CT
  (déjà DOM) reflète le nouvel ordre au prochain snapshot. Pas d'indicateur persistant.
- **Interversion** : sur `AlliesSwapped`, glisser (ou snap façon Téléport) les 2 sprites
  vers leurs cases échangées. Réutiliser le tween Téléport existant pour les 2 mons.
- **MoveTooltip** : tags — 🧲 « Attire l'attention » (Par Ici/Poudre Fureur, + « Poudre »
  pour Poudre Fureur), ⏫ « Fait jouer la cible » (Après Vous), ⇄ « Échange de place »
  (Interversion). i18n FR/EN.

## IA (garde-fous minimaux, heuristiques fines différées)

Précédent : tous les batches récents défèrent le scoring fin à une passe IA groupée.

- **Par Ici / Poudre Fureur** : ne pas caster si **0 ennemi** dans r4. Score de base
  faible ∝ nb d'ennemis en zone (le back-exploit par un allié n'est pas modélisé finement).
  Poudre Fureur : exclure les ennemis immunisés du compte.
- **Après Vous** : ne pas caster si aucun allié cible valide en r3. Score neutre/faible
  (l'IA ne raisonne pas sur « faire jouer un sweeper allié prêt »).
- **Interversion** : ne pas caster si aucun allié en r3. Score neutre (le repositionnement
  défensif / esquive n'est pas modélisé).
- Différé (passe IA groupée, non bloquant) : valorisation fine du back-setup, du tempo
  Après Vous, de l'esquive Interversion — même lot que crit / dégâts-utilitaires /
  manip-talent / buff-statut / etc.

## Tests

- **Unit** : `moves/{follow-me,rage-powder,after-you,ally-switch}.test.ts`
  (chacun via `buildMoveTestEngine` + mocks `packages/core/src/testing/`).
- **Unit ciblés** :
  - `isImmuneToPowderMove` (Plante bloque, Envelocape bloque, Lunettes Filtre bloque,
    non-immunisé pivote).
  - `ChargeTimeTurnSystem.promoteToImmediateNext` (cible devient strictement prochaine,
    cadence des autres préservée — pas de reset à `CT_START`).
- **Intégration** : `misc-grid-targeting.integration.test.ts`
  - Par Ici : 2 ennemis en r4 pivotent vers le lanceur ; ennemi hors r4 non affecté ;
    exposition dos vérifiée via `getFacingZone`.
  - Poudre Fureur : ennemi Plante ne pivote pas, ennemi non-Plante pivote.
  - Après Vous : après le cast, la cible est le prochain acteur ; un 3ᵉ mon plus rapide
    ne double pas la cible ; les jauges des autres ne sont pas remises à zéro.
  - Interversion : positions échangées ; terrain re-déclenché (mon Grounded posé sur lave
    subit la brûlure, mon lévitant survole).
- **e2e Playwright** : différé via `test-writer` + cahier `docs/test-plan.md` §5
  (non bloquant, mirror des batches A→D).

## Docs

- `docs/implementations.md` : +4 moves (496 → 500), lignes tableau Moves + Récapitulatif.
- `docs/decisions.md` : #639+ (réinterprétation orientation Par Ici/Poudre Fureur,
  immunité poudre Plante, promotion CT non-destructive, swap de positions + terrain
  re-trigger, hors-pool assumé).
- `STATUS.md` + `docs/next.md` : entrée batch E, chantier Misc **clos** (5/5).

## Reste après ce plan (reportés, non bloquants)

- e2e Playwright des 4 moves.
- Heuristiques IA fines (passe IA groupée).
- Retrofit optionnel immunité poudre type Plante sur les moves poudre-statut existants
  (gap latent signalé).
- **Chantier Misc terminé** → prochaine grande étape à décider avec l'humain
  (passe IA groupée ? session content-fill ? nouvelle famille ?).

## Compteur

**496 → 500 moves.** (Pas d'OP set, pas de talent/objet nouveau.)
