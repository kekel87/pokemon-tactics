import { describe, expect, it } from "vitest";
import { classer } from "./fts.mjs";
import { fusionner, MotifRefusFusion, planifierFusion } from "./fusion.mjs";
import { baseDeTest, type Graphe } from "./memoire-de-test";

const SECTION = "Section : Jalon 2b — démonstrateur InfoPanel DOM";

const GRAPHE: Graphe = {
  "section-p1": { type: "historique", observations: [SECTION, "Le panneau passe en DOM."] },
  "section-p2": { type: "historique", observations: [SECTION, "Les jetons d'équipe enrichis."] },
  "decision-9": { type: "decision", observations: ["Le panneau reste en overlay."] },
  "plan-4": { type: "plan", observations: ["Plan du jalon 2b."] },
};

const RELATIONS: [string, string, string][] = [
  ["section-p2", "découle-de", "decision-9"],
  ["plan-4", "détaille", "section-p2"],
  ["section-p1", "découle-de", "decision-9"],
  ["section-p2", "révise", "section-p1"],
];

const TYPES = new Map(Object.entries(GRAPHE).map(([nom, entite]) => [nom, entite.type]));

describe("planifierFusion — refus", () => {
  it("exige une cible et au moins une source", () => {
    expect(planifierFusion({ arguments: ["section-p1"], types: TYPES })).toMatchObject({
      ok: false,
      motif: MotifRefusFusion.Arguments,
    });
  });

  it("refuse la cible parmi les sources", () => {
    expect(
      planifierFusion({ arguments: ["section-p1", "section-p1"], types: TYPES }),
    ).toMatchObject({ ok: false, motif: MotifRefusFusion.Repetition });
  });

  it("refuse une source introuvable", () => {
    expect(
      planifierFusion({ arguments: ["section-p1", "section-p9"], types: TYPES }),
    ).toMatchObject({ ok: false, motif: MotifRefusFusion.EntiteIntrouvable });
  });

  it("refuse de mêler deux types", () => {
    expect(
      planifierFusion({ arguments: ["section-p1", "decision-9"], types: TYPES }),
    ).toMatchObject({ ok: false, motif: MotifRefusFusion.TypesDifferents });
  });
});

describe("planifierFusion — ce qui passe", () => {
  it("accepte une cible existante du même type", () => {
    expect(planifierFusion({ arguments: ["section-p1", "section-p2"], types: TYPES })).toEqual({
      ok: true,
      cible: "section-p1",
      sources: ["section-p2"],
      type: "historique",
      creer: false,
    });
  });

  it("accepte une cible nouvelle, créée au type des sources", () => {
    expect(
      planifierFusion({ arguments: ["section", "section-p1", "section-p2"], types: TYPES }),
    ).toMatchObject({ ok: true, type: "historique", creer: true });
  });
});

describe("fusionner", () => {
  it("déplace les observations en écartant le quasi-doublon de section", () => {
    const db = baseDeTest(GRAPHE, RELATIONS);
    const verdict = planifierFusion({ arguments: ["section-p1", "section-p2"], types: TYPES });
    expect(verdict).toMatchObject({ ok: true });
    expect(fusionner(db, verdict)).toMatchObject({ observations: 1, ecartees: 1 });
    expect(
      db
        .prepare("SELECT content FROM observations WHERE entity_name = ? ORDER BY id")
        .all("section-p1"),
    ).toEqual([
      { content: SECTION },
      { content: "Le panneau passe en DOM." },
      { content: "Les jetons d'équipe enrichis." },
    ]);
  });

  it("recâble les relations entrantes et sortantes, sans doublon ni boucle", () => {
    const db = baseDeTest(GRAPHE, RELATIONS);
    fusionner(db, planifierFusion({ arguments: ["section-p1", "section-p2"], types: TYPES }));
    expect(
      db
        .prepare(
          "SELECT from_entity, relation_type, to_entity FROM relations ORDER BY from_entity, to_entity",
        )
        .all(),
    ).toEqual([
      { from_entity: "plan-4", relation_type: "détaille", to_entity: "section-p1" },
      { from_entity: "section-p1", relation_type: "découle-de", to_entity: "decision-9" },
    ]);
  });

  it("supprime la source et réindexe ses observations sous la cible", () => {
    const db = baseDeTest(GRAPHE, RELATIONS);
    fusionner(db, planifierFusion({ arguments: ["section-p1", "section-p2"], types: TYPES }));
    expect(db.prepare("SELECT name FROM entities WHERE name = ?").all("section-p2")).toEqual([]);
    expect(classer(db, "jetons")).toEqual(["section-p1"]);
  });

  it("recolle les morceaux sous un nom nouveau", () => {
    const db = baseDeTest(GRAPHE, RELATIONS);
    const verdict = planifierFusion({
      arguments: ["section", "section-p1", "section-p2"],
      types: TYPES,
    });
    expect(verdict).toMatchObject({ ok: true, creer: true });
    fusionner(db, verdict);
    expect(
      db.prepare("SELECT name, entity_type FROM entities WHERE name LIKE 'section%'").all(),
    ).toEqual([{ name: "section", entity_type: "historique" }]);
    expect(classer(db, "jetons")).toEqual(["section"]);
  });

  it("écarte une ponctuation seule déjà présente mot pour mot sur la cible", () => {
    const db = baseDeTest({
      "notes-p1": { type: "historique", observations: ["—", "Première moitié du texte."] },
      "notes-p2": { type: "historique", observations: ["—", "Seconde moitié du texte."] },
    });
    const types = new Map([
      ["notes-p1", "historique"],
      ["notes-p2", "historique"],
    ]);
    expect(
      fusionner(db, planifierFusion({ arguments: ["notes-p1", "notes-p2"], types })),
    ).toMatchObject({ observations: 1, ecartees: 1 });
  });

  it("garde la récence la plus haute du groupe", () => {
    const db = baseDeTest(GRAPHE, RELATIONS, [
      ["section-p1", 10],
      ["section-p2", 30],
    ]);
    fusionner(db, planifierFusion({ arguments: ["section-p1", "section-p2"], types: TYPES }));
    expect(db.prepare("SELECT entity_name, ts FROM entity_recency").all()).toEqual([
      { entity_name: "section-p1", ts: 30 },
    ]);
  });
});

describe("récence — suit l'entité", () => {
  it("disparaît avec l'entité supprimée et suit un renommage", () => {
    const db = baseDeTest(GRAPHE, RELATIONS, [
      ["decision-9", 5],
      ["plan-4", 6],
    ]);
    db.prepare("DELETE FROM entities WHERE name = ?").run("decision-9");
    db.prepare("UPDATE entities SET name = ? WHERE name = ?").run("plan-4-bis", "plan-4");
    expect(db.prepare("SELECT entity_name, ts FROM entity_recency").all()).toEqual([
      { entity_name: "plan-4-bis", ts: 6 },
    ]);
  });
});
