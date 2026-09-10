import { describe, expect, it } from "vitest";
import { modeOf } from "../../app/src/analytics/battle-mode";
import { MAPS_REGISTRY } from "../../app/src/maps/maps-registry";
import {
  buildReport,
  countryLabel,
  END_REASON_UNKNOWN,
  Granularity,
  granularityFor,
  languageLabel,
  MAP_NAMES,
  MODE_LABELS,
  ONLINE_MODE,
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

describe("parité du mode en ligne", () => {
  it("🔴 rend la même chaîne que modeOf() côté application", () => {
    // Le premier littéral recopié de ce fichier qui gouverne un CALCUL et non un libellé : le
    // renommer d'un seul côté ferait cesser la déduplication des parties en ligne EN SILENCE, et
    // aucun test ne rougirait — report.test.ts écrit `mode: "online"` de sa propre main. Même
    // garde-fou que la parité des noms de cartes ci-dessus.
    expect(modeOf(2, 1)).toBe(ONLINE_MODE);
  });

  it("porte un libellé français, comme tous les modes affichés", () => {
    // Manquait depuis l'arrivée du mode en ligne (plan 201) : `online` sortait brut sur /tableau.
    expect(MODE_LABELS[ONLINE_MODE]).toBeDefined();
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
        rowOf({ id: 2, browser: "Firefox 153", payload: { first: true } }),
      ],
      30,
    );

    expect(report.browsers.get("Firefox")).toBe(2);
    expect(report.browsers.has("Firefox 154")).toBe(false);
  });

  it("🔴 compte l'audience par VISITE et non par ligne, une visite en produisant deux", () => {
    const report = buildReport(
      [
        rowOf({
          id: 1,
          country: "FR",
          browser: "Firefox 154",
          os: "Linux",
          lang: "fr",
          payload: { first: true, screen: ">=1920", referrer: "https://kekel87.itch.io/" },
        }),
        rowOf({
          id: 2,
          country: "FR",
          browser: "Firefox 154",
          os: "Linux",
          lang: "fr",
          payload: { screen: ">=1920", referrer: "https://kekel87.itch.io/" },
        }),
      ],
      30,
    );

    expect(report.visits).toBe(1);
    expect(report.countries.get("FR")).toBe(1);
    expect(report.browsers.get("Firefox")).toBe(1);
    expect(report.systems.get("Linux")).toBe(1);
    expect(report.languages.get("fr")).toBe(1);
    expect(report.screenSizes.get(">=1920")).toBe(1);
    expect(report.referrers.get("https://kekel87.itch.io/")).toBe(1);
  });

  it("compte la source d'entrée de la deuxième ligne, la ligne de boot ne pouvant pas la porter", () => {
    const report = buildReport(
      [
        rowOf({ id: 1, payload: { first: true, inputSource: null } }),
        rowOf({ id: 2, payload: { inputSource: "gamepad" } }),
      ],
      30,
    );

    expect(report.inputSources.get("gamepad")).toBe(1);
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

/**
 * Plan 204. En ligne, les deux pairs déclarent la MÊME partie : chacun envoie son `battle_started`
 * et son `battle_ended`, avec l'identifiant que l'hôte a tiré et fait voyager dans le `start`.
 *
 * Le fil de ces tests : ce qui se compte par PARTIE une seule fois, ce qui se compte par CAMP sur
 * les deux lignes — chaque pair ne déclarant que le sien.
 */
describe("parties en ligne, comptées une fois", () => {
  const ONLINE_ID = "b47f2c19";

  const onlineStart = (id: number, side: number, species: string) =>
    rowOf({
      id,
      kind: "battle_started",
      payload: {
        battleId: ONLINE_ID,
        mode: "online",
        map: "the-wall",
        format: "2v6",
        teams: [
          {
            side,
            source: "human-built",
            members: [{ species, ability: "overgrow", item: null, nature: "adamant", moves: [] }],
          },
        ],
      },
    });

  const onlineEnd = (id: number, species: string, extra: Record<string, unknown> = {}) =>
    rowOf({
      id,
      kind: "battle_ended",
      payload: {
        battleId: ONLINE_ID,
        winnerSide: 0,
        draw: false,
        turns: 20,
        durationMs: 600_000,
        outcomes: [{ species, moves: { tackle: 3 }, knockedOutTurn: null, knockedOutCause: null }],
        ...extra,
      },
    });

  it("compte UNE partie là où deux pairs en déclarent chacun une", () => {
    const report = buildReport([onlineStart(1, 0, "venusaur"), onlineStart(2, 1, "charizard")], 30);

    expect(report.battlesStarted).toBe(1);
    expect(report.battlesByMap.get("the-wall")).toBe(1);
    expect(report.battlesByFormat.get("2v6")).toBe(1);
    expect(report.battlesByMode.get("online")).toBe(1);
    expect(report.series.reduce((total, point) => total + point.started, 0)).toBe(1);
  });

  it("🔴 garde les DEUX camps : chaque pair ne déclare que le sien", () => {
    const report = buildReport([onlineStart(1, 0, "venusaur"), onlineStart(2, 1, "charizard")], 30);

    // Dédupliquer les compositions perdrait la moitié des statistiques d'usage — c'est-à-dire la
    // raison d'être de toute la télémétrie.
    expect(report.speciesUsage.get("venusaur")).toBe(1);
    expect(report.speciesUsage.get("charizard")).toBe(1);
    expect(report.teamSources.get("human-built")).toBe(2);
  });

  it("🔴 compte UNE partie finie, pas zéro", () => {
    const report = buildReport(
      [
        onlineStart(1, 0, "venusaur"),
        onlineStart(2, 1, "charizard"),
        onlineEnd(3, "venusaur"),
        onlineEnd(4, "charizard"),
      ],
      30,
    );

    // 🔴 Le cas qui a attrapé le défaut de D5. Avec un ensemble d'identifiants UNIQUE, alimenté par
    // les `battle_started`, le premier `battle_ended` y était déjà inscrit : il sautait lui aussi,
    // `battlesEnded` tombait à 0 et le taux d'abandon à 100 % — sans une ligne d'erreur.
    expect(report.battlesEnded).toBe(1);
    expect(report.abandonRate).toBe(0);
    expect(report.averageTurns).toBe(20);
    expect(report.averageDurationMs).toBe(600_000);
  });

  it("garde les issues des deux camps, comme les compositions", () => {
    const report = buildReport(
      [
        onlineStart(1, 0, "venusaur"),
        onlineStart(2, 1, "charizard"),
        onlineEnd(3, "venusaur"),
        onlineEnd(4, "charizard"),
      ],
      30,
    );

    expect(report.movesCast.get("tackle")).toBe(6);
  });

  it("🔴 rend le même relevé quel que soit l'ordre d'arrivée des quatre lignes", () => {
    // Les envois sont du fire-and-forget : le `battle_ended` d'un pair peut précéder le
    // `battle_started` de l'autre. C'est ce que les deux passes garantissent.
    const ordered = buildReport(
      [
        onlineStart(1, 0, "venusaur"),
        onlineStart(2, 1, "charizard"),
        onlineEnd(3, "venusaur"),
        onlineEnd(4, "charizard"),
      ],
      30,
    );
    const shuffled = buildReport(
      [
        onlineStart(1, 0, "venusaur"),
        onlineEnd(2, "venusaur"),
        onlineStart(3, 1, "charizard"),
        onlineEnd(4, "charizard"),
      ],
      30,
    );

    expect(shuffled.battlesStarted).toBe(ordered.battlesStarted);
    expect(shuffled.battlesEnded).toBe(ordered.battlesEnded);
    expect(shuffled.movesCast.get("tackle")).toBe(ordered.movesCast.get("tackle"));
    expect(shuffled.speciesUsage.get("charizard")).toBe(ordered.speciesUsage.get("charizard"));
  });

  it("🔴 ne déduplique JAMAIS deux parties locales de même identifiant", () => {
    // `createBattleId()` rend 32 bits : deux parties sans rapport peuvent collisionner. Effacer une
    // vraie partie du relevé serait pire que le double comptage qu'on corrige.
    const localStart = (id: number) =>
      rowOf({
        id,
        kind: "battle_started",
        payload: {
          battleId: "collision",
          mode: "local-vs-ai",
          map: "forest",
          format: "1v6",
          teams: [],
        },
      });

    const report = buildReport([localStart(1), localStart(2)], 30);

    expect(report.battlesStarted).toBe(2);
    expect(report.battlesByMode.get("local-vs-ai")).toBe(2);
  });

  it("🔴 n'efface pas une partie locale qui collisionnerait avec un identifiant en ligne", () => {
    // Le mode se lit sur la LIGNE, pas sur l'appartenance de l'identifiant au monde en ligne. Une
    // première version regardait l'ensemble des identifiants en ligne ici : la partie LOCALE
    // disparaissait du relevé, ce qui est le mode d'échec que D3 dit vouloir éviter. Le test « deux
    // parties locales de même identifiant » ne l'attrapait pas — il ne mélange pas les modes.
    const localTwin = rowOf({
      id: 3,
      kind: "battle_started",
      payload: {
        battleId: ONLINE_ID,
        mode: "local-vs-ai",
        map: "forest",
        format: "1v6",
        teams: [],
      },
    });

    const report = buildReport(
      [onlineStart(1, 0, "venusaur"), onlineStart(2, 1, "charizard"), localTwin],
      30,
    );

    expect(report.battlesStarted).toBe(2);
    expect(report.battlesByMode.get("online")).toBe(1);
    expect(report.battlesByMode.get("local-vs-ai")).toBe(1);
  });

  it("compte la fin de partie une seule fois par partie en ligne", () => {
    const report = buildReport(
      [
        onlineStart(1, 0, "venusaur"),
        onlineStart(2, 1, "charizard"),
        onlineEnd(3, "venusaur", { endReason: "forfeit" }),
        onlineEnd(4, "charizard", { endReason: "forfeit" }),
      ],
      30,
    );

    expect(report.battlesByEndReason.get("forfeit")).toBe(1);
  });
});

describe("fins de partie", () => {
  const endedRow = (id: number, payload: Record<string, unknown>) =>
    rowOf({
      id,
      kind: "battle_ended",
      payload: {
        battleId: `b${id}`,
        winnerSide: 0,
        draw: false,
        turns: 10,
        durationMs: 300_000,
        outcomes: [],
        ...payload,
      },
    });

  it("distingue le combat du forfait", () => {
    const report = buildReport(
      [
        endedRow(1, { endReason: "combat" }),
        endedRow(2, { endReason: "forfeit" }),
        endedRow(3, { endReason: "combat" }),
      ],
      30,
    );

    expect(report.battlesByEndReason.get("combat")).toBe(2);
    expect(report.battlesByEndReason.get("forfeit")).toBe(1);
  });

  it("🔴 range les lignes d'avant la mesure plutôt que de les perdre", () => {
    // Sans clé dédiée, le total de la table ne retomberait pas sur `battlesEnded` et on croirait à
    // une perte. `endReason` n'existe que depuis le plan 201.
    const report = buildReport([endedRow(1, {}), endedRow(2, { endReason: "combat" })], 30);

    expect(report.battlesByEndReason.get(END_REASON_UNKNOWN)).toBe(1);
    const total = [...report.battlesByEndReason.values()].reduce((sum, count) => sum + count, 0);
    expect(total).toBe(report.battlesEnded);
  });

  it("ne change pas le taux d'abandon, qui reste l'absence de fin", () => {
    // Un forfait ANNONCE sa fin : il compte parmi les parties finies (D2, plan 204).
    const report = buildReport(
      [
        rowOf({
          id: 1,
          kind: "battle_started",
          payload: { battleId: "b1", mode: "local-vs-ai", map: "forest", format: "1v6", teams: [] },
        }),
        rowOf({
          id: 2,
          kind: "battle_started",
          payload: { battleId: "b2", mode: "local-vs-ai", map: "forest", format: "1v6", teams: [] },
        }),
        endedRow(3, { battleId: "b1", endReason: "forfeit" }),
      ],
      30,
    );

    expect(report.abandonRate).toBe(0.5);
    expect(report.battlesByEndReason.get("forfeit")).toBe(1);
  });
});
