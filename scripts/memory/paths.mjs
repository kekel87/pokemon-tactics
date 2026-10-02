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
import { installerMoteur, poserSchema } from "./fts.mjs";

const PROJET = "pokemon-tactics";

export function configDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

/** Répertoire contenant node_modules/@pepk/mcp-memory-sqlite (le store, sans le moteur). */
export function vendorDir() {
  const dir = process.env.PT_MEMORY_VENDOR || path.join(configDir(), ".claude", "vendor");
  if (!fs.existsSync(path.join(dir, "node_modules"))) {
    throw new Error(
      `Paquet de mémoire introuvable : ${dir}\n` +
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

/**
 * Charge le store du paquet et y installe le moteur de recherche du dépôt (`fts.mjs`).
 * `avecMoteur: false` pour l'import pur : ni recherche classée, ni garde anti-doublon.
 * Le schéma est posé à l'ouverture dans tous les cas (voir `poserSchema`).
 */
export async function ouvrirStore({ avecMoteur = true, exigerExistante = true } = {}) {
  const { KnowledgeGraphStore } = await import(
    path.join(vendorDir(), "node_modules/@pepk/mcp-memory-sqlite/dist/store.js")
  );
  if (avecMoteur) {
    installerMoteur(KnowledgeGraphStore);
  }
  const store = new KnowledgeGraphStore(dbPath({ exigerExistante }));
  poserSchema(store.db);
  return store;
}

/**
 * Dossier d'état des hooks de mémoire (état de session, log d'usage). Même résolution
 * que les deux hooks Python : `PT_MEMORY_STATE`, sinon `.claude/.state` du dépôt.
 */
export function etatMemoire() {
  return (
    process.env.PT_MEMORY_STATE || path.join(import.meta.dirname, "..", "..", ".claude", ".state")
  );
}
