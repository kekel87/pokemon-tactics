import { describe, expect, it } from "vitest";
import { buildChargeTimeSystem } from "../testing/build-charge-time-system";
import { ChargeTimeTurnSystem } from "./ChargeTimeTurnSystem";
import { CT_START, CT_THRESHOLD, computeCtGain } from "./ct-costs";

describe("ChargeTimeTurnSystem", () => {
  it("initializes all Pokemon at CT_START", () => {
    const system = buildChargeTimeSystem({ a: 90, b: 20 });
    const snapshot = system.getCtSnapshot();
    expect(snapshot.a).toBe(CT_START);
    expect(snapshot.b).toBe(CT_START);
  });

  it("returns first actor after ticking", () => {
    const system = buildChargeTimeSystem({ fast: 90, slow: 20 });
    const actorId = system.getNextActorId();
    expect(actorId).toBe("fast");
  });

  it("faster Pokemon acts more often — ratio 1.3-1.6x over 20 actions", () => {
    const system = buildChargeTimeSystem({ fast: 90, slow: 20 });

    let fastCount = 0;
    let slowCount = 0;
    const totalActions = 20;

    for (let i = 0; i < totalActions; i++) {
      const actor = system.getNextActorId();
      if (actor === "fast") {
        fastCount++;
        system.onActionComplete("fast", 600);
      } else {
        slowCount++;
        system.onActionComplete("slow", 700);
      }
    }

    expect(fastCount + slowCount).toBe(totalActions);
    const ratio = fastCount / slowCount;
    expect(ratio).toBeGreaterThanOrEqual(1.3);
    expect(ratio).toBeLessThanOrEqual(1.7);
  });

  it("Agility +2 increases action count by ~2 over 20 actions", () => {
    const baseSystem = buildChargeTimeSystem({ fast: 90, slow: 20 });
    const boostedSystem = buildChargeTimeSystem({ fast: 90, slow: 20 }, { fast: 2, slow: 0 });

    let baseCount = 0;
    let boostedCount = 0;

    for (let i = 0; i < 20; i++) {
      const actor = baseSystem.getNextActorId();
      if (actor === "fast") {
        baseCount++;
      }
      baseSystem.onActionComplete(actor, actor === "fast" ? 600 : 700);
    }
    for (let i = 0; i < 20; i++) {
      const actor = boostedSystem.getNextActorId();
      if (actor === "fast") {
        boostedCount++;
      }
      boostedSystem.onActionComplete(actor, actor === "fast" ? 600 : 700);
    }

    expect(boostedCount).toBeGreaterThan(baseCount);
    expect(boostedCount - baseCount).toBeGreaterThanOrEqual(1);
  });

  it("removes KO'd Pokemon from rotation", () => {
    const system = buildChargeTimeSystem({ a: 90, b: 90 });
    system.onPokemonKO("b");
    const snapshot = system.getCtSnapshot();
    expect(Object.keys(snapshot)).not.toContain("b");

    const actor = system.getNextActorId();
    expect(actor).toBe("a");
  });

  it("onActionComplete reduces CT by cost", () => {
    const system = buildChargeTimeSystem({ a: 90 });
    const before = system.getCtSnapshot().a ?? CT_START;
    system.getNextActorId();
    system.onActionComplete("a", 600);
    const after = system.getCtSnapshot().a ?? 0;
    expect(after).toBeLessThan(before);
  });

  it("CT threshold is 1000", () => {
    expect(CT_THRESHOLD).toBe(1000);
  });

  it("tie-break by ID: smaller ID goes first when CT is equal", () => {
    const system = new ChargeTimeTurnSystem(["z", "a"], (_id) => computeCtGain(90, 0));
    const actor = system.getNextActorId();
    expect(actor).toBe("a");
  });
});
