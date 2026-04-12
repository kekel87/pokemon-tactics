import type { PokemonType } from "@pokemon-tactic/core";
import typeChartReference from "../reference/type-chart.json";
import { loadTypeChartFromReference } from "./loaders/load-type-chart";
import type { ReferenceTypeChart } from "./loaders/reference-types";

type TypeEffectiveness = Record<PokemonType, Record<PokemonType, number>>;

export const typeChart: TypeEffectiveness = loadTypeChartFromReference(
  typeChartReference as unknown as ReferenceTypeChart,
);
