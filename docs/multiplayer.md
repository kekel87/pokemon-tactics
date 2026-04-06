# Multijoueur P2P — Architecture et design

> Document de référence pour l'implémentation du multijoueur (Phase 7).
> Issu des discussions de design du 2026-04-06.
> Décisions associées : #209-212.

---

## Principes

1. **Zéro serveur** — connexion P2P directe via WebRTC (PeerJS)
2. **Exécution dupliquée** — chaque joueur fait tourner son propre BattleEngine
3. **Seules les actions transitent** — pas d'état complet, pas de sync lourde
4. **Anti-triche par validation** — chaque joueur vérifie les actions de l'autre
5. **Détection de désync** — checksum périodique du BattleState

---

## Pourquoi P2P fonctionne ici

- **Tour par tour** — pas de contrainte de latence, pas de sync temps réel
- **Données minuscules** — une `Action` c'est ~100 octets JSON
- **Core déterministe** — même seed + mêmes actions = même état (prouvé par le système de replay)
- **Information complète** — pas de fog of war, HP visibles, rien à cacher
- **Gratuit** — pas de serveur à payer ni à maintenir

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

Les deux joueurs ont le même BattleEngine avec le même seed PRNG. Quand un joueur joue, il envoie **seulement son action** à l'autre. L'autre la valide et l'applique localement.

---

## Flow d'une partie

### 1. Connexion (room code / lien d'invitation)

```
Joueur A crée une partie
  → Génère un room code court (ex: ABCD-1234)
  → PeerJS utilise ce code comme peer ID : new Peer("ABCD-1234")
  → A voit le code + un bouton "Copier le lien"
  → Le lien : https://kekel87.github.io/pokemon-tactics/?join=ABCD-1234
  → A attend une connexion

Joueur B entre le code OU clique le lien
  → PeerJS établit une connexion WebRTC data channel
  → Handshake : échange des versions du jeu
```

Pas de comptes, pas de matchmaking. Le code se partage par Discord, SMS, ou tout autre moyen. Le lien d'invitation pré-remplit le code dans la LobbyScene.

### 2. Team Select

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

---

## Anti-triche

### Le jeu est à information complète

Contrairement aux jeux de cartes ou aux FPS, tout est visible :
- HP de tous les Pokemon (barres visibles)
- Positions sur la grille
- Moves disponibles (4 par Pokemon, connus)
- Statuts et buffs/debuffs

Il n'y a rien à cacher. Un client modifié ne donne aucun avantage informationnel.

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

### Détection de désync

Tous les N tours (ex: 5), les deux joueurs comparent un hash de leur `BattleState` :

```
hash(BattleState) joueur A === hash(BattleState) joueur B ?
  Oui → tout va bien
  Non → désync détecté
    → Reconstruction depuis le replay (seed + actions enregistrées)
    → Si la reconstruction diverge aussi → bug dans le déterminisme, signaler
```

Le système de replay existant rend cette reconstruction triviale.

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

### Abandon volontaire

```
Joueur ferme l'onglet ou clique "Quitter"
  → Message "forfeit" envoyé si possible
  → L'autre joueur gagne par forfait
```

---

## 3+ joueurs

Topologie étoile implicite : chaque joueur envoie ses actions à **tous** les autres. Pas de host central.

```
3 joueurs : A ←→ B ←→ C ←→ A (mesh complet)
```

Pour N joueurs, chaque joueur a N-1 connexions. Avec max 12 joueurs, c'est 66 connexions mesh — acceptable pour du tour par tour avec ~100 octets/action.

Alternative si ça pose problème : un joueur relaye (topologie étoile), mais ça réintroduit un "host".

---

## WebRTC / PeerJS

### PeerJS

- Lib qui simplifie WebRTC data channels
- Signaling server gratuit inclus (peerjs.com)
- API simple : `new Peer()` → `peer.connect(id)` → `conn.send(data)`
- ~50KB gzipped

### STUN / TURN

- **STUN** — découvre l'IP publique. Gratuit (Google, Twilio fournissent des serveurs)
- **TURN** — relaye le trafic si la connexion directe échoue (NAT restrictif)
  - ~10% des connexions en ont besoin
  - Services gratuits limités : Open Relay, Metered free tier
  - Pour du tour par tour, la bande passante est négligeable
  - À évaluer en Phase 7

---

## Ce qui existe déjà et facilite le multi

| Composant | Utilité pour le multi |
|-----------|----------------------|
| `BattleEngine` API (getLegalActions/submitAction) | Protocole d'actions déjà propre |
| Système d'events (BattleEvent[]) | Le renderer consomme déjà des events, pas besoin de refaire |
| PRNG seedé (createPrng) | Même seed = même résultat = exécution dupliquée |
| Replay system (seed + actions) | Reconnexion/resync triviale |
| Core découplé du renderer | Le réseau s'insère entre les deux sans tout casser |
| `AiTeamController` | Remplacement si un joueur se déconnecte |

---

## Packages à créer

```
packages/
  network/       Nouveau package
    src/
      protocol.ts        Types des messages réseau
      peer-connection.ts  Wrapper PeerJS (connect, send, receive, reconnect)
      network-controller.ts  Orchestre le tour réseau (attend action distante)
      room.ts             Création/rejoindre une room, room codes
      checksum.ts         Hash du BattleState pour détection désync
```

---

## Scènes à ajouter/modifier

- **LobbyScene** (nouvelle) — créer une partie, entrer un code, attente de connexion
- **TeamSelectScene** — adapter pour échanger les sélections via réseau
- **BattleScene** — adapter GameController pour distinguer tour local vs tour distant

---

## Tests

### 1. Tests unitaires (protocole)

Pas besoin de réseau. On mock les connexions PeerJS.
"Quand je reçois un message `action`, est-ce que le moteur l'applique ?"

### 2. Tests d'intégration (deux moteurs en mémoire)

Deux `BattleEngine` communiquant via un faux canal (EventEmitter au lieu de WebRTC). Combat complet 1v1, vérification que les états restent identiques.

Couvre 95% des bugs possibles sans toucher au réseau.

### 3. Tests E2E (Playwright)

Deux onglets navigateur, un crée la partie, l'autre rejoint. Combat de bout en bout. Plus lent mais c'est le test ultime. Playwright est déjà en place.

---

## Comment les joueurs se trouvent

### V1 : Room code + lien d'invitation (Phase 7)

Pas de matchmaking. Les joueurs se trouvent par leurs propres moyens (Discord, SMS, Twitter, en personne) et partagent un code ou un lien.

```
LobbyScene :
  ┌─────────────────────────────┐
  │  Créer une partie           │  → génère un code, affiche "ABCD-1234"
  │                             │    + bouton "Copier le lien"
  │  Rejoindre (entrer un code) │  → champ texte, bouton Rejoindre
  │                             │
  │  Retour au menu             │
  └─────────────────────────────┘
```

C'est suffisant pour une communauté naissante. Un matchmaking avec personne en ligne c'est une salle d'attente vide — pire qu'un code.

### V2 : Matchmaking (quand la communauté grandit)

Si le besoin se fait sentir, ajouter un matchmaking simple via un service tiers (ex: Supabase Realtime, free tier) :

```
Joueur A clique "Chercher un adversaire"
  → écrit son peer ID + timestamp dans une table "lobby" (Supabase)
  → attend une notification Realtime...

Joueur B clique "Chercher un adversaire"
  → lit le lobby, trouve A (le plus ancien en attente)
  → se connecte en P2P via le peer ID de A
  → supprime l'entrée du lobby

Tout le combat passe en P2P. Le service externe ne sert que pour l'appairage.
```

Le matchmaking est un ajout incrémental — le code P2P (room code) reste la base, le matchmaking s'ajoute par-dessus sans rien casser.

**Décision reportée** — on implémentera le matchmaking uniquement si la communauté le justifie.
