import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { PokemonInstance } from "../../types/pokemon-instance";

function setup(defenderOverrides: Partial<PokemonInstance> = {}) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["upper-hand"],
    currentPp: { "upper-hand": 15 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
    ...defenderOverrides,
  });
  return buildMoveTestEngine([attacker, defender]);
}

function useUpperHand(engine: ReturnType<typeof setup>["engine"]) {
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: "attacker",
    moveId: "upper-hand",
    targetPosition: { x: 1, y: 0 },
  });
}

describe("upper-hand", () => {
  it("hits and flinches when the target's last action was offensive", () => {
    const { engine, state } = setup({ lastActedAtAction: 5, lastOffensiveActionAtAction: 5 });

    const result = useUpperHand(engine);

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("defender")?.volatileStatuses).toContainEqual(
      expect.objectContaining({ type: StatusType.Flinch }),
    );
  });

  it("fizzles when the target was not aggressive", () => {
    const { engine } = setup();

    const result = useUpperHand(engine);

    expect(result.events.map((event) => event.type)).toContain(BattleEventType.MoveFailed);
    expect(result.events.map((event) => event.type)).not.toContain(BattleEventType.DamageDealt);
  });
});
