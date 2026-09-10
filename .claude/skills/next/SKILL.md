---
name: next
description: Reconstitue l'état du projet depuis le graphe de mémoire et propose la prochaine étape.
---

**D'abord** : `pnpm e2e:status` — la suite e2e complète tourne en asynchrone sur GitHub et ne
bloque plus rien, donc personne ne voit son verdict si on ne le lit pas. Rouge → tu le dis en
premier, avant l'agenda. Détail dans le skill `/e2e-status`.

**Ensuite** : `git fetch origin`, puis compare `main`, `origin/main` et les branches locales.
Origine de cette règle : une session est repartie sur un `main` en retard de 2 commits, a relu des
docs périmées et a commencé à réimplémenter un plan déjà livré.

## L'état vient du graphe de mémoire, plus de fichiers

`STATUS.md` et `docs/next.md` n'existent plus : leur contenu est dans le graphe (plan 200).

### 🔴 Commence TOUJOURS par le pointeur, jamais par une recherche

```bash
node scripts/memory/query.mjs --open agenda-prochaine-etape-courante
```

**Nom stable, réécrit à chaque fin de session : c'est le seul endroit qui dit où on en est.** Tout
le reste du graphe est de l'histoire.

⚠️ **Ne cherche pas « la prochaine étape » par mots-clés.** Ça ne marche pas, et l'échec est
silencieux : le 2026-09-10, une session neuve a interrogé « à faire maintenant prochaine action »
et est tombée sur `agenda-2026-09-06-prochaine-etape` et `agenda-2026-09-08-prochaine-etape`, tous
deux périmés — le premier réclamait un commit fait depuis quatre jours. La file de sessions écrite
le matin même était, elle, **introuvable** : son nom ne contenait aucun de ces mots. Ce qu'on
cherche — « le plus récent » — n'est pas un mot, donc aucune recherche plein-texte ne le trouvera.
Les entités périmées portent désormais un `⛔ PÉRIMÉ` en tête ; si tu en croises une, ne la suis pas.

### Ensuite seulement, pour creuser un sujet

2 à 4 mots-clés distinctifs, jamais une phrase :

```bash
node scripts/memory/query.mjs --stats
node scripts/memory/query.mjs "reporté backlog technique"
node scripts/memory/query.mjs --open <nom-d-entité>
```

Types d'entités utiles ici : `agenda` (l'agenda persistant), `historique` (le journal de session),
`backlog` (dette ouverte), `decision` (les ~930 décisions numérotées), `feedback` (les règles de
travail données par l'humain).

🔴 **Le mode recherche tronque les observations.** Dès qu'une entrée compte, relis-la avec `--open`,
sinon tu perds la fin — c'est comme ça qu'on rate un chiffre.

Lis ensuite, seulement si le sujet l'exige : `docs/roadmap.md` (phases), `docs/plans/README.md`
(index des plans), et le plan en cours s'il y en a un (`in-progress` ou `ready`).

## Présente

**1. À faire maintenant** — l'item principal de l'agenda, croisé avec la roadmap et le plan en cours.
Recommande l'action prioritaire.

**2. Reporté / à refaire** — les entités `agenda` et `backlog` encore ouvertes. Si rien, le dire.

**3. Fait récemment** — 3 à 5 items. Croiser avec `git log -5` pour repérer les incohérences.

**4. Bloquants** — questions à trancher avant de démarrer, si applicable.

Concis : 10-15 lignes au total.

---

**Note** : le menu post-impl multi-select est déclenché par la règle `## Après impl` de `CLAUDE.md`,
pas par ce skill. Pas besoin de retaper `/next` après du code.
