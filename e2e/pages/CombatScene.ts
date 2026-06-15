import type { Page } from "@playwright/test";

interface MeshInfo {
  isVisible: boolean;
  isEnabled: boolean;
  renderingGroupId: number;
  position: { x: number; y: number; z: number };
}

/** Page Object for the Babylon combat scene — queries the read-only `__ptE2e__` scene-graph
 *  hook (semantic assertions: mesh count / group / position), never pixels. */
export class CombatScene {
  constructor(private readonly page: Page) {}

  /** Boot straight into a seeded sandbox battle (deterministic, replayable). Seed defaults to 1:
   *  pass an explicit seed ONLY when the test depends on the RNG outcome (e.g. driving a hit). */
  async gotoSandbox(seed = 1): Promise<void> {
    await this.page.goto(`/?sandbox=1&seed=${seed}`);
  }

  /** Boot a sandbox from a full config (status, hp, moves, positions…) — dev/test only. */
  async gotoSandboxConfig(config: Record<string, unknown>): Promise<void> {
    await this.page.goto(`/?config=${encodeURIComponent(JSON.stringify(config))}`);
  }

  /** Block on the scene's own readiness signal (map + initial sprite atlases loaded) before
   *  asserting — the deterministic gate the loader exposes. Replaces polling a count until the
   *  Playwright timeout: after this resolves, mesh asserts are instant and a failure here means
   *  "boot never completed" (clear) rather than "count never reached N" (ambiguous). Also covers
   *  the menu → combat transition: it waits for the NEW scene to install the hook AND go ready. */
  async waitReady(timeout = 20_000): Promise<void> {
    await this.page.waitForFunction(
      () => (globalThis as { __ptE2e__?: { isReady(): boolean } }).__ptE2e__?.isReady() === true,
      undefined,
      { timeout },
    );
  }

  /** Drive a tile click (pilot a turn) — same path as a real canvas pick. */
  clickTile(x: number, y: number): Promise<void> {
    return this.page.evaluate(
      (tile) =>
        (
          globalThis as { __ptE2e__?: { clickTile(x: number, y: number): void } }
        ).__ptE2e__?.clickTile(tile.x, tile.y),
      { x, y },
    );
  }

  /** Drive a tile hover — same path as a real canvas pointer-move (info panel / aura on hover). */
  hoverTile(x: number, y: number): Promise<void> {
    return this.page.evaluate(
      (tile) =>
        (
          globalThis as { __ptE2e__?: { hoverTile(x: number, y: number): void } }
        ).__ptE2e__?.hoverTile(tile.x, tile.y),
      { x, y },
    );
  }

  /** Cast the active Pokemon's first move at (x,y) and confirm: Attaque → 1er move → cible → confirme.
   *  Target = dummy tile for offensive/status moves, own tile for self/team moves. */
  async castFirstMove(x: number, y: number): Promise<void> {
    await this.page.getByRole("button", { name: "Attaque", exact: true }).click();
    await this.page.getByTestId("move-item").first().click();
    await this.clickTile(x, y);
    await this.clickTile(x, y);
  }

  /** End the active turn without acting: « Attendre » → confirm facing. Drives end-of-turn effects
   *  (status ticks, charge T2, aura/field expiry). */
  async endTurn(): Promise<void> {
    await this.page.getByRole("button", { name: "Attendre", exact: true }).click();
    await this.confirmDirection();
  }

  /** Confirm the open direction picker with its current facing (end the turn / placement). */
  confirmDirection(): Promise<void> {
    return this.page.evaluate(() =>
      (globalThis as { __ptE2e__?: { confirmDirection(): void } }).__ptE2e__?.confirmDirection(),
    );
  }

  isReady(): Promise<boolean> {
    return this.page.evaluate(
      () => (globalThis as { __ptE2e__?: { isReady(): boolean } }).__ptE2e__?.isReady() ?? false,
    );
  }

  meshNames(): Promise<string[]> {
    return this.page.evaluate(
      () => (globalThis as { __ptE2e__?: { meshNames(): string[] } }).__ptE2e__?.meshNames() ?? [],
    );
  }

  countByName(name: string): Promise<number> {
    return this.page.evaluate(
      (meshName) =>
        (globalThis as { __ptE2e__?: { countByName(n: string): number } }).__ptE2e__?.countByName(
          meshName,
        ) ?? -1,
      name,
    );
  }

  /** Distinct elevations (rounded world-Y) across all terrain tiles — >1 means a multi-level map.
   *  Computed in a single page.evaluate (no per-tile round-trip). */
  tileElevations(): Promise<number[]> {
    return this.page.evaluate(() => {
      const api = (
        globalThis as {
          __ptE2e__?: {
            meshNames(): string[];
            meshInfo(n: string): { position: { y: number } } | null;
          };
        }
      ).__ptE2e__;
      if (!api) {
        return [];
      }
      const tiles = api.meshNames().filter((n) => n.startsWith("tile_"));
      const ys = new Set<number>();
      for (const name of tiles) {
        const info = api.meshInfo(name);
        if (info) {
          ys.add(Math.round(info.position.y * 100) / 100);
        }
      }
      return [...ys];
    });
  }

  meshInfo(name: string): Promise<MeshInfo | null> {
    return this.page.evaluate(
      (meshName) =>
        (
          globalThis as { __ptE2e__?: { meshInfo(n: string): MeshInfo | null } }
        ).__ptE2e__?.meshInfo(meshName) ?? null,
      name,
    );
  }
}
