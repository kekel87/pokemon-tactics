export interface StatusRules {
  paralysis: {
    skipRate: number;
    speedMult: number;
  };
  freeze: {
    thawRate: number;
    maxTurns: number;
  };
  sleep: {
    sampleTurns: number[];
  };
}

export const DEFAULT_STATUS_RULES: StatusRules = {
  paralysis: { skipRate: 1 / 8, speedMult: 0.5 },
  freeze: { thawRate: 1 / 4, maxTurns: 3 },
  sleep: { sampleTurns: [2, 3, 3] },
};
