import type { Page } from "@playwright/test";
import { expect, readStoredSettings, seedSettings, test } from "../../fixtures";
import {
  connectPad,
  focusedDataValue,
  focusedTestId,
  holdPadUntil,
  PadButton,
  tapPadButton,
  withFakeGamepad,
} from "../../pages/gamepad";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, MusicPicker, TeamSelectScreen } from "../../pages/screens";

/*
 * Cahier §6.4 — la ligne « Musique » du bandeau de partie et sa modale (plan 239).
 *
 * 🔴 Aucun de ces scénarios n'écoute quoi que ce soit (musiques bloquées par le harnais, voir
 * `fixtures/music-block.ts`). Ce qui est vérifié ici est le CHOIX — ce que le bandeau affiche,
 * ce que la modale retient, où va le focus, ce qui est écrit dans les préférences. La lecture
 * elle-même (boucle, fondus, baisse sous un cri) est couverte en unitaire (`music-player.test.ts`,
 * `battle-audio.test.ts`) et reste une vérification humaine pour l'oreille.
 */

interface OpenedTeamSelect {
  teams: TeamSelectScreen;
  music: MusicPicker;
}

async function openTeamSelect(page: Page): Promise<OpenedTeamSelect> {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const teams = new TeamSelectScreen(page);
  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await expect(teams.title).toBeVisible();
  return { teams, music: new MusicPicker(page) };
}

/**
 * Ouvre la modale par de VRAIES pressions depuis « Changer » de la ligne Carte, juste au-dessus —
 * jamais par un `.focus()` sur la cible : c'est le chemin qui est en question.
 */
async function openPickerWithKeyboard(page: Page, music: MusicPicker): Promise<void> {
  await page.getByTestId("room-change-map").focus();
  await page.keyboard.press("ArrowDown");
  expect(await focusedTestId(page)).toBe("room-change-music");
  await page.keyboard.press("Enter");
  await expect(music.title).toBeVisible();
}

test("§6.4 musique : le bandeau s'ouvre sur « Aléatoire », la modale liste le tirage, le medley et les 26 pistes", async ({
  page,
}) => {
  const { music } = await openTeamSelect(page);
  await expect(music.name).toHaveText("Aléatoire");

  await music.changeButton.click();
  await expect(music.title).toBeVisible();

  await expect(music.listItems).toHaveCount(28);
  await expect(music.listItems.nth(0)).toHaveText("Aléatoire");
  await expect(music.listItems.nth(1)).toHaveText("Medley");
  await expect(music.item("bw-trainer")).toHaveText("Dresseur — Noir/Blanc");
  // La modale s'ouvre SUR le choix tenu : le joueur lit où il en est, et la manette a un départ.
  await expect(music.item("random")).toHaveAttribute("aria-current", "true");
  await expect(music.item("random")).toBeFocused();
});

// `.claude/rules/multi-input.md` : dans la liste, ↓ déplace le focus de ligne en ligne et Entrée
// choisit — un seul appui, sans confirmation. Échap referme sans rien changer. Dans les deux cas le
// focus revient sur le bouton qui a ouvert la modale.
test("§6.4 musique : au clavier, Échap ne change rien, Entrée choisit, et le focus revient sur « Changer »", async ({
  page,
}) => {
  const { music } = await openTeamSelect(page);

  await openPickerWithKeyboard(page, music);
  expect(await focusedDataValue(page, "musicId")).toBe("random");
  await page.keyboard.press("ArrowDown");
  expect(await focusedDataValue(page, "musicId")).toBe("medley");

  await page.keyboard.press("Escape");
  await expect(music.title).toHaveCount(0);
  await expect(music.name).toHaveText("Aléatoire");
  await expect.poll(() => focusedTestId(page)).toBe("room-change-music");

  await page.keyboard.press("Enter");
  await expect(music.title).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  expect(await focusedDataValue(page, "musicId")).toBe("dpp-trainer");

  await page.keyboard.press("Enter");
  await expect(music.title).toHaveCount(0);
  await expect(music.name).toHaveText("Dresseur — Diamant/Perle");
  await expect.poll(() => focusedTestId(page)).toBe("room-change-music");

  // Rouverte, la modale part de la piste retenue.
  await page.keyboard.press("Enter");
  await expect(music.item("dpp-trainer")).toHaveAttribute("aria-current", "true");
  await expect(music.item("dpp-trainer")).toBeFocused();
  await expect(music.item("random")).toHaveAttribute("aria-current", "false");
});

// La moitié « relecture » du choix persisté : `lastMusicId` est relu à l'arrivée sur l'écran, et la
// modale s'ouvre dessus.
test("§6.4 musique : la dernière musique choisie est relue des préférences", async ({ page }) => {
  await seedSettings(page, { lastMusicId: "medley" });
  const { music } = await openTeamSelect(page);

  await expect(music.name).toHaveText("Medley");

  await music.changeButton.click();
  await expect(music.item("medley")).toHaveAttribute("aria-current", "true");
  await expect(music.item("medley")).toBeFocused();
});

// La moitié « écriture » : le choix n'est retenu qu'au LANCEMENT, comme la carte — un choix
// abandonné en quittant l'écran ne devient pas une préférence.
test("§6.4 musique : le choix est écrit dans les préférences au lancement de la partie", async ({
  page,
}) => {
  const { teams, music } = await openTeamSelect(page);
  const storedMusicId = async (): Promise<unknown> => (await readStoredSettings(page)).lastMusicId;

  await music.changeButton.click();
  await music.item("xy-gym").click();
  await expect(music.name).toHaveText("Champion d'Arène — X/Y");
  expect(await storedMusicId()).toBeUndefined();

  await teams.giveSlotToAi();
  await teams.launch.click();

  await expect.poll(storedMusicId).toBe("xy-gym");
});

// `.claude/rules/multi-input.md` : à la manette, la croix rejoint « Changer » de la ligne Musique
// depuis celui de la ligne Carte, A ouvre la modale, la croix y descend et A choisit.
test("§6.4 musique : à la manette, la croix atteint la ligne Musique et A choisit une piste", async ({
  page,
}) => {
  await withFakeGamepad(page);
  const { music } = await openTeamSelect(page);
  await connectPad(page);

  await holdPadUntil(page, PadButton.DpadDown, async () => (await focusedTestId(page)) !== null);
  await holdPadUntil(page, PadButton.DpadRight, async () =>
    ["room-change-map", "room-change-music", "format-segment"].includes(
      (await focusedTestId(page)) ?? "",
    ),
  );
  await holdPadUntil(
    page,
    PadButton.DpadDown,
    async () => (await focusedTestId(page)) === "room-change-music",
  );

  await tapPadButton(page, PadButton.A);
  await expect(music.title).toBeVisible();
  expect(await focusedDataValue(page, "musicId")).toBe("random");

  await tapPadButton(page, PadButton.DpadDown);
  await expect.poll(() => focusedDataValue(page, "musicId")).toBe("medley");
  await tapPadButton(page, PadButton.A);

  await expect(music.title).toHaveCount(0);
  await expect(music.name).toHaveText("Medley");
  await expect.poll(() => focusedTestId(page)).toBe("room-change-music");
});
