import { ActionMenu } from "../ui/ActionMenu";
import { BattleUI } from "../ui/BattleUI";
import { InfoPanel } from "../ui/InfoPanel";
import { TurnTimeline } from "../ui/TurnTimeline";

export class BattleUIScene extends Phaser.Scene {
  infoPanel!: InfoPanel;
  actionMenu!: ActionMenu;
  battleUI!: BattleUI;
  turnTimeline!: TurnTimeline;

  constructor() {
    super("BattleUIScene");
  }

  create(): void {
    this.infoPanel = new InfoPanel(this);
    this.actionMenu = new ActionMenu(this);
    this.battleUI = new BattleUI(this);
    this.turnTimeline = new TurnTimeline(this);

    this.scene.get("BattleScene").events.emit("uiReady");
  }
}
