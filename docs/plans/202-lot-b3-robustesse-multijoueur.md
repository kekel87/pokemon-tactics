# Plan 202 — Lot B3 : robustesse du multijoueur

> **Statut** : in-progress — **exécution terminée** : les 7 étapes sont codées, e2e écrit, cahier de
> recette à jour, recette humaine et revue de code (`code-reviewer`, `core-guardian`) faites, tous
> les correctifs appliqués (2026-09-09). Seule la mesure à la main du délai de libération d'adresse
> du cloud PeerJS reste ouverte (backlog). Reste la **consignation au graphe** (décisions #963+, mise
> à jour de `plan-202`) avant que ce fichier ne soit supprimé. Voir § Ce que l'implémentation a
> corrigé et § Ce que la revue de code a trouvé.
> **Créé** : 2026-09-08
> **Revu** : 2026-09-08 — `plan-reviewer`, `game-designer`, `best-practices`. Les retours des trois
> sont intégrés ; ce qu'ils ont trouvé est consigné en bas de document (§ Ce que les revues ont
> corrigé), pour que la prochaine session sache ce qui a déjà été challengé.
> **Lot** : B3 du plan-cadre `195-phase7-multijoueur-telemetrie.md` (encore `in-progress`)
> **Préalable** : aucun. Le Lot B2 est clos (plan 201, `1c7c816`, validé à la main le 2026-09-08).
> **Critère du lot** (repris du plan-cadre) : **couper le réseau d'un pair et revenir.**
> **Référence de conception** : `docs/multiplayer.md` § Chronomètre de tour, § Gestion de la
> déconnexion, § Abandon volontaire. Décisions #864, #865, #905, #942, #944 et #819.

## Motivation

Aujourd'hui, un 1v1 en réseau se joue de bout en bout — tant que les deux joueurs restent. Dès que
l'un s'en va, rien ne se passe : l'autre attend un tour qui n'arrivera jamais, sur une phase
`waiting_remote` qui n'a pas de fin. Et le joueur parti ne peut pas revenir : sa sauvegarde de
combat existe, elle est même conservée exprès (décision #942), mais l'écran d'accueil **refuse** de
la proposer parce qu'une reprise ordinaire rendrait la main sur les deux camps (décision D4 du
plan 201, `isOnlineSave`).

Pire, et personne ne l'avait relevé avant d'écrire ce plan : **« Abandonner » existe déjà** dans le
menu de combat (plan 187), avec sa confirmation, et en ligne il fait `onBattleClosed()` puis
`onExit()` — donc il quitte la partie **sans prévenir l'adversaire**, qui reste devant un tour qui
ne viendra pas. L'abandon volontaire n'est pas à créer, il est à réparer.

Ce lot ferme les trois bouts : rythmer le tour, constater l'absence, et rendre le retour possible.

## Ce qui existe déjà, et que ce lot ne doit pas réinventer

| Acquis | Ce qu'il donne au Lot B3 |
|--------|--------------------------|
| `BattleEngine.forfeit(playerId)` (plan 201, 11 tests) | L'abandon volontaire et le forfait du chien de garde s'y branchent tels quels. Il écrit `currentHp = 0` en dur — donc hors du pipeline de dégâts — puis appelle `handleKo` par Pokemon, ce qui préserve les cascades. |
| Phase d'entrée `waiting_remote` (plan 201) | Distincte d'`animating` **exprès** pour que le chien de garde s'y accroche sans deviner. Famille d'entrée `watching` : caméra et journal restent vivants. |
| `orchestrator.applyForfeit(playerId)` | Seul point d'entrée du forfait dans la vue — il remet les événements dans la file d'animation, donc l'écran de victoire et la télémétrie suivent. |
| Message `forfeit`, champ `forfeitedSeat` | Déjà défini, valant `seat` pour un **abandon volontaire** : le champ a été écrit pour ce lot. |
| Entrée « Abandonner » du menu de combat (`onAbandon`, plan 187/189) | Le contrôle, sa confirmation et sa place dans la navigation clavier/manette existent. Seul son **effet en ligne** manque. |
| `BattleOrchestratorConfig` et ses rappels (`onLocalAction`, `onRemoteActionRejected`, `getElapsedMs`) | Le patron exact où brancher le chrono et l'entrée/sortie de `waiting_remote` : la vue ne décide pas, elle prévient l'hôte. |
| `engine.exportReplay()` et `engine.actionLogLength` | La queue du journal pour le rattrapage, sans écrire un seul accesseur. |
| Délais de grâce du salon (`GRACE_AFTER_CLEAN_CLOSE_MS` = 10 s, `GRACE_AFTER_SILENCE_MS` = 45 s, #905) | Le **prototype** de la politique de combat, et le modèle mental à garder : un départ n'est pas un état, c'est un silence. |
| Sauvegarde `{ setup + graines + actions }` et `resumeBattle` (plan 181) | La reconnexion est un **rejeu**, pas un protocole neuf. |
| `holdOnlineRoom` / `getOnlineRoom` (plan 199, correctif de revue) | Le salon vit **hors des écrans**. C'est la couture par laquelle un salon reconstruit entre en combat sans toucher à `wireOnlineBattle`. |
| `claimOwnIdentity` / `hostPeerId(code)` | L'adresse d'annuaire **dérive du code de salon**, donc un pair qui recharge reprend la même adresse et reste joignable. C'est ce qui rend la reconnexion possible sans annuaire d'état. |
| `RoomTimers` injectable + `fake-transport` | Tout ce lot est testable sans réseau et **sans laisser tourner 75 secondes**. |

## Réglages tranchés avec l'humain le 2026-09-08

| Réglage | Valeur | Motif |
|---------|--------|-------|
| **Durée du chrono de tour** | **60 s** | Une seule fenêtre doit couvrir déplacement + sous-menu + choix d'attaque + visée + confirmation + orientation, au pad et au doigt, sur une grille iso avec hauteurs. Le 45 s du VGC est un précédent pour un **choix unique**, pas pour un tour tactique multi-étapes. |
| **Portée de la fenêtre** | **Une par tour**, jamais rejouée | `enterActionMenu()` est rappelé à **chaque étape** du tour (après un déplacement accepté, après une attaque, sur chaque annulation). Redémarrer le compte à rebours dessus permettrait de geler la partie indéfiniment en annulant en boucle. |
| **Action par défaut au timeout** | **`EndTurn`, orientation courante** | Aucune décision de jeu prise à la place du joueur, action toujours légale, et elle traverse le replay sans cas particulier. Surtout pas une attaque au hasard. |
| **Chien de garde — premier déclenchement** | **chrono + 15 s = 75 s** | La marge de #865. Elle couvre l'animation d'une attaque de zone à plusieurs cibles **plus** une latence honnête. |
| **Chien de garde — déclenchements suivants** | **10 s**, une fois l'absence établie | Un pair qui a déjà disparu une fois n'a pas droit à la présomption de lenteur une seconde fois. |
| **Trois tours manqués consécutifs** | **Forfait**, avec avertissement visible au deuxième | Même patron et même seuil que le barème de divergence du Lot B2, qui affiche déjà « 2/3 ». |
| **Le forfait contourne les clauses de survie** | **Oui — statu quo** | `forfeit()` met les PV à 0 en dur, donc hors du pipeline de dégâts : Ténacité, Fermeté et Ceinture Force ne se déclenchent jamais. Un abandon n'est pas un dégât, c'est un renoncement. Aucun code à changer, seulement l'intention à consigner. |
| **Signal précoce de connexion incertaine** | **Dans ce lot** | `connectionState` de la `RTCPeerConnection` que PeerJS expose déjà. Zéro message de protocole. |

### Deux pièges de valeurs, à ne pas rejouer

🔴 **Le « 45 s » que la mémoire portait n'est pas le chrono de tour**, c'est le délai de grâce du
salon après un silence (#905). Les deux se ressemblaient assez pour être confondus, et la confusion
était piégeuse : 45 s de silence en combat serait tombé pile quand un chrono honnête de 45 s expire,
donc faux positif sur chaque tour joué à la dernière seconde — exactement ce contre quoi #865 met en
garde. Le chien de garde de **combat** vaut 75 s et ne réutilise **pas** `GRACE_AFTER_SILENCE_MS`.

🔴 **`CT_WAIT` = 350 est le coût le plus bas de toute la table** (`packages/core/src/battle/ct-costs.ts` :
déplacement seul 400, attaque seule ≥ 500, combo ≥ 750). L'action par défaut au timeout est donc
aussi **la plus rentable en tempo de jeu** : le joueur qui laisse expirer son chrono revient au
seuil d'action plus vite que celui qui joue vraiment. Le plan-cadre 195 l'avait noté ; la première
rédaction de ce plan l'a présenté comme « neutre », ce qui est faux. **Asymétrie assumée** : l'effet
plateau est nul (aucun déplacement, aucun dégât), aucun move ni talent du roster ne récompense
l'attente pure, et corriger le coût du timeout demanderait un `CT_WAIT` propre au réseau — un
deuxième barème pour un gain nul.

## Hypothèse assumée, confirmée par la revue design

**Le chrono est propre au jeu en ligne.** Il ne tourne ni en solo ni en hot-seat. La décision #819
(« un seul comportement, dès le solo ») porte sur le **menu de combat**, qui ne suspend ni l'IA ni
les animations y compris en solo — pas sur un compte à rebours. La seule raison d'être du chrono est
de ne pas faire attendre un pair distant : contrainte absente en solo, et en hot-seat l'autre joueur
est physiquement là.

Conséquence portée par l'implémentation plutôt que par un `if` : le chrono **est** son champ de
configuration. `turnClock` absent = pas de chrono. Le solo n'a rien à désactiver.

---

## Découpage en étapes

Chaque étape est livrable et testable seule. L'ordre n'est pas négociable : l'étape 2 a besoin du
chrono de l'étape 1 pour calculer sa marge, et l'étape 5 a besoin de l'admission de l'étape 4.

`NETWORK_VERSION` passe de **2 à 3**, **une seule fois** pour tout le lot, à la première étape qui
touche le protocole (l'étape 3). `SAVE_VERSION` passe de **1 à 2** à l'étape 5.

### Étape 1 — Chronomètre de tour, local et auto-déclarant

**Où** : `packages/render-ports/src/ports.ts` (`BattleChrome`, `BattleOrchestratorConfig`),
`packages/view-core/src/battle-orchestrator.ts`, `packages/ui-dom/src/battle-chrome.ts`,
`packages/app/src/babylon/combat-screen.ts`.

Le chrono n'est **pas** dans `packages/core` : il ne change aucune règle du jeu, il déclenche une
action que le moteur connaît déjà. Le core reste sans horloge, comme il doit l'être.

**Le contrat, qui règle l'injection et le « online-only » du même coup.** L'orchestrateur n'a
aujourd'hui aucun minuteur — un seul `setTimeout`, dans un helper `delay`. Nouveau champ de
`BattleOrchestratorConfig`, sur le patron de `getElapsedMs` :

```ts
/** Absent = pas de chrono (solo, hot-seat, studio). */
turnClock?: {
  durationMs: number;
  /** Rend de quoi annuler. Injecté par les tests ; défaut navigateur côté application. */
  schedule: (callback: () => void, delayMs: number) => () => void;
};
```

- Constante `ONLINE_TURN_DURATION_MS = 60_000`, dans `packages/network/src/protocol.ts` et non dans
  la vue : c'est une valeur que les deux pairs doivent partager, au même titre que `NETWORK_VERSION`.
- 🔴 **Une échéance en horloge murale, jamais un `setTimeout` unique de 60 s.** L'orchestrateur
  retient `deadlineAt = now() + durationMs` et se réveille périodiquement pour comparer. Motif : un
  onglet en arrière-plan voit ses minuteurs ralentis (Chrome ~1/s, puis ~1/min après 5 min
  d'inactivité), donc un `setTimeout(60000)` unique se déclencherait très en retard — et le joueur
  serait forfaité par le chien de garde de l'adversaire avant que son propre chrono ne parle. Avec
  une échéance, le réveil ralenti constate immédiatement le dépassement et soumet l'action.
- **Une fenêtre par tour.** Elle démarre quand l'acteur courant devient une place **locale**, dans
  `refreshUI()` — pas dans `enterActionMenu()`, qui est rappelé à chaque étape du tour et sur chaque
  annulation. Un test doit épingler ça : un déplacement suivi d'une attaque **ne remet pas** le
  compteur à 60 000 ms.
- À l'expiration : soumettre **`ActionKind.EndTurn` avec l'orientation courante**, par le chemin
  ordinaire (`executeAction`), donc persistée, diffusée et rejouable comme n'importe quelle autre.
  Aucun message réseau nouveau (#864).
  🔴 **Pas `CT_WAIT` / « Attendre »** : cette action n'est légale que si `hasMoved` et `hasActed`
  sont tous deux faux. Un timeout survenant après un déplacement déjà validé se ferait refuser par
  le moteur — le bug que cette ligne existe pour empêcher.
- Le chrono est **suspendu** pendant `animating` (l'animation de l'action précédente ne mange pas le
  temps de réflexion) et à l'écran de victoire. Il **ne s'arrête pas** quand le menu de combat
  s'ouvre (#819), d'où la pastille de l'étape 6.
- Nouveau membre de `BattleChrome` : `updateTurnClock(view: TurnClockView | null)`, `null` masquant
  le compteur. Il porte le temps restant et le camp concerné — **le chrono du tour distant est
  affiché aussi**, sinon l'attente n'a pas de fin visible. C'est un écart délibéré d'avec Pokémon
  Showdown, qui cache le temps de l'adversaire : Showdown est à choix simultané, où le temps de
  réflexion trahit l'incertitude, alors qu'ici le tour est séquentiel et le plateau visible — on est
  plus près d'une pendule d'échecs, où les deux cadrans se voient toujours.

**Tests** : unitaires `battle-orchestrator.test.ts`, `schedule` injecté — l'expiration produit une
action `end_turn` ; elle entre dans `recordedActions` ; `turnClock` absent ⇒ aucun minuteur ; un
déplacement puis une attaque dans le même tour ne rejouent pas la fenêtre ; un tour joué avant
l'échéance annule le minuteur ; un réveil **postérieur** à l'échéance (minuteur ralenti simulé)
soumet l'action immédiatement au lieu de replanifier.

### Étape 2 — Chien de garde de connexion, distinct du chrono

**Où** : `packages/network/src/room.ts`, `packages/render-ports/src/ports.ts`,
`packages/view-core/src/battle-orchestrator.ts`, `packages/app/src/network/online-battle.ts`,
`packages/network/src/protocol.ts`.

Deux signaux mènent au même écran, et il faut les deux — ils ne détectent pas la même panne :

| Signal | Ce qu'il attrape | Délai |
|--------|------------------|-------|
| **Canal refermé** (`handleChannelClosed`) | Onglet fermé, réseau coupé net, rechargement de page | 10 s si un `bye` a précédé, 75 s sinon |
| **Silence sur `waiting_remote`** | Onglet **gelé** dont la connexion reste ouverte | 75 s à partir de l'entrée en `waiting_remote`, puis 10 s |

🔴 **Le second signal se mesure depuis l'entrée en `waiting_remote`, jamais depuis « le dernier
message reçu »**. Pendant notre propre tour, le silence de l'adversaire est le comportement normal :
il n'a rien à envoyer. Un chien de garde fondé sur la date du dernier message éliminerait un joueur
attentif pendant qu'on réfléchit.

**Qui tient quel minuteur, et qui décide.** Le point que la revue a trouvé sous-spécifié :

- `room.ts` tient le minuteur du **canal refermé** — il l'a déjà. Il ne décide **rien** : il ne
  connaît ni les joueurs ni le moteur. À l'expiration il émet `onPeerAbsent(seat)`, nouveau rappel
  du salon, exactement comme `onAction` et `onForfeit`.
- `resolveDeparture` choisit désormais sa politique sur `this.locked` : salon → la place redevient
  libre (comportement actuel) ; **partie lancée → `onPeerAbsent`**, et surtout **pas** un retour de
  la place en `Waiting`, qui n'a aucun sens en combat.
- L'orchestrateur ne tient pas non plus le minuteur du **silence** : il signale seulement l'état, par
  un nouveau rappel de configuration `onWaitingRemote?: (playerId: string | null) => void` — le
  `playerId` attendu à l'entrée, `null` à la sortie.
- `online-battle.ts` est le seul à tenir les deux bouts (le salon **et** l'orchestrateur), donc c'est
  lui qui tient le minuteur de silence et qui décide. Il fait, sur les deux signaux, ce qu'il fait
  déjà pour le troisième refus du barème :
  `room.sendForfeit(seat, NetworkForfeitReason.Absent)` **puis** `attached.applyForfeit(playerId)` —
  on le dit avant de l'appliquer, parce qu'un pair absent peut très bien revenir sans nous écouter.
- Nouvelle cause dans `NetworkForfeitReason`, énumération **fermée** (c'est aussi une valeur de
  télémétrie) : `Absent: "absent"`. Elle n'accuse personne, comme `EtatDivergent`.

**Trois tours manqués consécutifs** (#905), le pendant AFK d'un pair dont le canal reste ouvert :

- Un `end_turn` reçu est **indiscernable** d'un « Attendre » joué volontairement — et forfaiter
  quelqu'un qui finit trois tours de suite sans agir serait absurde. Le message `action` gagne donc
  `timedOut?: true`, que l'émetteur pose lui-même quand l'action vient de son chrono.
- 🔴 **Auto-déclaré et non authentifiable**, comme `forfeitedSeat` : un client patché peut ne jamais
  le poser et échapper au compteur. C'est déjà la surface de triche assumée de #865 (« un client qui
  s'octroie plus de temps n'est puni par rien d'automatique »), pas une brèche nouvelle. Mentir dans
  l'autre sens ne fait que se nuire.
- Compteur **par place**, dans `online-battle.ts` avec le reste du barème. Remis à zéro par toute
  action sans le drapeau. Au deuxième, **avertissement visible « 2/3 »**, comme le barème de
  divergence. Au troisième, le même chemin de forfait que ci-dessus.

**Tests** : intégration `room` sur `fake-transport` avec `RoomTimers` injecté — canal fermé sans
`bye` ⇒ `onPeerAbsent` à 75 s et pas avant ; avec `bye` ⇒ 10 s ; une reconnexion avant l'échéance
annule le minuteur ; une seconde absence déclenche à 10 s ; un salon **non verrouillé** garde le
comportement de libération de place. Unitaires `online-battle.test.ts` pour le compteur AFK et son
avertissement au deuxième.

### Étape 3 — Signal précoce : lire ce que WebRTC sait déjà

**Où** : `packages/network/src/peer-connection.ts`, `packages/network/src/transport.ts`.

Le chien de garde de l'étape 2 est notre filet, mais il est lent par construction : 75 s de silence
avant de dire quoi que ce soit. Le navigateur, lui, sait bien plus tôt. ICE Consent Freshness
(RFC 7675) fait émettre une requête STUN toutes les 5 à 15 s sur le chemin établi ; sans réponse,
`connectionState` passe à `disconnected` en ~5 s puis à `failed` vers ~30 s. C'est aussi ce qui
maintient ouverte la correspondance NAT, que les box réclament après 30 à 60 s de silence — une
fenêtre dans laquelle un tour de 60 s sans un paquet applicatif tombe tout à fait.

- `NetworkChannel` gagne `onHealthChange(listener: (health: ChannelHealth) => void)`, avec
  `ChannelHealth` en énumération fermée : `Healthy`, `Uncertain`, `Failed`.
- `PeerChannel` tient déjà son `DataConnection` ; la `RTCPeerConnection` en est accessible. Brancher
  l'écouteur d'état, traduire, propager. `fake-transport` rend `Healthy` et permet de pousser les
  autres à la main.
- 🔴 **Aucun message de protocole, aucun ping applicatif.** On lit un état que le navigateur calcule
  déjà. Écrire notre propre battement de cœur coûterait du code et du trafic pour une information
  qu'on a gratuitement.
- `Uncertain` **ne déclenche aucun forfait** — il alimente seulement le bandeau de l'étape 6. Le
  forfait reste au chien de garde : `disconnected` se rétablit tout seul très souvent, et éliminer
  quelqu'un sur un rétablissable serait pire que d'attendre.

**Tests** : unitaires `peer-connection` avec `vi.mock("peerjs")` — le patron est déjà en place
(`implementation-peer-connection-tests-2026-09-06`) ; les trois états se propagent, et le
désabonnement coupe bien.

### Étape 4 — Admettre un revenant dans un salon verrouillé

**Où** : `packages/network/src/room.ts` (`attachIncoming`, `waitForWelcome`, `resolveDeparture`),
`packages/network/src/protocol.ts`.

C'est le verrou qui bloque tout aujourd'hui : `attachIncoming` **referme sans un mot** tout canal
entrant quand `this.locked` est vrai, et l'arrivant lit `partie_commencee`. Un revenant tombe donc
exactement sur le message qui lui dit de ne pas revenir.

- Le salon verrouillé admet un canal entrant **si et seulement si** sa place est dans l'ensemble des
  places attendues (celles dont le délai de grâce court). Toute autre reste refusée sur
  `partie_commencee` : ce n'est pas une réouverture du salon, c'est une porte pour un seul.
- La place est lue dans **l'adresse d'annuaire** (`seatFromPeerId`), jamais dans le message : c'est
  l'invariant de fiabilité du Lot B2, et il vaut ici plus qu'ailleurs.
- L'hôte répond `welcome` à un revenant, verrou compris — sinon `waitForWelcome` échoue sur la
  fermeture et rend `partie_commencee`.
- 🔴 **Cas de l'hôte parti.** Le code **est** son adresse (#904), donc un hôte qui recharge reprend
  la même adresse et redevient joignable : sa reconnexion passe par le même chemin que celle de
  l'invité, à condition que `resolveDeparture` **cesse de renvoyer l'invité à l'écran `lobby`** dès
  la première seconde de silence quand la partie est lancée. C'est la conséquence la plus facile à
  manquer de cette étape, et elle a son propre test.

**Tests** : intégration — un pair dont le canal s'est refermé se reconnecte pendant sa grâce et
obtient un `welcome` ; un pair **inconnu** se voit toujours refuser `partie_commencee` ; une
reconnexion après l'échéance est refusée ; l'hôte qui revient ne trouve pas son invité reparti au
`lobby`.

### Étape 5 — Rattrapage : le revenant rejoue, puis se remet à jour

**Où** : `packages/network/src/protocol.ts`, `packages/network/src/room.ts`,
`packages/app/src/app/screens.ts`, `packages/app/src/app/battle-persistence.ts`,
`packages/app/src/ui/dom/screens/main-menu-screen.ts`,
`packages/app/src/babylon/combat-screen.ts`, `packages/app/src/network/online-battle.ts`,
`packages/view-core/src/battle-orchestrator.ts`.

Le revenant a sa propre sauvegarde : setup, graines, et les actions **qu'il avait appliquées**. Il
lui manque celles jouées pendant son absence. En 1v1 l'écart est petit — le jeu se bloque dès que
c'est son tour — mais il n'est pas nul : l'adversaire a pu enchaîner plusieurs tours au Charge Time.

**Le chemin complet, de bout en bout** (le point que la revue a jugé bloquant) :

1. **La sauvegarde apprend le code du salon.** `CombatSetup` porte `localSeat` mais **pas** le code,
   et sans lui il n'y a aucune adresse à rappeler. Un champ `roomCode?: string`, et `SAVE_VERSION`
   de 1 à 2 (une sauvegarde d'un autre schéma est jetée, jamais migrée — règle du fichier).
2. **L'écran d'accueil propose la reprise.** `isOnlineSave(save)` cesse d'être un refus sec
   (`main-menu-screen.ts:63`) et devient l'entrée « Reprendre le combat », comme pour une partie
   locale.
3. **La reconnexion précède l'écran de combat.** Au clic : `Room.rejoin({ code, seat })` — nouvelle
   entrée du salon, à côté de `create` et `join` —, on attend le `welcome`, puis
   `holdOnlineRoom(room)`, et **alors** on navigue vers le combat. Le salon vit déjà hors des écrans
   pour cette raison précise : `wireOnlineBattle` lit `getOnlineRoom()` et n'a donc **aucune
   signature à changer**. Le porteur de salon est la couture.
4. **L'échec de reconnexion est un chemin normal**, pas un écran figé : `NetworkErrorCode` remonté et
   affiché par le même rendu d'erreur que l'écran `lobby`, sauvegarde jetée, retour au menu. Grâce
   expirée, hôte parti pour de bon, pare-feu : trois causes, un seul comportement.
5. **Deux messages, symétriques et minuscules** :
   - `resync_request { seat, actionIndex }` — « j'en suis là, donne-moi la suite » ;
   - `resync { fromIndex, actions }` — la queue du journal.
6. **Qui envoie quoi, et quand.** `wireOnlineBattle` gagne un `resuming: boolean` (lu de la
   sauvegarde). Dans `attach()`, un câblage qui reprend envoie `resync_request` avec
   `engine.actionLogLength` — après l'abonnement à `onAction`, pour ne pas perdre une action qui
   croiserait la demande. En face, le pair resté répond dans son propre `onResyncRequest` :
   `room.sendResync(seat, orchestrator.actionsSince(fromIndex))`. Nouveau membre mince de
   l'orchestrateur, `actionsSince(index)`, qui rend `engine.exportReplay().actions.slice(index)` —
   la vue n'expose pas son moteur.
7. **Le revenant applique par `submitRemoteAction`**, dans l'ordre, une par une. Le même chemin, les
   mêmes quatre contrôles, le même barème. Aucun mode « confiance » : une divergence pendant un
   rattrapage est justement le moment où on veut la voir.
   ⚠️ Le message porte des `Action` **nues**, sans place d'auteur, et c'est volontaire : le revenant
   rejoue un état déterministe, donc **son moteur sait déjà** qui doit agir à chaque index. Il
   renseigne l'enveloppe depuis son acteur courant. Conséquence à connaître : le contrôle « la place »
   devient tautologique pendant un rattrapage — ce sont la **légalité** et le **moteur** qui
   attrapent une divergence, et ce sont eux qui comptent.

⚠️ **Ce que cette étape ne fait pas** : elle ne vérifie pas que les deux journaux **concordent**
au-delà de l'index. Deux pairs peuvent se rattraper sur un état déjà divergent et ne s'en apercevoir
qu'au refus suivant. C'est le travail du **Lot B4** (somme de contrôle d'état), et le mentionner ici
évite de croire ce lot plus fort qu'il n'est.

**Tests** : intégration à deux salons sur `fake-transport` — un pair rate deux actions, revient,
demande le rattrapage, et les deux moteurs finissent au même index ; une action qui croise la
demande n'est pas perdue ; un rattrapage sur un journal divergent est refusé au lieu d'être avalé.
E2e à deux contextes : couper le canal d'un contexte, le recharger, et voir la partie reprendre.

### Étape 6 — Abandon volontaire, et ce que le joueur voit

**Où** : `packages/app/src/babylon/combat-screen.ts`, `packages/app/src/ui/dom/combat-menu.ts`,
`packages/ui-dom/src/battle-chrome.ts`, `packages/app/src/i18n/locales/*`.

- **« Abandonner » est à réparer, pas à créer.** L'entrée existe (plan 187), avec sa confirmation et
  sa navigation clavier/manette. Son `onAbandon` fait aujourd'hui `onBattleClosed()` puis
  `onExit()` (`combat-screen.ts:475`) : en ligne, **l'adversaire n'en sait rien**. Y brancher, quand
  le salon existe, `room.sendForfeit(monSiège, NetworkForfeitReason.Abandon)` **puis**
  `orchestrator.applyForfeit(monJoueur)` — l'ordre compte, comme pour le barème de divergence, parce
  qu'on part et qu'on ne pourra plus rien dire ensuite.
- Nouvelle cause : `Abandon: "resigned"` — distincte d'`absent` et de `diverged`, parce que les trois
  méritent trois phrases différentes à l'écran et trois lignes différentes en télémétrie.
- **Bandeau d'attente**, alimenté par trois sources et un seul rendu : `Uncertain` de l'étape 3
  (« connexion instable »), grâce en cours de l'étape 2 (« en attente de reconnexion… », avec le
  temps restant), et l'avertissement « 2/3 » du compteur AFK. Il remplace le silence actuel de
  `waiting_remote`, qui ne dit rien de ce qui se passe. Nouveau membre de `BattleChrome`,
  `updateConnectionNotice(view | null)`, sur le patron d'`updateWeather`.
- **Pastille « le temps continue » sur le menu de combat** (dette notée par le plan 187) : le menu
  n'est pas une pause (#819) et il grignote désormais du temps mesuré. Ne pas le dire serait un piège.
- Le `bye` doit partir à la **fermeture d'onglet**, pas seulement sur « Quitter » — c'est lui qui
  vaut le délai court de 10 s au lieu de 75 s. Vérifier que `releaseOnlineRoom` est bien atteint par
  `pagehide`, et pas seulement par le bouton.

**Passe multi-entrée obligatoire** (`.claude/rules/multi-input.md`) : le compteur de chrono et le
bandeau sont des éléments d'interface neufs. Quatre axes mesurés au chrome-devtools avant de faire
tester — clavier (atteinte aux flèches depuis un contrôle voisin, jamais `.focus()` sur la cible),
manette, tactile (hit-area ≥ 30 px sous `pointer: coarse`), responsive aux cinq formats. Le compteur
ne doit chevaucher ni la timeline ni le panneau d'information en 568×320. L'entrée « Abandonner »
existe déjà et sa navigation est acquise — vérifier seulement qu'ajouter la pastille ne la casse pas.

### Étape 7 — Test de parité et cahier de recette

- **Test manquant repéré par la revue design** : `forfeit()` déclenche Rancune exactement comme Lien
  du Destin (même bloc de `handleKo`), mais seul Lien du Destin a son test dédié
  (`BattleEngine.forfeit.test.ts`). Ajouter le symétrique — risque faible, parité de couverture.
- **Scénario de recette au tempo rapide** : le Charge Time crée une asymétrie que ni
  `docs/multiplayer.md` ni la première rédaction de ce plan ne mentionnaient. Un attaquant hâté
  revient à l'action bien plus souvent en temps réel qu'un profil lent, donc **pour la même absence
  réelle** (un appel de trois minutes) il cumule trois timeouts consécutifs là où un support lent en
  cumule un. Scénario dédié avec Électrode sous Hâte, pour vérifier que la fenêtre avant élimination
  reste vivable au tempo le plus élevé du roster.
- Cahier de recette (graphe, entités `recette`) : chrono visible et lisible aux cinq formats, bandeau
  d'attente dans ses trois états, abandon vu des deux côtés.

---

## Décisions à consigner au graphe

À écrire à la clôture, numérotées à partir de **#946** (la dernière existante est #945) :

1. Chrono de tour à **60 s**, **une fenêtre par tour** jamais rejouée, **propre au jeu en ligne** —
   avec le motif du rejet du chrono en solo et celui du rejet du redémarrage intra-tour (l'annulation
   en boucle gèlerait la partie).
2. Le chrono est une **échéance en horloge murale**, pas un `setTimeout` unique — et le trou que ça
   ferme (onglet en arrière-plan pendant son propre tour).
3. Action par défaut au timeout = **`EndTurn`, orientation courante**, et non « Attendre », qui est
   illégal après un déplacement déjà validé.
4. **Asymétrie `CT_WAIT` assumée** : le timeout est l'action la moins chère de la table, donc la plus
   rentable en tempo. Effet plateau nul, pas de barème réseau séparé.
5. Chien de garde de combat à **chrono + 15 s = 75 s**, puis paliers de 10 s — et pourquoi il ne
   réutilise **pas** `GRACE_AFTER_SILENCE_MS` malgré la ressemblance des valeurs.
6. Le chien de garde de combat se mesure depuis l'entrée en `waiting_remote`, pas depuis le dernier
   message reçu. `room.ts` tient le minuteur du canal et **ne décide rien** (`onPeerAbsent`) ;
   `online-battle.ts` décide.
7. Trois tours manqués consécutifs = forfait, avec avertissement « 2/3 ». Repose sur un drapeau
   `timedOut` **auto-déclaré et non authentifiable**, dans la surface de triche déjà assumée par #865.
8. L'abandon contourne les clauses de survie (Ténacité, Fermeté, Ceinture Force) : statu quo assumé,
   un abandon n'est pas un dégât. Les cascades de K.O. (Lien du Destin, Rancune, Représailles) sont
   préservées, elles.
9. Un salon verrouillé admet un revenant **et lui seul** — la place vient de l'adresse d'annuaire.
10. Le rattrapage passe par `submitRemoteAction`, sans mode « confiance », et le message porte des
    actions **nues** parce que le moteur du revenant sait qui agit.
11. Le signal précoce vient de `connectionState` (ICE Consent Freshness), **pas** d'un battement de
    cœur applicatif — et il n'entraîne jamais de forfait à lui seul.

## Risques

- **Le cas qui ne se teste pas en local** : la traversée de pare-feu entre deux réseaux réellement
  différents, avec l'onglet mis en arrière-plan pour aller coller le code dans une messagerie. C'est
  le scénario que #905 décrit comme « dans le flux, pas un cas limite », et personne ne peut le
  jouer sur une boucle locale. Risque assumé de la V1, comme au Lot B2.
- 🔴 **À mesurer sur le vrai cloud PeerJS avant de clore le lot, parce que l'e2e ne l'exercera
  jamais** (elle utilise un signaling local) : PeerJS a été observé mettant jusqu'à **~1 minute** à
  signaler `disconnected` et à libérer une adresse. Deux conséquences si c'est confirmé — le chemin
  rapide à 10 s ne se déclencherait presque jamais en vrai (un `bye` suppose un envoi réussi *avant*
  la coupure, ce qui échoue justement sur une coupure brutale), et une reconnexion légitime pourrait
  taper `salon_plein`. Le budget de réessai de la prise d'identifiant existe déjà dans
  `transport.ts` ; vérifier qu'il suffit, et l'allonger si besoin **sans toucher aux 75 s de grâce**.
- **Asymétrie de base de temps entre le chrono et le chien de garde adverse.** Mettre son onglet en
  arrière-plan pendant **son propre** tour reste vulnérable : l'échéance en horloge murale referme le
  cas courant (réveil ~1/s pendant les cinq premières minutes), mais au-delà de cinq minutes
  d'arrière-plan le réveil tombe à ~1/min et le forfait de l'adversaire peut arriver d'abord. Assumé :
  passé cinq minutes, le joueur *est* parti. La première rédaction de ce plan affirmait que « la
  dérive va dans le bon sens gratuitement » — c'est vrai de son propre chrono, faux du chien de garde
  d'en face, et il ne faut pas le réécrire à l'identique.
- **« Onglet gelé » recouvre deux réalités**, à ne pas confondre en lisant #905 : le *ralentissement*
  des minuteurs (couvert par la marge du chien de garde) et le **déchargement complet** de l'onglet
  sous pression mémoire iOS, qui détruit le contexte JS et la connexion WebRTC — celui-là n'est pas
  un cas de chrono du tout, c'est le chemin de reconnexion des étapes 4 et 5.
- **Un forfait de chien de garde n'est pas authentifiable**, comme `forfeitedSeat` en général
  (`backlog-forfait-sans-arbitre-non-authentifiable`) : un pair peut prétendre que l'autre est
  absent. Sans effet dans le cadrage du jeu (#863) ; le recours serait la somme de contrôle du
  Lot B4, pas un accusé de réception de plus.
- **`NETWORK_VERSION` 2 → 3, une seule fois** : ce lot ajoute trois messages et une durée partagée.
  Deux pairs de versions différentes divergeraient sur le chrono sans le savoir.

## Critère de sortie

1. Deux navigateurs jouent un 1v1. On coupe le réseau de l'un ; l'autre voit « connexion instable »
   en quelques secondes, puis « en attente de reconnexion… » avec un décompte. Le premier recharge,
   reprend le combat depuis l'écran d'accueil, rattrape les actions manquées, et la partie continue
   jusqu'à l'écran de victoire.
2. Même manipulation sans revenir : le forfait tombe à 75 s, l'écran de victoire s'affiche chez celui
   qui est resté, et la sauvegarde est jetée.
3. Un joueur laisse expirer son chrono trois fois de suite : avertissement « 2/3 » au deuxième,
   élimination sur `absent` au troisième.
4. « Abandonner » dans le menu de combat termine la partie **chez les deux pairs**.
5. Le chrono ne tourne ni en solo ni en hot-seat, et un tour déplacement + attaque + orientation tient
   dans les 60 s **au pad**, y compris sur une attaque de zone à plusieurs cibles.
6. Passe multi-entrée mesurée sur le compteur et le bandeau, aux cinq formats.
7. Le délai réel de libération d'adresse du cloud PeerJS a été mesuré à la main (voir Risques).
8. `/ci-gate full` vert, e2e à deux contextes compris.

---

## Ce que les revues ont corrigé

Gardé pour que la prochaine session ne rejoue pas ces débats.

| Revue | Trouvaille | Suite |
|-------|-----------|-------|
| `game-designer` | `enterActionMenu()` est rappelé à **chaque étape** du tour et sur chaque annulation — « le chrono démarre là » était ambigu, et un redémarrage aurait permis de geler la partie en annulant en boucle | Fenêtre **par tour**, démarrée dans `refreshUI()`. Durée portée de 45 s à **60 s** avec l'humain, puisqu'une seule fenêtre doit tout couvrir |
| `game-designer` | « Attendre » (`CT_WAIT`) est **illégal** si `hasMoved` ou `hasActed` — un timeout mi-tour se ferait refuser par le moteur | Le repli est `EndTurn` avec l'orientation courante |
| `game-designer` | `CT_WAIT` = 350 est le coût **le plus bas de la table** ; le plan-cadre 195 l'avait noté, la première rédaction disait « aucune décision de jeu » | Asymétrie écrite et assumée (décision 4) |
| `game-designer` | Le barème de divergence affiche « 2/3 » ; le compteur AFK n'avertissait de rien | Même patron d'avertissement |
| `game-designer` | Rancune n'a pas de test dédié sur l'abandon, Lien du Destin oui | Étape 7 |
| `game-designer` | Au Charge Time, un profil rapide cumule trois timeouts en bien moins de temps réel qu'un lent | Scénario de recette avec Électrode sous Hâte |
| `best-practices` | « La dérive va dans le bon sens gratuitement » ne vaut que pour son propre chrono, pas pour le chien de garde d'en face | Échéance en horloge murale + risque documenté |
| `best-practices` | 45 s est la valeur du VGC — mais pour un **choix unique**, pas un tour tactique. 60 s est le délai de reconnexion de Pokémon Showdown | Ancrage externe des deux valeurs retenues |
| `best-practices` | Aucun battement de cœur, alors que WebRTC en fait déjà un (ICE Consent Freshness) | Étape 3 |
| `best-practices` | PeerJS peut mettre ~1 min à signaler `disconnected` et à libérer une adresse ; l'e2e ne l'exercera jamais | Risque à mesurer à la main, critère de sortie 7 |
| `plan-reviewer` | Reconstruction du salon non spécifiée (jugée bloquante) | Étape 5, point 3 : `Room.rejoin` puis `holdOnlineRoom` **avant** de naviguer — `wireOnlineBattle` ne change pas de signature |
| `plan-reviewer` | Flux `resync` sans émetteur, sans moment, sans lieu | Étape 5, points 5 à 7 |
| `plan-reviewer` | Appelant du forfait de chien de garde non désigné | Étape 2 : `room.onPeerAbsent` signale, `online-battle.ts` décide |
| `plan-reviewer` | Compteur AFK sans emplacement, et « un `end_turn` reçu est indiscernable d'un choix » | Drapeau `timedOut` auto-déclaré, compteur dans `online-battle.ts` |
| `plan-reviewer` | Injection des minuteurs du chrono non dite | `BattleOrchestratorConfig.turnClock`, dont l'absence **est** le « pas de chrono en solo » |
| `plan-reviewer` | Valeurs de version non tranchées | `NETWORK_VERSION` 2 → 3 (étape 4), `SAVE_VERSION` 1 → 2 (étape 5) |
| `plan-reviewer` | Intégration du bouton « Abandonner » vague | Il **existe déjà** — l'étape 6 répare son effet en ligne au lieu de le créer |

---

## Ce que l'implémentation a corrigé

Écrit le 2026-09-09, à la fin des 7 étapes. Ce que le plan disait et que le code a démenti — à lire
avant de rouvrir une de ces décisions.

| Ce que le plan annonçait | Ce que le code a imposé |
|---|---|
| Le palier de 10 s se déclenche « une fois l'absence établie » | **Il se marque à la FERMETURE du canal, pas à l'expiration du délai.** Marqué à l'expiration il était inatteignable : en 1v1 le premier déclenchement prononce déjà le forfait, donc il n'y a jamais de « fois suivante ». Il a un sens réel ainsi — un pair qui tombe, revient, puis retombe voit son second délai raccourci. **Amende la décision #950.** |
| Le chien de garde du silence a lui aussi ses paliers | **Retiré.** Là, si le minuteur tombe il élimine : un palier y serait du code qu'aucun chemin n'atteint. Le palier ne vit plus que dans le chien de garde de **connexion** (`room.ts`). |
| L'hôte revient « par le même chemin que l'invité » | **Faux, et c'était un trou fonctionnel.** Qui compose est asymétrique : l'invité appelle l'hôte, jamais l'inverse. Un hôte qui recharge reprend bien son adresse et écoute — mais **personne ne le rappelle**, donc l'invité attendait 75 s devant un hôte joignable puis prononçait un forfait. D'où `scheduleHostRedial` et `HOST_REDIAL_INTERVAL_MS` (2 s) : l'invité recompose tant que la grâce court. Le trou ne se voit pas en testant la reconnexion de l'invité, qui, elle, compose. |
| `handleHello` sort tôt sur un salon verrouillé | Il doit quand même **envoyer l'état du salon au revenant, à lui seul**. `handshakeWithHost` attend un premier `room_state` avant de se dire entré (sinon l'arrivant lit une configuration vide et croit à une incompatibilité de version) : sans cet envoi, un revenant attendait le délai de garde en entier pour finir sur « plus de réponse ». |
| Le bandeau est alimenté par trois sources | Il fallait une **résolution par gravité**, pas trois `notify` impératifs : les états se chevauchent (deux tours manqués **puis** une coupure) et le dernier appelé gagnait au lieu du plus grave. D'où `refreshNotice`, qui tranche une fois, au même endroit — et qui ne republie pas un bandeau identique, sinon son décompte repartirait de zéro à chaque passage. |
| Le compteur de chrono va dans `BattleChrome` | Oui, mais le **décompte du bandeau** tourne dans le DOM (`connection-notice.ts`) et non dans `packages/network`. Le module réseau donne un budget (`graceMs`) ; le transformer en secondes demande un battement, et le seul endroit du projet où un battement d'une seconde est banal est le DOM. Même raison qui met le chronomètre dans l'orchestrateur et pas dans le moteur. |
| — | **`packages/network` n'a pas la bibliothèque `DOM`**, délibérément (cf. son `tsconfig`). Lire `connectionState` obligeait donc à décrire localement la forme minimale d'une `RTCPeerConnection` (`IceConnectionLike`) plutôt qu'à tirer tout le DOM pour trois membres. |
| — | `codeOfError` vivait dans `team-select-screen.ts`. La reprise en ligne échoue par les **mêmes** causes que l'entrée dans un salon, donc il est devenu `packages/app/src/network/network-error.ts` — extrait, pas dupliqué. |
| Le délai court (10 s) valait pour un `bye` propre en combat, « inchangé » depuis le salon | **Faux, corrigé en recette humaine** (décision #961) : hérité sans être réexaminé, il produisait une absurdité mesurée à la main — fermer sa fenêtre poliment donnait **moins** de temps (10 s) qu'arracher son câble (75 s). En combat l'intention se déclare par le menu, jamais par la croix : le `bye` ne raccourcit plus le premier délai. Un seul chiffre, `BATTLE_GRACE_SHORT_MS` = **30 s**, sert désormais à la deuxième chute de la même place, clean ou brutale — demandé par l'humain pour n'avoir qu'un chiffre à retenir. |
| L'abandon confirmé au menu affichait « les parties ne concordent plus » | **Bug de recette** : c'était la phrase de la divergence (`diverged`), affichée pour **tout** forfait faute de distinction. `ForfeitReason` porte désormais `resigned` / `disconnected` / `desynced`, une phrase par cause. |
| — | **Bug de recette** : le bandeau de connexion (« en attente de reconnexion… », avertissement AFK) continuait de s'afficher par-dessus l'écran de victoire une fois le combat terminé. Corrigé : il se tait dès la fin du combat. |

### Ce que la revue de code a trouvé (`code-reviewer`, `core-guardian`, 2026-09-09)

Trois bloquants, tous la **même famille de bug** que le trou d'asymétrie hôte/invité ci-dessus : une
relation asymétrique testée dans une seule direction.

| Trouvaille | Correctif |
|---|---|
| La demande de rattrapage (`resync_request`) pouvait partir sans canal ouvert — un hôte revenu envoie sa demande avant que `scheduleHostRedial` n'ait rétabli la connexion, et le message se perdait silencieusement | La demande de rattrapage est désormais **réémissible** : elle repart avec chaque tentative de reconnexion tant qu'aucune réponse `resync` n'est reçue |
| Le chien de garde du silence (`onWaitingRemote`) ne se réarmait pas après le retour d'un pair — un pair qui revenait puis retombait n'était plus surveillé du tout, la seconde absence passait inaperçue | Le chien de garde recommence son attente à chaque nouvelle entrée en `waiting_remote`, y compris après une reconnexion |
| La sauvegarde de reprise (`roomCode` + actions) n'était jetée que sur la cause `partie_commencee` — toute autre erreur de reconnexion (transitoire : `connexion_impossible`, `delai_depasse`) laissait une sauvegarde orpheline que l'écran d'accueil reproposait indéfiniment sur un salon mort | La sauvegarde est jetée sur **toute** cause d'échec de reconnexion, pas seulement `partie_commencee` |

**Bilan** : ce lot a rencontré **quatre bugs d'asymétrie** au total — l'hôte qui ne rappelle jamais
(#957), les deux couches du salon revenu sans grâce ni état (#960), et cette demande de rattrapage
sans canal trouvée en revue. Le même angle mort à chaque fois : une relation testée dans un seul
sens (l'invité qui revient, jamais l'hôte ; l'aller de la demande, jamais son émission après une
attente).

## Ce qui reste

- ~~**e2e à deux contextes**~~ — FAIT le 2026-09-09 : `e2e/tests/dom/online-resilience.spec.ts`
  (§11.3 coupure → retour → rattrapage → forfait du chien de garde ; §11.4 abandon vu des deux
  côtés), POM `e2e/pages/online-session.ts`, plus l'absence de chrono en solo dans
  `combat/hud.spec.ts`. Les deux moteurs sont comparés **au même index** (compte d'actions de la
  sauvegarde de chaque pair), red-green vérifié en neutralisant `sendResyncRequest`.
  🔴 Ce que l'écriture a appris : **une fermeture d'onglet fait bien parvenir son `bye`**, donc le
  retour doit tenir dans la fenêtre de grâce courte (30 s depuis la recette humaine, décision #961)
  — d'où `loseGuestTab()` qui boote l'onglet de retour AVANT la coupure (~180 ms utilisés sur le
  budget). Ne sont **pas** jouables en e2e, faute de pouvoir avancer un minuteur depuis le
  navigateur : le chrono de 60 s, le chien de garde du silence de 75 s et le forfait AFK à 3 tours —
  ils restent en unit/intégration.
- ~~**Cahier de recette**~~ — FAIT : §4.21 (compteur + bandeau + pastille) dans
  `recette-4-…`, §6.12 bis (reprise en ligne + échec de reprise) dans `recette-6-…`, inventaire des
  deux specs en §11 dans `recette-11-…`.
- ~~**Passe multi-entrée mesurée**~~ — FAIT : balayage automatisé des cinq formats en §11.3.
- ~~**Recette humaine**~~ — FAIT le 2026-09-09, dont le scénario au tempo rapide (Électrode sous
  Hâte). Trois bugs trouvés et corrigés en cours de recette : délai de grâce court incohérent
  (10 s → 30 s, `BATTLE_GRACE_SHORT_MS`, décision #961), message de forfait générique au lieu d'une
  phrase par cause, bandeau réseau qui continuait de s'afficher après la fin du combat. Voir § Ce que
  l'implémentation a corrigé.
- **Mesure à la main du délai réel de libération d'adresse du cloud PeerJS** (critère de sortie 7) —
  seul point du critère de sortie encore ouvert. Backlog : `backlog-delai-liberation-peerjs-cloud`.
- **Revue de code** (`code-reviewer`, `core-guardian`) — FAITE le 2026-09-09, trois bloquants trouvés
  et corrigés (demande de rattrapage réémissible, chien de garde du silence réarmé au retour,
  sauvegarde jetée sur toute cause d'échec). Voir § Ce que la revue de code a trouvé.
