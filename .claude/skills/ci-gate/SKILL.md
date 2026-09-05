---
name: ci-gate
description: Run le gate CI local (lint, typecheck, build, tests, tests:integration). BLOQUANT avant commit. Fail-fast avec hint de fix.
argument-hint: "[fast|full|slow]"
user-invocable: true
context: fork
agent: general-purpose
---

Tu exécutes le gate CI local du projet (sortie verbeuse confinée ici — seul ton rapport final remonte dans la conversation).

## Exécution

Lance (tier passé en argument, défaut `full`) :

```bash
bash .claude/skills/ci-gate/run.sh ${ARGUMENTS:-full}
```

Tiers :

| Tier | Contenu | Budget |
|---|---|---|
| `fast` | lint:fix → typecheck → test → test:integration, **avec le tour des écrans lancé en parallèle** (`e2e/tests/smoke`) | **boucle d'itération** |
| `full` | + build + test:scenario + **e2e `affected`** (niveau choisi d'après le diff : L1 smoke / L2 affected / L3 full) | point de contrôle |
| `slow` | + test:all (scenario) + **e2e complet** (les 531) | filet pré-release |

`fast` superpose le tour des écrans aux vérifications statiques : le tour attend un navigateur
pendant que lint/typecheck/vitest prennent des cœurs, donc les deux attentes se recouvrent au lieu
de s'additionner. Un échec du tour arrête le gate comme n'importe quelle étape.

Depuis le 2026-09-05, `affected` route par **famille de code → famille de specs** au lieu de
n'avoir qu'un cran « je ne sais pas scoper → je lance tout » : toucher au salon en ligne ne rejoue
plus les 218 specs de mécanique. Le tour des écrans est le plancher, toujours joint.

`pnpm lint:fix` peut modifier des fichiers (autofix Biome) — c'est attendu, ne les revert pas.

## Ressources machine (2026-08-25)

L'humain travaille et joue sur cette machine pendant le gate. L'e2e passe donc par
`scripts/with-cpu-cap.sh` (plafond noyau : 4 cœurs sur 16, 8 Go, priorité basse) et 3 workers — le
tier `full` reste `affected`, jamais `pnpm test:e2e` en direct. Un run long se lance **en tâche de
fond** pour pouvoir être arrêté dès qu'il réclame sa machine. `PT_FULL_SPEED=1` débride, uniquement
s'il l'a demandé. Détails : `.claude/rules/e2e.md` § Ressources machine.

## Rapport final — format STRICT

Ton dernier message est le seul contenu visible par l'appelant. Il contient, dans cet ordre :

1. **Sur succès** : la ligne `CI VERDICT: pass — <tier>` et rien d'autre d'essentiel (1 ligne de durée OK).
2. **Sur échec** :
   - La ligne `CI VERDICT: fail — <step> (<tier>)`
   - L'extrait d'erreur pertinent **verbatim** (10-30 lignes max : le test cassé, l'erreur tsc, la règle Biome) — pas le log entier.
   - Le hint de fix imprimé par le script.
   - La ligne suggestion copy-paste : `/goal /ci-gate passes (CI VERDICT: pass), or stop after 15 turns`

Pas de retry, pas de fix toi-même : tu rapportes, l'appelant décide. Verdict `fail` → l'appelant **stoppe la chaîne** (pas de `/commit`).
