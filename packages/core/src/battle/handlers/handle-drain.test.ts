import { describe, expect, it } from "vitest";
import { BattleEventType } from "../../enums/battle-event-type";
import { EffectKind } from "../../enums/effect-kind";
import { MockBattle, MockMove, MockPokemon } from "../../testing";
import type { EffectContext, SharedEffectState, TypeChart } from "../effect-handler-registry";
import { handleDrain } from "./handle-drain";

function contextWith(lastDamageDealt: number, currentHp: number, maxHp: number): EffectContext {
  const attacker = MockPokemon.fresh(MockBattle.player1Fast);
  attacker.maxHp = maxHp;
  attacker.currentHp = currentHp;

  const target = MockPokemon.fresh(MockBattle.player2Slow);
  const state = MockBattle.stateFrom([attacker, target]);
  const move = MockMove.fresh(MockMove.physical, {
    effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Drain, fraction: 0.5 }],
  });
  const shared: SharedEffectState = { lastDamageDealt };

  return {
    attacker,
    targets: [target],
    move,
    effect: { kind: EffectKind.Drain, fraction: 0.5 },
    state,
    typeChart: {} as TypeChart,
    attackerTypes: [],
    targetTypesMap: new Map(),
    shared,
  } as unknown as EffectContext;
}

describe("handleDrain", () => {
  it("heals attacker for fraction of last damage dealt", () => {
    const context = contextWith(80, 50, 200);

    const events = handleDrain(context);

    expect(context.attacker.currentHp).toBe(90);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: BattleEventType.HpRestored,
      pokemonId: context.attacker.id,
      amount: 40,
    });
  });

  it("caps healing at maxHp", () => {
    const context = contextWith(80, 195, 200);

    const events = handleDrain(context);

    expect(context.attacker.currentHp).toBe(200);
    expect(events[0]).toMatchObject({ amount: 5 });
  });

  it("returns no event when attacker already at full HP", () => {
    const context = contextWith(80, 200, 200);

    const events = handleDrain(context);

    expect(events).toHaveLength(0);
    expect(context.attacker.currentHp).toBe(200);
  });

  it("returns no event when last damage was 0", () => {
    const context = contextWith(0, 50, 200);

    const events = handleDrain(context);

    expect(events).toHaveLength(0);
    expect(context.attacker.currentHp).toBe(50);
  });

  it("heals at least 1 HP when fraction × damage rounds to 0", () => {
    const context = contextWith(1, 50, 200);
    (context.effect as { fraction: number }).fraction = 0.1;

    const events = handleDrain(context);

    expect(context.attacker.currentHp).toBe(51);
    expect(events[0]).toMatchObject({ amount: 1 });
  });
});
