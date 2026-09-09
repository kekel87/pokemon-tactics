import { type Action, ActionKind, Direction, ForfeitReason } from "@pokemon-tactic/core";
import {
  type ActionMessage,
  BATTLE_GRACE_AFTER_SILENCE_MS,
  ChannelHealth,
  type ForfeitMessage,
  NetworkForfeitReason,
  type ResyncMessage,
  type ResyncRequestMessage,
  type Room,
  type RoomTimers,
} from "@pokemon-tactic/network";
import type { BattleOrchestrator, RemoteActionRejection } from "@pokemon-tactic/view-core";
import { describe, expect, it } from "vitest";
import {
  type ConnectionNotice,
  createWiring,
  type OnlineBattleOrchestrator,
} from "./online-battle";

const PLAYERS = ["player-1", "player-2", "player-3"];

const action: Action = {
  kind: ActionKind.EndTurn,
  pokemonId: "p2-crobat",
  direction: Direction.North,
};

type FakeRoomSurface = Pick<
  Room,
  | "sendAction"
  | "sendForfeit"
  | "onAction"
  | "onForfeit"
  | "onPeerAbsent"
  | "onPeerAwaited"
  | "onPeerReturned"
  | "onPeerHealth"
  | "onResyncRequest"
  | "onResync"
  | "sendResyncRequest"
  | "sendResync"
>;

function fakeRoom(): {
  room: FakeRoomSurface;
  sentActions: { actionIndex: number; action: Action; timedOut?: true }[];
  sentForfeits: { forfeitedSeat: number; reason: string }[];
  emitAction: (message: ActionMessage) => void;
  emitForfeit: (message: ForfeitMessage) => void;
  emitPeerAbsent: (seat: number) => void;
  emitPeerAwaited: (seat: number, graceMs: number) => void;
  emitPeerReturned: (seat: number) => void;
  emitPeerHealth: (seat: number, health: ChannelHealth) => void;
  emitResyncRequest: (seat: number, actionIndex: number) => void;
  emitResync: (seat: number, fromIndex: number, actions: readonly Action[]) => void;
  sentResyncRequests: number[];
  sentResyncs: { fromIndex: number; actions: readonly Action[] }[];
} {
  const sentActions: { actionIndex: number; action: Action; timedOut?: true }[] = [];
  const sentForfeits: { forfeitedSeat: number; reason: string }[] = [];
  const actionListeners = new Set<(message: ActionMessage) => void>();
  const forfeitListeners = new Set<(message: ForfeitMessage) => void>();
  const absentListeners = new Set<(seat: number) => void>();
  const awaitedListeners = new Set<(seat: number, graceMs: number) => void>();
  const returnedListeners = new Set<(seat: number) => void>();
  const healthListeners = new Set<(seat: number, health: ChannelHealth) => void>();
  const resyncRequestListeners = new Set<(message: ResyncRequestMessage) => void>();
  const resyncListeners = new Set<(message: ResyncMessage) => void>();
  const sentResyncRequests: number[] = [];
  const sentResyncs: { fromIndex: number; actions: readonly Action[] }[] = [];
  return {
    room: {
      sendAction: (actionIndex, sent, timedOut) =>
        sentActions.push({
          actionIndex,
          action: sent,
          ...(timedOut === undefined ? {} : { timedOut }),
        }),
      sendForfeit: (forfeitedSeat, reason) => sentForfeits.push({ forfeitedSeat, reason }),
      onAction: (listener) => {
        actionListeners.add(listener);
        return () => actionListeners.delete(listener);
      },
      onForfeit: (listener) => {
        forfeitListeners.add(listener);
        return () => forfeitListeners.delete(listener);
      },
      onPeerAbsent: (listener) => {
        absentListeners.add(listener);
        return () => absentListeners.delete(listener);
      },
      onPeerAwaited: (listener) => {
        awaitedListeners.add(listener);
        return () => awaitedListeners.delete(listener);
      },
      onPeerReturned: (listener) => {
        returnedListeners.add(listener);
        return () => returnedListeners.delete(listener);
      },
      onPeerHealth: (listener) => {
        healthListeners.add(listener);
        return () => healthListeners.delete(listener);
      },
      onResyncRequest: (listener) => {
        resyncRequestListeners.add(listener);
        return () => resyncRequestListeners.delete(listener);
      },
      onResync: (listener) => {
        resyncListeners.add(listener);
        return () => resyncListeners.delete(listener);
      },
      sendResyncRequest: (actionIndex) => sentResyncRequests.push(actionIndex),
      sendResync: (fromIndex, actions) => sentResyncs.push({ fromIndex, actions }),
    },
    sentResyncRequests,
    sentResyncs,
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
    emitPeerAbsent: (seat) => {
      for (const listener of absentListeners) {
        listener(seat);
      }
    },
    emitPeerAwaited: (seat, graceMs) => {
      for (const listener of awaitedListeners) {
        listener(seat, graceMs);
      }
    },
    emitPeerReturned: (seat) => {
      for (const listener of returnedListeners) {
        listener(seat);
      }
    },
    emitPeerHealth: (seat, health) => {
      for (const listener of healthListeners) {
        listener(seat, health);
      }
    },
    emitResyncRequest: (seat, actionIndex) => {
      for (const listener of resyncRequestListeners) {
        listener({ type: "resync_request", seat, actionIndex });
      }
    },
    emitResync: (seat, fromIndex, actions) => {
      for (const listener of resyncListeners) {
        listener({ type: "resync", seat, fromIndex, actions });
      }
    },
  };
}

function fakeTimers(): {
  timers: RoomTimers;
  run: () => void;
  pendingDelays: () => number[];
  armedCount: () => number;
} {
  let pending: { callback: () => void; delayMs: number }[] = [];
  let armed = 0;
  return {
    timers: {
      setTimeout: (callback, delayMs) => {
        const entry = { callback, delayMs };
        pending.push(entry);
        armed += 1;
        return entry;
      },
      clearTimeout: (handle) => {
        pending = pending.filter((entry) => entry !== handle);
      },
    },
    run: () => {
      const due = pending;
      pending = [];
      for (const entry of due) {
        entry.callback();
      }
    },
    pendingDelays: () => pending.map((entry) => entry.delayMs),
    armedCount: () => armed,
  };
}

type OrchestratorSurface = OnlineBattleOrchestrator;

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
      isBattleOver: () => false,
      actionsSince: () => [],
      currentActorPlayerId: () => null,
      appliedActionCount: 0,
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
    wiring.attach(orchestrator.orchestrator, new AbortController().signal);

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
    wiring.attach(orchestrator.orchestrator, new AbortController().signal);

    room.emitAction({ type: "action", seat: 9, actionIndex: 0, action });

    expect(orchestrator.received).toEqual([]);
  });
});

describe("createWiring — élimination", () => {
  const wired = (allPlayerIds: readonly string[] = PLAYERS) => {
    const room = fakeRoom();
    const orchestrator = fakeOrchestrator();
    const wiring = createWiring(room.room, "player-1", allPlayerIds, ["player-1", "player-2"]);
    wiring.attach(orchestrator.orchestrator, new AbortController().signal);
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
    wiring.attach(orchestrator.orchestrator, controller.signal);

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

describe("createWiring — chien de garde du silence (plan 202)", () => {
  it("arme le délai long à l'entrée dans l'attente d'un tour distant", () => {
    const room = fakeRoom();
    const clock = fakeTimers();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"], {
      timers: clock.timers,
    });
    wiring.attach(fakeOrchestrator().orchestrator, new AbortController().signal);

    wiring.onWaitingRemote("player-2");

    expect(clock.pendingDelays()).toEqual([BATTLE_GRACE_AFTER_SILENCE_MS]);
  });

  it("élimine la place restée muette une fois le délai écoulé", () => {
    const room = fakeRoom();
    const clock = fakeTimers();
    const orchestrator = fakeOrchestrator();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"], {
      timers: clock.timers,
    });
    wiring.attach(orchestrator.orchestrator, new AbortController().signal);

    wiring.onWaitingRemote("player-2");
    clock.run();

    expect(room.sentForfeits).toEqual([{ forfeitedSeat: 2, reason: NetworkForfeitReason.Absent }]);
    expect(orchestrator.forfeited).toEqual(["player-2"]);
  });

  it("désarme le chien de garde dès qu'on sort de l'attente", () => {
    const room = fakeRoom();
    const clock = fakeTimers();
    const orchestrator = fakeOrchestrator();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"], {
      timers: clock.timers,
    });
    wiring.attach(orchestrator.orchestrator, new AbortController().signal);

    wiring.onWaitingRemote("player-2");
    wiring.onWaitingRemote(null);
    clock.run();

    expect(room.sentForfeits).toEqual([]);
    expect(orchestrator.forfeited).toEqual([]);
  });

  it("n'arme rien pour un joueur hors du format de la partie", () => {
    const room = fakeRoom();
    const clock = fakeTimers();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"], {
      timers: clock.timers,
    });
    wiring.attach(fakeOrchestrator().orchestrator, new AbortController().signal);

    wiring.onWaitingRemote("player-9");

    expect(clock.pendingDelays()).toEqual([]);
  });

  it("coupe le minuteur au démontage de l'écran", () => {
    const room = fakeRoom();
    const clock = fakeTimers();
    const controller = new AbortController();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"], {
      timers: clock.timers,
    });
    wiring.attach(fakeOrchestrator().orchestrator, controller.signal);

    wiring.onWaitingRemote("player-2");
    controller.abort();
    clock.run();

    expect(room.sentForfeits).toEqual([]);
  });

  it("élimine la place que le salon déclare absente", () => {
    const room = fakeRoom();
    const orchestrator = fakeOrchestrator();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"]);
    wiring.attach(orchestrator.orchestrator, new AbortController().signal);

    room.emitPeerAbsent(2);

    expect(room.sentForfeits).toEqual([{ forfeitedSeat: 2, reason: NetworkForfeitReason.Absent }]);
    expect(orchestrator.forfeited).toEqual(["player-2"]);
  });
});

describe("createWiring — tours manqués consécutifs (plan 202)", () => {
  function timedOutAction(seat: number, actionIndex: number): ActionMessage {
    return { type: "action", seat, actionIndex, action, timedOut: true };
  }

  it("porte le drapeau de dépassement sur l'action diffusée", () => {
    const room = fakeRoom();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"]);

    wiring.sendAction(2, action, true);

    expect(room.sentActions).toEqual([{ actionIndex: 2, action, timedOut: true }]);
  });

  it("avertit au deuxième tour manqué sans éliminer", () => {
    const room = fakeRoom();
    const notices: (ConnectionNotice | null)[] = [];
    const orchestrator = fakeOrchestrator();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"], {
      onNotice: (notice) => notices.push(notice),
    });
    wiring.attach(orchestrator.orchestrator, new AbortController().signal);

    room.emitAction(timedOutAction(2, 0));
    room.emitAction(timedOutAction(2, 1));

    expect(notices.at(-1)).toEqual({
      kind: "missed-turns",
      seat: 2,
      missedTurns: 2,
      limit: 3,
    });
    expect(orchestrator.forfeited).toEqual([]);
  });

  it("élimine au troisième tour manqué d'affilée", () => {
    const room = fakeRoom();
    const orchestrator = fakeOrchestrator();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"]);
    wiring.attach(orchestrator.orchestrator, new AbortController().signal);

    room.emitAction(timedOutAction(2, 0));
    room.emitAction(timedOutAction(2, 1));
    room.emitAction(timedOutAction(2, 2));

    expect(room.sentForfeits).toEqual([{ forfeitedSeat: 2, reason: NetworkForfeitReason.Absent }]);
    expect(orchestrator.forfeited).toEqual(["player-2"]);
  });

  it("remet le compteur à zéro dès qu'un tour est vraiment joué", () => {
    const room = fakeRoom();
    const orchestrator = fakeOrchestrator();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"]);
    wiring.attach(orchestrator.orchestrator, new AbortController().signal);

    room.emitAction(timedOutAction(2, 0));
    room.emitAction(timedOutAction(2, 1));
    room.emitAction({ type: "action", seat: 2, actionIndex: 2, action });
    room.emitAction(timedOutAction(2, 3));
    room.emitAction(timedOutAction(2, 4));

    expect(orchestrator.forfeited).toEqual([]);
  });

  it("ne mélange pas les compteurs de deux places", () => {
    const room = fakeRoom();
    const orchestrator = fakeOrchestrator();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"]);
    wiring.attach(orchestrator.orchestrator, new AbortController().signal);

    room.emitAction(timedOutAction(2, 0));
    room.emitAction(timedOutAction(3, 1));
    room.emitAction(timedOutAction(2, 2));
    room.emitAction(timedOutAction(3, 3));

    expect(orchestrator.forfeited).toEqual([]);
  });
});

describe("createWiring — bandeau d'état du réseau (plan 202)", () => {
  function noticeHarness() {
    const room = fakeRoom();
    const notices: (ConnectionNotice | null)[] = [];
    const orchestrator = fakeOrchestrator();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"], {
      onNotice: (notice) => notices.push(notice),
    });
    wiring.attach(orchestrator.orchestrator, new AbortController().signal);
    return { room, notices, orchestrator, wiring };
  }

  it("annonce une connexion incertaine dès que ICE perd la réponse", () => {
    const { room, notices } = noticeHarness();

    room.emitPeerHealth(2, ChannelHealth.Uncertain);

    expect(notices.at(-1)).toEqual({ kind: "connection-uncertain", seat: 2 });
  });

  it("efface le bandeau quand le chemin se rétablit", () => {
    const { room, notices } = noticeHarness();

    room.emitPeerHealth(2, ChannelHealth.Uncertain);
    room.emitPeerHealth(2, ChannelHealth.Healthy);

    expect(notices.at(-1)).toBeNull();
  });

  it("porte le budget de grâce que le salon a réellement accordé", () => {
    const { room, notices } = noticeHarness();

    room.emitPeerAwaited(2, 10_000);

    expect(notices.at(-1)).toEqual({ kind: "awaiting-reconnect", seat: 2, graceMs: 10_000 });
  });

  it("préfère l'attente de reconnexion à la connexion incertaine", () => {
    const { room, notices } = noticeHarness();

    room.emitPeerHealth(2, ChannelHealth.Uncertain);
    room.emitPeerAwaited(2, BATTLE_GRACE_AFTER_SILENCE_MS);

    expect(notices.at(-1)).toEqual({
      kind: "awaiting-reconnect",
      seat: 2,
      graceMs: BATTLE_GRACE_AFTER_SILENCE_MS,
    });
  });

  it("préfère l'attente de reconnexion à l'avertissement de tours manqués", () => {
    const { room, notices } = noticeHarness();

    room.emitAction({ type: "action", seat: 2, actionIndex: 0, action, timedOut: true });
    room.emitAction({ type: "action", seat: 2, actionIndex: 1, action, timedOut: true });
    room.emitPeerAwaited(2, BATTLE_GRACE_AFTER_SILENCE_MS);

    expect(notices.at(-1)?.kind).toBe("awaiting-reconnect");
  });

  it("efface le bandeau au retour du revenant", () => {
    const { room, notices } = noticeHarness();

    room.emitPeerHealth(2, ChannelHealth.Uncertain);
    room.emitPeerAwaited(2, BATTLE_GRACE_AFTER_SILENCE_MS);
    room.emitPeerReturned(2);

    expect(notices.at(-1)).toBeNull();
  });

  it("retire l'avertissement dès qu'un tour est vraiment joué", () => {
    const { room, notices } = noticeHarness();

    room.emitAction({ type: "action", seat: 2, actionIndex: 0, action, timedOut: true });
    room.emitAction({ type: "action", seat: 2, actionIndex: 1, action, timedOut: true });
    room.emitAction({ type: "action", seat: 2, actionIndex: 2, action });

    expect(notices.at(-1)).toBeNull();
  });

  it("ne republie pas un bandeau identique", () => {
    const { room, notices } = noticeHarness();

    room.emitPeerHealth(2, ChannelHealth.Uncertain);
    room.emitPeerHealth(2, ChannelHealth.Uncertain);

    expect(notices).toHaveLength(1);
  });

  it("efface le bandeau quand un forfait tombe", () => {
    const { room, notices } = noticeHarness();

    room.emitPeerAwaited(2, BATTLE_GRACE_AFTER_SILENCE_MS);
    room.emitPeerAbsent(2);

    expect(notices.at(-1)).toBeNull();
  });
});

describe("createWiring — rattrapage du revenant (plan 202)", () => {
  function resyncHarness(options?: { resuming?: boolean; appliedActionCount?: number }) {
    const room = fakeRoom();
    const base = fakeOrchestrator();
    const journal: Action[] = [
      { kind: ActionKind.EndTurn, pokemonId: "p1-venusaur", direction: Direction.North },
      { kind: ActionKind.EndTurn, pokemonId: "p2-crobat", direction: Direction.South },
    ];
    let actor = "player-2";
    const orchestrator = {
      ...base.orchestrator,
      appliedActionCount: options?.appliedActionCount ?? 0,
      actionsSince: (index: number) => journal.slice(index),
      currentActorPlayerId: () => actor,
      submitRemoteAction: (envelope: Parameters<BattleOrchestrator["submitRemoteAction"]>[0]) => {
        const accepted = base.orchestrator.submitRemoteAction(envelope);
        actor = actor === "player-2" ? "player-1" : "player-2";
        return accepted;
      },
    };
    const wiring = createWiring(room.room, "player-2", PLAYERS, ["player-1", "player-2"], {
      ...(options?.resuming === undefined ? {} : { resuming: options.resuming }),
    });
    wiring.attach(orchestrator, new AbortController().signal);
    return { room, wiring, received: base.received };
  }

  it("réclame la suite depuis son propre index quand il reprend", () => {
    const { room } = resyncHarness({ resuming: true, appliedActionCount: 5 });

    expect(room.sentResyncRequests).toEqual([5]);
  });

  it("ne réclame rien au démarrage normal d'une partie", () => {
    const { room } = resyncHarness();

    expect(room.sentResyncRequests).toEqual([]);
  });

  it("rend la queue de son journal au pair qui la réclame", () => {
    const { room } = resyncHarness();

    room.emitResyncRequest(1, 1);

    expect(room.sentResyncs).toHaveLength(1);
    expect(room.sentResyncs[0]?.fromIndex).toBe(1);
    expect(room.sentResyncs[0]?.actions).toHaveLength(1);
  });

  it("rend une liste vide quand le demandeur n'a rien manqué", () => {
    const { room } = resyncHarness();

    room.emitResyncRequest(1, 2);

    expect(room.sentResyncs[0]?.actions).toEqual([]);
  });

  it("applique les actions rattrapées dans l'ordre, en indexant depuis fromIndex", () => {
    const { room, received } = resyncHarness({ resuming: true, appliedActionCount: 3 });

    room.emitResync(1, 3, [
      { kind: ActionKind.EndTurn, pokemonId: "p1-venusaur", direction: Direction.North },
      { kind: ActionKind.EndTurn, pokemonId: "p2-crobat", direction: Direction.South },
    ]);

    expect(received.map((entry) => entry.actionIndex)).toEqual([3, 4]);
  });

  it("lit l'acteur courant à chaque action — les actions rattrapées voyagent nues", () => {
    const { room, received } = resyncHarness({ resuming: true, appliedActionCount: 0 });

    room.emitResync(1, 0, [
      { kind: ActionKind.EndTurn, pokemonId: "p2-crobat", direction: Direction.South },
      { kind: ActionKind.EndTurn, pokemonId: "p1-venusaur", direction: Direction.North },
    ]);

    expect(received.map((entry) => entry.playerId)).toEqual(["player-2", "player-1"]);
    expect(received.map((entry) => entry.seat)).toEqual([2, 1]);
  });
});

describe("createWiring — le bandeau se tait sur une partie finie (plan 202)", () => {
  it("n'annonce pas une attente de reconnexion quand le combat est terminé", () => {
    const room = fakeRoom();
    const notices: (ConnectionNotice | null)[] = [];
    const base = fakeOrchestrator();
    const orchestrator = { ...base.orchestrator, isBattleOver: () => true };
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"], {
      onNotice: (notice) => notices.push(notice),
    });
    wiring.attach(orchestrator, new AbortController().signal);

    room.emitPeerAwaited(2, BATTLE_GRACE_AFTER_SILENCE_MS);
    room.emitPeerHealth(2, ChannelHealth.Uncertain);

    expect(notices).toEqual([]);
  });

  it("traduit la cause de protocole en raison de moteur", () => {
    const room = fakeRoom();
    const forfeitedWith: (string | undefined)[] = [];
    const base = fakeOrchestrator();
    const orchestrator = {
      ...base.orchestrator,
      applyForfeit: (_playerId: string, reason?: string) => {
        forfeitedWith.push(reason);
        return true;
      },
    };
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"]);
    wiring.attach(orchestrator, new AbortController().signal);

    room.emitForfeit({
      type: "forfeit",
      seat: 2,
      forfeitedSeat: 2,
      reason: NetworkForfeitReason.Abandon,
    });
    room.emitForfeit({
      type: "forfeit",
      seat: 2,
      forfeitedSeat: 2,
      reason: NetworkForfeitReason.Absent,
    });

    expect(forfeitedWith).toEqual([ForfeitReason.Resigned, ForfeitReason.Disconnected]);
  });
});

describe("createWiring — l'hôte revenu réclame la suite quand son canal arrive (plan 202)", () => {
  function returningHostHarness() {
    const room = fakeRoom();
    const base = fakeOrchestrator();
    const orchestrator = { ...base.orchestrator, appliedActionCount: 3 };
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"], {
      resuming: true,
    });
    wiring.attach(orchestrator, new AbortController().signal);
    return { room };
  }

  it("réémet la demande au retour du pair, le premier envoi étant parti sans canal", () => {
    const { room } = returningHostHarness();

    room.emitPeerReturned(2);

    expect(room.sentResyncRequests).toEqual([3, 3]);
  });

  it("cesse de réclamer une fois le rattrapage reçu", () => {
    const { room } = returningHostHarness();

    room.emitResync(2, 3, []);
    room.emitPeerReturned(2);

    expect(room.sentResyncRequests).toEqual([3]);
  });

  it("ne réclame rien au retour d'un pair sur une partie qui n'est pas une reprise", () => {
    const room = fakeRoom();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"]);
    wiring.attach(fakeOrchestrator().orchestrator, new AbortController().signal);

    room.emitPeerReturned(2);

    expect(room.sentResyncRequests).toEqual([]);
  });
});

describe("createWiring — le chien de garde du silence recommence au retour (plan 202)", () => {
  it("réarme le délai complet quand le pair attendu revient", () => {
    const room = fakeRoom();
    const clock = fakeTimers();
    const orchestrator = fakeOrchestrator();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"], {
      timers: clock.timers,
    });
    wiring.attach(orchestrator.orchestrator, new AbortController().signal);

    wiring.onWaitingRemote("player-2");
    expect(clock.armedCount()).toBe(1);

    room.emitPeerReturned(2);

    /*
     * Un minuteur NEUF, et non l'ancien laissé en place : c'est tout l'enjeu. Le compteur d'armements
     * est le seul moyen de le voir — un double qui ne retient que les délais restants ne distingue
     * pas « réarmé » de « jamais touché », et un test qui ne regarderait que `pendingDelays` aurait
     * passé sur le code bogué.
     */
    expect(clock.armedCount()).toBe(2);
    expect(clock.pendingDelays()).toEqual([BATTLE_GRACE_AFTER_SILENCE_MS]);
    clock.run();
    expect(orchestrator.forfeited).toEqual(["player-2"]);
  });

  it("ne réarme rien pour une place qu'on n'attendait pas", () => {
    const room = fakeRoom();
    const clock = fakeTimers();
    const wiring = createWiring(room.room, "player-1", PLAYERS, ["player-1", "player-2"], {
      timers: clock.timers,
    });
    wiring.attach(fakeOrchestrator().orchestrator, new AbortController().signal);

    room.emitPeerReturned(3);

    expect(clock.armedCount()).toBe(0);
  });
});
