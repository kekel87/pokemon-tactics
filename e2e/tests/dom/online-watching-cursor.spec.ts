import type { Locator } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { TileInfoPanel } from "../../pages/combatHud";
import { connectPad, PadButton, tapPadButton, withFakeGamepad } from "../../pages/gamepad";
import type { OnlinePeer } from "../../pages/online-session";
import { OnlineSession } from "../../pages/online-session";

/*
 * Cahier §11.17 — INSPECTER le plateau pendant le tour d'en face, au clavier et à la manette
 * (2026-09-15, inventaire d'avant-release).
 *
 * 🔴 Ce que ce scénario garde est une ASYMÉTRIE MULTI-ENTRÉE refermée, pas une fonctionnalité neuve.
 * Le survol à la SOURIS repeignait déjà le panneau d'info de case pendant tout un tour distant —
 * `onTileHover` ne se bloque qu'en phase `animating`, jamais en `waiting_remote`. Le clavier et la
 * manette, eux, étaient coupés net : le contexte `watching` rendait la main avant même d'arriver aux
 * flèches (`input-router.ts`, plan 201). Un joueur au pad ne pouvait donc rien regarder pendant que
 * l'autre réfléchit — jusqu'à 60 s par tour. Voir `.claude/rules/multi-input.md`.
 *
 * Et le revers compte autant : ce qui est rendu est l'INSPECTION, pas le jeu. `Confirmer` et
 * `Annuler` doivent rester inertes des deux côtés — la partie n'est pas à nous. Sans ce volet, un
 * correctif trop large (rabattre `watching` sur `board`) passerait au vert tout en laissant le
 * spectateur valider une case et ouvrir le menu de combat sur le tour de quelqu'un d'autre.
 *
 * 🔴 **Deux VRAIS pairs, et c'est inévitable ici.** Le raccourci des autres specs de la famille — un
 * hôte seul qui repasse la place libre en IA — ne produit PAS ce contexte : une place tenue par l'IA
 * joue chez les deux pairs à la fois (`wireScoredAi`, graines dérivées), donc son tour passe par
 * `animating`, c'est-à-dire `locked`, qui coupe tout et à raison. Seul un tour attendu SUR LE RÉSEAU
 * entre en `waiting_remote`, donc en `watching`.
 *
 * ⚠️ Deux profils de navigateur, jamais deux onglets d'un même profil (recette du plan 202) : la
 * sauvegarde de reprise tient dans une seule clé. `OnlineSession` fournit les deux contextes.
 */

/*
 * Même budget que le reste de la famille : deux contextes, une négociation WebRTC, deux boots
 * Babylon complets. Le scénario lui-même ne joue AUCUN tour — il s'en tient à la fenêtre du premier.
 */
test.setTimeout(240_000);

/**
 * Les quatre directions d'écran, dans l'ordre où on les presse.
 *
 * Les quatre et pas une seule, parce que la case de départ n'est pas connue : le curseur repart du
 * point de vue de la caméra, donc du Pokemon qui JOUE — celui d'en face, posé au hasard sur une
 * carte tirée au hasard. Contre un bord, une direction ne bouge rien (`stepCursor` refuse de sortir
 * de la grille), ce qui est le comportement voulu ; balayer les deux axes donne au moins deux cases
 * distinctes où que le curseur commence, sans rien supposer de la géométrie.
 */
const ARROW_KEYS = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"] as const;
const DPAD_BUTTONS = [
  PadButton.DpadUp,
  PadButton.DpadRight,
  PadButton.DpadDown,
  PadButton.DpadLeft,
] as const;

/** Les cases que le curseur a occupées, une par pression, les pressions sans effet exclues. */
async function tilesVisited(
  peer: OnlinePeer,
  presses: readonly (() => Promise<void>)[],
): Promise<string[]> {
  const visited: string[] = [];
  for (const press of presses) {
    await press();
    const tile = await peer.scene.cursorTile();
    if (tile !== null) {
      visited.push(`${tile.x},${tile.y}`);
    }
  }
  return visited;
}

/** Le menu d'actions du tour — démonté chez qui regarde (`chrome.hideMenus()`). */
function actionMenuEntry(peer: OnlinePeer): Locator {
  return peer.page.getByRole("button", { name: "Déplacement", exact: true });
}

test("§11.17 en ligne : pendant le tour d'en face, le curseur répond aux flèches et au D-pad — Confirmer et Annuler, jamais", async ({
  browser,
}) => {
  const session = await OnlineSession.open(browser);

  /*
   * La manette synthétique est posée sur les DEUX pages avant toute navigation. Deux raisons, et
   * aucune n'est de la précaution : `addInitScript` ne vaut que pour les chargements SUIVANTS, et on
   * ne sait pas encore lequel des deux pairs regardera — l'ordre du premier tour dépend de la
   * Vitesse des équipes tirées. Elle n'est CONNECTÉE (donc lue par le poller) que sur le pair qui
   * regarde, à l'acte 2.
   */
  await withFakeGamepad(session.host.page);
  await withFakeGamepad(session.guest.page);

  try {
    await session.startBattle();
    const { observer } = await session.peerWithHand();
    const tileInfo = new TileInfoPanel(observer.page);

    /*
     * On est bien en `watching`, et c'est dit par ce que le joueur voit : « Attendre » n'existe que
     * du côté qui joue, et le menu d'actions est démonté. Sans ce relevé, un test qui se tromperait
     * de pair prouverait seulement que le curseur marche pendant SON propre tour.
     */
    await expect(observer.wait).toHaveCount(0);
    await expect(actionMenuEntry(observer)).toHaveCount(0);

    // — Acte 1 : le clavier ————————————————————————————————————————————————————————————————————————
    const keyboardTiles = await tilesVisited(
      observer,
      ARROW_KEYS.map((key) => () => observer.page.keyboard.press(key)),
    );

    // Avant le correctif, la liste était VIDE : aucune flèche n'atteignait le plateau, donc le
    // curseur n'était jamais posé. Deux cases distinctes disent à la fois qu'il est né et qu'il
    // bouge.
    expect(new Set(keyboardTiles).size).toBeGreaterThan(1);

    // Et le curseur SERT à quelque chose : le panneau d'info de case, effacé à l'entrée dans le
    // contexte, est repeint sous lui — exactement ce que la souris obtenait déjà en survolant.
    await expect(tileInfo.panel).toBeVisible();
    await expect(tileInfo.terrain).not.toBeEmpty();

    // Le revers, au clavier : `Espace` ne valide rien et `Échap` n'ouvre pas le menu de combat.
    const parkedAtKeyboard = await observer.scene.cursorTile();
    await observer.page.keyboard.press("Space");
    await observer.page.keyboard.press("Escape");

    expect(await observer.scene.cursorTile()).toEqual(parkedAtKeyboard);
    await expect(observer.combatMenu.dialog).toHaveCount(0);
    await expect(actionMenuEntry(observer)).toHaveCount(0);

    // — Acte 2 : la manette ————————————————————————————————————————————————————————————————————————
    /*
     * `activateFocusedControl()` ne couvrirait rien ici : il n'y a aucun contrôle DOM focalisé
     * pendant un tour distant, et c'est justement le point — le D-pad parle au plateau, pas à un
     * bouton. D'où la manette synthétique plutôt qu'un clic.
     */
    await connectPad(observer.page);
    const padTiles = await tilesVisited(
      observer,
      DPAD_BUTTONS.map((button) => () => tapPadButton(observer.page, button)),
    );

    expect(new Set(padTiles).size).toBeGreaterThan(1);

    const parkedAtPad = await observer.scene.cursorTile();
    await tapPadButton(observer.page, PadButton.A);
    await tapPadButton(observer.page, PadButton.B);

    expect(await observer.scene.cursorTile()).toEqual(parkedAtPad);
    await expect(observer.combatMenu.dialog).toHaveCount(0);
    await expect(actionMenuEntry(observer)).toHaveCount(0);

    /*
     * 🔴 La main n'a jamais changé de camp pendant tout ça — sans quoi les assertions négatives
     * ci-dessus ne prouveraient rien : `Confirmer` inerte sur un tour qui vient de nous revenir se
     * lirait comme un succès. Le tour d'en face dure 60 s (`ONLINE_TURN_DURATION_MS`) et personne
     * n'a joué depuis le début du scénario.
     */
    await expect(observer.wait).toHaveCount(0);
  } finally {
    await session.close();
  }
});
