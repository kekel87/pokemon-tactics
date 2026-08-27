import { describe, expect, it } from "vitest";
import { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import { Weather } from "../enums/weather";
import { MockBattle } from "../testing/mock-battle";
import { MockPokemon } from "../testing/mock-pokemon";
import type { MoveDefinition } from "../types/move-definition";
import { resolveCasterMoveContext } from "./damage-context";

const FLAMETHROWER = {
  id: "flamethrower",
  name: { fr: "Lance-Flammes", en: "Flamethrower" },
  type: PokemonType.Fire,
  category: "physical",
  power: 90,
  accuracy: 100,
  pp: 15,
} as unknown as MoveDefinition;

const BLIZZARD = {
  id: "blizzard",
  name: { fr: "Blizzard", en: "Blizzard" },
  type: PokemonType.Ice,
  category: "special",
  power: 110,
  accuracy: 70,
  pp: 5,
} as unknown as MoveDefinition;

function contextFor(move: MoveDefinition, weather: Weather, overrides = {}) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    position: { x: 2, y: 2 },
    ...overrides,
  });
  const state = MockBattle.stateFrom([attacker], 6, 6);
  state.weather = weather;
  return resolveCasterMoveContext(state, attacker, move, [PokemonType.Normal]);
}

describe("resolveCasterMoveContext", () => {
  it("laisse la fiche intacte et n'annonce aucune cause par temps clair", () => {
    const context = contextFor(FLAMETHROWER, Weather.None);

    expect(context.weatherBpMultiplier).toBe(1);
    expect(context.fieldTerrainBpMultiplier).toBe(1);
    expect(context.weatherAccuracyOverride).toBeUndefined();
    expect(context.causes).toEqual([]);
    expect(context.burnHalvesDamage).toBe(false);
  });

  it("remonte le multiplicateur de puissance du Soleil sur un move Feu, et nomme la cause", () => {
    const context = contextFor(FLAMETHROWER, Weather.Sun);

    expect(context.weatherBpMultiplier).toBeGreaterThan(1);
    expect(context.causes).toEqual([{ kind: "weather", weather: Weather.Sun }]);
  });

  it("remonte la précision imposée par la Neige à Blizzard", () => {
    const context = contextFor(BLIZZARD, Weather.Snow);

    expect(context.weatherAccuracyOverride).toBe(100);
    expect(context.causes).toEqual([{ kind: "weather", weather: Weather.Snow }]);
  });

  it("signale la brûlure sur un move physique", () => {
    const context = contextFor(FLAMETHROWER, Weather.None, {
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
    });

    expect(context.burnHalvesDamage).toBe(true);
  });

  it("ne signale pas la brûlure sur un move spécial", () => {
    const context = contextFor(BLIZZARD, Weather.None, {
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
    });

    expect(context.burnHalvesDamage).toBe(false);
  });
});
