import type { TeamSet, TeamSlot } from "@pokemon-tactic/core";
import { getLanguage, t } from "../../i18n";
import { getPortraitUrl } from "../../team/team-builder-data";
import { formatTeamDate } from "../../team/team-helpers";

export interface TeamCardCallbacks {
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
}

export function createTeamCardElement(team: TeamSet, callbacks: TeamCardCallbacks): HTMLElement {
  const card = document.createElement("div");
  card.className = "tb-team-card";
  card.dataset.testid = "team-card";

  const portraits = document.createElement("div");
  portraits.className = "tb-team-card-portraits";
  const filled = team.slots.slice(0, 6);
  for (let i = 0; i < 6; i++) {
    const slot = filled[i] as TeamSlot | undefined;
    const portrait = document.createElement("div");
    portrait.className = "tb-team-card-portrait";
    if (slot === undefined) {
      portrait.dataset.empty = "true";
    } else {
      portrait.style.backgroundImage = `url(${getPortraitUrl(slot.pokemonId)})`;
    }
    portraits.appendChild(portrait);
  }
  card.appendChild(portraits);

  const info = document.createElement("div");
  info.style.flex = "1";
  info.style.minWidth = "0";
  const name = document.createElement("div");
  name.className = "tb-team-card-name";
  name.textContent = team.name;
  info.appendChild(name);
  const date = document.createElement("div");
  date.className = "tb-team-card-date";
  date.textContent = t("teamBuilder.teamCard.modified").replace(
    "{date}",
    formatTeamDate(team.updatedAt, getLanguage()),
  );
  info.appendChild(date);
  card.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "tb-team-card-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "tb-btn";
  editBtn.type = "button";
  editBtn.textContent = t("teamBuilder.teamCard.edit");
  editBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    callbacks.onEdit();
  });
  actions.appendChild(editBtn);

  const exportBtn = document.createElement("button");
  exportBtn.className = "tb-btn";
  exportBtn.dataset.variant = "ghost";
  exportBtn.type = "button";
  exportBtn.textContent = t("teamBuilder.teamCard.export");
  exportBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    callbacks.onExport();
  });
  actions.appendChild(exportBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "tb-btn";
  deleteBtn.dataset.variant = "danger";
  deleteBtn.type = "button";
  deleteBtn.textContent = t("teamBuilder.teamCard.delete");
  deleteBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    callbacks.onDelete();
  });
  actions.appendChild(deleteBtn);

  card.appendChild(actions);

  card.addEventListener("click", () => callbacks.onEdit());

  return card;
}
