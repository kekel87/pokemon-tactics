import { StatusType } from "@pokemon-tactic/core";
import {
  MoveEffectForm,
  type PresentationCue,
  PresentationCueKind,
} from "@pokemon-tactic/render-ports";
import { CombatSpeed, combatClock, setCombatSpeed } from "@pokemon-tactic/view-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSettings, TurnCries } from "../settings";
import { isAudioSilent, prepareSound } from "./audio-player";
import {
  ATTACK_SOUND_FADE_MS,
  ATTACK_SOUND_MAX_MS,
  type BattleAudio,
  BORROWED_CRY_VOLUME,
  CROWDED_HIT_VOLUME,
  createBattleAudio,
  FAINT_CRY_WAIT_MAX_MS,
  HIT_RATE_JITTER,
  HIT_STAGGER_MS,
  hitSound,
  TURN_CRY_DELAY_MS,
  TURN_CRY_VOLUME,
} from "./battle-audio";
import { preloadSoundBundle } from "./sound-bank";

const bank = vi.hoisted(() => ({
  moves: {} as Record<string, readonly (readonly [number, string, number, number])[]>,
  effects: {} as Record<string, readonly (readonly [number, string, number, number])[]>,
  durations: {} as Record<string, number>,
}));

const voices = vi.hoisted(() => ({ play: vi.fn(), dispose: vi.fn() }));

vi.mock("./audio-player", () => ({
  initAudio: vi.fn(),
  setMasterVolume: vi.fn(),
  isAudioSilent: vi.fn(() => false),
  prepareSound: vi.fn(),
}));

vi.mock("./sound-bank", () => ({
  preloadSoundBundle: vi.fn(),
  moveSoundEvents: async (moveId: string) => bank.moves[moveId] ?? [],
  effectSoundEvents: async (effect: string) => bank.effects[effect] ?? [],
  soundDurationMs: async (soundId: string) => bank.durations[soundId] ?? 0,
}));

vi.mock("./combat-voices", () => ({ createCombatVoices: () => voices }));

vi.mock("../settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../settings")>()),
  getSettings: vi.fn(),
}));

const ATTACKER_ID = "p1-raichu";
const TARGET_ID = "p2-bulbasaur";
const MOVE_ID = "thunderbolt";

const SPECIES: Record<string, string> = { [ATTACKER_ID]: "raichu", [TARGET_ID]: "bulbasaur" };

const ATTACK_START: PresentationCue = {
  kind: PresentationCueKind.AttackStart,
  attackerId: ATTACKER_ID,
  moveId: MOVE_ID,
};

const ATTACK_END: PresentationCue = {
  kind: PresentationCueKind.AttackEnd,
  attackerId: ATTACKER_ID,
  moveId: MOVE_ID,
};

const FAINT: PresentationCue = { kind: PresentationCueKind.Faint, pokemonId: TARGET_ID };

const hit = (effectiveness: number, rankOnBeat = 0, critical = false): PresentationCue => ({
  kind: PresentationCueKind.Hit,
  targetId: TARGET_ID,
  effectiveness,
  critical,
  rankOnBeat,
});

const turnStart = (local: boolean): PresentationCue => ({
  kind: PresentationCueKind.TurnStart,
  pokemonId: ATTACKER_ID,
  local,
});

const effect = (form: MoveEffectForm, status?: StatusType): PresentationCue => ({
  kind: PresentationCueKind.Effect,
  form,
  durationMs: 300,
  impactMs: 100,
  ...(status === undefined ? {} : { status }),
});

describe("hitSound", () => {
  it("is silent on an immune target, critical or not", () => {
    expect(hitSound(0, false)).toBeNull();
    expect(hitSound(0, true)).toBeNull();
  });

  it.each([
    [4, { soundId: "hit:strong", rate: 1.12, volume: 1 }],
    [2, { soundId: "hit:strong", rate: 1, volume: 1 }],
    [1, { soundId: "hit:normal", rate: 1, volume: 1 }],
    [0.5, { soundId: "hit:weak", rate: 1, volume: 1 }],
    [0.25, { soundId: "hit:weak", rate: 0.85, volume: 0.7 }],
  ])("grades a non-critical blow at ×%s", (effectiveness, expected) => {
    expect(hitSound(effectiveness, false)).toEqual(expected);
  });

  it.each([1, 0.5, 0.25])("plays the strong hit on a critical at ×%s", (effectiveness) => {
    expect(hitSound(effectiveness, true)).toEqual({ soundId: "hit:strong", rate: 1, volume: 1 });
  });
});

describe("createBattleAudio", () => {
  let driver: symbol;
  let audio: BattleAudio;
  let isSoundMove: boolean;

  const flush = async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(0);
  };

  const advance = async (durationMs: number): Promise<void> => {
    await flush();
    combatClock.frame(driver, durationMs);
    await flush();
  };

  const mount = (turnCries = true): void => {
    audio = createBattleAudio({
      speciesOf: (pokemonId) => SPECIES[pokemonId],
      isSoundMove: () => isSoundMove,
      turnCries,
    });
  };

  const setTurnCries = (turnCries: TurnCries): void => {
    vi.mocked(getSettings).mockReturnValue({ turnCries } as ReturnType<typeof getSettings>);
  };

  const watchSettled = (): { done: boolean } => {
    const watch = { done: false };
    void audio.settled().then(() => {
      watch.done = true;
    });
    return watch;
  };

  const expectSettlesAt = async (durationMs: number): Promise<void> => {
    const watch = watchSettled();
    await advance(durationMs - 1);
    expect(watch.done).toBe(false);

    await advance(1);
    expect(watch.done).toBe(true);
  };

  const advanceThroughRanks = async (lastRank: number): Promise<void> => {
    await advance(0);
    for (let rank = 0; rank < lastRank; rank++) {
      await advance(HIT_STAGGER_MS);
    }
  };

  beforeEach(() => {
    bank.moves = {};
    bank.effects = {};
    bank.durations = {};
    isSoundMove = false;
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(isAudioSilent).mockReturnValue(false);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    setTurnCries(TurnCries.Mine);
    setCombatSpeed(CombatSpeed.Normal);
    driver = combatClock.attach();
    mount();
  });

  afterEach(() => {
    combatClock.detach(driver);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("preloads the bundle and prepares the three hit sounds as it mounts", () => {
    expect(preloadSoundBundle).toHaveBeenCalledTimes(1);
    expect(prepareSound).toHaveBeenCalledWith("hit:normal");
    expect(prepareSound).toHaveBeenCalledWith("hit:strong");
    expect(prepareSound).toHaveBeenCalledWith("hit:weak");
  });

  it("plays the hit sound of a blow", async () => {
    audio.onCue(hit(2));
    await advance(0);

    expect(voices.play.mock.calls).toEqual([["hit:strong", { rate: 1, volume: 1 }]]);
  });

  it("varies a hit's rate within its jitter", async () => {
    vi.mocked(Math.random).mockReturnValue(1);
    audio.onCue(hit(1));
    await advance(0);

    expect(voices.play.mock.calls[0]?.[1].rate).toBeCloseTo(1 + HIT_RATE_JITTER);
  });

  it("plays nothing on an immune target", async () => {
    audio.onCue(hit(0));
    await advance(100);

    expect(voices.play).not.toHaveBeenCalled();
  });

  it("plays nothing while the audio is silent", async () => {
    vi.mocked(isAudioSilent).mockReturnValue(true);
    bank.moves[MOVE_ID] = [[0, "move:zap", 1, 1]];

    audio.onCue(ATTACK_START);
    audio.onCue(hit(2));
    audio.onCue(FAINT);
    await advance(100);

    expect(voices.play).not.toHaveBeenCalled();
  });

  it("spreads the blows of an area attack by their rank on the beat", async () => {
    audio.onCue(hit(1, 0));
    audio.onCue(hit(1, 2));
    await advance(0);
    expect(voices.play).toHaveBeenCalledTimes(1);

    await advance(2 * HIT_STAGGER_MS - 1);
    expect(voices.play).toHaveBeenCalledTimes(1);

    await advance(1);
    expect(voices.play).toHaveBeenCalledTimes(2);
  });

  it("quietens the third copy of a hit sound and drops the fourth", async () => {
    for (const rank of [0, 1, 2, 3]) {
      audio.onCue(hit(1, rank));
    }
    await advanceThroughRanks(3);

    expect(voices.play.mock.calls.map(([, options]) => options.volume)).toEqual([
      1,
      1,
      CROWDED_HIT_VOLUME,
    ]);
  });

  it("counts the copies per sound: a different hit sound is not crowded out", async () => {
    for (const rank of [0, 1, 2]) {
      audio.onCue(hit(1, rank));
    }
    audio.onCue(hit(2, 3));
    await advanceThroughRanks(3);

    expect(voices.play.mock.calls.at(-1)).toEqual(["hit:strong", { rate: 1, volume: 1 }]);
  });

  it("plays a move's sounds at their instants, each capped at the attack's ceiling", async () => {
    bank.moves[MOVE_ID] = [
      [0, "move:zap", 0.8, 1],
      [300, "move:crackle", 1, 2],
    ];

    audio.onCue(ATTACK_START);
    await advance(0);
    expect(voices.play.mock.calls).toEqual([
      [
        "move:zap",
        {
          volume: 0.8,
          rate: 1,
          maxDurationMs: ATTACK_SOUND_MAX_MS,
          fadeOutMs: ATTACK_SOUND_FADE_MS,
        },
      ],
    ]);

    await advance(299);
    expect(voices.play).toHaveBeenCalledTimes(1);

    await advance(1);
    expect(voices.play.mock.calls[1]).toEqual([
      "move:crackle",
      {
        volume: 1,
        rate: 2,
        maxDurationMs: ATTACK_SOUND_MAX_MS - 300,
        fadeOutMs: ATTACK_SOUND_FADE_MS,
      },
    ]);
  });

  it("prepares a move's sounds ahead of their instants", async () => {
    bank.moves[MOVE_ID] = [[500, "move:zap", 1, 1]];

    audio.onCue(ATTACK_START);
    await advance(0);

    expect(prepareSound).toHaveBeenCalledWith("move:zap");
    expect(voices.play).not.toHaveBeenCalled();
  });

  it("never plays a sound timed at or past the attack's ceiling", async () => {
    bank.moves[MOVE_ID] = [[ATTACK_SOUND_MAX_MS, "move:late", 1, 1]];

    audio.onCue(ATTACK_START);
    await advance(ATTACK_SOUND_MAX_MS + 1000);

    expect(voices.play).not.toHaveBeenCalled();
  });

  it("lends the user's cry to a sound-based move with no sound of its own", async () => {
    isSoundMove = true;

    audio.onCue(ATTACK_START);
    await advance(0);

    expect(voices.play.mock.calls).toEqual([["cry:raichu", { volume: BORROWED_CRY_VOLUME }]]);
  });

  it("stays silent on a move with no sound that is not sound-based", async () => {
    audio.onCue(ATTACK_START);
    await advance(100);

    expect(voices.play).not.toHaveBeenCalled();
  });

  it("plays the species' cry at full volume on a faint", () => {
    audio.onCue(FAINT);

    expect(voices.play.mock.calls).toEqual([["cry:bulbasaur", { volume: 1 }]]);
  });

  it("plays no cry for a Pokémon whose species is unknown", async () => {
    audio.onCue({ kind: PresentationCueKind.Faint, pokemonId: "ghost" });
    audio.onCue({ kind: PresentationCueKind.TurnStart, pokemonId: "ghost", local: true });
    await advance(TURN_CRY_DELAY_MS);

    expect(voices.play).not.toHaveBeenCalled();
  });

  it("plays the turn's cry once the camera has had its beat, quieter", async () => {
    audio.onCue(turnStart(true));
    await advance(TURN_CRY_DELAY_MS - 1);
    expect(voices.play).not.toHaveBeenCalled();

    await advance(1);
    expect(voices.play.mock.calls).toEqual([["cry:raichu", { volume: TURN_CRY_VOLUME }]]);
  });

  it.each([
    [TurnCries.None, true, false],
    [TurnCries.None, false, false],
    [TurnCries.Mine, true, true],
    [TurnCries.Mine, false, false],
    [TurnCries.All, true, true],
    [TurnCries.All, false, true],
  ])("with turn cries on « %s », a turn that is local=%s cries=%s", async (mode, local, cries) => {
    setTurnCries(mode);

    audio.onCue(turnStart(local));
    await advance(TURN_CRY_DELAY_MS);

    expect(voices.play).toHaveBeenCalledTimes(cries ? 1 : 0);
  });

  it("plays no turn cry where turn cries have no place, whatever the setting", async () => {
    setTurnCries(TurnCries.All);
    mount(false);

    audio.onCue(turnStart(true));
    await advance(TURN_CRY_DELAY_MS);

    expect(voices.play).not.toHaveBeenCalled();
  });

  it("keeps only the hit sounds in Instant", async () => {
    setCombatSpeed(CombatSpeed.Instant);
    setTurnCries(TurnCries.All);
    isSoundMove = true;
    bank.moves[MOVE_ID] = [[0, "move:zap", 1, 1]];
    bank.effects.heal = [[0, "effect:heal", 1, 1]];

    audio.onCue(turnStart(true));
    audio.onCue(ATTACK_START);
    audio.onCue(effect(MoveEffectForm.Heal));
    audio.onCue(hit(2));
    audio.onCue(ATTACK_END);
    audio.onCue(FAINT);
    await advance(1000);

    expect(voices.play.mock.calls).toEqual([["hit:strong", { rate: 1, volume: 1 }]]);
  });

  it("plays the sounds of an effect at their instants", async () => {
    bank.effects.heal = [[120, "effect:heal", 0.9, 1]];

    audio.onCue(effect(MoveEffectForm.Heal));
    await advance(119);
    expect(voices.play).not.toHaveBeenCalled();

    await advance(1);
    expect(voices.play.mock.calls).toEqual([["effect:heal", { volume: 0.9, rate: 1 }]]);
  });

  it("plays the sound of the status a status effect shows", async () => {
    bank.effects[`status:${StatusType.Poisoned}`] = [[0, "effect:poison", 1, 1]];

    audio.onCue(effect(MoveEffectForm.Status, StatusType.Poisoned));
    await advance(0);

    expect(voices.play.mock.calls).toEqual([["effect:poison", { volume: 1, rate: 1 }]]);
  });

  it("plays nothing for an effect with no sound of its own", async () => {
    bank.effects.heal = [[0, "effect:heal", 1, 1]];

    audio.onCue(effect(MoveEffectForm.Projectile));
    audio.onCue(effect(MoveEffectForm.Status));
    await advance(100);

    expect(voices.play).not.toHaveBeenCalled();
  });

  it("mutes the drain an attack shows: the attack's own sounds cover it", async () => {
    bank.effects.drain = [[0, "effect:drain", 1, 1]];

    audio.onCue(ATTACK_START);
    audio.onCue(effect(MoveEffectForm.Drain));
    await advance(100);

    expect(voices.play).not.toHaveBeenCalled();
  });

  it("still plays another effect's sound during an attack", async () => {
    bank.effects.heal = [[0, "effect:heal", 1, 1]];

    audio.onCue(ATTACK_START);
    audio.onCue(effect(MoveEffectForm.Heal));
    await advance(0);

    expect(voices.play.mock.calls).toEqual([["effect:heal", { volume: 1, rate: 1 }]]);
  });

  it("plays the drain of a Vampigraine tick, outside any attack", async () => {
    bank.effects.drain = [[0, "effect:drain", 1, 1]];

    audio.onCue(ATTACK_START);
    audio.onCue(ATTACK_END);
    audio.onCue(effect(MoveEffectForm.Drain));
    await advance(0);

    expect(voices.play.mock.calls).toEqual([["effect:drain", { volume: 1, rate: 1 }]]);
  });

  it("tracks the attack in flight while silent, so a drain after it is heard", async () => {
    bank.effects.drain = [[0, "effect:drain", 1, 1]];
    vi.mocked(isAudioSilent).mockReturnValue(true);
    audio.onCue(ATTACK_START);
    audio.onCue(ATTACK_END);
    vi.mocked(isAudioSilent).mockReturnValue(false);

    audio.onCue(effect(MoveEffectForm.Drain));
    await advance(0);

    expect(voices.play).toHaveBeenCalledTimes(1);
  });

  it("is settled at once when nothing is playing", async () => {
    const watch = watchSettled();
    await flush();

    expect(watch.done).toBe(true);
  });

  it("settles once the attack's last sound has played out, at its own rate", async () => {
    bank.moves[MOVE_ID] = [
      [0, "move:zap", 1, 1],
      [300, "move:crackle", 1, 2],
    ];
    bank.durations = { "move:zap": 200, "move:crackle": 1000 };

    audio.onCue(ATTACK_START);

    await expectSettlesAt(800);
  });

  it("caps the wait for an attack's sounds at the attack's ceiling", async () => {
    bank.moves[MOVE_ID] = [[100, "move:wave", 1, 1]];
    bank.durations = { "move:wave": 8000 };

    audio.onCue(ATTACK_START);

    await expectSettlesAt(ATTACK_SOUND_MAX_MS);
  });

  it("settles once a borrowed cry has played out", async () => {
    isSoundMove = true;
    bank.durations = { "cry:raichu": 600 };

    audio.onCue(ATTACK_START);

    await expectSettlesAt(600);
  });

  it("settles once a K.O. cry has been heard whole", async () => {
    bank.durations = { "cry:bulbasaur": 900 };

    audio.onCue(FAINT);

    await expectSettlesAt(900);
  });

  it("caps the wait for a K.O. cry", async () => {
    bank.durations = { "cry:bulbasaur": 9000 };

    audio.onCue(FAINT);

    await expectSettlesAt(FAINT_CRY_WAIT_MAX_MS);
  });

  it("never holds the player back for their own Pokémon's turn cry", async () => {
    bank.durations = { "cry:raichu": 900 };

    audio.onCue(turnStart(true));
    const watch = watchSettled();
    await flush();

    expect(watch.done).toBe(true);
  });

  it("holds another seat's turn until its cry has played out", async () => {
    setTurnCries(TurnCries.All);
    bank.durations = { "cry:raichu": 900 };

    audio.onCue(turnStart(false));

    await expectSettlesAt(TURN_CRY_DELAY_MS + 900);
  });

  it("stops its voices when the battle is disposed", () => {
    audio.dispose();

    expect(voices.dispose).toHaveBeenCalledTimes(1);
  });
});
