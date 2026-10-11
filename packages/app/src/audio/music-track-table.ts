/**
 * The game's music (plan 239): official themes, with their loop points in ms of the source file.
 * A track plays its intro once, then loops between `loopStartMs` and `loopEndMs`.
 *
 * Two sources. Pokémon Showdown's battle themes (Gen 4 to 7) come with the loop points its client
 * hard-codes (`setBgm`). PokeRogue's (Gen 6 to 9, and the menu theme) loop from a start point to
 * the end of the file (`getBgmLoopPoint`): their `loopEndMs` is the file's decoded length, measured
 * once. The two longest PokeRogue themes are left out — past three minutes a decoded track costs
 * 80 MB and more, too much for a phone.
 *
 * Plain data without any import: `pnpm build-music` reads it to fetch and cut the files, the game
 * to play them. Emptying `BATTLE_MUSIC_TRACKS` is all it takes to ship without battle music.
 */
export interface MusicTrack<Id extends string = string> {
  /** Our file: `assets/audio/music/<id>.mp3`. */
  id: Id;
  sourceUrl: string;
  loopStartMs: number;
  loopEndMs: number;
}

const SHOWDOWN = "https://play.pokemonshowdown.com/audio";
const POKEROGUE =
  "https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/bgm";

function showdown<Id extends string>(
  id: Id,
  loopStartMs: number,
  loopEndMs: number,
): MusicTrack<Id> {
  return { id, sourceUrl: `${SHOWDOWN}/${id}.mp3`, loopStartMs, loopEndMs };
}

function pokerogue<Id extends string>(
  id: Id,
  file: string,
  loopStartMs: number,
  loopEndMs: number,
): MusicTrack<Id> {
  return { id, sourceUrl: `${POKEROGUE}/${file}.mp3`, loopStartMs, loopEndMs };
}

/** Kept as a tuple: the track ids form a type, which the labels' translation keys are checked against. */
export const BATTLE_MUSIC_TRACKS = [
  showdown("dpp-trainer", 13440, 96959),
  showdown("dpp-rival", 13888, 66352),
  showdown("hgss-johto-trainer", 23731, 125086),
  showdown("hgss-kanto-trainer", 13003, 94656),
  showdown("bw-trainer", 14629, 110109),
  showdown("bw-rival", 19180, 57373),
  showdown("bw-subway-trainer", 15503, 110984),
  showdown("bw2-kanto-gym-leader", 14626, 58986),
  showdown("bw2-rival", 7152, 68708),
  showdown("xy-trainer", 7802, 82469),
  showdown("xy-rival", 7802, 58634),
  pokerogue("xy-gym", "battle_kalos_gym", 44810, 147208),
  pokerogue("xy-elite", "battle_kalos_elite", 12340, 139009),
  pokerogue("xy-champion", "battle_kalos_champion", 10380, 88219),
  showdown("oras-trainer", 13579, 91548),
  showdown("oras-rival", 14303, 69149),
  showdown("sm-trainer", 8323, 89230),
  showdown("sm-rival", 11389, 62158),
  pokerogue("sm-elite", "battle_alola_elite", 19212, 67208),
  pokerogue("usum-champion", "battle_alola_champion", 13025, 100081),
  pokerogue("swsh-champion", "battle_galar_champion", 61635, 184524),
  pokerogue("sv-gym", "battle_paldea_gym", 127489, 163470),
  pokerogue("sv-elite", "battle_paldea_elite", 12770, 103466),
  pokerogue("sv-geeta", "battle_champion_geeta", 37447, 113084),
  pokerogue("sv-nemona", "battle_champion_nemona", 14914, 90853),
  pokerogue("sv-kieran", "battle_champion_kieran", 7206, 104000),
] as const;

export type BattleMusicTrack = (typeof BATTLE_MUSIC_TRACKS)[number];

/** The menus' theme, looped whole. */
export const MENU_MUSIC_TRACK = pokerogue("menu", "menu", 0, 91437);
