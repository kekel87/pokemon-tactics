import { type Action, ActionKind } from "@pokemon-tactic/core";

/**
 * Confrontation d'une action reçue du réseau à la liste des actions légales du moteur local
 * (plan 201, Lot B2).
 *
 * 🔴 **Pourquoi une projection et pas une égalité structurelle.** `getLegalActions()` énumère
 * `UseMove` avec sa case visée seule (`BattleEngine.getLegalActions`) ; la **case de retraite** est
 * ajoutée après coup par l'orchestrateur (`{ ...phase.action, retreatPosition }`) et validée
 * séparément à l'exécution par `isValidHitAndRunRetreat`. Une comparaison qui l'inclurait refuserait
 * donc **toute attaque à retraite** — Demi-Tour, Change Éclair, Eau Revoir — et éliminerait un joueur
 * honnête en trois attaques. La retraite est exclue de la projection : le moteur en reste juge, et il
 * l'est déjà.
 *
 * Les chemins de déplacement, eux, se comparent en entier : `getLegalActions` porte le chemin
 * **calculé par le moteur** (un seul par case atteignable), donc deux pairs qui énumèrent le même
 * état obtiennent les mêmes chemins.
 */
export function canonicalActionKey(action: Action): string {
  switch (action.kind) {
    case ActionKind.Move:
      return [
        ActionKind.Move,
        action.pokemonId,
        action.path.map((step) => `${step.x},${step.y}`).join(">"),
      ].join("|");
    case ActionKind.UseMove:
      return [
        ActionKind.UseMove,
        action.pokemonId,
        action.moveId,
        `${action.targetPosition.x},${action.targetPosition.y}`,
      ].join("|");
    case ActionKind.EndTurn:
      return [ActionKind.EndTurn, action.pokemonId, action.direction].join("|");
    case ActionKind.UndoMove:
      return [ActionKind.UndoMove, action.pokemonId].join("|");
  }
}

/** Vrai si l'action reçue correspond à l'une des actions légales, retraite mise à part. */
export function isLegalRemoteAction(legalActions: readonly Action[], received: Action): boolean {
  const key = canonicalActionKey(received);
  return legalActions.some((legal) => canonicalActionKey(legal) === key);
}
