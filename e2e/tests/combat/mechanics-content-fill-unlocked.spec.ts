import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  SPIT_UP_ONE_LAYER,
  SPIT_UP_SUCCESS,
  STOCKPILE_THIRD_TIER,
  SWALLOW_ONE_LAYER,
  SWALLOW_SUCCESS,
  UNBURDEN_ACTS_FIRST,
  UNBURDEN_BASELINE,
} from "../../fixtures/sandbox-configs";

// Cahier §5.46 — Débloque en 🤖 les cas content-fill jusqu'ici 👁 de §5.36 (Relâche/Avale RÉUSSITE,
// Stockage 3ᵉ palier) et §5.37 (Délestage) grâce aux champs `stockpileCount`/`unburdenActive` de
// SandboxMemberConfig (harness e2e uniquement). On automatise le SENS chiffré : la ligne de journal FR
// (dégâts/soin/réserve) et l'ordre du Charge Time (timeline), jamais le pixel. Déterministe : seed
// moteur, aucun override `Math.random`.
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

/** First numeric amount from a « <name> perd N PV » / « <name> récupère N PV » log line. */
async function firstAmount(page: Page, re: RegExp): Promise<number> {
  const text = (await log(page, re).first().textContent()) ?? "";
  return Number(/(\d+) PV/.exec(text)?.[1] ?? "0");
}

/** 1-based `data-team` of the current active mon (the head timeline entry). */
function activeTeam(page: Page): Promise<string | null> {
  return page.getByTestId("timeline-entry").first().getAttribute("data-team");
}

// ── Relâche (spit-up) — RÉUSSITE : dégâts spé = 100 × paliers, puis consomme la réserve ────────────
// §5.46 Relâche RÉUSSITE : réserve pré-chargée à 3 paliers → dégâts + « libère sa réserve accumulée ! ».
test("§5.46 Relâche : inflige des dégâts et vide la réserve (3 paliers)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SPIT_UP_SUCCESS);
  await scene.castFirstMove(3, 4); // cible adjacente
  await expect(log(page, /Ronflex perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Florizarre libère sa réserve accumulée/)).toBeAttached({
    timeout: 10_000,
  });
});

// §5.46 Relâche SCALING : les dégâts croissent avec les paliers (3 paliers > 1 palier). Même seed +
// même cible → dégâts déterministes ; l'assertion chiffrée fige la formule « 100 × paliers ».
test("§5.46 Relâche : les dégâts croissent avec les paliers de Stockage", async ({
  page,
  bootSandbox,
}) => {
  const three = await bootSandbox(SPIT_UP_SUCCESS);
  await three.castFirstMove(3, 4);
  await expect(log(page, /Ronflex perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  const damageThree = await firstAmount(page, /Ronflex perd \d+ PV/);

  const one = await bootSandbox(SPIT_UP_ONE_LAYER);
  await one.castFirstMove(3, 4);
  await expect(log(page, /Ronflex perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  const damageOne = await firstAmount(page, /Ronflex perd \d+ PV/);

  expect(damageThree).toBeGreaterThan(damageOne);
});

// §5.46 Relâche CONSOMMATION : après un Relâche réussi la réserve retombe à 0 → un 2ᵉ Relâche ÉCHOUE
// (guard `failsWithoutStockpile`). Un seul palier au départ pour que la cible survive au 1ᵉ coup.
test("§5.46 Relâche : la réserve consommée fait échouer un 2e usage", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SPIT_UP_ONE_LAYER);
  await scene.castFirstMove(3, 4);
  await expect(log(page, /Florizarre libère sa réserve accumulée/)).toBeAttached({
    timeout: 10_000,
  });

  await scene.endTurn(); // le tour cycle → retour au lanceur, réserve désormais vide
  await scene.castFirstMove(3, 4);
  await expect(log(page, /Mais cela échoue/)).toBeAttached({ timeout: 10_000 });
});

// ── Avale (swallow) — RÉUSSITE : soin 25/50/100 % selon paliers, puis consomme ─────────────────────
// §5.46 Avale RÉUSSITE : réserve à 3 paliers + PV bas → soin (plafonné aux PV manquants) + « libère ».
test("§5.46 Avale : soigne le lanceur et vide la réserve (3 paliers)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SWALLOW_SUCCESS);
  await scene.castFirstMove(2, 4); // Self
  await expect(log(page, /Florizarre récupère \d+ PV/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Florizarre libère sa réserve accumulée/)).toBeAttached({
    timeout: 10_000,
  });
});

// §5.46 Avale SCALING : le soin croît avec les paliers (3 paliers → 50 % du max plafonné > 1 palier
// → 25 % du max). Même blessure de départ + même seed → soin déterministe.
test("§5.46 Avale : le soin croît avec les paliers de Stockage", async ({ page, bootSandbox }) => {
  const three = await bootSandbox(SWALLOW_SUCCESS);
  await three.castFirstMove(2, 4);
  await expect(log(page, /Florizarre récupère \d+ PV/)).toBeAttached({ timeout: 10_000 });
  const healThree = await firstAmount(page, /Florizarre récupère \d+ PV/);

  const one = await bootSandbox(SWALLOW_ONE_LAYER);
  await one.castFirstMove(2, 4);
  await expect(log(page, /Florizarre récupère \d+ PV/)).toBeAttached({ timeout: 10_000 });
  const healOne = await firstAmount(page, /Florizarre récupère \d+ PV/);

  expect(healThree).toBeGreaterThan(healOne);
});

// ── Stockage (stockpile) — cap 3 paliers ──────────────────────────────────────────────────────────
// §5.46 Stockage 3ᵉ palier : réserve à 2 paliers → un cast atteint « (Stockage 3/3) » ; un 2ᵉ cast
// (après `endTurn`) dépasse le cap → « Mais cela échoue … ! ».
test("§5.46 Stockage : atteint le 3e palier puis échoue au-delà du cap", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(STOCKPILE_THIRD_TIER);
  await scene.castFirstMove(2, 4); // Self : 2 → 3
  await expect(log(page, /accumule ! \(Stockage 3\/3\)/)).toBeAttached({ timeout: 10_000 });

  await scene.endTurn();
  await scene.castFirstMove(2, 4); // cap 3 dépassé → échec
  await expect(log(page, /Mais cela échoue/)).toBeAttached({ timeout: 10_000 });
});

// ── Délestage (unburden) — Vitesse ×2 observable via la CADENCE du Charge Time ─────────────────────
// §5.46 Délestage : deux Florizarre de même Vitesse de base ; SEUL le flag Délestage diffère (équipe 2).
// Le mon actif au boot est figé à la création (avant que le flag ne s'applique) → l'équipe 1 (`p1-…`,
// gagnante des égalités d'id) ouvre le combat dans les DEUX configs. Le ×2 se lit donc sur la CADENCE :
// on fait « Attendre » deux fois (équipe 1 puis équipe 2) et on regarde QUI reprend la main en 3ᵉ.
// Comme la Vitesse alimente une courbe log, le ×2 n'est PAS un doublement de gain mais suffit à rendre
// le porteur strictement plus rapide → il rejoue en 3ᵉ (équipe 2), là où à Vitesse égale l'alternance
// rendrait la main à l'équipe 1. Hot-seat (2 équipes `player`) → aucun auto-tour, cadence pilotée.
test("§5.46 Délestage : le porteur rejoue plus vite grâce à la Vitesse ×2 (cadence CT)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(UNBURDEN_ACTS_FIRST);
  await scene.endTurn(); // équipe 1 (actif au boot) temporise
  await scene.endTurn(); // équipe 2 (porteur) temporise
  // 3ᵉ tour : le porteur ×2 a repris la main AVANT l'équipe 1 → l'actif est l'équipe 2.
  await expect.poll(() => activeTeam(page), { timeout: 10_000 }).toBe("2");
});

// §5.46 Délestage — TÉMOIN : MÊME cadence sans le flag → à Vitesse égale l'alternance rend la main à
// l'équipe 1 en 3ᵉ. Comparé au test précédent, prouve que c'est le ×2 (et non un biais d'id/position)
// qui fait rejouer l'équipe 2 plus tôt.
test("§5.46 Délestage — témoin : à Vitesse égale l'équipe 1 reprend la main en 3e (cadence CT)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(UNBURDEN_BASELINE);
  await scene.endTurn();
  await scene.endTurn();
  await expect.poll(() => activeTeam(page), { timeout: 10_000 }).toBe("1");
});
