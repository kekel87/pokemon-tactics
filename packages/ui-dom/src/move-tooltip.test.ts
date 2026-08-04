import type { MoveDefinition } from "@pokemon-tactic/core";
import { Category, EffectKind, PokemonType, TargetingKind } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import type { UiDomConfig } from "./config.js";
import { tagLines } from "./move-tooltip.js";

const config = {
  translate: (key: string, params?: Record<string, string | number>) =>
    params === undefined ? key : `${key}(${Object.values(params).join(",")})`,
  getLanguage: () => "fr",
  getPortraitUrl: () => "",
  getItemIconUrl: () => "",
  getTypeIconUrl: () => "",
  getCategoryIconUrl: () => "",
  getWeatherIconUrl: () => "",
} as unknown as UiDomConfig;

function move(overrides: Partial<MoveDefinition>): MoveDefinition {
  return {
    id: "test-move",
    name: "Test",
    type: PokemonType.Normal,
    category: Category.Physical,
    power: 50,
    accuracy: 100,
    pp: 20,
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [],
    ...overrides,
  };
}

describe("tagLines — recoil", () => {
  it("bills a fraction of the damage dealt", () => {
    const lines = tagLines(
      move({
        effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Recoil, fraction: 1 / 3 }],
      }),
      config,
    );

    expect(lines).toContain("moveTooltip.tag.recoilFraction(33)");
  });

  it("bills a share of max HP when ofMaxHp is set", () => {
    const lines = tagLines(
      move({
        effects: [
          { kind: EffectKind.Damage },
          { kind: EffectKind.Recoil, fraction: 0.5, ofMaxHp: true },
        ],
      }),
      config,
    );

    expect(lines).toContain("moveTooltip.tag.recoilMaxHp(50)");
    expect(lines).not.toContain("moveTooltip.tag.recoilFraction(50)");
  });

  it("rounds a quarter to 25", () => {
    const lines = tagLines(
      move({
        effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Recoil, fraction: 1 / 4 }],
      }),
      config,
    );

    expect(lines).toContain("moveTooltip.tag.recoilFraction(25)");
  });
});

describe("tagLines — drain", () => {
  it("reports the healed share", () => {
    const lines = tagLines(
      move({ effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Drain, fraction: 0.5 }] }),
      config,
    );

    expect(lines).toContain("moveTooltip.tag.drain(50)");
  });

  it("reports a three-quarter drain", () => {
    const lines = tagLines(
      move({ effects: [{ kind: EffectKind.Damage }, { kind: EffectKind.Drain, fraction: 0.75 }] }),
      config,
    );

    expect(lines).toContain("moveTooltip.tag.drain(75)");
  });
});

describe("tagLines — self-KO family", () => {
  it("marks an explosion as cancellable by Moiteur", () => {
    const lines = tagLines(move({ isExplosion: true }), config);

    expect(lines).toContain("moveTooltip.tag.selfKoExplosion");
  });

  it("marks an unconditional sacrifice", () => {
    const lines = tagLines(move({ selfKo: true }), config);

    expect(lines).toContain("moveTooltip.tag.selfKo");
  });

  it("marks a sacrifice conditional on connecting", () => {
    const lines = tagLines(move({ selfKoOnConnect: true }), config);

    expect(lines).toContain("moveTooltip.tag.selfKoOnConnect");
  });

  it("announces nothing for a move that spares its user", () => {
    const lines = tagLines(move({}), config);

    expect(lines).toEqual([]);
  });
});
