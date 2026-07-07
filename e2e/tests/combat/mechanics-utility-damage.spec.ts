import { expect, test } from "../../fixtures";
import {
  ANTI_AIR,
  ANTI_AIR_CONTROL,
  FALSE_SWIPE,
  FEINT_THROUGH_PROTECT,
  PURSUIT_BACKSTAB,
  PURSUIT_FRONTAL,
  SUPER_FANG,
  VITAL_THROW,
} from "../../fixtures/sandbox-configs";
import { InfoPanel } from "../../pages/combatHud";

// Cahier §5.33 — Misc Batch B : dégâts utilitaires (plan 152). Six moves dont l'identité est un
// CALCUL de dégâts particulier (plafonné, fixe, conditionnel au positionnement) plutôt qu'un effet
// secondaire. On pilote chaque move de bout en bout et on assert le SENS lisible : la ligne de
// journal FR (`BattleLogFormatter`) + le flottant / le badge de l'InfoPanel (`battle-views`), jamais
// le pixel. Déterministe (seed moteur, moves 100 % précision hors Croc Fatal 90 %, jamais d'override
// `Math.random`). Le core est couvert unit + intégration ; l'e2e valide l'observable UI.
const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

const readDamage = async (page: import("@playwright/test").Page): Promise<number> => {
  const text = await log(page, /perd \d+ PV/)
    .first()
    .textContent();
  const match = text?.match(/perd (\d+) PV/);
  return match ? Number(match[1]) : 0;
};

// §5.33 Faux-Chage (`false-swipe`, cannotKo) : le coup inflige des dégâts mais ne peut jamais K.O. —
// la cible à quelques PV survit à EXACTEMENT 1 PV (cap), aucune modale de victoire.
test("§5.33 Faux-Chage : les dégâts ne mettent jamais K.O. (cible reste à 1 PV)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(FALSE_SWIPE);
  const info = new InfoPanel(page);

  await scene.castFirstMove(2, 2);

  // Le coup touche (dégâts au journal)...
  await expect(log(page, /perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  // ... mais ne met jamais K.O. : aucune modale de victoire.
  await expect(page.getByRole("dialog").filter({ hasText: /gagne/ })).toHaveCount(0);

  // La cible reste à EXACTEMENT 1 PV — survol → InfoPanel « 1 / max » (le joueur, plein, ne matche
  // pas). Re-survol à chaque itération (le pointer-move est continu → robuste sous charge).
  await expect
    .poll(
      async () => {
        await scene.hoverTile(2, 2);
        return info.hpText.textContent();
      },
      { timeout: 10_000 },
    )
    .toMatch(/^1 \/ \d+$/);
});

// §5.33 Croc Fatal (`super-fang`, HalveTargetHp) : dégâts fixes = ⌊PV actuels / 2⌋ → journal dédié +
// flottant `-N`.
test("§5.33 Croc Fatal : inflige la moitié des PV actuels (journal + flottant)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(SUPER_FANG);

  await scene.castFirstMove(2, 2);

  // Journal FR dédié : « … perd la moitié de ses PV (-N) ! » (SuperFangApplied).
  await expect(log(page, /perd la moitié de ses PV \(-\d+\)/)).toBeAttached({ timeout: 10_000 });

  // Un flottant de dégâts `-N` monte au-dessus de la cible (mesh billboard, pas le pixel). Il vit
  // ~1 s → poll à intervalle court (< sa durée de vie).
  await expect
    .poll(() => scene.countByName("hud_text_plane"), {
      timeout: 10_000,
      intervals: [80, 80, 80, 80, 80],
    })
    .toBeGreaterThan(0);
});

// §5.33 Ruse (`feint`, bypassProtect) : touche à travers une Protection active. Le dummy (Vit. 50)
// se protège en 1er (Abri) ; puis Ronflex (Vit. 30) lance Ruse → touche malgré la protection.
test("§5.33 Ruse : touche à travers la protection (Abri) de la cible", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(FEINT_THROUGH_PROTECT);

  // Le dummy, plus rapide, se protège AVANT que le joueur agisse.
  await expect(log(page, /se protège avec Abri/)).toBeAttached({ timeout: 10_000 });

  // Ronflex lance Ruse → touche MALGRÉ la protection (journal dégâts, aucun blocage « Protégé »).
  await scene.castFirstMove(2, 2);
  await expect(log(page, /perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
});

// §5.33 Anti-Air — contrôle négatif : sans grounding, Coud'Boue (Sol) est SANS EFFET sur le Volant
// (immunité Sol→Vol). L'immunité de type est SILENCIEUSE au journal (aucune ligne de dégâts) → le
// tir a lieu (« … utilise Coud'Boue ! ») mais aucune ligne « Dracolosse perd … PV ». Référence du
// cas cloué ci-dessous.
test("§5.33 Anti-Air (contrôle) : sans grounding, un move Sol n'affecte pas le Volant", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(ANTI_AIR_CONTROL);

  await scene.castFirstMove(2, 2); // Coud'Boue directement sur le Dracolosse (Vol) non cloué
  await expect(log(page, /utilise Coud.Boue/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Dracolosse perd/)).toHaveCount(0); // immunité Sol→Vol : zéro dégât
});

// §5.33 Anti-Air (`smack-down`, Damage + SmackDown) : cloue un Volant au sol, puis un move Sol le
// touche (l'immunité Sol→Vol est LEVÉE). Une action ne termine PAS le tour → `endTurn()` explicite
// pour atteindre le tour 2. Le dummy adverse agit à son tour (pollue le journal de dégâts) → on fige
// le compte de dégâts subis par la cible AVANT Coud'Boue puis on prouve qu'il AUGMENTE après (le Vol
// cloué encaisse le move Sol) — comparé au contrôle où le même Coud'Boue reste à zéro dégât.
test("§5.33 Anti-Air : cloue le Volant au sol, puis un move Sol le touche", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(ANTI_AIR);

  // Tour 1 : Anti-Air cloue le Dracolosse (Vol) au sol (+ dégâts Roche).
  await scene.castFirstMove(2, 2);
  await expect(log(page, /est cloué au sol/)).toBeAttached({ timeout: 10_000 });

  await scene.endTurn(); // fin du tour 1 → le dummy joue → retour au joueur (tour 2)
  await expect(page.getByRole("button", { name: "Attaque", exact: true })).toBeVisible({
    timeout: 10_000,
  });

  // Fige le compte de dégâts subis par la cible une fois le tour du dummy résolu (toute pollution est
  // derrière nous : c'est de nouveau au joueur d'agir).
  const damageBefore = await log(page, /Dracolosse perd/).count();

  // Tour 2 : Coud'Boue (Sol, 2e move) frappe le Vol cloué → une NOUVELLE ligne de dégâts (immunité
  // Sol→Vol levée). Le joueur reste actif après le tir → aucun autre acteur n'ajoute de dégâts.
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  await page.getByTestId("move-item").nth(1).click();
  await scene.clickTile(2, 2);
  await scene.clickTile(2, 2);
  await expect(log(page, /utilise Coud.Boue/)).toBeAttached({ timeout: 10_000 });
  await expect
    .poll(() => log(page, /Dracolosse perd/).count(), { timeout: 10_000 })
    .toBeGreaterThan(damageBefore);
});

// §5.33 Anti-Air : le volatile de grounding remonte dans l'InfoPanel sous forme de badge « Au sol »
// (au survol du Volant cloué).
test("§5.33 Anti-Air : l'InfoPanel du Volant cloué affiche le badge « Au sol »", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(ANTI_AIR);
  const info = new InfoPanel(page);

  await scene.castFirstMove(2, 2);
  await expect(log(page, /est cloué au sol/)).toBeAttached({ timeout: 10_000 });

  const badge = info.panel.getByText("Au sol", { exact: true });
  await expect
    .poll(
      async () => {
        await scene.hoverTile(2, 2);
        if ((await info.name.textContent()) !== "Dracolosse") {
          return 0;
        }
        return badge.count();
      },
      { timeout: 10_000 },
    )
    .toBe(1);
});

// §5.33 Poursuite (`pursuit`, pursuitBackstab) : ×2 dans le dos. Deux boots identiques au seed près
// de l'orientation du dummy → même jet aléatoire ; les dégâts de dos (×2,3) dominent la face (×0,85).
test("§5.33 Poursuite : ×2 dans le dos — les dégâts de dos dominent ceux de face", async ({
  page,
  bootSandbox,
}) => {
  const backScene = await bootSandbox(PURSUIT_BACKSTAB);
  await backScene.castFirstMove(2, 2);
  await expect(log(page, /perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  const backDamage = await readDamage(page);

  const frontScene = await bootSandbox(PURSUIT_FRONTAL);
  await frontScene.castFirstMove(2, 2);
  await expect(log(page, /perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  const frontDamage = await readDamage(page);

  // Le dos (×2,3) écrase la face (×0,85) — même seed, même jet → ratio ≈ 2,7.
  expect(backDamage).toBeGreaterThan(frontDamage * 2);
});

// §5.33 Corps Perdu (`vital-throw`, bypassAccuracy) : ne rate jamais. Le dummy a l'Esquive au max
// (+6) ; Corps Perdu ignore la précision et touche quand même (jamais « rate son attaque »).
test("§5.33 Corps Perdu : ne rate jamais (touche une cible à Esquive max)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(VITAL_THROW);

  await scene.castFirstMove(2, 2);

  // Malgré l'Esquive +6, le coup touche (dégâts) et n'est JAMAIS raté.
  await expect(log(page, /perd \d+ PV/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /rate son attaque/)).toHaveCount(0);
});
