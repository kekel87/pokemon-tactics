---
name: worktree
description: Crée / liste / nettoie / supprime un git worktree pour lancer N sessions Claude en parallèle sur des branches différentes, sans dupliquer les node_modules ni se marcher dessus sur le port Vite. Un worktree = le repo entier sur une branche.
argument-hint: "add <branch> [base] | list | status | clean | relink <branch> | rm <branch>"
user-invocable: true
---

Wrappe `.claude/scripts/worktree.sh`. Chaque worktree est un checkout complet du repo sur **une branche**, sous `.worktrees/<branch-slug>/` (gitignored). Modèle pour faire tourner 2-3 sessions Claude en parallèle sans collision.

**Pourquoi worktree et pas clone** : partage le `.git` (objets, refs) du checkout principal — pas de re-clone, pas de re-fetch. Branche isolée, working dir isolé.

## Deps — pas de duplication

Sur `add`, si `pnpm-lock.yaml` du worktree == celui de main, **tous** les `node_modules` (root + `packages/*`) sont **reflink-copiés** (`cp -a --reflink=auto`) : clone copy-on-write isolé, ≈0 disque sur btrfs (ce repo est btrfs), qui diverge par fichier au write. Un `pnpm install` ultérieur dans le worktree ne touche que lui, jamais main. Le farm de symlinks relatifs de pnpm survit intact à la copie → aucun install nécessaire quand le lock matche.

Lockfile différent (ou absent) → vrai `pnpm install` dans le worktree (le store global pnpm hardlink déjà le contenu → rapide, peu de disque).

`relink <branch>` ré-isole les deps d'un worktree existant (réparation).

## Port Vite — pas de collision

Chaque worktree reçoit un port dev déterministe (5174..5253) écrit dans `.worktree-port` à sa racine. `vite.config.ts` le lit (ou l'env `PT_PORT`). Le checkout principal reste sur **5173**. Donc `pnpm dev`, `pnpm dev:sandbox`, `pnpm dev:map` tournent en // sans clash, URL prévisible.

## Usage

```bash
bash .claude/scripts/worktree.sh add    <branch> [base]   # base défaut origin/main
bash .claude/scripts/worktree.sh list
bash .claude/scripts/worktree.sh status                   # chaque worktree + état merge local + port
bash .claude/scripts/worktree.sh clean                    # liste les worktrees mergés dans main (candidats rm)
bash .claude/scripts/worktree.sh relink <branch>          # ré-isole les deps (réparation)
bash .claude/scripts/worktree.sh rm     <branch>          # supprime le worktree, garde la branche
```

## Merge → main (flow solo, sans GitHub)

Le checkout principal garde `main` ; chaque worktree porte une branche feature. Pour intégrer :

1. Depuis le **checkout principal** (`main`), merge **fast-forward only** (autorisé par la deny-list) :
   ```bash
   git -C <repo-root> merge --ff-only <branch>
   ```
   - ff-only = non destructeur : refuse proprement si `main` a divergé (pas de merge-commit, pas de force).
   - **Divergence** (main a avancé pendant le travail //) → ff-only échoue. **`git rebase` est autorisé** (l'humain préfère rebase aux merges) : Claude rebase la branche sur `main` **dans son worktree**, puis re-ff depuis le checkout principal. Conflit de rebase insoluble → stop, l'humain résout dans son GUI (GitKraken). Merge non-ff reste interdit (hook).
2. `bash .claude/scripts/worktree.sh rm <branch>` — retire le worktree (branche conservée).
3. Suppression de branche = humain (deny-list bloque `branch -d`).

**Ordre en parallèle** : après avoir mergé la branche A, `main` avance → la branche B (basée sur l'ancien main) n'est plus ff. Rebaser B sur main dans son worktree (`git -C .worktrees/<slug> rebase main`) avant de la ff-merger.

## Nettoyage (`clean`)

`clean` liste les worktrees dont la branche est déjà mergée dans `main` (`git merge-base --is-ancestor`, détection locale, zéro réseau). Le skill **propose** ces candidats via `AskUserQuestion`, l'humain coche, puis `rm` chaque confirmé. Jamais de suppression auto silencieuse.

## Quoi faire

1. Parser `$ARGUMENTS` en sous-commande, lancer le script.
2. Sur `add` : rapporter verbatim la ligne `cd <path>` et l'URL `pnpm dev` (port) pour que la session parallèle entre dans le worktree.
3. La branche est créée depuis `origin/main` sauf si une branche du même nom existe déjà.
4. Sur `rm` : supprimer un node_modules reflinké est safe (clones CoW indépendants, main intact).

## Notes

- 🔴 **Subagents = CWD du checkout principal, pas du worktree.** Tout subagent lancé pendant une session worktree doit recevoir `cd <chemin absolu worktree>` en 1re instruction + chemins absolus, sinon il lit l'état de `main` (branche/travail parallèle) et conclut faux. Détail + incident plan 137 : `docs/agent-orchestration.md` § « Subagents en session worktree ».
- Vitest / build n'ont pas de port → tournent en // sans réglage. Caches `.vite/` worktree-local.
- Un worktree dont la branche a besoin d'autres deps fait son propre `pnpm install` automatiquement — n'affecte pas les autres.
- `status` utilise `gh` pour l'état PR (optionnel — `NONE` si pas trouvé).
