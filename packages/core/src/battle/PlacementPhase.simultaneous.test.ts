import { describe, expect, it } from "vitest";
import { Direction } from "../enums/direction";
import { PlacementMode } from "../enums/placement-mode";
import { PlayerId } from "../enums/player-id";
import { MockMap } from "../testing/mock-map";
import { createPrng } from "../utils/prng";
import { PlacementError, PlacementPhase } from "./PlacementPhase";

const { map6x6: testMap, format2v2: testFormat, team1, team2, gridCenter6x6: gridCenter } = MockMap;

/**
 * Le placement SIMULTANÉ (plan 211) — celui du multijoueur en ligne.
 *
 * L'alternance en serpentin suppose un seul écran : elle fait jouer les camps l'un après l'autre, et
 * chacun voit ce que l'autre pose. En réseau, chaque joueur a son propre écran et ne pilote QUE son
 * camp ; il pose ses Pokemon quand il veut, sans attendre personne, et ne voit rien des autres avant
 * le lancement du combat.
 *
 * Le hot-seat local reste en `Alternating` — sur un écran partagé, le simultané n'a aucun sens.
 */
describe("PlacementPhase — placement simultané", () => {
  describe("plus personne n'attend son tour", () => {
    it("accepte deux poses d'affilée du même camp, là où l'alternance l'interdisait", () => {
      const phase = MockMap.simultaneousPlacement();

      expect(phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East).success).toBe(true);
      expect(phase.submitPlacement("poke-b", { x: 1, y: 0 }, Direction.East).success).toBe(true);
    });

    it("accepte les camps dans n'importe quel ordre d'arrivée", () => {
      const phase = MockMap.simultaneousPlacement();

      expect(phase.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West).success).toBe(true);
      expect(phase.submitPlacement("poke-d", { x: 5, y: 4 }, Direction.West).success).toBe(true);
      expect(phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East).success).toBe(true);
      expect(phase.submitPlacement("poke-b", { x: 1, y: 0 }, Direction.East).success).toBe(true);

      expect(phase.isComplete()).toBe(true);
    });

    it("le propriétaire vient du Pokemon posé, plus du tour courant", () => {
      const phase = MockMap.simultaneousPlacement();

      const result = phase.submitPlacement("poke-c", { x: 0, y: 0 }, Direction.East);

      expect(result).toEqual({ success: false, error: PlacementError.PositionOutOfZone });
    });

    it("refuse un Pokemon qui n'appartient à aucun camp", () => {
      const phase = MockMap.simultaneousPlacement();

      const result = phase.submitPlacement("poke-inconnu", { x: 0, y: 0 }, Direction.East);

      expect(result).toEqual({ success: false, error: PlacementError.WrongPlayer });
    });
  });

  describe("les refus qui tiennent encore", () => {
    it("refuse une case déjà occupée, même par le camp d'en face", () => {
      const phase = MockMap.simultaneousPlacement();
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);

      const result = phase.submitPlacement("poke-b", { x: 0, y: 0 }, Direction.East);

      expect(result).toEqual({ success: false, error: PlacementError.PositionOccupied });
    });

    it("refuse un Pokemon déjà posé", () => {
      const phase = MockMap.simultaneousPlacement();
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);

      const result = phase.submitPlacement("poke-a", { x: 1, y: 0 }, Direction.East);

      expect(result).toEqual({ success: false, error: PlacementError.PokemonAlreadyPlaced });
    });

    it("refuse une pose supplémentaire quand l'équipe est pleine", () => {
      const phase = new PlacementPhase(
        testMap,
        [{ ...team1, availablePokemonIds: ["poke-a", "poke-b", "poke-x"] }, team2],
        testFormat,
        PlacementMode.Simultaneous,
      );
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      phase.submitPlacement("poke-b", { x: 1, y: 0 }, Direction.East);

      const result = phase.submitPlacement("poke-x", { x: 0, y: 1 }, Direction.East);

      expect(result).toEqual({ success: false, error: PlacementError.PlayerAlreadyDone });
    });

    it("refuse une pose d'un camp qui s'est déclaré prêt", () => {
      const phase = MockMap.simultaneousPlacement();
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      phase.finishPlayer(PlayerId.Player1);

      const result = phase.submitPlacement("poke-b", { x: 1, y: 0 }, Direction.East);

      expect(result).toEqual({ success: false, error: PlacementError.PlayerAlreadyDone });
    });
  });

  describe("annuler ne touche que ses propres poses", () => {
    it("dépile la dernière pose DU JOUEUR, pas la dernière tout court", () => {
      const phase = MockMap.simultaneousPlacement();
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      phase.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West);

      expect(phase.undoLastPlacement(PlayerId.Player1)).toBe(true);

      expect(phase.getPlacements().map((entry) => entry.pokemonId)).toEqual(["poke-c"]);
    });

    it("libère la case annulée pour le camp d'en face", () => {
      const phase = MockMap.simultaneousPlacement();
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      phase.undoLastPlacement(PlayerId.Player1);

      expect(phase.submitPlacement("poke-b", { x: 0, y: 0 }, Direction.East).success).toBe(true);
    });

    it("rend faux quand le joueur n'a rien posé, sans toucher aux autres", () => {
      const phase = MockMap.simultaneousPlacement();
      phase.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West);

      expect(phase.undoLastPlacement(PlayerId.Player1)).toBe(false);
      expect(phase.getPlacements()).toHaveLength(1);
    });

    it("autorise l'annulation même si le camp d'en face a posé depuis", () => {
      const phase = MockMap.simultaneousPlacement();
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      phase.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West);
      expect(phase.canUndo(PlayerId.Player1)).toBe(true);
    });
  });

  describe("l'ordre canonique — le piège du plan 211", () => {
    it("rend les poses groupées par camp, quel que soit l'ordre d'arrivée", () => {
      const phase = MockMap.simultaneousPlacement();

      phase.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West);
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      phase.submitPlacement("poke-d", { x: 5, y: 4 }, Direction.West);
      phase.submitPlacement("poke-b", { x: 1, y: 0 }, Direction.East);

      expect(phase.getPlacements().map((entry) => entry.pokemonId)).toEqual([
        "poke-a",
        "poke-b",
        "poke-c",
        "poke-d",
      ]);
    });

    it("rend le MÊME ordre à deux machines qui ont reçu les poses différemment", () => {
      const onOneMachine = MockMap.simultaneousPlacement();
      onOneMachine.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      onOneMachine.submitPlacement("poke-b", { x: 1, y: 0 }, Direction.East);
      onOneMachine.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West);
      onOneMachine.submitPlacement("poke-d", { x: 5, y: 4 }, Direction.West);

      const onTheOther = MockMap.simultaneousPlacement();
      onTheOther.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West);
      onTheOther.submitPlacement("poke-d", { x: 5, y: 4 }, Direction.West);
      onTheOther.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      onTheOther.submitPlacement("poke-b", { x: 1, y: 0 }, Direction.East);

      expect(onOneMachine.getPlacements()).toEqual(onTheOther.getPlacements());
    });

    it("la dernière pose CHRONOLOGIQUE n'est pas la dernière de la liste triée", () => {
      const phase = MockMap.simultaneousPlacement();
      phase.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West);
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);

      expect(phase.getPlacements().at(-1)?.pokemonId).toBe("poke-c");
      expect(phase.getLastPlacement()?.pokemonId).toBe("poke-a");
      expect(phase.getLastPlacement(PlayerId.Player2)?.pokemonId).toBe("poke-c");
    });

    it("rend null quand le joueur n'a rien posé", () => {
      const phase = MockMap.simultaneousPlacement();
      phase.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West);

      expect(phase.getLastPlacement(PlayerId.Player1)).toBeNull();
    });

    it("préserve l'ordre de pose à l'intérieur d'un camp", () => {
      const phase = MockMap.simultaneousPlacement();

      phase.submitPlacement("poke-b", { x: 1, y: 0 }, Direction.East);
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);

      expect(phase.getPlacements().map((entry) => entry.pokemonId)).toEqual(["poke-b", "poke-a"]);
    });
  });

  describe("le chrono retombe sur la pose automatique", () => {
    it("pose les Pokemon restants d'un seul camp, sans toucher aux autres", () => {
      const phase = MockMap.simultaneousPlacement();
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);

      const placed = phase.autoPlaceForPlayer(PlayerId.Player1, gridCenter);

      expect(placed.map((entry) => entry.pokemonId)).toEqual(["poke-b"]);
      expect(phase.isPlayerDone(PlayerId.Player1)).toBe(true);
      expect(phase.getPlacedPokemonIds(PlayerId.Player2)).toHaveLength(0);
    });

    it("pose dans sa propre zone, jamais dans celle d'en face", () => {
      const phase = MockMap.simultaneousPlacement();

      const placed = phase.autoPlaceForPlayer(PlayerId.Player1, gridCenter);

      const firstTeamZone = new Set(
        testFormat.spawnZones[0]?.positions.map((p) => `${p.x},${p.y}`) ?? [],
      );
      for (const entry of placed) {
        expect(firstTeamZone.has(`${entry.position.x},${entry.position.y}`)).toBe(true);
      }
    });

    it("ne pose rien pour un camp qui a déjà tout posé", () => {
      const phase = MockMap.simultaneousPlacement();
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      phase.submitPlacement("poke-b", { x: 1, y: 0 }, Direction.East);

      expect(phase.autoPlaceForPlayer(PlayerId.Player1, gridCenter)).toHaveLength(0);
    });

    it("complète un camp à moitié posé, sans toucher à ce qui est déjà là", () => {
      const phase = MockMap.simultaneousPlacement();
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);

      const placed = phase.autoPlaceForPlayer(PlayerId.Player1, gridCenter);

      expect(placed.map((entry) => entry.pokemonId)).toEqual(["poke-b"]);
      expect(phase.getPlacements()[0]).toEqual({
        pokemonId: "poke-a",
        position: { x: 0, y: 0 },
        direction: Direction.East,
      });
    });

    it("prend le générateur fourni plutôt que celui de la phase", () => {
      const sharedSeed = 77;
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Simultaneous,
        1,
      );
      const otherMachine = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Simultaneous,
        2,
      );

      expect(
        phase.autoPlaceForPlayer(PlayerId.Player1, gridCenter, createPrng(sharedSeed)),
      ).toEqual(
        otherMachine.autoPlaceForPlayer(PlayerId.Player1, gridCenter, createPrng(sharedSeed)),
      );
    });

    it("le générateur fourni ne consomme pas celui de la phase", () => {
      const seed = 31;
      const withOwnRng = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Simultaneous,
        seed,
      );
      withOwnRng.autoPlaceForPlayer(PlayerId.Player1, gridCenter, createPrng(9));
      const withoutOwnRng = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Simultaneous,
        seed,
      );

      expect(withOwnRng.autoPlaceForPlayer(PlayerId.Player2, gridCenter)).toEqual(
        withoutOwnRng.autoPlaceForPlayer(PlayerId.Player2, gridCenter),
      );
    });

    it("à graine égale, deux machines posent au même endroit", () => {
      const seed = 4242;
      const onOneMachine = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Simultaneous,
        seed,
      );
      const onTheOther = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Simultaneous,
        seed,
      );

      expect(onOneMachine.autoPlaceForPlayer(PlayerId.Player1, gridCenter)).toEqual(
        onTheOther.autoPlaceForPlayer(PlayerId.Player1, gridCenter),
      );
    });
  });

  describe("la phase est finie quand tout le monde a fini", () => {
    it("reste inachevée tant qu'un camp n'a pas posé", () => {
      const phase = MockMap.simultaneousPlacement();
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      phase.submitPlacement("poke-b", { x: 1, y: 0 }, Direction.East);

      expect(phase.isComplete()).toBe(false);
    });

    it("s'achève quand chaque camp est plein ou s'est déclaré prêt", () => {
      const phase = MockMap.simultaneousPlacement();
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      phase.submitPlacement("poke-b", { x: 1, y: 0 }, Direction.East);
      phase.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West);
      phase.finishPlayer(PlayerId.Player2);

      expect(phase.isComplete()).toBe(true);
    });
  });

  describe("l'alternance n'a pas bougé", () => {
    it("garde l'ordre de pose en serpentin, sans le regrouper par camp", () => {
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Alternating,
      );
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);
      phase.submitPlacement("poke-c", { x: 4, y: 4 }, Direction.West);
      phase.submitPlacement("poke-d", { x: 5, y: 4 }, Direction.West);
      phase.submitPlacement("poke-b", { x: 1, y: 0 }, Direction.East);

      expect(phase.getPlacements().map((entry) => entry.pokemonId)).toEqual([
        "poke-a",
        "poke-c",
        "poke-d",
        "poke-b",
      ]);
    });

    it("refuse toujours deux poses d'affilée du même camp en serpentin", () => {
      const phase = new PlacementPhase(
        testMap,
        [team1, team2],
        testFormat,
        PlacementMode.Alternating,
      );
      phase.submitPlacement("poke-a", { x: 0, y: 0 }, Direction.East);

      const result = phase.submitPlacement("poke-b", { x: 1, y: 0 }, Direction.East);

      expect(result).toEqual({ success: false, error: PlacementError.WrongPlayer });
    });
  });
});
