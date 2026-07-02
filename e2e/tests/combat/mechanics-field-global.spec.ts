import { expect, test } from "../../fixtures";
import {
  FIELD_GLOBAL_GRAVITY,
  FIELD_GLOBAL_MAGIC_ROOM,
  FIELD_GLOBAL_WONDER_ROOM,
  GRAVITY_BLOCKS_AERIAL,
  TAILWIND_NORTH,
} from "../../fixtures/sandbox-configs";
import { TailwindHud } from "../../pages/combatHud";

// Cahier §5.29 — Famille Field global (plan 145) : 3 zones diamant r3 (Gravité / Zone Étrange / Zone
// Magique, moves Self) posées via cast + Vent Arrière (vent directionnel global). On automatise le
// SENS (zone posée + vent levé + move aérien verrouillé), jamais le pixel : la couleur propre à
// chaque kind, la pastille compteur, la flèche du HUD et les effets numériques profonds restent 👁 /
// couverts unit core.

const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// Les quads de zone réutilisent le rendu des Champs : `field_terrain_<colorDécimal>_<x>_<y>`. Chaque
// kind a une couleur UNIQUE (view-core/constants.ts) → un préfixe ne capture QUE la zone de ce kind
// (jamais un Champ de terrain ni une autre zone field-global).
const GRAVITY_MESH_PREFIX = "field_terrain_5996464_"; // FIELD_GLOBAL_COLOR_GRAVITY = 0x5b7fb0
const WONDER_ROOM_MESH_PREFIX = "field_terrain_4175782_"; // FIELD_GLOBAL_COLOR_WONDER_ROOM = 0x3fb7a6
const MAGIC_ROOM_MESH_PREFIX = "field_terrain_12605055_"; // FIELD_GLOBAL_COLOR_MAGIC_ROOM = 0xc0567f

// --- Les 3 zones diamant (Self → on cible la case du lanceur (2,3), comme Distorsion) --------------

const ZONES: readonly [string, Record<string, unknown>, RegExp, string][] = [
  ["Gravité", FIELD_GLOBAL_GRAVITY, /déploie Gravité/, GRAVITY_MESH_PREFIX],
  ["Zone Étrange", FIELD_GLOBAL_WONDER_ROOM, /déploie Zone Étrange/, WONDER_ROOM_MESH_PREFIX],
  ["Zone Magique", FIELD_GLOBAL_MAGIC_ROOM, /déploie Zone Magique/, MAGIC_ROOM_MESH_PREFIX],
];

for (const [label, config, journalRe, meshPrefix] of ZONES) {
  test(`§5.29 ${label} : zone posée (journal + scène)`, async ({ page, bootSandbox }) => {
    const scene = await bootSandbox(config);

    await scene.castFirstMove(2, 3); // move Self → cible la propre case du lanceur.

    // Journal FR : FieldGlobalPosted « <lanceur> déploie <label> (5 tours) ».
    await expect(log(page, journalRe)).toBeAttached({ timeout: 10_000 });

    // Scène : le quad du kind peint au moins l'épicentre. On asserte le SENS (zone présente, ancrée
    // sur le lanceur), pas le décompte exact (le diamant r3 est clippé au bord de la grille 6×6).
    await expect
      .poll(
        () =>
          scene
            .meshNames()
            .then((names) => names.filter((name) => name.startsWith(meshPrefix)).length),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);
    expect(await scene.countByName(`${meshPrefix}2_3`)).toBe(1);
  });
}

// --- Vent Arrière (GroundTarget portée 1 : la case cardinale ciblée donne la direction) -----------

test("§5.29 Vent Arrière : vent levé vers le Nord (journal + HUD)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(TAILWIND_NORTH);

  // (2,2) est la case cardinale au nord du lanceur (2,3), libérée (dummy écarté en (4,4)).
  await scene.castFirstMove(2, 2);

  // Journal FR : TailwindSet « <lanceur> lève le Vent Arrière vers le Nord (5 tours) ».
  await expect(log(page, /lève le Vent Arrière vers le Nord/)).toBeAttached({ timeout: 10_000 });

  // HUD flèche (mode Vent Arrière du bandeau top-center) : monté avec le libellé FR. La rotation de
  // la flèche selon la direction/azimut caméra = 👁 (pixel).
  const hud = new TailwindHud(page);
  await expect(hud.hud).toBeVisible();
  await expect(hud.label).toHaveText("Vent Arrière");
});

// --- Gravité verrouille les moves aériens (menu Attaque `data-enabled`) ---------------------------

test("§5.29 Gravité : verrouille un move aérien depuis la zone (menu)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(GRAVITY_BLOCKS_AERIAL);

  await scene.castFirstMove(2, 3); // pose Gravité → le lanceur est DANS sa propre zone.
  await expect(log(page, /déploie Gravité/)).toBeAttached({ timeout: 10_000 });

  // Un cast ne clôt pas le tour ; on l'achève explicitement (« Attendre » + confirme la direction) →
  // l'IA (dummy inerte) rejoue, puis la main revient au lanceur. On attend que le bouton Attaque se
  // réactive (son prochain tour) avant d'ouvrir le menu — sinon il reste `disabled`.
  await scene.endTurn();
  const attackButton = page.getByRole("button", { name: "Attaque", exact: true });
  await expect(attackButton).toBeEnabled({ timeout: 20_000 });

  // Toujours DANS sa zone Gravité : Pied Voltige (disabledUnderGravity) est filtré des actions légales
  // → sa ligne du menu Attaque porte data-enabled="false" bien qu'une cible adjacente (2,2) existe.
  await attackButton.click();
  const aerialRow = page.getByTestId("move-item").filter({ hasText: "Pied Voltige" });
  await expect(aerialRow).toHaveAttribute("data-enabled", "false");
});

test("§5.29 Gravité (témoin) : le move aérien reste jouable hors zone (menu)", async ({
  page,
  bootSandbox,
}) => {
  await bootSandbox(GRAVITY_BLOCKS_AERIAL);

  // Gravité NON posée → au tour 1 Pied Voltige a une cible adjacente légale → data-enabled="true".
  // Prouve que le verrou du test précédent vient bien de la Gravité (et non d'une portée manquante).
  await page.getByRole("button", { name: "Attaque", exact: true }).click();
  const aerialRow = page.getByTestId("move-item").filter({ hasText: "Pied Voltige" });
  await expect(aerialRow).toHaveAttribute("data-enabled", "true");
});
