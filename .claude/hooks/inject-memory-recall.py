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
import functools
import json
import os
import re
import sqlite3
import sys
import time
import unicodedata

CONFIG = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~/.claude")
# Mêmes surcharges que scripts/memory/paths.mjs : PT_MEMORY_HOME désigne la racine du
# graphe. PT_MEMORY_STATE déplace l'état de session et le log d'usage — c'est ce qui
# permet au harnais (eval-search.mjs) de rejouer les sondes sans polluer l'état réel.
HOME = os.environ.get("PT_MEMORY_HOME") or os.path.join(CONFIG, "memory", "pokemon-tactics")
DB = os.path.join(HOME, ".claude", "memory.db")
STATE_ROOT = os.environ.get("PT_MEMORY_STATE") or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", ".state")
STATE = os.path.join(STATE_ROOT, "session-memory")
# Une ligne par injection ; memory-usage-log.py y ajoute les ouvertures (--open).
# Le rapport « injecté puis ouvert » se lit par `eval-search.mjs --usage`.
USAGE_LOG = os.path.join(STATE_ROOT, "memory-usage.jsonl")

MAX_ENTITIES = 4
MAX_OBS_CHARS = 240
# 🔴 PAS de seuil de score absolu. Mesuré le 2026-09-06 : le score est une SOMME
# sur les champs qui correspondent, donc il mesure COMBIEN de termes touchent, pas
# à quel point ils discriminent. Résultat, les deux bandes se croisent à l'envers —
# « pourquoi llvmpipe a été écarté pour la CI e2e » score 1.7, « tu peux continuer »
# score 27.9. Aucun seuil ne les sépare. Le seuil 30 du montage professionnel vaut
# pour SON corpus, pas pour celui-ci.
#
# Critère retenu (plan 217) : le message doit nommer quelque chose du PROJET, et le
# vocabulaire du projet, c'est celui des NOMS d'entités. Un terme ne compte que s'il
# figure dans le nom de 1 à NOM_MAX entités ET dans au plus DF_MAX des entités. Seuls
# ces termes servent ensuite à la recherche.
# Mesuré le 2026-10-02 sur hook-probes.tsv et 254 prompts réels hors sondes. L'ancien
# critère (un terme rare, n'importe où) se taisait sur 0 des 20 prompts
# conversationnels : « vasi », « parfait », « demain » sont rares dans le graphe
# parce que les fiches feedback citent l'humain mot pour mot. Le nouveau : 20/20
# silences, 11/13 positifs (12/13 avant), déclenchement réel 62 % -> 34 %.
NOM_MAX = 5
REL_FLOOR = 0.5
RE_INJECT_AFTER = 15
# Même contrat que scripts/memory/fts.mjs — les deux moitiés du système DOIVENT
# chercher pareil. Mesuré le 2026-09-06 : l'enveloppe ne repliait pas les accents
# alors que ce hook le faisait, donc « mémoire » y devenait « m » + « moire ». Une
# divergence de tokenisation entre les deux est invisible et coûte la moitié du
# vocabulaire français. Valeur calibrée au harnais (12/15 à 0,02 sur 1984 entités).
DF_MAX = 0.02
# Ligne de voisins (plan 217) : NOMS seulement, jamais leur contenu. La littérature
# (GraphRAG-Bench) mesure que le graphe aide sur les questions à plusieurs sauts mais
# coûte en précision sur une recherche simple : on montre le chemin, le lecteur décide
# d'ouvrir. Mêmes verbes, même ordre que VERBES_SUIVIS de scripts/memory/relations.mjs —
# fts.test.ts le vérifie. `cite` et `voir-aussi` ne sont jamais suivis.
VERBES_SUIVIS = ("contredit", "remplace", "résout", "découle-de", "révise", "ouvre")
MAX_VOISINS = 3

# Mots vides : liste UNIQUE partagée avec scripts/memory/fts.mjs (plan 218) — mots-outils
# français et anglais, plus le bruit conversationnel. La porte des noms fait l'essentiel
# du tri ; cette liste ne retire que ce qu'elle laisserait passer. Fichier illisible = le
# hook se tait (main() est enveloppé) : pas de liste de repli, ce serait recréer la
# divergence que ce fichier supprime.
FICHIER_MOTS_VIDES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                          "scripts", "memory", "mots-vides.txt")


@functools.cache
def lire_mots_vides():
    with open(FICHIER_MOTS_VIDES, encoding="utf-8") as fh:
        return {ligne.strip() for ligne in fh if ligne.strip() and not ligne.startswith("#")}

TOKEN = re.compile(r"[A-Za-z0-9_-]+")
# Même règle que ecarterNombresIsoles (scripts/memory/fts.mjs) : un nombre seul ne compte
# que derrière un mot qui numérote (« plan 209 ») ou écrit « #924 ». Sinon il touche le
# NOM de decision-212 ou plan-212 et injecte une entité sans rapport.
NUMEROTANTS = {"plan", "plans", "decision", "decisions", "reflexion", "revision", "recette", "lot", "phase"}

# Même contrat que scripts/memory/fts.mjs (plan 217) : une observation « INVALID
# AAAA-MM-JJ: » est un fait périmé, jamais servi ; une entité qui porte un fait
# « CONFIRMED » par l'humain gagne BONUS_CONFIRME. fts.test.ts vérifie que ce fichier
# garde les mêmes clauses — une divergence entre les deux moitiés est invisible.
BONUS_CONFIRME = 1.5

# bm25() est illégal dans un agrégat au même niveau, et SQLite réaplatit une
# sous-requête simple : MATERIALIZED est ce qui rend la requête légale.
SEARCH_SQL = f"""
  WITH m AS MATERIALIZED (
    SELECT entity_name AS n, kind AS k, -bm25(memory_fts) AS r
    FROM memory_fts WHERE memory_fts MATCH ?
      AND NOT (kind = 'obs' AND text GLOB 'INVALID *')),
  best AS (SELECT n, k, MAX(r) AS r FROM m GROUP BY n, k),
  brut AS (SELECT n, SUM(CASE k WHEN 'name' THEN 3.0 WHEN 'type' THEN 0.5 ELSE 1.0 END * r) AS s
           FROM best GROUP BY n)
  SELECT brut.n, brut.s * CASE WHEN EXISTS (
           SELECT 1 FROM observations o WHERE o.entity_name = brut.n
             AND o.content GLOB 'CONFIRMED *') THEN {BONUS_CONFIRME} ELSE 1.0 END AS score
  FROM brut
  ORDER BY score DESC LIMIT 12"""


def terms(text):
    """Prompt -> termes FTS. Les accents sont repliés pour que « développer »
    atteigne la liste d'arrêt sous la forme « developper » au lieu de survivre en
    fragment. Les composés sont émis entiers ET éclatés : « ci-gate » cherche
    « ci-gate », et la porte des noms écarte ensuite « ci » et « gate » s'ils sont
    trop communs."""
    plie = "".join(c for c in unicodedata.normalize("NFD", text.lower())
                   if not unicodedata.combining(c))
    diese = set(re.findall(r"#(\d+)", plie))
    bruts = TOKEN.findall(plie)
    bruts = [t for i, t in enumerate(bruts)
             if not t.isdigit() or t in diese or (i and bruts[i - 1] in NUMEROTANTS)]
    eclate = []
    for t in bruts:
        eclate.append(t)
        if "-" in t or "_" in t:
            eclate.extend(re.split(r"[-_]", t))
    return [t for t in dict.fromkeys(eclate) if len(t) > 2 and t not in lire_mots_vides()]


def comptes(con, terme):
    """(entités où le terme apparaît, entités dont le NOM le porte) — un seul parcours."""
    try:
        return con.execute(
            "SELECT COUNT(DISTINCT entity_name), "
            "COUNT(DISTINCT CASE WHEN kind = 'name' THEN entity_name END) "
            "FROM memory_fts WHERE memory_fts MATCH ?", (f'"{terme}"',)).fetchone()
    except sqlite3.Error:
        return (0, 0)


# Un mot ÉCRIT comme du code : camelCase, snake_case, fichier.ext, ou entre backticks.
# Seconde voie de la porte : ces identifiants vivent souvent dans les observations
# seules (`setSeatOccupancy`, `battle_started`), jamais dans un nom d'entité.
IDENTIFIANT = re.compile(r"`([^`\s]+)`|\b([a-z]+[A-Z]\w*|\w+_\w+|\w+\.[a-z]{2,4})\b")


def identifiants(prompt):
    """Les identifiants de code du prompt, repliés comme `terms` les replie."""
    vus = set()
    for brut in IDENTIFIANT.finditer(prompt):
        for t in terms(brut.group(1) or brut.group(2)):
            vus.add(t)
    return vus


def termes_du_projet(con, tokens, total, codes):
    """Les termes qui nomment quelque chose du projet, rares dans le graphe (au plus
    DF_MAX des entités) : présents dans le nom de 1 à NOM_MAX entités, ou écrits comme
    un identifiant de code et présents quelque part."""
    retenus = []
    for t in tokens:
        frequence, dans_noms = comptes(con, t)
        if frequence == 0 or frequence > DF_MAX * total:
            continue
        if t in codes or 1 <= dans_noms <= NOM_MAX:
            retenus.append(t)
    return retenus


def voisins(con, nom):
    """La ligne « ↳ → verbe x, ← verbe y » : les liens forts d'une entité, du plus fort
    au plus faible. Une flèche sortante se lit « nom verbe x », entrante « y verbe nom »."""
    trous = ",".join("?" * len(VERBES_SUIVIS))
    liens = con.execute(
        f"""SELECT '→', relation_type, to_entity FROM relations
              WHERE from_entity = ? AND relation_type IN ({trous})
            UNION ALL
            SELECT '←', relation_type, from_entity FROM relations
              WHERE to_entity = ? AND relation_type IN ({trous})""",
        (nom, *VERBES_SUIVIS, nom, *VERBES_SUIVIS)).fetchall()
    liens = sorted(liens, key=lambda lien: (VERBES_SUIVIS.index(lien[1]), lien[2]))[:MAX_VOISINS]
    if not liens:
        return None
    return "  ↳ " + ", ".join(f"{fleche} {verbe} `{autre}`" for fleche, verbe, autre in liens)


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
    # Porte d'entrée : le message nomme-t-il quelque chose du projet ? Sinon on se
    # tait. Sur-déclencher est LE défaut qui fait désactiver un hook permanent.
    tokens = termes_du_projet(con, tokens, total, identifiants(prompt))
    if not tokens:
        return
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
            "SELECT content FROM observations WHERE entity_name = ? "
            "AND content NOT GLOB 'INVALID *'", (nom,))]
        meilleure = con.execute(
            """SELECT text FROM memory_fts WHERE memory_fts MATCH ? AND entity_name = ?
               AND kind = 'obs' AND text NOT GLOB 'INVALID *'
               ORDER BY bm25(memory_fts) LIMIT 1""", (expr, nom)).fetchone()
        extrait = meilleure[0] if meilleure else (obs[0] if obs else "")
        if len(extrait) > MAX_OBS_CHARS:
            extrait = extrait[:MAX_OBS_CHARS - 1] + "…"
        lignes.append(f"- `{nom}` ({typ[0] if typ else '?'}, {len(obs)} obs) — {extrait}")
        ligne_voisins = voisins(con, nom)
        if ligne_voisins:
            lignes.append(ligne_voisins)
    con.close()

    contexte = (
        "Mémoire du projet — entrées pertinentes pour ce message (index compact ; "
        "pour le détail complet d'une entrée : `node scripts/memory/query.mjs --open <nom>`). "
        "Ce sont les meilleures "
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
    with open(USAGE_LOG, "a") as fh:
        fh.write(json.dumps({"ts": int(time.time()), "sid": sid, "event": "injected",
                             "names": pris}, ensure_ascii=False) + "\n")


try:
    main()
except Exception:
    pass   # un hook de mémoire ne doit jamais bloquer un prompt
sys.exit(0)
