import { expect, type Page } from "@playwright/test";
import type { CombatScene } from "./CombatScene";
import { InfoPanel } from "./combatHud";

const HP_POLL = { timeout: 10_000, intervals: [150, 250, 400] };

/** Survole la tuile (x,y) jusqu'à ce que l'InfoPanel reflète `name`, puis lit la barre de vie
 *  (`role="progressbar"`) via le POM. Le panneau est stable une fois le tour posé → lecture sans race.
 *  Les dégâts de terrain/chute n'étant pas journalisés, c'est le seul signal e2e de PV chiffrés. */
export async function readHp(
  scene: CombatScene,
  page: Page,
  x: number,
  y: number,
  name: string,
): Promise<{ now: number; max: number }> {
  const info = new InfoPanel(page);
  await expect
    .poll(async () => {
      await scene.hoverTile(x, y);
      return info.name.textContent();
    }, HP_POLL)
    .toBe(name);
  const now = Number(await info.hpBar.getAttribute("aria-valuenow"));
  const max = Number(await info.hpBar.getAttribute("aria-valuemax"));
  return { now, max };
}
