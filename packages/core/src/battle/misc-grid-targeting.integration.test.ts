import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import { PlayerId } from "../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import { FacingZone, getFacingZone } from "./facing-modifier";

describe("Misc Batch E — grille-problématiques (plan 155)", () => {
  it("Par Ici turns every enemy in range and exposes their back", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["follow-me"],
      currentPp: { "follow-me": 5 },
    });
    const foeA = MockPokemon.fresh(MockPokemon.base, {
      id: "foeA",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      orientation: Direction.South,
    });
    const foeB = MockPokemon.fresh(MockPokemon.base, {
      id: "foeB",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 3 },
      orientation: Direction.North,
    });
    const { engine, state } = buildMoveTestEngine([caster, foeA, foeB]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "follow-me",
      targetPosition: { x: 0, y: 0 },
    });

    // Both foes now face the caster, so a strike from the far side lands on their back.
    expect(getFacingZone({ x: 3, y: 0 }, state.pokemon.get("foeA")!)).toBe(FacingZone.Back);
    expect(getFacingZone({ x: 0, y: 5 }, state.pokemon.get("foeB")!)).toBe(FacingZone.Back);
  });

  it("Poudre Fureur spares a Grass-type enemy but turns the rest", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["rage-powder"],
      currentPp: { "rage-powder": 5 },
    });
    const grassFoe = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "grassFoe",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      orientation: Direction.South,
    });
    const fireFoe = MockPokemon.fresh(MockPokemon.charmander, {
      id: "fireFoe",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 2 },
      orientation: Direction.South,
    });
    const { engine, state } = buildMoveTestEngine([caster, grassFoe, fireFoe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "rage-powder",
      targetPosition: { x: 0, y: 0 },
    });

    const drew = result.events.find((event) => event.type === BattleEventType.DrewAttention);
    expect(drew).toEqual(expect.objectContaining({ casterId: "caster", affectedIds: ["fireFoe"] }));
    expect(state.pokemon.get("grassFoe")?.orientation).toBe(Direction.South);
  });

  it("Après Vous makes a slow ally act before a faster enemy", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["after-you"],
      currentPp: { "after-you": 5 },
    });
    const slowAlly = MockPokemon.fresh(MockPokemon.base, {
      id: "slowAlly",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 5 },
    });
    const fastFoe = MockPokemon.fresh(MockPokemon.base, {
      id: "fastFoe",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 250 },
    });
    const { engine, state } = buildMoveTestEngine([caster, slowAlly, fastFoe]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "after-you",
      targetPosition: { x: 1, y: 0 },
    });
    // The caster ends its turn; the promoted ally must jump the queue ahead of the faster foe.
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "caster",
      direction: Direction.South,
    });

    expect(state.activePokemonId).toBe("slowAlly");
  });

  it("Interversion swaps the caster and its ally on the grid", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["ally-switch"],
      currentPp: { "ally-switch": 5 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 0 },
    });
    const { engine, state } = buildMoveTestEngine([caster, ally]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "ally-switch",
      targetPosition: { x: 3, y: 0 },
    });

    expect(state.pokemon.get("caster")?.position).toEqual({ x: 3, y: 0 });
    expect(state.pokemon.get("ally")?.position).toEqual({ x: 0, y: 0 });
  });
});
