#!/usr/bin/env bash
# worktree.sh — create / list / remove git worktrees for parallel Claude sessions
# on Pokemon Tactics (single pnpm monorepo, not a meta-repo).
#
#   worktree.sh add <branch> [base]   create a worktree + branch, share deps, assign port
#   worktree.sh list                  list all worktrees
#   worktree.sh status                each worktree + local merge state + port
#   worktree.sh clean                 list worktrees merged into main (removal candidates)
#   worktree.sh relink <branch>       re-isolate deps (repair)
#   worktree.sh rm <branch>           remove a worktree (keeps the branch)
#
# Worktrees live under .worktrees/<branch-slug>/ (gitignored). Each is a full
# checkout of the repo on one branch — the model for running 2-3 parallel
# sessions without them stepping on each other.
#
# DEPENDENCIES (no duplication):
#   On `add`, if the worktree's pnpm-lock.yaml matches the main checkout's, every
#   node_modules dir (root + packages/*) is REFLINK-COPIED (cp -a --reflink=auto).
#   A reflink is an isolated copy-on-write clone: real dir entries, sharing storage
#   with main until written (≈0 disk on btrfs/XFS — this repo is btrfs), diverging
#   PER FILE on write — so a later `pnpm install` in the worktree touches only that
#   worktree, never main or the others. pnpm's relative symlink farm survives the
#   copy intact (no install needed when the lockfile matches). Off a CoW filesystem,
#   --reflink=auto falls back to a full (still-isolated) copy.
#   Lockfile differs (or missing) → real `pnpm install` inside the worktree.
#
# PORT (no Vite clash):
#   Each worktree gets a deterministic dev-server port written to .worktree-port at
#   its root. vite.config.ts reads it (or the PT_PORT env). Main keeps 5173.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WT_BASE="$ROOT/.worktrees"

die() { echo "worktree: $*" >&2; exit 1; }

slug() { echo "$1" | sed 's#/#-#g'; }

# deterministic dev port for a slug: 5174..5253 (main stays on 5173)
port_for() {
  local s="$1" n
  n="$(printf '%s' "$s" | cksum | cut -d' ' -f1)"
  echo "$(( 5174 + n % 80 ))"
}

# ---------- deps ----------

# reflink-copy (or fall back to pnpm install) every node_modules in the workspace.
link_deps() {
  local wt_path="$1"
  local lf="pnpm-lock.yaml"

  if [[ ! -e "$ROOT/node_modules" ]]; then
    echo "  deps: main checkout has no node_modules — installing in worktree"
    ( cd "$wt_path" && pnpm install )
    return
  fi

  if [[ -f "$ROOT/$lf" && -f "$wt_path/$lf" ]] && cmp -s "$ROOT/$lf" "$wt_path/$lf"; then
    echo "  deps: $lf identical → reflink-copy node_modules (CoW ≈0 disk on btrfs, isolated)"
    # root + every packages/*/node_modules present in main
    local rel
    while IFS= read -r nm; do
      rel="${nm#"$ROOT"/}"
      rm -rf "${wt_path:?}/$rel"
      mkdir -p "$(dirname "$wt_path/$rel")"
      cp -a --reflink=auto "$nm" "$wt_path/$rel"
    done < <(
      printf '%s\n' "$ROOT/node_modules"
      find "$ROOT/packages" -maxdepth 2 -type d -name node_modules 2>/dev/null
    )
  else
    echo "  deps: $lf differs (or missing) → real pnpm install in worktree"
    ( cd "$wt_path" && pnpm install )
  fi
}

# bring untracked local config (env files) from main — a worktree is a clean checkout.
copy_local_config() {
  local wt_path="$1"
  shopt -s nullglob
  local copied=() f base
  for f in "$ROOT"/.env "$ROOT"/.env.local; do
    [[ -f "$f" ]] || continue
    base="$(basename "$f")"
    [[ -e "$wt_path/$base" ]] && continue
    cp "$f" "$wt_path/$base"
    copied+=("$base")
  done
  shopt -u nullglob
  if [[ ${#copied[@]} -gt 0 ]]; then
    echo "  config: copied local files → ${copied[*]}"
  fi
}

# ---------- subcommands ----------

cmd_add() {
  local branch="${1:-}" base="${2:-origin/main}"
  [[ -n "$branch" ]] || die "usage: worktree.sh add <branch> [base]"

  local s; s="$(slug "$branch")"
  local wt_path="$WT_BASE/$s"
  [[ -e "$wt_path" ]] && die "worktree already exists: $wt_path"

  mkdir -p "$WT_BASE"
  ( cd "$ROOT" && git fetch origin --quiet )

  echo "worktree: adding $branch at $wt_path (base $base)"
  if git -C "$ROOT" show-ref --verify --quiet "refs/heads/$branch"; then
    git -C "$ROOT" worktree add "$wt_path" "$branch"
  else
    git -C "$ROOT" worktree add -b "$branch" "$wt_path" "$base"
  fi

  link_deps "$wt_path"
  copy_local_config "$wt_path"

  local port; port="$(port_for "$s")"
  echo "$port" > "$wt_path/.worktree-port"
  echo "  port: dev server on $port (main stays 5173)"

  echo
  echo "✓ ready. Work here:"
  echo "    cd $wt_path"
  echo "    pnpm dev   →  http://localhost:$port"
}

cmd_list() {
  git -C "$ROOT" worktree list 2>/dev/null | grep -F "$WT_BASE/" || echo "worktree: none."
}

# status — one tab line per worktree, with local merge state. Read-only, no network.
# Columns: state \t branch \t port \t path   (state ∈ MERGED | active)
# MERGED = branch tip is an ancestor of local main (fully integrated, e.g. after a
# ff-only merge) → safe to remove. Solo local flow, no GitHub PR lookup.
cmd_status() {
  [[ -d "$WT_BASE" ]] || { echo "worktree: no worktrees."; return 0; }
  for d in "$WT_BASE"/*/; do
    [[ -d "$d" ]] || continue
    local path="${d%/}"
    local branch state="active" port=""
    branch="$(git -C "$path" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
    if [[ -f "$path/.worktree-port" ]]; then
      port="$(cat "$path/.worktree-port")"
    fi
    if git -C "$ROOT" merge-base --is-ancestor "$branch" main 2>/dev/null; then
      state="MERGED"
    fi
    printf '%s\t%s\t%s\t%s\n' "$state" "$branch" "$port" "$path"
  done
}

# clean — list ONLY worktrees whose branch is merged into main (removal candidates).
# Read-only: prints candidates for the /worktree skill to confirm, then rm each.
cmd_clean() {
  [[ -d "$WT_BASE" ]] || { echo "worktree: no worktrees."; return 0; }
  local found=0
  for d in "$WT_BASE"/*/; do
    [[ -d "$d" ]] || continue
    local path="${d%/}" branch
    branch="$(git -C "$path" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
    if git -C "$ROOT" merge-base --is-ancestor "$branch" main 2>/dev/null; then
      printf 'MERGED\t%s\t%s\n' "$branch" "$path"
      found=1
    fi
  done
  [[ "$found" -eq 0 ]] && echo "worktree: no merged worktrees to clean."
}

# relink — re-isolate an existing worktree's deps (reflink when lockfile matches, else install).
cmd_relink() {
  local branch="${1:-}"
  [[ -n "$branch" ]] || die "usage: worktree.sh relink <branch>"
  local wt_path="$WT_BASE/$(slug "$branch")"
  [[ -e "$wt_path" ]] || die "no such worktree: $wt_path"
  echo "worktree: relinking deps for $branch"
  link_deps "$wt_path"
}

cmd_rm() {
  local branch="${1:-}"
  [[ -n "$branch" ]] || die "usage: worktree.sh rm <branch>"
  local wt_path="$WT_BASE/$(slug "$branch")"
  [[ -e "$wt_path" ]] || die "no such worktree: $wt_path"

  git -C "$ROOT" worktree remove --force "$wt_path"
  git -C "$ROOT" worktree prune
  echo "✓ removed $wt_path (branch '$branch' kept)"
}

# ---------- dispatch ----------

case "${1:-}" in
  add)    shift; cmd_add    "$@" ;;
  list)   shift; cmd_list   "$@" ;;
  status) shift; cmd_status "$@" ;;
  clean)  shift; cmd_clean  "$@" ;;
  relink) shift; cmd_relink "$@" ;;
  rm)     shift; cmd_rm     "$@" ;;
  *)      die "usage: worktree.sh {add <branch> [base] | list | status | clean | relink <branch> | rm <branch>}" ;;
esac
