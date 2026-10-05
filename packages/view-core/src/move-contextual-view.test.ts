import type { CasterMoveContext, MoveDefinition } from "@pokemon-tactic/core";
import type { PresentationContext } from "@pokemon-tactic/render-ports";
import { describe, expect, it } from "vitest";
import { buildMoveContextualView } from "./move-contextual-view";

const MOVE = { id: "flamethrower", power: 90, accuracy: 100 } as unknown as MoveDefinition;

const context = {
  translate: (key: string) => key,
  getLanguage: () => "fr",
} as unknown as PresentationContext;

function caster(overrides: Partial<CasterMoveContext> = {}): CasterMoveContext {
  return {
    resolvedMove: MOVE,
    activeWeather: "none",
    weatherBpMultiplier: 1,
    fieldTerrainBpMultiplier: 1,
    weatherAccuracyOverride: undefined,
    helpingHandMultiplier: 1,
    burnHalvesDamage: false,
    causes: [],
    ...overrides,
  } as CasterMoveContext;
}

describe("buildMoveContextualView", () => {
  it("renvoie null quand le moteur n'a pas de contexte", () => {
    expect(buildMoveContextualView(context, null, MOVE)).toBeNull();
  });

  it("renvoie null quand la fiche vaut la réalité", () => {
    expect(buildMoveContextualView(context, caster(), MOVE)).toBeNull();
  });

  it("expose la puissance effective quand un multiplicateur s'applique", () => {
    const view = buildMoveContextualView(context, caster({ weatherBpMultiplier: 1.5 }), MOVE);

    expect(view?.power).toEqual({ base: 90, effective: 135, causes: [] });
    expect(view?.accuracy).toBeNull();
  });

  it("cumule les multiplicateurs de puissance", () => {
    const view = buildMoveContextualView(
      context,
      caster({ weatherBpMultiplier: 1.5, fieldTerrainBpMultiplier: 2 }),
      MOVE,
    );

    expect(view?.power?.effective).toBe(270);
  });

  it("expose la précision imposée par la météo", () => {
    const view = buildMoveContextualView(context, caster({ weatherAccuracyOverride: 70 }), MOVE);

    expect(view?.accuracy).toEqual({ base: 100, effective: 70, causes: [] });
    expect(view?.power).toBeNull();
  });

  it("expose la brûlure seule, sans toucher aux chiffres de la fiche", () => {
    const view = buildMoveContextualView(context, caster({ burnHalvesDamage: true }), MOVE);

    expect(view?.burnHalvesDamage).toBe(true);
    expect(view?.power).toBeNull();
    expect(view?.accuracy).toBeNull();
  });

  it("traduit chaque cause et la range sur la puissance qu'elle change", () => {
    const view = buildMoveContextualView(
      context,
      caster({
        weatherBpMultiplier: 1.5,
        causes: [{ kind: "weather", weather: "sun" }, { kind: "helping-hand" }],
      } as Partial<CasterMoveContext>),
      MOVE,
    );

    expect(view?.power?.causes).toEqual(["weather.sun", "moveContext.helpingHand"]);
    expect(view?.accuracy).toBeNull();
  });

  it("range la météo sur la précision seule quand elle ne touche qu'elle", () => {
    const view = buildMoveContextualView(
      context,
      caster({
        weatherAccuracyOverride: 100,
        causes: [{ kind: "weather", weather: "snow" }],
      } as Partial<CasterMoveContext>),
      { ...MOVE, accuracy: 70 } as MoveDefinition,
    );

    expect(view?.accuracy?.causes).toEqual(["weather.snow"]);
    expect(view?.power).toBeNull();
  });

  it("laisse une puissance nulle tranquille (move de statut)", () => {
    const statusMove = { id: "swords-dance", power: 0, accuracy: 0 } as unknown as MoveDefinition;
    const view = buildMoveContextualView(context, caster({ weatherBpMultiplier: 1.5 }), statusMove);

    expect(view).toBeNull();
  });
});
