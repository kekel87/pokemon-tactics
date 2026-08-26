import { PlayerController, type TeamSet } from "@pokemon-tactic/core";
import { createTeamPortraitsElement } from "./TeamPortraits";

export interface PlayerCellLabels {
  controllerHuman: string;
  controllerAi: string;
  chooseTeam: string;
}

export interface PlayerCellProps {
  slotIndex: number;
  playerLabel: string;
  shortLabel: string;
  colorHex: string;
  controller: PlayerController;
  assignedTeam: TeamSet | null;
  ephemeral: boolean;
  labels: PlayerCellLabels;
}

export interface PlayerCellCallbacks {
  /** Ouvre le sélecteur d'équipe de ce camp (décision #832). */
  onChooseTeam: () => void;
  onSetController: (controller: PlayerController) => void;
}

/** Glyphes du segment — un pictogramme par modalité de contrôle, lisible sans lire le libellé. */
const CONTROLLER_GLYPH = {
  [PlayerController.Human]: "🎮",
  [PlayerController.Ai]: "🤖",
} as const satisfies Record<PlayerController, string>;

/**
 * Une carte de camp : son numéro, le segment Humain / IA, et l'équipe assignée.
 *
 * Deux changements structurels du plan 188 :
 *
 * - **Le segment remplace le bouton bascule** (décision #831). Les deux états sont désormais
 *   affichés en permanence, l'actif surligné : on voit ce qu'on choisit avant de le choisir, au lieu
 *   de deviner ce que le bouton va devenir. Un bouton par état, donc presser « Humain » sur un camp
 *   déjà humain ne fait rien — l'ancien bouton unique, lui, le donnait à l'IA.
 * - **Le bouton d'équipe remplace la liste centrale** (décision #832). La carte n'est plus un
 *   `<div role="button" tabindex="0">` avec son `keydown` maison : le nom d'équipe est un `<button>`
 *   qui ouvre le sélecteur. La notion de « camp actif », un second curseur qui pouvait contredire le
 *   focus à l'écran, disparaît avec lui.
 */
export function createPlayerCellElement(
  props: PlayerCellProps,
  callbacks: PlayerCellCallbacks,
): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "ts-player-cell";
  cell.dataset.slotIndex = String(props.slotIndex);
  cell.style.setProperty("--ts-player-color", props.colorHex);

  const header = document.createElement("span");
  header.className = "ts-player-cell-header";

  const dot = document.createElement("span");
  dot.className = "ts-player-cell-dot";
  header.appendChild(dot);

  const label = document.createElement("span");
  label.className = "ts-player-cell-label";
  label.textContent = props.playerLabel;
  header.appendChild(label);

  cell.appendChild(header);

  // Le segment est sur sa PROPRE rangée, pleine largeur, et non plus poussé à droite de l'en-tête
  // (retour humain 2026-08-25 : « le passage du focus est bizarre »). La navigation du focus est
  // SPATIALE (`focusInDirection`) : le segment collé à droite avait son centre à droite de celui du
  // bouton d'équipe, donc ← depuis « Humain » descendait sur l'équipe au lieu de ne rien faire.
  // Empilé, la géométrie dit la même chose que la logique : ← → parcourent Humain ↔ IA, ↑ ↓ montent
  // et descendent dans la carte.
  cell.appendChild(buildControllerSegment(props, callbacks));

  const teamButton = document.createElement("button");
  teamButton.type = "button";
  teamButton.className = "ts-player-cell-team";
  teamButton.dataset.testid = "player-team-button";
  teamButton.dataset.slotIndex = String(props.slotIndex);
  const teamName = document.createElement("span");
  teamName.className = "ts-player-cell-team-name";
  if (props.assignedTeam === null) {
    teamName.textContent = props.labels.chooseTeam;
    teamButton.dataset.state = "empty";
  } else {
    teamName.textContent = props.assignedTeam.name;
    teamButton.dataset.state = props.ephemeral ? "ephemeral" : "saved";
  }
  teamButton.appendChild(teamName);
  // Les portraits, en plus du nom (retour humain 2026-08-25) : #832 avait remplacé la liste
  // permanente — qui les montrait en continu — par une modale, et la carte ne disait plus QUELLE
  // équipe c'était, seulement comment elle s'appelle.
  if (props.assignedTeam !== null) {
    teamButton.appendChild(createTeamPortraitsElement(props.assignedTeam.slots));
  }
  teamButton.addEventListener("click", () => callbacks.onChooseTeam());
  cell.appendChild(teamButton);

  return cell;
}

function buildControllerSegment(
  props: PlayerCellProps,
  callbacks: PlayerCellCallbacks,
): HTMLElement {
  const segment = document.createElement("div");
  segment.className = "ts-segments ts-player-cell-controller";

  for (const controller of [PlayerController.Human, PlayerController.Ai]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ts-segment";
    // Contrat de test : le testid localise, `data-controller` (id stable, indépendant de l'i18n) et
    // `data-slot-index` désignent lequel — le libellé, lui, porte un glyphe et se traduit.
    button.dataset.testid = "player-controller";
    // `PlayerController.Human === "human"` : l'enum porte déjà la valeur du contrat de test.
    button.dataset.controller = controller;
    button.dataset.slotIndex = String(props.slotIndex);
    if (props.controller === controller) {
      button.dataset.state = "active";
    }
    button.textContent = `${CONTROLLER_GLYPH[controller]} ${
      controller === PlayerController.Human
        ? props.labels.controllerHuman
        : props.labels.controllerAi
    }`;
    button.addEventListener("click", () => callbacks.onSetController(controller));
    segment.appendChild(button);
  }

  return segment;
}
