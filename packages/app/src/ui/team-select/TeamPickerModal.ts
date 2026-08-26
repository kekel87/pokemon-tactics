import { Modal } from "@pokemon-tactic/ui-dom";
import { t } from "../../i18n";
import { getInputSystem } from "../../input/input-system";
import { listTeams } from "../../team/team-storage";
import { playerShortLabel, teamColorToHex } from "./slot-state";
import { createTeamListElement, type TeamListEntry } from "./TeamList";

export interface TeamPickerOptions {
  /** Camp concerné — son numéro titre la modale, pour qu'on sache à qui on assigne. */
  slotIndex: number;
  playerLabel: string;
  /** Camps déjà pourvus, par identifiant d'équipe sauvegardée — alimente les badges. */
  assignedTeamIdsBySlot: readonly (string | null)[];
  /** `null` = la ligne « Aléatoire ». */
  onPick: (teamId: string | null) => void;
}

/**
 * Sélecteur d'équipe d'un camp (décision #832).
 *
 * Remplace la liste centrale permanente de l'écran de sélection d'équipe. Elle rend le même service —
 * choisir parmi les équipes sauvegardées, ou tirer une équipe aléatoire — mais adossée au camp qui
 * l'a ouverte, ce qui supprime la notion de « camp actif » : il n'y a plus qu'un curseur à l'écran,
 * le focus.
 *
 * Réutilise `TeamList` / `TeamListItem` tels quels : leurs lignes sont déjà de vrais `<button>`,
 * donc navigables au clavier comme à la manette sans une ligne de plus.
 */
export function openTeamPickerModal(options: TeamPickerOptions): void {
  const modal = new Modal({
    title: t("teamSelect.teams.pickerTitle", { player: options.playerLabel }),
    closeAriaLabel: t("teamBuilder.aria.close"),
    size: "picker",
  });

  const teams = listTeams().sort((a, b) => b.updatedAt - a.updatedAt);
  const entries: TeamListEntry[] = teams.map((team) => ({
    teamId: team.id,
    team,
    isRandom: false,
    badges: badgesForTeam(team.id, options.assignedTeamIdsBySlot),
  }));
  entries.push({ teamId: null, team: null, isRandom: true, badges: [] });

  const list = createTeamListElement(
    {
      entries,
      randomLabel: t("teamSelect.teams.random"),
      emptyTitle: t("teamSelect.teams.empty.title"),
      emptyCta: t("teamSelect.teams.empty.cta"),
    },
    {
      onPick: (teamId) => {
        // Fermer AVANT de rendre la main, pour que `onPick` s'exécute sur un écran sans modale.
        //
        // ⚠️ Ce n'est PAS ce qui protège le focus du camp suivant (décision #834) : l'événement `close`
        // d'un `<dialog>` est asynchrone, donc le `previousFocus.focus()` de `Modal` tire *après*
        // `onPick`. Ce qui le rend inopérant, c'est que le re-rendu a **détaché** le déclencheur.
        // Un futur passage à une mutation en place casserait donc ce focus en silence (revue de code
        // 2026-08-26) — c'est là qu'il faudra regarder.
        modal.close();
        options.onPick(teamId);
      },
    },
  );
  modal.getBody().appendChild(list);

  // Une manette n'a pas de `Tab` : sans point de départ posé ici, la première pression de direction
  // ne servirait qu'à entrer dans la liste (même motif que `bindScreenInput`, plan 184).
  if (getInputSystem()?.tracker.isFocusDriven() === true) {
    list.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
  }
}

/**
 * Quels camps jouent déjà cette équipe. Calculé sur TOUS les camps, pas seulement celui qui a ouvert
 * la modale : c'est ce qui fait que la vue d'ensemble des assignations reste entière derrière un seul
 * geste, alors que la liste permanente qu'elle remplace l'affichait en continu.
 *
 * Les équipes éphémères (aléatoires) n'ont pas d'identifiant, donc ne portent jamais de badge — c'était
 * déjà vrai de la liste centrale.
 */
function badgesForTeam(
  teamId: string,
  assignedTeamIdsBySlot: readonly (string | null)[],
): { slotIndex: number; label: string; colorHex: string }[] {
  const badges: { slotIndex: number; label: string; colorHex: string }[] = [];
  assignedTeamIdsBySlot.forEach((assignedId, slotIndex) => {
    if (assignedId === teamId) {
      badges.push({
        slotIndex,
        label: playerShortLabel(slotIndex),
        colorHex: teamColorToHex(slotIndex),
      });
    }
  });
  return badges;
}
