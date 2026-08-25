import type { Navigate, Screen } from "../../../app/screen-manager";
import type { Panel } from "../panels/panel";
import { createSettingsPanel } from "../panels/settings-panel";
import { bindScreenInput } from "./elements";

/**
 * Enveloppe écran du panneau de réglages (plan 187).
 *
 * Les lignes de réglages vivent dans `panels/settings-panel.ts`, que le menu de combat monte aussi.
 * Il ne reste ici que la registration d'entrée de la FSM et les deux sorties par navigation.
 */
export function createSettingsScreen(navigate: Navigate): Screen<"settings"> {
  let panel: Panel | null = null;
  let unbindScreenInput: (() => void) | null = null;

  const goBack = (): void => navigate("main-menu", undefined);

  return {
    mount(host) {
      panel = createSettingsPanel({
        onBack: goBack,
        onOpenControls: () => navigate("controls", undefined),
      });
      host.append(panel.element);
      unbindScreenInput = bindScreenInput(goBack);
    },
    dispose() {
      unbindScreenInput?.();
      unbindScreenInput = null;
      panel?.dispose();
      panel = null;
    },
  };
}
