---
name: review
description: Lance une review de code sur les changements en cours
user-invocable: true
allowed-tools:
  - read_file
  - grep
  - bash
  - task
---

Lance le subagent `code-reviewer` sur les changements actuels.

1. Regarde `git diff` et `git diff --staged` pour identifier les fichiers modifies
2. Si aucun changement, regarde le dernier commit (`git diff HEAD~1`)
3. Delegue la review au subagent `code-reviewer`
4. Affiche le rapport a l'humain

Si des fichiers dans `packages/core/` ont change, lance aussi le subagent `core-guardian` en parallele.
Si des fichiers dans `packages/renderer/` ont change, lance aussi le subagent `visual-tester` en parallele (si le dev server est lance).
