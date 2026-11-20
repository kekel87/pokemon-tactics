import { expect, test } from "../../fixtures";

const TEAMS_WITHOUT_TRAINER = [
  {
    control: "player",
    members: [{ pokemon: "venusaur", moves: ["scratch"], position: { x: 2, y: 3 } }],
  },
  {
    control: "passive",
    members: [{ pokemon: "dummy", position: { x: 2, y: 2 } }],
  },
] as const;

const TEAMS_WITH_RED = [{ ...TEAMS_WITHOUT_TRAINER[0], trainer: "red" }, TEAMS_WITHOUT_TRAINER[1]];

test("dresseur : Red choisi sur l'équipe 1 s'affiche dans la liste et ouvre la liste d'animations", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox({ seed: 12345, teams: TEAMS_WITH_RED });

  await expect(page.getByTestId("sandbox-trainer-0")).toHaveValue("red");
  await expect(page.getByTestId("sandbox-trainer-0").locator("option:checked")).toHaveText("Red");
  await expect(page.getByTestId("sandbox-trainer-animation-0")).toBeVisible();
  await expect(page.getByTestId("sandbox-trainer-animation-1")).toHaveCount(0);
});

test("dresseur : sans dresseur, aucune liste d'animations", async ({ page, bootSandbox }) => {
  await bootSandbox({ seed: 12345, teams: TEAMS_WITHOUT_TRAINER });

  await expect(page.getByTestId("sandbox-trainer-0")).toHaveValue("");
  await expect(page.getByTestId("sandbox-trainer-animation-0")).toHaveCount(0);
});
