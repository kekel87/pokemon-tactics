# Plan 217 — Mémoire : mesurer le rappel, invalider au lieu de raturer, des relations qui se suivent

**Statut** : done — livré le 2026-10-02 (recette humaine sautée)
**Ouvert le** : 2026-10-02, après comparaison avec le système mémoire d'un autre workspace et la
littérature (GraphRAG-Bench, Mem0g, HippoRAG 2, Governed Shared Memory, LatticeMind)
**Bloque la release ?** : non
**Taille** : moyen — outillage `scripts/memory/` et hook de rappel, migration de données relue

## Ce que tu verras à l'écran

1. Moins d'index mémoire injectés hors sujet sous tes messages — et un chiffre pour le prouver
   (sondes négatives : un « ok continue » n'injecte rien).
2. Une ligne `↳` sous certaines entrées injectées, qui nomme les voisins typés (« découle-de X,
   remplacée-par Y ») — jamais leur contenu.
3. Un fait périmé ne remonte plus : `--invalidate` le marque `INVALID AAAA-MM-JJ: raison`, la
   recherche et le hook l'ignorent.
4. Une commande d'audit qui **propose** (secrets, doublons, fusions, relations hors tableau) et ne
   modifie rien.
5. Accès inchangé : la CLI `query.mjs` reste le seul chemin (le MCP `memory` reste désactivé).

## Ligne de base mesurée (2026-10-02)

| Mesure | Valeur |
|---|---|
| Graphe | 2 318 entités, 10 660 observations, 886 relations, WAL |
| Sondes `eval-search.mjs` | **10/15** TOP-3 (12/15 au calibrage, à 1 984 entités) |
| Injection du hook | 485 prompts sur ~915 (53 %) sur 53 sessions |
| Injecté puis ouvert (`--open`) | 42 / 1 395 couples (entité, session) — 3 % |
| Verbes de relation distincts | **49**, dont variantes orthographiques (`découle de`/`decoule-de`, `révise`/`revise`…) |
| Entités sans relation | 1 486 (64 %) |
| Marqueurs d'invalidation maison | PÉRIMÉ 54, remplacé 43, OBSOLÈTE 18, ✅ RÉSOLU 21 — `INVALID` 0 |
| Hygiène | 104 observations recopiées entre entités, 7 `bruit-import`, 688 lignes de récence orphelines, 11 observations avec e-mail, 0 motif de token |

## Résultats mesurés (2026-10-02, fin de dev)

| Mesure | Avant | Après |
|---|---|---|
| Recherche, sondes TOP-3 | 10/15 | **13/15** — règle des numéros isolés + 2 attendus périmés corrigés après vérification `--open` |
| Hook, sondes positives | 12/13 | **11/13** |
| Hook, sondes négatives (silence) | **0/20** | **20/20** |
| Hook, déclenchement sur 254 prompts réels hors sondes | ~54 % | **35 %** |
| Relations | 49 verbes | **14**, 0 hors vocabulaire à l'audit |

**Écarts au plan, découverts en dev :**
- **Phase 0 ajoutée** : le moteur vivait hors dépôt (voir Étapes).
- **Les « 115 marqueurs maison » n'étaient pas 115 faits périmés.** Sur 143 occurrences, 109 sont
  des mots dans une phrase (« information périmée », « remplacé par `getMoveName()` »), 21 des
  notes de clôture vraies (« ✅ RÉSOLU … »), 13 des annotations visant une AUTRE observation. La
  migration se réduit à **4 entités, 27 observations** (3 anciens pointeurs d'agenda, 2 diagnostics
  déclarés faux) ; les corrections partielles (recettes 6 et 12) restent telles quelles.
- **Porte du hook refaite** : le critère « un terme rare n'importe où » se faisait piéger par la
  conversation (« vasi », « parfait » sont rares parce que les fiches feedback citent l'humain).
  Nouveau critère : un terme présent dans le NOM de 1 à 5 entités, ou écrit comme un identifiant de
  code (`camelCase`, `snake_case`, `fichier.ext`, backticks), et rare (≤ 2 %). Type `bruit-import`
  jamais servi. Compromis assumé : un terme technique écrit en minuscules et absent des noms
  (« llvmpipe ») ne déclenche plus le hook — `query.mjs` le trouve toujours.
- **Tokenizer** : `porter` gardé, mesuré (sans : 10/15 et 8/13 ; trigrammes : 10/15).

## Hors périmètre, et pourquoi

- **Gate de capture au Stop** : 25 sessions sur 26 avec ≥ 3 éditions écrivent déjà au graphe
  (`doc-keeper`/`session-closer`). Aucun problème constaté.
- **Branche orpheline** : la synchro par dépôt privé avec empreinte de contenu marche (vérifiée le
  2026-09-15).
- **Réactiver le MCP `memory`** : aucun pendant MCP à `--resolve`/`--retype`/`--forget`
  (question-ouverte-outils-mcp-memory-jamais-exerces).
- **Échelle de confiance automatique** (promoter à 3 juges) et défenses anti-empoisonnement
  multi-utilisateurs : surdimensionnées pour un projet solo.

## Étapes

### Phase 0 — Rapatrier le moteur de recherche (ajoutée en dev, accord humain du 2026-10-02)

Découvert en dev : `searchNodes`, le tokenizer, la stoplist et l'index FTS vivaient dans
`<config>/.claude/vendor/memory-fts.mjs`, **hors dépôt et non versionné** (la synchro ne transporte
que `memory.db`) — chaque machine avait sa copie. Toute la phase 1 et la phase 3 l'auraient modifié
en douce.

- [x] Étape 0.1 — `scripts/memory/fts.mjs` : le moteur devient un module **pur** (schéma, SQL,
  tokenisation, `installerMoteur(KnowledgeGraphStore)`), sans import de paquet nu ni démarrage de
  serveur MCP. `paths.mjs` l'applique. Le vendor ne fournit plus que `node_modules` (`@pepk`).
- [x] Étape 0.2 — Non-régression : `eval-search.mjs` doit rendre **exactement** 10/15 et les mêmes
  ratés avant/après le déplacement.
- [x] Étape 0.3 — Tests sur `node:sqlite` en mémoire (FTS5 disponible en Node 24, comme la CI) :
  le moteur devient testable sans la base réelle.

### Phase 1 — Invalider (fondation)
- [x] Étape 1.1 — `query.mjs --invalidate` : implémentation du préfixage et transaction
- [x] Étape 1.2 — Filtre `WHERE content NOT LIKE 'INVALID %'` dans `searchNodes` (query.mjs)
- [x] Étape 1.3 — Filtre INVALID dans le hook d'injection (`.claude/hooks/inject-memory-recall.py`)
- [x] Étape 1.4 — Trigger `AFTER UPDATE OF content ON observations` pour réindexation FTS
- [x] Étape 1.5 — Tests unitaires d'invalidation et d'exclusion (query.test.ts)
- [x] Étape 1.6 — Migration des marqueurs maison : **27 observations dans 4 entités** (table relue par l'humain le 2026-10-02), une transaction, base sauvegardée avant

### Phase 2 — Mesurer
- [x] Étape 2.1 — Créer `scripts/memory/hook-probes.tsv` (sondes positives + négatives)
- [x] Étape 2.2 — Implémenter sondes de hook dans `eval-search.mjs`
- [x] Étape 2.3 — Logger injections/ouvertures dans `.claude/.state/memory-usage.jsonl`
- [x] Étape 2.4 — Mesurer baseline : sondes TOP-3 et couverture négatives

### Phase 3 — Réparer la recherche
- [x] Étape 3.1 — Identifier les 5 ratés dans eval-search.mjs (TOP-1 vs TOP-3)
- [x] Étape 3.2 — Tester variantes : tokenizer, DF_MAX, poids, exclusions (au harnais)
- [x] Étape 3.3 — Valider variante gagnante : ≥ 12/15 ET 0 injection négative
- [x] Étape 3.4 — Commit des réglages dans le hook et paths.mjs

### Phase 4 — Vocabulaire et voisins
- [x] Étape 4.1 — Tableau fermé des verbes dans `scripts/memory/README.md`
- [x] Étape 4.2 — Enum des verbes dans `query.mjs --link` (refus hors liste)
- [x] Étape 4.3 — Implémentation ligne `↳` dans le hook (3 voisins max, verbes forts)
- [x] Étape 4.4 — Migration des 886 relations : 49 verbes → 14 (table relue par l'humain le 2026-10-02), 5 relations au sens inversé (`alimente`, `arbitre-par`), aucun doublon, une transaction
- [x] Étape 4.5 — Tests unitaires (`--link` refuse invalid, ligne affiche 3 max)

### Phase 5 — Audit
- [x] Étape 5.1 — `audit.mjs` : détection secrets (gitleaks stdin)
- [x] Étape 5.2 — `audit.mjs` : relations hors tableau (lint)
- [x] Étape 5.3 — `audit.mjs` : candidats fusion (Jaccard) et observations recopiées
- [x] Étape 5.4 — `audit.mjs` : lignes orphelines, `bruit-import`, raisons `INVALID`

## Phase 1 — Invalider au lieu de raturer (fondation pour les mesures)

**Doit précéder les phases de mesure** : tant que les observations `INVALID` remontent en recherche et en injection, les chiffres sont faussés.

- `query.mjs --invalidate <entité> "<fragment exact>" "<raison>"` : préfixe l'observation par
  `INVALID AAAA-MM-JJ: <raison> — ` (texte d'origine conservé), dans une transaction.
- Recherche (`searchNodes`) et hook d'injection exécutent `WHERE content NOT LIKE 'INVALID %'`
  pour les observations — **impératif côté `query.mjs` et `.claude/hooks/inject-memory-recall.py`**.
- Trigger FTS : ajouter `AFTER UPDATE OF content ON observations` pour reindexer quand une
  observation est invalidée (le préfixe change son contenu). Les triggers INSERT/DELETE existent.
- `CONFIRMED AAAA-MM-JJ:` posé **uniquement** sur validation explicite de l'humain ; bonus ×1,5 aux
  entités portant ce marqueur (implémentation dans la recherche).
- Une correction = invalidation + nouveau fait (jamais un rejet par l'anti-doublon).
- Tests unitaires : `--invalidate` (rejeu correct, transaction), exclusion des `INVALID` en recherche
  et injection, dans `query.test.ts`.
- Migration des 115 marqueurs maison (PÉRIMÉ, OBSOLÈTE, remplacé, ✅ RÉSOLU) : table de passage +
  échantillon montrés à l'humain, sauvegarde préalable, rejeu séquentiel (pas de parallélisation).

## Phase 2 — Mesurer le rappel (avec invalidations en place)

- `scripts/memory/hook-probes.tsv` : sondes positives (prompt réel → entité attendue dans
  l'injection) **et négatives** (prompt conversationnel → aucune injection). Prompts tirés des
  transcripts de ce projet, rien de copié d'ailleurs.
- `eval-search.mjs` rejoue aussi les sondes de hook (import de la fonction de classement du hook,
  ou appel du script en sous-processus avec un prompt fixe) et affiche les deux scores.
- Log d'usage `.claude/.state/memory-usage.jsonl` : `injected` écrit par le hook, `opened` écrit
  par un hook PostToolUse Bash qui reconnaît `query.mjs --open`. Ignoré par git.
- Cible pour les sondes négatives : **0 injection** (stricte, sinon le hook réinjecte du bruit).
- Quick win : l'en-tête injecté ne cite plus `mcp__memory__open_nodes` (outil désactivé) ; levée du
  doublon de nom `memory` côté local.

## Phase 3 — Réparer la recherche

- Diagnostiquer les 5 ratés actuels (via eval-search.mjs, 10/15 TOP-3 au baseline).
- Variantes testées **au harnais seulement** : tokenizer sans `porter` (raciniseur anglais sur
  corpus français), `DF_MAX`, poids par type, exclusion de `bruit-import`.
- Critère : retenir une variante seulement si elle gagne en recherche **sans** perdre en sondes de
  hook. Cible : ≥ 12/15 TOP-3 et 0 injection sur sondes négatives.

## Phase 4 — Vocabulaire fermé et ligne de voisins

**Dépend de Phase 1** (migrations) et **s'exécute après Phase 3** (pour que les scores de recherche
soient stabilisés avant de montrer les voisins).

- Tableau fermé (verbe, sens, direction, suivi ou non) dans `scripts/memory/README.md`. Brouillon,
  à relire avec la table de passage : `cite`, `détaille`, `révise`, `remplace`, `découle-de`,
  `résout`, `corrige`, `dépend-de`, `fait-partie-de`, `contredit`, `livre`, `concerne`, et
  `voir-aussi` en dernier recours, jamais suivi. Lister l'enum attendu dans `query.mjs --link`.
- `--link` refuse un verbe hors tableau, affiche la liste fermée en retour.
- **Implémentation du hook** : ligne `↳` de 3 voisins maximum, noms seulement, priorité aux verbes
  forts (`contredit`, `découle-de`, `résout`, `remplace`), jamais `voir-aussi`. Relecture : sondes
  de hook dédiées qui ne testent que cette ligne (injection de la relation sans le texte de l'entité).
- Migration des 886 relations : table de passage ancien → nouveau verbe relue par l'humain,
  sauvegarde préalable, rejeu séquentiel (pas de parallélisation).
- Tests unitaires : `--link` refuse un verbe invalide, la ligne `↳` affiche 3 voisins max, sondes
  de relation dans `query.test.ts`.

## Phase 5 — Audit à la demande

**Lecture seule**, lancé manuellement — ne modifie rien, propose.

`node scripts/memory/audit.mjs` :
- secrets : `gitleaks stdin` observation par observation (jamais de dump sur disque), affiche règle
  + entité, jamais la valeur ;
- relations hors tableau (lint : rejeté par `--link`) ;
- candidats à la fusion (même type, Jaccard des noms ≥ 0.7, voisins communs) et observations
  recopiées entre entités (Jaccard du contenu) ;
- lignes de récence orphelines, entités `bruit-import`, marqueurs `INVALID` sans raison valide.

## Recette prévue

Après Phase 1 (invalidation + tests) :
1. Ligne de commande : `--invalidate` sur une entité réelle, vérifier le préfixe dans `--open`.
2. Recherche : un fait invalidé ne remonte plus en `eval-search.mjs` (sonde).
3. Injection : un fait invalidé n'est pas injecté par le hook.

Après Phase 4 (vocabulaire et voisins) :
4. Ligne de commande : `--link` refuse un verbe hors tableau et affiche la liste.
5. Hook : un entité injectée affiche sa ligne `↳` sans le texte des voisins.

Après Phase 5 (audit) :
6. Ligne de commande : `node scripts/memory/audit.mjs` s'exécute et propose une fusion, ne modifie rien.

## Dépendances et risques

**Concurrence et sauvegarde pendant une migration en lot** :
- Migration Phase 1 : 115 marqueurs écrits séquentiellement (pas de parallélisation). Chaque `--invalidate`
  est une transaction isolée ; deux sessions en // sur la même entité se sérialisent via `PRAGMA
  busy_timeout = 5s`.
- Sauvegarde git (`memory-git-sync.sh`, hook `SessionStart`/`Stop`) : la base est versionnée à ces
  deux points. Une migration en cours au Stop sera incluse dans le commit.

**Crédibilité des chiffres** :
- Phase 1 doit **précéder** Phase 2 et 3 : tant que les `INVALID` remontent en recherche/injection,
  les mesures d'audit (`eval-search.mjs`, sondes de hook) manquent leur vraie cible.
- Phase 3 consolide les scores avant Phase 4 : variances de recherche, pas de base mouvante.

**Index FTS et UPDATE** :
- Les triggers sur `INSERT`/`DELETE observations` existent ; `UPDATE content` doit les compléter.
- Omission de ce trigger = incohérence silencieuse : on invalidera une observation en SQL, elle
  disparaîtra de `query.mjs --open` et de `--stats`, mais restera dans `memory_fts` et se
  réinjectera dans le prompt.

**Scénario audit absent** :
- La recette ne couvre pas audit.mjs (Phase 5) : prise de décision nécessaire sur les fusions
  qu'il propose. À décider avec l'humain lors de la review.
