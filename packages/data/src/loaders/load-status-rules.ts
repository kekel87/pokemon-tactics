import type { StatusRules } from "@pokemon-tactic/core";

interface ChampionsStatusFile {
  source: string;
  fetchedAt: string;
  status: {
    paralysis?: { skipRate?: number; speedMult?: number };
    freeze?: { thawRate?: number; maxTurns?: number };
    sleep?: { minTurns?: number; maxTurns?: number; sampleTurns?: number[] };
  };
}

export function loadStatusRulesFromReference(file: ChampionsStatusFile): StatusRules {
  const s = file.status;
  return {
    paralysis: {
      skipRate: s.paralysis?.skipRate ?? 1 / 8,
      speedMult: s.paralysis?.speedMult ?? 0.5,
    },
    freeze: {
      thawRate: s.freeze?.thawRate ?? 1 / 4,
      maxTurns: s.freeze?.maxTurns ?? 3,
    },
    sleep: {
      sampleTurns: s.sleep?.sampleTurns ?? [2, 3, 3],
    },
  };
}
