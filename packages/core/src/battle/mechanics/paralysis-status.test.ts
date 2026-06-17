import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, endTurnUntilActor, MockPokemon } from "../../testing";

describe("paralysis status", () => {
  it("blocks movement when paralysis procs (random < 0.25)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
      statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: null }],
    });

    const { engine, state } = buildMoveTestEngine([charmander, bulbasaur]);

    endTurnUntilActor(engine, state, "bulbasaur-1");

    const actions = engine.getLegalActions(PlayerId.Player2);
    const moveActions = actions.filter((a) => a.kind === ActionKind.Move);
    expect(moveActions).toHaveLength(0);

    vi.restoreAllMocks();
  });

  it("blocks dash moves when paralysis procs", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const pidgey = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 4, jump: 2, initiative: 50 },
      statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: null }],
    });

    const { engine, state } = buildMoveTestEngine([charmander, pidgey]);

    endTurnUntilActor(engine, state, "pidgey-1");

    const actions = engine.getLegalActions(PlayerId.Player2);
    const useMoveActions = actions.filter((a) => a.kind === ActionKind.UseMove);
    const moveIds = [
      ...new Set(useMoveActions.map((a) => (a.kind === ActionKind.UseMove ? a.moveId : ""))),
    ];
    expect(useMoveActions.length).toBeGreaterThan(0);
    expect(moveIds).not.toContain("quick-attack");

    vi.restoreAllMocks();
  });

  it("allows non-dash UseMove when paralysis procs", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
      statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: null }],
    });

    const { engine, state } = buildMoveTestEngine([charmander, bulbasaur]);

    endTurnUntilActor(engine, state, "bulbasaur-1");

    const actions = engine.getLegalActions(PlayerId.Player2);
    const useMoveActions = actions.filter((a) => a.kind === ActionKind.UseMove);
    const moveIds = [
      ...new Set(useMoveActions.map((a) => (a.kind === ActionKind.UseMove ? a.moveId : ""))),
    ];
    expect(moveIds).toContain("razor-leaf");
    expect(moveIds).toContain("sludge-bomb");

    vi.restoreAllMocks();
  });
});
