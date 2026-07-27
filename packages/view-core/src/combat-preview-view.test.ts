import {
  type BattleEngine,
  type BattleState,
  DefensiveKind,
  HeldItemId,
  PlayerId,
  StatName,
} from "@pokemon-tactic/core";
import { buildItemTestEngine, MockPokemon } from "@pokemon-tactic/core/testing";
import type { PresentationContext } from "@pokemon-tactic/render-ports";
import { describe, expect, it } from "vitest";
import { buildCombatPreviewView } from "./combat-preview-view.js";

const testContext: PresentationContext = {
  translate: (key, params) => (params ? `${key}(${Object.values(params).join(",")})` : key),
  getLanguage: () => "en",
  getPortraitUrl: (pokemonId) => `assets/sprites/pokemon/${pokemonId}/portrait-normal.png`,
  getItemIconUrl: (itemId) => `assets/sprites/item-icons/${itemId}.png`,
  getItemName: (itemId) => itemId,
  getAbilityName: (abilityId) => `ability:${abilityId}`,
  getPokemonTypes: () => ["electric"],
  getTypeIconUrl: (type) => `assets/ui/types/${type}.png`,
  getStatusIconUrl: (kind) => `assets/ui/statuses/icon-${kind}.png`,
  isDamagePreviewEnabled: () => true,
};

const TACKLE = "tackle";
const SHADOW_BALL = "shadow-ball";
const GROWL = "growl";
const GUILLOTINE = "guillotine";

interface Scenario {
  engine: BattleEngine;
  state: BattleState;
}

function scenario(defenderOverrides: Record<string, unknown> = {}, withAlly = false): Scenario {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 2, y: 2 },
    moveIds: [TACKLE, SHADOW_BALL, GROWL],
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: 3, y: 2 },
    ...defenderOverrides,
  });
  const roster = [attacker, defender];
  if (withAlly) {
    roster.push(
      MockPokemon.fresh(MockPokemon.base, {
        id: "ally",
        playerId: PlayerId.Player1,
        position: { x: 2, y: 3 },
      }),
    );
  }
  return buildItemTestEngine(roster, 8);
}

function pokemonOf(scene: Scenario, id: string) {
  const pokemon = scene.state.pokemon.get(id);
  if (!pokemon) {
    throw new Error(`missing ${id}`);
  }
  return pokemon;
}

function build(scene: Scenario, targetIds: readonly string[], focusIndex = 0, moveId = TACKLE) {
  const move = scene.engine.getEffectiveMove("attacker", moveId);
  if (!move) {
    throw new Error(`missing move ${moveId}`);
  }
  return buildCombatPreviewView(
    testContext,
    scene.engine,
    scene.state,
    "attacker",
    moveId,
    move,
    targetIds,
    focusIndex,
  );
}

describe("buildCombatPreviewView", () => {
  it("returns null when the focused index points at nothing", () => {
    expect(build(scenario(), ["defender"], 3)).toBeNull();
  });

  it("reports the target identity, HP and the footprint counter", () => {
    const view = build(scenario(), ["defender"]);

    expect(view?.target.name).not.toBe("");
    expect(view?.target.preview?.totalTargets).toBe(1);
    expect(view?.target.preview?.focusIndex).toBe(0);
    expect(view?.target.hpMax).toBeGreaterThan(0);
    expect(view?.target.isAlly).toBe(false);
  });

  it("puts the damage range on the arrow card and the HP left on the target card", () => {
    const view = build(scenario(), ["defender"]);

    expect(view?.target.preview?.damage).not.toBeNull();
    expect(view?.attack.damageValue).toMatch(/^\d+–\d+$/);
    expect(view?.attack.damageUnitLabel).toBe("combatPreview.damageUnit");
    expect(view?.target.preview?.remainingLabel).toMatch(/^combatPreview\.remaining\(\d+–\d+\)$/);
  });

  it("names the move and its resolved type on the arrow card", () => {
    const view = build(scenario(), ["defender"]);

    expect(view?.attack.moveName).not.toBe("");
    expect(view?.attack.moveTypeIconUrl).toContain("assets/ui/types/");
  });

  it("collapses the HP left to zero on a lethal hit", () => {
    const view = build(scenario({ currentHp: 1 }), ["defender"]);

    expect(view?.target.preview?.remainingLabel).toBe("combatPreview.remaining(0)");
  });

  it("marks a guaranteed K.O. through the outcome alone, with no verdict sentence", () => {
    const view = build(scenario({ currentHp: 1 }), ["defender"]);

    expect(view?.attack.outcome).toBe("guaranteed-ko");
    expect(view?.target.preview?.verdictLabel).toBe("");
  });

  it("prints nothing extra when the target survives the highest roll", () => {
    const view = build(scenario(), ["defender"]);

    expect(view?.attack.outcome).toBe("survives");
    expect(view?.target.preview?.verdictLabel).toBe("");
  });

  it("names a known survival guard, the one case colour cannot convey", () => {
    const scene = scenario({ currentHp: 1 });
    pokemonOf(scene, "defender").activeDefense = { kind: DefensiveKind.Endure };

    expect(build(scene, ["defender"])?.target.preview?.verdictLabel).toContain(
      "combatPreview.guard.endure",
    );
  });

  it("names Ceinture Force on a lethal hit only from full HP", () => {
    const scene = scenario({ maxHp: 10, currentHp: 10, heldItemId: HeldItemId.FocusSash });
    const defender = pokemonOf(scene, "defender");

    expect(build(scene, ["defender"])?.target.preview?.verdictLabel).toContain(
      "combatPreview.guard.focusSash",
    );

    defender.currentHp = defender.maxHp - 1;
    expect(build(scene, ["defender"])?.target.preview?.verdictLabel).toBe("");
  });

  it("hides an unrevealed Fermeté behind a plain K.O. on a one-hit-KO move", () => {
    const view = build(scenario({ abilityId: "sturdy" }), ["defender"], 0, GUILLOTINE);

    expect(view?.attack.damageValue).toBe("combatPreview.ohko.headline");
    expect(view?.attack.outcome).toBe("guaranteed-ko");
    expect(view?.target.preview?.verdictLabel).toBe("");
    expect(view?.target.preview?.remainingLabel).toBe("combatPreview.remaining(0)");
  });

  it("names the Fermeté immunity once the ability is revealed", () => {
    const view = build(
      scenario({ abilityId: "sturdy", revealedAbility: true }),
      ["defender"],
      0,
      GUILLOTINE,
    );

    expect(view?.attack.outcome).toBe("no-effect");
    expect(view?.target.preview?.verdictLabel).toBe("combatPreview.ohko.sturdyImmune");
    expect(view?.target.preview?.remainingLabel).toBe("");
  });

  it("blames Fermeté for a survival at 1 HP only once revealed", () => {
    const scene = scenario({ maxHp: 10, currentHp: 10, abilityId: "sturdy" });
    const defender = pokemonOf(scene, "defender");

    expect(build(scene, ["defender"])?.target.preview?.verdictLabel).toBe("");

    defender.revealedAbility = true;
    expect(build(scene, ["defender"])?.target.preview?.verdictLabel).toContain(
      "combatPreview.guard.sturdy",
    );
  });

  it("knows an ally's Fermeté without any reveal", () => {
    const scene = scenario({}, true);
    const ally = pokemonOf(scene, "ally");
    ally.abilityId = "sturdy";
    ally.maxHp = 10;
    ally.currentHp = 10;

    expect(build(scene, ["defender", "ally"], 1)?.target.preview?.verdictLabel).toContain(
      "combatPreview.guard.sturdy",
    );
  });

  it("never mentions Bandeau, whose survival is probabilistic", () => {
    const view = build(scenario({ maxHp: 10, currentHp: 10, heldItemId: HeldItemId.FocusBand }), [
      "defender",
    ]);

    expect(view?.attack.outcome).toBe("guaranteed-ko");
    expect(view?.target.preview?.verdictLabel).toBe("");
  });

  it("flags a focused ally, and never shows a stat block on the forecast card", () => {
    const view = build(scenario({}, true), ["defender", "ally"], 1);

    expect(view?.target.isAlly).toBe(true);
    expect(view?.target.stats).toBeUndefined();
    expect(view?.target.preview?.totalTargets).toBe(2);
  });

  it("labels a guaranteed hit rather than printing 100 %", () => {
    const view = build(scenario(), ["defender"]);

    expect(view?.attack.accuracyText).toBe(
      "combatPreview.accuracy.short(combatPreview.accuracy.guaranteed)",
    );
  });

  it("labels a degraded accuracy as a whole percent", () => {
    const scene = scenario();
    pokemonOf(scene, "defender").statStages[StatName.Evasion] = 2;

    const text = build(scene, ["defender"], 0, SHADOW_BALL)?.attack.accuracyText ?? "";
    expect(text).toMatch(/^combatPreview\.accuracy\.short\(\d+ %\)$/);
    expect(text).not.toContain("100 %");
  });

  it("labels the crit chance as a whole percent instead of a decimal", () => {
    expect(build(scenario(), ["defender"])?.attack.critText).toBe("combatPreview.crit.short(4 %)");
  });

  it("does not call a status move immune, even against a type that blocks its damage", () => {
    const scene = scenario({ definitionId: "gengar" });
    const view = build(scene, ["defender"], 0, GROWL);

    expect(view?.attack.outcome).not.toBe("no-effect");
    expect(view?.target.preview?.verdictLabel).toBe("");
  });

  it("still calls a DAMAGING move immune against the same target", () => {
    const view = build(scenario({ definitionId: "gengar" }), ["defender"]);

    expect(view?.attack.outcome).toBe("no-effect");
  });

  it("drops the crit line on a status move, and keeps its effect chip", () => {
    const view = build(scenario(), ["defender"], 0, GROWL);

    expect(view?.attack.critText).toBe("");
  });

  it("emits no modifier chip when every multiplier is neutral", () => {
    expect(build(scenario(), ["defender"])?.attack.modifierChips).toHaveLength(0);
  });
});
