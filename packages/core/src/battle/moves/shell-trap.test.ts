import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { ChargeReaction } from "../../enums/charge-reaction";
import { MoveFailedReason } from "../../enums/move-failed-reason";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup() {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["shell-trap", "tackle"],
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([attacker, defender]);
}

function useShellTrap(engine: ReturnType<typeof setup>["engine"]) {
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: "attacker",
    moveId: "shell-trap",
    targetPosition: { x: 1, y: 0 },
  });
}

describe("shell-trap", () => {
  it("sets the trap on the first turn with the shell reaction", () => {
    const { engine, state } = setup();
    const result = useShellTrap(engine);

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.MoveCharging);
    expect(state.pokemon.get("attacker")?.chargingMove?.reaction).toBe(ChargeReaction.Shell);
  });

  it("detonates on the second turn once armed by a physical hit", () => {
    const { engine, state } = setup();
    const attacker = state.pokemon.get("attacker");
    if (attacker) {
      attacker.chargingMove = { moveId: "shell-trap", reaction: ChargeReaction.Shell };
      attacker.shellTrapArmed = true;
    }
    const hpBefore = state.pokemon.get("defender")?.currentHp ?? 0;

    const result = useShellTrap(engine);

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("defender")?.currentHp).toBeLessThan(hpBefore);
    expect(state.pokemon.get("attacker")?.shellTrapArmed).toBeUndefined();
  });

  it("fizzles on the second turn when never armed", () => {
    const { engine, state } = setup();
    const attacker = state.pokemon.get("attacker");
    if (attacker) {
      attacker.chargingMove = { moveId: "shell-trap", reaction: ChargeReaction.Shell };
    }
    const hpBefore = state.pokemon.get("defender")?.currentHp ?? 0;

    const result = useShellTrap(engine);

    const failed = result.events.find((event) => event.type === BattleEventType.MoveFailed);
    expect(failed).toBeDefined();
    expect(failed && "reason" in failed ? failed.reason : undefined).toBe(
      MoveFailedReason.ShellTrap,
    );
    expect(result.events.map((event) => event.type)).not.toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("defender")?.currentHp).toBe(hpBefore);
  });
});
