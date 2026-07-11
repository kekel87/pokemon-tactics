import { CT_START, CT_THRESHOLD } from "./ct-costs";

export class ChargeTimeTurnSystem {
  private readonly ctMap: Map<string, number>;
  private readonly getCtGain: (pokemonId: string) => number;

  constructor(pokemonIds: string[], getCtGain: (pokemonId: string) => number) {
    this.ctMap = new Map(pokemonIds.map((id) => [id, CT_START]));
    this.getCtGain = getCtGain;
  }

  getNextActorId(): string {
    const MAX_TICKS = 10_000;
    let ticks = 0;

    while (ticks < MAX_TICKS) {
      const actorId = this.findActorAboveThreshold();
      if (actorId !== null) {
        return actorId;
      }
      this.tick();
      ticks++;
    }

    throw new Error("ChargeTimeTurnSystem: no actor found after max ticks");
  }

  onActionComplete(pokemonId: string, actionCost: number): void {
    const current = this.ctMap.get(pokemonId);
    if (current !== undefined) {
      this.ctMap.set(pokemonId, current - actionCost);
    }
  }

  onPokemonKO(pokemonId: string): void {
    this.ctMap.delete(pokemonId);
  }

  /**
   * Re-inject a revived mon into the scheduler (Vœu Soin / healing-wish, plan 147). It re-enters at
   * the start value so it takes its natural place in the cadence again. No-op if already scheduled.
   */
  onPokemonRevived(pokemonId: string): void {
    if (!this.ctMap.has(pokemonId)) {
      this.ctMap.set(pokemonId, CT_START);
    }
  }

  /**
   * Make `pokemonId` the immediate next actor (deterministic test setup): it crosses the threshold
   * while everyone else resets to the start value, so the natural cadence resumes afterwards.
   */
  forceActor(pokemonId: string): void {
    for (const id of this.ctMap.keys()) {
      this.ctMap.set(id, id === pokemonId ? CT_THRESHOLD : CT_START);
    }
  }

  /**
   * Après Vous (after-you, plan 155): make `pokemonId` the strictly-next actor **without** disturbing
   * anyone else's gauge (unlike `forceActor`, which resets everyone to `CT_START`). It is set both
   * above the current maximum AND above the action threshold, so the very next `getNextActorId`
   * returns it immediately — no ticking happens, so faster mons can't out-accumulate its head start.
   * Deterministic even on a tie, since no other mon can match `max + 1`. No-op if the mon is not
   * scheduled (e.g. KO'd).
   */
  promoteToImmediateNext(pokemonId: string): void {
    if (!this.ctMap.has(pokemonId)) {
      return;
    }
    let max = Number.NEGATIVE_INFINITY;
    for (const ct of this.ctMap.values()) {
      if (ct > max) {
        max = ct;
      }
    }
    this.ctMap.set(pokemonId, Math.max(CT_THRESHOLD, max + 1));
  }

  getCtSnapshot(): Record<string, number> {
    return Object.fromEntries(this.ctMap);
  }

  private tick(): void {
    for (const [id] of this.ctMap) {
      const gain = this.getCtGain(id);
      const current = this.ctMap.get(id) ?? 0;
      this.ctMap.set(id, current + gain);
    }
  }

  private findActorAboveThreshold(): string | null {
    let bestId: string | null = null;
    let bestCt = CT_THRESHOLD - 1;

    for (const [id, ct] of this.ctMap) {
      if (ct > bestCt || (ct === bestCt && bestId !== null && id < bestId)) {
        bestId = id;
        bestCt = ct;
      }
    }

    return bestId;
  }
}
