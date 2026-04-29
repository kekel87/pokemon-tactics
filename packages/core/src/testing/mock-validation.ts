import { Category } from "../enums/category";
import { EffectKind } from "../enums/effect-kind";
import { PokemonType } from "../enums/pokemon-type";
import { TargetingKind } from "../enums/targeting-kind";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonDefinition } from "../types/pokemon-definition";

export abstract class MockValidation {
  static readonly validMove: MoveDefinition = {
    id: "tackle",
    name: "Tackle",
    type: PokemonType.Normal,
    category: Category.Physical,
    power: 40,
    accuracy: 100,
    pp: 35,
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [{ kind: EffectKind.Damage }],
  };

  static readonly validPokemon: PokemonDefinition = {
    id: "test",
    name: "Test",
    types: [PokemonType.Normal],
    baseStats: { hp: 50, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
    weight: 10,
    movepool: ["tackle"],
    genderRatio: "genderless",
  };
}
