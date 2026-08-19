import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup(casterHp: number) {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["steel-beam"],
    currentPp: { "steel-beam": 5 },
    currentHp: casterHp,
    maxHp: 100,
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    maxHp: 500,
    currentHp: 500,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([caster, foe]);
}

describe("steel-beam", () => {
  // Métalaser a une précision de 95 : sans épingler l'aléa, ces tests manquent leur cible ~5 % des
  // exécutions (le moteur retombe sur Math.random quand le harnais ne reçoit pas de `random`).
  // 0.5 touche (50 < 95), ne critique pas, et donne un jet de dégâts médian.
  function pinRandom() {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deals damage and recoils 50% of the caster's max HP", () => {
    pinRandom();
    const { engine, state } = setup(100);
    const foeHpBefore = state.pokemon.get("foe")?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "steel-beam",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBeLessThan(foeHpBefore);
    expect(state.pokemon.get("caster")?.currentHp).toBe(50);
  });

  it("can down the caster through recoil", () => {
    pinRandom();
    const { engine, state } = setup(40);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "steel-beam",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get("caster")?.currentHp).toBe(0);
  });
});
