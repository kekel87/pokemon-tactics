import type { TeamSet, TeamSlot } from "@pokemon-tactic/core";
import { getPortraitUrl } from "../../team/team-builder-data";

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
  button.addEventListener("click", () => callbacks.onClick());

  const name = document.createElement("span");
  name.className = "ts-team-row-name";
  if (props.isRandomRow) {
    name.textContent = props.randomLabel;
  } else if (props.team === null) {
    name.textContent = "—";
  } else {
    name.textContent = props.team.name;
  }
  button.appendChild(name);

  const portraits = document.createElement("span");
  portraits.className = "ts-team-row-portraits";
  if (props.team !== null) {
    appendPortraits(portraits, props.team.slots);
  } else if (props.isRandomRow) {
    appendPlaceholderPortraits(portraits);
  }
  button.appendChild(portraits);

  const badgeContainer = document.createElement("span");
  badgeContainer.className = "ts-team-row-badges";
  for (const badge of props.badges) {
    badgeContainer.appendChild(createBadge(badge));
  }
  button.appendChild(badgeContainer);

  item.appendChild(button);
  return item;
}

function appendPortraits(target: HTMLElement, slots: readonly TeamSlot[]): void {
  for (let i = 0; i < 6; i++) {
    const slot = slots[i];
    const portrait = document.createElement("span");
    portrait.className = "ts-team-row-portrait";
    if (slot === undefined) {
      portrait.dataset.empty = "true";
    } else {
      portrait.style.backgroundImage = `url(${getPortraitUrl(slot.pokemonId)})`;
    }
    target.appendChild(portrait);
  }
}

function appendPlaceholderPortraits(target: HTMLElement): void {
  for (let i = 0; i < 6; i++) {
    const portrait = document.createElement("span");
    portrait.className = "ts-team-row-portrait";
    portrait.dataset.placeholder = "true";
    target.appendChild(portrait);
  }
}

function createBadge(badge: TeamListItemBadge): HTMLElement {
  const el = document.createElement("span");
  el.className = "ts-team-row-badge";
  el.dataset.slotIndex = String(badge.slotIndex);
  el.style.setProperty("--ts-badge-color", badge.colorHex);
  el.textContent = badge.label;
  return el;
}
