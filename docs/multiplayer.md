# Multijoueur P2P — Architecture et design

> Document de référence pour l'implémentation du multijoueur (Phase 7).
> Écrit le 2026-04-06, **révisé le 2026-08-29** après une passe d'audit de faisabilité.
> Décisions associées : #209-212 (fondations) et #862-870 (révision).

---

## Ce que la révision de 2026-08-29 a changé

Le document d'avril reposait sur deux prémisses qui ne tiennent plus. Elles sont corrigées ici, mais
il faut savoir qu'elles ont existé — plusieurs décisions d'août ont été prises en s'y appuyant.

1. **« Le jeu est à information complète, il n'y a rien à cacher. »** Faux depuis le plan 176
   (2026-08-05) : le fog ennemi existe. Voir § Fog.
2. **« Un serveur autoritaire arrivera en Phase 7. »** Quatre décisions d'août (#728, #732, #751, et
   le plan 181) y renvoyaient. Il n'y en aura pas — décision #862. Voir § Pourquoi pas de serveur.

Corrigés au passage : les scènes Phaser (§ Écrans), l'absence du plan 181 dans le schéma de resync
(§ Reconnexion), et les mentions « WebSocket » de `roadmap.md` / `game-design.md` §14, reliquats
d'avant la décision #209.

---

## Principes

1. **Zéro backend** — connexion P2P directe via WebRTC (PeerJS)
2. **Exécution dupliquée** — chaque joueur fait tourner son propre BattleEngine
3. **Seules les actions transitent** — pas d'état complet, pas de sync lourde
4. **Anti-triche par validation** — chaque joueur vérifie les actions de l'autre
5. **Détection de désync** — checksum périodique du BattleState

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
premier backend d'un projet aujourd'hui 100 % statique, et une politique de free tier qui peut
changer sans nous.

**Cloudflare Workers** revient plus tard dans ce document — pas comme arbitre du combat, mais pour la
télémétrie (§ Télémétrie), puis éventuellement le signaling et le relais de secours (§ Quand le NAT
gagne). Il n'a pas le comportement de mise en pause. **Rien de tout cela n'est en V1.**

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

## Flow d'une partie

### 1. Connexion (code de partie / lien d'invitation)

```
Joueur A crée une partie
  → Génère un code court (ex: ABCD-1234)
  → PeerJS utilise ce code PRÉFIXÉ comme peer ID : new Peer("pkmntac-ABCD-1234")
  → A voit le code court + un bouton "Copier le lien"
  → Le lien : https://kekel87.github.io/pokemon-tactics/?join=ABCD-1234
  → A attend une connexion

Joueur B entre le code OU clique le lien
  → PeerJS établit une connexion WebRTC data channel
  → Handshake : échange des versions du jeu
```

⚠️ **Le préfixe n'est pas cosmétique** (décision #866). Sur le cloud gratuit PeerJS, les IDs vivent
dans un **namespace mondial partagé entre toutes les applications** : un code nu comme `ABCD-1234`
entrerait en collision avec n'importe quelle autre appli PeerJS. Le préfixe n'est jamais montré au
joueur, qui ne voit et ne saisit que la partie courte.

Pas de comptes, pas de matchmaking. Le code se partage par Discord, SMS, ou tout autre moyen. Le lien
d'invitation pré-remplit le code dans l'écran de lobby.

> **Deux hôtes, deux liens.** Le jeu tourne sur GitHub Pages **et** en iframe sur itch.io. Le lien
> d'invitation doit être construit depuis l'origine courante, pas codé en dur.

### 2. Sélection d'équipe

```
Les deux joueurs choisissent leur équipe localement
  → Quand prêt, chaque joueur envoie sa sélection
  → Les deux ont les mêmes données → construction du BattleState identique
  → Seed PRNG partagé (généré par A, envoyé à B)
```

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
Les deux moteurs détectent la victoire indépendamment
  → Affichage de l'écran de victoire
  → Option : revanche, changer d'équipe, quitter
```

---

## Protocole de messages

```typescript
type NetworkMessage =
  | { type: "handshake"; version: string; playerName: string }
  | { type: "team_select"; selection: TeamSelection }
  | { type: "ready" }
  | { type: "seed"; seed: number }
  | { type: "action"; action: Action }
  | { type: "checksum"; round: number; hash: string }
  | { type: "desync"; round: number }
  | { type: "forfeit" }
  | { type: "rematch" }
  | { type: "chat"; message: string };
```

**Pas de message `timeout`** — c'est délibéré, voir § Chronomètre.

---

## Chronomètre de tour (décisions #864, #865)

Il y a un chrono. Il est **local et auto-déclarant** : quand le tien expire, **ton propre client
soumet l'action par défaut** (passer le tour) et la diffuse comme n'importe quelle autre action.
L'autre pair reçoit une action ordinaire et la valide comme le reste.

Trois conséquences heureuses :

- **Aucun ajout au protocole.** Pas de message `timeout`, pas d'arbitrage, pas de question
  « qui fait autorité sur l'horloge » — la question la plus embarrassante du P2P sans arbitre.
- **La dérive va dans le bon sens, gratuitement.** Tu démarres ton chrono en finissant d'appliquer
  l'action précédente ; le pair distant démarre le sien en la **recevant**, donc ~150 ms plus tard,
  donc son chrono expire après le tien. Tu n'es jamais coupé avant que ta propre horloge le dise.
- **Ça traverse le replay tout seul.** L'action de timeout entre dans `exportReplay()` comme les
  autres → la reprise du plan 181 la rejoue à l'identique, sans cas particulier.

### Ce que le chrono ne couvre pas — et ne doit pas essayer

Le pair déconnecté, l'onglet gelé, le client patché qui n'envoie rien : ce n'est pas un problème de
chrono, c'est le problème de **déconnexion** (§ Gestion de la déconnexion). Deux mécanismes séparés :

| | Rôle | Déclenche |
|---|---|---|
| **Chrono de tour** | rythme, anti-AFK | ton client soumet « passer le tour » |
| **Chien de garde de connexion** | anti-déconnexion | « En attente de reconnexion… » puis forfait |

Le chien de garde doit valoir **chrono + marge**, sinon un paquet lent honnête le déclenche à tort.

**Surface de triche assumée** : un client qui s'octroie cinq minutes n'est puni par rien
d'automatique. Le joueur honnête peut toujours quitter — suffisant à cette échelle.

**À trancher au moment de coder** : la durée, et l'action par défaut. « Passer le tour » sans agir est
le choix sûr ; surtout pas un move au hasard.

> **À ne pas oublier** (noté par le plan 187) : ouvrir le menu de combat **grignotera le temps du
> joueur sans le dire**, puisque rien n'est mis en pause (décision #819, cadrage « un seul
> comportement dès le solo »). Il faudra une pastille « le temps continue » sur la modale.

---

## Fog — cosmétique en ligne (décision #863)

**Le document d'avril affirmait qu'il n'y avait rien à cacher. C'est faux depuis le plan 176.**

Le fog ennemi existe : PV en pourcentage seul, objet tenu et talent en `???` tant qu'ils ne sont pas
révélés. Mais il est appliqué **côté vue** (`packages/view-core`) —
`BattleEngine.getGameState(_playerId)` reste un passthrough qui ignore son argument et rend l'état
complet par référence.

En exécution dupliquée, **chaque pair détient donc l'état complet**, et un client modifié voit à
travers le fog : PV exacts, objet, talent. C'était précisément le contraire de ce que l'ancienne
section « Anti-triche » promettait.

**Décision : on assume.** Le fog reste une rétention d'affichage, pas un secret — il fuit déjà en
local par le journal de combat et les dégâts flottants, qui gardent leurs chiffres absolus
(conséquence assumée de #728). Rendre le fog réel exigerait un moteur côté serveur, c'est-à-dire le
serveur autoritaire écarté en #862. On vise petit : le jeu se joue entre gens qui se sont échangé un
code, et quelqu'un d'assez motivé pour patcher le client joue contre des amis qui peuvent arrêter de
jouer avec lui. **À revisiter seulement si une communauté compétitive apparaît.**

---

## Anti-triche

### Validation des actions

Chaque action reçue est validée :

```
action reçue → getLegalActions() contient cette action ?
  Oui → submitAction(), on continue
  Non → compteur de triche++
    1er : rejeter, redemander (peut être un bug)
    2e  : avertir "Action invalide"
    3e  : forfait automatique
```

C'est la seule triche que le modèle attrape — et, le fog mis à part (§ Fog), la seule qui change
l'issue d'une partie.

### Détection de désync

Tous les N tours (ex: 5), les deux joueurs comparent un hash de leur `BattleState` :

```
hash(BattleState) joueur A === hash(BattleState) joueur B ?
  Oui → tout va bien
  Non → désync détecté
    → Reconstruction depuis le replay (seed + actions enregistrées)
    → Si la reconstruction diverge aussi → bug dans le déterminisme, signaler
```

⚠️ **Le hash n'est pas trivial** — l'audit a corrigé le document sur ce point. `BattleState` est de la
donnée simple, mais il contient une `Map<string, PokemonInstance>`, des tableaux de zones, des champs
optionnels et des flottants (`tile.height`). Il faut une **sérialisation canonique** : ordre des clés,
ordre d'itération des Map, arrondi des flottants. Petit chantier réel, à ne pas sous-estimer.

La **reconstruction**, elle, est bien triviale : c'est exactement ce que fait le plan 181.

---

## Gestion de la déconnexion

### Déconnexion temporaire

```
Joueur B perd la connexion
  → Timer de 30s pour reconnecter
  → Joueur A voit "En attente de reconnexion..."
  → Si B reconnecte : resync via replay (seed + actions depuis le début)
  → Si timeout : victoire par forfait pour A
```

### Reconnexion — la brique existe déjà (plan 181)

Le plan 181 « reprise de combat en cours » a livré exactement le chemin dont la reconnexion a besoin,
et il tourne en production depuis le 2026-08-14 :

- la sauvegarde est `{ setup + seed + actions }`, jamais de l'état dérivé ;
- `resumeBattle` reconstruit le moteur avec `creationRng: createPrng(seed)`, rejoue les actions,
  reconstruit le journal, refait apparaître les billboards depuis l'état du moteur ;
- la persistance est un **port** `load` / `save` / `clear` (décision #751), pas un accès direct à
  `localStorage` — donc la source du journal peut changer sans toucher à l'écran de combat.

En multijoueur, le pair qui revient rejoue par **ce même chemin**. Ce qui reste à faire :

- `mapUrl` → **identifiant stable de carte** (`MAPS_REGISTRY`) ; une URL n'est pas un contrat ;
- version de protocole au handshake — `buildVersion` invalide déjà les sauvegardes (décision #748),
  la même donnée sert à refuser un pair qui ne joue pas le même build ;
- politique de reconnexion (délai, qui attend, ce que voit l'autre).

### Abandon volontaire

```
Joueur ferme l'onglet ou clique "Quitter"
  → Message "forfeit" envoyé si possible
  → L'autre joueur gagne par forfait
```

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

**Bonne nouvelle** : en **IPv6 il n'y a pas de NAT du tout**. L'IPv6 mondial a franchi 50 % en mars
2026 et l'Arcep classe la France parmi les leaders, en notant que les clients sans IPv6 sont
désormais sur des réseaux en fin de vie (cuivre éteint en 2030). Deux joueurs français sur fibre ont
de bonnes chances de se connecter en direct. Le « ~10 % de connexions nécessitant un TURN » cité en
avril est une moyenne mondiale, pessimiste pour notre cas réel.

**Position V1** : on assume. Certaines paires ne se connecteront pas, message clair et « réessayez
depuis une connexion fixe ». Le vrai correctif est le relais de secours ci-dessous.

---

## Cloudflare Workers — ce qui viendra après la V1 (décision #869)

Pas un arbitre du combat. Trois usages, **dans cet ordre** :

1. **Télémétrie** (§ suivant) — c'est ce qui justifie le compte, le `wrangler.toml` et l'étape de
   déploiement CI. Le reste devient nettement moins cher une fois cette marche franchie.
2. **Signaling** — un Durable Object par code de partie remplace PeerJS Cloud : namespace à nous,
   plus de collisions (#866), plus de dépendance au SLA inexistant de `peerjs.com`. ~100 lignes.
3. **Relais de secours quand le NAT gagne** — le DO relaie les actions par WebSocket quand WebRTC
   échoue. Tour par tour, ~100 octets par action : charge négligeable, et **cela supprime le besoin
   d'un TURN tiers**. L'API Hibernation garde les clients connectés au réseau Cloudflare sans
   facturer la durée d'inactivité — exactement le profil d'un jeu où rien ne se passe pendant 60 s
   entre deux coups.

Limites du plan gratuit vérifiées le 2026-08-29 : Workers 100 000 requêtes/jour et 10 ms de CPU par
invocation (**temps CPU**, l'attente I/O n'est pas comptée) ; Durable Objects 100 000 requêtes/jour,
13 000 GB-s, **backend SQLite obligatoire en gratuit** (le backend clé-valeur est payant) ; D1
5 M lignes lues et 100 000 lignes écrites/jour, 5 Go.

---

## Télémétrie (décisions #867, #868, #870)

Rattachée à la Phase 7 par choix humain — c'est le même chantier « serveur » — **bien qu'elle soit
indépendante du réseau et concerne d'abord le solo**, c'est-à-dire 100 % du jeu aujourd'hui. Elle peut
donc être la première tranche livrée de la phase.

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

**Schéma** : événement brut en JSON, **agrégation à la lecture**. La contrainte serrée est
100 000 lignes écrites/jour → ~50 000 parties/jour en brut, contre ~2 200 si on éclatait en une ligne
par Pokemon et par move.

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

Topologie étoile implicite : chaque joueur envoie ses actions à **tous** les autres. Pas de host
central.

```
3 joueurs : A ←→ B ←→ C ←→ A (mesh complet)
```

Pour N joueurs, chaque joueur a N-1 connexions. Avec max 12 joueurs, c'est 66 connexions mesh.

⚠️ **Jamais mesuré, et l'audit invite à s'en méfier.** Le problème n'est pas la bande passante
(négligeable) mais la **cohérence** : 12 copies du moteur à garder identiques, et **aucune politique
définie pour une désync partielle** (3 pairs sur 12 divergent — qui a raison ?). À noter aussi que la
doc PeerJS observe une dégradation au-delà d'une poignée de connexions simultanées par pair.

**Position** : viser le **1v1** en V1, retester le FFA à 12 ensuite. Le relais de secours (§ Workers)
offrirait au besoin une topologie étoile sans réintroduire un « host » joueur.

---

## WebRTC / PeerJS

### PeerJS

- Lib qui simplifie WebRTC data channels
- Signaling gratuit inclus (peerjs.com) — **namespace mondial partagé**, d'où le préfixe (#866)
- API simple : `new Peer()` → `peer.connect(id)` → `conn.send(data)`
- ~50KB gzipped
- **Pas de SLA.** Historique de `429 Rate Limited` documenté, auto-hébergement recommandé par la doc
  dès qu'il y a du trafic. C'est ce qui fait du signaling maison (§ Workers) une suite naturelle.

### STUN / TURN

- **STUN** — découvre l'IP publique. Gratuit (Google, Twilio fournissent des serveurs)
- **TURN** — relaye le trafic si la connexion directe échoue. Voir § Le NAT : à remplacer par notre
  propre relais Cloudflare plutôt que par un free tier tiers, qui sont les plus fragiles de tous.

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
| **Hot-seat N joueurs déjà livré** | `humanPlayerIds` dans l'orchestrateur, Humain/IA par camp au team-select (plan 188), jusqu'à 12 équipes. **Le tour distant se greffe là où le tour hot-seat existe déjà** — le plus gros cadeau de la Phase 6.5 |
| Couche d'entrée device-agnostique (plans 184-186) | Un lobby doit être jouable à la manette : la couche existe, la saisie d'un code reste à cadrer |
| `AiTeamController` | Remplacement si un joueur se déconnecte — voir la réserve ci-dessous |

⚠️ **L'IA ne peut pas tourner sur les deux pairs.** Elle est seedée sur `createPrng(Date.now())`
(`combat-screen.ts:782`) : deux pairs qui la font tourner en parallèle divergeraient immédiatement. Il
faut **désigner un pair émetteur** qui joue l'IA et diffuse ses actions, ou fournir un seed d'IA de
session. Le plan 181 l'avait noté ; le document d'avril l'ignorait.

---

## Packages à créer

```
packages/
  network/       Nouveau package
    src/
      protocol.ts            Types des messages réseau
      peer-connection.ts     Wrapper PeerJS (connect, send, receive, reconnect)
      network-controller.ts  Orchestre le tour réseau (attend action distante)
      room.ts                Création/rejoindre une partie, codes préfixés
      checksum.ts            Sérialisation canonique + hash du BattleState
```

---

## Écrans à ajouter/modifier

> Le document d'avril parlait de `LobbyScene`, `TeamSelectScene` et `BattleScene`. **Ces scènes
> n'existent plus** : depuis la migration Babylon (Phase 5), l'application est une **FSM d'écrans
> DOM** décrite par `ScreenId` et `SCREEN_TRANSITIONS` dans `packages/app/src/app/screens.ts`.

- **`lobby`** — nouvel `ScreenId` : créer une partie, saisir un code, attendre la connexion. À câbler
  dans `SCREEN_TRANSITIONS` (depuis `battle-mode`, vers `team-select`) et à rendre jouable à la
  manette comme tous les écrans depuis le plan 188.
- **`team-select`** — échanger les sélections via le réseau. L'écran a été refondu au plan 188
  (formats en segments, Humain/IA à deux états, une modale d'équipe par camp) : c'est l'état
  Humain/IA qui devient « Humain distant ».
- **`combat`** — `runBattle` distingue tour local et tour distant. C'est le point d'accroche
  `humanPlayerIds` qui porte déjà la distinction humain/IA.

---

## Comment les joueurs se trouvent

### V1 : code de partie + lien d'invitation

Pas de matchmaking. Les joueurs se trouvent par leurs propres moyens (Discord, SMS, en personne) et
partagent un code ou un lien.

```
Écran de lobby :
  ┌─────────────────────────────┐
  │  Créer une partie           │  → génère un code, affiche "ABCD-1234"
  │                             │    + bouton "Copier le lien"
  │  Rejoindre (entrer un code) │  → champ texte, bouton Rejoindre
  │                             │
  │  Retour au menu             │
  └─────────────────────────────┘
```

C'est suffisant pour une communauté naissante. Un matchmaking avec personne en ligne, c'est une salle
d'attente vide — pire qu'un code.

### Matchmaking — écarté, pas reporté (2026-08-29)

La V2 « matchmaking via Supabase Realtime » du document d'avril est **écartée** avec le reste de
Supabase (#862). Si le besoin se représente un jour, il se ferait sur un Durable Object
(§ Workers) — mais l'objection ci-dessus reste : elle est produit, pas technique.

---

## Tests

### 1. Tests unitaires (protocole)

Pas besoin de réseau. On mock les connexions PeerJS.
« Quand je reçois un message `action`, est-ce que le moteur l'applique ? »

### 2. Tests d'intégration (deux moteurs en mémoire)

Deux `BattleEngine` communiquant via un faux canal (EventEmitter au lieu de WebRTC). Combat complet
1v1, vérification que les états restent identiques. Couvre l'essentiel des bugs sans toucher au
réseau.

### 3. Tests E2E (Playwright)

Deux contextes navigateur, un crée la partie, l'autre rejoint. Combat de bout en bout. Le harnais e2e
existe (`.claude/rules/e2e.md`) et sait déjà piloter une manette synthétique et un hook de scène.

⚠️ **Coût machine** : la suite complète est déjà à 519 tests et tourne sous plafond CPU
(`scripts/with-cpu-cap.sh`). Une famille de tests à deux contextes est à budgéter, pas à ajouter sans
y penser.
