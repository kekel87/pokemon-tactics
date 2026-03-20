import { describe, expect, it } from "vitest";
import { MockBattle } from "../testing/mock-battle";
import type { PokemonInstance } from "../types/pokemon-instance";
import { TurnManager } from "./TurnManager";

const base = MockBattle.player1Fast;

function pokemon(id: string, initiative: number): PokemonInstance {
  return { ...base, id, derivedStats: { ...base.derivedStats, initiative } };
}

describe("TurnManager", () => {
  it("sorts pokemon by initiative descending", () => {
    const turnManager = new TurnManager([
      pokemon("slow", 10),
      pokemon("fast", 90),
      pokemon("medium", 50),
    ]);

    expect(turnManager.getCurrentPokemonId()).toBe("fast");
  });

  it("breaks initiative ties by alphabetical id", () => {
    const turnManager = new TurnManager([
      pokemon("charlie", 50),
      pokemon("alice", 50),
      pokemon("bob", 50),
    ]);

    expect(turnManager.getCurrentPokemonId()).toBe("alice");
    turnManager.advance();
    expect(turnManager.getCurrentPokemonId()).toBe("bob");
    turnManager.advance();
    expect(turnManager.getCurrentPokemonId()).toBe("charlie");
  });

  it("advances through all pokemon in order", () => {
    const turnManager = new TurnManager([
      pokemon("slow", 10),
      pokemon("fast", 90),
      pokemon("medium", 50),
    ]);

    expect(turnManager.getCurrentPokemonId()).toBe("fast");
    turnManager.advance();
    expect(turnManager.getCurrentPokemonId()).toBe("medium");
    turnManager.advance();
    expect(turnManager.getCurrentPokemonId()).toBe("slow");
  });

  it("detects round completion", () => {
    const turnManager = new TurnManager([pokemon("a", 50), pokemon("b", 30)]);

    expect(turnManager.isRoundComplete()).toBe(false);
    turnManager.advance();
    expect(turnManager.isRoundComplete()).toBe(false);
    turnManager.advance();
    expect(turnManager.isRoundComplete()).toBe(true);
  });

  it("starts a new round from the beginning", () => {
    const turnManager = new TurnManager([pokemon("a", 50), pokemon("b", 30)]);

    turnManager.advance();
    turnManager.advance();
    expect(turnManager.isRoundComplete()).toBe(true);

    turnManager.startNewRound();
    expect(turnManager.isRoundComplete()).toBe(false);
    expect(turnManager.getCurrentPokemonId()).toBe("a");
  });

  it("removes a pokemon without breaking the order", () => {
    const turnManager = new TurnManager([
      pokemon("fast", 90),
      pokemon("medium", 50),
      pokemon("slow", 10),
    ]);

    turnManager.removePokemon("medium");

    expect(turnManager.getCurrentPokemonId()).toBe("fast");
    turnManager.advance();
    expect(turnManager.getCurrentPokemonId()).toBe("slow");
  });

  it("advances automatically when the active pokemon is removed", () => {
    const turnManager = new TurnManager([
      pokemon("fast", 90),
      pokemon("medium", 50),
      pokemon("slow", 10),
    ]);

    expect(turnManager.getCurrentPokemonId()).toBe("fast");
    turnManager.removePokemon("fast");
    expect(turnManager.getCurrentPokemonId()).toBe("medium");
  });

  it("wraps around when removing the last pokemon in order", () => {
    const turnManager = new TurnManager([pokemon("a", 90), pokemon("b", 50)]);

    turnManager.advance();
    expect(turnManager.getCurrentPokemonId()).toBe("b");
    turnManager.removePokemon("b");
    expect(turnManager.getCurrentPokemonId()).toBe("a");
  });

  it("returns the current turn order", () => {
    const turnManager = new TurnManager([pokemon("slow", 10), pokemon("fast", 90)]);

    expect(turnManager.getTurnOrder()).toEqual(["fast", "slow"]);
  });

  it("returns the current index", () => {
    const turnManager = new TurnManager([pokemon("a", 90), pokemon("b", 50)]);

    expect(turnManager.getCurrentIndex()).toBe(0);
    turnManager.advance();
    expect(turnManager.getCurrentIndex()).toBe(1);
  });

  it("ignores removal of non-existent pokemon", () => {
    const turnManager = new TurnManager([pokemon("a", 90), pokemon("b", 50)]);

    turnManager.removePokemon("nonexistent");
    expect(turnManager.getTurnOrder()).toEqual(["a", "b"]);
  });

  it("handles removal when all pokemon are removed", () => {
    const turnManager = new TurnManager([pokemon("a", 90)]);

    turnManager.removePokemon("a");
    expect(turnManager.getTurnOrder()).toEqual([]);
  });

  it("adjusts index when removing a pokemon before the current one", () => {
    const turnManager = new TurnManager([
      pokemon("fast", 90),
      pokemon("medium", 50),
      pokemon("slow", 10),
    ]);

    turnManager.advance();
    turnManager.advance();
    expect(turnManager.getCurrentPokemonId()).toBe("slow");

    turnManager.removePokemon("fast");
    expect(turnManager.getCurrentPokemonId()).toBe("slow");
  });
});
