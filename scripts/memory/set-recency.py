#!/usr/bin/env python3
"""Alimente entity_recency depuis les dates trouvees dans les observations.

Le classement BM25 ignore le temps. Sur un corpus de decisions ou l'une supersede
l'autre, c'est un defaut : la plus verbeuse remonte, pas la plus recente. Cette
table donne au classement un bonus borne (voir memory-fts.mjs).

Une entite sans date ne recoit aucun bonus — pas de date inventee.
"""
import datetime
import os
import re
import sqlite3
import sys

DATE = re.compile(r"(20\d\d)-(\d\d)-(\d\d)")
# 🔴 Ce script fait un DROP TABLE sur la base qu'il trouve. Le repli d'origine
# (`~/.claude/memory.db`) pointait AILLEURS que le graphe du projet : lancé sans
# argument, il opérait sur une base étrangère — ou en créait une — en rapportant un
# succès. La résolution est donc la même que partout ailleurs, et on échoue si la
# base n'existe pas plutôt que d'en fabriquer une vide.
PROJET = "pokemon-tactics"
config = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~/.claude")
racine = os.environ.get("PT_MEMORY_HOME") or os.path.join(config, "memory", PROJET)
db_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(racine, ".claude", "memory.db")
if not os.path.exists(db_path):
    sys.exit(f"Base de mémoire introuvable : {db_path}\n"
             "Surcharge possible : PT_MEMORY_HOME (racine, sans /.claude/memory.db).")
c = sqlite3.connect(db_path)
c.execute("CREATE TABLE IF NOT EXISTS entity_recency (entity_name TEXT PRIMARY KEY, ts REAL NOT NULL)")
# Force la reconstruction de l'index : le schema est en CREATE IF NOT EXISTS, donc
# un changement de tokeniseur n'a aucun effet sur une table deja creee.
c.execute("DROP TABLE IF EXISTS memory_fts")
for t in ("ai_entity", "ad_entity", "ai_obs", "ad_obs"):
    c.execute(f"DROP TRIGGER IF EXISTS memory_fts_{t}")

vus = {}
for nom, contenu in c.execute("SELECT entity_name, content FROM observations"):
    for a, m, j in DATE.findall(contenu or ""):
        try:
            ts = datetime.date(int(a), int(m), int(j)).toordinal()
        except ValueError:
            continue
        if ts > vus.get(nom, 0):
            vus[nom] = ts

c.executemany("INSERT OR REPLACE INTO entity_recency VALUES (?, ?)", vus.items())
c.commit()
total = c.execute("SELECT COUNT(*) FROM entities").fetchone()[0]
print(f"récence renseignée : {len(vus)} / {total} entités")
if vus:
    lo, hi = min(vus.values()), max(vus.values())
    print(f"plage : {datetime.date.fromordinal(lo)} → {datetime.date.fromordinal(hi)}")
print("index FTS supprimé — il se reconstruira à la prochaine recherche")
