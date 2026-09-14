import { describe, expect, it } from "vitest";
import { FRAGMENT_MIN, MotifRefus, PLAFOND_FORGET_ALL, planifierOubli } from "./forget-guards.mjs";

const OBSERVATIONS = [
  "Le maillage complet est la topologie retenue depuis la décision 899.",
  "Le tampon de réordonnancement lève l'obstacle du garde-fou d'index.",
  "La migration d'hôte élit la plus petite place connectée.",
];

const DATEES = [
  "Décidé le 2026-09-14 : le maillage complet tient à douze pairs.",
  "Décidé le 2026-09-14 : la migration d'hôte élit la plus petite place.",
  "Sans rapport : le tampon de réordonnancement lève le garde-fou d'index.",
];

describe("planifierOubli — arité et plancher, les deux défauts Critical du 2026-09-14", () => {
  it("refuse les arguments surnuméraires plutôt que de les jeter en silence", () => {
    const verdict = planifierOubli({
      tout: true,
      arguments: ["agenda", "le", "plan", "42"],
      observations: OBSERVATIONS,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.motif).toBe(MotifRefus.Arguments);
    expect(verdict.ok === false && verdict.message).toContain("reçu 4");
  });

  it("refuse un fragment manquant", () => {
    expect(
      planifierOubli({ tout: false, arguments: ["agenda"], observations: OBSERVATIONS }).ok,
    ).toBe(false);
    expect(planifierOubli({ tout: false, arguments: [], observations: OBSERVATIONS }).ok).toBe(
      false,
    );
  });

  it("refuse un fragment plus court que le plancher", () => {
    const verdict = planifierOubli({
      tout: false,
      arguments: ["agenda", "maillage"],
      observations: OBSERVATIONS,
    });
    expect(verdict.ok === false && verdict.motif).toBe(MotifRefus.FragmentCourt);
  });

  it("compte les caractères utiles, pas les espaces", () => {
    const rembourre = `  ${"a".repeat(FRAGMENT_MIN - 1)}   `;
    expect(rembourre.length).toBeGreaterThan(FRAGMENT_MIN);
    const verdict = planifierOubli({
      tout: false,
      arguments: ["agenda", rembourre],
      observations: OBSERVATIONS,
    });
    expect(verdict.ok === false && verdict.motif).toBe(MotifRefus.FragmentCourt);
  });
});

describe("planifierOubli — ce qui passe", () => {
  it("retient la seule observation qui contient le fragment", () => {
    const verdict = planifierOubli({
      tout: false,
      arguments: ["agenda", "migration d'hôte"],
      observations: OBSERVATIONS,
    });
    expect(verdict.ok).toBe(true);
    expect(verdict.ok === true && verdict.touchees).toEqual([OBSERVATIONS[2]]);
    expect(verdict.ok === true && verdict.nom).toBe("agenda");
    expect(verdict.ok === true && verdict.fragment).toBe("migration d'hôte");
  });

  it("assume deux correspondances sur trois sous --forget-all", () => {
    const verdict = planifierOubli({
      tout: true,
      arguments: ["agenda", "Décidé le 2026-09-14"],
      observations: DATEES,
    });
    expect(verdict.ok).toBe(true);
    expect(verdict.ok === true && verdict.touchees).toEqual([DATEES[0], DATEES[1]]);
  });

  it("refuse le même fragment sous --forget nu", () => {
    const verdict = planifierOubli({
      tout: false,
      arguments: ["agenda", "Décidé le 2026-09-14"],
      observations: DATEES,
    });
    expect(verdict.ok === false && verdict.motif).toBe(MotifRefus.Ambigu);
    expect(verdict.ok === false && verdict.message).toContain("--forget-all");
  });

  it("accepte exactement le plafond de correspondances sous --forget-all", () => {
    const observations = [
      ...Array.from(
        { length: PLAFOND_FORGET_ALL },
        (_, index) => `observation répétitive numéro ${index}`,
      ),
      "une observation tout à fait différente",
    ];
    const verdict = planifierOubli({
      tout: true,
      arguments: ["agenda", "observation répétitive"],
      observations,
    });
    expect(verdict.ok).toBe(true);
    expect(verdict.ok === true && verdict.touchees).toHaveLength(PLAFOND_FORGET_ALL);
  });
});

describe("planifierOubli — la correspondance est une sous-chaîne exacte", () => {
  it("ne correspond pas quand la casse diffère", () => {
    const verdict = planifierOubli({
      tout: false,
      arguments: ["agenda", "LE MAILLAGE COMPLET"],
      observations: OBSERVATIONS,
    });
    expect(verdict.ok === false && verdict.motif).toBe(MotifRefus.AucuneCorrespondance);
  });

  it("ne correspond pas quand les accents sont absents", () => {
    const verdict = planifierOubli({
      tout: false,
      arguments: ["agenda", "La migration d'hote elit"],
      observations: OBSERVATIONS,
    });
    expect(verdict.ok === false && verdict.motif).toBe(MotifRefus.AucuneCorrespondance);
  });

  it("refuse, et ne réussit pas en silence, quand rien ne correspond", () => {
    const verdict = planifierOubli({
      tout: false,
      arguments: ["agenda", "un texte parfaitement absent"],
      observations: OBSERVATIONS,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.message).toContain("SOUS-CHAÎNE EXACTE");
  });
});

describe("planifierOubli — les refus de sur-suppression", () => {
  it("refuse un fragment qui viderait l'entité, même sous --forget-all", () => {
    const verdict = planifierOubli({
      tout: true,
      arguments: ["agenda", "une phrase commune"],
      observations: ["une phrase commune ici", "une phrase commune là"],
    });
    expect(verdict.ok === false && verdict.motif).toBe(MotifRefus.Viderait);
  });

  it("juge « viderait » avant « plafond » quand les deux s'appliquent", () => {
    const verdict = planifierOubli({
      tout: true,
      arguments: ["agenda", "observation répétitive"],
      observations: Array.from(
        { length: PLAFOND_FORGET_ALL + 2 },
        (_, index) => `observation répétitive numéro ${index}`,
      ),
    });
    expect(verdict.ok === false && verdict.motif).toBe(MotifRefus.Viderait);
  });

  it("refuse au-delà du plafond de --forget-all", () => {
    const verdict = planifierOubli({
      tout: true,
      arguments: ["agenda", "observation répétitive"],
      observations: [
        ...Array.from(
          { length: PLAFOND_FORGET_ALL + 2 },
          (_, index) => `observation répétitive numéro ${index}`,
        ),
        "une observation tout à fait différente",
      ],
    });
    expect(verdict.ok === false && verdict.motif).toBe(MotifRefus.Plafond);
  });

  it("refuse plusieurs correspondances sous --forget nu, et les énumère", () => {
    const verdict = planifierOubli({
      tout: false,
      arguments: ["agenda", "Le tampon de ré"],
      observations: [
        ...OBSERVATIONS,
        "Le tampon de réordonnancement est rejoué en FIFO.",
        "Une observation sans rapport, pour que l'entité ne soit pas vidée.",
      ],
    });
    expect(verdict.ok === false && verdict.motif).toBe(MotifRefus.Ambigu);
    expect(verdict.ok === false && verdict.message).toContain("FIFO");
  });
});

describe("planifierOubli — l'ordre des gardes", () => {
  it("refuse une entité introuvable, et la nomme", () => {
    const verdict = planifierOubli({
      tout: false,
      arguments: ["entite-absente", "un fragment assez long"],
      observations: null,
    });
    expect(verdict.ok === false && verdict.motif).toBe(MotifRefus.EntiteIntrouvable);
    expect(verdict.ok === false && verdict.message).toContain("entite-absente");
  });

  it("juge les arguments avant de chercher l'entité", () => {
    const verdict = planifierOubli({
      tout: false,
      arguments: ["agenda", "le", "plan"],
      observations: null,
    });
    expect(verdict.ok === false && verdict.motif).toBe(MotifRefus.Arguments);
  });

  it("juge le plancher du fragment avant de chercher l'entité", () => {
    const verdict = planifierOubli({
      tout: false,
      arguments: ["entite-absente", "court"],
      observations: null,
    });
    expect(verdict.ok === false && verdict.motif).toBe(MotifRefus.FragmentCourt);
  });
});
