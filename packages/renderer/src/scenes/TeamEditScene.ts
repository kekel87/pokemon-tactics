import { TeamEditView } from "../ui/team/TeamEditView";

export interface TeamEditSceneData {
  teamId: string;
}

export class TeamEditScene extends Phaser.Scene {
  private teamId = "";
  private view: TeamEditView | null = null;

  constructor() {
    super("TeamEditScene");
  }

  init(data: TeamEditSceneData): void {
    this.teamId = data.teamId;
  }

  create(): void {
    const view = new TeamEditView({
      teamId: this.teamId,
      onBack: () => this.scene.start("MyTeamsScene"),
    });
    document.body.appendChild(view.element);
    this.view = view;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.view?.destroy();
      this.view = null;
    });
  }
}
