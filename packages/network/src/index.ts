/**
 * `@pokemon-tactic/network` — le salon en ligne (plan 199, Lot B1).
 *
 * Pur : aucune dépendance d'interface, et du moteur il ne connaît que des **types**. Le transport
 * est derrière une interface à deux mises en œuvre — la vraie (`peerjs`) et un canal en mémoire qui
 * rend le salon testable sans réseau.
 */

export * from "./fake-transport.js";
export * from "./peer-connection.js";
export * from "./protocol.js";
export * from "./room.js";
export * from "./room-code.js";
export * from "./transport.js";
