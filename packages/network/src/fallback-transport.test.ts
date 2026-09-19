import { describe, expect, it, vi } from "vitest";
import { FallbackTransport } from "./fallback-transport.js";
import { Listeners } from "./listeners.js";
import { NetworkErrorCode } from "./protocol.js";
import { type NetworkChannel, type NetworkTransport, NetworkTransportError } from "./transport.js";

const DIRECT_CHANNEL = { remotePeerId: "direct" } as unknown as NetworkChannel;
const RELAY_CHANNEL = { remotePeerId: "relay" } as unknown as NetworkChannel;

const PEER_ID = "pkmntac-A7K2M-1";

interface TransportStub {
  transport: NetworkTransport;
  claim: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  pushIncoming(channel: NetworkChannel): void;
}

function transportStub(channel: NetworkChannel): TransportStub {
  const incoming = new Listeners<[channel: NetworkChannel]>();
  const claim = vi.fn(() => Promise.resolve());
  const connect = vi.fn(() => Promise.resolve(channel));
  const destroy = vi.fn();
  return {
    transport: {
      claim,
      connect,
      onIncoming: (listener: (pushed: NetworkChannel) => void) => incoming.subscribe(listener),
      destroy,
    } as unknown as NetworkTransport,
    claim,
    connect,
    destroy,
    pushIncoming: (pushed) => incoming.emit(pushed),
  };
}

async function readyCascade(): Promise<{
  direct: TransportStub;
  relay: TransportStub;
  fallback: FallbackTransport;
  onRelayUsed: ReturnType<typeof vi.fn>;
}> {
  const direct = transportStub(DIRECT_CHANNEL);
  const relay = transportStub(RELAY_CHANNEL);
  const onRelayUsed = vi.fn();
  const fallback = new FallbackTransport({
    direct: direct.transport,
    relay: relay.transport,
    onRelayUsed,
  });
  await fallback.claim(PEER_ID);
  await vi.waitFor(() => expect(relay.claim).toHaveBeenCalled());
  await Promise.resolve();
  return { direct, relay, fallback, onRelayUsed };
}

describe("FallbackTransport.claim", () => {
  it("prend l'identité chez le DIRECT, qui seul alloue la place", async () => {
    const { direct, relay } = await readyCascade();

    expect(direct.claim).toHaveBeenCalledWith(PEER_ID);
    expect(relay.claim).toHaveBeenCalledWith(PEER_ID);
  });

  it("🔴 rend la main sans attendre la socket du relais", async () => {
    const direct = transportStub(DIRECT_CHANNEL);
    const relay = transportStub(RELAY_CHANNEL);
    relay.claim.mockReturnValue(new Promise(() => undefined));
    const fallback = new FallbackTransport({ direct: direct.transport, relay: relay.transport });

    await expect(fallback.claim(PEER_ID)).resolves.not.toThrow();
  });

  it("🔴 avale un relais injoignable : on repart sur le direct seul", async () => {
    const direct = transportStub(DIRECT_CHANNEL);
    const relay = transportStub(RELAY_CHANNEL);
    relay.claim.mockRejectedValue(
      new NetworkTransportError(NetworkErrorCode.ConnexionImpossible, "wss: bloqué"),
    );
    const fallback = new FallbackTransport({ direct: direct.transport, relay: relay.transport });

    await expect(fallback.claim(PEER_ID)).resolves.not.toThrow();

    direct.connect.mockRejectedValue(
      new NetworkTransportError(NetworkErrorCode.ConnexionImpossible),
    );
    await expect(fallback.connect(PEER_ID)).rejects.toMatchObject({
      code: NetworkErrorCode.ConnexionImpossible,
    });
    expect(relay.connect).not.toHaveBeenCalled();
  });

  it("remonte le refus du direct sans consulter le relais", async () => {
    const direct = transportStub(DIRECT_CHANNEL);
    const relay = transportStub(RELAY_CHANNEL);
    direct.claim.mockRejectedValue(new NetworkTransportError(NetworkErrorCode.SalonPlein));
    const fallback = new FallbackTransport({ direct: direct.transport, relay: relay.transport });

    await expect(fallback.claim(PEER_ID)).rejects.toMatchObject({
      code: NetworkErrorCode.SalonPlein,
    });
    expect(relay.claim).not.toHaveBeenCalled();
  });
});

describe("FallbackTransport.connect", () => {
  it("🔴 rend le canal DIRECT sans jamais consulter le relais quand la traversée réussit", async () => {
    const { fallback, relay } = await readyCascade();

    await expect(fallback.connect(PEER_ID)).resolves.toBe(DIRECT_CHANNEL);
    expect(relay.connect).not.toHaveBeenCalled();
  });

  it("transmet les options d'appel au transport qui compose", async () => {
    const { fallback, direct } = await readyCascade();

    await fallback.connect(PEER_ID, { timeoutMs: 8_000 });

    expect(direct.connect).toHaveBeenCalledWith(PEER_ID, { timeoutMs: 8_000 });
  });

  it.each([
    ["connexion impossible", NetworkErrorCode.ConnexionImpossible],
    ["délai dépassé", NetworkErrorCode.DelaiDepasse],
  ])("rejoue par le relais quand la mise en relation échoue en « %s »", async (_label, code) => {
    const { fallback, direct, relay, onRelayUsed } = await readyCascade();
    direct.connect.mockRejectedValue(new NetworkTransportError(code));

    await expect(fallback.connect(PEER_ID, { timeoutMs: 15_000 })).resolves.toBe(RELAY_CHANNEL);
    expect(relay.connect).toHaveBeenCalledWith(PEER_ID, { timeoutMs: 15_000 });
    expect(onRelayUsed).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["salon plein", NetworkErrorCode.SalonPlein],
    ["version incompatible", NetworkErrorCode.VersionIncompatible],
    ["code introuvable", NetworkErrorCode.CodeIntrouvable],
  ])("🔴 n'insiste PAS sur un refus délibéré — « %s »", async (_label, code) => {
    const { fallback, direct, relay, onRelayUsed } = await readyCascade();
    direct.connect.mockRejectedValue(new NetworkTransportError(code));

    await expect(fallback.connect(PEER_ID)).rejects.toMatchObject({ code });
    expect(relay.connect).not.toHaveBeenCalled();
    expect(onRelayUsed).not.toHaveBeenCalled();
  });

  it("n'insiste pas non plus sur une exception qui n'est pas du transport", async () => {
    const { fallback, direct, relay } = await readyCascade();
    const bug = new TypeError("canal indéfini");
    direct.connect.mockRejectedValue(bug);

    await expect(fallback.connect(PEER_ID)).rejects.toBe(bug);
    expect(relay.connect).not.toHaveBeenCalled();
  });

  it("🔴 respecte `relay: false`, que le salon pose sur un code que le registre dit inconnu", async () => {
    const { fallback, direct, relay } = await readyCascade();
    direct.connect.mockRejectedValue(
      new NetworkTransportError(NetworkErrorCode.ConnexionImpossible),
    );

    await expect(fallback.connect(PEER_ID, { relay: false })).rejects.toMatchObject({
      code: NetworkErrorCode.ConnexionImpossible,
    });
    expect(relay.connect).not.toHaveBeenCalled();
  });

  it("rend la cause d'origine, et non une cause inventée, quand aucun relais n'est configuré", async () => {
    const direct = transportStub(DIRECT_CHANNEL);
    const onRelayUsed = vi.fn();
    const fallback = new FallbackTransport({ direct: direct.transport, onRelayUsed });
    await fallback.claim(PEER_ID);
    direct.connect.mockRejectedValue(
      new NetworkTransportError(NetworkErrorCode.DelaiDepasse, "pair muet"),
    );

    await expect(fallback.connect(PEER_ID)).rejects.toMatchObject({
      code: NetworkErrorCode.DelaiDepasse,
      message: "pair muet",
    });
    expect(onRelayUsed).not.toHaveBeenCalled();
  });

  it("ne bascule pas sur un relais dont la socket n'est pas encore ouverte", async () => {
    const direct = transportStub(DIRECT_CHANNEL);
    const relay = transportStub(RELAY_CHANNEL);
    relay.claim.mockReturnValue(new Promise(() => undefined));
    const fallback = new FallbackTransport({ direct: direct.transport, relay: relay.transport });
    await fallback.claim(PEER_ID);
    direct.connect.mockRejectedValue(
      new NetworkTransportError(NetworkErrorCode.ConnexionImpossible),
    );

    await expect(fallback.connect(PEER_ID)).rejects.toMatchObject({
      code: NetworkErrorCode.ConnexionImpossible,
    });
    expect(relay.connect).not.toHaveBeenCalled();
  });

  it("ne bascule plus après destruction", async () => {
    const { fallback, direct, relay } = await readyCascade();
    direct.connect.mockRejectedValue(
      new NetworkTransportError(NetworkErrorCode.ConnexionImpossible),
    );

    fallback.destroy();

    await expect(fallback.connect(PEER_ID)).rejects.toMatchObject({
      code: NetworkErrorCode.ConnexionImpossible,
    });
    expect(relay.connect).not.toHaveBeenCalled();
  });
});

describe("FallbackTransport — les canaux entrants", () => {
  it("🔴 fusionne les deux sources en un seul point de diffusion", async () => {
    const { fallback, direct, relay } = await readyCascade();
    const seen: NetworkChannel[] = [];
    fallback.onIncoming((channel) => seen.push(channel));

    direct.pushIncoming(DIRECT_CHANNEL);
    relay.pushIncoming(RELAY_CHANNEL);

    expect(seen).toEqual([DIRECT_CHANNEL, RELAY_CHANNEL]);
  });

  it("🔴 coupe VRAIMENT l'écoute, sur les deux sources, quand l'appelant se désabonne", async () => {
    const { fallback, direct, relay } = await readyCascade();
    const seen: NetworkChannel[] = [];

    const unsubscribe = fallback.onIncoming((channel) => seen.push(channel));
    unsubscribe();
    direct.pushIncoming(DIRECT_CHANNEL);
    relay.pushIncoming(RELAY_CHANNEL);

    expect(seen).toHaveLength(0);
  });

  it("n'annonce plus rien après destruction", async () => {
    const { fallback, direct } = await readyCascade();
    const seen: NetworkChannel[] = [];
    fallback.onIncoming((channel) => seen.push(channel));

    fallback.destroy();
    direct.pushIncoming(DIRECT_CHANNEL);

    expect(seen).toHaveLength(0);
  });
});

describe("FallbackTransport.destroy", () => {
  it("🔴 coupe les DEUX transports, et leur passe l'abandon", async () => {
    const { fallback, direct, relay } = await readyCascade();

    fallback.destroy({ abandon: true });

    expect(direct.destroy).toHaveBeenCalledWith({ abandon: true });
    expect(relay.destroy).toHaveBeenCalledWith({ abandon: true });
  });

  it("ne raccroche qu'une fois", async () => {
    const { fallback, direct, relay } = await readyCascade();

    fallback.destroy();
    fallback.destroy();

    expect(direct.destroy).toHaveBeenCalledTimes(1);
    expect(relay.destroy).toHaveBeenCalledTimes(1);
  });
});
