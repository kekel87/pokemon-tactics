import { t } from "../i18n";
import { findBattleTrack, isMedleyMusicId, isRandomMusicId } from "./music-tracks";

/** What a music choice reads as: a track's label, « Aléatoire » or the medley. */
export function musicDisplayName(musicId: string): string {
  if (isRandomMusicId(musicId)) {
    return t("music.random");
  }
  if (isMedleyMusicId(musicId)) {
    return t("music.medley");
  }
  const track = findBattleTrack(musicId);
  // An id this build does not know (a peer on another version): shown as it came. A known one has
  // its label: the key is typed from the track table, so a track without one does not compile.
  return track === undefined ? musicId : t(`music.track.${track.id}`);
}
