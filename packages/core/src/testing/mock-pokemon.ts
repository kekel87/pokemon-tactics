import { Direction } from "../enums/direction";
import { PlayerId } from "../enums/player-id";
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
    playerId: PlayerId.Player1,
    level: 50,
    currentHp: 100,
    maxHp: 100,
    baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
    combatStats: { hp: 100, attack: 55, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
    derivedStats: { movement: 3, jump: 1, initiative: 55 },
    statStages: { ...ZERO_STAT_STAGES },
    statusEffects: [],
    position: { x: 0, y: 0 },
    orientation: Direction.South,
    moveIds: [],
    currentPp: {},
    activeDefense: null,
    lastEndureRound: null,
    toxicCounter: 0,
    volatileStatuses: [],
    recharging: false,
  };

  static readonly bulbasaur: PokemonInstance = {
    id: "bulbasaur-1",
    definitionId: "bulbasaur",
    playerId: PlayerId.Player1,
    level: 50,
    currentHp: 105,
    maxHp: 105,
    baseStats: { hp: 45, attack: 49, defense: 49, spAttack: 65, spDefense: 65, speed: 45 },
    combatStats: { hp: 105, attack: 54, defense: 54, spAttack: 70, spDefense: 70, speed: 50 },
    derivedStats: { movement: 3, jump: 1, initiative: 50 },
    statStages: { ...ZERO_STAT_STAGES },
    statusEffects: [],
    position: { x: 0, y: 0 },
    orientation: Direction.South,
    moveIds: ["razor-leaf", "sleep-powder", "leech-seed", "sludge-bomb"],
    currentPp: { "razor-leaf": 25, "sleep-powder": 15, "leech-seed": 10, "sludge-bomb": 10 },
    activeDefense: null,
    lastEndureRound: null,
    toxicCounter: 0,
    volatileStatuses: [],
    recharging: false,
  };

  static readonly charmander: PokemonInstance = {
    id: "charmander-1",
    definitionId: "charmander",
    playerId: PlayerId.Player1,
    level: 50,
    currentHp: 99,
    maxHp: 99,
    baseStats: { hp: 39, attack: 52, defense: 43, spAttack: 60, spDefense: 50, speed: 65 },
    combatStats: { hp: 99, attack: 57, defense: 48, spAttack: 65, spDefense: 55, speed: 70 },
    derivedStats: { movement: 3, jump: 1, initiative: 70 },
    statStages: { ...ZERO_STAT_STAGES },
    statusEffects: [],
    position: { x: 0, y: 0 },
    orientation: Direction.South,
    moveIds: ["ember", "scratch", "smokescreen", "dragon-breath"],
    currentPp: { ember: 25, scratch: 35, smokescreen: 20, "dragon-breath": 20 },
    activeDefense: null,
    lastEndureRound: null,
    toxicCounter: 0,
    volatileStatuses: [],
    recharging: false,
  };

  static readonly squirtle: PokemonInstance = {
    id: "squirtle-1",
    definitionId: "squirtle",
    playerId: PlayerId.Player1,
    level: 50,
    currentHp: 104,
    maxHp: 104,
    baseStats: { hp: 44, attack: 48, defense: 65, spAttack: 50, spDefense: 64, speed: 43 },
    combatStats: { hp: 104, attack: 53, defense: 70, spAttack: 55, spDefense: 69, speed: 48 },
    derivedStats: { movement: 3, jump: 1, initiative: 48 },
    statStages: { ...ZERO_STAT_STAGES },
    statusEffects: [],
    position: { x: 0, y: 0 },
    orientation: Direction.South,
    moveIds: ["water-gun", "tackle", "withdraw", "bubble-beam"],
    currentPp: { "water-gun": 25, tackle: 35, withdraw: 40, "bubble-beam": 20 },
    activeDefense: null,
    lastEndureRound: null,
    toxicCounter: 0,
    volatileStatuses: [],
    recharging: false,
  };

  static readonly pidgey: PokemonInstance = {
    id: "pidgey-1",
    definitionId: "pidgey",
    playerId: PlayerId.Player1,
    level: 50,
    currentHp: 100,
    maxHp: 100,
    baseStats: { hp: 40, attack: 45, defense: 40, spAttack: 35, spDefense: 35, speed: 56 },
    combatStats: { hp: 100, attack: 50, defense: 45, spAttack: 40, spDefense: 40, speed: 61 },
    derivedStats: { movement: 4, jump: 2, initiative: 61 },
    statStages: { ...ZERO_STAT_STAGES },
    statusEffects: [],
    position: { x: 0, y: 0 },
    orientation: Direction.South,
    moveIds: ["gust", "quick-attack", "sand-attack", "wing-attack"],
    currentPp: { gust: 35, "quick-attack": 30, "sand-attack": 15, "wing-attack": 35 },
    activeDefense: null,
    lastEndureRound: null,
    toxicCounter: 0,
    volatileStatuses: [],
    recharging: false,
  };

  static fresh(base: PokemonInstance, overrides?: Partial<PokemonInstance>): PokemonInstance {
    return {
      ...base,
      position: { ...base.position },
      baseStats: { ...base.baseStats },
      combatStats: { ...base.combatStats },
      derivedStats: { ...base.derivedStats },
      statStages: { ...base.statStages },
      statusEffects: [...base.statusEffects],
      volatileStatuses: [...base.volatileStatuses],
      moveIds: [...base.moveIds],
      currentPp: { ...base.currentPp },
      ...overrides,
    };
  }
}
