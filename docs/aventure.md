# Mode Aventure : base de connaissances

**Statut** : cadrage, phase de réflexion. Aucun plan, aucune ligne de code. Dernière mise à jour : 2026-11-12.

Ce document rassemble tout ce qui a été dit, décidé, refusé et cherché sur le solo. Le détail et l'historique de
chaque point vivent dans le graphe de mémoire (`node scripts/memory/query.mjs --open <nom>`) ; ce fichier est le
point d'entrée lisible. Toute nouvelle décision ou idée va d'abord au graphe, puis se reporte ici.

**Comment lire** : trois niveaux, à ne jamais confondre (`feedback-ponderer-idees-vs-decisions`).

- **Arrêté** : l'humain l'a tranché nettement.
- **Idée** : ce qu'il aime ou imagine, sans décision (« je sais pas », « ça peut être sympa »).
- **Ouvert** : question posée, à discuter.

## Vocabulaire

- **Carte du monde** : celle où l'on se déplace avant d'entrer en combat (façon FFTA).
- **Carte de combat** : la grille tactique, les `.tmj`. Ne jamais dire « carte » tout court.

## Le cadre

Le jeu se scinde en deux modes qui partagent le moteur de combat mais pas leurs règles
(`idee-deux-modes-combat-libre-et-aventure`).

- **Mode Combat** : le jeu actuel. Parité au niveau 50 aujourd'hui, mais pas figé : Little Cup, tous au niveau 100
  et d'autres formats restent possibles (`decision-1213`).
- **Mode Aventure** : une campagne avec ses propres règles, niveaux compris. Le menu ne se réorganisera qu'une fois
  l'Aventure là.

## Arrêté

| Sujet | Ce qui est arrêté | Graphe |
|---|---|---|
| Sauvegarde | Campagne persistante. Export et import obligatoires ; sauvegarde en ligne (cloud) non prioritaire | `decision-1208` |
| Défaite | Retour au dernier Centre Pokémon (la pénalité reste ouverte) | `decision-1209` |
| Départ | Canon : le joueur commence avec son seul starter | `decision-1210` |
| Niveaux | Niveaux classiques avec expérience | `decision-1211` |
| Badges | Comme le canon : ils font obéir les Pokémon de haut niveau ; ils ouvrent aussi les routes | `decision-1212` |
| Dresseur K.O. | Le dresseur sur la grille est vulnérable ; K.O., il est hors jeu pendant une durée X puis revient ; son K.O. ne fait pas perdre le combat | `decision-1214` |
| Capture | Le dresseur lance la Poké Ball en combat. Il est sur la grille pour ça : lancer les balls et soigner | `decision-1215` |
| Dresseur dès le début | Le dresseur sur la grille fait partie de la première version jouable | `decision-1216` |
| Carte du monde | Une carte plate 2D avec des étapes cliquables, pas une scène iso. À terme, toutes les régions | `decision-1217` |
| Assets | Zéro scrupule : cartes officielles reprises telles quelles, assets de fan games repris, fan game non affilié affiché. Règle du dépôt inchangée : seul le paquet empaqueté est commité | `decision-1222` |
| Argent | Argent gagné sur les dresseurs, Boutiques Pokémon en ville | `decision-1218` |
| Équipe | 6 au maximum, un PC pour le reste, combats en 6 contre 6 par défaut | `decision-1219` |
| Sauvages | Plusieurs sauvages par combat (l'équilibrage reste à discuter) | `decision-1220` |
| Persistance | PV et K.O. restent d'un combat à l'autre jusqu'au soin | `decision-1221` |
| Entraînement | Seulement les SP (façon Pokémon Champions), pas d'IV ni d'EV, pas d'élevage ni d'œufs ; les SP doivent être faciles à régler | `decision-1223` |
| Mécanique extra | Seule la Méga-Évolution (malgré le manque d'assets) | `decision-1224` |
| Livraison | Dans `main`, lot par lot, derrière un verrou ; menu principal revu (Aventure ou Stade de Combat), bouton Aventure verrouillé « Bientôt », ouvert par `?aventure=1` (GitHub Pages, pas itch.io) | `decision-1227`, `decision-1229` à `decision-1231` |
| Grottes | Tracé en pointillés découpé en étapes, une salle par étape ; événements posés sur une étape (Team Rocket au Mont Sélénite) | `decision-1232` |
| Portraits | Sprites de Pokémon Showdown (pixel art, toutes régions), artistes crédités | `decision-1233` |
| Obstacles des CS | Verrous de carte ouverts par une étape de la trame, sans capacité ni Pokémon requis, valables pour toutes les régions | `decision-1234` |
| Entraîner le générateur | Non : jamais documenté sur carte AMD | `decision-1235` |
| Sprites des dresseurs | SpriteKiln depuis l'artwork officiel, 9 animations dont 4 au caractère du personnage ; pas pour les Pokémon (Méga-Dracaufeu Y jugé « pas ouf ») | `decision-1236` |
| Ouverture publique | Quand Kanto se joue de bout en bout, en accès anticipé ; ne jamais casser les sauvegardes quand une région sort | `decision-1228` |

## Découpage en lots

Chaque lot a son plan dans `docs/plans/` au moment de le lancer ; l'ordre peut bouger.

0. **Prototype de carte**, hors jeu (en cours) : Kanto juste, rendu et données fixés.
1. **Menu et verrou** (fait, plan 251) : menu principal Aventure / Stade de Combat, Aventure verrouillé « Bientôt »,
   ouvert par `?aventure=1`.
2. **Carte dans le jeu** (cachée) : écran de carte de Kanto, déplacement au clic, menu d'actions au clic droit ;
   données de carte dans `packages/data`, images empaquetées.
3. **Boucle de base** : rencontre sauvage sur une route, combat existant, retour à la carte ; sauvegarde versionnée
   avec export / import et migrations.
4. **Dresseur sur la grille** : soins et capture par Poké Ball.
5. **Vie de la campagne** : Centres Pokémon et défaite, persistance des PV et K.O., argent et boutiques.
6. **Progression de Kanto** : dresseurs de route, arènes et badges, routes bloquées puis débloquées.
7. **Ouverture publique** de Kanto en accès anticipé ; puis Johto et les autres régions, comme des données en plus.

Déjà arrêté le 2026-09-16 : régions reprises telles quelles (Kanto d'abord), progression par badges sans histoire
à écrire, trajet qui prend du temps (on ne se téléporte pas), rencontres visibles sur la carte avant d'y entrer
(traverser tire faible, chercher tire fort), rival et méchants qui se déplacent sur la carte, légendaires sans
mécanisme de fuite (`idee-aventure-carte-en-graphe-de-noeuds`, `idee-rencontres-volontaires-plutot-qu-aleatoires`,
`idee-pnj-mobiles-rivaux-et-team-rocket`, `idee-legendaires-errants-sans-mecanisme-de-fuite`).

## Lignes rouges

- **Rester canon** : pas de Fakemon, pas d'évolutions inventées, pas de nouvelles capacités, pas de nouveaux types
  (`decision-1222`).
- **Jamais de Téracristal ni de Dynamax**, pour aucun mode, même comme exemple (`feedback-jamais-teracristal-ni-dynamax`).
- **Pas de scénario complet ni de monde sur mesure** : la narration vient de la structure et des comportements.
- **Pas d'élevage** (`decision-1223`).

## Idées (rien de décidé)

- **Une seule carte du monde**, sans travailler région par région ; entre deux régions, un trait avec des rencontres
  possibles. Les îles Orange peuvent y figurer (`idee-aventure-carte-en-graphe-de-noeuds`).
- **Voyager en volant** d'une région à l'autre pendant que la carte défile, comme dans la vidéo vue par l'humain
  (`decision-1222`, `reflexion-2026-11-09-sp-temtem-champions-et-vol-entre-regions`).
- **La carte du monde suit la vraie géographie** : chaque région s'inspire d'un lieu réel (Kanto, Johto, Hoenn,
  Sinnoh : Japon ; Unys : New York ; Kalos : France ; Alola : Hawaï ; Galar : Royaume-Uni ; Paldea : péninsule
  Ibérique). Beaucoup de fans ont fait une carte de ce genre.
- **Rendu HD-2D** de la carte du monde et des décors, repères : Gamma Emerald et Dott.
- **Une carte du monde détaillée et jolie en pixel art**, quitte à la générer : les cartes de fans trouvées sont jugées « hyper moches », elles ne servent qu'au placement des régions.
- **La terre hors des régions vient des vrais continents** ; l'échelle d'ensemble reste à régler, peut-être en
  masquant les distances par des nuages.
- **Des grandes zones plutôt qu'un seul planisphère** : Japon, Europe, Unys, Alola, chacune à son niveau de zoom.
  Changer de zone est une ellipse (survol des nuages, bateau). Le joueur ne voit jamais le monde entier. À la vraie
  échelle, Paldea fait environ 16 fois Kanto et Unys à peu près autant que Kanto.
- **Une carte vivante** : eau, vent, arbres, ombre des nuages animés ; météo et jour / nuit peut-être. Elle se rend
  donc par calques séparés (fond, routes, villes, étapes, arbres).
- **Voyager en bateau, en avion, en train** entre les lieux.
- **Se déplacer plus vite sur la carte** : voler d'une ville à l'autre avec un Pokémon Vol ou le badge requis, ou la
  bicyclette. Le vol remettrait en question le « on ne se téléporte pas » du 2026-09-16.
- **Routes bloquées** que le joueur débloque au fur et à mesure, pour sentir la progression.
- **Routes à angle droit seulement**, ou libres : pas tranché.
- **Niveau des ennemis selon le nombre total de badges**, toutes régions confondues (« sur les 80 badges et quelques »).
  À vérifier : Alola a des épreuves, Hisui n'a pas d'arène.
- **Expérience par action** façon FFT (ça varie le jeu). Repli si trop complexe : comme Pokémon (expérience au K.O.,
  Multi Exp.) (`decision-1211`).
- **Évolution en plein combat**, avec retour à 100 % des PV comme un boost rare (penchant, pas tranché).
- **Le grind, l'humain aime bien** : dans Final Fantasy il fallait grinder pour être plus fort.
- **Apprendre ou réapprendre des capacités** : boutiques, un sage, des CT, peut-être avec un coût, peut-être comme
  Pokémon Champions.
- **Économie** : montée de niveau bridée, prix des objets ajustés, argent à farmer pour débloquer : simples idées.
- **Régler les SP** : par des objets, ou par une interface où changer ses SP a un coût, comme Pokémon Champions.
  Pas d'objets qui retirent 10 points. Pokémon cache ces valeurs, c'est dommage. Piste Temtem.
- **Méchants** : un pseudo fil rouge par région les déclenche (Team Rocket à Kanto), sous forme d'une suite d'états
  posée sur la carte, sans dialogue (`idee-team-rocket-fil-conducteur-sans-scenario`).
- **Histoires annexes et fin de jeu officielles** de chaque région, reprises sur notre carte (`idee-reprendre-les-regions-telles-quelles`).
- **Légendaires** : certains se déplacent sur la carte, d'autres attendent à un endroit précis.
- **Tutoriels** : le début de la campagne en sert, et un tutoriel de combat à part existera aussi
  (`idee-tutoriel-replay-commente`).
- **Avatar du joueur** : un seul personnage androgyne, que le jeu ne genre jamais (dialogues en tournures épicènes) ;
  choix du nom, personnalisation par les couleurs et quelques accessoires ; ses sprites se feront par `/dresseur`
  (`idee-avatar-joueur-genre-neutre-et-personnalisation`).
- **Sprites des dresseurs d'abord** (joueur, dresseurs, champions), dans la perspective de Mystery Dungeon : les
  sprites GBA sont écartés (autre perspective, jambes cachées). Références de perspective : planches de FFTA et
  Tactics Ogre (Pokémon Conquest écarté) ; environ 75 à 100 images cohérentes par personnage
  (`idee-sprites-dresseurs-iso-par-generation`). Méthode arrêtée (`decision-1236`) : SpriteKiln depuis l'artwork
  officiel, par le skill `/dresseur` ; Red, Pierre, Ondine et Major Bob validés. Prochaine étape : les voir en jeu
  sur la grille, à côté des Pokémon.
- **Les portraits de tous les personnages de la licence**, à récupérer (`idee-portraits-personnages-de-la-licence`).
- **Dresseur sur la grille partout dans l'Aventure** : contre les sauvages (soigner, capturer) et en duel contre
  dresseurs et champions, où l'adversaire soigne aussi ; jamais dans le Stade de Combat. Penchant du 2026-11-11, pas
  arrêté : à condition de savoir produire les sprites iso animés de tous les dresseurs et champions
  (`idee-dresseur-unite-sur-le-terrain`).
- **Icônes d'aide sur la carte du monde** : événement ici, revenir ici, prochaine étape là
  (`idee-icones-de-quete-sur-la-carte-du-monde`).
- **Petits Pokémon décoratifs sur la carte** (Taupiqueur près de la Cave Taupiqueur, Pokémon des montagnes), sans
  charger : la carte doit rester minimaliste et simple (`idee-petits-pokemon-decoratifs-sur-la-carte`).
- **Plus tard, ne pas proposer** : défi du jour, puzzles tactiques, conditions de victoire alternatives
  (`feedback-ne-plus-proposer-defi-du-jour-ni-puzzles`).

## Ouvert

- **Génération d'images** : pas d'outil payant (PixelLab essayé, pas convaincant). Depuis le 2026-11-10, un
  générateur local et gratuit est disponible (skill `image-locale`, FLUX.2 sur le PC fixe) (`decision-1225`).
- **Courbe de progression sur toutes les régions** : enchaîner une région après l'autre avec un nouveau starter sans
  repartir de zéro, et à terme commencer n'importe où. Impression de l'humain : les modèles A, B et D de la recherche
  sont compatibles ; il veut savoir comment font les autres jeux avant de trancher la synchronisation vers le bas
  (`question-ouverte-courbe-de-progression-multi-regions`).
- **Pénalité de défaite** : perdre de l'argent, possible ; perdre l'expérience gagnée pendant le combat, hésitation
  (un Pokémon pourrait presque « désévoluer ») (`decision-1209`).
- **Équilibrage des combats contre plusieurs sauvages** (`decision-1220`).
- **Fin de jeu intéressante** : après le niveau 50, Pokémon n'est plus que du grind ; s'inspirer de FFT et des autres.
- **Comment produire la carte du monde** : quelle source, quel assemblage, quel rendu.
- **Le plan de jeu du solo** : enchaînement des événements, quête principale, mécaniques, dialogues, choix du starter
  et de la région de départ. La trame est celle du canon façon Rouge / Bleu (Pokédex, arènes, quelques missions
  comme le colis ou Léo), sans histoire en plus et avec peu de texte : seuls les personnages de la trame parlent,
  pas les dresseurs. Rival : se balade, ou posé aux endroits du canon en bloquant un chemin
  (`question-ouverte-trame-du-solo-quete-dialogues-starters`).
- **Les cartes de combat du solo** : garder les cartes actuelles, en faire une par lieu, les refaire, ou les générer
  de façon procédurale (l'humain y croit moins) (`question-ouverte-cartes-de-combat-du-solo`).
- **Le type du dresseur sur la grille** (probablement Normal, sans talent ni STAB) et la durée X de son K.O.

## Itérations sur la carte du monde

Chaque essai est archivé hors git dans `assets-src/references/aventure/poc-carte/iterations/vNN-<sujet>/` (script et
image), et on repart toujours d'une itération existante. Ce que l'humain a aimé ou non à chaque itération est consigné
dans `journal-iterations-carte-du-monde`, à relire avant d'en lancer une nouvelle. Direction artistique : tuiles
officielles Game Boy Advance d'abord, sprites Mystery Dungeon, sans se fermer aux autres jeux (`decision-1226`).

État, méthode et leçons en un seul endroit : `methode-carte-du-monde-lecons-des-iterations`. En bref :
- **Structure en cours d'essai** : des grandes zones (Japon, Europe, Unys, Alola), chacune à son zoom ; Japon soudé
  au centre, Paldea sur toute la péninsule et soudée à Kalos, vraie terre sans contenu sous des nuages.
- **Ce qui marche** : Natural Earth pour les côtes réelles, relief réel des tuiles Terrarium d'AWS, une seule rampe
  de couleurs d'altitude pour les régions et la vraie terre, côtes recalculées depuis la hauteur, calques séparés.
- **Ce qui a été rejeté** : tuiles collées sans détourage, montagnes et rochers en sprites semés au hasard, décor
  sans donnée derrière, continents écrasés, régions japonaises flottant en mer.
- **Ordre** : structure, puis décor, puis animations.

## Ce que disent les recherches

Toutes du 2026-11-09, faites par des sous-agents ; « non vérifié » dans le graphe quand une page n'a pas pu être relue.

### Défaite, expérience, évolution (`reflexion-2026-11-09-defaite-xp-evolution-tactical`)

- Quatre façons de gérer la défaite : recharger (Fire Emblem, FFT), réessayer en gardant l'expérience (Triangle
  Strategy, FFTA), revers dans le monde (Pokémon : Centre et argent), échec de partie avec héritage (Into the Breach).
- FFT donne l'expérience par action réussie, selon l'écart de niveau. Pièges : farmer en se tapant entre alliés ;
  remèdes : rien sur une cible trop faible ni sur un soin inutile, malus par tour.
- Presque aucun jeu ne fait évoluer en plein combat (exceptions : Pokémon UNITE, Digimon Survive).

### Niveau des ennemis et fin de jeu (`reflexion-2026-11-09-niveaux-ennemis-et-end-game`)

- A, plafond par badge (Radical Red, Unbound, Tactics Ogre Reborn). B, niveaux fixes par zone (Écarlate / Violet,
  Fire Emblem, Or / Argent). C, ennemis qui suivent le joueur (Oblivion, reconnu comme une erreur). D, bande par
  région et synchronisation vers le bas (Final Fantasy XIV, Guild Wars 2, Arbre de Combat).
- Or / Argent puis Kanto, le cas le plus proche du nôtre : Kanto trop facile, saut brutal vers Red.
- Fin de jeu ailleurs : jobs de FFT, compétences par l'équipement et lois de FFTA, Item World de Disgaea, Palais des
  Morts de Tactics Ogre ; Pokémon normalise ses installations au niveau 50 ; Run & Bun supprime le grind.

### SP, Temtem, vol entre régions (`reflexion-2026-11-09-sp-temtem-champions-et-vol-entre-regions`)

- Pokémon Champions : 66 SP, 32 max par stat ; ajouter un point coûte, le retirer est gratuit.
- Temtem : valeurs d'entraînement visibles, réglables à tout moment par des objets ±1 à ±100 et un « mixeur » qui
  règle tout dans un écran.
- La vidéo de vol vue par l'humain : https://x.com/ranbpa0/status/2111264296433078614 (repris sur YouTube :
  https://www.youtube.com/watch?v=lf5VAiuZ6mE). Identifié depuis : voir la section suivante.

### Vol entre régions et carte du Japon (`reflexion-2026-11-09-vol-entre-regions-et-carte-du-japon`)

- La vidéo de vol est le projet perso de @ranbpa0, sur la décompilation pokeemerald : un overworld continu de
  plusieurs régions assemblées, survolé sur le dos du Pokémon de l'équipe. Pas de nom, pas de ROM publique, une
  bêta annoncée « d'ici quelques mois ».
- Sa carte du Japon en style Town Map GBA (4096 × 3850) place Sinnoh, Kitakami, Kanto, Johto, Hoenn, Sevii et les
  régions de Pokémon Ranger ; elle contient aussi des régions de fan games (Naljo, Rijon, Tunod…), non canon pour nous.
  https://pbs.twimg.com/media/HTHVrTQbEAAWaN8.jpg?name=orig
- Autres cartes de fans du Japon : PokeJapan Map (2023) https://i.redd.it/dwl86layyrwb1.png , kyuweftea (2025)
  https://i.redd.it/vxthiqk2pdee1.png .
- Copies locales, hors git : `assets-src/references/aventure/`.

### Cartes des régions (`reflexion-2026-11-09-sources-cartes-regions`)

- Aucune carte de région libre de droits. Les jeux décompilés (dépôts `pret` : pokefirered, pokeemerald,
  pokecrystal, pokered) donnent la position exacte des villes et des routes. Kanto a déjà été réassemblé et son
  graphe (38 lieux, 41 liaisons) en est sorti juste.
- Pas de carte officielle unique du monde ; Bulbapedia documente les équivalents réels des régions.

### Fan games (`reflexion-2026-11-09-inventaire-fan-games`)

- Aucun fan game n'a une vraie carte du monde de toutes les régions canon. Le plus large : Pokémon Fire Ash, 9 régions
  (Kanto, Johto, Hoenn, Sinnoh, Unys, Kalos, Alola, Galar, îles Orange) reliées par Vol, téléportation et bateau.
- Voyage entre régions ailleurs : PokeMMO (un pirate dans chaque port), Pokémon Crossroads (par les Centres Pokémon),
  Emerald Extended Cut (un continent unique, mais 103 Pokémon ajoutés).
- Sources d'assets : décompilations `pret` et pokeemerald-expansion, PokeAPI/sprites, EeveeExpo, veekun.
- Nintendo retire surtout ce qui fait du bruit (gros pic de téléchargements, date de sortie annoncée).

### Trame de Kanto, grottes, portraits (`reflexion-2026-11-11-trame-kanto-grottes-portraits`)

Rapport complet hors git : `assets-src/references/aventure/recherches/2026-11-11-trame-grottes-portraits.md`.

- La trame de Rouge / Bleu tient en 27 étapes, qui se réduisent à 13 verrous (Pokédex, Pierre, Coupe, Passe Bateau,
  Thé aux gardes, Scope Sylphe, Poké Flûte, Bicyclette, Surf, Force, Clé Secrète, 7 puis 8 badges) et 8 combats de
  rival. Environ 300 à 350 boîtes de dialogue obligatoires en tout.
- Grottes : Mont Sélénite 3 cartes, 12 dresseurs, 1 événement ; Grotte 2 cartes, 15 dresseurs ; Cave Taupiqueur
  3 cartes, aucun dresseur, facultative.
- Fil sans texte ailleurs : un marqueur « prochaine étape », des PNJ-verrous à condition visible, peu de personnages
  récurrents (rival, Giovanni).
- Portraits : aucun jeu pixel homogène couvrant toutes les régions. Pokémon Showdown (environ 1500 sprites 80×80,
  toutes régions, pixel art) ; Pokémon Masters EX (1007 bustes 256×256, rendu 3D) via Bulbagarden Archives.

### Trame de Kanto dans les remakes (`reflexion-2026-11-11-trame-kanto-et-remakes`)

Rapport complet hors git : `assets-src/references/aventure/recherches/2026-11-11-trame-remakes.md`.

- Rouge Feu / Vert Feuille : mêmes verrous que Rouge / Bleu, plus du facultatif (îles Sevii, Thé gratuit, Memorydex).
- Let's Go : Techniques Secrètes données par des PNJ sans badge, conditions d'entrée d'arène (un type, un niveau,
  un nombre d'espèces), rival ami (Trace) qui guide, Jessie et James récurrents.

### Références de sprites de dresseurs (`reflexion-2026-11-11-references-sprites-dresseurs`)

Rapport et 11 images hors git : `assets-src/references/aventure/recherches/` et `sprites-dresseurs/`.

- Aucun sprite d'humain au style Mystery Dungeon n'existe (SpriteCollab : Pokémon seulement) : il faudra les produire.
- Gabarit de format : les Pokémon humanoïdes de Mystery Dungeon (Gallame, Lucario, Charmina), 8 directions
  réellement dessinées, cadres de 24×48 à 32×56.
- Pokémon Conquest n'a pas d'humains sur la grille ; FFTA et Tactics Ogre restent à voir (sites fermés aux agents).
- Piste de l'agent : un mannequin humain rendu aux 8 angles, le générateur ne servant qu'à habiller et styliser.

### Générer des sprites cohérents (`reflexion-2026-11-11-generation-sprites-bonnes-pratiques`)

- Aucun générateur ne tient seul des dizaines d'images cohérentes : la cohérence vient d'une structure (modèle 3D
  rendu sous 8 angles, squelette de pose), le générateur habille.
- Post-traitement : générer en grand, détourer, puis réduire sur une grille et une palette partagées
  (`proper-pixel-art`, `unfake`), retouche dans Pixelorama.
- Premier essai proposé : test A (générateur seul, image-à-image depuis un concept) contre test B (mannequin Mixamo
  rendu par Blender aux 8 angles), jugés sur planche.

### Entraîner le générateur au pixel art (`reflexion-2026-11-11-fine-tune-lora-pixel-art`)

- Un module LoRA de style Mystery Dungeon, entraîné sur nos 151 espèces (10 360 images distinctes), est la piste
  sérieuse ; jamais documenté sur une carte AMD : test de 50 pas d'abord.
- Pixel perfect visé par construction : canevas 64×64 agrandi ×8, une couleur par cellule, palette imposée.
- Le module dérive de sprites CC BY-NC : privé, jamais distribué ni commité.

### Comparatif de trois méthodes sur Red (2026-11-11, `idee-sprites-dresseurs-iso-par-generation`)

Planche, tableau et animations hors git : `assets-src/references/aventure/sprites-dresseurs/comparatif/`.

- FLUX.2 klein + module pixel-art-sprite, sur une pose de Gallame : le rendu le plus proche de Mystery Dungeon ;
  la vue de face donnée en référence aux autres directions améliore la cohérence, mais la marche ne tient pas
  (deux pas presque identiques) et les yeux restent illisibles à 30 px.
- SDXL + Pixel Art XL : ignore la direction demandée et se réduit mal à 30 px. Écarté.
- SpriteKiln : 8 directions cohérentes par construction, attente et marche complètes en vrai pixel, en quelques
  secondes sur le processeur. Défauts : visage minuscule sous la casquette, modèle écrit de tête et jugé
  « bizarre ». Prochain essai : son mode « depuis une illustration » (`ref prep`, `ref compare`).
- Scripts de ces essais, dans `assets-src/poc-sprites/` : `conversion_pmd.py` (image générée vers le gabarit PMD,
  trois tons par matière, contour noir fermé), `grille.py` (réduction à une grille), `reduire.sh` (détourage et
  palette imposée), `voxel_red.py` (Red en voxels par le code, rejeté : « Minecraft »).

### SpriteKiln depuis l'artwork (2026-11-12, `decision-1236`)

Fiches animées et modèles hors git : `assets-src/references/aventure/sprites-dresseurs/` (`fiche-<id>-animations.gif`,
`spritekiln-<id>/`).

- Ce qui a fait la différence : partir de l'artwork officiel en pied (Poképédia), proportions chibi Mystery Dungeon
  (épaules étroites, grosse tête), yeux peints et calés sur la grille de pixels, tête figée sur les images tenues.
  Le détail est dans `assets-src/poc-sprites/regles-dresseurs.md`.
- Taille sans l'ombre : Red et Ondine 28-29 px, Pierre 32 px, Major Bob 36 px, au-dessus de Machopeur.
- Coût mesuré : en un coup (une seule image regardée, contrôles en texte), environ 7 min et 170 000 jetons par
  personnage ; une relecture de directeur artistique automatique multiplie le coût par quatre environ.
- Les yeux restent la limite : le visage fait 6 à 8 px de large ; quatre expressions sont prêtes (normaux,
  plissés, ouverts, colère).
- Pokémon : Méga-Dracaufeu Y fait d'une traite se reconnaît mais paraît maigre, délavé et lisse à côté du
  Dracaufeu PMD ; écarté.

## Références visuelles et liens

- **Pokémon Gamma Emerald** (repère n°1 de l'humain) : https://undreamedpanic.itch.io/gamma-emerald-ea ; entretien
  sur ses choix HD-2D : https://www.youtube.com/watch?v=HymB8NJzSFQ . Aucun code ni asset récupérable.
- **Dott** (repère n°2, accepte des commandes) : Bourg Palette https://www.youtube.com/watch?v=c9QmaCrT8Vk , Carmin
  sur Mer https://www.youtube.com/watch?v=fMJcgiyFOps , Rosalia https://www.youtube.com/watch?v=Ijj-pAitQfg , FFTA
  en HD-2D https://www.youtube.com/watch?v=rltW3W4KFW8 .
- **Pokémon Fire Ash**, tour de Kanto à Galar : https://www.youtube.com/watch?v=sPDrTxxkVPc
- **Pokémon Unchosen**, Kanto tactique : https://eeveeexpo.com/threads/9519/
- **OpenMon**, technique proche de la nôtre : https://mickaelvanhoutte.github.io/openmon/
- **Chaîne d'Ayrei**, veille sur les fan games : https://www.youtube.com/@ayrei1503 (`idee-sources-fan-games-chaine-youtube-ayrei`).

Lire une vidéo YouTube : `python3 ~/Documents/claude-assistant/scripts/youtube-transcrit.py <lien> <sortie.json>`,
jamais par un navigateur (`feedback-videos-youtube-par-transcrit-local`).
