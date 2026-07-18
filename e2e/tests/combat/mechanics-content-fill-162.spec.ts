import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { DUEL, UPPER_HAND_FIZZLE, UPPER_HAND_HIT } from "../../fixtures/sandbox-configs";
import type { CombatScene } from "../../pages/CombatScene";
import { InfoPanel, WeatherHud } from "../../pages/combatHud";

// Cahier §5.36 — Content-fill des 9 derniers moves Gen 1 (plan 162). Chaque move est PILOTABLE par le
// joueur en sandbox (le lanceur est en contrôle humain), donc on l'exécute de bout en bout et on
// assert le SENS lisible : la ligne de journal FR (`BattleLogFormatter`), le badge volatile de
// l'InfoPanel (`battle-views`) ou le HUD météo — jamais le pixel. Déterministe : seed moteur, aucun
// override `Math.random` (règle dure e2e). Observables réservés à unit/multi-tours : voir bas de
// fichier + `docs/next.md`.
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// Spawns par défaut à 3 cases (joueur (2,4) / dummy (2,1)) → approche en (1,1), adjacent au dummy
// (identique à mechanics-priority-timing : la case (2,2) devant le dummy est bloquée par la zone de
// contrôle, (1,1) est franchissable ; les Single 1-1 sont omnidirectionnels). Le pas n'ouvre pas
// l'horloge d'action (lastActedAtAction stampé en FIN de tour seulement).
async function approachDummy(scene: CombatScene, page: Page): Promise<void> {
  await page.getByRole("button", { name: "Deplacement", exact: true }).click();
  await scene.clickTile(1, 1);
  await expect(page.getByRole("button", { name: "Annuler deplacement", exact: true })).toBeVisible({
    timeout: 10_000,
  });
}

// ── Stockage (stockpile) — accumulateur 1→3 paliers (Déf/Déf.Spé +1/palier) ──────────────────────
// §5.36 Stockage : le lanceur accumule un palier → journal « accumule ! (Stockage 1/3) » (Stockpiled).
test("§5.36 Stockage : accumule un palier (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["stockpile"] });
  await scene.castFirstMove(2, 3); // self
  await expect(log(page, /accumule ! \(Stockage 1\/3\)/)).toBeAttached({ timeout: 10_000 });
});

// §5.36 Stockage : le palier persistant remonte dans l'InfoPanel sous forme de badge « Stockage 1 »
// (survol de la case du lanceur, re-survol à chaque itération du poll — le survol est continu dans le
// jeu réel, robuste sans course).
test("§5.36 Stockage : l'InfoPanel du lanceur affiche le badge « Stockage 1 »", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["stockpile"] });
  const info = new InfoPanel(page);

  await scene.castFirstMove(2, 3);
  await expect(log(page, /accumule ! \(Stockage 1\/3\)/)).toBeAttached({ timeout: 10_000 });

  const badge = info.panel.getByText("Stockage 1", { exact: true });
  await expect
    .poll(
      async () => {
        await scene.hoverTile(2, 3);
        if ((await info.name.textContent()) !== "Florizarre") {
          return 0;
        }
        return badge.count();
      },
      { timeout: 10_000 },
    )
    .toBe(1);
});

// §5.36 Stockage : un 2e usage (sur un 2e tour, la 1ʳᵉ action ne termine pas le tour → endTurn) empile
// un 2e palier → journal « (Stockage 2/3) ». Le dummy AI inerte ne fait que temporiser.
test("§5.36 Stockage : un 2e usage empile un 2e palier (Stockage 2/3)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["stockpile"] });

  await scene.castFirstMove(2, 3);
  await expect(log(page, /accumule ! \(Stockage 1\/3\)/)).toBeAttached({ timeout: 10_000 });
  await scene.endTurn(); // fin du tour 1 → le dummy temporise → retour au joueur (tour 2)

  await scene.castFirstMove(2, 3);
  await expect(log(page, /accumule ! \(Stockage 2\/3\)/)).toBeAttached({ timeout: 10_000 });
});

// ── Relâche (spit-up) — dégâts spé = 100 × paliers, consomme ─────────────────────────────────────
// §5.36 Relâche : sans réserve accumulée (0 palier), le move ÉCHOUE (guard `failsWithoutStockpile`) →
// « Mais cela échoue … ! », 0 dégât. Le cas RÉUSSITE (dégâts × paliers + badge consommé) nécessite de
// pré-charger la réserve (aucun champ `stockpileCount` dans SandboxConfig) → couvert unit core.
test("§5.36 Relâche : échoue sans réserve accumulée (Mais cela échoue)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["spit-up"] });
  await scene.castFirstMove(2, 2); // cible (dummy adjacent)
  await expect(log(page, /Mais cela échoue/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /perd \d+ PV/)).toHaveCount(0);
});

// ── Avale (swallow) — soin 25/50/100 % selon paliers, consomme ────────────────────────────────────
// §5.36 Avale : sans réserve accumulée, le move ÉCHOUE (même guard). Le soin par paliers = unit core.
test("§5.36 Avale : échoue sans réserve accumulée (Mais cela échoue)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["swallow"], hp: 50 });
  await scene.castFirstMove(2, 3); // self
  await expect(log(page, /Mais cela échoue/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /récupère \d+ PV/)).toHaveCount(0);
});

// ── Prio-Parade (upper-hand) — fraîcheur d'action (comme Coup Bas) + flinch 100 % ─────────────────
// §5.36 Prio-Parade — RÉUSSITE : la dernière action de la cible était offensive → le coup TOUCHE, et
// l'apeurement 100 % skippe le tour suivant du dummy (« … est apeuré et ne peut pas agir ! »).
test("§5.36 Prio-Parade : touche une cible agressive puis l'apeure", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(UPPER_HAND_HIT);

  // Tour 1 (Persian, rapide) : s'approche puis TEMPORISE pour laisser le dummy agir.
  await approachDummy(scene, page);
  await scene.endTurn();

  // Tour du dummy (hot-seat) : il attaque Persian avec Charge → sa dernière action est offensive.
  await scene.castFirstMove(1, 1);
  await expect(log(page, /Persian perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  await scene.endTurn();

  // Tour 2 (Persian) : Prio-Parade → cible agressive → TOUCHE + apeure.
  await scene.castFirstMove(2, 1);
  await expect(log(page, /Ronflex perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  await scene.endTurn(); // le dummy tente d'agir mais est apeuré
  await expect(log(page, /est apeuré et ne peut pas agir/)).toBeAttached({ timeout: 10_000 });
});

// §5.36 Prio-Parade — ÉCHEC : la cible n'a pas (encore) attaqué → fizzle (« Mais cela échoue »).
test("§5.36 Prio-Parade : échoue si la cible n'a pas attaqué (Mais cela échoue)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(UPPER_HAND_FIZZLE);

  await approachDummy(scene, page);
  await scene.castFirstMove(2, 1);
  await expect(log(page, /Mais cela échoue/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Ronflex perd \d+ PV/)).toHaveCount(0);
});

// ── Piège de Venin (venom-drench) — baisse Atq/Atq.Spé/Vit d'une cible EMPOISONNÉE ────────────────
// §5.36 Piège de Venin — RÉUSSITE : cible empoisonnée → baisse 3 stats → journal « … baisse ! ».
test("§5.36 Piège de Venin : baisse les stats d'une cible empoisonnée", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["venom-drench"], dummyStatus: "poisoned" });
  await scene.castFirstMove(2, 2); // cible empoisonnée
  // Les 3 stats (Attaque, Atq. Spé., Vitesse) baissent → 3 lignes de journal « … baisse ! ».
  await expect(log(page, /baisse/)).toHaveCount(3, { timeout: 10_000 });
});

// §5.36 Piège de Venin — ÉCHEC : cible NON empoisonnée → « Mais cela échoue … ! », aucune baisse.
test("§5.36 Piège de Venin : échoue sur une cible non empoisonnée (Mais cela échoue)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["venom-drench"] });
  await scene.castFirstMove(2, 2);
  await expect(log(page, /Mais cela échoue/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /baisse/)).toHaveCount(0);
});

// ── Rayon Lune (moonlight) / Aurore (morning-sun) — soin météo-dépendant (même handler) ───────────
// §5.36 Rayon Lune : lanceur à PV réduits (hp: 50), hors météo spéciale → soin ½ → « récupère N PV ».
test("§5.36 Rayon Lune : soigne le lanceur (récupère N PV)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["moonlight"], hp: 50 });
  await scene.castFirstMove(2, 3); // self
  await expect(log(page, /récupère \d+ PV/)).toBeAttached({ timeout: 10_000 });
});

// §5.36 Aurore : identique à Rayon Lune (même handler `handle-heal-self` résolu par l'id du move).
test("§5.36 Aurore : soigne le lanceur (récupère N PV)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["morning-sun"], hp: 50 });
  await scene.castFirstMove(2, 3); // self
  await expect(log(page, /récupère \d+ PV/)).toBeAttached({ timeout: 10_000 });
});

// ── Partage Garde (guard-split) — moyenne Déf+Déf.Spé lanceur↔cible ───────────────────────────────
// §5.36 Partage Garde : Single r3 sur le dummy → journal « … partage sa Garde avec … ! » (GuardSplit).
test("§5.36 Partage Garde : partage la Garde avec la cible (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["guard-split"] });
  await scene.castFirstMove(2, 2); // cible
  await expect(log(page, /partage sa Garde avec/)).toBeAttached({ timeout: 10_000 });
});

// ── Métalaser (steel-beam) — Acier Spé Ligne 3, recul 50 % PV MAX (peut auto-K.O.) ────────────────
// Métalaser a 95 % de précision → seed choisi pour TOUCHER de façon déterministe (aucun override
// `Math.random`). Le dummy est endurant (`dummyHp: 999`) pour survivre au coup et isoler le recul.
// §5.36 Métalaser : touche la cible ET s'inflige un recul (le LANCEUR perd des PV).
test("§5.36 Métalaser : touche la cible et s'inflige un recul", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["steel-beam"], dummyHp: 999 });
  await scene.castFirstMove(2, 2); // Ligne 3 vers le nord → touche le dummy adjacent
  await expect(log(page, /Florizarre perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
});

// §5.36 Métalaser : le recul = 50 % des PV MAX → un lanceur à bas PV s'AUTO-K.O. après le coup.
test("§5.36 Métalaser : le recul auto-K.O. un lanceur à bas PV", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["steel-beam"], hp: 30, dummyHp: 999 });
  await scene.castFirstMove(2, 2);
  await expect(log(page, /Florizarre est K\.O\./)).toBeAttached({ timeout: 10_000 });
});

// ── Grêle (hail) — pose la météo Neige 5 tours ────────────────────────────────────────────────────
// §5.36 Grêle : Self → pose la Neige → journal « utilise Grêle ! » + HUD météo « Neige ».
test("§5.36 Grêle : pose la Neige (journal + HUD météo)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox({ ...DUEL, moves: ["hail"] });
  const weather = new WeatherHud(page);

  await scene.castFirstMove(2, 3); // self/field
  await expect(log(page, /utilise Grêle/)).toBeAttached({ timeout: 10_000 });
  await expect(weather.label).toHaveText("Neige", { timeout: 10_000 });
});
