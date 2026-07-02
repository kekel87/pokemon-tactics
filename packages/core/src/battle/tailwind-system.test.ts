import { describe, expect, it } from "vitest";
import { Direction } from "../enums/direction";
import { PlayerId } from "../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import {
  decrementTailwindTimer,
  setTailwind,
  TAILWIND_DEFAULT_DURATION,
  TAILWIND_SPEED_MULTIPLIER,
  tailwindSpeedMultiplier,
} from "./tailwind-system";

function freshState() {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 5 },
    orientation: Direction.East,
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 9, y: 9 },
    orientation: Direction.West,
  });
  return buildMoveTestEngine([caster, foe], { gridSize: 10 });
}

describe("setTailwind", () => {
  it("sets a single wind owned by the caster, blowing in the chosen direction", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    if (!caster) {
      throw new Error("missing caster");
    }
    setTailwind(state, caster, Direction.East);
    expect(state.tailwind).toEqual({
      direction: Direction.East,
      remainingTurns: TAILWIND_DEFAULT_DURATION,
      setterPokemonId: "caster",
    });
  });

  it("replaces the active wind on re-cast", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    const foe = state.pokemon.get("foe");
    if (!caster || !foe) {
      throw new Error("missing mons");
    }
    setTailwind(state, caster, Direction.East);
    state.tailwind!.remainingTurns = 1;
    setTailwind(state, foe, Direction.North);
    expect(state.tailwind?.direction).toBe(Direction.North);
    expect(state.tailwind?.setterPokemonId).toBe("foe");
    expect(state.tailwind?.remainingTurns).toBe(TAILWIND_DEFAULT_DURATION);
  });
});

describe("tailwindSpeedMultiplier", () => {
  it("boosts a mon aligned with the wind and leaves others unchanged", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    const foe = state.pokemon.get("foe");
    if (!caster || !foe) {
      throw new Error("missing mons");
    }
    setTailwind(state, caster, Direction.East);
    expect(tailwindSpeedMultiplier(state, caster)).toBe(TAILWIND_SPEED_MULTIPLIER);
    expect(tailwindSpeedMultiplier(state, foe)).toBe(1);
  });

  it("returns 1 with no active wind", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    if (!caster) {
      throw new Error("missing caster");
    }
    expect(tailwindSpeedMultiplier(state, caster)).toBe(1);
  });
});

describe("decrementTailwindTimer — setter turns only", () => {
  it("only decrements on the setter's own turn", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    if (!caster) {
      throw new Error("missing caster");
    }
    setTailwind(state, caster, Direction.East);
    expect(decrementTailwindTimer(state, "foe")).toBe(false);
    expect(state.tailwind?.remainingTurns).toBe(TAILWIND_DEFAULT_DURATION);
    expect(decrementTailwindTimer(state, "caster")).toBe(false);
    expect(state.tailwind?.remainingTurns).toBe(TAILWIND_DEFAULT_DURATION - 1);
  });

  it("clears the wind and reports expiry when it reaches zero", () => {
    const { state } = freshState();
    const caster = state.pokemon.get("caster");
    if (!caster) {
      throw new Error("missing caster");
    }
    setTailwind(state, caster, Direction.East);
    let expired = false;
    for (let i = 0; i < TAILWIND_DEFAULT_DURATION; i++) {
      expired = decrementTailwindTimer(state, "caster");
    }
    expect(expired).toBe(true);
    expect(state.tailwind).toBeUndefined();
  });
});
