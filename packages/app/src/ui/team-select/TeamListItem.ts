import type { TeamSet } from "@pokemon-tactic/core";
import { createPlaceholderPortraitsElement, createTeamPortraitsElement } from "./TeamPortraits";

export interface TeamListItemBadge {
  slotIndex: number;
  label: string;
  colorHex: string;
}

export interface TeamListItemProps {
  team: TeamSet | null;
  isRandomRow: boolean;
  badges: readonly TeamListItemBadge[];
  randomLabel: string;
}

export interface TeamListItemCallbacks {
  onClick: () => void;
}

export function createTeamListItemElement(
  props: TeamListItemProps,
  callbacks: TeamListItemCallbacks,
): HTMLElement {
  const item = document.createElement("li");
  item.className = "ts-team-row";
  if (props.isRandomRow) {
    item.dataset.variant = "random";
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ts-team-row-button";
  /*
   * Contrat de test : le testid localise la ligne, `data-team-id` dit LAQUELLE — l'id d'équipe, pas
   * son nom. Le nom seul ne suffit pas : la ligne focalisée n'est identifiable, de l'extérieur, que
   * par le texte de son conteneur, et ce conteneur porte le texte de TOUTES les lignes (plan 194 —
   * une cible « Fangs & Fists » matchait la ligne « Blaze & Psy », qui se faisait assigner à sa place).
   */
  button.dataset.testid = "team-row";
  button.dataset.teamId = props.team === null ? "random" : props.team.id;
  button.addEventListener("click", () => callbacks.onClick());

  const name = document.createElement("span");
  name.className = "ts-team-row-name";
  // Pas de troisième cas : le seul producteur (`TeamPickerModal`) n'émet que `(équipe, false)` ou
  // `(null, true)`. Le `« — »` d'avant était une branche morte (revue de code 2026-08-26).
  name.textContent = props.team === null ? props.randomLabel : props.team.name;
  button.appendChild(name);

  // Rembourré à 6 : dans une LISTE, les colonnes de portraits doivent se superposer d'une ligne à
  // l'autre. La carte de camp, elle, ne rembourre pas (cf. `TeamPortraits`).
  // Deux cas seulement, et c'est structurel : `TeamPickerModal` n'émet que `(équipe, false)` ou
  // `(null, true)`. Une troisième branche « pas d'équipe et pas la ligne aléatoire » était morte.
  button.appendChild(
    props.team === null
      ? createPlaceholderPortraitsElement()
      : createTeamPortraitsElement(props.team.slots, { padTo: 6 }),
  );

  const badgeContainer = document.createElement("span");
  badgeContainer.className = "ts-team-row-badges";
  for (const badge of props.badges) {
    badgeContainer.appendChild(createBadge(badge));
  }
  button.appendChild(badgeContainer);

  item.appendChild(button);
  return item;
}

function createBadge(badge: TeamListItemBadge): HTMLElement {
  const el = document.createElement("span");
  el.className = "ts-team-row-badge";
  el.dataset.slotIndex = String(badge.slotIndex);
  el.style.setProperty("--ts-badge-color", badge.colorHex);
  el.textContent = badge.label;
  return el;
}
