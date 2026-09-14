import { describe, expect, it } from "vitest";
import {
  isRendezvousOrigin,
  isValidRendezvousCode,
  type RendezvousRequest,
  ROOM_TTL_MS,
  RoomRendezvous,
} from "./rendezvous";

/** Un stockage de Durable Object en mémoire : une seule clé, c'est tout ce que le registre écrit. */
function fakeState(seed?: { host: unknown }): DurableObjectState {
  const map = new Map<string, unknown>(seed === undefined ? [] : [["host", seed.host]]);
  return {
    storage: {
      get: (key: string) => Promise.resolve(map.get(key)),
      put: (key: string, value: unknown) => {
        map.set(key, value);
        return Promise.resolve();
      },
      delete: (key: string) => Promise.resolve(map.delete(key)),
    },
  } as unknown as DurableObjectState;
}

async function call(
  room: RoomRendezvous,
  body: RendezvousRequest,
): Promise<Record<string, unknown>> {
  const answer = await room.fetch(
    new Request("https://example.test/salon/ABCD", { method: "POST", body: JSON.stringify(body) }),
  );
  return (await answer.json()) as Record<string, unknown>;
}

describe("isValidRendezvousCode", () => {
  it("🔴 accepte un code de la VRAIE longueur du jeu — cinq caractères", () => {
    // Le bug du 2026-09-14 : la règle exigeait quatre caractères, donc tout code réel était refusé
    // en 400 et la migration d'hôte ne pouvait pas avoir lieu. Les tests d'alors employaient des
    // codes inventés à quatre caractères, et validaient donc l'erreur.
    expect(isValidRendezvousCode("D65ZV")).toBe(true);
    expect(isValidRendezvousCode("d65zv")).toBe(true);
  });

  it("accepte la fourchette, sans recopier la règle du jeu", () => {
    expect(isValidRendezvousCode("AB12")).toBe(true);
    expect(isValidRendezvousCode("ABCDEFGH")).toBe(true);
  });

  it("refuse ce qui ne peut pas être un nom d'objet", () => {
    expect(isValidRendezvousCode("ABC")).toBe(false);
    expect(isValidRendezvousCode("ABCDEFGHIJKLM")).toBe(false);
    expect(isValidRendezvousCode("AB-2")).toBe(false);
    expect(isValidRendezvousCode("")).toBe(false);
  });
});

describe("isRendezvousOrigin", () => {
  it("admet les origines de publication", () => {
    expect(isRendezvousOrigin("https://kekel87.github.io")).toBe(true);
    expect(isRendezvousOrigin("https://html-classic.itch.zone")).toBe(true);
  });

  it("admet le développement local, quel que soit le port", () => {
    expect(isRendezvousOrigin("http://localhost:5173")).toBe(true);
    expect(isRendezvousOrigin("http://localhost:5199")).toBe(true);
    expect(isRendezvousOrigin("http://127.0.0.1:4321")).toBe(true);
  });

  it("refuse tout le reste", () => {
    expect(isRendezvousOrigin(null)).toBe(false);
    expect(isRendezvousOrigin("https://evil.test")).toBe(false);
    expect(isRendezvousOrigin("http://localhost.evil.test")).toBe(false);
    expect(isRendezvousOrigin("https://localhost:5173")).toBe(false);
  });
});

describe("RoomRendezvous", () => {
  it("ouvre un salon libre et rend la première époque", async () => {
    const room = new RoomRendezvous(fakeState());

    expect(await call(room, { op: "claim", peerId: "peer-a" })).toEqual({
      ok: true,
      peerId: "peer-a",
      epoch: 1,
    });
  });

  it("refuse de voler un code déjà pris, et dit à qui il est", async () => {
    const room = new RoomRendezvous(fakeState());
    await call(room, { op: "claim", peerId: "peer-a" });

    expect(await call(room, { op: "claim", peerId: "peer-b" })).toEqual({
      ok: false,
      peerId: "peer-a",
      epoch: 1,
    });
  });

  it("dit qu'un code inconnu n'existe pas", async () => {
    const room = new RoomRendezvous(fakeState());

    expect(await call(room, { op: "get" })).toEqual({ absent: true });
  });

  it("laisse le successeur reprendre la main à la bonne époque", async () => {
    const room = new RoomRendezvous(fakeState());
    await call(room, { op: "claim", peerId: "peer-a" });

    expect(await call(room, { op: "takeOver", peerId: "peer-b", epoch: 1 })).toEqual({
      ok: true,
      peerId: "peer-b",
      epoch: 2,
    });
    expect(await call(room, { op: "get" })).toEqual({ ok: true, peerId: "peer-b", epoch: 2 });
  });

  it("🔴 ne laisse passer qu'UNE reprise, et dit au perdant qui est le vrai hôte", async () => {
    const room = new RoomRendezvous(fakeState());
    await call(room, { op: "claim", peerId: "peer-a" });

    // Deux pairs ont vu la même déconnexion et calculé le même successeur.
    const first = await call(room, { op: "takeOver", peerId: "peer-b", epoch: 1 });
    const second = await call(room, { op: "takeOver", peerId: "peer-c", epoch: 1 });

    expect(first).toEqual({ ok: true, peerId: "peer-b", epoch: 2 });
    // Le perdant APPREND qu'il a perdu — c'est tout l'objet du compteur d'époque.
    expect(second).toEqual({ ok: false, peerId: "peer-b", epoch: 2 });
  });

  it("rouvre un salon éteint plutôt que de refuser une reprise dans le vide", async () => {
    const room = new RoomRendezvous(fakeState());

    expect(await call(room, { op: "takeOver", peerId: "peer-b", epoch: 3 })).toEqual({
      ok: true,
      peerId: "peer-b",
      epoch: 1,
    });
  });

  it("libère un code qu'un salon oublié confisquait", async () => {
    const stale = { peerId: "peer-a", epoch: 4, updatedAt: Date.now() - ROOM_TTL_MS - 1 };
    const room = new RoomRendezvous(fakeState({ host: stale }));

    expect(await call(room, { op: "get" })).toEqual({ absent: true });
    // Et le code est réellement réutilisable, pas seulement annoncé libre.
    expect(await call(room, { op: "claim", peerId: "peer-b" })).toEqual({
      ok: true,
      peerId: "peer-b",
      epoch: 1,
    });
  });

  it("🔴 refuse un claim sans peerId au lieu de confisquer le code six heures", async () => {
    const room = new RoomRendezvous(fakeState());

    const answer = await room.fetch(
      new Request("https://example.test/salon/ABCD", {
        method: "POST",
        body: JSON.stringify({ op: "claim" }),
      }),
    );

    expect(answer.status).toBe(400);
    // Et surtout : le code est resté LIBRE. Un enregistrement fantôme l'aurait bloqué jusqu'au TTL.
    expect(await call(room, { op: "get" })).toEqual({ absent: true });
  });

  it("refuse une reprise dont l'époque n'est pas un entier", async () => {
    const room = new RoomRendezvous(fakeState());
    await call(room, { op: "claim", peerId: "peer-a" });

    const answer = await room.fetch(
      new Request("https://example.test/salon/ABCD", {
        method: "POST",
        body: JSON.stringify({ op: "takeOver", peerId: "peer-b", epoch: "2" }),
      }),
    );

    expect(answer.status).toBe(400);
    expect(await call(room, { op: "get" })).toEqual({ ok: true, peerId: "peer-a", epoch: 1 });
  });

  it("ne tombe pas sur un corps illisible", async () => {
    const room = new RoomRendezvous(fakeState());
    const answer = await room.fetch(
      new Request("https://example.test/salon/ABCD", { method: "POST", body: "pas du json" }),
    );

    expect(answer.status).toBe(400);
  });
});
