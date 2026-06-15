import type { PlayerController, TeamSet } from "@pokemon-tactic/core";

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
  controllerHuman: PlayerController;
  controllerAi: PlayerController;
  assignedTeam: TeamSet | null;
  ephemeral: boolean;
  active: boolean;
  labels: PlayerCellLabels;
}

export interface PlayerCellCallbacks {
  onActivate: () => void;
  onToggleController: () => void;
}

export function createPlayerCellElement(
  props: PlayerCellProps,
  callbacks: PlayerCellCallbacks,
): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "ts-player-cell";
  cell.dataset.slotIndex = String(props.slotIndex);
  cell.dataset.active = String(props.active);
  cell.setAttribute("role", "button");
  cell.tabIndex = 0;
  cell.style.setProperty("--ts-player-color", props.colorHex);
  cell.addEventListener("click", () => callbacks.onActivate());
  cell.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      callbacks.onActivate();
    }
  });

  const header = document.createElement("span");
  header.className = "ts-player-cell-header";

  const dot = document.createElement("span");
  dot.className = "ts-player-cell-dot";
  header.appendChild(dot);

  const label = document.createElement("span");
  label.className = "ts-player-cell-label";
  label.textContent = props.playerLabel;
  header.appendChild(label);

  const controllerToggle = document.createElement("button");
  controllerToggle.type = "button";
  controllerToggle.className = "ts-player-cell-controller";
  controllerToggle.dataset.controller = props.controller === props.controllerHuman ? "human" : "ai";
  controllerToggle.textContent =
    props.controller === props.controllerHuman
      ? props.labels.controllerHuman
      : props.labels.controllerAi;
  controllerToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    callbacks.onToggleController();
  });
  header.appendChild(controllerToggle);

  cell.appendChild(header);

  const teamName = document.createElement("span");
  teamName.className = "ts-player-cell-team";
  if (props.assignedTeam === null) {
    teamName.textContent = props.labels.chooseTeam;
    teamName.dataset.state = "empty";
  } else {
    teamName.textContent = props.assignedTeam.name;
    teamName.dataset.state = props.ephemeral ? "ephemeral" : "saved";
  }
  cell.appendChild(teamName);

  return cell;
}
