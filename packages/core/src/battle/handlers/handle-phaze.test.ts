import { describe, expect, it } from "vitest";
import { BattleEventType } from "../../enums/battle-event-type";
import { EffectKind } from "../../enums/effect-kind";
import { PlayerId } from "../../enums/player-id";
import { PokemonType } from "../../enums/pokemon-type";
import { MockBattle, MockPokemon } from "../../testing";
import type { MoveDefinition } from "../../types/move-definition";
import type { PokemonInstance } from "../../types/pokemon-instance";
import type { TypeChart } from "../../types/type-chart";
import type { EffectContext } from "../effect-handler-registry";
import { handlePhaze } from "./handle-phaze";

function buildContext(attacker: PokemonInstance, targets: PokemonInstance[]): EffectContext {
  const state = MockBattle.stateFrom([attacker, ...targets], 8, 8);
  const targetTypesMap = new Map<string, PokemonType[]>();
  for (const target of targets) {
    targetTypesMap.set(target.id, [PokemonType.Normal]);
  }
  return {
    attacker,
    targets,
    move: {} as unknown as MoveDefinition,
    effect: { kind: EffectKind.PhazeToSpawn },
    state,
    typeChart: {} as unknown as TypeChart,
    attackerTypes: [PokemonType.Normal],
    targetTypesMap,
    moveTypeOf: () => undefined,
    targetPosition: targets[0]?.position ?? attacker.position,
    random: () => 0,
    heightModifier: 1,
    terrainModifier: 1,
    facingModifierMap: new Map(),
    shared: { lastDamageDealt: 0 },
    pokemonInRadius: () => [],
  };
}

describe("handlePhaze", () => {
  it("ejects an enemy target back to its spawn tile", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      spawnPosition: { x: 6, y: 6 },
    });
    const context = buildContext(attacker, [enemy]);

    const events = handlePhaze(context);

    expect(events.map((event) => event.type)).toContain(BattleEventType.Teleported);
    expect(enemy.position).toEqual({ x: 6, y: 6 });
  });

  it("never phazes an ally caught in the effect area", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 2 },
      spawnPosition: { x: 6, y: 6 },
    });
    const context = buildContext(attacker, [ally]);

    const events = handlePhaze(context);

    expect(events).toHaveLength(0);
    expect(ally.position).toEqual({ x: 3, y: 2 });
  });

  it("skips a fainted target", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      spawnPosition: { x: 6, y: 6 },
      currentHp: 0,
    });
    const context = buildContext(attacker, [enemy]);

    const events = handlePhaze(context);

    expect(events).toHaveLength(0);
    expect(enemy.position).toEqual({ x: 3, y: 2 });
  });

  it("leaves the target in place when no safe spawn tile exists", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      spawnPosition: { x: 3, y: 2 },
    });
    const context = buildContext(attacker, [enemy]);

    const events = handlePhaze(context);

    expect(events).toHaveLength(0);
    expect(enemy.position).toEqual({ x: 3, y: 2 });
  });
});
