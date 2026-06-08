import { AnalyticsEvent, trackEvent } from "../../../analytics/analytics";
import type { Navigate, Screen } from "../../../app/screen-manager";
import { getLanguage, setLanguage, t } from "../../../i18n";
import { Language } from "../../../i18n/types";
import { el, menuButton } from "./elements";

const VERSION_TEXT = __APP_VERSION__;

/** DOM port of MainMenuScene: title, 5 entries (Aventure disabled), version, language toggle. */
export function createMainMenuScreen(navigate: Navigate): Screen<"main-menu"> {
  let root: HTMLElement | null = null;

  const render = (host: HTMLElement): void => {
    root?.remove();
    root = el("div", "mn-screen");

    const title = el("h1", "mn-title");
    title.textContent = "POKEMON TACTICS";

    const buttons = el("nav", "mn-buttons");
    buttons.append(
      menuButton(t("menu.adventure")),
      menuButton(t("menu.battle"), () => navigate("battle-mode", undefined)),
      menuButton(t("menu.teamBuilder"), () => navigate("my-teams", undefined)),
      menuButton(t("menu.settings"), () => navigate("settings", undefined)),
      menuButton(t("menu.credits"), () => navigate("credits", undefined)),
    );

    const version = el("span", "mn-version");
    version.textContent = VERSION_TEXT;

    const language = el("button", "tb-btn mn-lang");
    language.type = "button";
    language.textContent = getLanguage().toUpperCase();
    language.addEventListener("click", () => {
      setLanguage(getLanguage() === Language.French ? Language.English : Language.French);
      render(host);
    });

    root.append(title, buttons, version, language);
    host.append(root);
  };

  return {
    mount(host) {
      trackEvent(AnalyticsEvent.MainMenu);
      render(host);
    },
    dispose() {
      root?.remove();
      root = null;
    },
  };
}
