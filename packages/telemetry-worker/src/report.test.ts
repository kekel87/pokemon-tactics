import { describe, expect, it } from "vitest";
import { modeOf } from "../../app/src/analytics/battle-mode";
import { AbandonSource, TelemetryAction } from "../../app/src/analytics/telemetry-contract";
import { MAPS_REGISTRY } from "../../app/src/maps/maps-registry";
import {
  ABANDON_POSTURE_LABELS,
  ABANDON_SOURCE_LABELS,
  AbandonPosture,
  ACTION_LABELS,
  buildReport,
  countryLabel,
  END_REASON_UNKNOWN,
  Granularity,
  granularityFor,
  languageLabel,
  MAP_NAMES,
  MODE_LABELS,
  ONLINE_MODE,
  type Report,
  renderHtml,
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

  it("rend les visiteurs par jour en moyenne, jamais le total des journées-visiteur", () => {
    const report = buildReport(
      [
        rowOf({ id: 1, visitor: "abc", payload: { first: true } }),
        rowOf({ id: 2, visitor: "def", payload: { first: true } }),
        rowOf({ id: 3, visitor: "ghi", payload: { first: true } }),
      ],
      30,
    );

    expect(report.uniqueVisitors).toBe(3);
    expect(report.visitorsPerDay).toBeCloseTo(0.1);
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

  it("🔴 écarte une partie commencée avant la fenêtre, même avec ses deux fins dedans", () => {
    // Les départs sont tombés avant la borne : sans eux, les deux fins comptaient double et le
    // taux d'abandon passait sous zéro (plan 227).
    const report = buildReport([onlineEnd(2, "venusaur"), onlineEnd(3, "charizard")], 30);

    expect(report.battlesEnded).toBe(0);
    expect(report.abandonRate).toBeNull();
    expect(report.speciesAppearances.size).toBe(0);
  });

  it("ne compte la tablée QU'UNE fois, malgré les deux pairs", () => {
    const twoPeerRow = (id: number, side: number) =>
      rowOf({
        id,
        kind: "battle_started",
        payload: {
          battleId: ONLINE_ID,
          mode: "online",
          map: "the-wall",
          format: "2v6",
          humans: 2,
          ai: 0,
          teams: [{ side, source: "human-built", members: [] }],
        },
      });

    const report = buildReport([twoPeerRow(1, 0), twoPeerRow(2, 1)], 30);

    // Le piège que ce test garde : compter les participants hors du garde de déduplication
    // doublerait exactement les parties à plusieurs — celles qu'on cherche à voir.
    expect(report.battlesByParticipants.get("2 joueurs, sans IA")).toBe(1);
  });

  it("dit « avant la mesure » plutôt qu'un chiffre faux quand les champs manquent", () => {
    // `validate.ts` ne contrôle ni `humans` ni `ai` : une ligne d'une version d'avant passe, et le
    // type qui les déclare obligatoires ne vaut rien sur des données déjà stockées.
    const report = buildReport([onlineStart(1, 0, "venusaur")], 30);

    expect(report.battlesByParticipants.get("avant la mesure")).toBe(1);
    expect([...report.battlesByParticipants.keys()].join()).not.toContain("undefined");
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
  // Une fin ne compte que si son départ est dans la fenêtre (plan 227) : chaque fin a le sien.
  const startedRow = (id: number) =>
    rowOf({
      id: 100 + id,
      kind: "battle_started",
      payload: { battleId: `b${id}`, map: "forest", mode: "local", teams: [] },
    });
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
        startedRow(1),
        startedRow(2),
        startedRow(3),
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
    const report = buildReport(
      [startedRow(1), startedRow(2), endedRow(1, {}), endedRow(2, { endReason: "combat" })],
      30,
    );

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

/**
 * Le goût et la force, deux cohortes qui ne s'additionnent jamais (plan 212, Lot E).
 *
 * 🔴 **Ce bloc encode une limite posée par l'humain le 2026-09-16** — « je ne veux pas que les
 * équipes aléatoires apparaissent dans les usages des Pokemon et de leurs attaques ». Elle vaut un
 * test qui rougit si on la franchit : l'élargissement de la collecte n'est acceptable QUE parce que
 * le tri à la lecture tient.
 */
describe("tri des cohortes goût / force", () => {
  const started = rowOf({
    id: 2,
    kind: "battle_started",
    payload: { battleId: "aaaa1111", map: "forest", mode: "local", teams: [] },
  });
  const ended = (outcomes: unknown[]) =>
    rowOf({
      id: 1,
      kind: "battle_ended",
      payload: {
        battleId: "aaaa1111",
        winnerSide: 0,
        draw: false,
        endReason: "combat",
        durationMs: 60_000,
        turns: 10,
        outcomes,
      },
    });

  it("🔴 tient les équipes aléatoires HORS des attaques d'usage", () => {
    const report = buildReport(
      [
        started,
        ended([
          { species: "venusaur", source: "human-built", side: 0, moves: { "giga-drain": 2 } },
          { species: "gengar", source: "human-random", side: 1, moves: { "shadow-ball": 5 } },
        ]),
      ],
      7,
    );

    // Le bloc du GOÛT ne voit que l'équipe bâtie à la main.
    expect([...report.movesCast.entries()]).toEqual([["giga-drain", 2]]);
    // Le bloc de la FORCE voit les deux.
    expect(report.movesCastAll.get("shadow-ball")).toBe(5);
    expect(report.movesCastAll.get("giga-drain")).toBe(2);
  });

  it("range les issues d'avant le plan 212 en équipes bâties à la main", () => {
    // Le repli est EXACT et non approximatif : avant ce plan, seules les équipes bâties à la main
    // étaient suivies, donc une issue sans `source` en est forcément une.
    const report = buildReport(
      [started, ended([{ species: "venusaur", moves: { "giga-drain": 1 } }])],
      7,
    );

    expect(report.movesCast.get("giga-drain")).toBe(1);
  });

  it("compte les apparitions et les présences dans le camp vainqueur", () => {
    const report = buildReport(
      [
        started,
        ended([
          { species: "venusaur", source: "human-random", side: 0, moves: {}, knockedOutTurn: null },
          { species: "gengar", source: "human-random", side: 1, moves: {}, knockedOutTurn: 4 },
        ]),
      ],
      7,
    );

    expect(report.speciesAppearances.get("venusaur")).toBe(1);
    expect(report.speciesWins.get("venusaur")).toBe(1);
    expect(report.speciesWins.get("gengar")).toBeUndefined();
    // Tombé sans avoir lancé une seule attaque : un problème d'initiative, pas de puissance.
    expect(report.diedWithoutActing.get("gengar")).toBe(1);
  });
});

/** L'abandon, enfin mesuré là où il arrive (plan 212, Lot F). */
describe("abandons", () => {
  const abandoned = (payload: Record<string, unknown>) =>
    rowOf({
      id: 1,
      kind: "battle_abandoned",
      payload: { battleId: "bbbb2222", turns: 12, durationMs: 300_000, from: "menu", ...payload },
    });

  it("🔴 n'entre pas dans les parties terminées", () => {
    const report = buildReport(
      [
        rowOf({
          id: 1,
          kind: "battle_started",
          payload: {
            battleId: "bbbb2222",
            mode: "solo",
            map: "simple-arena",
            format: "2v6",
            teams: [],
          },
        }),
        abandoned({ side: 0, healthRatios: { "0": 0.1, "1": 0.9 } }),
      ],
      7,
    );

    // L'ABSENCE de `battle_ended` reste le signal du taux d'abandon : la nouvelle ligne le décrit,
    // elle ne le requalifie pas en fin. Un `battlesEnded` à 1 ici casserait tout l'invariant.
    expect(report.battlesEnded).toBe(0);
    expect(report.abandonRate).toBe(1);
    expect(report.battlesAbandoned).toBe(1);
  });

  it("dit dans quel état on lâche", () => {
    const losing = buildReport([abandoned({ side: 0, healthRatios: { "0": 0.1, "1": 0.9 } })], 7);
    const winning = buildReport([abandoned({ side: 0, healthRatios: { "0": 0.9, "1": 0.1 } })], 7);
    const even = buildReport([abandoned({ side: 0, healthRatios: { "0": 0.5, "1": 0.55 } })], 7);

    expect(losing.abandonByPosture.get("losing")).toBe(1);
    expect(winning.abandonByPosture.get("winning")).toBe(1);
    expect(even.abandonByPosture.get("even")).toBe(1);
  });

  it("ne conclut rien quand le camp du partant est inconnu", () => {
    // Hot-seat : tous les camps sont locaux, « qui abandonne » n'a pas de réponse. En inventer une
    // serait pire que de n'en compter aucune — c'est ce chiffre qui doit désigner un correctif.
    const report = buildReport(
      [abandoned({ side: null, healthRatios: { "0": 0.1, "1": 0.9 } })],
      7,
    );

    expect(report.abandonByPosture.size).toBe(0);
    expect(report.battlesAbandoned).toBe(1);
  });

  it("ne compte qu'une fois une partie en ligne quittée par les deux pairs", () => {
    // Les deux pairs émettent chacun leur ligne sous le MÊME `battleId` : c'est lui qui dédoublonne,
    // exactement comme pour les fins (plan 204).
    const report = buildReport([abandoned({}), abandoned({})], 7);

    expect(report.battlesAbandoned).toBe(1);
  });

  it("prend la médiane du tour et de la durée, pas la moyenne (plan 224)", () => {
    // Deux départs au tour 1 et un au tour 54 : la moyenne dirait « tour 18 », personne n'y est parti.
    const report = buildReport(
      [
        abandoned({ turns: 1, durationMs: 30_000 }),
        abandoned({ battleId: "cccc3333", turns: 1, durationMs: 20_000 }),
        abandoned({ battleId: "dddd4444", turns: 54, durationMs: 1_000_000 }),
      ],
      7,
    );

    expect(report.medianAbandonTurns).toBe(1);
    expect(report.medianAbandonDurationMs).toBe(30_000);
  });

  it("prend la moyenne des deux valeurs centrales sur un effectif pair", () => {
    const report = buildReport(
      [abandoned({}), abandoned({ battleId: "cccc3333", turns: 20, durationMs: 600_000 })],
      7,
    );

    expect(report.medianAbandonTurns).toBe(16);
    expect(report.medianAbandonDurationMs).toBe(450_000);
  });

  it("range les départs par tranche de tours", () => {
    const report = buildReport(
      [
        abandoned({ turns: 0 }),
        abandoned({ battleId: "b2", turns: 2 }),
        abandoned({ battleId: "b3", turns: 3 }),
        abandoned({ battleId: "b4", turns: 10 }),
        abandoned({ battleId: "b5", turns: 11 }),
      ],
      7,
    );

    expect(report.abandonByTurnRange.get("quick")).toBe(2);
    expect(report.abandonByTurnRange.get("engaged")).toBe(2);
    expect(report.abandonByTurnRange.get("late")).toBe(1);
  });

  it("🔴 distingue « avant tout dégât » du coude à coude", () => {
    // Le défaut lu le 2026-10-04 : 37 départs sur 51 à PV pleins partout, comptés « au coude à coude ».
    const untouched = buildReport([abandoned({ side: 0, healthRatios: { "0": 1, "1": 1 } })], 7);
    const scratched = buildReport([abandoned({ side: 0, healthRatios: { "0": 1, "1": 0.97 } })], 7);

    expect(untouched.abandonByPosture.get("untouched")).toBe(1);
    expect(untouched.abandonByPosture.get("even")).toBeUndefined();
    expect(scratched.abandonByPosture.get("even")).toBe(1);
  });
});

/** Les départs rapides rapportés à l'appareil du joueur (plan 224). */
describe("abandons rapides par appareil", () => {
  const started = (id: number, payload: Record<string, unknown>) =>
    rowOf({
      id,
      kind: "battle_started",
      payload: {
        battleId: `start${id}`,
        mode: "local-vs-ai",
        map: "simple-arena",
        format: "2v6",
        teams: [],
        ...payload,
      },
    });
  const left = (id: number, payload: Record<string, unknown>) =>
    rowOf({
      id,
      kind: "battle_abandoned",
      payload: { battleId: `start${id}`, durationMs: 30_000, from: "tab-closed", ...payload },
    });

  it("rapporte les départs rapides aux parties lancées, par source et par écran", () => {
    const report = buildReport(
      [
        started(1, { inputSource: "touch", screen: "<768" }),
        started(2, { inputSource: "touch", screen: "<768" }),
        started(3, { inputSource: "pointer", screen: ">=1920" }),
        left(1, { turns: 1, inputSource: "touch", screen: "<768" }),
        // Parti tard : compte au dénominateur, pas au numérateur.
        left(2, { turns: 30, inputSource: "touch", screen: "<768" }),
      ],
      7,
    );

    expect(report.quickAbandonByInput.get("touch")).toEqual({ started: 2, quick: 1 });
    expect(report.quickAbandonByInput.get("pointer")).toEqual({ started: 1, quick: 0 });
    expect(report.quickAbandonByScreen.get("<768")).toEqual({ started: 2, quick: 1 });
  });

  it("🔴 compte le départ de chaque pair d'une partie en ligne, comme son démarrage", () => {
    // Les deux pairs partagent le `battleId` et partent chacun de leur appareil : un seul départ
    // compté pour deux démarrages afficherait 50 % là où tout le monde est parti.
    const online = { mode: "online", battleId: "duel", inputSource: "touch", screen: "<768" };
    const report = buildReport(
      [
        started(1, online),
        started(2, online),
        left(3, { battleId: "duel", turns: 1, inputSource: "touch", screen: "<768" }),
        left(4, { battleId: "duel", turns: 1, inputSource: "touch", screen: "<768" }),
      ],
      7,
    );

    expect(report.quickAbandonByInput.get("touch")).toEqual({ started: 2, quick: 2 });
    // La PARTIE, elle, ne compte qu'une fois parmi les départs.
    expect(report.battlesAbandoned).toBe(1);
  });

  it("🔴 ignore les lignes d'avant le plan, au numérateur comme au dénominateur", () => {
    // Les mêler ferait baisser tous les taux : les anciennes parties n'ont aucun appareil à qui
    // s'attribuer, mais grossiraient quand même un total.
    const report = buildReport([started(1, {}), left(1, { turns: 1 })], 7);

    expect(report.quickAbandonByInput.size).toBe(0);
    expect(report.quickAbandonByScreen.size).toBe(0);
    expect(report.abandonByTurnRange.get("quick")).toBe(1);
  });

  it("range sous « inconnue » une source d'entrée absente du relevé", () => {
    const report = buildReport([started(1, { inputSource: null, screen: "<768" })], 7);

    expect(report.quickAbandonByInput.get("unknown")).toEqual({ started: 1, quick: 0 });
  });
});

/**
 * Aucune clé brute dans le rapport (plan 212, Lot D).
 *
 * 🔴 Ce test existe parce que trois compteurs bien vivants — `checksum-mismatch`,
 * `checksum-compared` et `room-failed-format_reduit` — s'affichaient sous leur identifiant anglais,
 * et que personne ne s'en était aperçu pendant deux plans. Un libellé oublié ne casse rien : il
 * dégrade juste la lecture, en silence, jusqu'à ce qu'on relise le rapport de près.
 */
describe("parité des libellés d'action", () => {
  it("🔴 nomme chaque compteur déclaré côté application", () => {
    const declared = Object.values(TelemetryAction);
    const missing = declared.filter((action) => ACTION_LABELS[action] === undefined);

    expect(missing).toEqual([]);
  });

  it("🔴 nomme chaque provenance de départ", () => {
    // Ajouté en revue : la section « D'où on part » passait par ACTION_LABELS, qui ne contient
    // aucune de ces valeurs — elle s'affichait donc en anglais brut, le défaut exact que ce lot
    // existe pour tuer, reproduit dans le même commit. Le test le rend impossible à refaire.
    const declared = Object.values(AbandonSource);
    const missing = declared.filter((source) => ABANDON_SOURCE_LABELS[source] === undefined);

    expect(missing).toEqual([]);
  });

  it("🔴 nomme chaque posture d'abandon", () => {
    const missing = Object.values(AbandonPosture).filter(
      (posture) => ABANDON_POSTURE_LABELS[posture] === undefined,
    );

    expect(missing).toEqual([]);
  });
});

describe("barre de chiffres", () => {
  const reportOf = (overrides: Partial<Report>): Report => ({
    ...buildReport([], overrides.days ?? 30),
    ...overrides,
  });

  it("🔴 refuse d'afficher un taux d'abandon négatif", () => {
    // Possible dès qu'une partie en ligne a ses départs hors fenêtre et ses fins dedans.
    const html = renderHtml(reportOf({ abandonRate: -0.12 }), new Date("2026-09-17T12:00:00Z"));

    expect(html).toContain("<b>\u2014</b><span>Abandon</span>");
  });

  it("rend les visiteurs par jour, jamais le total des journées-visiteur", () => {
    const html = renderHtml(
      reportOf({ uniqueVisitors: 41, visitorsPerDay: 41 / 30 }),
      new Date("2026-09-17T12:00:00Z"),
    );

    expect(html).toContain("<b>1.4</b><span>Visiteurs / jour</span>");
    expect(html).not.toContain("<b>41</b><span>Visiteurs / jour</span>");
  });

  it("attache ses précisions à un bouton, jamais à la seule infobulle native", () => {
    const html = renderHtml(reportOf({}), new Date("2026-09-17T12:00:00Z"));

    // `title` ne s'atteint ni au doigt ni au clavier, et le relevé se lit au téléphone : il ne
    // reste qu'en repli sur le bouton, pour les navigateurs sans `:has()`.
    expect(html).not.toContain("title=");
    expect(html).toContain('class="q"');
    expect(html).toContain(":has(#bouton-precision-1:focus) #precision-1 { display: block; }");
  });

  it("🔴 pend ses bulles à la barre entière, jamais à une tuile", () => {
    // Ancrées sur la tuile, elles sortaient du cadre à droite et ouvraient une barre de
    // défilement horizontale (mesuré : 48 px de débordement à 578 px de large).
    const html = renderHtml(reportOf({}), new Date("2026-09-17T12:00:00Z"));
    const start = html.indexOf('<div class="rail">');
    const end = html.indexOf('<section class="charts">');

    // Sans ces deux gardes, un `indexOf` à -1 découperait une tranche silencieusement fausse et
    // le test passerait en ne vérifiant plus rien.
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const rail = html.slice(start, end);

    expect(rail).toContain('<p class="hint" id="precision-1"');
    expect(rail.indexOf('<p class="hint"')).toBeGreaterThan(
      rail.lastIndexOf("<span>Durée moyenne</span>"),
    );
  });

  it("ne met en garde sur les parties comptées double que si la fenêtre remonte avant le battleId partagé", () => {
    const avant = renderHtml(reportOf({ days: 30 }), new Date("2026-09-17T12:00:00Z"));
    const apres = renderHtml(reportOf({ days: 7 }), new Date("2026-10-20T12:00:00Z"));

    expect(avant).toContain("comptées double");
    expect(apres).not.toContain("comptées double");
  });
});

/**
 * Les affrontements (plan 227) : qui bat qui, l'adversaire pouvant être tenu par l'IA.
 *
 * 🔴 Limite posée par l'humain le 2026-10-05 : les espèces de l'IA ne servent QU'À nommer
 * l'adversaire. Elles n'entrent dans aucun usage ni dans le `n` de la cohorte de force.
 */
describe("affrontements", () => {
  const started = (battleId: string) =>
    rowOf({
      id: 1,
      kind: "battle_started",
      payload: { battleId, map: "forest", mode: "local", teams: [] },
    });
  const ended = (battleId: string, payload: Record<string, unknown>) =>
    rowOf({
      id: 2,
      kind: "battle_ended",
      payload: {
        battleId,
        winnerSide: 0,
        draw: false,
        endReason: "combat",
        durationMs: 60_000,
        turns: 10,
        outcomes: [{ species: "venusaur", source: "human-built", side: 0, moves: {} }],
        aiTeams: [{ side: 1, species: ["charizard", "onix"] }],
        ...payload,
      },
    });

  it("croise chaque espèce humaine avec chaque espèce adverse de l'IA", () => {
    const report = buildReport([started("m1"), ended("m1", {})], 7);

    expect(report.matchupAppearances.get("venusaur|charizard")).toBe(1);
    expect(report.matchupWins.get("venusaur|onix")).toBe(1);
  });

  it("🔴 ne compte jamais l'IA comme sujet, ni dans les usages, ni dans la force", () => {
    const report = buildReport([started("m2"), ended("m2", { winnerSide: 1 })], 7);

    expect([...report.matchupAppearances.keys()].some((key) => key.startsWith("charizard|"))).toBe(
      false,
    );
    expect(report.matchupWins.size).toBe(0);
    expect(report.speciesAppearances.has("charizard")).toBe(false);
  });

  it("écarte les forfaits et les matchs nuls", () => {
    const report = buildReport(
      [
        started("m3"),
        ended("m3", { endReason: "forfeit" }),
        started("m4"),
        ended("m4", { draw: true, winnerSide: null }),
      ],
      7,
    );

    expect(report.matchupAppearances.size).toBe(0);
  });

  it("recolle les deux camps d'une partie en ligne, déclarés chacun par son pair", () => {
    const peer = (side: number, species: string) =>
      ended("m5", {
        outcomes: [{ species, source: "human-built", side, moves: {} }],
        aiTeams: [],
      });
    const report = buildReport([started("m5"), peer(0, "venusaur"), peer(1, "gengar")], 7);

    expect(report.matchupWins.get("venusaur|gengar")).toBe(1);
    expect(report.matchupAppearances.get("gengar|venusaur")).toBe(1);
    expect(report.matchupWins.has("gengar|venusaur")).toBe(false);
  });
});
