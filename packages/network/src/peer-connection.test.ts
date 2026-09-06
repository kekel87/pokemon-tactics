import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PeerJsTransport } from "./peer-connection.js";
import type { NetworkMessage } from "./protocol.js";
import type { FakeDataConnection } from "./testing/fake-peerjs.js";
import { fakePeerjs } from "./testing/fake-peerjs.js";
import type { NetworkChannel } from "./transport.js";

/** Pourquoi la bibliothèque est remplacée plutôt qu'injectée : voir `testing/fake-peerjs.ts`. */
vi.mock("peerjs", async () => {
  const { FakePeer } = await import("./testing/fake-peerjs.js");
  return { default: FakePeer as unknown as typeof import("peerjs").default };
});

const OWN_PEER_ID = "pkmntac-A7K2M-2";
const HOST_PEER_ID = "pkmntac-A7K2M-1";

const BYE: NetworkMessage = { type: "bye", seat: 2 };
const START_ACK: NetworkMessage = { type: "start_ack", seat: 2 };

const SEND_FAILED = new Error("empaquetage binaire impossible");

/** Laisse partir la micro-tâche du `.catch` de `send` — il n'en planifie qu'une. */
async function settleSendOutcome(): Promise<void> {
  await Promise.resolve();
}

async function openOutgoingChannel(): Promise<{
  transport: PeerJsTransport;
  channel: NetworkChannel;
  connection: FakeDataConnection;
  closeNotifications: () => number;
}> {
  const transport = new PeerJsTransport();
  await transport.claim(OWN_PEER_ID);
  const channel = await transport.connect(HOST_PEER_ID);
  let notified = 0;
  channel.onClose(() => {
    notified += 1;
  });
  return {
    transport,
    channel,
    connection: fakePeerjs.lastConnection(),
    closeNotifications: () => notified,
  };
}

beforeEach(() => {
  fakePeerjs.reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PeerJsChannel.send", () => {
  it("prévient de la fermeture quand l'empaquetage de l'envoi rejette", async () => {
    const { channel, connection, closeNotifications } = await openOutgoingChannel();
    connection.sendResult = () => Promise.reject(SEND_FAILED);

    channel.send(BYE);

    expect(closeNotifications()).toBe(0);
    await vi.waitFor(() => expect(closeNotifications()).toBe(1));
  });

  it("ferme la connexion sous-jacente quand l'empaquetage de l'envoi rejette", async () => {
    const { channel, connection } = await openOutgoingChannel();
    connection.sendResult = () => Promise.reject(SEND_FAILED);

    channel.send(BYE);

    await vi.waitFor(() => expect(connection.closeCalls).toEqual([{ flush: true }]));
  });

  it.each<[string, () => void | Promise<void>]>([
    ["synchrone", () => undefined],
    ["asynchrone tenu", () => Promise.resolve()],
  ])("ne ferme rien sur un envoi %s", async (_label, sendResult) => {
    const { channel, connection, closeNotifications } = await openOutgoingChannel();
    connection.sendResult = sendResult;

    channel.send(BYE);
    await settleSendOutcome();

    expect(closeNotifications()).toBe(0);
    expect(connection.closeCalls).toEqual([]);
    expect(connection.sent).toEqual([BYE]);
  });

  it("n'écrit plus rien après un envoi qui a échoué", async () => {
    const { channel, connection } = await openOutgoingChannel();
    connection.sendResult = () => Promise.reject(SEND_FAILED);

    channel.send(BYE);
    await settleSendOutcome();
    connection.sendResult = () => undefined;
    channel.send(START_ACK);

    expect(connection.sent).toEqual([BYE]);
  });
});

describe("PeerJsChannel", () => {
  it("ne prévient qu'une fois quand un rejet d'envoi précède la fermeture de peerjs", async () => {
    const { channel, connection, closeNotifications } = await openOutgoingChannel();
    connection.sendResult = () => Promise.reject(SEND_FAILED);

    channel.send(BYE);
    await vi.waitFor(() => expect(closeNotifications()).toBe(1));
    connection.emitClose();

    expect(closeNotifications()).toBe(1);
  });

  it("ne ferme la connexion qu'une fois quand on referme un canal déjà fermé", async () => {
    const { channel, connection } = await openOutgoingChannel();

    channel.close();
    channel.close();

    expect(connection.closeCalls).toEqual([{ flush: true }]);
  });

  it("traite une erreur de connexion comme une fermeture", async () => {
    const { connection, closeNotifications } = await openOutgoingChannel();

    connection.emitError();

    expect(closeNotifications()).toBe(1);
  });

  it("expose l'adresse du pair joint", async () => {
    const { channel } = await openOutgoingChannel();

    expect(channel.remotePeerId).toBe(HOST_PEER_ID);
  });
});

describe("PeerJsTransport", () => {
  it("prend l'identifiant demandé", async () => {
    const transport = new PeerJsTransport();

    await transport.claim(OWN_PEER_ID);

    expect(fakePeerjs.lastPeer().id).toBe(OWN_PEER_ID);
  });

  it("demande un canal sortant ordonné et retransmis", async () => {
    const { connection } = await openOutgoingChannel();

    expect(connection.options).toEqual({ reliable: true });
  });

  it("ferme les canaux vivants quand il est détruit", async () => {
    const { transport, connection } = await openOutgoingChannel();

    transport.destroy();

    expect(connection.closeCalls).toEqual([{ flush: true }]);
  });

  it("ne détruit le pair qu'après la marge laissée aux derniers messages", async () => {
    const { transport } = await openOutgoingChannel();
    const peer = fakePeerjs.lastPeer();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    transport.destroy();

    expect(peer.destroyed).toBe(false);
    vi.runAllTimers();
    expect(peer.destroyed).toBe(true);
  });
});
