/**
 * Fusion d'entités : `query.mjs --merge <cible> <source...>` (plan 218).
 *
 * La migration du plan 200 a découpé une même section de document en plusieurs entités
 * (`…-p1` / `…-p2`, `…-01-…` / `…-02-…`) qui partagent leur observation « Section : … ».
 * Sur une question, ces morceaux se disputent les quatre places du hook de rappel au lieu
 * d'en prendre une. Fusionner les recolle.
 *
 * `planifierFusion` est pur (gardes) ; `fusionner` agit sur une base qui expose `exec` et
 * `prepare` — better-sqlite3 en production, `node:sqlite` en test (fusion.test.ts).
 */
import { enTransaction, estNouvelle, normaliser } from "./fts.mjs";

export const MotifRefusFusion = Object.freeze({
  /** Moins de deux noms : il faut une cible et au moins une source. */
  Arguments: "arguments",
  EntiteIntrouvable: "entite-introuvable",
  /** La cible figure parmi les sources, ou une source est répétée. */
  Repetition: "repetition",
  /** On ne fusionne que des entités de même type : un plan n'absorbe pas une décision. */
  TypesDifferents: "types-differents",
});

/**
 * Décide ce qu'un `--merge` doit faire, sans rien faire.
 *
 * @param {object} demande
 * @param {readonly string[]} demande.arguments `[cible, source, ...]`.
 * @param {ReadonlyMap<string, string>} demande.types Type de chaque entité nommée qui existe.
 *   La cible peut ne pas exister : elle est alors créée avec le type des sources — c'est
 *   ainsi qu'on recolle `x-p1`, `x-p2` sous le nom `x`, sans renommage.
 * @returns {{ ok: true, cible: string, sources: string[], type: string, creer: boolean }
 *   | { ok: false, motif: (typeof MotifRefusFusion)[keyof typeof MotifRefusFusion], message: string }}
 */
export function planifierFusion({ arguments: noms, types }) {
  if (noms.length < 2) {
    return {
      ok: false,
      motif: MotifRefusFusion.Arguments,
      message: "usage : --merge <cible> <source> [source...]",
    };
  }
  const [cible = "", ...sources] = noms;
  if (new Set(noms).size !== noms.length) {
    return {
      ok: false,
      motif: MotifRefusFusion.Repetition,
      message:
        "un même nom apparaît deux fois (la cible parmi les sources, ou une source répétée).",
    };
  }
  const absentes = sources.filter((nom) => !types.has(nom));
  if (absentes.length) {
    return {
      ok: false,
      motif: MotifRefusFusion.EntiteIntrouvable,
      message: `entité(s) introuvable(s) : ${absentes.join(", ")}`,
    };
  }
  const creer = !types.has(cible);
  const typeCible = types.get(cible) ?? types.get(sources[0] ?? "") ?? "";
  const ecarts = sources.filter((source) => types.get(source) !== typeCible);
  if (ecarts.length) {
    return {
      ok: false,
      motif: MotifRefusFusion.TypesDifferents,
      message: `types différents de la cible [${typeCible}] : ${ecarts.map((source) => `${source} [${types.get(source)}]`).join(", ")}`,
    };
  }
  return { ok: true, cible, sources, type: typeCible, creer };
}

/**
 * Applique une fusion validée, en une transaction :
 *   - la cible est créée si elle n'existe pas encore ;
 *   - les observations des sources passent sur la cible, sauf les quasi-doublons
 *     (même forme normalisée) — supprimer puis réinsérer, pour que les triggers FTS
 *     réindexent sous le nom de la cible ;
 *   - les relations, sortantes ET entrantes, sont recâblées sur la cible ; un doublon
 *     déjà présent garde la relation la plus ancienne, une boucle (cible → cible) disparaît ;
 *   - la récence de la cible prend la plus haute du groupe ;
 *   - les sources sont supprimées.
 *
 * @param {ReturnType<typeof planifierFusion>} verdict le verdict de `planifierFusion` ; un
 *   refus lève une erreur plutôt que d'être appliqué en silence.
 * @returns {{ observations: number, ecartees: number, relations: number }}
 */
export function fusionner(db, verdict) {
  if (!verdict.ok) {
    throw new Error(verdict.message);
  }
  const { cible, sources, type, creer } = verdict;
  const bilan = { observations: 0, ecartees: 0, relations: 0 };
  const lireObservations = db.prepare(
    "SELECT id, content FROM observations WHERE entity_name = ? ORDER BY id",
  );
  const supprimerObservation = db.prepare("DELETE FROM observations WHERE id = ?");
  // OR IGNORE : une observation de ponctuation seule n'est jamais un quasi-doublon (forme
  // normalisée vide), mais peut exister mot pour mot sur la cible — UNIQUE la refuserait.
  const ajouterObservation = db.prepare(
    "INSERT OR IGNORE INTO observations (entity_name, content) VALUES (?, ?)",
  );
  const lireRelations = db.prepare(
    "SELECT id, from_entity, relation_type, to_entity FROM relations " +
      "WHERE from_entity = ? OR to_entity = ?",
  );
  const supprimerRelation = db.prepare("DELETE FROM relations WHERE id = ?");
  const ajouterRelation = db.prepare(
    "INSERT OR IGNORE INTO relations (from_entity, to_entity, relation_type) VALUES (?, ?, ?)",
  );

  enTransaction(db, () => {
    if (creer) {
      db.prepare("INSERT INTO entities (name, entity_type) VALUES (?, ?)").run(cible, type);
    }
    const vues = new Set(
      lireObservations.all(cible).map((observation) => normaliser(observation.content)),
    );
    for (const source of sources) {
      for (const { id, content } of lireObservations.all(source)) {
        supprimerObservation.run(id);
        if (estNouvelle(vues, content) && ajouterObservation.run(cible, content).changes) {
          bilan.observations++;
        } else {
          bilan.ecartees++;
        }
      }
      for (const relation of lireRelations.all(source, source)) {
        supprimerRelation.run(relation.id);
        const de = relation.from_entity === source ? cible : relation.from_entity;
        const vers = relation.to_entity === source ? cible : relation.to_entity;
        if (de !== vers && ajouterRelation.run(de, vers, relation.relation_type).changes) {
          bilan.relations++;
        }
      }
    }
    const trous = sources.map(() => "?").join(", ");
    db.prepare(
      "INSERT INTO entity_recency (entity_name, ts) " +
        `SELECT ?, MAX(ts) FROM entity_recency WHERE entity_name IN (?, ${trous}) ` +
        "HAVING MAX(ts) IS NOT NULL ON CONFLICT(entity_name) DO UPDATE SET ts = excluded.ts",
    ).run(cible, cible, ...sources);
    db.prepare(`DELETE FROM entities WHERE name IN (${trous})`).run(...sources);
  });
  return bilan;
}
