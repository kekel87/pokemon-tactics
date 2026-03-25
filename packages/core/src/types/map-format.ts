import type { SpawnZone } from "./spawn-zone";

export interface MapFormat {
  teamCount: number;
  maxPokemonPerTeam: number;
  spawnZones: SpawnZone[];
}
