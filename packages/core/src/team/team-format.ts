export const TeamFormat = {
  OneVsOne: "1v1",
  TwoVsTwo: "2v2",
  ThreeVsThree: "3v3",
  FourVsFour: "4v4",
  SixVsSix: "6v6",
} as const;

export type TeamFormat = (typeof TeamFormat)[keyof typeof TeamFormat];

export const TEAM_FORMAT_PARTICIPANT_COUNT: Record<TeamFormat, number> = {
  [TeamFormat.OneVsOne]: 1,
  [TeamFormat.TwoVsTwo]: 2,
  [TeamFormat.ThreeVsThree]: 3,
  [TeamFormat.FourVsFour]: 4,
  [TeamFormat.SixVsSix]: 6,
};
