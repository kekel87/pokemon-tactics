#!/usr/bin/env python3
"""PreToolUse : interdit d'inscrire un reste-à-faire (backlog, agenda) sans accord.

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
# 🔴 `(?![-\w])` et NON `\b` : `-` n'est pas un caractère de mot, donc `backlog\b`
# matchait aussi `--add backlog-résolu` — SOLDER une dette était bloqué comme si on en
# inscrivait une neuve. Faux positif constaté le 2026-09-18, pendant la release v2026.9.2.
ECRITURE_GRAPHE = re.compile(
    r"query\.mjs\b.*--add\s+backlog(?![-\w])|--add\s+backlog(?![-\w]).*query\.mjs",
    re.IGNORECASE)
# 2026-09-18 : l'humain a étendu la règle — « arrête d'ajouter des restes à faire ».
# L'agenda était le contournement restant : `--add agenda` rangeait un reste-à-faire
# sans le moindre frottement, exactement ce que `--add backlog` ne pouvait plus faire.
# Même garde que ci-dessus : le type exact, jamais un type dérivé.
ECRITURE_AGENDA = re.compile(
    r"query\.mjs\b.*--add\s+agenda(?![-\w])|--add\s+agenda(?![-\w]).*query\.mjs",
    re.IGNORECASE)
# Seule sortie : la CLÔTURE de session, où l'humain a lui-même dit « fin » ou lancé
# `/status`. `session-closer` doit alors réécrire le pointeur d'agenda. Le hook ne
# peut pas reconnaître l'agent appelant, donc l'exception est déclarative :
# `PT_CLOTURE=1 node scripts/memory/query.mjs --add agenda …`. C'est un ralentisseur,
# pas un verrou — il force à nommer l'intention, il n'empêche personne de mentir.
EXEMPTION_CLOTURE = re.compile(r"\bPT_CLOTURE=1\b")
# Outils MCP mémoire qui ne peuvent RIEN inscrire. Les refuser sur la simple présence
# du mot « backlog » empêchait de RELIRE une dette, y compris une dette déjà soldée —
# un garde d'écriture qui bloquait une lecture. Faux positif constaté le 2026-09-18.
MCP_LECTURE_SEULE = ("open_nodes", "search_nodes", "read_graph")
# Le type exact d'une entité inscrite par un outil MCP.
TYPE_ENTITE = re.compile(r'"entityType"\s*:\s*"([^"]*)"')
TYPES_INTERDITS = ("backlog", "agenda")


def inscrit_une_dette(entree):
    """Vrai si l'entrée crée une entité typée EXACTEMENT `backlog` ou `agenda`.

    `backlog-résolu` n'en est pas une : solder une dette est le geste inverse de
    l'inscrire, et c'est ce que l'ancienne recherche de sous-chaîne confondait.
    """
    charge = json.dumps(entree, ensure_ascii=False)
    types = TYPE_ENTITE.findall(charge)
    if types:
        return any(t.lower() in TYPES_INTERDITS for t in types)
    # Forme inattendue : on ne sait pas lire, donc on refuse. Le garde prime sur le
    # confort — c'est un oubli de garde qui a motivé ce hook, pas un excès.
    return "backlog" in charge.lower()
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


MESSAGE_AGENDA = (
    "Enregistrement d'un reste-à-faire bloqué. Règle de l'humain (2026-09-18) : "
    "« arrête d'ajouter des restes à faire ; si tu trouves un truc en route, on en "
    "discute ». Rien au backlog NI à l'agenda sans son accord explicite.\n\n"
    "Le geste attendu, en chat, AVANT toute écriture : « j'ai trouvé <le défaut> — "
    "besoin de ta décision, ou j'avance ? »\n\n"
    "Exception unique — la CLÔTURE de session, quand l'humain a dit « fin » ou lancé "
    "`/status` : relancer la commande préfixée de `PT_CLOTURE=1`."
)


def refuse(message=None):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": message or MESSAGE,
    }}))


def main():
    charge = json.load(sys.stdin)
    outil = charge.get("tool_name") or ""
    entree = charge.get("tool_input") or {}

    if outil == "Bash":
        commande = str(entree.get("command", ""))
        if ECRITURE_GRAPHE.search(commande):
            refuse()
        elif ECRITURE_AGENDA.search(commande) and not EXEMPTION_CLOTURE.search(commande):
            refuse(MESSAGE_AGENDA)
        return
    if outil.startswith("mcp__memory__"):
        if outil.endswith(MCP_LECTURE_SEULE):
            return
        if inscrit_une_dette(entree):
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
