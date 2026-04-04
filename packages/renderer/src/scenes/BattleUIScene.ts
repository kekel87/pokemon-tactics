import { ActionMenu } from "../ui/ActionMenu";
import { BattleLogPanel } from "../ui/BattleLogPanel";
import { BattleUI } from "../ui/BattleUI";
import { InfoPanel } from "../ui/InfoPanel";
import { MoveTooltip } from "../ui/MoveTooltip";
import { PlacementRosterPanel } from "../ui/PlacementRosterPanel";
import { TurnTimeline } from "../ui/TurnTimeline";

export class BattleUIScene extends Phaser.Scene {
  infoPanel!: InfoPanel;
  actionMenu!: ActionMenu;
  battleUI!: BattleUI;
  turnTimeline!: TurnTimeline;
  placementRosterPanel!: PlacementRosterPanel;
  battleLogPanel!: BattleLogPanel;

  constructor() {
    super("BattleUIScene");
  }

  create(): void {
    this.infoPanel = new InfoPanel(this);
    this.actionMenu = new ActionMenu(this);
    this.battleUI = new BattleUI(this);
    this.turnTimeline = new TurnTimeline(this);
    this.placementRosterPanel = new PlacementRosterPanel(this);
    this.battleLogPanel = new BattleLogPanel(this);

    const moveTooltip = new MoveTooltip(this);
    this.actionMenu.setTooltip(moveTooltip);

    this.scene.get("BattleScene").events.emit("uiReady");
  }
}
