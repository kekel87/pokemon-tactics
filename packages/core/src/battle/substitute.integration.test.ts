import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { PlayerId } from "../enums/player-id";
import { StatusType } from "../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import { ProtectionReason, SubstituteFailedReason } from "../types/battle-event";

describe("Substitute — post + cost + invariants", () => {
  it("posts substitute at 25% maxHp, removes from caster HP", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      maxHp: 100,
      currentHp: 100,
      moveIds: ["substitute"],
      currentPp: { substitute: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });

    const { engine, state } = buildMoveTestEngine([caster, enemy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "substitute",
      targetPosition: { x: 0, y: 0 },
    });

    const posted = result.events.find((e) => e.type === BattleEventType.SubstitutePosted);
    expect(posted).toBeDefined();

    const after = state.pokemon.get("caster");
    expect(after?.currentHp).toBe(75);
    expect(after?.substituteHp).toBe(25);
  });

  it("fails if HP <= 25%", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      maxHp: 100,
      currentHp: 25,
      moveIds: ["substitute"],
      currentPp: { substitute: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });

    const { engine, state } = buildMoveTestEngine([caster, enemy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "substitute",
      targetPosition: { x: 0, y: 0 },
    });

    const failed = result.events.find(
      (e) =>
        e.type === BattleEventType.SubstituteFailed &&
        e.reason === SubstituteFailedReason.InsufficientHp,
    );
    expect(failed).toBeDefined();
    expect(state.pokemon.get("caster")?.substituteHp).toBeUndefined();
  });

  it("fails if already active", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      maxHp: 100,
      currentHp: 75,
      substituteHp: 25,
      moveIds: ["substitute"],
      currentPp: { substitute: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });

    const { engine } = buildMoveTestEngine([caster, enemy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "substitute",
      targetPosition: { x: 0, y: 0 },
    });

    const failed = result.events.find(
      (e) =>
        e.type === BattleEventType.SubstituteFailed &&
        e.reason === SubstituteFailedReason.AlreadyActive,
    );
    expect(failed).toBeDefined();
  });
});

describe("Substitute — damage absorption", () => {
  it("absorbs damage entirely when sub HP > damage", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      maxHp: 100,
      currentHp: 75,
      substituteHp: 100,
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, enemy]);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "tackle",
      targetPosition: { x: 0, y: 0 },
    });

    const damaged = result.events.find((e) => e.type === BattleEventType.SubstituteDamaged);
    expect(damaged).toBeDefined();

    const after = state.pokemon.get("caster");
    expect(after?.currentHp).toBe(75);
    expect(after?.substituteHp).toBeGreaterThan(0);
    expect(after?.substituteHp).toBeLessThan(100);

    vi.restoreAllMocks();
  });

  it("breaks substitute when damage >= sub HP, excess not carried", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      maxHp: 100,
      currentHp: 75,
      substituteHp: 1,
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, enemy]);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "tackle",
      targetPosition: { x: 0, y: 0 },
    });

    const broken = result.events.find((e) => e.type === BattleEventType.SubstituteBroken);
    expect(broken).toBeDefined();

    const after = state.pokemon.get("caster");
    expect(after?.currentHp).toBe(75);
    expect(after?.substituteHp).toBeUndefined();

    vi.restoreAllMocks();
  });
});

describe("Substitute — status block", () => {
  it("blocks Paralysis (Thunder-Wave) from enemy", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      maxHp: 100,
      currentHp: 75,
      substituteHp: 25,
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["thunder-wave"],
      currentPp: { "thunder-wave": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, enemy]);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "thunder-wave",
      targetPosition: { x: 0, y: 0 },
    });

    const blocked = result.events.find(
      (e) => e.type === BattleEventType.StatusBlocked && e.reason === ProtectionReason.Substitute,
    );
    expect(blocked).toBeDefined();

    const after = state.pokemon.get("caster");
    const paralyzed = after?.statusEffects.some((s) => s.type === StatusType.Paralyzed);
    expect(paralyzed).toBe(false);

    vi.restoreAllMocks();
  });
});

describe("Substitute — stat change block", () => {
  it("blocks Speed -1 (Icy-Wind secondary) from enemy", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      maxHp: 200,
      currentHp: 150,
      substituteHp: 50,
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["icy-wind"],
      currentPp: { "icy-wind": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, enemy]);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "icy-wind",
      targetPosition: { x: 0, y: 0 },
    });

    const blocked = result.events.find(
      (e) =>
        e.type === BattleEventType.StatChangeBlocked && e.reason === ProtectionReason.Substitute,
    );
    expect(blocked).toBeDefined();

    const afterSpeed = state.pokemon.get("caster")?.statStages.speed ?? 0;
    expect(afterSpeed).toBe(0);

    vi.restoreAllMocks();
  });
});

describe("Substitute — sound bypass", () => {
  it("Sing (sound) bypasses sub and applies Sleep", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      maxHp: 100,
      currentHp: 75,
      substituteHp: 25,
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      moveIds: ["sing"],
      currentPp: { sing: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, enemy]);

    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "sing",
      targetPosition: { x: 0, y: 0 },
    });

    const blocked = result.events.find(
      (e) => e.type === BattleEventType.StatusBlocked && e.reason === ProtectionReason.Substitute,
    );
    expect(blocked).toBeUndefined();

    const after = state.pokemon.get("caster");
    const asleep = after?.statusEffects.some((s) => s.type === StatusType.Asleep);
    expect(asleep).toBe(true);

    vi.restoreAllMocks();
  });

  it("Growl (sound) bypasses sub and lowers Atk", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      maxHp: 100,
      currentHp: 75,
      substituteHp: 25,
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["growl"],
      currentPp: { growl: 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const { engine, state } = buildMoveTestEngine([caster, enemy]);

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "enemy",
      moveId: "growl",
      targetPosition: { x: 0, y: 0 },
    });

    const afterAtk = state.pokemon.get("caster")?.statStages.attack ?? 0;
    expect(afterAtk).toBe(-1);

    vi.restoreAllMocks();
  });
});

describe("Substitute — KO cleanup", () => {
  it("clears substituteHp when caster KO'd by recoil (Self-Destruct)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      maxHp: 100,
      currentHp: 50,
      substituteHp: 25,
      moveIds: ["self-destruct"],
      currentPp: { "self-destruct": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });

    const { engine, state } = buildMoveTestEngine([caster, enemy]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "self-destruct",
      targetPosition: { x: 1, y: 0 },
    });

    const after = state.pokemon.get("caster");
    expect(after?.currentHp).toBe(0);
    expect(after?.substituteHp).toBeUndefined();

    vi.restoreAllMocks();
  });
});
