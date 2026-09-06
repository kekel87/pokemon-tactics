# Plan 200 — Méthode de travail et système de mémoire

> **Statut** : done — exécuté le 2026-09-06
> **Créé** : 2026-09-05
> **Origine** : l'humain constate une **baisse de rigueur** de Claude « depuis plusieurs jours », et
> demande si le système de mémoire monté sur le projet professionnel
> ne serait pas plus efficace que « tous nos fichiers md que vraisemblablement tu ne lis pas ».
> **Ce plan ne touche pas au jeu.** Il change la façon dont le projet se souvient et dont les règles
> s'appliquent. Le Lot B2 du multijoueur attend qu'il soit exécuté.

## Le point de départ, rétabli par l'humain

Deux précisions de l'humain, le 2026-09-05, qui commandent tout le reste.

**1. Les fichiers md sont la mémoire de Claude, pas une documentation pour l'humain.**

> « Au début du projet, je ne voulais pas que tu utilises la mémoire de Claude, car elle est que sur
> la machine. Donc on a tout mis dans les docs. »

> « Les md c'est notre mémoire. Moi je ne les lis jamais, je te demande. »

Le volume actuel n'est donc pas un accident : c'est la **conséquence directe d'une contrainte** — la
mémoire Claude n'était ni sauvegardée ni portable, donc tout est parti dans des fichiers versionnés.
La contrainte a tenu ; le contenant a fini par ne plus passer.

**2. Cette dérive est du ressort de Claude et de `doc-keeper`, pas de l'humain.**

> « Toi et le doc-keeper êtes les garants de ces fichiers. Si des trucs ne sont pas bien faits, c'est
> de votre ressort, pas du mien. »

Ce plan est donc une **correction de ce que Claude a laissé dériver**, pas une réorganisation neutre.
La formulation « les docs ont grossi » de la première rédaction était une façon de rendre le
phénomène météorologique — `doc-keeper` et Claude les ont fait grossir, sans jamais rien retirer ni
plafonner.

**3. La contrainte est levée** : l'humain a trouvé comment avoir une mémoire sauvegardée (le système
le projet professionnel, synchronisé par git). Donc — et c'est le renversement par rapport à la première rédaction
de ce plan — **on ne garde en md que ce qui est réellement un document, le reste va en mémoire.**

## Motivation — ce que la mesure dit

### 1. Croissance ×100 en six mois, sans jamais rien retirer

| fichier | à sa création | 2026-09-05 | ≈ tokens |
|---|---|---|---|
| `docs/decisions.md` | 4,6 Ko (mars) | **528 Ko** (×113) | ~132 000 |
| `docs/test-plan.md` | 0 (juillet) | **357 Ko** | ~89 000 |
| `STATUS.md` | 0 (avril) | **298 Ko** | ~75 000 |
| `docs/next.md` | 0 (mai) | **148 Ko** | ~37 000 |

Ces quatre fichiers pèsent **~333 000 tokens**. La table « quoi lire quand » de `CLAUDE.md` dit
« Hésitation sur un choix → `docs/decisions.md` ». Cette instruction n'est plus exécutable — pas
difficile : **infaisable** dans le budget d'une session.

**Preuve prise dans la session qui a produit ce plan** : le `/next` d'ouverture a ouvert
`docs/next.md` → `Output too large (145.1KB)`, aperçu de 2 Ko, puis `grep`. `STATUS.md` idem. Le
`/next` livré à l'humain s'appuyait donc sur **~5 %** de ces deux fichiers. Il se trouve qu'il était
juste ; rien ne le garantissait.

### 2. Le contenu n'est pas périmé — c'est le contenant qui est hostile

Première hypothèse, **fausse et écartée par la mesure** : « les docs sont pleines de résolu, il faut
purger avant d'indexer ».

| fichier | lignes | marquées résolu/barré |
|---|---|---|
| `docs/next.md` | 782 | 56 (**7 %**) |
| `docs/decisions.md` | 1058 | 15 (**1 %**) |
| `STATUS.md` | 585 | 13 (**2 %**) |

Le vrai défaut est la **densité de prose et l'absence de structure** :

| fichier | octets par ligne |
|---|---|
| `docs/decisions.md` | **499** |
| `STATUS.md` | **509** |
| `docs/next.md` | 190 |
| `docs/architecture.md` | 95 |

`docs/decisions.md` est **un tableau markdown de ~950 entrées**, avec **7 titres en tout** sur 528 Ko.
La décision #924 occupe 1 500 caractères dans une cellule. Résultat : illisible en bloc (132k tokens),
inutilisable au `grep` (qui rend un mur de 1 500 caractères), et **sans aucune ancre** où pointer.

Le contenu, lui, est bon — #924 est dense, causale, elle distingue le fait de la cause. **On ne jette
rien.** Et c'est exactement une entité à observations et relations : elle révise #840, elle découle
de #921. Le tableau markdown est le mauvais réceptacle d'un graphe.

### 3. Les règles en prose se dégradent, les règles mécaniques tiennent

894 lignes de règles (`CLAUDE.md` + `.claude/rules/*.md`), 20 marqueurs de règle dure dans le seul
`CLAUDE.md`, 61 fichiers de mémoire personnelle. À budget d'attention constant, la probabilité qu'une
règle donnée s'applique **baisse mécaniquement** avec le volume.

L'observation décisive est déjà dans le dépôt :

- `block-forbidden-commands.sh` (hook) — **jamais** enfreint. Aucun `git reset` en six mois.
- `french-names-reminder.sh` (hook) — a fallu le construire *parce que* la règle en prose ne tenait
  pas, après « >10 rappels » selon `CLAUDE.md` lui-même.
- « Ne rien ranger au backlog sans accord » (prose, dans un fichier mémoire parmi 61) — **enfreinte
  le 2026-09-05**, sur le défaut pré-existant des segments de format à 26 px.

**Ce qui tient, c'est ce qu'une machine applique.** Le reste s'érode à mesure que le volume monte.

## Cible — mémoire d'un côté, documents de l'autre

Le tri se fait sur une question : **est-ce que ce fichier décrit le système, ou est-ce qu'il se
souvient de quelque chose ?**

| | Va en **mémoire** (graphe) | Reste en **document** (md versionné) |
|---|---|---|
| **Nature** | Faits, décisions, état de session, historique, gotchas | Description du système, spécification, cahier, plan |
| **Lecture** | Par restitution ciblée, à la question | Linéaire, ou par section |
| **Candidats** | `docs/decisions.md`, `STATUS.md` (l'historique), `docs/next.md`, `docs/backlog-archive.md`, `docs/implementations.md`, les 61 fichiers de mémoire personnelle | `docs/game-design.md`, `docs/architecture.md`, `docs/multiplayer.md`, `docs/design-system.md`, `docs/test-plan.md`, `docs/plans/`, `CLAUDE.md`, `.claude/rules/` |

Le tri fichier par fichier est l'**étape 3**, à valider avec l'humain — la table ci-dessus est une
proposition, pas un acquis.

**Les 61 fichiers de mémoire personnelle** ont d'abord été versés au graphe (tranché par l'humain le
2026-09-05), au motif qu'ils souffrent du même mal que les md du projet : `MEMORY.md` ne charge que
les **titres**, et le corps d'un fichier n'est lu que si Claude y pense — c'est précisément le
mécanisme par lequel la règle « ne rien ranger au backlog sans accord » (`feedback_no_hidden_debt`)
a sauté.

La recherche d'état de l'art a ensuite montré que ces 61 fichiers **sont** la mémoire automatique
native de Claude Code — laquelle fait déjà de la divulgation progressive et n'est qu'à 30 % de son
plafond — et a donc recommandé de garder les deux systèmes, chacun sur son périmètre.

**Cette recommandation a été écartée** le même soir, sur un motif que la recherche ne pouvait pas
connaître : l'humain n'a pas confiance dans une mémoire qui s'écrit hors de sa vue, et sa règle y
avait déjà été enfreinte 5 fois. **Un seul système, le graphe** ; le natif est coupé. Voir
§ « Un seul système de mémoire » ci-dessous. La question de la duplication tombe avec lui.

### Le coût, assumé

Un SQLite ne se lit pas dans un diff et ne se fusionne pas (la doc du projet professionnel décrit la procédure de
divergence : sauvegarde et refus d'écraser). Aujourd'hui, une décision arrive **dans le commit qui
la produit** — cette traçabilité-là disparaît.

**Un export texte plat commité a été proposé pour la récupérer, et l'humain l'a écarté** (2026-09-05 ;
la même proposition lui avait été faite de son côté sur le projet professionnel) : « je veux que tu
pousses le `.db`, on s'en fiche de la comparaison ».

**Arbitrage acté** : c'est le **`.db` binaire** qui est poussé. **Pas de double écriture**, pas
d'export markdown. La perte de diffabilité est le prix choisi, pas un oubli — et c'est cohérent avec
le reste : personne ne lit ces contenus dans un diff, l'humain les demande à Claude.

### Où le `.db` est poussé — dépôt privé dédié (tranché le 2026-09-05)

Première rédaction : branche orpheline du dépôt du jeu, **qui est public**. L'humain a d'abord
accepté, puis posé la contrainte qui l'invalide : « dans la mémoire, faut pas de truc perso, d'info
sur ma machine etc. » Deux décisions se contredisaient alors — les fichiers de mémoire personnelle
rejoignaient le graphe, et le graphe partait en dépôt public. Sur les 61 fichiers, **3 sont
réellement sensibles** (adresses de courriel et employeur, canaux de diffusion, recette de
manipulation des secrets).

Le chiffrement de la base a été envisagé par l'humain, puis **écarté** pour trois raisons :

1. **Un dépôt public est irréversible** : un blob poussé a pu être cloné. Une fuite ou une faiblesse
   de la phrase de passe exposerait **tout l'historique, rétroactivement**. Le chiffrement échange un
   risque évitable aujourd'hui contre un pari sur dix ans.
2. **La taille explose** : un blob chiffré change intégralement à chaque écriture (nonce différent),
   donc git ne peut plus le stocker en delta — chaque synchronisation ajoute la base entière. C'est
   exactement le problème que la synchronisation du projet professionnel avait dû résoudre en hachant
   le *contenu* et non le fichier ; le chiffrement rend ce correctif inopérant.
3. Ça crée **un secret à gérer** là où il n'y en avait aucun.

**Décision retenue** : *« on met tout dans un seul dépôt privé »*. **Le dépôt privé dédié a été
créé par l'humain le 2026-09-05** (visibilité vérifiée `PRIVATE`, vide à ce stade) ; il fournira
son adresse à l'exécution — elle n'est pas inscrite ici, ce fichier vivant dans le dépôt public. Un dépôt privé dédié à la mémoire
reçoit la base ; le dépôt public du jeu **ne reçoit rien**. Plus de chiffrement à monter, plus de
séparation à maintenir, et la contrainte « pas de perso » est tenue par la **visibilité du dépôt**
plutôt que par un tri à refaire à chaque écriture — donc elle ne peut pas se dégrader avec le temps.

**Nettoyage fait dans la foulée** (2026-09-05) : le dépôt public portait le modèle exact de la carte
graphique (6 occurrences) et le nom du client git de l'humain (4). Généralisés en « GPU AMD dédié » et
« client git graphique » — sens technique conservé, configuration exacte retirée. Le reste était déjà
propre : aucun chemin personnel, aucune adresse, et `docs/promo-channels.md` est bien ignoré par git.

## Critère d'acceptation

> **L'humain demande, Claude répond juste — sans coup de chance au `grep`.**

Mesurable, et c'est ce qui manquait. **Étape 0** : constituer une batterie de ~15 questions de
restitution dont l'humain connaît la réponse (« pourquoi la roue de caractères contredit-elle
#840 ? », « pourquoi llvmpipe a-t-il été écarté ? », « qu'est-ce qui reste ouvert sur le Lot B3 ? »),
la jouer **avant** tout changement pour la ligne de base, la rejouer après chaque étape. Sans cette
mesure, on refait à l'estime exactement ce que ce plan reproche à l'existant.

## Ce que le système du projet professionnel apporte

Référence : `la doc du système de mémoire du projet professionnel`. Quatre pièces, toutes maison.

| Pièce | Ce que ça règle ici |
|---|---|
| **Injection de rappel** (`UserPromptSubmit`) | **Le trou principal.** Le fait pertinent arrive **avant que Claude parle**, sans qu'il ait à le demander ni à le payer. Remplace « lis `decisions.md` si tu hésites », qui est inexécutable. |
| **Recherche FTS5 + BM25**, rankée et capée | Remplace le `grep` aveugle. Sur le projet professionnel : `search_nodes("quote")` passait de 129 entités / **~124k tokens en un appel** à 10 / ~9k. |
| **Porte de capture** (`Stop`) | Donne un **moment de déclenchement** à la persistance, qui n'en a pas ici (c'est `session-closer`, à la main, en fin de session). |
| **Synchronisation git** (branche orpheline) | Le graphe voyage entre machines — **c'est la contrainte d'origine de l'humain, et sa levée**. |

La doc du projet professionnel nomme le trou exactement : *« Nothing reached a session unless the model asked for
it. »* C'est le nôtre.

### État du terrain — mesuré le 2026-09-05

**Rien à migrer, on part propre.** Trois constats :

- Un serveur `memory` **est déjà déclaré** dans la configuration du profil personnel — mais c'est
  **`@modelcontextprotocol/server-memory`** (adossé à un fichier JSON), **pas**
  `@pepk/mcp-memory-sqlite`, le seul que l'enveloppe FTS5 du projet professionnel sait corriger (elle patche
  `KnowledgeGraphStore.prototype`). Les deux paquets n'ont ni le même stockage ni les mêmes
  internes : porter, c'est **remplacer le serveur**, pas le configurer.
- Son fichier son fichier JSON est **absent** : déclaré, jamais écrit. Le serveur n'a
  jamais servi.
- Un la base par défaut hors profil de juillet traîne hors des deux répertoires de configuration (5 entités,
  21 observations, 7 relations) — vestige d'un essai, sans valeur.

### Points tranchés avec l'humain (2026-09-05)

1. **Répertoire de configuration — résolu, ce n'était pas une décision.**
   `CLAUDE_CONFIG_DIR` du profil personnel pour ce projet. Le montage est **symétrique** de
   celui du projet professionnel : `env.HOME=$CLAUDE_CONFIG_DIR` → base à
   `$CLAUDE_CONFIG_DIR/.claude/memory.db`, exactement comme
   celui du profil professionnel. Le `env.HOME` reste « pas de la décoration » : c'est lui qui
   empêche le paquet de retomber sur la base par défaut hors profil, le vestige ci-dessus.
2. **Séparé du professionnel — résolu de fait.** Les deux répertoires de configuration sont déjà
   distincts, donc `HOME` différent → base différente. Aucune plomberie à ajouter.
   **Et un graphe par projet, tranché par l'humain** : à l'intérieur de le profil personnel,
   `mcpServers` est **global**, donc une base unique serait partagée avec les autres projets
   personnels. Or Pokemon Tactics y verserait ~950 décisions, soit ~95 % du volume — le classement
   BM25 se dégrade avec le bruit d'un autre domaine, et surtout la synchronisation vers une branche
   orpheline **publique** y publierait la mémoire des autres projets. Le serveur `memory` est donc
   déclaré **au niveau projet**, sur une base dédiée.
3. **Dépôt public — accepté par l'humain.** Le `memory.db` sera public sur la branche orpheline.
   Aucun secret dans ce projet ; le contenu est du game design, des décisions techniques et de
   l'historique de session, déjà publics dans les md du dépôt.
4. **Import initial depuis `decisions.md` — faisable par script, confirmé.** Le fichier est un
   tableau régulier de **957 lignes à 5 colonnes** (`#`, `Date`, `Question`, `Décision`, `Contexte`)
   — analysable sans ambiguïté. Les colonnes `Décision` et `Contexte` deviennent des observations,
   le `#` l'identité, et les renvois entre décisions (« révise #840 », « découle de #921 ») des
   relations. Les trois sections `### Révisé à…` (lignes 954, 974, 1009) et `## Décisions écartées`
   (1047) sont à traiter à part : ce sont des révisions, donc des relations, pas des entités.

## Recherche d'état de l'art (2026-09-05) — ce qu'elle a changé

L'humain a demandé de chercher avant de porter par défaut (« peut-être qu'il y a encore mieux »),
conformément à sa propre règle « chercher avant de réinventer ». Recherche menée par l'agent
`best-practices`. **Conclusion : porter le système du projet professionnel tel quel — mais avec une
correction de périmètre importante.**

### Le fait décisif : la mémoire automatique native existe déjà, et elle tourne déjà ici

Vérifié dans la documentation officielle Claude Code
([code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory)) :

- La **mémoire automatique est active par défaut**, par dépôt git. **Les 61 fichiers de mémoire
  personnelle de ce projet *sont* cette fonctionnalité** — ce n'est pas un dispositif maison.
- Son modèle est un index `MEMORY.md` **injecté à chaque session**, plus un fichier markdown par
  sujet **lu à la demande**. C'est déjà la divulgation progressive du système maison : Anthropic a
  livré le mécanisme du hook d'injection.
- **Plafond dur : 200 lignes ou 25 Ko** pour `MEMORY.md`. Au-delà, troncature silencieuse.
  État mesuré ici : **59 lignes / 8,6 Ko**, soit ~30 % du plafond. Les 61 fichiers pèsent 83 Ko.
- Réglage `autoMemoryDirectory` : le répertoire est déplaçable, donc **synchronisable par git**.
  C'était la contrainte d'origine de l'humain — elle est levée nativement aussi.

**Le calcul qui tranche : 957 décisions n'entrent pas dans un index de 200 lignes.** Le natif couvre
l'injection à petite échelle, pas à la nôtre.

Les deux autres briques Anthropic ne s'appliquent pas : l'outil mémoire de l'API est le même modèle
de fichiers sans classement ; les magasins de mémoire des agents gérés (et leur consolidation
« Dreaming ») sont **hébergés chez Anthropic**, ce qui tombe sous la contrainte « local, pas d'API
externe ».

### ⚠️ Correction de périmètre — les 61 fichiers ne vont PAS dans le graphe

C'est le point où la recherche contredit un arbitrage pris plus tôt dans la session. Le
raisonnement : la mémoire native fait déjà correctement son travail **à cette taille** (30 % du
plafond), et faire tourner deux systèmes de mémoire concurrents recrée exactement la dérive que ce
plan cherche à corriger.

**Découpage par portée, à valider avec l'humain :**

| | Mémoire native (`MEMORY.md` + fichiers de sujet) | Graphe SQLite |
|---|---|---|
| Contenu | Préférences de travail, retours, façon de travailler | Les 957 décisions, les gotchas techniques, l'état du projet |
| Pourquoi | Petit, stable, déjà injecté à chaque session | Fait exploser le plafond de 200 lignes |

**Réserve à lever avant d'appliquer ce découpage** : l'index natif est **statique** — il ne dépend
pas de la question posée, il n'y a ni classement ni recherche. Or c'est précisément par là que la
règle du backlog a sauté : le titre était dans l'index, le corps n'a pas été relu. Le rappel du
graphe, lui, est **apparié à la requête** et pousse le contenu avant que Claude parle. Il faut donc
mesurer (étape 0) si le natif suffit vraiment sur ce cas, plutôt que de le supposer.

### Les deux dépôts déjà repérés par l'humain

- **`thedotmack/claude-mem`** (93 286 étoiles, Apache-2.0, poussé le 2026-09-05 — chiffres vérifiés
  par l'API GitHub). Il a beaucoup évolué depuis la version évaluée : recherche hybride BM25 +
  vectorielle, divulgation progressive, licence permissive. **Mais son schéma reste
  sessions / observations / résumés — toujours aucune table d'arêtes.** Journal mieux indexé, pas
  graphe curé : **le rejet tient**.
- **`Egonex-AI/Understand-Anything`** (81 594 étoiles, MIT — vérifiés). **Ce n'est pas une mémoire
  d'agent** : c'est un pipeline qui transforme *le code* en graphe de compréhension. Trois
  disqualifications : il indexe ce qui est dérivable du code (l'inverse de nos décisions et
  gotchas) ; **aucune injection en session** (un JSON que Claude lit s'il y pense — notre trou reste
  entier) ; **le français n'est pas dans ses langues supportées**. Éventuellement utile comme outil
  de découverte sur `packages/core/`, pas comme mémoire.

### Verdict sur les autres candidats

Aucun ne coche tout. L'écosystème 2026 s'est scindé : les journaux pour Claude Code (`codemem`,
`claude-mem-lite`, `ClawMem`, `remem`) ont la restitution classée mais **pas de graphe** ; les
serveurs MCP à graphe (`knowledgegraph-mcp`, et le paquet que l'enveloppe corrige) ont le graphe mais
une **recherche non classée**. `mem0`, `Zep`/`Graphiti`, `Letta`, `cognee` supposent Docker et une
base serveur : non synchronisables par git. `basic-memory` ramène au markdown qu'on fuit.

**L'enveloppe FTS5/BM25 maison est exactement la soudure manquante**, et quatre projets indépendants
ayant convergé en 2026 sur « SQLite + FTS5 BM25 + hook `UserPromptSubmit` » confirment que
l'architecture est la bonne.

### Le point aveugle français, précisé

- `unicode61` **retire les diacritiques par défaut** (`é`→`e`), ce qui aide beaucoup : le lexique
  technique FR/EN est massivement cognat (décision/decision, position, configuration, animation).
- Mais **Porter est un radicalisateur anglais** : les flexions françaises ne se conflatent pas. Le
  dégât est borné (le corpus est dominé par des identifiants, où le radicalisateur ne sert à rien)
  mais réel sur les questions en langage naturel.
- **BM25 seul suffit à cette échelle** : le gain hybride mesuré est de ~5 à 8 % NDCG, et le
  reclassement est déconseillé sous ~1 000 documents. Ce n'est pas là qu'est le problème.

### Ajouts recommandés au système maison, par rendement décroissant

1. **Le harnais d'évaluation de restitution** — c'est l'étape 0 de ce plan, et aucun des projets
   étudiés n'en a. C'est lui qui rend les points suivants décidables par la mesure.
2. **Expansion de requête FR→EN** sur un petit dictionnaire de termes du projet : la réponse la moins
   chère au point aveugle linguistique. N'aller au vectoriel que si la mesure montre que ça ne suffit
   pas.
3. 🔴 **Un bonus de récence dans le score.** Absent de BM25 pur, universel dans les mises en œuvre
   2026, et **critique sur un corpus de décisions** — où une décision en supersède une autre. BM25
   seul remonte la plus verbeuse, pas la plus récente. C'est exactement le piège qui a produit la
   contradiction #840 / roue de caractères.
4. **Une passe de consolidation** (fusion de doublons, marquage du périmé). La porte de capture fait
   croître le graphe, rien ne le taille — à ~1 000 entités importées d'un tableau, les doublons vont
   mordre.
5. `sqlite-vec` + un modèle multilingue local, **seulement si** la mesure l'exige après le point 2.

### Ce qui reste à vérifier

L'affirmation « aucun de ces journaux n'a de table d'arêtes » vient de leurs documentations, pas d'un
schéma exécuté. Elle est solide mais mériterait une vérification directe si elle devait porter seule
la décision — ce n'est pas le cas ici, le natif et le plafond de 200 lignes suffisent à trancher.



### ⚠️ Un seul système de mémoire — le natif est coupé (tranché le 2026-09-05)

L'humain : « ça me fait peur que tu écrives dans la mémoire de Claude sachant que je te l'avais
interdit », puis « on peut te dire de te servir que de la mémoire qu'on veut mettre en place ? ».
**Oui, et c'est retenu.**

**L'audit, d'abord, parce que le sujet est la confiance :**

- **Aucune écriture dans la session qui a produit ce plan** (démarrée à 22:44 ; dernières écritures
  du jour à 13:41, 16:00 et 19:13, par des sessions antérieures).
- L'interdiction n'était pas totale. `CLAUDE.md` dit : « recherches/décisions/contexte → doc projet,
  pas mémoire Claude. **Mémoire = préférences perso humain seulement** ».
- **Compte exact : 55 fichiers conformes** (54 `feedback_*` + 1 `user_*` — ce que la règle autorise),
  **5 en infraction** : `reference_pokerogue_rendering` (de la recherche, nommément visée par la
  règle), `project_batch_checklist`, `project_core_move_tests` (déjà en double dans
  `docs/methodology.md`), `project_cursor_ffta` (une tâche, sa place est `docs/next.md`), et
  `project_promo_channels` (limite : pointeur vers un fichier ignoré par git, il ne peut pas vivre
  ailleurs).

**Pourquoi ça a dérivé** : la mémoire automatique native est **conçue** pour écrire quatre types de
notes, dont `project` et `reference` — exactement ce que la règle interdisait. Le harnais instruit
cette écriture à chaque session ; la règle était une ligne de prose dans un `CLAUDE.md` de 15 Ko.
**Cinquième démonstration de la thèse de ce plan.** Et la documentation officielle l'énonce
elle-même : *« Claude treats them as context, not enforced configuration. To block an action
regardless of what Claude decides, use a PreToolUse hook instead. »*

**Décision** : un seul système de mémoire, le graphe. Les 61 fichiers y sont migrés — **les 5 en
infraction compris** (« on va les intégrer dans le graphe »), ce qui règle du même coup la
« correction de périmètre » laissée ouverte par la recherche : le natif n'est pas conservé en
parallèle, donc la question de la duplication tombe.

**Mise en œuvre, deux leviers documentés :**

| Levier | Portée |
|---|---|
| `"autoMemoryEnabled": false` dans `.claude/settings.json` du projet | coupe la mémoire native pour ce projet seulement |
| Hook `PreToolUse` sur le répertoire de mémoire | bloque l'écriture **quoi que Claude décide** |

Les deux, pas l'un ou l'autre : le réglage retire l'instruction, le hook garantit le résultat.

🔴 **Ordre obligatoire** : **construire le graphe → migrer les 61 → couper le natif.** Couper d'abord
laisserait le projet sans mémoire du tout pendant l'intervalle. Cette coupure est donc la **dernière**
opération de l'étape 2, pas la première.


## Étapes

### Étape 0 — Ligne de base de restitution *(préalable à tout)*

📄 **Fait le 2026-09-06.** Les 15 questions, leurs réponses de référence et **les trois relevés**
sont dans `docs/plans/200-etape0-restitution.md`. Résultat : **15/15 avant, 15/15 après** — le verrou
est passé, la suppression des sources était donc autorisée.

Batterie de ~15 questions + réponses attendues, validées par l'humain. Jouée avant tout changement,
résultat consigné ici. **Sans elle, aucune étape suivante n'est mesurable.**

### Étape 1 — Rendre mécaniques les règles qui comptent

Ordre choisi par l'humain : les hooks d'abord, parce que c'est court et que ça adresse la plainte
aiguë.

1. **Hook `PreToolUse` sur `Edit|Write` ciblant `docs/backlog.md`** — bloque, et rappelle la
   formulation attendue : « je l'ai trouvé : je le corrige maintenant, ou je le range ? Tu
   choisis. » **Y compris pour un défaut pré-existant**, qui est précisément le cas non couvert.
   - **Frontière avec `docs/next.md`** : `next.md` est l'agenda de travail de Claude, maintenu seul.
     `backlog.md` est la liste de **dette acceptée** de l'humain — y écrire, c'est décider à sa place
     qu'un défaut ne sera pas corrigé. D'où l'accord explicite.
2. **Audit des 894 lignes de règles** : pour chacune, trancher — mécanisable (hook, script, test), à
   garder en prose, ou **périmée et à retirer**. Première fois qu'on retire des règles.
3. `docs/methodology.md` §2 est périmé (il liste 7 fichiers de doc, il y en a ~30) — symptôme, à
   corriger dans la foulée.

### Étape 2 — Porter le système de mémoire

Les 4 points sont tranchés. **Une vérification reste en cours avant d'écrire la première ligne** :
l'humain a demandé de chercher l'état de l'art plutôt que de porter par défaut (« peut-être qu'il y a
encore mieux comme solution »). C'est sa propre règle — `feedback_research_before_reinventing`. La
connaissance de Claude s'arrête à **mai 2026**, on est en septembre : quatre mois dans un domaine
rapide, et il faut notamment vérifier si quelque chose de **natif** à Claude Code ou à l'API
Anthropic rend une partie du montage caduc.

Déjà écartés par l'humain, à ne pas re-proposer sans élément neuf : `thedotmack/claude-mem` (journal
automatique par résumé, pas un graphe curé ; migration lossy, aucune table d'arêtes pour ~500
relations). Repéré mais non évalué : `Egonex-AI/Understand-Anything`.

**Défaut par défaut** : reprendre les quatre pièces du projet professionnel en les adaptant. **Ne pas réécrire**
ce qui existe — la doc du projet professionnel contient les décisions déjà mesurées (`MAX` et non `SUM`, `OR` et non
`AND`, liste d'arrêt FR+EN, `WITH … AS MATERIALIZED`), et les refaire à l'aveugle rejouerait les
mêmes erreurs. Porter implique de **remplacer** le serveur `memory` en place (mauvais paquet, voir
§ État du terrain).

**Un point aveugle connu du système maison, à confronter à l'état de l'art** : le classement BM25
utilise un radicalisateur `porter unicode61`, conçu pour l'anglais, alors que le contenu ici est
massivement **français** et que l'humain interroge en français. Sur le projet professionnel le graphe est en
anglais ; ce n'est donc pas une pièce éprouvée sur notre cas.

### Étape 3 — Trier, migrer, plafonner

- Trier chaque fichier selon la table « mémoire / document », **avec l'humain**.
- Migrer les fichiers-mémoire vers le graphe, par script. **Pas d'export texte** — écarté par
  l'humain, voir § Le coût, assumé.
- Poser un **plafond de taille** par document restant, avec rotation vers archive au franchissement.
  L'absence de plafond est la cause racine de tout ce plan.
- Réécrire la charge de `doc-keeper` : il devient garant d'un budget, pas seulement d'une mise à
  jour. C'est ce qui manquait à son cahier des charges.

## Hors périmètre

- Toute modification du jeu. Le Lot B2 reprend après.
- La suppression de contenu de fond (décisions, `test-plan.md`) : on change le contenant, on ne jette
  pas.

## Décisions à inscrire

À l'exécution, pas maintenant. Pressenties : le diagnostic mesuré (croissance ×113, densité de prose,
contenant et non contenu) ; l'origine historique (mémoire locale non sauvegardée → tout en md) et la
levée de la contrainte ; « ce qui tient est ce qu'une machine applique » ; le critère de restitution ;
le partage mémoire/document ; le rejet de l'export texte et du chiffrement ; le dépôt privé dédié ;
un seul système de mémoire (natif coupé) ; le bonus de récence au score ; le plafond de taille avec
rotation.

## État à la clôture — 2026-09-06

**Le plan est exécuté.** Les quatre étapes sont faites.

| | |
|---|---|
| Graphe | **1984 entités, 8500 observations, 538 relations** |
| Markdown suivi | **5187 → ~730 Ko (−86 %)**, 214 fichiers supprimés |
| Hooks | **2 → 8** : rappel de mémoire, garde du backlog, rappel du menu, gardes de friction, synchronisation (`Stop` + `SessionStart`) |
| Mémoire native | coupée (`autoMemoryEnabled: false`) — un seul système |
| Sauvegarde | dépôt privé dédié, poussée vérifiée |
| Gate | `pnpm audit:flow` ajouté **en tête des trois niveaux** |

### Les trois bugs silencieux, qui ont tous la même signature

Chacun donnait l'apparence du fonctionnement. C'est le risque dominant du chantier, davantage que la
qualité du code :

1. **La sauvegarde ne sauvegardait rien.** `sqlite3` absent de la machine → les deux empreintes
   valaient la même chaîne vide → « aucun changement » → plus aucune poussée après la première.
   Règle qui en découle : *une empreinte qu'on ne sait pas calculer doit provoquer une sauvegarde,
   jamais son abandon.*
2. **Le hook du menu se déclenchait sur son propre état.** `.claude/.state/` non ignoré par git →
   rappel à chaque session sur un dépôt propre — précisément le « hook qui râle à vide » qu'il dit
   vouloir éviter.
3. **L'enveloppe de recherche ne repliait pas les accents**, alors que le hook Python le faisait.
   `mémoire` y devenait « m » + « moire ». Les deux moitiés du système ne cherchaient pas la même
   chose, et l'après-midi de réglages s'est faite par-dessus un tokeniseur cassé.

### Ce qui reste ouvert

- **Le plafond de taille par document et la rotation vers archive ne sont pas faits** — c'est la
  cause racine du plan, et rien n'empêche encore la dérive de recommencer. `audit-flow.mjs` ne
  mesure aucune taille.
- La charge de `doc-keeper` n'a pas été réécrite en « garant d'un budget ».
- **Trois choses ne sont pas éprouvées** : le hook `SessionStart` n'a jamais tourné, les outils
  `mcp__memory__*` n'ont jamais été appelés (tout est passé par `query.mjs`), et `doc-keeper` n'a
  pas été rejoué avec sa nouvelle définition — `session-closer`, lui, l'a été et a passé le test.

### Le fil à ne pas perdre

Ce plan est né d'un constat — « je te trouve moins rigoureux depuis plusieurs jours » — et la réponse
mesurée est que **la surface de règles avait dépassé le budget d'attention**. Le critère d'arbitrage
reste : *est-ce que ça réduit la surface, ou est-ce que ça l'augmente ?*

Et la leçon la plus solide de la journée, démontrée trois fois : **ce qui tient est ce qu'une machine
applique.** Une promesse d'être plus attentif ne vaut rien — la règle du backlog était écrite et
correcte, le menu post-impl aussi, les noms FR aussi. Les trois ont sauté. Aucun hook n'a sauté.
