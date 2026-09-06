/**
 * Charge le JSON produit par extract.py dans le graphe de memoire.
 *
 * Passe par l'API du paquet (et non par du SQL brut) pour que le schema soit
 * exact par construction, et pour beneficier du garde anti-doublons de
 * l'enveloppe FTS5. L'index FTS se reconstruit tout seul a la premiere recherche
 * (l'enveloppe compare le compte de lignes au contenu du graphe).
 *
 * Usage : HOME=<repertoire du graphe> node import.mjs <graph.json>
 */
import { readFileSync } from "node:fs";
import { dbPath, ouvrirStore } from "./paths.mjs";

const data = JSON.parse(readFileSync(process.argv[2], "utf8"));

console.log(`base       : ${dbPath({ exigerExistante: false })}`);
// Sans enveloppe : l'import massif n'a pas besoin de la recherche, et le serveur
// MCP qu'elle démarre n'a rien à faire ici.
const store = await ouvrirStore({ avecEnveloppe: false, exigerExistante: false });

const ents = store.createEntities(data.entities);
console.log(`entités    : ${ents.length} créées / ${data.entities.length} soumises`);

// Les cibles doivent EXISTER : une relation vers une entité absente leve une
// violation de cle etrangere qui annule tout le lot. Les plans referencent des
// numeros de decision qui n'existent pas (3 trous dans la sequence, et des renvois
// a des numeros jamais attribues) — on les ecarte au lieu de perdre les 153 autres.
const presentes = new Set(
  store.db
    .prepare("SELECT name FROM entities")
    .all()
    .map((r) => r.name),
);
const valides = (data.relations ?? []).filter((r) => presentes.has(r.from) && presentes.has(r.to));
const orphelines = (data.relations ?? []).length - valides.length;
const rels = store.createRelations(valides);
console.log(
  `relations  : ${rels.length} créées / ${valides.length} valides` +
    (orphelines ? ` (${orphelines} vers une entité absente, écartées)` : ""),
);

const c = (t) => store.db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
console.log(
  `--- en base : ${c("entities")} entités, ${c("observations")} observations, ${c("relations")} relations`,
);
