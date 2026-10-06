# Multijoueur P2P — Architecture et design

> Document de référence **de l'état actuel** du multijoueur. L'historique (révisions du document,
> bumps de `NETWORK_VERSION`, mesures datées, correctifs de recette) vit dans le graphe de mémoire :
> `historique-versions-reseau-network-version`, `historique-multiplayer-md-revisions-et-corrections`,
> `implementation-multiplayer-*`.
> Décisions associées : #209-212 (fondations), #862-870 (cadrage), #895-912 (salon),
> #939-967 (combat, chrono, chien de garde, abandon, reconnexion), #968+ (somme de contrôle),
> #1024-1028 (FFA en réseau).

---

## Principes

1. **Zéro backend** — connexion P2P directe via WebRTC (PeerJS)
2. **Exécution dupliquée** — chaque joueur fait tourner son propre BattleEngine
3. **Seules les actions transitent** — pas d'état complet, pas de sync lourde
4. **Anti-triche par validation** — chaque joueur vérifie les actions de l'autre
5. **Détection de désync** — somme de contrôle de l'état de combat après chaque action

---

## Pourquoi P2P fonctionne ici

- **Tour par tour** — pas de contrainte de latence, pas de sync temps réel
- **Données minuscules** — une `Action` c'est ~100 octets JSON
- **Core déterministe** — même seed + mêmes actions = même état (prouvé par le système de replay,
  et **réellement verrouillé** depuis le plan 181, voir § Ce qui existe déjà)
- **Gratuit** — pas de serveur à payer ni à maintenir

## Pourquoi pas de serveur, même petit (décision #862)

Un arbitre léger a été envisagé (Supabase) pour trois jobs : appairage, horloge de tour faisant
autorité, détention du seed. **Écarté.** Le plan gratuit met les projets en pause après **7 jours
d'inactivité** — profil exact d'un jeu à joueurs sporadiques : le backend dort quand quelqu'un veut
jouer. Et le contournement classique (un cron GitHub qui réveille le projet) est lui-même désactivé
après **60 jours sans activité du dépôt** : le gardien s'endort précisément dans le scénario qu'il
devait couvrir.

Le coût réel n'était d'ailleurs pas que la pause : un compte à maintenir, des politiques RLS, le
premier backend d'un projet 100 % statique, et une politique de free tier qui peut changer sans nous.

**Cloudflare Workers** n'est pas un arbitre du combat : il sert la télémétrie, le registre des salons
et le relais de secours (§ Cloudflare Workers, § Télémétrie). Il n'a pas le comportement de mise en
pause.

---

## Architecture

```
Joueur A                              Joueur B
┌──────────────┐                    ┌──────────────┐
│  Renderer    │                    │  Renderer    │
│  BattleEngine│◄── WebRTC ────────►│  BattleEngine│
│  (sa copie)  │   actions only     │  (sa copie)  │
└──────────────┘                    └──────────────┘
```

Les deux joueurs ont le même BattleEngine avec le même seed PRNG. Quand un joueur joue, il envoie
**seulement son action** à l'autre. L'autre la valide et l'applique localement.

---

## Versionnage réseau

🔴 **`NETWORK_VERSION`** (`packages/network/src/protocol.ts`) **s'incrémente à la main** dès que toucher
au moteur, aux données de jeu, à l'IA ou au protocole peut faire diverger deux pairs. Elle est
comparée **strictement** à la poignée de main (`hello` / `welcome`, refus `version_incompatible`,
message symétrique : on n'accuse aucun des deux camps).

**La question à se poser n'est pas « ai-je touché `protocol.ts` ? »** mais « un pair d'hier et un
pair d'aujourd'hui calculeraient-ils la même chose ? ». Sont concernés : la forme d'un message, une
règle de lecture (ex. quand refuser une action, comment prononcer un forfait), un champ de l'état
**haché** par la somme de contrôle, et toute décision de l'IA (rejouée à l'identique chez chaque pair
depuis une graine partagée — son verdict fait partie du contrat). Un seul incrément peut couvrir
plusieurs commits d'un même lot : la version dit « ces deux builds ne jouent pas la même partie »,
pas « voici combien de fois on l'a touchée ».

**Pourquoi pas `buildVersion`** (#900) : `__APP_VERSION__` vient de `git describe`, change à
**chaque commit** et diffère entre les déploiements Pages et itch.io — refuser dessus interdirait le
jeu entre plateformes, et deux `git describe` ne s'ordonnent pas.

On l'oubliera au moins une fois ; le filet est la somme de contrôle (§ Détection de désync), qui
transforme l'oubli en erreur lisible au lieu d'un combat qui part en silence — mais elle ne remplace
pas la discipline, elle rattrape l'oubli une fois qu'il a eu lieu.

**Où écrire le POURQUOI de chaque incrément** : dans un commentaire de `protocol.ts` (« N → N+1,
date, plan, raison ») **et** dans l'entité du graphe `historique-versions-reseau-network-version`
(une observation par version). Pas dans ce document.

**Ce que les pairs doivent partager se publie, il ne se devine pas** : la carte résolue, le
`formatKey`, les graines — jamais redérivés localement depuis un état de salon qui peut différer.

---

## Flow d'une partie

### 1. Connexion (code de partie)

**Le code est l'adressage** (#898). L'hôte prend l'identifiant `pkmntac-<CODE>-1`, la place *n* est
`pkmntac-<CODE>-n`. Personne n'annonce qu'il est l'hôte : c'est le fait d'avoir pris la place 1 qui
le définit, et la prise d'identifiant étant exclusive, deux pairs ne peuvent pas s'en croire
titulaires tous les deux.

```
Hôte : menu → Combat → En ligne → lobby (« Créer »)
  → écran de sélection d'équipe : LE CODE NAÎT ICI, et s'y affiche
     (là où l'hôte attend, donc là où il le partage) ; la carte vient de ses préférences,
     le format d'ouverture est le duel, tous deux modifiables depuis la salle d'attente

Invité : menu → Combat → En ligne → lobby (saisie du code + « Rejoindre »)
  → il tente la place 2 ; prise → la place 3 ; etc. jusqu'au nombre de places du format
  → hello (version, place réclamée) → welcome (places occupées) → room_state (carte, format, options)
  → écran de sélection d'équipe, en salle d'attente
```

Trois propriétés tombent de ce seul choix d'adressage :

- **L'allocation de place sans arbitre** : le refus de l'annuaire **est** le mécanisme. Personne ne
  coordonne, et deux arrivants simultanés ne peuvent pas obtenir la même place.
- **Le maillage complet** (#899) : tout le monde joint tout le monde en connaissant le seul code —
  c'est ce qui fait qu'un hôte qui part n'emporte pas les connexions des autres entre eux.
- **La reconnexion sans serveur** : celui qui revient réclame **la même place**, à une adresse que
  les autres connaissent déjà.

Le code fait **5 caractères** d'un alphabet de 32 sans ambiguïté (les 26 lettres moins `I` et `O`,
les chiffres `2` à `9`), soit ~33 millions de combinaisons. Affiché d'un bloc (`A7K2M`), jamais avec
son préfixe.

⚠️ **Le préfixe n'est pas cosmétique** (décision #866). Sur le cloud gratuit PeerJS, les IDs vivent
dans un **namespace mondial partagé entre toutes les applications** : un code nu comme `A7K2M`
entrerait en collision avec n'importe quelle autre appli PeerJS. Le préfixe n'est jamais montré au
joueur, qui ne voit et ne saisit que la partie courte.

⚠️ **Toute prise d'identifiant qu'on s'attend à posséder réessaie** avec un délai croissant : après
une coupure, l'annuaire retient l'ancienne adresse quelques secondes, et sans ces réessais recharger
sa page suffirait à se voir refuser sa propre place. En revanche le **balayage** des places d'un
arrivant ne réessaie pas — là, « occupée » est la réponse normale, et insister ajouterait plusieurs
secondes par place déjà prise.

Pas de comptes, pas de matchmaking, **pas de lien d'invitation** (#895 : il serait construit depuis
l'origine courante, qui vaut `html-classic.itch.zone/…` dans l'iframe itch.io) : le code se partage
par Discord, SMS, ou tout autre moyen.

**La saisie du code passe par une roue de caractères** — cinq emplacements montrant leurs voisins
d'alphabet — et non par un champ texte. Motif : un champ texte n'est **pas saisissable à la manette**
(choix explicite du projet), donc garder les deux aurait voulu dire échanger un sous-arbre DOM selon
la source active, et perdre le focus à chaque bascule. Un seul widget sert les quatre entrées : les
lettres au clavier, les directions et `A` au pad, la tape au doigt, le clic et la molette à la souris.

### 2. Sélection d'équipe

**Il n'y a pas d'écran de salon séparé** (#897) : l'écran de sélection d'équipe **est** la salle
d'attente. Ce qu'il gagne en mode réseau :

| Ajout | Détail |
|---|---|
| Le code, en évidence, avec « Copier » | C'est là que l'hôte attend, donc là qu'il partage |
| Encart de paramètres | Carte (nom), format, placement auto, prévisualisation de dégâts. Modifiable par l'**hôte** tant que personne n'est prêt, en lecture seule pour les autres |
| Une ligne dit **qui la tient**, pas ce qu'on pourrait y choisir | « 👑 Joueur hôte », « 🎮 Vous », « 🌐 Joueur distant » remplacent le segment Humain / IA sur toute place tenue par un humain, **sur la largeur entière**. Seules les places libres et IA gardent le segment, et seulement chez l'hôte : plus aucun contrôle grisé sans raison lisible |
| « ⏳ Place libre » | Personne encore. Ne bloque pas le lancement, part en IA au `start` |
| Les équipes des **autres humains sont masquées** | Fuite d'information, sinon : le jeu masque déjà l'objet tenu et le talent de l'adversaire (#729). On voit la sienne et celles que personne ne tient |
| **Tout le monde a « Prêt / Pas prêt »**, l'hôte compris | Lui seul garde « Lancer » en plus. Et c'est **sa** confirmation qui gèle les paramètres de partie — réversible d'un « Pas prêt ». Les geler sur le « prêt » d'un invité lui retirait une décision qui n'était pas la sienne |
| « Prêt » | Remplace « Lancer » pour les invités. L'hôte garde « Lancer », actif quand tout le monde est prêt, et peut **forcer** en repassant les lignes qui traînent en IA |

```
Chacun compose les lignes qu'il possède : la sienne, plus les lignes IA pour l'hôte
  → chaque sélection est annoncée au salon
  → l'hôte grave le setup et le diffuse (`start`)
  → chaque pair ACCUSE réception (`start_ack`)
  → l'hôte n'entre en combat que lorsque tous ont accusé, et annule sinon
```

Le setup diffusé porte : l'**identifiant stable de carte** (jamais l'URL — elle dépend de la base de
déploiement et n'est pas un contrat entre deux pairs), le format (`formatKey`), les options de
partie, la composition de **chaque** place, les **quatre graines** (combat, placement, IA, équipe) et
un `battleId` (télémétrie).

🔴 **Le lancement doit être accusé** (#903). Sans accusé, un pair qui manque le `start` reste sur
l'écran d'équipe pendant que les autres jouent, et aucun moment n'existe où quelqu'un s'en aperçoit.

🔴 **Aucun tirage local sans graine venue de l'hôte** (#902) : le placement automatique, l'IA et le
tirage d'équipe « Aléatoire » dérivent tous d'une graine du `start`. Un tirage propre à chaque pair
donnerait deux plateaux différents avant le premier tour.

**Le niveau de l'IA se choisit place par place** (`aiDifficulty`, optionnel sur `NetworkSeatState` et
`StartSeat`). 🔴 **On ne pose pas la clé plutôt que de l'écrire à `undefined`** : la sérialisation
BinaryPack de PeerJS transforme un `undefined` en `null` sur le fil, et le garde de type rejetait
alors le `room_state` en entier.

**L'équipe « Aléatoire » n'est qu'une intention** (`NetworkTeamSelection.random`) : l'équipe ne
transite jamais, chaque pair la dérive localement à partir de la graine `team` de la place. Le tirage
est **différé au lancement** pour tous les camps aléatoires, IA comprise, solo comme en ligne — une
équipe aléatoire non tirée n'est pas cachée, elle n'existe pas encore (ce qui laisse intacte #729).
Règles à respecter :

- `deriveTeamSeedsBySeat` (copie conforme de `deriveAiSeedsBySeat`, via `deriveSeedsBySeat` : toutes
  les places dérivées d'un coup, dans l'ordre croissant, jamais à la demande) doit rendre des
  **entiers** : `createPrng` commence par `seed | 0`, une graine flottante de `[0, 1)` s'y écraserait
  à zéro et toutes les places tireraient les mêmes Pokemon — sans désync, donc sans signal en jeu.
- `id` et `createdAt` d'une équipe tirée (non déterministes) restent **hors** du `BattleState` :
  `generateRandomTeamSlots` ne rend que les six emplacements, jamais l'enveloppe `TeamSet`, sinon la
  somme de contrôle diverge à la première vérification.
- Le pool du tirage : Pokemon au dernier stade qui ont un build, une espèce par famille, objets
  uniques (decision-1136).

**Le niveau appartient au Pokemon** (`BattleSetupConfig.levelOverrides`, par emplacement) et c'est le
**format de partie** qui le normalise : `BattleFormatRules.adjustLevel`, posé à 50 par le mode Combat
dans `buildBattle` — le chemin que la partie vive et la reprise partagent. La formule de dégâts lit
`attacker.level`.

### 3. Combat

```
Tour du joueur A :
  1. A choisit une action via l'UI (comme en local)
  2. A envoie l'action à B : { type: "action", data: Action }
  3. B reçoit l'action
  4. B vérifie : action in getLegalActions() ?
     Oui → B fait submitAction() localement
     Non → triche détectée (compteur++)
  5. Les deux renderers jouent les events

Tour du joueur B :
  (symétrique)
```

### 4. Fin de partie

```
Chaque moteur détecte la victoire indépendamment, à N camps comme à deux
  → Affichage de l'écran de victoire
  → Option : changer d'équipe, quitter (`rematch` reste hors V1, voir § Protocole de messages)
```

⚠️ **Un camp éliminé avant la fin ne ferme rien.** La partie continue tant qu'il reste au moins deux
camps vivants (`checkVictory`, `playersAlive.size <= 1`). Le joueur éliminé voit un dialogue à deux
issues — retour au menu / mode spectateur, caméra libre (plan 210 : graphe, `plan-210`). Un combat en
ligne pose `reviveDefeatedCamps: false`.

---

## Protocole de messages

`packages/network/src/protocol.ts`. L'union des messages :

```typescript
type NetworkMessage =
  | { type: "hello"; networkVersion: number; seat: number }
  | { type: "welcome"; networkVersion: number; occupiedSeats: readonly number[] }
  | { type: "room_state"; options: NetworkRoomOptions; seats: …; locked: boolean }
  | { type: "team_select"; seat: number; selection: NetworkTeamSelection }
  | { type: "ready"; seat: number; ready: boolean }
  | { type: "start"; options: …; seeds: NetworkSeeds; seats: readonly StartSeat[] }
  | { type: "start_ack"; seat: number }
  | { type: "bye"; seat: number }
  | { type: "action"; seat: number; actionIndex: number; action: Action }   // + timedOut?: true
  | { type: "forfeit"; seat: number; forfeitedSeat: number; reason: NetworkForfeitReason }
  | { type: "resync_request"; seat: number; actionIndex: number }
  | { type: "resync"; seat: number; fromIndex: number; actions: readonly Action[] }
  | { type: "checksum"; seat: number; actionIndex: number; digest: string }
  | { type: "placement"; seat: number; placements: readonly NetworkPlacement[] };
```

(`start` porte aussi `battleId` et `formatKey`, voir ci-dessous.)

- **`action`** : `actionIndex` est le nombre d'actions enregistrées chez l'émetteur **avant** celle-ci —
  un détecteur de désync du pauvre (D3) qui dit « nous ne sommes pas au même point » au lieu
  d'appliquer une action au mauvais acteur. `timedOut?: true` est auto-déclaré par l'émetteur
  (#955). Un **tampon de réordonnancement par index** absorbe l'ordre de livraison d'un maillage
  (le Charge Time fournit l'ordre *logique* : un seul acteur à la fois, #1024).
- **`forfeit`** : `forfeitedSeat` désigne la place éliminée, qui n'est pas celle de l'émetteur quand
  c'est un constat de divergence.
- **`resync_request` / `resync`** : le rattrapage d'un revenant — « j'en suis là, donne-moi la suite » /
  la queue du journal.
- **`checksum`** : voir § Détection de désync.
- **`start.battleId`** : tiré par l'hôte, **transporté sans jamais être lu** par `packages/network` ;
  il sert à la télémétrie, pour que les `battle_started` / `battle_ended` des deux pairs se rattachent
  à la même partie (une partie en ligne compterait sinon pour deux).
- **`start.formatKey`** : publié par l'hôte, jamais redérivé par chaque pair (en mode carte
  « Aléatoire », l'invité dériverait depuis une carte qui n'est pas celle jouée). `launch()` refuse
  un format vide comme il refuse la sentinelle de tirage, et l'écran de combat **jette** au lieu de
  replier sur le premier format de la carte quand la partie est en ligne.
- **La carte « Aléatoire »** : en ligne, l'hôte peut la tenir secrète jusqu'au lancement ; le
  `room_state` annonce la sentinelle, mais le message `start` publie toujours la carte **résolue**.

### Le message `placement`

Le placement d'un camp **en un seul envoi**, émis quand ce joueur a fini — pas une pose à la fois. Le
placement en ligne est **simultané** (chacun pose quand il veut, on démarre quand tous ont fini) et
**caché** jusqu'au lancement. Le repli du chrono emprunte le même chemin : à l'expiration, le client
pose lui-même ce qui reste et envoie ce message. Trois règles :

- **Une place ne pose qu'une fois.** Un deuxième message pour la même place vient d'un revenant qui
  rediffuse après reconnexion ; le rejouer doublerait ses Pokemon. Le premier reçu fait foi
  (`placedSeats` dans `room.ts`).
- **Avec tampon**, comme les actions et contrairement aux empreintes : un placement n'est jamais
  périmé, et l'écran qui s'abonne tard doit le recevoir. C'est même le cas courant — les écrans ne se
  montent pas au même instant.
- 🔴 **L'ordre de réception ne devient JAMAIS l'ordre d'application.** Les poses sont rangées par
  place croissante avant que le moteur ne soit bâti (`getPlacements()` du core). Deux pairs qui
  appliqueraient les mêmes poses dans deux ordres différents construiraient deux états différents,
  et le détecteur de désync tuerait la partie avant le premier tour.

### Ce qui reste hors V1

`rematch` et `chat`. Le **nom de joueur est écarté de la V1** (#906) : il revient avec le compte et
le classement ; la salle d'attente affiche « Joueur 2 ».

🔴 **En attendant `rematch` : « Recommencer » est GARDÉ, pas câblé** (#1038). Le menu de combat et le
menu du placement n'offrent l'entrée que hors ligne — son rappel (`onReplay` du chrome) remonte le
setup en local, ce qui donnerait un hot-seat sur les deux camps avec le salon encore tenu. Une option
absente (`onRestart?`), jamais un booléen `canReplay` sur l'entrée elle-même : un appelant ne peut pas
cacher l'entrée en gardant le rappel vivant. Même garde des deux côtés (`localPlayerIds === undefined`
en combat, `setup.localSeat === undefined` au placement) ; le dialogue de victoire la porte déjà
(`canReplay`).

**Pas de message `timeout`** — c'est délibéré, voir § Chronomètre.

**Le déverrouillage du salon EST le message d'annulation du lancement.** Il n'y en a pas de
troisième : un invité entre en combat dès le `start` (il n'a aucun moyen de savoir où en sont les
autres), et un `room_state` déverrouillé le ramène à la salle d'attente si l'hôte a dû annuler.

**Les causes de refus sont une énumération fermée** — `code_introuvable`, `salon_plein`,
`partie_commencee`, `version_incompatible`, `connexion_impossible`, `delai_depasse` — et ce sont
aussi les valeurs envoyées en télémétrie : jamais de texte libre, sinon le rapport devient
inagrégeable.

---

## Chronomètre de tour (décisions #864, #865, #946-#950)

Il y a un chrono. Il est **local et auto-déclarant** : quand le tien expire, **ton propre client
soumet l'action par défaut** (passer le tour) et la diffuse comme n'importe quelle autre action.
L'autre pair reçoit une action ordinaire et la valide comme le reste.

| Réglage | Valeur | Motif |
|---|---|---|
| Durée | **60 s** | Une seule fenêtre doit couvrir déplacement + sous-menu + choix d'attaque + visée + confirmation + orientation, au pad et au doigt, sur une grille iso avec hauteurs. Le 45 s du VGC est un précédent pour un **choix unique**, pas pour un tour tactique multi-étapes |
| Portée de la fenêtre | **Une par tour**, jamais rejouée | `enterActionMenu()` est rappelé à **chaque étape** du tour et sur chaque annulation ; redémarrer le compte à rebours dessus permettrait de geler la partie en annulant en boucle |
| Repli au timeout | **`EndTurn`, orientation courante** | Aucune décision de jeu prise à la place du joueur, action toujours légale, traverse le replay sans cas particulier. **Pas `CT_WAIT` / « Attendre »** : cette action est illégale si `hasMoved` ou `hasActed`, un timeout survenant après un déplacement déjà validé se ferait refuser par le moteur |

Deux conséquences heureuses :

- **Aucun ajout au protocole.** Pas de message `timeout`, pas d'arbitrage, pas de question
  « qui fait autorité sur l'horloge » — la question la plus embarrassante du P2P sans arbitre.
- **Ça traverse le replay tout seul.** L'action de timeout entre dans `exportReplay()` comme les
  autres → la reprise du plan 181 la rejoue à l'identique, sans cas particulier.

⚠️ **La dérive d'horloge ne protège que de ton PROPRE chrono, pas du chien de garde d'en face.** Tu
démarres ton chrono en finissant d'appliquer l'action précédente, le pair distant démarre le sien en
la **recevant** ~150 ms plus tard : son chrono expire après le tien. Mais si tu mets ton onglet en
arrière-plan **pendant ton propre tour**, ton minuteur ralentit (Chrome ~1/s, puis ~1/min après 5 min
d'inactivité) donc tu ne t'auto-passes pas — alors que le chien de garde de l'adversaire tourne sur
**sa propre** horloge murale en temps réel et te forfaite à 75 s, connexion intacte. **Risque
assumé** : passé cinq minutes d'arrière-plan pendant son propre tour, le joueur *est* parti.

🔴 **Parade retenue : une échéance en horloge murale, jamais un `setTimeout` unique de 60 s.**
L'orchestrateur retient `deadlineAt = now() + durationMs` et se réveille périodiquement (250 ms)
pour comparer, plutôt que de planifier un unique minuteur de 60 000 ms qui se déclencherait très en
retard sur un onglet ralenti. Avec une échéance, un réveil tardif constate immédiatement le
dépassement et soumet l'action au lieu d'attendre un minuteur suivant.

### Ce que le chrono ne couvre pas — et ne doit pas essayer

Le pair déconnecté, l'onglet gelé, le client patché qui n'envoie rien : ce n'est pas un problème de
chrono, c'est le problème de **déconnexion** (§ Gestion de la déconnexion). Deux mécanismes séparés :

| | Rôle | Déclenche |
|---|---|---|
| **Chrono de tour** | rythme, anti-AFK | ton client soumet « passer le tour » |
| **Chien de garde de connexion** | anti-déconnexion | « En attente de reconnexion… » puis forfait |

⚠️ **« Onglet gelé » recouvre deux réalités, à ne pas confondre** : le *ralentissement* des
minuteurs de navigateur (couvert par la marge du chien de garde ci-dessous) et le **déchargement
complet** de l'onglet sous pression mémoire iOS, qui détruit le contexte JS et la connexion WebRTC.
Le premier se rythme ; le second n'a rien à voir avec le chrono, c'est le chemin de reconnexion
(§ Gestion de la déconnexion).

Le chien de garde vaut **chrono + 15 s = 75 s** au premier déclenchement — la marge de #865, qui
couvre l'animation d'une attaque de zone à plusieurs cibles plus une latence honnête — sinon un
paquet lent honnête le déclenche à tort.

**Surface de triche assumée** : un client qui s'octroie cinq minutes n'est puni par rien
d'automatique. Le joueur honnête peut toujours quitter — suffisant à cette échelle.

🔴 **Asymétrie `CT_WAIT` assumée.** Passer le tour au timeout coûte `CT_WAIT` = 350, le coût **le
plus bas de toute la table** (`packages/core/src/battle/ct-costs.ts` : déplacement seul 400,
attaque seule ≥ 500, combo ≥ 750) : le timeout est donc l'action **la plus rentable en tempo de
jeu**. Effet plateau nul (aucun déplacement, aucun dégât), aucun move ni talent du roster ne
récompense l'attente pure — asymétrie assumée plutôt que d'ouvrir un `CT_WAIT` propre au réseau
pour un gain nul.

**Le chrono du tour adverse s'affiche aussi.** Écart délibéré d'avec Pokémon Showdown, qui cache le
temps de l'adversaire : Showdown est à choix simultané, où le temps de réflexion trahit
l'incertitude, alors qu'ici le tour est séquentiel et le plateau visible — on est plus près d'une
pendule d'échecs, où les deux cadrans se voient toujours.

Ouvrir le menu de combat **grignote le temps du joueur**, rien n'étant mis en pause (#819, un seul
comportement dès le solo) : une pastille « le temps continue » l'annonce sur la modale.

---

## Fog — cosmétique en ligne (décision #863)

Le fog ennemi existe (plan 176) : PV en pourcentage seul, objet tenu et talent en `???` tant qu'ils
ne sont pas révélés. Mais il est appliqué **côté vue** (`packages/view-core`) —
`BattleEngine.getGameState(_playerId)` reste un passthrough qui ignore son argument et rend l'état
complet par référence.

En exécution dupliquée, **chaque pair détient donc l'état complet**, et un client modifié voit à
travers le fog : PV exacts, objet, talent.

**Décision : on assume.** Le fog reste une rétention d'affichage, pas un secret — il fuit déjà en
local par le journal de combat et les dégâts flottants, qui gardent leurs chiffres absolus
(conséquence assumée de #728). Rendre le fog réel exigerait un moteur côté serveur, c'est-à-dire le
serveur autoritaire écarté en #862. On vise petit : le jeu se joue entre gens qui se sont échangé un
code, et quelqu'un d'assez motivé pour patcher le client joue contre des amis qui peuvent arrêter de
jouer avec lui. **À revisiter seulement si une communauté compétitive apparaît.**

### Le placement caché est de la même famille — mais pas du même ordre de grandeur (plan 211)

Le placement en ligne est **caché jusqu'au lancement** : chacun pose à l'aveugle, tout se révèle au
passage au combat. Comme le fog, ce caché est **un caché d'écran, pas un secret**. Le message
`placement` part en clair dès qu'un joueur a fini, donc qui termine en 10 s a son placement complet
dans la mémoire du client d'en face pendant tout le reste de la phase. Un client honnête ne l'affiche
qu'au lancement ; un client modifié a déjà tout.

**Décision : on assume**, même modèle de confiance que ci-dessus (arbitrage humain).

🔴 **Mais ne pas confondre les deux fuites.** Le fog laisse filer des PV exacts, un objet, un talent :
des détails chiffrés, qui se révèlent de toute façon au combat. Ici, c'est **tout le déploiement
adverse**, et la fuite ne dégrade pas une information, elle **défait la prémisse entière de la
phase** — « personne ne peut adapter son placement à celui d'en face » devient faux pour qui triche.
Même nature de décision, deux ordres de grandeur d'écart.

**La parade existe et a été écartée sciemment** : envoyer une *empreinte* de son placement en
finissant, et les positions en clair seulement quand tout le monde est prêt — chacun vérifiant
ensuite que l'empreinte correspond. Coût : un message de plus et un tour de protocole. Écartée parce
que le modèle de confiance ne la réclame pas. **À ressortir telle quelle** le jour où le jeu
s'ouvrirait à des inconnus — compte, classement, mise en relation automatique — c'est-à-dire la même
condition que celle qui ferait revisiter le fog.

---

## Anti-triche

### Validation des actions

Chaque action reçue est validée. **Quatre contrôles**, du moins cher au plus révélateur :

```
action reçue → même index d'action que chez nous ?        non → refus (desynced_index)
             → l'acteur courant est-il de ce camp ?        non → refus (not_this_seat)
             → dans getLegalActions(), RETRAITE EXCLUE ?   non → refus (not_legal)
             → submitAction() l'accepte ?                  non → refus (engine_refused)
             → sinon appliquée, et le compteur retombe à 0
```

🔴 **Pas de « rejeter, redemander »** (D1) : `executeAction` soumet à son propre moteur **puis**
diffuse, donc quand on refuse, l'émetteur a déjà avancé — renvoyer la même action ne répare rien, on
est déjà divergents. Le barème :

| Refus **consécutif** | Effet |
|---|---|
| 1er | journal seulement — un bug de notre côté est plausible |
| 2e | avertissement visible, avec le compteur (« 2/3 ») |
| 3e | le camp est éliminé (`engine.forfeit`) et le constat est diffusé |

Un succès **remet le compteur à zéro** : un hoquet isolé n'élimine personne, et un pair réellement
divergent voit **tout** refusé, donc atteint trois d'affilée en trois tours.

⚠️ **La retraite est exclue de la comparaison** (`canonicalActionKey`) : `getLegalActions()` ne porte
que la case visée, l'orchestrateur ajoute `retreatPosition` après coup et le moteur la valide seul.
L'inclure refuserait **Demi-Tour, Change Éclair et Eau Revoir**, éliminant un joueur honnête en trois
attaques.

🔴 **Ce n'est pas une accusation de triche** (D5). En 1v1, personne ne peut dire qui s'est écarté —
un client modifié peut *feindre* de constater une divergence. Le message porte donc la cause
`diverged` et le joueur lit « les parties ne concordent plus », jamais « vous avez triché ». Même
symétrie que le refus de version (#900).

**Ce que le modèle n'attrape pas, et qu'il faut assumer** : côté émetteur, une action refusée ne
coûte rien — son moteur local l'a acceptée. Le seul qui paie est le récepteur, en attente. Un pair
qui refuse délibérément des actions **légitimes** élimine donc l'autre à coût nul, et `forfeitedSeat`
n'étant pas authentifiable, il peut même le désigner directement. Sans effet dans le cadrage du jeu
(§ Fog, #863) ; le recours serait du côté de la somme de contrôle.

### Détection de désync

À **chaque action complétée** (`CHECKSUM_EVERY_N_ACTIONS = 1`), plus une empreinte au lancement
(`actionIndex` 0, après le placement) : les pairs comparent un hash de leur `BattleState`.

```
battleStateChecksum(state) chez A === battleStateChecksum(state) chez B, au même actionIndex ?
  Oui → rien ne se passe (ni message ni journal)
  Non → constat de divergence (NetworkForfeitReason.EtatDivergent) — « les parties ne concordent plus »
```

En **duel**, le constat de divergence ne prononce pas de forfait bilatéral : il **ARRÊTE la partie sans
vainqueur** (« Partie interrompue », decision-1060), à l'émission comme à la réception. À 3 camps et
plus, la comparaison devient un vote — voir § 3+ joueurs, « Le désaccord à N témoins ».

🔴 **Constat, rien de plus — pas de reconstruction depuis le replay.** En 1v1 personne ne peut dire
qui s'est écarté (#943), donc « réparer » voudrait dire adopter la version d'en face sans preuve, et
le rattrapage du journal (`resync`) n'envoie que la queue des actions, pas l'état complet. Le but —
rendre l'écart **lisible** au lieu de silencieux — est servi sans reconstruction.

**Sérialisation canonique** (`packages/core/src/battle/state-checksum.ts`, pur, générique et
récursif — jamais une projection énumérée des ~100 champs de `PokemonInstance` ; il vit dans le core
parce que c'est un module qui connaît la forme de l'état, decision-971) : clés d'objet triées par
point de code, clés à valeur `undefined` omises (charnière : `handleKo` remet une vingtaine de champs
à `undefined` plutôt que de les supprimer), `Map` triée par clé et émise en liste de paires,
**tableaux non triés** (leur ordre est sémantique — `fieldTerrains`, `statusEffects`, `auras`),
flottants quantifiés à un nombre fixe de décimales, `-0` normalisé en `0`, `NaN`/`Infinity` levés
comme erreur. Toute la grille est incluse, `height`/`terrain` compris. Hachage **non cryptographique**
(FNV-1a 64 bits) : détecte la divergence accidentelle, ne résiste à aucune contrefaçon — cohérent avec
#943, rien n'étant authentifié de toute façon. Coût : **0,299 ms** par empreinte sur `simple-arena`
(12×20 = 240 tuiles, 4 Pokémon), texte canonique de 25 330 caractères ; la plus grande carte
(`le-mur`, 16×16) est à ×1,1 — la cadence de 1 action est confirmée par le chiffre (#969).

🔴 **Ce n'est pas un anti-triche, et la cadence n'y change rien.** Rien ne lie l'empreinte émise à
l'état réellement détenu — un client modifié fait tourner un état honnête à côté et émet l'empreinte
honnête. Ce qui empêche de tricher reste la validation d'actions (#211). Le seul gain contre un
menteur : un constat de divergence **fabriqué** alors que les empreintes concordent devient
contredisable (nuance à #943).

Deux compteurs de télémétrie, et il en faut bien deux (#976) : `checksum-mismatch`, distinct de
`forfeit-diverged` — leur **écart** dit combien de forfaits pour divergence viennent d'actions
refusées plutôt que d'une désync d'état muette ; et `checksum-compared`, compté une fois par combat
où au moins deux empreintes ont été confrontées. Ce dernier est le **dénominateur** : sans lui, un
`checksum-mismatch` à zéro serait indiscernable de « aucune comparaison n'a jamais eu lieu », et le
seul chiffre censé mesurer le déterminisme ne prouverait rien.

---

## Gestion de la déconnexion

### Déconnexion temporaire

```
Joueur B disparaît
  → Combien de temps A l'attend, selon COMMENT il a disparu :
      · silence, aucun `bye` reçu (câble arraché, onglet gelé) ...... 75 s = chrono + 15 s de marge
      · fermeture d'onglet, un `bye` est arrivé ...................... 30 s (`BATTLE_GRACE_SHORT_MS`)
      · deuxième chute de la même place ............................. 30 s (le même chiffre)
  → Joueur A voit "En attente de reconnexion..." avec le décompte du délai réellement accordé
  → Si B reconnecte : resync via replay (actions manquées, pas tout le journal)
  → Si le délai expire : victoire par forfait pour A
```

(Décisions #950-#952, #954-#955, #957, #960, #961.)

### Le seuil d'absence à N camps (décision #1028)

Le chien de garde ci-dessus couvre le silence réseau ; **un pair présent sur le fil mais qui laisse
passer son tour** (écran verrouillé, alt-tab prolongé) est couvert séparément par
`missedTurnLimitFor(teamCount)` (`online-battle.ts`) : un camp est forfaité au bout de **tours
manqués consécutifs**, avec un avertissement affiché à l'avant-dernier — même patron que le « 2/3 »
des refus de divergence.

```
missedTurnLimitFor(teamCount) = 3 si teamCount <= 2, sinon 2
```

🔴 **Ce n'est pas une proportion, c'est une marche.** Le seuil compte des **tours**, pas des minutes,
et l'écart entre deux tours d'un même camp croît avec le nombre de camps : le Charge Time fait
toujours agir douze combattants par round quel que soit le format (`MAX_POKEMON_PER_BATTLE`), donc à
60 s par tour, 3 tours manqués valent ~6 min en duel mais ~36 min à douze camps — une place morte
occuperait sa place plus d'une demi-heure et déciderait du sort des autres. Une vraie proportionnalité
(« ~6 min quel que soit le format ») donnerait **1 seul tour toléré** dès six camps, donc éliminer sur
un accident isolé — exactement ce que le mécanisme existe pour éviter. Le plancher de **deux** est un
compromis assumé : ~6 min en duel, ~24 min à douze. ⚠️ Les autres camps ne sont pas bloqués pendant
ce temps, ils jouent — seule l'**occupation de la place** est le problème, pas un temps mort partagé.

La forme définitive reste ouverte : elle attend une mesure de cadence réelle, la télémétrie n'ayant
jamais observé que du 1v1.

### Signal précoce, avant le chien de garde (décision #956)

`connectionState` de la `RTCPeerConnection`, exposé par PeerJS, donne un signal **gratuit et bien
plus rapide** que le chien de garde : ICE Consent Freshness (RFC 7675) fait émettre une requête
STUN toutes les 5 à 15 s sur le chemin établi, donc `connectionState` passe à `disconnected` en
~5 s sans réponse, puis à `failed` vers ~30 s — sans aucun message de protocole ni battement de
cœur applicatif à écrire, le navigateur le calcule déjà. Il alimente le bandeau (« connexion
instable »), il ne déclenche **jamais** de forfait à lui seul : `disconnected` se rétablit souvent
tout seul, et éliminer quelqu'un sur un état rétablissable serait pire que d'attendre le chien de
garde.

### Reconnexion (plan 181)

La reprise de combat en cours (plan 181) est le chemin dont la reconnexion se sert :

- la sauvegarde est `{ setup + seed + actions }`, jamais de l'état dérivé ;
- `resumeBattle` reconstruit le moteur avec `creationRng: createPrng(seed)`, rejoue les actions,
  reconstruit le journal, refait apparaître les billboards depuis l'état du moteur ;
- la persistance est un **port** `load` / `save` / `clear` (décision #751), pas un accès direct à
  `localStorage` — donc la source du journal peut changer sans toucher à l'écran de combat.

En multijoueur, le pair qui revient rejoue par **ce même chemin**. Le setup diffusé porte
l'**identifiant stable de carte** (jamais l'URL, § Sélection d'équipe) et la version de protocole au
handshake est `NETWORK_VERSION`, **pas** `buildVersion` (§ Versionnage réseau) — `buildVersion` reste
le garde-fou du solo (décision #748), un autre mécanisme.

**Politique de reconnexion en combat.** Contrairement au salon, fermer l'onglet (la croix) **ne
déclare aucune intention** — l'intention se déclare par le menu de combat (« Abandonner »,
« Quitter »). D'où : **75 s** après un **silence** (aucun `bye` reçu), et **30 s**
(`BATTLE_GRACE_SHORT_MS`) dans les deux autres cas — une **fermeture d'onglet**, ou une **deuxième
chute** de la même place. Le **salon**, lui, garde ses délais (#905) : 10 s après un `bye`, 45 s après
un silence — là, la place se libère et personne ne perd de partie.

🔴 **Le combat ne réutilise PAS `GRACE_AFTER_SILENCE_MS` (45 s), malgré la ressemblance des
valeurs** (#950). Un délai de 45 s tomberait pile quand un chrono honnête de 60 s approche de son
échéance : le joueur qui joue à la dernière seconde passerait pour absent (#865). Le chien de garde
de combat est **dérivé du chrono lui-même** (chrono + 15 s).

🔴 **Le `bye` de fermeture d'onglet vaut 30 s en combat, et non 10 s** (#961). Fermer sa fenêtre
poliment ne doit pas donner **moins** de temps à l'adversaire qu'arracher son câble ; la croix, c'est
l'accident que la reprise existe pour absorber. Et 30 s plutôt que 75 : celui qui reste ne doit pas
attendre une minute et quart contre quelqu'un de vraiment parti — il peut toujours abandonner lui-même.
Le **même** chiffre sert à la deuxième chute d'une place : un seul chiffre à retenir.

`room.ts` tient le minuteur du canal refermé et ne décide rien (`onPeerAbsent`) ; `online-battle.ts`,
qui tient à la fois le salon et l'orchestrateur, décide et déclenche le forfait (#951).

### La limite : un hôte tué net ne revient pas (décision #966)

Délai avant que l'adresse d'un pair parti soit libre sur le service public de PeerJS (mesuré, en
WebSocket nu) :

| Comment le pair est parti | Délai avant que son adresse soit libre |
|---|---|
| **proprement** (« Quitter », ou une croix dont le message de départ part) | **110 ms** |
| **brutalement** (onglet tué avant d'avoir pu parler) | **99 s** |

Un pair parti brutalement **ne peut donc pas revenir** dans les 75 s que l'adversaire attend au
maximum ; aucun budget de réessais n'y change rien. La place qui héberge étant une valeur publiée au
registre (plan 209), un hôte qui ne revient pas est **remplacé** au lieu d'être attendu. Un invité
qui revient réclame sa place dans les mêmes conditions, mais il n'est pas le point de rendez-vous : il
compose, donc son retour ne dépend pas de la libération d'une adresse que quelqu'un d'autre attend.

**Écarté** : allonger la grâce du silence à 110 s dégraderait le cas courant (l'adversaire attendrait
deux minutes devant un écran figé) pour sauver le cas rare. La vraie correction de fond serait de
**ne plus dériver l'adresse de la place**, ce qui demande un point de rendez-vous tiers (le Worker
`RoomRendezvous` existe) : un lot à part, pas un réglage.

⚠️ **Deux hypothèses infirmées, à ne pas ressusciter.** Il n'y a **aucune limitation par IP** sur le
service public — jouer à deux depuis la même machine n'y est pour rien. Et un barème de réessais
**serré** rend les choses pires : les sockets se gênent entre elles côté client, et le refus devenait
« connexion impossible » au lieu de « place occupée », donc un abandon immédiat au lieu d'un réessai.

### L'hôte ne rappelle jamais — l'asymétrie de qui compose (décisions #957, #960)

**Qui compose est asymétrique** : l'invité appelle l'hôte à une adresse dérivée du code ; l'hôte
n'appelle **jamais** personne, il écoute. Un hôte qui recharge sa page reprend bien son adresse et
redevient joignable (§ Connexion) — mais **personne ne le rappelle**.

**`scheduleHostRedial`** : pendant sa fenêtre de grâce, l'invité **recompose** l'adresse de l'hôte
toutes les `HOST_REDIAL_INTERVAL_MS` (2 s) au lieu d'attendre un appel qui ne viendra jamais. Ce trou
ne se voit pas en testant la reconnexion de l'invité (qui compose) — il ne se révèle qu'en testant le
retour de l'**hôte**.

Un salon revenu (l'hôte qui recharge) n'a ni délai de grâce en cours ni état de places à présenter :
`handleHello` doit envoyer l'état du salon **au revenant, à lui seul**, avant même que
`waitForWelcome` ne se dise entré — sans quoi l'arrivant lit une configuration vide et croit à une
incompatibilité de version.

### Abandon volontaire

« Abandonner » est dans le menu de combat (plan 187), avec sa confirmation et sa navigation
clavier/manette. En ligne, il doit **prévenir l'adversaire** :

```
Joueur clique "Abandonner" (confirmé) ou ferme l'onglet
  → room.sendForfeit(monSiège, NetworkForfeitReason.Abandon) PUIS applyForfeit(monJoueur)
    — l'ordre compte : on part, on ne pourra plus rien dire ensuite
  → L'autre joueur gagne par forfait
```

Le `bye` doit partir à la **fermeture d'onglet** (`pagehide`), pas seulement sur un clic « Quitter ».

**Une phrase par raison**, pas un message unique : `ForfeitReason` distingue `resigned` (abandon),
`disconnected` (chien de garde) et `desynced` (divergence), chacun avec sa propre phrase dans le
journal de combat.

**Le bandeau de connexion se tait dès que le combat est terminé** : il n'affiche plus « en attente de
reconnexion… » ni l'avertissement AFK par-dessus l'écran de victoire.

🔴 **L'abandon (et le forfait de chien de garde) contourne les clauses de survie — statu quo
assumé** (#953) : `forfeit()` met les PV à 0 en dur, donc hors du pipeline de dégâts —
**Ténacité**, **Fermeté** et **Ceinture Force** ne se déclenchent jamais. Un abandon n'est pas un
dégât, c'est un renoncement. Les cascades de K.O., elles, restent préservées (**Lien du Destin**,
**Rancune**, **Représailles**) : même bloc `handleKo` que pour un K.O. ordinaire.

---

## Ce qui reste ouvert

Limites assumées, chacune avec son entrée de backlog dans le graphe de mémoire — aucune n'est une
régression, ce sont des choix de V1.

- **Sauvegarde partagée entre deux onglets d'un même profil** — deux onglets du même navigateur, sur
  le même profil, se disputent la même clé de sauvegarde de reprise. Backlog :
  `backlog-sauvegarde-partagee-entre-onglets-meme-profil`.
- **Délai réel de libération d'adresse du cloud PeerJS** — mesuré à 110 ms / 99 s (§ La limite), mais
  non confirmé dans toutes les conditions. Backlog : `backlog-delai-liberation-peerjs-cloud`.
- **Cadence d'un round à N camps** — pire cas théorique 12 actions × 60 s = 12 min par round ; le
  seuil d'absence (§ Le seuil d'absence à N camps) attend une mesure de cadence réelle.

---

## Le NAT, et quand il gagne

Chaque box a **une seule IP publique** ; les appareils derrière ont des IP privées et la box réécrit
les adresses. Conséquence : personne ne peut « appeler » une machine depuis l'extérieur.

La parade est le **hole punching**, à quoi sert STUN : chaque pair demande à un serveur STUN public
« tu me vois comment ? », les deux s'échangent ces adresses par le signaling, puis émettent vers
l'autre **en même temps**. Le paquet sortant crée l'entrée dans la table NAT ; le paquet entrant la
matche et passe. STUN ne relaie rien — d'où sa gratuité.

**Ça casse avec le NAT symétrique** : certaines box et opérateurs assignent un port externe
**différent par destinataire**, donc le port annoncé par STUN ne vaut que pour parler à STUN. Deux
pairs en NAT symétrique ne se joignent pas. On le trouve surtout en réseau d'entreprise et en
**CGNAT** — très répandu **sur mobile**. Le bon réflexe pour un joueur bloqué est donc le **wifi
fixe**, pas la 4G.

**TURN** est l'abandon : un relais que les deux joignent en sortant. Marche toujours, coûte de la
bande passante, donc quasi jamais gratuit sérieusement.

🔴 **Les TURN gratuits de `peerjs` sont morts** : `eu-0.turn.peerjs.com` et `us-0.turn.peerjs.com`
n'ont plus d'enregistrement DNS `A`, et un vrai Chromium ne gather plus aucun candidat ICE `relay`.
Le repli tiers `openrelay.metered.ca` est mort aussi (le free tier public a fermé) : un TURN tiers
gratuit est le composant le plus fragile de la chaîne. Sans TURN il ne reste que le STUN, qui ne
franchit ni le NAT symétrique ni le CGNAT — d'où le **relais de secours** ci-dessous
(§ Cloudflare Workers), qui traite ces paires. La configuration ICE (`ice-servers.ts`) ne passe que
deux STUN vivants (`stun.cloudflare.com`, `stun.l.google.com`).

En **IPv6 il n'y a pas de NAT du tout** : deux joueurs sur fibre ont de bonnes chances de se
connecter en direct. Le « ~10 % de connexions nécessitant un TURN » est une moyenne mondiale,
pessimiste pour notre cas réel.

---

## Cloudflare Workers (décision #869)

Pas un arbitre du combat. Trois usages :

1. **Télémétrie** (§ suivant) — c'est ce qui justifie le compte, le `wrangler.toml` et l'étape de
   déploiement CI.
2. **Registre des salons (signaling partiel)** — `RoomRendezvous`, un Durable Object qui tient la
   correspondance *code de salon → place qui héberge*. Il découple le code de salon de l'identité de
   l'hôte, ce qui permet la migration d'hôte (#904). Il ne remplace pas encore PeerJS : les canaux
   passent toujours par PeerJS. Un signaling complet (un Durable Object par code de partie : namespace
   à nous, plus de collisions #866, plus de dépendance au SLA inexistant de `peerjs.com`, ~100 lignes)
   reste une suite possible. Le registre est **optionnel** : injoignable, le jeu retombe sur la place
   1 et pas de migration.
3. **Relais de secours quand le NAT gagne** — `RoomRelay`, un Durable Object par code de partie. Une
   seule WebSocket par joueur ; les canaux vers chaque pair sont multiplexés dessus, adressés par une
   trame `<to>|<from>|<charge utile JSON>` — l'adresse HORS du JSON, pour que le relais n'ait jamais
   à désérialiser la charge, même pour la router.

   Le direct (PeerJS) reste la règle, gratuit et plus rapide. Le relais n'est essayé que quand
   `connect()` échoue en `ConnexionImpossible` ou `DelaiDepasse`, et **par pair, pas par salon** —
   seuls les canaux qui échouent basculent. `claim()`, et non `connect()`, ouvre la socket : côté
   salon, seul l'invité appelle `connect`, un relais qui n'apparaîtrait qu'au premier repli
   n'existerait jamais côté hôte.

   L'API Hibernation garde les clients connectés sans facturer la durée d'inactivité — exactement le
   profil d'un jeu où rien ne se passe pendant 60 s entre deux coups — et **supprime le besoin d'un
   TURN tiers**. Un garde-fou de quota (`RELAY_DAILY_LIMIT`, ~60 % du palier gratuit de requêtes)
   refuse l'ouverture d'un salon **neuf** une fois ce seuil atteint — jamais une partie déjà en cours —
   pour protéger le registre des salons et la télémétrie, qui partagent le même compte. Le compteur
   vit dans le stockage SQLite de l'objet (une écriture D1 par salon, à sa fermeture, jamais une par
   message) ; `pnpm stats` affiche la consommation du jour en pourcentage du palier.

   🔴 **Le TURN Cloudflare est écarté** (arbitrage humain) : il exige un profil de facturation même
   pour son palier gratuit, et poser une carte ferait sortir le compte du régime « ça s'arrête au lieu
   de facturer » pour un régime où le dépassement se paie, sans plafond dur en retour. Le compte
   reste sans carte.

Limites du plan gratuit : Workers 100 000 requêtes/jour et 10 ms de CPU par invocation (**temps CPU**,
l'attente I/O n'est pas comptée) ; Durable Objects 100 000 requêtes/jour, 13 000 GB-s, **backend
SQLite obligatoire en gratuit** (le backend clé-valeur est payant) ; D1 5 M lignes lues et 100 000
lignes écrites/jour, 5 Go.

---

## Télémétrie (décisions #867, #868, #870)

Rattachée à la Phase 7 par choix humain — c'est le même chantier « serveur » — **bien qu'elle soit
indépendante du réseau et concerne d'abord le solo**, c'est-à-dire 100 % du jeu aujourd'hui.

**Pourquoi quitter Goatcounter** : il est sur toutes les grandes listes de filtrage (EasyPrivacy,
EasyList Privacy, AdGuard, StevenBlack), donc les données sont faussées par les bloqueurs — et
l'auto-héberger ne suffit pas, les filtres visent aussi le motif `count.js`. Notre télémétrie n'est
**pas un script d'analytics** mais un `fetch()` du code du jeu vers notre propre API sur un chemin
neutre : les listes ne peuvent pas la bloquer sans casser le jeu.

**Ce qu'on mesure** : des **usages**, pas des scores. Parties jouées, Pokemon les plus joués, attaques
les plus utilisées, taux d'abandon. Trichable en théorie, sans enjeu en pratique — personne ne patche
un client pour gonfler un compteur d'usage, et c'est déjà le modèle de confiance de Goatcounter. Un
**vrai classement compétitif est hors de portée** : il exigerait que le serveur fasse tourner le
combat (#870), même mur que le fog.

**Forme** : deux événements groupés par partie — `battle_started` (carte, format, nombre d'équipes,
humain/IA) et `battle_ended` (durée, tours, camp vainqueur, Pokemon et moves utilisés). L'écart entre
les deux donne gratuitement le taux d'abandon. **Une seule requête par partie**, jamais une par move.
En ligne, chaque pair émet les siens ; `battleId` (§ Protocole) les rattache à la même partie.

**Schéma** : événement brut en JSON, **agrégation à la lecture**. La contrainte serrée est
100 000 lignes écrites/jour : une écriture sur une table indexée compte **deux lignes** (table +
index), donc une partie (deux événements) coûte ~4 lignes, soit un plafond de l'ordre de
**~25 000 parties/jour**. Le rapport de force avec un schéma éclaté (une ligne par Pokemon et par
move, ~45× plus coûteux) justifie le brut.

⚠️ **RGPD** : en collectant nous-mêmes, nous devenons **responsable du traitement**. Goatcounter
offrait le sans-cookie et la conformité clés en main (#215) ; ici c'est à faire **exprès** — aucun
identifiant, aucune IP stockée, aucune empreinte, uniquement des compteurs agrégés. Ce sont des
données de jeu, pas des données personnelles, et ça doit le rester.

**Réserve pratique** : le jeu est servi depuis `kekel87.github.io` et itch.io ; un Worker sort par
défaut sur `*.workers.dev`, donc en **tierce partie** vis-à-vis du jeu — ce que les filtres visent en
priorité. `workers.dev` n'est pas bloqué en masse aujourd'hui (ça casserait trop de sites), le risque
est faible. Pour l'annuler complètement il faudrait un **nom de domaine** servant le jeu et l'API en
première partie.

**Piste ouverte, non cadrée** : afficher certaines de ces statistiques **en jeu** (les usages surtout).
Peu coûteux — un endpoint qui sert du JSON agrégé mis en cache, lu une fois par période de cache et
non une fois par joueur.

---

## 3+ joueurs

Pas de host central : chaque joueur envoie ses actions à **tous** les autres (maillage complet).

```
3 joueurs : A ←→ B ←→ C ←→ A (mesh complet)
```

Pour N joueurs, chaque joueur a N-1 connexions. Avec max 12 joueurs, c'est 66 liens. **Le réseau
accepte les cinq formats** (2, 3, 4, 6 et 12 camps).

### Le maillage tient à douze

Harnais : `e2e/tests/bench/mesh-scaling.spec.ts`, dans son propre projet Playwright que `PT_BENCH=1`
fait exister (sans quoi la suite GitHub ouvrirait douze navigateurs par tranche) :

```
PT_BENCH=1 npx playwright test --project=bench
```

| Format | Liens attendus | Extrémités connectées | Entrée du dernier arrivé |
|--------|----------------|------------------------|--------------------------|
| 2 camps  | 1  | 2 / 2 — **100 %** | 1 229 ms |
| 3 camps  | 3  | 6 / 6 — **100 %** | 1 236 ms |
| 6 camps  | 15 | 30 / 30 — **100 %** | 1 345 ms |
| 12 camps | 66 | 132 / 132 — **100 %** | 1 304 ms |

Temps d'entrée plat (+6 % entre deux et douze camps). Le repli en topologie étoile n'est donc **pas**
nécessaire — il reste disponible (§ Cloudflare Workers) mais rien ne l'appelle.

🔴 **Ce que ces chiffres ne valent PAS.** Le harnais tourne sous `peerIce=off`, tout le monde sur la
boucle locale : c'est un **plancher**, le coût du montage tel que notre code l'ordonne, sans une
milliseconde de réseau réel. Le temps d'entrée entre deux machines derrière deux NAT se mesure à
deux postes.

### `connectToMesh` : parallèle, et l'échec est attribuable à sa connexion

`Room.connectToMesh` négocie les liens **en parallèle** (`Promise.all` sur des tâches qui avalent leur
échec : un pair manquant n'empêche personne d'entrer). Le vrai enjeu est `CONNECT_TIMEOUT_MS = 15_000`
(`transport.ts`) : en série, une seule place morte retardait toutes les suivantes de quinze secondes
chacune.

🔴 **Règle : paralléliser n'est sûr que si l'échec est attribuable.** `waitForConnectionOpen`
(`peer-connection.ts`) n'écoute pas l'objet `peer` partagé sans filtre : `peerErrorConcerns` décide
quelle connexion un échec concerne. Trois cas : une cause globalement fatale (`network`,
`socket-error`, `server-error`…) vaut pour tout le monde et rejette ; `peer-unavailable` ne rejette
que la connexion que son **message** nomme (`peerjs` n'expose l'identité de la cible que dans le
texte) ; tout le reste, `webrtc` en tête, n'est attribuable à personne et ne rejette **rien** — le
minuteur de 15 s est par promesse. Sans cela, une seule place absente rejetterait les onze promesses
et le dernier arrivant se retrouverait avec le seul canal de l'hôte — or l'hôte ne relaie pas,
**le maillage EST le transport**.

**Le filet** : la diaphonie est éprouvée dans `peer-connection.test.ts`, contre le double `FakePeer`
qui est un vrai émetteur partagé (pair absent nommé, cause fatale, `webrtc` inattribuable,
`peer-unavailable` sans message) — hors d'atteinte de `testing/fake-transport.ts` et du banc de
mesure. `room.integration.test.ts` garde qu'une place morte ne coûte que son propre lien.

⚠️ **Ce qui reste non mesuré** : la **cadence** d'un round (voir § Ce qui reste ouvert).

### Le désaccord à N témoins (décision #1026)

`compareDigests` (§ Détection de désync) devient `evaluateDigests` à 3 camps et plus : au lieu
d'accuser l'autre pair, on regroupe **toutes** les empreintes connues au même `actionIndex` — la
mienne comprise — et le groupe minoritaire est forfaité, moi compris s'il y a lieu. Trois issues : un
groupe strictement majoritaire → les autres groupes sont forfaités ; égalité au sommet → **personne**
n'est accusé (*Age of Empires*, *Factorio* font pareil : constater la divergence, ne jamais
réconcilier) ; moins de deux empreintes connues → on attend. Le duel garde son constat symétrique : à
deux témoins, tout désaccord est une égalité 1-1, la majorité n'y détecterait plus rien. Toujours pas
un anti-triche (seuil byzantin 3f+1, hors de portée à 3 ou 4 camps) — un outil de diagnostic contre la
divergence accidentelle.

**Le quorum exclut les places forfaitées, pas les places éliminées au combat** (#1045). Un pair
**parti** fige son empreinte à son dernier index pendant que les survivants avancent : compté, il
fabriquerait un faux positif à chaque action, donc `forfeitedSeats` en sort. Un pair **éliminé au
combat** qui continue de regarder ne fige rien : son moteur applique les mêmes actions que les autres,
son empreinte avance pareil — il reste un témoin **valide**, et un témoin honnête de plus rend le
vote de minorité plus sûr.

---

## WebRTC / PeerJS

### PeerJS

- Lib qui simplifie WebRTC data channels
- Signaling gratuit inclus (peerjs.com) — **namespace mondial partagé**, d'où le préfixe (#866)
- API simple : `new Peer()` → `peer.connect(id)` → `conn.send(data)`
- ~50KB gzipped
- **Pas de SLA.** Historique de `429 Rate Limited` documenté, auto-hébergement recommandé par la doc
  dès qu'il y a du trafic. C'est ce qui fait du signaling maison (§ Cloudflare Workers) une suite
  naturelle.

### STUN / TURN

- **STUN** — découvre l'IP publique. Gratuit (Google, Twilio fournissent des serveurs). Le jeu passe
  une liste explicite (`ice-servers.ts`) qui écrase les défauts de `peerjs` : deux STUN vivants, et
  rien d'autre.
- **TURN** — relayait le trafic si la connexion directe échouait. Les TURN gratuits de `peerjs` ont
  disparu (§ Le NAT). **Remplacé par notre propre relais WebSocket sur Durable Object**
  (§ Cloudflare Workers) plutôt que par un TURN tiers — Cloudflare exige une carte bancaire même en
  palier gratuit, et les free tier publics (`peerjs`, `openrelay.metered.ca`) sont les plus fragiles
  de tous.

---

## Ce qui existe déjà et facilite le multi

| Composant | Utilité pour le multi |
|-----------|----------------------|
| `BattleEngine` API (getLegalActions/submitAction) | Protocole d'actions déjà propre |
| Système d'events (BattleEvent[]) | Le renderer consomme déjà des events |
| PRNG seedé (`createPrng`) | Même seed = même résultat = exécution dupliquée |
| **Déterminisme réellement verrouillé** (plan 181) | `creationRng: createPrng(seed)` sur le chemin live ; plus aucun `Math.random` sur le chemin de production. Les occurrences restantes sont des seams test-only ou hors combat |
| Replay (`exportReplay` / `runReplay`) | Reconnexion et resync — **éprouvé en production** depuis le plan 181 |
| Port de persistance `load`/`save`/`clear` (#751) | La source du journal peut devenir le pair distant sans toucher l'écran de combat |
| Core découplé du renderer | Le réseau s'insère entre les deux sans tout casser |
| **Hot-seat N joueurs** | `humanPlayerIds` dans l'orchestrateur, Humain/IA par camp au team-select (plan 188), jusqu'à 12 équipes. **Le tour distant se greffe là où le tour hot-seat existe déjà** |
| Couche d'entrée device-agnostique (plans 184-186) | Le lobby est jouable à la manette (saisie du code par la roue de caractères, § Connexion) |
| `AiTeamController` | Remplacement si un joueur se déconnecte |

✅ **L'IA tourne sur les deux pairs** (#901). En solo elle est seedée sur `createPrng(Date.now())` ;
ce seed-là diverge d'un pair à l'autre, mais ça n'a plus d'importance en ligne : le setup diffusé
porte une graine d'IA dérivée **par place**, et c'est suffisant, l'IA étant **pure** à état et
générateur donnés (aucun `Math.random` ni `Date.now` dans `packages/core/src/ai/`). Pas de « pair
émetteur » à désigner.

---

## Le paquet `packages/network/`

Pur : aucune dépendance d'interface, et du moteur il ne connaît que des **types** (plus quelques
énumérations fermées de `protocol.ts`, pour valider au bord du réseau — pas une porte ouverte à de la
logique).

```
packages/network/src/
  protocol.ts            messages, NETWORK_VERSION, causes de refus, graines
  room-code.ts           alphabet, génération, adresses dérivées du code, parsePeerId
  transport.ts           le contrat commun + la prise d'identifiant à réessais
  peer-connection.ts     la mise en œuvre PeerJS
  fallback-transport.ts  la cascade direct → relais, transparente pour room.ts
  relay-connection.ts    le transport WebSocket vers le Durable Object de relais
  fake-transport.ts      canal en mémoire : c'est lui qui rend le salon testable sans réseau
  room.ts                état de salon, arrivées, départs, lancement accusé,
                         routage action/forfeit/checksum/resync/placement
                         (pas de `network-controller.ts` séparé, ce fichier suffit)
```

🔴 **`checksum.ts` ne vit pas ici** : la sérialisation canonique et le hash du `BattleState` vivent dans
`packages/core/src/battle/state-checksum.ts`. C'est un module **pur qui connaît la forme de l'état de
combat** — sa place est auprès de l'état, pas du transport. Le salon ne porte qu'un type de message,
un envoi, un rappel et une branche de routage.

Le **canal en mémoire n'est pas un artifice de test** : c'est lui qui permet de faire tourner deux
salons — ou douze — dans le même processus, donc de couvrir l'allocation concurrente, les départs et
le lancement annulé **sans réseau ni service tiers**. C'est ce qui garde le gate vert le jour où
Internet tombe.

---

## Écrans

L'application est une **FSM d'écrans DOM** décrite par `ScreenId` et `SCREEN_TRANSITIONS` dans
`packages/app/src/app/screens.ts`.

- **`lobby`** : « Créer » / « Rejoindre » (roue de caractères). Va droit vers `team-select`, hôte
  comme invité : il n'y a **pas d'écran `map-select`**. Le choix de carte est une modale
  (`ui/map-select/MapPickerModal.ts`) ouverte depuis le bandeau de partie de `team-select`, pour ne
  pas démonter l'écran (et perdre la composition d'équipe en cours) à chaque changement de carte.
  Le lobby ouvre en duel (`OPENING_TEAM_COUNT`) et **ne porte pas de sélecteur de format** : le choix
  se fait dans la salle d'attente (§ Sélection d'équipe). Un invité ne quitte le lobby que si la
  partie existe (il se connecte **avant** de naviguer).
- **`team-select`** : la salle d'attente. Le troisième état de ligne n'est pas un contrôleur mais un
  état de **salon** — le moteur ne connaît qu'« humain » ou « IA », et un joueur distant est un
  humain, simplement pas celui qui est devant cet écran.
- **`combat`** : `runBattle` distingue tour local et tour distant (`humanPlayerIds` porte la
  distinction humain/IA ; `localPlayerIds` n'est défini qu'en ligne).

🔴 **Le salon n'appartient à AUCUN écran** (`packages/app/src/network/online-room.ts`). Il est détenu
par la session et **survit à l'entrée en combat**. Un salon qui doit vivre plus longtemps que l'écran
qui le crée ne peut pas lui appartenir : `peerjs` **jette** le tampon d'un canal qu'on détruit,
l'accusé de lancement de l'invité pouvait donc ne jamais partir et l'annulation de l'hôte
n'atteignait plus personne. Il se ferme sur les deux vrais chemins de sortie : « Retour » depuis la
salle d'attente, et **tout retour au menu principal** — `combat` ne transite que vers lui, donc
l'écran de combat n'a pas à connaître le réseau.

⚠️ **Corollaire pour tout écran qui s'y branche** : ses écouteurs doivent être soldés à son
démontage. Le salon leur survivant, les oublier fait rendre un écran détruit à chaque message reçu.

---

## Comment les joueurs se trouvent

**Code de partie seul** (#895). Pas de matchmaking. Les joueurs se trouvent par leurs propres moyens
(Discord, SMS, en personne) et partagent **un code**.

**Les cinq formats sont ouverts en ligne** (2, 3, 4, 6 et 12 camps ; décision D6/#944 renversée par le
plan 209) — l'écran `lobby` ouvre en duel et le choix se fait dans la **salle d'attente**.
`Room.setTeamCount` recompose les places sans toucher au **code** du salon — l'adresse ne dépend pas
du format. Rétrécir le format **éjecte les derniers arrivés** (places hautes, jamais la première),
prévenus avant que leur canal ne se ferme.

```
Écran `lobby` :
  ┌───────────────────────────────────────────────┐
  │  Créer une partie                             │
  │    « Créer une partie »                       │
  │                                               │
  │  Rejoindre une partie                         │
  │      Z     6     J     Z     L                │
  │    ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐              │
  │    │ A │ │ 7 │ │ K │ │ 2 │ │ M │  ← roue de caractères
  │    └───┘ └───┘ └───┘ └───┘ └───┘              │
  │      B     8     L     3     N                │
  │    « Rejoindre »                              │
  │                                               │
  │  Retour                                       │
  └───────────────────────────────────────────────┘
```

Le code s'affiche ensuite dans la **salle d'attente**, avec un bouton « Copier » — c'est là que
l'hôte attend, donc là qu'il le partage.

C'est suffisant pour une communauté naissante. Un matchmaking avec personne en ligne, c'est une salle
d'attente vide — pire qu'un code.

**Matchmaking — écarté, pas reporté** (#862) : la V2 « matchmaking via Supabase Realtime » est
écartée avec le reste de Supabase. Si le besoin se représente un jour, il se ferait sur un Durable
Object (§ Cloudflare Workers) — mais l'objection reste : elle est produit, pas technique.

---

## Tests

### 1. Tests unitaires (protocole)

Pas besoin de réseau : alphabet et génération de code, adresses dérivées, reconnaissance des
messages, refus de version, dérivation des graines d'IA et d'équipe, prise d'identifiant à réessais.

### 2. Tests d'intégration (salons en mémoire)

Plusieurs `Room` dans le **même processus**, par le canal en mémoire : allocation de places
concurrente, maillage, arrivée et départ (propre et silencieux), hôte qui part, refus au-delà du
format, refus de version, lancement accusé, **lancement annulé quand un accusé manque**.

### 3. Tests E2E (Playwright) — un seul scénario

`e2e/tests/dom/online-lobby.spec.ts` : deux contextes de navigateur, l'un crée, l'autre saisit le
code au clavier et rejoint, les deux entrent en combat (assertion sur le **signal de disponibilité de
la scène**, pas sur la présence d'un `<canvas>`, qui existe dès le montage).

🔴 **L'annuaire est LOCAL**, lancé par le harnais (paquet `peer`, second `webServer` de
`playwright.config.ts`, port dérivé de celui de l'app). Le service public ferait dépendre la suite
d'un tiers sans engagement de service : une coupure d'Internet rendrait le gate rouge sans qu'une
ligne de notre code ait changé. La surcharge passe par `?peerPort=`, **verrouillée sur `DEV` ou
`VITE_E2E`** comme `?seed=` — sans ce verrou, ce serait une porte ouverte à l'interception de
parties. Les serveurs STUN/TURN sont désactivés pour les mêmes raisons : les deux pairs sont sur la
boucle locale.

⚠️ **Coût machine** : la suite complète tourne sous plafond CPU (`scripts/with-cpu-cap.sh`). D'où
**un seul** scénario à deux contextes ; tout ce qui se teste sans réseau reste en intégration, qui ne
coûte rien.
