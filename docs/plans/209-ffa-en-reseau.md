# Plan 209 — Le FFA en réseau, et la fin du multijoueur

**Statut** : ready
**Ouvert le** : 2026-09-13, à la demande de l'humain, en recette du plan 208
**Cadré le** : 2026-09-13, avec l'humain et une recherche de bonnes pratiques
**Rouvre** : décision #944 (le 1v1 seul en ligne), **renversée** par ce plan

## Pourquoi ce plan existe

En recette du plan 208, l'humain a buté une fois de plus sur l'absence de sélecteur de format dans la
salle d'attente en ligne. Ses mots : **« Mais pourquoi tu parles TOUJOURS au singulier, le multi c'est
pas que du 1v1 »**, puis, devant la décision qui l'explique : **« Mais qui a décidé ça ! J'ai jamais
voulu ça moi »**.

La décision #944 (2026-09-08, plan 201 Lot B2) est tracée comme décision humaine. Elle répondait à la
question « quels formats offrir en ligne ? » et retenait « le 1v1 seul ». L'humain ne la reconnaît pas
trois plans plus tard, et la redemande à chaque recette — c'est le signe que l'accord n'a pas porté
sur ce qu'il croyait accorder.

🔴 **Ce plan ne restreint plus rien : il finit le multijoueur.** Consigne humaine du 2026-09-13, après
cadrage : « on finit le multi ce plan ». Les quatre volets sont dedans — l'ordre des actions, le
désaccord à N témoins, les cinq formats, la migration d'hôte. Découpé en lots pour que chaque tranche
se teste, **pas** pour en reporter une.

🔴 **#944 est RENVERSÉE, pas effacée.** Elle reste au graphe avec sa date et son contexte, marquée
renversée par ce plan, pour qu'aucune session future ne la resserve comme un acquis.

## Ce que le cadrage a établi

### Le problème n'est pas celui qu'on croyait nommer

Le jeu possède **déjà** un ordre total, et il le tient de ses propres règles : le Charge Time ne donne
la main qu'à **un** acteur à la fois, donc deux camps ne peuvent jamais émettre légitimement en même
temps — un pair a besoin de l'action du précédent pour que son moteur lui rende la main.

**Il n'y a donc aucune collision d'`actionIndex` possible.** Ce que le maillage casse, ce n'est pas
l'ordre *logique* des actions — il est déterminé par les règles — c'est l'ordre de **livraison** à
travers N-1 canaux SCTP indépendants, chacun ordonné en lui-même, aucun ordonné avec les autres.

Conséquence directe, et c'est le principal acquis du cadrage : **une horloge logique (Lamport,
vecteurs) serait du sur-dimensionnement net.** Ces mécanismes reconstruisent un ordre entre événements
réellement concurrents, produits par des émetteurs qui ne se coordonnent pas. Nous n'avons pas ce
problème. Un simple entier de séquence — celui qu'on a déjà — suffit, à condition de s'en servir pour
**réordonner** au lieu de **refuser**.

### Ce que la recherche écarte, et pourquoi

| Piste | Verdict |
|---|---|
| Horloge logique (Lamport / vectorielle) | Résout la concurrence d'écriture. Nous n'en avons pas : le tour par tour la rend impossible. **Écartée** |
| Relais dur de toutes les actions par l'hôte | Ordonne vraiment, mais l'hôte redevient point de passage **et** point de panne, et double la latence. Contraire au P2P du plan 195. **Écartée** |
| CRDT / Yjs | Fusionne des éditions concurrentes sans ordre préétabli. Aucun CRDT ne connaît la légalité d'une action. Remplacerait un problème résolu par un plus gros. **Écartée** |
| Rollback netcode (GGPO) | Prédiction d'entrée sur ~100 ms de simulation continue. Notre tour dure jusqu'à 60 s, il n'y a rien à rejouer image par image. **Hors sujet** |
| Trystero (signaling alternatif) | Remplacerait un tiers par un autre. Le projet a déjà mieux prévu pour ce problème précis : un Durable Object à soi. **Écartée** |
| PlayPeerJS (« migration d'hôte automatique ») | Annonce la migration mais ne documente ni l'algorithme, ni le rendez-vous, ni le sort des connexions pendant la bascule. Mainteneur : en maintenance, recommande autre chose. **Ne pas adopter, même comme référence** |

**Aucune dépendance nouvelle.** Le travail restant est de la logique de protocole propre au jeu —
exactement ce que `packages/network` et `battle-orchestrator.ts` portent déjà.

### Trois constats de lecture de code, faits au cadrage

**1. L'extension du tampon est la bonne piste, mais insuffisante telle qu'elle était écrite.** Garder
l'action quand l'index est en avance ne suffit pas : `pendingRemoteActions` est rejoué en **FIFO**
(`shift()`, `battle-orchestrator.ts:1122`). Deux actions gardées dans le désordre et la mauvaise sort
d'abord, repart en queue de file, et **rien ne relance la file** puisque aucune action n'a été
appliquée — `refreshUI` est le seul point de reprise. La partie se fige. 🔴 Il faut **piocher l'index
attendu**, jamais la tête de file.

**2. Le mécanisme de rattrapage existe déjà, il est simplement désarmé.** `sendResyncRequest(fromIndex)`
/ `sendResync` (Lot B3, décision #955) sait redemander la queue du journal. `online-battle.ts:523` le
coupe hors `resuming === true`, donc il ne sert qu'à la reconnexion. Rien à écrire : à armer.

**3. La somme de contrôle ne s'affaiblit pas à N pairs — elle s'inverse.** `compareDigests`
(`online-battle.ts:420`) confronte mon empreinte à celle d'**un** pair et, sur désaccord, prononce le
forfait de **ce pair** (`:443`). À deux, c'est symétrique et juste. À trois, si c'est **moi** qui
diverge, je prononce le forfait des deux autres — honnêtes — l'un après l'autre, pendant qu'ils
prononcent le mien. **Le seul pair fautif est le seul à rester debout dans sa propre partie.**

En revanche, bonne nouvelle non attendue : **`BattleEngine.forfeit` est déjà correct à N camps**
(`BattleEngine.ts:1272`). Il suit le patron de Lien du Destin et laisse `checkVictory` trancher, qui
ne conclut que si `playersAlive.size <= 1` — le commentaire prévoit explicitement le cas à trois
camps. **Rien à reprendre au moteur** : tout le défaut de #975 est dans la couche réseau.

---

## Les lots

### Lot C1 — L'ordre des actions

**Ce qu'il débloque** : le FFA jouable à 3 et 4 camps. C'est le seul lot qui lève l'obstacle de fond ;
les trois autres traitent ce que le FFA rend visible.

1. Dans `submitRemoteAction` (`battle-orchestrator.ts:1818`), remplacer le refus sur
   `actionIndex !== expected` par une discrimination de sens :
   - index **supérieur** à l'attendu → l'action est légitime et arrive trop tôt : **garder**,
     `pendingRemoteActions`, aucun refus compté ;
   - index **inférieur** → l'émetteur rejoue ou diverge : **refuser**, comme aujourd'hui.
2. Remplacer le `shift()` de `refreshUI` (`:1122`) par une recherche de l'enveloppe dont
   l'`actionIndex` vaut `engine.actionLogLength`. Retirer par index, pas en tête. **Sans ce point, le
   lot fige la partie au lieu de l'ouvrir** — voir constat 1.
3. Plafonner le tampon et le purger : une action gardée dont l'index est devenu **inférieur** à
   l'attendu (elle a été appliquée par un autre chemin, un resync par exemple) doit être jetée, pas
   gardée pour toujours.
4. Armer le resync en cours de partie, en **filet** et non en premier recours : quand une action
   manque depuis plus d'un délai, demander la queue du journal. Le tampon règle le désordre ; le
   resync règle la perte réelle. Les deux sont complémentaires — l'un n'absorbe pas l'autre.
   **Base de départ : 15 s**, soit le quart du chronomètre de tour (60 s, plan 202). Assez long pour
   qu'un désordre ordinaire se résolve tout seul dans le tampon, assez court pour qu'une perte réelle
   ne mange pas le tour. À affiner sur observation, pas à deviner une deuxième fois.

**Critères de sortie** — tests unitaires `view-core`, sans réseau : trois actions livrées dans le
désordre (2, 0, 1) sont appliquées dans l'ordre 0, 1, 2 et **aucun refus n'est compté** ; une action
d'index inférieur est refusée ; le tampon ne grossit pas indéfiniment sur une action jamais réclamée.

### Lot C2 — Le désaccord à N témoins

**Ce qu'il corrige** : l'inversion du constat 3, et la limite de #975.

1. Retourner `compareDigests` : au lieu d'accuser celui qui n'est pas d'accord avec moi, rassembler
   **toutes** les empreintes connues au même `actionIndex` — la mienne comprise — et accuser le
   **minoritaire**, moi compris. Se prononcer soi-même divergent doit être un cas normal du code, pas
   une branche oubliée.
2. **Exclure du quorum les places forfaitées ou éliminées.** Leur empreinte fige à leur dernier index
   pendant que les survivants avancent : comptée, elle fabrique un faux positif à chaque action. C'est
   la limite exacte de #975.
3. Ne comparer que des empreintes au **même `actionIndex`** — déjà le cas, à préserver explicitement :
   un revenant qui rattrape son journal émet des empreintes en retard qui pollueraient le vote.
4. **Le vote, concrètement.** Grouper les places par empreinte à un `actionIndex` donné, puis
   comparer la taille des groupes. Trois issues, et une seule fonction qui les rend :
   - un groupe strictement plus grand que tous les autres → les places des **autres** groupes sont
     minoritaires, forfait prononcé contre elles, **la mienne comprise** ;
   - deux groupes ou plus à égalité au sommet → **personne** n'est accusé ;
   - moins de deux empreintes connues → rien à décider, on attend.

   Exemple d'égalité à quatre camps : `[A:h1, B:h1, C:h2, D:h2]` — deux contre deux, aucun groupe ne
   domine, aucun forfait. La fonction rend « pas de verdict », pas un camp au hasard.
5. **La règle d'égalité.** Aucun précédent ne tranche : *Age of Empires* et *Factorio* constatent la
   divergence et **ne réconcilient jamais**. 🔴 Nous faisons pareil — **pas de majorité, personne
   n'est accusé** : on compte en télémétrie et on laisse jouer. Prononcer un forfait sur une égalité,
   c'est éliminer un joueur à pile ou face.

🔴 **Ce que ce lot n'est pas, et doit continuer de ne pas être : un anti-triche.** Le seuil byzantin
est de 3f+1 — tolérer un seul pair menteur demande 4 pairs. À trois camps, un vote 2 contre 1 ne
**prouve** rien contre un divergent intentionnel. C'est un outil de **diagnostic** contre la
divergence accidentelle, et la documentation doit continuer de le dire (#943, #975).

**Critères de sortie** : à trois pairs dont un divergent, les deux honnêtes le désignent et ne
s'accusent pas l'un l'autre ; le pair divergent se reconnaît minoritaire ; un camp forfaité ne
déclenche plus aucun écart chez les survivants ; une égalité à quatre n'accuse personne.

### Lot C3 — Les cinq formats

**Ce qu'il rend au joueur** : ce que l'humain réclame depuis trois plans.

1. `ONLINE_TEAM_COUNT` (`online-room.ts:119`) disparaît au profit de `REQUIRED_TEAM_COUNTS` — la
   ligne que #944 annonçait comme réversible. **En dernier, jamais en premier** : elle n'a de sens
   qu'une fois C1 et C2 livrés.
2. Le **sélecteur de format revient dans la salle d'attente**, et le nombre de places est gravé avant
   la publication du code — un salon ne change pas de format en cours de route.
3. `team-select-screen.ts:522-567` : la bascule solo → en ligne ne rabat plus sur 2 camps. Le garde-fou
   `losesCamps` reste, mais ne se déclenche plus que pour une vraie perte.
4. `GamePanel.formatLabel` : le cas « N joueurs » redevient atteignable — **c'est pourquoi il a été
   gardé** plutôt que supprimé (arbitrage humain du 2026-09-13, qui solde
   `question-formatlabel-room-formatplayers-code-mort-potentiel`).
5. `Room.setSeatOccupancy` : revoir le refus d'un `Human` sur une place libre (correctif du
   2026-09-05) à N camps.
6. Le bandeau de partie du plan 208 : la ligne « Format · 1 contre 1 » redevient un vrai choix. **Rien
   d'autre du plan 208 ne bouge.**

7. 🔴 **Le seuil d'absence doit devenir proportionnel au nombre de camps.** Le détecteur du Lot B3
   forfait sur **trois tours manqués consécutifs** — calibré pour le 1v1, où le tour revient toutes
   les 2 actions, donc ~6 minutes. Le Charge Time fait toujours agir **12 combattants par round**
   quel que soit le format (`MAX_POKEMON_PER_BATTLE`), donc à 12 camps le tour ne revient que toutes
   les 12 actions : **trois tours manqués prennent ~36 minutes**. Un joueur parti occupe sa place
   plus d'une demi-heure, et son inaction décide du sort des autres. Relevé au cadrage par
   `game-designer`, 2026-09-13.

   ⚠️ **Ce que ce n'est pas** : les onze autres ne sont pas bloqués 36 minutes — ils jouent pendant
   ce temps, et ne subissent que les 3 × 60 s de ses tours perdus. Le problème est l'**occupation de
   la place**, pas le temps mort. Ne pas surdimensionner la correction sur une mauvaise lecture.

🔴 **Mesurer le maillage à 12, ne pas le supposer.** 66 connexions, 11 par pair. La bande passante
n'est pas le sujet (~100 octets à la cadence humaine) ; le sujet est le **montage** — N² négociations
ICE indépendantes — et la **surface de panne** : la probabilité qu'au moins un lien tombe sur un NAT
symétrique monte bien plus vite que le nombre de joueurs. Aucun seuil dur n'existe dans la
littérature pour du data-only, donc **on mesure** (règle du projet depuis le plan 198) : temps
d'entrée en partie à 3, 6 et 12, et taux de liens établis. Si 12 ne tient pas, le repli est la
topologie étoile du Lot C4 — pas un abandon du format.

**Critères de sortie** : une partie à 3 et à 4 se crée, se rejoint et se joue jusqu'au verdict ; le
sélecteur affiche les cinq formats ; la mesure de montage à 6 et 12 est faite et consignée ; **un
joueur qui décroche à 12 camps est forfaité dans un délai du même ordre qu'en 1v1**, pas en trente-six
minutes.

🔴 **Un critère de cadence, pas seulement de réseau.** La première rédaction ne mesurait que la
connectivité — c'était un angle mort, relevé au cadrage. Un format peut se connecter parfaitement et
rester injouable. À consigner avec la mesure de montage : **durée d'un round complet** et **attente
entre deux tours d'un même joueur**, à 6 et à 12. Le pire cas théorique est connu (12 actions × 60 s
= 12 min par round, ~11 min d'attente en 12 camps) ; ce qu'on ne sait pas, c'est ce que les humains
consomment réellement de leurs 60 s — la télémétrie du plan 204 n'a jamais mesuré que du 1v1.

### Lot C4 — Le rendez-vous tiers

**Pourquoi il est là** : la migration d'hôte n'a que deux issues connues — un point de rendez-vous
indépendant de tout pair, ou renoncer. L'humain a tranché « dedans », donc c'est le rendez-vous.

Aujourd'hui le code de salon **est** l'adresse PeerJS de l'hôte (`pkmntac-<CODE>-1`, #904). Changer
d'hôte veut donc dire changer l'adresse d'une partie en cours, sous les doigts des joueurs — c'est un
problème d'**adressage**, pas d'ordonnancement, et aucun réglage ne le contourne.

1. Un **Durable Object par code de partie** dans `packages/telemetry-worker/` (l'infra existe : compte,
   `wrangler.toml`, étape de déploiement CI — c'est la marche coûteuse, elle est franchie). Il tient la
   correspondance *code de salon → pair actuellement hôte*, et rien d'autre.

   **Le protocole, à trois messages et un compteur** — à verrouiller ici, parce que le Lot C5 s'appuie
   dessus :

   | Message | Rend | Quand |
   |---|---|---|
   | `claim-host { code, peerId }` | `{ ok: true, epoch }` ou `{ ok: false, epoch, peerId }` | Création du salon. Refusé si le code est déjà pris et vivant |
   | `get-host { code }` | `{ peerId, epoch }` ou `{ absent: true }` | Un invité compose le code |
   | `take-over { code, peerId, epoch }` | `{ ok: true, epoch: epoch + 1 }` ou `{ ok: false, epoch, peerId }` | Migration (Lot C5) |

   🔴 **`epoch` est le cœur du dispositif, pas un ornement.** `take-over` n'applique le changement que
   si l'`epoch` fourni est bien celui courant, et l'incrémente en réussissant — un compare-and-swap.
   Un Durable Object s'exécute **mono-thread par objet** (garantie Cloudflare), donc deux `take-over`
   concurrents sont déjà sérialisés : le premier passe et fait passer l'`epoch` à `n+1`, le second
   arrive avec `n`, **échoue**, et reçoit dans son refus l'identité du vrai hôte. C'est ce retour qui
   compte : sans lui, le perdant ne saurait pas qu'il a perdu et se croirait hôte. C'est exactement le
   piège du double hôte du Lot C5, et il se ferme ici, pas là-bas.

   **Qui a le droit d'écrire** : n'importe quel pair, et c'est assumé. Le Durable Object n'authentifie
   personne — comme le reste du réseau, il n'est **pas** un anti-triche (même position que #943/#975).
   Il sérialise et arbitre, il ne juge pas. Un pair malveillant qui détourne un salon peut déjà faire
   pire en divergeant.
2. Le code de salon cesse d'être dérivé d'une place. Il devient une **clé** que le Durable Object
   résout. C'est aussi ce qui solde `backlog-delai-liberation-peerjs-cloud` : plus d'attente de 99 s
   pour reprendre une adresse précise, puisque l'adresse n'est plus précise.
3. Bénéfices acquis au passage, déjà prévus par `docs/multiplayer.md:727` : namespace à nous (fin des
   collisions #866) et fin de la dépendance au SLA inexistant de `peerjs.com`.
4. **Le relais de secours reste hors de ce lot** (usage 3 du § Workers) — sauf si la mesure du Lot C3
   montre que le maillage à 12 ne tient pas, auquel cas la topologie étoile entre ici.

**Limites du plan gratuit à respecter** (vérifiées le 2026-08-29) : 100 000 requêtes/jour, 10 ms de CPU
par invocation (temps CPU, l'attente I/O n'est pas comptée), backend **SQLite obligatoire** en gratuit.

**Critères de sortie** : un salon se crée et se rejoint sans que le code encode l'identité d'un pair ;
**deux `take-over` concurrents au même `epoch` — un seul réussit, et le perdant reçoit l'identité du
vrai hôte** ; le chemin PeerJS Cloud reste fonctionnel en repli tant que le Durable Object n'est pas
déployé.

### Lot C5 — La migration d'hôte

**L'élection elle-même est triviale et ne mérite aucune cérémonie.** Le maillage complet fait que
chaque pair observe déjà qui est connecté, et les places sont numérotées, donc totalement ordonnées :
**la plus petite place encore connectée devient hôte.** Zéro tour de message, pas de bully (O(n²)
messages) ni d'anneau — ils résolvent un accord que notre ordre total rend déjà acquis.

1. À la perte de l'hôte, chaque pair calcule le même successeur, localement. Le nouvel hôte s'annonce
   au Durable Object du Lot C4, qui met la correspondance à jour.
2. Les pairs restants ne se reconnectent pas entre eux — le maillage tient déjà. Seul le **rôle**
   change, pas la topologie.
3. **Ce que le nouvel hôte fait en arrivant**, dans cet ordre :
   1. `take-over` auprès du Durable Object avec l'`epoch` qu'il a lu. **S'il échoue, il n'est pas
      hôte** — il lit dans le refus qui l'est, et s'arrête là ;
   2. demande la queue du journal (`resync_request`) pour être certain d'être au point le plus avancé
      des survivants — l'ancien hôte a pu diffuser une dernière action avant de tomber ;
   3. reprend les responsabilités d'hôte : `broadcastRoomState`, le verrou de lancement, le barème
      d'élimination du Lot B2 ;
   4. rediffuse l'état du salon, pour que les autres constatent la bascule au lieu de la déduire.

   **Les compteurs de refus ne se transmettent pas.** `remoteRejectionsBySeat` est local à chaque
   orchestrateur et le nouvel hôte repart de zéro : c'est le comportement voulu, pas un oubli — hériter
   d'un barème qu'on n'a pas soi-même observé reviendrait à éliminer un joueur sur la parole d'un pair
   qui n'est plus là.
4. Solde `backlog-election-nouvel-hote-multijoueur`.

🔴 **Le piège** : deux pairs qui se croient hôtes en même temps, parce qu'ils n'ont pas vu la même
déconnexion au même instant. L'ordre total des places **ne suffit pas** à le fermer — deux pairs
peuvent calculer le même successeur puis écrire chacun de leur côté. Ce qui le ferme est le
compare-and-swap sur `epoch` du Lot C4 : un seul `take-over` réussit, et **le perdant l'apprend** au
lieu de le supposer. Relevé en revue de plan, 2026-09-13 — la première rédaction affirmait la garantie
sans la fournir.

**Critères de sortie** : à 3 camps, l'hôte tué net n'interrompt pas la partie des deux autres ; le
code de salon continue de fonctionner pour un invité qui revient ; aucun cas où deux pairs se croient
hôtes.

---

## Ordre et dépendances

```
C1 (ordre)  →  C2 (désaccord)  →  C3 (formats)  →  C4 (rendez-vous)  →  C5 (migration)
   |              |                   |                  |
   |              |                   |                  └─ requis par C5, et repli si la mesure de C3 échoue
   |              |                   └─ ONLINE_TEAM_COUNT tombe ICI, jamais avant
   |              └─ sinon un forfait accuse des joueurs honnêtes dès le 3e camp
   └─ seul lot qui lève l'obstacle de fond
```

C1 et C2 sont **indissociables d'une mise en ligne** : livrer C1 seul rendrait le FFA jouable et la
somme de contrôle menteuse. C3 est jouable dès que C1+C2 tiennent. C4 et C5 vont ensemble.

## Ce qu'on ne refait pas

Le plan 208 vient de livrer la carte en modale et le bandeau de partie. Rien ici n'y revient, à une
exception : la ligne « Format » du bandeau redevient un vrai choix (Lot C3).

Le moteur (`packages/core`) n'est **pas** touché : `forfeit` et `checkVictory` sont déjà corrects à N
camps. Tout le travail est dans `packages/network`, `packages/view-core` et `packages/app`.

## Ce que ce plan ne traite pas, et qui est réel

Relevé au cadrage par `game-designer`, **hors périmètre parce que déjà vrai en local** — le plan 209
ne fait que l'exposer entre humains :

- **Le joueur éliminé n'est prévenu de rien.** À 12 camps, son camp tombe et le combat continue sans
  lui : même écran, aucun message, aucune consigne. Le moteur est correct (`checkVictory` ne conclut
  qu'à un survivant), c'est l'interface qui se tait — il n'existe aucune clé i18n entre « abandon » et
  « fin de partie ». Déjà vrai en hot-seat, mais l'isolement en ligne le rend plus dur : personne dans
  la pièce pour dire « tu peux partir ». → backlog.
- **L'attente pendant les tours distants est passive.** Rien n'est offert au joueur qui regarde onze
  adversaires jouer : le rendu est le même que pour une IA en solo. → backlog UX, pas ce plan.
- **Le ciblage ne corrige pas le tir groupé.** L'IA traite tout camp adverse à égalité, sans
  pondération pour celui qui mène ni protection du plus faible. En FFA, la dynamique classique est que
  tout le monde tape le premier qui dépasse. Aucune décision ne tranche si c'est voulu ou subi. Vrai
  depuis que les formats à N camps existent en solo. → à trancher avec l'humain, hors protocole.

## Questions restées ouvertes

- Le délai au bout duquel le resync en filet se déclenche (Lot C1, point 4) — à régler à
  l'implémentation, une fois le tampon observé en vrai.
- Le relais étoile : dedans ou pas, selon la mesure du maillage à 12 (Lot C3).
- La forme du seuil d'absence proportionnel (Lot C3, point 7) : trois tours **de son propre camp**
  rapportés à la cadence réelle, ou un plafond en secondes indépendant du format ? À trancher sur la
  mesure de cadence, pas avant.
