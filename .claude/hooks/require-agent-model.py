#!/usr/bin/env python3
"""PreToolUse (Agent) : refuse une délégation qui ne nomme pas son modèle.

Méthode agents de l'humain, section 4 : chaque délégation nomme son modèle (haiku mécanique, sonnet bien
spécifié, opus raisonnement dur). Passent : un paramètre `model`, un agent dont la définition porte `model:`,
un fork (il hérite toujours du modèle de l'appelant).
"""
import json
import os
import re
import sys

DOSSIERS_AGENTS = [
    os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "."), ".claude", "agents"),
    os.path.expanduser("~/.claude/agents"),
]
MESSAGE = ("Délégation sans modèle : ajoute `model` (haiku pour le mécanique, sonnet pour le bien spécifié, "
           "opus pour le raisonnement dur ; dans le doute le moins cher).")


def definition_nomme_un_modele(type_agent):
    for dossier in DOSSIERS_AGENTS:
        try:
            with open(os.path.join(dossier, f"{type_agent}.md"), encoding="utf-8") as fichier:
                if re.search(r"^model:\s*\S", fichier.read(), re.MULTILINE):
                    return True
        except OSError:
            continue
    return False


def main():
    charge = json.load(sys.stdin)
    if charge.get("tool_name") != "Agent":
        return
    entree = charge.get("tool_input") or {}
    type_agent = entree.get("subagent_type") or "general-purpose"
    if entree.get("model") or type_agent == "fork" or definition_nomme_un_modele(type_agent):
        return
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": MESSAGE,
    }}))


try:
    main()
except Exception:
    pass          # un garde défaillant ne doit pas bloquer un outil légitime
sys.exit(0)
