# Plan 211 — Le placement à la main, en ligne

**Statut** : done (2026-09-15)
**Livré le** : 2026-09-15, les cinq lots d'un trait
**Ouvert le** : 2026-09-15, sur constat de l'humain en inventaire du backlog d'avant-release
**Cadré le** : 2026-09-15, avec l'humain
**Bloque la release ?** : **OUI** — arbitré par l'humain au cadrage. On ne publie pas un multijoueur
dont le placement à la main ne marche pas.
**Solde** : `backlog-placement-flow-sans-conscience-reseau`

## Pourquoi ce plan existe

Dans le salon en ligne, l'hôte peut décocher **« Placement auto »**. Rien ne l'en empêche. Et la
phase de placement n'a jamais appris que la partie pouvait être en ligne : elle ne connaît qu'une
seule situation, **tout le monde autour du même écran**.

Le joueur qui décoche déclenche donc ceci, sur **chaque** écran : le jeu réclame, en alternance, un
Pokémon de son équipe puis un Pokémon de l'équipe d'en face — **douze poses par écran**, les deux
équipes placées deux fois, aucune des deux machines ne sachant ce que l'autre a fait. Puis, juste
avant le premier tour, le détecteur du Lot B4 compare les deux états, ne les reconnaît pas, et arrête
tout sur **« les parties ne concordent plus »**.

Rien n'est corrompu — le garde-fou fait son travail. Mais la partie meurt avant le premier coup, sur
un message de désynchronisation que personne ne peut comprendre, après une phase de placement deux
fois trop longue.

🔴 **Et ça n'a jamais été testé.** C'est le vrai manque, relevé comme tel par l'humain :

> « Déjà, on a jamais testé ça, c'est un vrai manque. »

Aucun test ne couvre un placement en ligne entre deux vrais joueurs. Le seul qui décoche la case
(`e2e/tests/dom/online-combat-menu.spec.ts:47`) met une **IA** en face — et une IA se place toute
seule, donc le défaut ne peut pas y apparaître. Le placement auto étant coché par défaut, la recette
manuelle passe elle aussi toujours par le chemin qui marche.

## L'état des lieux, vérifié dans le code au cadrage

Neuf constats de lecture, dont aucun n'était écrit.

1. **La bascule est décochable en ligne.** `team-select-screen.ts:995` ne la grise que chez l'invité,
   ou chez l'hôte une fois qu'il s'est déclaré prêt. L'hôte non-prêt en dispose librement.
2. **L'option part au salon et est diffusée** telle quelle dans le message de démarrage
   (`team-select-screen.ts:340`). Aucune garde nulle part dans `packages/network`.
3. **Les places distantes sont rabattues sur `human`** — le commentaire de `enterNetworkBattle`
   (`team-select-screen.ts:345`) le dit explicitement. Vu du flux de placement, les deux camps sont
   donc des humains locaux indiscernables.
4. **Le flux de placement n'a aucun champ réseau.** `PlacementFlowOptions`
   (`packages/app/src/babylon/placement-flow.ts:76-105`) ne porte ni `localSeat`, ni pair distant, ni
   salon. `mountPlacement` ne lui en passe aucun. `enterPlacement()` (`:253`) ne saute un joueur que
   si son contrôleur est `Ai`.
5. **Le protocole ne transporte aucune pose.** `protocol.ts:150` ne porte qu'une **graine** de
   placement, faite pour le tirage **automatique**. Il n'existe aucun message pour dire « je viens de
   poser Florizarre ici ».
6. **Le core alterne un Pokémon à la fois**, en serpentin : `buildTurnQueue`
   (`packages/core/src/battle/PlacementPhase.ts:64`) empile un tour par joueur et par round, en
   inversant l'ordre aux rounds impairs.
7. **`PlacementMode` existe déjà et son paramètre est ignoré.** L'énumération porte `Alternating` et
   `Random` (`packages/core/src/enums/placement-mode.ts`), et le constructeur le reçoit sous le nom
   `_mode` (`PlacementPhase.ts:46`) sans jamais le lire. L'accroche de ce plan est donc **déjà
   posée** : il s'agit de la brancher, pas de l'inventer.
8. **L'écran montre aujourd'hui tous les camps.** `refreshSpawnZones` (`placement-flow.ts:172-190`)
   dessine les zones de départ de **toutes** les équipes, et met en évidence les cases **occupées**
   de chacune. En ligne et à placement caché, c'est une fuite d'information à refermer.
9. **Le détecteur de désync sauve la mise, et c'est lui qui rend le défaut non silencieux.**
   L'empreinte de lancement part à `actionIndex` 0, **après** le placement et avant la première
   action (§ Détection de désync de `docs/multiplayer.md`, et `online-determinism.spec.ts:218`).

## Les décisions du cadrage (2026-09-15)

Trois arbitrages de l'humain, posés en menu :

| Sujet | Tranché | Motif |
|---|---|---|
| Déroulé | **Tous en même temps** | Chacun pose ses six quand il veut ; on démarre quand tout le monde a fini. L'alternance coûterait 72 tours d'attente à douze joueurs, contre une durée constante en simultané |
| Visibilité | **Caché jusqu'au départ** | Chacun place à l'aveugle, tout se révèle au lancement. Personne ne peut adapter son placement à celui d'en face — la phase devient un pari, et le dernier à poser n'a plus l'avantage |
| Retardataire | **Chrono, puis pose auto** | 90 s pour toute la phase. À l'expiration, le client du retardataire pose lui-même ses Pokémon restants au hasard et diffuse. Personne n'est éjecté : une coupure réseau ne doit pas coûter la partie |
| Release | **Elle attend ce plan** | On ne publie pas le multijoueur avec ce trou |

Trois points de détail que je tranche ici, faute qu'ils changent quoi que ce soit au dessin
d'ensemble — à contredire au passage en revue si l'un déplaît :

- **Les zones de départ restent visibles**, toutes. C'est de la géographie de carte, lisible par tout
  le monde avant même le lancement ; la cacher n'ajouterait rien qu'une gêne. Ce qui se cache, ce
  sont les **Pokémon posés** et les **cases occupées** des autres camps.
- **Qui a fini est public.** « Joueur 2 : prêt » ne révèle aucune position et rend l'attente lisible.
  Sans ça, un joueur qui attend ne sait pas s'il attend quelqu'un ou si le jeu est planté. L'humain
  l'a confirmé au cadrage, en cours de rédaction de ce plan — « va falloir ajouter un récap des
  joueurs qui sont prêts ou pas du coup » — et c'est désormais une pièce nommée du Lot E3, pas une
  ligne d'état.
- **Annuler ne touche que ses propres poses.** `undoLastPlacement` est aujourd'hui global ; en
  simultané il doit être borné au joueur, sans quoi on défait la pose d'un autre.

## Lot E1 — Le core apprend à placer en même temps

**Tests d'abord** : c'est de la mécanique de `packages/core`, donc Vitest avant tout le reste.

- Ajouter `PlacementMode.Simultaneous`, et **lire** le mode : `_mode` cesse d'être ignoré.
- En simultané, `getNextToPlace()` et `turnQueue` ne gouvernent plus rien : `submitPlacement` accepte
  la pose de **n'importe quel** joueur non terminé, dans sa propre zone, sur une case libre. Les
  refus existants (mauvais propriétaire, Pokémon déjà posé, case occupée, hors zone) restent.
- `undoLastPlacement` / `canUndo` prennent le joueur et ne remontent que **sa** pile.
- `isComplete()` devient « tous les joueurs ont fini », sans notion de tour.

🔴 **Le point le plus important du lot, et le piège du plan** : `getPlacements()` doit rendre un
**ordre canonique** — par **index de place réseau** croissant (la `seat`, donc l'ordre des `PLAYER_IDS`
du setup), puis par ordre de pose à l'intérieur d'un camp — et **jamais** l'ordre d'arrivée.

La chaîne exacte, vérifiée en revue du draft : l'ordre d'insertion dans `this.placements`
(`PlacementPhase.ts:222`) fixe celui de `getPlacements()` (`:188`), qui fixe l'ordre d'itération de
`createBattleFromPlacements` (`BattleSetup.ts:196`), qui fixe l'ordre de construction des Pokémon
dans le moteur, qui fixe l'empreinte. Un maillon, du premier au dernier. L'empreinte de lancement est calculée sur l'état construit à partir de
cette liste ; deux machines qui reçoivent les mêmes poses dans un ordre différent produiraient deux
états différents, donc une désynchronisation immédiate. Le défaut qu'on répare est exactement de
cette famille : on ne le remplace pas par une version plus subtile de lui-même.

Le hot-seat local **ne change pas** : il reste en `Alternating`, sur le même code qu'aujourd'hui.

## Lot E2 — Le protocole transporte les poses

- Nouveau message : `{ type: "placement"; seat: number; placements: readonly NetworkPlacement[] }`,
  où une pose porte le Pokémon, la position et l'orientation.
- **Un seul message par joueur, envoyé quand il a fini** — pas une pose à la fois. Le placement étant
  caché, il n'y a rien à montrer aux autres en cours de route : le message par lot est plus simple,
  moins bavard, et ne crée aucun ordre d'arrivée à départager pose par pose. Le chrono s'y branche
  sans cas particulier : à l'expiration, le client pose le reste au hasard et envoie le même message.
- **Application dans l'ordre des places, jamais dans l'ordre de réception** — pendant du point rouge
  du Lot E1.
- **Une place ne pose qu'une fois** : un deuxième message pour la même place est ignoré. Il arrive
  après une reconnexion, et le rejouer dédoublerait les Pokémon.
- **`NETWORK_VERSION` 8 → 9.** Non négociable : un pair d'avant ne sait pas émettre ce message, et
  attendrait indéfiniment celui d'en face. La leçon écrite en tête du § Protocole de
  `docs/multiplayer.md` s'applique dans sa version la plus simple — ici, la forme d'un message change
  vraiment.
- Mettre à jour le § Protocole de `docs/multiplayer.md` **dans le même lot**, pas après : les deux
  derniers incréments y ont été consignés en retard, dont un rattrapé par la revue de code.
- Mettre à jour `docs/game-design.md` § 2b, qui ne décrit aujourd'hui que l'alternance en serpentin
  et le mode aléatoire. La divergence hot-seat / en ligne doit y être **nommée**, sinon la ligne 34
  (« chaque joueur voit tout le plateau, en permanence ») se lira comme couvrant aussi le placement
  en ligne, et le prochain lecteur prendra le caché pour un bug.

### Le caché est un caché d'écran, pas une garantie — tranché, et assumé

Relevé par la revue design du draft, et c'est le point juste de cette revue : le message de pose part
**dès qu'un joueur a fini**, pas à la révélation. Qui termine en 10 s a donc son placement complet
dans la mémoire du client d'en face pendant les 80 s qui suivent. Un client honnête ne l'affiche
qu'au lancement ; un client modifié a déjà tout, et la promesse « personne ne peut adapter son
placement à celui d'en face » est fausse pour lui.

**Tranché par l'humain le 2026-09-15 : on assume, comme le fog.** Même modèle de confiance que la
décision #863 — on joue entre gens qui se sont échangé un code, et quelqu'un d'assez motivé pour
patcher son client joue contre des amis qui peuvent arrêter de jouer avec lui.

🔴 **Mais ce n'est pas la même fuite que le fog, et il ne faut pas laisser les deux se confondre.**
Le fog laisse filer des PV exacts, un objet, un talent — des détails qui se révèlent de toute façon
au combat. Ici, c'est **tout le déploiement adverse**, et ça défait la prémisse entière de la phase.
Décision de même nature, ordre de grandeur différent : à écrire comme telle au § Fog de
`docs/multiplayer.md`, en connaissance de cause, plutôt qu'à découvrir plus tard.

L'option écartée, notée pour ne pas la re-chercher : envoyer une **empreinte** du placement en
finissant, et les positions en clair seulement quand tout le monde est prêt. Ça rendrait le caché
vrai même face à un client modifié, au prix d'un message de plus et d'un tour de protocole au Lot E2.
Écartée parce que le modèle de confiance du projet ne la réclame pas — à ressortir telle quelle le
jour où le jeu s'ouvrirait à des inconnus (compte, classement, mise en relation automatique).

## Lot E3 — L'écran de placement sait qu'il est en ligne

- `PlacementFlowOptions` reçoit la place locale. En ligne, le flux ne pilote **que** le camp local ;
  les autres camps ne sont plus des joueurs à faire jouer.
- **Masquer ce qui doit l'être** : les Pokémon posés par les autres et leurs cases occupées.
  `refreshSpawnZones` garde les zones, perd la mise en évidence des cases occupées adverses.
- 🔴 **Récapitulatif des joueurs prêts** — demandé par l'humain au cadrage, et ce n'est pas un détail
  d'affichage : en simultané, **on ne peut pas savoir où en est la phase sans lui**. Un joueur qui a
  fini de poser n'a plus rien à l'écran qui bouge ; sans ce récapitulatif il ne sait pas s'il attend
  quelqu'un, combien de monde, ni si le jeu est planté.

  Une ligne par camp, avec son état : **en train de placer** / **prêt**. Trois exigences :
  - **Lisible à douze camps** comme à deux — donc une liste compacte qui tient à l'écran sans
    défilement à 12 lignes, y compris en 568×320.
  - **Vivant** : un camp bascule à « prêt » au moment où son message de pose arrive, pas au
    lancement.
  - **Ne révèle rien du placement** : l'état, jamais une position ni un nombre de Pokémon posés. « Il
    en est à 4 sur 6 » dirait déjà quelque chose du rythme d'en face, et à douze camps ce serait une
    grille d'information gratuite.

  Il sert aussi au chrono : c'est là qu'on lit qui fait attendre tout le monde.

  Réemploi probable plutôt que création : la salle d'attente affiche déjà une liste de camps avec un
  état prêt / pas prêt (`RoomPanel`). À regarder d'abord — même besoin, même vocabulaire à l'écran, et
  le joueur vient littéralement de la voir deux écrans plus tôt.
- **Écran d'attente** quand j'ai fini et que les autres non — le récapitulatif ci-dessus en est le
  cœur — avec une sortie, « Quitter » existant déjà au placement.
- **Révélation au lancement** : les Pokémon des autres apparaissent d'un coup au passage au combat.
- **Chrono de 90 s**, visible par tous, une seule fenêtre pour toute la phase — même principe que le
  chrono de combat (local, auto-déclarant, aucun arbitre, § Chronomètre de `docs/multiplayer.md`), et
  la même raison de ne pas le rejouer à chaque étape : il serait gelable en boucle.

  **90 s fixe, quel que soit le format, et c'est vérifié** : la revue design du draft soupçonnait une
  lacune — « et les formats où l'on pose douze Pokémon ? ». Ils n'existent pas. `maxPokemonPerTeam`
  vaut `min(positions de la zone, ⌊12 / nombre de camps⌋)`
  (`packages/data/src/tiled/parse-spawns-layer.ts:199-201`), et les cinq formats sont 2, 3, 4, 6 et 12
  camps (`REQUIRED_TEAM_COUNTS`) : on pose donc **6, 4, 3, 2 ou 1** Pokémon. Le « 12p (1×12) » de
  `docs/game-design.md:31` désigne douze camps d'**un** Pokémon, pas un joueur qui en poserait douze.

  Le pire cas par joueur est donc **6 poses, au format à deux joueurs** — 15 s par pose, et c'est
  aussi le format où attendre l'autre coûte le moins. La charge par joueur **décroît** quand le
  nombre de joueurs croît : à douze camps, chacun pose un seul Pokémon. C'est exactement la propriété
  qu'on veut en simultané, et elle tient sans indexer le chrono sur le format.

  **Il court en continu et ne se suspend jamais** — ni pendant qu'on choisit un Pokémon, ni pendant
  qu'on vise une case, ni pendant qu'on oriente. C'est le sens de « une seule fenêtre » : le chrono
  de combat couvre de la même façon déplacement, sous-menu, visée, confirmation et orientation d'un
  seul tenant, précisément parce qu'un compteur qui repart à chaque étape se gèle en annulant en
  boucle. Question posée en revue du draft, tranchée ici pour qu'elle ne se repose pas à
  l'implémentation.
- **Passe multi-entrée mesurée** avant de faire tester : clavier, manette, tactile, responsive sur
  les cinq tailles. C'est un contrôle d'interface neuf, donc `.claude/rules/multi-input.md`
  s'applique en entier.

## Lot E4 — Ce qui peut mal tourner pendant le placement

Aucune de ces situations n'existait avant ce plan : la phase de placement n'a jamais été un moment où
le réseau vit.

- **Un pair se déconnecte pendant le placement** — le chien de garde et le seuil d'absence à N camps
  (décision #1028) sont écrits pour le combat. Vérifier ce qu'ils font ici, et le décider.
- **L'hôte tombe pendant le placement** — la migration d'hôte (Lot C5) a été écrite pour le combat.
  Même vérification.
- **Un joueur quitte pendant le placement** — « Quitter » existe déjà, et le salon est encore vivant.
- **La reprise** : rien n'est sauvegardé avant le combat (`battle-persistence`). À confirmer par la
  lecture, et à écrire si c'est vrai — c'est ce qui décide si une reconnexion en plein placement
  repart de zéro.
- **« Recommencer » est déjà gardé en ligne** (`combat-screen.ts:1858`) : rien à faire, à vérifier
  que la garde tient toujours avec le nouveau flux.

## Lot E5 — Les tests qui manquaient

C'est le lot qui solde le manque d'origine, et il ne se coupe pas.

- **e2e à deux vrais pairs, placement à la main** : les deux posent, chacun ne voit que ses Pokémon,
  la partie démarre, et l'empreinte de lancement **concorde**. C'est le test qui n'existait pas.
- **e2e du chrono** : un pair ne pose rien, la fenêtre expire, ses Pokémon sont posés au hasard, la
  partie démarre quand même.
- **e2e du chrono, cas hybride** — relevé par la revue design : un pair pose **quatre** Pokémon puis
  laisse expirer. Les deux derniers tombent au hasard dans les cases qui restent, et la formation
  obtenue peut être **moins cohérente** qu'un tirage entièrement aléatoire : le hasard casse une
  intention au lieu de n'en avoir aucune à casser (deux Pokémon lâchés en avant d'une ligne pensée en
  retrait). Ce n'est pas un défaut à corriger — le placement tout-aléatoire est déjà le mode par
  défaut du jeu, et l'orientation y est calculée vers le centre, jamais tirée — mais c'est le cas à
  regarder en recette plutôt qu'à découvrir chez un joueur.
- **e2e du masquage** : pendant le placement, aucune position adverse n'est lisible à l'écran.
- **e2e du récapitulatif** : un camp passe de « en train de placer » à « prêt » quand son message de
  pose arrive, et l'autre pair le voit sans avoir démarré le combat.
- **Cahier de recette** mis à jour (graphe, entités `recette`). ⚠️ Numéroter à partir de **§11.11** :
  §11.9 et §11.10 sont pris, et §11.3 porte déjà une collision connue
  (`backlog-collision-numerotation-cahier-recette-11-3`) qu'on ne veut pas aggraver.

## Ordre d'exécution

`E1 → E2 → E3 → E4 → E5`

E1 avant E2 : le protocole transporte ce que le core sait accepter. E2 avant E3 : l'écran s'appuie
sur les messages. E4 après E3 : les pannes se constatent sur le flux fini. E5 en dernier, mais les
tests unitaires de E1 s'écrivent **avant** son code — « tests first » vaut pour la mécanique du core,
pas pour l'e2e.

## Ce que l'exécution a trouvé, et que le cadrage n'avait pas vu

Cinq défauts nés du plan lui-même, tous attrapés avant la recette humaine — trois par les tests,
deux par la revue de code.

1. 🔴 **Le tri canonique a cassé l'annulation — y compris en hot-seat local.** Le flux défaisait
   « la dernière pose » en prenant `getPlacements().at(-1)`. Une fois la liste triée par camp, ce
   dernier élément appartient toujours au DERNIER camp, plus à celui qui vient de poser : en
   serpentin, annuler aurait retiré le Pokemon de l'adversaire. Aucun test existant ne l'attrapait —
   les tests du core vérifient la classe, pas le flux. Corrigé par `getLastPlacement(playerId?)`, qui
   rend la dernière pose **chronologique**, avec ses propres cas de test. La leçon vaut d'être
   gardée : un tri qui change une liste change tout ce qui lisait son dernier élément.

2. 🔴 **Le joueur le plus lent restait bloqué pour toujours — trouvé par l'e2e §11.14.** Le départ du
   combat n'était déclenché qu'à la RÉCEPTION d'un placement distant. Celui qui finit en dernier a
   déjà tout reçu : plus aucun message ne vient, donc rien ne démarre. Invisible quand les deux
   finissent presque ensemble, ce qui est exactement pourquoi il fallait un scénario où l'un finit
   franchement après l'autre.

3. 🔴 **Un pair qui part pendant le placement laissait les autres attendre indéfiniment.** Le chien de
   garde du salon tourne pourtant bien à ce moment (le salon est verrouillé dès le lancement, et la
   migration d'hôte fonctionne), mais **personne ne l'écoutait** : `wireOnlineBattle` ne se branche
   qu'une fois le combat monté. Le chrono ne sauve pas ce cas — il ne pose que ses propres Pokemon,
   jamais ceux d'un absent. Le Lot E4 branche l'écoute et le récapitulatif l'annonce.

   Et **on ne pose pas les Pokemon de l'absent à sa place**, contrairement à ce qu'on pourrait croire
   plus simple : le tirage automatique consomme le générateur pseudo-aléatoire partagé, dont l'état
   dépend de ce que chaque machine a déjà tiré — or un pair dont le chrono a expiré en a consommé, et
   un autre non. Deux survivants poseraient l'absent à des cases différentes : le défaut même que ce
   plan répare, rejoué par sa propre réparation.

4. 🔴 **Une place tenue par l'IA bloquait la partie pour toujours** — trouvé en revue de code, et
   c'est le défaut le plus grave du lot. `activePlayer()` ne rend que le camp local en ligne, donc la
   branche IA du flux y est inatteignable ; une IA n'émet aucun message de placement, donc son camp
   n'était jamais compté fini ; et le chrono ne sauve rien puisqu'il ne pose que le camp local.

   Ce n'est pas un cas tordu : c'est « j'ouvre un salon, personne ne vient, je passe la place en
   IA », le montage même d'un spec existant — qui restait vert **en s'arrêtant à l'écran de
   placement**, donc en masquant le blocage. Corrigé en posant les camps IA **au démarrage**, avant
   toute pose humaine, avec un générateur dérivé par place. Les deux conditions comptent : le
   générateur de la phase avance à chaque tirage (son état dépend de ce que cette machine a déjà
   tiré), et poser au milieu du placement laisserait les cases libres dépendre de qui a déjà joué.
   Gardé par §11.16, vérifié rouge sans le correctif.

5. 🔴 **Le tri canonique a failli casser le hot-seat local et les captures d'intro.** Appliqué à tous
   les modes, il changeait l'ordre de consommation du générateur de création (genre, nature), donc
   les Pokemon tirés à graine égale dans une partie locale — et une capture d'intro censée être
   reproductible ne l'aurait plus été. Rien ne l'assertait, les suites restaient vertes. Le tri est
   désormais **restreint au mode simultané**, ce qui rend vraie la promesse « le hot-seat ne change
   pas » faite plus haut, et un test garde l'ordre serpentin. Hors simultané le tri n'a de toute
   façon aucune utilité : une seule machine en hot-seat, et la même graine des deux côtés en
   placement automatique.

## La passe multi-entrée, mesurée

Chrome-devtools sur Chromium, panneau peuplé de **douze camps** — le pire cas — aux cinq viewports de
référence. Mesuré, pas supposé, comme `.claude/rules/multi-input.md` l'exige.

| Viewport | Colonnes | Liste défile ? | Débordement | Hauteur de rangée |
|---|---|---|---|---|
| 568 × 320 | 3 | non | non | 24 px |
| 667 × 375 | 3 | non | non | 24 px |
| 1024 × 768 | 2 | non | non | 24 px |
| 1920 × 1080 | 2 | non | non | 24 px |
| 2560 × 1440 | 2 | non | non | 24 px |

🔴 **Et la mesure a trouvé un défaut, exactement ce pour quoi elle existe.** En 568 × 320, douze
camps sur deux colonnes font six rangées (144 px) pour une liste plafonnée à 40 vh (128 px) : **elle
défilait**, alors que ce plan promet qu'elle tient à l'écran. Corrigé par une règle sous
`height < 500px` — colonnes minimales à 118 px, donc **trois** colonnes et quatre rangées (96 px),
plafond relevé à 50 vh. Re-mesuré : plus de défilement, aucune rangée tronquée.

Le panneau ne porte **aucun contrôle interactif** — c'est une liste en lecture seule — donc les axes
clavier et manette sont sans objet ici : rien à atteindre, rien à activer. La sortie pendant
l'attente reste « Quitter » du menu de placement, déjà couvert par le plan 189.

## Ce que la revue du draft a vérifié, et qui n'est donc plus à chercher

Passe de `plan-reviewer` sur le draft, le 2026-09-15. Les dix affirmations de lecture de la section
« état des lieux » ont été recontrôlées une par une, avec leurs numéros de ligne : **toutes exactes**.
Trois endroits du code qu'on pouvait craindre atteints par le passage au simultané ont été vérifiés
et ne le sont **pas** :

- **Les captures d'intro** (`intro.capture.ts`) passent par le placement **automatique** — chemin
  inchangé par ce plan.
- **Le studio sandbox** construit sa phase de placement en mode `Random` — inchangé lui aussi.
- **La sauvegarde de reprise** ne retient rien avant le lancement du combat, ce que le Lot E4 devait
  confirmer par la lecture : c'est confirmé, une reconnexion en plein placement repart donc de zéro.

Aucune autre source de divergence entre deux machines que l'ordre des poses n'a été trouvée.

## Ce que ce plan n'est pas

- **Pas le `rematch`.** « Recommencer » reste gardé en ligne, comme aujourd'hui.
- **Pas une modification du placement automatique.** Le chemin par graine partagée marche, il est le
  défaut, il ne bouge pas.
- **Pas une modification du hot-seat local.** L'alternance en serpentin y reste la règle : sur un
  seul écran, le placement simultané n'a aucun sens, et le caché encore moins.
