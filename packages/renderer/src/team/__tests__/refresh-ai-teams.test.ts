import { PlayerController, type TeamSet } from "@pokemon-tactic/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshAllAiSlots } from "../refresh-ai-teams";

vi.mock("../team-generator", () => ({
  generateRandomTeam: vi.fn(
    (opts: { name: string }): TeamSet => ({
      id: `gen-${Math.random()}`,
      name: opts.name,
      slots: [],
      createdAt: 0,
      updatedAt: 0,
    }),
  ),
}));

interface Slot {
  controller: PlayerController;
  assignedTeam: TeamSet | null;
  assignedTeamId: string | null;
  label: string;
}

const humanTeam: TeamSet = {
  id: "human-team",
  name: "Champions",
  slots: [],
  createdAt: 1,
  updatedAt: 1,
};

const aiSavedTeam: TeamSet = {
  id: "ai-team",
  name: "Stall",
  slots: [],
  createdAt: 2,
  updatedAt: 2,
};

describe("refreshAllAiSlots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("regenerates AI slots, leaves human slots intact", () => {
    const slots: Slot[] = [
      {
        controller: PlayerController.Human,
        assignedTeam: humanTeam,
        assignedTeamId: humanTeam.id,
        label: "J1",
      },
      {
        controller: PlayerController.Ai,
        assignedTeam: aiSavedTeam,
        assignedTeamId: aiSavedTeam.id,
        label: "J2",
      },
    ];
    const refreshed = refreshAllAiSlots(slots, "Aléatoire");
    expect(refreshed[0]?.assignedTeam).toBe(humanTeam);
    expect(refreshed[0]?.assignedTeamId).toBe(humanTeam.id);
    expect(refreshed[1]?.assignedTeam?.name).toBe("Aléatoire");
    expect(refreshed[1]?.assignedTeamId).toBeNull();
  });

  it("returns same shape (no controller mutation)", () => {
    const slots: Slot[] = [
      { controller: PlayerController.Ai, assignedTeam: null, assignedTeamId: null, label: "J1" },
    ];
    const refreshed = refreshAllAiSlots(slots, "Aléatoire");
    expect(refreshed[0]?.controller).toBe(PlayerController.Ai);
    expect(refreshed[0]?.label).toBe("J1");
    expect(refreshed[0]?.assignedTeam).not.toBeNull();
  });
});
