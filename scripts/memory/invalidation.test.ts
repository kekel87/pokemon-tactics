import { describe, expect, it } from "vitest";
import { MotifRefusInvalidation, planifierInvalidation, texteInvalide } from "./invalidation.mjs";

const OBSERVATIONS = [
  "Le maillage complet est la topologie retenue depuis la décision 899.",
  "Le tampon de réordonnancement lève l'obstacle du garde-fou d'index.",
  "INVALID 2026-09-30: remplacé par le relais — la migration d'hôte élit la plus petite place.",
];
const DATE = "2026-10-02";
const RAISON = "remplacé par decision-1100, relais turn";

function planifier(arguments_: string[], observations: string[] | null = OBSERVATIONS) {
  return planifierInvalidation({ arguments: arguments_, observations, date: DATE });
}

describe("planifierInvalidation — refus", () => {
  it("exige exactement nom, fragment et raison", () => {
    expect(planifier(["e", "Le maillage complet"])).toMatchObject({
      ok: false,
      motif: MotifRefusInvalidation.Arguments,
    });
    expect(planifier(["e", "Le maillage", "complet", RAISON])).toMatchObject({
      ok: false,
      motif: MotifRefusInvalidation.Arguments,
    });
  });

  it("refuse un fragment ou une raison trop courts", () => {
    expect(planifier(["e", "maillage", RAISON])).toMatchObject({
      ok: false,
      motif: MotifRefusInvalidation.FragmentCourt,
    });
    expect(planifier(["e", "Le maillage complet", "faux"])).toMatchObject({
      ok: false,
      motif: MotifRefusInvalidation.RaisonCourte,
    });
  });

  it("distingue entité introuvable, aucune correspondance et déjà invalidée", () => {
    expect(planifier(["e", "Le maillage complet", RAISON], null)).toMatchObject({
      ok: false,
      motif: MotifRefusInvalidation.EntiteIntrouvable,
    });
    expect(planifier(["e", "rien de tel ici", RAISON])).toMatchObject({
      ok: false,
      motif: MotifRefusInvalidation.AucuneCorrespondance,
    });
    expect(planifier(["e", "la migration d'hôte élit", RAISON])).toMatchObject({
      ok: false,
      motif: MotifRefusInvalidation.DejaInvalidee,
    });
  });

  it("refuse un fragment qui touche plusieurs faits vivants", () => {
    expect(
      planifier(
        ["e", "Le maillage complet", RAISON],
        [...OBSERVATIONS, "Le maillage complet, bis."],
      ),
    ).toMatchObject({ ok: false, motif: MotifRefusInvalidation.Ambigu });
  });
});

describe("planifierInvalidation — ce qui passe", () => {
  it("préfixe le marqueur daté et la raison, garde le texte d'origine intact", () => {
    const verdict = planifierInvalidation({
      arguments: ["e", "Le maillage complet", RAISON],
      observations: OBSERVATIONS,
      date: DATE,
    });
    expect(verdict).toEqual({
      ok: true,
      nom: "e",
      avant: OBSERVATIONS[0],
      apres: `INVALID 2026-10-02: ${RAISON} — ${OBSERVATIONS[0]}`,
    });
  });

  it("ignore une observation déjà invalidée qui contient aussi le fragment", () => {
    const observations = [
      "La migration d'hôte élit la plus petite place connectée.",
      "INVALID 2026-09-30: doublon — La migration d'hôte élit la plus petite place connectée, v1.",
    ];
    const verdict = planifierInvalidation({
      arguments: ["e", "La migration d'hôte élit", RAISON],
      observations,
      date: DATE,
    });
    expect(verdict.ok && verdict.avant).toBe(observations[0]);
  });

  it("rogne les espaces de la raison", () => {
    expect(texteInvalide("fait", "  raison  ", DATE)).toBe("INVALID 2026-10-02: raison — fait");
  });
});
