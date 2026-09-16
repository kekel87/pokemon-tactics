# Plan 212 — Mesurer les mécaniques de fin de Phase 7, et les deux trous trouvés en lisant les chiffres

**Statut** : done
**Terminé le** : 2026-09-16
**Ouvert le** : 2026-09-15, sur question de l'humain — « la télémétrie est en place pour le multi ?
on a bien tout prévu comme point de mesure ? »
**Cadré le** : 2026-09-15, avec l'humain
**Bloque la release ?** : **OUI**, arbitré par l'humain. Motif ci-dessous.
**Taille** : moyen — quatre compteurs, trois libellés oubliés, deux trous de mesure trouvés en
lisant les chiffres le 2026-09-16, et leurs tests.
**Élargi le** : 2026-09-16, après lecture des statistiques de production (§ « Ce que les chiffres
ont dit »). Deux lots ajoutés, E et F.

## Pourquoi ce plan existe

L'audit de la télémétrie en ligne, fait à la demande de l'humain avant de publier la Phase 7, dit
deux choses.

**La première est rassurante.** Tout ce qui a été pensé aux plans 201 à 204 est en place et vivant :
l'entonnoir du salon avec **une cause de refus par compteur**, le chrono de tour, les **quatre
causes de forfait distinguées**, la reprise réussie contre la reprise échouée, la dégradation ICE,
la somme de contrôle **et son dénominateur**. Les treize compteurs en ligne ont tous au moins un
point d'émission réel — aucun déclaré-mais-mort. Et `battle_started` porte `mode`, `format`,
`humans`, `ai`, plus le `battleId` partagé entre pairs qui fait compter **une** partie et non deux.

**La seconde ne l'est pas.** Trois mécaniques livrées **après** cette conception n'ont jamais été
instrumentées — elles sont nées aux plans 209, 210 et 211, quand la télémétrie, elle, datait du 204 :

| Mécanique | Plan | Mesurée ? |
|---|---|---|
| Migration d'hôte | 209 | ❌ |
| Chrono de placement à 90 s, puis pose automatique | 211 | ❌ |
| Joueur éliminé : il regarde ou il part | 210 | ❌ |

### Pourquoi ça bloque la release plutôt que d'attendre

🔴 **Une mesure oubliée avant publication est une mesure perdue pour toujours.** Les premières
semaines sont les plus informatives — c'est là que les modes d'échec inconnus se manifestent, sur
des réseaux qu'on n'a pas, avec des joueurs qui ne font pas ce qu'on attend. Ajouter le compteur
après coup ne rattrape pas les données qu'on n'a pas prises.

Et la télémétrie s'est donné cette règle à elle-même, noir sur blanc dans `telemetry.ts` :

> **les délais du lot sont des paris**, arrêtés à la main faute de terrain […] « On ajustera à
> l'usage » n'est tenable que si l'usage se mesure, sinon on devine deux fois.

Or **le chrono de placement de 90 s est exactement un de ces paris**, et son frère — les 60 s du
chrono de tour — **est** mesuré par `turn-timed-out`. L'incohérence est directe : on a instrumenté un
pari et pas l'autre, pour la seule raison que le second est né deux plans plus tard.

La **migration d'hôte** est le cas le plus gênant des trois. C'est le mécanisme le plus récent et le
plus risqué du multijoueur — il réécrit **qui héberge en pleine partie**, il dépend d'un registre
externe, et son compare-and-swap a déjà été corrigé deux fois en recette (plan 209, puis la
migration en chaîne). On s'apprête à le publier avec **zéro signal de terrain**.

## Ce qu'il faut faire

### Lot A — Migration d'hôte

Compter le moment où un pair **devient** hôte par migration (jamais à la création : `Room.create` a
déjà `room-created`).

- **Où** : `packages/app/src/network/online-room.ts`, dans `holdOnlineRoom`. C'est le **seul** site
  qui traverse toutes les phases — la migration peut survenir en salle d'attente comme en plein
  combat, et ce fichier détient le salon des deux côtés de la transition d'écran. S'abonner par
  `room.onChange` et détecter la transition `Guest → Host`.
- 🔴 **Pas dans `packages/network`** : ce paquet ne connaît pas la télémétrie, et ne doit pas. C'est
  la même frontière que `maxSeats` et `rendezvous`, injectés depuis l'application.
- ⚠️ Compter la **transition**, pas l'état : `onChange` émet à chaque changement de salon, donc il
  faut mémoriser le rôle précédent, sinon un hôte compte à chaque événement.
- Nom proposé : `HostMigrated` → `"host-migrated"`.
- **Ce que ce chiffre répondra** : la migration arrive-t-elle vraiment, et aboutit-elle ? Croisé avec
  `forfeit-absent`, il dit si un hôte qui part est remplacé ou si la partie meurt avec lui.

### Lot B — Chrono de placement expiré

- **Où** : `packages/app/src/babylon/placement-flow.ts`, dans `onWindowExpired()`, à l'intérieur du
  `if (!phase.isPlayerDone(localPlayerId))` — on ne compte que si l'expiration a **réellement** posé
  quelque chose à notre place. Un joueur déjà prêt dont la fenêtre expire n'est pas un dépassement.
- Nom proposé : `PlacementTimedOut` → `"placement-timed-out"`.
- **Ce que ce chiffre répondra** : 90 s suffisent-ils pour poser son équipe ? Exactement la question
  que `turn-timed-out` pose pour les 60 s du tour. À lire rapporté au nombre de parties en ligne.

### Lot C — Le joueur éliminé, regarder ou partir

- **Où** : le dialogue à deux issues du plan 210 (`showEliminated`, `battle-chrome.ts` côté rendu ;
  le câblage est dans `combat-screen.ts`). Un compteur par issue.
- Noms proposés : `EliminatedKeptWatching` → `"eliminated-kept-watching"` et `EliminatedLeft` →
  `"eliminated-left"`.
- **Ce que ces chiffres répondront** : le mode spectateur sert-il à quelqu'un ? C'est une
  fonctionnalité entière livrée « sans une ligne de code » au plan 210 ; si personne ne reste, on le
  saura, et c'est une information de conception, pas un bug.
- ⚠️ Le seul des trois qui ne mesure **pas** un pari technique. Il vient en dernier.

### Lot D — Les trois libellés oubliés + tous les compteurs des lots A à F

`packages/telemetry-worker/src/report.ts` porte une table `Record<string, string>` qui nomme chaque
action dans le rapport. Trois compteurs **existants** n'y figurent pas et s'y afficheraient sous leur
clé brute :

- `checksum-mismatch`
- `checksum-compared`
- `room-failed-format_reduit`

Y ajouter aussi les compteurs des lots A à C, et l'événement du lot F (`battle-abandoned`).
**Ne pas oublier ce lot** : c'est précisément le genre d'oubli qui a produit les trois premiers.
Après ce lot, aucun événement émis ne doit s'afficher sous sa clé brute.

### Lot E — Les équipes aléatoires nourrissent la FORCE, jamais le GOÛT

**Ce que les chiffres ont dit** (production, 14 jours de mesure, lus le 2026-09-16) : sur 5 parties
terminées, **4 ont un `outcomes` vide**. Le bilan complet de deux semaines tient en deux lignes —
**une** attaque réellement lancée (Balle Graine), **une** cause de K.O. La cause est structurelle et
non accidentelle : `trackedSidesOf` ne retient que les camps `human-built`, et sur 44 camps observés
**6 seulement** l'étaient (24 aléatoires de l'IA, 14 aléatoires à contrôle humain). Croisé aux 77 %
d'abandon, environ **3 %** des parties produisent de la donnée d'usage. Le pari phare du plan 196 —
« attaques emportées ≠ attaques réellement lancées », qui révèle les attaques mortes — ne produit
rien, et n'en produira pas davantage après la release.

**Ce qui se joue, et pourquoi ce n'est PAS une entorse à la règle d'usage.** L'humain a posé une
limite nette le 2026-09-16 : *« je ne veux pas que les équipes aléatoires apparaissent dans les
usages des Pokemon et de leurs attaques »*. Elle est juste, et elle ne s'oppose pas à ce lot, parce
que deux questions distinctes se cachaient sous un seul mot :

| Question | Cohorte qui y répond | Pourquoi celle-là |
|----------|---------------------|-------------------|
| **Le goût** — qu'est-ce que les joueurs *choisissent* ? | Équipes bâties à la main, **et elles seules** | Une composition subie ne dit rien d'un choix |
| **La force** — qu'est-ce qui *gagne* réellement ? | Toutes les équipes humaines, aléatoires **comprises** | Un Pokemon distribué et non choisi est une **expérience contrôlée** : zéro biais de sélection |

C'est le renversement qui justifie le lot. Pour juger si un Pokemon est cassé, la donnée aléatoire
ne vaut pas *moins* que la donnée bâtie à la main — elle vaut **mieux**. Une équipe bâtie mesure la
force *polluée par la réputation* (on prend Dracaufeu parce que c'est Dracaufeu, puis on gagne, et
on ne sait plus si c'est le Pokemon ou le joueur). Une équipe aléatoire est un tirage : ce qu'elle
gagne, elle le gagne sur pièces.

- **Où** : 
  - `packages/app/src/analytics/team-telemetry.ts`, `trackedSidesOf` — élargir aux camps à
    contrôle humain **ET aléatoires** (`human-built` + `human-random` seulement, **jamais** `ai-random`).
    La logique : « si `side.controlledByHuman`, on track » au lieu de « si `side.team?.members !== undefined` ».
  - `packages/app/src/analytics/telemetry.ts` : dans `BattleTelemetry` ou `recordOutcome()`, capturer la
    provenance de chaque côté au démarrage du combat, puis la passer à chaque `TelemetryMemberOutcome` — le
    drapeau `source: "human-built" | "human-random" | "ai-random"` doit voyager de `battle_started` vers
    chaque événement d'`outcomes`.
  - `TelemetryMemberOutcome` — **ajouter le drapeau de provenance** (`source: string`) à chaque entrée.
- 🔴 **Le drapeau est le cœur du lot, pas un détail.** Sans lui, l'élargissement mélange les deux
  cohortes de façon irréversible et trahit la limite posée. Avec lui, le tri se fait **à la
  lecture** — conforme à la décision #868, qui veut un Worker qui ne comprend pas ce qu'il stocke.
- ⚠️ **Ne PAS élargir `teams[].members`** de `battle_started`. La composition d'une équipe aléatoire
  n'a aucune raison de voyager : elle ne dit rien du goût, et l'espèce voyage déjà dans `outcomes`
  pour ce qui nous intéresse. Le commentaire de `TelemetryTeam` — « on ne capture pas ce qu'il
  faudrait ensuite se souvenir d'exclure » — **reste vrai et reste en vigueur** pour ce champ-là.
- **Où, côté lecture** : `packages/telemetry-worker/src/report.ts`. Le rapport se scinde en **deux
  blocs qui ne s'additionnent jamais** :
  - `── Statistiques d'usage (équipes bâties à la main) ──` — `speciesUsage`, `abilityUsage`,
    `itemUsage`, `movesetUsage` (inchangés, ils lisent `teams[].members`) **et** `movesCast` filtré
    sur `source === human-built`. C'est le bloc du goût : **aucune équipe aléatoire n'y entre.**
  - `── Déroulé des combats (toutes équipes humaines) ──` — `knockOutCauses`, tour de chute, survie,
    et présence dans le camp vainqueur. C'est le bloc de la force.
- **Ce que ce lot répondra** : « quel Pokemon gagne quand personne ne l'a choisi », qui est la
  question d'équilibrage de la Phase 8, et qu'aucune quantité de données bâties à la main ne peut
  trancher seule.


#### Ce que le bloc « force » ne dira PAS — trois réserves à ne pas perdre

Relevées par `game-designer` le 2026-09-16, en lisant le code plutôt qu'en le supposant. Aucune
n'invalide le lot ; toutes changent la façon de **formuler** une conclusion.

1. **Le tirage d'espèce est bien uniforme — vérifié.** `generateRandomTeam` tire six espèces sans
   remise dans les 150 entrées jouables, sans pondération de type, de rôle ni de stade d'évolution.
   Mewtwo et Magicarpe ont la même probabilité. Le renversement du lot E est donc fondé.
2. ⚠️ **Mais le *build*, lui, n'est pas tiré au hasard.** `applyOpSetIfAvailable` prend
   systématiquement `opSets[0]` — le **premier** set du fichier pour cette espèce, toujours le même,
   alors que plusieurs espèces en ont jusqu'à huit. Les pré-évolutions sans set retombent sur les
   quatre premières attaques du movepool. Conséquence : le bloc de force ne mesure pas « la force de
   Dracaufeu », il mesure **« la force du build canonique de Dracaufeu »**. Le signal reste propre
   (le même build pour toutes les parties, donc comparable), mais conclure « ce Pokemon est cassé »
   quand c'est peut-être « ce build est mal calibré » serait une sur-lecture. Randomiser le build
   est un chantier à part, hors de ce plan.
3. ⚠️ **21 parties sur 22 se jouent contre l'IA.** Le bloc de force ne suit que les camps à contrôle
   humain — donc, en solo, un seul camp mesuré face à un adversaire jamais suivi. La quasi-totalité
   de ce qu'on lira répond à **« qu'est-ce qui bat cette IA »**, pas « qu'est-ce qui gagne en PvP ».
   Biais orthogonal à aléatoire/bâti, à nommer avant que le PvP ne donne des chiffres contradictoires
   sans qu'on sache pourquoi.
4. ⚠️ **La présence dans le camp vainqueur est un résultat d'ÉQUIPE.** Six membres, la qualité de
   l'adversaire, des synergies non voulues puisque le tirage est aléatoire. L'attribuer à un membre
   est plus confondu que la mort, le tour de chute ou les attaques lancées, tous imputables à
   l'individu. Signal d'appoint, jamais en tête de rapport.

#### Combien de temps avant que ces chiffres parlent — réponse honnête

Au rythme du 2026-09-16 (~1,6 partie/jour, ~1,4 camp humain/jour), une espèce donnée apparaît
**environ une fois tous les 17 jours**. Pour atteindre n=30 par espèce — encore une marge d'erreur
de ~9 points — il faut de l'ordre de **16 mois**. La réponse à « combien de temps » est donc : des
**mois, voire des saisons**, pas des semaines.

Ce qui se mesure vite, en revanche, ce sont les questions qui **poolent** tout le trafic au lieu de
le fragmenter par espèce : le taux d'abandon et sa posture (lot F), les causes de K.O. globales, la
durée et le nombre de tours. C'est là que la valeur immédiate du chantier se trouve — le croisement
par espèce est un investissement à long terme qu'il faut commencer maintenant *parce qu'*il est
long, pas parce qu'il rendra vite.

🔴 **D'où le seuil d'affichage** : le rapport tait tout taux de victoire sous **10 apparitions** et
affiche le `n` à côté de chaque ligne. Sans ce garde, un « 100 % de victoires » sur UNE apparition
s'afficherait comme un Pokemon cassé — exactement l'erreur que les chiffres du 2026-09-16 invitaient
à faire, où « une attaque lancée, une cause de K.O. » se lisait comme un signal alors que c'est du
bruit à n=1.

### Lot F — Mesurer l'abandon là où il arrive

**Ce que les chiffres ont dit** : **22 parties commencées, 5 terminées — 77 % d'abandon.** On
connaît le taux et rien d'autre, parce que l'abandon se mesure aujourd'hui par une **absence**.
Impossible de dire si les gens lâchent au tour 3 ou au tour 50, en perdant ou en gagnant. Les
parties qui vont au bout durent 36 tours et 11 min en moyenne, avec une à **37,5 min** : l'hypothèse
« c'est trop long » est plausible, et strictement invérifiable en l'état.

🔴 **Un nouvel événement, JAMAIS un `battle_ended`.** L'invariant « pas de `battle_ended` = abandon »
est documenté en toutes lettres sur `BattleEndedPayload.endReason`, et le plan 201 a déjà payé le
prix de l'avoir failli casser pour le forfait. Émettre un `battle_ended` au départ ferait sortir ces
parties du signal d'abandon pour polluer celui des victoires décisives. **L'absence reste le
signal** ; ce lot ajoute une ligne *à côté*, qui décrit le départ sans le requalifier en fin.

- **Nom proposé** : `EventKind.BattleAbandoned` → `"battle_abandoned"`. Porte le `battleId` (décision #880),
  donc se rapproche du `battle_started` correspondant exactement comme `battle_ended` le fait — l'abandon
  devient lisible par carte et par format, et non plus seulement en global. Type : `BattleAbandonedPayload`
  avec champs : `battleId`, `turns`, `durationMs`, `from`, `healthRatios` (dict side → ratio).
- **Trois champs**, les trois axes retenus par l'humain le 2026-09-16 :
  - `turns` et `durationMs` — **où** on lâche (tour et durée). Le collecteur les tient déjà tous les deux ;
    il n'y a rien à calculer, seulement à les sortir sans exiger que la partie soit finie.
  - `from` — **d'où** on part. **Quatre valeurs après revue de code**, pas trois :
    - `menu` — « Quitter », qui GARDE la sauvegarde : le joueur compte peut-être revenir ;
    - `abandon` — « Abandonner », qui la PURGE : départ définitif. **Oublié à la rédaction du plan**,
      et c'est le plus important des quatre : en solo — 21 parties sur 22 du trafic — « Abandonner »
      ne produit aucun `BattleEnded`, donc le geste le plus explicite de « j'arrête cette partie » ne
      laissait aucune trace portant le tour, la durée et les PV. Les confondre avec « Quitter »
      mélangerait les hésitants et ceux qui claquent la porte — or ce sont les seconds dont les 77 %
      parlent ;
    - `diverged` — **et non `disconnected`** : le seul appelant d'`onBattleInterrupted` est la
      divergence d'état. Une vraie perte de connexion se termine par un forfait, donc par un
      `battle_ended`, et n'émet jamais d'abandon. Une étiquette « déconnexion » aurait fait lire
      « les gens perdent leur connexion » à qui ouvrirait le rapport dans six mois ;
    - `tab-closed` — fermeture d'onglet, via `pagehide` et `sendBeacon`.
  - `healthRatios` — le rapport de PV restants **par camp** au moment du départ (ratio 0-1). Dit si on
    abandonne en train de **perdre** (frustration d'équilibrage, la Phase 8 doit le savoir) ou en train de
    **gagner** (partie trop longue, c'est un problème de rythme et pas de puissance). C'est le seul
    des trois qui distingue deux causes qui appellent des correctifs **opposés**.
- **Où** : 
  - `packages/app/src/analytics/battle-telemetry.ts` — une méthode `buildAbandonedPayload()` qui
    rend un payload **même si `ended` est faux** (c'est tout son objet), à partir de `turns`,
    `durationMs` (déjà présents dans le collecteur), `battleId`, et `healthRatios` (à calculer au
    moment du départ : PV restants / PV max par côté).
  - Le câblage vit dans **trois sites**, tous vérifiant `if (collector !== null)` avant d'émettre :
    1. `packages/app/src/babylon/combat-screen.ts`, dans `onBattleInterrupted` — interruption réseau
    2. `packages/app/src/babylon/combat-screen.ts`, dans la branche du menu (« Quitter ») — départ volontaire
    3. `packages/app/src/analytics/telemetry.ts` ou un hook `beforeunload`, via `sendBeacon` — fermeture d'onglet
       (respecte décisions #888/#889)
- 🔴 **L'exclusivité vaut par PAIR, pas par PARTIE** — relevé en revue de code, et c'est une nuance
  réelle. En ligne, un départ produit systématiquement les **deux** lignes sous le même `battleId` :
  le partant émet son `battle_abandoned`, et son adversaire, dont le délai de grâce expire, émet un
  `battle_ended` par forfait. Les deux ensembles de déduplication du Worker ne se croisent jamais.
  Conséquence : `battlesAbandoned` compte des **départs mesurés**, pas des parties abandonnées, et
  n'est pas le complément de `battlesEnded`. `abandonRate`, lui, ne bouge pas — il se calcule
  toujours par absence. En solo, 21 parties sur 22 du trafic, l'invariant est strict. Dit dans le
  type plutôt que corrigé : une logique inter-pairs coûterait bien plus que ce que ça rapporte.
- ⚠️ **Exclusivité stricte avec `battle_ended`.** Une partie émet l'un **ou** l'autre, jamais les
  deux : le collecteur est mis à `null` par `endBattleTelemetry()` (ligne `package/app/src/analytics/battle-telemetry-session.ts`),
  et la fermeture d'onglet qui suit une victoire ne doit pas produire un abandon fantôme. La vérification
  `if (collector !== null)` avant d'émettre un abandon (aux trois sites) la garantit.
  Un test doit le prouver — c'est exactement le genre de double comptage qui rend un taux faux sans que rien n'ait l'air cassé.
- ⚠️ **La fermeture d'onglet passe par `sendBeacon`**, comme la ligne `session` (décisions #888,
  #889). Ne pas inventer un second mécanisme de départ.
- **Ce que ce lot répondra** : les 77 % sont-ils un problème de rythme, d'équilibrage ou de
  découverte ? Trois correctifs différents, aujourd'hui indiscernables.

## Ce qu'il ne faut PAS faire

- ❌ **Ne pas ajouter `mode` à `BattleEndedPayload`.** C'est ce que demanderait
  `backlog-telemetrie-partie-a-cheval-sur-la-borne`, et le plan 204 se l'est explicitement interdit.
  Hors périmètre, et ça change la forme d'un message.
- ❌ **Ne pas toucher au Worker au-delà de la table de libellés** *pour les lots A à D*. Les actions
  sont comptées génériquement ; aucune liste blanche à maintenir côté serveur. Le lot E, lui, touche
  bien `report.ts` — c'est une **lecture**, pas une liste blanche : le Worker continue de stocker des
  lignes qu'il ne comprend pas, et c'est le rapport qui les range en deux blocs.
- ❌ **Ne pas faire émettre un `battle_ended` à une partie abandonnée** (lot F). L'absence est le
  signal ; la requalifier polluerait le taux de victoires décisives que lira la Phase 8.
- ❌ **Ne pas élargir `teams[].members` aux équipes aléatoires** (lot E). Seul `outcomes` s'élargit.
  Une composition subie n'est pas un choix et n'a rien à faire dans les statistiques d'usage.
- ❌ **Ne pas instrumenter la production pour rendre un test vert** — voir
  `feedback-agents-jamais-instrumenter-la-production`. Si un compteur est difficile à couvrir, le
  dire plutôt que d'ajouter un crochet.

## Comment on saura que c'est fait

- Les cinq nouveaux compteurs/événements (`host-migrated`, `placement-timed-out`,
  `eliminated-kept-watching`, `eliminated-left`, `battle_abandoned`) ont chacun **un point d'émission
  réel** — le contrôle de l'audit : un compteur déclaré et jamais émis est pire que pas de compteur,
  il donne l'illusion de la mesure.

  🔴 **Mais DEUX seulement ont un test de leur ÉMISSION, et il faut le dire plutôt que le maquiller.**
  `host-migrated` et `battle_abandoned` en fermeture d'onglet sont couverts en unitaire, au point
  d'émission. Les quatre autres — `placement-timed-out`, les deux issues du joueur éliminé, et
  `battle_abandoned` par le menu ou par divergence — vivent dans des fichiers Babylon sans harnais
  unitaire, et **aucun `countAction` n'est observable en e2e**.

  Ce n'est pas une lacune d'outillage, c'est la garde de plateforme qui rend la collecte muette hors
  d'`itch.zone` et `github.io` — celle-là même qui protège les statistiques de production des 500+
  tests e2e. Les deux façons de la contourner sont écartées : un crochet dans le code de production
  est interdit (`feedback-agents-jamais-instrumenter-la-production`), et détourner la résolution DNS
  ferait viser le **vrai** Worker, donc polluerait les vraies données au moindre raté d'interception
  — déjà écarté nommément au plan 204, pour cette raison.

  **Ce qui est couvert pour ces quatre-là, c'est le GESTE qui les déclenche** (§11.18, §12.12,
  §12.13, §12.15, §4.20), pas l'appel qui suit. Piste si on veut fermer le trou un jour : extraire un
  seam pur et minuscule côté `analytics/` — mais c'est une indirection créée pour le test, donc un
  arbitrage humain, pas une évidence.

  Reste aussi hors de portée, et sans signal possible : la moitié subtile de `placement-timed-out` —
  un joueur **déjà prêt** dont la fenêtre expire ne doit pas compter. Ce cas ne produit rien à
  l'écran, donc il n'y a rien à asserter.
- Le rapport n'affiche plus aucune clé brute.
- `pnpm stats` tourne et montre les nouvelles lignes.
- **Le rapport montre deux blocs distincts** (lot E), et le bloc d'usage ne contient **aucune**
  équipe aléatoire. Un test du Worker le prouve sur un jeu de lignes mêlant les deux provenances :
  c'est la limite posée par l'humain, elle mérite un test qui échoue si on la franchit.
- **Une partie quittée en cours émet `battle_abandoned` et PAS `battle_ended`** (lot F), et une
  partie gagnée puis dont l'onglet se ferme n'émet **pas** d'abandon fantôme. Deux tests.
- Gate full vert.

## Suite immédiate, hors de ce plan

~~L'humain veut **regarder les statistiques existantes** avant de publier.~~ **FAIT le
2026-09-16**, et c'est cette lecture qui a produit les lots E et F ci-dessus — la demande n'était
donc pas à côté du plan, elle en était la source. Ce qu'elle a montré, en plus des deux trous de
mesure : audience à **36 visites / 34 visiteurs uniques** en 14 jours, majoritairement **anglophone**
(en 18, fr 7, es 6), et **36 % de tactile** (Android 8 + iOS 5 sur 36) — la passe multi-entrée qu'on
s'impose est validée par le terrain. Usage monolithique : **22/22 des parties en 2v6**, 21/22 en solo
contre l'IA, et **64 % sur Arène Simple**, la première de la liste. Reste à savoir si c'est un choix
ou une inertie d'interface — question de conception, hors de ce plan. Voir l'entité
`plan-196` du graphe pour le dispositif, et `backlog-écart-résiduel-télémétrie-vs-compteur-itchio`
— cette mesure-là s'active **pile après** le redéploiement, donc après la release.
