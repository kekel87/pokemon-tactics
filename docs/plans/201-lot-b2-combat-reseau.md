# Plan 201 — Lot B2 : combat en réseau

> **Statut** : done
> **Créé** : 2026-09-08
> **Avancement** : **les 8 étapes sont livrées et validées à la main** le 2026-09-08. `NETWORK_VERSION`
> est à **2**. 4334 tests unitaires, 439 d'intégration et 531 e2e verts (gate `full`, cadré sur
> `origin/main`). Validation manuelle : un 1v1 complet en ligne jusqu'à l'écran de victoire
> (« Joueur 2 gagne ! · 5 tours · 54 s »), sur le service public de PeerJS.
> **Revu** le 2026-09-08 par `plan-reviewer` (11 affirmations de code vérifiées exactes) et
> `game-designer` (trois corrections portées ci-dessous).
> ✅ **Versé au graphe** le 2026-09-08 : entité `plan-201`, décisions **#939-945** (les D1-D7 de ce
> document), `historique-2026-09-08-lot-b2-combat-reseau`, `recette-12-jeu-en-ligne`,
> `agenda-2026-09-08-prochaine-etape`, et cinq entrées de backlog.
> 🔴 **Ce fichier reste à supprimer** — c'est la dernière étape du routage de `docs/plans/README.md`,
> son contenu vivant désormais dans le graphe. Non fait ici : `git rm` et `rm` sont sur la deny-list
> des commandes destructrices (`CLAUDE.md` § Interdits), donc la suppression revient à l'humain.
> **Lot B2 de la Phase 7** — plan-cadre : `docs/plans/195-phase7-multijoueur-telemetrie.md`
> **Référence de conception** : `docs/multiplayer.md` § Combat, § Anti-triche, § Protocole de messages
> **Prérequis** : Lot B1 livré (plan 199, graphe `plan-199`). Plan 200 clos, donc plus aucun préalable.
> **Ce lot s'arrête** quand deux navigateurs jouent un 1v1 complet de bout en bout. Le chronomètre,
> la reconnexion et l'abandon volontaire sont le **Lot B3** ; la somme de contrôle d'état le **B4**.

## Ce que le lot livre

Aujourd'hui, deux pairs entrent en combat avec un état identique **et jouent chacun leur copie
locale** : aucune action ne s'échange. Ce lot fait s'échanger les actions, greffe le tour distant là
où le tour hot-seat existe déjà, et valide chaque action reçue.

Il absorbe au passage les **trois dettes** que le Lot B1 a laissées ouvertes (§ Dettes absorbées).

## Ce qui est déjà là — et que ce lot ne réinvente pas

| Acquis | Ce qu'il donne au Lot B2 |
|--------|--------------------------|
| **Le salon survit à la transition d'écran** (`packages/app/src/network/online-room.ts`) | Écrit exactement pour ce lot. `holdOnlineRoom` / `releaseOnlineRoom` existent ; il manque **un lecteur**. |
| **Maillage par place** (`room.ts`, adresses `pkmntac-<CODE>-n`) | Diffuser une action, c'est `broadcast()`. Rien à ajouter au transport. |
| **Trois graines dans le `start`** (`NetworkSeeds`, décision #902) | Combat, placement et IA sont déjà identiques sur les deux pairs. Le déterminisme est acquis, ce lot ne le rejoue pas. |
| **`recordedActions` + `exportReplay()`** (`BattleEngine.ts:1313`, `:400`) | Une action distante passée par `submitAction` entre dans le journal **comme une locale** : la reprise du plan 181 et le replay marchent sans cas particulier. |
| **Hot-seat N joueurs** (`humanPlayerIds`, plan 188) | La place où greffer le tour distant. ⚠️ Mais pas telle quelle — voir piège 2. |
| **Canal en mémoire** (`@pokemon-tactic/network/testing`) | Deux moteurs dans le même processus : c'est là que les bugs de protocole se prennent, pas en e2e. |

---

## 🔴 Trois pièges trouvés en lisant le code — à traiter, pas à découvrir en recette

### Piège 1 — `onTurnReady` est **synchrone**, un tour distant ne l'est pas

```ts
// packages/view-core/src/battle-orchestrator.ts:210
onTurnReady: ((activePokemonId: string) => BattleEvent[] | false) | null = null;
```

Deux réponses seulement : un tableau d'événements (« j'ai joué, voilà le résultat ») ou `false`
(« c'est un humain, ouvre le menu », `refreshUI` enchaîne sur `enterActionMenu()` ligne 733). Un tour
distant n'est ni l'un ni l'autre : **il faut attendre un message**.

Il faut donc une **troisième réponse** et un point d'entrée impératif pour la suite :

- `onTurnReady` peut rendre `"pending"` → l'orchestrateur entre dans une phase d'attente, contexte
  d'entrée `locked` (le plateau ne prend plus rien, le curseur s'efface — le chemin existe déjà,
  `onInputContextChanged` ligne 663 le traite pour le tour d'IA).
- `orchestrator.submitRemoteAction(action)` : nouvelle méthode publique, seul point d'entrée du
  réseau dans la vue. Elle valide, puis passe par **le même `executeAction`** que le joueur local —
  donc même file d'animation, même `onActionCommitted`, même persistance, même journal.

L'union devient `BattleEvent[] | false | "pending"`. Les deux appelants existants
(`wireScoredAi`, le bac à sable) ne rendent jamais `"pending"` : aucun changement de comportement en
local.

### Piège 2 — `humanPlayerIds` contient les places **distantes** : je joue le tour de mon adversaire

`StartSeat.controller` ne connaît que `human` et `ai` : `remote` est **rabattu sur `human`** à la
composition du setup (`protocol.ts`, commentaire de `NetworkSeatOccupancy`). Puis
`team-select-screen.ts:240` recopie ce contrôleur dans `TeamSelection`, et `combat-screen.ts:1011`
en dérive `humanPlayerIds`.

Conséquence : au tour du distant, `refreshUI` voit un tour humain ordinaire et enchaîne sur
`enterActionMenu()` — **le menu d'actions s'ouvre chez moi pour le camp adverse**. C'est un bloquant
du lot, pas un détail : rien dans le setup ne dit qui est *moi*.

**Correctif** : un champ de plus dans `BattleOrchestratorConfig`, `localPlayerIds`, qui **par défaut
vaut `humanPlayerIds`** — le hot-seat local est donc inchangé au bit près. `refreshUI` : acteur
humain **hors** de `localPlayerIds` → tour distant → `"pending"`.

C'est aussi ce qui répond à « qui envoie quoi » : je ne diffuse que les actions des places de
`localPlayerIds`.

> Note, sans suite : `viewerPlayerId()` (ligne 583) suit la même liste, donc le point de vue des
> panneaux bascule chez le distant pendant son tour. **Pas un sujet** — le fog en ligne est
> cosmétique et assumé depuis la décision #863, et on ne joue pas en compétitif. Faire lire
> `localPlayerIds` à `viewerPlayerId()` tombe gratuitement avec le correctif ci-dessus ; ça s'arrête
> là, aucun travail dédié.

### Piège 3 — `retreatPosition` n'est **pas** dans `getLegalActions()`

`getLegalActions` énumère `UseMove` avec `targetPosition` seul (`BattleEngine.ts:1189`). La retraite
est ajoutée **après coup** par l'orchestrateur :

```ts
// battle-orchestrator.ts:1336
this.executeAction({ ...phase.action, retreatPosition: { x: tile.x, y: tile.y } });
```

et validée séparément à l'exécution par `isValidHitAndRunRetreat` (`BattleEngine.ts:3023`). Une
validation par égalité stricte contre `getLegalActions()` **refuserait donc toute attaque à
retraite** — Demi-Tour (`u-turn`), Change Éclair (`volt-switch`), Eau Revoir (`flip-turn`) — et
forfaiterait un joueur honnête en trois attaques.

**Correctif** : la comparaison porte sur une **projection canonique** de l'action, `retreatPosition`
exclu. Le moteur reste juge du reste, et il l'est déjà.

Deux notes de la même lecture, à garder en tête :

- Les actions `Move` portent le chemin **calculé par le moteur** (`reachable.path`), un seul par case
  atteignable : deux pairs qui énumèrent le même état obtiennent les mêmes chemins, l'égalité tient.
- La peur et la confusion **consomment l'aléa**, mais pas là où je l'avais écrit (correction de
  `game-designer`) : elles se résolvent dans `advanceTurn` (`BattleEngine.ts:4225`), à la fin de la
  résolution de l'action précédente et **avant** que le nouvel acteur prenne la main ; le bloc de
  `applyAction` (ligne 1257) n'est qu'un repli gardé par `if (!this.confusionChecked)`. Dans les deux
  cas c'est le chemin partagé, donc symétrique entre pairs. `getLegalActions`, lui, est pur : valider
  ne dérange pas le générateur — mais soumettre dans le mauvais ordre le dérangerait, d'où le
  garde-fou d'index ci-dessous.

---

## Décisions prises avec l'humain (2026-09-08)

**D1 — Barème assoupli sur action refusée. Le « redemander » du document disparaît.**
`docs/multiplayer.md` § Anti-triche décrit « 1er : rejeter, redemander ». C'est impraticable :
`executeAction` soumet **puis** diffuse, donc l'émetteur a déjà avancé son moteur quand je refuse —
renvoyer la même action ne peut rien réparer, on est déjà divergents. Le barème devient :

| Refus | Effet |
|-------|-------|
| 1er | journal seulement — un bug honnête de notre côté est possible |
| 2e | avertissement visible « Action invalide » |
| 3e | forfait de l'émetteur |

Effet de bord heureux, et c'est lui qui rend le barème suffisant en attendant le Lot B4 : un pair
réellement divergent voit **tout** refusé, donc atteint 3 en trois actions. Le forfait arrive vite,
sans mécanisme dédié.

**D2 — Le forfait vit dans le core : `engine.forfeit(playerId)`.** Le core n'a **aucun** chemin
d'abandon aujourd'hui (rien dans `packages/core` ne parle de forfait). Une API moteur fait marcher
l'écran de victoire, la télémétrie `battle_ended` et le récapitulatif du plan 197 **sans un seul cas
particulier** — et le Lot B3 la réutilise pour l'abandon volontaire et le chien de garde. Testable en
Vitest, donc écrit en tests-first.

🔴 **Correction de `game-designer`, et elle compte** : j'avais écrit que `forfeit()` « émet
`BattleEnded` avec le vainqueur restant ». **C'est vrai à deux camps seulement.** `checkVictory()`
(`BattleEngine.ts:3867`) sort tôt tant que `playersAlive.size > 1` : à trois camps, le forfait d'un
seul ne termine rien, et le combat continue entre les autres. Écrire un second chemin de résolution
« forfait » ferait mentir l'API sur les formats jusqu'à `12v1`.

Le bon geste existe déjà dans le moteur : **le patron de Lien du Destin** (`BattleEngine.ts:3736`) —
mettre `currentHp = 0`, émettre `PokemonKo`, appeler `handleKo`, qui appelle `checkVictory` lui-même.
`forfeit(playerId)` boucle donc sur les Pokemon vivants de ce camp et laisse la résolution existante
trancher. `BattleEnded` devient une **conséquence éventuelle**, jamais une garantie de l'appel. Les
Pokemon du camp restent des cadavres inertes sur la grille, comme tout K.O. — le blocage, le ciblage
et la ligne de vue filtrent déjà sur `currentHp > 0`.

⚠️ **Limite assumée** : le forfait n'est pas une `Action`, il ne va pas dans `recordedActions`, donc
il est absent du replay. Acceptable — une partie forfaitée est finie, la reprise ne s'y applique pas.
À redire explicitement si le Lot B4 rejoue des parties forfaitées.

**D3 — L'action porte son index.** Le message d'action porte `actionIndex`, le nombre d'actions déjà
enregistrées chez l'émetteur avant celle-ci. Un décalage est refusé avec une erreur lisible au lieu
d'appliquer une action au mauvais acteur. Le canal PeerJS est fiable et ordonné (SCTP), donc ce n'est
pas un correctif de transport : c'est un **détecteur de désync du pauvre**, une dizaine de lignes,
qui transforme « le combat part en silence » en « les versions divergent » sans attendre la
sérialisation canonique du Lot B4.

**D4 — Une partie en ligne se sauvegarde comme une partie locale, mais ne se reprend pas *seul*.**
Ma première recommandation était de ne rien persister en ligne ; elle était fausse, et l'humain l'a
corrigée en rappelant qu'une coupure ou un rechargement involontaire doit laisser une chance de
revenir. C'est déjà codé : le Lot B1 tient des **délais de grâce** — 10 s après un départ propre,
45 s après un silence (`room.ts:47-50`) — et l'en-tête de `battle-persistence.ts` avait tranché la
question avant nous :

> *That choice also decides the multiplayer story (Phase 7): … a client that lost its connection
> resumes through this very path with the log fetched from the server instead of from here.*

Le journal d'actions local est donc **ce sur quoi le Lot B3 reconnectera**. On le garde.

En revanche, le B2 doit **fermer la reprise solo** : les places distantes étant rabattues sur
`human`, un rechargement proposerait aujourd'hui de reprendre le combat — en hot-seat, le joueur
tenant **les deux camps**. La sauvegarde porte donc une marque « en ligne », et l'écran de reprise la
refuse avec un message honnête. Que le rechargement mène à une **re-jonction** est du B3.

**D5 — Le constat d'élimination est une divergence, pas une accusation de triche.**
En 1v1, **personne ne peut dire qui s'est écarté** : un client modifié peut parfaitement *feindre* de
constater une divergence. On ne prétend donc pas savoir. Le message dit « vos parties ne concordent
plus », jamais « vous avez triché » — même symétrie que le refus de version (#900). La cause s'appelle
`diverged`, pas `invalid_actions`.

Deux exigences de l'humain, qui fixent la forme du message :
- **les camps tiers doivent savoir pourquoi** un joueur disparaît de la partie ;
- **l'intéressé doit savoir qu'il est éliminé, et pourquoi** — sans quoi il joue seul dans le vide.

D'où `forfeitedSeat` **en plus** de `seat` : l'émetteur signe, et désigne la place éliminée. À trois
camps et plus, un pair réellement divergent est refusé par **tous** les honnêtes (même moteur, même
état), donc le constat est unanime dans le cas courant.
⚠️ **`forfeitedSeat` n'est pas authentifiable** : n'importe quel pair peut désigner n'importe qui.
Contrepartie assumée du modèle sans arbitre, sans effet dans le cadrage du jeu (#863) — à revoir
seulement si une communauté compétitive apparaît.

**D6 — Le réseau est restreint au 1v1**, décidé pendant l'écriture, après D3. Le garde-fou d'index
(D3) suppose un canal ordonné, vrai **par connexion** dans un maillage complet — mais à trois camps et
plus, `broadcast()` écrit sur des canaux que rien n'ordonne **entre eux** : une action en avance sur
un canal serait refusée puis perdue, et trois refus élimineraient un joueur honnête qui n'a rien fait
de mal. L'écran `lobby` **annonce** le format 1v1 au lieu de l'offrir. Conséquence trouvée en
écrivant : un sélecteur à une seule option est un **contrôle mort** qui occupe un arrêt de focus pour
rien — remplacé par une ligne d'information, le mécanisme de sélecteur retiré.

**D7 — Nouveau contexte d'entrée `watching`.** Le contexte `locked` (piège 1) bloquait tout, caméra
comprise, sur l'idée que « les verrous durent moins d'une seconde » — vrai d'une animation, faux d'un
tour distant qui dure le temps que l'autre réfléchit. Retour de recette de l'humain. `watching` laisse
la caméra, le zoom, le journal, la timeline et le menu de combat ; refuse curseur, menu d'actions et
confirmation — le plateau ne prend aucune saisie de jeu, mais l'attente n'est plus un écran figé.

---

## Découpage en étapes

Chaque étape est livrable et testable seule. Tests avant code sur tout ce qui touche le core.

### Étape 1 — Le forfait dans le core (D2) ✅ *livrée le 2026-09-08*

- `BattleEngine.forfeit(playerId): ActionResult` — met à 0 les PV des Pokemon vivants du camp, émet
  un `PokemonKo` par Pokemon et passe par `handleKo`, comme Lien du Destin. **Rien d'autre** : la fin
  de partie est décidée par `checkVictory` / `finalizeBattleEnd`, qui existent et sont testés.
- Idempotent : un forfait sur une partie déjà terminée, ou sur un camp déjà éliminé, ne rend rien.
- **Tests d'abord** (`packages/core/src/battle/*.test.ts`) :
  - 1v1 → `BattleEnded`, l'autre camp gagne ;
  - **3 camps → AUCUN `BattleEnded`**, le combat continue entre les deux restants (l'assertion qui
    empêche d'écrire un second chemin de résolution) ;
  - dernier camp debout qui abandonne → `winnerId: null`, le match nul du plan 191 ;
  - hors de son tour → accepté, un abandon n'attend pas son tour ;
  - après `BattleEnded` → sans effet ;
  - un forfait qui déclenche Lien du Destin ou Rancune en cascade se comporte comme un K.O. multiple
    ordinaire.
- `core-guardian` obligatoire.

### Étape 2 — Le protocole (`packages/network/src/protocol.ts`) ✅ *livrée le 2026-09-08*

Deux messages neufs :

```ts
/** Une action de combat, telle que son auteur l'a soumise à son propre moteur. */
export interface ActionMessage {
  type: "action";
  seat: number;
  /** Index de l'action chez l'émetteur AVANT soumission (décision D3). */
  actionIndex: number;
  action: Action;
}

/** Un camp est éliminé — parties qui ne concordent plus (B2), abandon ou chien de garde (B3). */
export interface ForfeitMessage {
  type: "forfeit";
  /** Qui l'annonce. Confronté à l'adresse d'annuaire, donc fiable. */
  seat: number;
  /** La place éliminée : `seat` pour un abandon, une autre pour un constat de divergence (D5). */
  forfeitedSeat: number;
  reason: NetworkForfeitReason;
}
```

- `NetworkForfeitReason` en **énumération fermée**, comme `NetworkErrorCode` : `diverged` (B2), puis
  `left` et `timeout` (B3). Jamais de texte libre — ce sont aussi des valeurs de télémétrie.
- La table des valideurs est exhaustive dans les deux sens (`satisfies Record<NetworkMessageType,
  …>`) : ajouter les deux variantes à l'union **force** l'ajout des entrées, sinon ça ne compile pas.
  C'est aussi ce qui a fait échouer la compilation des deux `switch` de `room.ts` dès l'union
  élargie — le compilateur a désigné l'étape 4 tout seul.
- 🔴 **`NETWORK_VERSION` passe de 1 à 2.** Le protocole change ; c'est exactement le cas que la
  constante existe pour attraper.

### Étape 3 — Dette absorbée : `isNetworkMessage` valide le contenu ✅ *livrée le 2026-09-08*

`isNetworkMessage` (`protocol.ts`) ne regarde que `type`, tout en promettant `value is NetworkMessage`.
Or `handleMessage` (`room.ts:660`) fait confiance à cette promesse :

```ts
case "room_state":
  this.applyRoomState(message.options, message.seats, message.locked);
```

Un `{"type":"room_state"}` nu passe le garde, `message.options` vaut `undefined`, et l'exception
part depuis un rappel `onMessage` — **le salon de l'invité meurt**. Aucun pair malveillant n'est
nécessaire : une version future suffit.

- Un valideur par variante, à côté de son interface. Pas de bibliothèque de schéma : huit — bientôt
  dix — formes simples, et le paquet réseau reste sans dépendance.
- Le message d'action est celui qui **exige** ce travail : un `Action` venu du réseau est une union
  discriminée à champs imbriqués (`path: Position[]`, `targetPosition`), et le rejeter proprement
  vaut mieux que le passer à `submitAction`. La validation de forme est le garde du bord ; la
  validation de **légalité** est l'étape 5.
- Tests unitaires : chaque variante, en bien formé **et** en tronqué. Le tronqué est le vrai test.

### Étape 4 — Le salon transporte les actions (`room.ts`) ✅ *livrée le 2026-09-08*

- `sendAction(actionIndex, action)` : diffuse `{ type: "action", seat: this.seat, … }`.
- `onAction(listener)` / `onForfeit(listener)` : mêmes conventions que `onStart` / `onChange`, qui
  rendent une fonction de désinscription.
- `sendForfeit(forfeitedSeat, reason)` : diffusé à **tout** le maillage, l'intéressé compris (D5).
- `isSpokenFor(remoteSeat, message)` couvre les deux nouveaux types : une place ne parle que pour
  elle-même, sinon un pair jouerait le tour d'un autre camp. Pour `forfeit`, ce contrôle n'établit
  que **qui parle**, pas de qui il parle — `forfeitedSeat` reste inauthentifiable, et c'est assumé.
- **Tests d'intégration** (`room.integration.test.ts`, canal en mémoire) : aller-retour d'action dans
  les deux sens avec son index, action signée au nom d'un autre → ignorée, message d'action tronqué →
  ignoré sans faire tomber le salon, le camp éliminé prévenu, **les camps tiers prévenus aussi**,
  constat signé au nom d'un autre → ignoré, désinscription effective.

🔴 **Ce que l'écriture de l'étape 4 a trouvé, et qui n'était pas dans le plan** : le garde
`isNetworkMessage` ne vivait que dans le **vrai** transport (`peer-connection.ts:351`). Le canal en
mémoire, lui, livrait tout — donc **aucun test d'intégration ne pouvait atteindre le message tronqué
qui tuait le salon**, et le trou n'était visible qu'en unitaire. Le double reproduisait déjà
l'aller-retour JSON « pour faire échouer en test ce qui échouerait en vrai » ; il lui manquait le
garde, ajouté pour la même raison. Un double plus permissif que la production fait passer en test ce
qui casse en ligne — c'est la même famille que le bug de vidage de tampon du Lot B1.

### Étape 5 — L'orchestrateur accepte un tour distant (`packages/view-core`) ✅ *livrée le 2026-09-08*

Le cœur du lot, et le seul endroit qui touche `packages/view-core`.

- `BattleOrchestratorConfig` gagne `localPlayerIds?: readonly string[]` (défaut : `humanPlayerIds`)
  et deux rappels : `onLocalAction?: (action: Action, actionIndex: number) => void` et
  `onRemoteActionRejected?: (seat: number, strike: number) => void`.
- `onTurnReady` rend `BattleEvent[] | false | "pending"`.
- Nouvelle phase d'attente dans `InputState`, contexte d'entrée `locked`.
- `submitRemoteAction(action, actionIndex)` :
  1. index attendu ? sinon refus (D3) ;
  2. l'acteur courant appartient-il bien à la place émettrice ? sinon refus ;
  3. projection canonique contenue dans `getLegalActions(active.playerId)`, `retreatPosition`
     exclu (piège 3) ? sinon refus ;
  4. `executeAction(action)` — et si le moteur refuse quand même, c'est aussi un refus.
- 🔴 **`onLocalAction` se branche dans `executeAction` seulement**, jamais dans la branche IA de
  `refreshUI` (ligne 726). L'IA est déterministe et tourne **des deux côtés** (décision #901) :
  diffuser ses actions les ferait jouer deux fois.
- **Tests unitaires** (`battle-orchestrator.test.ts`) : un tour distant **n'ouvre pas le menu**
  d'actions (le test qui aurait attrapé le piège 2) ; une attaque à retraite venue du réseau est
  acceptée (piège 3) ; index décalé → refus ; barème 1/2/3 → constat au troisième.
- **Un test d'intégration à deux moteurs** (`game-designer`) : même graine, canal en mémoire, une
  séquence qui déclenche peur, confusion et verrouillage d'attaque (Encore, Entrave, Possessif,
  Rancune), et l'égalité de `getLegalActions()` vérifiée de bout en bout. Motif : **tout le barème
  repose sur le déterminisme bit-à-bit**. Un seul `Math.random` résiduel dans cette zone produirait
  une divergence systématique, toujours sur le même joueur, et l'éliminerait en trois tours — le
  barème ne sait pas distinguer une divergence d'un bug de notre côté.
- **Journaliser le `ActionError` précis à chaque refus** (`NotYourTurn`, `WrongPokemon`,
  `InvalidAction`…), même si la cause réseau reste la valeur fermée `diverged` : sinon un bug de
  déterminisme et une vraie divergence donnent le même symptôme opaque, invérifiable en recette.
- L'avertissement du 2e refus porte **le compteur** (« 2/3 »), pas un texte muet : l'imminence de
  l'élimination doit se voir des deux côtés.

**Découpe suggérée par `plan-reviewer`**, si l'étape se révèle trop grosse à reviewer d'un bloc :
**5a** la troisième réponse `"pending"` + la phase d'attente + le contexte `locked` · **5b**
`localPlayerIds` dans la config · **5c** `submitRemoteAction` et ses quatre niveaux de validation.
Décidable en codant : les trois se testent séparément.

### Étape 6 — Le câblage de l'application ✅ *livrée le 2026-09-08*

- `online-room.ts` gagne `getOnlineRoom(): Room | null`. Il n'a aujourd'hui que `hold` et `release` —
  personne ne peut lire le salon depuis le combat.
- `team-select-screen.ts:245` : `navigate("combat", …)` transporte la **place locale**. C'est
  l'information qui manque de bout en bout — le setup dit qui est humain, jamais qui c'est *moi*.
- `combat-screen.ts` : `localPlayerIds` dérivé de cette place ; `wireTurnReady` compose le hook d'IA
  existant avec le hook distant ; les rappels du salon branchés sur `submitRemoteAction` ; le forfait
  reçu appelle `engine.forfeit`.
- Sortie de combat : `releaseOnlineRoom()` sur tous les chemins de sortie.
- **La reprise, tranchée par D4** : on persiste comme en local, et la sauvegarde porte une marque
  « en ligne » que l'écran de reprise refuse. Sans cette marque, un rechargement rendrait la main sur
  **les deux camps** (les places distantes étant rabattues sur `human`, c'est un hot-seat déguisé).
  La re-jonction est du Lot B3, qui reconnectera sur ce même journal.

### Étape 7 — Dettes absorbées : la télémétrie du jeu en ligne ✅ *livrée le 2026-09-08*

Les deux dettes n'en font qu'une : `modeOf(humans)` (`battle-telemetry-session.ts:29`) ne connaît que
`local-hotseat` et `local-vs-ai`, et `telemetryTeams` est absent du setup composé, donc une partie en
ligne **n'émet pas `battle_started`** — le jeu en ligne est invisible dans les statistiques de combat.

- `mode: "online"` — le champ est un `string` libre côté client (`telemetry.ts:146`) et côté Worker
  (`report.ts:68`, agrégé par `bump(report.battlesByMode, payload.mode)`), donc rien à migrer.
- 🔴 **`telemetryTeams` ne porte que MA place.** Le motif inscrit au Lot B1 (« la composition des
  autres camps n'est pas de l'information locale ») est **incomplet** : le message `start` porte
  bel et bien `selection.pokemonDefinitionIds` de **chaque** place, l'information est donc là. Le
  vrai problème est le **double comptage** — deux pairs qui déclarent la même partie compteraient
  chaque équipe deux fois, et les statistiques d'usage à la Showdown sont précisément ce que le
  Lot A existe pour produire. Chacun déclare son camp : chaque équipe compte une fois, le total est
  juste. À consigner comme décision, en corrigeant le motif au passage.
- 🔴 **Marquer le forfait** (décision humaine, relevé par `game-designer`) : `endReason: "combat" |
  "forfeit"` sur `BattleEndedPayload`, et une valeur `KnockOutCause.Forfeit`. Motif — l'abandon se
  mesure aujourd'hui par l'**absence** de `battle_ended` (commentaire de `telemetry.ts:407-411`), et
  un forfait qui en émet un **casse cet invariant** : il sortirait du signal d'abandon pour polluer
  celui des victoires décisives que la Phase 8 veut lire. Sans marqueur, les Pokemon du camp éliminé
  remonteraient en plus en `KnockOutCause.Damage` (le repli de `telemetry.ts:118`), ce qui est
  factuellement faux. À porter aussi dans l'agrégation du Worker (`report.ts`) — hors périmètre de ce
  lot, mais à ne pas découvrir en Phase 8.
- Conséquence à vérifier : `trackedSidesOf(input.telemetryTeams)` (ligne 68) restreint le collecteur
  aux camps suivis. Avec une seule équipe déclarée, `battle_ended` ne rapporte que mes K.O. et mes
  attaques — c'est **voulu** et symétrique, mais il faut que la lecture SQL du Worker ne suppose pas
  deux camps par partie.

### Étape 8 — Tests e2e à deux contextes ✅ *livrée le 2026-09-08*

Le harnais sait déjà le faire (le scénario du Lot B1, `online-lobby.spec`), et le plan-cadre prévient
que cette famille de tests **se budgète** : la suite est à ~531 tests sous plafond CPU.

- **Un** scénario ajouté : deux contextes entrent en combat, chacun joue un tour, les deux plateaux
  concordent. Pas un scénario par cas de barème — ceux-là se prennent en intégration.
- Conventions : `.claude/rules/e2e.md`.
- L'essentiel de la couverture reste en **intégration** : deux moteurs, canal en mémoire, aucun
  navigateur. C'est ce qui garde le gate vert quand Internet tombe.

---

## Dettes absorbées — récapitulatif

| Dette | Où | Étape |
|-------|----|-------|
| `battle_started` n'a pas de mode `online` | `battle-telemetry-session.ts:29` | 7 |
| `telemetryTeams` absent du setup composé en ligne | `team-select-screen.ts:253` | 7 |
| `isNetworkMessage` ne valide que l'enveloppe | `packages/network/src/protocol.ts` | 3 |
| Le canal en mémoire ne portait pas le garde du vrai transport, donc aucun test d'intégration ne pouvait l'atteindre | `packages/network/src/testing/fake-transport.ts` | 4 |

## Ce que l'écriture a ajouté au plan

Quatre choses que la rédaction n'avait pas prévues et que le code a réclamées :

1. **`BattleEngine.actionLogLength`** — un accesseur, plutôt que `exportReplay().actions.length` qui
   recopie tout le journal à chaque action reçue. C'est le compteur que les deux pairs comparent (D3).
2. **`BattleEventType.PlayerForfeited`**, émis **en tête** de `forfeit()`, avant les K.O. qu'il
   entraîne. Sans lui, rien dans le flux ne distingue une équipe qui abandonne d'une équipe qui tombe
   sous les coups : ni la télémétrie (qui rangeait tout en `damage`), ni le journal — et l'exigence de
   l'humain était précisément que **l'éliminé et les camps tiers sachent pourquoi**.
3. **Une ligne de journal** (`battleLog.playerForfeited`) : « Le joueur 2 quitte la partie — les
   parties ne concordent plus. » Le numéro de camp et non un nom, la V1 n'en ayant pas (#906). C'est
   le seul endroit qui *dit* ce qui s'est passé ; l'écran de victoire, lui, arrivait sans explication.
4. **`isOnlineSave`** dans `battle-persistence.ts`, et le refus de l'offre de reprise au menu (D4).

5. **Une confirmation inattendue, par un test qui a échoué.** L'e2e comparait d'abord le panneau
   d'info entier des deux pairs : il a échoué sur `155/155` contre `100/100` pour le **même** Ptéra.
   Ce n'est pas une divergence — c'est le **fog** (plan 176) : celui qui possède le Pokemon lit ses
   PV exacts, l'autre les lit en pourcentage. Les deux panneaux diffèrent donc *à raison*, et cet
   échec est la meilleure preuve que `localPlayerIds` fait bien lire chacun par ses propres yeux.
   L'assertion ne porte plus que sur le nom.

Et deux modules neufs, isolés pour être testables seuls : `view-core/remote-action.ts` (la projection
canonique) et `app/network/online-battle.ts` (la traduction place ↔ joueur, plus le barème).

## Trois bugs trouvés, qui valent d'être retenus

- **L'annuaire public de PeerJS n'a jamais été joignable hors e2e.** `PeerJsTransport` passait
  `host`/`port`/`path`/`secure` explicitement à `undefined` ; `peerjs` fusionnant ses défauts par
  étalement, une clé à `undefined` **écrase** le défaut → `wss://undefined:undefined…` →
  `SyntaxError`. La recette du Lot B1 passait par `?peerPort`, qui renseigne les quatre options, donc
  le chemin par défaut n'avait jamais été emprunté. Le symptôme était illisible : `new Peer` hors du
  `try`, et `codeOfError` qui transtypait tout objet portant un `code` — d'où « room.error.12 »
  affiché au joueur.
- **`engine.forfeit()` appelé hors de l'orchestrateur ne s'affichait pour personne.** Rien n'écoute
  le moteur (`engine.on` n'a aucun appelant en production) : tout passe par la file d'animation.
  Équipe éliminée restée debout, ligne de journal jamais affichée, télémétrie de fin muette, aucun
  écran de victoire, orchestrateur bloqué à jamais.
- **Une action reçue avant que l'écran de combat ne soit branché était jetée sans trace**, et faisait
  éliminer un joueur honnête en trois tours. Les deux pairs n'entrent pas en combat au même instant
  (chargement carte + atlas). Tampon ajouté dans `Room`.

## Deux notes de méthode

- **Le garde `isNetworkMessage` ne vivait que dans le vrai transport** (voir étape 3/4) ; le canal en
  mémoire livrait tout, donc aucun test d'intégration ne pouvait atteindre le message tronqué. Un
  double plus permissif que la production fait passer en test ce qui casse en ligne — même famille
  que le tampon jeté du Lot B1.
- 🔴 **`/ci-gate` cadre `affected` sur `HEAD`.** Après le commit WIP de mi-chaîne, il ne voit plus que
  le diff post-commit : 14 tests au lieu de 531. Le sélecteur accepte un `baseRef`
  (`tsx scripts/e2e-affected.ts origin/main`). Point d'attention du skill `/ci-gate` : le gate d'avant
  le commit définitif devrait prendre `origin/main` comme base, sinon il valide moins que ce qu'on
  croit.

## Backlog laissé ouvert

- **Écran « cette partie n'existe pas »** : aujourd'hui une ligne de texte sous « Rejoindre ».
  L'humain souhaite quelque chose de plus parlant, voire un écran dédié. Question de forme à trancher
  (écran plein, modale, ou ligne rendue visible). Les six causes de refus sont déjà en énumération
  fermée.
- **Double comptage des parties en ligne en télémétrie** : chacun déclare son camp, donc les équipes
  comptent une fois, mais `battleId` est tiré localement et les deux pairs émettent `battle_started`
  — `battlesByMode` comptera **deux** parties `online` par match. À traiter avant la Phase 8.
- **`endReason` non agrégé côté Worker** : la Phase 8 devra écarter les forfaits des statistiques de
  matchup.
- **Le trou du modèle sans arbitre** : un pair qui refuse des actions légitimes élimine l'autre à
  coût nul, et `forfeitedSeat` n'est pas authentifiable. Sans effet dans le cadrage du jeu (#863) ;
  recours du côté du Lot B4.

## Critère de réussite

Un combat 1v1 complet de bout en bout entre deux navigateurs, sans qu'aucun serveur du projet
n'arbitre — jusqu'à l'écran de victoire, avec le récapitulatif du plan 197 et `battle_ended` émis des
deux côtés.

✅ **Atteint et validé à la main le 2026-09-08** : « Joueur 2 gagne ! · 5 tours · 54 s », sur le
service public de PeerJS.

## Hors périmètre — et où ça va

| Sujet | Lot |
|-------|-----|
| Chronomètre de tour, action par défaut au timeout | B3 |
| Chien de garde de connexion, reconnexion, abandon volontaire | B3 |
| Somme de contrôle d'état, reconstruction depuis le replay | B4 |
| Revanche, discussion écrite, nom de joueur | hors V1 (#906) |
| Fog réel en ligne | écarté définitivement (#863) |
| FFA à 12 en réseau | hors V1 |

## À ne pas oublier

- 🔴 **`NETWORK_VERSION` → 2** (étape 2). C'est le lot qui change le protocole.
- Les trois réglages de forfait à trancher **avant d'écrire le Lot B3** (délais raccourcis à 10 s
  une fois l'absence établie ; le forfait qui contourne les clauses de survie ; 45 s peut-être trop
  court pour une attaque de zone à plusieurs cibles) — pas ici, mais l'API `forfeit` de l'étape 1 est
  ce sur quoi ils se poseront.
- `docs/multiplayer.md` à corriger sur deux points en fin de lot : § Anti-triche (le « redemander »
  disparaît, D1) et § Protocole (les deux messages neufs). `doc-keeper` en fin de chaîne.
- 🔴 **Un trou du modèle « sans arbitre », à consigner et pas à résoudre ici** (relevé par
  `game-designer`) : côté émetteur, une action refusée ne coûte **rien** — son moteur local l'a
  acceptée. Le seul qui paie est le récepteur, en attente. Donc un pair qui refuse délibérément des
  actions **légitimes** élimine l'autre à coût nul, et `forfeitedSeat` n'étant pas authentifiable, il
  peut même le désigner directement. Sans effet dans le cadrage du jeu (#863), mais à ne pas laisser
  filer en silence jusqu'à ce qu'un joueur le découvre en ligne. Le recours serait du côté de la
  somme de contrôle du Lot B4, pas d'un accusé de réception de plus.
- Le rythme d'accumulation des trois refus n'est pas une durée fixe : il suit la cadence de tour de
  l'émetteur, donc la Vitesse de son équipe. Un profil lent étale ses trois refus sur plusieurs tours
  réels, pendant lesquels l'autre regarde un plateau figé — d'où le compteur « 2/3 » de l'étape 5,
  qui est le seul signal que le joueur ait.
- Le menu de combat grignotera le temps du joueur sans le dire — pastille « le temps continue » à
  prévoir quand le chrono existera (B3, noté par le plan 187).
