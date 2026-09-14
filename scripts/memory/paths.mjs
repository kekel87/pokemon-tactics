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
  const store = new KnowledgeGraphStore(dbPath({ exigerExistante }));
  poserTriggersDeType(store);
  return store;
}

/**
 * Les triggers qui tiennent la ligne `kind = 'type'` de l'index FTS alignée sur
 * `entities.entity_type`.
 *
 * Ils vivent ICI, dans le dépôt, et se reposent à chaque ouverture du store, parce
 * que le propriétaire du schéma FTS — `memory-fts.mjs` dans l'enveloppe — n'en
 * déclare que quatre : INSERT et DELETE sur `entities` et sur `observations`, jamais
 * UPDATE. Une base reconstruite par l'enveloppe repart donc sans eux.
 *
 * Et leur absence ne se voit pas : l'auto-réparation de l'enveloppe compare des
 * NOMBRES de lignes (2 x entités + observations), or retyper une entité n'en change
 * aucun. L'index mentirait sur le type, définitivement et en silence — la panne
 * exacte que la bascule de type avait déjà produite le 2026-09-10.
 *
 * `IF NOT EXISTS` : l'appel est idempotent, il ne coûte rien sur une base déjà à jour.
 */
function poserTriggersDeType(store) {
  store.db.exec(`
    CREATE TRIGGER IF NOT EXISTS memory_fts_au_entity
    AFTER UPDATE OF entity_type ON entities BEGIN
      DELETE FROM memory_fts WHERE entity_name = old.name AND kind = 'type';
      INSERT INTO memory_fts(entity_name, kind, text)
        VALUES (new.name, 'type', new.entity_type);
    END;
    CREATE TRIGGER IF NOT EXISTS memory_fts_au_entity_rename
    AFTER UPDATE OF name ON entities BEGIN
      UPDATE memory_fts SET entity_name = new.name WHERE entity_name = old.name;
      DELETE FROM memory_fts WHERE entity_name = new.name AND kind = 'name';
      INSERT INTO memory_fts(entity_name, kind, text)
        VALUES (new.name, 'name', REPLACE(new.name, '-', ' '));
    END;
  `);
}
