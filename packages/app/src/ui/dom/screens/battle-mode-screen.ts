import { countScreen, TelemetryScreen } from "../../../analytics/telemetry";
import type { Navigate, Screen } from "../../../app/screen-manager";
import { t } from "../../../i18n";
import { preferredMapId } from "../../../maps/preferred-map";
import { bindScreenInput, el, menuButton } from "./elements";

/**
 * Le choix du mode de combat : Local et En ligne actifs, Tutoriel désactivé, retour au menu.
 *
 * 🔴 « Jeu en solo » entre DROIT dans la sélection d'équipe depuis le plan 208 : l'écran de choix du
 * terrain qui s'intercalait ici n'existe plus. La carte vient des préférences (dernière jouée, sinon
 * un tirage) et se change en modale depuis l'écran suivant, ce qui préserve la composition en cours.
 */
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
        menuButton(t("battleMode.local"), () =>
          navigate("team-select", { mapId: preferredMapId() }),
        ),
        menuButton(t("battleMode.online"), () => navigate("lobby", undefined)),
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
