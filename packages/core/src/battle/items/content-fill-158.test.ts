import { itemHandlers, loadData } from "@pokemon-tactic/data";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildItemTestEngine, MockMove, MockPokemon } from "../../testing";
import type { DamageModifyContext } from "../../types/ability-definition";
import type { PokemonInstance } from "../../types/pokemon-instance";

function defenseContext(self: PokemonInstance): DamageModifyContext {
  return {
    self,
    opponent: MockPokemon.fresh(MockPokemon.base, { id: "opponent" }),
    move: MockMove.fresh(MockMove.physical),
    isAttacker: false,
    attackerTypes: [],
    defenderTypes: [],
    effectiveness: 1,
  };
}

describe("Griffe Rasoir (razor-claw)", () => {
  const handler = itemHandlers.find((h) => h.id === HeldItemId.RazorClaw);

  it("grants +1 critical-hit stage to any holder", () => {
    expect(
      handler?.onCritStageBoost?.({
        self: MockPokemon.fresh(MockPokemon.base),
        move: MockMove.fresh(MockMove.physical),
      }),
    ).toBe(1);
  });
});

describe("Poing Chance (lucky-punch)", () => {
  const handler = itemHandlers.find((h) => h.id === HeldItemId.LuckyPunch);

  it("grants +2 critical-hit stages to Leveinard", () => {
    expect(
      handler?.onCritStageBoost?.({
        self: MockPokemon.fresh(MockPokemon.base, { definitionId: "chansey" }),
        move: MockMove.fresh(MockMove.physical),
      }),
    ).toBe(2);
  });

  it("does nothing for any other species", () => {
    expect(
      handler?.onCritStageBoost?.({
        self: MockPokemon.fresh(MockPokemon.base, { definitionId: "pidgey" }),
        move: MockMove.fresh(MockMove.physical),
      }),
    ).toBe(0);
  });
});

describe("Poudre Métal (metal-powder)", () => {
  const handler = itemHandlers.find((h) => h.id === HeldItemId.MetalPowder);

  it("boosts an untransformed Métamorph's defenses (×1/1.5 incoming)", () => {
    const ditto = MockPokemon.fresh(MockPokemon.base, { definitionId: "ditto" });
    expect(handler?.onDamageModify?.(defenseContext(ditto))).toBeCloseTo(1 / 1.5);
  });

  it("does nothing for a non-Métamorph", () => {
    const mon = MockPokemon.fresh(MockPokemon.base, { definitionId: "pidgey" });
    expect(handler?.onDamageModify?.(defenseContext(mon))).toBe(1.0);
  });

  it("does nothing on offense", () => {
    const ditto = MockPokemon.fresh(MockPokemon.base, { definitionId: "ditto" });
    expect(handler?.onDamageModify?.({ ...defenseContext(ditto), isAttacker: true })).toBe(1.0);
  });
});

function trapScenario(attackerItem?: HeldItemId) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["bind"],
    ...(attackerItem ? { heldItemId: attackerItem } : {}),
  });
  const defender = MockPokemon.fresh(MockPokemon.charmander, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
  });
  return { attacker, defender };
}

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Trap-modifying items (engine)", () => {
  it("Carapace Mue (shed-shell) blocks a trap from taking hold", () => {
    const { attacker } = trapScenario();
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      heldItemId: HeldItemId.ShedShell,
    });
    const { engine, state } = buildItemTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "bind",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.StatusBlocked);
    expect(
      state.pokemon.get(defender.id)?.volatileStatuses.some((v) => v.type === StatusType.Trapped),
    ).toBe(false);
  });

  it("Bande Étreinte (binding-band) doubles the trap's per-turn chip", () => {
    const { attacker, defender } = trapScenario(HeldItemId.BindingBand);
    const { engine, state } = buildItemTestEngine([attacker, defender]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "bind",
      targetPosition: { x: 1, y: 0 },
    });

    const trapped = state.pokemon
      .get(defender.id)
      ?.volatileStatuses.find((v) => v.type === StatusType.Trapped);
    expect(trapped?.damagePerTurn).toBeCloseTo(0.25);
  });

  it("Accro Griffe (grip-claw) forces the trap to its maximum duration", () => {
    const { attacker, defender } = trapScenario(HeldItemId.GripClaw);
    const { engine, state } = buildItemTestEngine([attacker, defender]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "bind",
      targetPosition: { x: 1, y: 0 },
    });

    const trapped = state.pokemon
      .get(defender.id)
      ?.volatileStatuses.find((v) => v.type === StatusType.Trapped);
    expect(trapped?.remainingTurns).toBe(5);
  });
});

describe("Dé Pipé (loaded-dice, engine)", () => {
  it("forces a variable-hit move to its maximum number of hits", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["bullet-seed"],
      heldItemId: HeldItemId.LoadedDice,
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
    });
    const { engine } = buildItemTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "bullet-seed",
      targetPosition: { x: 1, y: 0 },
    });

    const multiHit = result.events.find((e) => e.type === BattleEventType.MultiHitComplete);
    expect(multiHit?.type === BattleEventType.MultiHitComplete && multiHit.totalHits).toBe(5);
  });
});

describe("Cape Obscure (covert-cloak, engine)", () => {
  it("shields the holder from an incoming secondary stat drop", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["moonblast"],
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      heldItemId: HeldItemId.CovertCloak,
    });
    const { engine, state } = buildItemTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "moonblast",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(defender.id)?.statStages.spAttack).toBe(0);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.HeldItemActivated && e.itemId === HeldItemId.CovertCloak,
      ),
    ).toBe(true);
  });
});

describe("Bandeau (focus-band, engine)", () => {
  function lethalSetup() {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["tackle"],
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 1,
      maxHp: 100,
      heldItemId: HeldItemId.FocusBand,
    });
    return { attacker, defender };
  }

  it("survives an otherwise lethal hit at 1 HP when the roll lands (< 10 %)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { attacker, defender } = lethalSetup();
    const { engine, state } = buildItemTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(defender.id)?.currentHp).toBe(1);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.HeldItemActivated && e.itemId === HeldItemId.FocusBand,
      ),
    ).toBe(true);
  });

  it("does not survive when the roll misses (>= 10 %)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { attacker, defender } = lethalSetup();
    const { engine, state } = buildItemTestEngine([attacker, defender]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(defender.id)?.currentHp).toBe(0);
  });
});

describe("No-op abilities (Fuite / Ramassage)", () => {
  const data = loadData();

  it("registers a handler for Fuite (run-away)", () => {
    expect(data.abilityRegistry.get("run-away")).toBeDefined();
  });

  it("registers a handler for Ramassage (pickup)", () => {
    expect(data.abilityRegistry.get("pickup")).toBeDefined();
  });
});
