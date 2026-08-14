import { ActionKind, type BattleState, type MapDefinition } from "@pokemon-tactic/core";
import { pocArena } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { MockBattleResume } from "../testing/mock-battle-resume";
import { type BattleInputs, buildBattle, resumeBattle } from "./battle-resume";

const MAP: MapDefinition = pocArena;
const INPUTS: BattleInputs = MockBattleResume.inputs;

/**
 * Drive the battle deterministically without an AI: attack when a move is legal, otherwise end the
 * turn. What matters is that a varied action log accumulates, not that the play is smart.
 */
function playActions(battle: ReturnType<typeof buildBattle>, count: number): void {
  const { engine } = battle;
  for (let played = 0; played < count; played++) {
    const state = engine.getGameState("");
    const active = state.pokemon.get(state.activePokemonId);
    if (!active) {
      return;
    }
    const legalActions = engine.getLegalActions(active.playerId);
    const enemy = [...state.pokemon.values()].find(
      (pokemon) => pokemon.playerId !== active.playerId && pokemon.currentHp > 0,
    );
    // Strongest damaging move first, aimed at the enemy: `getLegalActions` offers a `UseMove` with NO
    // target (the confirm step supplies it), and submitting it as-is only ever emits `move_started` —
    // the battle would never advance towards an end, which the "already over" case needs.
    const attacks = legalActions
      .filter((action) => action.kind === ActionKind.UseMove)
      .map((action) => ({
        action,
        power:
          action.kind === ActionKind.UseMove
            ? (battle.moveDefinitions.get(action.moveId)?.power ?? 0)
            : 0,
      }))
      .sort((left, right) => right.power - left.power);
    const attack = attacks[0]?.action;
    const action =
      attack && enemy && attack.kind === ActionKind.UseMove
        ? { ...attack, targetPosition: enemy.position }
        : legalActions.find((candidate) => candidate.kind === ActionKind.EndTurn);
    if (!action) {
      return;
    }
    engine.submitAction(active.playerId, action);
  }
}

/**
 * Whole-state comparison, deliberately NOT a hand-picked list of fields: enumerating them is the very
 * rot this design avoids (a counter added later would silently escape the check). Vitest compares Maps
 * structurally, so every `PokemonInstance` field is in scope — hidden counters, fog reveals included.
 */
function snapshot(state: BattleState) {
  return {
    ...state,
    pokemon: [...state.pokemon.entries()].sort(([left], [right]) => left.localeCompare(right)),
  };
}

describe("battle resume", () => {
  it("rebuilds a battle in progress with the exact same state", () => {
    // Given a battle played for a while
    const live = buildBattle(INPUTS, MAP);
    live.engine.consumeStartupEvents();
    playActions(live, 12);
    const replay = live.engine.exportReplay();
    expect(replay.actions.length).toBeGreaterThan(0);

    // When it is rebuilt from its saved action log alone
    const resumed = resumeBattle(INPUTS, replay.actions, MAP);

    // Then every derived value comes back identical — nothing is copied, so nothing can be missed
    expect(snapshot(resumed.battle.state)).toEqual(snapshot(live.state));
  });

  it("brings back what the battle narrated, for the log", () => {
    const live = buildBattle(INPUTS, MAP);
    const liveEvents = [...live.engine.consumeStartupEvents()];
    for (let action = 0; action < 6; action++) {
      const before = live.engine.exportReplay().actions.length;
      playActions(live, 1);
      if (live.engine.exportReplay().actions.length === before) {
        break;
      }
    }

    const resumed = resumeBattle(INPUTS, live.engine.exportReplay().actions, MAP);

    expect(resumed.logEvents.length).toBeGreaterThan(liveEvents.length);
    expect(resumed.logEvents.slice(0, liveEvents.length)).toEqual(liveEvents);
  });

  it("leaves nothing for the orchestrator to animate on resume", () => {
    const live = buildBattle(INPUTS, MAP);
    live.engine.consumeStartupEvents();
    playActions(live, 4);

    const resumed = resumeBattle(INPUTS, live.engine.exportReplay().actions, MAP);

    expect(resumed.battle.engine.consumeStartupEvents()).toEqual([]);
  });

  it("refuses a log it cannot replay instead of restoring half a battle", () => {
    expect(() =>
      resumeBattle(
        INPUTS,
        [
          {
            kind: ActionKind.UseMove,
            pokemonId: "p1-pikachu",
            moveId: "not-a-move",
            targetPosition: { x: 5, y: 5 },
          },
        ],
        MAP,
      ),
    ).toThrow("Replay failed");
  });

  it("refuses a log whose battle is already over", () => {
    // The save is written the moment an action is accepted, while the victory is only noticed once the
    // animation queue drains — a tab discarded in between saves a finished battle. Resuming it would
    // show an action menu with no legal action and no victory dialog.
    const lethalInputs = MockBattleResume.lethalInputs;
    const live = buildBattle(lethalInputs, MAP);
    live.engine.consumeStartupEvents();
    playActions(live, 200);
    const alive = [...live.state.pokemon.values()].filter((pokemon) => pokemon.currentHp > 0);
    expect(alive).toHaveLength(1);

    expect(() => resumeBattle(lethalInputs, live.engine.exportReplay().actions, MAP)).toThrow(
      "already over",
    );
  });
});
