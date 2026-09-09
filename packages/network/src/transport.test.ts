import { describe, expect, it } from "vitest";
import { NetworkErrorCode } from "./protocol.js";
import { FakeNetworkDirectory } from "./testing/fake-transport.js";
import {
  CLAIM_RETRY_DELAYS_MS,
  claimOwnIdentity,
  type NetworkTransport,
  NetworkTransportError,
  networkErrorCodeFromPeerError,
} from "./transport.js";

const OWN_PEER_ID = "pkmntac-A7K2M-1";
const OTHER_PEER_ID = "pkmntac-A7K2M-2";

function recordingSleep(): { sleep: (delayMs: number) => Promise<void>; delays: number[] } {
  const delays: number[] = [];
  return {
    delays,
    sleep: async (delayMs) => {
      delays.push(delayMs);
    },
  };
}

describe("networkErrorCodeFromPeerError", () => {
  it("distingue le code mal recopié de la place déjà prise", () => {
    expect(networkErrorCodeFromPeerError("peer-unavailable")).toBe(
      NetworkErrorCode.CodeIntrouvable,
    );
    expect(networkErrorCodeFromPeerError("unavailable-id")).toBe(NetworkErrorCode.SalonPlein);
  });

  it("rabat toute autre cause sur « connexion impossible »", () => {
    for (const peerErrorType of [
      "network",
      "socket-error",
      "socket-closed",
      "server-error",
      "webrtc",
      "browser-incompatible",
      "ssl-unavailable",
      "invalid-id",
      "invalid-key",
      "disconnected",
      "cause-ajoutee-par-une-version-future",
    ]) {
      expect(networkErrorCodeFromPeerError(peerErrorType)).toBe(
        NetworkErrorCode.ConnexionImpossible,
      );
    }
  });
});

describe("claimOwnIdentity", () => {
  it("prend l'identifiant sans attendre quand il est libre", async () => {
    const directory = new FakeNetworkDirectory();
    const { sleep, delays } = recordingSleep();

    await claimOwnIdentity(directory.createTransport(), OWN_PEER_ID, sleep);

    expect(delays).toEqual([]);
  });

  it("réessaie avec un délai croissant tant que l'adresse est retenue", async () => {
    const directory = new FakeNetworkDirectory();
    directory.linger(OWN_PEER_ID);
    const delays: number[] = [];
    const sleep = async (delayMs: number) => {
      delays.push(delayMs);
      if (delays.length === 2) {
        directory.release(OWN_PEER_ID);
      }
    };

    await claimOwnIdentity(directory.createTransport(), OWN_PEER_ID, sleep);

    expect(delays).toEqual([CLAIM_RETRY_DELAYS_MS[0], CLAIM_RETRY_DELAYS_MS[1]]);
  });

  it("abandonne sur « salon plein » après avoir épuisé les réessais", async () => {
    const directory = new FakeNetworkDirectory();
    directory.linger(OWN_PEER_ID);
    const { sleep, delays } = recordingSleep();

    await expect(
      claimOwnIdentity(directory.createTransport(), OWN_PEER_ID, sleep),
    ).rejects.toMatchObject({ code: NetworkErrorCode.SalonPlein });
    expect(delays).toEqual([...CLAIM_RETRY_DELAYS_MS]);
  });

  it("n'insiste pas quand l'annuaire est injoignable", async () => {
    const directory = new FakeNetworkDirectory();
    directory.failClaimsWith(NetworkErrorCode.ConnexionImpossible);
    const { sleep, delays } = recordingSleep();

    await expect(
      claimOwnIdentity(directory.createTransport(), OWN_PEER_ID, sleep),
    ).rejects.toMatchObject({ code: NetworkErrorCode.ConnexionImpossible });
    expect(delays).toEqual([]);
  });
});

describe("FakeNetworkDirectory", () => {
  it("rend la prise d'identifiant exclusive", async () => {
    const directory = new FakeNetworkDirectory();
    const first = directory.createTransport();
    const second = directory.createTransport();

    await first.claim(OWN_PEER_ID);

    await expect(second.claim(OWN_PEER_ID)).rejects.toMatchObject({
      code: NetworkErrorCode.SalonPlein,
    });
  });

  it("libère l'identifiant quand le transport est détruit", async () => {
    const directory = new FakeNetworkDirectory();
    const first = directory.createTransport();
    await first.claim(OWN_PEER_ID);
    first.destroy();

    await expect(directory.createTransport().claim(OWN_PEER_ID)).resolves.toBeUndefined();
  });

  it("retient une adresse sans pair derrière, puis la libère", async () => {
    const directory = new FakeNetworkDirectory();
    directory.linger(OWN_PEER_ID);
    const transport = directory.createTransport();

    await expect(transport.claim(OWN_PEER_ID)).rejects.toMatchObject({
      code: NetworkErrorCode.SalonPlein,
    });

    directory.release(OWN_PEER_ID);

    await expect(transport.claim(OWN_PEER_ID)).resolves.toBeUndefined();
  });

  it("refuse de joindre une adresse que personne ne tient", async () => {
    const directory = new FakeNetworkDirectory();
    const transport = directory.createTransport();
    await transport.claim(OTHER_PEER_ID);

    await expect(transport.connect(OWN_PEER_ID)).rejects.toMatchObject({
      code: NetworkErrorCode.CodeIntrouvable,
    });
  });

  it("refuse de joindre avant d'avoir pris son propre identifiant", async () => {
    const directory = new FakeNetworkDirectory();
    const host = directory.createTransport();
    await host.claim(OWN_PEER_ID);

    await expect(directory.createTransport().connect(OWN_PEER_ID)).rejects.toMatchObject({
      code: NetworkErrorCode.ConnexionImpossible,
    });
  });

  it("livre les messages en asynchrone", async () => {
    const directory = new FakeNetworkDirectory();
    const host = directory.createTransport();
    const guest = directory.createTransport();
    await host.claim(OWN_PEER_ID);
    await guest.claim(OTHER_PEER_ID);
    const received: string[] = [];
    host.onIncoming((channel) => {
      channel.onMessage((message) => received.push(message.type));
    });

    const channel = await guest.connect(OWN_PEER_ID);
    channel.send({ type: "bye", seat: 2 });

    expect(received).toEqual([]);
    await Promise.resolve();
    expect(received).toEqual(["bye"]);
  });

  it("livre une copie, jamais la référence envoyée", async () => {
    const directory = new FakeNetworkDirectory();
    const host = directory.createTransport();
    const guest = directory.createTransport();
    await host.claim(OWN_PEER_ID);
    await guest.claim(OTHER_PEER_ID);
    const sent = { type: "bye", seat: 2 } as const;
    let delivered: unknown;
    host.onIncoming((channel) => {
      channel.onMessage((message) => {
        delivered = message;
      });
    });

    const channel = await guest.connect(OWN_PEER_ID);
    channel.send(sent);
    await Promise.resolve();

    expect(delivered).toEqual(sent);
    expect(delivered).not.toBe(sent);
  });

  it("délivre ce qui a été envoyé avant une fermeture", async () => {
    const directory = new FakeNetworkDirectory();
    const host = directory.createTransport();
    const guest = directory.createTransport();
    await host.claim(OWN_PEER_ID);
    await guest.claim(OTHER_PEER_ID);
    const received: string[] = [];
    host.onIncoming((channel) => {
      channel.onMessage((message) => received.push(message.type));
    });

    const channel = await guest.connect(OWN_PEER_ID);
    channel.send({ type: "bye", seat: 2 });
    channel.close();
    await Promise.resolve();
    await Promise.resolve();

    expect(received).toEqual(["bye"]);
  });
});

describe("claimOwnIdentity — patience de la reconnexion (plan 202)", () => {
  const patientSleep = async (): Promise<void> => {
    /* aucune attente réelle en test */
  };

  function transportFailing(codes: readonly NetworkErrorCode[]): {
    transport: NetworkTransport;
    attempts: () => number;
  } {
    let attempt = 0;
    return {
      transport: {
        claim: async () => {
          const code = codes[attempt];
          attempt += 1;
          if (code !== undefined) {
            throw new NetworkTransportError(code, "refus simulé");
          }
        },
        connect: () => Promise.reject(new Error("non utilisé")),
        onIncoming: () => () => undefined,
        destroy: () => undefined,
      },
      attempts: () => attempt,
    };
  }

  it("réessaie un refus transitoire sur le barème patient", async () => {
    const failing = transportFailing([
      NetworkErrorCode.ConnexionImpossible,
      NetworkErrorCode.DelaiDepasse,
    ]);

    await claimOwnIdentity(failing.transport, "pkmntac-A7K2M-1", patientSleep, [1, 1, 1], true);

    expect(failing.attempts()).toBe(3);
  });

  it("abandonne un refus transitoire sur le barème de la création", async () => {
    const failing = transportFailing([NetworkErrorCode.ConnexionImpossible]);

    await expect(
      claimOwnIdentity(failing.transport, "pkmntac-A7K2M-1", patientSleep),
    ).rejects.toMatchObject({ code: NetworkErrorCode.ConnexionImpossible });
    expect(failing.attempts()).toBe(1);
  });

  it("réessaie une place occupée dans les deux cas", async () => {
    const patient = transportFailing([NetworkErrorCode.SalonPlein]);
    const pressed = transportFailing([NetworkErrorCode.SalonPlein]);

    await claimOwnIdentity(patient.transport, "pkmntac-A7K2M-1", patientSleep, [1], true);
    await claimOwnIdentity(pressed.transport, "pkmntac-A7K2M-1", patientSleep);

    expect(patient.attempts()).toBe(2);
    expect(pressed.attempts()).toBe(2);
  });
});
