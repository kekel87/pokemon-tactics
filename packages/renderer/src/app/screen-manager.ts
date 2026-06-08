import { SCREEN_TRANSITIONS, type ScreenId, type ScreenParamsById } from "./screens";

/**
 * Screen contract (plan 120): mount builds the DOM (async when assets load),
 * dispose tears everything down (DOM + Babylon resources).
 */
export interface Screen<Id extends ScreenId = ScreenId> {
  mount(host: HTMLElement, params: ScreenParamsById[Id]): Promise<void> | void;
  dispose(): void;
}

/** Builds a fresh screen per navigation — a left screen is disposed, never reused. */
export type ScreenRegistry = {
  readonly [Id in ScreenId]: () => Screen<Id>;
};

/** Navigation callback handed to screens (fire-and-forget over ScreenManager.navigate). */
export type Navigate = <Id extends ScreenId>(id: Id, params: ScreenParamsById[Id]) => void;

/**
 * Replaces Phaser scene.launch/sleep/stop: one active screen at a time,
 * dispose-then-mount on every transition. Navigations are serialized so a
 * click landing during an async mount cannot interleave two transitions.
 */
export class ScreenManager {
  private currentId: ScreenId | null = null;
  private currentScreen: Screen | null = null;
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly host: HTMLElement,
    private readonly registry: ScreenRegistry,
  ) {}

  get current(): ScreenId | null {
    return this.currentId;
  }

  /** Boot entry (main menu, sandbox combat, ?map= preview) — no transition guard. */
  start<Id extends ScreenId>(id: Id, params: ScreenParamsById[Id]): Promise<void> {
    return this.enqueue(id, params, false);
  }

  /** Guarded transition: must be legal in SCREEN_TRANSITIONS from the current screen. */
  navigate<Id extends ScreenId>(id: Id, params: ScreenParamsById[Id]): Promise<void> {
    return this.enqueue(id, params, true);
  }

  private enqueue<Id extends ScreenId>(
    id: Id,
    params: ScreenParamsById[Id],
    guarded: boolean,
  ): Promise<void> {
    const run = this.chain.then(() => this.transitionTo(id, params, guarded));
    // Keep the chain alive after a rejected transition (illegal in dev).
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async transitionTo<Id extends ScreenId>(
    id: Id,
    params: ScreenParamsById[Id],
    guarded: boolean,
  ): Promise<void> {
    // Legality is checked at execution time: a queued navigation validates
    // against the screen actually displayed when its turn comes.
    if (guarded && !this.isLegal(id)) {
      const message = `Illegal screen transition: ${this.currentId ?? "<none>"} → ${id}`;
      if (import.meta.env.DEV) {
        throw new Error(message);
      }
      // biome-ignore lint/suspicious/noConsole: prod fallback — surface the bad transition without crashing
      console.warn(message);
      return;
    }
    this.currentScreen?.dispose();
    this.currentScreen = null;
    this.currentId = null;
    const screen = this.registry[id]();
    await screen.mount(this.host, params);
    this.currentScreen = screen;
    this.currentId = id;
  }

  private isLegal(id: ScreenId): boolean {
    return this.currentId !== null && SCREEN_TRANSITIONS[this.currentId].includes(id);
  }
}
