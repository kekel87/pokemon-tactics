# Plan 117 — B4 « Terrains » : moteur de Champs zonés + 4 poseurs

> **Statut : done** (livré 2026-06-08)
> Vague 2 de la roadmap maître **plan 112** (premier batch terrain & objet).
> Total moves visé : 382 → **386** (+4 poseurs). Les **6 moves dépendants** sont dans le **plan 118** (suite).
> Décisions de scope + adaptations tactiques validées humain 2026-06-08 (voir ci-dessous, décisions #424–#434). #435 (signature damage-calc) = à trancher impl-start.

## Objectif

Construire le **système de Champs** (terrains Pokémon : Herbu / Électrifié / Brumeux / Psychique) et livrer les **4 moves poseurs**. Contrairement à Showdown où un Champ couvre toute l'arène, ici un Champ est une **zone peinte sur la grille** (modèle FFTA) : un diamant de tuiles autour du lanceur, qui reste en place pendant que le poseur se déplace. C'est le pitch « Pokémon × FFTA » assumé — le positionnement dans/hors de la zone devient une couche tactique.

Ce plan livre **le moteur** (data-model, peinture, double porte d'effet, timers, rendu, IA) + **les 4 poseurs**. Les 6 moves qui exploitent/scalent selon le Champ actif (Gliss'Herbe, Monte-Tension, Vaste Pouvoir, Explo-Brume, Champlification, Force Nature) suivent dans le **plan 118**, car ils ajoutent 4 sous-mécaniques distinctes (priorité-depuis-position, ciblage dynamique, self-KO, morph de type).

## ⚠️ Collision de noms — `FieldTerrain` ≠ `TerrainType`

Le jeu a **déjà** `TerrainType` (tuiles de map : herbe haute, lave, glace, eau…) dans `packages/core/src/enums/terrain-type.ts`. Les « Champs » Pokémon sont un concept **orthogonal** posé par des moves. **Nouveau nom : `FieldTerrain`** + `state.fieldTerrains[]`. Les deux couches coexistent et s'empilent (une tuile peut être `lava` ET sous un Champ Herbu — les deux effets s'appliquent).

## Les 4 poseurs

| Nom FR | id | Type | Cat. | Ciblage | Effet (pose un Champ zoné r3) |
|--------|-----|------|------|---------|-------------------------------|
| **Champ Herbu** | `grassy-terrain` | Plante | Statut | Self (pose la zone) | Zone : soin **1/16 PV/tour** au sol + Plante **×1.3** (attaquant sur zone) + **½ Séisme/Bulldozer** (cible sur zone) |
| **Champ Électrifié** | `electric-terrain` | Élec | Statut | Self | Zone : au sol **immunisé sommeil** + Élec **×1.3** (attaquant sur zone) |
| **Champ Brumeux** | `misty-terrain` | Fée | Statut | Self | Zone : au sol **immunisé statut majeur + confusion** + Dragon **×0.5** (cible sur zone) |
| **Champ Psychique** | `psychic-terrain` | Psy | Statut | Self | Zone : **barrière anti-dash** (ennemi du poseur, voir §5) + Psy **×1.3** (attaquant sur zone) |

Learners roster Gen 1 confirmés (script learnsets, 2026-06-08) — **aucun move mort** :
- **Champ Herbu** (6) : Florizarre, Ortide, Empiflor, Noadkoko, Saquedeneu, Mew
- **Champ Électrifié** (8) : Raichu, Magnéton, Électrode, Leveinard, Élektek, Voltali, Électhor, Mew
- **Champ Brumeux** (4) : Mélodelfe, Grodoudou, M. Mime, Mew
- **Champ Psychique** (8) : Alakazam, Flagadoss, Hypnomade, Noadkoko, M. Mime, Lippoutou, Mewtwo, Mew

## Décisions de scope & adaptations tactiques (validées humain 2026-06-08)

> **Note numérotation** : les #424–#435 ci-dessous correspondent dans `docs/decisions.md` à **#427–#438** (décalage de +3 — #424–#426 ont été pris par l'outillage worktree, commit `45cde85`). `decisions.md` fait foi.

| # | Décision |
|---|----------|
| **#424** | **Modèle zone peinte** (et non field-wide façon Showdown). Un Champ = une zone de tuiles, pas un effet global. C'est le pitch FFTA. La synergie grille naît du positionnement + de la porte « au sol ». |
| **#425** | **Zone = diamant Manhattan r3 (25 tuiles) centré sur la case du lanceur au moment du cast**, **statique** ensuite (ne suit pas le poseur). Réutilise le rayon des auras (plan 095). |
| **#426** | **Multi-zones coexistantes** : plusieurs Champs différents simultanés. Sur chevauchement, **le dernier posé gagne par-tuile**. Chaque zone a **son propre compteur** indépendant. Poser Champ A, se déplacer, poser Champ B au tour suivant = 2 zones, 2 timers. |
| **#427** | **Double porte d'effet** : un mon subit l'effet d'un Champ ssi **(a)** sa case courante appartient à une zone de ce Champ **ET (b)** il est **au sol** (`isEffectivelyFlying` false). Flyer au-dessus d'une zone Herbu = pas de soin. Position + altitude comptent. |
| **#428** | **Champ Psychique réinterprété en barrière anti-dash** (divergence Showdown assumée). Canon = bloque les moves à priorité ; ici la méta priorité est faible/peu lisible. Voir §5 pour la sémantique exacte. |
| **#429** | **Force Nature** (plan 118) est piloté par le **Champ-zone sous le lanceur** (le « Champ actif » au sens zone), pas par la tuile de map. Cohérent avec les 9 autres moves du batch. |
| **#430** | **Rendu : contour de zone net + fill additif basse alpha** (0 asset). Le contour porte la lecture (couleur = identité du Champ) ; le fill additif « illumine » sans masquer le sol. **Motif par Champ = v2** si le playtest montre une ambiguïté. |
| **#431** | **Compteur = pastille couleur-Champ au centre-ancre de la zone**, flottante en world-space, **persistante** (pas de hover — pas d'infopanel-curseur). Reste sur la zone même quand le poseur s'éloigne. 1 zone = 1 pastille. |
| **#432** | **Terrain Extender inclus** dans ce plan. `HeldItemId.TerrainExtender` (`terrain-extender`) : durée Champ **5 → 8 tours** si le poseur le tient (figée au cast, miroir Light Clay / Heat Rock). |
| **#433** | **Multiplicateur de boost = ×1.3** (génération actuelle ; les anciennes gens étaient ×1.5). ½ Séisme/Bulldozer = ×0.5. Dragon vs Brumeux = ×0.5. |
| **#434** | **Découpage 2 plans** : **117** = moteur + 4 poseurs + Terrain Extender + rendu + IA. **118** = 6 moves dépendants. Chaque plan = 1 commit, livrable seul. |

## Systèmes moteur à construire

### 1. Data-model `FieldTerrain` + `FieldZone`

- **Enum** `packages/core/src/enums/field-terrain.ts` (const-object, `core.md`) :
  ```ts
  export const FieldTerrain = {
    Grassy:   "grassy",
    Electric: "electric",
    Misty:    "misty",
    Psychic:  "psychic",
  } as const;
  ```
- **Type** `packages/core/src/types/field-zone.ts` (1 fichier = 1 type) :
  ```ts
  export interface FieldZone {
    kind: FieldTerrain;
    casterId: string;
    tiles: Position[];        // diamant Manhattan r3 figé au cast (cases in-bounds uniquement)
    anchor: Position;         // centre-ancre = case du lanceur au cast (pour la pastille timer)
    remainingTurns: number;   // 5 ou 8 (Terrain Extender), décrémenté fin de round
    postedRound: number;      // pour le tie-break d'overlap (le plus récent gagne)
  }
  ```
- **`BattleState`** (`types/battle-state.ts`) : ajouter `fieldTerrains: FieldZone[]` + `fieldTerrainsLastTickRound?: number` (dedup du tick, exactement comme `aurasLastTickRound`).

### 2. Système `field-terrain-system.ts` (miroir `aura-system.ts`)

`packages/core/src/battle/field-terrain-system.ts` :

- `FIELD_TERRAIN_DEFAULT_DURATION = 5`, `FIELD_TERRAIN_EXTENDED_DURATION = 8`, `FIELD_TERRAIN_RADIUS = 3`, `GRASSY_HEAL_FRACTION = 1/16`.
- `fieldTerrainDurationForCaster(caster)` → 8 si `caster.heldItemId === HeldItemId.TerrainExtender`, sinon 5.
- `enumerateZoneTiles(grid, anchor)` → toutes les cases `manhattanDistance ≤ 3` in-bounds (réutilise `manhattanDistance` de `aura-system`).
- `postFieldTerrain(state, caster, kind)` → construit la `FieldZone` (tiles + anchor = `caster.position`, `remainingTurns` selon objet, `postedRound`), **push** dans `state.fieldTerrains`. **Pas de merge same-caster** : poser un nouveau Champ ajoute une zone (un même mon peut tenir plusieurs zones à des emplacements différents — décision #426). Émet `FieldTerrainPosted`.
- **`getFieldTerrainAt(state, pos): FieldTerrain | null`** — **clé de tout** : scanne `state.fieldTerrains` du **plus récent au plus ancien** (overlap : dernier posé gagne), retourne le `kind` de la première zone contenant `pos`, sinon `null`. Le tri par récence = ordre d'insertion inversé + tie-break `postedRound` (suffit : on push à la fin).
- **`isOnFieldTerrain(state, pokemon, kind): boolean`** — applique la **double porte** : `getFieldTerrainAt(state, pokemon.position) === kind` **ET** `!isEffectivelyFlying(pokemon, types)`. C'est le helper que tous les effets appellent.
- `getActiveZonesOfKind(state, kind)` (pour le rendu : dessiner toutes les zones d'un kind).
- `decrementFieldTerrainsTimer(state): ExpiredFieldZone[]` — décrémente chaque zone, retire celles à 0, retourne les expirées (pour `FieldTerrainExpired`). Miroir `decrementAurasTimer`.
- `removeZonesOfCaster(state, casterId)` — **NON appelé au KO** : décision — une zone **survit au KO de son poseur** (le Champ est posé sur le sol, pas attaché au mon vivant). Helper fourni quand même au cas où, mais `handleKo` ne l'appelle pas. *(Diffère des auras, qui meurent avec le caster. Cohérent avec « zone peinte statique ».)*

> **Survie au KO — tranché (review game-designer)** : une zone posée **survit au KO de son poseur** (reste son nombre de tours). Peinture au sol, pas aura mobile. Plus FFTA, valeur résiduelle attendue (le joueur a payé une action), **non abusif**. Diffère des auras (mort-au-KO). Caveat FFA documenté en risques ; bascule mort-au-KO réservée au playtest si gênant (appel `removeZonesOfCaster` dans `handleKo`).

### 3. Boost / réduction de puissance — `damage-calculator`

Le `damage-calculator` gagne un **multiplicateur de Champ**, calculé à part puis injecté (comme `screenMultiplier` / `weatherBpModifier` du plan 095 / météo).

- **Boost de type (attaquant sur zone)** : `getFieldTerrainBpModifier(state, attacker, move)` →
  - Herbu + move Plante + `isOnFieldTerrain(attacker, Grassy)` → **×1.3**
  - Électrifié + move Élec + `isOnFieldTerrain(attacker, Electric)` → **×1.3**
  - Psychique + move Psy + `isOnFieldTerrain(attacker, Psychic)` → **×1.3**
  - sinon ×1.0
- **Réduction (cible sur zone)** : `getFieldTerrainDefenseModifier(state, target, move)` →
  - Brumeux + move Dragon + `isOnFieldTerrain(target, Misty)` → **×0.5**
  - Herbu + move ∈ {`earthquake`, `bulldoze`, `magnitude`} + `isOnFieldTerrain(target, Grassy)` → **×0.5**
  - sinon ×1.0
- Les deux passent par le pipeline existant de modificateurs du `damage-calculator`. **Le ½ Séisme/Bulldozer s'évalue par-cible** (un Séisme touche plusieurs tuiles : seules les cibles sur Herbu sont réduites).
- **⚠️ Décision #435 (à confirmer humain) — signature `calculateDamageWithCrit`** : déjà ~17 params (height/terrain/facing/weather×2/screen/brickBreak ajoutés au fil des plans 095/116). Ajouter 2 params terrain de plus aggrave le bloat. **Deux options** :
  - **(a) Ajouter 2 params en queue** (`fieldTerrainBpModifier`, `fieldTerrainDefenseModifier`), cohérent avec l'historique, zéro churn ailleurs. **Reco si on ne veut pas toucher les call-sites.**
  - **(b) Refactor en objet `DamageModifiers`** regroupant tous les multiplicateurs optionnels. Plus propre, mais **touche tous les call-sites du damage-calc** = changement structurel → **accord humain requis** (CLAUDE.md « consulter avant structure »).
  - **Reco : (a) pour ce plan**, et noter (b) comme dette de refactor à part si la signature devient ingérable. **Trancher à l'impl-start.**

### 4. Statut / sommeil bloqué — `handle-status`

- **`handle-status.ts`** : avant d'appliquer un statut majeur (ou la confusion), si la cible `isOnFieldTerrain(target, Misty)` → **bloqué**, émet `StatusBlocked` avec `ProtectionReason.MistyTerrain` (étendre l'enum `ProtectionReason` posé plan 098). Réutilise le point d'insertion des checks Brume/Rune Protect (plan 098).
- **Champ Électrifié** : bloque uniquement le **sommeil**. Si statut == `Asleep` et `isOnFieldTerrain(target, Electric)` → bloqué (`ProtectionReason.ElectricTerrain`). (Confusion **non** bloquée par Électrifié — parité.)
- **Différence avec Brume/Rune (auras)** : les Champs bloquent par **position de la cible**, pas par appartenance d'équipe. Un mon peut se protéger en se tenant sur sa propre zone Brumeux. Le check est `isOnFieldTerrain(target, …)` (porte « au sol » incluse → un flyer sur la zone n'est pas protégé).

### 5. Barrière anti-dash — Champ Psychique (décision #428)

Réinterprétation grid-native du « bloque la priorité » canon.

- **Déclenchement** : dans `resolveDash` (`grid/targeting.ts`, qui calcule déjà un chemin Bresenham + `DashBlockInfo`), on teste chaque case du chemin. Le dash est **bloqué** dès que le chemin **entre** (depuis l'extérieur) dans une case appartenant à une **zone Psychique** dont le **poseur est un ennemi du dasher**.
- **Effet** : le dasher **s'arrête sur la dernière case avant la zone**, **aucune attaque**. Le dasher a quand même avancé jusqu'au bord (repositionnement partiel). Émet un évènement `DashBlockedByPsychicTerrain` (nouveau, pour le log + floating text).
- **Portée** : seuls les dashs des **ennemis du poseur** sont bloqués (champ protecteur, aligné canon). Les **flyers / semi-invul** (dash aérien) **traversent** — cohérent avec la porte « au sol » (#427). Un dasher **déjà dans la zone** qui en sort n'est **pas** bloqué (le champ protège l'entrée, pas la sortie).
- **Implémentation finale (décidée au playtest 2026-06-08)** : la barrière s'applique **uniquement au déplacement réel**, dans **`BattleEngine.dashMoveCaster`** — pas à la résolution de cible. `dashMoveCaster` walke le chemin, et via le prédicat `isEnemyPsychicBarrierAt(state, dasher, dasherTypes, pos)` (helper `field-terrain-system.ts`, construit par `buildDashBarrierPredicate`), s'arrête sur la dernière case avant d'entrer dans une zone Psychique ennemie, émet `DashBlockedByPsychicTerrain`, n'attaque pas.
- **`resolveDash` (`grid/targeting.ts`) N'EST PAS touché** : la résolution de cible / `getLegalActions` / preview **ignorent la barrière**. Conséquence voulue : **le dash reste toujours sélectionnable** (l'action n'est jamais filtrée comme illégale). Le joueur lance le dash normalement et « percute le mur » à l'exécution. Décision UX (playtest) : ne pas rendre un dash illégal parce qu'il serait bloqué — sinon, collé au mur, le joueur ne peut plus lancer le move et c'est déroutant. *(Abandonné : la troncature initiale dans `resolveDash` + le prédicat `TraversalContext.isDashBarrierTile`, retirés.)*
- **Effet de bord IA** : l'IA voit la portée « pleine » (sans barrière) → peut tenter un dash qui sera bloqué. Acceptable v1 ; raffinement scoring possible plus tard.

### 6. Soin de zone — Champ Herbu, end-turn

- **Handler end-turn `field-terrain-tick-handler.ts`**, priorité via constante nommée **`FIELD_TERRAIN_TICK_PRIORITY = 260`** (`field-terrain-system.ts`) — **après** le tick HoT/250 du plan 116 (Racines/Anneau Hydro), **avant** les pièges/300. Justification écrite dans le code :
  - Pour chaque mon vivant : si `isOnFieldTerrain(mon, Grassy)` → soigne `max(1, floor(maxHp/16))`, émet `HpRestored`. Clamp `maxHp`.
  - **Décrément des timers de zone** : fait par `decrementFieldTerrainsTimer`, appelé une fois par round (dedup `fieldTerrainsLastTickRound`, miroir des auras), émet `FieldTerrainExpired` pour chaque zone tombée à 0.
- **Ordre vs Anneau Hydro/Racines (plan 116)** : indépendants, cumulables (un mon enraciné sur Champ Herbu = 1/8 + 1/16). Aucune interaction spéciale.

## Couche objet — Terrain Extender (décision #432)

- `HeldItemId.TerrainExtender = "terrain-extender"` (enum core + data item).
- Effet **passif au cast** : `fieldTerrainDurationForCaster` lit l'objet du poseur → 8 tours au lieu de 5. Aucune autre mécanique (pas de trigger end-turn). Miroir exact de Light Clay (durée aura) et Heat Rock (durée météo).
- Data : entrée item `packages/data/src/items/` + i18n FR/EN (nom officiel FR : **Étend-Terre**). Description : « Allonge la durée des Champs posés par le porteur (5 → 8 tours) ».

## Couche de données (`tactical.ts`)

```ts
"grassy-terrain":   { Self, effects: [PostFieldTerrain Grassy] },
"electric-terrain": { Self, effects: [PostFieldTerrain Electric] },
"misty-terrain":    { Self, effects: [PostFieldTerrain Misty] },
"psychic-terrain":  { Self, effects: [PostFieldTerrain Psychic] },
```

- **`EffectKind.PostFieldTerrain { kind: FieldTerrain }`** (handler enregistré, pas de switch — `core.md`), miroir `PostAura` / `PostScreen` (plan 095). Le handler appelle `postFieldTerrain(state, caster, kind)`.
- Ciblage **Self** (le Champ s'ancre sur la case du lanceur). Le renderer **affiche le diamant r3 en preview** à la sélection (réutilise `GameController.getSelfRadiusEffect` posé plan 116 pour Fontaine de Vie/Aromathérapie — même pattern de preview de zone Self).

## Champs / état ajoutés

| Champ | Sémantique | Posé par | Reset / cleanup |
|-------|-----------|----------|------------------|
| `BattleState.fieldTerrains: FieldZone[]` | zones de Champ actives | `postFieldTerrain` (handler `PostFieldTerrain`) | `decrementFieldTerrainsTimer` (expiration) |
| `BattleState.fieldTerrainsLastTickRound?` | dedup du décrément par round | tick handler | — |

> **Pas de nouveau champ sur `PokemonInstance`** : l'appartenance à une zone est calculée à la volée via `getFieldTerrainAt(state, pos)`. `handleKo` **ne touche pas** `fieldTerrains` (les zones survivent au KO du poseur — décision §2, à confirmer review).

## IA (scoring)

- **Poseurs (`scoreSelfMove`, branche `PostFieldTerrain`)** — réutilise le pattern `PostScreen`/`PostAura` (plan 095) :
  - Score de base × `earlyMultiplier` (×1.2 si round ≤ 3, un Champ vaut plus tôt) × bénéfice estimé.
  - **Bénéfice** = nombre d'**alliés au sol dans le rayon r3** qui profitent du Champ (boost de type s'ils ont un move du bon type / soin Herbu / immunité statut). +bonus si un allié est menacé par le type que le Champ réduit (ex : Champ Brumeux si un Dragon ennemi proche).
  - **−1 / interdit** si une zone du même kind couvre déjà la case (pas de re-pose inutile).
  - **Champ Électrifié** : bonus si un allié au sol risque l'endormissement (move sommeil ennemi détecté — réutiliser `threat-detection.ts` plan 098).
  - **Champ Psychique** : bonus si l'ennemi a des dashers (la barrière les neutralise) et que des alliés sont groupés dans le rayon.
- **Positionnement** : hors-scope pour ce plan (l'IA ne « va pas se placer » dans une zone exprès — le scoring de déplacement n'est pas touché). Si l'IA sous-exploite les Champs en playtest → amélioration ultérieure du `action-scorer` de mouvement. Documenté en risque.
- **Barrière anti-dash** : l'IA ne doit **pas** tenter un dash ennemi qui sera tronqué par une zone Psy (légalité/portée corrigée en §5 → le scoring voit la portée réelle).

## Renderer + i18n

- **`FieldTerrainLayer`** (nouveau, `packages/renderer/src/grid/`) — le layer « entre tuiles et décorations » demandé :
  - Dessiné dans le **band des highlights** (depth iso offset ~0.1–0.2 au-dessus du depth de tuile, donc au-dessus du terrain de map, **sous** décos/Pokemon). Nouvelle constante `DEPTH_FIELD_TERRAIN_ISO_OFFSET` (~0.12, entre highlight 0.1 et enemy-range 0.15).
  - Par zone : **fill additif** (`Phaser.BlendModes.ADD`, alpha bas ~0.25) coloré par Champ + **contour net** (stroke saturé ~3px) sur le périmètre de la zone. Couleurs : Herbu vert, Électrifié jaune, Brumeux rose/cyan clair, Psychique violet (à figer dans `design-system.ts` — tokens `FIELD_TERRAIN_COLORS`).
  - **Pastille timer** au centre-ancre (`zone.anchor`) : petit cercle couleur-Champ + nombre `remainingTurns` (texte). World-space, persistante (décision #431). Se met à jour sur `FieldTerrainPosted` / décrément / `FieldTerrainExpired`.
  - **Overlap** : dessiner les zones dans l'ordre d'insertion (la plus récente par-dessus) → la couleur visible sur une case chevauchée = celle qui gagne mécaniquement (`getFieldTerrainAt`). Cohérence visuel/moteur garantie.
  - `refreshFieldTerrainVisuals()` idempotent, rappelé sur `FieldTerrainPosted` / `FieldTerrainExpired` / `TurnEnded` (décrément) / `PokemonMoved` (la couleur sous un mon ne change pas, mais les pastilles peuvent être recomposées) — mutualiser avec le pattern `refreshScreenVisuals` (plan 095).
- **GameController** : câbler `FieldTerrainPosted`, `FieldTerrainExpired`, `DashBlockedByPsychicTerrain` (floating text + log). Preview Self du diamant r3 à la sélection d'un poseur (réutilise `getSelfRadiusEffect`).
- **InfoPanel** : quand un mon est **sur** une zone (au sol), badge `Sur Champ {kind}` (info contextuelle). Optionnel v1 — le contour + pastille portent déjà l'info. À trancher en review.
- **MoveTooltip** (FR/EN) tags auto sur les poseurs : « Pose un Champ Herbu (zone, 5 tours) — soin + boost Plante », etc. Tag « ⏱ Étendu à 8 tours avec Étend-Terre » si pertinent.
- **BattleLogFormatter** : pose de Champ, expiration, soin Herbu (réutilise `HpRestored`), statut/sommeil bloqué par Champ (`StatusBlocked` + nouvelles raisons), dash stoppé par barrière Psy.
- **i18n** : nouvelles clés FR/EN (noms FR officiels obligatoires — Champ Herbu/Électrifié/Brumeux/Psychique, Étend-Terre).

## Tests (test-writer)

1 fichier `{id}.test.ts` par poseur + tests système. **Tester le décrément + le soin dans les deux loops** (round + CT) — model-agnosticisme (horloge plan 115).

- **grassy-terrain** : pose une zone r3 (25 tuiles, tronquée aux bords) ; soin 1/16/tour pour un mon **au sol sur la zone** ; **pas** de soin pour un flyer sur la zone (porte #427) ; **pas** de soin hors zone ; Plante ×1.3 si attaquant sur zone ; Séisme ×0.5 sur cible sur zone ; expiration à 5 tours (8 avec Étend-Terre).
- **electric-terrain** : sommeil bloqué pour un mon au sol sur zone ; confusion **non** bloquée ; Élec ×1.3 attaquant sur zone ; flyer sur zone **non** immunisé au sommeil.
- **misty-terrain** : statut majeur + confusion bloqués (au sol sur zone) ; Dragon ×0.5 vs cible sur zone ; flyer sur zone non protégé.
- **psychic-terrain** : **barrière anti-dash** : dash ennemi entrant → stoppé au bord, 0 dégât ; dash allié du poseur → **passe** ; dash flyer → **passe** ; dasher partant de l'intérieur → **passe** ; preview de portée (`getLegalActions`) reflète le blocage ; Psy ×1.3 attaquant sur zone.
- **Multi-zones / overlap** : 2 Champs différents coexistent ; `getFieldTerrainAt` renvoie le **dernier posé** sur une case chevauchée ; chaque zone décrémente **indépendamment** ; une zone survit au **KO de son poseur**.
- **Terrain Extender** : poseur tenant Étend-Terre → zone 8 tours ; figé au cast (lâcher l'objet après ne change rien).
- **Système** : `field-terrain-tick-handler` (ordre de priorité, clamp soin, dedup décrément) ; `isOnFieldTerrain` (double porte) ; `getFieldTerrainAt` (récence). Tests **round ET CT** pour le décrément.

## Étapes

1. `test-writer` : specs des 4 poseurs + système (échouent d'abord).
2. **Enums + types** :
   - `field-terrain.ts` (`FieldTerrain`), `field-zone.ts` (`FieldZone`).
   - `BattleState.fieldTerrains` + `fieldTerrainsLastTickRound`.
   - **Étendre `protection-reason.ts`** : `MistyTerrain`, `ElectricTerrain` (const-object existant plan 098).
   - **Nouveaux `BattleEventType`** : `FieldTerrainPosted`, `FieldTerrainExpired`, `DashBlockedByPsychicTerrain` (+ types d'event correspondants, 1 fichier/type).
3. **`field-terrain-system.ts`** : `enumerateZoneTiles`, `postFieldTerrain`, `getFieldTerrainAt`, `isOnFieldTerrain`, `isEnemyPsychicBarrierAt`, `getActiveZonesOfKind`, `decrementFieldTerrainsTimer`, `fieldTerrainDurationForCaster`, constante `FIELD_TERRAIN_TICK_PRIORITY = 260`.
4. **Effet dédié** : `EffectKind.PostFieldTerrain { kind }` + handler **enregistré dans le registry d'effets** (`initializeEffectRegistry` ou équivalent — pas de switch, `core.md`). Étendre l'union `Effect`. Test isolé du handler (`effect-processor.integration.test.ts`).
5. **Damage-calc** : `getFieldTerrainBpModifier` + `getFieldTerrainDefenseModifier`. **Trancher décision #435 (signature)** : reco **(a)** 2 params en queue de `calculateDamageWithCrit`. ½ Séisme/Bulldozer évalué **par-cible**.
6. **handle-status** : blocage statut (Brumeux) / sommeil (Électrifié) par `isOnFieldTerrain(target, …)`, au point d'insertion des checks Brume/Rune Protect (plan 098), `StatusBlocked` + nouvelles `ProtectionReason`.
7. **Barrière anti-dash** (mouvement seul) : helper `isEnemyPsychicBarrierAt` + `buildDashBarrierPredicate` ; `BattleEngine.dashMoveCaster` walke le chemin et s'arrête au bord de la zone Psychique ennemie, émet `DashBlockedByPsychicTerrain`, n'attaque pas. **`resolveDash` non touché** → le dash reste toujours sélectionnable (décision playtest #431).
8. **Tick end-turn** `field-terrain-tick-handler.ts` (priorité `FIELD_TERRAIN_TICK_PRIORITY`) + enregistrement `TurnPipeline` (`BattleEngine`). Soin Herbu + décrément timers (dedup `fieldTerrainsLastTickRound` round/CT).
9. **Objet** : `HeldItemId.TerrainExtender` (core) + data item + i18n (Étend-Terre).
10. **Data `tactical.ts`** : 4 entrées poseurs + noms EN.
11. **IA scoring** : branche `PostFieldTerrain` dans `scoreSelfMove`.
12. **Renderer** : `FieldTerrainLayer` (contour + fill additif + pastille timer), depth offset, couleurs design-system, `refreshFieldTerrainVisuals`, preview Self r3, câblage GameController + log + tooltips. i18n FR/EN.
13. Gate CI verte.
14. `implementations.md` : 382 → **386**. `plan 112` B4 : 4/10 livrés (6 dépendants → plan 118). `decisions.md` : #424–**#435**. `next.md` : prochain = plan 118.

## Risques / surveillance (game-designer)

- **Zone r3 = 25 tuiles — seuil de taille map** (game-designer) : 25 tuiles = ~17 % d'une map 12×12 (OK, « une zone »), mais **~39 % d'une map 8×8** (bascule en quasi-field-wide → dilue le jeu de position). Un Champ **statique** r3 est mécaniquement plus fort qu'une aura r3 **mobile** (contrôle une zone fixe sans dépendre du poseur). **Garde-fou** : `FIELD_TERRAIN_RADIUS` est une constante → **tester toutes les maps du roster à la livraison ; sur map ≤ ~9×9, fallback r2 (13 tuiles)**. Critère : si 2 zones cumulées couvrent > 50 % de la surface jouable → descendre r2.
- **Stall — combo non-trivial identifié** (game-designer) : le vrai risque n'est **pas** le pic immobile (Racines+Anneau Hydro+Herbu = 3/16, mais Racines s'arrache au mouvement → cible exposée), c'est **un support qui pose Champ Herbu pour des alliés** qui ont Anneau Hydro+Restes : **2/16/tour SANS contrainte d'immobilité**, + Vœu télécommandé de Leveinard (~155 PV). Scénario à surveiller en priorité : **Florizarre (Champ Herbu) + Leveinard (Vœu + Anneau Hydro)**. **Garde-fou si parties > 25 rounds** : rendre **Champ Herbu et Anneau Hydro mutuellement exclusifs** (la zone ne soigne pas un mon ayant déjà Anneau Hydro) — ciblé sur le vrai problème, ne touche pas les valeurs. Alternative : soin Herbu 1/16 → 1/32.
- **Survie au KO du poseur** (décision §2) : **game-designer endosse** — peinture au sol qui survit = bon FFTA, **pas abusif** (valeur résiduelle attendue, le joueur a payé une action). **Caveat FFA** (reviewer) : en 4 joueurs, une zone orpheline Herbu peut bénéficier à plusieurs équipes. **Garde-fou trivial si gênant** : appeler `removeZonesOfCaster` dans `handleKo` (bascule mort-au-KO). **Décision retenue : survie au KO**, basculement réservé au playtest FFA.
- **Étend-Terre 8 tours** : parité Pierre de Feu/Argile Lisse. 8 t × 1/16 = ½ PV max soigné cumulé (Herbu) ou 8 t d'immunité statut (Brumeux) / barrière (Psy). **Fallback si stall Herbu trop fort : durée étendue Champs 8 → 6-7 tours** (distinct de la météo qui reste à 8), réduit le soin total sans toucher le montant/tour.
- **Overlap & fragmentation** : empiler des zones → lisibilité rendu (contours croisés, pastilles superposées). Cap naturel : 1 pose = 1 action. **Mew apprend les 4 Champs** → patchwork possible. **Garde-fou si clutter en playtest** : soft-cap **2 zones actives par poseur** (Mew choisit ses 2 meilleures) — pas un changement mécanique majeur. Offset des pastilles superposées (renderer).
- **Barrière anti-dash & portée IA/UI** : couvert par `resolveDash` (chemin unique validate+exécution) — mais **test de preview obligatoire** (`getLegalActions` doit refléter la troncature) + vérifier `getDashPositions`. Divergence Showdown (#428) à documenter au wiki. Cas dégénéré léger : équipe adverse à 4+ dashers (roster en a ~5) verrouillée 5-8 t → acceptable (coût 1 action statut, sortie/contournement/flyers possibles, dasher avance quand même jusqu'au bord).
- **Champ Psychique sans dashers adverses** = quasi inutile (juste le boost Psy). Acceptable (move situationnel), mais l'IA doit le scorer **bas/0** si l'ennemi n'a pas de dash.
- **Combos learners à surveiller** (game-designer, mons du plan 118) : Alakazam/Mewtwo Zen Absolu + Champ Psy = STAB ×1.5 × terrain ×1.3 = **×1.95** (dans la norme, cf. Soleil+STAB Feu ×2.25). Si Mewtwo trop dominant → retirer Champ Psy de son moveset (override tactique, Lippoutou/Alakazam suffisent comme poseurs). Florizarre Champ Herbu + Vampigraine = attrition multi-source (intentionnel pour un Plante).
- **Double porte « au sol »** : dépend de `isEffectivelyFlying` (déjà étendu Racines plan 116, Lévitation, Roost). Vérifier qu'un mon enraciné (Racines) **est** affecté par les Champs (grounding) — interaction voulue.

## Hors-scope (→ plan 118 ou plus tard)

- **6 moves dépendants** : Gliss'Herbe, Monte-Tension, Vaste Pouvoir (AoE dynamique), Explo-Brume (self-KO), Champlification (morph type), Force Nature (morph move) → **plan 118**.
- **Motif/particules par Champ** (v2 rendu) → si le playtest montre une ambiguïté du fill additif (décision #430).
- **IA de positionnement** (aller se placer dans une zone) → amélioration ultérieure du scoring de mouvement.
- **Champ Maïté / Misty/Grassy seeds** et autres objets terrain → batch objet B5.
- **Interaction Champs × abilities** (Surge Surfer, Grassy Surge, etc.) → hors roster Gen 1 / futur.
