# Plan 182 — Anneaux d'aura au sol (contour de zone permanent)

> **Statut** : done (2026-08-19)
> **Créé** : 2026-08-19
> **Phase** : 6.5 « Client jouable », Lot 3 (compléter l'UI) — **dernier item du lot**
> **Cadre** : `docs/plans/173-phase-client-jouable-ui-controles.md` — item « Auras : 1 rond par aura empilable » + décision #4

## Motivation

Backlog `roadmap.md:305` (Polish visuel 2D-HD, 2026-06-19) : « **Auras — un "rond" par aura qui se stack** : un anneau au sol par aura active, empilables visuellement. »

Aujourd'hui les auras se lisent par **émoji flottés au-dessus des tuiles du rayon, uniquement au survol du lanceur** (`babylon-aura-ground-icons.ts`) — donc invisibles par défaut. Le joueur ne voit pas qu'il traverse une zone protégée sans aller survoler chaque lanceur un par un. L'item jumeau du plan 177 (« rendu in-world des effets sur tuiles — feedback permanent sans survol ») dit la même chose.

Livrer cet item **clôt le Lot 3** et débloque le Lot 1 (contrôles tactiles).

## Décisions humaines actées (2026-08-19)

1. **L'anneau remplace les émoji au sol** — ce n'est pas un ajout. `babylon-aura-ground-icons.ts` et `view-core/aura-ground-layout.ts` sortent du code (zéro tolérance au code mort).
2. **Contour de périmètre de zone**, pas un marqueur par tuile. Ancré au lanceur, le suit.
3. **Permanent** — plus de survol.
4. **Section de l'anneau = 1 voxel** (1 voxel = 1 px = 1/24 unité monde, `docs/references/voxel-tile-placement.md` §Échelle).
5. **Empilement vertical** quand plusieurs auras : pas de **2 voxels** (1 voxel d'anneau + 1 voxel de vide). Un pas de 1 voxel ferait fondre deux anneaux voisins en un trait épais.
6. **Une teinte par type d'aura.**
7. **Anneaux au-dessus de la peinture des Champs** — la séparation verticale règle la superposition, pas une dédup.
8. **Requiem** entre dans le système, avec sa **teinte de menace distincte** et son rayon propre. Le court-circuit actuel est supprimé.
9. **Brouhaha** entre dans le système : anneau **+ nouvelle pastille de barre de vie** (elle n'a aucun rendu aujourd'hui).
10. **Périmètre fermé aux auras.** Hazards, DoT et Champs sont déjà rendus, on n'y touche pas.
11. **La charge 2 tours** (`chargingMove`, ⚡) n'est pas une aura et n'a pas de zone → hors périmètre, inchangée.
12. **Teinte dérivée de la couleur de l'émoji** déjà affiché sur la barre de vie — l'émoji porte l'identité, l'anneau la prolonge. Détail et écarts assumés : étape 7. Pastille Brouhaha : **🔊**.
13. **Aucun gating sous le fog** — les anneaux sont dessinés pour **les deux camps**, y compris Requiem et Brouhaha. Ce n'est pas une décision neuve : le plan 176 (ligne 38) a déjà tranché « crans de stats, statuts, volatiles, **auras** → visibles », au motif que ces changements « sont annoncés au journal **et** en texte flottant au moment où ils arrivent : les cacher au panneau serait incohérent, pas discret ». L'anneau hérite de cette politique. Il ne crée aucune fuite nouvelle : la zone est déjà lisible aujourd'hui en survolant le lanceur ennemi — l'anneau retire la friction, pas le secret.
14. **Relief** : hypothèse retenue, à arbitrer à l'écran — le contour épouse le haut de chaque tuile (il monte et descend avec le terrain, comme la peinture des Champs). Contrepartie assumée : sur terrain accidenté l'empilement se lit **par segment**, pas comme des plans parallèles traversant toute la zone.

## Constat carto

### Le pipeline de contour procédural existe déjà de bout en bout

Vérifié dans le code, c'est le constat qui dimensionne ce plan — il n'y a **presque pas de géométrie à écrire** :

- **`packages/view-core/src/field-terrain-borders.ts`** (plan 125) — `fieldTerrainBorderEdges(tiles)` prend **n'importe quel** jeu de tuiles et rend, par tuile, chaque côté dont le voisin est absent du set. C'est exactement l'algorithme du contour en escalier d'un disque de Manhattan. `fieldTerrainBorderSegment(side)` donne les offsets d'extrémités (±0.5). Engine-agnostique, déjà partagé entre le contour de portée et le périmètre des Champs.
- **`packages/render-babylon/src/babylon-field-terrains.ts:120-161`** — le rendu de ce contour : chaque arête devient un segment `CreateGreasedLine`, posé sur `topAt(x, y)` donc **épousant déjà l'élévation par tuile**, lift `BABYLON_TILE_OUTLINE_Y_OFFSET`, **inset d'une demi-largeur** pour que le trait tienne entièrement dans la tuile (pas de morsure dans le mur d'un voisin plus haut). Aucun `alphaIndex`, juste un `alpha` matériau.
- **La largeur demandée est déjà en prod** : `FIELD_TERRAIN_OUTLINE_WIDTH = 0.04` unité, quand 1 voxel = 1/24 = **0.0417**. La « section d'un voxel » est à 4 % près la largeur du contour Champs existant. Rien à calibrer.
- **`Grid.getTilesInRange(pos, 0, r)`** est Manhattan **et clipé aux bornes de la grille** (`Grid.test.ts:97`). Le découpage du contour au bord de carte est gratuit.

Conséquence : ce plan est surtout du **view-model** (quelles zones, quel ordre, quelle teinte) plus un **clone paramétré** du renderer de contour existant. Pas un chantier géométrique.

### Les 6 auras et leur état de rendu

| Aura | Source core | Rayon | Périmètre | Barre de vie | Sol aujourd'hui |
|---|---|---|---|---|---|
| **Protection** | `state.auras`, `AuraKind.Reflect` | `AURA_RADIUS = 3` | alliés | 🛡️ sur chaque mon couvert | émoji au survol |
| **Mur Lumière** | `state.auras`, `AuraKind.LightScreen` | `AURA_RADIUS = 3` | alliés | ✨ idem | émoji au survol |
| **Brume** | `state.auras`, `AuraKind.Mist` | `AURA_RADIUS = 3` | alliés | 🌫️ idem | émoji au survol |
| **Rune Protect** | `state.auras`, `AuraKind.Safeguard` | `AURA_RADIUS = 3` | alliés | 🕊️ idem | émoji au survol |
| **Requiem** | `pokemon.perishAura` | **variable** (`effect.radius`) | **tout le monde**, lanceur inclus | 🎵 sur le **lanceur seul** | émoji au survol, **court-circuitant** les 4 autres |
| **Brouhaha** | `lockInMoveId === "uproar"` | `UPROAR_AURA_RADIUS = 3` | tout le monde (bloque le Sommeil) | **rien** | **rien** |

Trois faits qui simplifient :

- **Toutes les auras sont mobiles.** Les 4 auras d'équipe testent `isWithinAuraRadius(caster.position, …)` sur la position **vivante** du lanceur ; Requiem est documentée « follows the caster — recomputed from its live position » (`handle-perish-song.ts:8-9`) ; Brouhaha suit son lanceur verrouillé. Pas de cas particulier « aura mobile » à traiter : **toutes** se recalculent depuis la position courante du lanceur.
- **Les 4 périmètres d'équipe sont rigoureusement identiques** (même rayon, même lanceur). L'empilement vertical est la seule façon de les distinguer — des anneaux concentriques auraient exigé d'inventer des rayons faux.
- **`postedAtAction`** existe déjà sur `TeamAura`, documenté « stable ordering for badge rendering » → ordre d'empilement gratuit et stable. Requiem et Brouhaha n'en ont pas (voir étape 1).

### Le calcul de zone est dupliqué 4 fois

`aura-system.isWithinAuraRadius`, `battle-views.ts:166`, `battle-orchestrator.ts:~1600`, `ai/action-scorer.ts:1376` — chacun refait le Manhattan à la main. **Ne pas en ajouter un 5ᵉ** : la zone dessinée doit dériver du même helper que la zone qui protège, sinon l'anneau peut mentir. C'est la dérive que le plan 175 a dû réparer sur les dégâts (`resolveDamageContext`).

### Palette

Aucune teinte n'est assignée par type d'aura aujourd'hui (`view-core/constants.ts:207-212` n'a que des émoji). Déjà pris dans `docs/design-system.md` : bleu (allié / buff / équipe 1), rouge (ennemi / attaque / équipe 2), orange (portée ennemie), jaune doré (focus / curseur / dash), vert (soin / validation), violet (statuts volatils), gris (neutre), plus cyan / rose / lime / brun dans les 12 `TEAM_COLORS`. **Tranché** par la règle « la teinte dérive de la couleur de l'émoji » (décision 12) — détail et écarts à l'étape 7.

## Étapes

### 1. `view-core` — view-model unifié des zones d'aura

Nouveau `packages/view-core/src/aura-ring-view.ts`. Une abstraction qui couvre les 3 sources hétérogènes (`state.auras`, `perishAura`, verrou Brouhaha) :

```
AuraRingSpec {
  id: string            // stable entre les frames : `${ringKind}:${casterPokemonId}`
  casterPokemonId: string
  tiles: readonly Position[]   // via Grid.getTilesInRange → déjà clipé carte
  color: number
  stackIndex: number    // 0, 1, 2… → lift = index × pas
}
```

- **`ringKind`** est une clé élargie, pas un `AuraKind` : les 4 valeurs de `AuraKind` **plus** les deux littéraux `"perish-aura"` et `"uproar"`. Requiem et Brouhaha n'ont pas d'`AuraKind` (l'une vit sur `pokemon.perishAura`, l'autre sur `lockInMoveId`), donc le type du view-model doit les accueillir explicitement — `type AuraRingKind = AuraKind | "perish-aura" | "uproar"`.
- **Pas de champ `radius` dans le spec** : le rayon ne sert qu'à produire `tiles`, il n'a aucun usage en aval. Il est lu à la source (constante `AURA_RADIUS` pour les 4 murs, `UPROAR_AURA_RADIUS` pour Brouhaha, `caster.perishAura.radius` pour Requiem, seul rayon variable) et consommé immédiatement. Ne pas le porter dans le spec évite un champ que deux consommateurs sur trois ignoreraient.
- Les tuiles viennent de `getTilesInRange(caster.position, 0, radius)`. **Pas de filtre `pokemonAt`** : contrairement aux émoji, un anneau de contour ne se cache pas derrière un sprite (le trait est au sol, sur le pourtour).
- Ordre d'empilement : `postedAtAction` pour les 4 auras d'équipe. Requiem et Brouhaha n'en ont pas → tri sur la clé composite stable `${ringKind}:${casterPokemonId}`, **jamais** l'ordre d'itération d'une `Map` (sinon l'empilement danserait d'une frame à l'autre). Les deux familles cohabitent : les auras d'équipe d'abord par `postedAtAction`, puis Requiem/Brouhaha par clé composite.
- Extraire le prédicat de zone dans **un** helper partagé et router les 4 duplications dessus.

### 2. `render-ports` — port

Remplacer `setAuraGroundIcons(cells, symbols)` par `setAuraRings(specs: readonly AuraRingSpec[])` dans `ports.ts` et `combat-scene.ts`.

### 3. `render-babylon` — renderer d'anneaux

Nouveau `packages/render-babylon/src/babylon-aura-rings.ts`, cloné sur le bloc périmètre de `babylon-field-terrains.ts:120-161` :

- `fieldTerrainBorderEdges(tiles)` → segments → `CreateGreasedLine`, un mesh par aura (pas un par tuile).
- `topAt(x, y)` par tuile de bordure, `lineY = top.y + BABYLON_TILE_OUTLINE_Y_OFFSET + stackIndex × AURA_RING_STACK_PITCH`. Le lift sert **à la fois** l'anti-z-fighting et l'empilement — un seul mécanisme.
- Inset d'une demi-largeur, comme les Champs.
- `renderingGroupId = 0` : `combat-scene.ts:222-223` désactive l'auto-clear du depth pour les groupes 1 et 2, donc un sprite en groupe 2 occlut correctement un mesh en groupe 0 — le mécanisme déjà utilisé par les hazards et les décorations.
- **Pas d'`alphaIndex`, pas de `disableDepthWrite`** — le contour Champs n'en pose pas, et le lift Y suffit à l'ordonnancement.
- Reconstruction : `points` de GreasedLine **n'est pas mutable** (doc officielle), `setPoints()` détruit et recrée. Donc `dispose` + recréation quand une zone change — même patron que `field-terrains.paintZone()`. Fréquence : au déplacement d'un lanceur, pas par frame.

### 4. Brouhaha — pastille de barre de vie

Nouveau symbole dans `view-core/constants.ts` + branchement dans la boucle de `refreshAuraIndicators` (`battle-orchestrator.ts`). Émoji cohérent avec la famille sonore (📢 ou 🔊 — à trancher étape 7).

### 5. Requiem — suppression du court-circuit **du chemin au sol**

Bien distinguer les deux chemins, ils ne se comportent pas pareil (vérifié) :

- **`showAuraHoverFor`** (`battle-orchestrator.ts:1615`) — le chemin **au sol**, celui que ce plan remplace. Sa branche Requiem (l. 1621) fait `return` avant d'atteindre les auras d'équipe : un lanceur Requiem + Protection n'affiche aujourd'hui que Requiem au sol. C'est **ce** court-circuit qui disparaît → les deux anneaux coexisteront.
- **`refreshAuraIndicators`** (l. ~1570-1612) — le chemin des **pastilles de barre de vie**. Il n'a **pas** de court-circuit : Requiem (l. 1573) et les 4 auras d'équipe (l. ~1586-1608) y cohabitent déjà. **Aucun changement requis**, hors l'ajout de la pastille Brouhaha (étape 4).

### 6. Suppression du code mort

- `packages/render-babylon/src/babylon-aura-ground-icons.ts` → supprimé.
- `packages/view-core/src/aura-ground-layout.ts` → supprimé, + son export d'index.
- **Constantes orphelines — vérifiées par grep, suppression sûre**, mais l'inventaire est plus large qu'il n'y paraît : `AURA_HOVER_MAX_ICONS` et `SCREEN_HOVER_AURA_ALPHA` sont **définies en double**, dans `packages/render-babylon/src/constants.ts:35-36` **et** dans `packages/app/src/constants.ts:230,232` (duplication préexistante, sans rapport avec ce plan). Les deux copies deviennent mortes. S'ajoutent `AURA_HOVER_ICON_HEIGHT` / `_OFFSET` (+ leurs réexports `BABYLON_*` dans `babylon-constants.ts:12,14`) et les `AURA_HOVER_ICON_SIZE`/`_LIFT`/`_ALPHA` documentés dans `design-system.md`. **Re-grepper au moment de la purge** plutôt que se fier à cette liste : elle date de la rédaction du plan.
- `showAuraHoverFor` et son appel depuis le survol.
- Section « Phase recette — auras (Murs) in-engine » de `docs/design-system.md` à réécrire, pas à laisser décrire un système supprimé.

### 7. Constantes et palette

- `AURA_RING_STACK_PITCH = 2 / 24` (2 voxels), dans `packages/view-core/src/constants.ts` à côté de `TILE_OUTLINE_Y_OFFSET`.
- Table de teintes : `AURA_RING_COLOR_BY_KIND: Record<AuraRingKind, number>` dans `packages/view-core/src/constants.ts` (même fichier que `AURA_INDICATOR_SYMBOL`, dont elle est le pendant chromatique — les deux tables doivent se lire côte à côte, c'est ce qui rend la règle « la teinte dérive de l'émoji » vérifiable en relecture).
- **Règle de palette actée (humain, 2026-08-19) : la teinte de l'anneau dérive de la couleur de l'émoji déjà affiché sur la barre de vie.** L'émoji porte l'identité, l'anneau la prolonge — aucune légende à apprendre, le lien barre de vie ↔ sol est automatique.

  Appliquée telle quelle, la règle bute sur un fait : **4 des 6 émoji sont dans la famille gris / blanc / bleu-gris** (🛡️ acier, 🌫️ gris pâle, 🕊️ blanc, 🔊 gris), ce qui annule la distinction cherchée ; et un trait d'un voxel en gris pâle disparaît sur neige ou sable. D'où l'ancrage sur l'émoji quand sa teinte est distinctive, et un écart assumé et tracé quand elles se télescopent :

  | Aura | Émoji | Teinte | Origine |
  |---|---|---|---|
  | Protection | 🛡️ | bleu acier | dérivée directe |
  | Mur Lumière | ✨ | or | dérivée directe |
  | Brume | 🌫️ | cyan pâle | dérivée, saturation poussée (le gris pur disparaîtrait) |
  | Rune Protect | 🕊️ | vert olive | dérivée du **rameau**, pas du corps blanc |
  | Requiem | 🎵 | violet | **écart** — la note est bleu nuit : invisible sur terrain sombre, et trop proche du bleu acier |
  | Brouhaha | 🔊 | orange chaud (`0xff8c42`) | **écart, aucune base émoji** — le haut-parleur est gris, déjà pris 3 fois. Le rose magenta initialement proposé a été écarté : Terrain Brumeux (`0xf49ad1`) et Zone Magique (`0xc0567f`) occupent déjà cet espace au sol. |

  **Collisions à arbitrer à l'écran** (pas tranchables sur le papier) : l'**or** contre le jaune doré du curseur / dash, et le **bleu acier** contre le bleu d'équipe 1. Les contextes diffèrent (curseur = mesh voxel au-dessus du Pokemon, anneau = trait au sol), à confirmer visuellement.

  **Limite de la règle** : les couleurs d'émoji dépendent de la police (Noto Color Emoji sous Linux, autre chose sur iOS/Android). « Coller à l'émoji » est un guide de conception, pas un invariant vérifiable en test.
- Pastille Brouhaha : **🔊** (acté humain).
- Plafond d'anneaux empilés simultanés : aucune source ne donne de seuil pour ce cas (l'`AURA_HOVER_MAX_ICONS = 6` des émoji n'est pas transposable — une croix spatialise, un empilement compresse). À fixer sur test visuel réel, pas par déduction.

### 8. Tests

- **unit `view-core`** — nouveau `packages/view-core/src/aura-ring-view.test.ts` : jeu de tuiles d'un disque Manhattan r3 ; clipping au bord de carte ; `stackIndex` déterministe à auras multiples (l'invariant qui compte : deux appels sur le même état rendent le même ordre) ; Requiem à rayon variable ; Brouhaha détectée via le verrou `lockInMoveId` ; lanceur K.O. → pas d'anneau ; aucune aura → liste vide.
- **unit `core`** — dans le `packages/core/src/battle/aura-system.test.ts` **existant**, pas un nouveau fichier : le helper de zone partagé, avec la non-régression du refacto (les 4 anciens sites rendent le même verdict qu'avant).
- **e2e** — à confier à l'agent `test-writer`, qui place le spec et met `docs/test-plan.md` à jour (le harnais e2e a ses conventions, `.claude/rules/e2e.md`). Scénarios : anneau présent **sans survol** après pose d'une Protection ; empilement à 2 auras du même lanceur ; l'anneau suit le lanceur qui se déplace ; disparition à expiration.

  ⚠️ Ce que l'e2e **ne** couvrira pas, et qu'il ne faut pas prétendre couvrir : l'apparence de l'anneau (épaisseur, teinte, jonctions aux coins, lisibilité de l'empilement) n'est pas observable par le harnais. Ces points sont **👁 humain** au cahier, pas 🤖 — les inscrire comme automatisables serait un test mort.
- **golden visuel** : le projet e2e `visual` est **local-only** (la CI GitHub ne le voit pas) — un golden pour l'anneau est utile mais ne protège que localement.

### 9. Docs

`docs/design-system.md` (section auras réécrite : constantes, pas d'empilement, teintes), `docs/decisions.md` (décisions de ce plan), `docs/roadmap.md:305` + ligne Lot 3 cochées, `docs/next.md`, `docs/plans/README.md`.

## Risques et angles morts

Signalés par la passe `best-practices` (2026-08-19), **à ne pas combler au jugé** :

1. **Jonctions de segments aux coins.** `fieldTerrainBorderEdges` rend des **segments indépendants**, pas une polyligne fermée ordonnée. GreasedLine accepte `Vector3[][]`, donc ça fonctionne — mais le rendu exact des extrémités aux coins de l'escalier (micro-gap ou chevauchement) n'est pas documenté. **À vérifier par capture réelle**, pas à supposer. Le contour Champs vit déjà avec ça sans que ce soit remonté, ce qui est plutôt rassurant sans être une preuve : ses zones sont plus grandes, donc les coins plus rares.
2. **Trait fin sous-échantillonné au zoom arrière.** À 0.04 unité un côté d'anneau peut tomber sous 1 px écran selon le cran de zoom. Risque **déjà couru et empiriquement toléré** par les contours Champs/portée aux mêmes largeurs. Le moiré de rotation, lui, ne nous concerne pas : `AZIMUTH_STEP = Math.PI / 2`, la caméra ne tourne que par paliers de 90°, chaque palier est un rendu statique. Repli si un scintillement réel apparaît : `sizeAttenuation: true` avec largeur mini en px — **mais ça change la sémantique de l'épaisseur** (dépendante du zoom, plus du voxel), donc arbitrage humain requis, pas un fix silencieux.
3. **Lisibilité de l'empilement.** Aucune source sur le seuil. À l'échelle 24 px/tuile, une pile de N bandes de 1 voxel se projette en une fine bande oblique sous caméra dimétrique. Le point le plus susceptible d'être rejeté à l'œil — d'où l'arbitrage écran avant de figer.
4. **Aucun post-mortem public** FFTA / Triangle Strategy / Tactics Ogre Reborn / Unicorn Overlord sur le traitement de contour de zone persistante. Les choix de forme s'appuient sur la cohérence avec l'esthétique déjà tranchée du projet (traits nets partout : curseur, contour Champs, contour de portée), pas sur une doc de ces jeux.
5. **Superposition avec le fill des Champs.** Les anneaux passent au-dessus par lift Y. Sur une tuile qui porte à la fois un fill de Champ, son contour, et 2 anneaux d'aura, on empile 4 traits dans quelques pixels. Cas peu fréquent mais réel — à regarder en sandbox.

## Hors périmètre

- Hazards, DoT, Champs en rendu in-world (item distinct du plan 177, § « Rendu in-world des effets sur tuiles »).
- La charge 2 tours (`chargingMove`) — pas une aura, pas de zone.
- Le « point icônes » du plan 177 (remplacer les émoji placeholder du panneau de case par un pack cohérent) — ce plan retire les émoji **au sol**, il ne touche pas à ceux du DOM ni à la rangée de la barre de vie.
- Toute redaction core par perspective (fog serveur) — Phase 7.
