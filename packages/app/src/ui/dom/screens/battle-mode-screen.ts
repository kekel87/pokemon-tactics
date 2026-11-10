import { countScreen, TelemetryScreen } from "../../../analytics/telemetry";
import { ReplayFailure } from "../../../app/replay-code";
import type { Navigate, Screen } from "../../../app/screen-manager";
import { t } from "../../../i18n";
import type { TranslationKey } from "../../../i18n/types";
import { preferredMapId } from "../../../maps/preferred-map";
import { openReplayImportModal } from "../../team/ReplayImportModal";
import { bindScreenInput, comingSoonButton, el, menuButton } from "./elements";

const REPLAY_FAILURE_KEYS: Record<ReplayFailure, TranslationKey> = {
  [ReplayFailure.Rejected]: "replay.error.rejected",
  [ReplayFailure.LoadFailed]: "replay.error.loadFailed",
  [ReplayFailure.Diverged]: "replay.error.diverged",
};

/**
 * Stade de Combat (plan 251) : tout ce qui ne sert qu'au combat hors Aventure. Local, En ligne, Revoir un
 * combat, Constructeur d'équipe, Tutoriel (désactivé), retour au menu.
 *
 * 🔴 « Local » entre DROIT dans la sélection d'équipe depuis le plan 208 : l'écran de choix du
 * terrain qui s'intercalait ici n'existe plus. La carte vient des préférences (dernière jouée, sinon
 * un tirage) et se change en modale depuis l'écran suivant, ce qui préserve la composition en cours.
 */
export function createBattleModeScreen(navigate: Navigate): Screen<"battle-mode"> {
  let root: HTMLElement | null = null;
  let unbindScreenInput: (() => void) | null = null;

  const goBack = (): void => navigate("main-menu", undefined);

  return {
    mount(host, params) {
      countScreen(TelemetryScreen.BattleMode);
      root = el("div", "mn-screen");

      const title = el("h1", "mn-title");
      title.textContent = t("battleMode.title");

      const buttons = el("nav", "mn-buttons");
      const replayFailure = params?.replayFailure;
      if (replayFailure !== undefined) {
        const failure = el("p", "mn-error", "replay-error");
        failure.textContent = t(REPLAY_FAILURE_KEYS[replayFailure]);
        buttons.append(failure);
      }
      buttons.append(
        menuButton(t("battleMode.local"), () =>
          navigate("team-select", { mapId: preferredMapId() }),
        ),
        menuButton(t("battleMode.online"), () => navigate("lobby", undefined)),
        menuButton(t("menu.reviewBattle"), () => {
          // Un nouvel essai : l'échec du précédent ne doit pas rester sous la fenêtre d'import.
          // Retiré sur place, sans re-rendu : le bouton garde le focus que la fenêtre lui rendra.
          root?.querySelector("[data-testid='replay-error']")?.remove();
          openReplayImportModal((replay) =>
            navigate("combat", { mapUrl: replay.data.mapUrl, replay }),
          );
        }),
        menuButton(t("menu.teamBuilder"), () => navigate("my-teams", undefined)),
        comingSoonButton(t("battleMode.tutorial")),
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
