import type { TeamSet } from "@pokemon-tactic/core";
import { countAction, TelemetryAction } from "../../analytics/telemetry";
import { t } from "../../i18n";
import { generateRandomTeam } from "../../team/team-generator";
import { createEmptyTeam } from "../../team/team-helpers";
import { deleteTeam, listTeamSummaries, loadTeam, saveTeam } from "../../team/team-storage";
import { renderPreservingFocus } from "../dom/preserve-focus";
import { screenHeader, screenHeaderSpacer, screenHeaderTitle } from "../dom/screens/elements";
import { openDeleteConfirmModal } from "./DeleteConfirmModal";
import { openShowdownIoModal } from "./ShowdownIoModal";
import { createTeamCardElement } from "./TeamCard";

export interface MyTeamsViewOptions {
  onBack: () => void;
  onEditTeam: (teamId: string) => void;
}

/**
 * Team list view (topbar + cards) used by the DOM my-teams screen
 * (plan 120 step 5). Navigation stays with the caller via the options callbacks.
 */
export class MyTeamsView {
  readonly element: HTMLDivElement;
  private readonly content: HTMLDivElement;
  private readonly options: MyTeamsViewOptions;

  constructor(options: MyTeamsViewOptions) {
    this.options = options;
    const root = document.createElement("div");
    root.className = "scr-root tb-root";

    // Barre PARTAGÉE avec la salle d'attente et l'écran « Jouer en ligne » depuis le plan 207 : le
    // patron « écran plein » existait en trois copies, celle-ci servant de référence (« le bouton
    // retour de team builder est mieux », retour humain).
    const topbar = screenHeader(() => this.options.onBack());
    topbar.append(screenHeaderTitle(t("teamBuilder.myTeamsTitle")), screenHeaderSpacer());

    const newBtn = document.createElement("button");
    newBtn.className = "tb-btn";
    newBtn.dataset.variant = "primary";
    newBtn.type = "button";
    newBtn.textContent = t("teamBuilder.newTeam");
    newBtn.addEventListener("click", () => this.createNewTeam());
    topbar.appendChild(newBtn);

    const generateBtn = document.createElement("button");
    generateBtn.className = "tb-btn";
    generateBtn.type = "button";
    generateBtn.textContent = t("teamBuilder.generateRandom");
    generateBtn.addEventListener("click", () => this.generateRandom());
    topbar.appendChild(generateBtn);

    root.appendChild(topbar);

    const content = document.createElement("div");
    content.className = "tb-content";
    root.appendChild(content);

    this.element = root;
    this.content = content;
    this.renderTeams();
  }

  destroy(): void {
    this.element.remove();
  }

  private renderTeams(): void {
    renderPreservingFocus(this.content, () => this.renderTeamsNow());
  }

  private renderTeamsNow(): void {
    this.content.innerHTML = "";
    const summaries = listTeamSummaries().sort((a, b) => b.updatedAt - a.updatedAt);

    const header = document.createElement("div");
    header.className = "tb-my-teams-header";
    const headerTitle = document.createElement("div");
    headerTitle.className = "tb-my-teams-header-title";
    headerTitle.textContent = t("teamBuilder.myTeamsCount").replace(
      "{count}",
      summaries.length.toString(),
    );
    header.appendChild(headerTitle);
    this.content.appendChild(header);

    if (summaries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tb-empty-state";
      const title = document.createElement("div");
      title.textContent = t("teamBuilder.emptyState");
      title.className = "tb-empty-state-title";
      empty.appendChild(title);
      const hint = document.createElement("div");
      hint.textContent = t("teamBuilder.emptyHint");
      empty.appendChild(hint);
      this.content.appendChild(empty);
      return;
    }

    for (const summary of summaries) {
      const team = loadTeam(summary.id);
      if (team === null) {
        continue;
      }
      const card = createTeamCardElement(team, {
        onEdit: () => this.options.onEditTeam(team.id),
        onDelete: () => this.confirmDelete(team),
        onExport: () => this.exportTeam(team),
      });
      this.content.appendChild(card);
    }
  }

  private createNewTeam(): void {
    // Le Team Builder est-il utilisé, ou joue-t-on avec les équipes par défaut ? (plan 196)
    countAction(TelemetryAction.TeamSave);
    const team = createEmptyTeam(t("teamBuilder.untitledTeam"));
    saveTeam(team);
    this.options.onEditTeam(team.id);
  }

  private generateRandom(): void {
    const summaries = listTeamSummaries();
    const existingCount = summaries.filter((s) =>
      s.name.startsWith(t("teamBuilder.randomTeamPrefix")),
    ).length;
    const name = `${t("teamBuilder.randomTeamPrefix")} #${existingCount + 1}`;
    countAction(TelemetryAction.TeamGenerate);
    const team = generateRandomTeam({ name });
    saveTeam(team);
    this.options.onEditTeam(team.id);
  }

  private confirmDelete(team: TeamSet): void {
    openDeleteConfirmModal({
      teamName: team.name,
      onConfirm: () => {
        countAction(TelemetryAction.TeamDelete);
        deleteTeam(team.id);
        this.renderTeams();
      },
    });
  }

  private exportTeam(team: TeamSet): void {
    openShowdownIoModal({ team, mode: "export" });
  }
}
