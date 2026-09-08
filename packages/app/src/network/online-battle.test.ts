import { type Action, ActionKind, Direction } from "@pokemon-tactic/core";
import {
  type ActionMessage,
  type ForfeitMessage,
  NetworkForfeitReason,
  type Room,
} from "@pokemon-tactic/network";
import type { BattleOrchestrator, RemoteActionRejection } from "@pokemon-tactic/view-core";
import { describe, expect, it } from "vitest";
import { createWiring } from "./online-battle";

const PLAYERS = ["player-1", "player-2", "player-3"];

const action: Action = {
  kind: ActionKind.EndTurn,
  pokemonId: "p2-crobat",
  direction: Direction.North,
};

function fakeRoom(): {
  room: Pick<Room, "sendAction" | "sendForfeit" | "onAction" | "onForfeit">;
  sentActions: { actionIndex: number; action: Action }[];
  sentForfeits: { forfeitedSeat: number; reason: string }[];
  emitAction: (message: ActionMessage) => void;
  emitForfeit: (message: ForfeitMessage) => void;
} {
  const sentActions: { actionIndex: number; action: Action }[] = [];
  const sentForfeits: { forfeitedSeat: number; reason: string }[] = [];
  const actionListeners = new Set<(message: ActionMessage) => void>();
  const forfeitListeners = new Set<(message: ForfeitMessage) => void>();
  return {
    room: {
      sendAction: (actionIndex, sent) => sentActions.push({ actionIndex, action: sent }),
      sendForfeit: (forfeitedSeat, reason) => sentForfeits.push({ forfeitedSeat, reason }),
      onAction: (listener) => {
        actionListeners.add(listener);
        return () => actionListeners.delete(listener);
      },
      onForfeit: (listener) => {
        forfeitListeners.add(listener);
        return () => forfeitListeners.delete(listener);
      },
    },
    sentActions,
    sentForfeits,
    emitAction: (message) => {
      for (const listener of actionListeners) {
        listener(message);
      }
    },
    emitForfeit: (message) => {
      for (const listener of forfeitListeners) {
        listener(message);
      }
    },
  };
}

type OrchestratorSurface = Pick<BattleOrchestrator, "submitRemoteAction" | "applyForfeit">;

function fakeOrchestrator(): {
  orchestrator: OrchestratorSurface;
  received: { seat: number; playerId: string; actionIndex: number }[];
  forfeited: string[];
} {
  const received: { seat: number; playerId: string; actionIndex: number }[] = [];
  const forfeited: string[] = [];
  return {
    orchestrator: {
      submitRemoteAction: (envelope) => {
        received.push({
          seat: envelope.seat,
          playerId: envelope.playerId,
          actionIndex: envelope.actionIndex,
        });
        return true;
      },
      applyForfeit: (playerId) => {
        forfeited.push(playerId);
        return true;
      },
    },
    received,
    forfeited,
  };
}

function rejection(seat: number, strike: number): RemoteActionRejection {
  return { seat, strike, limit: 3, cause: { kind: "not_legal" } };
}

describe("createWiring — places locales et distantes", () => {
  it("tient pour distant tout humain qui n'est pas nous", () => {
    const wiring = createWiring(fakeRoom().room, "player-2", PLAYERS, ["player-1", "player-2"]);

    expect(wiring.isRemotePlayer("player-1")).toBe(true);
    expect(wiring.isRemotePlayer("player-2")).toBe(false);
  });

  it("ne tient jamais une place IA pour distante — son tour se joue des deux côtés", () => {
    const wiring = createWiring(fakeRoom().room, "player-1", PLAYERS, ["player-1"]);

    expect(wiring.isRemotePlayer("player-2")).toBe(false);
    expect(wiring.isRemotePlayer("player-3")).toBe(false);
  });
});

describe("createWiring — échange des actions", () => {
  it("diffuse une action locale avec son index", () => {
    const room = fakeRoom();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"]);

    wiring.sendAction(4, action);

    expect(room.sentActions).toEqual([{ actionIndex: 4, action }]);
  });

  it("traduit la place reçue en joueur avant de la remettre à l'orchestrateur", () => {
    const room = fakeRoom();
    const orchestrator = fakeOrchestrator();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"]);
    wiring.attach(orchestrator.orchestrator as BattleOrchestrator, new AbortController().signal);

    room.emitAction({ type: "action", seat: 2, actionIndex: 3, action });

    expect(orchestrator.received).toEqual([{ seat: 2, playerId: "player-2", actionIndex: 3 }]);
  });

  it("ignore une action venue d'une place hors du format de la partie", () => {
    const room = fakeRoom();
    const orchestrator = fakeOrchestrator();
    const wiring = createWiring(
      room.room,
      "player-1",
      ["player-1", "player-2"],
      ["player-1", "player-2"],
    );
    wiring.attach(orchestrator.orchestrator as BattleOrchestrator, new AbortController().signal);

    room.emitAction({ type: "action", seat: 9, actionIndex: 0, action });

    expect(orchestrator.received).toEqual([]);
  });
});

describe("createWiring — élimination", () => {
  const wired = (allPlayerIds: readonly string[] = PLAYERS) => {
    const room = fakeRoom();
    const orchestrator = fakeOrchestrator();
    const wiring = createWiring(room.room, "player-1", allPlayerIds, ["player-1", "player-2"]);
    wiring.attach(orchestrator.orchestrator as BattleOrchestrator, new AbortController().signal);
    return { room, orchestrator, wiring };
  };

  it("ne fait rien aux deux premiers refus", () => {
    const { room, orchestrator, wiring } = wired();

    wiring.onRejection(rejection(2, 1));
    wiring.onRejection(rejection(2, 2));

    expect(room.sentForfeits).toEqual([]);
    expect(orchestrator.forfeited).toEqual([]);
  });

  it("constate la divergence au troisième, et l'annonce avant de l'appliquer", () => {
    const { room, orchestrator, wiring } = wired();

    wiring.onRejection(rejection(2, 3));

    expect(room.sentForfeits).toEqual([
      { forfeitedSeat: 2, reason: NetworkForfeitReason.EtatDivergent },
    ]);
    expect(orchestrator.forfeited).toEqual(["player-2"]);
  });

  it("passe par l'orchestrateur, jamais par le moteur — sinon rien ne s'affiche", () => {
    const { orchestrator, wiring } = wired();

    wiring.onRejection(rejection(2, 3));

    expect(orchestrator.forfeited).toEqual(["player-2"]);
  });

  it("applique un constat reçu d'un pair", () => {
    const { room, orchestrator } = wired();

    room.emitForfeit({
      type: "forfeit",
      seat: 2,
      forfeitedSeat: 3,
      reason: NetworkForfeitReason.EtatDivergent,
    });

    expect(orchestrator.forfeited).toEqual(["player-3"]);
  });

  it("applique un constat qui NOUS désigne — c'est ainsi qu'on apprend qu'on est éliminé", () => {
    const { room, orchestrator } = wired();

    room.emitForfeit({
      type: "forfeit",
      seat: 2,
      forfeitedSeat: 1,
      reason: NetworkForfeitReason.EtatDivergent,
    });

    expect(orchestrator.forfeited).toEqual(["player-1"]);
  });

  it("ignore un constat désignant une place hors du format", () => {
    const { room, orchestrator } = wired(["player-1", "player-2"]);

    room.emitForfeit({
      type: "forfeit",
      seat: 2,
      forfeitedSeat: 9,
      reason: NetworkForfeitReason.EtatDivergent,
    });

    expect(orchestrator.forfeited).toEqual([]);
  });

  it("se désabonne à la sortie du combat", () => {
    const room = fakeRoom();
    const orchestrator = fakeOrchestrator();
    const controller = new AbortController();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"]);
    wiring.attach(orchestrator.orchestrator as BattleOrchestrator, controller.signal);

    controller.abort();
    room.emitAction({ type: "action", seat: 2, actionIndex: 0, action });
    room.emitForfeit({
      type: "forfeit",
      seat: 2,
      forfeitedSeat: 2,
      reason: NetworkForfeitReason.EtatDivergent,
    });

    expect(orchestrator.received).toEqual([]);
    expect(orchestrator.forfeited).toEqual([]);
  });
});
