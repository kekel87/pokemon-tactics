import type { Navigate, Screen } from "../../../app/screen-manager";
import { getLanguage, setLanguage, t } from "../../../i18n";
import { Language } from "../../../i18n/types";
import {
  isFullscreen,
  isFullscreenSupported,
  onFullscreenChange,
  toggleFullscreen,
} from "../../../platform/fullscreen";
import { shouldOfferIosInstall } from "../../../platform/pwa";
import { getSettings, updateSettings } from "../../../settings";
import { bindEscape, el, menuButton } from "./elements";

/** DOM port of SettingsScene: language and damage-preview rows. */
export function createSettingsScreen(navigate: Navigate): Screen<"settings"> {
  let root: HTMLElement | null = null;
  let unbindEscape: (() => void) | null = null;
  let unbindFullscreen: (() => void) | null = null;

  const goBack = (): void => navigate("main-menu", undefined);

  const row = (label: string, control: HTMLElement): HTMLElement => {
    const container = el("div", "mn-row");
    const labelElement = el("span", "mn-row-label");
    labelElement.textContent = label;
    container.append(labelElement, control);
    return container;
  };

  const render = (host: HTMLElement): void => {
    root?.remove();
    root = el("div", "mn-screen");

    const title = el("h1", "mn-title");
    title.textContent = t("settings.title");

    const languageToggle = menuButton(getLanguage() === Language.French ? "FR" : "EN", () => {
      setLanguage(getLanguage() === Language.French ? Language.English : Language.French);
      render(host);
    });
    languageToggle.dataset.testid = "setting-language";

    const damagePreviewEnabled = getSettings().damagePreview;
    const damagePreviewToggle = menuButton(
      damagePreviewEnabled ? t("settings.on") : t("settings.off"),
      () => {
        updateSettings({ damagePreview: !getSettings().damagePreview });
        render(host);
      },
    );
    damagePreviewToggle.dataset.testid = "setting-damage-preview";

    const rows = el("div", "mn-rows");
    rows.append(
      row(t("settings.language"), languageToggle),
      row(t("settings.damagePreview"), damagePreviewToggle),
    );

    // Plein écran (plan 180-a) : masque la barre d'URL du navigateur, qui ampute une bande d'un
    // viewport paysage déjà à l'étroit sur téléphone. La ligne n'apparaît que si l'API existe —
    // sur iPhone elle est absente (Safari ne l'implémente pas), et une bascule inerte serait pire
    // que pas de bascule. Là-bas, c'est la ligne d'installation ci-dessous qui prend le relais.
    if (isFullscreenSupported()) {
      const fullscreenToggle = menuButton(
        isFullscreen() ? t("settings.on") : t("settings.off"),
        () => {
          // Pas d'`await` avant l'appel : `toggleFullscreen` doit consommer l'activation
          // utilisateur de ce clic, sinon la demande est rejetée. Le rendu suit via
          // `fullscreenchange`, ce qui couvre aussi les sorties non déclenchées par nous
          // (Échap, geste système).
          void toggleFullscreen();
        },
      );
      fullscreenToggle.dataset.testid = "setting-fullscreen";
      rows.append(row(t("settings.fullscreen"), fullscreenToggle));
    }

    // iPhone : le plein écran ne s'obtient qu'en installant le site à l'écran d'accueil, et aucune
    // API ne peut le proposer (`beforeinstallprompt` n'existe pas sur iOS) — d'où une simple
    // marche à suivre. Masquée dès que l'app tourne déjà installée.
    if (shouldOfferIosInstall()) {
      const hint = el("span", "mn-row-hint", "setting-install-hint");
      hint.textContent = t("settings.installAppIosHint");
      rows.append(row(t("settings.installApp"), hint));
    }

    const back = menuButton(t("settings.back"), goBack);

    root.append(title, rows, back);
    host.append(root);
  };

  return {
    mount(host) {
      render(host);
      unbindEscape = bindEscape(goBack);
      // Le plein écran peut être quitté sans passer par la bascule (Échap, geste système) : on
      // réaffiche depuis l'état réel du document plutôt que depuis un état local qui dériverait.
      unbindFullscreen = onFullscreenChange(() => render(host));
    },
    dispose() {
      unbindEscape?.();
      unbindEscape = null;
      unbindFullscreen?.();
      unbindFullscreen = null;
      root?.remove();
      root = null;
    },
  };
}
