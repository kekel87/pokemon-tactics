/**
 * `@pokemon-tactic/network` — le salon en ligne (plan 199, Lot B1).
 *
 * Pur : aucune dépendance d'interface. Du moteur il ne prend que des **types**, à l'exception de
 * l'énumération `PlayerController`, dont `composeStartSeats` a besoin des valeurs. Le transport
 * est derrière une interface à deux mises en œuvre — la vraie (`peerjs`), exportée ici, et un canal
 * en mémoire qui rend le salon testable sans réseau, exporté par `@pokemon-tactic/network/testing`.
 *
 * Ce barrel ne porte que l'API : un double de test qui en sort part dans le graphe de
 * l'application, où il n'a rien à faire.
 */

export * from "./peer-connection.js";
export * from "./protocol.js";
export * from "./room.js";
export * from "./room-code.js";
export * from "./transport.js";
