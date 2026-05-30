import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../enums/action-error";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { PlayerId } from "../enums/player-id";
import { StatusType } from "../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import { ProtectionReason } from "../types/battle-event";

describe("Disable — blocks the target's last used move for 4 turns", () => {
  it("applies Disabled volatile with 4 turns + MoveDisabled event", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["disable"],
      currentPp: { disable: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle", "recover"],
      currentPp: { tackle: 35, recover: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
      lastUsedMoveId: "tackle",
    });

    const { engine, state } = buildMoveTestEngine([attacker, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "disable",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const disabledEvent = result.events.find(
      (e) =>
        e.type === BattleEventType.MoveDisabled &&
        e.pokemonId === "target" &&
        e.moveId === "tackle",
    );
    expect(disabledEvent).toBeDefined();

    const targetAfter = state.pokemon.get("target");
    const disabled = targetAfter?.volatileStatuses.find((v) => v.type === StatusType.Disabled);
    expect(disabled?.remainingTurns).toBe(4);
    expect(disabled?.moveId).toBe("tackle");

    vi.restoreAllMocks();
  });

  it("blocks the disabled move but allows other moves", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle", "ember"],
      currentPp: { tackle: 35, ember: 25 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Disabled, remainingTurns: 4, moveId: "tackle" }],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });

    const { engine } = buildMoveTestEngine([caster, enemy]);

    const blocked = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    expect(blocked.success).toBe(false);
    expect(blocked.error).toBe(ActionError.InvalidAction);
    expect(
      blocked.events.some(
        (e) => e.type === BattleEventType.DisableBlocked && e.pokemonId === "caster",
      ),
    ).toBe(true);
  });

  it("getLegalActions removes only the disabled move", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle", "ember"],
      currentPp: { tackle: 35, ember: 25 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Disabled, remainingTurns: 4, moveId: "tackle" }],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });

    const { engine } = buildMoveTestEngine([caster, enemy]);
    const useMoves = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.UseMove);

    expect(useMoves.some((a) => a.kind === ActionKind.UseMove && a.moveId === "tackle")).toBe(
      false,
    );
    expect(useMoves.some((a) => a.kind === ActionKind.UseMove && a.moveId === "ember")).toBe(true);
  });

  it("fails when the target has not used a move yet", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["disable"],
      currentPp: { disable: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });

    const { engine, state } = buildMoveTestEngine([attacker, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "disable",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.events.some((e) => e.type === BattleEventType.DisableFailed)).toBe(true);
    expect(state.pokemon.get("target")?.volatileStatuses.length).toBe(0);

    vi.restoreAllMocks();
  });

  it("fails when the target's last move has no PP left", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["disable"],
      currentPp: { disable: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
      lastUsedMoveId: "tackle",
    });

    const { engine, state } = buildMoveTestEngine([attacker, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "disable",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.events.some((e) => e.type === BattleEventType.DisableFailed)).toBe(true);
    expect(
      state.pokemon.get("target")?.volatileStatuses.some((v) => v.type === StatusType.Disabled),
    ).toBe(false);

    vi.restoreAllMocks();
  });

  it("fails when the target already has a disabled move", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["disable"],
      currentPp: { disable: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
      lastUsedMoveId: "tackle",
      volatileStatuses: [{ type: StatusType.Disabled, remainingTurns: 4, moveId: "tackle" }],
    });

    const { engine } = buildMoveTestEngine([attacker, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "disable",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.events.some((e) => e.type === BattleEventType.DisableFailed)).toBe(true);

    vi.restoreAllMocks();
  });
});

describe("Encore — forces the target to repeat its last move for 3 turns", () => {
  it("applies Encored volatile with 3 turns + MoveEncored event", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["encore"],
      currentPp: { encore: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["recover", "tackle"],
      currentPp: { recover: 10, tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
      lastUsedMoveId: "recover",
    });

    const { engine, state } = buildMoveTestEngine([attacker, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "encore",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const encoredEvent = result.events.find(
      (e) =>
        e.type === BattleEventType.MoveEncored &&
        e.pokemonId === "target" &&
        e.moveId === "recover",
    );
    expect(encoredEvent).toBeDefined();

    const encored = state.pokemon
      .get("target")
      ?.volatileStatuses.find((v) => v.type === StatusType.Encored);
    expect(encored?.remainingTurns).toBe(3);
    expect(encored?.moveId).toBe("recover");

    vi.restoreAllMocks();
  });

  it("getLegalActions keeps only the encored move", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle", "ember"],
      currentPp: { tackle: 35, ember: 25 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Encored, remainingTurns: 3, moveId: "tackle" }],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });

    const { engine } = buildMoveTestEngine([caster, enemy]);
    const useMoves = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.UseMove);

    expect(useMoves.some((a) => a.kind === ActionKind.UseMove && a.moveId === "tackle")).toBe(true);
    expect(useMoves.some((a) => a.kind === ActionKind.UseMove && a.moveId === "ember")).toBe(false);
  });

  it("blocks a non-encored move via executeUseMove", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle", "ember"],
      currentPp: { tackle: 35, ember: 25 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Encored, remainingTurns: 3, moveId: "tackle" }],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });

    const { engine } = buildMoveTestEngine([caster, enemy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "ember",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.events.some((e) => e.type === BattleEventType.EncoreBlocked)).toBe(true);
  });

  it("ends early when the encored move runs out of PP", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle", "ember"],
      currentPp: { tackle: 0, ember: 25 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Encored, remainingTurns: 3, moveId: "tackle" }],
    });
    const dummy = MockPokemon.fresh(MockPokemon.base, {
      id: "dummy",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 1 },
    });

    const { engine, state } = buildMoveTestEngine([caster, dummy]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "caster",
      direction: caster.orientation,
    });

    const stillEncored = state.pokemon
      .get("caster")
      ?.volatileStatuses.some((v) => v.type === StatusType.Encored);
    expect(stillEncored).toBe(false);
  });

  it("fails when the target has not used a move yet", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["encore"],
      currentPp: { encore: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });

    const { engine } = buildMoveTestEngine([attacker, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "encore",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.events.some((e) => e.type === BattleEventType.EncoreFailed)).toBe(true);

    vi.restoreAllMocks();
  });
});

describe("Encore/Disable — interactions", () => {
  it("Substitute blocks Disable and Encore (canon)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const disabler = MockPokemon.fresh(MockPokemon.base, {
      id: "disabler",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["disable", "encore"],
      currentPp: { disable: 20, encore: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
      lastUsedMoveId: "tackle",
      substituteHp: 25,
    });

    const { engine, state } = buildMoveTestEngine([disabler, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "disabler",
      moveId: "disable",
      targetPosition: { x: 1, y: 0 },
    });

    const blocked = result.events.find(
      (e) =>
        e.type === BattleEventType.StatusBlocked &&
        e.status === StatusType.Disabled &&
        e.reason === ProtectionReason.Substitute,
    );
    expect(blocked).toBeDefined();
    expect(
      state.pokemon.get("target")?.volatileStatuses.some((v) => v.type === StatusType.Disabled),
    ).toBe(false);

    vi.restoreAllMocks();
  });

  it("does not regress Taunt duration through the shared tick handler", () => {
    const tauntedCaster = MockPokemon.fresh(MockPokemon.base, {
      id: "taunted",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [{ type: StatusType.Taunted, remainingTurns: 3 }],
    });
    const dummy = MockPokemon.fresh(MockPokemon.base, {
      id: "dummy",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 1 },
    });

    const { engine, state } = buildMoveTestEngine([tauntedCaster, dummy]);

    for (let turn = 0; turn < 3; turn++) {
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "taunted",
        direction: tauntedCaster.orientation,
      });
      engine.submitAction(PlayerId.Player2, {
        kind: ActionKind.EndTurn,
        pokemonId: "dummy",
        direction: dummy.orientation,
      });
    }

    expect(
      state.pokemon.get("taunted")?.volatileStatuses.some((v) => v.type === StatusType.Taunted),
    ).toBe(false);
  });

  it("clears Disabled/Encored volatiles on KO", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 1,
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
      volatileStatuses: [
        { type: StatusType.Disabled, remainingTurns: 4, moveId: "tackle" },
        { type: StatusType.Encored, remainingTurns: 3, moveId: "tackle" },
      ],
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });

    const { engine, state } = buildMoveTestEngine([attacker, target, ally]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    const targetAfter = state.pokemon.get("target");
    expect(targetAfter?.currentHp).toBe(0);
    expect(targetAfter?.volatileStatuses.length).toBe(0);

    vi.restoreAllMocks();
  });

  it("Encore + Disable on the same move does not soft-lock the unit", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle", "ember"],
      currentPp: { tackle: 35, ember: 25 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      volatileStatuses: [
        { type: StatusType.Disabled, remainingTurns: 4, moveId: "tackle" },
        { type: StatusType.Encored, remainingTurns: 3, moveId: "tackle" },
      ],
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });

    const { engine } = buildMoveTestEngine([caster, enemy]);
    const actions = engine.getLegalActions(PlayerId.Player1);

    expect(actions.filter((a) => a.kind === ActionKind.UseMove).length).toBe(0);
    expect(actions.some((a) => a.kind === ActionKind.EndTurn)).toBe(true);
  });
});
