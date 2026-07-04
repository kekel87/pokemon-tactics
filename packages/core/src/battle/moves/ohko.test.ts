import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildItemTestEngine, buildMoveTestEngine, MockPokemon } from "../../testing";

function attacker(overrides: Partial<Parameters<typeof MockPokemon.fresh>[1]> = {}) {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    definitionId: "machop",
    playerId: PlayerId.Player1,
    position: { x: 1, y: 2 },
    moveIds: ["guillotine"],
    currentPp: { guillotine: 5 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
    ...overrides,
  });
}

function foe(overrides: Partial<Parameters<typeof MockPokemon.fresh>[1]> = {}) {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    definitionId: "machop",
    playerId: PlayerId.Player2,
    position: { x: 2, y: 2 },
    currentHp: 300,
    maxHp: 300,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
    ...overrides,
  });
}

describe("OHKO family", () => {
  it("instantly KOs the target on hit and emits OneHitKo", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { engine, state } = buildMoveTestEngine([attacker(), foe()]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "guillotine",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBe(0);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.OneHitKo);
    vi.restoreAllMocks();
  });

  it("misses on a failed accuracy roll, leaving the target untouched", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { engine, state } = buildMoveTestEngine([attacker(), foe()]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "guillotine",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBe(300);
    const types = result.events.map((event) => event.type);
    expect(types).toContain(BattleEventType.MoveMissed);
    expect(types).not.toContain(BattleEventType.OneHitKo);
    vi.restoreAllMocks();
  });

  it("Fermeté grants full immunity (target untouched, AbilityActivated)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { engine, state } = buildMoveTestEngine([
      attacker(),
      foe({ definitionId: "geodude", abilityId: "sturdy", currentHp: 200, maxHp: 200 }),
    ]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "guillotine",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBe(200);
    expect(result.events.map((event) => event.type)).not.toContain(BattleEventType.OneHitKo);
    const abilityEvents = result.events.filter(
      (event) => event.type === BattleEventType.AbilityActivated,
    );
    expect(abilityEvents.length).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });

  it("Brise Moule bypasses Fermeté and lands the KO", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { engine, state } = buildMoveTestEngine([
      attacker({ abilityId: "mold-breaker" }),
      foe({ definitionId: "geodude", abilityId: "sturdy", currentHp: 200, maxHp: 200 }),
    ]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "guillotine",
      targetPosition: { x: 2, y: 2 },
    });

    expect(state.pokemon.get("foe")?.currentHp).toBe(0);
    vi.restoreAllMocks();
  });

  it("a Ghost target is immune to a Normal OHKO (no effect, no KO)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { engine, state } = buildMoveTestEngine([
      attacker(),
      foe({ definitionId: "gastly", currentHp: 200, maxHp: 200 }),
    ]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "guillotine",
      targetPosition: { x: 2, y: 2 },
    });

    expect(state.pokemon.get("foe")?.currentHp).toBe(200);
    expect(result.events.map((event) => event.type)).not.toContain(BattleEventType.OneHitKo);
    vi.restoreAllMocks();
  });

  it("Abîme (Ground) does not affect a Flying target", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { engine, state } = buildMoveTestEngine([
      attacker({ moveIds: ["fissure"], currentPp: { fissure: 5 } }),
      foe({ definitionId: "pidgey", currentHp: 200, maxHp: 200 }),
    ]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "fissure",
      targetPosition: { x: 2, y: 2 },
    });

    expect(state.pokemon.get("foe")?.currentHp).toBe(200);
    vi.restoreAllMocks();
  });

  it("Glaciation does not affect an Ice-type target", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { engine, state } = buildMoveTestEngine([
      attacker({ definitionId: "lapras", moveIds: ["sheer-cold"], currentPp: { "sheer-cold": 5 } }),
      foe({ definitionId: "dewgong", currentHp: 200, maxHp: 200 }),
    ]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "sheer-cold",
      targetPosition: { x: 2, y: 2 },
    });

    expect(state.pokemon.get("foe")?.currentHp).toBe(200);
    vi.restoreAllMocks();
  });

  it("rolls accuracy independently per target on a multi-tile line (one KO, one survivor)", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.99).mockReturnValue(0.99);
    const secondFoe = foe({ id: "foe2", position: { x: 3, y: 2 }, currentHp: 250, maxHp: 250 });
    const { engine, state } = buildMoveTestEngine([
      attacker({ moveIds: ["fissure"], currentPp: { fissure: 5 } }),
      foe(),
      secondFoe,
    ]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "fissure",
      targetPosition: { x: 3, y: 2 },
    });

    const koCount = [state.pokemon.get("foe"), state.pokemon.get("foe2")].filter(
      (pokemon) => pokemon?.currentHp === 0,
    ).length;
    const aliveCount = [state.pokemon.get("foe"), state.pokemon.get("foe2")].filter(
      (pokemon) => (pokemon?.currentHp ?? 0) > 0,
    ).length;
    expect(koCount).toBe(1);
    expect(aliveCount).toBe(1);
    vi.restoreAllMocks();
  });

  it("Verrouillage guarantees the hit and is consumed exactly once", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { engine, state } = buildMoveTestEngine([
      attacker({ volatileStatuses: [{ type: StatusType.LockedOn, remainingTurns: 1 }] }),
      foe(),
    ]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "guillotine",
      targetPosition: { x: 2, y: 2 },
    });

    expect(state.pokemon.get("foe")?.currentHp).toBe(0);
    expect(state.pokemon.get("attacker")?.volatileStatuses).not.toContainEqual(
      expect.objectContaining({ type: StatusType.LockedOn }),
    );
    vi.restoreAllMocks();
  });

  it("Baie Ceinture lets a full-HP target survive the OHKO at 1 HP", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { engine, state } = buildItemTestEngine(
      [attacker(), foe({ heldItemId: HeldItemId.FocusSash, currentHp: 200, maxHp: 200 })],
      6,
      "attacker",
    );

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "guillotine",
      targetPosition: { x: 2, y: 2 },
    });

    expect(state.pokemon.get("foe")?.currentHp).toBe(1);
    vi.restoreAllMocks();
  });
});
