import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  AFTER_YOU_PROMOTES,
  ALLY_SWITCH_SWAP,
  FOLLOW_ME_DRAWS,
  FOLLOW_ME_OUT_OF_RANGE,
  RAGE_POWDER_GRASS_IMMUNE,
  RAGE_POWDER_HITS,
} from "../../fixtures/sandbox-configs";

// Cahier §5.45 — Batch E « grille » (plan 155) via le harness N-vs-N (plan 167). Quatre moves
// hors-pool Gen 1 dont l'identité canon (redirection / priorité / switch forcé) est réinterprétée sur
// la grille + le Charge Time. On automatise le SENS lisible : la ligne de journal FR
// (`BattleLogFormatter`), l'ordre CT (timeline / mon actif) ou la position de scène (`spriteStates`),
// jamais le pixel. Déterministe : seed moteur, moves statut (aucun jet), aucun override `Math.random`.
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// ── Par Ici (follow-me) — Zone r4 Self : pivote les ennemis en zone pour faire face au lanceur ─────
// §5.45 Par Ici — HIT : un ennemi dans le diamant r4 pivote → « … attire l'attention ! … ».
test("§5.45 Par Ici : attire l'attention d'un ennemi à portée (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(FOLLOW_ME_DRAWS);
  await scene.castFirstMove(2, 4); // Zone Self → propre case
  await expect(log(page, /Florizarre attire l'attention/)).toBeAttached({ timeout: 10_000 });
});

// §5.45 Par Ici — HORS zone : un ennemi au-delà de r4 ne pivote pas → le move se lance (« utilise Par
// Ici ! ») mais AUCUNE ligne « attire l'attention » (affectedIds vide). Prouve la borne de la Zone r4.
test("§5.45 Par Ici : n'affecte pas un ennemi hors du rayon r4 (témoin)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(FOLLOW_ME_OUT_OF_RANGE);
  await scene.castFirstMove(2, 4);
  await expect(log(page, /Florizarre utilise Par Ici/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /attire l'attention/)).toHaveCount(0);
});

// ── Poudre Fureur (rage-powder) — idem Par Ici, mais move POUDRE (immunité Plante/…) ──────────────
// §5.45 Poudre Fureur — HIT : un ennemi NON immunisé (Ronflex, Normal) pivote → « … attire l'attention ! ».
test("§5.45 Poudre Fureur : attire l'attention d'un ennemi non immunisé (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(RAGE_POWDER_HITS);
  await scene.castFirstMove(2, 4);
  await expect(log(page, /Florizarre attire l'attention/)).toBeAttached({ timeout: 10_000 });
});

// §5.45 Poudre Fureur — IMMUNITÉ poudre : un ennemi Plante DANS la zone r4 ne pivote PAS → le move se
// lance (« utilise Poudre Fureur ! ») mais AUCUNE ligne « attire l'attention ». Contraste avec Par Ici
// (qui tournerait ce même Plante) → prouve que c'est le flag POUDRE qui bloque, pas la portée.
test("§5.45 Poudre Fureur : un ennemi Plante est immunisé (aucune attirance)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(RAGE_POWDER_GRASS_IMMUNE);
  await scene.castFirstMove(2, 4);
  await expect(log(page, /Florizarre utilise Poudre Fureur/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /attire l'attention/)).toHaveCount(0);
});

// ── Après Vous (after-you) — Single r3 allié : promotion stricte au prochain tour CT ───────────────
// §5.45 Après Vous : l'allié LENT ciblé est promu prochain (« … va agir juste après ! ») ET, après
// `endTurn`, devient l'actif AVANT l'ennemi RAPIDE (le portrait de tête de la timeline est l'allié).
test("§5.45 Après Vous : promeut l'allié au prochain tour CT (journal + ordre d'action)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(AFTER_YOU_PROMOTES);
  await scene.castFirstMove(3, 4); // cible = case de l'allié Ronflex
  await expect(log(page, /Ronflex va agir juste après/)).toBeAttached({ timeout: 10_000 });

  // Fin du tour du lanceur → la promotion est consommée dans `advanceTurn` : Ronflex (lent) devient
  // l'actif, DEVANT l'Électrode (rapide) qui aurait joué en premier sans la promotion. Le portrait de
  // tête de la timeline (mon actif) est donc Ronflex.
  await scene.endTurn();
  await expect
    .poll(() => page.getByTestId("timeline-portrait").first().getAttribute("data-pokemon-id"), {
      timeout: 10_000,
    })
    .toBe("snorlax");
});

// ── Interversion (ally-switch) — Single r3 allié : échange de positions lanceur↔allié ──────────────
// §5.45 Interversion : le lanceur et l'allié échangent leur case → journal AlliesSwapped + positions
// effectivement permutées dans la scène (Florizarre ↔ Ronflex).
test("§5.45 Interversion : échange les positions du lanceur et de l'allié (journal + scène)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(ALLY_SWITCH_SWAP);
  await scene.castFirstMove(2, 5); // cible = case de l'allié Ronflex

  await expect(log(page, /Florizarre et Ronflex échangent leur place/)).toBeAttached({
    timeout: 10_000,
  });

  // Après l'échange : Florizarre occupe l'ancienne case de l'allié (2,5), Ronflex celle du lanceur (2,4).
  await expect
    .poll(
      async () => {
        const states = await scene.spriteStates();
        const venusaur = states.find((s) => s.pokemonId === "venusaur");
        const snorlax = states.find((s) => s.pokemonId === "snorlax");
        return { venusaur: venusaur?.tile, snorlax: snorlax?.tile };
      },
      { timeout: 10_000 },
    )
    .toEqual({ venusaur: { x: 2, y: 5 }, snorlax: { x: 2, y: 4 } });
});
