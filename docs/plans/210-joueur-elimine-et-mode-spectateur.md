# Plan 210 — Le joueur éliminé, et le mode spectateur

**Statut** : done (2026-09-15)
**Livré le** : 2026-09-15, les cinq lots d'un trait
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

### `NETWORK_VERSION` 7 → 8 — oublié, puis rattrapé en revue (Major 1)

`canonicalize` (`core/src/battle/state-checksum.ts`) sérialise **tout** l'état et n'omet que les
`undefined`. Un combat en ligne pose désormais `reviveDefeatedCamps: false` : un build d'avant n'a pas
ce champ, et deux pairs de versions différentes divergeraient **dès la première somme de contrôle**,
sans même lancer Vœu Soin. La règle change aussi l'issue de Vœu Soin. D'où l'incrément, que le lot
avait omis.

### Ce que ça simplifie plus loin

Avec ce lot, un camp éliminé **en ligne** ne revient jamais. Le point 4 du Lot D1 reste nécessaire
pour le local — où la réanimation reste permise — mais le dialogue du Lot D2, lui, ne peut plus être
démenti après coup.

## Lot D1 — Le moteur dit qu'un camp est tombé

**Tests d'abord** (`packages/core`, mécanique de combat).

1. Nouvel événement `PlayerEliminated { playerId }` dans `battle-event.ts` et
   `battle-event-type.ts`, émis par `finalizeEliminations` **pour chaque camp qui vient de perdre son
   dernier Pokémon** — y compris le **dernier** camp tombé, celui dont la chute termine la partie :
   il est annoncé, puis le verdict suit. (La rédaction d'origine disait « par `checkVictory` » et
   « tant que la partie continue » ; les deux étaient inexacts, relevé en revue.)
2. 🔴 **Émis AVANT le verdict de victoire, jamais après.** Le dernier camp à tomber et le vainqueur
   sont décidés au même instant ; un ordre inversé ferait afficher « tu as perdu » à quelqu'un qui
   vient de gagner. Même discipline que `PlayerForfeited`, « émis **avant** les K.O. qu'il entraîne ».
3. 🔴 **Une fois par camp, jamais deux.** Un camp déjà éliminé ne le redevient pas au K.O. suivant :
   la mémoire est `announcedEliminations`. Un camp qui ABANDONNE y entre sans être annoncé
   (`PlayerForfeited` le dit déjà) ; un camp redevenu vivant — en local, où Vœu Soin peut encore le
   ramener — en sort, et sera réannoncé s'il retombe.
4. 🔴 **L'émission suit le MÊME report que le verdict de victoire, et ce n'est pas un détail.**
   `checkVictory` est appelé depuis `handleKo` (`BattleEngine.ts:3929`), donc **au milieu** d'une
   résolution. Le plan 191 a déjà réglé ce problème pour le match nul : le verdict est *calculé* là,
   mais *émis* seulement à la frontière de la résolution, par `finalizeBattleEnd` (appelé en
   `:1233` et `:1322`) — c'est ce qui permet à un auto-K.O. de la même résolution (Explosion) de le
   dégrader en nul.

   `PlayerEliminated` fait pareil, **sans toucher `checkVictory`** : `finalizeEliminations(events)`
   **recalcule tout depuis l'état** à la frontière — quels camps n'ont plus un seul Pokémon debout —
   et l'émet **juste avant** `finalizeBattleEnd`, aux deux frontières (`submitAction`, `forfeit`).
   Plus simple que de noter les chutes au fil de la résolution : un camp tombé puis réanimé avant la
   frontière n'a jamais rien eu à retirer, puisque rien n'avait été noté.

   Bénéfice : le cas limite de **Vœu Soin** se résout par la machinerie qui existe déjà, sans
   événement inverse ni annonce à révoquer. Et avec le Lot D0, il ne peut de toute façon plus se
   produire en ligne.
5. Consommateur branché : le **journal de combat** (`battleLog.playerEliminated`, FR et EN).
   **La télémétrie n'est PAS branchée, et c'est une décision** (relevé en revue, décision #1050) :
   `battle-telemetry.ts` enregistre déjà chaque K.O. avec sa cause, donc l'élimination d'un camp s'en
   déduit à la lecture. Un champ de plus changerait la forme de la charge lue par le Worker Cloudflare
   (plan 196) pour n'apprendre rien de nouveau.

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

### ✅ Vérifié le 2026-09-15 : le dialogue ne se ferme que par l'un de ses deux boutons

« Pas d'échappatoire silencieuse » a été contrôlé geste par geste, en lisant le code, parce qu'un
`preventDefault` sur `cancel` ne couvre que la fermeture **native** d'`Échap` :

| Geste | Pourquoi il ne ferme pas |
|---|---|
| `Échap` au clavier | Une modale ouverte force le contexte `menu`, dont le `cancel` renvoie `true` — la touche est avalée. Le `preventDefault` sur l'événement `cancel` du dialogue double la protection. ⚠️ Vrai **seulement depuis le correctif ci-dessous** : avant lui, le contexte `watching` n'atteignait jamais ce `cancel`, et c'était le `preventDefault` SEUL qui tenait le dialogue ouvert. (L'ancien garde du `cancel` de plateau, devenu inatteignable, a été retiré en revue.) |
| B à la manette | `closeOpenModal` n'est appelé que par les écrans de **menu** (`elements.ts`), jamais par l'écran de combat |
| Retour du navigateur | `browser-back.ts` émet d'abord une annulation, que l'écran de combat avale — il repart avant d'atteindre `closeOpenModal` |
| Clic à côté | Un `<dialog>` natif ne se ferme pas au clic sur le fond |

Et quand bien même une voie oubliée le fermerait, l'issue serait **inoffensive** : fermer le dialogue
revient à « Continuer à regarder ». Aucune fermeture accidentelle ne peut faire quitter la partie —
c'est cela que l'interdiction protège.

### 🔴 Défaut trouvé par la mesure, et une affirmation de ce plan qui était fausse

La version précédente de ce paragraphe affirmait, **par lecture du code** : « au pad, le dialogue se
parcourt aux flèches (`focusInDirection` dans la branche modale) ». **C'était faux**, et la passe
multi-entrée mesurée l'a démenti : quatre pressions de flèche comme de D-pad, le focus n'a jamais
quitté « Continuer à regarder ». Au pad, sans `Tab`, **le joueur ne pouvait jamais quitter** — et le
menu de combat refuse de s'ouvrir tant qu'une modale est là.

La branche modale existe bien, mais dans le groupe de gestes `menu`. Or ce dialogue s'ouvre pendant
un tour distant, en contexte **`watching`** — qui ne sert que la vue et s'arrête avant les flèches, A
et Échap (`input-router.ts`) — puis en **`locked`** dès qu'une action s'anime, qui coupe tout. La
victoire n'avait jamais eu le défaut parce que `battle_over` est classé `menu` en dur, pour cette
raison précise. La lecture avait vu la branche ; elle n'avait pas vu qu'on n'y entrait pas.

**Corrigé** dans `combat-screen.ts` : une modale ouverte présente le contexte `menu`, quelle que soit
la phase. Les gestes de vue restent servis (le routeur les traite avant la navigation), donc le
spectateur garde sa caméra. Re-mesuré : les deux issues s'atteignent aux flèches et au D-pad, B ne
ferme pas. Verrouillé en e2e au §12.12 (d bis), qui échouerait sans le correctif.

**Mesure responsive et tactile** (stabilisée : la première tentative mesurait avant que `--ui-scale`
ne se recalcule, et rendait à 568×320 les boutons de la 4K) : aucun débordement, aucun bouton hors
viewport, aucun chevauchement, de 568×320 à 2560×1440 ; boutons de 62 px en 4K. Sous pointeur grossier
**confirmé actif**, `--target-min` vaut 30 px et les deux boutons font **exactement 30 px** de haut à
568×320 comme à 667×375 : le plancher est tenu, sans marge. Ses deux boutons portent `tb-btn`, qui hérite du
plancher tactile `--target-min`, et un `data-testid` chacun (`eliminated-keep-watching`,
`eliminated-back-to-menu`) — le libellé « Retour au menu » étant partagé avec la victoire.

### Ce que la revue de code a fait corriger dans ce lot

- **Le bouton du menu de combat restait grisé après « Continuer à regarder »** (Major 2). Pendant que
  le dialogue est ouvert, le passage du tour distant (`locked` → `watching`) rafraîchit le bouton et
  le grise ; rien ne le rafraîchissait à la fermeture. Au doigt, c'est le seul accès à « Quitter ».
  Corrigé par un rappel `onClosed` du contrat `showEliminated`, appelé sur l'événement `close` —
  donc aussi quand la victoire referme le dialogue.
- **`playerId` traversait le contrat pour être ignoré** (Major 3) : retiré, et la décision
  `shouldAnnounceLocalElimination` rend un booléen.
- **Après un rechargement, le dialogue ne revient pas — et c'est tranché, pas oublié.** Un éliminé
  en ligne qui recharge son onglet reprend en spectateur : le replay reconstruit l'état et le journal,
  il n'a toujours aucun Pokémon, donc jamais la main, et il garde « Quitter » dans le menu de combat.
  Rejouer le dialogue demanderait de distinguer une élimination vécue d'une élimination relue, pour un
  cas où le joueur a déjà vu l'annonce. Décision #1050.

## Lot D3 — Le mode spectateur : il existait déjà

✅ **Livré sans une ligne de code, et c'est la découverte du lot.** La première rédaction prescrivait
de vider `localPlayerIds` du camp éliminé pour verrouiller son menu d'action — avec le risque, noté
alors, de rouvrir le bug de « Recommencer » (décision #1038). Rien de cela n'était nécessaire.

Un joueur éliminé en ligne n'a plus **un seul** Pokemon vivant, et depuis le lot D0 plus aucun moyen
d'en récupérer un. L'ordonnanceur ne lui rend donc **jamais** la main : chaque tour suivant appartient
à un camp distant, et l'orchestrateur passe en `waiting_remote`, menu d'action fermé
(`battle-orchestrator.ts`, branche `aiEvents === "pending"`). Le spectateur est l'état naturel d'un
camp sans survivant.

« Continuer à regarder » revient donc à **fermer le dialogue**. La scène reste entièrement vivante —
journal, caméra, survol — parce que rien ne l'a jamais arrêtée. `localPlayerIds` n'est pas touché, et
l'invariant « sa présence est le drapeau partie en ligne » tient sans effort.

La modale de fin de partie continue de s'afficher au spectateur ; si la partie se termine alors que
le dialogue d'élimination est encore ouvert, `showVictory` le referme d'abord — deux modales empilées
laisseraient le joueur fermer la mauvaise.

## Lot D4 — Le cycle de vie en ligne : vérifié, rien à construire

✅ **Vérifié par lecture le 2026-09-15**, deux faits qui n'étaient pas écrits : le départ de l'éliminé fait prononcer aux survivants un forfait `Absent` que `BattleEngine.forfeit` **refuse** (un camp sans Pokemon debout, `InvalidAction`) — et `applyForfeit` absorbe ce refus proprement (`return false`). Mais `forfeitSeat` a déjà sorti la place du quorum **avant** d'appeler le moteur (`online-battle.ts:476`). Résultat : le quorum est libéré, et le journal n'ajoute **rien** derrière « Le Joueur 3 est éliminé » — voir le point 4, corrigé en conséquence.

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
4. **Pas de nouvelle raison de forfait.** Le journal des survivants dit « Le Joueur 3 est éliminé. »
   (Lot D1), **et rien d'autre s'il s'en va** : le forfait d'absence qui suit son départ est refusé
   par le moteur, un camp sans Pokémon debout n'ayant rien à abandonner. (La rédaction d'origine
   annonçait une seconde ligne « quitte la partie » — inexact, vérifié en lisant le code.) Ajouter
   une raison `Elimine` a été envisagé au cadrage et écarté : elle n'apprendrait rien de plus.

5. 🔴 **Ne pas prononcer de forfait à l'élimination elle-même.** Le forfait est l'effet du **départ**,
   jamais de la défaite. Les confondre retirerait du quorum un témoin qui regarde encore — et
   c'est précisément ce que le Lot C2 du plan 209 décrivait vouloir faire, sur un raisonnement faux.

**Critères de sortie** : à trois camps en ligne, le camp éliminé qui regarde continue d'apparaître
dans le quorum et aucune divergence n'est prononcée ; le même camp qui part en est retiré par le
chemin d'absence existant, et les deux survivants finissent leur partie sans se figer.

## Ordre d'exécution et dépendances

```
D0 (règle Vœu Soin, indépendant — ajouté après coup)
  ↓ Simplifie (retire le cas limite « camp réanimé après annonce »)
D1 (événement core)
  ↓ Consomme
D2 + D3 (dialogue + spectateur, en parallèle)
  ↓ Vérifient
D4 (cycle de vie)
```

- **D0 n'a aucune dépendance amont** : c'est une règle de moteur autonome, soulevée après le cadrage
  initial de D1–D4 (voir Lot D0). Elle ne bloque rien, mais retire par avance le cas limite que D1
  aurait sinon dû gérer (un camp annoncé éliminé, puis réanimé).
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
