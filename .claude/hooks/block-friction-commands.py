#!/usr/bin/env python3
"""PreToolUse : refuse les gestes qui ont déjà coûté cher, et dit pourquoi.

Chaque entrée ici vient d'un incident réel, pas d'une précaution théorique. Une
règle en prose s'érode avec le volume — ce qu'une machine applique tient. Preuve
dans ce dépôt : `block-forbidden-commands.sh` n'a jamais été enfreint en six mois,
alors que trois règles écrites ont sauté (backlog, noms FR, menu post-impl).

Chaque refus doit expliquer la CAUSE, pas seulement interdire : un refus qu'on ne
comprend pas se contourne.
"""
import json
import re
import sys

# (motif, message). Le motif s'applique à la commande Bash complète.
COMMANDES = [
    # Resserré le 2026-09-16 : le motif visait TOUT workflow, alors que la décision #925 ne
    # parle que de la suite e2e. Surveiller `itch-deploy` pendant une release est légitime, et
    # l'agent `publisher` a dû sonder `gh run view` à la main faute de pouvoir le faire. Il
    # bloquait même un `grep` dont la chaîne recherchée contenait la phrase.
    # ⚠️ Trou assumé : `gh run watch <id>` sur un identifiant nu ne dit pas quel workflow c'est,
    # donc la suite e2e reste surveillable par son numéro. Le motif ne peut pas le savoir ; ce
    # qui tient ce cas, c'est le skill /next et `pnpm e2e:status`, pas ce hook.
    (r"(?s)^(?=.*\bgh\s+run\s+watch\b)(?=.*\be2e\b)",
     "🔴 Décision #925 : on n'attend JAMAIS la suite e2e. Elle est asynchrone sur "
     "GitHub (~5 min) précisément pour ne bloquer personne — rester planté devant "
     "annule tout le bénéfice du chantier qui l'y a mise. Lis son verdict avec "
     "`pnpm e2e:status` (ou le skill `/e2e-status`) et continue. "
     "(Les AUTRES workflows — itch-deploy par exemple — restent surveillables.)"),
    (r"--update-snapshots|--update-snapshot\b",
     "🔴 Une différence de capture ne se règle JAMAIS en réécrivant la référence : "
     "c'est effacer la régression au lieu de la voir. Ouvre le diff, comprends "
     "l'écart, corrige la cause. Si la nouvelle image est légitime, c'est l'humain "
     "qui le valide."),
    (r"\b(kill|pkill|killall)\b.*\b(firefox|chrome|chromium)\b",
     "🔴 Ne jamais tuer un navigateur : ce sont ceux de l'humain, avec ses onglets. "
     "Pour arrêter TON serveur sandbox, utilise TaskStop sur la tâche d'arrière-plan "
     "— sûr et indépendant du port."),
    (r"\b(kill|pkill|killall)\b.*\bvite\b(?!.*\bTaskStop\b)",
     "⚠️ Tuer un processus vite au nom risque d'emporter le serveur de développement "
     "de l'humain. Arrête TON process d'arrière-plan par TaskStop ; en dernier "
     "recours, cible le PID de CE checkout uniquement."),
]

# (motif de chemin, message) pour Edit / Write / NotebookEdit.
CHEMINS = [
    (r"packages/data/reference/",
     "🔴 `packages/data/reference/` est une base de connaissance GÉNÉRÉE (Gen 1-9, "
     "alignée Pokemon Champions). On ne l'édite jamais à la main : le prochain "
     "rafraîchissement écraserait la correction sans trace. Corrige la source ou le "
     "script de génération."),
]


# Fichiers d'instructions et docs : pas de tiret cadratin (méthode agents de l'humain).
# On refuse seulement les tirets AJOUTÉS, pour pouvoir éditer les fichiers anciens qui en contiennent.
TIRET = "—"
CHEMIN_SANS_TIRET = re.compile(r"(^|/)(CLAUDE(\.local)?\.md|\.claude/.+\.md|docs/.+\.md)$")
MESSAGE_TIRET = ("Pas de tiret cadratin dans les fichiers d'instructions et docs : "
                 "remplace-le par deux-points, virgule, parenthèses ou point.")


def tirets_ajoutes(outil, entree):
    chemin = str(entree.get("file_path", ""))
    if outil not in ("Edit", "Write") or not CHEMIN_SANS_TIRET.search(chemin):
        return False
    if outil == "Edit":
        return (str(entree.get("new_string", "")).count(TIRET)
                > str(entree.get("old_string", "")).count(TIRET))
    try:
        avant = open(chemin, encoding="utf-8").read().count(TIRET)
    except OSError:
        avant = 0
    return str(entree.get("content", "")).count(TIRET) > avant


def refuse(message):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": message,
    }}))


def main():
    charge = json.load(sys.stdin)
    outil = charge.get("tool_name") or ""
    entree = charge.get("tool_input") or {}

    if tirets_ajoutes(outil, entree):
        refuse(MESSAGE_TIRET)
        return

    sujet, regles = "", []
    if outil == "Bash":
        sujet, regles = str(entree.get("command", "")), COMMANDES
    elif outil in ("Edit", "Write", "NotebookEdit"):
        sujet = " ".join(str(entree.get(c, "")) for c in
                         ("file_path", "path", "notebook_path"))
        regles = CHEMINS
    if not sujet:
        return

    for motif, message in regles:
        if re.search(motif, sujet, re.IGNORECASE):
            refuse(message)
            return


try:
    main()
except Exception:
    pass          # un garde défaillant ne doit pas bloquer un outil légitime
sys.exit(0)
