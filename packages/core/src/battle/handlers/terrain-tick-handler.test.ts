import { describe, expect, it } from "vitest";
import { BattleEventType } from "../../enums/battle-event-type";
import { PokemonType } from "../../enums/pokemon-type";
import { StatusType } from "../../enums/status-type";
import { TerrainType } from "../../enums/terrain-type";
import { MockBattle, MockPokemon } from "../../testing";
import { createTerrainTickHandler } from "./terrain-tick-handler";

const P1 = MockBattle.player1Fast;

function makeHandler(pokemonDefinitionId: string, types: PokemonType[]) {
  return createTerrainTickHandler(new Map([[pokemonDefinitionId, types]]));
}

function stateOnTerrain(pokemon: ReturnType<typeof MockPokemon.fresh>, terrain: TerrainType) {
  const state = MockBattle.stateFrom([pokemon]);
  MockBattle.setTile(state, pokemon.position.x, pokemon.position.y, { terrain });
  return state;
}

describe("terrainTickHandler — swamp", () => {
  it("Given Normal Pokemon on swamp, When EndTurn, Then StatusApplied Poisoned", () => {
    const pokemon = MockPokemon.fresh(P1, { definitionId: "normal-type" });
    const handler = makeHandler("normal-type", [PokemonType.Normal]);
    const state = stateOnTerrain(pokemon, TerrainType.Swamp);

    const result = handler(pokemon.id, state);

    expect(result.events.some((e) => e.type === BattleEventType.TerrainStatusApplied)).toBe(true);
    expect(pokemon.statusEffects.some((s) => s.type === StatusType.Poisoned)).toBe(true);
  });

  it("Given Poison-type Pokemon on swamp, When EndTurn, Then no status", () => {
    const pokemon = MockPokemon.fresh(P1, { definitionId: "poison-type" });
    const handler = makeHandler("poison-type", [PokemonType.Poison]);
    const state = stateOnTerrain(pokemon, TerrainType.Swamp);

    const result = handler(pokemon.id, state);

    expect(result.events.some((e) => e.type === BattleEventType.TerrainStatusApplied)).toBe(false);
    expect(pokemon.statusEffects).toHaveLength(0);
  });

  it("Given Flying Pokemon on swamp, When EndTurn, Then no effect", () => {
    const pokemon = MockPokemon.fresh(P1, { definitionId: "flying-type" });
    const handler = makeHandler("flying-type", [PokemonType.Flying]);
    const state = stateOnTerrain(pokemon, TerrainType.Swamp);

    const result = handler(pokemon.id, state);

    expect(result.events).toHaveLength(0);
  });

  it("Given already Poisoned Pokemon on swamp, When EndTurn, Then no double-poison", () => {
    const pokemon = MockPokemon.fresh(P1, {
      definitionId: "normal-type",
      statusEffects: [{ type: StatusType.Poisoned, remainingTurns: null }],
    });
    const handler = makeHandler("normal-type", [PokemonType.Normal]);
    const state = stateOnTerrain(pokemon, TerrainType.Swamp);

    handler(pokemon.id, state);

    expect(pokemon.statusEffects).toHaveLength(1);
  });

  it("Given Burned Pokemon on swamp, When EndTurn, Then no Poisoned (single major status)", () => {
    const pokemon = MockPokemon.fresh(P1, {
      definitionId: "normal-type",
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
    });
    const handler = makeHandler("normal-type", [PokemonType.Normal]);
    const state = stateOnTerrain(pokemon, TerrainType.Swamp);

    const result = handler(pokemon.id, state);

    expect(result.events.some((e) => e.type === BattleEventType.TerrainStatusApplied)).toBe(false);
    expect(pokemon.statusEffects).toHaveLength(1);
    expect(pokemon.statusEffects[0]?.type).toBe(StatusType.Burned);
  });
});

describe("terrainTickHandler — magma", () => {
  it("Given Normal Pokemon on magma, When EndTurn, Then TerrainDamageDealt 1/16 HP", () => {
    const pokemon = MockPokemon.fresh(P1, {
      currentHp: 100,
      maxHp: 160,
      definitionId: "normal-type",
    });
    const handler = makeHandler("normal-type", [PokemonType.Normal]);
    const state = stateOnTerrain(pokemon, TerrainType.Magma);

    const result = handler(pokemon.id, state);

    const dotEvent = result.events.find((e) => e.type === BattleEventType.TerrainDamageDealt);
    expect(dotEvent).toBeDefined();
    if (dotEvent?.type === BattleEventType.TerrainDamageDealt) {
      expect(dotEvent.amount).toBe(10);
    }
    expect(pokemon.currentHp).toBe(90);
  });

  it("Given Fire-type Pokemon on magma, When EndTurn, Then no TerrainDamageDealt", () => {
    const pokemon = MockPokemon.fresh(P1, { definitionId: "fire-type" });
    const handler = makeHandler("fire-type", [PokemonType.Fire]);
    const state = stateOnTerrain(pokemon, TerrainType.Magma);

    const result = handler(pokemon.id, state);

    expect(result.events.some((e) => e.type === BattleEventType.TerrainDamageDealt)).toBe(false);
    expect(result.events.some((e) => e.type === BattleEventType.TerrainStatusApplied)).toBe(false);
  });

  it("Given terrain tick kills Pokemon, Then PokemonKo emitted", () => {
    const pokemon = MockPokemon.fresh(P1, {
      currentHp: 1,
      maxHp: 160,
      definitionId: "normal-type",
    });
    const handler = makeHandler("normal-type", [PokemonType.Normal]);
    const state = stateOnTerrain(pokemon, TerrainType.Magma);

    const result = handler(pokemon.id, state);

    expect(result.pokemonFainted).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.PokemonKo)).toBe(true);
    expect(pokemon.currentHp).toBe(0);
  });
});

describe("terrainTickHandler — tall_grass", () => {
  it("Given Pokemon on tall_grass, When EndTurn, Then no terrain tick effect", () => {
    const pokemon = MockPokemon.fresh(P1, { definitionId: "normal-type" });
    const handler = makeHandler("normal-type", [PokemonType.Normal]);
    const state = stateOnTerrain(pokemon, TerrainType.TallGrass);

    const result = handler(pokemon.id, state);

    expect(result.events).toHaveLength(0);
    expect(pokemon.statStages.evasion).toBe(0);
  });
});

describe("terrainTickHandler — neutral terrain", () => {
  it("Normal terrain has no effect", () => {
    const pokemon = MockPokemon.fresh(P1, { definitionId: "normal-type" });
    const handler = makeHandler("normal-type", [PokemonType.Normal]);
    const state = stateOnTerrain(pokemon, TerrainType.Normal);

    const result = handler(pokemon.id, state);

    expect(result.events).toHaveLength(0);
  });

  it("KO Pokemon is skipped", () => {
    const pokemon = MockPokemon.fresh(P1, { currentHp: 0, definitionId: "normal-type" });
    const handler = makeHandler("normal-type", [PokemonType.Normal]);
    const state = stateOnTerrain(pokemon, TerrainType.Magma);

    const result = handler(pokemon.id, state);

    expect(result.events).toHaveLength(0);
  });
});
