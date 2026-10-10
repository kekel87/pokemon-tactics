/**
 * Sound bundle build (plan 238, sound lot 3).
 *
 * Downloads into `assets-src/audio/` (gitignored source/cache, like the sprites and the effects):
 *   - PokeRogue's move animations (`battle-anims/<move>.json`) for every playable move, of which
 *     ONLY the timed sound events are kept (sound name, frame, volume, pitch) — the AGPL JSON
 *     itself is never shipped;
 *   - the move sounds they cite (`audio/battle_anims/`, mostly Pokémon Reborn's PRSFX rips);
 *   - the three hit sounds (`audio/se/hit*.wav`);
 *   - the roster's cries from PokeAPI/cries (`latest`: the current games' cries, by dex number).
 *
 * Each sound is peak-normalised and encoded as its own small mono mp3 (see `encodingOf`), then
 * concatenated into ONE shipped file, `packages/app/public/assets/audio/sounds.bin`, indexed by
 * `sounds-manifest.json` (byte range and duration of each sound, timed sounds of each move). Two files in
 * the build whatever the number of sounds (itch.io's 1000-file wall, decision-1138). No audio
 * sprite: decoding 13 minutes of audio in one block costs ~150 MB of RAM, and mp3 encoder padding
 * shifts sprite offsets differently in each browser — each sound is decoded on demand instead.
 *
 * Usage: pnpm build-audio (re-downloads and re-encodes only what is missing from the cache)
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { tacticalOverrides } from "../packages/data/src/overrides/tactical.js";
import { playablePokemon } from "../packages/data/src/playable/playable-pokemon.js";

const ROOT_DIR = resolve(import.meta.dirname, "..");
const CACHE_DIR = join(ROOT_DIR, "assets-src/audio");
const ANIMS_DIR = join(CACHE_DIR, "pokerogue/battle-anims");
const RAW_DIR = join(CACHE_DIR, "raw");
const ENCODED_DIR = join(CACHE_DIR, "encoded");
const BUNDLE_DIR = join(ROOT_DIR, "packages/app/public/assets/audio");
const POKEROGUE_URL = "https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta";
/** The cries of the current games (PokeAPI/cries `latest`), by national dex number. */
const POKEAPI_CRIES_URL =
  "https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest";
const REFERENCE_POKEMON_PATH = join(ROOT_DIR, "packages/data/reference/pokemon.json");
/** PokeRogue plays its animations at one frame per 3 ticks of 60 Hz. */
const POKEROGUE_FRAME_MS = 50;
const DOWNLOAD_CONCURRENCY = 8;
const PEAK_TARGET_DB = -1;

/** Hit sound key → PokeRogue `audio/se/` file. */
const HIT_SOURCES = {
  normal: "hit.wav",
  strong: "hit_strong.wav",
  weak: "hit_weak.wav",
} as const;

/**
 * Sounds of the effects our own animations play (a heal's bubbles, a status biting, Vampigraine's
 * drain): effect key → PokeRogue common animation. The runtime plays them on the effect's cue, so
 * they land with OUR visuals, not PokeRogue's.
 */
const EFFECT_ANIMS: Readonly<Record<string, string>> = {
  heal: "common-health-up",
  drain: "common-leech-seed",
  shield: "common-protect",
  "status:poisoned": "common-poison",
  "status:badly_poisoned": "common-toxic",
  "status:burned": "common-burn",
  "status:paralyzed": "common-paralysis",
  "status:asleep": "common-sleep",
  "status:frozen": "common-frozen",
  "status:confused": "common-confusion",
  "status:infatuated": "common-attract",
};

/** Effect key → PokeRogue `audio/se/` file, for the effects that are one plain sound. */
const EFFECT_SOUNDS: Readonly<Record<string, string>> = {
  "stat-up": "stat_up.wav",
  "stat-down": "stat_down.wav",
};

/**
 * Moves PokeRogue animates without any sound (or does not animate at all), given the sounds of a
 * kindred move — our choice, not PokeRogue's. Repos is not here: the heal and the sleep it brings
 * have their own effect sounds. The vocal moves (Rugissement…) are not either: the runtime gives
 * them their user's cry.
 */
const MOVE_SOUND_BORROWS: Readonly<Record<string, string>> = {
  snowscape: "hail",
  "grassy-glide": "trailblaze",
  "nature-power": "growth",
  "dragon-cheer": "helping-hand",
  "mirror-move": "mimic",
  copycat: "role-play",
};

interface PokeRogueSoundEvent {
  eventType: string;
  resourceName: string;
  volume: number;
  pitch: number;
}

interface PokeRogueAnim {
  frameTimedEvents?: Record<string, PokeRogueSoundEvent[]>;
}

/** The manifest's form of a move's timed sound: `[atMs, soundId, volume, rate]`. */
type MoveSoundEvent = [atMs: number, soundId: string, volume: number, rate: number];

async function download(url: string, file: string): Promise<boolean> {
  if (existsSync(file)) {
    return true;
  }
  const response = await fetch(url);
  if (response.status === 404) {
    return false;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  return true;
}

async function inBatches<T>(items: readonly T[], task: (item: T) => Promise<void>): Promise<void> {
  for (let index = 0; index < items.length; index += DOWNLOAD_CONCURRENCY) {
    await Promise.all(items.slice(index, index + DOWNLOAD_CONCURRENCY).map(task));
  }
}

/** Raw cache file name of a PokeRogue sound (names carry spaces). */
function rawFileOf(resourceName: string): string {
  return join(RAW_DIR, "battle_anims", resourceName);
}

/** PokeRogue resolves an extension-less resource name to its `.m4a`, then its `.wav`. */
async function downloadMoveSound(resourceName: string): Promise<string | null> {
  const candidates =
    extname(resourceName) === "" ? [`${resourceName}.m4a`, `${resourceName}.wav`] : [resourceName];
  for (const candidate of candidates) {
    const url = `${POKEROGUE_URL}/audio/battle_anims/${encodeURIComponent(candidate)}`;
    if (await download(url, rawFileOf(candidate))) {
      return candidate;
    }
  }
  return null;
}

function soundEventsOf(anim: PokeRogueAnim | PokeRogueAnim[]): MoveSoundEvent[] {
  // Some moves ship one variant per side (player / opponent): the first one is the player's.
  const variant = Array.isArray(anim) ? anim[0] : anim;
  const events: MoveSoundEvent[] = [];
  for (const [frame, frameEvents] of Object.entries(variant?.frameTimedEvents ?? {})) {
    for (const event of frameEvents) {
      if (event.eventType === "AnimTimedSoundEvent" && event.resourceName !== "") {
        events.push([
          Number(frame) * POKEROGUE_FRAME_MS,
          `move:${event.resourceName}`,
          event.volume / 100,
          event.pitch / 100,
        ]);
      }
    }
  }
  return events.sort((a, b) => a[0] - b[0]);
}

/**
 * Encoding by sound family. Move sounds are 8-bit 12 kHz sources: more than 24 kHz / 48 kbps buys
 * nothing. Hits and cries are full-band recordings of the games: kept at 44.1 kHz, or they come out
 * muffled (the first playtest heard Dracaufeu's cry as not quite his own).
 */
function encodingOf(soundId: string): { sampleRate: string; bitrate: string } {
  return soundId.startsWith("move:")
    ? { sampleRate: "24000", bitrate: "48k" }
    : { sampleRate: "44100", bitrate: "96k" };
}

/** A sound's length in ms, rounded up — what the runtime waits on before moving on. */
function durationMs(file: string): number {
  const output = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  ).stdout;
  return Math.ceil(Number(output) * 1000);
}

function encode(sourceFile: string, soundId: string): string {
  const { sampleRate, bitrate } = encodingOf(soundId);
  const encodedFile = join(
    ENCODED_DIR,
    `${soundId.replace(/[^a-zA-Z0-9-]/g, "_")}-${sampleRate}-${bitrate}.mp3`,
  );
  if (existsSync(encodedFile)) {
    return encodedFile;
  }
  // volumedetect reports on stderr.
  const detection = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", sourceFile, "-af", "volumedetect", "-f", "null", "-"],
    { encoding: "utf8" },
  ).stderr;
  const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(detection)?.[1] ?? 0);
  const gain = PEAK_TARGET_DB - peak;
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      sourceFile,
      "-af",
      `volume=${gain.toFixed(2)}dB`,
      "-ac",
      "1",
      "-ar",
      sampleRate,
      "-b:a",
      bitrate,
      "-codec:a",
      "libmp3lame",
      encodedFile,
    ],
    { stdio: "inherit" },
  );
  return encodedFile;
}

async function main(): Promise<void> {
  for (const directory of [
    ANIMS_DIR,
    join(RAW_DIR, "battle_anims"),
    join(RAW_DIR, "se"),
    join(RAW_DIR, "cries"),
    ENCODED_DIR,
    BUNDLE_DIR,
  ]) {
    mkdirSync(directory, { recursive: true });
  }

  const moveIds = Object.keys(tacticalOverrides).sort();
  const moveEvents: Record<string, MoveSoundEvent[]> = {};
  const missingAnims: string[] = [];
  await inBatches(moveIds, async (moveId) => {
    const file = join(ANIMS_DIR, `${moveId}.json`);
    if (!(await download(`${POKEROGUE_URL}/battle-anims/${moveId}.json`, file))) {
      missingAnims.push(moveId);
      return;
    }
    const events = soundEventsOf(JSON.parse(readFileSync(file, "utf8")));
    if (events.length > 0) {
      moveEvents[moveId] = events;
    }
  });

  for (const [moveId, donorId] of Object.entries(MOVE_SOUND_BORROWS)) {
    const donorEvents = moveEvents[donorId];
    if (moveEvents[moveId] !== undefined || donorEvents === undefined) {
      throw new Error(
        `Sound borrow ${moveId} ← ${donorId}: the move has sounds, or the donor none`,
      );
    }
    moveEvents[moveId] = donorEvents;
  }

  const effectEvents: Record<string, MoveSoundEvent[]> = {};
  await inBatches(Object.entries(EFFECT_ANIMS), async ([effect, anim]) => {
    const file = join(ANIMS_DIR, `${anim}.json`);
    if (!(await download(`${POKEROGUE_URL}/battle-anims/${anim}.json`, file))) {
      throw new Error(`Effect animation not found in PokeRogue: ${anim}`);
    }
    effectEvents[effect] = soundEventsOf(JSON.parse(readFileSync(file, "utf8")));
  });

  // Sound id → its source file; ids are what the manifest and the runtime speak.
  const sources = new Map<string, string>();
  await inBatches(Object.entries(EFFECT_SOUNDS), async ([effect, file]) => {
    const raw = join(RAW_DIR, "se", file);
    if (!(await download(`${POKEROGUE_URL}/audio/se/${file}`, raw))) {
      throw new Error(`Effect sound not found in PokeRogue: ${file}`);
    }
    sources.set(`effect:${effect}`, raw);
    effectEvents[effect] = [[0, `effect:${effect}`, 1, 1]];
  });
  const soundIds = [
    ...new Set(
      [...Object.values(moveEvents), ...Object.values(effectEvents)]
        .flat()
        .map((event) => event[1])
        .filter((soundId) => soundId.startsWith("move:")),
    ),
  ];
  await inBatches(soundIds, async (soundId) => {
    const resourceName = soundId.slice("move:".length);
    const resolved = await downloadMoveSound(resourceName);
    if (resolved === null) {
      throw new Error(`Move sound not found in PokeRogue: ${resourceName}`);
    }
    sources.set(soundId, rawFileOf(resolved));
  });
  await inBatches(Object.entries(HIT_SOURCES), async ([key, file]) => {
    const raw = join(RAW_DIR, "se", file);
    if (!(await download(`${POKEROGUE_URL}/audio/se/${file}`, raw))) {
      throw new Error(`Hit sound not found in PokeRogue: ${file}`);
    }
    sources.set(`hit:${key}`, raw);
  });
  const dexNumbers = new Map(
    (
      JSON.parse(readFileSync(REFERENCE_POKEMON_PATH, "utf8")) as {
        id: string;
        dexNumber: number;
      }[]
    ).map((pokemon) => [pokemon.id, pokemon.dexNumber]),
  );
  const missingCries: string[] = [];
  await inBatches(playablePokemon, async ({ id }) => {
    const dexNumber = dexNumbers.get(id);
    const raw = join(RAW_DIR, "cries", `${id}.ogg`);
    if (dexNumber !== undefined && (await download(`${POKEAPI_CRIES_URL}/${dexNumber}.ogg`, raw))) {
      sources.set(`cry:${id}`, raw);
    } else {
      missingCries.push(id);
    }
  });

  const chunks: Buffer[] = [];
  const sounds: Record<string, [number, number, number]> = {};
  let offset = 0;
  for (const [soundId, sourceFile] of [...sources].sort(([a], [b]) => a.localeCompare(b))) {
    const encodedFile = encode(sourceFile, soundId);
    const bytes = readFileSync(encodedFile);
    sounds[soundId] = [offset, bytes.length, durationMs(encodedFile)];
    chunks.push(bytes);
    offset += bytes.length;
  }

  const moves = Object.fromEntries(
    Object.entries(moveEvents).sort(([a], [b]) => a.localeCompare(b)),
  );

  writeFileSync(join(BUNDLE_DIR, "sounds.bin"), Buffer.concat(chunks));
  const effects = Object.fromEntries(
    Object.entries(effectEvents).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(
    join(BUNDLE_DIR, "sounds-manifest.json"),
    `${JSON.stringify({ sounds, moves, effects })}\n`,
  );

  console.log(
    `${Object.keys(sounds).length} sounds, ${(offset / 1024 / 1024).toFixed(2)} MB — ` +
      `${Object.keys(moves).length}/${moveIds.length} moves with sounds` +
      (missingAnims.length > 0 ? `, no PokeRogue anim: ${missingAnims.sort().join(", ")}` : "") +
      (missingCries.length > 0 ? `, no PokeAPI cry: ${missingCries.sort().join(", ")}` : ""),
  );
}

await main();
