import type { Room } from "@pokemon-tactic/network";

/**
 * Le salon en ligne de la session, détenu **hors des écrans** (plan 199, correctif de revue).
 *
 * 🔴 Motif, et c'est un bug de correction, pas une élégance : le salon appartenait à l'écran de
 * sélection d'équipe, donc entrer en combat le **détruisait** — `dispose()` appelait `leave()`, qui
 * détruit le pair. Or l'accusé de lancement de l'invité (`start_ack`) part juste avant cette
 * navigation, et `peerjs` **jette** le tampon d'un canal qu'on détruit :
 * `BufferedConnection.close()` fait `this._buffer = []`, et `close({ flush: true })` se contente
 * d'envoyer une sentinelle avant de rendre la main — il ne ferme rien et ne vide rien.
 *
 * L'accusé pouvait donc ne jamais partir. L'hôte attendait 15 s, annulait, et rediffusait un salon
 * déverrouillé **à un invité qui n'avait plus de salon pour l'entendre** : l'invité en combat seul,
 * l'hôte revenu en salle d'attente. C'est exactement la panne que l'accusé existe pour empêcher, et
 * elle était atteignable sans aucun pair malveillant — seulement de la chance de temporisation, que
 * ni l'intégration (le canal factice vide correctement sa file, lui) ni l'e2e (boucle locale,
 * transmission immédiate) ne pouvaient prendre en défaut.
 *
 * Un salon qui survit à la transition d'écran ne peut plus appartenir à l'écran qui le crée. C'est
 * aussi l'architecture dont le **Lot B2** a besoin, où les actions s'échangent pendant le combat.
 */

let current: Room | null = null;

/** Confie le salon à la session. Un salon déjà détenu est fermé — on n'en garde jamais deux. */
export function holdOnlineRoom(room: Room): void {
  if (current !== null && current !== room) {
    current.leave();
  }
  current = room;
}

/**
 * Termine la session en ligne : `bye` puis fermeture. Sans effet s'il n'y a pas de salon, ce qui
 * permet de l'appeler depuis tout chemin de sortie sans avoir à savoir si on jouait en ligne.
 */
export function releaseOnlineRoom(): void {
  current?.leave();
  current = null;
}
