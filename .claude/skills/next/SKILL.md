---
name: next
description: Lit docs/next.md (agenda persistant), STATUS, roadmap et plan en cours. Propose la prochaine étape, OU si impl en cours présente menu multi-select pour la chaîne de finalisation.
user-invocable: true
---

## Mode A — Pas d'impl en cours (workflow standard)

Détection : `git status --porcelain` vide OU seulement fichiers non liés au code (docs, plans).

Lis dans cet ordre :

1. **`docs/next.md`** — agenda persistant (à faire / reporté / fait récemment)
2. `STATUS.md` — état actuel du projet
3. `docs/roadmap.md` — phases et tâches
4. `docs/backlog.md` — bugs connus et feedback non traités
5. `docs/plans/README.md` — index des plans
6. Le plan en cours s'il y en a un (statut `in-progress` ou `ready`)

Présente :

**1. À faire maintenant** — item principal de `docs/next.md`, croisé avec roadmap et plan en cours. Recommande l'action prioritaire.

**2. Reporté / à refaire** — section éponyme de `docs/next.md`. Si vide, le dire.

**3. Fait récemment** — 3-5 derniers items. Croiser avec `git log -5` pour repérer les incohérences.

**4. Bloquants** — questions à trancher avant de démarrer, si applicable.

Concis : 10-15 lignes max au total.

Si `docs/next.md` est vide ou obsolète (fait récent ne correspond pas aux commits), propose une MAJ.

## Mode B — Impl en cours (menu post-impl)

Détection : `git status --porcelain` contient fichiers `.ts`, `.tsx`, `.json` (data), assets, ou tests modifiés/ajoutés non commit.

Présente le menu multi-select via `AskUserQuestion` avec étapes **pré-sélectionnées selon contexte** :

```
Impl détectée : <résumé 1 ligne des fichiers changés>

Étapes à lancer (multi-select) :
  [x] core-guardian       (si packages/core/** touché)
  [x] code-reviewer       (toujours si diff significative)
  [x] doc-keeper          (si STATUS/docs/decisions impactés)
  [ ] visual-tester       (si packages/renderer/** touché — coûteux, à demander)
  [x] gate CI             (`/ci-gate` — lint+typecheck+build+test+integration)
  [x] commit-message      (`/commit` — génère titre, n'exécute PAS le commit)
```

Règles pré-sélection (auto-cochage) :
- `core-guardian` : coché si `git diff --name-only HEAD` matche `packages/core/`
- `code-reviewer` : coché si >50 lignes changées OU nouveau fichier source
- `doc-keeper` : coché si nouvelle mécanique, nouveau Pokemon/move/ability, ou changement structurel
- `visual-tester` : **jamais auto-coché** — l'humain décide (≥2 min Playwright)
- `gate CI` : coché par défaut sauf si déjà passé dans le tour
- `commit-message` : coché par défaut

### Ordre d'exécution (fixe, peu importe l'ordre de sélection)

| Ordre | Étape | Stop si fail |
|-------|-------|--------------|
| 1 | `core-guardian` | Oui (dep UI dans core = bloquant) |
| 2 | `code-reviewer` | Oui si **Critical** |
| 3 | `doc-keeper` | Non (juste rapport) |
| 4 | `visual-tester` | Oui si régression visuelle |
| 5 | `gate CI` (`/ci-gate`) | Oui (BLOQUANT — pas de commit sans CI verte) |
| 6 | `commit-message` (`/commit`) | N/A (output seulement, jamais commit auto) |

### Stop conditions

Arrêt et attente de l'humain quand :
- `core-guardian` détecte dep UI dans core
- `code-reviewer` retourne **Critical** (sécurité, perf, design fondamental)
- `gate CI` échoue → affiche logs + suggère fix
- `visual-tester` détecte régression
- Ambiguïté → poser question

**Jamais commit/push automatique.** `commit-message` génère le titre ; l'humain copie-colle pour commit.

## Mode C — Plan rédaction en cours

Si fichier `docs/plans/*-name.md` non commit avec statut `draft` :

Présente menu réduit :
```
Plan en rédaction : <nom>

Étapes :
  [x] plan-reviewer
  [ ] game-designer       (si mécaniques jeu)
  [ ] humain validation   (toujours dernier, manuel)
```

## Mode D — Session fin (humain dit "fin de session", "/status", ou explicite)

Présente :
```
Fin de session :
  [x] session-closer      (MAJ STATUS.md + croisement backlog)
  [x] gate CI
  [x] commit-message
```
