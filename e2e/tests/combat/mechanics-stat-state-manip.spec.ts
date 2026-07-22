import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  STAT_MANIP_CLEAR_SMOG,
  STAT_MANIP_GUARD_SWAP,
  STAT_MANIP_HAZE,
  STAT_MANIP_HEART_SWAP,
  STAT_MANIP_POWER_SWAP,
  STAT_MANIP_PSYCH_UP,
  STAT_MANIP_SPEED_SWAP,
  STAT_MANIP_TOPSY_TURVY,
} from "../../fixtures/sandbox-configs";

// Cahier §5.39 — Famille Manip état/stats (plan 146). Reset / copie / inversion / échange de crans de
// stats, piloté à travers le renderer. Les unit/integration core couvrent la résolution pure (valeurs
// des crans, blocage par le Clone, team-agnosticité de Buée Noire) ; ici on prouve que chaque move
// résout via l'orchestrateur ET émet sa ligne de journal FR dédiée (BattleLogFormatter). On assert le
// SENS (la ligne de journal), jamais le pixel. Tous ces moves sont STATUT (aucun jet) → déterministes.
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// §5.39 Buée Noire : reset zone Self → tous les crans annulés (message team-agnostic).
test("§5.39 Buée Noire : annule les changements de stats de tous les Pokémon", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(STAT_MANIP_HAZE);
  await scene.castFirstMove(2, 4); // Zone Self → propre case
  await expect(log(page, /Les changements de stats de tous les Pokémon sont annulés/)).toBeAttached(
    {
      timeout: 10_000,
    },
  );
});

// §5.39 Bain de Smog : dégâts PUIS reset des crans de la cible.
test("§5.39 Bain de Smog : inflige des dégâts puis annule les crans de la cible", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(STAT_MANIP_CLEAR_SMOG);
  await scene.castFirstMove(3, 4); // la cible adjacente à l'est
  await expect(log(page, /Ronflex perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  await expect(
    log(page, /Les changements de stats de tous les Pokémon sont annulés/),
  ).toBeAttached();
});

// §5.39 Boost : le lanceur copie les crans de la cible.
test("§5.39 Boost : le lanceur copie les changements de stats de la cible", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(STAT_MANIP_PSYCH_UP);
  await scene.castFirstMove(3, 4);
  await expect(log(page, /Florizarre copie les changements de stats de Ronflex/)).toBeAttached({
    timeout: 10_000,
  });
});

// §5.39 Renversement : inverse le signe des crans de la cible.
test("§5.39 Renversement : inverse les changements de stats de la cible", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(STAT_MANIP_TOPSY_TURVY);
  await scene.castFirstMove(3, 4);
  await expect(log(page, /Les changements de stats de Ronflex sont inversés/)).toBeAttached({
    timeout: 10_000,
  });
});

// §5.39 Permugarde : échange les crans Déf + Déf. Spé. lanceur↔cible.
test("§5.39 Permugarde : échange la Défense et la Déf. Spé. avec la cible", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(STAT_MANIP_GUARD_SWAP);
  await scene.castFirstMove(3, 4);
  await expect(
    log(page, /Florizarre et Ronflex échangent leur Défense et Déf\. Spé\./),
  ).toBeAttached({ timeout: 10_000 });
});

// §5.39 Permuforce : échange les crans Atq + Atq. Spé. lanceur↔cible.
test("§5.39 Permuforce : échange l'Attaque et l'Atq. Spé. avec la cible", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(STAT_MANIP_POWER_SWAP);
  await scene.castFirstMove(3, 4);
  await expect(
    log(page, /Florizarre et Ronflex échangent leur Attaque et Atq\. Spé\./),
  ).toBeAttached({ timeout: 10_000 });
});

// §5.39 Permucœur : échange les 7 crans lanceur↔cible (portée 1).
test("§5.39 Permucœur : échange tous les crans avec la cible adjacente", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(STAT_MANIP_HEART_SWAP);
  await scene.castFirstMove(3, 4);
  await expect(log(page, /Florizarre et Ronflex échangent leur/)).toBeAttached({ timeout: 10_000 });
});

// §5.39 Permuvitesse : échange la Vitesse brute lanceur↔cible (portée 1).
test("§5.39 Permuvitesse : échange la Vitesse avec la cible adjacente", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(STAT_MANIP_SPEED_SWAP);
  await scene.castFirstMove(3, 4);
  await expect(log(page, /Florizarre et Ronflex échangent leur Vitesse/)).toBeAttached({
    timeout: 10_000,
  });
});
