/**
 * Fabrique de graphe de mémoire pour les tests : une base `node:sqlite` en mémoire, avec le
 * schéma du paquet `@pepk/mcp-memory-sqlite` et le moteur du dépôt posé par-dessus.
 */
import { DatabaseSync } from "node:sqlite";
import { poserSchema } from "./fts.mjs";

const SCHEMA_PAQUET = `
  CREATE TABLE entities (name TEXT PRIMARY KEY, entity_type TEXT NOT NULL);
  CREATE TABLE observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, entity_name TEXT NOT NULL, content TEXT NOT NULL,
    UNIQUE(entity_name, content));
  CREATE TABLE relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, from_entity TEXT NOT NULL, to_entity TEXT NOT NULL,
    relation_type TEXT NOT NULL, UNIQUE(from_entity, to_entity, relation_type));`;

export type Graphe = Record<string, { type: string; observations: string[] }>;

export function baseDeTest(
  graphe: Graphe,
  relations: readonly [string, string, string][] = [],
  recences: readonly [string, number][] = [],
): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA_PAQUET);
  poserSchema(db);
  const entite = db.prepare("INSERT INTO entities (name, entity_type) VALUES (?, ?)");
  const observation = db.prepare("INSERT INTO observations (entity_name, content) VALUES (?, ?)");
  const relation = db.prepare(
    "INSERT INTO relations (from_entity, relation_type, to_entity) VALUES (?, ?, ?)",
  );
  for (const [nom, { type, observations }] of Object.entries(graphe)) {
    entite.run(nom, type);
    for (const texte of observations) {
      observation.run(nom, texte);
    }
  }
  for (const [de, verbe, vers] of relations) {
    relation.run(de, verbe, vers);
  }
  const recence = db.prepare("INSERT INTO entity_recency (entity_name, ts) VALUES (?, ?)");
  for (const [nom, ts] of recences) {
    recence.run(nom, ts);
  }
  return db;
}
