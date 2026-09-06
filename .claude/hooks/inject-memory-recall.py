#!/usr/bin/env python3
"""UserPromptSubmit : injecte la tranche PERTINENTE du graphe de mémoire.

Pourquoi ce hook existe : c'est la seule pièce qui adresse la panne réellement
constatée. La mesure du 2026-09-06 a montré que la recherche *quand on demande*
marchait déjà très bien (15/15 au grep sur les fichiers). Ce qui manquait, c'est
le rappel *quand personne ne demande* — on ne cherche pas ce dont on ignore
l'existence. C'est comme ça que la règle « ne rien ranger au backlog sans accord »
a été enfreinte alors qu'elle était écrite, correcte, et jamais relue.

Un INDEX COMPACT, pas les données : nom, type, nombre d'observations et la
meilleure observation tronquée. Le détail se lit à la demande. Injecter les
observations elles-mêmes noierait le prompt qu'elles servent.

Aucun chemin machine ici : ce fichier vit dans un dépôt public. La base se déduit
de CLAUDE_CONFIG_DIR.

Sûr par construction : toute erreur, base absente ou état illisible sort en
silence avec le code 0. Un hook de mémoire ne doit JAMAIS bloquer un prompt.
La base est ouverte en lecture seule : deux sessions parallèles ne se gênent pas.
"""
import json
import os
import re
import sqlite3
import sys
import unicodedata

CONFIG = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~/.claude")
DB = os.path.join(CONFIG, "memory", "pokemon-tactics", ".claude", "memory.db")
STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".state", "session-memory")

MAX_ENTITIES = 4
MAX_OBS_CHARS = 240
# 🔴 PAS de seuil de score absolu. Mesuré le 2026-09-06 : le score est une SOMME
# sur les champs qui correspondent, donc il mesure COMBIEN de termes touchent, pas
# à quel point ils discriminent. Résultat, les deux bandes se croisent à l'envers —
# « pourquoi llvmpipe a été écarté pour la CI e2e » score 1.7, « tu peux continuer »
# score 27.9. Aucun seuil ne les sépare. Le seuil 30 du montage professionnel vaut
# pour SON corpus, pas pour celui-ci.
# Critère retenu : la RARETÉ. On n'injecte que si le message nomme quelque chose de
# spécifique au projet — un terme présent dans au plus RARETE_MAX % des entités.
RARETE_MAX = float(os.environ.get("PT_MEMORY_RARETE_MAX", "0.01"))
REL_FLOOR = 0.5
RE_INJECT_AFTER = 15
# Même contrat que l'enveloppe de recherche — les deux moitiés du système DOIVENT
# chercher pareil. Mesuré le 2026-09-06 : l'enveloppe ne repliait pas les accents
# alors que ce hook le faisait, donc « mémoire » y devenait « m » + « moire ». Une
# divergence de tokenisation entre les deux est invisible et coûte la moitié du
# vocabulaire français. Valeur calibrée au harnais (12/15 à 0,02 sur 1984 entités).
DF_MAX = 0.02

# Le graphe est en FRANÇAIS et les questions aussi — l'inverse du montage
# professionnel, où le graphe est anglais. Ces mots sont donc FRÉQUENTS ici, et
# c'est le filtre de fréquence documentaire qui fait l'essentiel du travail ;
# cette liste ne traite que le bruit conversationnel court.
STOP = set("""
a accord ai aller alors an and any apres are as assez at au aussi autre aux avant avec beaucoup bien bon bonjour
by ca car ce cela ces cest cette chose comme comment continue continuer dabord dac daccord dans de deja des dessus dis
dit dois doit donc donne du elle elles en encore enfin entree est et etre eu fais fait faire faut
for from hein ici il ils in is it ja jamais je juste la le les leur long lui ma mais me merci mets
marche mieux moi moins mon montre non nos not notre nous of oh ok on ont ou oui par parce pas peu peut peux
perdu plus plutot pour pourquoi pourtant quand sinon que quel quelle quelque qui quoi sa sais sait sans se ses
si son sont sous suis super sur ta tant te tel the this to ton toujours tous tout tres trop truc tu
un une va vais vas vers veut veux via voila voir vos votre vous vraiment vu was with y yes
""".split())

TOKEN = re.compile(r"[A-Za-z0-9_-]+")

# bm25() est illégal dans un agrégat au même niveau, et SQLite réaplatit une
# sous-requête simple : MATERIALIZED est ce qui rend la requête légale.
SEARCH_SQL = """
  WITH m AS MATERIALIZED (
    SELECT entity_name AS n, kind AS k, -bm25(memory_fts) AS r
    FROM memory_fts WHERE memory_fts MATCH ?),
  best AS (SELECT n, k, MAX(r) AS r FROM m GROUP BY n, k)
  SELECT n, SUM(CASE k WHEN 'name' THEN 3.0 WHEN 'type' THEN 0.5 ELSE 1.0 END * r) AS score
  FROM best GROUP BY n ORDER BY score DESC LIMIT 12"""


def terms(text):
    """Prompt -> termes FTS. Les accents sont repliés pour que « développer »
    atteigne la liste d'arrêt sous la forme « developper » au lieu de survivre en
    fragment. Les composés sont émis entiers ET éclatés : « ci-gate » cherche
    « ci-gate », et le filtre de fréquence jette ensuite « ci » et « gate »."""
    plie = "".join(c for c in unicodedata.normalize("NFD", text.lower())
                   if not unicodedata.combining(c))
    bruts = TOKEN.findall(plie)
    eclate = []
    for t in bruts:
        eclate.append(t)
        if "-" in t or "_" in t:
            eclate.extend(re.split(r"[-_]", t))
    return [t for t in dict.fromkeys(eclate) if len(t) > 2 and t not in STOP]


def frequences(con, tokens, total):
    """Fréquence documentaire de chaque terme, entre 0 et 1."""
    out = []
    for t in tokens:
        try:
            c = con.execute("SELECT COUNT(DISTINCT entity_name) FROM memory_fts "
                            "WHERE memory_fts MATCH ?", (f'"{t}"',)).fetchone()[0]
        except sqlite3.Error:
            c = total
        out.append((t, c / total if total else 1.0))
    return out


def filtre_frequence(con, tokens, total):
    """Un terme présent dans plus de DF_MAX % des entités ne discrimine rien et
    NOIE le terme rare qui porte la question. Mesuré : « llvmpipe rasteriseur
    WebGL CI » ne trouvait rien, « llvmpipe » seul trouvait du premier coup."""
    if len(tokens) < 2 or total < 20:
        return tokens
    notes = frequences(con, tokens, total)
    rares = [t for t, r in notes if r <= DF_MAX]
    if rares:
        return rares
    return [t for t, _ in sorted(notes, key=lambda x: x[1])[:2]]


def lire_etat(path):
    vu = {}
    try:
        with open(path) as fh:
            for ligne in fh:
                nom, _, idx = ligne.rstrip("\n").partition("\t")
                if nom:
                    vu[nom] = int(idx or 0)
    except (OSError, ValueError):
        pass
    return vu


def main():
    charge = json.load(sys.stdin)
    prompt = charge.get("prompt") or ""
    sid = charge.get("session_id") or ""
    if not prompt or not sid or not os.path.exists(DB):
        return

    tokens = terms(prompt)
    if not tokens:
        return

    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True, timeout=2.0)
    total = con.execute("SELECT COUNT(*) FROM entities").fetchone()[0]
    notes = frequences(con, tokens, total)
    # Porte d'entrée : le message nomme-t-il quelque chose de spécifique ? Sinon on
    # se tait. Sur-déclencher est LE défaut qui fait désactiver un hook permanent.
    # « Rare » veut dire RARE MAIS PRÉSENT. Une fréquence de 0 signifie que le mot
    # n'est pas dans le graphe du tout — il n'y a rien à rappeler, et déclencher
    # dessus ne produit que du bruit (mesuré : « vas-y », « je vais me coucher »).
    presents = [f for _, f in notes if f > 0]
    if not presents or min(presents) > RARETE_MAX:
        return
    tokens = filtre_frequence(con, tokens, total)
    expr = " OR ".join(f'"{t}"' for t in tokens)
    try:
        classe = con.execute(SEARCH_SQL, (expr,)).fetchall()
    except sqlite3.Error:
        return
    if not classe:
        return

    plancher = classe[0][1] * REL_FLOOR
    candidats = [n for n, s in classe if s >= plancher]

    os.makedirs(STATE, exist_ok=True)
    chemin = os.path.join(STATE, sid)
    vu = lire_etat(chemin)
    idx = max(vu.values(), default=0) + 1
    # Une entité revient après RE_INJECT_AFTER prompts : le contexte a pu être
    # compacté entre-temps, et la réinjecter est moins coûteux que de l'oublier.
    pris = [n for n in candidats
            if idx - vu.get(n, -RE_INJECT_AFTER) >= RE_INJECT_AFTER][:MAX_ENTITIES]
    if not pris:
        return

    lignes = []
    for nom in pris:
        typ = con.execute("SELECT entity_type FROM entities WHERE name = ?", (nom,)).fetchone()
        obs = [r[0] for r in con.execute(
            "SELECT content FROM observations WHERE entity_name = ?", (nom,))]
        meilleure = con.execute(
            """SELECT text FROM memory_fts WHERE memory_fts MATCH ? AND entity_name = ?
               AND kind = 'obs' ORDER BY bm25(memory_fts) LIMIT 1""", (expr, nom)).fetchone()
        extrait = meilleure[0] if meilleure else (obs[0] if obs else "")
        if len(extrait) > MAX_OBS_CHARS:
            extrait = extrait[:MAX_OBS_CHARS - 1] + "…"
        lignes.append(f"- `{nom}` ({typ[0] if typ else '?'}, {len(obs)} obs) — {extrait}")
    con.close()

    contexte = (
        "Mémoire du projet — entrées pertinentes pour ce message (index compact ; "
        "pour le détail complet d'une entrée, `mcp__memory__open_nodes` avec son nom, "
        "ou `node scripts/memory/query.mjs --open <nom>`). Ce sont les meilleures "
        "correspondances, pas forcément toutes :\n" + "\n".join(lignes))
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": contexte,
    }}))

    for nom in pris:
        vu[nom] = idx
    tmp = chemin + ".tmp"
    with open(tmp, "w") as fh:
        for nom, i in vu.items():
            fh.write(f"{nom}\t{i}\n")
    os.replace(tmp, chemin)


try:
    main()
except Exception:
    pass   # un hook de mémoire ne doit jamais bloquer un prompt
sys.exit(0)
