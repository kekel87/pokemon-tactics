import type { MoveDefinition } from "@pokemon-tactic/core";
import {
  EffectKind,
  EffectTarget,
  FIELD_TERRAIN_RADIUS,
  FieldTerrain,
  StatName,
  StatusType,
} from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { moveIntent, selfPreviewRadius } from "./move-intent.js";

function move(effects: MoveDefinition["effects"]): MoveDefinition {
  return { effects } as unknown as MoveDefinition;
}

describe("moveIntent", () => {
  it("classifies a damaging move as attack", () => {
    expect(moveIntent(move([{ kind: EffectKind.Damage }]))).toBe("attack");
  });

  it("classifies a damaging move that also drains as attack", () => {
    expect(
      moveIntent(move([{ kind: EffectKind.Damage }, { kind: EffectKind.Drain, fraction: 0.5 }])),
    ).toBe("attack");
  });

  it("classifies a non-damaging heal move as heal", () => {
    expect(moveIntent(move([{ kind: EffectKind.HealSelf, percent: 0.5 }]))).toBe("heal");
    expect(moveIntent(move([{ kind: EffectKind.HealTarget, percent: 0.25, radius: 2 }]))).toBe(
      "heal",
    );
    expect(moveIntent(move([{ kind: EffectKind.CureTeamStatus, radius: 1 }]))).toBe("heal");
  });

  it("classifies a status move as attack", () => {
    expect(
      moveIntent(move([{ kind: EffectKind.Status, status: StatusType.Poisoned, chance: 100 }])),
    ).toBe("attack");
  });

  it("classifies a target stat drop as attack", () => {
    expect(
      moveIntent(
        move([
          {
            kind: EffectKind.StatChange,
            stat: StatName.Attack,
            stages: -1,
            target: EffectTarget.Targets,
          },
        ]),
      ),
    ).toBe("attack");
  });

  it("classifies a phazing move as attack", () => {
    expect(moveIntent(move([{ kind: EffectKind.PhazeToSpawn }]))).toBe("attack");
    expect(moveIntent(move([{ kind: EffectKind.Damage }, { kind: EffectKind.PhazeToSpawn }]))).toBe(
      "attack",
    );
  });

  it("classifies a self stat boost as buff", () => {
    expect(
      moveIntent(
        move([
          {
            kind: EffectKind.StatChange,
            stat: StatName.Attack,
            stages: 2,
            target: EffectTarget.Self,
          },
        ]),
      ),
    ).toBe("buff");
  });
});

describe("selfPreviewRadius", () => {
  it("returns the heal radius", () => {
    expect(
      selfPreviewRadius(move([{ kind: EffectKind.HealTarget, percent: 0.25, radius: 2 }])),
    ).toBe(2);
  });

  it("returns the cure radius", () => {
    expect(selfPreviewRadius(move([{ kind: EffectKind.CureTeamStatus, radius: 3 }]))).toBe(3);
  });

  it("returns the field terrain radius", () => {
    expect(
      selfPreviewRadius(
        move([{ kind: EffectKind.PostFieldTerrain, terrain: FieldTerrain.Grassy }]),
      ),
    ).toBe(FIELD_TERRAIN_RADIUS);
  });

  it("returns the ally stat-buff radius (howl / magnetic-flux)", () => {
    expect(
      selfPreviewRadius(
        move([
          {
            kind: EffectKind.StatChange,
            stat: StatName.Attack,
            stages: 1,
            target: EffectTarget.Self,
            radius: 2,
          },
        ]),
      ),
    ).toBe(2);
  });

  it("returns undefined for a single-tile self move", () => {
    expect(
      selfPreviewRadius(
        move([
          {
            kind: EffectKind.StatChange,
            stat: StatName.Attack,
            stages: 1,
            target: EffectTarget.Self,
          },
        ]),
      ),
    ).toBeUndefined();
  });
});
