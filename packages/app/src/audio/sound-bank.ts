/**
 * The sound bundle (plan 238): `sounds.bin` (every sound a small mp3 of its own, concatenated) and
 * `sounds-manifest.json` (byte ranges, and each move's timed sound events), built by
 * `pnpm build-audio`. Fetched once, on the first sound asked for — never at boot, so the splash
 * screen does not wait on audio (a battle preloads it as it mounts) — then each sound is decoded on demand and kept.
 *
 * Sound ids: `move:<PokeRogue sound name>`, `hit:normal|strong|weak`, `cry:<species id>`.
 */

const BUNDLE_PATH = "assets/audio";

/** One timed sound of a move: `[atMs, soundId, volume, rate]`, `atMs` from the attack's start. */
export type MoveSoundEvent = readonly [atMs: number, soundId: string, volume: number, rate: number];

interface SoundManifest {
  sounds: Record<string, readonly [offset: number, length: number, durationMs: number]>;
  moves: Record<string, readonly MoveSoundEvent[]>;
  /** Timed sounds of our own effects (a heal, a status biting…), by effect key. */
  effects: Record<string, readonly MoveSoundEvent[]>;
}

interface LoadedBundle {
  manifest: SoundManifest;
  bin: ArrayBuffer;
}

let bundle: Promise<LoadedBundle | null> | null = null;
const decoded = new Map<string, Promise<AudioBuffer | null>>();

/** Start fetching the bundle ahead of the first sound (a battle about to start). Idempotent. */
export function preloadSoundBundle(): void {
  void loadBundle();
}

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: ${response.status}`);
  }
  return response;
}

function loadBundle(): Promise<LoadedBundle | null> {
  bundle ??= Promise.all([
    fetchOk(`${BUNDLE_PATH}/sounds-manifest.json`).then(
      (response) => response.json() as Promise<SoundManifest>,
    ),
    fetchOk(`${BUNDLE_PATH}/sounds.bin`).then((response) => response.arrayBuffer()),
  ])
    .then(([manifest, bin]) => ({ manifest, bin }))
    // No sound is not worth a broken game: the bundle failing to load just leaves it silent.
    .catch(() => null);
  return bundle;
}

/** The timed sounds of a move, empty when it has none. */
export async function moveSoundEvents(moveId: string): Promise<readonly MoveSoundEvent[]> {
  return (await loadBundle())?.manifest.moves[moveId] ?? [];
}

/** The timed sounds of one of our effects (`heal`, `drain`, `status:poisoned`…), empty when none. */
export async function effectSoundEvents(effect: string): Promise<readonly MoveSoundEvent[]> {
  return (await loadBundle())?.manifest.effects[effect] ?? [];
}

/** How long a sound lasts at its recorded rate, in ms — 0 when the bundle has no such sound. */
export async function soundDurationMs(soundId: string): Promise<number> {
  return (await loadBundle())?.manifest.sounds[soundId]?.[2] ?? 0;
}

/** The decoded sound, or null when the bundle has no such sound (a species without a cry). */
export function decodeSound(
  context: BaseAudioContext,
  soundId: string,
): Promise<AudioBuffer | null> {
  let sound = decoded.get(soundId);
  if (sound === undefined) {
    sound = loadBundle().then((loaded) => {
      const range = loaded?.manifest.sounds[soundId];
      if (loaded === null || range === undefined) {
        return null;
      }
      // `decodeAudioData` detaches the buffer it is handed: decode a copy of the slice.
      return (
        context
          .decodeAudioData(loaded.bin.slice(range[0], range[0] + range[1]))
          // An undecodable sound is a silent one, like a missing bundle.
          .catch(() => null)
      );
    });
    decoded.set(soundId, sound);
  }
  return sound;
}
