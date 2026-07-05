import { describe, expect, it } from "vitest";
import { BattleEventType } from "../enums/battle-event-type";
import { Category } from "../enums/category";
import { ChargeReaction } from "../enums/charge-reaction";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import { MockMove, MockPokemon } from "../testing";
import { applyChargeReaction } from "./charge-reaction";

function charging(reaction: ChargeReaction) {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "victim",
    playerId: PlayerId.Player1,
    chargingMove: { moveId: "focus-punch", reaction },
  });
}

function attacker() {
  return MockPokemon.fresh(MockPokemon.base, { id: "attacker", playerId: PlayerId.Player2 });
}

const contactMove = MockMove.fresh(MockMove.physical, { flags: { contact: true } });
const rangedPhysical = MockMove.fresh(MockMove.physical, { flags: { contact: false } });

describe("applyChargeReaction", () => {
  it("returns nothing when the victim is not charging a reactive move", () => {
    const victim = MockPokemon.fresh(MockPokemon.base, { id: "victim" });
    const events = applyChargeReaction({
      victim,
      attacker: attacker(),
      attackerMove: contactMove,
      attackerTypes: [PokemonType.Normal],
    });
    expect(events).toHaveLength(0);
    expect(victim.focusInterrupted).toBeUndefined();
  });

  it("focus: any direct hit interrupts the charge once", () => {
    const victim = charging(ChargeReaction.Focus);
    const first = applyChargeReaction({
      victim,
      attacker: attacker(),
      attackerMove: rangedPhysical,
      attackerTypes: [PokemonType.Normal],
    });
    expect(victim.focusInterrupted).toBe(true);
    expect(first.map((event) => event.type)).toContain(BattleEventType.FocusInterrupted);

    const second = applyChargeReaction({
      victim,
      attacker: attacker(),
      attackerMove: rangedPhysical,
      attackerTypes: [PokemonType.Normal],
    });
    expect(second).toHaveLength(0);
  });

  it("beak: burns a contact attacker without interrupting the charge", () => {
    const victim = charging(ChargeReaction.Beak);
    const striker = attacker();
    const events = applyChargeReaction({
      victim,
      attacker: striker,
      attackerMove: contactMove,
      attackerTypes: [PokemonType.Normal],
    });
    expect(events.map((event) => event.type)).toContain(BattleEventType.BeakBlastBurn);
    expect(striker.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Burned }),
    );
    expect(victim.focusInterrupted).toBeUndefined();
  });

  it("beak: a non-contact attacker is not burned", () => {
    const victim = charging(ChargeReaction.Beak);
    const striker = attacker();
    const events = applyChargeReaction({
      victim,
      attacker: striker,
      attackerMove: rangedPhysical,
      attackerTypes: [PokemonType.Normal],
    });
    expect(events).toHaveLength(0);
    expect(striker.statusEffects).toHaveLength(0);
  });

  it("beak: a Fire-type contact attacker is immune to the burn", () => {
    const victim = charging(ChargeReaction.Beak);
    const striker = attacker();
    const events = applyChargeReaction({
      victim,
      attacker: striker,
      attackerMove: contactMove,
      attackerTypes: [PokemonType.Fire],
    });
    expect(events).toHaveLength(0);
    expect(striker.statusEffects).toHaveLength(0);
  });

  it("shell: arms on a physical hit, stays disarmed on a special hit", () => {
    const physicalVictim = charging(ChargeReaction.Shell);
    const armed = applyChargeReaction({
      victim: physicalVictim,
      attacker: attacker(),
      attackerMove: rangedPhysical,
      attackerTypes: [PokemonType.Normal],
    });
    expect(physicalVictim.shellTrapArmed).toBe(true);
    expect(armed.map((event) => event.type)).toContain(BattleEventType.ShellTrapArmed);

    const specialVictim = charging(ChargeReaction.Shell);
    const notArmed = applyChargeReaction({
      victim: specialVictim,
      attacker: attacker(),
      attackerMove: MockMove.fresh(MockMove.special, { category: Category.Special }),
      attackerTypes: [PokemonType.Normal],
    });
    expect(specialVictim.shellTrapArmed).toBeUndefined();
    expect(notArmed).toHaveLength(0);
  });
});
