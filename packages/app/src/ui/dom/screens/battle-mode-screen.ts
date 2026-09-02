import { countScreen, TelemetryScreen } from "../../../analytics/telemetry";
import type { Navigate, Screen } from "../../../app/screen-manager";
import { t } from "../../../i18n";
import { bindScreenInput, el, menuButton } from "./elements";

/** DOM port of BattleModeScene: Local enabled, Online/Tutorial disabled, back to menu. */
export function createBattleModeScreen(navigate: Navigate): Screen<"battle-mode"> {
  let root: HTMLElement | null = null;
  let unbindScreenInput: (() => void) | null = null;

  const goBack = (): void => navigate("main-menu", undefined);

  return {
    mount(host) {
      countScreen(TelemetryScreen.BattleMode);
      root = el("div", "mn-screen");

      const title = el("h1", "mn-title");
      title.textContent = t("battleMode.title");

      const buttons = el("nav", "mn-buttons");
      buttons.append(
        menuButton(t("battleMode.local"), () => navigate("map-select", undefined)),
        menuButton(t("battleMode.online")),
        menuButton(t("battleMode.tutorial")),
        menuButton(t("battleMode.back"), goBack),
      );

      root.append(title, buttons);
      host.append(root);
      unbindScreenInput = bindScreenInput(goBack);
    },
    dispose() {
      unbindScreenInput?.();
      unbindScreenInput = null;
      root?.remove();
      root = null;
    },
  };
}
