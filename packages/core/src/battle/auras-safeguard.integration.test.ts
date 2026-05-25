import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { AuraKind } from "../enums/aura-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { PlayerId } from "../enums/player-id";
import { StatusType } from "../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import { ProtectionReason } from "../types/battle-event";
import { postAura } from "./aura-system";

describe("Safeguard aura — blocks major statuses + confusion from enemies", () => {
  it("blocks Sleep (Sleep-Powder) on ally inside aura", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "safeguard-caster",
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
      moveIds: ["sleep-powder"],
      currentPp: { "sleep-powder": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, ally, enemy]);
    postAura(state, caster, AuraKind.Safeguard);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "sleep-powder",
      targetPosition: { x: 1, y: 0 },
    });

    const blockedEvent = result.events.find(
      (e) =>
        e.type === BattleEventType.StatusBlocked &&
        e.pokemonId === "ally" &&
        e.reason === ProtectionReason.Safeguard,
    );
    expect(blockedEvent).toBeDefined();

    const afterAlly = state.pokemon.get("ally");
    const isAsleep = afterAlly?.statusEffects.some((s) => s.type === StatusType.Asleep);
    expect(isAsleep).toBe(false);

    vi.restoreAllMocks();
  });

  it("blocks Paralysis (Thunder-Wave) on ally inside aura", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "safeguard-caster",
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
      moveIds: ["thunder-wave"],
      currentPp: { "thunder-wave": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, ally, enemy]);
    postAura(state, caster, AuraKind.Safeguard);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "thunder-wave",
      targetPosition: { x: 1, y: 0 },
    });

    const blockedEvent = result.events.find(
      (e) =>
        e.type === BattleEventType.StatusBlocked &&
        e.pokemonId === "ally" &&
        e.status === StatusType.Paralyzed,
    );
    expect(blockedEvent).toBeDefined();

    const afterAlly = state.pokemon.get("ally");
    const isParalyzed = afterAlly?.statusEffects.some((s) => s.type === StatusType.Paralyzed);
    expect(isParalyzed).toBe(false);

    vi.restoreAllMocks();
  });

  it("blocks Toxic (BadlyPoisoned) on ally inside aura", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "safeguard-caster",
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
      moveIds: ["toxic"],
      currentPp: { toxic: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, ally, enemy]);
    postAura(state, caster, AuraKind.Safeguard);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "toxic",
      targetPosition: { x: 1, y: 0 },
    });

    const blockedEvent = result.events.find(
      (e) =>
        e.type === BattleEventType.StatusBlocked &&
        e.pokemonId === "ally" &&
        e.status === StatusType.BadlyPoisoned,
    );
    expect(blockedEvent).toBeDefined();

    const afterAlly = state.pokemon.get("ally");
    const isBadlyPoisoned = afterAlly?.statusEffects.some(
      (s) => s.type === StatusType.BadlyPoisoned,
    );
    expect(isBadlyPoisoned).toBe(false);

    vi.restoreAllMocks();
  });

  it("blocks Confusion (Confuse-Ray) on ally inside aura", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "safeguard-caster",
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
      moveIds: ["confuse-ray"],
      currentPp: { "confuse-ray": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, ally, enemy]);
    postAura(state, caster, AuraKind.Safeguard);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "confuse-ray",
      targetPosition: { x: 1, y: 0 },
    });

    const blockedEvent = result.events.find(
      (e) =>
        e.type === BattleEventType.StatusBlocked &&
        e.pokemonId === "ally" &&
        e.status === StatusType.Confused,
    );
    expect(blockedEvent).toBeDefined();

    const afterAlly = state.pokemon.get("ally");
    const isConfused = afterAlly?.volatileStatuses.some((s) => s.type === StatusType.Confused);
    expect(isConfused).toBe(false);

    vi.restoreAllMocks();
  });

  it("Rest self-induced Asleep bypasses caster's own Safeguard", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "rest-caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: 50,
      maxHp: 100,
      moveIds: ["rest"],
      currentPp: { rest: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster]);
    postAura(state, caster, AuraKind.Safeguard);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "rest-caster",
      moveId: "rest",
      targetPosition: { x: 0, y: 0 },
    });

    const afterCaster = state.pokemon.get("rest-caster");
    const isAsleep = afterCaster?.statusEffects.some((s) => s.type === StatusType.Asleep);
    expect(isAsleep).toBe(true);

    vi.restoreAllMocks();
  });

  it("blocks friendly fire status from same-team ally", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "safeguard-caster",
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
      moveIds: ["thunder-wave"],
      currentPp: { "thunder-wave": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, ally, allyAttacker]);
    postAura(state, caster, AuraKind.Safeguard);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "ally-attacker",
      moveId: "thunder-wave",
      targetPosition: { x: 1, y: 0 },
    });

    const blocked = result.events.some(
      (e) =>
        e.type === BattleEventType.StatusBlocked &&
        e.pokemonId === "ally" &&
        e.status === StatusType.Paralyzed,
    );
    expect(blocked).toBe(true);
    expect(state.pokemon.get("ally")?.statusEffects.length).toBe(0);

    vi.restoreAllMocks();
  });

  it("does not protect target outside aura radius (>r3)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "safeguard-caster",
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
      moveIds: ["sleep-powder"],
      currentPp: { "sleep-powder": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, farAlly, enemy], { gridSize: 10 });
    postAura(state, caster, AuraKind.Safeguard);

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "sleep-powder",
      targetPosition: { x: 5, y: 0 },
    });

    const afterFarAlly = state.pokemon.get("far-ally");
    const isAsleep = afterFarAlly?.statusEffects.some((s) => s.type === StatusType.Asleep);
    expect(isAsleep).toBe(true);

    vi.restoreAllMocks();
  });

  it("emits protectingCasterId on StatusBlocked event", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "safeguard-caster",
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
      moveIds: ["sleep-powder"],
      currentPp: { "sleep-powder": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, ally, enemy]);
    postAura(state, caster, AuraKind.Safeguard);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "sleep-powder",
      targetPosition: { x: 1, y: 0 },
    });

    const blockedEvent = result.events.find(
      (e) => e.type === BattleEventType.StatusBlocked && e.pokemonId === "ally",
    );
    expect(blockedEvent).toBeDefined();
    if (blockedEvent && blockedEvent.type === BattleEventType.StatusBlocked) {
      expect(blockedEvent.protectingCasterId).toBe("safeguard-caster");
      expect(blockedEvent.reason).toBe(ProtectionReason.Safeguard);
    }

    vi.restoreAllMocks();
  });
});
