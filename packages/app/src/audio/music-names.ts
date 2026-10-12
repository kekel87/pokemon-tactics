import { t } from "../i18n";
import { MENU_MUSIC_TRACKS } from "./music-track-table";
import { findBattleTrack, isMedleyMusicId, isRandomMusicId } from "./music-tracks";

/** What a music choice reads as: a track's or a menus' theme's label, « Aléatoire », the medley. */
export function musicDisplayName(musicId: string): string {
  if (isRandomMusicId(musicId)) {
    return t("music.random");
  }
  if (isMedleyMusicId(musicId)) {
    return t("music.medley");
  }
  const menuTrack = MENU_MUSIC_TRACKS.find((track) => track.id === musicId);
  if (menuTrack !== undefined) {
    return t(`music.menu.${menuTrack.id}`);
  }
  const track = findBattleTrack(musicId);
  // An id this build does not know (a peer on another version): shown as it came. A known one has
  // its label: the key is typed from the track table, so a track without one does not compile.
  return track === undefined ? musicId : t(`music.track.${track.id}`);
}
