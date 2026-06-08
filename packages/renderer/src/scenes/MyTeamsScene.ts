import { MyTeamsView } from "../ui/team/MyTeamsView";

export class MyTeamsScene extends Phaser.Scene {
  private view: MyTeamsView | null = null;

  constructor() {
    super("MyTeamsScene");
  }

  create(): void {
    const view = new MyTeamsView({
      onBack: () => this.scene.start("MainMenuScene"),
      onEditTeam: (teamId) => this.scene.start("TeamEditScene", { teamId }),
    });
    document.body.appendChild(view.element);
    this.view = view;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.view?.destroy();
      this.view = null;
    });
  }
}
