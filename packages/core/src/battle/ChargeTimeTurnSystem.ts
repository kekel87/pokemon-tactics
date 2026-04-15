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
