# scripts/memory/ — outils du graphe de mémoire

La mémoire du projet (décisions, plans terminés, historique, dette, retours) vit dans un
**graphe SQLite**, plus dans des fichiers markdown. Voir le plan 200.

## Outils vivants

| Fichier | Rôle |
|---|---|
| `query.mjs` | **Le point d'entrée.** Lecture (`"mots clés"`, `--open`, `--stats`), écriture (`--add`, `--link`, `--resolve`, `--retype`) et **suppression** (`--forget`, `--forget-all`). `--help` pour le détail |
| `forget-guards.mjs` | Les gardes de `--forget`/`--forget-all`, **pures** (aucun accès disque, aucun `process.exit`) — sorties de `query.mjs` pour rester testables. Couvertes par `query.test.ts` |
| `paths.mjs` | Résolution **unique** du chemin de la base, déduite de `CLAUDE_CONFIG_DIR`. Surcharges : `PT_MEMORY_HOME`, `PT_MEMORY_VENDOR` |
| `import.mjs` | Chargement en masse d'un JSON `{entities, relations}` |
| `set-recency.py` | Alimente la table de récence et force la reconstruction de l'index FTS. À rejouer après un import en masse |
| `eval-search.mjs` | **Harnais d'évaluation** : 15 questions réelles, score TOP-3. C'est lui qui a permis de mesurer les réglages au lieu de les supposer — et d'écarter trois pistes plausibles mais fausses |

Aucune variable d'environnement n'est requise : tout se déduit de `CLAUDE_CONFIG_DIR`.

```bash
node scripts/memory/query.mjs "llvmpipe rasteriseur"
node scripts/memory/query.mjs --open decision-924
node scripts/memory/eval-search.mjs        # non-régression du classement
```

## Solder une entrée : `--resolve`, jamais une observation seule

```bash
node scripts/memory/query.mjs --resolve backlog-machin "Soldé par le plan 210, decision-1042."
```

`--resolve` consigne la clôture **et** bascule le type (`backlog` → `backlog-résolu`,
`question-ouverte` → `question-résolue`) dans une seule transaction. `--retype` fait la bascule
seule, pour un cas délibéré.

🔴 **Ajouter une observation « ✅ RÉSOLU » ne solde rien** : l'entrée reste comptée ouverte par
`--stats` et par toute reprise de session. C'est arrivé à **24 entrées de backlog**, certaines
pendant deux mois — voir `decision-1035`. La cause n'était pas la négligence : jusqu'au
2026-09-14, l'outil ne savait qu'ajouter, donc la conclusion était hors de portée.

## 🔴 `--forget` — le seul geste destructeur

```bash
node scripts/memory/query.mjs --forget <entité> "une phrase entière copiée depuis --open"
node scripts/memory/query.mjs --forget-all <entité> "<fragment>"   # plusieurs, assumé
```

Retire des observations. Le fragment est une **sous-chaîne exacte**, sensible à la casse et aux
accents — copiez le texte depuis `--open`, ne le retapez pas.

Gardes, toutes en refus avec code 1 : fragment de moins de 10 caractères utiles ; argument
surnuméraire (le fragment doit être **entre guillemets** : sans elles, `--forget-all x le plan 42`
réduisait le fragment à `le`) ; fragment qui vide l'entité — une entité sans observation reste
indexée et ressort en recherche, muette ; plus de 5 correspondances sur `--forget-all`. Tout ce
qui est retiré est **réimprimé en entier** avant de l'être.

**Rattrapage** : la base est versionnée par `.claude/hooks/memory-git-sync.sh`, donc un retrait
regretté se récupère à la granularité de la sauvegarde — la commande est rappelée dans la sortie
de `--forget`.

## Ce qui n'est plus là

Les six extracteurs de migration (`parse-decisions.py`, `extract.py`, `extract-prose.py`,
`extract-plans.py`, `extract-automemory.py`, `extract-roadmap.py`) ont été **supprimés** : leurs
sources — `docs/decisions.md`, `STATUS.md`, `docs/next.md`, les 198 plans… — n'existent plus, donc
ils ne pouvaient plus s'exécuter. Mille lignes de code mort.

Ils restent dans l'historique git si la migration devait être rejouée :

```bash
git log --diff-filter=D -- scripts/memory/     # trouver le commit
git show <commit>^:scripts/memory/extract-prose.py
```

⚠️ `extract-roadmap.py` réécrivait `docs/roadmap.md` **en place et sans être idempotent** : rejoué
sur une roadmap déjà raccourcie, il vidait la table « Ce qui est fait ». Si tu le ressors de
l'historique, ajoute-lui une garde avant de le lancer.

## Où sont les données

La base n'est **pas** dans ce dépôt (il est public, le graphe contient du personnel). Elle vit sous
`$CLAUDE_CONFIG_DIR/memory/pokemon-tactics/` et se synchronise vers un **dépôt privé** dédié, via
`.claude/hooks/memory-git-sync.sh` (`Stop` et `SessionStart`). L'adresse du dépôt est dans
`PT_MEMORY_REMOTE`, définie dans les réglages personnels — jamais ici.
