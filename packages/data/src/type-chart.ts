import type { PokemonType } from "@pokemon-tactic/core";
import typeChartReference from "../reference/type-chart.json";
import { deepFreeze } from "./deep-freeze";
import { loadTypeChartFromReference } from "./loaders/load-type-chart";
import type { ReferenceTypeChart } from "./loaders/reference-types";

type TypeEffectiveness = Record<PokemonType, Record<PokemonType, number>>;

// Frozen: the type chart is a shared module-level singleton passed to every engine (incl. every test
// engine under `isolate: false`). A mutation would silently poison other tests' damage math.
export const typeChart: TypeEffectiveness = deepFreeze(
  loadTypeChartFromReference(typeChartReference as unknown as ReferenceTypeChart),
);
