import { VISIT_BEACON_FLAG } from "../analytics/telemetry-contract";

/**
 * Doubles de navigateur pour les tests du client de télémétrie (plan 196).
 *
 * Le dépôt ne monte pas de jsdom : les tests du paquet `app` stubbent les globales une par une, et
 * c'est le test qui appelle `vi.stubGlobal` — même contrat que `local-storage-stub.ts`. On reproduit
 * ici le strict minimum dont `telemetry.ts` a besoin, et surtout on **capture les envois** au lieu
 * de les laisser partir sur le réseau.
 */

export interface BeaconCapture {
  /** URL visée par chaque envoi, dans l'ordre. */
  readonly urls: string[];
  /** Enveloppes décodées, pour ne pas re-parser dans chaque test. */
  readonly envelopes: Record<string, unknown>[];
}

export interface TelemetryStub {
  /** À passer à `vi.stubGlobal("window", …)`. */
  readonly window: unknown;
  /** À passer à `vi.stubGlobal("document", …)`. */
  readonly document: unknown;
  /** À passer à `vi.stubGlobal("navigator", …)`. */
  readonly navigator: unknown;
  readonly beacon: BeaconCapture;
  /** Déclenche `visibilitychange` avec l'état demandé. */
  emitVisibilityChange(state: "hidden" | "visible"): void;
  /** Déclenche `pagehide` — l'événement de fermeture d'onglet, celui que la production a raté. */
  emitPageHide(): void;
  /** Combien d'écouteurs sont enregistrés pour ce type — de quoi prouver qu'on n'en installe qu'un. */
  listenerCount(type: string): number;
}

/**
 * @param hostname hôte simulé. `localhost` doit neutraliser toute la collecte.
 * @param beaconQueued ce que rend `sendBeacon` ; `false` doit déclencher le repli `fetch`.
 */
export function createTelemetryStub(options: {
  hostname: string;
  beaconQueued?: boolean;
  inputSource?: string;
  screenWidth?: number;
  referrer?: string;
  /** Simule une balise inline qui a déjà mis la ligne de visite en file. */
  visitAlreadySent?: boolean;
}): TelemetryStub {
  const urls: string[] = [];
  const envelopes: Record<string, unknown>[] = [];
  const listeners = new Map<string, ((event: unknown) => void)[]>();

  const listen = (type: string, listener: (event: unknown) => void): void => {
    listeners.set(type, [...(listeners.get(type) ?? []), listener]);
  };

  const emit = (type: string): void => {
    for (const listener of listeners.get(type) ?? []) {
      listener(undefined);
    }
  };

  const documentStub = {
    visibilityState: "visible" as "hidden" | "visible",
    referrer: options.referrer ?? "",
    documentElement: { dataset: { inputSource: options.inputSource } },
    addEventListener: listen,
  };

  return {
    window: {
      location: { hostname: options.hostname },
      screen: { width: options.screenWidth ?? 1920 },
      addEventListener: listen,
      ...(options.visitAlreadySent === true ? { [VISIT_BEACON_FLAG]: true } : {}),
    },
    document: documentStub,
    navigator: {
      sendBeacon: (url: string, body: string): boolean => {
        if (options.beaconQueued === false) {
          return false;
        }
        urls.push(url);
        envelopes.push(JSON.parse(body) as Record<string, unknown>);
        return true;
      },
    },
    beacon: { urls, envelopes },
    emitVisibilityChange(state) {
      documentStub.visibilityState = state;
      emit("visibilitychange");
    },
    emitPageHide() {
      emit("pagehide");
    },
    listenerCount(type) {
      return listeners.get(type)?.length ?? 0;
    },
  };
}
