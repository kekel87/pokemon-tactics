/**
 * Team identity colours (plan 125). Shared by the presentation layer (timeline /
 * field-terrain pills) and every renderer (UI team-select, Babylon board), so
 * they live in the contract package — the single leaf both sides depend on.
 */
export const TEAM_COLORS: readonly number[] = [
  0x2255aa, // Player 1 — Blue
  0xaa2233, // Player 2 — Red
  0x22aa44, // Player 3 — Green
  0xccaa00, // Player 4 — Yellow
  0x8833aa, // Player 5 — Purple
  0xdd6622, // Player 6 — Orange
  0x22aaaa, // Player 7 — Cyan
  0xdd4488, // Player 8 — Pink
  0x88cc22, // Player 9 — Lime
  0x885522, // Player 10 — Brown
  0x4488dd, // Player 11 — Light blue
  0x777777, // Player 12 — Grey
];

const FALLBACK_TEAM_COLOR = 0x2255aa;

/** Resolve a 1-based team number to its colour (falls back to team 1's blue). */
export function teamColorByIndex(team: number): number {
  return TEAM_COLORS[team - 1] ?? FALLBACK_TEAM_COLOR;
}

/** Resolve a 0-based team index to a CSS hex string (falls back to team 1's blue). */
export function teamColorToHex(index: number): string {
  const value = TEAM_COLORS[index] ?? FALLBACK_TEAM_COLOR;
  return `#${value.toString(16).padStart(6, "0")}`;
}

/** Resolve a `player-N` id to its team colour (falls back to team 1's blue). */
export function getTeamColorByPlayerId(playerId: string): number {
  const match = playerId.match(/player-(\d+)/);
  if (!match) {
    return FALLBACK_TEAM_COLOR;
  }
  const index = Number.parseInt(match[1] ?? "1", 10) - 1;
  return TEAM_COLORS[index] ?? FALLBACK_TEAM_COLOR;
}
