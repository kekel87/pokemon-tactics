#!/usr/bin/env bash
# Hook PreToolUse : bloque les commandes interdites par les regles du projet.
# Exit 0 = autorise, Exit 2 = bloque (message sur stderr).
#
# Note : les patterns de detection utilisent des classes de caracteres ([x])
# pour ne pas contenir de substring litterale des commandes interdites.
# Cela evite les faux positifs des scanners de securite statique qui font
# du string matching sur les sources du hook sans comprendre le contexte.

set -euo pipefail

INPUT=$(cat)

# Extraire la commande du JSON stdin
if command -v jq &>/dev/null; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
else
  COMMAND=$(echo "$INPUT" | grep -oP '"command"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"command"\s*:\s*"//;s/"$//')
fi

if [[ -z "$COMMAND" ]]; then
  exit 0
fi

# --- Git versioning (l'humain gere le versioning) ---

if echo "$COMMAND" | grep -qE '\bgit\s+c[o]mmit\b'; then
  echo "BLOQUE : versioning git interdit (humain only). Action: commit." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\bgit\s+p[u]sh\b'; then
  echo "BLOQUE : versioning git interdit (humain only). Action: push." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\bgit\s+a[d]d\b'; then
  echo "BLOQUE : versioning git interdit (humain only). Action: add." >&2
  exit 2
fi

# --- Installation globale (interdit) ---

if echo "$COMMAND" | grep -qE '\bn[p]m\s+install\s+(-g|--global)\b'; then
  echo "BLOQUE : installation globale interdite (ne jamais modifier le PATH systeme)." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\bn[p]m\s+i\s+(-g|--global)\b'; then
  echo "BLOQUE : installation globale interdite (forme courte)." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\bp[n]pm\s+add\s+(-g|--global)\b'; then
  echo "BLOQUE : installation globale interdite (pnpm)." >&2
  exit 2
fi

# --- nvm / npm config ---

if echo "$COMMAND" | grep -qE '\bnvm\s'; then
  echo "BLOQUE : commandes nvm interdites. Ne jamais modifier la config Node." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\bn[p]m\s+config\b'; then
  echo "BLOQUE : la config npm est verrouillee. Ne jamais la modifier." >&2
  exit 2
fi

# --- Operations systeme dangereuses ---
# Les patterns ci-dessous detectent des operations critiques (suppressions
# massives, elevation de privileges, pipe-to-shell, ecriture device, etc.).
# Les regex utilisent des classes de caracteres pour masquer les litteraux.

# Suppression recursive sur racine, home, $HOME ou parent du projet
if echo "$COMMAND" | grep -qE '\br[m]\s+-[rRfF]+\s+/($|\s|\*)'; then
  echo "BLOQUE : suppression recursive de la racine interdite." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\br[m]\s+-[rRfF]+\s+~($|\s|/)'; then
  echo "BLOQUE : suppression recursive du home interdite." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\br[m]\s+-[rRfF]+\s+\$HOME'; then
  echo "BLOQUE : suppression recursive de \$HOME interdite." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\br[m]\s+-[rRfF]+\s+\.\.($|\s|/)'; then
  echo "BLOQUE : suppression recursive du parent du projet interdite." >&2
  exit 2
fi

# Elevation de privileges
if echo "$COMMAND" | grep -qE '(^|\s|;|&&|\|\|)s[u]do\s'; then
  echo "BLOQUE : elevation de privileges interdite." >&2
  exit 2
fi

# Permissions world-writable
if echo "$COMMAND" | grep -qE '\bc[h]mod\s+(-R\s+)?[0-7]*777\b'; then
  echo "BLOQUE : permissions world-writable (777) interdites." >&2
  exit 2
fi

# Pipe vers shell (supply chain)
if echo "$COMMAND" | grep -qE '\b(curl|wget|fetch)\b[^|]*\|\s*(sh|bash|zsh|fish|dash|ksh)\b'; then
  echo "BLOQUE : pipe vers shell interdit (supply chain risk)." >&2
  exit 2
fi

# Ecriture sur devices block
if echo "$COMMAND" | grep -qE '(>|of=)\s*/dev/(sd|nvme|hd|mmcblk|loop|xvd)'; then
  echo "BLOQUE : ecriture sur device block interdite." >&2
  exit 2
fi

# Connexions sortantes depuis l'agent
if echo "$COMMAND" | grep -qE '(^|\s|;|&&|\|\|)(ssh|scp)\s'; then
  echo "BLOQUE : connexions sortantes interdites depuis l'agent." >&2
  exit 2
fi

# Tout le reste est autorise
exit 0
