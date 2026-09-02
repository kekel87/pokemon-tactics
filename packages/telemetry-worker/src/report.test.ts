import { describe, expect, it } from "vitest";
import { MAPS_REGISTRY } from "../../app/src/maps/maps-registry";
import {
  buildReport,
  countryLabel,
  Granularity,
  granularityFor,
  languageLabel,
  MAP_NAMES,
} from "./report";
import { createEventRow as rowOf } from "./testing/mock-telemetry";

describe("parité des noms de cartes", () => {
  it("🔴 couvre exactement les cartes du registre du jeu", () => {
    expect(Object.keys(MAP_NAMES).sort()).toEqual(MAPS_REGISTRY.map((entry) => entry.id).sort());
  });

  it("porte le même nom FR que le registre pour chaque carte", () => {
    for (const entry of MAPS_REGISTRY) {
      expect(MAP_NAMES[entry.id]).toBe(entry.displayName.fr);
    }
  });
});

describe("buildReport", () => {
  it("compte les visites au drapeau first et non au nombre de lignes", () => {
    const report = buildReport(
      [
        rowOf({ id: 1, payload: { first: true, screens: { "main-menu": 1 } } }),
        rowOf({ id: 2, payload: { screens: { credits: 1 } } }),
        rowOf({ id: 3, payload: { screens: { credits: 1 } } }),
      ],
      30,
    );

    expect(report.rows).toBe(3);
    expect(report.visits).toBe(1);
  });

  it("additionne les deltas de compteurs venus de plusieurs lignes", () => {
    const report = buildReport(
      [
        rowOf({ id: 1, payload: { first: true, screens: { "main-menu": 2 } } }),
        rowOf({ id: 2, payload: { screens: { "main-menu": 3 } } }),
      ],
      30,
    );

    expect(report.screens.get("main-menu")).toBe(5);
  });

  it("ne compte un visiteur qu'une fois, quel que soit le nombre de ses lignes", () => {
    const report = buildReport(
      [
        rowOf({ id: 1, visitor: "abc", payload: { first: true } }),
        rowOf({ id: 2, visitor: "abc", payload: {} }),
        rowOf({ id: 3, visitor: "def", payload: { first: true } }),
      ],
      30,
    );

    expect(report.uniqueVisitors).toBe(2);
  });

  it("regroupe les navigateurs sans leur version", () => {
    const report = buildReport(
      [
        rowOf({ id: 1, browser: "Firefox 154", payload: { first: true } }),
        rowOf({ id: 2, browser: "Firefox 153", payload: {} }),
      ],
      30,
    );

    expect(report.browsers.get("Firefox")).toBe(2);
    expect(report.browsers.has("Firefox 154")).toBe(false);
  });

  it("tire le taux d'abandon de l'écart entre parties lancées et terminées", () => {
    const report = buildReport(
      [
        rowOf({ id: 1, kind: "battle_started", payload: { map: "the-wall", teams: [] } }),
        rowOf({ id: 2, kind: "battle_started", payload: { map: "forest", teams: [] } }),
        rowOf({
          id: 3,
          kind: "battle_ended",
          payload: { turns: 10, durationMs: 60_000, outcomes: [] },
        }),
      ],
      30,
    );

    expect(report.battlesStarted).toBe(2);
    expect(report.battlesEnded).toBe(1);
    expect(report.abandonRate).toBeCloseTo(0.5);
  });

  it("ne relève la composition que des équipes bâties à la main", () => {
    const report = buildReport(
      [
        rowOf({
          id: 1,
          kind: "battle_started",
          payload: {
            map: "forest",
            teams: [
              {
                side: 0,
                source: "human-built",
                members: [
                  {
                    species: "venusaur",
                    ability: "chlorophyll",
                    item: "life-orb",
                    moves: ["growth"],
                  },
                ],
              },
              { side: 1, source: "ai-random" },
            ],
          },
        }),
      ],
      30,
    );

    expect(report.speciesUsage.get("venusaur")).toBe(1);
    expect(report.teamSources.get("ai-random")).toBe(1);
    expect(report.speciesUsage.size).toBe(1);
  });

  it("rend un axe continu, périodes creuses comprises", () => {
    const report = buildReport([rowOf({ id: 1, payload: { first: true } })], 7);

    expect(report.series).toHaveLength(7);
    expect(report.series.at(-1)?.visits).toBe(1);
    expect(report.series[0]?.visits).toBe(0);
  });

  it("laisse les moyennes vides quand aucune partie ne s'est terminée", () => {
    const report = buildReport(
      [rowOf({ id: 1, kind: "battle_started", payload: { map: "forest", teams: [] } })],
      30,
    );

    expect(report.averageTurns).toBe(null);
    expect(report.averageDurationMs).toBe(null);
    expect(report.abandonRate).toBe(1);
  });
});

describe("libellés d'audience", () => {
  it.each([
    ["FR", "🇫🇷 France"],
    ["US", "🇺🇸 États-Unis"],
    ["DE", "🇩🇪 Allemagne"],
  ])("nomme le pays %s en français avec son drapeau", (code, expected) => {
    expect(countryLabel(code)).toBe(expected);
  });

  it.each([
    ["T1", "Réseau Tor"],
    ["XX", "Origine inconnue"],
  ])("traduit le code non géographique %s", (code, expected) => {
    expect(countryLabel(code)).toBe(expected);
  });

  it("retombe sur le code brut plutôt que d'échouer sur un code inconnu", () => {
    expect(countryLabel("ZZZ")).toBe("ZZZ");
  });

  it.each([
    ["fr", "français"],
    ["en", "anglais"],
    ["ja", "japonais"],
  ])("nomme la langue %s en français", (tag, expected) => {
    expect(languageLabel(tag)).toBe(expected);
  });

  it("ne colle PAS de drapeau à une langue, qui n'est pas un pays", () => {
    expect(languageLabel("fr")).not.toMatch(/\p{Regional_Indicator}/u);
  });
});

describe("versions du jeu", () => {
  it("🔴 se comptent par VISITE et non par ligne", () => {
    const report = buildReport(
      [
        rowOf({ id: 1, build: "v1", payload: { first: true } }),
        rowOf({ id: 2, build: "v1", payload: { screens: { credits: 1 } } }),
        rowOf({
          id: 3,
          build: "v1",
          kind: "battle_started",
          payload: { map: "forest", teams: [] },
        }),
      ],
      30,
    );

    expect(report.builds.get("v1")).toBe(1);
  });
});

describe("fuseau d'affichage", () => {
  function utcDayOf(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
  }

  function bucketOf(timestamp: number): string | undefined {
    const report = buildReport(
      [rowOf({ id: 1, receivedAt: timestamp, payload: { first: true } })],
      30,
    );
    return report.series.find((point) => point.visits > 0)?.key;
  }

  it("🔴 range 22h30 UTC au jour SUIVANT — l'heure de Paris est en avance", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const stamp = Date.parse(`${yesterday}T22:30:00Z`);
    const nextDay = utcDayOf(stamp + 86_400_000);

    expect(bucketOf(stamp)).toBe(nextDay);
  });

  it("range 10h UTC au même jour", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const stamp = Date.parse(`${yesterday}T10:00:00Z`);

    expect(bucketOf(stamp)).toBe(utcDayOf(stamp));
  });
});

describe("pas de la série", () => {
  it.each([
    [7, Granularity.Day],
    [30, Granularity.Day],
    [31, Granularity.Day],
    [32, Granularity.Week],
    [90, Granularity.Week],
    [120, Granularity.Week],
    [121, Granularity.Month],
    [365, Granularity.Month],
  ])("passe une fenêtre de %s jours au pas %s", (days, expected) => {
    expect(granularityFor(days)).toBe(expected);
  });

  it("🔴 regroupe par semaine au lieu de perdre les données au-delà de 90 colonnes", () => {
    const report = buildReport([], 90);

    expect(report.granularity).toBe(Granularity.Week);
    expect(report.series.length).toBeLessThanOrEqual(14);
    expect(report.series.length).toBeGreaterThan(10);
  });

  it("regroupe par mois sur une année, sans tronquer la fenêtre", () => {
    const report = buildReport([], 365);

    expect(report.granularity).toBe(Granularity.Month);
    expect(report.series.length).toBeLessThanOrEqual(13);
    expect(report.series.length).toBeGreaterThan(11);
  });

  it("ramène une semaine à son lundi", () => {
    const wednesday = Date.parse("2026-09-02T12:00:00Z");
    const report = buildReport(
      [rowOf({ id: 1, receivedAt: wednesday, payload: { first: true } })],
      90,
    );

    expect(report.series.find((point) => point.visits > 0)?.key).toBe("2026-08-31");
  });
});
