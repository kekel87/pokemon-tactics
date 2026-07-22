import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  PASSIVE_AI_STATIC,
  SCORED_AI_ATTACKS,
  SPAWN_FAINTED_ALLY_REVIVE,
} from "../../fixtures/sandbox-configs";

// Cahier §5 — harness équipes N-vs-N (plan 167) : le studio sandbox passe du 1v1 plat aux équipes
// avec contrôle par équipe (player / passive / scored). Ce déblocage fait tourner le VRAI scorer IA
// en sandbox, déterministe via le seed. Ces specs pilotent le boot ?config v2 (`teams`).
const log = (page: Page, pattern: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: pattern });

test("§5 IA scorée : l'équipe 2 attaque de son propre chef (journal)", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(SCORED_AI_ATTACKS);

  // Dracaufeu (IA « hard », plus rapide) prend le premier tour tout seul : Lance-Flammes descend la
  // colonne et touche Florizarre — le scorer a bien choisi ET exécuté une attaque sans intervention.
  await expect(log(page, /Dracaufeu utilise Lance-Flammes/)).toBeAttached({ timeout: 15_000 });
  await expect(log(page, /Florizarre perd \d+ PV/)).toBeAttached();
});

test("§5 contraste passif : l'équipe 2 passive n'agit pas", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(PASSIVE_AI_STATIC);

  // L'équipe 2 passive (Dracaufeu, plus rapide) a « attendu » son tour au boot → la main revient au
  // joueur (menu d'action monté). C'est le point d'observation stable après le tour IA vide.
  await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // Aucune attaque IA (pas de move joué) et le sprite n'a pas quitté sa tuile de spawn (2,1).
  await expect(log(page, /Dracaufeu utilise/)).toHaveCount(0);
  const charizard = (await scene.spriteStates()).find((state) => state.pokemonId === "charizard");
  expect(charizard?.tile).toEqual({ x: 2, y: 1 });
});

// NOTE déterminisme : le sandbox seede désormais la RNG de COMBAT **et** de CRÉATION
// (`createSandboxBattle` passe `creationRng: createPrng(config.seed)`), donc à seed fixe la nature /
// le genre / le spread de stats — et le dégât de Lance-Flammes — sont reproductibles. Ces specs
// asssertent la DÉCISION du scorer (l'ennemi attaque de lui-même), qui est le déblocage visé ; une
// assertion chiffrée « même seed → même dégât » est désormais possible et pourra être ajoutée par
// `test-writer` (seule exception résiduelle : la durée de Confus, cf. `SandboxSetup.applyConfigToInstance`).

test("§5 allié KO au spawn : ne bloque pas le tour et est réanimé par Vœu Soin", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SPAWN_FAINTED_ALLY_REVIVE);

  // L'allié Dracaufeu (hp:0) n'est jamais actif : le joueur pilote directement Florizarre. Le fait
  // que Vœu Soin se lance prouve que le membre KO n'a pas volé/bloqué le tour. Cible = tuile de
  // l'allié KO adjacent (3,4).
  await scene.castFirstMove(3, 4);

  await expect(log(page, /utilise Vœu Soin/)).toBeAttached({ timeout: 15_000 });
  // Florizarre se sacrifie (self-KO) et l'allié KO revient au combat.
  await expect(log(page, /Florizarre est K\.O\./)).toBeAttached();
  await expect(log(page, /Dracaufeu revient au combat/)).toBeAttached();
});
