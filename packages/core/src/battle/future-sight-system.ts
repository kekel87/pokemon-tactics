import type { PokemonType } from "../enums/pokemon-type";
import { StatName } from "../enums/stat-name";
import type { BattleState } from "../types/battle-state";
import type { PendingStrike } from "../types/pending-strike";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { TypeChart } from "../types/type-chart";
import { manhattanDistance } from "../utils/manhattan-distance";
import type { RandomFn } from "../utils/prng";
import { getStab, getTypeEffectiveness } from "./damage-calculator";
import { getEffectiveStat } from "./stat-modifier";

/** Level is fixed at 50 across the project (Champions style), matching the damage calculator. */
const BATTLE_LEVEL = 50;

export interface FutureSightOffenseSnapshot {
  attacker: PokemonInstance;
  attackerTypes: PokemonType[];
  moveType: PokemonType;
  power: number;
}

/**
 * Builds the frozen-offense payload for a Prescience strike from the caster's state at cast: the
 * effective Special Attack (base stat with stages) and the STAB multiplier from the caster's types.
 * Canon "no boosts from item/Ability once the user is gone" is honoured implicitly — only these two
 * scalars are frozen, no item/ability hooks are replayed at landing.
 */
export function freezeOffense(
  snapshot: FutureSightOffenseSnapshot,
): PendingStrike["frozenOffense"] {
  const specialAttack = getEffectiveStat(
    snapshot.attacker.combatStats.spAttack,
    snapshot.attacker.statStages[StatName.SpAttack] ?? 0,
  );
  return {
    specialAttack,
    power: snapshot.power,
    moveType: snapshot.moveType,
    stabMultiplier: getStab(snapshot.moveType, snapshot.attackerTypes),
  };
}

/** True when a Prescience strike is already locked on this tile (canon "one per slot"). */
export function hasStrikeOnTile(state: BattleState, tile: Position): boolean {
  return state.pendingStrikes.some(
    (strike) => strike.centerPosition.x === tile.x && strike.centerPosition.y === tile.y,
  );
}

/**
 * Computes the special damage a frozen-offense strike deals to a single defender. Mirrors the core
 * of the damage calculator (level 50, special split, STAB, type effectiveness, fixed roll) but with
 * the attacker side frozen and no item/ability/crit modifiers. Returns 0 on an immune defender.
 */
export function computeStrikeDamage(
  frozenOffense: PendingStrike["frozenOffense"],
  defender: PokemonInstance,
  defenderTypes: PokemonType[],
  typeChart: TypeChart,
  roll: number,
): number {
  const effectiveness = getTypeEffectiveness(frozenOffense.moveType, defenderTypes, typeChart);
  if (effectiveness === 0) {
    return 0;
  }
  const effectiveDefense = getEffectiveStat(
    defender.combatStats.spDefense,
    defender.statStages[StatName.SpDefense] ?? 0,
  );
  const adjustedPower = Math.max(1, frozenOffense.power);
  const baseDamage = Math.floor(
    (((2 * BATTLE_LEVEL) / 5 + 2) * adjustedPower * frozenOffense.specialAttack) /
      effectiveDefense /
      50 +
      2,
  );
  return Math.max(1, Math.floor(baseDamage * frozenOffense.stabMultiplier * effectiveness * roll));
}

/** A single landing resolution: who was hit, how much, and who fainted. */
export interface StrikeLanding {
  strike: PendingStrike;
  hits: { pokemonId: string; damage: number; fainted: boolean }[];
}

export interface FutureSightTickDeps {
  typeChart: TypeChart;
  pokemonTypesMap: Map<string, PokemonType[]>;
  random: RandomFn;
}

/**
 * Advances every Prescience strike owned by `casterId` by one of the caster's turns. Strikes that
 * reach 0 land: each living Pokemon within the AoE (Manhattan radius of the locked tile, friendly
 * fire included) takes frozen-offense damage computed against its live defense. Mutates HP and
 * removes resolved strikes from state. Returns the landings (empty array if nothing resolved this
 * turn). Called from the engine on both the caster's live turn and its ghost turns (post-KO).
 */
export function tickFutureSightStrikesForCaster(
  state: BattleState,
  casterId: string,
  deps: FutureSightTickDeps,
): StrikeLanding[] {
  const landings: StrikeLanding[] = [];
  const survivors: PendingStrike[] = [];

  for (const strike of state.pendingStrikes) {
    if (strike.casterId !== casterId) {
      survivors.push(strike);
      continue;
    }
    strike.turnsRemaining -= 1;
    if (strike.turnsRemaining > 0) {
      survivors.push(strike);
      continue;
    }
    landings.push(resolveLanding(state, strike, deps));
  }

  state.pendingStrikes = survivors;
  return landings;
}

function resolveLanding(
  state: BattleState,
  strike: PendingStrike,
  deps: FutureSightTickDeps,
): StrikeLanding {
  const hits: StrikeLanding["hits"] = [];
  for (const pokemon of state.pokemon.values()) {
    if (pokemon.currentHp <= 0) {
      continue;
    }
    if (manhattanDistance(strike.centerPosition, pokemon.position) > strike.radius) {
      continue;
    }
    const defenderTypes = deps.pokemonTypesMap.get(pokemon.definitionId) ?? [];
    const roll = deps.random() * 0.15 + 0.85;
    const damage = computeStrikeDamage(
      strike.frozenOffense,
      pokemon,
      defenderTypes,
      deps.typeChart,
      roll,
    );
    if (damage <= 0) {
      continue;
    }
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    hits.push({ pokemonId: pokemon.id, damage, fainted: pokemon.currentHp <= 0 });
  }
  return { strike, hits };
}
