# Multijoueur P2P — Architecture et design

> Document de référence pour l'implémentation du multijoueur (Phase 7).
> Écrit le 2026-04-06, **révisé le 2026-08-29** après une passe d'audit de faisabilité, puis
> **corrigé le 2026-09-04 par le Lot B1, qui est le premier à avoir été implémenté**, puis
> **corrigé le 2026-09-09 par le Lot B3, implémenté et validé en recette humaine**, puis
> **corrigé le 2026-09-10 par le Lot B4 (détection de désync)** — codé, e2e et recette humaine
> encore en cours (plan 203).
> Décisions associées : #209-212 (fondations), #862-870 (révision), #895-912 (Lot B1),
> #946-#967 (Lot B3, plan 202 — chrono, chien de garde, abandon, reconnexion),
> #968+ (Lot B4, plan 203 — somme de contrôle, forfait sur divergence).

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
diverger deux pairs. On l'oubliera au moins une fois ; le filet **existe désormais** : la somme de
contrôle du Lot B4 (§ Détection de désync) transforme l'oubli en erreur lisible au lieu d'un combat
qui part en silence — mais elle ne remplace pas la discipline d'incrémenter la version, elle ne
fait que rattraper l'oubli une fois qu'il a eu lieu.

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

**Ce que le Lot B2 a ajouté** (plan 201) :

```typescript
  | { type: "action"; seat: number; actionIndex: number; action: Action }
  | { type: "forfeit"; seat: number; forfeitedSeat: number; reason: NetworkForfeitReason }
```

`actionIndex` est le nombre d'actions enregistrées chez l'émetteur **avant** celle-ci : un détecteur
de désync du pauvre (décision D3), qui dit « nous ne sommes pas au même point » au lieu d'appliquer
une action au mauvais acteur. `forfeitedSeat` désigne la place éliminée, qui n'est pas celle de
l'émetteur quand c'est un constat de divergence — et **`NETWORK_VERSION` est passée à 2**.

**Ce que le Lot B3 a ajouté** (plan 202) :

```typescript
  | { type: "resync_request"; seat: number; actionIndex: number }
  | { type: "resync"; seat: number; fromIndex: number; actions: readonly Action[] }
```

Le message `action` gagne `timedOut?: true` (auto-déclaré par l'émetteur, décision #955). Le
rattrapage d'un revenant : « j'en suis là, donne-moi la suite » / la queue du journal — et
**`NETWORK_VERSION` est passée à 3**.

**Ce que le Lot B4 a ajouté** (plan 203) :

```typescript
  | { type: "checksum"; seat: number; actionIndex: number; digest: string }
```

Une empreinte de l'état de combat (`battleStateChecksum`, `packages/core`), émise après chaque
action complétée et une fois au lancement (`actionIndex` 0, après le placement). Comparée par pair
et par ancrage ; à l'écart, `forfeitSeat(...)` avec `NetworkForfeitReason.EtatDivergent` — **et
`NETWORK_VERSION` est passée à 4**. Détail : § Détection de désync.

**Ce que le plan 204 a ajouté** (hors lot, dette de télémétrie soldée avant la Phase 8) : le message
`start` porte un champ `battleId: string` de plus, tiré par l'hôte — **et `NETWORK_VERSION` est
passée à 5**.

C'est le seul champ du protocole que `packages/network` **transporte sans jamais le lire**. Il sert
à la télémétrie : les deux pairs émettent chacun leur `battle_started` et leur `battle_ended`, et
sans identifiant commun rien à la lecture ne disait que ces lignes étaient la même partie — une
partie en ligne comptait pour deux dans les parties, les cartes, les formats, les durées et le taux
d'abandon. Les compositions d'équipes, elles, étaient déjà justes : chaque pair ne déclare que son
camp (plan 201, étape 7), et l'agrégation les cumule toujours sur les deux lignes.

**Ce qui reste à écrire** : `rematch` et `chat` (hors V1). Le **nom de joueur a été écarté de la V1**
(#906) : il revient avec le compte et le classement ; la salle d'attente affiche « Joueur 2 ».

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

**Tranché avec l'humain le 2026-09-08** (plan 202, étape 1) :

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

⚠️ **« La dérive va dans le bon sens, gratuitement » — vrai seulement de ton PROPRE chrono, pas du
chien de garde d'en face.** Le raisonnement — tu démarres ton chrono en finissant d'appliquer
l'action précédente, le pair distant démarre le sien en la **recevant** ~150 ms plus tard, donc son
chrono expire après le tien — ne protège que contre ton propre minuteur. Si tu mets ton onglet en
arrière-plan **pendant ton propre tour**, ton minuteur ralentit (Chrome ~1/s, puis ~1/min après
5 min d'inactivité) donc tu ne t'auto-passes pas — mais le chien de garde de l'adversaire, lui,
tourne sur **sa propre** horloge murale en temps réel, et te forfaite à 75 s, connexion intacte.
Les deux minuteurs n'ont pas la même base de temps. **Risque assumé** : passé cinq minutes
d'arrière-plan pendant son propre tour, le joueur *est* parti.

🔴 **Parade retenue : une échéance en horloge murale, jamais un `setTimeout` unique de 60 s.**
L'orchestrateur retient `deadlineAt = now() + durationMs` et se réveille périodiquement pour
comparer, plutôt que de planifier un unique minuteur de 60 000 ms qui se déclencherait très en
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
(§ Gestion de la déconnexion, Lot B3).

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

> **Réglé** (noté par le plan 187, corrigé au Lot B3, étape 6) : ouvrir le menu de combat **grignote
> le temps du joueur sans le dire**, puisque rien n'est mis en pause (décision #819, cadrage « un
> seul comportement dès le solo »). Une pastille « le temps continue » l'annonce désormais sur la
> modale.

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

### Validation des actions — LIVRÉ (plan 201, Lot B2)

Chaque action reçue est validée. **Quatre contrôles**, du moins cher au plus révélateur :

```
action reçue → même index d'action que chez nous ?        non → refus (desynced_index)
             → l'acteur courant est-il de ce camp ?        non → refus (not_this_seat)
             → dans getLegalActions(), RETRAITE EXCLUE ?   non → refus (not_legal)
             → submitAction() l'accepte ?                  non → refus (engine_refused)
             → sinon appliquée, et le compteur retombe à 0
```

🔴 **Le « rejeter, redemander » de la version d'avril était impraticable** (décision D1) :
`executeAction` soumet à son propre moteur **puis** diffuse, donc quand on refuse, l'émetteur a déjà
avancé — renvoyer la même action ne répare rien, on est déjà divergents. Le barème devient :

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

🔴 **Ce n'est pas une accusation de triche** (décision D5). En 1v1, personne ne peut dire qui s'est
écarté — un client modifié peut *feindre* de constater une divergence. Le message porte donc la cause
`diverged` et le joueur lit « les parties ne concordent plus », jamais « vous avez triché ». Même
symétrie que le refus de version (#900).

**Ce que le modèle n'attrape pas, et qu'il faut assumer** : côté émetteur, une action refusée ne
coûte rien — son moteur local l'a acceptée. Le seul qui paie est le récepteur, en attente. Un pair
qui refuse délibérément des actions **légitimes** élimine donc l'autre à coût nul, et `forfeitedSeat`
n'étant pas authentifiable, il peut même le désigner directement. Sans effet dans le cadrage du jeu
(§ Fog, #863) ; le recours serait du côté de la somme de contrôle du Lot B4.

### Détection de désync (Lot B4, plan 203, décisions #968+)

**Livré.** À **chaque action complétée** (`CHECKSUM_EVERY_N_ACTIONS = 1`), plus une empreinte au
lancement (`actionIndex` 0, après le placement) : les deux pairs comparent un hash de leur
`BattleState`.

```
battleStateChecksum(state) chez A === battleStateChecksum(state) chez B, au même actionIndex ?
  Oui → rien ne se passe (ni message ni journal)
  Non → forfeitSeat(..., NetworkForfeitReason.EtatDivergent) — « les parties ne concordent plus »
```

🔴 **Constat et forfait, rien de plus — pas de reconstruction depuis le replay.** Le document
annonçait ici une reconstruction ; le plan-cadre 195 aussi. **Amendé en implémentant** : en 1v1,
personne ne peut dire qui s'est écarté (#943), donc « réparer » voudrait dire adopter la version
d'en face sans preuve, et le rattrapage du Lot B3 n'envoie de toute façon que la queue du journal
(`fromIndex`), pas l'état complet. Le but — rendre l'écart **lisible** au lieu de silencieux — est
servi sans reconstruction.

**Sérialisation canonique** (`packages/core/src/battle/state-checksum.ts`, pur, générique et
récursif — jamais une projection énumérée des ~100 champs de `PokemonInstance`) : clés d'objet
triées par point de code, clés à valeur `undefined` omises (charnière : `handleKo` remet une
vingtaine de champs à `undefined` plutôt que de les supprimer), `Map` triée par clé et émise en
liste de paires, **tableaux non triés** (leur ordre est sémantique — `fieldTerrains`, `statusEffects`,
`auras`), flottants quantifiés à un nombre fixe de décimales, `-0` normalisé en `0`, `NaN`/`Infinity`
levés comme erreur. Toute la grille est incluse, `height`/`terrain` compris. Hachage **non
cryptographique** (FNV-1a 64 bits) : détecte la divergence accidentelle, ne résiste à aucune
contrefaçon — cohérent avec #943, rien n'étant authentifié de toute façon. Coût mesuré :
**0,299 ms** par empreinte sur `simple-arena` (12×20 = 240 tuiles, 4 Pokémon), pour un texte
canonique de 25 330 caractères. La plus grande carte du roster (`le-mur`, 16×16) n'est qu'à ×1,1, et
le réseau étant en 1v1 il n'y a jamais plus de 4 Pokémon : la cadence de 1 action est confirmée par
le chiffre, pas par l'intuition (#969).

🔴 **Ce n'est pas un anti-triche, et la cadence n'y change rien.** Rien ne lie l'empreinte émise à
l'état réellement détenu — un client modifié fait tourner un état honnête à côté et émet l'empreinte
honnête. Ce qui empêche de tricher reste la validation d'actions (#211, Lot B2). Le seul gain
contre un menteur : un constat de divergence **fabriqué** alors que les empreintes concordent
devient contredisable (nuance à #943).

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

(Lot B3, plan 202, étapes 2, 4 et 5 — décisions #950-#952, #954-#955, #957, #960, #961)

### Signal précoce, avant le chien de garde (Lot B3, étape 3, décision #956)

`connectionState` de la `RTCPeerConnection`, exposé par PeerJS, donne un signal **gratuit et bien
plus rapide** que le chien de garde : ICE Consent Freshness (RFC 7675) fait émettre une requête
STUN toutes les 5 à 15 s sur le chemin établi, donc `connectionState` passe à `disconnected` en
~5 s sans réponse, puis à `failed` vers ~30 s — sans aucun message de protocole ni battement de
cœur applicatif à écrire, le navigateur le calcule déjà. Il alimente le bandeau (« connexion
instable »), il ne déclenche **jamais** de forfait à lui seul : `disconnected` se rétablit souvent
tout seul, et éliminer quelqu'un sur un état rétablissable serait pire que d'attendre le chien de
garde.

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
Ce que le **Lot B3** (livré le 2026-09-09) y a ajouté :

- politique de reconnexion **en combat** (délai, qui attend, ce que voit l'autre) — les délais de
  grâce du salon (10 s après un `bye`, 45 s après un silence, #905) en sont le **prototype**, mais
  pas le patron final : en combat, contrairement au salon, fermer l'onglet (la croix) **ne déclare
  aucune intention** — l'intention se déclare par le menu de combat (« Abandonner », « Quitter »).
  Voici comment c'est transposé (Lot B3, plan 202, étape 2, corrigé en recette humaine par la
  décision #961) : **75 s** — pas 45 s — après un **silence** (aucun `bye` reçu), et **30 s**
  (`BATTLE_GRACE_SHORT_MS`) dans les deux autres cas — une **fermeture d'onglet**, ou une **deuxième
  chute** de la même place.

  🔴 **Le combat ne réutilise PAS `GRACE_AFTER_SILENCE_MS` (45 s), malgré la ressemblance des
  valeurs** (décision #950). Un délai de grâce de 45 s en combat tomberait pile quand un chrono de
  tour honnête de 60 s approche de son échéance : le joueur qui joue à la dernière seconde se ferait
  passer pour absent — exactement ce contre quoi #865 met en garde. Le chien de garde de combat est
  donc **dérivé du chrono lui-même** (chrono + 15 s = 75 s), pas du salon.

  🔴 **Le `bye` de fermeture d'onglet vaut 30 s en combat, et non plus 10 s** (décision #961, amende
  #950). Le 10 s était hérité du salon et n'avait jamais été réexaminé pour le combat : il produisait
  une absurdité mesurée à la main — fermer sa fenêtre poliment donnait **moins** de temps (10 s) à
  l'adversaire qu'arracher son câble (75 s). Le motif de #905, « l'intention est connue », vaut dans
  une salle d'attente où partir ne coûte rien ; en combat l'intention se déclare par le **menu**
  (« Abandonner », « Quitter »), jamais par la croix de la fenêtre — la croix, c'est l'accident, celui
  que la reprise existe pour absorber. Et 30 s plutôt que 75 : celui qui reste ne doit pas attendre
  une minute et quart contre quelqu'un qui est vraiment parti, et il peut toujours abandonner
  lui-même. Le **même** chiffre sert à la deuxième chute d'une place — un seul chiffre à retenir,
  demandé par l'humain. Le **salon**, lui, garde ses valeurs de #905 (10 s / 45 s) : là, la place se
  libère et personne ne perd de partie. `room.ts` tient le minuteur du canal refermé et ne décide
  rien (`onPeerAbsent`) ; `online-battle.ts`, qui tient à la fois le salon et l'orchestrateur, décide
  et déclenche le forfait (décision #951).

### La limite mesurée : un hôte tué net ne revient pas (décision #966)

**Chiffres mesurés le 2026-09-09** contre le service public de PeerJS, en WebSocket nu — pas
supposés, et la mesure a fait tomber deux hypothèses au passage :

| Comment le pair est parti | Délai avant que son adresse soit libre |
|---|---|
| **proprement** (« Quitter », ou une croix dont le message de départ part) | **110 ms** |
| **brutalement** (onglet tué avant d'avoir pu parler) | **99 s** |

Un **hôte** parti brutalement **ne peut donc pas revenir** : il lui faudrait 99 s pour reprendre son
adresse, alors que l'adversaire ne l'attend au maximum que 75 s (§ Gestion de la déconnexion). Aucun
budget de réessais n'y change quoi que ce soit — insister plus longtemps ne ramènerait personne dans
une partie déjà perdue par forfait.

**Pourquoi cela ne touche que l'hôte** : il doit récupérer une adresse **précise**, le code de salon
étant son adresse (#904). Un invité qui revient réclame la sienne dans les mêmes conditions, mais
l'invité n'est pas le point de rendez-vous : c'est lui qui compose, donc son retour ne dépend pas de
la libération d'une adresse que quelqu'un d'autre attend.

**Ce qui a été écarté**, et pourquoi : allonger la grâce du silence à 110 s dégraderait le cas
courant — l'adversaire attendrait deux minutes devant un écran figé — pour sauver le cas rare. La
vraie correction de fond serait de **ne plus dériver l'adresse de la place**, ce qui demande un point
de rendez-vous tiers (le Worker Cloudflare du Lot A existe déjà) : c'est un lot à part, pas un
réglage.

⚠️ **Deux hypothèses infirmées, à ne pas ressusciter.** Il n'y a **aucune limitation par IP** sur le
service public — 25 prises d'adresse d'affilée passent sans un refus — donc jouer à deux depuis la
même machine n'y est pour rien. Et un barème de réessais **serré** rend les choses pires, pas
meilleures : treize essais en 53 s faisaient se gêner les sockets entre elles côté client, et le
refus devenait « connexion impossible » au lieu de « place occupée », donc un abandon immédiat au
lieu d'un réessai.

### L'hôte ne rappelle jamais — l'asymétrie de qui compose (décisions #957, #960)

**Qui compose est asymétrique, et le document d'origine ne le disait pas** : l'invité appelle
l'hôte à une adresse dérivée du code ; l'hôte n'appelle **jamais** personne, il écoute. Un hôte qui
recharge sa page reprend bien son adresse et redevient joignable (§ Connexion) — mais **personne ne
le rappelle**. Sans correctif, l'invité restait devant son délai de grâce en entier face à un hôte
pourtant revenu et joignable, puis prononçait un forfait sur un adversaire présent.

**Correctif : `scheduleHostRedial`** — pendant sa fenêtre de grâce, l'invité **recompose** l'adresse
de l'hôte toutes les `HOST_REDIAL_INTERVAL_MS` (2 s) au lieu d'attendre un appel qui ne viendra
jamais. Ce trou ne se voit pas en testant la reconnexion de l'invité (qui, elle, compose) — il ne se
révèle qu'en testant le retour de l'**hôte**.

**Deux couches supplémentaires du même trou** (décision #960), trouvées en écrivant : un salon
revenu (l'hôte qui recharge) n'avait **ni** délai de grâce en cours **ni** état de places à
présenter — il refusait donc le canal entrant de l'invité qui le rappelait, puis se refermait à la
présentation. `handleHello` doit désormais envoyer l'état du salon **au revenant, à lui seul**,
avant même que `waitForWelcome` ne se dise entré — sans quoi l'arrivant lisait une configuration
vide et croyait à une incompatibilité de version.

### Abandon volontaire

**« Abandonner » existe déjà** dans le menu de combat (plan 187), avec sa confirmation et sa
navigation clavier/manette. Ce qui manque n'est pas le contrôle mais son **effet en ligne** :
aujourd'hui son `onAbandon` fait `onBattleClosed()` puis `onExit()` — il quitte **sans prévenir
l'adversaire**, qui reste devant un tour qui ne viendra jamais. **C'était un bug, réparé par le Lot
B3** (plan 202, étape 6), pas une fonctionnalité créée de zéro.

```
Joueur clique "Abandonner" (confirmé) ou ferme l'onglet
  → room.sendForfeit(monSiège, NetworkForfeitReason.Abandon) PUIS applyForfeit(monJoueur)
    — l'ordre compte : on part, on ne pourra plus rien dire ensuite
  → L'autre joueur gagne par forfait
```

Le `bye` doit partir à la **fermeture d'onglet** (`pagehide`), pas seulement sur un clic
« Quitter ».

**Une phrase par raison, pas un message unique** — correctif de recette humaine : le journal de
combat disait « les parties ne concordent plus » (la phrase de la divergence, § Anti-triche) pour
**tout** forfait, y compris un abandon volontaire tout juste confirmé au menu. `ForfeitReason`
distingue désormais `resigned` (abandon), `disconnected` (chien de garde) et `desynced`
(divergence), chacun avec sa propre phrase.

**Le bandeau de connexion se tait dès que le combat est terminé** — correctif de recette humaine :
il continuait sinon d'afficher « en attente de reconnexion… » ou l'avertissement AFK par-dessus
l'écran de victoire.

🔴 **L'abandon (et le forfait de chien de garde) contourne les clauses de survie — statu quo
assumé** (décision #953) : `forfeit()` met les PV à 0 en dur, donc hors du pipeline de dégâts —
**Ténacité**, **Fermeté** et **Ceinture Force** ne se déclenchent jamais. Un abandon n'est pas un
dégât, c'est un renoncement. Les cascades de K.O., elles, restent préservées (**Lien du Destin**,
**Rancune**, **Représailles**) : même bloc `handleKo` que pour un K.O. ordinaire.

---

## Ce qui reste ouvert

Limites assumées à la clôture du Lot B3 (2026-09-09), chacune avec son entrée de backlog dans le
graphe de mémoire — aucune n'est une régression, ce sont des choix de V1 :

- **Élection d'un nouvel hôte impossible** — le code de partie **est** l'adresse de l'hôte
  (§ Connexion, #898) : si l'hôte part pour de bon, il n'y a personne à élire, la partie s'arrête là.
  Backlog : `backlog-election-nouvel-hote-multijoueur`.
- **Sauvegarde partagée entre deux onglets d'un même profil** — deux onglets du même navigateur, sur
  le même profil, se disputent la même clé de sauvegarde de reprise. Backlog :
  `backlog-sauvegarde-partagee-entre-onglets-meme-profil`.
- **Délai réel de libération d'adresse du cloud PeerJS non mesuré** — observé à l'écriture jusqu'à
  ~1 minute (§ Risques, plan 202), jamais confirmé sur le vrai service public. Backlog :
  `backlog-delai-liberation-peerjs-cloud`.
- **`battle_started` toujours pas émis en ligne** (décision #962) — la télémétrie compte des
  `battle_ended` en ligne sans le `battle_started` qui leur correspondrait : les compteurs ont des
  numérateurs sans dénominateur, un taux d'abandon en ligne ne peut pas se calculer.

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

🔴 **Le Lot B2 a rendu cette limite concrète, pas seulement prudente** (décision D6, plan 201) :
`actionIndex` (§ Protocole) suppose un canal **ordonné**, vrai **par connexion** dans un maillage
complet — mais à trois camps et plus, `broadcast()` écrit sur des canaux que rien n'ordonne **entre
eux**. Une action en avance sur un canal serait refusée puis perdue, et trois refus élimineraient un
joueur honnête. **Le réseau est donc restreint au 1v1** : l'écran `lobby` **annonce** le format au
lieu de l'offrir (plus de sélecteur — il n'y a rien à choisir).

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
  room.ts                LIVRÉ — état de salon, arrivées, départs, lancement accusé,
                         routage action/forfeit/checksum/resync (B2, B3, B4 — pas de
                         `network-controller.ts` séparé, ce fichier suffit)
```

🔴 **`checksum.ts` ne vit pas ici.** Le plan-cadre 195 le plaçait dans ce paquet ; **amendé en
implémentant le Lot B4** (plan 203) : la sérialisation canonique et le hash du `BattleState`
vivent dans `packages/core/src/battle/state-checksum.ts`. Motif : c'est un module **pur qui connaît
la forme de l'état de combat** — sa place est auprès de l'état, pas du transport. Le salon ne gagne
qu'un type de message, un envoi, un rappel et une branche de routage (une trentaine de lignes).

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

⚠️ **Le format est annoncé, pas offert** (décision D6, plan 201) : le réseau est restreint au 1v1
(§ 3+ joueurs), donc l'écran ne porte plus de sélecteur — un contrôle à une seule option serait un
arrêt de focus mort pour rien.

```
Écran `lobby` :
  ┌───────────────────────────────────────────────┐
  │  Créer une partie                             │
  │    Format : 1 contre 1                        │
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
