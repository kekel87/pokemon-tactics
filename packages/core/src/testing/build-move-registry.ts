import { loadData } from "@pokemon-tactic/data";
import type { MoveDefinition } from "../types/move-definition";

export function buildMoveRegistry(): Map<string, MoveDefinition> {
  const registry = new Map<string, MoveDefinition>();
  for (const move of loadData().moves) {
    registry.set(move.id, move);
  }
  return registry;
}
