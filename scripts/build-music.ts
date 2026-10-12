/**
 * Battle music build (plan 239).
 *
 * Downloads the tracks of `music-track-table.ts` into `assets-src/audio/music/` (gitignored
 * source/cache, like the sounds), and writes one mp3 per track into
 * `packages/app/public/assets/audio/music/` — a file each rather than a bundle: the game fetches
 * only the track it plays.
 *
 * Each track is cut at its loop end and given a short tail, a copy of what follows its loop start:
 * what the loop would play next. The tail is never heard as such, but it keeps the loop seamless
 * when a decoder shifts the audio by its encoder delay, or when the source loops at its very end.
 * Tracks are brought to one loudness by a constant gain — a medley must not jump in level from a
 * track to the next — and encoded in stereo.
 *
 * Usage: pnpm build-music (re-downloads and re-encodes only what is missing)
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  BATTLE_MUSIC_TRACKS,
  MENU_MUSIC_TRACKS,
  type MusicTrack,
} from "../packages/app/src/audio/music-track-table.js";

const ROOT_DIR = resolve(import.meta.dirname, "..");
const CACHE_DIR = join(ROOT_DIR, "assets-src/audio/music");
const OUTPUT_DIR = join(ROOT_DIR, "packages/app/public/assets/audio/music");
const LOUDNESS_TARGET_LUFS = -16;
const PEAK_CEILING_DB = -1.5;
/** Length of the tail copied from the loop start, in seconds. */
const TAIL_SECONDS = 0.5;
const BITRATE = "96k";
const SAMPLE_RATE = "44100";
/** What each shipped file was cut and encoded from: a track whose recipe changed is redone. */
const RECIPES_FILE = join(CACHE_DIR, "encoded-recipes.json");

async function download(url: string, file: string): Promise<void> {
  if (existsSync(file)) {
    return;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}

/** The constant gain that brings a track to the target loudness without clipping, in dB. */
function gainOf(sourceFile: string): number {
  // loudnorm reports its measures on stderr, as a JSON block among the log lines.
  const report = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", sourceFile, "-af", "loudnorm=print_format=json", "-f", "null", "-"],
    { encoding: "utf8" },
  ).stderr;
  const block = /\{[^{}]*\}/.exec(report)?.[0];
  if (block === undefined) {
    throw new Error(`No loudness report for ${sourceFile}`);
  }
  const measures = JSON.parse(block) as { input_i: string; input_tp: string };
  return Math.min(
    LOUDNESS_TARGET_LUFS - Number(measures.input_i),
    PEAK_CEILING_DB - Number(measures.input_tp),
  );
}

async function main(): Promise<void> {
  mkdirSync(CACHE_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  let totalBytes = 0;
  const tracks: readonly MusicTrack[] = [...BATTLE_MUSIC_TRACKS, ...MENU_MUSIC_TRACKS];
  const recipes: Record<string, string> = existsSync(RECIPES_FILE)
    ? JSON.parse(readFileSync(RECIPES_FILE, "utf8"))
    : {};
  for (const track of tracks) {
    const sourceFile = join(CACHE_DIR, `${track.id}.mp3`);
    const outputFile = join(OUTPUT_DIR, `${track.id}.mp3`);
    await download(track.sourceUrl, sourceFile);
    const recipe = [
      track.sourceUrl,
      track.loopStartMs,
      track.loopEndMs,
      track.restartAtMs ?? "loop",
      TAIL_SECONDS,
      LOUDNESS_TARGET_LUFS,
      PEAK_CEILING_DB,
      BITRATE,
      SAMPLE_RATE,
    ].join("|");
    if (!existsSync(outputFile) || recipes[track.id] !== recipe) {
      const loopStart = (track.loopStartMs / 1000).toFixed(3);
      const loopEnd = (track.loopEndMs / 1000).toFixed(3);
      execFileSync(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          sourceFile,
          "-filter_complex",
          // An album track is kept whole: the game restarts it with a crossfade, it has no loop.
          track.restartAtMs === undefined
            ? `[0:a]volume=${gainOf(sourceFile).toFixed(2)}dB,asplit[whole][again];` +
              `[whole]atrim=end=${loopEnd}[body];` +
              `[again]atrim=start=${loopStart}:duration=${TAIL_SECONDS},asetpts=PTS-STARTPTS[tail];` +
              "[body][tail]concat=n=2:v=0:a=1"
            : `[0:a]volume=${gainOf(sourceFile).toFixed(2)}dB`,
          "-ac",
          "2",
          "-ar",
          SAMPLE_RATE,
          "-b:a",
          BITRATE,
          "-codec:a",
          "libmp3lame",
          outputFile,
        ],
        { stdio: "inherit" },
      );
      recipes[track.id] = recipe;
      writeFileSync(RECIPES_FILE, `${JSON.stringify(recipes, null, 2)}\n`);
    }
    totalBytes += statSync(outputFile).size;
  }
  console.log(`${tracks.length} tracks, ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
}

await main();
