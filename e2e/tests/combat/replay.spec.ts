import { deflateRawSync, inflateRawSync } from "node:zlib";
import type { Page } from "@playwright/test";
import { expect, seedSavedTeams, test } from "../../fixtures";
import { CombatScene } from "../../pages/CombatScene";
import { MainMenu } from "../../pages/MainMenu";
import {
  DUEL_ATTACKER_TEAM_ID,
  DUEL_DEFENDER_TEAM_ID,
  DUEL_TEAM_STORAGE,
} from "../../pages/online-duel";
import { BattleModeScreen, TeamSelectScreen } from "../../pages/screens";

// Cahier — replay de combat partageable (plan 242) : « Revoir un combat » au menu, le code d'un combat
// terminé, la barre de lecture.
//
// Le code n'est jamais un fichier commité : il est PRODUIT par un vrai combat hors ligne, copié par le
// bouton de l'écran de victoire, puis recollé dans la fenêtre du menu. C'est le seul moyen de prouver
// l'aller-retour de bout en bout — et un code forgé mentirait sur l'empreinte du combat rejoué.
//
// Pourquoi pas le studio sandbox : il monte son propre orchestrateur, SANS export de replay (celui-ci
// n'existe que sur le chemin réel menu → équipes → combat). Le combat est donc le duel Alakazam contre
// Abra du harnais en ligne, joué ici par l'IA des deux côtés : un seul Pokemon par camp, un K.O. en
// un coup, aucune action du test à synchroniser.

/** Joue, par le parcours réel du menu, un combat IA contre IA qui se termine par un K.O. */
async function playOfflineDuelToVictory(page: Page): Promise<void> {
  await seedSavedTeams(page, DUEL_TEAM_STORAGE);
  const menu = new MainMenu(page);
  const teams = new TeamSelectScreen(page);
  await menu.goto();
  await menu.combat.click();
  await new BattleModeScreen(page).local.click();
  await expect(teams.title).toBeVisible();
  await teams.giveSlotToAi(0);
  await teams.giveSlotToAi(1);
  await teams.pickSavedTeam(0, DUEL_ATTACKER_TEAM_ID);
  await teams.pickSavedTeam(1, DUEL_DEFENDER_TEAM_ID);
  await expect(teams.launch).toBeEnabled();
  await teams.launch.click();
  await new CombatScene(page).waitReady();
  await expect(page.getByTestId("replay-share")).toBeVisible({ timeout: 120_000 });
}

const CODE_PREFIX = "PTR2.";

/** Ce que les falsifications lisent de l'enveloppe d'un code ; le reste passe tel quel. */
interface CodeEnvelope {
  fingerprint: string;
  data: { actions: { path?: unknown; targetPosition?: unknown }[] };
}

/** Décode l'enveloppe d'un vrai code, laisse `tamper` la falsifier, et la ré-encode sous le même préfixe. */
function tamperEnvelope(code: string, tamper: (envelope: CodeEnvelope) => void): string {
  const envelope: CodeEnvelope = JSON.parse(
    inflateRawSync(Buffer.from(code.slice(CODE_PREFIX.length), "base64url")).toString("utf8"),
  );
  tamper(envelope);
  return CODE_PREFIX + deflateRawSync(Buffer.from(JSON.stringify(envelope))).toString("base64url");
}

/**
 * Falsifie un vrai code : même enveloppe et même empreinte (il passe donc tous les gardes de
 * forme), mais la première action de déplacement ou de move vise une case hors de la grille.
 */
function forgeImpossibleAction(code: string): string {
  return tamperEnvelope(code, (envelope) => {
    const impossible = { x: 999, y: 999 };
    const action = envelope.data.actions.find(
      (candidate) => candidate.path !== undefined || candidate.targetPosition !== undefined,
    );
    if (action === undefined) {
      throw new Error("le combat produit contient une action à falsifier");
    }
    if (action.path === undefined) {
      action.targetPosition = impossible;
    } else {
      action.path = [impossible];
    }
  });
}

/** Falsifie un vrai code : le combat est intact et rejouable, mais l'empreinte annoncée est fausse. */
function forgeFingerprint(code: string): string {
  return tamperEnvelope(code, (envelope) => {
    envelope.fingerprint = `${envelope.fingerprint}0`;
  });
}

test("replay : la fenêtre refuse un texte quelconque et un code tronqué, avec un message clair", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  await menu.goto();

  await menu.reviewBattle.click();
  const input = page.getByTestId("replay-code-input");
  const error = page.getByTestId("replay-import-error");
  await expect(input).toBeVisible();
  await expect(error).toBeHidden();

  await input.fill("bonjour tout le monde");
  await page.getByTestId("replay-start").click();
  await expect(error).toHaveText("Ce texte n'est pas un code de replay.");

  await input.fill("PTR2.AAAA");
  await page.getByTestId("replay-start").click();
  await expect(error).toHaveText("Ce code est abîmé ou incomplet.");
  // Aucun combat n'est monté sur un refus : la fenêtre reste, le menu est toujours dessous.
  await expect(input).toBeVisible();
});

test("replay : un combat gagné se copie, se recolle au menu et se rejoue avec sa barre de lecture", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1600, height: 900 });

  // 1. L'écran de victoire d'un combat hors ligne offre le partage.
  await playOfflineDuelToVictory(page);
  const share = page.getByTestId("replay-share");
  await expect(share.getByTestId("copy-replay")).toBeVisible();
  await expect(share.getByTestId("download-replay")).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    share.getByTestId("download-replay").click(),
  ]);
  expect(download.suggestedFilename()).toBe("pokemon-tactics-replay.txt");

  await share.getByTestId("copy-replay").click();
  await expect(share.getByTestId("copy-replay")).toHaveText("Code copié !");
  const code = await page.evaluate(() => navigator.clipboard.readText());
  expect(code.startsWith(CODE_PREFIX)).toBe(true);

  // 2. Le recoller au menu principal.
  const menu = new MainMenu(page);
  await menu.goto();
  await menu.reviewBattle.click();
  await page.getByTestId("replay-code-input").fill(code);
  await page.getByTestId("replay-start").click();
  await new CombatScene(page).waitReady();

  // 3. La barre de lecture et le journal.
  const bar = page.getByTestId("replay-bar");
  await expect(bar).toBeVisible({ timeout: 15_000 });
  const position = page.getByTestId("replay-position");
  const toggle = page.getByTestId("replay-toggle");
  // Le journal est ouvert d'emblée sur grand écran : lire est l'activité principale d'un replay.
  await expect(page.getByTestId("battle-log")).toHaveAttribute("data-collapsed", "false");

  // Le replay démarre en lecture ; on le met en pause tout de suite. Arrivé au bout, la modale de
  // victoire rend la barre inerte : tous les gestes de pas se jouent donc AVANT la fin.
  await expect(toggle).toHaveAttribute("data-state", "playing");
  await toggle.click();
  await expect(toggle).toHaveAttribute("data-state", "paused");
  const total = Number(/\/ (\d+)$/.exec((await position.textContent()) ?? "")?.[1]);
  expect(total).toBeGreaterThan(2);
  const reached = Number(/(\d+) \//.exec((await position.textContent()) ?? "")?.[1]);
  expect(reached).toBeLessThan(total);

  // Pas avant : exactement une action, puis pause.
  await page.getByTestId("replay-step-forward").click();
  await expect(position).toHaveText(`Action ${reached + 1} / ${total}`, { timeout: 30_000 });
  await expect(toggle).toHaveAttribute("data-state", "paused");

  // Le recul remonte le combat SANS recréer le canvas : on marque l'élément et on le retrouve.
  await page.evaluate(() => {
    for (const canvas of document.querySelectorAll("canvas")) {
      canvas.dataset.replayMark = "kept";
    }
  });
  const canvasCount = await page.locator("canvas").count();
  await page.getByTestId("replay-step-back").click();
  await expect(position).toHaveText(`Action ${reached} / ${total}`, { timeout: 30_000 });
  await expect(page.locator("canvas")).toHaveCount(canvasCount);
  await expect(page.locator("canvas[data-replay-mark='kept']")).toHaveCount(canvasCount);

  // Début : tout est rembobiné, le recul n'a plus de sens.
  await page.getByTestId("replay-restart").click();
  await expect(position).toHaveText(`Action 0 / ${total}`, { timeout: 30_000 });
  await expect(page.getByTestId("replay-step-back")).toBeDisabled();
  await expect(page.locator("canvas[data-replay-mark='kept']")).toHaveCount(canvasCount);

  // La vitesse défile au clic, ralentit au clic droit (retour de recette).
  const speed = page.getByTestId("replay-speed");
  await expect(speed).toHaveText("×1");
  await speed.click();
  await expect(speed).toHaveText("×2");
  await speed.click({ button: "right" });
  await expect(speed).toHaveText("×1");
  await speed.click({ button: "right" });
  await expect(speed).toHaveText("×0,5");
  await speed.click();

  // Lecture jusqu'au bout : la victoire du combat rejoué s'ouvre, sur la dernière action.
  await toggle.click();
  await expect(position).toHaveText(`Action ${total} / ${total}`, { timeout: 120_000 });
  // Le compteur arrive au bout dès que la dernière action part ; la victoire attend la fin de son animation.
  await expect(page.getByTestId("battle-over")).toBeVisible({ timeout: 30_000 });
  await expect(toggle).toHaveAttribute("data-state", "paused");
});

test("replay : un code dont une action est impossible ramène au menu avec un message, retiré au prochain essai", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await playOfflineDuelToVictory(page);
  const copy = page.getByTestId("replay-share").getByTestId("copy-replay");
  await copy.click();
  await expect(copy).toHaveText("Code copié !");
  const code = await page.evaluate(() => navigator.clipboard.readText());
  expect(code.startsWith(CODE_PREFIX)).toBe(true);

  const menu = new MainMenu(page);
  await menu.goto();
  await menu.reviewBattle.click();
  await page.getByTestId("replay-code-input").fill(forgeImpossibleAction(code));
  await page.getByTestId("replay-start").click();

  // Le journal est vérifié en entier avant la lecture : retour au menu, avec la cause.
  const failure = page.getByTestId("replay-error");
  await expect(failure).toHaveText(
    "Ce replay ne peut pas être rejoué : le code a été modifié, ou ce combat se déroule autrement dans cette version du jeu.",
    { timeout: 30_000 },
  );
  await expect(menu.reviewBattle).toBeVisible();

  // Un nouvel essai efface l'échec précédent.
  await menu.reviewBattle.click();
  await expect(page.getByTestId("replay-code-input")).toBeVisible();
  await expect(failure).toHaveCount(0);
});

test("replay : un code dont l'empreinte est fausse ramène au menu avec « se déroule autrement »", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await playOfflineDuelToVictory(page);
  const copy = page.getByTestId("replay-share").getByTestId("copy-replay");
  await copy.click();
  await expect(copy).toHaveText("Code copié !");
  const code = await page.evaluate(() => navigator.clipboard.readText());
  expect(code.startsWith(CODE_PREFIX)).toBe(true);

  const menu = new MainMenu(page);
  await menu.goto();
  await menu.reviewBattle.click();
  await page.getByTestId("replay-code-input").fill(forgeFingerprint(code));
  await page.getByTestId("replay-start").click();

  // Le journal se rejoue sans erreur : seul l'écart d'empreinte trahit la falsification.
  await expect(page.getByTestId("replay-error")).toHaveText(
    "Ce replay ne peut pas être rejoué : ce combat se déroule autrement dans cette version du jeu.",
    { timeout: 30_000 },
  );
  await expect(menu.reviewBattle).toBeVisible();
});
