# Plan 216 — Le relais qui manquait, et deux correctifs de salon

**Statut** : done
**Ouvert le** : 2026-09-19, sur trois bugs remontés par l'humain après une partie tentée avec son
frère, lui en déplacement
**Livré le** : 2026-09-19 — les trois scénarios de recette validés du premier coup ; deux écarts
avec ce document, corrigés ci-dessous (§ 1.0 bis, § 2.3), et sept bloquants trouvés par les revues
automatiques après la recette (dont le tirage d'équipe qui aurait donné les six mêmes Pokemon à tous
les camps aléatoires, et le relais qui ne pouvait pas fonctionner côté hôte) — voir le graphe de
mémoire pour le détail.
**Bloque la release ?** : **oui** — le jeu en ligne est inutilisable hors NAT favorable
**Taille** : moyen — un transport de repli neuf (relais Durable Object), plus deux correctifs cernés

## Ce que tu verras à l'écran

1. Une partie en ligne se connecte **depuis les données mobiles et le wifi d'hôtel**, pas seulement
   depuis deux box à la maison — c'est le bug qui vous a empêchés de jouer.
2. Dans le salon, un camp « Aléatoire » n'affiche **plus du tout la ligne de Pokemon** — ni
   portraits, ni silhouettes, rien. Plus rien à comparer, donc plus de relances. L'équipe se tire au
   lancement du combat.
3. Sur l'écran « Jouer en ligne », tu peux **taper le code ou faire `Ctrl+V` tout de suite**, sans
   avoir à cliquer une case d'abord.

⚠️ **Un point annoncé à l'humain puis retiré** : j'avais promis « tu ne verras plus non plus l'équipe
aléatoire d'en face ». C'était faux, `game-designer` l'a relevé — `team-select-screen.ts:975` masque
DÉJÀ l'équipe d'un autre joueur humain en ligne (`teamVisible: !isOnline() || isMine ||
!isHeldByHuman(seatState)`). Le seul vrai trou était sa PROPRE équipe, celle qu'on peut re-tirer.

---

## Bug 1 — le multijoueur ne connecte plus (majeur)

### Ce qui a été mesuré, et ce qui a été écarté

Trois hypothèses évidentes, toutes **écartées par la mesure** avant d'écrire une ligne :

| Hypothèse | Vérification | Verdict |
|---|---|---|
| L'annuaire PeerJS est tombé | `GET https://0.peerjs.com/peerjs/id` → `200` | debout |
| Les deux plateformes n'ont pas la même `NETWORK_VERSION` | `deploy.yml` et `itch-deploy.yml` se déclenchent tous deux sur la **release**, et les deux exécutions du tag `v2026.9.2` sont vertes | même build, `NETWORK_VERSION = 14` des deux côtés |
| Régression du salon ou du protocole | Deux navigateurs pilotés contre le **service public** de PeerJS : création du salon, code `BNNV7` saisi à la roue, invité entré dans la salle d'attente | aucun défaut — le chemin public fonctionne |

### La vraie cause

Les serveurs TURN gratuits de PeerJS **n'existent plus**. Leurs noms n'ont plus d'enregistrement `A`,
vérifié sur trois résolveurs indépendants (`1.1.1.1`, `8.8.8.8`, `9.9.9.9`) :

```
eu-0.turn.peerjs.com  →  (aucun A)
us-0.turn.peerjs.com  →  (aucun A)
0.peerjs.com          →  172.66.41.3      (l'annuaire, lui, répond)
```

Conséquence observée dans un vrai Chromium, en listant les candidats ICE avec la configuration par
défaut de `peerjs@1.5.5` :

```
candidats  : host, srflx          ← aucun "relay"
erreurs    : 701 TURN host lookup received error   (eu-0, us-0, udp et tcp)
```

Il ne reste donc que `stun.l.google.com`. Le STUN suffit derrière un NAT ordinaire ; il **ne suffit
pas** en NAT symétrique ni en CGNAT — données mobiles, wifi d'hôtel, réseau public. C'est exactement
la situation décrite par `docs/multiplayer.md` § « Le NAT, et quand il gagne » (l. 860-866), et ça
explique que les six combinaisons tentées (itch×itch, itch×github, github×github, mobile et desktop)
échouent identiquement : le défaut est **sous** la couche applicative, la plateforme n'y change rien.

Le repli statique évident a été testé et écarté lui aussi : `openrelay.metered.ca` répond
`400 TURN allocate error` — le free tier public a fermé.

🔴 Le document l'avait prévu, l. 1100 : *« à remplacer par notre propre relais Cloudflare plutôt que
par un free tier tiers, qui sont les plus fragiles de tous »*. C'est arrivé.

### Le correctif retenu (arbitrage humain, 2026-09-19)

**Un relais WebSocket sur Durable Object**, pas un TURN tiers.

#### Pourquoi le TURN Cloudflare a été écarté

Il était la première recommandation. L'humain a demandé « on est obligé de mettre sa carte ? », et la
vérification lui a donné raison :

- Un fil de leur forum (octobre 2025, littéralement « No-CC TURN free tier ») rapporte que le TURN
  **exige un profil de facturation même pour le palier gratuit**, parce qu'il est rangé sous la
  facturation Realtime. ⚠️ Non confirmé de première main : le fil rend un 403 et le dashboard refuse
  un navigateur piloté.
- Et surtout, le point qui tranche : **sur le plan gratuit, Cloudflare ARRÊTE, il ne facture pas.**
  Dépassement des requêtes → `Error 1027` jusqu'à minuit UTC. C'est un plafond **structurel**.
  Poser une carte, c'est sortir de ce régime pour un régime où le dépassement se paie — et Cloudflare
  n'offre pas de plafond dur en payant, seulement des alertes.

Le compte du projet reste donc **sans carte**. Ça ferme la porte au TURN, et ce n'est pas un pis-aller :
`docs/multiplayer.md` l. 1100 recommandait déjà « notre propre relais Cloudflare plutôt qu'un free
tier tiers, qui sont les plus fragiles de tous ». PeerJS vient de démontrer la phrase.

#### Pourquoi c'est un petit lot — la couture existe déjà

🔴 **Correction d'une estimation donnée à l'humain puis démentie en lisant le code.** J'ai d'abord
annoncé « lot nettement plus gros ». Faux : `packages/network/src/transport.ts` définit déjà
`NetworkTransport` et `NetworkChannel`, et il en existe **deux implémentations** — PeerJS et un canal
en mémoire. Le relais est une **troisième implémentation des deux mêmes interfaces**.

Conséquence directe : `NetworkMessage` voyage inchangé, aucun message du protocole n'est touché, et
**`NETWORK_VERSION` ne bouge pas pour ce bug**. (Elle bougera pour le bug 2, pour une autre raison.)

#### Étape 1.0 — la cascade direct → relais, et où elle vit

**Relecture `plan-reviewer` (2026-09-19) : le plan disait « le relais est tenté quand `connect()`
échoue » sans dire QUI tente.** Réponse trouvée en lisant `room-types.ts` l. 52 : `RoomDeps.transport`
est **un seul** `NetworkTransport`, injecté par `onlineRoomDeps()` (`online-room.ts` l. 37). Le salon
ne construit pas son transport, il le reçoit.

Donc la cascade est un **transport enveloppe**, `FallbackTransport`, qui implémente `NetworkTransport`
et compose les deux autres :

```
onlineRoomDeps()
  └── FallbackTransport
        ├── PeerJsTransport   (tenté en premier, toujours)
        └── RelayTransport    (WebSocket vers le Durable Object du code de partie)
```

- `claim()` — prend l'identifiant chez PeerJS comme aujourd'hui. C'est lui, et lui seul, qui reste
  le mécanisme d'allocation de place : le refus de l'annuaire **est** l'allocation (`transport.ts`,
  doc de `claim`). Le relais ne s'en mêle pas.
- `connect()` — tente PeerJS ; sur `ConnexionImpossible` ou `DelaiDepasse`, rejoue par le relais.
- `onIncoming()` — fusionne les deux sources.

🔴 **Ce que ça résout gratuitement.** Le plan listait comme risque principal « `room.ts` pourrait
supposer que tous ses canaux sont du même type ». Avec l'enveloppe, **il ne voit pas la différence** :
il reçoit des `NetworkChannel` et ignore d'où ils sortent. Le risque tombe, et rien de `room.ts`
n'est touché.

⚠️ Reste vrai à vérifier : `destroy({ abandon })` doit descendre aux **deux** transports, et le
`TEARDOWN_DRAIN_MS` de PeerJS n'a pas d'équivalent WebSocket.

#### Étape 1.0 bis — comment un message est adressé dans le relais

**Relecture `plan-reviewer` : « canaux multiplexés, adressés par place » sans structure de message.**

🔴 **Écart avec le code livré.** Ce plan proposait une enveloppe JSON `{ from, to, payload }`. À
l'écriture, l'adressage a été sorti du JSON : une trame est la chaîne `<to>|<from>|<charge utile
JSON>` (`relay-connection.ts`, `FRAME_SEPARATOR`). Deux raisons ont tranché contre le JSON :
l'adresse devient *structurellement* illisible pour le contenu (`indexOf` + réexpédition, le Durable
Object n'a même pas la possibilité de désérialiser `payload`), et le coût : à 12 places un `start`
pèse ~15 Ko, et le désérialiser pour en extraire un entier à chaque diffusion aurait coûté ~165 Ko de
JSON analysés par message pour 11 pairs, côté relais comme côté client.

🔴 **Le Durable Object ne lit que le préfixe `<to>`.** Il ne désérialise jamais la charge, ne la
valide pas, ne la comprend pas — même position que le registre des salons (`rendezvous.ts` l. 13 :
*« il sérialise et il tranche les courses, il ne juge pas »*).

C'est ce qui garantit la promesse de l'étape précédente : `NetworkMessage` voyage **inchangé**, aucune
des huit variantes n'est touchée, et **`NETWORK_VERSION` ne bouge pas** pour ce bug.

#### Étape 1.1 — l'objet relais, côté Worker

Une seconde classe de Durable Object dans `packages/telemetry-worker/`, à côté de `RoomRendezvous`,
**un objet par code de partie** — même clé, même durée de vie.

Son travail tient en une phrase : il recopie aux autres ce qu'un joueur lui envoie. Il ne lit pas le
contenu, ne valide aucune règle, n'arbitre rien. Même position que le registre des salons (l. 13 de
`rendezvous.ts`) : *« il sérialise et il tranche les courses, il ne juge pas »*.

🔴 **API Hibernation obligatoire, ce n'est pas une optimisation.** Documentation Cloudflare :
*« Calling `accept()` on a WebSocket in an Object will incur duration charges for the entire time the
WebSocket is connected »* — donc un combat au tour par tour paierait tout son temps de réflexion.
Avec l'Hibernation, *« Billable Duration (GB-s) charges do not accrue during hibernation »* et les
clients restent connectés au réseau Cloudflare pendant ce temps. Sans elle, le lot ne tient pas dans
le palier gratuit ; avec elle, la durée n'est même pas le facteur limitant.

⚠️ L'hibernation **réinitialise l'état en mémoire**. L'objet ne doit donc rien garder en RAM entre
deux messages qu'il ne sache pas relire depuis les attachements de socket.

`[[migrations]]` : `new_sqlite_classes` comme `RoomRendezvous` — le backend clé-valeur est payant,
vérification déjà faite le 2026-08-29 et consignée dans `wrangler.toml`.

#### Étape 1.2 — le transport, côté client

`packages/network/src/relay-connection.ts` (neuf) : `NetworkTransport` + `NetworkChannel` au-dessus
d'une WebSocket, en face de `peer-connection.ts`.

Une **seule** WebSocket par joueur, vers l'objet de son code de partie ; les canaux vers chaque pair
sont multiplexés dessus, adressés par identifiant de place. À 12 joueurs, ça donne 12 connexions
contre les 66 du maillage actuel — le relais est **plus léger que le direct** à ce nombre.

`ChannelHealth` et `onHealthChange` existent pour le chemin ICE ; il faut leur donner un sens sur une
WebSocket (connectée / en reconnexion / morte) plutôt que de les laisser mentir.

#### Étape 1.3 — quand le relais s'allume

**Jamais en premier.** Le direct reste la règle : il est gratuit, plus rapide, et ne nous fait rien
transiter. Le relais est un repli, tenté quand `connect()` échoue en `ConnexionImpossible` ou
`DelaiDepasse`.

Le repli est **par pair, pas par salon** : si deux joueurs se joignent en direct et qu'un troisième
est derrière un CGNAT, seuls les canaux qui le concernent passent par le relais. Il n'y a pas de
décision collective à prendre — quand A ne joint pas B, B ne joint pas A non plus, donc les deux
basculent d'eux-mêmes et se retrouvent sur le même objet.

⚠️ **À vérifier en écrivant** : que `room.ts` ne suppose nulle part que tous ses canaux sont du même
type. C'est l'hypothèse la plus susceptible d'être fausse dans tout ce lot.

#### Étape 1.4 — le garde-fou de quota (demandé par l'humain, 2026-09-19)

🔴 **Sa vraie raison n'est pas le budget, elle est plus dure que ça.** Le plafond de 100 000
requêtes/jour est **à l'échelle du compte**. Si le relais le brûle, `Error 1027` ne tombe pas que sur
lui : il tombe aussi sur la **télémétrie** et surtout sur le **registre des salons**, sans lequel
plus personne ne peut créer ni rejoindre une partie — même en direct, même sans avoir besoin du
relais. Un relais qui s'emballe casserait donc le multijoueur **en entier**, y compris pour ceux qu'il
ne servait pas.

##### Où le compteur vit — et pourquoi pas en D1 à chaque message

**Relecture `plan-reviewer` : « rangé en D1 » sans table ni migration.** En cherchant la table, le
plan s'est démenti lui-même, et c'est la correction la plus utile de cette relecture :

⚠️ **Écrire en D1 à chaque message serait auto-destructeur.** Le palier gratuit D1 donne **100 000
écritures de ligne par jour** — le même ordre de grandeur que le budget de requêtes qu'on cherche à
protéger. Un compteur qui consomme autant que ce qu'il mesure ne mesure rien, il double la facture.

Le compteur vit donc **dans le stockage SQLite du Durable Object lui-même** :

- il survit à l'hibernation (contrairement à la mémoire, qui est réinitialisée) ;
- il n'est pas facturé en requêtes : le stockage d'un objet ne passe pas par le réseau ;
- il est naturellement cloisonné par salon, donc sans contention entre parties.

**Une seule** écriture D1 par salon, à sa fermeture (ou sur une alarme périodique pour un salon qui
traîne), agrège ce que la partie a consommé :

```sql
-- migrations/0002_relay_usage.sql
CREATE TABLE relay_usage (
  day      TEXT PRIMARY KEY,   -- 'YYYY-MM-DD' en UTC, comme le quota Cloudflare
  requests INTEGER NOT NULL,   -- estimation : connexions + plafond(messages entrants / 20)
  rooms    INTEGER NOT NULL    -- combien de salons relayés ce jour-là
);
```

Écriture en `INSERT … ON CONFLICT(day) DO UPDATE SET requests = requests + …`.

🔴 **UTC et non l'heure locale** : c'est à minuit UTC que Cloudflare remet ses compteurs à zéro. Un
compteur calé sur Paris dériverait d'une ou deux heures et dirait « 40 % » au moment précis où le
quota réel vient de repartir de zéro — ou pire, l'inverse.

##### La condition de refus, exactement

**Relecture `plan-reviewer` : « refuse les nouveaux salons » — comment l'objet sait-il qu'il est
nouveau ? Un Durable Object n'a pas de rappel de création.** Juste. La condition est donc posée sur
ce que l'objet **peut** observer de lui-même, au moment d'une demande d'ouverture de WebSocket :

```
si (consommation du jour ≥ SEUIL)  et  (cet objet n'a AUCUNE socket active)
    → refuser l'ouverture, avec une cause lisible
sinon
    → accepter
```

La seconde condition est ce qui distingue « nouveau salon » de « salon en cours » sans avoir besoin
d'un rappel de création : un objet **sans aucune socket** est un salon qui commence ; un objet qui en
a déjà est une partie entamée, qu'on ne coupe pas au milieu. `getWebSockets()` le donne, et il
fonctionne **après** hibernation — c'est précisément ce que l'API Hibernation garantit.

`SEUIL` à caler, de l'ordre de 60-70 % du palier, pour laisser la marge restante au registre des
salons et à la télémétrie.

Le refus n'est jamais fatal : on retombe sur le direct seul, c'est-à-dire l'état d'aujourd'hui.

##### Le dire

`pnpm stats` affiche la consommation du jour **en pourcentage du palier gratuit**, lue dans
`relay_usage`. C'est le signal que l'humain a demandé : voir venir le mur au lieu de le découvrir.

##### Le limiteur de débit existant — vérifié, pas un problème

**Relecture `plan-reviewer` : le `[[ratelimits]]` de `wrangler.toml` asphyxierait-il le relais ?**
Vérifié en lisant `worker.ts` : **non**, et par construction. Le routeur traite `DASHBOARD_PATH` puis
`RENDEZVOUS_PATH` **avant** le limiteur, avec un commentaire qui le dit explicitement (*« ce n'est pas
une collecte, donc ni l'origine, ni le limiteur, ni la validation d'enveloppe ne le concernent »*). Le
limiteur ne s'applique qu'à `ENDPOINT_PATH`, la collecte de télémétrie.

La route du relais se range **au même endroit et de la même façon** que celle du registre. Rien à
configurer ; il faut juste ne pas se tromper d'ordre en l'ajoutant.

#### Étape 1.5 — retirer les hôtes TURN morts

Indépendamment du relais, passer une liste `iceServers` explicite à `PeerJsTransport` (l'option existe
déjà, `peer-connection.ts:51`) : deux STUN vivants (`stun.cloudflare.com:3478`,
`stun.l.google.com:19302`), et **rien d'autre**.

Passer `iceServers` remplace intégralement les défauts de `peerjs`, donc retire `eu-0` et `us-0` au
lieu de les laisser consommer une résolution DNS ratée à chaque négociation. C'est un gain même
quand le relais n'est pas nécessaire.

⚠️ `signallingOverride()` renseigné (e2e, `?peerPort`) ⇒ on ne change rien à ce qu'il décide. La suite
e2e ne doit rien demander à Internet, règle déjà posée dans `signalling-override.ts`.

#### Étape 1.6 — la mesure

Le compteur `room-failed-connexion_impossible` existe déjà (`telemetry-contract.ts:130`) : c'est lui
qui dira si le relais fait son travail.

Et il faut **compter les messages d'un vrai combat** plutôt que de croire mon estimation. Le
dimensionnement de l'étape 1.4 repose sur « ~2 000 messages entrants pour une partie à 12 »,
posée à la louche. Elle survit à une erreur d'un facteur 10 — mais autant la remplacer par un chiffre
mesuré, puisque le compteur de l'étape 1.4 le donne gratuitement.

⚠️ Hors périmètre mais constaté en route : `pnpm stats` échoue, `code 7403 — The given account is
not valid or is not authorized to access this service`. Jeton `wrangler` expiré, il faudra un
`wrangler login`. Ça ne touche pas le jeu, seulement la lecture des chiffres — mais ça bloque
l'étape 1.4 point 2, qui passe par `pnpm stats`.

---

## Bug 2 — l'équipe aléatoire visible dans le salon

### Ce qui se passe

`slot-state.ts:124/170/196` : choisir « Aléatoire » appelle `generateRandomTeam` **immédiatement**, et
`PlayerCell.ts:228` affiche les portraits du résultat. Re-cliquer « Aléatoire » re-tire. Le salon
devient une vitrine : on relance jusqu'à obtenir une équipe qui plaît.

### Le correctif retenu (arbitrage humain, 2026-09-19)

**Le tirage descend au lancement.** « Aléatoire » n'est plus qu'une **intention** portée par le camp ;
l'équipe n'existe qu'au démarrage du combat.

Deux questions de design que `game-designer` a sorties du plan, tranchées par l'humain le 2026-09-19 :

| Question | Réponse |
|---|---|
| Le différé s'applique-t-il aussi aux camps IA ? | **Oui, tous les camps.** |
| Et en solo / hot-seat ? | **Oui, même règle partout.** |

🔴 **Ce que ces réponses résolvent, et qui n'était dans aucune des options proposées.** La tension
apparente était avec la décision #729, écrite en dur dans `PlayerCell.ts:200` — *« Les lignes IA
restent visibles de tous »*. Elle tombe, parce que la bonne lecture n'est pas « on masque les camps
IA » :

> Une équipe aléatoire non tirée **n'est pas cachée, elle n'existe pas encore.**

L'état porté par le camp est « aléatoire », pas « six Pokemon qu'on refuse de montrer ». Un camp IA à
qui l'hôte assigne une **équipe sauvegardée** reste intégralement visible, comme aujourd'hui. #729
reste donc vraie pour tout ce qui existe ; ce qui change, c'est qu'il existe désormais un état où il
n'y a rien à montrer.

De même pour le hot-seat : *« en local tout est visible, les joueurs sont côte à côte »*
(`team-select-screen.ts:973`) reste vrai. Rien n'est soustrait à personne — le tirage n'a simplement
pas encore eu lieu.

**Bénéfice non prévu** : `setSlotController` (`slot-state.ts:170`) tire une équipe neuve à chaque
bascule de contrôleur. `game-designer` avait relevé que l'hôte pouvait pêcher une équipe IA en
basculant Humain → IA → Humain → IA. Avec l'intention, la bascule ne tire plus rien, elle repose un
état. **Le vecteur se ferme tout seul**, sans une ligne écrite pour lui.

#### Étape 2.1 — l'intention, côté état de camp

`SlotState` : un camp aléatoire garde `assignedTeam = null` avec `ephemeral = true`. La paire
`(null, true)` **est** « aléatoire, pas encore tirée » — distincte de `(null, false)`, qui reste
« humain sans équipe ». `TeamListItem.ts:54` connaît déjà cette lecture, c'est la même.

🔴 **Affichage : on retire la rangée, on ne la remplace pas** (arbitrage humain, 2026-09-19). Ma
proposition initiale était de montrer six silhouettes via `createPlaceholderPortraitsElement()`
(`TeamPortraits.ts:42`). Refusée, et c'est plus simple : la carte de camp **n'appendra aucune rangée
de portraits** pour un camp aléatoire — ni portraits, ni silhouettes. Le nom « Aléatoire » dit déjà
tout ce qu'il y a à dire ; six cases vides ne feraient qu'occuper de la hauteur pour ne rien
apprendre, exactement l'argument déjà écrit dans `TeamPortraits.ts` à propos du rembourrage à 12
camps.

⚠️ Conséquence à traiter et non à subir : la carte d'un camp aléatoire devient **plus courte** que
celle d'un camp dont l'équipe est choisie. À 12 camps, les cartes ne s'alignent donc plus toutes à la
même hauteur. À vérifier à l'œil sur les cinq tailles de la passe responsive — si ça saute aux yeux,
c'est un retour à remonter à l'humain, pas une décision à prendre seul.

#### Étape 2.2 — le tirage déterministe

🔴 **Le point délicat de tout le plan.** En ligne, chaque pair monte sa propre copie du combat : si
chacun tirait son aléatoire dans son coin, ils joueraient six Pokemon différents chacun et
divergeraient avant le tour 1.

`generateRandomTeam` prend déjà un `rng` en option (`team-generator.ts:51`) — la porte est ouverte. Le
tirage se fait donc **depuis une graine partagée**, dérivée par place comme les graines d'IA le sont
déjà (décision #901) :

- `StartMessage` porte une **quatrième graine**, `teamSeed`, à côté de combat / placement / IA ;
- chaque pair dérive la graine de **chaque** place par `deriveTeamSeedsBySeat`, copie conforme de
  `deriveAiSeedsBySeat` (`protocol.ts` l. 882), dont voici le contrat exact :

  ```ts
  // places triées par ordre CROISSANT, générateur consommé UNE FOIS par place, dans cet ordre
  const ascending = [...seats].sort((left, right) => left - right);
  return new Map(ascending.map((seat) => [seat, nextRandom()]));
  ```

  🔴 **Toutes les places sont dérivées d'un coup, y compris celles qui ne sont pas aléatoires.**
  C'est la raison d'être de la fonction d'origine, recopiée mot pour mot de sa documentation :
  dériver à la demande ferait dépendre les valeurs de **qui** demande, donc du nombre de camps
  aléatoires — « deux pairs qui n'interrogent pas les mêmes places obtiendraient des graines
  différentes pour la même place ». Le piège est déjà documenté ; il ne faut pas le rejouer.

  Le générateur est semé sur `seeds.team` par `createPrng` du core, fourni par l'appelant :
  `packages/network` ne dépend d'aucune implémentation d'aléa ;
- rien de plus ne transite : une graine pèse moins qu'une liste de six Pokemon complets.

⚠️ `generateRandomTeam` pose aussi `id: generateTeamId()` et `createdAt: Date.now()`, tous deux non
déterministes. Ils doivent rester **hors** de ce qui entre dans le `BattleState` — sinon la somme de
contrôle du Lot B4 divergerait dès la première vérification. Seuls les `slots` comptent ; l'identité
et l'horodatage restent locaux. **À vérifier explicitement en écrivant**, c'est le piège du lot.

#### Étape 2.3 — le protocole

- `NetworkTeamSelection` doit pouvoir dire « aléatoire » plutôt que d'énumérer six Pokemon.
- `StartMessage` gagne `teamSeed`, et sa validation avec.
  🔴 **Écart avec le code livré** : la graine n'est pas un champ `teamSeed` séparé, elle est le
  quatrième membre de `NetworkSeeds` (`seeds.team`, à côté de `battle`/`placement`/`ai`) —
  `StartMessage.seeds` porte déjà ce triplet devenu quatuor, et la nouvelle graine s'y range comme
  `ai` s'y range depuis la décision #901, plutôt que d'ouvrir un champ de plus au même niveau.
- 🔴 **`NETWORK_VERSION` 14 → 15.** Un pair d'avant n'émet ni ne lit `seeds.team` ni l'intention
  « aléatoire » : il composerait une équipe vide ou différente, et les deux pairs divergeraient sans
  qu'aucun message ne paraisse malformé. C'est le mode d'échec exact que la version protège.

#### Étape 2.4 — le solo, et le piège de « Recommencer »

Même chemin qu'en ligne, graine tirée localement au lancement. Arbitrage humain : **même règle
partout**, donc une seule lecture de « Aléatoire » à maintenir.

🔴 **Vérification obligatoire, signalée par `game-designer`.** « Recommencer » du menu de combat
(`combat-screen.ts` l. 2052-2060) rejoue le **même** `CombatSetup` via `setupForReplay`, qui ne
retire que `battleId`. Il faut que la graine d'équipe — donc l'équipe tirée — **survive au replay
à l'identique**.

Si l'implémentation régénérait une graine à chaque `replay()`, « Recommencer » deviendrait un bouton
de pêche **à un seul clic**, plus rapide que le bug qu'on est en train de corriger, et exactement là
où le plan prétend avoir fermé la vitrine. À couvrir par un test, pas par une lecture rapide.

⚠️ Le contournement qui reste, et qu'on assume : en solo, « Quitter » → menu → sélection d'équipe →
« Lancer » redonne un tirage. Gratuit et illimité pour un joueur seul, mais sans commune mesure avec
un clic dans le salon — et la plainte d'origine visait le salon partagé, où relancer fait perdre du
temps à quelqu'un d'autre. Le correctif **ralentit** la pêche en solo, il ne l'élimine pas.

## Bug 3 — la saisie du code n'attrape pas le focus

### Ce qui se passe

`lobby-screen.ts:366` pose le focus sur `focusableControls()[0]` au montage — le premier bouton de
l'écran, pas la roue. Or la roue écoute `paste` **sur son propre élément** (`code-wheel.ts:353`) et
les frappes sur lui aussi (l. 341). Tant que le joueur n'a pas cliqué une case, `Ctrl+V` et les
lettres tombent dans le vide, sans que rien ne le dise.

Le bouton « Coller » (plan 207, étape 3) contourne le problème à la souris, mais il ne couvre ni la
frappe au clavier ni le `Ctrl+V` réflexe — et c'est précisément ce que l'humain a essayé de faire.

### Le correctif

Deux écoutes posées **au niveau de l'écran** tant qu'il est monté, qui se contentent de rediriger
vers la roue :

1. **`paste`** capté sur le document : le code est passé à `wheel.paste()`, et le focus va sur la
   roue. `Ctrl+V` et le clic droit → Coller marchent d'où qu'on soit sur l'écran.
2. **une frappe de l'alphabet du code** (`ROOM_CODE_ALPHABET`) alors que le focus est ailleurs qu'un
   contrôle qui consomme les touches : le focus passe à la roue et la lettre y est jouée, pas perdue.

Les deux écoutes s'annulent au démontage par l'`AbortController` déjà en place.

🔴 **Aucun `.focus()` d'office sur la roue au montage** : ce serait détourner l'ordre de tabulation et
casser la lecture au lecteur d'écran d'un écran dont le premier geste peut aussi être « Créer une
partie ». On rattrape l'intention, on ne la présume pas.

### Passe multi-entrée

Le diff touche `packages/app/src/ui/` : la passe des quatre axes de `.claude/rules/multi-input.md`
est **obligatoire et mesurée** avant recette — clavier (atteinte aux flèches depuis un contrôle
voisin, jamais un `.focus()` sur la cible), manette, tactile (plancher 30 px sous `pointer: coarse`),
responsive sur les cinq tailles.

---

## Risques ajoutés par la relecture (2026-09-19)

Quatre points que `plan-reviewer` a relevés et que le plan ne nommait pas. Deux sont traités
ci-dessus (la cascade de transport, le compteur en D1) ; voici les deux qui restent ouverts, plus
deux exigences de test.

### `ChannelHealth` sur une WebSocket — à définir, pas à bricoler

`NetworkChannel.onHealthChange` a été écrit pour le chemin ICE (plan 202) : `room.ts` s'en sert pour
savoir si un pair est en train de décrocher. Sur une WebSocket, les états ne se correspondent pas
terme à terme.

🔴 **Ne pas câbler une valeur par défaut « en bonne santé » pour faire taire le type.** Un canal qui
ment sur sa santé est pire qu'un canal muet : le chien de garde d'abandon (plan 202) prendrait ses
décisions sur une information fausse. Établir la correspondance explicitement — ouverte / en
reconnexion / morte — et écrire ce que chaque état déclenche côté salon.

### L'hibernation et la survie des sockets

Le plan s'appuie sur le fait que les WebSockets survivent à l'hibernation de l'objet. C'est bien la
garantie annoncée par Cloudflare (*« WebSocket clients remain connected to the Cloudflare network »*),
mais le plan ne le disait pas — et c'est l'hypothèse dont **tout** le dimensionnement dépend.
À confirmer par un test qui laisse un salon dormir plus longtemps que le délai d'éviction, pas par
citation.

### Deux tests qui manquaient au plan

1. **Déterminisme du tirage d'équipe** (étape 2.2) : un test qui vérifie que `id` et `createdAt`,
   tous deux non déterministes, **n'entrent pas** dans ce qui alimente le `BattleState`. Sans lui, la
   somme de contrôle du Lot B4 diverge à la première vérification et le vote de minorité élimine un
   joueur honnête — pour un horodatage. C'est le piège le plus cher du lot, il mérite son test.
2. **Deux pairs, deux graines identiques** : même `teamSeed`, mêmes places, mêmes six Pokemon des
   deux côtés. C'est la propriété que tout le reste suppose.

### Périmètre — l'avis de la relecture, et ce qu'on en fait

`plan-reviewer` juge les trois bugs « tenable mais serré », et note qu'un imprévu sur le câblage du
relais repousserait le bug 2. C'est exact, et c'est précisément ce que couvre le **coupe-circuit de
dérive de plan** du workflow : si l'exécution du bug 1 s'écarte sérieusement de ce document, je
m'arrête et je remonte, au lieu d'entamer le bug 2 sur une base incertaine.

## Ordre d'exécution

1. **Bug 3** — le plus petit et le plus isolé, il ne touche que le lobby.
2. **Bug 1** — Worker, puis client. Il vaut la release à lui seul.
3. **Bug 2** — le plus intrusif (protocole, `NETWORK_VERSION`, déterminisme), donc en dernier, sur
   une base déjà saine.

## Ce que ce plan ne fait PAS

- Pas de TURN tiers, ni Cloudflare Realtime (carte requise, voir § Bug 1) ni free tier public
  (`openrelay.metered.ca` mesuré mort). Le compte du projet reste sans moyen de paiement, donc
  dans le régime « ça s'arrête au lieu de facturer ».
- Pas de remise en route de `pnpm stats` : son échec vient d'un jeton `wrangler` expiré
  (`code 7403`), donc d'un `wrangler login` qui appartient à l'humain. Le code de l'étape 1.4
  s'écrit et se teste sans lui ; seule la LECTURE des chiffres attend.
- Aucune entrée d'agenda ni de backlog créée en route.
