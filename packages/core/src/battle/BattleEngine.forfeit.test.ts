import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import { PlayerId } from "../enums/player-id";
import { StatusType } from "../enums/status-type";
import { MockBattle, MockPokemon } from "../testing";
import type { BattleEvent } from "../types/battle-event";
import { BattleEngine } from "./BattleEngine";

const P1 = MockBattle.player1Fast;
const P2 = MockBattle.player2Slow;

const fresh = MockPokemon.fresh;

function endedWinners(events: readonly BattleEvent[]): (string | null)[] {
  return events
    .filter((event) => event.type === BattleEventType.BattleEnded)
    .map((event) => (event.type === BattleEventType.BattleEnded ? event.winnerId : undefined))
    .filter((winnerId): winnerId is string | null => winnerId !== undefined);
}

function koIds(events: readonly BattleEvent[]): string[] {
  return events
    .filter((event) => event.type === BattleEventType.PokemonKo)
    .map((event) => (event.type === BattleEventType.PokemonKo ? event.pokemonId : ""));
}

describe("BattleEngine.forfeit", () => {
  it("met à terre toute l'équipe du camp qui abandonne", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P1, { id: "medium" }), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.forfeit(PlayerId.Player1);

    expect(result.success).toBe(true);
    expect(koIds(result.events)).toEqual(expect.arrayContaining(["fast", "medium"]));
    expect(state.pokemon.get("fast")?.currentHp).toBe(0);
    expect(state.pokemon.get("medium")?.currentHp).toBe(0);
    expect(state.pokemon.get("slow")?.currentHp).toBe(100);
  });

  it("donne la victoire au camp restant en 1v1", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.forfeit(PlayerId.Player1);

    expect(endedWinners(result.events)).toEqual([PlayerId.Player2]);
  });

  it("ne termine PAS le combat quand deux camps restent debout", () => {
    const state = MockBattle.stateFrom([
      fresh(P1),
      fresh(P2),
      fresh(P2, { id: "third", playerId: PlayerId.Player3, position: { x: 2, y: 2 } }),
    ]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.forfeit(PlayerId.Player1);

    expect(result.success).toBe(true);
    expect(endedWinners(result.events)).toEqual([]);
    expect(state.pokemon.get("slow")?.currentHp).toBe(100);
    expect(state.pokemon.get("third")?.currentHp).toBe(100);
  });

  it("rend un match nul quand le dernier camp debout abandonne", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2, { currentHp: 0 })]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.forfeit(PlayerId.Player1);

    expect(endedWinners(result.events)).toEqual([null]);
  });

  it("accepte un abandon hors du tour de celui qui abandonne", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());
    expect(engine.getGameState(PlayerId.Player1).activePokemonId).toBe("fast");

    const result = engine.forfeit(PlayerId.Player2);

    expect(result.success).toBe(true);
    expect(endedWinners(result.events)).toEqual([PlayerId.Player1]);
  });

  it("reste sans effet sur un camp déjà éliminé", () => {
    const state = MockBattle.stateFrom([
      fresh(P1),
      fresh(P2),
      fresh(P2, {
        id: "third",
        playerId: PlayerId.Player3,
        currentHp: 0,
        position: { x: 2, y: 2 },
      }),
    ]);
    const engine = new BattleEngine(state, new Map());

    const result = engine.forfeit(PlayerId.Player3);

    expect(result.success).toBe(false);
    expect(result.events).toEqual([]);
  });

  it("reste sans effet une fois le combat terminé", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());
    engine.forfeit(PlayerId.Player1);

    const again = engine.forfeit(PlayerId.Player2);

    expect(again.success).toBe(false);
    expect(again.events).toEqual([]);
  });

  it("n'émet jamais un second verdict de fin de combat", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());
    const emitted: BattleEvent[] = [];
    engine.on(BattleEventType.BattleEnded, (event) => emitted.push(event));

    engine.forfeit(PlayerId.Player1);
    engine.forfeit(PlayerId.Player1);

    expect(emitted).toHaveLength(1);
  });

  it("passe la main à un acteur vivant quand le camp actif abandonne", () => {
    const state = MockBattle.stateFrom([
      fresh(P1),
      fresh(P2),
      fresh(P2, { id: "third", playerId: PlayerId.Player3, position: { x: 2, y: 2 } }),
    ]);
    const engine = new BattleEngine(state, new Map());
    expect(engine.getGameState(PlayerId.Player1).activePokemonId).toBe("fast");

    engine.forfeit(PlayerId.Player1);

    const active = state.pokemon.get(engine.getGameState(PlayerId.Player2).activePokemonId);
    expect(active?.currentHp).toBeGreaterThan(0);
    expect(active?.playerId).not.toBe(PlayerId.Player1);
  });

  it("refuse toute action une fois le combat clos par abandon", () => {
    const state = MockBattle.stateFrom([fresh(P1), fresh(P2)]);
    const engine = new BattleEngine(state, new Map());
    engine.forfeit(PlayerId.Player2);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "fast",
      direction: Direction.South,
    });

    expect(result.success).toBe(false);
  });

  it("déclenche Lien du Destin comme n'importe quel K.O.", () => {
    const state = MockBattle.stateFrom([
      fresh(P1),
      fresh(P2),
      fresh(P2, { id: "third", playerId: PlayerId.Player3, position: { x: 2, y: 2 } }),
    ]);
    const engine = new BattleEngine(state, new Map());
    const bonded = state.pokemon.get("fast");
    if (bonded) {
      bonded.volatileStatuses.push({ type: StatusType.DestinyBond, remainingTurns: 3 });
      bonded.lastHitBy = { attackerId: "slow", moveId: "tackle" };
    }

    const result = engine.forfeit(PlayerId.Player1);

    expect(koIds(result.events)).toEqual(expect.arrayContaining(["fast", "slow"]));
    expect(state.pokemon.get("slow")?.currentHp).toBe(0);
    expect(endedWinners(result.events)).toEqual([PlayerId.Player3]);
  });
});
