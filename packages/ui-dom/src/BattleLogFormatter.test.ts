import {
  BattleEventType,
  DefensiveKind,
  StatName,
  StatusType,
  TerrainType,
} from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import {
  BattleLogColors,
  type BattleLogContext,
  type BattleLogEntry,
  formatBattleEvent,
} from "./BattleLogFormatter";

function traceContext(): BattleLogContext {
  return {
    getPokemonName: (id) => (id === "pika" ? "Pikachu" : id === "bulba" ? "Bulbizarre" : id),
    getMoveName: (id) => (id === "thunderbolt" ? "Tonnerre" : id),
    getAbilityName: (id) => (id === "static" ? "Statik" : null),
    getItemName: (id) => (id === "leftovers" ? "Restes" : null),
    language: "fr",
    translate: (key, params) => {
      const args = Object.entries(params ?? {})
        .map(([name, value]) => `${name}=${String(value)}`)
        .sort()
        .join(",");
      return args === "" ? key : `${key}|${args}`;
    },
  };
}

function traceOf(event: Parameters<typeof formatBattleEvent>[0]): string {
  const result = formatBattleEvent(event, traceContext());
  const entry = (Array.isArray(result) ? result[0] : result) as BattleLogEntry;
  return entry.message;
}

describe("BattleLogFormatter — contrat de clés i18n", () => {
  it("route un événement simple vers sa clé, avec le nom en paramètre", () => {
    expect(traceOf({ type: BattleEventType.TurnStarted, pokemonId: "pika" })).toBe(
      "battleLog.turnStarted|name=Pikachu",
    );
  });

  it("passe le nom d'attaque résolu, pas son identifiant", () => {
    expect(
      traceOf({
        type: BattleEventType.MoveStarted,
        attackerId: "pika",
        moveId: "thunderbolt",
      }),
    ).toBe("battleLog.moveStarted.used|moveName=Tonnerre,name=Pikachu");
  });

  it("distingue les variantes d'un même événement par des clés différentes", () => {
    const raised = traceOf({
      type: BattleEventType.StatChanged,
      targetId: "pika",
      stat: StatName.Attack,
      stages: 1,
    });
    const lowered = traceOf({
      type: BattleEventType.StatChanged,
      targetId: "pika",
      stat: StatName.Attack,
      stages: -1,
    });
    expect(raised).toContain("battleLog.statChanged.raised");
    expect(lowered).toContain("battleLog.statChanged.lowered");
  });

  it("interpole le libellé de statistique par sa clé, pas par une table locale", () => {
    expect(
      traceOf({
        type: BattleEventType.StatChanged,
        targetId: "pika",
        stat: StatName.SpAttack,
        stages: 1,
      }),
    ).toBe("battleLog.statChanged.raised|name=Pikachu,statName=battleLog.stat.spAttack");
  });

  it("compose la clé de statut sur la VALEUR d'enum, tirets et soulignés compris", () => {
    expect(
      traceOf({
        type: BattleEventType.StatusApplied,
        targetId: "pika",
        status: StatusType.BadlyPoisoned,
      }),
    ).toBe("battleLog.status.badly_poisoned.applied|name=Pikachu");
    expect(
      traceOf({
        type: BattleEventType.StatusApplied,
        targetId: "pika",
        status: StatusType.AquaRing,
      }),
    ).toBe("battleLog.status.aqua-ring.applied|name=Pikachu");
  });

  it("sépare application et disparition d'un statut", () => {
    expect(
      traceOf({
        type: BattleEventType.StatusRemoved,
        targetId: "pika",
        status: StatusType.Burned,
      }),
    ).toBe("battleLog.status.burned.removed|name=Pikachu");
  });

  it("n'écrit AUCUNE ligne pour un statut hors périmètre du journal", () => {
    expect(
      formatBattleEvent(
        { type: BattleEventType.StatusApplied, targetId: "pika", status: StatusType.Roosted },
        traceContext(),
      ),
    ).toBeNull();
  });

  it("retombe sur le statut quand le terrain n'a pas de ligne dédiée", () => {
    expect(
      traceOf({
        type: BattleEventType.TerrainStatusApplied,
        pokemonId: "pika",
        terrain: TerrainType.Swamp,
        status: StatusType.Poisoned,
      }),
    ).toBe("battleLog.terrainStatus.swamp|name=Pikachu");
    expect(
      traceOf({
        type: BattleEventType.TerrainStatusApplied,
        pokemonId: "pika",
        terrain: TerrainType.Grass,
        status: StatusType.Poisoned,
      }),
    ).toBe("battleLog.status.poisoned.applied|name=Pikachu");
  });

  it("route le nom de protection par sa clé, et distingue blocage et renvoi", () => {
    expect(
      traceOf({
        type: BattleEventType.DefenseTriggered,
        defenderId: "pika",
        defenseKind: DefensiveKind.Protect,
        blocked: true,
      }),
    ).toBe(
      "battleLog.defenseTriggered.protected|defenseName=battleLog.defense.protect,name=Pikachu",
    );
    expect(
      traceOf({
        type: BattleEventType.DefenseTriggered,
        defenderId: "pika",
        defenseKind: DefensiveKind.Counter,
        blocked: false,
      }),
    ).toBe("battleLog.defenseTriggered.reflected|defenseName=battleLog.defense.counter");
  });

  it("choisit la clé selon la gravité de l'empoisonnement par piège d'entrée", () => {
    const badly = traceOf({
      type: BattleEventType.EntryHazardTriggered,
      pokemonId: "pika",
      kind: "toxic-spikes",
      status: StatusType.BadlyPoisoned,
    });
    const normal = traceOf({
      type: BattleEventType.EntryHazardTriggered,
      pokemonId: "pika",
      kind: "toxic-spikes",
      status: StatusType.Poisoned,
    });
    expect(badly).toContain("battleLog.entryHazardTriggered.badlyPoisoned");
    expect(normal).toContain("battleLog.entryHazardTriggered.poisoned");
    expect(badly).toContain("label=battleLog.entryHazard.toxic-spikes");
  });

  it("émet la clé de météo posée puis dissipée", () => {
    expect(traceOf({ type: BattleEventType.WeatherSet, weather: "rain" })).toBe(
      "battleLog.weather.rainSet",
    );
    expect(traceOf({ type: BattleEventType.WeatherCleared, weather: "rain" })).toBe(
      "battleLog.weather.rainCleared",
    );
  });

  it("ne fabrique jamais de message sans passer par translate", () => {
    const events: Parameters<typeof formatBattleEvent>[0][] = [
      { type: BattleEventType.TurnStarted, pokemonId: "pika" },
      { type: BattleEventType.MoveMissed, attackerId: "pika", targetId: "bulba" },
      { type: BattleEventType.PokemonKo, pokemonId: "bulba" },
      { type: BattleEventType.CriticalHit, attackerId: "pika", targetId: "bulba" },
      { type: BattleEventType.WeatherSet, weather: "sun" },
    ];
    for (const event of events) {
      const result = formatBattleEvent(event, traceContext());
      const entries = Array.isArray(result) ? result : result === null ? [] : [result];
      for (const entry of entries) {
        expect(entry.message.startsWith("battleLog.")).toBe(true);
      }
    }
  });

  it("conserve la couleur et les identifiants de Pokemon de chaque ligne", () => {
    const result = formatBattleEvent(
      { type: BattleEventType.TurnStarted, pokemonId: "pika" },
      traceContext(),
    ) as BattleLogEntry;
    expect(result.color).toBe(BattleLogColors.turn);
    expect(result.pokemonIds).toEqual(["pika"]);
  });
});
