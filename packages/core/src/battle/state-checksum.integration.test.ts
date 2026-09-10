import { pocArena } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { Direction } from "../enums/direction";
import { PlacementMode } from "../enums/placement-mode";
import { PlayerController } from "../enums/player-controller";
import { PlayerId } from "../enums/player-id";
import { buildTestEngineFromPlacements } from "../testing/build-test-engine";
import type { Action } from "../types/action";
import type { BattleState } from "../types/battle-state";
import type { PlacementTeam } from "../types/placement-team";
import type { PokemonInstance } from "../types/pokemon-instance";
import { PlacementPhase } from "./PlacementPhase";
import { runReplay } from "./replay-runner";
import { battleStateChecksum } from "./state-checksum";

/**
 * Parité de la somme de contrôle entre deux moteurs (plan 203, Lot B4, étape 5).
 *
 * 🔴 **Le faux positif est pire que l'absence de détecteur** : une empreinte qui diverge sur une
 * partie honnête met fin à un vrai combat, par un message que le joueur ne peut ni comprendre ni
 * contester. Ces tests sont le garde-fou de ce risque — ils vérifient d'abord que deux moteurs
 * honnêtes CONCORDENT, et seulement ensuite qu'une vraie divergence est vue.
 */

const teams: PlacementTeam[] = [
  {
    playerId: PlayerId.Player1,
    availablePokemonIds: ["p1-venusaur", "p1-blastoise"],
    controller: PlayerController.Human,
  },
  {
    playerId: PlayerId.Player2,
    availablePokemonIds: ["p2-charizard", "p2-raichu"],
    controller: PlayerController.Human,
  },
];

const PLACEMENT_SEED = 42;

function freshBattle(): {
  engine: ReturnType<typeof buildTestEngineFromPlacements>["engine"];
  state: BattleState;
} {
  const map = pocArena;
  const format = map.formats[0];
  if (!format) {
    throw new Error("Missing format");
  }
  const gridCenter = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  // La même graine de placement des deux côtés : c'est ce que le setup diffusé garantit (#902).
  const phase = new PlacementPhase(map, teams, format, PlacementMode.Random, PLACEMENT_SEED);
  const placements = phase.autoPlaceAll(gridCenter);
  return buildTestEngineFromPlacements(placements, teams);
}

/**
 * Joue une action légale du camp courant, en préférant une attaque.
 *
 * Pilotée par `getLegalActions` et non par des identifiants de moves écrits à la main : ça fait
 * tourner le vrai calcul de dégâts, les vrais K.O. et les vrais effets, sans que le test ait à
 * connaître le movepool du roster.
 */
function playLegalAction(
  engine: ReturnType<typeof buildTestEngineFromPlacements>["engine"],
  state: BattleState,
): Action | null {
  const actor = state.pokemon.get(state.activePokemonId);
  if (!actor) {
    return null;
  }
  const legal = engine.getLegalActions(actor.playerId);
  const attack = legal.find((candidate) => candidate.kind === ActionKind.UseMove);
  const chosen =
    attack ??
    ({ kind: ActionKind.EndTurn, pokemonId: actor.id, direction: Direction.North } as Action);
  const result = engine.submitAction(actor.playerId, chosen);
  if (!result.success) {
    const fallback: Action = {
      kind: ActionKind.EndTurn,
      pokemonId: actor.id,
      direction: Direction.North,
    };
    const retried = engine.submitAction(actor.playerId, fallback);
    if (!retried.success) {
      throw new Error(`Action refusée : ${String(retried.error)}`);
    }
    return fallback;
  }
  return chosen;
}

/** Fait passer le tour au camp courant, comme un joueur qui attend. */
function endTurn(
  engine: ReturnType<typeof buildTestEngineFromPlacements>["engine"],
  state: BattleState,
): Action {
  const actorId = state.activePokemonId;
  const actor = state.pokemon.get(actorId);
  if (!actor) {
    throw new Error("Aucun acteur courant");
  }
  const action: Action = {
    kind: ActionKind.EndTurn,
    pokemonId: actor.id,
    direction: Direction.North,
  };
  const result = engine.submitAction(actor.playerId, action);
  if (!result.success) {
    throw new Error(`Action refusée : ${String(result.error)}`);
  }
  return action;
}

describe("battleStateChecksum — parité entre deux moteurs", () => {
  it("gives both peers the same digest at the launch anchor", () => {
    // L'empreinte de lancement, index 0 : elle couvre la phase de PLACEMENT, dont le tirage local
    // avait déjà produit deux plateaux différents une fois (#902).
    expect(battleStateChecksum(freshBattle().state)).toBe(battleStateChecksum(freshBattle().state));
  });

  it("keeps both peers in step at every single action, not just at the end", () => {
    const mine = freshBattle();
    const theirs = freshBattle();

    const digests: string[] = [];
    for (let turn = 0; turn < 12; turn += 1) {
      endTurn(mine.engine, mine.state);
      endTurn(theirs.engine, theirs.state);
      const digest = battleStateChecksum(mine.state);
      expect(digest, `tour ${turn}`).toBe(battleStateChecksum(theirs.state));
      digests.push(digest);
    }

    // L'état AVANCE réellement : un test qui passerait sur douze empreintes identiques ne
    // prouverait rien du tout.
    expect(new Set(digests).size).toBeGreaterThan(1);
  });

  it("does not care in which order the Pokemon Map was built", () => {
    // LE scénario de faux positif le plus probable : un pair qui a repris sa partie a reconstruit
    // sa `Map` en rejouant son journal, donc dans un autre ordre d'insertion.
    const { state } = freshBattle();
    const reversed = new Map([...state.pokemon.entries()].reverse());
    const rebuilt: BattleState = { ...state, pokemon: reversed };

    expect([...reversed.keys()]).not.toEqual([...state.pokemon.keys()]);
    expect(battleStateChecksum(rebuilt)).toBe(battleStateChecksum(state));
  });

  it("does not care that a cleared field was set to undefined rather than deleted", () => {
    // `handleKo` remet une vingtaine de champs à `undefined` au lieu de les supprimer, là où un pair
    // reconstruit par rejeu n'a jamais posé la clé. Sans cette égalité, un faux positif à chaque K.O.
    const { state } = freshBattle();
    const [id, pokemon] = [...state.pokemon.entries()][0] as [string, PokemonInstance];

    const cleared = new Map(state.pokemon);
    cleared.set(id, { ...pokemon, typeOverride: undefined, stockpileCount: undefined });

    expect(battleStateChecksum({ ...state, pokemon: cleared })).toBe(battleStateChecksum(state));
  });

  it("catches a single point of damage", () => {
    const { state } = freshBattle();
    const [id, pokemon] = [...state.pokemon.entries()][0] as [string, PokemonInstance];
    const hurt = new Map(state.pokemon);
    hurt.set(id, { ...pokemon, currentHp: pokemon.currentHp - 1 });

    expect(battleStateChecksum({ ...state, pokemon: hurt })).not.toBe(battleStateChecksum(state));
  });

  it("agrees with a peer that rebuilt its state through the real resume path", () => {
    // 🔴 LE test du risque dominant. Une reconnexion ne recopie pas l'état : elle le RECONSTRUIT en
    // rejouant le journal (`runReplay`, le chemin du plan 181). C'est là qu'un faux positif
    // apparaîtrait pour de vrai, et une `Map` reconstruite dans un autre ordre le produirait.
    const mine = freshBattle();
    for (let turn = 0; turn < 10; turn += 1) {
      playLegalAction(mine.engine, mine.state);
    }

    const replayed = runReplay(mine.engine.exportReplay(), () => freshBattle().engine);

    expect(battleStateChecksum(replayed.getGameState(""))).toBe(battleStateChecksum(mine.state));
  });

  it("catches two peers that are not at the same action", () => {
    const mine = freshBattle();
    const theirs = freshBattle();
    endTurn(mine.engine, mine.state);

    // C'est pourquoi on ne compare QUE des empreintes de même index d'ancrage : sinon, tout écart
    // d'un tour serait lu comme une divergence.
    expect(battleStateChecksum(mine.state)).not.toBe(battleStateChecksum(theirs.state));
  });
});
