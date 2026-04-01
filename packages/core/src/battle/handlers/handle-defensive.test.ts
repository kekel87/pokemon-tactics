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
      roundApplied: 1,
      turnIndexApplied: 0,
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
      roundApplied: 1,
      turnIndexApplied: 0,
    };

    handleDefensive(context);

    expect(context.attacker.activeDefense?.kind).toBe(DefensiveKind.Counter);
  });

  it("records correct round and turnIndex from state", () => {
    const context = contextFor(DefensiveKind.Endure);
    context.state.roundNumber = 3;
    context.state.currentTurnIndex = 2;

    handleDefensive(context);

    expect(context.attacker.activeDefense).toEqual({
      kind: DefensiveKind.Endure,
      roundApplied: 3,
      turnIndexApplied: 2,
    });
  });

  describe("Endure spam check", () => {
    it("sets lastEndureRound on Endure", () => {
      const context = contextFor(DefensiveKind.Endure);
      context.state.roundNumber = 2;

      handleDefensive(context);

      expect(context.attacker.lastEndureRound).toBe(2);
    });

    it("blocks Endure if used on consecutive round", () => {
      const context = contextFor(DefensiveKind.Endure);
      context.state.roundNumber = 3;
      context.attacker.lastEndureRound = 2;

      const events = handleDefensive(context);

      expect(events).toHaveLength(0);
      expect(context.attacker.activeDefense).toBeNull();
    });

    it("allows Endure if gap of 2+ rounds", () => {
      const context = contextFor(DefensiveKind.Endure);
      context.state.roundNumber = 4;
      context.attacker.lastEndureRound = 2;

      const events = handleDefensive(context);

      expect(events).toHaveLength(1);
      expect(context.attacker.activeDefense?.kind).toBe(DefensiveKind.Endure);
    });

    it("does not set lastEndureRound for non-Endure moves", () => {
      const context = contextFor(DefensiveKind.Protect);
      handleDefensive(context);

      expect(context.attacker.lastEndureRound).toBeNull();
    });
  });
});
