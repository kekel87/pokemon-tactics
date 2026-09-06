/**
 * Point de résolution UNIQUE du graphe de mémoire.
 *
 * Il en existait cinq, divergentes : deux scripts retombaient sur
 * `~/.claude/memory.db` et créaient une base NEUVE au mauvais endroit en
 * rapportant un succès — dont un qui y faisait un `DROP TABLE`. Et la commande
 * documentée dans CLAUDE.md échouait faute de variables d'environnement, alors
 * qu'elle est présentée comme le cœur du dispositif.
 *
 * Tout se déduit de CLAUDE_CONFIG_DIR ; les variables PT_MEMORY_* restent des
 * surcharges explicites. Aucun chemin machine en dur : ce fichier est public.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJET = "pokemon-tactics";

export function configDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

/** Répertoire contenant node_modules/@pepk/mcp-memory-sqlite et memory-fts.mjs. */
export function vendorDir() {
  const dir = process.env.PT_MEMORY_VENDOR || path.join(configDir(), ".claude", "vendor");
  if (!fs.existsSync(path.join(dir, "node_modules"))) {
    throw new Error(
      `Enveloppe de mémoire introuvable : ${dir}\n` +
        "Attendu : <config>/.claude/vendor avec node_modules/@pepk/mcp-memory-sqlite.\n" +
        "Surcharge possible : PT_MEMORY_VENDOR.",
    );
  }
  return dir;
}

/** Racine du graphe. `<racine>/.claude/memory.db` est la base. */
export function memoryHome() {
  return process.env.PT_MEMORY_HOME || path.join(configDir(), "memory", PROJET);
}

/**
 * Chemin de la base. `exigerExistante` par défaut : mieux vaut échouer que créer
 * silencieusement une base vide ailleurs — c'est exactement ce qui rendait deux
 * scripts dangereux.
 */
export function dbPath({ exigerExistante = true } = {}) {
  const p = path.join(memoryHome(), ".claude", "memory.db");
  if (exigerExistante && !fs.existsSync(p)) {
    throw new Error(
      `Base de mémoire introuvable : ${p}\n` +
        "Surcharge possible : PT_MEMORY_HOME (racine, sans le /.claude/memory.db).",
    );
  }
  return p;
}

/** Charge le store, enveloppe FTS comprise. `avecEnveloppe: false` pour l'import pur. */
export async function ouvrirStore({ avecEnveloppe = true, exigerExistante = true } = {}) {
  const vendor = vendorDir();
  if (avecEnveloppe) {
    // L'enveloppe démarre le serveur MCP en fin de fichier, et celui-ci analyse
    // argv : on le lui cache pendant le chargement. On ne restaure PAS ensuite —
    // le processus sort par process.exit(), ce qui tue le serveur avec lui.
    const vrais = process.argv.slice(2);
    process.argv = process.argv.slice(0, 2);
    process.env.HOME = memoryHome(); // le paquet résout $HOME/.claude/memory.db
    // Le serveur annonce son démarrage et le chemin de la base sur stderr à CHAQUE
    // appel — du bruit facturé dans le transcript. On le tait pendant le chargement,
    // mais on laisse passer ce qui compte : un repli sur la recherche LIKE signale
    // que l'index FTS est cassé, et ça, il faut le voir.
    const erreurReelle = console.error;
    console.error = (...a) => {
      const t = String(a[0] ?? "");
      if (t.includes("falling back to LIKE") || t.includes("rebuilt index")) {
        erreurReelle(...a);
      }
    };
    try {
      await import(path.join(vendor, "memory-fts.mjs"));
    } finally {
      console.error = erreurReelle;
      process.argv = [...process.argv.slice(0, 2), ...vrais];
    }
  }
  const { KnowledgeGraphStore } = await import(
    path.join(vendor, "node_modules/@pepk/mcp-memory-sqlite/dist/store.js")
  );
  return new KnowledgeGraphStore(dbPath({ exigerExistante }));
}
