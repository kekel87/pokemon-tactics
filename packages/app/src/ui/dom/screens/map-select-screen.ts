import { createMapPreviewStage, type MapPreviewStage } from "@pokemon-tactic/render-babylon";
import { AnalyticsEvent, trackEvent } from "../../../analytics/analytics";
import type { Navigate, Screen } from "../../../app/screen-manager";
import { getLanguage, t } from "../../../i18n";
import { getInputSystem } from "../../../input/input-system";
import { MAPS_REGISTRY } from "../../../maps/maps-registry";
import { el, menuButton } from "./elements";

/**
 * DOM port of MapSelectScene (plan 120 step 3): map list on the left, live
 * Babylon preview + details on the right. ↑/↓ move the selection, Enter
 * confirms, Escape goes back.
 */
export function createMapSelectScreen(navigate: Navigate): Screen<"map-select"> {
  let root: HTMLElement | null = null;
  let preview: MapPreviewStage | null = null;
  let selectedIndex = 0;
  const listButtons: HTMLButtonElement[] = [];
  let unregisterInput: (() => void) | undefined;

  const goBack = (): void => navigate("battle-mode", undefined);

  const confirmSelection = (): void => {
    const entry = MAPS_REGISTRY[selectedIndex];
    if (entry) {
      navigate("team-select", { mapUrl: entry.url });
    }
  };

  const detailsName = el("h2", "ms-details-name", "map-detail-name");
  const detailsMeta = el("p", "ms-details-meta", "map-detail-meta");
  const detailsDescription = el("p", "ms-details-description", "map-detail-description");

  const refreshSelection = (): void => {
    const entry = MAPS_REGISTRY[selectedIndex];
    if (!entry) {
      return;
    }
    listButtons.forEach((button, index) => {
      button.setAttribute("aria-current", index === selectedIndex ? "true" : "false");
    });
    listButtons[selectedIndex]?.scrollIntoView({ block: "nearest" });
    const lang = getLanguage();
    detailsName.textContent = entry.displayName[lang];
    const tagsText = entry.tags.length > 0 ? `  ·  ${entry.tags.join(", ")}` : "";
    detailsMeta.textContent = `${entry.size}${tagsText}`;
    detailsDescription.textContent = entry.description[lang];
    preview?.setMap(entry.url);
  };

  const selectIndex = (index: number): void => {
    if (index === selectedIndex) {
      return;
    }
    selectedIndex = index;
    refreshSelection();
  };

  const moveSelection = (delta: number): void => {
    selectIndex((selectedIndex + delta + MAPS_REGISTRY.length) % MAPS_REGISTRY.length);
  };

  return {
    mount(host) {
      trackEvent(AnalyticsEvent.MapSelect);
      root = el("div", "ms-screen");

      const aside = el("aside", "ms-list-panel");
      const title = el("h1", "ms-title");
      title.textContent = t("mapSelect.title");
      const list = el("ul", "ms-list");
      MAPS_REGISTRY.forEach((entry, index) => {
        const item = el("li");
        const button = el("button", "ms-list-item", "map-list-item");
        button.type = "button";
        button.textContent = entry.displayName[getLanguage()];
        button.addEventListener("click", () => selectIndex(index));
        listButtons.push(button);
        item.append(button);
        list.append(item);
      });
      const back = menuButton(t("mapSelect.back"), goBack);
      aside.append(title, list, back);

      const main = el("div", "ms-main");
      const previewContainer = el("div", "ms-preview");
      const details = el("section", "ms-details");
      details.append(detailsName, detailsMeta, detailsDescription);
      const confirm = menuButton(t("mapSelect.confirm"), confirmSelection);
      confirm.classList.add("ms-confirm");
      main.append(previewContainer, details, confirm);

      root.append(aside, main);
      host.append(root);

      preview = createMapPreviewStage(previewContainer);
      refreshSelection();

      // This screen keeps its own arrows: they walk the MAP SELECTION, not the DOM focus, so it
      // registers a menu consumer of its own rather than the generic `bindScreenInput` (plan 184).
      unregisterInput = getInputSystem()?.register({
        context: () => "screen",
        menu: {
          focusMove: (direction) => {
            if (direction === "up") {
              moveSelection(-1);
            } else if (direction === "down") {
              moveSelection(1);
            }
          },
          confirm: () => {
            // A focused button already activates natively on Enter/Space.
            if (document.activeElement instanceof HTMLButtonElement) {
              return false;
            }
            confirmSelection();
            return true;
          },
          cancel: () => {
            goBack();
            return true;
          },
        },
      });
    },
    dispose() {
      unregisterInput?.();
      unregisterInput = undefined;
      preview?.dispose();
      preview = null;
      root?.remove();
      root = null;
    },
  };
}
