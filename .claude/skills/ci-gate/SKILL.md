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

Tiers : `fast` = lint:fix → typecheck → test · `full` = + build + test:integration + **e2e `affected`** (niveau choisi d'après le diff, cf plan 170 : L1 smoke / L2 affected / L3 full, escalade auto si cross-cutting) · `slow` = + test:all (scenario) + **e2e `full`** (les 349, filet pré-release).

`pnpm lint:fix` peut modifier des fichiers (autofix Biome) — c'est attendu, ne les revert pas.

## Rapport final — format STRICT

Ton dernier message est le seul contenu visible par l'appelant. Il contient, dans cet ordre :

1. **Sur succès** : la ligne `CI VERDICT: pass — <tier>` et rien d'autre d'essentiel (1 ligne de durée OK).
2. **Sur échec** :
   - La ligne `CI VERDICT: fail — <step> (<tier>)`
   - L'extrait d'erreur pertinent **verbatim** (10-30 lignes max : le test cassé, l'erreur tsc, la règle Biome) — pas le log entier.
   - Le hint de fix imprimé par le script.
   - La ligne suggestion copy-paste : `/goal /ci-gate passes (CI VERDICT: pass), or stop after 15 turns`

Pas de retry, pas de fix toi-même : tu rapportes, l'appelant décide. Verdict `fail` → l'appelant **stoppe la chaîne** (pas de `/commit`).
