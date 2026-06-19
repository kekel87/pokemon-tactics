import { expect, test } from "../../fixtures";
import { ENTRY_HAZARD_SPIKES } from "../../fixtures/sandbox-configs";

// Cahier §5.22 — Pièges au sol (entry hazards, plan 131). On automatise le SENS de la POSE
// (Picots posés à distance via le picker GroundTarget → ligne de journal FR + mesh peint au sol),
// jamais le pixel. Le DÉCLENCHEMENT à l'entrée n'est pas pilotable depuis le harness (owner-immunity
// côté joueur + dummy AI immobile) → son sens reste couvert par les unit/integration du core
// (`entry-hazard-system`, `resolve-hazard-traversal`), et le rendu (couleur équipe, pips de couches,
// texte flottant « blessé par les Picots ») reste 👁.

const log = (page: import("@playwright/test").Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// Un mesh de piège est nommé `hazard_<file>_<x>_<y>`. Picots à 1 couche → file `hazards_spikes_1`.
const SPIKES_LAYER1_MESH = "hazard_hazards_spikes_1";

test("§5.22 Picots : posés via le picker GroundTarget (journal + scène)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(ENTRY_HAZARD_SPIKES);

  // Picots est un poseur GroundTarget : on vise une case libre traversable à portée — (2,1),
  // distance 2 de Cloyster en (2,3). `castFirstMove` sélectionne la cible puis confirme.
  await scene.castFirstMove(2, 1);

  // Journal FR : ligne EntryHazardPosted « Des Picots sont posés au sol ».
  await expect(log(page, /Des Picots sont posés au sol/)).toBeAttached({ timeout: 10_000 });

  // Scène : le mesh de Picots (couche 1) est peint exactement sur la case visée (2,1) et nulle part
  // ailleurs — la pose vise UNE case, pas un diamant (décision 2026-06-18).
  await expect
    .poll(() => scene.countByName(`${SPIKES_LAYER1_MESH}_2_1`), { timeout: 10_000 })
    .toBe(1);
  expect(await scene.countByName(`${SPIKES_LAYER1_MESH}_2_3`)).toBe(0);
});
