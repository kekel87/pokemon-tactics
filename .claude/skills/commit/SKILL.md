---
name: commit
description: Génère un message de commit conventional (titre seul, ≤72 char) via l'agent commit-message. Ne commit JAMAIS — propose, l'humain colle.
user-invocable: true
---

Thin wrapper sur l'agent `commit-message` (haiku, rapide).

## Pré-requis

- Gate CI verte (`bash .claude/skills/ci-gate/run.sh`). Si pas passée dans le tour, lance-la d'abord ou avertis.
- Changements présents (`git diff --stat` ou fichiers untracked).

## Étapes

1. Vérifie `git diff --stat HEAD` et `git status --porcelain` :
   - Rien à commit → signale et stop.
2. Lance l'agent `commit-message` via `Agent({ subagent_type: "commit-message", ... })`. Passe le contexte de session (plan en cours, résumé) dans le prompt — l'agent prime contexte sur diff.
3. Affiche le message proposé verbatim.
4. **STOP**. Pas de `git commit`. L'humain copie le titre.

## Règles

- **Jamais** `git commit`/`git add`/`git push` (bloqué par hook de toute façon).
- Titre seul, ≤72 char, conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- Scope entre parenthèses : `feat(core):`, `fix(renderer):`, `feat(core,renderer):`.
- Si changements trop variés pour un titre → propose plusieurs commits logiques avec liste de fichiers par commit.

## Output

Format attendu :
```
Proposed commit message:

  feat(core): implement Move+Act FFTA-like turn system (plan 008)

Files staged: (liste)
Run: git add <files> && git commit -m "<message>"
```
