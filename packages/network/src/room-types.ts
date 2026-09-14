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
  /** La place de ce joueur. */
  seat: number;
  /**
   * La place qui HÉBERGE, en ce moment (plan 209, Lot C5).
   *
   * 🔴 Ce n'est plus forcément la 1. L'interface le lisait en dur (`HOST_SEAT`), donc après une
   * migration elle posait toujours la couronne sur l'ancien hôte parti et affichait sa ligne comme
   * « place libre » — vu de tous les survivants. Relevé en recette le 2026-09-14.
   */
  hostSeat: number;
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
  /**
   * Le registre des salons, quand il est disponible (plan 209, Lot C4).
   *
   * 🔴 **Optionnel, et le rester est délibéré.** Sans lui, tout continue comme avant le plan 209 :
   * l'hôte est la place 1, parce que c'est l'avoir prise qui fait l'hôte (#904). Avec lui, la place
   * qui héberge devient une **valeur publiée**, donc remplaçable — c'est ce qui rend la migration
   * d'hôte possible (Lot C5). Un registre injoignable ne doit jamais empêcher de jouer : le repli
   * est le comportement d'origine, pas une erreur.
   *
   * Injecté par l'application, comme `maxSeats` : ce paquet ne connaît ni l'URL du Worker, ni la
   * façon dont on l'atteint.
   */
  rendezvous?: RoomRendezvousClient;
}

/**
 * Ce que le salon attend du registre (plan 209, Lot C4). Trois gestes, pas un de plus.
 *
 * `epoch` est le compteur de compare-and-swap : `takeOver` n'aboutit que si l'époque fournie est
 * encore celle en cours, et le perdant reçoit en retour la place réellement en charge. C'est ce
 * qui interdit à deux pairs de se croire hôtes en même temps.
 */
export interface RoomRendezvousClient {
  /** L'hôte publie sa place à l'ouverture. Faux si le code est déjà pris et vivant. */
  claim(code: string, seat: number): Promise<{ ok: boolean; seat: number; epoch: number }>;
  /** Qui héberge, et depuis quelle époque ? `null` quand le code n'est pas (ou plus) enregistré. */
  lookup(code: string): Promise<{ seat: number; epoch: number } | null>;
  /** Un successeur réclame la main. Faux s'il a perdu la course — la place rendue est la bonne. */
  takeOver(
    code: string,
    seat: number,
    epoch: number,
  ): Promise<{ ok: boolean; seat: number; epoch: number }>;
}
