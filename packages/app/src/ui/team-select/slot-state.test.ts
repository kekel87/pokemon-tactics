import { AiDifficulty, DEFAULT_AI_DIFFICULTY, PlayerController } from "@pokemon-tactic/core";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../team/team-storage", () => ({ loadTeam: () => null }));
vi.mock("../../team/last-selection", () => ({
  loadLastSelection: () => [],
  saveLastSelectionEntry: () => {},
}));

const { buildTeamSelections, setSlotController } = await import("./slot-state");

function aiSlot(aiDifficulty = DEFAULT_AI_DIFFICULTY) {
  return {
    controller: PlayerController.Ai,
    aiDifficulty,
    assignedTeam: null,
    assignedTeamId: null,
    ephemeral: false,
  };
}

describe("setSlotController — le niveau d'IA (plan 214)", () => {
  it("pose le niveau demandé en donnant la place à l'IA", () => {
    const slot = {
      controller: PlayerController.Human,
      aiDifficulty: DEFAULT_AI_DIFFICULTY,
      assignedTeam: null,
      assignedTeamId: null,
      ephemeral: false,
    };

    expect(setSlotController(slot, PlayerController.Ai, AiDifficulty.Hard)).toBe(true);
    expect(slot.controller).toBe(PlayerController.Ai);
    expect(slot.aiDifficulty).toBe(AiDifficulty.Hard);
  });

  /*
   * 🔴 Le cas qui casserait l'écran sans ce test : le segment du plan 214 porte TROIS boutons IA.
   * Passer de « IA Moyenne » à « IA Difficile » ne change pas le contrôleur — l'ancienne garde
   * `slot.controller === controller` rendait donc `false` et la bascule était MUETTE.
   */
  it("change le seul niveau d'une place déjà tenue par l'IA", () => {
    const slot = aiSlot(AiDifficulty.Medium);

    expect(setSlotController(slot, PlayerController.Ai, AiDifficulty.Hard)).toBe(true);
    expect(slot.aiDifficulty).toBe(AiDifficulty.Hard);
  });

  /*
   * L'équipe aléatoire déjà tirée pour cette place ne doit PAS être re-tirée en changeant le niveau :
   * l'humain verrait son adversaire changer d'équipe sous ses yeux pour avoir touché la difficulté.
   */
  it("garde l'équipe déjà tirée en changeant le niveau", () => {
    const slot = aiSlot(AiDifficulty.Easy);
    slot.assignedTeam = { name: "Équipe éphémère", slots: [] } as never;
    slot.ephemeral = true;
    const team = slot.assignedTeam;

    setSlotController(slot, PlayerController.Ai, AiDifficulty.Hard);

    expect(slot.assignedTeam).toBe(team);
  });

  it("ne bouge pas quand le niveau demandé est déjà celui de la place", () => {
    const slot = aiSlot(AiDifficulty.Hard);
    expect(setSlotController(slot, PlayerController.Ai, AiDifficulty.Hard)).toBe(false);
  });

  it("garde le niveau de la place quand l'appelant n'en précise aucun", () => {
    const slot = aiSlot(AiDifficulty.Hard);
    setSlotController(slot, PlayerController.Human);
    expect(slot.aiDifficulty).toBe(AiDifficulty.Hard);
  });
});

describe("buildTeamSelections — la frontière entre état local et contrat sérialisé", () => {
  it("ne porte le niveau que sur les places tenues par l'IA", () => {
    const human = {
      controller: PlayerController.Human,
      aiDifficulty: AiDifficulty.Hard,
      assignedTeam: { name: "moi", slots: [] },
      assignedTeamId: "t1",
      ephemeral: false,
    };
    const ai = {
      ...aiSlot(AiDifficulty.Easy),
      assignedTeam: { name: "elle", slots: [] },
    };

    const selections = buildTeamSelections([human, ai] as never);

    expect(selections?.[0]?.aiDifficulty).toBeUndefined();
    expect(selections?.[1]?.aiDifficulty).toBe(AiDifficulty.Easy);
  });
});
