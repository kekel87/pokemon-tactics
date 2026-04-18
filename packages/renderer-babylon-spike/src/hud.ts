import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import type { Scene } from "@babylonjs/core/scene";

export interface PokemonPanelApi {
  setHp(current: number, max: number): void;
  setCt(value: number): void;
  dispose(): void;
}

export function createPokemonPanel(scene: Scene, name: string): PokemonPanelApi {
  const texture = AdvancedDynamicTexture.CreateFullscreenUI("hud", true, scene);
  texture.idealWidth = 1920;

  const panel = new Rectangle("pokemon_panel");
  panel.width = "320px";
  panel.height = "120px";
  panel.thickness = 2;
  panel.color = "#f4e4b8";
  panel.background = "rgba(20, 30, 60, 0.85)";
  panel.cornerRadius = 4;
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  panel.left = "16px";
  panel.top = "-16px";
  texture.addControl(panel);

  const stack = new StackPanel();
  stack.width = 1;
  stack.paddingLeft = "12px";
  stack.paddingRight = "12px";
  stack.paddingTop = "8px";
  stack.paddingBottom = "8px";
  panel.addControl(stack);

  const nameLabel = new TextBlock("name", name);
  nameLabel.color = "#ffffff";
  nameLabel.fontFamily = "PokemonEmeraldPro";
  nameLabel.fontSize = 22;
  nameLabel.fontWeight = "bold";
  nameLabel.height = "28px";
  nameLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  stack.addControl(nameLabel);

  const { bar: hpBar, fill: hpFill, label: hpLabel } = createBar("hp", "#d04848");
  stack.addControl(hpBar);

  stack.addControl(createSpacer(4));

  const { bar: ctBar, fill: ctFill, label: ctLabel } = createBar("ct", "#4aa8d8");
  stack.addControl(ctBar);

  function setHp(current: number, max: number): void {
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    hpFill.width = ratio;
    hpLabel.text = `HP ${current}/${max}`;
  }

  function setCt(value: number): void {
    const ratio = Math.max(0, Math.min(1, value / 100));
    ctFill.width = ratio;
    ctLabel.text = `CT ${Math.round(value)}`;
  }

  setHp(42, 48);
  setCt(0);

  return {
    setHp,
    setCt,
    dispose: () => texture.dispose(),
  };
}

function createBar(
  id: string,
  fillColor: string,
): { bar: Rectangle; fill: Rectangle; label: TextBlock } {
  const bar = new Rectangle(`${id}_bar`);
  bar.width = 1;
  bar.height = "28px";
  bar.thickness = 1;
  bar.color = "#0c1220";
  bar.background = "rgba(0, 0, 0, 0.5)";
  bar.cornerRadius = 2;

  const fill = new Rectangle(`${id}_fill`);
  fill.width = 1;
  fill.height = 1;
  fill.thickness = 0;
  fill.background = fillColor;
  fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  bar.addControl(fill);

  const label = new TextBlock(`${id}_label`, "");
  label.color = "#ffffff";
  label.fontFamily = "PokemonEmeraldPro";
  label.fontSize = 16;
  label.fontWeight = "bold";
  bar.addControl(label);

  return { bar, fill, label };
}

function createSpacer(pixels: number): Rectangle {
  const spacer = new Rectangle("spacer");
  spacer.width = 1;
  spacer.height = `${pixels}px`;
  spacer.thickness = 0;
  spacer.background = "transparent";
  return spacer;
}
