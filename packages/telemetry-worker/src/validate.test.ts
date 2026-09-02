import { describe, expect, it } from "vitest";
import { MockAudienceHeaders, MockEnvelope, MockOrigin } from "./testing/mock-telemetry";
import {
  ALLOWED_ORIGINS,
  categorizeBrowser,
  categorizeOs,
  checkAccess,
  MAX_BODY_BYTES,
  primaryLanguage,
  ValidationFailure,
  validateEnvelope,
} from "./validate";

describe("checkAccess", () => {
  it("porte exactement les deux origines mesurées au spike de l'étape 1, jamais supposées", () => {
    expect(ALLOWED_ORIGINS).toEqual([MockOrigin.itch, MockOrigin.githubPages]);
  });

  it.each([MockOrigin.itch, MockOrigin.githubPages])("accepte un POST depuis %s", (origin) => {
    expect(checkAccess({ method: "POST", origin })).toEqual({ ok: true });
  });

  it.each([
    ["une origine étrangère", MockOrigin.foreign],
    ["le sous-domaine de la page itch, qui n'est PAS celui du jeu", "https://kekel87.itch.io"],
    ["une origine avec un chemin", `${MockOrigin.githubPages}/pokemon-tactics`],
    ["la même origine en http", "http://kekel87.github.io"],
    ["l'absence d'en-tête Origin", null],
  ])("rejette %s", (_label, origin) => {
    expect(checkAccess({ method: "POST", origin })).toEqual({
      ok: false,
      reason: ValidationFailure.OriginNotAllowed,
    });
  });

  it.each(["GET", "HEAD", "PUT", "DELETE", "post"])("rejette la méthode %s", (method) => {
    expect(checkAccess({ method, origin: MockOrigin.githubPages })).toEqual({
      ok: false,
      reason: ValidationFailure.MethodNotAllowed,
    });
  });

  it("vérifie la méthode avant l'origine, la méthode étant le refus le moins coûteux", () => {
    expect(checkAccess({ method: "GET", origin: MockOrigin.foreign })).toEqual({
      ok: false,
      reason: ValidationFailure.MethodNotAllowed,
    });
  });
});

describe("validateEnvelope", () => {
  it("accepte une enveloppe conforme et rend le payload non interprété", () => {
    expect(validateEnvelope(JSON.stringify(MockEnvelope.battleStarted))).toEqual({
      ok: true,
      envelope: {
        kind: "battle_started",
        build: "2026.9.1",
        platform: "ghp",
        payload: { map: "the-wall" },
      },
    });
  });

  it.each(["session", "battle_started", "battle_ended"])("accepte le type %s", (kind) => {
    const result = validateEnvelope(JSON.stringify({ ...MockEnvelope.battleStarted, kind }));
    expect(result.ok).toBe(true);
  });

  it.each([
    ["itch", "itch"],
    ["ghp", "ghp"],
  ])("accepte la plateforme %s", (_label, platform) => {
    const result = validateEnvelope(JSON.stringify({ ...MockEnvelope.battleStarted, platform }));
    expect(result.ok).toBe(true);
  });

  it.each([
    ["un type inconnu", { kind: "battle_paused" }],
    ["un type vide", { kind: "" }],
    ["un type qui n'est pas une chaîne", { kind: 42 }],
    ["un type absent", { kind: undefined }],
  ])("rejette %s", (_label, overrides) => {
    const result = validateEnvelope(
      JSON.stringify({ ...MockEnvelope.battleStarted, ...overrides }),
    );
    expect(result).toEqual({ ok: false, reason: ValidationFailure.KindUnknown });
  });

  it.each([
    ["une plateforme inconnue", { platform: "steam" }],
    ["une plateforme absente", { platform: undefined }],
  ])("rejette %s", (_label, overrides) => {
    const result = validateEnvelope(
      JSON.stringify({ ...MockEnvelope.battleStarted, ...overrides }),
    );
    expect(result).toEqual({ ok: false, reason: ValidationFailure.PlatformUnknown });
  });

  it.each([
    ["un build absent", { build: undefined }],
    ["un build vide", { build: "" }],
    ["un build absurdement long", { build: "x".repeat(65) }],
    ["un build avec un retour à la ligne", { build: "2026.9.1\ninjection" }],
    ["un build avec un emoji", { build: "2026.9.1🔥" }],
  ])("rejette %s", (_label, overrides) => {
    const result = validateEnvelope(
      JSON.stringify({ ...MockEnvelope.battleStarted, ...overrides }),
    );
    expect(result).toEqual({ ok: false, reason: ValidationFailure.BuildInvalid });
  });

  it("rejette un corps qui n'est pas du JSON", () => {
    expect(validateEnvelope("kind=session")).toEqual({
      ok: false,
      reason: ValidationFailure.BodyNotJson,
    });
  });

  it.each([
    ["un tableau", "[]"],
    ["une chaîne JSON", '"session"'],
    ["null", "null"],
  ])("rejette %s à la racine du corps", (_label, body) => {
    expect(validateEnvelope(body)).toEqual({
      ok: false,
      reason: ValidationFailure.BodyNotJson,
    });
  });

  it("remplace un payload absent ou mal typé par un objet vide, le Worker n'inspectant pas le métier", () => {
    for (const payload of [undefined, "texte", 3, [1, 2]]) {
      const result = validateEnvelope(JSON.stringify({ ...MockEnvelope.battleStarted, payload }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.envelope.payload).toEqual({});
      }
    }
  });

  it("rejette un corps au-delà du plafond", () => {
    const oversized = JSON.stringify({
      ...MockEnvelope.battleStarted,
      payload: { filler: "x".repeat(MAX_BODY_BYTES) },
    });
    expect(validateEnvelope(oversized)).toEqual({
      ok: false,
      reason: ValidationFailure.BodyTooLarge,
    });
  });

  it("compte le plafond en OCTETS et non en caractères, ce qu'un emoji de 4 octets révèle", () => {
    const oversized = JSON.stringify({
      ...MockEnvelope.battleStarted,
      payload: { filler: "🔥".repeat(Math.ceil(MAX_BODY_BYTES / 4)) },
    });
    expect(validateEnvelope(oversized)).toEqual({
      ok: false,
      reason: ValidationFailure.BodyTooLarge,
    });
  });

  it("vérifie la taille avant de dépenser un analyseur JSON", () => {
    expect(validateEnvelope(`{{{${"x".repeat(MAX_BODY_BYTES)}`)).toEqual({
      ok: false,
      reason: ValidationFailure.BodyTooLarge,
    });
  });
});

describe("catégorisation de l'agent utilisateur", () => {
  it.each([
    ["Firefox", MockAudienceHeaders.firefoxOnLinux, "Firefox 121"],
    ["Chrome", MockAudienceHeaders.chromeOnWindows, "Chrome 130"],
    ["Edge, qui se déclare AUSSI Chrome", MockAudienceHeaders.edgeOnWindows, "Edge 130"],
    ["Opera, qui se déclare AUSSI Chrome", MockAudienceHeaders.operaOnWindows, "Opera 114"],
    [
      "Safari, qui n'annonce sa version que par Version/",
      MockAudienceHeaders.safariOnMac,
      "Safari 17",
    ],
  ])("classe %s", (_label, userAgent, expected) => {
    expect(categorizeBrowser(userAgent)).toBe(expected);
  });

  it("rend null sur un agent absent ou non reconnu", () => {
    expect(categorizeBrowser(null)).toBe(null);
    expect(categorizeBrowser("curl/8.5.0")).toBe(null);
  });

  it.each([
    ["Android, qui se déclare AUSSI Linux", MockAudienceHeaders.chromeOnAndroid, "Android"],
    ["iOS", MockAudienceHeaders.safariOnIphone, "iOS"],
    ["Windows", MockAudienceHeaders.chromeOnWindows, "Windows"],
    ["macOS", MockAudienceHeaders.safariOnMac, "macOS"],
    ["Linux de bureau", MockAudienceHeaders.firefoxOnLinux, "Linux"],
  ])("classe le système de %s", (_label, userAgent, expected) => {
    expect(categorizeOs(userAgent)).toBe(expected);
  });

  it("ne conserve jamais la version du système, qui serait un critère de recoupement", () => {
    const android = categorizeOs(MockAudienceHeaders.chromeOnAndroid);
    expect(android).toBe("Android");
    expect(android).not.toContain("14");
  });
});

describe("langue principale", () => {
  it.each([
    ["une liste pondérée", "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7", "fr"],
    ["une langue seule", "en", "en"],
    ["une langue régionale seule", "pt-BR", "pt"],
    ["une casse mélangée", "FR-fr", "fr"],
    ["des espaces", " de-DE , de;q=0.9 ", "de"],
  ])("extrait %s", (_label, header, expected) => {
    expect(primaryLanguage(header)).toBe(expected);
  });

  it("ne conserve jamais la région", () => {
    expect(primaryLanguage("fr-CA")).toBe("fr");
  });

  it.each([
    ["un en-tête absent", null],
    ["le joker", "*"],
    ["un en-tête vide", ""],
    ["une valeur qui n'est pas une langue", "12345"],
  ])("rend null sur %s", (_label, header) => {
    expect(primaryLanguage(header)).toBe(null);
  });
});
