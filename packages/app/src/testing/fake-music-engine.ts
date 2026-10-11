/**
 * Double du moteur Web Audio vu par `music-player.ts` : juste ce que le lecteur de musique appelle,
 * chaque appel consigné. Aucun son, aucune horloge réelle — `now` s'avance à la main.
 */

export interface FakeGainCall {
  method: "setValueAtTime" | "setTargetAtTime" | "cancelScheduledValues";
  level?: number;
  at: number;
  timeConstant?: number;
}

export class FakeGainNode {
  readonly calls: FakeGainCall[] = [];

  readonly gain = {
    setValueAtTime: (level: number, at: number): void => {
      this.calls.push({ method: "setValueAtTime", level, at });
    },
    setTargetAtTime: (level: number, at: number, timeConstant: number): void => {
      this.calls.push({ method: "setTargetAtTime", level, at, timeConstant });
    },
    cancelScheduledValues: (at: number): void => {
      this.calls.push({ method: "cancelScheduledValues", at });
    },
  };

  connect<Target>(target: Target): Target {
    return target;
  }

  disconnect(): void {
    /* la topologie des nœuds n'est pas modélisée */
  }

  targets(): { level: number | undefined; at: number }[] {
    return this.calls
      .filter((call) => call.method === "setTargetAtTime")
      .map((call) => ({ level: call.level, at: call.at }));
  }
}

export class FakeBufferSource {
  buffer: unknown = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  startedAt: number | null = null;
  stoppedAt: number | null = null;

  connect<Target>(target: Target): Target {
    return target;
  }

  start(at: number): void {
    this.startedAt = at;
  }

  stop(at: number): void {
    this.stoppedAt = at;
  }

  addEventListener(): void {
    /* la fin d'une piste n'est pas simulée */
  }
}

export class FakeMusicEngine {
  now = 0;
  audible = true;
  available = true;
  audibleListener: (() => void) | null = null;
  readonly gains: FakeGainNode[] = [];
  readonly sources: FakeBufferSource[] = [];
  readonly fetched: string[] = [];
  readonly failing = new Set<string>();
  readonly busNode = new FakeGainNode();

  readonly context = {
    createGain: (): FakeGainNode => {
      const gain = new FakeGainNode();
      this.gains.push(gain);
      return gain;
    },
    createBufferSource: (): FakeBufferSource => {
      const source = new FakeBufferSource();
      this.sources.push(source);
      return source;
    },
    decodeAudioData: async (encoded: ArrayBuffer): Promise<ArrayBuffer> => encoded,
  };

  constructor() {
    Object.defineProperty(this.context, "currentTime", { get: () => this.now });
  }

  /** Le gain baissé le temps d'un cri : premier créé par le lecteur. */
  get duck(): FakeGainNode | undefined {
    return this.gains[0];
  }

  /** Le gain tenu bas par une raison (`MusicDim`) : second créé par le lecteur. */
  get dim(): FakeGainNode | undefined {
    return this.gains[1];
  }

  readonly fetch = async (url: string): Promise<unknown> => {
    this.fetched.push(url);
    return {
      ok: !this.failing.has(url),
      arrayBuffer: async () => new ArrayBuffer(8),
    };
  };

  reset(): void {
    this.now = 0;
    this.audible = true;
    this.available = true;
    this.audibleListener = null;
    this.gains.length = 0;
    this.sources.length = 0;
    this.fetched.length = 0;
    this.failing.clear();
  }
}
