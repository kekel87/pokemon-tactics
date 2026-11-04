# Plan 244 : Replier une partie des sous-agents en skills

**Statut** : en cours (replis 1 à 3 et 5 faits le 2026-11-04, repli 4 refusé par la mesure), dans l'onglet `pokemon-sous-agents`, un agent à la fois.
**Origine** : mission du pilote `assistant`, validée par l'humain le 2026-11-02 ; question ouverte « plan de repli des sous-agents » → oui.
Graphe : `agenda-replier-sous-agents-en-skills`.

## Ce que tu verras à l'écran

- Moins d'attente en fin de lot : la consignation, le message de commit et la relecture de plan se font dans le tour, sans agent qui repart à froid.
- Le menu de finalisation propose les mêmes cases, avec des noms qui ne changent pas pour toi.
- La liste d'agents passe de 22 à environ 12 ; ceux qui restent ont une raison écrite (regard indépendant, travail parallèle, contexte lourd).
- Chaque repli est livré seul, avec un avant/après sur les cas de référence ci-dessous.

## Pourquoi

Article Anthropic (veille du 2026-10-31) : un agent unique avec des skills fait souvent mieux qu'une douzaine de
spécialistes (qualité, coût, ~2× plus rapide). On ne garde un sous-agent que si (a) le contexte saturerait le tour
principal, (b) le travail est parallèle et jetable, (c) les consignes contrediraient celles du tour principal
(regard indépendant). Au-delà de 30-50 outils, le choix d'outil se dégrade.

## Usage réel (lancements depuis le 2026-09-01, transcriptions locales)

| Agent | Lancements | Agent | Lancements |
|---|---|---|---|
| doc-keeper | 62 | wiki-keeper | 10 |
| code-reviewer | 60 | publisher | 8 |
| test-writer | 56 | data-miner | 6 |
| plan-reviewer | 52 | best-practices | 6 |
| session-closer | 46 | commit-message | 0 |
| game-designer | 42 | ai-player, asset-manager, debugger, dependency-manager, feedback-triager, level-designer, move-pattern-designer, performance-profiler, sandbox-json, visual-tester | 0 |
| core-guardian | 22 | | |

Chiffres bruts (chaque appel peut figurer deux fois dans une transcription) : seul l'ordre de grandeur compte.

## Cas de référence (à rejouer avant et après chaque repli)

Mesures pour chaque cas : critères cochés (qualité), tokens consommés, durée, interventions de l'humain.
Mesure « avant » = l'agent actuel, sur le même commit de départ.

| # | Tâche | Agent actuel | Résultat attendu (critères) |
|---|---|---|---|
| 1 | Message de commit du diff du plan 243 (abandons dans le replay) | commit-message | Conventional commit, titre seul ≤72 car., 1 scope max sinon aucun, en français, fidèle au diff |
| 2 | Vérifier le core après le diff de `c9bced18` (Garde Large / Roche Chaude), puis sur une copie où un import `@babylonjs` est planté dans `packages/core` | core-guardian | Diff propre → « aucune anomalie détectée… non exhaustif » ; import planté → signalé avec fichier:ligne |
| 3 | Relire `docs/plans/243-abandons-dans-le-replay.md` | plan-reviewer | Vérifie la section « Ce que tu verras à l'écran », critères testables, fichiers cités existants ; aucune réécriture hors périmètre |
| 4 | Consigner le lot du plan 242 (replay partageable) | doc-keeper | Entités `decision`/`implémentation` créées et reliées, roadmap à jour ; aucune entité `historique` ni `agenda` ; pas de doublon d'entité existante |
| 5 | Clôture de session après le lot 243 | session-closer | `historique` + pointeur `agenda-prochaine-etape-courante` à jour ; documents périmés signalés, pas corrigés ; aucune `decision` écrite |
| 6 | Mettre le wiki à jour après le correctif Garde Large bloquée par les murs | wiki-keeper | Page mécanique alignée sur le code, noms FR officiels, rien publié sans accord |
| 7 | Bonnes pratiques : encoder un replay dans une URL partageable (taille, compression, versionnage) | best-practices | Sources citées et datées, recommandation unique, comparaison avec ce que fait le plan 242 |
| 8 | Config sandbox depuis « Garde Large face à Séisme, lanceur derrière un mur » | sandbox-json | JSON valide, chargé sans erreur par la sandbox, scénario conforme à la description |
| 9 | Revue d'équilibre de Roche Chaude sous Zone Magique | game-designer (gardé, témoin) | Analyse cohérente avec `packages/data` ; sert de témoin : ne doit pas se dégrader quand le contexte principal s'allège |
| 10 | Revue du diff du plan 243 avant commit | code-reviewer (gardé, témoin) | Mêmes trouvailles qu'aujourd'hui ; vérifie que les replis n'ont pas retiré de règle dont il dépend |

## Proposition

### Replier en skill (tour principal)

| Agent | Raison | Devient |
|---|---|---|
| commit-message | 0 lancement ; le skill `/commit` existe déjà, le tour principal a le contexte du lot | fusionné dans `/commit` |
| core-guardian | Vérification mécanique (imports interdits) ; un script la fait mieux qu'un modèle | script dans `/ci-gate` + ligne dans `/menu` |
| plan-reviewer | Le tour principal vient d'écrire le plan : repartir à froid coûte sans apporter de regard neuf utile (le regard neuf, c'est `game-designer`) | skill `/relire-plan` |
| session-closer | Le tour principal sait ce qui s'est passé dans la session ; l'agent le reconstitue | skill `/cloture` (appelé par `/status`) |
| doc-keeper | Idem, sur le contenu du lot ; supprime le conflit d'écriture avec `session-closer` | skill `/consigner` |
| wiki-keeper | Toujours lancé après `doc-keeper`, jamais en parallèle | étape finale de `/consigner` |
| best-practices | Recherche web ponctuelle, peu de contexte | skill `/bonnes-pratiques` |
| sandbox-json | Déjà appelé depuis `/recette` | fusionné dans `/recette` |

### Garder en sous-agent

`code-reviewer`, `game-designer` (regard indépendant) · `test-writer` (parallèle au menu, gros volume) ·
`visual-tester`, `debugger`, `performance-profiler` (sorties lourdes : captures, traces) · `data-miner`,
`asset-manager`, `level-designer`, `move-pattern-designer` (consignes longues et spécialisées, rarement utiles au tour
principal) · `publisher` (deux phases, relance).

### Supprimer (décision de l'humain, 2026-11-02)

`ai-player`, `dependency-manager`, `feedback-triager` : 0 lancement depuis septembre. Le skill `/itch-feedback` qui appelle `feedback-triager` est à adapter au moment de la suppression.

## Ordre

Un repli à la fois, du moins risqué au plus central, chacun mesuré sur ses cas avant de passer au suivant :
1. `commit-message` (cas 1) → 2. `core-guardian` (cas 2) → 3. `sandbox-json` (cas 8) → 4. `best-practices` (cas 7)
→ 5. `plan-reviewer` (cas 3) → 6. `session-closer` (cas 5) → 7. `doc-keeper` + `wiki-keeper` (cas 4, 6).
Cas 9-10 rejoués après les étapes 5 et 7.

Chaque repli met à jour CLAUDE.md (table des agents, parallélisme) et les skills qui appellent l'agent (`/menu`, `/next`, `/publish`, `/commit`, `/recette`).
Critère d'arrêt : un cas qui perd un critère → on garde l'agent et on note pourquoi au graphe.

## Ajouts du plan 245 (méthode agents, 2026-11-02)

- Section 4 de la méthode : les agents gardés ne déclarent plus de `tools:`, sauf les relecteurs (`code-reviewer`, `game-designer`) ; chaque délégation nomme son modèle (hook `require-agent-model.py`).
- `/memo` (sauver avant compactage ce qui n'est écrit nulle part) se fond dans le skill `/cloture` issu de `session-closer`.
- Revue unique : `code-reviewer`, `/code-review` et `review-local` se recoupent ; une seule commande au menu, qui nomme le commit relu.
- Les gros agents gardés (`level-designer` 316 lignes, `publisher` 246) se découpent par branche : le commun dans le fichier, le reste dans des fichiers voisins derrière un pointeur.

## Journal

### Repli 1 : `commit-message` → `/commit` (2026-11-04)

Cas 1 rejoué sur le commit `4ace5eb1` (titre réel : « feat: abandons rejoués dans le replay, partage en ligne »).

| | Avant (agent haiku) | Après (tour principal) |
|---|---|---|
| Titre | `feat: abandons rejoués dans le replay, partage en ligne (plan 243)` | `feat: abandons rejoués dans le replay, partage en ligne` |
| Critères (conventional, ≤72, scope, français, fidèle) | 5/5 | 5/5 |
| Coût | 16 815 tokens, 2 appels, 9,8 s | ≈ 2,3 Ko lus (stat + log), 2 appels, pas de démarrage à froid |
| Interventions humaines | 0 | 0 |

L'agent disait « anglais uniquement » contre l'usage du dépôt ; il a suivi le log par chance. Le skill fixe le
français. Mesure « après » faite dans le même tour que la mesure « avant » : le titre n'est pas aveugle, seul le
coût compte ici. Fichiers : `.claude/skills/commit/SKILL.md` réécrit, `.claude/agents/commit-message.md` retiré,
mentions mises à jour dans `docs/architecture.md`, `docs/methodology.md`, `.claude/agents/session-closer.md`.

### Repli 2 : `core-guardian` → `pnpm audit:core` (2026-11-04)

Cas 2 rejoué sur `c9bced18`, propre puis avec `import { Vector3 } from "@babylonjs/core"` planté en
`battle/ability-handler-registry.ts:4`.

| | Avant (agent haiku) | Après (`scripts/check-core-purity.mjs`) |
|---|---|---|
| Diff propre | aucune violation, formule « Core pur » puis « non exhaustif » | « aucune anomalie détectée par les règles connues (non exhaustif) », exit 0 |
| Import planté | signalé, fichier:ligne | signalé, fichier:ligne, exit 1 |
| Coût | 20 920 + 23 160 tokens, 6 + 10 appels, 16 s + 22 s | 0 token, environ 150 ms par passe |

Le script part d'une liste blanche : le code de jeu n'importe que des chemins relatifs, les tests et
`src/testing/` ont droit à `vitest`, `node:*` et `@pokemon-tactic/data`. Il refuse aussi les globales DOM, les
timers et `console.*` hors tests, ainsi que toute dépendance dans `packages/core/package.json`. Commentaires et
chaînes sont neutralisés : les « window » des commentaires, qui sont des fenêtres de tour, ne sont plus des
faux positifs. Contrôle en plus sur une copie piégée (import de type, import dynamique, `setTimeout`, `window`,
dépendance) : 5 violations sur 5 trouvées, et le texte dans une chaîne n'est pas signalé.
Limite : l'agent relevait aussi, hors règles, que `@pokemon-tactic/data` est importé par `src/testing/` sans être
déclaré ; le script ne fait pas ce genre de remarque.

Fichiers : script ajouté, `audit:core` dans `package.json` et dans les trois modes de `/ci-gate`, agent retiré,
mentions mises à jour dans `/menu`, `review-local`, `code-reviewer`, le hook `remind-post-impl-menu.py`,
`rules/style.md`, `docs/methodology.md`, `docs/architecture.md`.

### Repli 3 : `sandbox-json` → `/recette` + `pnpm sandbox:check` (2026-11-04)

Cas 8 : « Garde Large face à Séisme, lanceur derrière un mur ».

| | Avant (agent haiku) | Après (tour principal, `config-sandbox.md`) |
|---|---|---|
| JSON valide | oui | oui |
| Chargé sans erreur | oui, vérifié après coup par `sandbox:check` ; l'agent ne pouvait pas le vérifier | oui, `CHARGÉ SANS ERREUR`, cases et orientations lues |
| Conforme | oui : carte `sandbox-los`, Électrode couvre, le pilier (3,3) coupe la couverture de Ronflex, Séisme vient de face | oui, même scénario, parti de la fixture `WIDE_GUARD_WALL_BLOCKS_COVER` |
| Coût | 49 678 tokens, 14 appels, 48 s | environ 1 Ko lu, 1 appel au vérificateur (0,6 s) |

L'agent s'est trompé deux fois dans son explication, sans effet sur la config : `rhydon` appelé
« Rhinocorne » (c'est Rhinoféros) et Séisme décrit comme touchant les cases adjacentes (règle Showdown) alors
qu'ici c'est une zone de rayon 2 autour du lanceur. Sa table de champs ignorait la forme `teams`, la carte et les
positions, et ses exemples dataient d'avant le roster jouable. Le vérificateur rejette un move inconnu, un Pokemon
hors roster et un Pokemon déplacé de la case demandée ; il a montré au passage que la note « pas Pikachu » de
`test-writer` était périmée.
Fichiers : `scripts/check-sandbox-config.ts` (+ `sandbox:check`, tsconfig des scripts),
`.claude/skills/recette/config-sandbox.md`, étape 2 de `/recette`, agent retiré, mentions dans `test-writer`,
`visual-tester`, `docs/architecture.md`, README de `packages/data/sandbox-configs`.

### Repli 4 : `best-practices` gardé en sous-agent (2026-11-04)

Cas 7 : encoder un replay dans une URL partageable. La mesure « après » a été faite à l'aveugle, avant de lire
la réponse de l'agent.

| | Avant (agent sonnet) | Après (tour principal, skill `/bonnes-pratiques` d'essai) |
|---|---|---|
| Sources citées et datées | oui, presque toutes datées (MDN, compat-data, WHATWG, zlib, Showdown) | partiel : 4 sources, 2 sans date |
| Recommandation unique | oui (garder le format, revoir la garde de version) | oui (garder le format, plafonner la décompression) |
| Comparaison avec le plan 242 | oui, au niveau du code : 6 écarts nommés avec fichier:ligne | oui, au niveau du plan : 3 écarts |
| Coût | 111 505 tokens, 68 appels, 5 min 50 s | 3 recherches, 3 pages, 5 lectures de code, dans le contexte principal |

Critère d'arrêt atteint : le cas perd un critère et beaucoup de profondeur. La recherche lit beaucoup (pages web,
code de référence) et c'est cette lecture qui fait la qualité : la faire dans le tour coûte autant de contexte que
l'agent, et le tour est tenté de la raccourcir. Raison (a) de la section « Pourquoi » : on garde l'agent.
Le skill d'essai n'est pas commité.
Décision au graphe : `decision-1191`.

### Repli 5 : `plan-reviewer` → `/relire-plan` (2026-11-04)

Cas 3 : relire `docs/plans/243-abandons-dans-le-replay.md`. Le plan est déjà clos : les deux relectures l'ont
pris tel quel. L'agent a travaillé sur une copie de travail, pour pouvoir vérifier qu'il ne réécrivait rien.
Mesure « après » faite à l'aveugle.

| | Avant (agent haiku) | Après (tour principal, `/relire-plan`) |
|---|---|---|
| Section « Ce que tu verras à l'écran » | non examinée (absente de sa consigne) | examinée : présente, observable, mais placée après le tableau d'écarts |
| Critères testables | non examinés comme tels (a relevé que la recette à 3 camps n'a pas été faite) | « reprise sans divergence » sans moyen de constat (l.145) |
| Fichiers cités existants | oui, avec en plus les lignes périmées une par une | oui, tous présents ; lignes périmées relevées (normal après le dev) |
| Aucune réécriture hors périmètre | oui (copie intacte) | oui |
| Coût | 43 603 tokens, 13 appels, 34 s | environ 11 Ko lus (le plan), 2 commandes, décisions ouvertes au graphe |

L'agent suivait un gabarit périmé : en-tête YAML, `docs/plans/README.md` comme index, et « un plan clos sort du
dossier ». Il a aussi proposé de déplacer le plan dans le graphe, ce qui sort du périmètre. Les deux ont relevé la
vérification télémétrie/salon jamais faite (l.17, l.138). La recherche des fichiers cités est une commande du
skill.
Fichiers : `.claude/skills/relire-plan/SKILL.md`, agent retiré, mentions dans `/next`, `/menu`,
`docs/methodology.md`, `docs/architecture.md`.
