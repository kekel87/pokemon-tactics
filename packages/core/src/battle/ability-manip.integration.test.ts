import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { PlayerId } from "../enums/player-id";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { TerrainType } from "../enums/terrain-type";
import { buildItemTestEngine, MockPokemon } from "../testing";
import { isEffectivelyFlying } from "./effective-flying";

// Famille Misc Batch C (plan 153) : manipulation runtime du talent via abilityIdOverride / abilitySuppressed.

describe("Ability manip — Soucigraine (worry-seed)", () => {
  it("replaces the target's ability with Insomnie and wakes a sleeping target", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["worry-seed"],
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "blaze",
      statusEffects: [{ type: StatusType.Asleep, remainingTurns: 3 }],
    });
    const { engine, state } = buildItemTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "worry-seed",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(target.id)?.abilityIdOverride).toBe("insomnia");
    expect(
      state.pokemon.get(target.id)?.statusEffects.some((s) => s.type === StatusType.Asleep),
    ).toBe(false);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.AbilityChanged);
  });

  it("fails when the target already effectively has Insomnie", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["worry-seed"],
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "insomnia",
    });
    const { engine, state } = buildItemTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "worry-seed",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(target.id)?.abilityIdOverride).toBeUndefined();
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.MoveFailed);
  });
});

describe("Ability manip — Suc Digestif (gastro-acid)", () => {
  it("suppresses the target's ability", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["gastro-acid"],
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "blaze",
    });
    const { engine, state } = buildItemTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "gastro-acid",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(target.id)?.abilitySuppressed).toBe(true);
  });

  it("fails on a target with no effective ability", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["gastro-acid"],
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: undefined,
    });
    const { engine, state } = buildItemTestEngine([caster, target]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "gastro-acid",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(target.id)?.abilitySuppressed).toBeUndefined();
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.MoveFailed);
  });

  it("suppressing Lévitation grounds the target (interaction complète)", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["gastro-acid"],
    });
    const target = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "levitate",
    });
    const { engine } = buildItemTestEngine([caster, target]);

    const targetTypes = engine.getPokemonTypes(target.id);
    expect(isEffectivelyFlying(target, targetTypes)).toBe(true);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "gastro-acid",
      targetPosition: { x: 1, y: 0 },
    });

    expect(isEffectivelyFlying(target, targetTypes)).toBe(false);
  });

  it("de-levitating a mon floating over lava drowns it immediately (interaction complète)", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["gastro-acid"],
    });
    const target = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "levitate",
    });
    const { engine, state } = buildItemTestEngine([caster, target]);
    const tile = state.grid[0]?.[1];
    if (tile) {
      tile.terrain = TerrainType.Lava;
    }

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "gastro-acid",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(target.id)?.currentHp).toBeLessThanOrEqual(0);
  });
});

describe("Ability manip — Imitation (role-play)", () => {
  it("copies the target's effective ability onto the caster", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["role-play"],
      abilityId: "torrent",
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "blaze",
    });
    const { engine, state } = buildItemTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "role-play",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(caster.id)?.abilityIdOverride).toBe("blaze");
    expect(state.pokemon.get(target.id)?.abilityIdOverride).toBeUndefined();
  });
});

describe("Ability manip — Échange (skill-swap)", () => {
  it("swaps the effective abilities of caster and target", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["skill-swap"],
      abilityId: "torrent",
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "blaze",
    });
    const { engine, state } = buildItemTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "skill-swap",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(caster.id)?.abilityIdOverride).toBe("blaze");
    expect(state.pokemon.get(target.id)?.abilityIdOverride).toBe("torrent");
  });

  it("granting Intimidation applies its aura to adjacent enemies (interaction complète)", () => {
    const caster = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["skill-swap"],
      abilityId: "intimidate",
    });
    const target = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "blaze",
    });
    const { engine, state } = buildItemTestEngine([caster, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: caster.id,
      moveId: "skill-swap",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(target.id)?.abilityIdOverride).toBe("intimidate");
    expect(state.pokemon.get(caster.id)?.statStages[StatName.Attack]).toBe(-1);
  });
});

describe("Ability manip — Suc Digestif removes a source's Intimidation aura", () => {
  it("restores the Attack drop when the intimidate source is suppressed", () => {
    const victim = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["gastro-acid"],
    });
    const source = MockPokemon.fresh(MockPokemon.charmander, {
      id: "source",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "intimidate",
    });
    const { engine, state } = buildItemTestEngine([victim, source]);

    expect(state.pokemon.get(victim.id)?.statStages[StatName.Attack]).toBe(-1);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: victim.id,
      moveId: "gastro-acid",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(source.id)?.abilitySuppressed).toBe(true);
    expect(state.pokemon.get(victim.id)?.statStages[StatName.Attack]).toBe(0);
    expect(
      state.pokemon.get(victim.id)?.volatileStatuses.some((v) => v.type === StatusType.Intimidated),
    ).toBe(false);
  });
});

describe("Ability manip — KO cleanup", () => {
  it("clears the override and suppression when the mon faints", () => {
    const caster = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["ember"],
      currentHp: 1,
      abilityIdOverride: "insomnia",
      abilitySuppressed: true,
    });
    const target = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["vine-whip"],
    });
    const { engine, state } = buildItemTestEngine([caster, target], 6, target.id);

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: target.id,
      moveId: "vine-whip",
      targetPosition: { x: 0, y: 0 },
    });

    const fainted = state.pokemon.get(caster.id);
    expect(fainted?.currentHp).toBeLessThanOrEqual(0);
    expect(fainted?.abilityIdOverride).toBeUndefined();
    expect(fainted?.abilitySuppressed).toBeUndefined();
  });
});
