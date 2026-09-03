import { expect, test } from "../../fixtures";
import {
  DUEL_MUTUAL_KO,
  VICTORY_ROSTER_ALLY_FELL,
  VICTORY_ROSTER_WITH_LOSSES,
} from "../../fixtures/sandbox-configs";

// Cahier §4.10 — récapitulatif de la modale de fin de partie (plan 197) : sous le verdict, la rangée
// de portraits de l'équipe VAINQUEUR (K.O. grisés via `data-ko`) puis la ligne « N tours · durée ».
// L'unitaire de `ui-dom` tourne en environnement `node` : il ne couvre que le formateur de durée
// (`battle-chrome.test.ts`), jamais le DOM construit ici. C'est donc l'e2e qui tient la rangée.
// Le testid `battle-over` de la dialog appartient au harnais du plan 194 — on le LIT, on n'y touche
// pas. On assert le SENS (présence/absence, effectif, état K.O. par portrait), jamais le pixel :
// le GRISEMENT lui-même est un filtre CSS, donc 👁.

// La rangée n'existe que s'il y a une équipe à mettre en avant : sur un match nul `winnerId` est
// `null`, donc AUCUNE rangée — l'absence du nœud, pas un nœud vide. La ligne de stats, elle, reste.
test("§4.10 match nul : aucune rangée de portraits, la ligne de statistiques demeure", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(DUEL_MUTUAL_KO);
  await scene.castFirstMove(2, 3); // Destruction : motif auto-centré → la propre case du lanceur

  const dialog = page.getByTestId("battle-over");
  await expect(dialog.getByRole("heading")).toHaveText("Match nul", { timeout: 10_000 });
  await expect(page.getByTestId("victory-roster")).toHaveCount(0);
  await expect(page.getByTestId("victory-stats")).toBeVisible();
});

// L'effectif, pas les survivants : les deux coéquipiers nés K.O. (`hp: 0`) comptent dans la rangée.
test("§4.10 victoire : la rangée liste tout l'effectif du vainqueur, K.O. marqués", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(VICTORY_ROSTER_WITH_LOSSES);
  await scene.castFirstMove(3, 4); // Griffe (portée 1) sur le dummy adjacent → dernier ennemi à terre

  const roster = page.getByTestId("victory-roster");
  await expect(roster).toBeVisible({ timeout: 10_000 });
  await expect(roster.getByRole("img")).toHaveCount(3);
  await expect(roster.getByRole("img", { name: "Florizarre" })).not.toHaveAttribute("data-ko");
  await expect(roster.getByRole("img", { name: "Dracaufeu" })).toHaveAttribute("data-ko", "true");
  await expect(roster.getByRole("img", { name: "Tortank" })).toHaveAttribute("data-ko", "true");

  // « 1 tour » a sa propre clé (pas de mécanisme de pluriel dans le projet), et la durée a trois
  // paliers : « 12 s » sous la minute, « 1 min 05 », « 1 h 07 » au-delà de l'heure — le temps de jeu
  // étant cumulé sur les reprises, le dernier est atteignable. La durée est toujours présente ; seul
  // son ordre de grandeur dépend de la machine.
  await expect(page.getByTestId("victory-stats")).toHaveText(
    /^(1 tour|\d+ tours) · (\d+ s|\d+ min \d{2}|\d+ h \d{2})$/,
  );
});

// Le cas de régression du plan 197 : le récapitulatif se dérive de `currentHp <= 0` dans
// `state.pokemon`. Un moteur qui retirerait un corps de l'état ferait DISPARAÎTRE le portrait au
// lieu de le griser — silencieusement, puisque le compte resterait cohérent avec les survivants.
test("§4.10 victoire : un allié tombé pendant le combat reste dans la rangée, marqué K.O.", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(VICTORY_ROSTER_ALLY_FELL);
  await scene.castFirstMove(2, 4); // Séisme : Zone auto-centrée → la propre case du lanceur

  const roster = page.getByTestId("victory-roster");
  await expect(roster).toBeVisible({ timeout: 10_000 });
  await expect(roster.getByRole("img")).toHaveCount(2);
  await expect(roster.getByRole("img", { name: "Alakazam" })).not.toHaveAttribute("data-ko");
  await expect(roster.getByRole("img", { name: "Florizarre" })).toHaveAttribute("data-ko", "true");
});
