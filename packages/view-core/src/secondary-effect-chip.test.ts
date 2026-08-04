import type { MoveDefinition } from "@pokemon-tactic/core";
import { Category, EffectKind, PokemonType, StatName, TargetingKind } from "@pokemon-tactic/core";
import type { PresentationContext } from "@pokemon-tactic/render-ports";
import { describe, expect, it } from "vitest";
import { buildSecondaryEffectChip } from "./secondary-effect-chip.js";

const context = {
  translate: (key: string) => key,
  getStatusIconUrl: (kind: string) => `assets/ui/statuses/icon-${kind}.png`,
  getStatusLabelUrl: (kind: string) => `assets/ui/statuses/label-${kind}.png`,
} as unknown as PresentationContext;

function move(effects: MoveDefinition["effects"]): MoveDefinition {
  return {
    id: "test-move",
    name: "Test",
    type: PokemonType.Normal,
    category: Category.Physical,
    power: 50,
    accuracy: 100,
    pp: 20,
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects,
  };
}

describe("buildSecondaryEffectChip", () => {
  it("returns nothing for a move without a chance-based effect", () => {
    expect(buildSecondaryEffectChip(context, move([{ kind: EffectKind.Damage }]))).toBeNull();
  });

  it("ignores an effect that always lands", () => {
    const chip = buildSecondaryEffectChip(
      context,
      move([{ kind: EffectKind.Status, status: "burned", chance: 100 } as never]),
    );

    expect(chip).toBeNull();
  });

  it("uses the status chip art for a status that ships one", () => {
    const chip = buildSecondaryEffectChip(
      context,
      move([{ kind: EffectKind.Status, status: "burned", chance: 10 } as never]),
    );

    expect(chip?.statusLabelUrl).toBe("assets/ui/statuses/label-burned.png");
    expect(chip?.statusLabelAlt).toBe("status.burned");
    expect(chip?.iconUrls).toBeUndefined();
    expect(chip?.text).toBe("10 %");
  });

  it("falls back to the glyph for a status without chip art", () => {
    const chip = buildSecondaryEffectChip(
      context,
      move([{ kind: EffectKind.Status, status: "confused", chance: 20 } as never]),
    );

    expect(chip?.statusLabelUrl).toBeUndefined();
    expect(chip?.iconUrls).toEqual(["assets/ui/statuses/icon-confused.png"]);
  });

  it("names the stat and its direction for a stat-change effect", () => {
    const chip = buildSecondaryEffectChip(
      context,
      move([
        { kind: EffectKind.StatChange, stat: StatName.Speed, stages: -1, chance: 20 } as never,
      ]),
    );

    expect(chip?.text).toBe("stat.spd 1↓ · 20 %");
    expect(chip?.tone).toBe("danger");
  });
});
