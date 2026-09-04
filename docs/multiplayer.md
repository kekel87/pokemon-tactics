# Multijoueur P2P — Architecture et design

> Document de référence pour l'implémentation du multijoueur (Phase 7).
> Écrit le 2026-04-06, **révisé le 2026-08-29** après une passe d'audit de faisabilité, puis
> **corrigé le 2026-09-04 par le Lot B1, qui est le premier à avoir été implémenté**.
> Décisions associées : #209-212 (fondations), #862-870 (révision), #895-912 (Lot B1).

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

## Ce que le Lot B1 a changé, en le codant (2026-09-04)

Le Lot B1 (plan 199 — transport, salon, lancement) est **livré**. Cinq points de ce document, écrits
avant tout code, se sont révélés faux ou impraticables à l'écriture. Ils sont corrigés dans les
sections concernées ; les voici groupés, parce que plusieurs décisions d'août s'appuyaient dessus.

1. **Plus de lien d'invitation** (#895). Il serait construit depuis l'origine courante, laquelle vaut
   `html-classic.itch.zone/…` dans l'iframe itch.io — un lien qu'on ne peut ni prévoir ni partager.
   Le **code seul**, en 5 caractères.
2. **Le format se choisit AVANT la création** (#896), dans l'écran `lobby`. Il fixe le nombre de
   places avant la naissance du code, ce qui supprime le cas « l'hôte change de format alors que
   quelqu'un est entré », qui aurait demandé d'éjecter un joueur.
3. **Pas de second écran de salon** (#897). La salle d'attente **est** l'écran de sélection
   d'équipe, qui porte déjà les lignes par camp depuis le plan 188.
4. **L'IA est autorisée en ligne** (#901). Ce document disait le contraire ; vérification faite,
   l'IA est **pure** à état et générateur donnés (aucun `Math.random` ni `Date.now` dans
   `packages/core/src/ai/`), donc une graine dérivée par place suffit, sans un seul message.
5. **Le refus de version ne porte pas sur `buildVersion`** (#900). `__APP_VERSION__` vient de
   `git describe`, change à **chaque commit**, et diffère entre les déploiements Pages et itch.io :
   refuser dessus **interdirait le jeu entre plateformes**. Une constante `NETWORK_VERSION`,
   incrémentée à la main, la remplace.

🔴 **La règle à retenir de tout ça** : `NETWORK_VERSION` (`packages/network/src/protocol.ts`)
**s'incrémente à la main** dès que toucher au moteur, aux données de jeu ou au protocole peut faire
diverger deux pairs. On l'oubliera au moins une fois ; le filet est la somme de contrôle du Lot B4,
qui transformera l'oubli en erreur lisible au lieu d'un combat qui part en silence.

**Deux pièges de déterminisme trouvés en écrivant**, tous deux corrigés :

- **Le placement automatique tirait au hasard localement** (`PlacementPhase`), depuis un tirage
  `crypto.getRandomValues` propre à chaque pair. Sans graine venue de l'hôte, deux joueurs avaient
  **deux plateaux différents avant le premier tour**. Le setup diffusé porte donc **trois** graines :
  combat, placement, IA (#902).
- **Le lancement doit être accusé** (#903). Sans accusé, un pair qui manque le `start` reste sur
  l'écran d'équipe pendant que les autres jouent, et **aucun moment n'existe** où quelqu'un s'en
  aperçoit : il attend un tour qui n'arrivera jamais.

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

### 1. Connexion (code de partie) — LIVRÉ (plan 199)

**Le code est l'adressage** (#898). L'hôte prend l'identifiant `pkmntac-<CODE>-1`, la place *n* est
`pkmntac-<CODE>-n`. Personne n'annonce qu'il est l'hôte : c'est le fait d'avoir pris la place 1 qui
le définit, et la prise d'identifiant étant exclusive, deux pairs ne peuvent pas s'en croire
titulaires tous les deux.

```
Hôte : menu → Combat → En ligne → lobby (format + « Créer »)
  → écran de terrain (aperçu 3D)
  → écran de sélection d'équipe : LE CODE NAÎT ICI, et s'y affiche
     (là où l'hôte attend, donc là où il le partage)

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
- **La reconnexion sans serveur** (Lot B3) : celui qui revient réclame **la même place**, à une
  adresse que les autres connaissent déjà, même si l'hôte est parti entre-temps.

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

Pas de comptes, pas de matchmaking, **pas de lien d'invitation** (#895) : le code se partage par
Discord, SMS, ou tout autre moyen.

**La saisie du code passe par une roue de caractères** — cinq emplacements montrant leurs voisins
d'alphabet — et non par un champ texte. Motif : un champ texte n'est **pas saisissable à la manette**
(choix explicite du projet), donc garder les deux aurait voulu dire échanger un sous-arbre DOM selon
la source active, et perdre le focus à chaque bascule. Un seul widget sert les quatre entrées : les
lettres au clavier, les directions et `A` au pad, la tape au doigt, le clic et la molette à la souris.

### 2. Sélection d'équipe — LIVRÉ (plan 199)

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
| Sélecteur de format masqué | Il est gravé depuis le `lobby` |

```
Chacun compose les lignes qu'il possède : la sienne, plus les lignes IA pour l'hôte
  → chaque sélection est annoncée au salon
  → l'hôte grave le setup et le diffuse (`start`)
  → chaque pair ACCUSE réception (`start_ack`)
  → l'hôte n'entre en combat que lorsque tous ont accusé, et annule sinon
```

Le setup diffusé porte : l'**identifiant stable de carte** (jamais l'URL — elle dépend de la base de
déploiement et n'est pas un contrat entre deux pairs), le format, les options de partie, la
composition de **chaque** place, et les **trois graines** (combat, placement, IA).

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

**Ce qui est LIVRÉ** (Lot B1, `packages/network/src/protocol.ts`) :

```typescript
type NetworkMessage =
  | { type: "hello"; networkVersion: number; seat: number }
  | { type: "welcome"; networkVersion: number; occupiedSeats: readonly number[] }
  | { type: "room_state"; options: NetworkRoomOptions; seats: …; locked: boolean }
  | { type: "team_select"; seat: number; selection: NetworkTeamSelection }
  | { type: "ready"; seat: number; ready: boolean }
  | { type: "start"; options: …; seeds: NetworkSeeds; seats: readonly StartSeat[] }
  | { type: "start_ack"; seat: number }
  | { type: "bye"; seat: number };
```

**Ce qui reste à écrire** : `action` (Lot B2), `checksum` / `desync` (Lot B4), `forfeit` (B2),
`rematch` et `chat` (hors V1). Le **nom de joueur a été écarté de la V1** (#906) : il revient avec le
compte et le classement ; la salle d'attente affiche « Joueur 2 ».

**Pas de message `timeout`** — c'est délibéré, voir § Chronomètre.

**Le déverrouillage du salon EST le message d'annulation du lancement.** Il n'y en a pas de
troisième : un invité entre en combat dès le `start` (il n'a aucun moyen de savoir où en sont les
autres), et un `room_state` déverrouillé le ramène à la salle d'attente si l'hôte a dû annuler.

**Les causes de refus sont une énumération fermée** — `code_introuvable`, `salon_plein`,
`partie_commencee`, `version_incompatible`, `connexion_impossible`, `delai_depasse` — et ce sont
aussi les valeurs envoyées en télémétrie : jamais de texte libre, sinon le rapport devient
inagrégeable.

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

En multijoueur, le pair qui revient rejoue par **ce même chemin**. Deux des trois inconnues d'alors
sont déjà réglées par le Lot B1, comme effet de bord du salon plutôt que de la reconnexion
elle-même : le setup diffusé porte l'**identifiant stable de carte** (jamais l'URL, § Sélection
d'équipe) et la **version de protocole au handshake** est `NETWORK_VERSION`, **pas** `buildVersion`
(#900, § Protocole) — `buildVersion` reste le garde-fou du solo (décision #748), un autre mécanisme.
Ce qui reste à faire, au **Lot B3** :

- politique de reconnexion **en combat** (délai, qui attend, ce que voit l'autre) — les délais de
  grâce du salon (10 s après un `bye`, 45 s après un silence, #905) en sont le prototype, pas encore
  transposés au combat.

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
100 000 lignes écrites/jour.

⚠️ **Chiffre corrigé le 2026-08-31** (vérification web, plan 196) : la doc D1 précise qu'une écriture
sur une table indexée compte **deux lignes** — celle de la table et celle de l'index. Avec deux
événements par partie, une partie coûte donc **~4 lignes**, pas 2 : le plafond réel est de l'ordre de
**~25 000 parties/jour**, non ~50 000 comme écrit ici le 2026-08-29. Sans conséquence pratique à notre
échelle, et le rapport de force avec un schéma éclaté (une ligne par Pokemon et par move, ~45× plus
coûteux) reste intact — c'est lui qui justifie le brut.

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
| `AiTeamController` | Remplacement si un joueur se déconnecte — voir le paragraphe suivant |

✅ **L'IA tourne bien sur les deux pairs, résolu au Lot B1 (#901).** En solo elle est seedée sur
`createPrng(Date.now())` (`combat-screen.ts:782`) ; ce seed-là diverge d'un pair à l'autre, mais ça
n'a plus d'importance en ligne : le setup diffusé porte une graine d'IA dérivée **par place**, et
c'est suffisant, l'IA étant **pure** à état et générateur donnés (aucun `Math.random` ni `Date.now`
dans `packages/core/src/ai/`). Pas de « pair émetteur » à désigner — cette idée, notée par le plan 181
et reprise sans vérification par le document d'avril, est **annulée** par #901.

---

## Le paquet `packages/network/`

**Créé au Lot B1.** Pur : aucune dépendance d'interface, et du moteur il ne connaît que des **types**.

```
packages/network/src/
  protocol.ts            LIVRÉ — messages, NETWORK_VERSION, causes de refus, graines
  room-code.ts           LIVRÉ — alphabet, génération, adresses dérivées du code
  transport.ts           LIVRÉ — le contrat commun + la prise d'identifiant à réessais
  peer-connection.ts     LIVRÉ — la mise en œuvre PeerJS
  fake-transport.ts      LIVRÉ — canal en mémoire : c'est lui qui rend le salon testable sans réseau
  room.ts                LIVRÉ — état de salon, arrivées, départs, lancement accusé
  network-controller.ts  Lot B2 — orchestre le tour réseau (attend l'action distante)
  checksum.ts            Lot B4 — sérialisation canonique + hash du BattleState
```

Le **canal en mémoire n'est pas un artifice de test** : c'est lui qui permet de faire tourner deux
salons — ou douze — dans le même processus, donc de couvrir l'allocation concurrente, les départs et
le lancement annulé **sans réseau ni service tiers**. C'est ce qui garde le gate vert le jour où
Internet tombe.

---

## Écrans à ajouter/modifier

> Le document d'avril parlait de `LobbyScene`, `TeamSelectScene` et `BattleScene`. **Ces scènes
> n'existent plus** : depuis la migration Babylon (Phase 5), l'application est une **FSM d'écrans
> DOM** décrite par `ScreenId` et `SCREEN_TRANSITIONS` dans `packages/app/src/app/screens.ts`.

- **`lobby`** — **LIVRÉ** : format (avant la création) puis « Créer » / « Rejoindre ». Câblé dans
  `SCREEN_TRANSITIONS` depuis `battle-mode`, vers `map-select` (l'hôte, qui choisit son terrain) et
  vers `team-select` (l'invité, à qui la carte arrive de l'hôte).
- **`map-select`** — **LIVRÉ** : accepte une intention de partie en ligne et la **transmet**. Sans
  cette transmission la salle d'attente se montait en mode local, sans code ni salon, et rien ne le
  signalait — l'écran étant par ailleurs parfaitement fonctionnel.
- **`team-select`** — **LIVRÉ** : la salle d'attente. Le troisième état de ligne n'est pas un
  contrôleur mais un état de **salon** — le moteur ne connaît qu'« humain » ou « IA », et un joueur
  distant est un humain, simplement pas celui qui est devant cet écran.
- **`combat`** — Lot B2 : `runBattle` distinguera tour local et tour distant. Le point d'accroche
  `humanPlayerIds` porte déjà la distinction humain/IA. Le Lot B1 y a déjà mis les **trois graines**
  du setup, seule chose dont le combat ait besoin pour être identique sur les deux pairs.

🔴 **Le salon n'appartient à AUCUN écran** (`packages/app/src/network/online-room.ts`). Il est détenu
par la session et **survit à l'entrée en combat**.

Ce n'est pas une élégance, c'est un correctif : quand il appartenait à l'écran de sélection d'équipe,
entrer en combat le détruisait, et `peerjs` **jette** le tampon d'un canal qu'on détruit — l'accusé de
lancement de l'invité pouvait donc ne jamais partir, l'hôte annulait, et son annulation n'atteignait
plus personne. Un salon qui doit vivre plus longtemps que l'écran qui le crée ne peut pas lui
appartenir. Il se ferme sur les deux vrais chemins de sortie : « Retour » depuis la salle d'attente,
et **tout retour au menu principal** — `combat` ne transite que vers lui, donc l'écran de combat n'a
pas à connaître le réseau. C'est aussi ce dont le Lot B2 a besoin, où les actions s'échangent pendant
le combat.

⚠️ **Corollaire pour tout écran qui s'y branche** : ses écouteurs doivent être soldés à son
démontage. Le salon leur survivant, les oublier fait rendre un écran détruit à chaque message reçu.

---

## Comment les joueurs se trouvent

### V1 : code de partie seul — LIVRÉ (#895)

Pas de matchmaking. Les joueurs se trouvent par leurs propres moyens (Discord, SMS, en personne) et
partagent **un code**. Pas de lien d'invitation : il serait construit depuis l'origine courante,
laquelle vaut `html-classic.itch.zone/…` dans l'iframe itch.io.

```
Écran `lobby` :
  ┌───────────────────────────────────────────────┐
  │  Créer une partie                             │
  │    Joueurs : [2] 3  4  6  12    ← AVANT de créer
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

### Matchmaking — écarté, pas reporté (2026-08-29)

La V2 « matchmaking via Supabase Realtime » du document d'avril est **écartée** avec le reste de
Supabase (#862). Si le besoin se représente un jour, il se ferait sur un Durable Object
(§ Workers) — mais l'objection ci-dessus reste : elle est produit, pas technique.

---

## Tests

### 1. Tests unitaires (protocole) — LIVRÉ

Pas besoin de réseau : alphabet et génération de code, adresses dérivées, reconnaissance des
messages, refus de version, dérivation des graines d'IA, prise d'identifiant à réessais.

### 2. Tests d'intégration (deux salons en mémoire) — LIVRÉ

Plusieurs `Room` dans le **même processus**, par le canal en mémoire : allocation de places
concurrente, maillage, arrivée et départ (propre et silencieux), hôte qui part, refus au-delà du
format, refus de version, lancement accusé, **lancement annulé quand un accusé manque**.

Le Lot B2 y ajoutera deux `BattleEngine` communiquant par le même canal, pour vérifier que les états
restent identiques sur un combat complet.

### 3. Tests E2E (Playwright) — LIVRÉ, un seul scénario

`e2e/tests/dom/online-lobby.spec.ts` : deux contextes de navigateur, l'un crée, l'autre saisit le
code au clavier et rejoint, les deux entrent en combat (assertion sur le **signal de disponibilité de
la scène**, pas sur la présence d'un `<canvas>`, qui existe dès le montage).

🔴 **L'annuaire est LOCAL**, lancé par le harnais (paquet `peer`, second `webServer` de
`playwright.config.ts`, port dérivé de celui de l'app). Le service public ferait dépendre la suite
d'un tiers sans engagement de service : une coupure d'Internet rendrait le gate rouge sans qu'une
ligne de notre code ait changé. La surcharge passe par `?peerPort=`, **verrouillée sur `DEV` ou
`VITE_E2E`** comme `?seed=` — sans ce verrou, ce serait une porte ouverte à l'interception de
parties. Les serveurs STUN/TURN sont désactivés pour les mêmes raisons : les deux pairs sont sur la
boucle locale, et attendre la résolution de `*.turn.peerjs.com` faisait dépasser le scénario.

⚠️ **Coût machine** : la suite complète est à ~520 tests et tourne sous plafond CPU
(`scripts/with-cpu-cap.sh`). D'où **un seul** scénario à deux contextes (mesuré ~9 s isolé) ; tout ce
qui se teste sans réseau reste en intégration, qui ne coûte rien.
