import type { TeamSet } from "@pokemon-tactic/core";
import { createTeamListItemElement, type TeamListItemBadge } from "./TeamListItem";

export interface TeamListEntry {
  teamId: string | null;
  team: TeamSet | null;
  isRandom: boolean;
  badges: readonly TeamListItemBadge[];
}

export interface TeamListCallbacks {
  onPick: (teamId: string | null) => void;
}

export interface TeamListProps {
  entries: readonly TeamListEntry[];
  randomLabel: string;
  emptyTitle: string;
  emptyCta: string;
}

export function createTeamListElement(
  props: TeamListProps,
  callbacks: TeamListCallbacks,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "ts-team-list";

  const savedEntries = props.entries.filter((e) => !e.isRandom);
  if (savedEntries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "ts-team-list-empty";
    const title = document.createElement("h3");
    title.className = "ts-team-list-empty-title";
    title.textContent = props.emptyTitle;
    empty.appendChild(title);
    const cta = document.createElement("p");
    cta.className = "ts-team-list-empty-cta";
    cta.textContent = props.emptyCta;
    empty.appendChild(cta);
    wrapper.appendChild(empty);
  }

  const list = document.createElement("ul");
  list.className = "ts-team-list-items";
  const frag = document.createDocumentFragment();
  for (const entry of props.entries) {
    const li = createTeamListItemElement(
      {
        team: entry.team,
        isRandomRow: entry.isRandom,
        badges: entry.badges,
        randomLabel: props.randomLabel,
      },
      { onClick: () => callbacks.onPick(entry.teamId) },
    );
    frag.appendChild(li);
  }
  list.appendChild(frag);
  wrapper.appendChild(list);

  return wrapper;
}
