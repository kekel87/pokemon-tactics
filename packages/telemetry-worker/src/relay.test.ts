import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { billableRequests, RELAY_DAILY_LIMIT, RELAY_PATH, RoomRelay } from "./relay";

interface FakeRelaySocket {
  tag: string;
  sent: string[];
  closeCalls: number;
  send(data: string): void;
  close(): void;
}

interface FakeRelay {
  relay: RoomRelay;
  sockets: FakeRelaySocket[];
  storage: Map<string, unknown>;
  accepted: { tags: string[] }[];
  statements: { sql: string; params: unknown[] }[];
  join(seat: number, options?: { failSend?: boolean }): FakeRelaySocket;
  leave(socket: FakeRelaySocket): void;
}

function fakeRelay(options: { usage?: number; readFails?: boolean; writeFails?: boolean } = {}) {
  const sockets: FakeRelaySocket[] = [];
  const storage = new Map<string, unknown>();
  const accepted: { tags: string[] }[] = [];
  const statements: { sql: string; params: unknown[] }[] = [];

  const state = {
    storage: {
      get: (key: string) => Promise.resolve(storage.get(key)),
      put: (key: string, value: unknown) => {
        storage.set(key, value);
        return Promise.resolve();
      },
      delete: (key: string) => Promise.resolve(storage.delete(key)),
    },
    getWebSockets: (tag?: string) =>
      tag === undefined ? sockets : sockets.filter((socket) => socket.tag === tag),
    acceptWebSocket: (_socket: unknown, tags: string[]) => {
      accepted.push({ tags });
    },
  } as unknown as DurableObjectState;

  const database = {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => ({
        run: () => {
          if (options.writeFails === true) {
            return Promise.reject(new Error("D1 indisponible"));
          }
          statements.push({ sql, params });
          return Promise.resolve({});
        },
        first: () => {
          if (options.readFails === true) {
            return Promise.reject(new Error("D1 indisponible"));
          }
          return Promise.resolve(options.usage === undefined ? null : { requests: options.usage });
        },
      }),
    }),
  } as unknown as D1Database;

  const harness: FakeRelay = {
    relay: new RoomRelay(state, { database }),
    sockets,
    storage,
    accepted,
    statements,
    join: (seat, socketOptions) => {
      const socket: FakeRelaySocket = {
        tag: String(seat),
        sent: [],
        closeCalls: 0,
        send: (data) => {
          if (socketOptions?.failSend === true) {
            throw new Error("socket morte");
          }
          socket.sent.push(data);
        },
        close: () => {
          socket.closeCalls += 1;
        },
      };
      sockets.push(socket);
      return socket;
    },
    leave: (socket) => {
      sockets.splice(sockets.indexOf(socket), 1);
    },
  };
  return harness;
}

function upgradeRequest(seat: string | null, options: { upgrade?: boolean } = {}): Request {
  const query = seat === null ? "" : `?seat=${seat}`;
  return new Request(`https://example.test${RELAY_PATH}/A7K2M${query}`, {
    headers: options.upgrade === false ? {} : { Upgrade: "websocket" },
  });
}

describe("facturation estimée", () => {
  it("compte une requête par connexion", () => {
    expect(billableRequests({ connections: 12, incoming: 0 })).toBe(12);
  });

  it("applique le ratio de 20 pour 1 aux messages entrants", () => {
    expect(billableRequests({ connections: 0, incoming: 100 })).toBe(5);
  });

  it("arrondit au-dessus un reliquat de messages", () => {
    expect(billableRequests({ connections: 0, incoming: 1 })).toBe(1);
  });

  it("garde au relais une part MINORITAIRE du palier gratuit du compte", () => {
    expect(RELAY_DAILY_LIMIT).toBeLessThan(100_000);
  });
});

describe("RoomRelay — l'ouverture", () => {
  it("refuse une requête qui n'est pas une montée en WebSocket", async () => {
    const harness = fakeRelay();

    const answer = await harness.relay.fetch(upgradeRequest("1", { upgrade: false }));

    expect(answer.status).toBe(426);
    expect(harness.accepted).toHaveLength(0);
  });

  it.each([
    ["absente", null],
    ["non entière", "deux"],
    ["hors barème", "0"],
  ])("refuse une place %s", async (_label, seat) => {
    const harness = fakeRelay();

    const answer = await harness.relay.fetch(upgradeRequest(seat));

    expect(answer.status).toBe(400);
    expect(harness.accepted).toHaveLength(0);
  });

  it("🔴 refuse un salon qui COMMENCE quand la consommation du jour a atteint le plafond", async () => {
    const harness = fakeRelay({ usage: RELAY_DAILY_LIMIT });

    const answer = await harness.relay.fetch(upgradeRequest("1"));

    expect(answer.status).toBe(429);
    expect(harness.accepted).toHaveLength(0);
  });
});

describe("RoomRelay — l'ouverture acceptée", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "Response",
      class {
        readonly status: number;
        constructor(_body: unknown, init?: { status?: number }) {
          this.status = init?.status ?? 200;
        }
      },
    );
    vi.stubGlobal(
      "WebSocketPair",
      class {
        readonly 0 = { client: true };
        readonly 1 = { server: true };
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("🔴 accepte par l'API Hibernation, en étiquetant la socket de sa place", async () => {
    const harness = fakeRelay();

    const answer = await harness.relay.fetch(upgradeRequest("7"));

    expect(answer.status).toBe(101);
    expect(harness.accepted).toEqual([{ tags: ["7"] }]);
  });

  it("compte la connexion au jour courant", async () => {
    const harness = fakeRelay();

    await harness.relay.fetch(upgradeRequest("1"));

    expect(harness.storage.get("usage")).toMatchObject({ connections: 1, incoming: 0 });
  });

  it("🔴 laisse entrer sur un relais saturé quand la partie est DÉJÀ entamée", async () => {
    const harness = fakeRelay({ usage: RELAY_DAILY_LIMIT });
    harness.join(1);

    const answer = await harness.relay.fetch(upgradeRequest("2"));

    expect(answer.status).toBe(101);
  });

  it("accepte plutôt que de refuser quand le relevé de consommation est illisible", async () => {
    const harness = fakeRelay({ readFails: true });

    const answer = await harness.relay.fetch(upgradeRequest("1"));

    expect(answer.status).toBe(101);
  });
});

describe("RoomRelay — l'acheminement", () => {
  it("🔴 réexpédie la trame TELLE QUELLE aux sockets de la place visée", async () => {
    const harness = fakeRelay();
    const sender = harness.join(1);
    const target = harness.join(2);
    const frame = '2|1|{"type":"bye","seat":1}';

    await harness.relay.webSocketMessage(sender as unknown as WebSocket, frame);

    expect(target.sent).toEqual([frame]);
    expect(sender.sent).toHaveLength(0);
  });

  it("🔴 achemine une charge utile qu'il serait incapable de désérialiser", async () => {
    const harness = fakeRelay();
    const sender = harness.join(1);
    const target = harness.join(2);
    const frame = "2|1|ceci n'est pas du JSON | et contient des barres";

    await harness.relay.webSocketMessage(sender as unknown as WebSocket, frame);

    expect(target.sent).toEqual([frame]);
  });

  it.each([
    ["une donnée binaire", new ArrayBuffer(4)],
    ["une trame sans séparateur", '{"type":"bye"}'],
    ["une trame sans destinataire", "|1|charge"],
    ["un destinataire illisible", "deux|1|charge"],
    ["un destinataire hors barème", "0|1|charge"],
  ])("jette %s sans rien acheminer", async (_label, message) => {
    const harness = fakeRelay();
    const sender = harness.join(1);
    const target = harness.join(2);

    await harness.relay.webSocketMessage(
      sender as unknown as WebSocket,
      message as string | ArrayBuffer,
    );

    expect(target.sent).toHaveLength(0);
    expect(harness.storage.get("usage")).toBeUndefined();
  });

  it("poursuit la diffusion quand une socket meurt en cours de route", async () => {
    const harness = fakeRelay();
    const sender = harness.join(1);
    harness.join(2, { failSend: true });
    const alive = harness.join(2);

    await harness.relay.webSocketMessage(sender as unknown as WebSocket, "2|1|charge");

    expect(alive.sent).toEqual(["2|1|charge"]);
  });

  it("🔴 ne persiste le compteur qu'une fois par requête FACTURABLE, pas une fois par message", async () => {
    const harness = fakeRelay();
    const sender = harness.join(1);
    harness.join(2);

    for (let sent = 0; sent < 19; sent += 1) {
      await harness.relay.webSocketMessage(sender as unknown as WebSocket, "2|1|charge");
    }
    expect(harness.storage.get("usage")).toBeUndefined();

    await harness.relay.webSocketMessage(sender as unknown as WebSocket, "2|1|charge");
    expect(harness.storage.get("usage")).toMatchObject({ connections: 0, incoming: 20 });
  });
});

describe("RoomRelay — la fin du salon", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("raccroche le partant sans remonter de relevé tant qu'il reste du monde", async () => {
    const harness = fakeRelay();
    const leaving = harness.join(1);
    harness.join(2);

    harness.leave(leaving);
    await harness.relay.webSocketClose(leaving as unknown as WebSocket);

    expect(leaving.closeCalls).toBe(1);
    expect(harness.statements).toHaveLength(0);
  });

  it("🔴 remonte en D1 la consommation du salon quand le DERNIER s'en va, reliquat compris", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-19T22:30:00Z"));
    const harness = fakeRelay();
    const last = harness.join(1);
    harness.join(2);
    await harness.relay.webSocketMessage(last as unknown as WebSocket, "2|1|charge");

    harness.leave(last);
    harness.sockets.length = 0;
    await harness.relay.webSocketClose(last as unknown as WebSocket);

    expect(harness.statements).toHaveLength(1);
    expect(harness.statements[0]?.sql).toContain("INSERT INTO relay_usage");
    expect(harness.statements[0]?.params).toEqual(["2026-09-19", 1]);
    expect(harness.storage.get("usage")).toBeUndefined();
  });

  it("🔴 range la consommation au jour UTC, et non à l'heure de Paris", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T01:30:00+02:00"));
    const harness = fakeRelay();
    const last = harness.join(1);
    await harness.relay.webSocketMessage(last as unknown as WebSocket, "1|1|charge");

    harness.sockets.length = 0;
    await harness.relay.webSocketClose(last as unknown as WebSocket);

    expect(harness.statements[0]?.params[0]).toBe("2026-09-19");
  });

  it("🔴 solde la veille avant de repartir de zéro quand un salon traverse minuit UTC", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-19T23:59:00Z"));
    const harness = fakeRelay();
    const socket = harness.join(1);
    for (let sent = 0; sent < 20; sent += 1) {
      await harness.relay.webSocketMessage(socket as unknown as WebSocket, "1|1|charge");
    }

    vi.setSystemTime(new Date("2026-09-20T00:01:00Z"));
    for (let sent = 0; sent < 20; sent += 1) {
      await harness.relay.webSocketMessage(socket as unknown as WebSocket, "1|1|charge");
    }

    expect(harness.statements).toEqual([
      { sql: expect.stringContaining("INSERT INTO relay_usage"), params: ["2026-09-19", 1] },
    ]);
    expect(harness.storage.get("usage")).toMatchObject({ day: "2026-09-20", incoming: 20 });
  });

  it("traite une socket en erreur comme une socket partie", async () => {
    const harness = fakeRelay();
    const broken = harness.join(1);

    harness.sockets.length = 0;
    await harness.relay.webSocketError(broken as unknown as WebSocket);

    expect(broken.closeCalls).toBe(1);
  });

  it("🔴 ne coupe aucune partie quand le relevé D1 échoue", async () => {
    const harness = fakeRelay({ writeFails: true });
    const last = harness.join(1);
    await harness.relay.webSocketMessage(last as unknown as WebSocket, "1|1|charge");

    harness.sockets.length = 0;

    await expect(harness.relay.webSocketClose(last as unknown as WebSocket)).resolves.not.toThrow();
  });
});
