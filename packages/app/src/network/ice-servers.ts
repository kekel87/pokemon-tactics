import type { IceServerConfig } from "@pokemon-tactic/network";

/**
 * Les serveurs STUN du jeu (plan 216, bug 1, étape 1.5).
 *
 * 🔴 **Cette liste existe pour REMPLACER celle de `peerjs`, pas pour la compléter.** Les défauts de
 * `peerjs@1.5.5` portent trois entrées, dont **deux serveurs TURN morts** :
 *
 * ```
 * stun:stun.l.google.com:19302      ← vivant
 * turn:eu-0.turn.peerjs.com:3478    ← plus aucun enregistrement DNS A
 * turn:us-0.turn.peerjs.com:3478    ← plus aucun enregistrement DNS A
 * ```
 *
 * Mesuré le 2026-09-19 sur trois résolveurs indépendants (`1.1.1.1`, `8.8.8.8`, `9.9.9.9`), et
 * confirmé dans un vrai Chromium : la négociation ne gather que des candidats `host` et `srflx`,
 * aucun `relay`, avec quatre `701 TURN host lookup received error`. C'est **la cause du bug majeur**
 * de ce plan — sans relais, ni le NAT symétrique ni le CGNAT ne se franchissent, donc plus de partie
 * en ligne depuis des données mobiles ou un wifi public.
 *
 * Passer une liste explicite à `PeerJsTransport` **écrase** intégralement celle de la bibliothèque,
 * donc retire les deux hôtes morts au lieu de les laisser consommer une résolution DNS ratée à
 * chaque négociation. C'est un gain de latence même quand le relais n'est pas nécessaire.
 *
 * ⚠️ **Aucun TURN ici, et ce n'est pas un oubli.** Le remplacement n'est pas un autre TURN tiers —
 * ils sont « les plus fragiles de tous » (`docs/multiplayer.md`), ce que PeerJS vient de démontrer,
 * et le TURN Cloudflare exige une carte bancaire même pour son palier gratuit. Le secours est notre
 * propre relais WebSocket (`relay-connection.ts`), sur le Worker du projet, sans moyen de paiement
 * et donc dans le régime « le quota s'arrête au lieu de facturer ».
 */
export const DEFAULT_ICE_SERVERS: readonly IceServerConfig[] = [
  /*
   * Deux fournisseurs plutôt qu'un : un STUN injoignable ne doit pas suffire à faire échouer la
   * découverte d'adresse publique, qui reste le chemin gratuit et le seul qu'on veuille emprunter.
   * Les deux ont été vérifiés joignables le 2026-09-19.
   */
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.l.google.com:19302" },
];
