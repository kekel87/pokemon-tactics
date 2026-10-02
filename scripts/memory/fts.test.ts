import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assurerIndex,
  BONUS_CONFIRME,
  classer,
  DF_MAX,
  estInvalide,
  MARQUEUR_CONFIRME,
  MARQUEUR_INVALIDE,
  MOTS_VIDES,
  NUMEROTANTS,
  normaliser,
  plafonner,
  termes,
} from "./fts.mjs";
import { baseDeTest, type Graphe } from "./memoire-de-test";

const GRAPHE_RELAIS: Graphe = {
  "plan-x": { type: "plan", observations: ["le relais turn débloque le NAT."] },
  "plan-y": { type: "plan", observations: ["le relais turn passe par un Durable Object."] },
};

describe("termes — tokenisation de la requête", () => {
  it("replie les accents, comme unicode61 dans l'index", () => {
    expect(termes("mémoire écartée")).toEqual(["memoire", "ecartee"]);
  });

  it("émet les composés entiers ET éclatés", () => {
    expect(termes("ci-gate")).toEqual(["ci-gate", "ci", "gate"]);
  });

  it("retire les mots vides, sauf si la requête n'est faite que d'eux", () => {
    expect(termes("pour le roster")).toEqual(["roster"]);
    expect(termes("pour le")).toEqual(["pour", "le"]);
  });
});

describe("normaliser — clé de quasi-doublon", () => {
  it("ignore casse, accents, ponctuation et espaces", () => {
    expect(normaliser("Le  Gate, est LENT !")).toBe(normaliser("le gate est lent"));
    expect(normaliser("décidé")).toBe("decide");
  });
});

describe("classer — classement BM25", () => {
  it("MAX par champ, pas SOMME : une touche précise bat l'accumulation", () => {
    const db = baseDeTest({
      "decision-llvmpipe": { type: "decision", observations: ["llvmpipe écarté pour la CI."] },
      "historique-bavard": {
        type: "historique",
        observations: Array.from({ length: 30 }, (_, i) => `session ${i} : on a parlé de llvmpipe`),
      },
    });
    expect(classer(db, "llvmpipe")[0]).toBe("decision-llvmpipe");
  });

  it("ne sert pas une entité dont la seule correspondance est invalidée", () => {
    const db = baseDeTest({
      "decision-a": {
        type: "decision",
        observations: ["INVALID 2026-10-02: remplacé par decision-b — swiftshader retenu."],
      },
      "decision-b": { type: "decision", observations: ["swiftshader est le rendu de la CI."] },
    });
    expect(classer(db, "swiftshader")).toEqual(["decision-b"]);
  });

  it("donne le bonus à une entité portant un fait CONFIRMED", () => {
    const ordreNeutre = classer(baseDeTest(GRAPHE_RELAIS), "relais");
    expect(ordreNeutre).toHaveLength(2);
    const perdant = ordreNeutre[1] ?? "";
    const avec = baseDeTest(GRAPHE_RELAIS);
    avec
      .prepare("INSERT INTO observations (entity_name, content) VALUES (?, ?)")
      .run(perdant, "CONFIRMED 2026-10-02: validé en partie réelle.");
    expect(classer(avec, "relais")[0]).toBe(perdant);
  });
});

describe("index FTS — triggers et auto-réparation", () => {
  it("réindexe une observation réécrite en place (--invalidate)", () => {
    const db = baseDeTest({
      "decision-z": { type: "decision", observations: ["zinzolin retenu."] },
    });
    db.prepare("UPDATE observations SET content = ? WHERE entity_name = ?").run(
      "INVALID 2026-10-02: abandonné — zinzolin retenu.",
      "decision-z",
    );
    const lignes = db
      .prepare("SELECT text FROM memory_fts WHERE entity_name = ? AND kind = 'obs'")
      .all("decision-z");
    expect(lignes).toEqual([{ text: "INVALID 2026-10-02: abandonné — zinzolin retenu." }]);
    expect(classer(db, "zinzolin")).toEqual([]);
  });

  it("se reconstruit quand son nombre de lignes ne correspond plus au graphe", () => {
    const db = baseDeTest({
      "decision-r": { type: "decision", observations: ["rhizome indexé."] },
    });
    db.exec("DELETE FROM memory_fts");
    assurerIndex(db);
    expect(classer(db, "rhizome")).toEqual(["decision-r"]);
  });
});

describe("plafonner — sortie de recherche", () => {
  it("masque les observations invalidées et les compte", () => {
    const sortie = plafonner(["fait vivant", "INVALID 2026-10-02: périmé — ancien fait"], "e");
    expect(sortie).toEqual(["fait vivant", "[… 1 invalidée(s) — --open e]"]);
  });

  it("n'appelle marqueur que le préfixe exact, sensible à la casse", () => {
    expect(estInvalide("INVALID 2026-10-02: x")).toBe(true);
    expect(estInvalide("le cas invalid de la garde")).toBe(false);
    expect(estInvalide("invalid 2026-10-02: x")).toBe(false);
  });
});

describe("contrat avec le hook de rappel — les deux moitiés cherchent pareil", () => {
  const hook = readFileSync(
    path.join(import.meta.dirname, "../../.claude/hooks/inject-memory-recall.py"),
    "utf8",
  );

  it("exclut les observations INVALID et applique le même bonus CONFIRMED", () => {
    expect(hook).toContain(`NOT (kind = 'obs' AND text GLOB '${MARQUEUR_INVALIDE}*')`);
    expect(hook).toContain(`AND o.content GLOB '${MARQUEUR_CONFIRME}*'`);
    expect(hook).toContain(`BONUS_CONFIRME = ${BONUS_CONFIRME}`);
  });

  it("lit la même liste de mots vides, qui réunit les deux anciennes", () => {
    expect(hook).toMatch(/mots-vides\.txt/);
    expect(hook).not.toMatch(/^STOP\s*=/m);
    expect(MOTS_VIDES.has("something")).toBe(true);
    expect(MOTS_VIDES.has("parfait")).toBe(true);
  });

  it("filtre les termes communs au même seuil", () => {
    expect(hook).toContain(`DF_MAX = ${DF_MAX}`);
  });

  it("n'admet un nombre seul que derrière les mêmes mots qui numérotent", () => {
    const ensemble = NUMEROTANTS.map((mot) => `"${mot}"`).join(", ");
    expect(hook.replace(/\s+/g, " ")).toContain(`NUMEROTANTS = {${ensemble}}`);
  });
});
