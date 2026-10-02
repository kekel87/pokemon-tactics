#!/usr/bin/env python3
"""PostToolUse Bash : note chaque `query.mjs --open <noms…>` dans le log d'usage.

Plan 217. Le hook de rappel note ce qu'il INJECTE ; ce hook-ci note ce qui est
réellement OUVERT ensuite. Leur rapprochement (`eval-search.mjs --usage`) est le seul
signal d'usage du rappel : mesuré avant ce hook, en relisant les transcripts, 42
ouvertures pour 1 395 couples (entité, session) injectés — 3 %.

Réserve à garder en tête en lisant le ratio : l'extrait de 240 caractères suffit
parfois, et ne pas ouvrir n'est pas toujours ne pas utiliser. Un ratio qui reste près
de zéro pendant des semaines signale du bruit ; un ratio modéré ne prouve rien seul.

Sûr par construction, comme son jumeau : toute erreur sort en silence avec le code 0.
"""
import json
import os
import re
import shlex
import sys
import time

STATE_ROOT = os.environ.get("PT_MEMORY_STATE") or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", ".state")
USAGE_LOG = os.path.join(STATE_ROOT, "memory-usage.jsonl")
APPEL = re.compile(r"scripts/memory/query\.mjs\s+(.*?)(?:[;&|]|$)")


def noms_ouverts(commande):
    """Les noms passés à --open, toutes invocations de la commande confondues."""
    noms = []
    # Ligne par ligne : sans ça, `$` ne s'ancre qu'à la toute fin et seul le dernier
    # appel d'une commande sur plusieurs lignes était noté.
    for morceau in (m for ligne in commande.splitlines() for m in APPEL.findall(ligne)):
        try:
            mots = shlex.split(morceau)
        except ValueError:
            continue
        if "--open" in mots:
            noms.extend(m for m in mots[mots.index("--open") + 1:] if not m.startswith("-"))
    return noms


def main():
    charge = json.load(sys.stdin)
    commande = (charge.get("tool_input") or {}).get("command") or ""
    if "query.mjs" not in commande:
        return
    noms = noms_ouverts(commande)
    if not noms:
        return
    os.makedirs(STATE_ROOT, exist_ok=True)
    with open(USAGE_LOG, "a") as fh:
        fh.write(json.dumps({"ts": int(time.time()), "sid": charge.get("session_id") or "",
                             "event": "opened", "names": noms}, ensure_ascii=False) + "\n")


try:
    main()
except Exception:
    pass   # un hook de mémoire ne doit jamais bloquer un outil
sys.exit(0)
