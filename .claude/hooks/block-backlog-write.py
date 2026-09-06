#!/usr/bin/env python3
"""PreToolUse : interdit toute écriture dans docs/backlog.md sans accord explicite.

Origine : le 2026-09-05, un défaut PRÉ-EXISTANT (segments de format à 26 px) a été
inscrit au backlog puis signalé à l'humain APRÈS. Signaler après n'est pas demander.
Récidive d'une règle qui existait déjà en mémoire — et c'est précisément la
démonstration que la prose ne tient pas : ce qu'une machine applique tient
(block-forbidden-commands.sh n'a jamais été enfreint en six mois), le reste s'érode.

Frontière avec docs/next.md, volontaire : next.md est l'agenda de travail de Claude,
maintenu seul. backlog.md est la liste de DETTE ACCEPTÉE de l'humain — y écrire,
c'est décider à sa place qu'un défaut ne sera pas corrigé.
"""
import json
import re
import sys

# 🔴 La règle a déménagé, le garde doit suivre. `docs/backlog.md` n'existe plus
# (plan 200) : la dette vit dans le graphe, et `query.mjs --add backlog …` la rangeait
# sans le moindre frottement. On garde l'ancien chemin par sécurité — si quelqu'un
# recrée le fichier, il est protégé — et on ajoute le vrai chemin d'écriture.
CIBLE = "docs/backlog.md"
# Écriture d'une dette dans le graphe, par le client ou par l'outil MCP.
ECRITURE_GRAPHE = re.compile(
    r"query\.mjs\b.*--add\s+backlog\b|--add\s+backlog\b.*query\.mjs", re.IGNORECASE)
MESSAGE = (
    "Enregistrement d'une dette bloqué : le backlog est la liste de dette ACCEPTÉE "
    "par l'humain. Y ajouter une entrée revient à décider à sa place qu'un défaut "
    "ne sera pas corrigé.\n\n"
    "Le geste attendu, en chat, AVANT toute écriture : « j'ai trouvé <le défaut> — "
    "je le corrige maintenant, ou je le range au backlog ? Tu choisis. »\n\n"
    "Vaut aussi pour un défaut pré-existant que tu n'as pas introduit — c'est le cas "
    "qui a motivé ce garde-fou. Si l'humain a déjà donné son accord explicite dans "
    "cette conversation, dis-le lui et demande-lui de relancer l'action."
)


def refuse():
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": MESSAGE,
    }}))


def main():
    charge = json.load(sys.stdin)
    outil = charge.get("tool_name") or ""
    entree = charge.get("tool_input") or {}

    if outil == "Bash":
        if ECRITURE_GRAPHE.search(str(entree.get("command", ""))):
            refuse()
        return
    if outil.startswith("mcp__memory__") and "backlog" in json.dumps(entree).lower():
        refuse()
        return

    chemins = [str(entree.get(c, "")) for c in ("file_path", "path", "notebook_path")]
    if not any(CIBLE in c for c in chemins):
        return
    refuse()


try:
    main()
except Exception:
    pass          # un hook défaillant ne doit pas bloquer un outil légitime
sys.exit(0)
