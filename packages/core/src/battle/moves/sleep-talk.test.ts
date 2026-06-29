import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("sleep-talk", () => {
  const awakeUser = () =>
    MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 1, y: 1 },
      moveIds: ["sleep-talk", "ember", "scratch"],
    });
  const asleepUser = () =>
    MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 1, y: 1 },
      moveIds: ["sleep-talk", "ember", "scratch"],
      statusEffects: [{ type: StatusType.Asleep, remainingTurns: 2 }],
    });
  const foe = () =>
    MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
    });

  it("is not a legal action while awake", () => {
    const { engine } = buildMoveTestEngine([awakeUser(), foe()], { random: () => 0 });

    const actions = engine.getLegalActions(PlayerId.Player1);
    const sleepTalk = actions.filter(
      (action) =>
        action.kind === ActionKind.UseMove && "moveId" in action && action.moveId === "sleep-talk",
    );

    expect(sleepTalk).toHaveLength(0);
  });

  it("is a legal action while asleep", () => {
    const { engine } = buildMoveTestEngine([asleepUser(), foe()], { random: () => 0 });

    const actions = engine.getLegalActions(PlayerId.Player1);
    const sleepTalk = actions.filter(
      (action) =>
        action.kind === ActionKind.UseMove && "moveId" in action && action.moveId === "sleep-talk",
    );

    expect(sleepTalk.length).toBeGreaterThan(0);
  });

  it("rolls a move from the user's own moveset with its identity hidden", () => {
    const { engine } = buildMoveTestEngine([asleepUser(), foe()], { random: () => 0 });

    const result = engine.prepareCalledMove("charmander-1", "sleep-talk");

    expect("failed" in result).toBe(false);
    if ("failed" in result) {
      return;
    }
    expect(result.reveal).toBe(false);
    expect(["ember", "scratch"]).toContain(result.calledMoveId);
  });
});
