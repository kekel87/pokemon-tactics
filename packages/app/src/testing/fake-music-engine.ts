import { MusicBus } from "../audio/audio-player";

/**
 * Double du moteur Web Audio vu par `music-player.ts` : juste ce que le lecteur de musique appelle,
 * chaque appel consigné. Aucun son, aucune horloge réelle — `now` s'avance à la main.
 *
 * Le moteur fournit les deux bus de musique et les gains `duck` et `dim` (plan 240) : le lecteur ne
 * crée plus que le gain de chaque piste, lu par la topologie (`source.output`). Un moteur NEUF par
 * test, jamais remis à zéro.
 */

export interface FakeGainCall {
  method: "setValueAtTime" | "setTargetAtTime" | "cancelScheduledValues";
  level?: number;
  at: number;
  timeConstant?: number;
}

export class FakeGainNode {
  readonly calls: FakeGainCall[] = [];
  /** Ce sur quoi le nœud a été branché en dernier. */
  output: unknown = null;

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
    this.output = target;
    return target;
  }

  disconnect(): void {
    /* la fin d'une piste n'est pas simulée : jamais appelé */
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
  /** Le gain de la piste, sur lequel la source a été branchée. */
  output: FakeGainNode | null = null;

  connect<Target>(target: Target): Target {
    this.output = target instanceof FakeGainNode ? target : null;
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
  available = true;
  /** Les musiques qu'on ne peut pas entendre (audio verrouillé, coupée, volume à zéro). */
  readonly inaudible = new Set<MusicBus>();
  /** Les musiques que le joueur a coupées : rien à charger pour elles. */
  readonly unwanted = new Set<MusicBus>();
  audibleListener: (() => void) | null = null;
  readonly sources: FakeBufferSource[] = [];
  readonly fetched: string[] = [];
  readonly failing = new Set<string>();
  readonly buses: Record<MusicBus, FakeGainNode> = {
    [MusicBus.Battle]: new FakeGainNode(),
    [MusicBus.Menu]: new FakeGainNode(),
  };
  /** Le gain baissé le temps d'un cri. */
  readonly duck = new FakeGainNode();
  /** Le gain tenu bas par une raison (`MusicDim`). */
  readonly dim = new FakeGainNode();

  readonly context = {
    createGain: (): FakeGainNode => new FakeGainNode(),
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

  /** Ce que rend `musicOutput()`, `null` sans Web Audio. */
  output(): { context: unknown; buses: unknown; duck: unknown; dim: unknown } | null {
    return this.available
      ? { context: this.context, buses: this.buses, duck: this.duck, dim: this.dim }
      : null;
  }

  isAudible(bus: MusicBus): boolean {
    return !this.inaudible.has(bus) && !this.unwanted.has(bus);
  }

  isWanted(bus: MusicBus): boolean {
    return !this.unwanted.has(bus);
  }

  /** Le bus sur lequel une piste joue, `undefined` si elle n'est branchée sur aucun. */
  busOf(source: FakeBufferSource | undefined): MusicBus | undefined {
    return Object.values(MusicBus).find((bus) => source?.output?.output === this.buses[bus]);
  }

  readonly fetch = async (url: string): Promise<unknown> => {
    this.fetched.push(url);
    return {
      ok: !this.failing.has(url),
      arrayBuffer: async () => new ArrayBuffer(8),
    };
  };
}
