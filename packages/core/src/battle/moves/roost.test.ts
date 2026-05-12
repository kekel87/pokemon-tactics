import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { PokemonType } from "../../enums/pokemon-type";
import { StatusType } from "../../enums/status-type";
import { TerrainType } from "../../enums/terrain-type";
import { buildMoveTestEngine, MockBattle, MockPokemon } from "../../testing";
import { isEffectivelyFlying } from "../effective-flying";
import { createTerrainTickHandler } from "../handlers/terrain-tick-handler";

describe("roost", () => {
  it("heals 50% of maxHp on self", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["roost"],
      currentPp: { roost: 10 },
      currentHp: 50,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const dummy = MockPokemon.fresh(MockPokemon.charmander, {
      id: "dummy",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, dummy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "roost",
      targetPosition: attacker.position,
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HpRestored);
    expect(state.pokemon.get(attacker.id)?.currentHp).toBe(150);
  });

  it("applies Roosted volatile (suppresses Flying type for one turn)", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["roost"],
      currentPp: { roost: 10 },
      currentHp: 100,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const dummy = MockPokemon.fresh(MockPokemon.charmander, {
      id: "dummy",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 4 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, dummy]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "roost",
      targetPosition: attacker.position,
    });

    const after = state.pokemon.get(attacker.id);
    expect(after?.volatileStatuses.some((v) => v.type === StatusType.Roosted)).toBe(true);
  });

  it("isEffectivelyFlying returns false while Roosted, true after volatile cleared", () => {
    const pokemon = MockPokemon.fresh(MockPokemon.base, {
      volatileStatuses: [{ type: StatusType.Roosted, remainingTurns: 1 }],
    });
    expect(isEffectivelyFlying(pokemon, [PokemonType.Normal, PokemonType.Flying])).toBe(false);
    pokemon.volatileStatuses = [];
    expect(isEffectivelyFlying(pokemon, [PokemonType.Normal, PokemonType.Flying])).toBe(true);
  });

  it("Roosting over lava kills the Pokemon (OHKO terrain DoT)", () => {
    const pokemon = MockPokemon.fresh(MockBattle.player1Fast, {
      definitionId: "articuno",
      currentHp: 200,
      maxHp: 200,
      volatileStatuses: [{ type: StatusType.Roosted, remainingTurns: 1 }],
    });
    const state = MockBattle.stateFrom([pokemon]);
    MockBattle.setTile(state, pokemon.position.x, pokemon.position.y, {
      terrain: TerrainType.Lava,
    });

    const types = [PokemonType.Ice, PokemonType.Flying];
    const handler = createTerrainTickHandler(new Map([["articuno", types]]));
    const result = handler(pokemon.id, state);

    expect(result.events.some((e) => e.type === BattleEventType.TerrainDamageDealt)).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.PokemonKo)).toBe(true);
    expect(pokemon.currentHp).toBe(0);
  });

  it("Roosting over deep water kills the Pokemon (non-Water type)", () => {
    const pokemon = MockPokemon.fresh(MockBattle.player1Fast, {
      definitionId: "moltres",
      currentHp: 200,
      maxHp: 200,
      volatileStatuses: [{ type: StatusType.Roosted, remainingTurns: 1 }],
    });
    const state = MockBattle.stateFrom([pokemon]);
    MockBattle.setTile(state, pokemon.position.x, pokemon.position.y, {
      terrain: TerrainType.DeepWater,
    });

    const types = [PokemonType.Fire, PokemonType.Flying];
    const handler = createTerrainTickHandler(new Map([["moltres", types]]));
    const result = handler(pokemon.id, state);

    expect(result.events.some((e) => e.type === BattleEventType.PokemonKo)).toBe(true);
  });

  it("Flying Pokemon NOT roosted is immune to lava (still flying)", () => {
    const pokemon = MockPokemon.fresh(MockBattle.player1Fast, {
      definitionId: "articuno",
      currentHp: 200,
      maxHp: 200,
    });
    const state = MockBattle.stateFrom([pokemon]);
    MockBattle.setTile(state, pokemon.position.x, pokemon.position.y, {
      terrain: TerrainType.Lava,
    });

    const types = [PokemonType.Ice, PokemonType.Flying];
    const handler = createTerrainTickHandler(new Map([["articuno", types]]));
    const result = handler(pokemon.id, state);

    expect(result.events.some((e) => e.type === BattleEventType.TerrainDamageDealt)).toBe(false);
  });

  it("Water-type roosted over deep water survives (type immunity persists)", () => {
    const pokemon = MockPokemon.fresh(MockBattle.player1Fast, {
      definitionId: "gyarados-test",
      currentHp: 200,
      maxHp: 200,
      volatileStatuses: [{ type: StatusType.Roosted, remainingTurns: 1 }],
    });
    const state = MockBattle.stateFrom([pokemon]);
    MockBattle.setTile(state, pokemon.position.x, pokemon.position.y, {
      terrain: TerrainType.DeepWater,
    });

    const types = [PokemonType.Water, PokemonType.Flying];
    const handler = createTerrainTickHandler(new Map([["gyarados-test", types]]));
    const result = handler(pokemon.id, state);

    expect(result.events.some((e) => e.type === BattleEventType.TerrainDamageDealt)).toBe(false);
  });
});
