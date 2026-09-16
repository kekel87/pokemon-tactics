import type { Room, RoomView } from "@pokemon-tactic/network";
import { RoomRole } from "@pokemon-tactic/network";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTelemetryStub, type TelemetryStub } from "../testing/telemetry-stub";

vi.mock("../i18n", () => ({ getLanguage: () => "fr", t: (key: string) => key }));

const PAGES_HOST = "kekel87.github.io";

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Un salon réduit à ce que `watchHostMigration` lit : un rôle courant, et un abonnement qu'on peut
 * déclencher à la main. Le vrai `Room` traîne un transport et un registre dont ce test n'a que faire.
 */
function fakeRoom(initialRole: RoomRole) {
  const listeners: ((view: RoomView) => void)[] = [];
  let role = initialRole;
  const left: string[] = [];
  return {
    left,
    room: {
      get view() {
        return { role } as RoomView;
      },
      leave() {
        left.push("leave");
      },
      onChange(listener: (view: RoomView) => void) {
        listeners.push(listener);
        return () => {
          listeners.splice(listeners.indexOf(listener), 1);
        };
      },
    } as unknown as Room,
    /** Publie un changement de salon, comme le ferait le vrai. */
    emit(next: RoomRole) {
      role = next;
      for (const listener of [...listeners]) {
        listener({ role: next } as RoomView);
      }
    },
    listenerCount: () => listeners.length,
  };
}

/** Les compteurs d'action sont des deltas de module : chaque test repart d'un graphe neuf. */
async function loadRoom(stub: TelemetryStub) {
  vi.resetModules();
  vi.stubGlobal("window", stub.window);
  vi.stubGlobal("document", stub.document);
  vi.stubGlobal("navigator", stub.navigator);
  vi.stubGlobal("__APP_VERSION__", "v2026.9.1");
  return {
    room: await import("./online-room"),
    telemetry: await import("../analytics/telemetry"),
  };
}

/** Le compte de `host-migrated` dans la ligne de visite, une fois vidée. */
function migrationsSent(stub: TelemetryStub, flush: () => void): number {
  flush();
  const session = stub.beacon.envelopes.find((envelope) => envelope.kind === "session");
  const actions = (session?.payload as { actions?: Record<string, number> } | undefined)?.actions;
  return actions?.["host-migrated"] ?? 0;
}

describe("watchHostMigration (plan 212, Lot A)", () => {
  it("compte le passage d'invité à hôte", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const { room: online, telemetry } = await loadRoom(stub);
    const fake = fakeRoom(RoomRole.Guest);

    online.holdOnlineRoom(fake.room);
    fake.emit(RoomRole.Host);

    expect(migrationsSent(stub, telemetry.flushSession)).toBe(1);
  });

  it("🔴 compte la TRANSITION et non l'état", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const { room: online, telemetry } = await loadRoom(stub);
    const fake = fakeRoom(RoomRole.Guest);

    online.holdOnlineRoom(fake.room);
    fake.emit(RoomRole.Host);
    // `onChange` émet à chaque changement du salon — une place qui se libère, un verrou, un délai de
    // grâce. Un hôte compterait à chaque fois si on lisait simplement `role === Host`.
    fake.emit(RoomRole.Host);
    fake.emit(RoomRole.Host);

    expect(migrationsSent(stub, telemetry.flushSession)).toBe(1);
  });

  it("ne compte jamais l'hôte d'origine", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const { room: online, telemetry } = await loadRoom(stub);
    const fake = fakeRoom(RoomRole.Host);

    // Il est déjà hôte au premier instantané : c'est `room-created` qui le dit, pas ce compteur.
    online.holdOnlineRoom(fake.room);
    fake.emit(RoomRole.Host);

    expect(migrationsSent(stub, telemetry.flushSession)).toBe(0);
  });

  it("se désabonne quand le salon est relâché", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const { room: online } = await loadRoom(stub);
    const fake = fakeRoom(RoomRole.Guest);

    online.holdOnlineRoom(fake.room);
    online.releaseOnlineRoom();

    expect(fake.listenerCount()).toBe(0);
  });

  it("se désabonne de l'ancien salon quand un autre le remplace", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const { room: online } = await loadRoom(stub);
    const first = fakeRoom(RoomRole.Guest);
    const second = fakeRoom(RoomRole.Guest);

    online.holdOnlineRoom(first.room);
    online.holdOnlineRoom(second.room);

    expect(first.listenerCount()).toBe(0);
    expect(second.listenerCount()).toBe(1);
    // L'ancien salon est aussi quitté : on n'en tient jamais deux.
    expect(first.left).toEqual(["leave"]);
  });

  it("🔴 ne s'abonne pas deux fois au même salon reconfié", async () => {
    const stub = createTelemetryStub({ hostname: PAGES_HOST });
    const { room: online, telemetry } = await loadRoom(stub);
    const fake = fakeRoom(RoomRole.Guest);

    online.holdOnlineRoom(fake.room);
    online.holdOnlineRoom(fake.room);
    fake.emit(RoomRole.Host);

    // Deux abonnements compteraient la même migration deux fois — et l'écran de combat reconfie
    // bien le salon qu'il détient déjà.
    expect(fake.listenerCount()).toBe(1);
    expect(migrationsSent(stub, telemetry.flushSession)).toBe(1);
  });
});
