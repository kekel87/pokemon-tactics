import { describe, expect, it } from "vitest";
import { BattleEventType } from "../enums/battle-event-type";
import { EffectKind } from "../enums/effect-kind";
import { StatusType } from "../enums/status-type";
import type { BattleEvent } from "../types/battle-event";
import type { EffectContext } from "./effect-handler-registry";
import { EffectHandlerRegistry } from "./effect-handler-registry";

const baseContext: EffectContext = {
  attacker: {} as EffectContext["attacker"],
  targets: [],
  move: { effects: [] } as unknown as EffectContext["move"],
  effect: { kind: EffectKind.Damage } as EffectContext["effect"],
  state: {} as unknown as EffectContext["state"],
  typeChart: {} as EffectContext["typeChart"],
  attackerTypes: [],
  targetTypesMap: new Map(),
};

describe("EffectHandlerRegistry", () => {
  it("returns empty events when no handler is registered for the effect kind", () => {
    const registry = new EffectHandlerRegistry();

    const events = registry.process(baseContext);

    expect(events).toEqual([]);
  });

  it("calls the registered handler and returns its events", () => {
    const registry = new EffectHandlerRegistry();
    const expectedEvent: BattleEvent = {
      type: BattleEventType.DamageDealt,
      targetId: "target-1",
      amount: 10,
      effectiveness: 1,
    };
    registry.register(EffectKind.Damage, () => [expectedEvent]);

    const events = registry.process(baseContext);

    expect(events).toEqual([expectedEvent]);
  });

  it("dispatches to the correct handler based on effect kind", () => {
    const registry = new EffectHandlerRegistry();
    const damageEvent: BattleEvent = {
      type: BattleEventType.DamageDealt,
      targetId: "t1",
      amount: 5,
      effectiveness: 1,
    };
    const statusEvent: BattleEvent = {
      type: BattleEventType.StatusApplied,
      targetId: "t2",
      status: StatusType.Burned,
    };
    registry.register(EffectKind.Damage, () => [damageEvent]);
    registry.register(EffectKind.Status, () => [statusEvent]);

    const damageContext: EffectContext = {
      ...baseContext,
      effect: { kind: EffectKind.Damage },
    };
    const statusContext: EffectContext = {
      ...baseContext,
      effect: {
        kind: EffectKind.Status,
        status: StatusType.Burned,
        chance: 100,
      } as EffectContext["effect"],
    };

    expect(registry.process(damageContext)).toEqual([damageEvent]);
    expect(registry.process(statusContext)).toEqual([statusEvent]);
  });

  it("reports whether a handler is registered via has()", () => {
    const registry = new EffectHandlerRegistry();
    registry.register(EffectKind.Damage, () => []);

    expect(registry.has(EffectKind.Damage)).toBe(true);
    expect(registry.has(EffectKind.Status)).toBe(false);
  });
});
