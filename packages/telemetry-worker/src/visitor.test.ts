import { describe, expect, it } from "vitest";
import { MockAudienceHeaders } from "./testing/mock-telemetry";
import { dayStamp, visitorHash } from "./visitor";

const BASE = {
  secret: "secret-de-test-jamais-dans-le-depot",
  ip: MockAudienceHeaders.ip,
  userAgent: MockAudienceHeaders.firefoxOnLinux,
  day: "2026-09-02",
};

describe("dayStamp", () => {
  it("rend la date UTC du jour, qui sert de sel tournant", () => {
    expect(dayStamp(new Date("2026-09-02T14:31:00Z"))).toBe("2026-09-02");
  });

  it("bascule à minuit UTC et non à l'heure locale", () => {
    expect(dayStamp(new Date("2026-09-02T23:59:59Z"))).toBe("2026-09-02");
    expect(dayStamp(new Date("2026-09-03T00:00:00Z"))).toBe("2026-09-03");
  });
});

describe("visitorHash", () => {
  it("rend un haché hexadécimal de 32 caractères", async () => {
    expect(await visitorHash(BASE)).toMatch(/^[0-9a-f]{32}$/);
  });

  it("est stable pour le même visiteur le même jour, ce qui permet de compter des uniques", async () => {
    expect(await visitorHash(BASE)).toBe(await visitorHash(BASE));
  });

  it("CHANGE le lendemain : aucun suivi inter-jours n'est possible, même pour nous", async () => {
    expect(await visitorHash(BASE)).not.toBe(await visitorHash({ ...BASE, day: "2026-09-03" }));
  });

  it("distingue deux IP différentes", async () => {
    expect(await visitorHash(BASE)).not.toBe(await visitorHash({ ...BASE, ip: "198.51.100.7" }));
  });

  it("distingue deux agents différents depuis la même IP", async () => {
    expect(await visitorHash(BASE)).not.toBe(
      await visitorHash({ ...BASE, userAgent: MockAudienceHeaders.chromeOnWindows }),
    );
  });

  it("distingue deux secrets différents", async () => {
    expect(await visitorHash(BASE)).not.toBe(await visitorHash({ ...BASE, secret: "autre" }));
  });

  it("ne laisse fuir ni l'IP ni l'agent dans sa sortie", async () => {
    const hash = await visitorHash(BASE);
    expect(hash).not.toContain(MockAudienceHeaders.ip);
    expect(hash).not.toContain("Firefox");
  });

  it("rend null sans secret configuré, plutôt que de faire tomber la collecte", async () => {
    expect(await visitorHash({ ...BASE, secret: undefined })).toBe(null);
    expect(await visitorHash({ ...BASE, secret: "" })).toBe(null);
  });

  it("rend null sans IP", async () => {
    expect(await visitorHash({ ...BASE, ip: null })).toBe(null);
  });

  it("accepte un agent absent sans échouer", async () => {
    expect(await visitorHash({ ...BASE, userAgent: null })).toMatch(/^[0-9a-f]{32}$/);
  });
});
