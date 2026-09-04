import {
  countAction,
  countScreen,
  TelemetryAction,
  TelemetryScreen,
} from "../../../analytics/telemetry";
import { type BattleResumeSave, battleResumeStore } from "../../../app/battle-persistence";
import type { Navigate, Screen } from "../../../app/screen-manager";
import { getLanguage, setLanguage, t } from "../../../i18n";
import { Language } from "../../../i18n/types";
import { MAPS_REGISTRY } from "../../../maps/maps-registry";
import { releaseOnlineRoom } from "../../../network/online-room";
import { bindScreenInput, el, menuButton } from "./elements";

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
  return menuButton(label, () => {
    // La reprise du plan 181 est-elle voulue ? Ce compteur ne dit qu'« acceptée » ; le refus se
    // déduit de l'écart avec « proposée », donc il n'a pas de compteur à lui (plan 196).
    // ⚠️ Aucun `battle_started` ici : une reprise n'ouvre pas une nouvelle partie, sinon une partie
    // reprise trois fois compterait pour quatre.
    countAction(TelemetryAction.ResumeAccepted);
    navigate("combat", { mapUrl: save.mapUrl, setup: save.setup, resume: save });
  });
}

/**
 * DOM port of MainMenuScene: title, 5 entries (Aventure disabled) plus a 6th when a battle is waiting
 * to be resumed, version, language toggle.
 */
export function createMainMenuScreen(navigate: Navigate): Screen<"main-menu"> {
  let root: HTMLElement | null = null;
  let unbindScreenInput: (() => void) | null = null;

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
      countAction(TelemetryAction.ResumeOffered);
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
      countScreen(TelemetryScreen.MainMenu);
      /*
       * Toute retombée au menu principal met fin à une éventuelle session en ligne (plan 199).
       *
       * C'est le point de fermeture qui **couvre tous les cas** : le salon appartient à la session
       * et non à l'écran qui le crée — pour que l'accusé de lancement ait le temps de partir — et
       * `combat` ne transite que vers ici (`SCREEN_TRANSITIONS`). Quitter un combat en ligne, ou
       * l'abandonner, referme donc le canal sans que l'écran de combat ait à connaître le réseau.
       * Sans effet quand on jouait en local.
       */
      releaseOnlineRoom();
      render(host);
      // Sans « retour » (c'est le premier écran), mais les flèches doivent y naviguer comme partout.
      unbindScreenInput = bindScreenInput();
    },
    dispose() {
      unbindScreenInput?.();
      unbindScreenInput = null;
      root?.remove();
      root = null;
    },
  };
}
