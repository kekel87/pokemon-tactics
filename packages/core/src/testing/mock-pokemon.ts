import { Direction } from "../enums/direction";
import type { StatName as StatNameType } from "../enums/stat-name";
import { StatName } from "../enums/stat-name";
import type { PokemonInstance } from "../types/pokemon-instance";

const ZERO_STAT_STAGES: Record<StatNameType, number> = {
  [StatName.Hp]: 0,
  [StatName.Attack]: 0,
  [StatName.Defense]: 0,
  [StatName.SpAttack]: 0,
  [StatName.SpDefense]: 0,
  [StatName.Speed]: 0,
  [StatName.Accuracy]: 0,
  [StatName.Evasion]: 0,
};

export abstract class MockPokemon {
  static readonly base: PokemonInstance = {
    id: "pokemon-1",
    definitionId: "test",
    playerId: "player-1",
    currentHp: 100,
    maxHp: 100,
    baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
    derivedStats: { movement: 3, jump: 1, initiative: 50 },
    statStages: { ...ZERO_STAT_STAGES },
    statusEffects: [],
    position: { x: 0, y: 0 },
    orientation: Direction.South,
    moveIds: [],
    currentPp: {},
    koCountdown: null,
  };

  static readonly bulbasaur: PokemonInstance = {
    id: "bulbasaur-1",
    definitionId: "bulbasaur",
    playerId: "player-1",
    currentHp: 45,
    maxHp: 45,
    baseStats: { hp: 45, attack: 49, defense: 49, spAttack: 65, spDefense: 65, speed: 45 },
    derivedStats: { movement: 3, jump: 1, initiative: 45 },
    statStages: { ...ZERO_STAT_STAGES },
    statusEffects: [],
    position: { x: 0, y: 0 },
    orientation: Direction.South,
    moveIds: ["razor-leaf", "sleep-powder", "leech-seed", "sludge-bomb"],
    currentPp: { "razor-leaf": 25, "sleep-powder": 15, "leech-seed": 10, "sludge-bomb": 10 },
    koCountdown: null,
  };

  static readonly charmander: PokemonInstance = {
    id: "charmander-1",
    definitionId: "charmander",
    playerId: "player-1",
    currentHp: 39,
    maxHp: 39,
    baseStats: { hp: 39, attack: 52, defense: 43, spAttack: 60, spDefense: 50, speed: 65 },
    derivedStats: { movement: 3, jump: 1, initiative: 65 },
    statStages: { ...ZERO_STAT_STAGES },
    statusEffects: [],
    position: { x: 0, y: 0 },
    orientation: Direction.South,
    moveIds: ["ember", "scratch", "smokescreen", "dragon-breath"],
    currentPp: { ember: 25, scratch: 35, smokescreen: 20, "dragon-breath": 20 },
    koCountdown: null,
  };

  static readonly squirtle: PokemonInstance = {
    id: "squirtle-1",
    definitionId: "squirtle",
    playerId: "player-1",
    currentHp: 44,
    maxHp: 44,
    baseStats: { hp: 44, attack: 48, defense: 65, spAttack: 50, spDefense: 64, speed: 43 },
    derivedStats: { movement: 3, jump: 1, initiative: 43 },
    statStages: { ...ZERO_STAT_STAGES },
    statusEffects: [],
    position: { x: 0, y: 0 },
    orientation: Direction.South,
    moveIds: ["water-gun", "tackle", "withdraw", "bubble-beam"],
    currentPp: { "water-gun": 25, tackle: 35, withdraw: 40, "bubble-beam": 20 },
    koCountdown: null,
  };

  static readonly pidgey: PokemonInstance = {
    id: "pidgey-1",
    definitionId: "pidgey",
    playerId: "player-1",
    currentHp: 40,
    maxHp: 40,
    baseStats: { hp: 40, attack: 45, defense: 40, spAttack: 35, spDefense: 35, speed: 56 },
    derivedStats: { movement: 4, jump: 2, initiative: 56 },
    statStages: { ...ZERO_STAT_STAGES },
    statusEffects: [],
    position: { x: 0, y: 0 },
    orientation: Direction.South,
    moveIds: ["gust", "quick-attack", "sand-attack", "wing-attack"],
    currentPp: { gust: 35, "quick-attack": 30, "sand-attack": 15, "wing-attack": 35 },
    koCountdown: null,
  };

  static fresh(base: PokemonInstance, overrides?: Partial<PokemonInstance>): PokemonInstance {
    return {
      ...base,
      position: { ...base.position },
      baseStats: { ...base.baseStats },
      derivedStats: { ...base.derivedStats },
      statStages: { ...base.statStages },
      statusEffects: [...base.statusEffects],
      moveIds: [...base.moveIds],
      currentPp: { ...base.currentPp },
      ...overrides,
    };
  }
}
