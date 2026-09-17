# Plan 214 — Le niveau de l'IA, choisi place par place

**Statut** : draft
**Ouvert le** : 2026-09-16, sur choix de l'humain au démarrage de session (domaine « Le solo »)
**Bloque la release ?** : non — la `v2026.9.1` est publiée, rien n'attend ce plan
**Taille** : petit à moyen — le cœur existe déjà, tout le travail est de l'exposer

## Pourquoi ce plan existe

Le chiffre qui a ouvert le domaine « Le solo » : **21 parties sur 22 se jouent contre l'IA**
(plan 212). Le mode réellement joué est le solo, et il n'offre **aucun réglage**.

Et un constat fait en ouvrant le code, qui n'était écrit nulle part :

> 🔴 **La vraie partie est câblée en dur sur `EASY_PROFILE`.**
> `combat-screen.ts:1224`, dans `wireScoredAi` — la fonction qui sert **le solo comme les places IA
> en ligne**. Les profils `MEDIUM_PROFILE` et `HARD_PROFILE` existent depuis le plan 029, sont
> testés et documentés (`docs/ai-system.md` §189), et ne sont atteignables que par le **studio
> sandbox**. Personne n'a jamais joué contre eux dans le jeu.

Les 22 parties mesurées se sont donc toutes jouées contre **l'IA la plus faible des trois** : celle
qui pioche un coup sous-optimal 40 % du temps dans son top 3. À poser à côté des 77 % d'abandon
**sans en conclure quoi que ce soit** — on n'a pas la donnée qui le dirait, et `battle_abandoned`
vient tout juste d'entrer en production.

⚠️ **Ce plan ne touche pas au scoring.** Il n'ajoute pas un niveau, n'en retouche pas les poids, ne
rééquilibre rien. Il branche un choix sur trois profils qui existent. Toute envie de retoucher les
poids est un autre sujet, et elle attend du volume (décision #1074).

## Ce que l'humain a tranché

| Question | Réponse | Conséquence |
|---|---|---|
| Où se choisit la difficulté ? | **Par place** | Le sélecteur `Humain / IA` de l'écran de sélection d'équipe passe à **quatre** valeurs |
| Quel niveau par défaut ? | **Moyenne** | Change le comportement livré : on quitte Facile |
| Le solo seulement ? | **Non** — « ya pas que le solo, ya le niveau de l'IA en multi aussi » | Les places IA d'une partie en ligne se règlent pareil, donc la valeur traverse le réseau |

Le choix « par place » a été retenu contre un réglage global parce qu'il **couvre les deux cas d'un
seul mécanisme** : la place est déjà l'unité qui porte `controller`, en solo comme en ligne, et elle
traverse déjà le réseau. Un réglage global aurait quand même dû être partagé en ligne — donc le même
travail réseau, plus un deuxième endroit où regarder quand l'IA ne joue pas comme attendu.

## Ce que valent réellement les trois niveaux (`game-designer`, 2026-09-16)

`pickScoredAction` trie les actions par score, garde les `topN` viables, puis : si `randomWeight <= 0`
prend toujours le rang 1 ; sinon, avec probabilité `randomWeight`, tire **uniformément** un rang parmi
les `topN`. D'où :

| Profil | P(coup optimal) | P(rang 2) | P(rang 3) |
|---|---|---|---|
| Facile | **73,3 %** | 13,3 % | 13,3 % |
| Moyenne | **92,5 %** | 7,5 % | — |
| Difficile | **100 %** | — | — |

**Facile → Moyenne est un vrai palier, net sans être brutal.** Facile joue non-optimal plus d'une
action sur quatre, et un tiers de ces ratés descend au **rang 3** — le candidat le plus faible retenu,
celui qui peut être visiblement absurde. Moyenne divise cette fréquence par ~3,6 et **ne descend
jamais sous le rang 2**, donc jamais le pire choix. Les poids de scoring étant identiques, le joueur
sentira une IA **plus fiable**, pas plus maligne.

🔴 **Moyenne → Difficile risque d'être indistinct, et il faut le savoir avant de dessiner
l'interface.** `killPotential` reste à **10 sur les trois profils** et domine le score dès qu'un KO ou
un gros dégât est en jeu ; les poids relevés de Difficile (`typeAdvantage` 3→5, `positioning` 2→3,
`statChanges` 1→2) ne changent le classement que sur des **choix serrés sans KO évident**. Sur un
combat ordinaire, les deux se ressembleront. Verdict du `game-designer` : deux paliers nettement
sentis (Facile / le reste) **plus une nuance fine**, pas trois paliers équidistants.

Ce que ça change pour le Lot B : on présente quand même les trois — ils existent, ils sont réellement
différents, et on ne retouche pas les poids (hors périmètre, décision #1074). Mais **on n'écrit pas de
libellé qui promette trois écarts égaux**. Un joueur qui ne sent pas la différence entre Moyenne et
Difficile fait une remarque prévisible, pas un rapport de bug.

## Ce qui existe, et sur quoi on se branche

| Élément | Où | État |
|---|---|---|
| `AiDifficulty` = `easy \| medium \| hard` | `core/src/enums/ai-difficulty.ts` | ✅ existe |
| `EASY_PROFILE`, `MEDIUM_PROFILE`, `HARD_PROFILE` | `core/src/ai/ai-profiles.ts` | ✅ existent, exportés par `core/src/index.ts` |
| Pipeline de scoring **commun à tous les niveaux** | `docs/ai-system.md` §25, §220 | ✅ rien à faire |
| `TeamSelection.controller: PlayerController` | `core/src/types/team-selection.ts` | le porteur naturel du nouveau champ |
| `wireScoredAi(...)` → `EASY_PROFILE` en dur | `app/src/babylon/combat-screen.ts:1224` | 🔴 le point à corriger |
| `profileForKey` (clé → profil) | `app/src/babylon/combat-screen.ts:1608` | ✅ existe, écrit pour le sandbox — à remonter et réutiliser |
| Sélecteur `Humain / IA` par place | `app/src/ui/team-select/PlayerCell.ts:246` | boucle sur 2 valeurs, à ouvrir |
| `StartSeat.controller` (le `start` grave chaque place) | `network/src/protocol.ts:332` | le porteur réseau |
| `NetworkSeatState.occupancy` (la place vue par tous, en direct) | `network/src/protocol.ts:187` | pour que le salon **montre** le niveau avant le lancement |
| `NETWORK_VERSION` | `network/src/protocol.ts:74` | **11 → 12** |

## Ce qu'on ne fait pas

- **Pas de quatrième niveau**, pas de « Auto passif » ni de « Joueur » : ce sont des outils du studio
  sandbox (décision #699), pas des choix de joueur.
- **Pas de retouche des poids de scoring.** Voir l'avertissement plus haut.
- **Pas de difficulté par Pokemon**, ni qui monte en cours de partie.
- **Pas de réglage global** dans Paramètres — arbitré ci-dessus.

---

## Lot A — Le niveau descend jusqu'au contrôleur

**But** : que `wireScoredAi` cesse de décider à la place de l'appelant.

1. `core/src/types/team-selection.ts` — ajouter `aiDifficulty?: AiDifficulty` à `TeamSelection`.
   Optionnel, et c'est voulu : une place humaine n'en a pas, et les sauvegardes d'avant ce plan n'en
   portent pas.
2. Remonter la table `AI_PROFILE_BY_KEY` / `profileForKey` de `combat-screen.ts:1602` vers le core,
   à côté des profils qu'elle indexe — c'est une propriété des profils, pas de l'écran de combat.
   Elle y devient **`profileForDifficulty(difficulty: AiDifficulty): AiProfile`**, une fonction
   **totale** : pas de paramètre optionnel, pas de repli interne.
3. 🔴 **Il existe DÉJÀ deux défauts divergents dans le code, et le plan doit trancher lequel gagne.**

   | Chemin | Défaut actuel |
   |---|---|
   | Le jeu — `wireScoredAi:1224` | `EASY_PROFILE`, en dur, aucun choix possible |
   | Le studio sandbox — `profileForKey:1609` | `AI_PROFILE_BY_KEY[key ?? "hard"]`, donc **Difficile** |

   Deux valeurs différentes pour la même question. C'est exactement la forme de bug qu'on vient
   corriger, et la remontée au core la ferait disparaître par accident si on ne la nomme pas.

   **Ce qu'on fait** : `DEFAULT_AI_DIFFICULTY = AiDifficulty.Medium`, **une constante, dans le core**,
   appliquée en **un seul point** — la normalisation d'une `TeamSelection` sans le champ. Le sandbox
   garde son `?? "hard"` **au site d'appel**, en argument explicite : c'est un outil de développement
   avec son propre contrat, et un argument passé n'est pas un repli caché.

   Pourquoi cette rigueur : en ligne, une divergence de défaut entre deux pairs donne **deux IA
   différentes sans erreur et sans trace** — la classe de bug que le `throw` de `wireScoredAi:1217` a
   été écrit pour attraper.
4. Exporter `AiProfile` (le type) du barrel du core : `packages/core/src/types/ai-profile.ts` n'est
   pas ré-exporté aujourd'hui, et la signature publique de `profileForDifficulty` en a besoin.
   ✅ `AiDifficulty` l'est déjà (`enums/index.ts:3` → `core/src/index.ts:150`), rien à faire.
5. `wireScoredAi` prend le profil **par place** au lieu de la constante : la boucle lit
   `placementTeams`, qu'elle reçoit déjà, et appelle
   `profileForDifficulty(team.aiDifficulty ?? DEFAULT_AI_DIFFICULTY)`. Corriger le commentaire de
   tête (« EASY AI (seeded) »), qui devient faux.
6. `buildTeamSelections` (`app/src/ui/team-select/slot-state.ts:44`) propage le champ depuis
   `SlotState`, et **garantit qu'une place IA sort toujours avec un `aiDifficulty` défini** — c'est
   la frontière entre l'état local (toujours renseigné) et le contrat sérialisé (optionnel pour
   l'ascendance).
7. **Ascendance** : une sauvegarde d'avant ce plan n'a pas le champ. Vérifier qu'une
   `TeamSelection` sans `aiDifficulty` traverse tout le chemin et atterrit sur `Moyenne`, sans
   exception ni place muette.
8. **Tests existants à reprendre** : ceux qui consomment `profileForKey` côté sandbox suivent le
   renommage ; les tests IA du core importent les profils, donc transparents. Faire le tour avant de
   déclarer le lot fini.

**Tests (Vitest, avant le code)** :
- `profileForDifficulty` rend le bon profil pour **chacune des trois valeurs** (fonction totale, il
  n'y a pas de cas `undefined` à tester — c'est le but de l'avoir rendue totale).
- Une `TeamSelection` **sans** `aiDifficulty` atterrit sur `MEDIUM_PROFILE` : le test porte sur la
  **normalisation**, seul endroit où `DEFAULT_AI_DIFFICULTY` s'applique.
- Deux places IA de niveaux différents dans la même partie reçoivent bien deux profils différents.
- `DEFAULT_AI_DIFFICULTY` vaut `Medium` — test d'une ligne, mais c'est la valeur dont tout le reste
  du plan dépend, et celle qu'une main distraite changera un jour sans voir les conséquences.

## Lot B — Le sélecteur par place

**But** : quatre valeurs là où il y en avait deux, sans casser les quatre axes d'entrée.

1. `SlotState` gagne `aiDifficulty: AiDifficulty` (toujours renseigné en mémoire, `medium` à la
   création ; c'est le champ **du contrat** qui est optionnel, pas l'état local).
2. `setSlotController(slot, controller)` (`slot-state.ts:139`) n'a **que deux paramètres** : lui
   ajouter le niveau, puis reprendre son appelant `team-select-screen.ts:602`. `PlayerCell.ts:246`
   boucle sur les quatre valeurs au lieu de deux, et `PlayerCell.ts:111` étend la table d'emoji.
3. Libellés FR : **Humain**, **IA Facile**, **IA Moyenne**, **IA Difficile**. Clés à créer dans
   **`fr.ts` et `en.ts`** : `teamSelect.controller.aiEasy`, `aiMedium`, `aiHard`.
   `teamSelect.controller.human` existe déjà (`fr.ts:182`) et ne bouge pas ;
   `teamSelect.controller.ai` (`fr.ts:183`) devient inutilisée sur cet écran — **la retirer si plus
   rien ne la lit** (zéro tolérance au code mort). ⚠️ `battle.turnOwner.ai` et
   `sandbox.dummyControl.ai` sont des usages **différents**, ne pas y toucher.
4. 🔴 **Un segment à quatre valeurs, c'est le sujet de `.claude/rules/multi-input.md`.** La rangée
   s'allonge de deux crans sur un écran déjà dense, et le plan 206 a posé le plancher de 30 px sous
   `pointer: coarse`. Passe **mesurée** obligatoire, pas supposée : clavier (atteint aux flèches
   depuis un contrôle voisin, par de vraies pressions), manette, tactile, et les cinq largeurs
   (568×320, 667×375, 1024×768, 1920×1080, 2560×1440). Précédent direct : `fix(ui): les boutons de
   combat ne rétrécissent plus sous 32 px` (8666d5e1), même écueil il y a deux commits.
5. Vérifier `packages/app/src/app/battle-persistence.ts` : une partie reprise après rechargement
   doit retrouver le niveau de chaque place, pas retomber sur le défaut.

## Lot C — En ligne

**But** : que les deux pairs montent la même IA, et que le salon le montre avant de lancer.

1. `StartSeat` gagne `aiDifficulty?: AiDifficulty`, avec son garde de forme dans le validateur
   (`isStartSeat`, à côté de `isSeat` / `isTeamSelection`).
2. `NetworkSeatState` : le niveau doit être visible **dans le salon**, pas seulement au lancement —
   sinon on découvre l'adversaire en entrant en combat. Deux formes possibles, à trancher en écrivant
   le lot : un champ `aiDifficulty` à côté d'`occupancy`, ou des variantes d'`occupancy`. **Le champ
   séparé est préférable** : `occupancy` porte déjà un sens propre au réseau (`remote`, `waiting`)
   qui n'a rien à voir avec la difficulté, et les mélanger multiplierait les états par trois.
3. **Le chemin complet, bout à bout** — il manquait au plan, et c'est là que se cache la question
   « où l'hôte range-t-il le niveau ? ». Réponse : **dans l'état de place du salon**, à côté
   d'`occupancy`, donc `Room` en est le dépositaire unique.

   ```
   segment de l'écran  →  setSlotController (app)         → SlotState.aiDifficulty
                       →  Room.setSeatOccupancy (network/src/room.ts:874, DEUX paramètres
                          aujourd'hui → en accepter un troisième)
                       →  NetworkSeatState.aiDifficulty    → diffusé à tous les pairs, donc AFFICHABLE
                                                             dans le salon avant le lancement
                       →  Room.composeStartSeats (network/src/room.ts:1884)
                       →  StartSeat.aiDifficulty           → gravé dans le `start`
                       →  TeamSelection.aiDifficulty       → wireScoredAi
   ```

   `setSeatOccupancy` fait déjà `assertHost()` et refuse la place de l'hôte lui-même : **seul l'hôte
   règle les places IA**, gratuitement, comme il choisit déjà le format et compose leurs équipes.
   L'écran rend les places distantes en lecture seule.
4. Une place `waiting` qui part en IA au lancement n'a jamais été réglée par personne : elle prend
   `DEFAULT_AI_DIFFICULTY`, donc **Moyenne**. Le défaut est appliqué **dans `composeStartSeats`**,
   côté hôte, et le résultat est gravé dans le `start` — donc **les pairs reçoivent une valeur
   explicite et n'appliquent jamais de défaut eux-mêmes**. C'est ce qui rend la divergence
   impossible plutôt que simplement improbable.
5. 🔴 **`NETWORK_VERSION` 11 → 12, et en DERNIÈRE étape du lot**, une fois tous les champs propagés
   et les e2e verts. Sans ce bump, un pair d'avant ce plan ignore le champ et monte une IA **Moyenne**
   face à un pair qui en attend une Difficile : deux moteurs divergents, aucun message d'erreur.
   C'est précisément ce que `NETWORK_VERSION` existe pour refuser. Le poser trop tôt casse la recette
   en cascade pendant qu'on code le reste du lot.

**Tests e2e (harness Playwright, deux vrais pairs)** — dans la famille `online`, sur le modèle des
§11.11 à §11.16 du plan 211 : l'hôte règle une place IA sur Difficile, le pair distant **le voit dans
le salon**, et après le `start` les deux pairs jouent la même partie sans divergence.

## Lot D — Télémétrie, doc, recette

1. **Télémétrie** : joindre le niveau choisi à l'événement de début de partie
   (`analytics/team-telemetry.ts:127`, où `countControllers` compte déjà humains et IA). ⚠️ Vérifier
   d'abord **ce que reçoit réellement cette fonction** — elle prend une liste de
   `{ controller }`, pas forcément les `TeamSelection` complètes ; si le niveau n'y est pas, c'est
   son contrat d'appel qu'il faut élargir, pas un champ à bricoler en aval. C'est de
   l'information **gratuite** et elle répond à une question qu'on se posera : quand on relira
   `battle_abandoned`, on voudra savoir si on abandonne plus contre Difficile. Sans ce champ, la
   lecture ne le dira pas, et il sera trop tard.
2. `docs/ai-system.md` : §189 décrit les trois niveaux comme s'ils étaient joignables — c'était faux.
   Dire où le choix se fait, et que le défaut est Moyenne.
3. `docs/roadmap.md` : cocher « Choisir le niveau de l'IA » dans « Le solo ».
4. `docs/multiplayer.md` : le bump `NETWORK_VERSION` et le nouveau champ de place.
5. Graphe de mémoire (`doc-keeper`) : les décisions du plan, dont **le câblage en dur sur
   `EASY_PROFILE`** — c'est le fait le plus utile à retrouver dans six mois, et il n'était écrit
   nulle part. ⚠️ La capacité d'écriture au graphe de `doc-keeper` vient d'être réparée
   (décision #1080) et **n'a jamais été éprouvée** : vérifier qu'il a bien écrit, ne pas le supposer.
6. Cahier de recette (graphe, entités `recette`) : le tour des quatre valeurs du sélecteur.

---

## Ordre et risques

`A → B → C → D`. A est autonome et testable seul. B rend le choix atteignable en solo — livrable
utile même si C attend. C est le seul lot qui touche au réseau.

| Risque | Parade |
|---|---|
| 🔴 Défaut divergent entre deux pairs → deux IA différentes, sans erreur | Défaut à **un seul endroit** (Lot A.3) + bump `NETWORK_VERSION` (Lot C.4) |
| Le segment à 4 valeurs casse le tactile ou le clavier | Passe multi-entrée **mesurée** avant de faire tester (Lot B.4) |
| Le défaut passe de Facile à Moyenne : le jeu livré devient plus dur | Assumé, c'est le choix de l'humain. **Critère de sortie** ci-dessous |
| Moyenne et Difficile perçus comme identiques | Connu et accepté (section « Ce que valent réellement les trois niveaux »). Pas de libellé promettant trois écarts égaux |
| Une sauvegarde d'avant ce plan n'a pas le champ | `aiDifficulty` optionnel → défaut Moyenne, la partie reprend |

## 🔴 Ce que la MESURE a révélé, et qui change la portée du plan (2026-09-17)

Le plan disait « on ne touche pas au scoring, on branche un choix sur trois profils qui existent ».
**Cette prémisse était fausse, et c'est l'humain qui l'a fait tomber** en jouant une partie Facile
contre Difficile, même équipe des deux côtés : elle ne s'est jamais terminée.

Un banc de mesure a été écrit pour trancher — `scripts/ai-bench.ts`, `pnpm ai:bench [N]`. **480
parties, IA contre IA**, six affrontements, deux conditions.

### Résultat 1 — les trois niveaux sont cosmétiques

La colonne qui compte n'est pas le taux de victoire, c'est la **marge** : combien de Pokemon le
gagnant a encore debout sur 6.

| Affrontement (équipes différentes) | Victoires | Survivants du gagnant | 6-0 |
|---|---|---|---|
| Facile / Moyenne | 16-24 | **3,2**/6 | 3 / 40 |
| Facile / Difficile | 16-22 | **3,3**/6 | 3 / 38 |
| Moyenne / Difficile | 20-20 | **3,4**/6 | 2 / 40 |
| Facile / Facile | 20-20 | **3,2**/6 | 3 / 40 |
| Difficile / Difficile | 19-19 | **3,5**/6 | 1 / 38 |

**La marge ne dépend pas du niveau.** Difficile qui bat Facile finit à 3,3 survivants ; Facile qui bat
Facile, à 3,2. Sur ~38 parties l'incertitude est de ±0,3 : ces chiffres sont le même chiffre.
L'attente de l'humain — « Facile contre Difficile, ça doit être presque tout le temps 6-0 » — est
démentie : **3 fois sur 38**, et **0 fois sur 34** en miroir.

Lecture de la cause : `killPotential` vaut **10 pour les trois profils** et écrase tout. Les poids que
Difficile relève (type 3→5, position 2→3, stats 1→2) ne départagent que des choix déjà serrés. Le seul
levier réel — `randomWeight` / `topN` — ne change QUE lequel des 2-3 meilleurs candidats on prend, or
ils se valent presque toujours. D'où : même IA, trois étiquettes.

### Résultat 2 — le statu quo, et il est fréquent

| Miroir (équipes identiques) | Jamais finies |
|---|---|
| Facile / Moyenne | 4 / 40 |
| Facile / Difficile | 6 / 40 |
| Moyenne / Difficile | 7 / 40 |
| **Difficile / Difficile** | **8 / 40** |

Contre 0 à 2 sur 40 à équipes différentes. **C'est le miroir qui déclenche**, et c'est exactement la
partie qu'a jouée l'humain. Mécanisme observé en direct : `Racaillou`, `Def 120 ➜ 480` (+6, le
plafond), tout le monde à 100 % de PV. Les paliers atteignent **+6 dans les six affrontements**, y
compris Facile contre Facile — ce n'est donc pas un travers de Difficile, c'est le scorer qui
surévalue les montées de stats en général.

Le moteur n'a **aucune limite de tours** : le match nul ne couvre que les K.O. simultanés (plan 191).
Rien n'arrête une partie qui tourne en rond.

### Ce que l'humain a tranché là-dessus

| Question | Réponse |
|---|---|
| Limite de tours, ou corriger l'IA ? | **Corriger l'IA** — « on peut pas faire en sorte que les IA ne tournent pas en boucle plutôt ? ». Plus un filet anti-répétition : **les deux**. |
| Où traiter ? | **Dans le plan 214**, pas dans un plan à part. |
| Pistes retenues pour Difficile | **Les quatre** : préserver ses Pokemon, anticiper le tour d'après, concentrer le feu, et revoir les poids. |
| Avant de coder | **Session de recherche web** — bonnes pratiques, papiers, jeux similaires, projets indés et ROM hacks Pokemon. |

⚠️ **La ligne « ce plan ne touche pas au scoring » plus haut est donc CADUQUE.** Elle est conservée
telle quelle pour que l'on voie ce qui a été cru au départ, et ce que la mesure a corrigé.

---

## Ce que la RECHERCHE a dit (agent `best-practices`, 2026-09-17)

Demandée par l'humain avant de coder. Elle a **contredit une des quatre pistes retenues**, ce qui est
exactement ce à quoi elle servait.

### 🔴 « Anticiper le tour d'après » est écarté

Dans le genre tactique de référence, **aucun jeu n'utilise de minimax ou de MCTS multi-coups pour
l'IA ennemie en jeu réel**, malgré des budgets AAA :

- **XCOM** (GDC 2013, Firaxis) — *utility scoring* à un coup par unité, séquentiel.
- **Wargroove** — ils ont **délibérément évité** la simulation hypothétique pour rester réactifs ;
  leur IA reste un scoring à un coup sur des cartes de menace riches.
- **Into the Breach** — pas de recherche adverse du tout : elle planifie son tour et le télégraphie.
- **GameAIPro 3, ch. 28** (*Xenonauts 2*) — le mur est l'explosion combinatoire (jusqu'à 12¹⁶
  combinaisons par tour), pas le coût CPU. Leurs concessions pour rendre MCTS praticable (modèle de
  simulation abstrait, unités réduites à force + position) sacrifient l'exactitude.

Le consensus : mettre l'effort dans une **meilleure évaluation statique à un coup**, pas dans la
profondeur. C'est déjà l'arbitrage du **plan 165**, que la recherche confirme rétroactivement.

Ce qui reste défendable, et qui n'est PAS du minimax : un lookahead **très restreint** — cloner
l'état, appliquer l'action candidate, appeler le scorer pour prédire la réplique du **seul** ennemi
le plus menaçant. C'est la généralisation du patron A3/A4 qu'on a déjà pour le ring-out. ⚠️ La
recherche le signale comme une **extrapolation, non documentée ailleurs** — à valider par mesure
avant d'investir. **Décision en attente de l'humain.**

### 🔴 Le vrai levier de difficulté : la richesse des considérations, pas les poids

`docs/ai-system.md` liste **~19 volets de scoring** (ring-out A3/A4, sacrifice, lock-in, priorité,
manip de talent, phazing, copie de move…) qui tournent **à l'identique pour les trois profils**. Seuls
quatre poids et le duo `randomWeight`/`topN` varient. **C'est l'explication de la mesure** : la partie
du pipeline qui fait la différence tactique est la même pour Facile et Difficile.

Le patron établi (XCOM, *A Better ADVENT*) est d'**activer des volets par palier** plutôt que de
pondérer : Facile ne prépare jamais un ring-out, Difficile le fait exprès. C'est une différence de
**comportement observable**, pas de probabilité — largement plus perceptible.

Wargroove, cité tel quel : *« having smarter AI doesn't necessarily make a game better »*.

Contre-point utile : Into the Breach **révèle tout** et n'est pas perçue comme facile, mais comme
juste. Donc **cacher de l'information au joueur n'est pas le bon levier** ici ; cacher des
*capacités* à l'IA, si.

### Les trois autres pistes, confirmées

| Piste | Ce que dit la recherche |
|---|---|
| **Préserver** | Le patron dominant est une **carte de menace statique**, pas de la simulation (Wargroove « Threat Assessment », XCOM `MoveWeightProfiles`). Fire Emblem est moqué pour ne jamais évaluer son propre danger — notre trou exact. On a déjà la primitive : `bestEnemyDamageAgainst` (`threat-detection.ts`), utilisée seulement pour le recul (A4). La généraliser à **chaque destination candidate**, pondérée par une courbe non linéaire du ratio de PV. |
| **Concentrer le feu** | Bonne nouvelle : l'état **séquentiel et mutable** le produit déjà en partie — une cible blessée par un allié a moins de PV quand l'unité suivante calcule. Le manque est que `killPotential` est un quasi-tout-ou-rien : le crédit d'une cible presque morte est noyé. Généraliser `isHealthyTarget` en **bonus explicite « cible blessée »** dans `scoreDamagingMove`. |
| **Statu quo** | Deux précédents : les **échecs** (triple répétition + 50 coups, règle purement mécanique découplée du scoring) et **Pokemon Showdown** (*Endless Battle Clause*, réponse rodée à **notre pathologie exacte** — stalling par soin/buff répété). Philosophie commune : un filet **formel**, séparé de l'intelligence de l'IA. |

Sources principales : [Wargroove — The AI of War](https://wargroove.com/the-ai-of-war/) ·
[GDC 2013 — AI Postmortems](https://www.gdcvault.com/play/1018058/AI-Postmortems-Assassin-s-Creedm) ·
[GameAIPro3 ch.28](http://www.gameaipro.com/GameAIPro3/GameAIPro3_Chapter28_Pitfalls_and_Solutions_When_Using_Monte_Carlo_Tree_Search_for_Strategy_and_Tactical_Games.pdf) ·
[Chess Programming — Repetitions](https://chessprogramming.org/Repetitions) ·
[Showdown — Endless Battle Clause](https://pokemonshowdown.com/news/5780) ·
[Fire Emblem AI Analysis](https://jchuong.github.io/fire-emblem-ai-analysis) ·
[Advance Wars: Deep Difficulty Design](https://critical-gaming.squarespace.com/blog/2009/5/14/advance-wars-deep-difficulty-design.html)

---

## Lot E — Les IA ne tournent plus en rond

**But** : supprimer la cause, puis poser un filet. L'humain a demandé les deux.

1. **Ne plus valoriser un buff à vide.** Le scorer crédite une montée de stat même au plafond (+6) ou
   sans ennemi à portée. La dévaluer dans ces deux cas. C'est la cause directe : paliers à +6 dans
   les six affrontements.
2. **Filet anti-répétition.** Si l'état de jeu — positions et PV de tous — est inchangé depuis N
   tours, forcer un autre choix. Traite le symptôme quelle qu'en soit la cause.
3. **Critère de réussite, mesuré** : `pnpm ai:bench 200` doit ramener « jamais finies » à **0** en
   miroir, sans dégrader la durée médiane. Le banc est l'arbitre, pas l'impression.

### Lot E — ce qui a été fait, et ce que la mesure a dit à chaque pas

| Étape | Parties sans fin (miroir, /240) | Équipes différentes |
|---|---|---|
| Départ | **34** | 3 |
| Buff au plafond dévalué | 14 | 3 |
| Filet de répétition | **4** | 0 |
| Malus au plancher dévalué + détecteur de stagnation | **4** | **0** |

**Trois correctifs, tous nés d'une mesure, aucun d'une intuition.**

1. **Buff sur soi au plafond** — score négatif, donc l'action n'est même plus candidate (`pickScoredAction`
   filtre sur `score >= 0` ; à 0 elle restait piochable). Plus une courbe de saturation, sans quoi l'IA
   empilerait jusqu'à l'avant-dernier cran.
2. **Filet de répétition** — signature de position (qui est où, à combien de PV, avec quels crans) et
   compteur. À la 3ᵉ occurrence — le seuil des échecs — l'IA **dévie dans son classement**. Aucun appel
   au hasard : les deux pairs d'une partie en ligne dévient au même tour vers la même action.
3. **Malus chez l'ennemi au plancher** — le symétrique du 1, trouvé en **instrumentant** les parties
   restantes : deux Lamantine s'étaient mutuellement baissé l'Attaque à -6 et relançaient des baisses
   sans effet.

🔴 **Le seuil de stagnation a été MESURÉ, après une régression.** Première tentative à 40 actions sans
perte de PV : les parties sans fin sont passées de 4 à **17** — le filet déviait l'IA pendant des
phases normales et l'empêchait de conclure. La distribution relevée sur 480 parties :

| | médiane | p90 | p99 | max |
|---|---|---|---|---|
| parties qui FINISSENT (n=476) | 35 | 46 | **395** | 1826 |
| parties BLOQUÉES (n=4) | **3847** | — | — | 3862 |

40 tapait **sous le p90** : une partie saine sur dix était sabotée. Seuil porté à **1000**, et le
décalage **borné à 3** — non borné, il poussait l'IA de plus en plus bas dans son classement jusqu'à
jouer n'importe quoi, ce qui allongeait les parties au lieu de les conclure.

### 🔴 Les 4 dernières ne sont PAS un défaut d'IA

Instrumentées une par une. Toutes le même cas : **fin de partie en 1 contre 1, même espèce, miroir
parfait**.

| Graine | Survivants | Blocage |
|---|---|---|
| 1999 (×2) | 2 × Lamantine | `Atk = -6` des deux côtés (Onde Boréale), **Repos** soigne à fond |
| 1666 | 2 × Artikodin | Pleine vie, **Atterrissage** compense exactement Blizzard |
| 1777 | 2 × Gravalanch | `Déf = +6` (Boul'Armure), et seuls Charge et Roulade en face |

Aucun choix ne gagne : ce ne sont pas de mauvais coups, c'est une position où **personne ne PEUT**
l'emporter. Le filet dévie bien de 3 rangs, mais avec quatre capacités également impuissantes, dévier
ne change rien.

**Conclusion, et elle valide l'arbitrage de l'humain** : corriger l'IA plutôt que poser une limite de
tours a réglé **89 %** des cas (37 → 4) sans toucher aux règles du jeu. Le reliquat relève d'une autre
nature — c'est exactement pour ça que les échecs ont la règle des 50 coups et Showdown son
*Endless Battle Clause*. **Décision en attente de l'humain** : accepter 4/240 en miroir (0/240 en
équipes différentes, donc invisible en partie réelle), ou ajouter un match nul formel.

---

## Lot F — « Difficile » mérite son nom

**But** : que la marge de victoire sépare enfin les niveaux. Aujourd'hui elle ne les sépare pas du
tout.

Conception **à arrêter après le retour de la recherche** (agent `best-practices`, lancé le
2026-09-17). Les quatre pistes retenues par l'humain :

**Conception arrêtée après la recherche**, qui a réordonné les priorités :

1. 🔴 **Des volets activés par palier** — LE levier, d'après la recherche, et celui qui explique la
   mesure. `AiProfile` gagne des **capacités** à côté de ses poids. Facile n'accède pas au
   positionnement ring-out préparatoire (A3/A4), ni au bonus « cible blessée », ni à la pénalité
   d'exposition ; Difficile a tout. Différence de **comportement**, pas de probabilité.
2. **Préserver ses Pokemon** — généraliser `bestEnemyDamageAgainst` du seul cas de recul à **chaque
   destination candidate**, pondéré par une courbe non linéaire du ratio de PV. Capacité réservée aux
   paliers hauts. C'est ce que l'humain attend en premier : « le difficile est censé planifier /
   optimiser / préserver ».
3. **Concentrer le feu** — bonus « cible blessée » dans `scoreDamagingMove`, proportionnel à l'inverse
   du ratio de PV restants. Amplifie l'effet de mutation séquentielle déjà présent.
4. **Revoir les poids** — en dernier, et seulement si la mesure montre qu'il reste un écart à créer.
   La recherche dit que les poids sont le levier le plus faible.

⏸️ **Écarté par la recherche : le lookahead multi-coups.** Voir la section recherche. Un lookahead
**restreint** (une action, une réplique du seul ennemi le plus menaçant) reste possible, mais la
recherche le donne comme non documenté ailleurs. **Décision en attente de l'humain.**

**Critère de réussite, mesuré** : `pnpm ai:bench 200` doit montrer une marge qui **croît avec le
niveau**, là où elle est plate aujourd'hui (3,2 / 3,3 / 3,5 indifféremment). Chiffre cible à fixer
avec l'humain quand la recherche aura dit ce qui est atteignable.

## Outil — `scripts/ai-bench.ts`

Écrit pour ce plan, gardé comme instrument permanent. `pnpm ai:bench [N]` (défaut 40). **Hors de la
suite de tests à dessein** : 480 parties prennent des minutes, le gate doit rester rapide.

Règle de lecture, écrite dans son en-tête : à 40 parties, un écart de moins de **±8 points** de
victoire ou de **±0,3** survivant est du **bruit**. Ne rien conclure en dessous.

## Critère de sortie, à ne pas oublier

Ce plan change le comportement livré **à l'aveugle** : on ne sait pas encore pourquoi 77 % des parties
sont abandonnées, et tout l'échantillon existant a été joué contre Facile. Les deux hypothèses sont
symétriques — si on abandonne par frustration de perdre, resserrer l'IA par défaut **aggrave** ; si on
abandonne d'ennui, ça **améliore**.

Donc, après la mise en ligne : **relire `battle_abandoned` segmenté par `aiDifficulty`**, et comparer
le taux d'abandon des parties `medium` à la ligne de base historique `easy`. C'est ce qui validera ou
invalidera le choix de défaut. Le champ du Lot D.1 est ce qui rend cette lecture possible — **sans
lui, elle ne dira rien, et il sera trop tard**.
