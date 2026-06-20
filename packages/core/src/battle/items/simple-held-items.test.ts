import { itemHandlers } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Category } from "../../enums/category";
import { Direction } from "../../enums/direction";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildItemTestEngine, MockMove, MockPokemon } from "../../testing";
import type { DamageModifyContext } from "../../types/ability-definition";
import type { AfterMoveDamageDealtContext } from "../../types/held-item-definition";
import type { PokemonInstance } from "../../types/pokemon-instance";

function modifyContext(category: Category, isAttacker: boolean): DamageModifyContext {
  return {
    self: MockPokemon.fresh(MockPokemon.base, { id: "self" }),
    opponent: MockPokemon.fresh(MockPokemon.base, { id: "opponent" }),
    move: MockMove.fresh(MockMove.physical, { category }),
    isAttacker,
    attackerTypes: [],
    defenderTypes: [],
    effectiveness: 1,
  };
}

function afterMoveContext(
  attacker: PokemonInstance,
  damageDealt: number,
): AfterMoveDamageDealtContext {
  return { attacker, move: MockMove.fresh(MockMove.physical), damageDealt };
}

describe("Bandeau Muscle (muscle-band)", () => {
  const handler = itemHandlers.find((h) => h.id === HeldItemId.MuscleBand);

  it("Given a physical attacker, When attacking, Then multiplier is 1.1", () => {
    expect(handler?.onDamageModify?.(modifyContext(Category.Physical, true))).toBe(1.1);
  });

  it("Given a special attacker, When attacking, Then multiplier is 1.0", () => {
    expect(handler?.onDamageModify?.(modifyContext(Category.Special, true))).toBe(1.0);
  });

  it("Given a physical move received, When defending, Then multiplier is 1.0", () => {
    expect(handler?.onDamageModify?.(modifyContext(Category.Physical, false))).toBe(1.0);
  });
});

describe("Lunettes Sages (wise-glasses)", () => {
  const handler = itemHandlers.find((h) => h.id === HeldItemId.WiseGlasses);

  it("Given a special attacker, When attacking, Then multiplier is 1.1", () => {
    expect(handler?.onDamageModify?.(modifyContext(Category.Special, true))).toBe(1.1);
  });

  it("Given a physical attacker, When attacking, Then multiplier is 1.0", () => {
    expect(handler?.onDamageModify?.(modifyContext(Category.Physical, true))).toBe(1.0);
  });

  it("Given a special move received, When defending, Then multiplier is 1.0", () => {
    expect(handler?.onDamageModify?.(modifyContext(Category.Special, false))).toBe(1.0);
  });
});

describe("Grelot Coque (shell-bell)", () => {
  const handler = itemHandlers.find((h) => h.id === HeldItemId.ShellBell);

  it("Given a hurt holder dealing damage, When the move lands, Then it heals one eighth of damage dealt", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      currentHp: 100,
      maxHp: 300,
    });
    const events = handler?.onAfterMoveDamageDealt?.(afterMoveContext(attacker, 16)) ?? [];
    expect(attacker.currentHp).toBe(102);
    expect(events.some((e) => e.type === BattleEventType.HpRestored)).toBe(true);
  });

  it("Given a full-HP holder, When the move lands, Then no heal", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      currentHp: 300,
      maxHp: 300,
    });
    expect(handler?.onAfterMoveDamageDealt?.(afterMoveContext(attacker, 16))).toHaveLength(0);
    expect(attacker.currentHp).toBe(300);
  });

  it("Given no damage dealt, When the move lands, Then no heal", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      currentHp: 100,
      maxHp: 300,
    });
    expect(handler?.onAfterMoveDamageDealt?.(afterMoveContext(attacker, 0))).toHaveLength(0);
    expect(attacker.currentHp).toBe(100);
  });
});

describe("Orbe Toxique (toxic-orb)", () => {
  function holderAndFoe(statusEffects: PokemonInstance["statusEffects"]) {
    const holder = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "holder",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      heldItemId: HeldItemId.ToxicOrb,
      statusEffects,
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    return buildItemTestEngine([holder, foe]);
  }

  it("Given holder with no status, When end turn, Then Badly Poisoned applied and toxic counter reset", () => {
    const { engine } = holderAndFoe([]);
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "holder",
      direction: Direction.East,
    });
    const statusApplied = result.events.find(
      (e) =>
        e.type === BattleEventType.StatusApplied &&
        "status" in e &&
        e.status === StatusType.BadlyPoisoned,
    );
    expect(statusApplied).toBeDefined();
    const holderAfter = engine.getGameState(PlayerId.Player1).pokemon.get("holder");
    expect(holderAfter?.statusEffects.some((s) => s.type === StatusType.BadlyPoisoned)).toBe(true);
  });

  it("Given holder already Paralyzed, When end turn, Then no Badly Poison applied", () => {
    const { engine } = holderAndFoe([{ type: StatusType.Paralyzed, remainingTurns: null }]);
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "holder",
      direction: Direction.East,
    });
    const holderAfter = engine.getGameState(PlayerId.Player1).pokemon.get("holder");
    expect(holderAfter?.statusEffects.some((s) => s.type === StatusType.BadlyPoisoned)).toBe(false);
  });
});
