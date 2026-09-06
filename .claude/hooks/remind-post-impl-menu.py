#!/usr/bin/env python3
"""Stop : rappelle le menu post-implémentation quand du travail reste non validé.

Pourquoi ce hook existe : la règle « Après impl » de CLAUDE.md est OBLIGATOIRE et
pourtant elle s'érode — sur la session du 2026-09-06, une dizaine de scripts écrits,
36 fichiers modifiés, 214 supprimés, et le menu n'a **pas été proposé une seule
fois**. Même mode de panne que la règle du backlog : de la prose dans un fichier de
14 Ko, que rien n'applique. Ce qui tient, c'est ce qu'une machine applique.

Un hook `Stop` est le seul moment où l'on peut encore agir : `SessionEnd` arrive
quand le modèle est déjà parti.

Trois gardes, parce qu'un hook qui râle à chaque tour est désactivé en une journée :
  1. `stop_hook_active` — ne jamais bloquer une reprise déjà causée par un hook Stop,
     sinon la session ne peut plus se terminer ;
  2. un marqueur par session, écrit AVANT d'émettre : au plus un rappel, jamais deux ;
  3. il faut de vraies modifications de code ou de configuration — une session de
     discussion ou de lecture ne déclenche rien.

Pire cas par construction : un tour perdu par session.
"""
import json
import os
import subprocess
import sys

ETAT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".state", "menu-rappel")
# Ce qui compte comme « implémentation ». La doc seule n'est pas concernée : le menu
# prévoit déjà un cas réduit pour ça.
SURVEILLE = ("packages/", "scripts/", ".claude/", "e2e/", "scenarios/")

MESSAGE = (
    "Du travail est modifié et n'a pas passé la chaîne de validation. La règle "
    "« Après impl » de CLAUDE.md est OBLIGATOIRE : avant de dire « fait » ou de "
    "proposer la suite, appeler AskUserQuestion avec le menu multi-select en "
    "3 questions (Tests ? / Validations locales ? / Finalisation ?), pré-cochées "
    "selon le contexte.\n\n"
    "Fichiers concernés :\n{fichiers}\n\n"
    "Si l'humain a déjà tranché la suite dans cette conversation, dis-le-lui en une "
    "ligne et termine — ce rappel ne se répétera pas dans cette session."
)


def modifies():
    """Fichiers SUIVIS et modifiés dans les répertoires surveillés.

    Deux pièges, tous deux constatés :
    - les entrées `??` sont exclues. Sans ça le hook se déclenchait sur son PROPRE
      marqueur (`.claude/.state/`), donc à chaque session, sur un dépôt propre —
      exactement le « hook qui râle à vide » que ce fichier dit vouloir éviter ;
    - un `git` qui échoue (pas un dépôt, `index.lock` tenu ailleurs, délai dépassé)
      rend une sortie vide, qu'on prendrait pour « rien à signaler ». On distingue
      donc l'échec du silence.
    """
    try:
        r = subprocess.run(["git", "status", "--porcelain", "--untracked-files=no"],
                           capture_output=True, text=True, timeout=10,
                           cwd=os.environ.get("CLAUDE_PROJECT_DIR") or None)
    except Exception:
        return None
    if r.returncode != 0:
        return None
    fichiers = []
    for ligne in r.stdout.split("\n"):
        chemin = ligne[3:].strip().strip('"')
        if " -> " in chemin:          # renommage : « ancien -> nouveau »
            chemin = chemin.split(" -> ", 1)[1]
        if chemin and chemin.startswith(SURVEILLE):
            fichiers.append(chemin)
    return fichiers


def main():
    charge = json.load(sys.stdin)
    if charge.get("stop_hook_active"):
        return
    sid = charge.get("session_id") or ""
    if not sid:
        return
    fichiers = modifies()
    if fichiers is None or not fichiers:
        return          # git indisponible, ou rien de suivi n'a bougé

    os.makedirs(ETAT, exist_ok=True)
    marqueur = os.path.join(ETAT, sid)
    if os.path.exists(marqueur):
        return
    # écrit AVANT d'émettre : si quoi que ce soit échoue ensuite, on ne boucle pas
    open(marqueur, "w").write("1")

    apercu = "\n".join(f"  - {f}" for f in fichiers[:8])
    if len(fichiers) > 8:
        apercu += f"\n  … et {len(fichiers) - 8} autres"
    print(json.dumps({"decision": "block",
                      "reason": MESSAGE.format(fichiers=apercu)}))


try:
    main()
except Exception:
    pass          # un hook de rappel ne doit jamais empêcher une session de finir
sys.exit(0)
