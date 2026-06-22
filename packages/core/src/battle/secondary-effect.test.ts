import { describe, expect, it } from "vitest";
import { EffectKind } from "../enums/effect-kind";
import { EffectTarget } from "../enums/effect-target";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { MockMove } from "../testing";
import type { Effect } from "../types/effect";
import { isSecondaryEffect, moveHasSecondaryEffect } from "./secondary-effect";

const statusSecondary: Effect = {
  kind: EffectKind.Status,
  status: StatusType.Flinch,
  chance: 30,
};
const statusGuaranteed: Effect = {
  kind: EffectKind.Status,
  status: StatusType.Burned,
  chance: 100,
};
const statusSelf: Effect = {
  kind: EffectKind.Status,
  status: StatusType.Confused,
  chance: 30,
  target: EffectTarget.Self,
};
const statChangeSecondary: Effect = {
  kind: EffectKind.StatChange,
  stat: StatName.Defense,
  stages: -1,
  target: EffectTarget.Targets,
  chance: 30,
};
const statChangeSelf: Effect = {
  kind: EffectKind.StatChange,
  stat: StatName.Attack,
  stages: 1,
  target: EffectTarget.Self,
  chance: 30,
};
const statChangeGuaranteed: Effect = {
  kind: EffectKind.StatChange,
  stat: StatName.Defense,
  stages: -1,
  target: EffectTarget.Targets,
};
const damage: Effect = { kind: EffectKind.Damage };

describe("isSecondaryEffect", () => {
  it("flags a chance-based opponent status on a damaging move", () => {
    expect(isSecondaryEffect(statusSecondary, true)).toBe(true);
  });

  it("does not flag any effect on a non-damaging move", () => {
    expect(isSecondaryEffect(statusSecondary, false)).toBe(false);
    expect(isSecondaryEffect(statChangeSecondary, false)).toBe(false);
  });

  it("does not flag a self-targeted effect", () => {
    expect(isSecondaryEffect(statusSelf, true)).toBe(false);
    expect(isSecondaryEffect(statChangeSelf, true)).toBe(false);
  });

  it("does not flag a guaranteed (100%) effect", () => {
    expect(isSecondaryEffect(statusGuaranteed, true)).toBe(false);
    expect(isSecondaryEffect(statChangeGuaranteed, true)).toBe(false);
  });

  it("flags a chance-based opponent stat drop on a damaging move", () => {
    expect(isSecondaryEffect(statChangeSecondary, true)).toBe(true);
  });

  it("does not flag a non-status, non-stat effect", () => {
    expect(isSecondaryEffect(damage, true)).toBe(false);
  });
});

describe("moveHasSecondaryEffect", () => {
  it("is true for a damaging move carrying a secondary", () => {
    const move = MockMove.fresh(MockMove.physical, { effects: [damage, statusSecondary] });
    expect(moveHasSecondaryEffect(move)).toBe(true);
  });

  it("is false for a damaging move with no secondary", () => {
    const move = MockMove.fresh(MockMove.physical, { effects: [damage] });
    expect(moveHasSecondaryEffect(move)).toBe(false);
  });

  it("is false for a status move even when it inflicts a status", () => {
    const move = MockMove.fresh(MockMove.status, { effects: [statusSecondary] });
    expect(moveHasSecondaryEffect(move)).toBe(false);
  });

  it("is false when the only extra effect is a self boost", () => {
    const move = MockMove.fresh(MockMove.physical, { effects: [damage, statChangeSelf] });
    expect(moveHasSecondaryEffect(move)).toBe(false);
  });
});
