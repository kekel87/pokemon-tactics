import { exportTeamToShowdown, importShowdownTeam, type TeamSet } from "@pokemon-tactic/core";
import { Modal } from "@pokemon-tactic/ui-dom";
import { t } from "../../i18n";
import { getTeamBuilderRegistry } from "../../team/team-builder-data";
import { touchTeam } from "../../team/team-helpers";

export type ShowdownIoMode = "import" | "export";

export interface ShowdownIoModalOptions {
  team: TeamSet;
  mode: ShowdownIoMode;
  onImport?: (team: TeamSet) => void;
}

export function openShowdownIoModal(options: ShowdownIoModalOptions): void {
  const modal = new Modal({
    title: t("teamBuilder.showdown"),
    closeAriaLabel: t("teamBuilder.aria.close"),
  });
  const body = modal.getBody();

  const tabs = document.createElement("div");
  tabs.className = "tb-showdown-tabs";

  const importTab = document.createElement("div");
  importTab.className = "tb-showdown-tab";
  importTab.textContent = t("teamBuilder.showdownImport");

  const exportTab = document.createElement("div");
  exportTab.className = "tb-showdown-tab";
  exportTab.textContent = t("teamBuilder.showdownExport");

  tabs.appendChild(importTab);
  tabs.appendChild(exportTab);
  body.appendChild(tabs);

  const importView = document.createElement("div");
  const exportView = document.createElement("div");

  // EXPORT view
  const exportTextarea = document.createElement("textarea");
  exportTextarea.className = "tb-showdown-textarea";
  exportTextarea.readOnly = true;
  try {
    const registry = getTeamBuilderRegistry();
    exportTextarea.value = exportTeamToShowdown(options.team, registry.exportRegistry);
  } catch (err) {
    exportTextarea.value = `Error: ${(err as Error).message}`;
  }
  exportView.appendChild(exportTextarea);

  const copyBtn = document.createElement("button");
  copyBtn.className = "tb-btn";
  copyBtn.dataset.variant = "primary";
  copyBtn.type = "button";
  copyBtn.textContent = t("teamBuilder.showdownCopy");
  copyBtn.style.marginTop = "8px";
  copyBtn.addEventListener("click", () => {
    void navigator.clipboard
      .writeText(exportTextarea.value)
      .then(() => {
        copyBtn.textContent = t("teamBuilder.showdownCopied");
        setTimeout(() => {
          copyBtn.textContent = t("teamBuilder.showdownCopy");
        }, 1500);
      })
      .catch(() => {
        copyBtn.textContent = "✗";
      });
  });
  exportView.appendChild(copyBtn);

  // IMPORT view
  const importTextarea = document.createElement("textarea");
  importTextarea.className = "tb-showdown-textarea";
  importTextarea.placeholder = t("teamBuilder.showdownImportPlaceholder");
  importView.appendChild(importTextarea);

  const importBtn = document.createElement("button");
  importBtn.className = "tb-btn";
  importBtn.dataset.variant = "primary";
  importBtn.type = "button";
  importBtn.textContent = t("teamBuilder.showdownImportButton");
  importBtn.style.marginTop = "8px";
  importView.appendChild(importBtn);

  const importFeedback = document.createElement("div");
  importView.appendChild(importFeedback);

  importBtn.addEventListener("click", () => {
    importFeedback.innerHTML = "";
    const text = importTextarea.value;
    try {
      const registry = getTeamBuilderRegistry();
      const result = importShowdownTeam(text, registry.importRegistry);
      if (result.warnings.length > 0) {
        const warnList = document.createElement("div");
        warnList.className = result.team === null ? "tb-error-list" : "tb-warn-list";
        const title =
          result.team === null
            ? t("teamBuilder.showdownErrorsTitle")
            : t("teamBuilder.showdownWarningsTitle");
        warnList.innerHTML = `<strong>${title}</strong><ul>${result.warnings
          .map((w) => `<li>${w.kind} — ${w.detail}</li>`)
          .join("")}</ul>`;
        importFeedback.appendChild(warnList);
      }
      if (result.team === null) {
        if (result.warnings.length === 0) {
          const errorList = document.createElement("div");
          errorList.className = "tb-error-list";
          errorList.textContent = t("teamBuilder.showdownNoneParsed");
          importFeedback.appendChild(errorList);
        }
        return;
      }
      const updated = touchTeam({
        ...options.team,
        slots: result.team.slots,
        name: options.team.name,
      });
      options.onImport?.(updated);
      modal.close();
    } catch (err) {
      const errorList = document.createElement("div");
      errorList.className = "tb-error-list";
      errorList.textContent = (err as Error).message;
      importFeedback.appendChild(errorList);
    }
  });

  body.appendChild(importView);
  body.appendChild(exportView);

  const setMode = (mode: ShowdownIoMode): void => {
    importTab.dataset.state = mode === "import" ? "active" : "";
    exportTab.dataset.state = mode === "export" ? "active" : "";
    importView.style.display = mode === "import" ? "" : "none";
    exportView.style.display = mode === "export" ? "" : "none";
  };
  if (options.onImport === undefined) {
    importTab.style.pointerEvents = "none";
    importTab.style.opacity = "0.4";
  }
  importTab.addEventListener("click", () => {
    if (options.onImport !== undefined) {
      setMode("import");
    }
  });
  exportTab.addEventListener("click", () => setMode("export"));
  setMode(options.mode);
}
