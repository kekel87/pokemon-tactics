---
name: review
description: Lance une review de code sur les changements en cours
user-invocable: true
---

Lance l'agent `code-reviewer` sur les changements actuels.

1. Regarde `git diff` et `git diff --staged` pour identifier les fichiers modifiés
2. Si aucun changement, regarde le dernier commit (`git diff HEAD~1`)
3. Délègue la review à l'agent `code-reviewer`
4. Affiche le rapport à l'humain

Si des fichiers dans `packages/core/` ont changé, lance aussi l'agent `core-guardian` en parallèle.
Si des fichiers dans `packages/renderer/` ont changé, lance aussi l'agent `visual-tester` en parallèle (si le dev server est lancé).
