import { AnalyticsEvent, trackEvent } from "../../../analytics/analytics";
import { type BattleResumeSave, battleResumeStore } from "../../../app/battle-persistence";
import type { Navigate, Screen } from "../../../app/screen-manager";
import { getLanguage, setLanguage, t } from "../../../i18n";
import { Language } from "../../../i18n/types";
import { MAPS_REGISTRY } from "../../../maps/maps-registry";
import { el, menuButton } from "./elements";

const VERSION_TEXT = __APP_VERSION__;

/**
 * Entry point back into a battle interrupted by a reload (plan 181) — shown only when a save exists,
 * so the menu is unchanged for a player who has no battle waiting.
 *
 * The map name is spelled out in the label: the whole point of coming back here is not remembering
 * what was going on.
 */
function resumeEntry(save: BattleResumeSave, navigate: Navigate): HTMLButtonElement {
  const map = MAPS_REGISTRY.find((entry) => entry.url === save.mapUrl);
  const mapName = map?.displayName[getLanguage()];
  const label = mapName ? `${t("menu.resumeBattle")} — ${mapName}` : t("menu.resumeBattle");
  return menuButton(label, () =>
    navigate("combat", { mapUrl: save.mapUrl, setup: save.setup, resume: save }),
  );
}

/**
 * DOM port of MainMenuScene: title, 5 entries (Aventure disabled) plus a 6th when a battle is waiting
 * to be resumed, version, language toggle.
 */
export function createMainMenuScreen(navigate: Navigate): Screen<"main-menu"> {
  let root: HTMLElement | null = null;

  const render = (host: HTMLElement): void => {
    root?.remove();
    root = el("div", "mn-screen");

    const title = el("h1", "mn-title");
    title.textContent = "POKEMON TACTICS";

    const buttons = el("nav", "mn-buttons");
    // Read on every render (including the language toggle's re-render), so a battle abandoned from the
    // combat screen stops being offered without any cross-screen plumbing.
    const save = battleResumeStore().load();
    if (save) {
      buttons.append(resumeEntry(save, navigate));
    }
    buttons.append(
      menuButton(t("menu.adventure")),
      menuButton(t("menu.battle"), () => navigate("battle-mode", undefined)),
      menuButton(t("menu.teamBuilder"), () => navigate("my-teams", undefined)),
      menuButton(t("menu.settings"), () => navigate("settings", undefined)),
      menuButton(t("menu.credits"), () => navigate("credits", undefined)),
    );

    const version = el("span", "mn-version", "app-version");
    version.textContent = VERSION_TEXT;

    const language = el("button", "tb-btn mn-lang", "language-toggle");
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
