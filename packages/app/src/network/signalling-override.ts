import type { PeerJsTransportOptions } from "@pokemon-tactic/network";

/**
 * Annuaire de mise en relation forcé par l'URL, pour l'e2e du jeu en ligne (plan 199, étape 8).
 *
 * Un salon normal passe par le service public de PeerJS. Le faire faire à la suite e2e la rendrait
 * dépendante d'un **tiers sans engagement de service** : une coupure d'Internet, ou une panne chez
 * eux, rendrait le gate local rouge sans qu'aucune ligne de notre code n'ait changé. Le projet
 * PeerJS publie un serveur autonome (`peer`, version `1.0.2`), que le harnais lance sur un port
 * local ; ce module est ce qui permet à l'app de le joindre.
 *
 * `?peerPort=<port>` (et `?peerHost=`, `?peerPath=` au besoin) est donc **verrouillé sur `DEV` ou
 * `VITE_E2E`**, exactement comme `?seed=` (`capture-seed.ts`) et le boot bac à sable par URL : dans
 * une version publiée, ce module renvoie toujours `undefined`, et il n'existe aucun moyen de
 * détourner la mise en relation d'un joueur vers un serveur choisi de l'extérieur — ce qui, sans ce
 * verrou, serait une porte ouverte à l'interception de parties.
 */
export function signallingOverride(): PeerJsTransportOptions | undefined {
  if (!(import.meta.env.DEV || import.meta.env.VITE_E2E === "true")) {
    return undefined;
  }
  const params = new URLSearchParams(window.location.search);
  const rawPort = params.get("peerPort");
  if (rawPort === null) {
    return undefined;
  }
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    return undefined;
  }
  return {
    host: params.get("peerHost") ?? "localhost",
    port,
    path: params.get("peerPath") ?? "/",
    // Un annuaire local tourne en clair : réclamer TLS le rendrait injoignable.
    secure: false,
    /*
     * 🔴 `?peerIce=off` coupe les serveurs STUN/TURN, et **seule la suite e2e le demande**.
     *
     * Motif côté tests : avec les serveurs par défaut de la bibliothèque, chaque pair tente de
     * résoudre `*.turn.peerjs.com`, ce qui échoue ou traîne selon le réseau de la machine — la
     * négociation attendait ces résolutions et le scénario dépassait son délai. Une suite de tests ne
     * doit rien demander à Internet.
     *
     * Motif pour lequel ce n'est **pas** le défaut, appris d'un retour de recette : couper STUN
     * cassait la mise en relation sur un annuaire local en usage réel. Chromium s'en sort avec ses
     * seuls candidats « host » sur la boucle locale ; **Firefox non** — il refuse la négociation avec
     * « ICE failed, add a STUN server ». Le besoin du harnais n'a donc rien à faire dans le chemin
     * qu'un humain emprunte pour tester.
     */
    ...(params.get("peerIce") === "off" ? { iceServers: [] } : {}),
  };
}
