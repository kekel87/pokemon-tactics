# Plan 234 — VFX lot 2a : un effet pour chaque attaque, par forme × type

**Statut** : done (2026-10-08, recette humaine validée)
**Origine** : `/next` du 2026-10-08, suite du chantier VFX (roadmap, domaine *Donner envie*).
Cadrage : graphe, `decision-1137` (lot 2 = 2a générique puis 2b dédié), `decision-1138` (régime de
licence proposé, limite itch), `reflexion-2026-10-07-vfx-source-pmdo` (inventaire PMDO),
`plan-233` (marqueurs d'impact, horloge `combatClock`, atelier, **clos le 2026-10-08**).

**Ce plan est le lot 2a** : des effets **génériques**, aucun effet dédié à une attaque précise (lot 2b),
aucun son (lot 3), aucune lumière/fumée HD-2D (champs réservés dans le descripteur, ignorés).

**Relu le 2026-10-08** contre le code (`plan-reviewer`) et côté jeu (`game-designer`) ; arbitrages
techniques intégrés dans le texte, aucun point ne reste à l'humain.

## Écarts au plan, constatés pendant le dev (2026-10-08)

- **Un seul script** `pnpm build-move-effects` (télécharge si absent, empaquette) ; index de la
  planche en **module TS généré** (`render-babylon/src/move-effect-atlas.ts`, clés typées) plutôt
  qu'un JSON à côté du PNG : 1 fichier ajouté au build (la planche, 20 Ko). Source en
  `assets-src/effects/` (gitignorée, hors `public/`).
- **Un seul port** `playMoveEffect(pokemonId, spec)` : l'éclat d'impact est la forme `impact` jouée
  depuis la case actuelle du Pokémon touché (l'état lu par l'orchestrateur est déjà final, un recul
  l'aurait déplacé). `direction` retiré du descripteur (inutile).
- **Multi-coups** : un seul projectile, puis un éclat par coup (pas un projectile par coup).
- **Ciblage effectif** (Expansion de Force sur Champ Psychique, Malédiction) : non pris en compte, la
  forme se calcule sur le ciblage de base ; la relation soi/allié/ennemi vient des cases touchées.
- **Table de surcharges** : non créée (vide = code mort), à ajouter à la première surcharge.
- Rendu par un `SpriteManager` Babylon (un appel de dessin, sprites face caméra, pool réutilisé).

## Révision en recette (2026-10-08) — familles d'après PMD Origins

Retour de l'humain : le premier classement (13 formes) était une interprétation personnelle et
manquait des familles entières. Trois recherches (Showdown, PokeRogue, PMD Origins) puis deux
recherches PMDO dédiées (inventaire des 512 fiches `Data/Skill`, code moteur RogueEssence/PMDC) ont
fondé une table de familles, **validée par l'humain**. Données de recherche : graphe (doc-keeper) ;
listes sans drapeau tirées des fiches PMDO, dans `packages/view-core/src/move-effect-form.ts`.

| Famille (forme) | Critère | Rendu (PMDO) |
|---|---|---|
| Morsure, Entaille, Griffe, Poing, Pied, Manchette, Estoc | drapeaux `bite` / `slicing` / `punch` + listes PMDO | avancée du lanceur (2/3 de case, sur RushFrame→HitFrame→ReturnFrame) + marque orientée sur la cible |
| Contact simple (`melee`) | autre contact | avancée + éclat par coup |
| Ruée (`rush`) | ciblage Ruée | images rémanentes (fantôme 50 %, 133 ms) |
| Rayon (`beam`) | Ligne spéciale | corps étiré + tête (`Column_White`), 100 ms/case, maintien 100 ms, coupure nette |
| Jet (`stream`) | Lance-Flammes, Hydrocanon, Rafale Psy | 8 particules toutes les 83 ms le long de la ligne |
| Projectile / Lame lancée (`blade`) | Cible à distance / `slicing` à distance | 10 cases/s |
| Bombe, Lancer au sol | Explosion, GroundTarget | cloche haute de la moitié de la distance |
| Souffle, Vent | Cône / drapeau `wind` | éventail de 90° (4 salves × 2) |
| Poudre | drapeau `powder` | spores colorées par le statut, qui retombent en dérivant |
| Zone | Zone, Croix | anneau au sol en ellipse + fumée, 100 ms/case |
| Chant, Cri, Onde sonore | `sound` + listes | notes / `Growl` orienté / anneaux |
| Regard, Onde sur la cible | listes PMDO | `Leer` / `Wave_Circle` |
| Concentration, Écran, Bonus allié | statut sur soi / liste écrans / allié | rassemblement / panneau `Screen_RSE` / rassemblement sur l'allié |
| Événements | stat, soin, absorption, statut, Abri, contrecoup | rouge ↑ / bleu ↓ ; anneau vert + étincelles ; bulles ; image PMD par statut ; bouclier ; éclat |

Hors 2a (lot 2b) : éclair du ciel, piliers, ligotage/encerclement, échanges, tirs en étoile, voiles
plein écran. PMDO ne part pas de la tête : notre départ depuis la gueule (points PMDCollab
extraits au hit frame, `pnpm extract-sprites --anchors-only`) est un ajout.

## Ce que tu verras à l'écran

1. Chaque attaque jouable affiche un effet visuel, choisi par sa **forme** (projectile, explosion, rayon,
   souffle, zone, onde sonore, coup au contact, nuage de statut, aura…) et **coloré par son type**.
2. Un **projectile** (Flammèche, Pistolet à O…) part de l'attaquant au moment du tir, **voyage** jusqu'à
   la cible, et c'est **à son arrivée** que la cible encaisse (assombrissement, barre, chiffre).
3. Les coups au contact gardent le geste du Pokémon et ajoutent seulement un **éclat d'impact** sur la
   cible, plus gros sur un super efficace.
4. L'effet suit la **Vitesse des combats** (×2 en Rapide, rien en Instantanée) et se rejoue, se ralentit
   et se scrube dans l'**atelier des attaques**, avec une piste « Effet » dans la séquence.

## Le constat

- **512 attaques jouables** (chiffre du 2026-10-08, non recompté à la relecture). `packages/data/reference/moves.json`
  compte 850 entrées de move ; le filtre « jouable » est à rappeler dans le script de mesure.
- Ciblage × catégorie (chiffres du 2026-10-08, non recomptés) : Single physique 148, Self statut 79,
  Single statut 69, Single spéciale 54, Cône spéciale 27, Dash physique 25, Line spéciale 18, Slash
  physique 15, Zone spéciale 14, Zone statut 10, Cône statut 9, Zone physique 8, le reste < 7.
- Drapeaux : contact 180, bullet 17, slicing 14, punch 13, wind 11, bite 9, pulse 6, dance 6, powder 5.
  **sound : 19 annoncés, mais l'index `reference/indexes/moves-by-flag.json` liste 32 ids** — à
  re-mesurer sur les 512 jouables avant de figer la règle « sound ».
- `moveAnimationCategory` (`packages/data/src/base/animation-category.ts`) couvre **111 attaques**
  (et non 61 comme écrit avant la relecture), défaut Contact — il choisit le geste Attack/Shoot/Charge,
  il n'est **pas** la source de la forme.
- Accroches en place (plan 233) : `stageAttack` attend `playback.impact` (HitFrame du sprite) puis joue
  les coups ; cues de présentation `AttackStart` / `Impact` / `Hit` / `AttackEnd` consommés par l'atelier ;
  tout temps de combat passe par `combatClock`.
- **Piège du tir** : la HitFrame de l'animation Shoot = **départ** du tir (à vérifier sur l'atlas réel,
  champ `hitFrameByAnimation`). Aujourd'hui, `applyEvents` traite le `DamageDealt` dès que `stageAttack`
  rend la main : flash, barre et chiffre tombent au départ. Avec un projectile, l'impact doit attendre
  son temps de vol.
- Sources PMDO (`PMDCollab/RawAsset/Particle`) : 665 PNG, ~3 Mo, `<Nom>.None.png` (bande de frames) ou
  `<Nom>.Dir8.png` (8 directions) ; impacts génériques `Hit_Neutral`, `Hit_Super_Effective` ; `Beam/` =
  60 rayons. **Aucun fichier LICENSE** (rips des jeux Mystery Dungeon).

## Vérifications contre le code (relecture 2026-10-08)

- **`MoveStarted` ne porte pas de cible** : seulement `attackerId`, `moveId`, `direction`, et
  `resolvedMoveId?` / `resolvedType?` pour les morphs (Métronome, Nature Power, Pulsation de terrain).
  Source : `packages/core/src/types/battle-event.ts` l.67, `BattleEngine.ts` l.1981-1990.
- **`applyEvents(events)` ne reçoit que les événements**, et l'état lu par l'orchestrateur est déjà
  **final** pour tout le lot (commentaire `battle-orchestrator.ts` l.2243). Les positions et le
  ciblage lus à ce moment ne sont pas ceux du moment du tir.
- **Ciblage effectif ≠ ciblage de base** : `MoveDefinition.fieldTerrainTargetingOverride` (Expansion de
  Force : Single → Zone sur Champ Psychique) et `targetingByCasterType` (Malédiction : Single si Spectre,
  Self sinon), résolus par `effectiveTargetingFor`. Une forme calculée sur `move.targeting` seul est fausse
  pour ces moves.
- **Blast** : la case d'impact dépend d'une interception (`resolveBlastImpactTile`,
  `packages/core/src/grid/targeting.ts` l.187) et il faut la case visée, absente de l'événement.
- **Dash et Téléport** (`PokemonDashed`, `Teleported` ∈ `DISPLACEMENT_EVENT_TYPES`, l.253) :
  `collectStrikes` met `displacedBeforeHit` à vrai, `stageAttack` ne joue pas le coup, et le coup part
  au `DamageDealt` traité **dans la boucle**, après le déplacement — pas au HitFrame.
- **Multi-coups** : `multiHit` = plusieurs blows sur **une même** cible. Les blows intermédiaires passent
  par `playStrike` (cue `Hit` seul, sans `playImpact`), donc **hors de `stageAttack`**.
- **Charge en deux tours** : le tour 1 émet `MoveCharging` (`BattleEngine.ts` l.1868) **sans**
  `MoveStarted` ; `MoveStarted` n'arrive qu'au tour 2.
- **Téléport** : 7 moves de ciblage `Teleport` dans `packages/data/src/overrides/tactical.ts`
  (ids : `teleport`, `fly`, `dig`, `bounce`, `phantom-force`, `shadow-force`, `dive`). Les six
  derniers ont des dégâts et un `semiInvulnerableState`.
- **Sound + Cône** : les moves Cône à drapeau sound (ids : `roar`, `growl`, `sing`, `snore`, `round`,
  `echoed-voice`, `alluring-voice`, `hyper-voice`, `uproar`) tombent dans `sound-wave` par priorité.
  Aucun move Ligne à drapeau sound n'apparaît dans `tactical.ts` ; le ciblage des autres vient de la
  base, non vérifié.
- **Mise en forme des teintes** : `docs/design-system.md` § Types Pokemon ne définit que **6 types**
  (Feu, Eau, Plante, Normal, Vol, Poison) ; il n'existe **aucune** constante `TYPE_COLORS` dans le code.
- **Renderer** : `.claude/rules/renderer-babylon.md` impose `renderingGroupId = 0` (un autre groupe vide le
  depth buffer). Le « groupe de rendu au-dessus des sprites » du plan initial y contrevient (voir § D).
- **Atelier** : la piste « effects » existe déjà, grisée dans `FUTURE_TRACKS`
  (`packages/app/src/babylon/move-workshop-timeline.ts` l.67-68). Le `switch` sur les cues est exhaustif.
- **Précédents d'assets confirmés** : `scripts/extract-sprites.ts` / `pack-sprites.ts` (source gitignorée,
  bundle commité) et `scripts/extract-item-icons.ts` (dossier per-item gitignoré, plan 168).
- **Non vérifié** : la limite itch « +2 fichiers » (aucune source trouvée dans `docs/`).

## Licence — tranché par l'humain le 2026-10-08

Effets PMDO **repris comme les sprites** : source téléchargée par script et **gitignorée**, **planche
empaquetée commitée**, jeu autonome hors ligne (`decision-1138` confirmée). Corollaire, fait dans ce
lot : réécrire la ligne « Commiter assets non libres de droits » de `CLAUDE.md` pour décrire cette
pratique (source régénérable gitignorée, paquet commité).

## Approche

### A. Forme d'un effet — fonction pure (view-core)

`packages/view-core/src/move-effect-form.ts`, sur le modèle de `secondary-effect-chip.ts`.
Signature : `moveEffectForm(move: MoveDefinition, targeting: TargetingPattern, relation: TargetRelation)`
— `targeting` = ciblage **effectif** (`effectiveTargetingFor`), `relation` = `self` / `ally` / `enemy`
(dérivée de `targetsAlly` / `targetsAllyOrSelf` et des cases touchées).

Ciblages et drapeaux **vérifiés dans les données le 2026-10-08** (sound : Cône 12, Single 5, Self 2 ;
contact hors Single : Éclate-Roc Cross, Bec Vrille / Tunnelier / Empal'Korne Line, Tour Rapide /
Centrifugifle Zone ; Slash sans contact : Tranch'Herbe, Lame d'Air, Feuille Magik, Tranch'Air,
Coupe Psycho ; Dash sans contact : Éclats Glace, Onde Vide ; Blast : Météores, Déflagration,
Bombe Beurk…). Règles, **la première qui matche gagne** :

| # | Forme | Règle |
|---|-------|-------|
| 1 | `vanish` | ciblage Teleport (Téléport, Vol, Tunnel, Rebond, Plongée, Revenant, Hantise) : bouffée au départ et à l'arrivée, éclat d'impact si dégâts |
| 2 | `impact` | Dash, HitAndRun, Slash, Single `range.max === 1`, et **Line ou Cross avec `contact`** (Bec Vrille, Éclate-Roc) |
| 3 | `sound-wave` | drapeau `sound` — les anneaux **épousent la vraie forme** (arc qui s'ouvre en Cône, anneaux qui voyagent en Single, autour du lanceur en Self) |
| 4 | `beam` | Line |
| 5 | `breath` | Cône, non statut |
| 6 | `blast` | Blast : projectile **puis** explosion sur les cases à l'arrivée (Météores, Déflagration, Bombe Beurk) |
| 7 | `burst` | Zone, Cross, non statut (Séisme, Surf : une explosion **par case** touchée, jamais une boule centrée) |
| 8 | `ground-marker` | GroundTarget (Picots, Piège de Roc) : projectile qui retombe sur la case visée ; le marqueur persistant existant prend le relais |
| 9 | `projectile` | Single non statut, non contact, `range.max > 1` (Balle Graine compris) |
| 10 | `status-cloud` | statut sur Zone ou Cône (Poudre Dodo, Flash, Brouillard, Doux Parfum) : nuage teinté sur les cases |
| 11 | `ally-buff` | statut, relation `ally` : particules qui montent **sur l'allié**, pas sur le lanceur |
| 12 | `self-aura` | Self, ou statut relation `self` |
| 13 | `target-status` | statut Single, relation `enemy` |
| — | défaut | `impact` (repli si rien ne matche, signalé en dev par un avertissement console) |

Slash (arc devant soi) reste `impact`, un éclat par case touchée, image « entaille » pour les drapeaux
`slicing`. Table `moveEffectFormOverride` (view-core, à côté de la fonction) : **vide** au départ,
remplie à l'atelier pendant la recette ; pas de table recopiée à la main.

### B. Descripteur d'effet

`MoveEffectDescriptor { form, type }` côté view-core. Le choix de la **particule** PMDO et de la
**teinte** est un choix de rendu (fichiers d'assets et couleurs) : il se fait dans `render-babylon`, pas
dans view-core. `light` / `smoke` / `heat` réservés (HD-2D plus tard), **ignorés** par
ce lot. Résolution par repli : effet dédié (lot 2b, absent ici) → forme × type → forme → défaut (défaut
à définir, voir A).

Type → **une particule PMDO par type** (18 types, ex. braise pour Feu, bulle pour Eau, étincelle pour
Électrik). Les 18 choix se font à partir du listing réel de `RawAsset/Particle`, pas de mémoire, et se
valident à l'atelier. Impact : `Hit_Neutral` / `Hit_Super_Effective` selon l'efficacité. Rayon : une
entrée de `Beam/`.

Teintes : 12 types sur 18 n'ont pas de couleur dans `docs/design-system.md`. On prend la **palette
de types usuelle des jeux** pour les 18, avec un plancher de luminosité pour Normal, Combat et Vol
(sinon ils disparaissent sur herbe et sable), ajoutée à `render-babylon/src/constants.ts` et à
`docs/design-system.md`. Validée à l'œil en recette. Soins : jamais une teinte « dégât », vert/blanc.

### C. Assets — 2 fichiers ajoutés au build

- `scripts/extract-move-effects.ts` (`pnpm extract-move-effects`) : télécharge les PNG retenus depuis
  RawAsset vers `packages/app/public/assets/effects/source/` (**gitignoré**, ajouter la ligne au
  `.gitignore`).
- `scripts/pack-move-effects.ts` (`pnpm pack-move-effects`) : planche `move-effects.png` + index
  `move-effects.json` (frames, taille, mode None/Dir8), commités. Précédent : `pack-sprites.ts`.
- **Ajout** : la mention d'attribution et la note de licence (`LICENSE` : code MIT, sprites CC BY-NC 4.0)
  doivent couvrir les effets PMDO. Le plan ne le prévoyait pas.
- Chargement suivant `docs/babylon/babylon-asset-lifecycle.md` (une texture, NEAREST, dispose à la
  sortie de scène).

### D. Rendu (render-babylon)

- Module `packages/render-babylon/src/babylon-move-effects.ts`, sur le modèle de `babylon-aura-rings.ts`.
  Quads billboard texturés sur la planche, pool réutilisé, frames avancées par `combatClock.deltaMs`
  et gelées par `combatClock.isPaused` (même pattern que `directional-billboard.ts` l.544-549), donc
  Vitesse, pause et scrub de l'atelier gratuits.
- **Branchement** dans `combat-scene.ts` : création avec la scène, avance dans `advanceFrame`
  (l.738), `dispose()` dans la chaîne de la scène. Le plan ne le disait pas.
- **Port** : ajouter à `BoardView` (`packages/render-ports/src/ports.ts`, à côté de `playAttack` l.220)
  `playMoveEffect(descriptor, origin: Position, direction: Direction, targetTiles: readonly Position[]): AttackPlayback`.
  Le plan initial omettait `direction` (nécessaire au rayon et au souffle) et la liste des cases.
  Implémentation dans `battle-board-view.ts`, avec un repli `{ impact: Promise.resolve(), done: Promise.resolve() }`
  comme `playAttack`.
- Comportement par forme : `projectile` voyage case par case (vitesse en cases/s, en temps de combat),
  `beam` s'étire de l'origine au bout de la ligne (longueur du ciblage, direction), `breath` éventail sur
  les cases du cône, `burst` une explosion par case touchée, `sound-wave` anneaux concentriques,
  `impact` éclat sur chaque cible, `self-aura` particules qui montent autour du lanceur,
  `target-status` scintillement sur la cible.
- Profondeur : `renderingGroupId = 0` (règle renderer), occlusion normale par le terrain, biais de
  profondeur comme les sprites pour passer devant la cible.
- **Plafonds de lisibilité** : un effet ne dépasse jamais les cases réellement touchées ; rayon épais
  d'un tiers de case ; anneaux sonores en trait fin sans remplissage ; jamais par-dessus la barre de PV
  ni le chiffre de dégâts ; une attaque multi-cibles = un effet global + un petit éclat par cible.

### E. Orchestrateur (view-core, `battle-orchestrator.ts`)

- **Forme** : calculée sur `event.resolvedMoveId ?? event.moveId`, avec le ciblage effectif. Note :
  `attackAnimationName(moveId)` (l.3075) utilise encore `moveId` ; à aligner ou à laisser en connaissance
  de cause.
- **Source des cases : `MoveStarted` gagne `targetPosition` et `affectedTiles`** (champs ajoutés,
  calculés juste avant l'émission dans `BattleEngine.ts`, où `affectedTiles` existe déjà). Les
  événements ne passent **pas** sur le réseau (seules les actions sont envoyées, `docs/multiplayer.md`) :
  l'état haché et le protocole ne changent pas, **pas d'incrément de `NETWORK_VERSION`**. Changement
  du core → test unitaire d'abord (le `MoveStarted` d'un Blast porte la case d'impact interceptée).
- **Attente du projectile** : `await effect.impact` dans `stageAttack` ne suffit pas, il faut aussi :
  - gate sur le **premier `DamageDealt` de la boucle** pour Dash et Téléport (le coup part là) ;
  - gate dans **`playStrike`** pour le premier coup d'un multi-coups sur la même cible ;
  - **safety net** en temps de combat si le coup n'arrive jamais (`MoveMissed`, `DefenseActivated` d'un
    Abri/Protect, cible KO ou déplacée). Même patron que `playAttack` (`combat-scene.ts` l.1148-1151).
- Formes `projectile` et `beam` : attendre `effect.impact` ; les autres formes : impact au HitFrame,
  effet en parallèle.
- `attack.done` attend aussi `effect.done` (`endAttack` / `finishAttack`).
- Instantanée (`isInstantCombat`, `stageAttack` l.2556) : aucun effet ; le cue `Impact` reste.
- **Charge en deux tours** : au tour 1, `MoveCharging` joue un `self-aura` de charge teinté par le type
  (sinon le joueur croit l'attaque oubliée) ; le tour 2 joue l'effet normal.
- **Multi-coups** : un éclat d'impact **par coup** (c'est ce qui fait compter les coups) ; un
  projectile par coup pour les multi-coups à distance (Balle Graine). Coup raté : pas d'éclat.
- **Raté, Abri, semi-invulnérable** : le projectile vole jusqu'à la case et s'éteint sans éclat ; le
  filet de sécurité en temps de combat garantit que l'orchestrateur ne reste jamais bloqué.
- Nouveau cue `PresentationCueKind.Effect` avec phase début/fin (`attackerId`, `moveId`, `form`). Le
  `switch` de `move-workshop-timeline.ts` doit gérer le nouveau cas (sinon erreur de typecheck).

### F. Atelier

- Dégriser la piste « effects » (`FUTURE_TRACKS`, `move-workshop-timeline.ts` l.67-68) et la brancher
  sur le cue `Effect` : début, impact, fin.
- Fiche de l'attaque : afficher la forme résolue.
- Rien d'autre (decision-1143 : l'atelier joue les effets d'office).

## Étapes

Ordre d'exécution, d'un trait.

- [ ] 0 — Core : `targetPosition` + `affectedTiles` sur `MoveStarted`, test unitaire d'abord.
- [ ] 1 — `moveEffectForm` pure dans `packages/view-core/src/move-effect-form.ts`, table de surcharges
  vide, relation `self`/`ally`/`enemy` fournie par l'appelant. Tests unitaires après recette (menu).
- [ ] 2 — `scripts/extract-move-effects.ts` + ligne `.gitignore` pour `assets/effects/source/`.
  Listing réel de `RawAsset/Particle`, choix des 18 particules à valider.
- [ ] 3 — `scripts/pack-move-effects.ts` → `move-effects.png` + `move-effects.json`, commités.
- [ ] 4 — `CLAUDE.md` : réécrire la ligne « Commiter assets non libres de droits ». Mention PMDO dans
  `LICENSE` / crédits, alignée sur celle des sprites.
- [ ] 5 — Port `BoardView.playMoveEffect` (render-ports) + implémentation vide dans `battle-board-view.ts`.
- [ ] 6 — `babylon-move-effects.ts` : texture NEAREST, pool de quads, avance par `combatClock`, `dispose()`.
  Branchement dans `combat-scene.ts` (création, `advanceFrame`, dispose).
- [ ] 7 — Les treize formes en rendu Babylon, effet de charge du tour 1. Teintes des 18 types dans
  `constants.ts` et `docs/design-system.md`.
- [ ] 8 — Orchestrateur : `resolvedMoveId`, gating dans `stageAttack` / boucle `DamageDealt` / `playStrike`,
  safety net, cue `PresentationCueKind.Effect`, `attack.done` élargi.
- [ ] 9 — Atelier : piste Effet branchée, fiche de forme résolue.
- [ ] 10 — Docs : `docs/architecture.md` (arborescence, scripts, assets), `docs/design-system.md`
  (teintes), `docs/babylon/` si le cycle de vie change.
- [ ] 11 — Recette (6 scénarios ci-dessous). Puis le menu : tests unitaires `moveEffectForm`, e2e, lint.

## Critères de complétion

- Chacune des 512 attaques jouables reçoit une forme (aucune forme `undefined`), sans table recopiée.
- Flammèche à distance 3 : la cible n'encaisse qu'à l'arrivée du projectile, jamais au départ.
- Instantanée : aucun effet. Rapide : durée ÷ 2, pause et scrub de l'atelier fonctionnent.
- La piste Effet de l'atelier affiche début, impact et fin.
- `pnpm typecheck` vert, planche `move-effects.png` committée, source gitignorée, LICENSE mis à jour.
- Aucun changement de l'état du core ni du protocole réseau : seul `MoveStarted` gagne deux champs
  de présentation.

## Risques

- **Lisibilité** en iso avec 6 Pokémon : un effet trop gros masque la grille → tailles plafonnées,
  réglées à l'atelier.
- **Perf mobile** : pool de quads, une seule texture, pas de GlowLayer.
- **Déterminisme** : l'effet est **purement présentation**. Il ne doit appeler ni le RNG du core, ni muter
  l'état. La forme se calcule sur des données lues (move, ciblage effectif, événement). Un rejeu ou une
  reprise (plan 181) rejoue les effets sans changer l'état du combat.
- **Réseau** : les deux pairs reçoivent les mêmes événements, donc la même forme. Les cases cibles ne
  doivent pas venir de l'action locale (on n'a pas l'action distante côté `applyEvents`). Voir point 1.
- **Fog de guerre** (plan 176) : un effet coloré par type révèle le type d'une attaque ennemie. Vérifier
  que le type est déjà public au moment du coup (nom dans le journal), sinon l'effet fuit l'information.
- **Métronome masqué** (plan 144) : l'effet révèle le type et la forme du move tiré au hasard. Vérifier
  si l'identité est publique après résolution (`resolvedMoveId` est dans l'événement, donc partagé).
- **Classement imparfait** de certaines attaques → table de surcharges, remplie en recette.

## Hors périmètre

Effets dédiés par attaque (2b) · son (lot 3) · lumière, fumée, chaleur, bloom · effets de météo,
de terrain de champ, de statut persistant (brûlure qui fume…) · secousse caméra · indicateur de
recharge (Ultralaser).

## Recette prévue (scénarios)

1. Projectile : Flammèche à distance 3, la cible encaisse à l'arrivée.
2. Rayon et souffle : une attaque Line et une attaque Cône.
3. Zone, explosion et onde sonore : Séisme, Bombe Beurk, Mégaphone.
4. Contact : Charge puis un super efficace, éclat d'impact.
5. Statuts et cas à part : une attaque sur soi, une sur la cible, Poudre Dodo, Vol (deux tours).
6. Vitesse Rapide / Instantanée, et un combat IA vs IA pour la lisibilité d'ensemble.

## Dépendances

- **Avant** : plan 233 (clos le 2026-10-08) — cues, `combatClock`, atelier. Décisions 1137, 1138, 1143.
- **Débloque** : lot 2b (effets dédiés par attaque, sur la même résolution `dédié → forme × type → forme →
  défaut`), puis lot 3 (son, sur les mêmes cues).
- **Relu** par `plan-reviewer` et `game-designer` le 2026-10-08 (classement, lisibilité, cas oubliés
  intégrés). `doc-keeper` pour `docs/architecture.md` et `docs/design-system.md` à l'étape 10.
