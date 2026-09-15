# Plan 210 — Le joueur éliminé, et le mode spectateur

**Statut** : ready
**Ouvert le** : 2026-09-14, à la demande de l'humain, en dépilage du backlog d'avant-release
**Cadré le** : 2026-09-15, avec l'humain
**Bloque la release ?** : **non** — arbitré par la décision #1040, il suit la publication de la Phase 7
**Solde** : `backlog-joueur-elimine-non-prevenu`

## Pourquoi ce plan existe

À N camps, quand le dernier Pokémon d'un joueur tombe, **il ne se passe rien**. Le combat continue
sans lui, sur le même écran, sans un message, sans une consigne. Aucune clé de traduction n'existe
entre « abandon » et « fin de partie ».

Relevé au cadrage du plan 209 par `game-designer` le 2026-09-13, mis hors périmètre parce que le 209
était un plan de **protocole** et que ceci est de l'**interface**.

Ce que l'humain a demandé, mot pour mot :

> « Tu as perdu, soit on retourne au menu, soit on continue à regarder la partie. »

Donc **un dialogue à deux issues**, pas un message. Le mode spectateur est la moitié de la
fonctionnalité, pas un bonus.

## 🔴 En ligne seulement — et le local n'est pas un oubli

Le hot-seat local partage **un seul écran**. Offrir « Retour au menu » à un joueur éliminé y
signifierait lui donner le pouvoir d'**emporter la partie des autres** — l'écran n'est pas le sien.
Le dialogue à deux issues n'a de sens que là où l'écran appartient à un seul joueur.

Constaté par l'humain au cadrage, qui a écarté l'option « les deux » pour cette raison :

> « en local, tu restes physiquement à regarder la partie à côté des autres, mais tu ne joues plus »

Ce que le local gagne quand même, **gratuitement** et sans modale : le Lot D1 lui donne une ligne de
journal (« Le Joueur 3 est éliminé »). C'est tout ce qui manquait là-bas — l'information, pas le
choix.

## L'état des lieux, vérifié dans le code au cadrage

Trois constats de lecture, dont aucun n'était écrit :

1. **Le moteur ne dit rien.** `BattleEngine.checkVictory` (`BattleEngine.ts:1279`) calcule déjà
   `playersAlive`, et le **jette**. Il ne se déclenche qu'à un seul survivant. `PokemonEliminated`
   existe (par Pokémon) et `PlayerForfeited` aussi (camp qui quitte), mais rien ne couvre « le
   dernier Pokémon d'un camp vient de tomber, et le combat continue ». L'élimination **au combat**
   est muette dans le moteur.

2. **`BattleEngine.forfeit` et `checkVictory` sont DÉJÀ corrects à N camps** (relevé au 209,
   `BattleEngine.ts:1272`). `packages/core` n'a donc rien à réparer — seulement à **dire** ce qu'il
   sait déjà.

3. 🔴 **Le Lot C2 du plan 209 annonçait d'exclure du quorum les places « forfaitées ou éliminées ».
   La moitié « ou éliminées » n'a JAMAIS été implémentée.** `forfeitedSeats` (`online-battle.ts`)
   n'est alimenté que par des forfaits explicites (l. 476 et 892). Une élimination au combat n'y
   entre pas.

   Et c'est **tant mieux**, parce que le raisonnement du 209 était faux pour ce cas : il disait
   « leur empreinte fige à leur dernier index pendant que les survivants avancent ». Vrai d'un joueur
   **parti**. Faux d'un joueur **éliminé** : son moteur continue de recevoir et d'appliquer toutes
   les actions, donc son empreinte avance comme celle des autres. Il reste un témoin **valide**.

   Ce plan ne corrige donc pas un écart, il **ratifie le code** et corrige la documentation du 209.

## Les décisions du cadrage

| # | Question | Décision |
|---|----------|----------|
| D1 | D'où vient le signal d'élimination ? | **Nouvel événement core.** `checkVictory` calcule déjà l'information ; c'est un fait de jeu, sa place est dans le moteur |
| D2 | Que voit le spectateur ? | **Tout, caméra libre.** L'état actuel moins la main |
| D3 | L'éliminé reste-t-il témoin de la somme de contrôle ? | **Oui tant qu'il regarde.** Consigne de l'humain : « fais au plus simple ». Il se trouve que le plus simple est le comportement actuel — le garder coûte **zéro ligne**, l'exclure demanderait d'en écrire |
| D4 | Le hot-seat local ? | **Non** pour le dialogue et le spectateur — voir la section dédiée ci-dessus |
| D5 | Un camp tombé peut-il être réanimé par Vœu Soin ? | **Non en ligne, oui en local** (#1047). Par une option de règle lue par le moteur, jamais par une notion de réseau dans `packages/core` |

## Lot D0 — Un camp tombé ne se fait plus réanimer (en ligne)

**Tests d'abord** (`packages/core`, règle de jeu).

🔴 **Ce lot n'était pas au cadrage initial.** L'humain l'a soulevé le 2026-09-15, après coup :

> « un joueur qui abandonne ou qui a perdu, faudrait ne pas pouvoir […] réanimer ses Pokémon après
> son tour et son départ. En multi local, ça peut être marrant par contre »

Et c'est atteignable **aujourd'hui**, ce n'est pas une précaution théorique.

### Le trou, vérifié dans le code

⚠️ **Piège de nommage, à lire avant d'écrire une ligne.** Le move de réanimation du jeu est
**Vœu Soin** (`healing-wish`). **Second Souffle** (`revival-blessing`) est traduit dans
`moves.fr.json` mais **n'est pas implémenté** — absent de `tactical.ts`. Le code et la décision #24
surnomment Vœu Soin « Second Souffle » en commentaire, ce qui a déjà trompé ce plan dans sa première
rédaction. Il n'y a **qu'une** réanimation dans le jeu.

`handle-revive-or-heal.ts` le dit lui-même :

> *« Any occupant is a valid target — **ally or enemy**, alive or KO »*

Vœu Soin réanime donc à 50 % **n'importe quel occupant d'une case à portée 1-3, y compris le mort
d'un camp adverse**. Un camp éliminé peut être ramené dans la partie sans que personne le lui
demande — et en ligne, il a peut-être déjà cliqué « Retour au menu » et quitté le salon. Sa place
serait alors vivante et sans personne pour la jouer.

### Ce qu'il faut écrire

1. `BattleEngine` reçoit une option de configuration, `reviveDefeatedCamps`. **Vraie en local, fausse
   en ligne**, posée par l'application au montage du combat.
2. 🔴 **`packages/core` ne doit PAS savoir ce qu'est « en ligne ».** Il n'a aucune dépendance réseau
   et n'en aura pas — il lit une **option de règle**, c'est tout. C'est l'application qui sait dans
   quel mode elle monte le combat. Le nom de l'option doit le refléter : il parle de camps vaincus,
   jamais de réseau.
3. Quand l'option est fausse, `handleReviveOrHeal` **refuse** une cible K.O. appartenant à un camp
   éliminé ou forfaité. Le move **échoue**, et 🔴 **le lanceur meurt quand même** — le sacrifice est
   payé d'avance (`selfKo`), le changer serait un autre sujet. Réutiliser `ReviveOrHealFailed`, qui
   existe déjà pour la case vide.
4. En ligne, l'option **fait partie de la configuration du combat**, donc les douze moteurs la
   partagent et restent d'accord. Rien à faire de plus côté somme de contrôle.

**Critères de sortie** : en ligne, Vœu Soin visant le mort d'un camp éliminé échoue et le lanceur
tombe ; en local, le même geste réanime. Les deux ont leur test.

### Ce que ça simplifie plus loin

Avec ce lot, un camp éliminé **en ligne** ne revient jamais. Le point 4 du Lot D1 reste nécessaire
pour le local — où la réanimation reste permise — mais le dialogue du Lot D2, lui, ne peut plus être
démenti après coup.

## Lot D1 — Le moteur dit qu'un camp est tombé

**Tests d'abord** (`packages/core`, mécanique de combat).

1. Nouvel événement `PlayerEliminated { playerId }` dans `battle-event.ts` et
   `battle-event-type.ts`, émis par `checkVictory` **pour chaque camp qui vient de perdre son dernier
   Pokémon**, tant que la partie continue.
2. 🔴 **Émis AVANT le verdict de victoire, jamais après.** Le dernier camp à tomber et le vainqueur
   sont décidés au même instant ; un ordre inversé ferait afficher « tu as perdu » à quelqu'un qui
   vient de gagner. Même discipline que `PlayerForfeited`, « émis **avant** les K.O. qu'il entraîne ».
3. 🔴 **Une fois par camp, jamais deux.** Un camp déjà éliminé ne le redevient pas au K.O. suivant.
   `checkVictory` est appelé à chaque résolution — l'événement a besoin d'une mémoire, comme
   `pendingBattleEnd` en a une.
4. 🔴 **L'émission suit le MÊME report que le verdict de victoire, et ce n'est pas un détail.**
   `checkVictory` est appelé depuis `handleKo` (`BattleEngine.ts:3929`), donc **au milieu** d'une
   résolution. Le plan 191 a déjà réglé ce problème pour le match nul : le verdict est *calculé* là,
   mais *émis* seulement à la frontière de la résolution, par `finalizeBattleEnd` (appelé en
   `:1233` et `:1322`) — c'est ce qui permet à un auto-K.O. de la même résolution (Explosion) de le
   dégrader en nul.

   `PlayerEliminated` doit faire pareil : `checkVictory` **note** les camps qui viennent de tomber,
   et un `finalizeEliminations(events)` les émet à la même frontière, **juste avant**
   `finalizeBattleEnd`. Un camp noté puis réanimé avant la frontière **sort tout seul** de la liste
   en attente.

   Bénéfice : le cas limite de **Vœu Soin** se résout par la machinerie qui existe déjà, sans
   événement inverse ni annonce à révoquer. Et avec le Lot D0, il ne peut de toute façon plus se
   produire en ligne.
5. Consommateurs gratuits, à brancher : le **journal de combat** (`battleLog.playerEliminated`,
   FR et EN) et **`battle-telemetry.ts`**, qui compte déjà `PlayerForfeited`.

**Critères de sortie** : à quatre camps, trois éliminations successives produisent trois événements,
dans l'ordre, une seule fois chacun, et le quatrième camp gagne sans qu'un `PlayerEliminated` soit
émis pour lui.

## Lot D2 — Le dialogue à deux issues

1. À la réception de `PlayerEliminated` **pour un camp local**, en partie **en ligne** seulement
   (`localPlayerIds !== undefined`, l'invariant posé par la décision #1038), le combat affiche un
   dialogue : **« Retour au menu »** / **« Continuer à regarder »**.
2. 🔴 **Après l'animation du K.O., pas pendant.** Le joueur doit voir son dernier Pokémon tomber.
   L'orchestrateur cadence déjà `PokemonKo` / `PokemonEliminated` (`battle-orchestrator.ts:251`) ;
   le dialogue s'insère à la fin de ce cadencement, pas au milieu.
3. Clés à créer, FR et EN — il n'en existe **aucune** entre `combatMenu.abandon` et la fin de partie.
4. **Pas d'échappatoire silencieuse** : ce dialogue ne se ferme pas par `Échap` ni par un clic à
   côté. Les deux issues sont des choix, et l'une d'elles quitte la partie.

**Critères de sortie** : un joueur éliminé en ligne voit le dialogue (deux boutons, noms FR), après
le K.O. du dernier Pokémon. Aucun des deux ne peut être fermé par `Échap` ni cliquant à côté.
Choisir « Retour au menu » part effectivement ; choisir « Continuer à regarder » lance le mode
spectateur (lot D3).

## Lot D3 — Le mode spectateur

1. « Continuer à regarder » laisse la scène **entièrement vivante** : journal, caméra libre,
   survol des cases. Seuls changent le **menu d'action, verrouillé**, et le fait qu'**aucun tour
   n'est proposé**.
2. Le verrou existe déjà : `localPlayerIds` sert exactement à ça depuis le Lot B2 — le pair qui
   regarde a son menu verrouillé. Spectateur = `localPlayerIds` vidé de ce camp, pas un nouveau mode.
3. 🔴 **Ne pas réutiliser `localPlayerIds === undefined` pour signifier « spectateur »**, et c'est
   l'invariant que la décision #1038 a écrit dans la JSDoc : **sa présence est le drapeau « partie
   en ligne »**. La vider ferait réapparaître « Recommencer » — le bug qu'on vient de fermer. Le
   spectateur garde un `localPlayerIds` **présent et vide**, ou un drapeau à part.
4. La modale de fin de partie continue de s'afficher au spectateur quand la partie se termine : il
   regarde pour voir qui gagne.

**Critères de sortie** : un spectateur voit le journal en temps réel, la caméra libre (pan/zoom),
le survol des cases. Le menu d'action n'affiche plus « Attaquer », « Échanger », aucun bouton
pour proposer un tour. La modale de fin de partie s'affiche quand la partie se termine (qui a gagné).

## Lot D4 — Le cycle de vie en ligne : vérifier, pas construire

🔴 **Ce lot n'écrit presque rien, et c'est le résultat du cadrage le plus utile.** L'humain a tranché
« fais au plus simple » sur la question du quorum ; il se trouve que le plus simple est aussi ce qui
existe déjà. Les deux branches sont gratuites :

1. **« Continuer à regarder » ne touche à rien.** Le salon reste tenu, le moteur continue d'appliquer
   les actions, les empreintes continuent de partir. L'éliminé reste dans `votingSeats()` — parce que
   rien ne l'en retire : `forfeitedSeats` n'est alimenté que par des forfaits explicites, et une
   élimination au combat n'en est pas un. **Zéro ligne.** Et c'est correct, pas seulement pratique :
   son moteur avance comme celui des autres, donc son empreinte aussi. Un témoin honnête de plus rend
   le vote de minorité plus sûr, alors que le quorum rétrécit déjà à chaque camp tombé.

2. **« Retour au menu » n'a rien à émettre de spécial non plus.** C'est une sortie de partie
   ordinaire : `releaseOnlineRoom()` diffuse le `bye`, et chez les survivants
   `room.onPeerAbsent` (`online-battle.ts:816`) prononce déjà le forfait `Absent`, qui le retire du
   quorum. Machinerie du Lot B3, en place depuis le plan 202.

   Ce qui compte, et c'est le **seul vrai travail du lot** : vérifier que le bouton emprunte bien ce
   chemin-là, et pas une navigation interne. C'est exactement le piège de la décision #1038 —
   « Recommencer » remontait le setup **en interne**, donc `releaseOnlineRoom()` n'était jamais
   appelé et le salon restait tenu. Une navigation qui ressemble à un départ sans en être un.

3. **Le menu de combat aussi.** Le spectateur peut partir plus tard par « Quitter » du menu ; vérifier
   qu'il emprunte le même chemin qu'au point 2, et pas une navigation interne. Même piège, même
   vérification — c'est une ligne de plus dans le test, pas un lot à part.
4. **Pas de nouvelle raison de forfait.** Le journal des survivants dira « Le Joueur 3 est éliminé. »
   (Lot D1), puis « Le Joueur 3 quitte la partie. » s'il s'en va. Les deux phrases sont vraies, dans
   le bon ordre, et aucune ne prétend qu'il a renoncé. Ajouter une raison `Elimine` a été envisagé au
   cadrage et écarté : elle n'apprendrait rien que la première phrase ne dise déjà.

5. 🔴 **Ne pas prononcer de forfait à l'élimination elle-même.** Le forfait est l'effet du **départ**,
   jamais de la défaite. Les confondre retirerait du quorum un témoin qui regarde encore — et
   c'est précisément ce que le Lot C2 du plan 209 décrivait vouloir faire, sur un raisonnement faux.

**Critères de sortie** : à trois camps en ligne, le camp éliminé qui regarde continue d'apparaître
dans le quorum et aucune divergence n'est prononcée ; le même camp qui part en est retiré par le
chemin d'absence existant, et les deux survivants finissent leur partie sans se figer.

## Ordre d'exécution et dépendances

```
D1 (événement core)
  ↓ Consomme
D2 + D3 (dialogue + spectateur, en parallèle)
  ↓ Vérifient
D4 (cycle de vie)
```

- **D1 d'abord** : c'est la fondation. Tous les autres dépendent de `PlayerEliminated`.
- **D2 et D3 en parallèle** : UI indépendante, tous deux reçoivent D1.
- **D4 après** : vérification que les choix du dialogue débouchent sur les bons chemins.

## Ce que ce plan n'est pas

- **Pas une revanche.** Le message `rematch` reste hors V1 (`docs/multiplayer.md`), comme l'a tranché
  la décision #1038.
- **Pas un spectateur pour non-joueurs.** Rejoindre un salon pour regarder sans jouer est une autre
  fonctionnalité, qui demanderait une place sans équipe et un écran de salon différent.
- **Pas une caméra de retransmission.** Suivre automatiquement le joueur actif a été proposé au
  cadrage et écarté : c'est une fonctionnalité de caméra à part entière.
- **Pas un lever de brouillard.** Écarté au cadrage : en ligne, un éliminé qui parle à un survivant
  deviendrait un avantage.
