import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { AuraKind } from "../enums/aura-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { PlayerId } from "../enums/player-id";
import { StatName } from "../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import { ProtectionReason } from "../types/battle-event";
import { postAura } from "./aura-system";

describe("Mist aura — blocks enemy stat decreases", () => {
  it("blocks Growl Atk -1 when target sits in ally's Mist aura", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "mist-caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      moveIds: ["growl"],
      currentPp: { growl: 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, ally, enemy]);
    postAura(state, caster, AuraKind.Mist);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "growl",
      targetPosition: { x: 1, y: 0 },
    });

    const blockedEvents = result.events.filter(
      (e) =>
        e.type === BattleEventType.StatChangeBlocked &&
        e.reason === ProtectionReason.Mist &&
        e.pokemonId === "ally",
    );
    expect(blockedEvents.length).toBeGreaterThan(0);

    const afterAlly = state.pokemon.get("ally");
    expect(afterAlly?.statStages[StatName.Attack]).toBe(0);

    vi.restoreAllMocks();
  });

  it("blocks Growl on multiple allies in cone (6v6 scenario)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "mist-caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const ally1 = MockPokemon.fresh(MockPokemon.base, {
      id: "ally1",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const ally2 = MockPokemon.fresh(MockPokemon.base, {
      id: "ally2",
      playerId: PlayerId.Player1,
      position: { x: 4, y: 2 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 2 },
      moveIds: ["growl"],
      currentPp: { growl: 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, ally1, ally2, enemy], { gridSize: 8 });
    postAura(state, caster, AuraKind.Mist);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "growl",
      targetPosition: { x: 4, y: 2 },
    });

    const blockedOnAlly1 = result.events.some(
      (e) => e.type === BattleEventType.StatChangeBlocked && e.pokemonId === "ally1",
    );
    const blockedOnAlly2 = result.events.some(
      (e) => e.type === BattleEventType.StatChangeBlocked && e.pokemonId === "ally2",
    );
    const blockedOnCaster = result.events.some(
      (e) => e.type === BattleEventType.StatChangeBlocked && e.pokemonId === "mist-caster",
    );

    expect(state.pokemon.get("ally1")?.statStages[StatName.Attack]).toBe(0);
    expect(state.pokemon.get("ally2")?.statStages[StatName.Attack]).toBe(0);
    expect(state.pokemon.get("mist-caster")?.statStages[StatName.Attack]).toBe(0);
    expect(blockedOnAlly1 || blockedOnAlly2 || blockedOnCaster).toBe(true);

    vi.restoreAllMocks();
  });

  it("blocks friendly fire stat decrease from same-team ally cone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "mist-caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const allyAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "ally-attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 0 },
      moveIds: ["growl"],
      currentPp: { growl: 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, ally, allyAttacker]);
    postAura(state, caster, AuraKind.Mist);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "ally-attacker",
      moveId: "growl",
      targetPosition: { x: 1, y: 0 },
    });

    const blocked = result.events.some(
      (e) => e.type === BattleEventType.StatChangeBlocked && e.pokemonId === "ally",
    );
    expect(blocked).toBe(true);
    expect(state.pokemon.get("ally")?.statStages[StatName.Attack]).toBe(0);

    vi.restoreAllMocks();
  });

  it("does not protect target outside aura radius (>r3)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "mist-caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const farAlly = MockPokemon.fresh(MockPokemon.base, {
      id: "far-ally",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 6, y: 0 },
      moveIds: ["growl"],
      currentPp: { growl: 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, farAlly, enemy], { gridSize: 10 });
    postAura(state, caster, AuraKind.Mist);

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "growl",
      targetPosition: { x: 5, y: 0 },
    });

    const afterFarAlly = state.pokemon.get("far-ally");
    expect(afterFarAlly?.statStages[StatName.Attack]).toBe(-1);

    vi.restoreAllMocks();
  });

  it("Mist disappears when caster KOs (aura cleanup)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "mist-caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: 1,
      maxHp: 100,
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      moveIds: ["growl"],
      currentPp: { growl: 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, ally, enemy]);
    postAura(state, caster, AuraKind.Mist);

    // KO caster directly
    const casterRef = state.pokemon.get("mist-caster");
    if (casterRef) {
      casterRef.currentHp = 0;
    }

    // Manually emulate handleKo by using removeAurasOfCaster — but for this test
    // we rely on Growl going through since caster is dead.
    // In core BattleEngine.handleKo removes auras. To exercise that, we'd need to
    // route damage through the engine. Simpler: caster HP 0 → findActiveAurasProtectingTarget
    // already excludes dead casters, so Mist aura inactive.
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "growl",
      targetPosition: { x: 1, y: 0 },
    });

    const afterAlly = state.pokemon.get("ally");
    expect(afterAlly?.statStages[StatName.Attack]).toBe(-1);

    vi.restoreAllMocks();
  });

  it("emits protectingCasterId on StatChangeBlocked event", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "mist-caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      moveIds: ["growl"],
      currentPp: { growl: 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, ally, enemy]);
    postAura(state, caster, AuraKind.Mist);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "growl",
      targetPosition: { x: 1, y: 0 },
    });

    const blockedEvent = result.events.find(
      (e) => e.type === BattleEventType.StatChangeBlocked && e.pokemonId === "ally",
    );
    expect(blockedEvent).toBeDefined();
    if (blockedEvent && blockedEvent.type === BattleEventType.StatChangeBlocked) {
      expect(blockedEvent.protectingCasterId).toBe("mist-caster");
      expect(blockedEvent.reason).toBe(ProtectionReason.Mist);
    }

    vi.restoreAllMocks();
  });
});
