import { describe, expect, it } from "vitest";
import { BattleEventType } from "../enums/battle-event-type";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { PhaseResult } from "./turn-pipeline";
import { TurnPipeline } from "./turn-pipeline";

const dummyState = {} as BattleState;

const neutralResult: PhaseResult = {
  events: [],
  skipAction: false,
  restrictActions: false,
  pokemonFainted: false,
};

const turnEndedEvent: BattleEvent = {
  type: BattleEventType.TurnEnded,
  pokemonId: "pokemon-1",
};

describe("TurnPipeline", () => {
  it("returns neutral result when no handlers are registered", () => {
    const pipeline = new TurnPipeline();

    const result = pipeline.executeStartTurn("pokemon-1", dummyState);

    expect(result.events).toEqual([]);
    expect(result.skipAction).toBe(false);
    expect(result.restrictActions).toBe(false);
    expect(result.pokemonFainted).toBe(false);
  });

  it("executes a registered StartTurn handler", () => {
    const pipeline = new TurnPipeline();
    pipeline.registerStartTurn(() => ({ ...neutralResult, events: [turnEndedEvent] }), 100);

    const result = pipeline.executeStartTurn("pokemon-1", dummyState);

    expect(result.events).toEqual([turnEndedEvent]);
  });

  it("executes a registered EndTurn handler", () => {
    const pipeline = new TurnPipeline();
    pipeline.registerEndTurn(() => ({ ...neutralResult, events: [turnEndedEvent] }), 100);

    const result = pipeline.executeEndTurn("pokemon-1", dummyState);

    expect(result.events).toEqual([turnEndedEvent]);
  });

  it("executes handlers in priority order (lower number first)", () => {
    const pipeline = new TurnPipeline();
    const order: number[] = [];
    pipeline.registerStartTurn(() => {
      order.push(2);
      return neutralResult;
    }, 200);
    pipeline.registerStartTurn(() => {
      order.push(1);
      return neutralResult;
    }, 100);

    pipeline.executeStartTurn("pokemon-1", dummyState);

    expect(order).toEqual([1, 2]);
  });

  it("merges results from multiple handlers", () => {
    const pipeline = new TurnPipeline();
    const event1: BattleEvent = {
      type: BattleEventType.TurnStarted,
      pokemonId: "p1",
      roundNumber: 1,
    };
    const event2: BattleEvent = { type: BattleEventType.TurnEnded, pokemonId: "p1" };
    pipeline.registerStartTurn(
      () => ({ ...neutralResult, events: [event1], skipAction: true }),
      100,
    );
    pipeline.registerStartTurn(
      () => ({ ...neutralResult, events: [event2], restrictActions: true }),
      200,
    );

    const result = pipeline.executeStartTurn("pokemon-1", dummyState);

    expect(result.events).toEqual([event1, event2]);
    expect(result.skipAction).toBe(true);
    expect(result.restrictActions).toBe(true);
  });

  it("stops executing handlers when pokemonFainted is true", () => {
    const pipeline = new TurnPipeline();
    const faintEvent: BattleEvent = {
      type: BattleEventType.PokemonKo,
      pokemonId: "p1",
      countdownStart: 0,
    };
    const unreachedEvent: BattleEvent = { type: BattleEventType.TurnEnded, pokemonId: "p1" };
    pipeline.registerStartTurn(
      () => ({ ...neutralResult, events: [faintEvent], pokemonFainted: true }),
      100,
    );
    pipeline.registerStartTurn(() => ({ ...neutralResult, events: [unreachedEvent] }), 200);

    const result = pipeline.executeStartTurn("pokemon-1", dummyState);

    expect(result.events).toEqual([faintEvent]);
    expect(result.pokemonFainted).toBe(true);
  });

  it("passes pokemonId to the handler", () => {
    const pipeline = new TurnPipeline();
    let receivedId = "";
    pipeline.registerStartTurn((pokemonId) => {
      receivedId = pokemonId;
      return neutralResult;
    }, 100);

    pipeline.executeStartTurn("charmander-1", dummyState);

    expect(receivedId).toBe("charmander-1");
  });

  it("unregisters a StartTurn handler", () => {
    const pipeline = new TurnPipeline();
    const event: BattleEvent = { type: BattleEventType.TurnEnded, pokemonId: "p1" };
    const handler = (): PhaseResult => ({ ...neutralResult, events: [event] });
    pipeline.registerStartTurn(handler, 100);

    pipeline.unregisterStartTurn(handler);
    const result = pipeline.executeStartTurn("p1", dummyState);

    expect(result.events).toEqual([]);
  });

  it("unregisters an EndTurn handler", () => {
    const pipeline = new TurnPipeline();
    const event: BattleEvent = { type: BattleEventType.TurnEnded, pokemonId: "p1" };
    const handler = (): PhaseResult => ({ ...neutralResult, events: [event] });
    pipeline.registerEndTurn(handler, 100);

    pipeline.unregisterEndTurn(handler);
    const result = pipeline.executeEndTurn("p1", dummyState);

    expect(result.events).toEqual([]);
  });

  it("does nothing when unregistering a handler that was not registered", () => {
    const pipeline = new TurnPipeline();
    const handler = (): PhaseResult => neutralResult;

    pipeline.unregisterStartTurn(handler);
    const result = pipeline.executeStartTurn("p1", dummyState);

    expect(result.events).toEqual([]);
  });
});
