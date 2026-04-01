import { Category } from "../enums/category";
import { PokemonType } from "../enums/pokemon-type";
import { TargetingKind } from "../enums/targeting-kind";
import type { MoveDefinition } from "../types/move-definition";

export abstract class MockMove {
  static readonly physical: MoveDefinition = {
    id: "tackle",
    name: "Tackle",
    type: PokemonType.Normal,
    category: Category.Physical,
    power: 40,
    accuracy: 100,
    pp: 35,
    effects: [],
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
  };

  static readonly special: MoveDefinition = {
    id: "ember",
    name: "Ember",
    type: PokemonType.Fire,
    category: Category.Special,
    power: 40,
    accuracy: 100,
    pp: 25,
    effects: [],
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 3 } },
  };

  static readonly status: MoveDefinition = {
    id: "protect",
    name: "Protect",
    type: PokemonType.Normal,
    category: Category.Status,
    power: 0,
    accuracy: 100,
    pp: 10,
    effects: [],
    targeting: { kind: TargetingKind.Self },
  };

  static fresh(base: MoveDefinition, overrides?: Partial<MoveDefinition>): MoveDefinition {
    return {
      ...base,
      effects: [...base.effects],
      ...overrides,
    };
  }
}
