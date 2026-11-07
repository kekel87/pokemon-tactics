import { expect, test } from "../../fixtures";
import { BALLOON_UNDER_MAGIC_ROOM } from "../../fixtures/sandbox-configs";

// Plan 249 : sous une Zone Magique le Ballon ne compte plus. On assert le SENS par les surbrillances de
// portée (`highlight_move_x_y`) : la lave (0,5) couverte par la zone n'est pas proposée au porteur,
// l'eau profonde (5,5), hors zone, l'est (le Ballon lévite).

test("plan 249 : lave en Zone Magique non proposée à un porteur de Ballon, eau profonde hors zone oui", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(BALLOON_UNDER_MAGIC_ROOM);
  await page.getByRole("button", { name: "Déplacement", exact: true }).click();
  await expect
    .poll(async () => (await scene.meshNamesStartingWith("highlight_move_")).length)
    .toBeGreaterThan(0);
  const reachable = new Set(
    (await scene.meshNamesStartingWith("highlight_move_")).map((name) =>
      name.replace("highlight_move_", ""),
    ),
  );

  expect(reachable.has("5_5")).toBe(true);
  expect(reachable.has("0_5")).toBe(false);
});
