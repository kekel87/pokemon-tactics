import { type BattleEvent, BattleEventType } from "@pokemon-tactic/core";

/**
 * Faut-il dire au joueur de CETTE machine que son camp vient de tomber ? (plan 210, lot D2)
 *
 * Sortie de l'orchestrateur pour être une fonction pure : c'est une DÉCISION à trois conditions,
 * et l'orchestrateur n'a aucun harnais qui simule une élimination au combat. La tester ici coûte
 * trois lignes par cas ; la tester à travers lui demanderait de monter un combat entier.
 *
 * Un booléen et non l'identifiant du camp : personne ne s'en servait (revue du plan 210, Major 3).
 * Une machine en ligne n'a qu'un camp local, donc « lequel » n'apprend rien au dialogue.
 *
 * Les trois conditions :
 *
 * 1. **En ligne seulement** — `localPlayerIds` présent. C'est le drapeau « partie en ligne »
 *    (décision #1038), et en hot-seat l'écran est partagé : offrir « Retour au menu » à l'éliminé
 *    lui donnerait le pouvoir d'emporter la partie des autres (décision #1046).
 * 2. **Un camp LOCAL** — l'élimination d'un adversaire ne nous concerne pas, le journal la dit.
 * 3. **Pas quand la partie se termine dans le même lot** — le dialogue de victoire arrive, et il dit
 *    déjà tout. Deux modales pour un seul instant, c'est une de trop.
 */
export function shouldAnnounceLocalElimination(
  events: readonly BattleEvent[],
  localPlayerIds: readonly string[] | undefined,
): boolean {
  if (localPlayerIds === undefined) {
    return false;
  }
  if (events.some((event) => event.type === BattleEventType.BattleEnded)) {
    return false;
  }
  return events.some(
    (event) =>
      event.type === BattleEventType.PlayerEliminated && localPlayerIds.includes(event.playerId),
  );
}
