---
name: commit
description: Génère un message de commit conventional court (titre seul, ≤72 char) via l'agent commit-message, puis commit + push directement. Pas de validation du message.
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
3. `git add` + `git commit -m "<message>"` + `git push`. Stop sur fail.

## Règles

- 🔴 **Pas de validation du message** : la convention suffit, l'humain ne veut plus arbitrer chaque message. Commit + push directement, rien à proposer en chat.
- Titre seul, version courte/concise, ≤72 char, conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- **Scope** : 1 seul scope max (`feat(core):`). Si plusieurs scopes → **aucun scope** (`feat:`), jamais `feat(scope1, scope2):`.
- Si changements trop variés pour un titre → propose plusieurs commits logiques avec liste de fichiers par commit.
- Destructeurs (reset, checkout, restore, clean, etc.) restent interdits (deny-list). `git rebase` est autorisé.

## Output

Une ligne en chat après coup, pas avant :
```
Commité + pushé : feat(core): implement Move+Act FFTA-like turn system
```
