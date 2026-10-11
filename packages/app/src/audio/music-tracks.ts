import { RANDOM_MUSIC_ID } from "@pokemon-tactic/network";
import { BATTLE_MUSIC_TRACKS, type BattleMusicTrack, type MusicTrack } from "./music-track-table";

export { RANDOM_MUSIC_ID };

/**
 * The music choice of a battle (plan 239): a track id, or one of two entries that are not tracks —
 * « Aléatoire » (one track drawn, looped for the whole battle) and the medley (one drawn track
 * after another).
 *
 * `RANDOM_MUSIC_ID` is drawn ONCE, where the battle is set up — online by the host, whose draw
 * travels in the `start` — so a setup only ever carries a track id or the medley.
 */
export const MEDLEY_MUSIC_ID = "medley";

export function isRandomMusicId(musicId: string): boolean {
  return musicId === RANDOM_MUSIC_ID;
}

export function isMedleyMusicId(musicId: string): boolean {
  return musicId === MEDLEY_MUSIC_ID;
}

export function findBattleTrack(musicId: string): BattleMusicTrack | undefined {
  return BATTLE_MUSIC_TRACKS.find((track) => track.id === musicId);
}

/** The stored choice, or « Aléatoire » when it names a track the game no longer ships. */
export function knownMusicIdOrDefault(storedMusicId: string): string {
  return isMedleyMusicId(storedMusicId) || findBattleTrack(storedMusicId) !== undefined
    ? storedMusicId
    : RANDOM_MUSIC_ID;
}

/** What « Aléatoire » resolves to when the game ships no track: an id no track has, so silence. */
const NO_MUSIC_ID = "none";

/** `random` → a drawn track; anything else as it is. Never returns `random` itself. */
export function resolveMusicId(musicId: string): string {
  if (!isRandomMusicId(musicId)) {
    return musicId;
  }
  const index = Math.floor(Math.random() * BATTLE_MUSIC_TRACKS.length);
  return BATTLE_MUSIC_TRACKS[index]?.id ?? NO_MUSIC_ID;
}

/**
 * The medley's order: every track once in a drawn order, then a new draw — never the same track
 * twice in a row, also across two draws. Returns `undefined` only when there is no track at all.
 */
export function createMedleyOrder(random: () => number): () => MusicTrack | undefined {
  let queue: MusicTrack[] = [];
  let last: MusicTrack | undefined;
  return () => {
    if (queue.length === 0) {
      queue = [...BATTLE_MUSIC_TRACKS];
      // Fisher-Yates.
      for (let index = queue.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1));
        const moved = queue[index];
        const swapped = queue[other];
        if (moved !== undefined && swapped !== undefined) {
          queue[index] = swapped;
          queue[other] = moved;
        }
      }
      const first = queue[0];
      if (first !== undefined && first === last && queue.length > 1) {
        queue.push(first);
        queue.shift();
      }
    }
    last = queue.shift();
    return last;
  };
}
