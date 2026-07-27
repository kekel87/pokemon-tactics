import { expect, test } from "../../fixtures";
import {
  COMBAT_PREVIEW_ACCURACY,
  COMBAT_PREVIEW_AOE,
  COMBAT_PREVIEW_FOCUS_SASH,
  COMBAT_PREVIEW_IMMUNE,
  COMBAT_PREVIEW_MODIFIERS,
  COMBAT_PREVIEW_SURVIVES,
  DUEL_LETHAL,
} from "../../fixtures/sandbox-configs";
import { CursorPanel, InfoPanel, TileInfoPanel } from "../../pages/combatHud";

// Cahier §4.14 (preview de combat, plan 175) — pendant la CONFIRMATION d'une attaque, le panneau du
// lanceur s'étend d'un bloc d'attaque (move + fourchette de dégâts + précision + critique + puces) et
// la carte curseur bascule sur la cible focalisée (PV prédits, verdict, compteur n/N). DOM pur : les
// view-models (`buildCombatPreviewView`) sont découplés du core, on assert le SENS (textes FR
// officiels, attribut de létalité), jamais le pixel — la barre fantôme dégradée reste 👁.
//
// Déterminisme : `previewMove` est PUR (aucun jet, Verrouillage lu sans être consommé) et aucun test
// ne confirme l'attaque (`aimFirstMove` s'arrête à la confirmation) → les valeurs affichées ne
// dépendent d'aucun tirage.

test("§4.14 preview : K.O. garanti — chiffre létal, PV restants à 0 %, panneau de case masqué", async ({
  page,
  bootSandbox,
}) => {
  // Dummy à 1 % PV → même le roll minimum de Griffe le met K.O.
  const scene = await bootSandbox(DUEL_LETHAL);
  const attacker = new InfoPanel(page);
  const target = new CursorPanel(page);
  const tile = new TileInfoPanel(page);

  await scene.aimFirstMove(2, 2);

  // Bloc d'attaque greffé sur le panneau du LANCEUR : nom FR officiel du move + fourchette « min–max ».
  await expect(attacker.attack).toBeVisible();
  await expect(attacker.moveName).toHaveText("Griffe");
  await expect(attacker.damage).toHaveText(/^\d+–\d+$/);
  // Létalité portée par l'attribut (le DOM colore le chiffre avec) — pas de phrase à assertion fragile.
  await expect(attacker.damage).toHaveAttribute("data-outcome", "guaranteed-ko");
  // Griffe est à 100 % de précision et sans cran adverse → « touche à coup sûr ».
  await expect(attacker.accuracy).toHaveText("Préc. 100 %");
  await expect(attacker.crit).toHaveText(/^Crit\. \d+ %$/);

  // Carte cible (droite) : le dummy focalisé, PV prédits à zéro.
  await expect(target.panel).toBeVisible();
  await expect(target.remaining).toHaveText("→ 0 % PV");
  // Cible unique → pas de compteur de cycle.
  await expect(target.counter).toBeHidden();

  // La rangée appartient à la prévision pendant la confirmation : le panneau de case s'efface.
  await expect(tile.panel).toBeHidden();
});

test("§4.14 preview : coup non létal — PV restants en plage, aucun verdict", async ({
  page,
  bootSandbox,
}) => {
  // Ronflex à pleins PV : Griffe (40 BP, sans STAB) ne peut pas l'entamer sérieusement.
  const scene = await bootSandbox(COMBAT_PREVIEW_SURVIVES);
  const attacker = new InfoPanel(page);
  const target = new CursorPanel(page);

  await scene.aimFirstMove(2, 2);

  await expect(attacker.damage).toHaveAttribute("data-outcome", "survives");
  // PV restants annoncés en PLAGE (pire cas d'abord), à l'image de la fourchette de dégâts.
  await expect(target.remaining).toHaveText(/^→ \d+–\d+ % PV$/);
  // Rien à nuancer : la couleur du chiffre suffit, la ligne de verdict reste vide.
  await expect(target.verdict).toBeHidden();
});

test("§4.14 preview : immunité — « Sans effet » et aucune fourchette", async ({
  page,
  bootSandbox,
}) => {
  // Griffe est de type Normal, Ectoplasma est Spectre → ×0.
  const scene = await bootSandbox(COMBAT_PREVIEW_IMMUNE);
  const attacker = new InfoPanel(page);
  const target = new CursorPanel(page);

  await scene.aimFirstMove(2, 2);

  await expect(attacker.damage).toHaveAttribute("data-outcome", "no-effect");
  // Pas de fourchette à afficher → cadratin.
  await expect(attacker.damage).toHaveText("—");
  await expect(target.verdict).toHaveText("Sans effet");
  // Aucun PV ne part → pas de ligne de PV restants.
  await expect(target.remaining).toBeHidden();
});

test("§4.14 preview : Ceinture Force à PV max — le verdict létal porte « sauf Ceinture Force »", async ({
  page,
  bootSandbox,
}) => {
  // Séisme (Sol) ×2 sur l'Ectoplasma (Poison) frêle : létal depuis ses PV pleins. Mais il tient une
  // Ceinture Force, garde-fou DÉTERMINISTE de survie à 1 PV, et la source est connue du joueur.
  const scene = await bootSandbox(COMBAT_PREVIEW_FOCUS_SASH);
  const attacker = new InfoPanel(page);
  const target = new CursorPanel(page);

  // Séisme est une Zone auto-centrée : on vise la propre case du lanceur.
  await scene.aimFirstMove(2, 3);

  await expect(attacker.moveName).toHaveText("Séisme");
  await expect(attacker.damage).toHaveAttribute("data-outcome", "guaranteed-ko");
  // Nom FR officiel de l'objet, jamais l'id anglais.
  await expect(target.verdict).toHaveText("sauf Ceinture Force");
});

test("§4.14 preview : précision effective — Esquive +2 de la cible fait tomber Griffe à 50 %", async ({
  page,
  bootSandbox,
}) => {
  // 100 % de fiche ÷ multiplicateur d'Esquive (+2 → ×2) = 50 % effectifs.
  const scene = await bootSandbox(COMBAT_PREVIEW_ACCURACY);
  const attacker = new InfoPanel(page);

  await scene.aimFirstMove(2, 2);

  await expect(attacker.accuracy).toHaveText("Préc. 50 %");
});

test("§4.14 preview : puces de modificateurs (efficacité ×2) + effet secondaire (10 %)", async ({
  page,
  bootSandbox,
}) => {
  // Lance-Flammes (Feu) sur un Florizarre (Plante/Poison) → ×2, et le move porte 10 % de Brûlure.
  const scene = await bootSandbox(COMBAT_PREVIEW_MODIFIERS);
  const attacker = new InfoPanel(page);

  await scene.aimFirstMove(2, 2);

  await expect(attacker.moveName).toHaveText("Lance-Flammes");
  // Puce d'efficacité : le multiplicateur résultant (la table de types dépliable est hors périmètre).
  await expect(attacker.modifiers).toContainText("×2");
  // Puce d'effet secondaire : la chance du statut, telle que le move la porte.
  await expect(attacker.effect).toContainText("10 %");
});

test("§4.14 preview : zone multi-cibles — compteur n/2 et cycle clavier (Tab / Shift+Tab)", async ({
  page,
  bootSandbox,
}) => {
  // Séisme couvre l'allié Florizarre (2,4) ET l'ennemi Ronflex (2,2) : 2 cibles cyclables.
  const scene = await bootSandbox(COMBAT_PREVIEW_AOE);
  const target = new CursorPanel(page);

  await scene.aimFirstMove(2, 3);

  // Le cycle suit l'ordre des Pokemon de l'état (équipe 1 puis 2) → l'allié ouvre le panneau.
  await expect(target.counter).toHaveText("1/2");
  await expect(target.name).toHaveText("Florizarre");

  await page.keyboard.press("Tab");
  await expect(target.counter).toHaveText("2/2");
  await expect(target.name).toHaveText("Ronflex");

  // Boucle : Shift+Tab revient à la cible précédente.
  await page.keyboard.press("Shift+Tab");
  await expect(target.counter).toHaveText("1/2");
  await expect(target.name).toHaveText("Florizarre");
});

test("§4.14 preview : cycle au survol d'une autre cible de l'empreinte + tir allié", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(COMBAT_PREVIEW_AOE);
  const target = new CursorPanel(page);

  await scene.aimFirstMove(2, 3);

  // Cible focalisée par défaut = l'allié → tir allié : la carte cible est aux couleurs de l'équipe 1.
  await expect(target.name).toHaveText("Florizarre");
  await expect(target.panel).toHaveAttribute("data-team", "1");
  await expect(target.remaining).toHaveText(/^→ \d+–\d+ % PV$/);

  // Survoler l'ennemi de l'empreinte y déplace le focus (le survol est continu en jeu → on re-survole
  // à chaque poll, anti-course avec un re-render du HUD).
  await expect
    .poll(
      async () => {
        await scene.hoverTile(2, 2);
        return target.name.textContent();
      },
      { timeout: 10_000 },
    )
    .toBe("Ronflex");
  await expect(target.panel).toHaveAttribute("data-team", "2");
  await expect(target.counter).toHaveText("2/2");
});

test("§4.14 preview : réglage « Prévisualisation dégâts » désactivé → aucune prévision", async ({
  page,
  bootSandbox,
}) => {
  // Le réglage vit en localStorage (`pt-settings`), lu au boot : on le pose AVANT navigation.
  await page.addInitScript(() =>
    localStorage.setItem("pt-settings", JSON.stringify({ damagePreview: false })),
  );
  const scene = await bootSandbox(DUEL_LETHAL);
  const attacker = new InfoPanel(page);
  const target = new CursorPanel(page);

  await scene.aimFirstMove(2, 2);

  // Même config qu'au 1er test (K.O. garanti) : sans le réglage, rien de tout cela n'apparaît.
  await expect(attacker.attack).toBeHidden();
  await expect(target.remaining).toBeHidden();
  await expect(target.counter).toBeHidden();
  // Le panneau du lanceur, lui, reste en place (identité + PV) : seule la prévision disparaît.
  await expect(attacker.panel).toBeVisible();
  await expect(attacker.name).toHaveText("Florizarre");
});
