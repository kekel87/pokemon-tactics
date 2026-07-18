import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  ANTICIPATION_REVEALS_ABILITY,
  ARENA_TRAP_PLAYER_TRAPPED,
  ARENA_TRAP_RELEASE,
  FOREWARN_REVEALS_MOVE,
  FRISK_REVEALS_ITEM,
  HARVEST_SUN_RESTORE,
  NEUTRALIZING_GAS_FAR,
  NEUTRALIZING_GAS_SUPPRESS,
} from "../../fixtures/sandbox-configs";
import type { CombatScene } from "../../pages/CombatScene";
import { InfoPanel } from "../../pages/combatHud";

// Cahier §5.37 — Content-fill des 7 derniers talents Gen 1 (plan 163). Chaque talent est PILOTABLE via
// l'UI sandbox (le joueur contrôle son mon ; `playerAbility`/`dummyAbility` overridables), donc on
// assert le SENS lisible : la ligne de journal FR (`BattleLogFormatter`), le badge volatile de
// l'InfoPanel au survol (`battle-views`) ou l'état désactivé du bouton d'action — jamais le pixel.
// Déterministe : seed moteur, aucun override `Math.random` (règle dure e2e). Délestage (unburden) est
// reporté (`docs/next.md`) : sa Vitesse ×2 n'est pas observable proprement en 1v1 → unit core.
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// Le survol est CONTINU dans le jeu réel : on re-survole à chaque itération du poll (robuste sans
// course) et on ne compte le badge QUE quand l'InfoPanel affiche bien le mon attendu.
function badgeCountOnHover(
  scene: CombatScene,
  info: InfoPanel,
  tile: { x: number; y: number },
  expectedName: string,
  badgeMatcher: string | RegExp,
): Promise<number> {
  return (async () => {
    await scene.hoverTile(tile.x, tile.y);
    if ((await info.name.textContent()) !== expectedName) {
      return -1;
    }
    return info.panel.getByText(badgeMatcher).count();
  })();
}

// ── Récolte (harvest) — fin de tour sous Soleil (100 %) recrée la baie consommée ──────────────────
// §5.37 Récolte : sous Soleil, la Baie Lichii mangée en fin de tour (pincement à 20 % PV) est
// restaurée DANS LA MÊME fin de tour (item onEndTurn court avant ability onEndTurn) → journal.
test("§5.37 Récolte : recrée la baie de pincement consommée en fin de tour (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(HARVEST_SUN_RESTORE);
  await scene.endTurn(); // « Attendre » → fin de tour : la baie se mange puis Récolte la recrée.
  await expect(log(page, /Récolte de Ronflex s'active/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Ronflex recycle son Baie Lichii/)).toBeAttached({ timeout: 10_000 });
});

// ── Piège Sable (arena-trap) — immobilise l'ennemi au sol adjacent (r1 Chebyshev) ─────────────────
// §5.37 Piège Sable : le joueur (Cran, non-exempt) est adjacent au dummy porteur → bouton
// « Deplacement » désactivé + badge « Piégé » sur l'InfoPanel du joueur (posés à l'init).
test("§5.37 Piège Sable : le mon piégé ne peut plus se déplacer (bouton désactivé)", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(ARENA_TRAP_PLAYER_TRAPPED);
  await expect(page.getByRole("button", { name: "Deplacement", exact: true })).toBeDisabled({
    timeout: 10_000,
  });
});

test("§5.37 Piège Sable : l'InfoPanel du mon piégé affiche le badge « Piégé »", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(ARENA_TRAP_PLAYER_TRAPPED);
  const info = new InfoPanel(page);
  await expect
    .poll(() => badgeCountOnHover(scene, info, { x: 2, y: 3 }, "Florizarre", "Piégé"), {
      timeout: 10_000,
    })
    .toBe(1);
});

// §5.37 Piège Sable — RUPTURE : le joueur porte le talent, le dummy (Cran) est piégé à l'init ; quand
// le joueur s'éloigne (Chebyshev > 1) le dummy est libéré → son badge « Piégé » disparaît.
test("§5.37 Piège Sable : le badge « Piégé » disparaît quand le porteur s'éloigne", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(ARENA_TRAP_RELEASE);
  const info = new InfoPanel(page);

  // À l'init, le dummy adjacent est piégé.
  await expect
    .poll(() => badgeCountOnHover(scene, info, { x: 2, y: 2 }, "Ronflex", "Piégé"), {
      timeout: 10_000,
    })
    .toBe(1);

  // Le joueur (porteur de Piège Sable) se déplace en (2,5) → distance 3 du dummy → rupture.
  await page.getByRole("button", { name: "Deplacement", exact: true }).click();
  await scene.clickTile(2, 5);

  await expect
    .poll(() => badgeCountOnHover(scene, info, { x: 2, y: 2 }, "Ronflex", "Piégé"), {
      timeout: 10_000,
    })
    .toBe(0);
});

// ── Gaz Inhibiteur (neutralizing-gas) — neutralise les talents ennemis dans un rayon Manhattan r2 ──
// §5.37 Gaz Inhibiteur : le dummy adjacent (r2) au porteur voit son talent neutralisé → badge
// « Talent neutralisé » à son survol ; le porteur ne s'auto-neutralise pas (aucun badge).
test("§5.37 Gaz Inhibiteur : le talent d'un ennemi à portée est neutralisé (badge)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(NEUTRALIZING_GAS_SUPPRESS);
  const info = new InfoPanel(page);
  await expect
    .poll(() => badgeCountOnHover(scene, info, { x: 2, y: 2 }, "Ronflex", "Talent neutralisé"), {
      timeout: 10_000,
    })
    .toBe(1);
});

test("§5.37 Gaz Inhibiteur : le porteur ne s'auto-neutralise pas (aucun badge)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(NEUTRALIZING_GAS_SUPPRESS);
  const info = new InfoPanel(page);
  await expect
    .poll(() => badgeCountOnHover(scene, info, { x: 2, y: 3 }, "Florizarre", "Talent neutralisé"), {
      timeout: 10_000,
    })
    .toBe(0);
});

// §5.37 Gaz Inhibiteur — portée bornée : un ennemi au-delà de r2 (Manhattan 3) n'est PAS neutralisé.
test("§5.37 Gaz Inhibiteur : un ennemi hors du rayon r2 n'est pas neutralisé (témoin)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(NEUTRALIZING_GAS_FAR);
  const info = new InfoPanel(page);
  await expect
    .poll(() => badgeCountOnHover(scene, info, { x: 2, y: 0 }, "Ronflex", "Talent neutralisé"), {
      timeout: 10_000,
    })
    .toBe(0);
});

// ── Fouille (frisk) — révèle l'objet des ennemis ──────────────────────────────────────────────────
// §5.37 Fouille : l'objet du dummy est révélé à l'entrée → badge « Objet : Restes » à son survol.
test("§5.37 Fouille : révèle l'objet de l'ennemi (badge « Objet : Restes »)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(FRISK_REVEALS_ITEM);
  const info = new InfoPanel(page);
  await expect
    .poll(() => badgeCountOnHover(scene, info, { x: 2, y: 2 }, "Ronflex", "Objet : Restes"), {
      timeout: 10_000,
    })
    .toBe(1);
});

// ── Prédiction (forewarn) — révèle la capacité la plus puissante des ennemis ───────────────────────
// §5.37 Prédiction : la capacité la plus forte du dummy est révélée → badge « Menace : {capacité} ».
// La capacité exacte dérive du moveset d'espèce → on assert le PRÉFIXE « Menace : » (robuste).
test("§5.37 Prédiction : révèle la menace de l'ennemi (badge « Menace : … »)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(FOREWARN_REVEALS_MOVE);
  const info = new InfoPanel(page);
  await expect
    .poll(() => badgeCountOnHover(scene, info, { x: 2, y: 2 }, "Ronflex", /^Menace : /), {
      timeout: 10_000,
    })
    .toBe(1);
});

// ── Anticipation (anticipation) — révèle le talent des ennemis (non-canon, plan 163) ──────────────
// §5.37 Anticipation : le talent du dummy est révélé → badge « Talent : Lévitation » à son survol.
test("§5.37 Anticipation : révèle le talent de l'ennemi (badge « Talent : Lévitation »)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(ANTICIPATION_REVEALS_ABILITY);
  const info = new InfoPanel(page);
  await expect
    .poll(() => badgeCountOnHover(scene, info, { x: 2, y: 2 }, "Ronflex", "Talent : Lévitation"), {
      timeout: 10_000,
    })
    .toBe(1);
});
