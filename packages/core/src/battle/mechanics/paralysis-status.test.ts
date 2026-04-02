import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

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

    const { engine } = buildMoveTestEngine([charmander, bulbasaur]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "charmander-1",
      direction: Direction.South,
    });

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

    const { engine } = buildMoveTestEngine([charmander, pidgey]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "charmander-1",
      direction: Direction.South,
    });

    const actions = engine.getLegalActions(PlayerId.Player2);
    const useMoveActions = actions.filter((a) => a.kind === ActionKind.UseMove);
    const moveIds = [
      ...new Set(useMoveActions.map((a) => (a.kind === ActionKind.UseMove ? a.moveId : ""))),
    ];
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

    const { engine } = buildMoveTestEngine([charmander, bulbasaur]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "charmander-1",
      direction: Direction.South,
    });

    const actions = engine.getLegalActions(PlayerId.Player2);
    const useMoveActions = actions.filter((a) => a.kind === ActionKind.UseMove);
    const moveIds = [
      ...new Set(useMoveActions.map((a) => (a.kind === ActionKind.UseMove ? a.moveId : ""))),
    ];
    expect(moveIds).toContain("razor-leaf");
    expect(moveIds).toContain("sludge-bomb");

    vi.restoreAllMocks();
  });

  it("halves effective initiative so paralyzed Pokemon plays later", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const pokemonA = MockPokemon.fresh(MockPokemon.charmander, {
      id: "pokemon-a",
      definitionId: "charmander",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      statusEffects: [],
    });
    const pokemonB = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "pokemon-b",
      definitionId: "bulbasaur",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 80 },
      statusEffects: [],
    });

    const { engine, state } = buildMoveTestEngine([pokemonA, pokemonB]);

    expect(state.turnOrder[0]).toBe("pokemon-a");

    pokemonA.statusEffects = [{ type: StatusType.Paralyzed, remainingTurns: null }];

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "pokemon-a",
      direction: Direction.South,
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "pokemon-b",
      direction: Direction.South,
    });

    expect(state.roundNumber).toBe(2);
    expect(state.turnOrder[0]).toBe("pokemon-b");

    vi.restoreAllMocks();
  });
});
