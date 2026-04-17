---
name: next
description: Lit docs/next.md (agenda persistant), STATUS, roadmap et plan en cours. Propose la prochaine étape et affiche ce qui est reporté / récemment fait.
user-invocable: true
---

Lis dans cet ordre :

1. **`docs/next.md`** — agenda persistant (à faire / reporté / fait récemment)
2. `STATUS.md` — état actuel du projet
3. `docs/roadmap.md` — phases et tâches
4. `docs/backlog.md` — bugs connus et feedback non traités
5. `docs/plans/README.md` — index des plans
6. Le plan en cours s'il y en a un (statut `in-progress` ou `ready`)

Présente dans cet ordre :

**1. À faire maintenant** — item principal de `docs/next.md`, croisé avec roadmap et plan en cours. Recommande l'action prioritaire.

**2. Reporté / à refaire** — section éponyme de `docs/next.md`. Si vide, le dire.

**3. Fait récemment** — 3-5 derniers items. Croiser avec `git log -5` pour repérer les incohérences.

**4. Bloquants** — questions à trancher avant de démarrer, si applicable.

Sois concis : 10-15 lignes max au total.

Si `docs/next.md` est vide ou obsolète (fait récent ne correspond pas aux commits), propose une MAJ.
