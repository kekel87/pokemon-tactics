import type { Direction } from "@pokemon-tactic/core";
import type {
  CombatPokemonHandle,
  CombatScene,
  CombatSceneSpawn,
} from "@pokemon-tactic/render-ports";

/**
 * Double de `CombatScene` : `addPokemon` est la seule méthode que `spawnBillboardsFromState` appelle,
 * toute autre lève — un appel de plus dans le code doit casser le test, pas passer en silence.
 */
export function createCombatSceneDouble(): {
  scene: CombatScene;
  spawns: CombatSceneSpawn[];
  facings: Direction[];
} {
  const spawns: CombatSceneSpawn[] = [];
  const facings: Direction[] = [];
  const handle = {
    setFacing: (direction: Direction) => facings.push(direction),
  } as unknown as CombatPokemonHandle;
  const scene = new Proxy({} as CombatScene, {
    get(_target, property) {
      if (property === "addPokemon") {
        return (entry: CombatSceneSpawn) => {
          spawns.push(entry);
          return handle;
        };
      }
      throw new Error(`CombatSceneDouble ne connaît pas « ${String(property)} »`);
    },
  });
  return { scene, spawns, facings };
}
