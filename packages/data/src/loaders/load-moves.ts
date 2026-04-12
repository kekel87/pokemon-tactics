import type { Category, MoveFlags, PokemonType } from "@pokemon-tactic/core";
import type { ReferenceMove } from "./reference-types";

interface BaseMoveData {
  id: string;
  name: string;
  type: PokemonType;
  category: Category;
  power: number;
  accuracy: number;
  pp: number;
  ignoresHeight?: boolean;
  flags?: MoveFlags;
}

const RELEVANT_FLAGS: (keyof MoveFlags)[] = [
  "contact",
  "sound",
  "bullet",
  "wind",
  "powder",
  "pulse",
  "punch",
  "bite",
  "slicing",
  "dance",
  "protect",
  "mirror",
  "snatch",
  "metronome",
  "bypasssub",
  "reflectable",
  "charge",
  "recharge",
  "gravity",
  "heal",
];

function extractFlags(refFlags: Record<string, boolean>): MoveFlags | undefined {
  const flags: MoveFlags = {};
  let hasFlag = false;
  for (const key of RELEVANT_FLAGS) {
    if (refFlags[key]) {
      (flags as Record<string, boolean>)[key] = true;
      hasFlag = true;
    }
  }
  return hasFlag ? flags : undefined;
}

export function loadMovesFromReference(
  referenceData: ReferenceMove[],
  moveIds: Set<string>,
): BaseMoveData[] {
  const referenceById = new Map<string, ReferenceMove>();
  for (const move of referenceData) {
    referenceById.set(move.id, move);
  }

  const result: BaseMoveData[] = [];

  for (const moveId of moveIds) {
    const ref = referenceById.get(moveId);
    if (!ref) {
      throw new Error(`Move "${moveId}" not found in reference data`);
    }

    const flags = extractFlags(ref.flags);

    result.push({
      id: ref.id,
      name: ref.names.en,
      type: ref.type as PokemonType,
      category: ref.category as Category,
      power: ref.power ?? 0,
      accuracy: ref.accuracy ?? 100,
      pp: ref.pp,
      ...(flags ? { flags } : {}),
    });
  }

  return result;
}
