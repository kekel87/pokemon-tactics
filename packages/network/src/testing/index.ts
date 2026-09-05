/**
 * Point d'entrée des doubles de test du paquet réseau — `@pokemon-tactic/network/testing`.
 *
 * Séparé du barrel public parce qu'un double de test n'est pas de l'API : exporté par `index.ts`,
 * `FakeNetworkDirectory` partait dans le graphe de l'application, où il n'a rien à faire. Même
 * découpage que `@pokemon-tactic/core/testing`.
 */

export * from "./fake-transport.js";
