import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  ABILITY_MANIP_GASTRO_ACID,
  ABILITY_MANIP_ROLE_PLAY,
  ABILITY_MANIP_SKILL_SWAP,
  ABILITY_MANIP_WORRY_SEED,
} from "../../fixtures/sandbox-configs";

// Cahier §5.41 — Famille Manip talent, Batch C (plan 153). Mutation runtime du talent (event
// AbilityChanged). Les unit/integration core couvrent le changement d'état effectif (talent effectif,
// suppression pour tout le combat, échec no-op) ; ici on prouve que chaque move résout via
// l'orchestrateur ET émet sa ligne de journal FR dédiée. Le lanceur porte Engrais (overgrow) et la
// cible Vaccin (immunity), distincts → aucun échec no-op. On assert le SENS (la ligne de journal),
// jamais le pixel. Single r1 statut → cast déterministe (aucun jet).
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// §5.41 Soucigraine : remplace le talent de la cible par un talent fixe (Insomnie).
test("§5.41 Soucigraine : le talent de la cible devient un autre (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(ABILITY_MANIP_WORRY_SEED);
  await scene.castFirstMove(3, 4);
  await expect(log(page, /Le talent de Ronflex devient/)).toBeAttached({ timeout: 10_000 });
});

// §5.41 Suc Digestif : supprime le talent de la cible pour le reste du combat.
test("§5.41 Suc Digestif : le talent de la cible est neutralisé (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(ABILITY_MANIP_GASTRO_ACID);
  await scene.castFirstMove(3, 4);
  await expect(log(page, /Le talent de Ronflex est neutralisé/)).toBeAttached({ timeout: 10_000 });
});

// §5.41 Imitation : le lanceur copie le talent effectif de la cible.
test("§5.41 Imitation : le lanceur copie le talent de la cible (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(ABILITY_MANIP_ROLE_PLAY);
  await scene.castFirstMove(3, 4);
  await expect(log(page, /Florizarre copie le talent/)).toBeAttached({ timeout: 10_000 });
});

// §5.41 Échange : échange les talents lanceur↔cible (deux AbilityChanged ; on assert celui du lanceur).
test("§5.41 Échange : le lanceur reçoit le talent de la cible (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(ABILITY_MANIP_SKILL_SWAP);
  await scene.castFirstMove(3, 4);
  await expect(log(page, /Le talent de Florizarre devient/)).toBeAttached({ timeout: 10_000 });
});
