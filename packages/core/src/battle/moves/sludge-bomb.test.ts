import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockBattle, MockPokemon } from "../../testing";

describe("sludge-bomb", () => {
  it("deals damage to target within blast radius 1", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const hpBefore = target.currentHp;
    const { engine, state } = buildMoveTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "sludge-bomb",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(target.id)?.currentHp).toBeLessThan(hpBefore);
  });

  it("applies poison when random favors it", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "sludge-bomb",
      targetPosition: { x: 3, y: 0 },
    });

    expect(state.pokemon.get(target.id)?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Poisoned }),
    );

    vi.restoreAllMocks();
  });

  it("does not hit target outside blast radius", () => {
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const farTarget = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "far-target",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const hpBefore = farTarget.currentHp;
    const { engine, state } = buildMoveTestEngine([caster, target, farTarget]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "sludge-bomb",
      targetPosition: { x: 3, y: 0 },
    });

    expect(state.pokemon.get(farTarget.id)?.currentHp).toBe(hpBefore);
  });

  it("is intercepted by a pillar (height 2) and explodes on the tile in front of it", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["sludge-bomb"],
      currentPp: { "sludge-bomb": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const targetBehindPillar = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 4, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    const { engine, state } = buildMoveTestEngine([caster, targetBehindPillar], 6);
    MockBattle.setTile(state, 2, 0, { height: 2 });
    const hpBefore = state.pokemon.get(targetBehindPillar.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "sludge-bomb",
      targetPosition: { x: 4, y: 0 },
    });

    expect(state.pokemon.get(targetBehindPillar.id)?.currentHp).toBe(hpBefore);
    vi.restoreAllMocks();
  });

  it("redirects the intercepted epicenter to the tile in front of the pillar (not the pillar itself)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const caster = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["sludge-bomb"],
      currentPp: { "sludge-bomb": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const onEpicenterTile = MockPokemon.fresh(MockPokemon.charmander, {
      id: "on-epicenter",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const justBehindPillar = MockPokemon.fresh(MockPokemon.charmander, {
      id: "just-behind",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });

    const { engine, state } = buildMoveTestEngine(
      [caster, onEpicenterTile, justBehindPillar],
      6,
    );
    MockBattle.setTile(state, 2, 0, { height: 2 });
    const hpEpicenterBefore = state.pokemon.get(onEpicenterTile.id)?.currentHp ?? 0;
    const hpBehindBefore = state.pokemon.get(justBehindPillar.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "sludge-bomb",
      targetPosition: { x: 4, y: 0 },
    });

    expect(state.pokemon.get(onEpicenterTile.id)?.currentHp).toBeLessThan(hpEpicenterBefore);
    expect(state.pokemon.get(justBehindPillar.id)?.currentHp).toBe(hpBehindBefore);
    vi.restoreAllMocks();
  });
});
