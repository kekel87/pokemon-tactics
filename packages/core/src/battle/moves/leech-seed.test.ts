import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../../enums/action-error";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("leech-seed", () => {
  it("applies Seeded volatile status on target in range", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "leech-seed",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.StatusApplied);

    const targetPokemon = state.pokemon.get(target.id)!;
    const seeded = targetPokemon.volatileStatuses.find((v) => v.type === StatusType.Seeded);
    expect(seeded).toBeDefined();
    expect(seeded!.sourceId).toBe(caster.id);

    vi.restoreAllMocks();
  });

  it("drains target HP and heals source on EndTurn", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: 50,
      maxHp: 105,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      currentHp: 99,
      maxHp: 99,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "leech-seed",
      targetPosition: { x: 2, y: 0 },
    });

    const casterHpAfterSeed = state.pokemon.get(caster.id)!.currentHp;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: caster.id,
      direction: Direction.South,
    });

    // Target's EndTurn triggers the seeded tick
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: target.id,
      direction: Direction.South,
    });

    const targetHpAfter = state.pokemon.get(target.id)!.currentHp;
    const casterHpAfter = state.pokemon.get(caster.id)!.currentHp;

    // Target lost 1/8 of 99 = 12 HP
    expect(targetHpAfter).toBeLessThan(99);
    expect(casterHpAfter).toBeGreaterThan(casterHpAfterSeed);

    vi.restoreAllMocks();
  });

  it("returns InvalidTarget when target is out of range", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const farTarget = MockPokemon.fresh(MockPokemon.charmander, {
      id: "far-target",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([caster, farTarget]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "leech-seed",
      targetPosition: { x: 5, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
  });

  it("stops draining when source is KO", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const source = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: 1,
      maxHp: 105,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });
    const killer = MockPokemon.fresh(MockPokemon.base, {
      id: "killer-1",
      playerId: PlayerId.Player2,
      position: { x: 0, y: 1 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      combatStats: { hp: 100, attack: 200, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([source, target, killer]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: source.id,
      moveId: "leech-seed",
      targetPosition: { x: 2, y: 0 },
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: source.id,
      direction: Direction.South,
    });

    // Kill the source
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: target.id,
      moveId: "scratch",
      targetPosition: { x: 0, y: 0 },
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: target.id,
      direction: Direction.South,
    });

    // Killer also attacks source if still alive
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: killer.id,
      moveId: "scratch",
      targetPosition: { x: 0, y: 0 },
    });
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: killer.id,
      direction: Direction.South,
    });

    expect(state.pokemon.get(source.id)!.currentHp).toBe(0);
    // Seeded status should be removed from target since source is dead
    const targetPokemon = state.pokemon.get(target.id)!;
    const seeded = targetPokemon.volatileStatuses.find((v) => v.type === StatusType.Seeded);
    expect(seeded).toBeUndefined();

    vi.restoreAllMocks();
  });

  it("is immune on Grass-type targets", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    // Bulbasaur (Grass) targets another Bulbasaur (Grass)
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const grassTarget = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "grass-target",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, grassTarget]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "leech-seed",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    // No Seeded status applied
    const targetPokemon = state.pokemon.get(grassTarget.id)!;
    expect(
      targetPokemon.volatileStatuses.find((v) => v.type === StatusType.Seeded),
    ).toBeUndefined();

    vi.restoreAllMocks();
  });

  it("allows multiple Seeded from different sources on the same target", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster1 = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "caster-1",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const caster2 = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "caster-2",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster1, caster2, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster1.id,
      moveId: "leech-seed",
      targetPosition: { x: 2, y: 0 },
    });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: caster1.id,
      direction: Direction.South,
    });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster2.id,
      moveId: "leech-seed",
      targetPosition: { x: 2, y: 0 },
    });

    const targetPokemon = state.pokemon.get(target.id)!;
    const seededStatuses = targetPokemon.volatileStatuses.filter(
      (v) => v.type === StatusType.Seeded,
    );
    expect(seededStatuses).toHaveLength(2);
    expect(seededStatuses[0]!.sourceId).toBe(caster1.id);
    expect(seededStatuses[1]!.sourceId).toBe(caster2.id);

    vi.restoreAllMocks();
  });
});
