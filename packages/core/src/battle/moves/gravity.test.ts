import { describe, expect, it } from "vitest";
import { ActionError } from "../../enums/action-error";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { FieldGlobalKind } from "../../enums/field-global-kind";
import { PlayerId } from "../../enums/player-id";
import { PokemonType } from "../../enums/pokemon-type";
import { TerrainType } from "../../enums/terrain-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { BattleEvent } from "../../types/battle-event";
import { postFieldGlobalZone } from "../field-global-system";

// Gravité (gravity) — move integration tests.

function damageTo(events: BattleEvent[], targetId: string): number {
  return events
    .filter(
      (event): event is Extract<BattleEvent, { type: typeof BattleEventType.DamageDealt }> =>
        event.type === BattleEventType.DamageDealt && event.targetId === targetId,
    )
    .reduce((sum, event) => sum + event.amount, 0);
}

describe("gravity — zone posting", () => {
  it("posts a FieldGlobalPosted (Gravity, 25-tile r3 diamond, 5 turns) and a zone in state", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 5 },
      moveIds: ["gravity"],
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 9, y: 9 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe], { gridSize: 12 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "gravity",
      targetPosition: { x: 5, y: 5 },
    });

    expect(result.success).toBe(true);
    const posted = result.events.find((e) => e.type === BattleEventType.FieldGlobalPosted);
    expect(posted).toBeDefined();
    if (posted && posted.type === BattleEventType.FieldGlobalPosted) {
      expect(posted.tiles.length).toBe(25);
      expect(posted.durationTurns).toBe(5);
    }
    expect(state.fieldGlobalZones).toHaveLength(1);
  });
});

describe("gravity — airborne move ban", () => {
  it("forbids Vol (fly) while the caster stands in a Gravity zone", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 5 },
      moveIds: ["gravity", "fly"],
      currentPp: { gravity: 10, fly: 10 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 6, y: 5 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe], { gridSize: 12 });
    const casterInstance = state.pokemon.get("caster");
    if (!casterInstance) {
      throw new Error("missing caster");
    }
    postFieldGlobalZone(state, casterInstance, FieldGlobalKind.Gravity);

    const legal = engine.getLegalActions(PlayerId.Player1);
    const offersFly = legal.some(
      (action) => action.kind === ActionKind.UseMove && action.moveId === "fly",
    );
    expect(offersFly).toBe(false);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "fly",
      targetPosition: { x: 6, y: 5 },
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidAction);
    expect(result.events.some((e) => e.type === BattleEventType.GravityMoveBlocked)).toBe(true);
  });
});

describe("gravity — immediate grounding on cast", () => {
  it("melts a Flying-type standing over magma the instant the zone is posted", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 5 },
      moveIds: ["gravity"],
    });
    const flyer = MockPokemon.fresh(MockPokemon.base, {
      id: "flyer",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 6 },
      typeOverride: [PokemonType.Flying],
      hp: 100,
    });
    const { engine, state } = buildMoveTestEngine([caster, flyer], { gridSize: 12 });
    const magmaTile = state.grid[6]?.[5];
    if (!magmaTile) {
      throw new Error("missing magma tile");
    }
    magmaTile.terrain = TerrainType.Magma;
    const flyerBefore = state.pokemon.get("flyer")?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "gravity",
      targetPosition: { x: 5, y: 5 },
    });

    expect(state.pokemon.get("flyer")?.currentHp ?? 0).toBeLessThan(flyerBefore);
  });
});

describe("gravity — grounds a Flying defender", () => {
  it("lets a Ground move hit a Flying-type standing in the zone", () => {
    function build() {
      const caster = MockPokemon.fresh(MockPokemon.base, {
        id: "caster",
        playerId: PlayerId.Player1,
        position: { x: 5, y: 5 },
        moveIds: ["high-horsepower"],
        currentPp: { "high-horsepower": 10 },
      });
      const foe = MockPokemon.fresh(MockPokemon.base, {
        id: "foe",
        playerId: PlayerId.Player2,
        position: { x: 6, y: 5 },
        typeOverride: [PokemonType.Flying],
      });
      return buildMoveTestEngine([caster, foe], { gridSize: 12 });
    }

    const grounded = build();
    const groundedCaster = grounded.state.pokemon.get("caster");
    if (!groundedCaster) {
      throw new Error("missing caster");
    }
    postFieldGlobalZone(grounded.state, groundedCaster, FieldGlobalKind.Gravity);
    const groundedHit = grounded.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "high-horsepower",
      targetPosition: { x: 6, y: 5 },
    });
    expect(damageTo(groundedHit.events, "foe")).toBeGreaterThan(0);

    const airborne = build();
    const airborneHit = airborne.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "high-horsepower",
      targetPosition: { x: 6, y: 5 },
    });
    expect(damageTo(airborneHit.events, "foe")).toBe(0);
  });
});
