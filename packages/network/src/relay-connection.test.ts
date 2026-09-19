import { afterEach, describe, expect, it, vi } from "vitest";
import { NetworkErrorCode, type NetworkMessage } from "./protocol.js";
import { RelayTransport } from "./relay-connection.js";
import { FakeSocketState, FakeWebSocket } from "./testing/fake-websocket.js";
import { ChannelHealth, type NetworkChannel } from "./transport.js";

const ENDPOINT = "wss://relais.test/relais";
const OWN_PEER_ID = "pkmntac-A7K2M-2";
const HOST_PEER_ID = "pkmntac-A7K2M-1";
const THIRD_PEER_ID = "pkmntac-A7K2M-3";

const BYE: NetworkMessage = { type: "bye", seat: 2 };
const START_ACK: NetworkMessage = { type: "start_ack", seat: 2 };

const OPEN_TIMEOUT_MS = 3_000;

interface RelayHarness {
  transport: RelayTransport;
  sockets: FakeWebSocket[];
  latest(): FakeWebSocket;
  breakNextOpen(): void;
}

function relayHarness(): RelayHarness {
  const sockets: FakeWebSocket[] = [];
  let broken = false;
  const transport = new RelayTransport({
    endpoint: ENDPOINT,
    openSocket: (url) => {
      if (broken) {
        broken = false;
        throw new Error("wss: bloqué");
      }
      const socket = new FakeWebSocket(url);
      sockets.push(socket);
      return socket.asWebSocket();
    },
  });
  return {
    transport,
    sockets,
    latest: () => {
      const socket = sockets.at(-1);
      if (socket === undefined) {
        throw new Error("le transport n'a demandé aucune socket");
      }
      return socket;
    },
    breakNextOpen: () => {
      broken = true;
    },
  };
}

async function connectedHarness(): Promise<RelayHarness> {
  const harness = relayHarness();
  const claim = harness.transport.claim(OWN_PEER_ID);
  harness.latest().emitOpen();
  await claim;
  return harness;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("RelayTransport.claim", () => {
  it("ouvre la socket du CODE de partie, place comprise", async () => {
    const harness = await connectedHarness();

    expect(harness.sockets).toHaveLength(1);
    expect(harness.latest().url).toBe(`${ENDPOINT}/A7K2M?seat=2`);
  });

  it("🔴 ouvre la socket de l'hôte, qui ne compose jamais", async () => {
    const harness = relayHarness();
    const claim = harness.transport.claim(HOST_PEER_ID);

    expect(harness.sockets).toHaveLength(1);
    harness.latest().emitOpen();
    await claim;
  });

  it("refuse une adresse illisible sans rien ouvrir", async () => {
    const harness = relayHarness();

    await expect(harness.transport.claim("autrejeu-A7K2M-2")).rejects.toMatchObject({
      code: NetworkErrorCode.ConnexionImpossible,
    });
    expect(harness.sockets).toHaveLength(0);
  });

  it("rend « délai dépassé » quand le relais reste muet, et raccroche la socket abandonnée", async () => {
    vi.useFakeTimers();
    const harness = relayHarness();
    const claim = harness.transport.claim(OWN_PEER_ID);
    const rejection = expect(claim).rejects.toMatchObject({
      code: NetworkErrorCode.DelaiDepasse,
    });

    vi.advanceTimersByTime(OPEN_TIMEOUT_MS);

    await rejection;
    expect(harness.latest().closeCalls).toHaveLength(1);
  });

  it("rend « connexion impossible » quand la socket ne peut même pas être construite", async () => {
    const harness = relayHarness();
    harness.breakNextOpen();

    await expect(harness.transport.claim(OWN_PEER_ID)).rejects.toMatchObject({
      code: NetworkErrorCode.ConnexionImpossible,
    });
  });

  it("rend « connexion impossible » quand la socket se ferme avant de s'ouvrir", async () => {
    const harness = relayHarness();
    const claim = harness.transport.claim(OWN_PEER_ID);

    harness.latest().emitClose(1006);

    await expect(claim).rejects.toMatchObject({ code: NetworkErrorCode.ConnexionImpossible });
  });

  it("🔴 ne met pas une ouverture RATÉE en cache : la tentative suivante rouvre", async () => {
    const harness = relayHarness();
    harness.breakNextOpen();
    await expect(harness.transport.claim(OWN_PEER_ID)).rejects.toThrow();

    const retry = harness.transport.claim(OWN_PEER_ID);
    harness.latest().emitOpen();

    await retry;
    expect(harness.sockets).toHaveLength(1);
  });

  it("n'ouvre qu'UNE socket quand plusieurs appels la réclament en même temps", async () => {
    const harness = relayHarness();
    const claim = harness.transport.claim(OWN_PEER_ID);
    const connect = harness.transport.connect(HOST_PEER_ID);

    harness.latest().emitOpen();
    await claim;
    await connect;

    expect(harness.sockets).toHaveLength(1);
  });

  it("refuse tout après destruction", async () => {
    const harness = relayHarness();
    harness.transport.destroy();

    await expect(harness.transport.claim(OWN_PEER_ID)).rejects.toMatchObject({
      code: NetworkErrorCode.ConnexionImpossible,
    });
  });
});

describe("RelayTransport.connect", () => {
  it("refuse de joindre un pair avant d'avoir pris son propre identifiant", async () => {
    const harness = relayHarness();

    await expect(harness.transport.connect(HOST_PEER_ID)).rejects.toMatchObject({
      code: NetworkErrorCode.ConnexionImpossible,
    });
    expect(harness.sockets).toHaveLength(0);
  });

  it("refuse une adresse qui n'est pas de ce salon", async () => {
    const harness = await connectedHarness();

    await expect(harness.transport.connect("pkmntac-B8L3N-1")).rejects.toMatchObject({
      code: NetworkErrorCode.CodeIntrouvable,
    });
  });

  it("rend le MÊME canal pour deux appels sur la même place", async () => {
    const harness = await connectedHarness();

    const first = await harness.transport.connect(HOST_PEER_ID);
    const second = await harness.transport.connect(HOST_PEER_ID);

    expect(second).toBe(first);
    expect(first.remotePeerId).toBe(HOST_PEER_ID);
  });

  it("🔴 cadre l'envoi en `<to>|<from>|<charge utile>`, adresse HORS du JSON", async () => {
    const harness = await connectedHarness();
    const channel = await harness.transport.connect(HOST_PEER_ID);

    channel.send(BYE);

    expect(harness.latest().sent).toEqual([`1|2|${JSON.stringify(BYE)}`]);
  });
});

describe("RelayTransport — la réception", () => {
  it("livre au canal déjà ouvert, sans annoncer de canal entrant", async () => {
    const harness = await connectedHarness();
    const channel = await harness.transport.connect(HOST_PEER_ID);
    const received: NetworkMessage[] = [];
    const announced: NetworkChannel[] = [];
    channel.onMessage((message) => received.push(message));
    harness.transport.onIncoming((incoming) => announced.push(incoming));

    harness.latest().emitMessage(`2|1|${JSON.stringify(START_ACK)}`);

    expect(received).toEqual([START_ACK]);
    expect(announced).toHaveLength(0);
  });

  it("ANNONCE un canal entrant pour une place qu'on n'avait pas jointe, AVANT de lui livrer", async () => {
    const harness = await connectedHarness();
    const announced: NetworkChannel[] = [];
    const received: NetworkMessage[] = [];
    harness.transport.onIncoming((incoming) => announced.push(incoming));
    harness.transport.onIncoming((incoming) =>
      incoming.onMessage((message) => received.push(message)),
    );

    harness.latest().emitMessage(`2|3|${JSON.stringify(START_ACK)}`);

    expect(announced).toHaveLength(1);
    expect(announced[0]?.remotePeerId).toBe(THIRD_PEER_ID);
    expect(received).toEqual([START_ACK]);
  });

  it("n'annonce qu'une fois une place qui parle deux fois", async () => {
    const harness = await connectedHarness();
    const announced: NetworkChannel[] = [];
    harness.transport.onIncoming((incoming) => announced.push(incoming));

    harness.latest().emitMessage(`2|3|${JSON.stringify(START_ACK)}`);
    harness.latest().emitMessage(`2|3|${JSON.stringify(BYE)}`);

    expect(announced).toHaveLength(1);
  });

  it.each<[string, unknown]>([
    ["une trame sans séparateur", '{"type":"bye","seat":2}'],
    ["une place émettrice illisible", '2|abc|{"type":"bye","seat":2}'],
    ["une place émettrice hors barème", '2|0|{"type":"bye","seat":2}'],
    ["une charge utile qui n'est pas du JSON", "2|1|pas du json"],
    ["un message hors protocole", '2|1|{"type":"inconnu"}'],
    ["une donnée binaire", new ArrayBuffer(4)],
  ])("ignore %s au lieu d'en faire une erreur d'interface", async (_label, data) => {
    const harness = await connectedHarness();
    const channel = await harness.transport.connect(HOST_PEER_ID);
    const received: NetworkMessage[] = [];
    const announced: NetworkChannel[] = [];
    channel.onMessage((message) => received.push(message));
    harness.transport.onIncoming((incoming) => announced.push(incoming));

    harness.latest().emitMessage(data);

    expect(received).toHaveLength(0);
    expect(announced).toHaveLength(0);
  });
});

describe("RelayTransport — la fermeture", () => {
  it("marque les canaux perdus PUIS fermés quand la socket meurt", async () => {
    const harness = await connectedHarness();
    const channel = await harness.transport.connect(HOST_PEER_ID);
    const events: string[] = [];
    channel.onHealthChange((health) => events.push(health));
    channel.onClose(() => events.push("close"));

    harness.latest().emitClose(1006);

    expect(events).toEqual([ChannelHealth.Failed, "close"]);
  });

  it("🔴 n'annonce JAMAIS un canal relayé en bonne santé", async () => {
    const harness = await connectedHarness();
    const channel = await harness.transport.connect(HOST_PEER_ID);
    const health: ChannelHealth[] = [];
    channel.onHealthChange((state) => health.push(state));

    harness.latest().emitMessage(`2|1|${JSON.stringify(START_ACK)}`);
    channel.send(BYE);

    expect(health).toHaveLength(0);
  });

  it("ne livre plus rien à un canal fermé par l'appelant", async () => {
    const harness = await connectedHarness();
    const channel = await harness.transport.connect(HOST_PEER_ID);
    const received: NetworkMessage[] = [];
    channel.onMessage((message) => received.push(message));

    channel.close();
    harness.latest().emitMessage(`2|1|${JSON.stringify(START_ACK)}`);

    expect(received).toHaveLength(0);
  });

  it("avale un envoi dont la socket est déjà en train de se fermer, plutôt que de jeter", async () => {
    const harness = await connectedHarness();
    const channel = await harness.transport.connect(HOST_PEER_ID);
    const socket = harness.latest();

    socket.close();

    expect(socket.readyState).toBe(FakeSocketState.Closing);
    expect(() => channel.send(BYE)).not.toThrow();
    expect(socket.sent).toHaveLength(0);
  });

  it("raccroche proprement à la destruction, et ne la rejoue pas", async () => {
    const harness = await connectedHarness();

    harness.transport.destroy();
    harness.transport.destroy();

    expect(harness.latest().closeCalls).toEqual([{ code: 1000, reason: "bye" }]);
  });

  it("🔴 ne laisse aucune socket vivante quand `destroy()` passe PENDANT l'ouverture", async () => {
    const harness = relayHarness();
    const claim = harness.transport.claim(OWN_PEER_ID);
    const socket = harness.latest();

    harness.transport.destroy();
    expect(socket.closeCalls).toHaveLength(0);

    socket.emitOpen();

    await expect(claim).rejects.toMatchObject({ code: NetworkErrorCode.ConnexionImpossible });
    expect(socket.closeCalls).toEqual([{ code: 1000, reason: "bye" }]);
  });
});
