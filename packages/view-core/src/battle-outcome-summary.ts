import type { BattleState } from "@pokemon-tactic/core";
import {
  BattleOutcomeKind,
  type BattleOutcomeMember,
  type BattleOutcomeSummary,
} from "@pokemon-tactic/render-ports";

/**
 * Récapitulatif de fin de partie (plan 197) — tout se dérive de l'état, rien n'est collecté en cours
 * de combat.
 *
 * Fonction libre plutôt que méthode privée de l'orchestrateur : elle est purement calculatoire, et la
 * sortir permet de la tester sans monter un orchestrateur complet (moteur, plateau, chrome, contexte
 * de présentation).
 *
 * `currentHp <= 0` suffit à dire « hors du combat » : un Pokémon K.O. **reste** dans `state.pokemon`
 * (le moteur ne l'en retire jamais), et les trois chemins de **sortie d'arène** — chute, terrain
 * infranchissable, terrain létal — passent tous les PV à zéro avant d'éliminer. Un ressuscité
 * (Vœu Soin) repasse au-dessus de zéro, et son portrait cesse d'être grisé : c'est voulu.
 */
export function buildOutcomeSummary(input: {
  state: BattleState;
  /** Camp vainqueur, ou `null` sans vainqueur (match nul, partie interrompue). */
  winnerId: string | null;
  /**
   * Le verdict. Omis, il se déduit de `winnerId` — un vainqueur décide, son absence est un match
   * nul. Seule une partie INTERROMPUE doit le passer explicitement : elle n'est déductible d'aucun
   * état, puisque c'est le réseau qui la prononce, pas le moteur.
   */
  kind?: BattleOutcomeKind;
  /**
   * Temps de jeu cumulé, fourni par l'hôte. Reçu **déjà calculé** plutôt que dérivé ici d'un
   * horodatage : recoller les tranches de jeu d'une partie reprise regarde l'hôte, pas la vue.
   */
  elapsedMs: number;
}): BattleOutcomeSummary {
  // Sans vainqueur : aucune équipe à mettre en avant, la dialog n'affiche alors pas de portraits.
  const winnerTeam: BattleOutcomeMember[] =
    input.winnerId === null
      ? []
      : [...input.state.pokemon.values()]
          .filter((pokemon) => pokemon.playerId === input.winnerId)
          .map((pokemon) => ({
            definitionId: pokemon.definitionId,
            ko: pokemon.currentHp <= 0,
          }));

  return {
    kind:
      input.kind ?? (input.winnerId === null ? BattleOutcomeKind.Draw : BattleOutcomeKind.Decided),
    winnerTeam,
    /*
     * L'horloge d'actions du moteur. Elle s'incrémente juste avant chaque `TurnStarted` (même bloc,
     * aucune branche entre les deux), donc elle compte exactement ce que la télémétrie compte de son
     * côté — et elle est réincrémentée par le rejeu, donc juste après une reprise.
     */
    turns: input.state.actionCounter ?? 0,
    // Plancher à zéro : une horloge système reculée en cours de partie ne doit pas produire une
    // durée négative.
    durationMs: Math.max(0, input.elapsedMs),
  };
}
