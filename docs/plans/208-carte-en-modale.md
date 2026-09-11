# Plan 208 — La carte en modale, et le bandeau de partie

**Statut** : ready
**Session** : 5 de `agenda-2026-09-10-file-de-sessions-dediees`
**Dépend de** : plan 207, étape 6 (le contexte `modal` du système d'entrée)

## Ce que le cadrage a établi

Cadré avec l'humain le 2026-09-10. Sa demande, dans ses mots : « ça serait compliqué de passer
l'écran de sélection de la carte en modale, afin de pouvoir changer de carte depuis cet écran ?
(idem en solo) », puis « du coup en solo, peut-être afficher le bandeau aussi (avec le bouton et la
carte choisie) », puis l'idée d'un bouton pour créer une partie en ligne à la place du code.

Et une consigne explicite : **« faut corriger tout ce qui tourne autour »**. Ce plan n'est donc pas
« poser une modale » — c'est retirer une route du graphe de navigation et solder tout ce qui y était
accroché. C'est là qu'est le travail, pas dans la modale.

## Pourquoi c'est bon marché côté rendu

`createMapPreviewStage(container)` (`map-preview-stage.ts:15`) accepte **n'importe quel conteneur** :
il y crée son `<canvas>` et son voile de chargement. Il entre donc dans `Modal.getBody()` sans
adaptation. `Modal` existe (`packages/ui-dom/src/Modal.ts`). L'écran ne fait que **150 lignes**.

Restent deux points de vigilance de rendu : le redimensionnement du canvas Babylon dans un
`<dialog>`, et la **libération de la scène à la fermeture** (`scene?.dispose()` — le voile
anti-course par jeton est déjà géré par `map-preview-stage.ts:31-33`).

## Le gain caché

Aujourd'hui, changer de carte en solo passe par « Retour »
(`team-select-screen.ts:134` → `navigate("map-select")`), ce qui **démonte l'écran de sélection
d'équipe**. La modale préserve la composition en cours. C'est le vrai motif, au-delà du confort.

## Étape 1 — Le pourtour : ce qui est accroché à la route `map-select`

L'inventaire, fait au cadrage. **Rien ici n'est optionnel.**

🔴 **Quatre entrées ajoutées après la revue du plan** (plan-reviewer, 2026-09-10) : mon inventaire de
cadrage avait oublié **l'enregistrement de la route lui-même** et **les trois seuls appels qui y
mènent**. C'est précisément ce qui aurait fait dire « c'est fait » avec la route toujours vivante.
Elles sont marquées ⬅ dans le tableau.

| Où | Ce qui change |
|---|---|
| `babylon-boot.ts:155` ⬅ | l'enregistrement `"map-select": () => createMapSelectScreen(navigate)` disparaît du gestionnaire d'écrans |
| `babylon-boot.ts:54` ⬅ | l'import de `createMapSelectScreen` |
| `babylon-boot.ts:29` ⬅ | l'import de `./styles/map-select.css` |
| `battle-mode-screen.ts:23` ⬅ | « Jeu en solo » : `navigate("map-select")` → plus de navigation, on va droit à `team-select` |
| `lobby-screen.ts:62` ⬅ | l'hôte qui crée : `navigate("map-select", { network })` → droit à `team-select`, l'intention d'hôte transmise directement |
| `team-select-screen.ts:134` ⬅ | le retour en solo : `navigate("map-select")` → ouvre la modale au lieu de démonter l'écran (c'est le **gain caché** ci-dessus) |
| `app/screens.ts:14` | `"map-select"` quitte l'union des écrans |
| `app/screens.ts:118` | son type de charge (`{ network?: HostIntent } \| undefined`) disparaît |
| `app/screens.ts:154-161` | **4 entrées** du graphe de transitions à recâbler : `battle-mode`, `lobby`, `map-select` (supprimée), `team-select` |
| `app/screen-persistence.ts:42` | la carte est dans la liste des écrans repris à la reprise de session — une session reprise ne doit plus y atterrir |
| `app/screen-persistence.ts:14` | le commentaire qui cite `map-select` depuis le plan 199 |
| `analytics/telemetry.ts:35` | `MapSelect: "map-select"` — voir étape 2, **contrat de télémétrie** |
| `map-select-screen.ts` | l'écran devient un composant de modale |
| `styles/.../map-select.css` | les classes `ms-*` suivent |
| `e2e/pages/responsive.ts` | le tour responsive des écrans |
| `e2e/tests/dom/platform.spec.ts` | idem |
| `scripts/build-release-assets.ts` | référence `map-select` (captures de release) |
| `app/screen-manager.test.ts`, `app/screen-persistence.test.ts` | tests unitaires qui nomment la route |

**Historique du navigateur** : le plan 205 vient de brancher `popstate` sur le graphe de
navigation. Un écran de moins, c'est un cran d'historique de moins — et le geste de retour du
téléphone doit **fermer la modale** avant de remonter d'écran, pas sauter par-dessus.

**Le tour des écrans du gate** : `/ci-gate fast` fait le tour des 10 écrans. Il passe à 9, ou la
carte s'y visite en ouvrant la modale. À trancher en implémentant, mais **le compte écrit dans le
gate doit changer avec le code** — sinon le gate valide un écran qui n'existe plus, en silence.

## 🔴 Étape 2 — La télémétrie : ne pas trouer le funnel

Le funnel mesuré est `game-loaded → main-menu → battle-mode → map-select → team-select →
battle-start → battle-end` (plan 114, et le Worker du plan 196). Supprimer `map-select` **trouve un
trou au milieu d'une série historique**.

Deux options, à trancher avant de coder :

1. **Garder le compteur**, compté à l'**ouverture de la modale**. La série reste continue, mais elle
   change de sens : ce n'était pas un passage obligé, ça devient un geste volontaire — donc le
   volume s'effondre sans que rien soit cassé, ce qui est exactement le genre de faux signal qu'on
   passe six mois à mal lire.
2. **Retirer le compteur** et acter la coupure, en la datant dans le graphe pour que la lecture
   future des séries sache pourquoi la marche est là.

Recommandation : **option 2**, plus honnête. Un passage obligé et un geste optionnel ne sont pas la
même mesure, et prétendre le contraire coûte plus cher que la coupure.

🔴 **Décision requise de l'humain avant de démarrer le plan.** C'est une coupure dans une série
historique : elle ne se rattrape pas après coup.

## Étape 3 — Quelle carte par défaut

Conséquence directe : `battle-mode → team-select` en solo, `lobby → team-select` pour l'hôte. Plus
personne ne traverse un écran de choix de carte, donc **une carte doit être choisie d'office** avant
d'arriver.

🔴 **Décision requise de l'humain** : `MAPS_REGISTRY[0]` (la première, repli évident) ou **la
dernière carte jouée**, lue dans les préférences persistées ? Le mécanisme existe déjà — « Placement
auto » et « Prévisualisation dégâts » y vivent depuis le plan 198.

## Étape 4 — Le bandeau de partie, dans les deux modes

L'encart de salon (`ui/team-select/RoomPanel.ts`, `.ts-room-panel`) n'existe qu'en ligne. Il devient
un **bandeau de partie** présent en solo aussi.

| | En ligne | En solo |
|---|---|---|
| Bloc gauche | le code + « Copier » | **« Créer une partie en ligne »** (étape 5) |
| Bloc droit | Carte, Format, options, en lecture seule | Carte + **« Changer de carte »** (ouvre la modale) |

Le nom du fichier et des classes (`RoomPanel`, `ts-room-*`) ne décrit plus ce qu'ils font — à
renommer, pas à laisser mentir.

Occasion à saisir au passage : l'humain a cru le sélecteur de format **disparu** de la salle
d'attente. Il est retiré volontairement en ligne (décision #896), et l'encart le rappelle déjà en
lecture seule — mais visiblement pas assez fort pour qu'on le voie. Le bandeau refait est l'endroit
où le dire clairement.

## Étape 5 — « Créer une partie en ligne » depuis le solo

Idée de l'humain : « je me demande si y'a pas un mode où en solo, à la place du code, on propose pas
un bouton pour créer une partie multi (genre il s'est trompé), vu qu'on a le bandeau ».

🔴 **Correction d'une erreur d'analyse du cadrage.** J'ai d'abord annoncé que « la composition doit
traverser la création du salon », donc que c'était coûteux. L'humain a répondu « mais on est déjà sur
le salon, je ne comprends pas trop la difficulté » — **il avait raison**. La salle d'attente **est**
l'écran de sélection d'équipe (décision #897) : la composition est déjà dans `slots`, sur place.
**Il n'y a aucune navigation, donc rien à faire traverser.**

Le travail réel, en trois points :

1. Forcer le format à **2 camps** s'il ne l'est pas déjà (le réseau n'accepte que deux camps, et
   c'est structurel : le garde-fou d'index suppose un canal fiable et ordonné, vrai **par
   connexion**, donc exact à deux seulement — voir `ONLINE_TEAM_COUNTS` dans `lobby-screen.ts`).
2. Garder mon camp, **libérer l'autre** — il devient « ⏳ Place libre » (`room.seatOpen`).
3. `createAsHost(2)` (`team-select-screen.ts:855`, existe déjà) puis re-rendre sur place.

**Confirmation demandée seulement quand la bascule détruit quelque chose** : un format à plus de deux
camps, ou une équipe déjà composée sur un camp qui va être libéré. En 1v1 contre l'IA, ça ne coûte
que l'équipe de l'IA — on bascule sans rien demander. Arbitré ainsi avec l'humain.

## Étape 6 — L'option « Aléatoire », résolue au lancement

Une entrée « 🎲 Aléatoire » dans la liste des cartes, **résolue seulement au lancement de la partie**
— pas à la sélection. Donc personne, hôte compris, ne sait sur quoi il va tomber pendant qu'il
compose son équipe.

Rappelé par l'humain au cadrage comme un retour de son frère — mais l'idée **était déjà au backlog
depuis le 2026-09-03** (`backlog-carte-aléatoire-option-de-sélection-2026-09-03-idée-du-f`), déjà de
lui. L'entrée de backlog porte deux choses que le cadrage n'avait pas retrouvées :

- **Le motif que le multijoueur ajoute** : « Aléatoire » évite la **négociation de carte** entre deux
  joueurs. Un système de vote avait été évoqué puis écarté au Lot B1 (« on verra plus tard ») ; le
  tirage est la réponse bon marché au même problème.
- **La contrainte déjà écrite** : « le tirage doit venir de l'hôte avec le reste du setup, **jamais
  tiré deux fois** ». C'est exactement la conclusion à laquelle le cadrage est arrivé par le code
  ci-dessous — deux chemins, même réponse.

### Ce que ça touche

- **Le bandeau** affiche « Aléatoire », pas un nom de carte.
- **L'aperçu Babylon** n'a rien à montrer. Un panneau neutre (le dé, un libellé), pas un canvas vide
  — le voile de chargement de `map-preview-stage.ts:20-28` existe précisément parce qu'« un cadre
  vide donne l'impression que c'est cassé » (retour humain 2026-08-06).
- **La télémétrie** doit compter la carte **tirée**, pas « aléatoire », sinon la répartition des
  cartes jouées devient inexploitable.

### 🔴 En ligne : le protocole n'a presque rien à apprendre

Bonne nouvelle, vérifiée : la carte voyage déjà jusqu'à l'invité en **`start.options.mapId`**, lu par
`enterNetworkBattle` (`team-select-screen.ts:242`, `mapUrlFromId(start.options.mapId)`). L'hôte tire
au moment du « Lancer » et met l'identifiant **résolu** dans le message de lancement : l'invité reçoit
une carte concrète, et **le message de lancement ne change pas**. Les deux pairs ont la même carte
sans un octet de protocole en plus, et sans tirage à répliquer.

Ce qui change, en revanche : **les options du salon affichées avant le lancement**. L'invité voit
« Carte » dans son bandeau ; si l'hôte a choisi « Aléatoire », l'invité doit lire « Aléatoire »
jusqu'au lancement. C'est une valeur nouvelle dans un ensemble que les deux pairs doivent interpréter
pareil → **question `NETWORK_VERSION` à trancher en implémentant**, et le seul vrai coût réseau de
l'étape.

Le repli existe déjà si on se trompe : un identifiant de carte inconnu du pair donne un refus lisible
(`VersionIncompatible`) au lieu d'un chargement d'URL construite au hasard.

### Le piège de capacité, vérifié

`maxPokemonPerTeam` est **déduit de la carte** (`min(positions de spawn, 12 / camps)`). Une carte
tirée au lancement pourrait donc, en principe, accepter **moins** de Pokemon que l'équipe déjà
composée.

Mesuré sur les 9 cartes avec le vrai parseur : **en 1v1, c'est 6 partout** (les zones font 6 ou 9
tuiles, le plafond de jeu vaut `12 / 2 = 6`, donc le plafond gagne toujours). **Aucun risque au seul
format du réseau.**

⚠️ Aux autres formats (solo uniquement), ce n'est **pas vérifié** carte par carte — mon calcul rapide
au cadrage a donné des écarts que le vrai parseur n'a pas confirmés, donc il ne faut pas s'y fier.
`simple-arena` donne `3J × 4, 4J × 3, 6J × 2, 12J × 1`. **À mesurer avec le vrai chargeur avant
d'offrir « Aléatoire » sur les formats à plus de deux camps** — et si un écart existe, la bonne
réponse est de plafonner le tirage aux cartes qui tiennent le format courant, **jamais de tronquer
une équipe déjà composée** : le joueur perdrait un choix fait en toute bonne foi.

Confirmé par game-designer, qui ajoute la règle de déploiement : **« Aléatoire » reste une entrée
volontaire à côté des neuf cartes nommées**, jamais un remplacement du choix explicite. Ce qu'il
retire, c'est la lecture de carte avant composition — un axe de préparation, pas la profondeur du
combat (position, hauteur, orientation restent entières). C'est acceptable **parce que** c'est opt-in.

### ⚠️ Point de vigilance neuf : la symétrie des zones de spawn

Relevé par game-designer, et non vérifié. Les neuf cartes ne sont pas neuf habillages d'un même
terrain : lave létale au Volcan Actif, eau profonde et chutes mortelles à l'Archipel des Pontons,
dénivelé pyramidal et poussée dans le vide sur Le Mur, glace glissante en Toundra, piliers qui
coupent la ligne de vue aux Dunes et Ruines. Croisé avec le modificateur de terrain (+15 % si le type
du move correspond), le blocage de la mêlée à `|heightDiff| ≥ 2` et le KO létal sur `lava` /
`deep_water`, la carte change réellement la valeur d'une équipe.

D'où la question : **une carte avantage-t-elle structurellement un camp par la géométrie de ses
zones de spawn ?** En solo la carte est un choix assumé, donc c'est sans gravité. **En ligne, un
déséquilibre de spawn devient un déséquilibre de match imposé aux deux joueurs sans qu'aucun ne
l'ait choisi.** À vérifier sur les couches `spawns_1v1` des neuf cartes avant d'ouvrir « Aléatoire »
en ligne.

## Étape 7 — Le bouton « Retour » de la carte

Il disparaît, et l'humain l'avait repéré comme une anomalie avant même la modale : dans
`map-select-screen.ts:96-97`, il est collé **au bas du panneau de liste de gauche**
(`aside.append(title, list, back)`). Partout ailleurs le retour est soit à la fin d'une pile centrée
(lobby, mode de combat, crédits), soit dans l'en-tête (sélection d'équipe). C'est le **seul** de sa
sorte dans le projet.

L'en-tête de `Modal` porte déjà sa croix de fermeture : le bouton s'en va sans rien laisser pendre.

## Recette

Passe multi-entrée **mesurée** avant de déranger l'humain (`.claude/rules/multi-input.md`).

- **Manette** : la modale de carte atteinte et refermable (B). C'est le risque nº 1 du plan — il
  dépend du contexte `modal` posé au plan 207. **Fail bloquant** si la modale est injoignable au pad.
- **Clavier** : ↑/↓ dans la liste des cartes **dans** la modale, Entrée confirme, Échap ferme.
- **Tactile** : les lignes de la liste au plancher de 30 px, la croix de fermeture aussi.
- **Responsive** : la modale à 568×320 — c'est une liste **plus** un aperçu Babylon, le cas le plus
  serré du projet. Mesurer, pas supposer.
- **Geste de retour du téléphone** : il ferme la modale, il ne quitte pas l'écran (plan 205).

Scénarios pour l'humain : le tirage aléatoire (carte inconnue jusqu'au lancement, et l'invité qui
voit bien la même que l'hôte), changer de carte en solo **sans perdre sa composition** (le motif du
plan), changer de carte en tant qu'hôte et vérifier que l'invité voit le changement, et la bascule
solo → en ligne avec et sans destruction.
