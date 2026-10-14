import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  WIDE_GUARD_FRONT_BLOCKED_BACK_HIT,
  WIDE_GUARD_WALL_BLOCKS_COVER,
} from "../../fixtures/sandbox-configs";

// Cahier §5.46 — Garde Large (`wide-guard`) : la couverture d'équipe obéit à l'orientation PROPRE de
// chaque protégé (même règle qu'Abri). Électrode (rapide) se couvre en 1er ; Florizarre lance ensuite
// Tornade (Cône) : Ronflex, de face, est protégé ; Tortank, de dos, est touché. On asserte le SENS
// (lignes du journal FR), jamais le pixel. Seed moteur, Tornade 100 % précision.
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

test("§5.46 Garde Large : protège l'allié de face, touche l'allié de dos (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(WIDE_GUARD_FRONT_BLOCKED_BACK_HIT);

  // Électrode, plus rapide, joue sa couverture AVANT le joueur.
  await expect(log(page, /Électrode utilise Garde Large/)).toBeAttached({ timeout: 10_000 });

  await scene.castFirstMove(1, 4); // Tornade : cône vers l'est, sur Ronflex puis Tortank

  await expect(log(page, /Garde Large protège Ronflex/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Tortank perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Ronflex perd \d+ PV/)).toHaveCount(0);
  await expect(log(page, /Garde Large protège Tortank/)).toHaveCount(0);
});

// Un mur entre le lanceur de Garde Large et l'allié lui coupe la ligne de vue : pas de couverture.
test("§5.46 Garde Large : un mur coupe la couverture, l'allié est touché (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(WIDE_GUARD_WALL_BLOCKS_COVER);

  await expect(log(page, /Électrode utilise Garde Large/)).toBeAttached({ timeout: 10_000 });

  await scene.castFirstMove(4, 3); // Tornade sur Ronflex, derrière le mur vu d'Électrode

  await expect(log(page, /Ronflex perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Garde Large protège Ronflex/)).toHaveCount(0);
});
