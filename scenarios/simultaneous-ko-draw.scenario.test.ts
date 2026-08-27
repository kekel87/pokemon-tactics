import {
  ActionKind,
  type BattleEvent,
  BattleEventType,
  PlayerId,
  StatusType,
} from "@pokemon-tactic/core";
import { buildMoveTestEngine, MockPokemon } from "@pokemon-tactic/core/testing";
import { describe, expect, it } from "vitest";

/*
 * Plan 191 — un double K.O. dans la MÊME résolution doit produire un match nul.
 *
 * Avant ce plan, `checkVictory` scellait ET émettait le verdict au premier K.O. individuel : le
 * premier combattant à tomber laissait l'autre camp seul vivant, donc vainqueur déclaré, et
 * l'auto-K.O. de l'attaquant qui suivait dans la même résolution ne pouvait plus rien réviser.
 */

function caster(moveId: string) {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 5 },
    moveIds: [moveId],
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
}

function foe(currentHp: number) {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 5, y: 6 },
    currentHp,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
}

interface BattleEndedEvent {
  readonly type: typeof BattleEventType.BattleEnded;
  readonly winnerId: string | null;
}

function battleEndedEvents(events: readonly BattleEvent[]): BattleEndedEvent[] {
  return events.filter(
    (event): event is BattleEndedEvent => event.type === BattleEventType.BattleEnded,
  );
}

describe("K.O. simultanés d'une même résolution — scenario", () => {
  it("Explo-Brume sur le dernier ennemi : le lanceur meurt aussi, donc match nul", () => {
    // Given — un 1v1 où l'ennemi ne survivra pas au souffle, et le lanceur s'auto-K.O.
    const { engine, state } = buildMoveTestEngine([caster("misty-explosion"), foe(1)], {
      gridSize: 10,
      random: () => 0.5,
    });

    // When
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "misty-explosion",
      targetPosition: { x: 5, y: 5 },
    });

    // Then — les deux camps sont vides, personne ne l'emporte
    expect(result.success).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBe(0);
    expect(state.pokemon.get("caster")?.currentHp).toBe(0);

    const ended = battleEndedEvents(result.events);
    expect(ended).toHaveLength(1);
    expect(ended[0]?.winnerId).toBeNull();
  });

  it("un K.O. simple laisse un camp vivant : vainqueur déclaré, un seul événement de fin", () => {
    // Given — le lanceur emploie une attaque sans auto-K.O.
    const { engine, state } = buildMoveTestEngine([caster("tackle"), foe(1)], {
      gridSize: 10,
      random: () => 0.5,
    });

    // When
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "tackle",
      targetPosition: { x: 5, y: 6 },
    });

    // Then — non-régression : le vainqueur normal n'est pas dégradé en nul
    expect(result.success).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBe(0);
    expect(state.pokemon.get("caster")?.currentHp).toBeGreaterThan(0);

    const ended = battleEndedEvents(result.events);
    expect(ended).toHaveLength(1);
    expect(ended[0]?.winnerId).toBe(PlayerId.Player1);
  });

  it("Lien du Destin : le tueur tombe dans la résolution de sa victime, donc match nul", () => {
    // Given — la victime porte le lien, le lanceur la finit et part avec elle
    const victim = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 6 },
      currentHp: 1,
      volatileStatuses: [{ type: StatusType.DestinyBond, remainingTurns: 999 }],
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster("tackle"), victim], {
      gridSize: 10,
      random: () => 0.5,
    });

    // When
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "tackle",
      targetPosition: { x: 5, y: 6 },
    });

    // Then
    expect(result.success).toBe(true);
    expect(state.pokemon.get("foe")?.currentHp).toBe(0);
    expect(state.pokemon.get("caster")?.currentHp).toBe(0);

    const ended = battleEndedEvents(result.events);
    expect(ended).toHaveLength(1);
    expect(ended[0]?.winnerId).toBeNull();
  });
});
