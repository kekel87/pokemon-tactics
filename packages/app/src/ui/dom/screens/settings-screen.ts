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
import { bindScreenInput, el, menuButton } from "./elements";

/** DOM port of SettingsScene: language and damage-preview rows. */
export function createSettingsScreen(navigate: Navigate): Screen<"settings"> {
  let root: HTMLElement | null = null;
  let unbindScreenInput: (() => void) | null = null;
  let unbindFullscreen: (() => void) | null = null;
  let fullscreenToggle: HTMLButtonElement | null = null;

  /**
   * Refresh just the fullscreen label. Leaving fullscreen through Escape or a system gesture has to
   * show through, but rebuilding the screen for one word would drop the keyboard focus (plan 184).
   */
  const refreshFullscreenLabel = (): void => {
    if (fullscreenToggle) {
      fullscreenToggle.textContent = isFullscreen() ? t("settings.on") : t("settings.off");
    }
  };

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
    fullscreenToggle = null;

    const title = el("h1", "mn-title");
    title.textContent = t("settings.title");

    // Switching the language retranslates every label of the screen, so this one really does rebuild
    // — and then puts the focus back where it was, or a keyboard player would lose their place.
    const languageToggle = menuButton(getLanguage() === Language.French ? "FR" : "EN", () => {
      setLanguage(getLanguage() === Language.French ? Language.English : Language.French);
      render(host);
      root?.querySelector<HTMLElement>("[data-testid='setting-language']")?.focus();
    });
    languageToggle.dataset.testid = "setting-language";

    const damagePreviewToggle = menuButton(
      getSettings().damagePreview ? t("settings.on") : t("settings.off"),
      () => {
        updateSettings({ damagePreview: !getSettings().damagePreview });
        // Only this label changes — mutate it in place. Rebuilding the whole subtree used to drop the
        // focus to `<body>` on every toggle, which makes keyboard and gamepad navigation unusable
        // (plan 184, dette rapatriée du Lot 3 / décision #752).
        damagePreviewToggle.textContent = getSettings().damagePreview
          ? t("settings.on")
          : t("settings.off");
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
      fullscreenToggle = menuButton(isFullscreen() ? t("settings.on") : t("settings.off"), () => {
        // Pas d'`await` avant l'appel : `toggleFullscreen` doit consommer l'activation
        // utilisateur de ce clic, sinon la demande est rejetée. Le rendu suit via
        // `fullscreenchange`, ce qui couvre aussi les sorties non déclenchées par nous
        // (Échap, geste système).
        void toggleFullscreen();
      });
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

    const controls = menuButton(t("settings.configure"), () => navigate("controls", undefined));
    controls.dataset.testid = "setting-controls";
    rows.append(row(t("settings.controls"), controls));

    const back = menuButton(t("settings.back"), goBack);

    root.append(title, rows, back);
    host.append(root);
  };

  return {
    mount(host) {
      render(host);
      unbindScreenInput = bindScreenInput(goBack);
      // Le plein écran peut être quitté sans passer par la bascule (Échap, geste système) : on relit
      // l'état réel du document plutôt qu'un état local qui dériverait — mais on ne rafraîchit que
      // le libellé concerné, pas tout l'écran (plan 184 : un re-rendu perd le focus clavier).
      unbindFullscreen = onFullscreenChange(refreshFullscreenLabel);
    },
    dispose() {
      unbindScreenInput?.();
      unbindScreenInput = null;
      unbindFullscreen?.();
      unbindFullscreen = null;
      root?.remove();
      root = null;
    },
  };
}
