import type { Navigate, Screen } from "../../../app/screen-manager";
import { t } from "../../../i18n";
import { bindScreenInput, comingSoonButton, el, menuButton } from "./elements";

/**
 * L'entrée du mode Aventure (plan 251), atteinte seulement derrière le verrou (`adventure-unlock.ts`).
 * « Continuer » arrivera avec la sauvegarde (lot 3) ; « Nouvelle aventure » avec la carte et la boucle
 * de base.
 */
export function createAdventureScreen(navigate: Navigate): Screen<"adventure"> {
  let root: HTMLElement | null = null;
  let unbindScreenInput: (() => void) | null = null;

  const goBack = (): void => navigate("main-menu", undefined);

  return {
    mount(host) {
      root = el("div", "mn-screen");

      const title = el("h1", "mn-title");
      title.textContent = t("adventure.title");

      const buttons = el("nav", "mn-buttons");
      buttons.append(
        comingSoonButton(t("adventure.new")),
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
