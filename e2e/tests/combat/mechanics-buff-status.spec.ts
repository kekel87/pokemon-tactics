import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  BUFF_STATUS_ACUPRESSURE,
  BUFF_STATUS_ATTRACT,
  BUFF_STATUS_BELLY_DRUM,
  BUFF_STATUS_CURSE_GHOST,
  BUFF_STATUS_CURSE_SELF,
  BUFF_STATUS_MAGNET_RISE,
  BUFF_STATUS_YAWN,
} from "../../fixtures/sandbox-configs";

// Cahier §5.42 — Famille Buff/statut, Batch D (plan 154). Chaque move a une ligne de journal FR
// dédiée. Les unit/integration core couvrent les effets internes (DoT de Malédiction, sommeil différé
// de Bâillement, cap +6 de Cognobidon, lévitation 5 tours de Vol Magnétik, saut de tour d'Attraction)
// ; ici on prouve que chaque move résout via l'orchestrateur ET émet sa ligne de journal FR. On assert
// le SENS (la ligne de journal), jamais le pixel. Statut sans jet → cast déterministe.
const log = (page: Page, re: RegExp) =>
  page.getByTestId("battle-log-entry").filter({ hasText: re });

// §5.42 Malédiction (lanceur Spectre) : sacrifie 50 % PV + jette une malédiction sur l'ennemi r3.
test("§5.42 Malédiction (Spectre) : le lanceur se maudit et maudit la cible (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(BUFF_STATUS_CURSE_GHOST);
  await scene.castFirstMove(3, 4);
  await expect(log(page, /Ectoplasma se maudit et jette une malédiction sur Ronflex/)).toBeAttached(
    {
      timeout: 10_000,
    },
  );
});

// §5.42 Malédiction (lanceur non-Spectre) : buff Self (−1 Vit / +1 Atq / +1 Déf), sans coût de PV.
test("§5.42 Malédiction (non-Spectre) : le lanceur se buffe (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(BUFF_STATUS_CURSE_SELF);
  await scene.castFirstMove(2, 4); // Self → propre case
  await expect(log(page, /Attaque de Florizarre augmente/)).toBeAttached({ timeout: 10_000 });
  await expect(log(page, /Vitesse de Florizarre baisse/)).toBeAttached();
});

// §5.42 Bâillement : rend la cible somnolente (sommeil différé d'un tour).
test("§5.42 Bâillement : la cible commence à somnoler (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(BUFF_STATUS_YAWN);
  await scene.castFirstMove(3, 4);
  await expect(log(page, /Ronflex commence à somnoler/)).toBeAttached({ timeout: 10_000 });
});

// §5.42 Cognobidon : sacrifie 50 % PV et maximise l'Attaque.
test("§5.42 Cognobidon : le lanceur se tape le bidon et maximise son Attaque (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(BUFF_STATUS_BELLY_DRUM);
  await scene.castFirstMove(2, 4); // Self → propre case
  await expect(log(page, /Florizarre se tape le bidon et maximise son Attaque/)).toBeAttached({
    timeout: 10_000,
  });
});

// §5.42 Acupression : +2 à une stat de combat aléatoire (seedée) du lanceur → une hausse sur le lanceur.
test("§5.42 Acupression : une stat aléatoire du lanceur augmente (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(BUFF_STATUS_ACUPRESSURE);
  await scene.castFirstMove(2, 4); // ally-or-self → propre case
  await expect(log(page, /de Florizarre augmente/)).toBeAttached({ timeout: 10_000 });
});

// §5.42 Attraction : infatue une cible du sexe opposé (Tauros ♂ → Kangourex ♀, garanti).
test("§5.42 Attraction : la cible du sexe opposé tombe amoureuse (journal)", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(BUFF_STATUS_ATTRACT);
  await scene.castFirstMove(3, 4);
  await expect(log(page, /Kangourex tombe amoureux/)).toBeAttached({ timeout: 10_000 });
});

// §5.42 Vol Magnétik : le lanceur lévite (immunité Sol 5 tours).
test("§5.42 Vol Magnétik : le lanceur lévite (journal)", async ({ page, bootSandbox }) => {
  const scene = await bootSandbox(BUFF_STATUS_MAGNET_RISE);
  await scene.castFirstMove(2, 4); // Self → propre case
  await expect(log(page, /Florizarre lévite grâce à un champ magnétique/)).toBeAttached({
    timeout: 10_000,
  });
});
