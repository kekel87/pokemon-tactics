# Plan 199 — Lot B1 : transport et salon en ligne

> **Statut** : done — livré le 2026-09-04
> **Créé** : 2026-09-03
> **Lot B1 de la Phase 7** — plan-cadre : `docs/plans/195-phase7-multijoueur-telemetrie.md`
> **Périmètre arrêté avec l'humain le 2026-09-03**, au cours d'une discussion de cadrage qui a
> révisé plusieurs points du plan-cadre et de `docs/multiplayer.md` (voir § Ce que la discussion a
> changé). Le combat en réseau est le **Lot B2**, la robustesse le **Lot B3** : ce plan s'arrête
> quand les joueurs entrent en combat avec un état identique.

## Motivation

C'est la première brique réseau du projet. Elle ne fait jouer personne : elle fait **se trouver** deux
navigateurs, se mettre d'accord sur une configuration, et démarrer la même partie. Tout le reste du
multijoueur en dépend, et deux de ses choix — l'**adressage** et la **version de compatibilité** —
sont irréversibles sans tout reprendre. C'est pour ça qu'ils sont tranchés ici et pas plus tard.

## Ce que la discussion du 2026-09-03 a changé

Cinq points du cadrage antérieur sont **révisés**. Ils sont listés d'abord parce que la doc existante
dit encore le contraire.

1. **Plus de lien d'invitation.** `docs/multiplayer.md` § Connexion prévoyait
   `?join=ABCD-1234`. Décision humaine : **on ne partage que le code**. Disparaissent avec lui la
   route d'URL, la détection de plateforme pour construire le lien, et le piège de l'iframe itch.io
   (où `window.location` désigne un `html-classic.itch.zone/...` opaque, pas la page du jeu).
2. **Le format se choisit avant que la partie existe.** Il fixe le nombre de places ; le graver avant
   la naissance du code supprime entièrement la gestion de l'éjection de joueurs quand le format
   rétrécit.
3. **Pas de « salon d'attente » séparé.** La salle d'attente **est** l'écran de sélection d'équipe,
   qui porte déjà une ligne par camp et l'état Humain/IA depuis le plan 188. Le nouvel écran `lobby`
   se réduit à : choisir le format, créer ou rejoindre.
4. **L'IA est autorisée en ligne**, contrairement à ce que j'avais recommandé. Le correctif « désigner
   un pair émetteur qui joue l'IA » du plan-cadre est **inutile** : voir § Déterminisme.
5. **Refus sur `buildVersion` : abandonné avant d'être écrit.** Voir § Version de compatibilité.

## Périmètre

**Dedans :**
1. Paquet `packages/network/`.
2. Écran `lobby` : format, « Créer une partie », « Rejoindre » (saisie du code au clavier et à la
   manette).
3. Adressage dérivé du code, allocation des places, maillage complet.
4. Écran de sélection d'équipe en mode réseau : code affiché, encart de paramètres, lignes distantes,
   bouton « Prêt », l'hôte bascule une ligne Humain ↔ IA.
5. Départs pendant le salon (invité, hôte).
6. Lancement accusé : échange des équipes, diffusion du setup et des graines, entrée en combat
   simultanée.
7. Compteurs de télémétrie, y compris les échecs.

**Dehors :**
- **Toute action de combat échangée** → B2. Ce plan s'arrête à l'entrée en combat.
- **L'action de forfait dans le moteur** → B2 (il n'y a pas de combat ici pour l'utiliser).
- **Chronomètre, tours manqués, reconnexion qui rejoue le journal** → B3.
- **Changement d'hôte** — écarté en V1, voir § Départs.
- **Pseudo de joueur** — écarté par l'humain le 2026-09-03 : le sujet revient avec le compte et le
  classement (`#870`, `#885`). La salle d'attente affiche « Joueur 2 », « Joueur 3 ».
- Chat, revanche, spectateurs, code personnalisé, QR code, éditer son équipe depuis le salon, vote
  pour la carte, carte aléatoire. Les quatre derniers sont au backlog.

## Le flux, écran par écran

**Hôte** : menu → Combat → **En ligne** → `lobby` (choisir le format, « Créer ») → écran de sélection
de terrain (aperçu 3D) → **écran de sélection d'équipe**, où le code naît et s'affiche.

**Invité** : menu → Combat → **En ligne** → `lobby` (saisir le code, « Rejoindre ») → **écran de
sélection d'équipe** directement. Il ne configure rien ; la carte lui arrive de l'hôte et il n'en voit
que le nom.

Rien n'est créé tant que l'hôte n'a pas fini de configurer : le code apparaît à l'entrée sur l'écran
de sélection d'équipe, pas avant.

**Ce que l'écran de sélection d'équipe gagne en mode réseau :**

| Ajout | Détail |
|---|---|
| Le code, en évidence, avec « Copier » | C'est là que l'hôte attend, donc là qu'il partage |
| Encart de paramètres | Carte (nom), format, placement auto, prévisualisation de dégâts. Modifiable par l'**hôte** tant que personne n'est prêt, en lecture seule pour les autres |
| Troisième état de ligne | « Joueur distant », à côté d'Humain et IA. Seul l'hôte bascule une ligne Humain ↔ IA (`setController`, `team-select-screen.ts:82`) |
| « Prêt » | Remplace « Lancer » pour les invités. L'hôte garde « Lancer », actif quand tout le monde est prêt, et peut **forcer** en repassant les lignes pas prêtes en IA |
| Sélecteur de format masqué | Il est gravé depuis le `lobby` |

## D'où le salon tire sa liste de formats

L'écran de sélection d'équipe lit aujourd'hui les formats **sur la carte chargée**
(`team-select-screen.ts:236-240`, `loaded.map.formats`), chaque carte les déclarant par ses calques
de spawn (`spawns_1v1`, `spawns_3p`, `spawns_4p`, `spawns_6p`, `spawns_12p`). Or le `lobby` doit en
proposer un **avant** qu'une carte existe.

**Ce n'est pas un problème : l'invariant est déjà garanti par le code.** Toute carte doit déclarer
**les cinq** formats pour être valide — `REQUIRED_TEAM_COUNTS = [2, 3, 4, 6, 12]` et
`validateTiledMap` lève une **erreur** (pas un avertissement) pour chaque format manquant
(`packages/data/src/tiled/validate-tiled-map.ts:3` et `:92-98`), avec `requireAllFormats` à `true`
par défaut ; seules les cartes de développement en sont dispensées
(`packages/app/src/maps/load-tiled-map.ts:50`), et elles ne sont pas jouables en ligne.

**Donc** : le `lobby` tire sa liste de `REQUIRED_TEAM_COUNTS`, la source de vérité existante. Pas de
filtrage des cartes, pas de revalidation du couple carte/format au lancement — ce serait du code mort
gardant un invariant que le chargement de carte fait déjà respecter.

## Adressage — la décision structurante

**Les adresses se déduisent du code.** L'hôte est `pkmntac-<CODE>-1`, la place *n* est
`pkmntac-<CODE>-n`. Personne n'a besoin d'annoncer qu'il est l'hôte : c'est **le fait d'avoir pris la
place 1** qui le définit, et la prise d'identifiant étant exclusive, deux pairs ne peuvent pas s'en
croire titulaires tous les deux.

Trois bénéfices d'un seul choix :

- **Attribution des places sans arbitre** : un arrivant tente `-2` ; si l'identifiant est déjà pris,
  il tente `-3`, et ainsi de suite **jusqu'au nombre de places du format** (`teamCount` du
  `MapFormat`), au-delà duquel le salon est plein. Le refus du serveur d'annuaire **est** le
  mécanisme d'allocation, personne ne coordonne, et deux arrivants simultanés ne peuvent pas obtenir
  la même place.
- **Maillage** : tout le monde peut joindre tout le monde en connaissant le seul code. C'est ce qui
  fait qu'un hôte qui part **n'emporte pas** les connexions des autres entre eux.
- **Reconnexion (B3) possible sans serveur** : celui qui revient réclame **la même place**, à une
  adresse que les autres connaissent déjà — même si l'hôte est parti entre-temps. Avec des
  identifiants tirés au hasard (le défaut de la bibliothèque), quelqu'un qui recharge sa page revient
  à une adresse inconnue de tous : la reconnexion serait impossible sans serveur.

⚠️ **Deux réserves à traiter dans le code, pas à découvrir en recette :**
- Après une coupure, l'annuaire peut retenir l'ancienne adresse quelques secondes. Toute prise
  d'identifiant doit réessayer avec un délai croissant avant de conclure que la place est occupée.
- Le préfixe `pkmntac-` n'est pas cosmétique (`#866`) : l'espace de noms du service gratuit est
  **mondial et partagé entre toutes les applications**.

**Code** : 5 caractères, alphabet de 32 sans ambiguïté (les 26 lettres moins `I` et `O`, les chiffres
`2` à `9`), soit ~33 millions de combinaisons. Affiché d'un bloc (`A7K2M`), jamais avec son préfixe.

**Maillage** : l'hôte diffuse la liste des places occupées, chaque arrivant se connecte à toutes.
En 1v1 c'est indiscernable d'une étoile ; la convention est posée maintenant pour ne pas la
redécouvrir au premier salon à trois.

## Version de compatibilité

Le refus sur `buildVersion` que j'avais recommandé est **faux** et ne doit pas être écrit.
`__APP_VERSION__` vient de `git describe --tags --always --dirty` (`packages/app/vite.config.ts:48`) :
il change à **chaque commit**, y compris de documentation. Et GitHub Pages et itch.io sont déployés
par deux workflows séparés — le 2026-09-03, itch portait `v2026.8.2-telemetrie` quand `main` était
devant. Un refus strict **interdirait à un joueur itch de jouer avec un joueur Pages**, c'est-à-dire
le cas qu'on veut. Il ne permet pas non plus de dire lequel des deux doit recharger : deux
`git describe` ne s'ordonnent pas.

**Retenu** : une constante `NETWORK_VERSION`, entier, **incrémentée à la main** quand les règles ou le
protocole changent. Comparaison stricte à la poignée de main, refus symétrique avec un message qui
n'accuse personne. La règle (« toucher au moteur ou aux données l'incrémente ») est inscrite au-dessus
de la constante et dans `docs/multiplayer.md`. Le filet est la somme de contrôle du Lot B4 : le jour
où on oubliera, la divergence deviendra une erreur propre au lieu d'un combat qui part en silence.

## Déterminisme — pourquoi l'IA est autorisée

Le plan-cadre notait que l'IA « ne peut pas tourner sur les deux pairs » parce qu'elle est semée sur
`createPrng(Date.now())` (`combat-screen.ts:815`). Vérifié le 2026-09-03 : **le chemin du bac à sable
fait déjà la bonne chose**, `createPrng(seed)` (`combat-screen.ts:1169`), et il n'y a **aucun**
`Math.random` ni `Date.now` dans `packages/core/src/ai/`. L'IA est donc pure à état et générateur
donnés.

Il suffit que l'hôte fournisse une graine d'IA, **dérivée par joueur** (jamais un générateur unique
partagé : l'ordre de consommation compterait), et les deux pairs jouent la même IA sans échanger un
seul message. **Dérivation retenue** : un générateur semé sur la graine d'IA du setup est consommé
une fois par place, **dans l'ordre croissant des places**, et la valeur obtenue sème le générateur de
cette place. L'ordre des places étant le même partout, la dérivation l'est aussi — ce qui ne serait
pas vrai d'une dérivation par identifiant de joueur, dont l'ordre d'itération n'est pas garanti. Conséquence agréable : le maillage ne coûte qu'en **humains**, pas en joueurs — un salon
« 12 joueurs » à 2 humains et 10 IA n'a qu'une seule connexion.

🔴 **Piège de même nature, trouvé au passage** : le **placement automatique tire au hasard**.
`PlacementPhase.ts:49` fait `randomSeed == null ? Math.random : createPrng(randomSeed)`, et
`combat-screen.ts:306` lui passe le résultat de `randomSeed()` (`combat-screen.ts:1028-1036`), un
tirage **local** par `crypto.getRandomValues`. Sans graine venue de
l'hôte, deux pairs obtiennent **deux plateaux différents avant le premier tour**. Le setup diffusé au
lancement porte donc **trois graines** : combat, placement, IA.

## Départs

**Un invité part** (salon) : sa ligne repasse en IA, tout le monde le voit, la préparation continue.

**L'hôte part** (salon) : le salon passe en « connexion perdue avec l'hôte — 45 s », visible. S'il
revient, il réclame `-1`, adresse connue de tous, et on reprend. Sinon, retour à l'écran `lobby` avec
« L'hôte a quitté la partie ». Il n'existe plus : il en recréera un, avec un nouveau code.

**Pas de changement d'hôte en V1.** Le code **est** l'adresse de l'hôte, donc un nouvel hôte veut dire
un nouveau code, que personne n'a. Et en 1v1 l'opération ne sert personne : si l'hôte part, il reste
une personne seule, à qui on offrirait d'hériter d'un salon vide plutôt que de revenir à l'écran de
départ. Ça n'a du sens qu'à 4 ou 12 humains, format qu'on ne livre pas comme fiable en V1.

**Aucune destruction immédiate, jamais** — c'est la leçon du mobile. Verrouiller son écran, basculer
sur une messagerie pour coller le code, recevoir un appel : sur téléphone, « partir » est un accident
permanent, et **l'hôte va forcément aller coller son code ailleurs**, c'est dans le flux. Un onglet en
arrière-plan voit ses minuteurs fortement ralentis, et sur iOS la page peut être gelée puis supprimée.
D'où deux règles :

1. Un silence de quelques secondes est le comportement **normal** d'un téléphone, pas un départ.
2. Le chien de garde se fonde sur les **messages reçus**, jamais sur une horloge locale fine — c'est
   précisément ce que le navigateur sabote en arrière-plan.

**En cours de combat, il n'y a rien de spécial à faire pour l'hôte** : une fois la partie lancée, il
n'a plus aucun rôle. Le setup est gravé, les graines sont partagées, chaque pair a le moteur complet.
Un hôte qui part en combat est « un joueur qui part en combat », traité par le Lot B3. C'est ce qui
rend le pair-à-pair tenable ici, et ça n'est vrai **qu'en maillage complet**.

> **Le modèle mental, à garder pour B3** : un départ n'est pas un changement d'état, c'est un
> **silence**. Rien ne disparaît — les Pokemon de l'absent sont là, où ils étaient, avec leurs PV,
> chez tout le monde. Seules ses **décisions** s'arrêtent. Ce qu'on choisit, c'est quoi faire du
> silence. Décidé avec l'humain le 2026-09-03, à écrire en B3 : on ne fige **pas** la partie, on joue
> jusqu'à son tour ; son tour est passé au bout de 10 s si le canal s'est fermé proprement, 45 s s'il
> se tait ; **3 tours manqués consécutifs** (le compteur repart à zéro dès qu'il rejoue) valent
> forfait, et ses Pokemon tombent K.O. Un joueur absent et un joueur qui regarde ailleurs sont ainsi
> le **même cas**, traité par un seul mécanisme.

**Quatre points relevés par la passe game design du 2026-09-03.** Le premier est tranché, les trois
autres sont des réglages à arrêter avant d'écrire B3 — pas à découvrir dedans :

1. ✅ **TRANCHÉ le 2026-09-03 — le compteur qui repart à zéro ouvrait un blocage volontaire.** Un
   joueur en train de perdre pouvait agir *juste avant* le troisième tour manqué, indéfiniment, et
   infliger 45 s d'attente réelle à l'adversaire à chaque décision sans jamais atteindre le forfait —
   le défaut classique des minuteurs à seuil. **Retenu** : un **second compteur, cumulatif et non
   réinitialisable**, 6 tours manqués sur l'ensemble du combat valant forfait, en plus des 3
   consécutifs. Deux nombres, aucun mécanisme de plus. Voir `#908`.
2. **Le deuxième silence ne vaut pas le premier.** Une fois qu'un délai de 45 s a expiré, l'absence
   est établie : les délais suivants peuvent descendre à 10 s. Sans ça, un Pokemon **rapide** et
   absent revient souvent dans la file (« attendre » est l'action la moins chère de la table, 350
   points de temps de charge) et impose une attente de 45 s à chaque retour. Préférer raccourcir les
   délais suivants plutôt que renchérir le coût de l'auto-passe : le barème est une règle de jeu, il
   n'a pas à changer selon l'état du réseau.
3. **Le forfait doit contourner toute clause de survie.** Aucun effet du genre Increvable ou Ceinture
   Force n'est implémenté aujourd'hui (`sturdy` est un fragment sans gestionnaire), mais le jour où
   l'un le sera, un forfait qui laisserait un Pokemon à 1 PV donnerait un combat qui ne se termine
   jamais. Le Pokemon tombe, point final.
4. **45 s peut être court pour une vraie décision.** L'inégalité n'est pas « Pokemon rapide contre
   lent » — 45 s est généreux pour n'importe quel profil — mais « décision simple contre décision
   complexe » : une attaque de zone à plusieurs cibles avec risque de toucher un allié se réfléchit.
   À vérifier en recette plutôt qu'à supposer.

**Ce que la passe a confirmé, et qui est acquis** : le forfait n'a **aucun code de victoire à
écrire**. Mettre l'équipe K.O. suffit — `checkVictory` sort déjà tant qu'il reste plus d'un camp
vivant, donc un forfait en 1v1 donne la victoire à l'autre, et dans un format à plus de deux camps il
retire simplement un camp sans terminer la partie. Le mécanisme de verdict du plan 191 couvre même le
cas limite d'un forfait simultané au dernier K.O. adverse : match nul, jamais un vainqueur usurpé. Et
**il n'existe pas d'exploit de tempo** : se taire pour être auto-passé coûte exactement le même temps
de charge que cliquer « attendre » soi-même, avec le risque du forfait en plus.

## Protocole (Lot B1 seulement)

`hello` (version réseau, place réclamée) · `welcome` (places occupées, état du salon) · `room_state`
(carte, format, options, lignes) · `team_select` (sélection d'un joueur) · `ready` · `start` ·
`start_ack` · `bye` (départ propre). **Aucun message d'action** : le combat, c'est B2.

`start` est le seul message dont la forme doit être arrêtée dès l'étape 1, parce que tout le
déterminisme en dépend. Il porte : l'**identifiant stable de carte** (jamais l'URL), le format, les
options de partie (placement automatique, prévisualisation de dégâts), la composition de **chaque**
place — équipe et nature, humaine ou IA —, et les **trois graines** (combat, placement, IA).

Erreurs remontées à l'interface, en énumération fermée : `code_introuvable`, `salon_plein`,
`partie_commencee`, `version_incompatible`, `connexion_impossible` (la traversée de pare-feu a
échoué), `delai_depasse`. Ce sont aussi les valeurs envoyées en télémétrie — jamais de texte libre.

🔴 **Le lancement doit être accusé.** Sans accusé : l'hôte diffuse « on démarre », un pair ne reçoit
pas le message, les autres entrent en combat, lui reste sur l'écran d'équipe — et **aucun moment**
n'existe où quelqu'un s'en aperçoit ; il attend un tour qui n'arrivera jamais. L'hôte n'entre donc en
combat que lorsque tous ont confirmé, et annule le lancement avec un message sinon.

## Étapes

> Les étapes s'enchaînent dans l'ordre, à une exception : 2 et 3 se développent ensemble (le canal
> factice de l'étape 2 est ce qui rend l'étape 3 testable).

1. **Paquet `packages/network/`** — `protocol.ts` (messages, `NETWORK_VERSION`), `room-code.ts`
   (alphabet, génération, adresses dérivées). Pur, aucun réseau, entièrement testable unitairement.
   Zéro dépendance d'interface ; le paquet ne connaît du moteur que des **types**.
2. **Transport** — une interface commune, deux mises en œuvre : `peer-connection.ts` (la
   bibliothèque `peerjs`, version courante `1.5.5` ; confirmer l'API et les codes d'erreur avant de
   coder, la branche `2.0.0-beta` existe et n'est pas retenue) et `fake-transport.ts` (canal en
   mémoire). Le canal factice n'est pas un artifice de test : c'est lui qui rend les étapes 3 et 6
   testables sans réseau.
3. **`room.ts`** — état de salon, création, arrivée, allocation de place avec réessais, liste des
   places, départs propres et silencieux, délai de grâce (constantes nommées au même endroit :
   **10 s** après une fermeture propre, **45 s** après un silence). Tests d'intégration avec deux salons dans le
   même processus par le canal factice.
4. **Écran `lobby`** — nouvel `ScreenId` et transitions ; choix du format (liste indépendante de la
   carte, § Les formats viennent de la carte) ; « Créer » / « Rejoindre » ; saisie du code au clavier
   **et à la manette**.

   ⚠️ La manette **ne peut pas écrire** dans un champ texte, et c'est un choix explicite, pas un
   manque : le commentaire de `packages/app/src/input/focus-navigation.ts:237` dit qu'un champ texte
   « revendique tout le clavier mais la manette ne saisit pas », donc le contrôle ne revendique rien
   pour que les flèches en sortent. Il faut donc une **roue de caractères** — 5 emplacements,
   haut/bas fait défiler l'alphabet restreint, gauche/droite change d'emplacement, A valide. Elle
   sert aussi sur téléphone, où elle évite le clavier système qui recouvre l'écran.

   🔴 **La roue est un élément visuel neuf : sa maquette se présente à l'humain et se fait valider
   AVANT d'être codée** (règle du projet : décrire le résultat attendu, obtenir le feu vert, puis
   implémenter). C'est la seule étape du plan qui a une dépendance humaine.
5. **Salle d'attente** — l'écran de sélection d'équipe en mode réseau : encart de paramètres, code et
   « Copier », lignes distantes, « Prêt », bascule Humain ↔ IA réservée à l'hôte, sélecteur de format
   masqué. L'hôte change la carte en repassant par l'écran de terrain (la transition existe déjà dans
   les deux sens), et ne peut plus rien changer dès que quelqu'un est prêt.
6. **Lancement** — échange des sélections d'équipe, composition du setup par l'hôte (carte, format,
   options, équipes, **trois graines**), diffusion, accusés, entrée en combat. Le salon se verrouille
   dès « Lancer » : plus aucune connexion acceptée. **Inclut la première des deux corrections du
   plan-cadre** : le setup transporte l'**identifiant stable de carte** (`MAPS_REGISTRY`), jamais un
   `mapUrl` — une URL dépend de la base de déploiement et n'est pas un contrat entre deux pairs. La
   conversion existe déjà dans les deux sens (`analytics/battle-telemetry-session.ts:27` fait le
   trajet URL → identifiant). L'hôte **revalide** ici le couple carte/format avant de diffuser.
7. **Messages d'erreur et télémétrie** — code inexistant, salon plein, partie déjà commencée, versions
   incompatibles, échec de connexion (traversée de pare-feu). Compteurs : partie créée, partie
   rejointe, échec de connexion **avec sa cause en énumération courte**, salon abandonné. Jamais de
   texte libre. C'est aussi le **canari** du risque « domaine Cloudflare filtré » du plan-cadre.
8. **e2e** — **un seul** scénario à deux contextes de navigateur (créer, rejoindre, arriver en
   combat). ⚠️ À budgéter : la suite est déjà à ~520 tests sous plafond de processeur. Le scénario
   doit s'appuyer sur un **annuaire local** lancé par le harnais, jamais sur le service public — sinon
   la suite dépend d'un tiers sans engagement de service, et une coupure d'Internet rend le gate
   rouge. Le projet PeerJS publie un serveur autonome ; **à confirmer à l'étape 2** avec le reste de
   l'API. Si le montage s'avère coûteux, la couverture retombe sur les tests d'intégration de
   l'étape 3 (qui, eux, ne demandent aucun réseau) et le scénario e2e passe en dette assumée,
   **signalée à l'humain** plutôt que supprimée en silence.
9. **Documentation** — `docs/multiplayer.md` : retirer le lien d'invitation du § Connexion, inscrire
   l'adressage dérivé, la version de compatibilité et la règle « toucher au moteur ou aux données
   incrémente `NETWORK_VERSION` ». Puis `docs/decisions.md`, `docs/test-plan.md`, l'index des plans,
   et le plan-cadre 195 § Lot B, dont les **deux corrections à faire dans ce lot** doivent être
   mises à jour : la première (identifiant stable de carte) est **absorbée par l'étape 6**, la
   seconde (l'IA non rejouable sur deux pairs) est **annulée** par la graine d'IA partagée (`#901`).

## Ce que l'exécution a appris (2026-09-04)

Les neuf étapes sont livrées. Cinq choses n'étaient pas dans le plan et méritent de rester écrites.

1. 🔴 **Les lettres de la roue collisionnaient avec les touches de mouvement.** `KeyS` est lié à
   « bas » et `KeyD` à « droite » (bindings AZERTY, remappables), et l'`InputSystem` écoute `window`
   en bouillonnement : sans `stopPropagation`, chaque lettre partait **aussi** comme un mouvement.
   Taper `SNSD2` posait `SNSDA` — le `S` faisait défiler la lettre voisine, le `D` sortait le focus
   de la roue, et le dernier caractère n'avait plus de destinataire. Trouvé par l'e2e, pas par
   l'inspection. La roue arrête donc les touches qu'elle consomme, et laisse passer les flèches.
2. 🔴 **`Room.join` rendait la main avant le premier `room_state`.** Le `welcome` ne porte que la
   version et les places occupées : ni carte, ni format, ni options. L'invité lisait donc une
   configuration vide, cherchait la carte d'identifiant `""`, et affichait « versions
   incompatibles » alors que tout allait bien. Un invité **n'est pas dans le salon** tant qu'il n'en
   connaît pas la configuration.
3. 🔴 **L'écran de terrain ne transmettait pas l'intention réseau.** La salle d'attente se montait
   en mode local, sans code ni salon, et **rien ne le signalait** — l'écran étant par ailleurs
   parfaitement fonctionnel. Le genre de trou qu'aucun test unitaire n'attrape.
4. **La ligne humaine de l'invité n'est pas la première.** `buildInitialSlots` codait l'index 0 en
   dur ; un invité assis à la place 3 voyait sa dernière équipe posée sur la ligne de l'hôte.
5. **Les sélections d'équipe n'étaient annoncées par personne.** Le salon ne devine pas ce que
   l'écran a composé : sans appel explicite, le `start` de l'hôte partait avec des équipes **vides**.

**Deux réglages du transport, mesurés et non supposés :**
- Le **balayage** des places ne réessaie pas, là où la prise de **sa propre** adresse réessaie. Un
  salon à 12 dont 6 places sont prises mettrait une demi-minute à laisser entrer si chaque « occupée »
  coûtait ses trois réessais.
- L'e2e **désactive STUN/TURN**. Les deux pairs sont sur la boucle locale ; attendre la résolution de
  `*.turn.peerjs.com` faisait dépasser le scénario. Une suite de tests ne demande rien à Internet.

## Ce que la revue de code a corrigé le même jour (2026-09-04)

Deux **Critical** et six **Important**, tous corrigés avant le commit définitif. Les deux Critical
méritent d'être écrits, parce que chacun invalide une affirmation que ce plan portait.

### 🔴 Le salon faisait confiance à `message.seat`

L'adresse d'annuaire d'un canal est **fiable** — la prise d'identifiant est exclusive, personne ne
peut se présenter à la place d'un autre. Mais le salon ne confrontait cette adresse au contenu du
message **qu'une fois sur sept** : seul `hello` était vérifié. L'attaque la plus simple était
silencieuse et marchait en 1v1 nu :

```
{ type: "team_select", seat: 1, selection: { pokemonDefinitionIds: ["magikarp"] } }
```

L'hôte entrait en combat avec une équipe qu'il n'avait jamais choisie, **son écran ayant affiché la
vraie jusqu'au bout** — l'interface lit `slots`, le `start` lit `selections`. Même famille : un
`start_ack` au nom d'autrui faisait lancer l'hôte alors qu'un pair n'avait rien reçu, ce qui est
précisément la panne que l'accusé existe pour empêcher ; un `room_state` forgé réécrivait la
configuration d'un invité ; un `bye` au nom d'autrui faisait tomber son délai de grâce de 45 s à 10 s.

Le commentaire de `setSeatSelection` **affirmait la propriété que le code n'avait pas** : `ownsSeat`
ne gardait que le setter local, jamais le chemin réseau. Et le test « refuse celles des autres »
donnait une fausse assurance — il n'exerçait que le setter.

Corrigé par `isSpokenFor`, franchi avant tout traitement : un message qui parle d'une place doit venir
de cette place, et ceux qui font autorité sur le salon (`room_state`, `start`) de l'hôte seul. Quatre
tests d'intégration nouveaux, tous par le pair nu.

### 🔴 `close({ flush: true })` ne vide rien, et l'accusé de lancement pouvait être perdu

Ce plan affirmait que l'accusé partait avant le démontage de l'écran, « la fermeture du canal réel
vidant sa file ». **C'est faux sur `peerjs@1.5.5`**, vérifié dans sa source :

- `close({ flush: true })` **ne ferme rien** : il envoie une sentinelle puis rend la main.
- `close()` **jette** la file : `BufferedConnection.close()` fait `this._buffer = []`.
- `Peer.destroy()` passe par la seconde branche, puis coupe la `RTCPeerConnection`.

`PeerJsTransport.destroy()` enchaînait les deux dans la même boucle synchrone : le `flush` était
annulé par la ligne suivante. L'accusé pouvait donc ne jamais partir, l'hôte annulait au bout de 15 s,
et rediffusait un salon déverrouillé **à un invité qui n'avait plus de salon pour l'entendre** —
invité en combat seul, hôte revenu en salle d'attente.

Ni l'intégration ni l'e2e ne pouvaient l'attraper : le canal factice, lui, **vide correctement** sa
file (fermeture déposée en micro-tâche derrière les envois), donc l'intégration validait une
propriété que la production n'avait pas ; et l'e2e tourne sur la boucle locale, où la transmission est
immédiate. C'était de la chance de temporisation, pas une vérification.

**Corrigé à la racine, pas contourné** : le salon a quitté l'écran. Il appartient désormais à la
session (`packages/app/src/network/online-room.ts`) et **survit à l'entrée en combat** — ce qui est
aussi l'architecture dont le Lot B2 a besoin. Il se ferme sur les deux vrais chemins de sortie :
« Retour » depuis la salle d'attente, et tout retour au menu principal (`combat` ne transite que vers
lui, donc l'écran de combat n'a pas à connaître le réseau). Le drainage avant destruction est corrigé
en plus, pour le `bye`.

Corollaire vital : les **écouteurs** de l'écran de sélection d'équipe sont désormais soldés à son
démontage. Le salon lui survivant, les oublier ferait rendre un écran détruit à chaque message reçu
pendant le combat.

### Ce que la recette humaine a corrigé (2026-09-04, second tour)

Neuf retours, dont un **bloquant que la recette seule pouvait trouver**.

| Retour | Cause, et ce qu'elle apprend |
|---|---|
| 🔴 **« ICE failed », impossible de rejoindre** | J'avais coupé STUN dans la surcharge `?peerPort=`, pour que l'e2e ne résolve pas `*.turn.peerjs.com`. Sauf que c'est **la même URL** que j'avais donnée à l'humain pour tester. Chromium s'en sort avec ses seuls candidats « host » sur la boucle locale, **Firefox refuse**. Le besoin du harnais s'était invité dans le chemin qu'un humain emprunte : `peerIce=off` est désormais propre au harnais |
| 🔴 **Les paramètres de partie ne partaient pas au salon** | Les bascules du pied écrivaient la préférence persistée et la variable locale, mais n'appelaient **jamais** `setOptions`. L'encart affichait l'ancienne valeur, les autres joueurs ne l'apprenaient pas, et c'est celle du salon qui est diffusée au lancement — on aurait joué sous une règle que l'hôte croyait avoir changée |
| **L'hôte s'affichait « En attente » chez tout le monde** | Il n'appelait jamais `setReady` : sa place restait `ready: false` **à jamais** dans l'état du salon. Les invités ne pouvaient pas savoir s'il avait fini de composer, et devaient se déclarer prêts à l'aveugle. Sa préparation se **dérive** maintenant de son équipe composée — pas de second bouton à côté de « Lancer », qui dirait deux fois la même chose |
| **« En attente » sur sa propre ligne** | Contresens : on est là par définition. Le badge ne dit plus que l'état **des autres** |
| **Une place libre s'affichait « IA »** | Un salon en ligne était indistinguable d'une partie solo au premier regard. Nouvel état `waiting` — « ⏳ Place libre » — qui ne bloque pas le lancement et part en IA au `start`, donc le salon reste jouable si personne ne vient |
| **Les contrôles désactivés ne le montraient pas** | `disabled` les écartait de la navigation, mais rien à l'œil ne disait pourquoi cliquer ne faisait rien. Grisés désormais, segment **et** bouton d'équipe |
| **Coller le code n'était pas possible** | Un code arrive par messagerie, donc par le presse-papier. `paste` est écouté (donc aussi clic droit → Coller et le menu du téléphone), tolérant aux espaces, tirets, casse, et à une adresse `pkmntac-XXXXX-1` collée par erreur |

**Deux retours renvoyés au Lot B2, avec l'humain** : le **kick** et le **changement de format dans la
salle d'attente**. Les deux rouvrent la décision #896 — le format se choisit avant la création
précisément pour ne pas avoir à éjecter quelqu'un — et le kick demande un message de protocole, une
raison affichée à l'éjecté, et une règle sur qui peut éjecter qui. Ça se cadre, ça ne s'improvise pas.

**La leçon de méthode** : ma vérification tournait sur Chromium, la sienne sur Firefox. Le bloquant
ICE n'était atteignable que de son côté. Une auto-vérification sur un seul moteur ne remplace pas la
recette humaine — c'est exactement ce que la règle du re-test après la chaîne existe pour attraper.

### Recette humaine, troisième tour (2026-09-04) — la salle d'attente dit enfin qui est qui

Sept retours d'ergonomie, tous sur le même malentendu : **l'écran demandait au joueur de comprendre
pourquoi des contrôles étaient grisés**, au lieu de lui dire ce qui se passe.

| Retour | Correction |
|---|---|
| Le segment Humain / IA de l'hôte, grisé sans raison lisible | Remplacé par **« 👑 Joueur hôte »** — vu de tous, lui compris |
| Idem pour un joueur distant, et pour sa propre place quand on est invité | **« 🌐 Joueur distant »** et **« 🎮 Vous »**. Plus **aucune** place tenue par un humain n'affiche de segment grisé ; une place libre vue par un invité n'affiche plus rien du tout, l'en-tête disant déjà « Place libre » |
| Une puce seule s'arrêtait au milieu de la carte | La rangée passe en colonnes **automatiques** : deux boutons se partagent la largeur, une puce seule la prend entière (mesuré 399 px sur 410) |
| **L'équipe des autres joueurs était visible** | Elle **disparaît**. Fuite d'information : le jeu masque déjà l'objet tenu et le talent de l'adversaire (#729). On voit la sienne et celles que personne ne tient (IA, place libre) — celles-là sont composées par l'hôte, mais visibles de tous |
| L'hôte ne pouvait plus changer ses options | Le gel se déclenchait dès qu'un **invité** était prêt, retirant à l'hôte une décision qui n'était pas la sienne, sans moyen de la reprendre |
| L'hôte n'avait pas de « Prêt / Pas prêt » | **Il l'a**, en plus de « Lancer ». Et c'est **là** que ses options gèlent — sur son propre engagement, réversible d'un « Pas prêt » |

🔴 **Ce retour a annulé un choix que j'avais fait au tour précédent.** J'avais *dérivé* la préparation
de l'hôte de son équipe composée, en écartant un second bouton comme redondant avec « Lancer ». C'est
l'humain qui a vu ce que ça coûtait : sans bouton, l'hôte n'a aucun moyen de dire « attendez », ni de
dégeler ses options. Un bouton explicite pour tout le monde est plus simple à expliquer **et** plus
utile. `isEveryoneReady` n'exempte donc plus personne.

**Sur le combat, pour éviter le malentendu** : arriver à l'écran de combat des deux côtés est le
critère de ce lot, et il est atteint — même plateau, même ordre de jeu. Mais **aucune action ne
traverse encore** : chacun joue sa copie locale, et les coups de l'autre n'arrivent pas. C'est le
Lot B2.

### Les six Important

| Défaut | Ce qu'il coûtait |
|---|---|
| Le bouton « Lancer » de l'hôte n'avait pas de `data-testid` | `renderPreservingFocus` ne restaure que par famille de testid, **sans repli**. En réseau le re-rendu part de chaque message distant : l'hôte perdait le liseré à l'instant où l'invité pressait « Prêt », donc quand le bouton devenait actionnable. C'est la régression du plan 194, sur le contrôle le plus important de l'écran |
| La rangée de formats du `lobby` contournait `renderPreservingFocus` | Même régression, écran neuf : changer de format au clavier ou au pad éjectait le focus |
| `waitForWelcome` n'écoutait pas la fermeture | Rejoindre une partie **déjà lancée** donnait dix secondes d'écran muet puis « plus de réponse ». Et `PartieCommencee` n'avait **aucun producteur** : du code mort avec son message déjà traduit en deux langues |
| Graine d'IA manquante rattrapée sur `Date.now()` | Deux pairs, deux IA différentes, **sans erreur ni trace** — la divergence la plus coûteuse à diagnostiquer, sur le seul chemin où elle est invisible en jeu. Lève désormais |
| Les boutons d'équipe des autres joueurs étaient focalisables | Un invité en partie à 4 traversait aux flèches trois boutons qui n'ouvraient rien. `disabled` règle l'affichage et la navigation d'un coup |
| Localisateur par classe CSS dans le POM e2e | Banni sans réserve par les règles du projet — couplé au style |

Le reste de la revue (conventions, dette) est consigné dans `docs/next.md` § Reporté.

**Un défaut préexistant relevé au passage, non corrigé** (hors périmètre) : en local, tous les
contrôleurs d'IA d'une partie sont semés sur `createPrng(Date.now())` **dans la même boucle**, donc
très probablement sur la même milliseconde — plusieurs camps IA partagent alors le même flux
d'aléa. Sans effet visible connu, mais c'est une source d'entropie qui n'en est pas une. En ligne le
problème n'existe pas : chaque place a sa graine dérivée.

## Vérifications

- **Unitaire** : alphabet et génération de code, adresses dérivées, sérialisation du protocole, refus
  de version.
- **Intégration** (canal factice, deux salons en mémoire) : allocation de places concurrente, arrivée
  et départ, hôte qui part, lancement accusé, lancement annulé quand un accusé manque.
- **e2e** : le scénario unique de l'étape 8.
- **À la main** : deux navigateurs sur la même machine, puis — c'est le vrai test — **un ordinateur et
  un téléphone sur deux réseaux différents**, en allant coller le code dans une messagerie entre les
  deux (le cas qui met l'onglet en arrière-plan).
- Gate CI complet.

## Risques

| Risque | Position |
|---|---|
| Le service d'annuaire gratuit n'a **aucun engagement de service** et un espace de noms mondial | Codes préfixés (`#866`) en V1 ; annuaire à nous sur Durable Object si ça mord (après-V1, `#869`) |
| **Traversée de pare-feu impossible** pour certaines paires (NAT symétrique, réseau mobile) | Assumé en V1 : message clair. Le vrai correctif est le relais de secours, après la V1 |
| Le **domaine Cloudflare filtré** emporterait la mise en relation le jour où l'annuaire sera à nous | Le canari de télémétrie tourne déjà (plan-cadre § Risques). Rien à faire ici |
| **Coût machine de l'e2e** à deux contextes | Un seul scénario, annuaire local, budgété et non ajouté à l'aveugle |
| On oubliera d'incrémenter `NETWORK_VERSION` | Certain au moins une fois. La somme de contrôle du Lot B4 transforme l'oubli en erreur lisible |

## Décisions à inscrire dans `docs/decisions.md`

| # | Date | Question | Décision |
|---|---|---|---|
| 895 | 2026-09-03 | Comment deux joueurs se trouvent-ils ? | **Code de partie seul.** Pas de lien d'invitation : il serait construit depuis l'origine courante, laquelle vaut `html-classic.itch.zone/...` dans l'iframe itch.io. Révise `docs/multiplayer.md` § Connexion |
| 896 | 2026-09-03 | Quand se choisit le format ? | **Avant la création du salon**, dans le `lobby`. Il fixe le nombre de places ; le graver avant la naissance du code supprime toute éjection de joueur |
| 897 | 2026-09-03 | Un écran de salon d'attente séparé ? | **Non.** La salle d'attente est l'écran de sélection d'équipe, qui porte déjà les lignes par camp (plan 188). `lobby` se réduit au format et à créer/rejoindre |
| 898 | 2026-09-03 | Comment les pairs s'adressent-ils ? | **Adresses dérivées du code** (`pkmntac-<CODE>-<place>`). Donne d'un coup l'allocation de place sans arbitre, le maillage, et la reconnexion sans serveur |
| 899 | 2026-09-03 | Maillage ou étoile ? | **Maillage complet.** En étoile, le départ de l'hôte couperait les autres entre eux. Indiscernable en 1v1, posé maintenant pour ne pas être redécouvert à trois |
| 900 | 2026-09-03 | Sur quoi refuser deux versions incompatibles ? | Une constante `NETWORK_VERSION` incrémentée à la main, **pas** `buildVersion` : celui-ci change à chaque commit et diffère entre les déploiements Pages et itch.io, ce qui interdirait le jeu entre plateformes |
| 901 | 2026-09-03 | L'IA est-elle jouable en ligne ? | **Oui.** L'IA est pure à état et générateur donnés (aucun `Math.random` ni `Date.now` dans `packages/core/src/ai/`) : une graine dérivée par joueur suffit, sans un seul message. Annule le correctif « pair émetteur » du plan-cadre. Le maillage ne coûte donc qu'en humains |
| 902 | 2026-09-03 | Que porte le setup diffusé au lancement ? | **Trois graines** : combat, **placement** et IA. Le placement automatique tire au hasard (`PlacementPhase.ts:49`) depuis un tirage local — sans cette graine, deux pairs ont deux plateaux différents avant le premier tour |
| 903 | 2026-09-03 | Le lancement est-il accusé ? | **Oui.** Sans accusé, un pair qui manque le message reste sur l'écran d'équipe pendant que les autres jouent, et rien ne le signale à personne |
| 904 | 2026-09-03 | Changement d'hôte quand l'hôte part ? | **Non en V1.** Le code est l'adresse de l'hôte, donc un nouvel hôte veut dire un nouveau code que personne n'a ; et en 1v1 l'opération ne sert personne. En combat, la question ne se pose pas : l'hôte n'a plus aucun rôle une fois la partie lancée |
| 905 | 2026-09-03 | Que fait-on d'un joueur qui se tait ? | **Jamais de destruction immédiate.** Sur téléphone, « partir » est un accident permanent, et l'hôte va forcément mettre son onglet en arrière-plan pour partager le code. Délai de grâce visible partout, chien de garde fondé sur les messages reçus et non sur une horloge locale. En combat (B3) : 10 s si le canal s'est fermé proprement, 45 s en cas de silence, **3 tours manqués consécutifs** valent forfait |
| 906 | 2026-09-03 | Un pseudo de joueur ? | **Non en V1** (décision humaine). La salle d'attente affiche « Joueur 2 ». Le sujet revient avec le compte et le classement, où il entraîne les conséquences de `#885` |
| 908 | 2026-09-03 | Le compteur de tours manqués remis à zéro permet un blocage volontaire — que fait-on ? | **Un second compteur, cumulatif et non réinitialisable** : 6 tours manqués sur l'ensemble du combat valent forfait, en plus des 3 consécutifs. Sans lui, un joueur en train de perdre agit juste avant le troisième tour manqué, indéfiniment, et impose 45 s d'attente réelle à l'adversaire à chaque décision sans jamais perdre. Relevé par la passe `game-designer` du 2026-09-03, tranché le jour même. S'écrit au Lot B3 |
| 907 | 2026-09-03 | D'où le salon tire-t-il sa liste de formats, alors qu'ils sont déclarés par la carte ? | De **`REQUIRED_TEAM_COUNTS`**, la source de vérité existante. Règle rappelée par l'humain et **déjà codée** : une carte doit déclarer **les cinq** formats pour être valide, `validateTiledMap` lève une erreur sinon. Donc ni filtrage des cartes par format, ni revalidation du couple au lancement — ce serait du code mort |
| 909 | 2026-09-04 | La préparation de l'hôte se dérive-t-elle de son équipe composée, ou lui faut-il son propre bouton « Prêt » ? | **Son propre bouton, réversible**, et c'est sa confirmation qui gèle ses paramètres. Dérivée, la préparation lui retirait deux gestes que les autres ont : dire « attendez », et dégeler ses options. `isEveryoneReady` n'exempte plus personne. **Annule** la dérivation choisie plus tôt le même jour. Sortie de recette. |
| 910 | 2026-09-04 | Comment s'annonce une place que personne n'occupe encore ? | **« ⏳ Place libre »** (`Waiting`), jamais « IA » : sinon un salon en attente ressemble à une partie solo complète. La place ne devient une IA qu'au lancement. Sortie de recette. |
| 911 | 2026-09-04 | Qui voit l'équipe des autres joueurs dans la salle d'attente ? | **Personne** — la sienne, et celles des IA pour l'hôte. Même fuite d'information que #729 ; on masque la ligne entière, pas seulement son édition. Sortie de recette. |
| 912 | 2026-09-04 | Que montre une place tenue par un humain, là où une place d'IA montre le bascule Humain / IA ? | **Un libellé d'identité pleine largeur** : « 👑 Joueur hôte », « 🎮 Vous », « 🌐 Joueur distant ». Un bascule désactivé sur une place inconvertible se lit comme un bug. Sortie de recette. |
