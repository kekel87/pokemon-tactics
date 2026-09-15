import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import { PlayerId } from "../enums/player-id";
import { StatusType } from "../enums/status-type";
import { buildMoveTestEngine, MockBattle, MockPokemon } from "../testing";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import { BattleEngine } from "./BattleEngine";

const fresh = MockPokemon.fresh;

function eliminatedPlayers(events: readonly BattleEvent[]): string[] {
  return events.flatMap((event) =>
    event.type === BattleEventType.PlayerEliminated ? [event.playerId] : [],
  );
}

function eventTypes(events: readonly BattleEvent[]): string[] {
  return events.map((event) => event.type);
}

function activeOf(state: BattleState): { pokemonId: string; playerId: string } {
  const active = state.pokemon.get(state.activePokemonId);
  if (active === undefined) {
    throw new Error(`aucun Pokemon actif : ${state.activePokemonId}`);
  }
  return { pokemonId: active.id, playerId: active.playerId };
}

function endTurnOfActive(engine: BattleEngine, state: BattleState): BattleEvent[] {
  const { pokemonId, playerId } = activeOf(state);
  const result = engine.submitAction(playerId, {
    kind: ActionKind.EndTurn,
    pokemonId,
    direction: Direction.South,
  });
  expect(result.success).toBe(true);
  return result.events;
}

function loneSacrificeScene(extraCamps: number) {
  const caster = fresh(MockPokemon.base, {
    id: "user",
    playerId: PlayerId.Player1,
    position: { x: 2, y: 2 },
    moveIds: ["healing-wish"],
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const target = fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 3, y: 2 },
    derivedStats: { movement: 3, jump: 1, initiative: 1 },
  });
  const others =
    extraCamps === 0
      ? []
      : [
          fresh(MockPokemon.base, {
            id: "third",
            playerId: PlayerId.Player3,
            position: { x: 6, y: 6 },
            derivedStats: { movement: 3, jump: 1, initiative: 1 },
          }),
        ];
  return buildMoveTestEngine([caster, target, ...others]);
}

function sacrifice(engine: BattleEngine): BattleEvent[] {
  const result = engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: "user",
    moveId: "healing-wish",
    targetPosition: { x: 3, y: 2 },
  });
  expect(result.success).toBe(true);
  return result.events;
}

describe("BattleEngine — PlayerEliminated", () => {
  it("annonce le camp qui perd son dernier Pokemon quand la partie continue", () => {
    const { engine } = loneSacrificeScene(1);

    const events = sacrifice(engine);

    expect(eliminatedPlayers(events)).toEqual([PlayerId.Player1]);
    expect(eventTypes(events)).not.toContain(BattleEventType.BattleEnded);
  });

  it("annonce le dernier camp tombé AVANT le verdict de victoire", () => {
    const { engine } = loneSacrificeScene(0);

    const events = sacrifice(engine);
    const types = eventTypes(events);

    expect(eliminatedPlayers(events)).toEqual([PlayerId.Player1]);
    expect(types.indexOf(BattleEventType.PlayerEliminated)).toBeLessThan(
      types.indexOf(BattleEventType.BattleEnded),
    );
  });

  it("n'annonce jamais le vainqueur", () => {
    const { engine } = loneSacrificeScene(0);

    const events = sacrifice(engine);

    expect(eliminatedPlayers(events)).not.toContain(PlayerId.Player2);
  });

  it("n'annonce un camp qu'une fois, même quand d'autres actions suivent", () => {
    const { engine, state } = loneSacrificeScene(1);
    sacrifice(engine);

    const later = endTurnOfActive(engine, state);

    expect(eliminatedPlayers(later)).toEqual([]);
  });

  it("n'annonce pas un camp qui abandonne — PlayerForfeited le dit déjà", () => {
    const state = MockBattle.stateFrom([
      fresh(MockBattle.player1Fast),
      fresh(MockBattle.player2Slow),
      fresh(MockBattle.player2Slow, {
        id: "third",
        playerId: PlayerId.Player3,
        position: { x: 2, y: 2 },
      }),
    ]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.forfeit(PlayerId.Player1);

    expect(eventTypes(result.events)).toContain(BattleEventType.PlayerForfeited);
    expect(eliminatedPlayers(result.events)).toEqual([]);
  });

  it("réannonce un camp revenu puis retombé, là où la réanimation reste permise", () => {
    const { engine, state } = loneSacrificeScene(1);
    const foe = state.pokemon.get("foe");
    if (foe === undefined) {
      throw new Error("scène incomplète");
    }
    foe.currentHp = 0;
    expect(eliminatedPlayers(endTurnOfActive(engine, state))).toEqual([PlayerId.Player2]);

    foe.currentHp = foe.maxHp;
    expect(eliminatedPlayers(endTurnOfActive(engine, state))).toEqual([]);

    foe.currentHp = 0;
    expect(eliminatedPlayers(endTurnOfActive(engine, state))).toEqual([PlayerId.Player2]);
  });
});

describe("BattleEngine — PlayerEliminated, cas de la revue du plan 210", () => {
  it("à quatre camps, trois éliminations s'annoncent dans l'ordre et le vainqueur jamais", () => {
    const camps = [
      { id: "camp-1", playerId: PlayerId.Player1, position: { x: 1, y: 1 }, initiative: 100 },
      { id: "camp-2", playerId: PlayerId.Player2, position: { x: 4, y: 1 }, initiative: 80 },
      { id: "camp-3", playerId: PlayerId.Player3, position: { x: 1, y: 4 }, initiative: 60 },
      { id: "camp-4", playerId: PlayerId.Player4, position: { x: 4, y: 4 }, initiative: 40 },
    ];
    const { engine, state } = buildMoveTestEngine(
      camps.map((camp) =>
        fresh(MockPokemon.base, {
          id: camp.id,
          playerId: camp.playerId,
          position: camp.position,
          moveIds: ["healing-wish"],
          derivedStats: { movement: 3, jump: 1, initiative: camp.initiative },
        }),
      ),
    );

    const actors: string[] = [];
    const announced: string[] = [];
    let lastEvents: BattleEvent[] = [];
    for (let fall = 0; fall < 3; fall += 1) {
      const { pokemonId, playerId } = activeOf(state);
      const caster = state.pokemon.get(pokemonId);
      if (caster === undefined) {
        throw new Error(`lanceur introuvable : ${pokemonId}`);
      }
      const result = engine.submitAction(playerId, {
        kind: ActionKind.UseMove,
        pokemonId,
        moveId: "healing-wish",
        targetPosition: { x: caster.position.x + 1, y: caster.position.y },
      });
      expect(result.success).toBe(true);
      actors.push(playerId);
      announced.push(...eliminatedPlayers(result.events));
      lastEvents = result.events;
    }

    expect(announced).toEqual(actors);
    const survivor = camps.find((camp) => !actors.includes(camp.playerId));
    expect(announced).not.toContain(survivor?.playerId);
    const ended = lastEvents.find((event) => event.type === BattleEventType.BattleEnded);
    expect(ended?.type === BattleEventType.BattleEnded && ended.winnerId).toBe(survivor?.playerId);
    const types = eventTypes(lastEvents);
    expect(types.indexOf(BattleEventType.PlayerEliminated)).toBeLessThan(
      types.indexOf(BattleEventType.BattleEnded),
    );
  });

  it("un match nul annonce les deux camps tombés, puis le verdict nul", () => {
    const caster = fresh(MockPokemon.base, {
      id: "user",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      moveIds: ["healing-wish"],
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 6, y: 6 },
      derivedStats: { movement: 3, jump: 1, initiative: 1 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe]);
    const bonded = state.pokemon.get("user");
    if (bonded === undefined) {
      throw new Error("scène incomplète");
    }
    bonded.volatileStatuses.push({ type: StatusType.DestinyBond, remainingTurns: 3 });
    bonded.lastHitBy = { attackerId: "foe", moveId: "tackle" };

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "user",
      moveId: "healing-wish",
      targetPosition: { x: 3, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(eliminatedPlayers(result.events)).toEqual([PlayerId.Player1, PlayerId.Player2]);
    const ended = result.events.find((event) => event.type === BattleEventType.BattleEnded);
    expect(ended?.type === BattleEventType.BattleEnded && ended.winnerId).toBeNull();
    const types = eventTypes(result.events);
    expect(types.lastIndexOf(BattleEventType.PlayerEliminated)).toBeLessThan(
      types.indexOf(BattleEventType.BattleEnded),
    );
  });

  it("annonce le camp qu'une cascade d'abandon emporte, jamais celui qui abandonne", () => {
    const state = MockBattle.stateFrom([
      fresh(MockBattle.player1Fast),
      fresh(MockBattle.player2Slow),
      fresh(MockBattle.player2Slow, {
        id: "third",
        playerId: PlayerId.Player3,
        position: { x: 2, y: 2 },
      }),
    ]);
    const engine = new BattleEngine(state, new Map());
    const bonded = state.pokemon.get("fast");
    if (bonded === undefined) {
      throw new Error("scène incomplète");
    }
    bonded.volatileStatuses.push({ type: StatusType.DestinyBond, remainingTurns: 3 });
    bonded.lastHitBy = { attackerId: "slow", moveId: "tackle" };

    const result = engine.forfeit(PlayerId.Player1);

    expect(eliminatedPlayers(result.events)).toEqual([PlayerId.Player2]);
    const types = eventTypes(result.events);
    expect(types.indexOf(BattleEventType.PlayerEliminated)).toBeLessThan(
      types.indexOf(BattleEventType.BattleEnded),
    );
  });
});
