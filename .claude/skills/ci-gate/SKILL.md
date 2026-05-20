---
name: ci-gate
description: Run le gate CI local (lint, typecheck, build, tests, tests:integration). BLOQUANT avant commit. Fail-fast avec hint de fix.
argument-hint: "[fast|full|slow]"
user-invocable: true
---

Mirror la gate BLOQUANTE de CLAUDE.md en local pour éviter ping-pong sur lint/typecheck/test cassés. Backed by `.claude/skills/ci-gate/run.sh`.

## Usage

```bash
bash .claude/skills/ci-gate/run.sh          # full (défaut)
bash .claude/skills/ci-gate/run.sh fast     # skip build + integration
bash .claude/skills/ci-gate/run.sh slow     # + test:scenario via test:all
```

## Tiers

| Tier | Commandes |
|------|-----------|
| `fast` | `lint:fix` → `typecheck` → `test` |
| `full` (défaut) | `lint:fix` → `typecheck` → `build` → `test` → `test:integration` |
| `slow` | `lint:fix` → `typecheck` → `build` → `test:all` (unit + integration + scenario) |

## Comportement

1. Exécute fail-fast (`set -e` esprit, sortie immédiate sur erreur).
2. Sur fail : affiche hint de fix contextualisé (lint:fix, typecheck, test…).
3. Exit code non-zéro → bloque la suite (`/commit`, push).

## Quand l'utiliser

- Avant chaque `/commit` (étape obligatoire de la chaîne `/next` mode B).
- Après refacto significative pour vérifier régressions.
- Avant push sur main (rappel : push manuel humain uniquement).

## Output

Affiche la sortie verbatim. Sur échec, surface le hint et **stop la chaîne** (pas de `/commit`).
