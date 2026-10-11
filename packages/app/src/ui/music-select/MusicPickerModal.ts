import { Modal } from "@pokemon-tactic/ui-dom";
import { countAction, TelemetryAction } from "../../analytics/telemetry";
import { musicDisplayName } from "../../audio/music-names";
import { BATTLE_MUSIC_TRACKS } from "../../audio/music-track-table";
import {
  isMedleyMusicId,
  isRandomMusicId,
  MEDLEY_MUSIC_ID,
  RANDOM_MUSIC_ID,
} from "../../audio/music-tracks";
import { t } from "../../i18n";
import { el } from "../dom/screens/elements";

export interface MusicPickerOptions {
  /** The choice held when the modal opens, `RANDOM_MUSIC_ID` and the medley included. */
  currentMusicId: string;
  /** Called only when the player picks a choice other than the one held. */
  onPick: (musicId: string) => void;
}

/**
 * The battle music choice, as a modal (plan 239): « Aléatoire » and the medley first — the two
 * entries most players want — then every track by name. A line is a plain button and picking is
 * one press, so keyboard, gamepad and touch need nothing of their own here.
 *
 * Returns what closes it from outside: the modal lives on `document.body`, outside the tree of
 * the screen that opens it, and a remote `start` may unmount that screen while it is open.
 */
export function openMusicPickerModal(options: MusicPickerOptions): () => void {
  const modal = new Modal({
    title: t("music.pickerTitle"),
    closeAriaLabel: t("teamBuilder.aria.close"),
    size: "picker",
  });

  const list = el("ul", "ms-list");
  let currentButton: HTMLButtonElement | null = null;
  const musicIds = [RANDOM_MUSIC_ID, MEDLEY_MUSIC_ID, ...BATTLE_MUSIC_TRACKS.map(({ id }) => id)];
  for (const musicId of musicIds) {
    const item = el("li");
    const button = el("button", "ms-list-item", "music-list-item");
    button.type = "button";
    button.dataset.musicId = musicId;
    button.textContent = musicDisplayName(musicId);
    const current = musicId === options.currentMusicId;
    button.setAttribute("aria-current", current ? "true" : "false");
    if (current) {
      currentButton = button;
    }
    button.addEventListener("click", () => {
      modal.close();
      if (current) {
        return;
      }
      countAction(chosenActionOf(musicId));
      options.onPick(musicId);
    });
    item.append(button);
    list.append(item);
  }
  modal.getBody().append(list);

  // The list opens on the choice held, so the player reads where they stand — and a gamepad, which
  // has no `Tab`, gets a starting point.
  (currentButton ?? list.querySelector<HTMLElement>("button"))?.focus();
  currentButton?.scrollIntoView({ block: "nearest" });

  return () => modal.close();
}

function chosenActionOf(musicId: string): TelemetryAction {
  if (isRandomMusicId(musicId)) {
    return TelemetryAction.MusicRandomChosen;
  }
  return isMedleyMusicId(musicId)
    ? TelemetryAction.MusicMedleyChosen
    : TelemetryAction.MusicTrackChosen;
}
