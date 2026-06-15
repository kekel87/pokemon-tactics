import type { Navigate, Screen } from "../../../app/screen-manager";
import { HOVER_CURSOR_OPTIONS } from "../../../constants";
import { getLanguage, setLanguage, t } from "../../../i18n";
import { Language } from "../../../i18n/types";
import { getSettings, updateSettings } from "../../../settings";
import { bindEscape, el, menuButton } from "./elements";

/** DOM port of SettingsScene: language, damage preview and hover-cursor rows. */
export function createSettingsScreen(navigate: Navigate): Screen<"settings"> {
  let root: HTMLElement | null = null;
  let unbindEscape: (() => void) | null = null;

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

    const cursorIndex = Math.max(
      0,
      HOVER_CURSOR_OPTIONS.findIndex((option) => option.key === getSettings().hoverCursorKey),
    );
    const cursorOption = HOVER_CURSOR_OPTIONS[cursorIndex] ?? HOVER_CURSOR_OPTIONS[0];
    const cursorToggle = menuButton(cursorOption.label, () => {
      const next = HOVER_CURSOR_OPTIONS[(cursorIndex + 1) % HOVER_CURSOR_OPTIONS.length];
      updateSettings({ hoverCursorKey: (next ?? cursorOption).key });
      render(host);
    });
    cursorToggle.dataset.testid = "setting-cursor";
    const cursorImage = el("img", "mn-cursor-preview");
    cursorImage.src = `assets/ui/cursor/${cursorOption.key}.png`;
    cursorImage.alt = "";
    cursorImage.loading = "lazy";
    cursorImage.decoding = "async";
    cursorToggle.prepend(cursorImage);

    const rows = el("div", "mn-rows");
    rows.append(
      row(t("settings.language"), languageToggle),
      row(t("settings.damagePreview"), damagePreviewToggle),
      row(t("settings.cursor"), cursorToggle),
    );

    const back = menuButton(t("settings.back"), goBack);

    root.append(title, rows, back);
    host.append(root);
  };

  return {
    mount(host) {
      render(host);
      unbindEscape = bindEscape(goBack);
    },
    dispose() {
      unbindEscape?.();
      unbindEscape = null;
      root?.remove();
      root = null;
    },
  };
}
