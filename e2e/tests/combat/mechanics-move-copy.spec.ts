import { expect, test } from "../../fixtures";
import { MOVE_COPY_METRONOME, MOVE_COPY_MIMIC } from "../../fixtures/sandbox-configs";

// Cahier §5.28 — famille Move-copy (plan 144), pilotée à travers le renderer. Les unit/integration core
// couvrent la résolution pure (tirage PRNG, exclusions, verrou anti-reroll, gate sommeil, échecs sans
// dernier move, PP du slot). Ici on prouve les DEUX signaux observables les plus nets et déterministes :
// (1) Copie (`mimic`) mute son slot → journal « <X> apprend <Y> ! » (event MoveCopied) + le sous-menu
// d'attaque liste le move copié à la place de Copie ; (2) Métronome (`metronome`) appelle un move tiré
// qui s'exécute via l'orchestrateur → ligne de révélation « Métronome → <move tiré> ». On assert le SENS
// (ligne de journal FR / libellé du menu), jamais le pixel. Blabla Dodo / Mimique / Photocopie /
// Gribouille = 👁 (gate sommeil / historique de move / équivalence avec Copie) — couverts unit core.
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// §5.28 Copie : le dummy joue Plaquage au tour 1 (IA) → au tour 2 le joueur lance Copie sur lui →
// le slot Copie devient Plaquage. Le journal FR « Alakazam apprend Plaquage ! » (MoveCopied) monte.
test("§5.28 Copie : remplace le slot par le dernier move de la cible (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(MOVE_COPY_MIMIC);

  // Tour 1 : le joueur attend, l'IA du dummy joue son Plaquage → pose son lastUsedMoveId="body-slam".
  await scene.endTurn();
  await expect(log(page, /Ronflex utilise Plaquage/)).toBeAttached({ timeout: 10_000 });

  // Tour 2 : le joueur lance Copie sur le dummy adjacent (2,2).
  await scene.castFirstMove(2, 2);
  await expect(log(page, /Alakazam apprend Plaquage/)).toBeAttached({ timeout: 10_000 });
});

// §5.28 Copie : après la mutation, le sous-menu d'attaque liste « Plaquage » à la place de « Copie »
// (le slot a bien été réécrit, jouable au tour suivant). On lit le libellé du move-item du menu.
test("§5.28 Copie : le sous-menu d'attaque liste le move copié à la place de Copie", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(MOVE_COPY_MIMIC);

  await scene.endTurn();
  await expect(log(page, /Ronflex utilise Plaquage/)).toBeAttached({ timeout: 10_000 });

  await scene.castFirstMove(2, 2);
  await expect(log(page, /Alakazam apprend Plaquage/)).toBeAttached({ timeout: 10_000 });

  // Le tour du joueur s'achève sur le cast de Copie : on attend (fin de tour → l'IA rejoue) pour revenir
  // sur Alakazam avec un menu d'action FRAIS. Le sous-menu d'attaque liste alors « Plaquage » (slot muté,
  // jouable au tour suivant) et plus « Copie ».
  await scene.endTurn();
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  const moveName = page.getByTestId("move-name");
  await expect(moveName.filter({ hasText: "Plaquage" })).toBeAttached({ timeout: 10_000 });
  await expect(moveName.filter({ hasText: "Copie" })).toHaveCount(0);
});

// §5.28 Métronome : le joueur lance Métronome → l'engine tire un move (PRNG seedé), le renderer entre en
// ciblage à NOM MASQUÉ, le joueur place sur le dummy adjacent → le move appelé s'exécute. La preuve la
// plus nette de la réentrance est la ligne de RÉVÉLATION du journal « Métronome → <move tiré> » (event
// MoveStarted avec resolvedMoveId du move appelé). On assert le SENS (un move a bien été appelé), pas
// l'identité exacte du move tiré (dépend du seed + roster).
test("§5.28 Métronome : appelle et exécute un move tiré (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(MOVE_COPY_METRONOME);

  await scene.castFirstMove(2, 2); // tirer -> placer sur le dummy adjacent -> exécuter
  await expect(log(page, /Métronome → .+/)).toBeAttached({ timeout: 10_000 });
});
