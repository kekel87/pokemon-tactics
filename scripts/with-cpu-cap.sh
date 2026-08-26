#!/usr/bin/env bash
# Exécute une commande sous un PLAFOND DUR de CPU et de mémoire, pour que l'humain garde sa machine.
#
# Motif (2026-08-25) : la suite e2e prend 8 workers Chromium avec WebGL (défaut Playwright =
# cœurs / 2) pendant ~12 min. Sur cette machine ça sature les 16 cœurs, donc ça rend le poste
# inutilisable pour travailler ou jouer en parallèle — le reproche exact de l'humain.
#
# Pourquoi un cgroup plutôt que juste `--workers` : `--workers` est une consigne que Playwright
# s'applique à lui-même, elle ne borne pas l'arbre de process (Chromium enfante des rendus, des GPU
# process, Vite compile à côté). `systemd-run --user --scope` pose une limite que le NOYAU applique
# à tout ce qui naît dedans. `CPUWeight` bas fait en plus *céder* le CPU aux tâches interactives au
# lieu de se le disputer avec elles — c'est ce qui change tout pour un jeu qui tourne à côté.
#
# Débridage explicite : `PT_FULL_SPEED=1` (à réserver aux runs où personne n'utilise la machine).
#
# Usage : bash scripts/with-cpu-cap.sh <commande> [args…]

set -euo pipefail

# 4 cœurs sur 16 : la suite avance, 12 cœurs restent pour l'humain.
CPU_QUOTA="${PT_CPU_QUOTA:-400%}"
MEMORY_MAX="${PT_MEMORY_MAX:-8G}"
# 100 = défaut. 20 = cède franchement dès qu'autre chose veut le CPU.
CPU_WEIGHT="${PT_CPU_WEIGHT:-20}"

if [[ $# -eq 0 ]]; then
  echo "usage: $0 <commande> [args…]" >&2
  exit 2
fi

if [[ -n "${PT_FULL_SPEED:-}" ]]; then
  echo "⚡ plein régime (PT_FULL_SPEED=1) — aucun plafond, la machine est prise" >&2
  exec "$@"
fi

# `systemd-run --user` a besoin des contrôleurs `cpu` et `memory` délégués à la session. Sans eux
# (autre init, cgroup v1, conteneur), on ne fait pas semblant : on retombe sur `nice`/`ionice`, qui
# ne PLAFONNENT rien mais donnent au moins la priorité à l'humain — et on le dit.
cgroup_controllers="/sys/fs/cgroup/user.slice/user-$(id -u).slice/cgroup.controllers"
if command -v systemd-run >/dev/null 2>&1 &&
  [[ -r "$cgroup_controllers" ]] &&
  grep -q cpu "$cgroup_controllers" &&
  grep -q memory "$cgroup_controllers"; then
  echo "🧯 plafond dur : CPU ${CPU_QUOTA} · RAM ${MEMORY_MAX} · priorité ${CPU_WEIGHT}/100 (PT_FULL_SPEED=1 pour débrider)" >&2
  # `--scope` garde la commande dans CE terminal (stdio et code de sortie traversent) au lieu d'en
  # faire un service détaché. Vérifié : `false` ressort bien en 1.
  exec systemd-run --user --scope --quiet \
    --property="CPUQuota=${CPU_QUOTA}" \
    --property="MemoryMax=${MEMORY_MAX}" \
    --property="CPUWeight=${CPU_WEIGHT}" \
    -- "$@"
fi

echo "⚠️  contrôleurs cgroup cpu/memory indisponibles : pas de plafond, seulement une priorité basse" >&2
exec nice -n 19 "$@"
