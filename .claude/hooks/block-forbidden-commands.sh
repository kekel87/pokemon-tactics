#!/usr/bin/env bash
# Hook PreToolUse : bloque les commandes interdites par les regles du projet.
# Exit 0 = autorise, Exit 2 = bloque (message sur stderr).

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

if echo "$COMMAND" | grep -qE '\bgit\s+commit\b'; then
  echo "BLOQUE : git commit est interdit. L'humain gere le versioning." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\bgit\s+push\b'; then
  echo "BLOQUE : git push est interdit. L'humain gere le versioning." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\bgit\s+add\b'; then
  echo "BLOQUE : git add est interdit. L'humain gere le versioning." >&2
  exit 2
fi

# --- Installation globale ---

if echo "$COMMAND" | grep -qE '\bnpm\s+install\s+(-g|--global)\b'; then
  echo "BLOQUE : npm install -g est interdit. Ne jamais installer globalement." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\bnpm\s+i\s+(-g|--global)\b'; then
  echo "BLOQUE : npm i -g est interdit. Ne jamais installer globalement." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\bpnpm\s+add\s+(-g|--global)\b'; then
  echo "BLOQUE : pnpm add -g est interdit. Ne jamais installer globalement." >&2
  exit 2
fi

# --- nvm / npm config ---

if echo "$COMMAND" | grep -qE '\bnvm\s'; then
  echo "BLOQUE : les commandes nvm sont interdites. Ne jamais modifier la config Node." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\bnpm\s+config\b'; then
  echo "BLOQUE : npm config est interdit. Ne jamais modifier la config npm." >&2
  exit 2
fi

# Tout le reste est autorise
exit 0
