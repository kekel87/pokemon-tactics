---
name: cloture
description: Clôt une session dans le graphe (pointeur `agenda-prochaine-etape-courante`, `historique`, agenda, questions ouvertes) et signale les documents périmés sans les corriger. À lancer sur « fin », `/status`, la case de fin de session du menu, ou avant un compactage (« note tout », « range avant de compacter »).
user-invocable: true
---

Porte sur l'état de la session. Ce que le lot a produit (décisions, implémentations) se consigne par
`/consigner` au menu, pas ici. Outils du graphe : `scripts/memory/README.md` et `query.mjs --help`.
Préfixe `PT_CLOTURE=1` sur toute écriture d'agenda (le hook `block-backlog-write.py` la refuse sinon).

## Étapes

1. Relire la session depuis la dernière clôture ou le dernier compactage : ce qui est fait (commits,
   `git log --oneline -10`, `git status --porcelain`), décisions et refus de l'humain avec leur raison,
   questions restées sans réponse, travail en cours (onglets, sous-agents), retours de joueurs relayés.
   Critère : une liste de faits, chacun avec sa source (commit, message de l'humain).
2. Ce qui n'est écrit nulle part : une décision ou un refus de l'humain absent du graphe et du plan → le
   signaler pour `/consigner` ; un retour de joueur → entité `retour` ; une question ouverte → entité
   `question-ouverte`. Critère : chaque fait de l'étape 1 a sa place nommée (graphe, plan, commit).
3. Avant d'écrire « rien en attente » : `query.mjs --type backlog` et `--type retour`, listes complètes.
4. Réécrire le pointeur `agenda-prochaine-etape-courante`, nom stable, jamais un agenda daté de plus :
   `--forget` sur l'ancienne ligne « À FAIRE MAINTENANT » (fragment copié depuis `--open`, entre
   guillemets), puis `--add` de la nouvelle, avec ce qui vient de se faire.
   Critère : `--open agenda-prochaine-etape-courante` montre une seule ligne « À FAIRE MAINTENANT », juste.
5. Une entité `historique-<date>-<sujet>` : date, ce qui a été fait, ce qui a été décidé en chemin (en
   renvoyant aux entités), reliée au pointeur. Un agenda reporté : `PT_CLOTURE=1 … --add agenda`. Un
   agenda périmé : `--invalidate`, jamais un avertissement écrit au-dessus.
6. Documents périmés (roadmap, architecture, plans, CLAUDE.md) : les lister à l'humain, ne pas les corriger.
7. Rapport en une ligne par écriture (entité, type), puis les documents signalés. Rien dans le graphe hors
   `historique`, `agenda`, `retour`, `question-ouverte`.

## Garde-fous

- `--forget` ne sert qu'à réécrire le pointeur ; un fait faux s'invalide.
- Rien en `backlog` sans accord explicite de l'humain.
- Ne documenter que ce qui est fait, chaque observation datée.
