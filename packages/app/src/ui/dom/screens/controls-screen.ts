import { countScreen, TelemetryScreen } from "../../../analytics/telemetry";
import type { Navigate, Screen } from "../../../app/screen-manager";
import { createControlsPanel } from "../panels/controls-panel";
import type { Panel } from "../panels/panel";
import { bindScreenInput } from "./elements";

/**
 * Enveloppe écran du panneau des contrôles (plan 186, réduite à ceci par le plan 187).
 *
 * Tout ce qui dessine la table vit dans `panels/controls-panel.ts`, que le menu de combat monte
 * aussi. Il ne reste ici que ce qui fait d'un panneau un ÉCRAN : la registration d'entrée de la FSM
 * et la sortie par navigation.
 */
export function createControlsScreen(navigate: Navigate): Screen<"controls"> {
  let panel: Panel | null = null;
  let unbindScreenInput: (() => void) | null = null;

  // Retour vers RÉGLAGES, d'où l'on vient — pas vers le menu principal : un écran atteint depuis un
  // autre doit y ramener, sinon `Échap` éjecte le joueur de deux niveaux d'un coup.
  const goBack = (): void => navigate("settings", undefined);

  return {
    mount(host) {
      // La légende du plan 185 suffit-elle, ou va-t-on chercher la liste complète ? (plan 196)
      countScreen(TelemetryScreen.Controls);
      panel = createControlsPanel({ onBack: goBack });
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
