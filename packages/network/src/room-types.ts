import type { NetworkRoomOptions, NetworkSeatState } from "./protocol.js";
import type { NetworkTransport } from "./transport.js";

/**
 * Le vocabulaire du salon : ce qu'il montre (`RoomView`), ce qu'il exige pour tourner (`RoomDeps`)
 * et ce qu'il substitue en test (`RoomTimers`).
 *
 * Sorti de `room.ts` parce qu'aucune de ces déclarations ne dépend de la machine à états — elles
 * sont son contrat, lisible sans elle.
 */

export const RoomRole = {
  Host: "host",
  Guest: "guest",
} as const;

export type RoomRole = (typeof RoomRole)[keyof typeof RoomRole];

/** Ce que l'interface affiche. Un instantané, jamais une référence sur l'état interne. */
export interface RoomView {
  code: string;
  role: RoomRole;
  /** La place de ce joueur. 1 = l'hôte. */
  seat: number;
  options: NetworkRoomOptions;
  seats: readonly NetworkSeatState[];
  /** Vrai dès « Lancer » : plus aucune connexion acceptée. */
  locked: boolean;
  /** Les places dont on attend le retour, avec ce qu'il reste de leur délai de grâce. */
  awaited: readonly AwaitedSeat[];
}

export interface AwaitedSeat {
  seat: number;
  /** Vrai si un `bye` a précédé la fermeture — le délai court s'applique alors. */
  cleanClose: boolean;
}

export interface RoomTimers {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface RoomDeps {
  transport: NetworkTransport;
  /**
   * Nombre maximal de places qu'un arrivant balaie. L'appelant le fournit
   * (`Math.max(...REQUIRED_TEAM_COUNTS)`) : ce paquet ne dépend pas de `@pokemon-tactic/data`.
   */
  maxSeats: number;
  timers?: RoomTimers;
  sleep?: (delayMs: number) => Promise<void>;
  /** Injecté par les tests pour affirmer un code exact. */
  generateCode?: () => string;
}
