import { describe, expect, it } from "vitest";
import { BattleEventType } from "../../enums/battle-event-type";
import { DefensiveKind } from "../../enums/defensive-kind";
import { EffectKind } from "../../enums/effect-kind";
import { MockBattle, MockMove, MockPokemon } from "../../testing";
import type { EffectContext, TypeChart } from "../effect-handler-registry";
import { handleDefensive } from "./handle-defensive";

function contextFor(defenseKind: DefensiveKind): EffectContext {
  const attacker = MockPokemon.fresh(MockBattle.player1Fast);
  const state = MockBattle.stateFrom([attacker]);
  const move = MockMove.fresh(MockMove.status, {
    effects: [{ kind: EffectKind.Defensive, defenseKind }],
  });
  return {
    attacker,
    targets: [attacker],
    move,
    effect: { kind: EffectKind.Defensive, defenseKind },
    state,
    typeChart: {} as TypeChart,
    attackerTypes: [],
    targetTypesMap: new Map(),
  };
}

describe("handleDefensive", () => {
  it("sets activeDefense on the attacker", () => {
    const context = contextFor(DefensiveKind.Protect);
    handleDefensive(context);

    expect(context.attacker.activeDefense).toEqual({
      kind: DefensiveKind.Protect,
      appliedAtAction: 0,
    });
  });

  it("emits DefenseActivated event", () => {
    const context = contextFor(DefensiveKind.Detect);
    const events = handleDefensive(context);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: BattleEventType.DefenseActivated,
      pokemonId: context.attacker.id,
      defenseKind: DefensiveKind.Detect,
    });
  });

  it("overwrites existing activeDefense", () => {
    const context = contextFor(DefensiveKind.Counter);
    context.attacker.activeDefense = {
      kind: DefensiveKind.Protect,
      appliedAtAction: 0,
    };

    handleDefensive(context);

    expect(context.attacker.activeDefense?.kind).toBe(DefensiveKind.Counter);
  });

  it("stamps appliedAtAction from the action clock", () => {
    const context = contextFor(DefensiveKind.Endure);
    context.state.actionCounter = 3;

    handleDefensive(context);

    expect(context.attacker.activeDefense).toEqual({
      kind: DefensiveKind.Endure,
      appliedAtAction: 3,
    });
  });

  describe("Endure spam check", () => {
    it("sets lastEndureAtAction on Endure", () => {
      const context = contextFor(DefensiveKind.Endure);
      context.state.actionCounter = 2;

      handleDefensive(context);

      expect(context.attacker.lastEndureAtAction).toBe(2);
    });

    it("blocks Endure when used on the immediately consecutive turn", () => {
      const context = contextFor(DefensiveKind.Endure);
      context.state.actionCounter = 3;
      // lastEndureAtAction matching the previous-turn stamp means it was used last turn.
      context.attacker.lastActedAtAction = 2;
      context.attacker.lastEndureAtAction = 2;

      const events = handleDefensive(context);

      expect(events).toHaveLength(0);
      expect(context.attacker.activeDefense).toBeNull();
    });

    it("allows Endure again once the user has acted on another turn since", () => {
      const context = contextFor(DefensiveKind.Endure);
      context.state.actionCounter = 5;
      context.attacker.lastActedAtAction = 4;
      context.attacker.lastEndureAtAction = 2;

      const events = handleDefensive(context);

      expect(events).toHaveLength(1);
      expect(context.attacker.activeDefense?.kind).toBe(DefensiveKind.Endure);
    });

    it("does not set lastEndureAtAction for non-Endure moves", () => {
      const context = contextFor(DefensiveKind.Protect);
      handleDefensive(context);

      expect(context.attacker.lastEndureAtAction).toBeNull();
    });
  });
});
