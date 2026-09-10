# Plan 204 — Télémétrie : une partie en ligne compte pour une

> **Statut** : done — livré le 2026-09-10. Les 5 étapes sont codées, l'e2e à deux contextes couvre
> le partage de l'identifiant (§11.1 (e), rouge-vert sur deux sabotages), et la revue de code a été
> traitée : quatre défauts moyens corrigés dont deux bugs réels (D3 que le code ne tenait pas, et
> l'identifiant qui survivait à un rejeu), plus une limite écrite. Décisions #983 à #989.
>
> **Hors phase.** La Phase 7 est close (plan-cadre 195 `done`). Ce plan solde les **deux dettes
> nommées comme bloquantes pour la Phase 8** (équilibrage) :
> `backlog-telemetrie-double-comptage-parties-en-ligne` et `backlog-endreason-non-agrege-worker`.
> Première session de la file `agenda-2026-09-10-file-de-sessions-dediees`.

## Motivation

Le Lot A a livré une télémétrie dont la raison d'être est de nourrir l'équilibrage de la Phase 8. En
ligne, elle compte faux.

Les deux pairs d'une partie en ligne émettent chacun leur `battle_started` puis leur `battle_ended`,
avec un `battleId` **tiré localement** (`createBattleId()`, `packages/app/src/analytics/telemetry.ts:490`).
Rien, à la lecture, ne dit que ces deux lignes sont la même partie.

### Ce que le backlog sous-estimait

Il ne nomme que `battlesByMode`. La lecture de `report.ts` (2026-09-10) montre que **tout ce qui se
compte par partie** est doublé pour une partie en ligne :

| Doublé | Juste |
|---|---|
| `battlesStarted`, `battlesEnded` | `teams[]` — chacun déclare son camp |
| `battlesByMap`, `battlesByFormat`, `battlesByMode` | |
| la série journalière (`started`, `ended`) | |
| `turnsTotal`, `durationTotal` → les deux moyennes | |
| `abandonRate` (dérivé des deux compteurs) | |
| `movesCast`, `knockOutCauses` | |

`teams[]` est juste **par construction** : `buildOnlineTelemetryTeams` (`team-telemetry.ts:78`) ne
déclare que notre camp, précisément pour éviter le double comptage des équipes — l'étape 7 du plan
201 avait vu le problème, mais seulement pour les équipes.

🔴 **Corollaire qui gouverne tout ce plan** : `outcomes[]` de `battle_ended` suit `trackedSides`,
donc en ligne chaque pair ne détaille **que son propre camp**. La déduplication ne peut donc pas être
« je jette la seconde ligne » — elle doit être **sélective** : ce qui compte par PARTIE une seule
fois, ce qui compte par CAMP cumulé sur les deux lignes.

### La seconde dette

`endReason` (`"combat"` / `"forfeit"`, plan 201) arrive au Worker et **rien ne l'agrège**. Il existe
pour rattraper un invariant que le forfait a cassé : l'abandon se mesurait par l'ABSENCE de
`battle_ended`, or un forfait en émet un. Sans agrégation, la Phase 8 comptera comme décisives des
parties qui ne se sont pas jouées jusqu'au bout.

## Décisions de cadrage (2026-09-10)

**D1 — Le `battleId` voyage dans le message `start`, tiré par l'hôte.** Les deux pairs émettent avec
le même identifiant, et `report.ts` déduplique à la lecture.

Écarté : « seul l'hôte émet, et il déclare les deux camps ». Le `start` porte bien la sélection de
chaque place, mais pas le `TeamSource` ni le drapeau `generated` (qui se lit du *nom* de l'équipe
sauvegardée, lequel ne voyage pas) — on perdrait la provenance réelle du camp invité. Et un hôte
dont la télémétrie ne part pas (bloqueur, onglet tué) ferait disparaître la partie **entière** au
lieu de la laisser à moitié vue. L'option retenue garde l'invariant « chacun déclare son camp », déjà
écrit et testé, et rapproche les deux `battle_ended` du même match — ce que le backlog notait comme
son avantage propre.

**D2 — `endReason` : compteur agrégé + affichage, moyennes inchangées.** Tranché par Claude, l'humain
s'en remettant au jugement. `averageTurns` et `averageDurationMs` sont publiés depuis le 2026-09-02 :
en changer la définition maintenant casse la série sans que personne l'ait demandé. Le compteur donne
à la Phase 8 de quoi filtrer, et le jour où elle voudra des moyennes hors forfait, la donnée sera là.

**D3 — La déduplication ne s'applique qu'aux parties `online`, et le mode se lit sur la LIGNE.**

> ⚠️ **Amendement du 2026-09-10, trouvé en revue de code** : la première rédaction de ce point
> disait « une partie locale n'est jamais candidate, quelle que soit la collision », et le code ne
> le tenait pas. Il testait l'appartenance de l'IDENTIFIANT au monde en ligne, jamais le mode de la
> ligne courante : une ligne locale entrait quand même dans l'ensemble, donc une partie locale
> collisionnant avec une partie en ligne pouvait être effacée — le mode d'échec même que ce point
> veut éviter. Corrigé en lisant `payload.mode` sur la ligne. Ce qui reste vrai : un
> `battle_started` local n'est jamais candidat. Ce qui ne l'est pas : un `battle_ended` local qui
> collisionnerait avec un identifiant en ligne reste exposé, faute de `mode` dans son payload.

Le motif : `createBattleId()` rend 8 caractères hexadécimaux, soit 32 bits. Deux parties **sans
aucun rapport** peuvent donc porter le même identifiant (collision d'anniversaire vers ~65 000
parties, loin devant nous, mais le mode d'échec serait une vraie partie effacée du relevé sans une
ligne d'erreur). On ne déduplique que ce qu'un `battle_started` a explicitement rangé en
`mode: "online"`.

**D4 — L'historique n'est pas réécrit.** Les parties en ligne déjà en base portent deux identifiants
distincts et resteront comptées double. Le schéma est « événement brut, agrégation à la lecture » et
rien ne réécrit le passé. À dire dans le relevé plutôt qu'à corriger.

**D5 — L'agrégation se fait en DEUX PASSES, pas en une.** Trouvé à la revue du plan, et c'était un
défaut de la règle telle qu'elle était écrite. Un ensemble unique d'identifiants, alimenté par les
`battle_started`, aurait fait sauter aussi le **premier** `battle_ended` de chaque partie en ligne —
son identifiant y figurant déjà. `battlesEnded` serait tombé à zéro pour toutes les parties en
ligne, et `abandonRate` à 100 %, sans une ligne d'erreur.

Donc : **passe 1** sur les seuls `battle_started`, qui construit l'ensemble des identifiants rangés
en `mode: "online"` ; **passe 2**, l'agrégation, avec **deux** ensembles « déjà compté » distincts,
un par genre d'événement. Bénéfice de bord : l'ordre d'arrivée devient sans objet. Les deux
consommateurs lisent pourtant en `ORDER BY id` (`dashboard.ts:94`, `telemetry-stats.ts:204`), mais
l'ordre d'insertion serveur n'est pas l'ordre logique — le `battle_ended` d'un pair peut précéder le
`battle_started` de l'autre, et une règle en une passe en dépendrait silencieusement.

## Étapes

### 1. `battleId` dans le protocole (`packages/network`)

- `StartMessage` gagne `battleId: string` (`protocol.ts`), **champ propre, à côté de `seeds`** — pas
  un quatrième membre de `NetworkSeeds`, qui est un triplet de graines aléatoires et rien d'autre.
- Validateur `start` : `typeof message.battleId === "string"` et non vide.
- `NETWORK_VERSION` **4 → 5**. C'est un champ requis d'un message existant : un pair en version 4
  n'a pas d'identifiant à donner, et le handshake doit le refuser plutôt que de laisser une partie
  se lancer à moitié instrumentée.
- `Room.launch()` passe de `(seeds: NetworkSeeds)` à `(seeds: NetworkSeeds, battleId: string)` et
  pose le champ dans le `start`. Deux arguments plutôt qu'un objet : la méthode n'en a qu'un
  aujourd'hui, et le paquet `network` n'a pas à connaître le mot « télémétrie » — pour lui c'est un
  identifiant opaque qu'il transporte.

### 2. L'identifiant traverse jusqu'à la télémétrie (`packages/app`)

- `CombatSetup` gagne `battleId?: string` — absent en local, comme `seeds` et `localSeat`.
- `team-select-screen.ts`, **quatre points nommés** parce que c'est là que le champ se perdrait :
  1. `onNetworkLaunch()` (~l.171) — l'hôte appelle `createBattleId()` juste avant `room.launch()`,
     à côté des trois `freshSeed()`, et passe le résultat en second argument.
  2. Le même hôte le pose dans le setup qu'il monte pour lui-même.
  3. `enterNetworkBattle()` (~l.256-281) — l'invité le lit de `start.battleId` et le pose dans le
     setup, à côté de `seeds: start.seeds`.
  4. `combat-screen.ts` (~l.291) — l'appel à `beginBattleTelemetry()` le transmet, **en spread
     conditionnel** sur le modèle de `localSeat` : `...(setup.battleId === undefined ? {} : { battleId: setup.battleId })`.
- `beginBattleTelemetry()` accepte un `battleId` fourni et ne tire le sien que s'il n'en reçoit pas.
- ⚠️ **Passe-plat à ne pas rejouer** : la décision #979 a montré que `runBattle` jette en silence
  tout champ du setup qu'il ne redéclare pas dans ses options, et que TypeScript ne peut pas le voir
  quand l'objet est bâti par des `...` conditionnels — c'est exactement la forme employée au point 4
  ci-dessus. Suivre le champ de bout en bout à l'exécution, pas seulement à la compilation.

### 3. Déduplication sélective (`packages/telemetry-worker/src/report.ts`)

Deux passes (D5). **Passe 1** : parcourir les `battle_started` et retenir les `battleId` dont le
payload porte `mode: "online"` (`BattleStartedPayload.mode` existe, `report.ts:68`). **Passe 2** :
l'agrégation actuelle, avec deux ensembles « déjà compté » **distincts** — un pour les `started`, un
pour les `ended`. Un `battleId` absent de l'ensemble `online` n'est jamais dédupliqué, quoi qu'il
arrive (D3).

- `battle_started` `online` **déjà compté** → on saute `battlesStarted`, la série, `battlesByMap`,
  `battlesByFormat`, `battlesByMode`. On traite **toujours** `teams[]`, sur les deux lignes : chaque
  pair n'y déclare que son propre camp, donc les cumuler est ce qui reconstitue la partie complète.
  Ne pas les cumuler perdrait la moitié des compositions des statistiques d'usage.
- `battle_ended` dont le `battleId` est `online` et **déjà compté** → on saute `battlesEnded`, la
  série, `turnsTotal`, `durationTotal`. On traite **toujours** `outcomes[]`, sur les deux lignes,
  pour la même raison (`outcomes` suit `trackedSides`, donc un camp par pair).
- La première ligne `ended` vue donne la durée et le nombre de tours : chaque pair mesure sa propre
  durée depuis son propre `startedAt`, aucune n'est plus vraie que l'autre. On ne moyenne pas — une
  moyenne de deux mesures du même phénomène n'apporte rien et rendrait le résultat dépendant de la
  présence des deux lignes.
- Portée des ensembles : la durée de l'appel. `buildReport(rows, days)` est une fonction pure sur un
  tableau de lignes, il n'y a rien à purger ni à faire vivre entre deux appels.

### 4. Agrégation de `endReason` (`report.ts` + `dashboard.ts`)

- `battlesByEndReason: Record<string, number>` dans le rapport, alimenté par `battle_ended`, une fois
  par partie (donc sous la même règle de déduplication que l'étape 3).
- Les lignes sans `endReason` (antérieures au plan 201) tombent dans une clé explicite plutôt que
  d'être ignorées : leur nombre est lui-même une information sur la profondeur de l'historique.
- Affichage sur la page `/tableau` : un `block("Fins de partie", …)` dans la colonne **Usage**,
  **après « Modes »** — même forme que ses voisins (`htmlBars` + table de libellés français, sur le
  modèle de `MODE_LABELS` / `CAUSE_LABELS`). Et dans le rapport terminal de `pnpm stats`.
- Une **légende au pied du rail « Abandon »**, sur le modèle de celle des visiteurs uniques déjà
  présente en pied de page : dire que « Abandon » mesure l'absence totale de `battle_ended`, et que
  les forfaits comptent donc parmi les parties finies. Suggestion de `game-designer` : le rail est
  affiché sans réserve depuis le 2026-09-02 et se lit spontanément comme un taux de départ en
  cours de partie, ce qu'il n'est pas. Changement d'affichage seul, aucune métrique touchée.
- `abandonRate`, `averageTurns`, `averageDurationMs` : **inchangés** (D2).

### 5. Tests

- `protocol.test.ts` — le `start` sans `battleId` est refusé ; version 5 au handshake.
- `report.test.ts` — deux paires de lignes `online` de même `battleId` donnent **une** partie, **deux**
  camps, et les moyennes d'une seule partie ; deux parties **locales** de même identifiant (D3)
  restent **deux** parties ; `battlesByEndReason` compte une fois par partie et range les lignes sans
  `endReason`.
- `report.test.ts`, **le cas qui aurait attrapé le défaut de D5** : une partie en ligne complète
  donne `battlesEnded === 1`, jamais 0. Écrire ce test AVANT le correctif et le voir rouge — la
  règle en une passe le rendait rouge, et rien d'autre dans la suite ne l'aurait signalé.
- `report.test.ts`, ordre : les mêmes quatre lignes mélangées (`ended` d'un pair avant le `started`
  de l'autre) donnent le même rapport. C'est ce que les deux passes garantissent.
- `room.integration.test.ts` — l'identifiant de l'hôte arrive chez l'invité.
- e2e famille `online` — l'identifiant est le même des deux côtés. À écrire par `test-writer`, qui
  maintient aussi le cahier de recette.

## Critères d'acceptation

1. Une partie en ligne complète produit **une** partie dans le relevé, avec les **deux** camps et
   leurs compositions.
2. Les Pokemon et attaques des deux camps figurent aux statistiques d'usage — rien n'a été perdu en
   déduplicant.
3. Deux parties **locales** qui porteraient le même `battleId` restent deux parties.
4. Un pair en `NETWORK_VERSION` 4 est refusé au handshake, avec le message symétrique existant.
5. `battlesByEndReason` distingue combat, forfait et les lignes d'avant le plan 201, et s'affiche sur
   `/tableau` comme dans `pnpm stats`.
6. Gate `full` vert.

## Ce que ce plan ne fait pas

- **Il ne corrige pas l'historique** (D4) : les parties en ligne déjà en base restent doublées.
- **Il ne touche pas au taux d'abandon.** Un forfait émet `battle_ended`, donc ne compte pas comme
  abandon, alors que la partie ne s'est pas jouée jusqu'au bout. C'est un vrai sujet — mais c'est la
  Phase 8 qui doit dire ce qu'elle veut compter, avec la donnée que ce plan lui donne.
- **Il ne mesure rien de neuf.** Aucun événement, aucun champ de payload en plus de `battleId` :
  seulement compter juste ce qui est déjà collecté.
- 🔴 **Il ne donne pas de taux de victoire par espèce, ni de matchup** — et c'est le manque le plus
  gros pour la Phase 8, relevé par `game-designer`. La jointure est théoriquement possible
  (`teams[].side` + `winnerSide` + `battleId`), mais `MemberOutcomePayload` ne porte **ni `side` ni
  lien au vainqueur** : aujourd'hui `speciesUsage` ne mesure que la PRÉSENCE d'un Pokemon dans une
  équipe, jamais l'issue de sa partie. On ne peut donc pas dire « Florizarre gagne moins souvent
  contre les vols ». Hors périmètre ici parce que ce n'est pas un ajout à peu de frais — la
  cardinalité matchup × espèce et le traitement des équipes à plusieurs Pokemon sont un sujet de
  conception en soi. **À cadrer en tête de la Phase 8**, pas à redécouvrir sur place.
- **Il n'authentifie pas les événements.** N'importe qui peut poster au Worker un `battleId`
  inventé. Signer (HMAC ou autre) serait disproportionné au trafic — relevé par `best-practices`,
  écarté sauf abus constaté.
- 🔴 **Il ne reconnaît pas une partie à cheval sur la borne de la fenêtre.** L'ensemble des
  identifiants en ligne ne se peuple que depuis les `battle_started`, et les deux consommateurs
  bornent leur requête à N jours : une partie dont les départs tombent avant la borne et les fins
  dedans voit ses deux fins comptées double, et `abandonRate` peut passer négatif puisque
  `battlesStarted` n'a rien vu. Irréparable sans ajouter `mode` à `BattleEndedPayload`, ce que ce
  plan s'interdit. Relevé en revue de code, écrit dans `report.ts` au-dessus de la passe 1.
- **Il n'ajoute pas d'identifiant par ÉVÉNEMENT** (style `$insert_id`). Il n'en faut pas : `send()`
  (`telemetry.ts:334-352`) est du fire-and-forget strict — `sendBeacon`, et un seul `fetch
  keepalive` en repli si la mise en file échoue, dont le rejet est avalé. **Aucun réessai nulle
  part**, donc aucun risque qu'un pair livre deux fois son propre événement. 🔴 Le jour où quelqu'un
  ajoute un réessai à `send()`, il lui faudra un identifiant par événement : la déduplication de ce
  plan est par PARTIE et ne verrait pas le doublon.

## Revue de code (2026-09-10, après implémentation)

Aucun bloquant. Le cœur de la règle — deux ensembles distincts, frontière partie/camp, indépendance
à l'ordre — a été confirmé juste, y compris sur les cas creusés que le plan n'avait pas prévus
(trois lignes du même identifiant, identifiant présent chez un seul pair, reconnexion qui réémet).

Quatre défauts moyens, tous traités :

1. **D3 que le code ne tenait pas** — corrigé, plus le test qui manquait (mélange des modes sur un
   même identifiant ; l'ancien test ne mélangeait pas les modes, donc ne l'attrapait pas). Rouge
   vérifié.
2. **`"online"` devenu un littéral porteur de comportement**, recopié entre deux paquets sans garde
   — nommé `ONLINE_MODE` et couvert par un test de parité contre `modeOf()`, sur le modèle de celui
   des noms de cartes. Le renommer d'un seul côté aurait fait cesser la déduplication en silence.
3. **L'identifiant survivait à un rejeu** — donc la partie rejouée était avalée comme un doublon de
   la précédente : ni départ, ni fin, ni durée. `setupForReplay()` le retire aux deux points de
   remontage (`combat-screen.ts`). Jamais atteignable en recette : il faut rejouer une partie en
   ligne pour le voir.
4. **La limite de la borne de fenêtre** — écrite, pas corrigée (voir ci-dessus).

🔴 **Bug PRÉ-EXISTANT signalé au passage, hors périmètre** : « Recommencer » du menu de combat
(`combat-menu.ts:164`) est offert **sans condition**, y compris en ligne, et remonte le setup en
local — donc un hot-seat sur les deux camps avec le salon toujours tenu. Le dialogue de victoire,
lui, est gardé (`canReplay: localPlayerIds === undefined`). C'est exactement ce que la revue du plan
201 avait voulu empêcher, mais d'un seul côté. À trancher avec l'humain.

## Revues

Relu le 2026-09-10 par trois agents, avant exécution.

- **`plan-reviewer`** — a fait apparaître le défaut devenu D5 (en creusant l'ordre d'arrivée), la
  signature de `Room.launch()` laissée implicite, les quatre points de pose du champ à l'étape 2, et
  l'emplacement non dit sur `/tableau`. Trois de ses doutes sont infirmés par le code et n'ont rien
  changé : `mode` est bien dans `BattleStartedPayload` (`report.ts:68`), les lignes sont bien lues
  en `ORDER BY id`, et la purge des ensembles est un non-sujet (`buildReport` est pure).
- **`game-designer`** — D2 confirmée, avec un motif que le plan n'avait pas : `buildReport` prend
  les lignes brutes, donc la Phase 8 filtrera les forfaits **en amont** de l'appel sans réécrire
  l'agrégation. A fait ajouter le manque « victoire par espèce » ci-dessus et la légende du rail
  « Abandon » (étape 4).
- **`best-practices`** — approche D1 conforme au pattern usuel (identifiant canonique émis par une
  autorité unique + déduplication à l'agrégation : `$insert_id` de Mixpanel, `session.id`
  d'OpenTelemetry) ; notre hôte tient le rôle qu'un serveur tiendrait ailleurs. A confirmé les
  32 bits comme suffisants **et** redressé le motif : l'entropie n'a rien à voir avec la vie privée,
  qui tient à l'éphémérité et à l'absence de lien à une identité — élargir l'identifiant
  n'apporterait aucune protection. A soulevé le réessai et l'authentification, tous deux traités
  ci-dessus.
