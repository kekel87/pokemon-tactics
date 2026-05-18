import type { TeamSet } from "@pokemon-tactic/core";
import { t } from "../i18n";
import { generateRandomTeam } from "../team/team-generator";
import { createEmptyTeam } from "../team/team-helpers";
import { deleteTeam, listTeamSummaries, loadTeam, saveTeam } from "../team/team-storage";
import { openDeleteConfirmModal } from "../ui/team/DeleteConfirmModal";
import { openShowdownIoModal } from "../ui/team/ShowdownIoModal";
import { createTeamCardElement } from "../ui/team/TeamCard";

export class MyTeamsScene extends Phaser.Scene {
  private root: HTMLDivElement | null = null;

  constructor() {
    super("MyTeamsScene");
  }

  create(): void {
    this.mountRoot();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unmountRoot());
  }

  private mountRoot(): void {
    this.unmountRoot();
    const root = document.createElement("div");
    root.className = "tb-root";
    root.dataset.scene = "MyTeamsScene";

    const topbar = document.createElement("div");
    topbar.className = "tb-topbar";

    const backBtn = document.createElement("button");
    backBtn.className = "tb-btn";
    backBtn.dataset.variant = "ghost";
    backBtn.type = "button";
    backBtn.textContent = t("teamBuilder.back");
    backBtn.addEventListener("click", () => this.scene.start("MainMenuScene"));
    topbar.appendChild(backBtn);

    const title = document.createElement("div");
    title.className = "tb-topbar-title";
    title.textContent = t("teamBuilder.myTeamsTitle");
    topbar.appendChild(title);

    const spacer = document.createElement("div");
    spacer.className = "tb-topbar-spacer";
    topbar.appendChild(spacer);

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

    document.body.appendChild(root);
    this.root = root;

    this.renderTeams(content);
  }

  private unmountRoot(): void {
    if (this.root !== null) {
      this.root.remove();
      this.root = null;
    }
  }

  private renderTeams(content: HTMLDivElement): void {
    content.innerHTML = "";
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
    content.appendChild(header);

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
      content.appendChild(empty);
      return;
    }

    for (const summary of summaries) {
      const team = loadTeam(summary.id);
      if (team === null) {
        continue;
      }
      const card = createTeamCardElement(team, {
        onEdit: () => this.editTeam(team.id),
        onDelete: () => this.confirmDelete(team),
        onExport: () => this.exportTeam(team),
      });
      content.appendChild(card);
    }
  }

  private createNewTeam(): void {
    const team = createEmptyTeam(t("teamBuilder.untitledTeam"));
    saveTeam(team);
    this.scene.start("TeamEditScene", { teamId: team.id });
  }

  private generateRandom(): void {
    const summaries = listTeamSummaries();
    const existingCount = summaries.filter((s) =>
      s.name.startsWith(t("teamBuilder.randomTeamPrefix")),
    ).length;
    const name = `${t("teamBuilder.randomTeamPrefix")} #${existingCount + 1}`;
    const team = generateRandomTeam({ name });
    saveTeam(team);
    this.scene.start("TeamEditScene", { teamId: team.id });
  }

  private editTeam(teamId: string): void {
    this.scene.start("TeamEditScene", { teamId });
  }

  private confirmDelete(team: TeamSet): void {
    openDeleteConfirmModal({
      teamName: team.name,
      onConfirm: () => {
        deleteTeam(team.id);
        if (this.root !== null) {
          const content = this.root.querySelector(".tb-content") as HTMLDivElement | null;
          if (content !== null) {
            this.renderTeams(content);
          }
        }
      },
    });
  }

  private exportTeam(team: TeamSet): void {
    openShowdownIoModal({ team, mode: "export" });
  }
}
