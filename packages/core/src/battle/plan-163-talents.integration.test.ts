import { abilityHandlers } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { HeldItemId } from "../enums/held-item-id";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { Weather } from "../enums/weather";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import type { PokemonInstance } from "../types/pokemon-instance";
import { effectiveAbilityId } from "./effective-ability";
import { effectiveBaseSpeed } from "./effective-base-speed";
import { consumeHeldItem } from "./held-item-transfer";

function setup(playerOverrides: Partial<PokemonInstance>, foeOverrides: Partial<PokemonInstance>) {
  const player = MockPokemon.fresh(MockPokemon.base, {
    id: "player",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    derivedStats: { movement: 4, jump: 1, initiative: 100 },
    ...playerOverrides,
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    derivedStats: { movement: 4, jump: 1, initiative: 10 },
    ...foeOverrides,
  });
  return buildMoveTestEngine([player, foe]);
}

describe("Piège Sable (arena-trap)", () => {
  it("blocks a grounded adjacent enemy from moving", () => {
    const { engine } = setup({ abilityId: "guts" }, { abilityId: "arena-trap" });
    const actions = engine.getLegalActions(PlayerId.Player1);
    expect(actions.some((action) => action.kind === ActionKind.Move)).toBe(false);
  });

  it("does not trap a Flying-type (airborne) enemy", () => {
    const { engine } = setup(
      { abilityId: "guts", typeOverride: [PokemonType.Flying] },
      { abilityId: "arena-trap" },
    );
    const actions = engine.getLegalActions(PlayerId.Player1);
    expect(actions.some((action) => action.kind === ActionKind.Move)).toBe(true);
  });

  it("does not trap a Fuite (run-away) holder", () => {
    const { engine } = setup({ abilityId: "run-away" }, { abilityId: "arena-trap" });
    const actions = engine.getLegalActions(PlayerId.Player1);
    expect(actions.some((action) => action.kind === ActionKind.Move)).toBe(true);
  });

  it("does not trap when the arena-trap holder is two tiles away", () => {
    const { engine } = setup(
      { abilityId: "guts" },
      { abilityId: "arena-trap", position: { x: 2, y: 0 } },
    );
    const actions = engine.getLegalActions(PlayerId.Player1);
    expect(actions.some((action) => action.kind === ActionKind.Move)).toBe(true);
  });
});

describe("Gaz Inhibiteur (neutralizing-gas)", () => {
  it("suppresses an enemy ability within r2", () => {
    const { state } = setup(
      { abilityId: "neutralizing-gas" },
      { abilityId: "overgrow", position: { x: 2, y: 0 } },
    );
    expect(state.pokemon.get("foe")?.abilitySuppressedByGas).toBe(true);
    expect(effectiveAbilityId(state.pokemon.get("foe")!)).toBeUndefined();
  });

  it("does not suppress beyond r2", () => {
    const { state } = setup(
      { abilityId: "neutralizing-gas" },
      { abilityId: "overgrow", position: { x: 4, y: 4 } },
    );
    expect(state.pokemon.get("foe")?.abilitySuppressedByGas).toBeUndefined();
    expect(effectiveAbilityId(state.pokemon.get("foe")!)).toBe("overgrow");
  });

  it("never suppresses its own gas", () => {
    const { state } = setup(
      { abilityId: "neutralizing-gas" },
      { abilityId: "neutralizing-gas", position: { x: 2, y: 0 } },
    );
    expect(effectiveAbilityId(state.pokemon.get("foe")!)).toBe("neutralizing-gas");
  });
});

describe("Délestage (unburden)", () => {
  it("doubles Speed once the item is consumed and reverts nothing until regained", () => {
    const mon = MockPokemon.fresh(MockPokemon.base, {
      abilityId: "unburden",
      heldItemId: HeldItemId.Leftovers,
    });
    const baseSpeed = effectiveBaseSpeed(mon);

    consumeHeldItem(mon);

    expect(mon.unburdenActive).toBe(true);
    expect(effectiveBaseSpeed(mon)).toBe(baseSpeed * 2);
  });

  it("does not trigger for a non-unburden holder", () => {
    const mon = MockPokemon.fresh(MockPokemon.base, {
      abilityId: "guts",
      heldItemId: HeldItemId.Leftovers,
    });
    consumeHeldItem(mon);
    expect(mon.unburdenActive).toBeUndefined();
  });
});

describe("Récolte (harvest)", () => {
  it("restores a consumed berry at end of turn (guaranteed under Sun)", () => {
    const harvest = abilityHandlers.find((handler) => handler.id === "harvest");
    const { state } = setup({ abilityId: "harvest" }, {});
    const mon = state.pokemon.get("player")!;
    mon.heldItemId = undefined;
    mon.consumedItemId = HeldItemId.SitrusBerry;

    harvest?.onEndTurn?.({ self: mon, state, random: () => 0.9, weather: Weather.Sun });

    expect(mon.heldItemId).toBe(HeldItemId.SitrusBerry);
  });

  it("does not restore a non-berry item", () => {
    const harvest = abilityHandlers.find((handler) => handler.id === "harvest");
    const { state } = setup({ abilityId: "harvest" }, {});
    const mon = state.pokemon.get("player")!;
    mon.heldItemId = undefined;
    mon.consumedItemId = HeldItemId.LifeOrb;

    harvest?.onEndTurn?.({ self: mon, state, random: () => 0, weather: Weather.Sun });

    expect(mon.heldItemId).toBeUndefined();
  });
});

describe("info-reveal abilities", () => {
  it("Fouille (frisk) reveals the enemy's item", () => {
    const { state } = setup(
      { abilityId: "frisk" },
      { abilityId: "guts", heldItemId: HeldItemId.Leftovers },
    );
    expect(state.pokemon.get("foe")?.revealedItem).toBe(true);
  });

  it("Prédiction (forewarn) flags the enemy's strongest move", () => {
    const { state } = setup({ abilityId: "forewarn" }, { abilityId: "guts" });
    expect(state.pokemon.get("foe")?.revealedTopMove).toBe(true);
  });

  it("Anticipation reveals the enemy's ability", () => {
    const { state } = setup({ abilityId: "anticipation" }, { abilityId: "guts" });
    expect(state.pokemon.get("foe")?.revealedAbility).toBe(true);
  });
});
