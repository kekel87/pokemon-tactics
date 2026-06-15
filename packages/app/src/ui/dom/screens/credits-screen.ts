import type { Navigate, Screen } from "../../../app/screen-manager";
import { t } from "../../../i18n";
import { bindEscape, el, menuButton } from "./elements";

const CREDIT_KEYS = [
  "credits.disclaimer",
  "credits.sprites",
  "credits.tileset",
  "credits.font",
  "credits.code",
] as const;

/** DOM port of CreditsScene: attribution paragraphs + back to menu. */
export function createCreditsScreen(navigate: Navigate): Screen<"credits"> {
  let root: HTMLElement | null = null;
  let unbindEscape: (() => void) | null = null;

  const goBack = (): void => navigate("main-menu", undefined);

  return {
    mount(host) {
      root = el("div", "mn-screen");

      const title = el("h1", "mn-title");
      title.textContent = t("credits.title");

      const content = el("div", "mn-credits");
      for (const key of CREDIT_KEYS) {
        const paragraph = el("p", "mn-credits-text");
        paragraph.textContent = t(key);
        content.append(paragraph);
      }

      root.append(title, content, menuButton(t("credits.back"), goBack));
      host.append(root);
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
