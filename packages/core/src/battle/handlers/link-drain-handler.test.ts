import { describe, expect, it } from "vitest";
import { BattleEventType } from "../../enums/battle-event-type";
import { MockBattle, MockLink, MockPokemon } from "../../testing";
import { linkDrainHandler } from "./link-drain-handler";

describe("linkDrainHandler", () => {
  it("drains target and heals source", () => {
    const source = MockPokemon.fresh(MockBattle.player1Fast, {
      id: "source",
      currentHp: 50,
      maxHp: 100,
    });
    const target = MockPokemon.fresh(MockBattle.player2Slow, {
      id: "target",
      currentHp: 100,
      maxHp: 100,
      position: { x: 2, y: 0 },
    });
    const state = MockBattle.stateFrom([source, target]);
    state.activeLinks = [{ ...MockLink.leechSeed }];

    const result = linkDrainHandler("target", state);

    expect(target.currentHp).toBe(88);
    expect(source.currentHp).toBe(62);
    expect(result.events).toContainEqual({
      type: BattleEventType.LinkDrained,
      sourceId: "source",
      targetId: "target",
      amount: 12,
    });
    expect(result.pokemonFainted).toBe(false);
  });

  it("does not heal source beyond maxHp", () => {
    const source = MockPokemon.fresh(MockBattle.player1Fast, {
      id: "source",
      currentHp: 95,
      maxHp: 100,
    });
    const target = MockPokemon.fresh(MockBattle.player2Slow, {
      id: "target",
      currentHp: 100,
      maxHp: 100,
      position: { x: 2, y: 0 },
    });
    const state = MockBattle.stateFrom([source, target]);
    state.activeLinks = [{ ...MockLink.leechSeed }];

    linkDrainHandler("target", state);

    expect(source.currentHp).toBe(100);
  });

  it("causes KO when drain kills target", () => {
    const source = MockPokemon.fresh(MockBattle.player1Fast, {
      id: "source",
      currentHp: 50,
      maxHp: 100,
    });
    const target = MockPokemon.fresh(MockBattle.player2Slow, {
      id: "target",
      currentHp: 5,
      maxHp: 100,
      position: { x: 2, y: 0 },
    });
    const state = MockBattle.stateFrom([source, target]);
    state.activeLinks = [{ ...MockLink.leechSeed }];

    const result = linkDrainHandler("target", state);

    expect(target.currentHp).toBe(0);
    expect(result.pokemonFainted).toBe(true);
    expect(result.events).toContainEqual({
      type: BattleEventType.PokemonKo,
      pokemonId: "target",
      countdownStart: 0,
    });
  });

  it("breaks link when distance exceeds maxRange", () => {
    const source = MockPokemon.fresh(MockBattle.player1Fast, {
      id: "source",
      currentHp: 100,
      maxHp: 100,
      position: { x: 0, y: 0 },
    });
    const target = MockPokemon.fresh(MockBattle.player2Slow, {
      id: "target",
      currentHp: 100,
      maxHp: 100,
      position: { x: 4, y: 4 },
    });
    const state = MockBattle.stateFrom([source, target]);
    state.activeLinks = [{ ...MockLink.leechSeed, maxRange: 4 }];

    const result = linkDrainHandler("target", state);

    expect(target.currentHp).toBe(100);
    expect(state.activeLinks).toHaveLength(0);
    expect(result.events).toContainEqual({
      type: BattleEventType.LinkBroken,
      sourceId: "source",
      targetId: "target",
    });
  });

  it("breaks link when source is KO", () => {
    const source = MockPokemon.fresh(MockBattle.player1Fast, {
      id: "source",
      currentHp: 0,
      maxHp: 100,
    });
    const target = MockPokemon.fresh(MockBattle.player2Slow, {
      id: "target",
      currentHp: 100,
      maxHp: 100,
      position: { x: 2, y: 0 },
    });
    const state = MockBattle.stateFrom([source, target]);
    state.activeLinks = [{ ...MockLink.leechSeed }];

    const result = linkDrainHandler("target", state);

    expect(target.currentHp).toBe(100);
    expect(state.activeLinks).toHaveLength(0);
    expect(result.events).toContainEqual({
      type: BattleEventType.LinkBroken,
      sourceId: "source",
      targetId: "target",
    });
  });

  it("permanent link does not countdown", () => {
    const source = MockPokemon.fresh(MockBattle.player1Fast, {
      id: "source",
      currentHp: 50,
      maxHp: 100,
    });
    const target = MockPokemon.fresh(MockBattle.player2Slow, {
      id: "target",
      currentHp: 100,
      maxHp: 100,
      position: { x: 2, y: 0 },
    });
    const state = MockBattle.stateFrom([source, target]);
    state.activeLinks = [{ ...MockLink.leechSeed, remainingTurns: null }];

    linkDrainHandler("target", state);

    expect(state.activeLinks[0]?.remainingTurns).toBeNull();
    expect(state.activeLinks).toHaveLength(1);
  });

  it("returns neutral result when no links target this pokemon", () => {
    const pokemon = MockPokemon.fresh(MockBattle.player1Fast, { id: "solo" });
    const state = MockBattle.stateFrom([pokemon]);
    state.activeLinks = [];

    const result = linkDrainHandler("solo", state);

    expect(result.events).toHaveLength(0);
    expect(result.pokemonFainted).toBe(false);
    expect(result.skipAction).toBe(false);
  });
});
