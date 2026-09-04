import {
  ActionKind,
  Direction,
  Nature,
  type PlacementEntry,
  type PlacementTeam,
  PlayerController,
  PlayerId,
  StatName,
  type StatSpread,
} from "@pokemon-tactic/core";
import type { BattleResumeSave } from "../app/battle-persistence";
import type { CombatSetup } from "../app/screens";
import type { BattleInputs } from "../babylon/battle-resume";

/**
 * Battle-resume fixtures (plan 181): one starting position shared by the persistence tests (what a
 * save looks like) and the resume tests (what it rebuilds). Both used to carry their own copy, which
 * is exactly how two tests of the same feature start disagreeing about its shape.
 *
 * The placements sit side by side on `pocArena` so the two Pokémon are in range of each other from the
 * first turn — a log full of real attacks is what makes the state comparison meaningful.
 */
export abstract class MockBattleResume {
  static readonly mapUrl = "assets/maps/simple-arena.tmj";

  static readonly setup: CombatSetup = {
    teams: [
      {
        playerId: PlayerId.Player1,
        pokemonDefinitionIds: ["pikachu"],
        controller: PlayerController.Human,
      },
      {
        playerId: PlayerId.Player2,
        pokemonDefinitionIds: ["bulbasaur"],
        controller: PlayerController.Ai,
      },
    ],
    formatKey: "2v1",
    autoPlacement: true,
    damagePreview: true,
  };

  static readonly placementTeams: PlacementTeam[] = [
    {
      playerId: PlayerId.Player1,
      availablePokemonIds: ["p1-pikachu"],
      controller: PlayerController.Human,
    },
    {
      playerId: PlayerId.Player2,
      availablePokemonIds: ["p2-bulbasaur"],
      controller: PlayerController.Ai,
    },
  ];

  static readonly placements: PlacementEntry[] = [
    { pokemonId: "p1-pikachu", position: { x: 4, y: 5 }, direction: Direction.East },
    { pokemonId: "p2-bulbasaur", position: { x: 5, y: 5 }, direction: Direction.West },
  ];

  static readonly seed = 987_654;

  static readonly evenStatSpread: StatSpread = {
    [StatName.Hp]: 0,
    [StatName.Attack]: 0,
    [StatName.Defense]: 0,
    [StatName.SpAttack]: 0,
    [StatName.SpDefense]: 0,
    [StatName.Speed]: 0,
  };

  /** The battle's starting position, as both the live path and the resume path consume it. */
  static readonly inputs: BattleInputs = {
    setup: MockBattleResume.setup,
    placementTeams: MockBattleResume.placementTeams,
    placements: MockBattleResume.placements,
    seed: MockBattleResume.seed,
  };

  /**
   * Same position, but with movesets pinned to hard-hitting attacks, for tests that need the battle to
   * actually END. The default moveset is `movepool.slice(0, 4)`, which for these two is all status
   * moves (Rapidité, Rugissement…): a battle driven from it never kills anyone.
   */
  static readonly lethalInputs: BattleInputs = {
    ...MockBattleResume.inputs,
    setup: {
      ...MockBattleResume.setup,
      teams: [
        {
          ...MockBattleResume.setup.teams[0],
          playerId: PlayerId.Player1,
          pokemonDefinitionIds: ["pikachu"],
          controller: PlayerController.Human,
          slots: [
            {
              pokemonId: "pikachu",
              ability: "static",
              nature: Nature.Hardy,
              moveIds: ["thunderbolt"],
              statSpread: MockBattleResume.evenStatSpread,
            },
          ],
        },
        {
          ...MockBattleResume.setup.teams[1],
          playerId: PlayerId.Player2,
          pokemonDefinitionIds: ["bulbasaur"],
          controller: PlayerController.Ai,
          slots: [
            {
              pokemonId: "bulbasaur",
              ability: "overgrow",
              nature: Nature.Hardy,
              moveIds: ["tackle"],
              statSpread: MockBattleResume.evenStatSpread,
            },
          ],
        },
      ],
    },
  };

  /** A minimal one-action log, for tests that only care about storage round-tripping. */
  static readonly savedProgress: Omit<BattleResumeSave, "version" | "buildVersion"> = {
    mapUrl: MockBattleResume.mapUrl,
    setup: MockBattleResume.setup,
    placementTeams: MockBattleResume.placementTeams,
    placements: MockBattleResume.placements,
    seed: MockBattleResume.seed,
    actions: [{ kind: ActionKind.EndTurn, pokemonId: "p1-pikachu", direction: Direction.East }],
  };
}
