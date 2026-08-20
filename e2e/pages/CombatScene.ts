import type { Locator, Page } from "@playwright/test";

interface MeshInfo {
  isVisible: boolean;
  isEnabled: boolean;
  renderingGroupId: number;
  position: { x: number; y: number; z: number };
  transparent: boolean;
}

interface MeshBounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

/** Per-sprite animation/terrain snapshot from the read-only scene hook (§11 flying resting anim):
 *  the animation playing now, the resting pose it reverts to, its occupied tile and that terrain. */
interface SpriteState {
  pokemonId: string;
  animation: string;
  restingAnimation: string;
  tile: { x: number; y: number };
  terrain: string | undefined;
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

  /** Drive a tile hover — same path as a real canvas pointer-move (info panel ; les auras ne dépendent plus du survol depuis le plan 182). */
  hoverTile(x: number, y: number): Promise<void> {
    return this.page.evaluate(
      (tile) =>
        (
          globalThis as { __ptE2e__?: { hoverTile(x: number, y: number): void } }
        ).__ptE2e__?.hoverTile(tile.x, tile.y),
      { x, y },
    );
  }

  /**
   * Tap a tile as a FINGER would (plan 183): synthesises a real `pointerdown`/`pointerup` on the
   * canvas, so the press travels the actual input layer instead of short-circuiting to the
   * orchestrator the way `clickTile` does.
   *
   * On touch the first tap only INSPECTS — call it twice on the same tile to act, like a player.
   * Resolves to false when the map has no geometry yet.
   */
  tapTile(x: number, y: number): Promise<boolean> {
    return this.page.evaluate(
      (tile) =>
        (
          globalThis as { __ptE2e__?: { tapTile(x: number, y: number): boolean } }
        ).__ptE2e__?.tapTile(tile.x, tile.y) ?? false,
      { x, y },
    );
  }

  /** Cast the active Pokemon's first move at (x,y) and confirm: Attaque → 1er move → cible → confirme.
   *  Target = dummy tile for offensive/status moves, own tile for self/team moves. */
  async castFirstMove(x: number, y: number): Promise<void> {
    await this.castMove(this.page.getByTestId("move-item").first(), x, y);
  }

  /** Comme {@link castFirstMove} mais en choisissant le move par son NOM FR affiché — nécessaire dès
   *  qu'un test enchaîne DEUX moves du même mon (empiler deux auras), où « le premier » ne suffit plus. */
  async castMoveNamed(name: string, x: number, y: number): Promise<void> {
    await this.castMove(this.page.getByTestId("move-item").filter({ hasText: name }), x, y);
  }

  /** Shared cast flow: Attaque → le move désigné → cible → confirme. */
  private async castMove(move: Locator, x: number, y: number): Promise<void> {
    await this.page.getByRole("button", { name: "Attaque", exact: true }).click();
    await move.click();
    if (!(await this.skippedTargeting())) {
      await this.clickTile(x, y);
    }
    await this.clickTile(x, y);
  }

  /**
   * True when selecting the move landed straight on the confirmation step, i.e. the targeting phase
   * was skipped (plan 183). A static pattern — soi-même, croix, zone — is centred on the caster and
   * ignores the aimed tile entirely (`resolveTargeting` reads `caster.position`), so asking for a
   * target was asking to choose between one option. Helpers must therefore not spend a click aiming,
   * or it would confirm the attack a step early.
   */
  private async skippedTargeting(): Promise<boolean> {
    const instruction = this.page.getByTestId("combat-instruction");
    return (await instruction.textContent())?.trim() === "Confirmer ?";
  }

  /** Aim the active Pokemon's first move at (x,y) and STOP on the confirmation step: Attaque → 1er
   *  move → survol de la cible → cible. One click short of {@link castFirstMove}, so the confirm-phase
   *  overlays (preview flash, damage labels, combat-preview panel — plan 175) stay on screen to be
   *  asserted. Target = the victim's tile for a targeted move, the caster's own tile for a self-centred
   *  zone. The hover is NOT decoration: a directional/single footprint is computed by the cursor-follow
   *  preview, so a real pointer always moves over the tile before pressing — skipping it would lock in
   *  an empty footprint and no forecast. */
  async aimFirstMove(x: number, y: number): Promise<void> {
    await this.page.getByRole("button", { name: "Attaque", exact: true }).click();
    await this.page.getByTestId("move-item").first().click();
    // A static pattern is already ON the confirmation step (see `skippedTargeting`): aiming would
    // spend the click that confirms, and the overlays this helper exists to expose would vanish.
    if (await this.skippedTargeting()) {
      return;
    }
    await this.hoverTile(x, y);
    await this.clickTile(x, y);
  }

  /** Drive a one-tile move end to end via the real DOM+canvas path: select the mover, open the move
   *  sub-flow (« Deplacement »), pick the destination tile, then confirm the landing facing so the
   *  glide tween runs. The landing resting animation is only applied once the tween settles — poll
   *  {@link spriteStates} on `tile === destination` to read it (see §11 flying resting anim). */
  async moveTo(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    await this.clickTile(fromX, fromY); // select the active mover
    await this.page.getByRole("button", { name: "Deplacement", exact: true }).click();
    await this.clickTile(toX, toY); // pick destination → opens the landing-facing picker
    await this.confirmDirection(); // confirm facing → runs the glide tween
  }

  /** Read-only per-sprite animation/terrain state (`__ptE2e__.spriteStates`). Serializable primitives
   *  only — the resting pose settles at the END of a move tween, so drive a move then poll this. */
  spriteStates(): Promise<SpriteState[]> {
    return this.page.evaluate(
      () =>
        (
          globalThis as { __ptE2e__?: { spriteStates(): SpriteState[] } }
        ).__ptE2e__?.spriteStates() ?? [],
    );
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

  /** Noms de mesh commençant par `prefix` (familles nommées `<famille>_<clé>` : anneaux d'aura,
   *  highlights, hazards…) — `countByName` demande un nom EXACT, or la clé d'un anneau d'aura porte
   *  l'id d'instance du lanceur. */
  async meshNamesStartingWith(prefix: string): Promise<string[]> {
    return (await this.meshNames()).filter((name) => name.startsWith(prefix));
  }

  /** Boîte englobante MONDE d'un mesh (`__ptE2e__.meshBounds`). Seul signal géométrique des anneaux
   *  d'aura : ce sont des GreasedLine bâtis sur des points absolus, donc leur `position` reste à
   *  l'origine et c'est l'étendue qui dit où passe l'anneau et sur quel plan Y il est empilé. */
  meshBounds(name: string): Promise<MeshBounds | null> {
    return this.page.evaluate(
      (meshName) =>
        (
          globalThis as { __ptE2e__?: { meshBounds(n: string): MeshBounds | null } }
        ).__ptE2e__?.meshBounds(meshName) ?? null,
      name,
    );
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
