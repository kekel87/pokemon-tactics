import { expect, seedSettings, test } from "../../fixtures";
import { DUEL } from "../../fixtures/sandbox-configs";
import type { CombatScene } from "../../pages/CombatScene";

// Plan 233 — le coup tombe au bon moment. Florizarre (venusaur) lance Griffe (scratch, 100 %) sur le
// mannequin au contact : l'animation « Attack » de Florizarre porte son coup à l'image 5 sur 11.
//
// La barre de PV est peinte dans une texture (non observable au scene-graph) ; la ligne de journal
// « … perd N PV ! » est écrite dans le MÊME battement de l'orchestrateur que la barre qui baisse.
// On relève donc, à l'instant exact où cette ligne apparaît, l'animation que joue l'attaquant
// (`recordAnimationAtLogLines`) : « Attack » prouve que les dégâts tombent PENDANT le geste, à
// l'impact, et plus après sa fin.

const TARGET_TILE = DUEL.dummyPosition;
const POLL = { timeout: 10_000, intervals: [100, 200, 400] };

async function damageLineAnimation(scene: CombatScene): Promise<string | null | undefined> {
  const lines = await scene.logLineAnimations();
  return lines.find((line) => line.text.includes("perd"))?.animation;
}

test("impact : les dégâts tombent pendant l'animation d'attaque, à l'image d'impact", async ({
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL);
  await scene.recordAnimationAtLogLines(DUEL.pokemon);

  await scene.castFirstMove(TARGET_TILE.x, TARGET_TILE.y);

  await expect.poll(() => damageLineAnimation(scene), POLL).toBe("Attack");
});

test("impact : en vitesse Instantanée, aucune animation d'attaque ne joue avant les dégâts", async ({
  page,
  bootSandbox,
}) => {
  await seedSettings(page, { combatSpeed: "instant" });
  const scene = await bootSandbox(DUEL);
  await scene.recordAnimationAtLogLines(DUEL.pokemon);

  await scene.castFirstMove(TARGET_TILE.x, TARGET_TILE.y);

  await expect
    .poll(async () => {
      const animation = await damageLineAnimation(scene);
      return animation !== undefined && animation !== "Attack";
    }, POLL)
    .toBe(true);
});
