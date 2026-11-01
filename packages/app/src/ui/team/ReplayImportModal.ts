import { Modal } from "@pokemon-tactic/ui-dom";
import { decodeReplayCode, ReplayCodeError, type ReplayData } from "../../app/replay-code";
import { t } from "../../i18n";
import type { TranslationKey } from "../../i18n/types";

/**
 * La fenêtre « Revoir un combat » (plan 242) : on y colle un code de replay, ou on charge le fichier
 * que le bouton de l'écran de victoire a téléchargé.
 *
 * Le champ de texte ne se saisit pas à la manette — c'est un choix du jeu, pas un oubli. Le bouton
 * « Charger un fichier » est son chemin au pad, et celui des codes trop longs pour un message.
 */

const ERROR_KEYS: Record<ReplayCodeError, TranslationKey> = {
  [ReplayCodeError.NotACode]: "replay.error.notACode",
  [ReplayCodeError.Unreadable]: "replay.error.unreadable",
  [ReplayCodeError.UnknownFormat]: "replay.error.unknownFormat",
  [ReplayCodeError.OtherVersion]: "replay.error.otherVersion",
};

export function openReplayImportModal(onLoaded: (data: ReplayData) => void): void {
  const modal = new Modal({
    title: t("replay.title"),
    closeAriaLabel: t("teamBuilder.aria.close"),
  });
  const body = modal.getBody();

  const hint = document.createElement("p");
  hint.className = "rp-import-hint";
  hint.textContent = t("replay.hint");

  const label = document.createElement("label");
  label.textContent = t("replay.pasteLabel");
  const textarea = document.createElement("textarea");
  textarea.className = "tb-showdown-textarea";
  textarea.dataset.testid = "replay-code-input";
  textarea.placeholder = t("replay.pastePlaceholder");
  textarea.spellcheck = false;
  label.append(textarea);

  const feedback = document.createElement("div");
  feedback.className = "tb-error-list";
  feedback.dataset.testid = "replay-import-error";
  feedback.hidden = true;
  feedback.setAttribute("role", "alert");

  /*
   * Le décodage est asynchrone : sans ce verrou, un double clic (ou un clic puis un fichier) en lance
   * deux, et les deux ouvrent un combat.
   */
  let decoding = false;
  const load = async (text: string): Promise<void> => {
    if (decoding) {
      return;
    }
    decoding = true;
    const result = await decodeReplayCode(text, __APP_VERSION__);
    decoding = false;
    if (!result.ok) {
      feedback.textContent = t(ERROR_KEYS[result.error]);
      feedback.hidden = false;
      return;
    }
    modal.close();
    onLoaded(result.data);
  };

  const start = document.createElement("button");
  start.type = "button";
  start.className = "tb-btn";
  start.dataset.variant = "primary";
  start.dataset.testid = "replay-start";
  start.textContent = t("replay.start");
  start.addEventListener("click", () => void load(textarea.value));

  // Le `<input type="file">` reste caché : le bouton visible porte le focus, le `data-testid` et le
  // style du jeu, et le clic le délègue au sélecteur natif.
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".txt,text/plain";
  fileInput.hidden = true;
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    // Vidé tout de suite : sinon reprendre le même fichier après une erreur ne déclenche plus `change`.
    fileInput.value = "";
    if (file !== undefined) {
      file.text().then(load, () => {
        feedback.textContent = t(ERROR_KEYS[ReplayCodeError.Unreadable]);
        feedback.hidden = false;
      });
    }
  });
  const fileButton = document.createElement("button");
  fileButton.type = "button";
  fileButton.className = "tb-btn";
  fileButton.dataset.testid = "replay-load-file";
  fileButton.textContent = t("replay.loadFile");
  fileButton.addEventListener("click", () => fileInput.click());

  const actions = document.createElement("div");
  actions.className = "rp-import-actions";
  actions.append(fileButton, start, fileInput);
  const content = document.createElement("div");
  content.className = "rp-import";
  content.append(hint, label, feedback, actions);
  body.append(content);
  textarea.focus();
}
