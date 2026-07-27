import { describe, expect, it } from "vitest";
import { DefensiveKind } from "../enums/defensive-kind";
import { HeldItemId } from "../enums/held-item-id";
import { PlayerId } from "../enums/player-id";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { SurvivalGuardKind } from "../enums/survival-guard-kind";
import { Weather } from "../enums/weather";
import { buildItemTestEngine, MockPokemon } from "../testing";
import type { PokemonInstance } from "../types/pokemon-instance";
import { setWeather } from "./weather-system";

const TACKLE = "tackle";
const EMBER = "ember";
const SLAM = "slam";

function battle(overrides: Partial<PokemonInstance> = {}) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 2, y: 2 },
    moveIds: [TACKLE, SLAM, EMBER],
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: 3, y: 2 },
    ...overrides,
  });
  return buildItemTestEngine([attacker, defender], 8);
}

describe("BattleEngine.previewMove", () => {
  it("returns null for an unknown attacker, move or defender", () => {
    const { engine } = battle();
    expect(engine.previewMove("ghost", TACKLE, "defender")).toBeNull();
    expect(engine.previewMove("attacker", "not-a-move", "defender")).toBeNull();
    expect(engine.previewMove("attacker", TACKLE, "ghost")).toBeNull();
  });

  it("reports a damage range, its modifiers and the crit odds", () => {
    const { engine } = battle();
    const preview = engine.previewMove("attacker", TACKLE, "defender");

    expect(preview).not.toBeNull();
    expect(preview?.damage?.min).toBeGreaterThan(0);
    expect(preview?.damage?.max).toBeGreaterThanOrEqual(preview?.damage?.min ?? 0);
    expect(preview?.damage?.effectiveness).toBe(1);
    expect(preview?.damage?.resolvedMoveType).toBe("normal");
    expect(preview?.damage?.resolvedPower).toBeGreaterThan(0);
    expect(preview?.critChance).toBe(1 / 24);
  });

  it("reports null accuracy for a move that cannot miss", () => {
    const { engine } = battle();
    expect(engine.previewMove("attacker", TACKLE, "defender")?.accuracy).toBeNull();
  });

  it("reports the degraded accuracy of a move against a boosted-evasion target", () => {
    const { engine, state } = battle();
    const defender = state.pokemon.get("defender");
    if (!defender) {
      throw new Error("missing defender");
    }
    defender.statStages[StatName.Evasion] = 2;

    expect(engine.previewMove("attacker", SLAM, "defender")?.accuracy).toBeLessThan(75);
  });

  it("does not consume Verrouillage while previewing", () => {
    const { engine, state } = battle();
    const attacker = state.pokemon.get("attacker");
    if (!attacker) {
      throw new Error("missing attacker");
    }
    attacker.volatileStatuses.push({ type: StatusType.LockedOn, remainingTurns: 1 });

    expect(engine.previewMove("attacker", SLAM, "defender")?.accuracy).toBeNull();
    expect(engine.previewMove("attacker", SLAM, "defender")?.accuracy).toBeNull();
    expect(attacker.volatileStatuses).toHaveLength(1);
  });

  it("folds the active weather into the estimate, not just into the real hit", () => {
    const { engine, state } = battle();
    const clear = engine.previewMove("attacker", EMBER, "defender");

    setWeather(state, Weather.Sun);
    const sunny = engine.previewMove("attacker", EMBER, "defender");

    expect(sunny?.damage?.weatherModifier).toBeGreaterThan(1);
    expect(sunny?.damage?.max).toBeGreaterThan(clear?.damage?.max ?? 0);
  });

  it("reports a neutral weather modifier under clear skies", () => {
    const { engine } = battle();
    expect(engine.previewMove("attacker", EMBER, "defender")?.damage?.weatherModifier).toBe(1);
  });

  it("reports no survival guard on a plain target", () => {
    const { engine } = battle();
    expect(engine.previewMove("attacker", TACKLE, "defender")?.survivalGuard).toBeNull();
  });

  it("reports Ténacité as a survival guard", () => {
    const { engine, state } = battle();
    const defender = state.pokemon.get("defender");
    if (!defender) {
      throw new Error("missing defender");
    }
    defender.activeDefense = { kind: DefensiveKind.Endure };

    expect(engine.previewMove("attacker", TACKLE, "defender")?.survivalGuard).toBe(
      SurvivalGuardKind.Endure,
    );
  });

  it("reports Ceinture Force as a survival guard only from full HP", () => {
    const { engine, state } = battle({ heldItemId: HeldItemId.FocusSash });
    const defender = state.pokemon.get("defender");
    if (!defender) {
      throw new Error("missing defender");
    }

    expect(engine.previewMove("attacker", TACKLE, "defender")?.survivalGuard).toBe(
      SurvivalGuardKind.FocusSash,
    );

    defender.currentHp = defender.maxHp - 1;
    expect(engine.previewMove("attacker", TACKLE, "defender")?.survivalGuard).toBeNull();
  });

  it("reports Fermeté as a survival guard from full HP", () => {
    const { engine } = battle({ abilityId: "sturdy" });
    expect(engine.previewMove("attacker", TACKLE, "defender")?.survivalGuard).toBe(
      SurvivalGuardKind.Sturdy,
    );
  });

  it("ignores Bandeau, whose survival is probabilistic", () => {
    const { engine } = battle({ heldItemId: HeldItemId.FocusBand });
    expect(engine.previewMove("attacker", TACKLE, "defender")?.survivalGuard).toBeNull();
  });
});
