import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, endTurnUntilActor, MockPokemon } from "../../testing";
import { decrementDistortionTimer, postDistortion } from "../distortion-system";

// Distorsion (trick-room) — move integration tests

function slowFastTrio() {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 5 },
    moveIds: ["trick-room"],
    currentPp: { "trick-room": 10 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const slow = MockPokemon.fresh(MockPokemon.base, {
    id: "slow",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 6 },
    baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 20 },
    derivedStats: { movement: 3, jump: 1, initiative: 20 },
  });
  const fast = MockPokemon.fresh(MockPokemon.base, {
    id: "fast",
    playerId: PlayerId.Player2,
    position: { x: 5, y: 4 },
    baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 150 },
    derivedStats: { movement: 3, jump: 1, initiative: 150 },
  });
  return buildMoveTestEngine([caster, slow, fast], { gridSize: 12 });
}

function firstIndexOf(timeline: { pokemonId: string }[], id: string): number {
  return timeline.findIndex((entry) => entry.pokemonId === id);
}

describe("trick-room — zone posting", () => {
  it("posts a DistortionPosted event (25-tile r3 diamond, 5 turns) and a zone in state", () => {
    const { engine, state } = slowFastTrio();

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "trick-room",
      targetPosition: { x: 5, y: 5 },
    });

    expect(result.success).toBe(true);
    const posted = result.events.find((e) => e.type === BattleEventType.DistortionPosted);
    expect(posted).toBeDefined();
    if (posted && posted.type === BattleEventType.DistortionPosted) {
      expect(posted.casterId).toBe("caster");
      expect(posted.tiles.length).toBe(25);
      expect(posted.durationTurns).toBe(5);
    }
    expect(state.distortionZones).toHaveLength(1);
  });

  it("re-casting on the same tile refreshes the zone (Champs-style replace, no stacking)", () => {
    const { engine, state } = slowFastTrio();
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "trick-room",
      targetPosition: { x: 5, y: 5 },
    });
    expect(state.distortionZones).toHaveLength(1);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "caster",
      direction: Direction.South,
    });
    endTurnUntilActor(engine, state, "caster");
    expect(state.distortionZones[0]?.remainingTurns).toBeLessThan(5);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "trick-room",
      targetPosition: { x: 5, y: 5 },
    });

    expect(result.success).toBe(true);
    expect(state.distortionZones).toHaveLength(1);
    expect(state.distortionZones[0]?.remainingTurns).toBe(5);
  });
});

describe("trick-room — CT inversion inside the zone", () => {
  it("schedules a slow mon before a fast mon when both stand in the zone", () => {
    const { engine, state } = slowFastTrio();

    const controlTimeline = engine.predictCtTimeline(30);
    expect(firstIndexOf(controlTimeline, "fast")).toBeLessThan(
      firstIndexOf(controlTimeline, "slow"),
    );

    const caster = state.pokemon.get("caster");
    if (!caster) {
      throw new Error("missing caster");
    }
    postDistortion(state, caster);

    const distortedTimeline = engine.predictCtTimeline(30);
    expect(firstIndexOf(distortedTimeline, "slow")).toBeLessThan(
      firstIndexOf(distortedTimeline, "fast"),
    );
  });
});

describe("trick-room — duration and ghost clock", () => {
  it("expires after 5 of the caster's turns", () => {
    const { engine, state } = slowFastTrio();
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "trick-room",
      targetPosition: { x: 5, y: 5 },
    });
    expect(state.distortionZones[0]?.remainingTurns).toBe(5);

    for (let round = 0; round < 5; round++) {
      endTurnUntilActor(engine, state, "caster");
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.EndTurn,
        pokemonId: "caster",
        direction: Direction.South,
      });
    }

    expect(state.distortionZones).toHaveLength(0);
  });

  it("survives the caster's KO and still expires on the ghost clock", () => {
    const { engine, state } = slowFastTrio();
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "trick-room",
      targetPosition: { x: 5, y: 5 },
    });

    const caster = state.pokemon.get("caster");
    if (caster) {
      caster.currentHp = 0;
    }

    // The dead caster's would-be turns still tick its zone down (ghost clock): persists for 4...
    for (let i = 0; i < 4; i++) {
      decrementDistortionTimer(state, "caster");
    }
    expect(state.distortionZones).toHaveLength(1);
    expect(state.distortionZones[0]?.remainingTurns).toBe(1);

    // ...then expires on the 5th ghost tick.
    const expired = decrementDistortionTimer(state, "caster");
    expect(state.distortionZones).toHaveLength(0);
    expect(expired).toEqual([{ casterId: "caster" }]);
  });
});
