import {
  AiDifficulty,
  createPrng,
  DEFAULT_AI_DIFFICULTY,
  PlayerController,
  PlayerId,
  type TeamSet,
} from "@pokemon-tactic/core";
import { describe, expect, it, vi } from "vitest";
import { generateRandomTeamSlots } from "../../team/team-generator";

vi.mock("../../team/team-storage", () => ({ loadTeam: () => null }));
vi.mock("../../team/last-selection", () => ({
  loadLastSelection: () => [],
  saveLastSelectionEntry: () => undefined,
}));

const { assignTeamToSlot, buildTeamSelections, setSlotController, teamSelectionOf } = await import(
  "./slot-state"
);

function aiSlot(aiDifficulty = DEFAULT_AI_DIFFICULTY) {
  return {
    controller: PlayerController.Ai,
    aiDifficulty,
    assignedTeam: null,
    assignedTeamId: null,
    ephemeral: false,
  };
}

function randomSlot(controller = PlayerController.Ai) {
  return {
    controller,
    aiDifficulty: DEFAULT_AI_DIFFICULTY,
    assignedTeam: null,
    assignedTeamId: null,
    ephemeral: true,
  };
}

function savedTeam(seed: number): TeamSet {
  return {
    id: `team-${seed}`,
    name: `Équipe ${seed}`,
    slots: generateRandomTeamSlots(createPrng(seed)),
    createdAt: 0,
    updatedAt: 0,
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

  it("change le seul niveau d'une place déjà tenue par l'IA", () => {
    const slot = aiSlot(AiDifficulty.Medium);

    expect(setSlotController(slot, PlayerController.Ai, AiDifficulty.Hard)).toBe(true);
    expect(slot.aiDifficulty).toBe(AiDifficulty.Hard);
  });

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

    const selections = buildTeamSelections([human, ai] as never, new Map());

    expect(selections?.[0]?.aiDifficulty).toBeUndefined();
    expect(selections?.[1]?.aiDifficulty).toBe(AiDifficulty.Easy);
  });
});

const GRAINE_4242 = ["farfetch-d", "golbat", "kabutops", "ponyta", "exeggcute", "gloom"];

describe("buildTeamSelections — le tirage différé au lancement", () => {
  it("tire six Pokemon pour un camp aléatoire, depuis la graine de son index", () => {
    const selections = buildTeamSelections([randomSlot()], new Map([[0, 4242]]));

    expect(selections?.[0]?.pokemonDefinitionIds).toEqual(GRAINE_4242);
  });

  it("rend des équipes différentes pour des graines différentes", () => {
    const first = buildTeamSelections([randomSlot()], new Map([[0, 1]]));
    const second = buildTeamSelections([randomSlot()], new Map([[0, 2]]));

    expect(second?.[0]?.pokemonDefinitionIds).not.toEqual(first?.[0]?.pokemonDefinitionIds);
  });

  it("donne à chaque camp la graine de SON index, et pas celle du voisin", () => {
    const selections = buildTeamSelections(
      [randomSlot(), randomSlot()],
      new Map([
        [0, 11],
        [1, 22],
      ]),
    );
    const swapped = buildTeamSelections(
      [randomSlot(), randomSlot()],
      new Map([
        [0, 22],
        [1, 11],
      ]),
    );

    expect(swapped?.[0]?.pokemonDefinitionIds).toEqual(selections?.[1]?.pokemonDefinitionIds);
    expect(swapped?.[1]?.pokemonDefinitionIds).toEqual(selections?.[0]?.pokemonDefinitionIds);
  });

  it("🔴 refuse de composer quand un camp aléatoire n'a pas de graine", () => {
    expect(buildTeamSelections([randomSlot()], new Map())).toBeNull();
  });

  it("refuse de composer quand un camp est vide sans être aléatoire", () => {
    expect(buildTeamSelections([aiSlot()], new Map([[0, 7]]))).toBeNull();
  });

  it("refuse de composer au-delà des douze places du jeu", () => {
    const slots = Array.from({ length: 13 }, () => randomSlot());
    const seeds = new Map(slots.map((_, index) => [index, index + 1]));

    expect(buildTeamSelections(slots, seeds)).toBeNull();
  });

  it("ignore la graine d'un camp dont l'équipe est déjà assignée", () => {
    const slot = { ...aiSlot(), assignedTeam: savedTeam(3) };

    const selections = buildTeamSelections([slot], new Map([[0, 999]]));

    expect(selections?.[0]?.slots).toEqual(savedTeam(3).slots);
  });

  it("fait concorder les identifiants annoncés et les emplacements composés", () => {
    const selections = buildTeamSelections([randomSlot()], new Map([[0, 55]]));

    expect(selections?.[0]?.pokemonDefinitionIds).toEqual(
      selections?.[0]?.slots?.map((slot) => slot.pokemonId),
    );
  });

  it("🔴 ne laisse fuir NI identifiant NI horodatage vers le combat", () => {
    const selections = buildTeamSelections([randomSlot()], new Map([[0, 8]]));

    expect(selections?.[0]).not.toHaveProperty("id");
    expect(selections?.[0]).not.toHaveProperty("createdAt");
    for (const slot of selections?.[0]?.slots ?? []) {
      expect(slot).not.toHaveProperty("id");
      expect(slot).not.toHaveProperty("createdAt");
    }
  });
});

describe("teamSelectionOf", () => {
  it("dérive les identifiants annoncés des emplacements composés", () => {
    const slots = savedTeam(12).slots;

    const selection = teamSelectionOf(
      { controller: PlayerController.Human, aiDifficulty: AiDifficulty.Hard },
      PlayerId.Player1,
      slots,
    );

    expect(selection.pokemonDefinitionIds).toEqual(slots.map((slot) => slot.pokemonId));
    expect(selection.playerId).toBe(PlayerId.Player1);
  });

  it("recopie les emplacements au lieu de partager la référence de l'appelant", () => {
    const slots = savedTeam(13).slots;

    const selection = teamSelectionOf(
      { controller: PlayerController.Ai, aiDifficulty: AiDifficulty.Easy },
      PlayerId.Player2,
      slots,
    );

    expect(selection.slots).toEqual(slots);
    expect(selection.slots).not.toBe(slots);
  });

  it("ne porte le niveau que sur une place tenue par l'IA", () => {
    const human = teamSelectionOf(
      { controller: PlayerController.Human, aiDifficulty: AiDifficulty.Hard },
      PlayerId.Player1,
      [],
    );
    const ai = teamSelectionOf(
      { controller: PlayerController.Ai, aiDifficulty: AiDifficulty.Hard },
      PlayerId.Player2,
      [],
    );

    expect(human.aiDifficulty).toBeUndefined();
    expect(ai.aiDifficulty).toBe(AiDifficulty.Hard);
  });
});

describe("l'intention « Aléatoire », et non l'équipe", () => {
  it("🔴 donner une place à l'IA pose l'intention, sans tirer d'équipe", () => {
    const slot = {
      controller: PlayerController.Human,
      aiDifficulty: DEFAULT_AI_DIFFICULTY,
      assignedTeam: null,
      assignedTeamId: null,
      ephemeral: false,
    };

    setSlotController(slot, PlayerController.Ai);

    expect(slot.assignedTeam).toBeNull();
    expect(slot.ephemeral).toBe(true);
  });

  it("🔴 aucune bascule répétée ne fait apparaître d'équipe à comparer", () => {
    const slot = { ...aiSlot(), assignedTeam: savedTeam(1), ephemeral: false };

    setSlotController(slot, PlayerController.Human);
    setSlotController(slot, PlayerController.Ai);
    setSlotController(slot, PlayerController.Human);
    setSlotController(slot, PlayerController.Ai);

    expect(slot.assignedTeam).toBeNull();
    expect(slot.assignedTeamId).toBeNull();
    expect(slot.ephemeral).toBe(true);
  });

  it("rendre la place à un humain la laisse vide, et non aléatoire", () => {
    const slot = randomSlot();

    setSlotController(slot, PlayerController.Human);

    expect(slot.assignedTeam).toBeNull();
    expect(slot.ephemeral).toBe(false);
  });

  it("choisir « Aléatoire » au sélecteur pose l'intention plutôt que six Pokemon", () => {
    const slot = { ...aiSlot(), assignedTeam: savedTeam(2), assignedTeamId: "team-2" };

    expect(assignTeamToSlot(slot, 1, null)).toBe(true);
    expect(slot.assignedTeam).toBeNull();
    expect(slot.assignedTeamId).toBeNull();
    expect(slot.ephemeral).toBe(true);
  });
});
