import { expect, seedSavedTeams, test } from "../../fixtures";
import { CombatScene } from "../../pages/CombatScene";
import { InfoPanel } from "../../pages/combatHud";
import {
  ABRA_TEAM_ID,
  ALAKAZAM_TEAM_ID,
  castHealingWishOnEmptyNeighbour,
  ELIMINATION_TEAM_STORAGE,
  EliminationView,
  OnlineTrio,
  SACRIFICE_NAME,
  SACRIFICE_TEAM_ID,
} from "../../pages/elimination";
import {
  connectPad,
  focusedTestId,
  PadButton,
  tapPadButton,
  withFakeGamepad,
} from "../../pages/gamepad";
import { MainMenu } from "../../pages/MainMenu";
import type { OnlinePeer } from "../../pages/online-session";
import { BattleModeScreen, TeamSelectScreen } from "../../pages/screens";

/*
 * Cahier §12.12 à §12.15 — le joueur éliminé, et le mode spectateur (plan 210).
 *
 * Ce que ces scénarios gardent : quand le dernier Pokemon d'un camp tombe et que la partie continue,
 * le moteur le DIT (`PlayerEliminated`, lot D1) — une ligne de journal chez tout le monde — et, EN
 * LIGNE seulement, le joueur éliminé reçoit un dialogue à deux issues (lot D2) : regarder la suite
 * ou partir. En hot-seat l'écran est partagé, donc la ligne de journal est TOUT ce qui s'affiche.
 *
 * L'élimination passe par Vœu Soin (sacrifice du lanceur, sans aucun jet) — voir `pages/elimination.ts`.
 *
 * Le préfixe `online-` du nom de fichier est porteur : il range le spec dans la famille `online` de
 * `scripts/e2e-affected.ts`, rejouée quand `packages/network/` bouge. Le scénario hot-seat vit ici
 * quand même, parce que c'est la contre-épreuve directe du dialogue en ligne : sans lui, un dialogue
 * qui s'afficherait partout passerait au vert.
 */

/*
 * Trois contextes de navigateur, deux négociations WebRTC, trois boots Babylon — et pour « Retour au
 * menu » un délai de grâce réellement écoulé (30 s en combat, `BATTLE_GRACE_SHORT_MS`).
 */
test.setTimeout(300_000);

test("§12.12 en ligne à 3 camps : seul l'éliminé voit le dialogue, Échap ne le ferme pas, « Continuer à regarder » laisse voir la suite", async ({
  browser,
}) => {
  const trio = await OnlineTrio.open(browser);
  try {
    // Avant toute navigation : la manette synthétique s'installe par `addInitScript` (étape (d bis)).
    await withFakeGamepad(trio.sacrificed.page);
    await trio.startBattle();
    await trio.playUntilSacrificedHasHand();
    await trio.sacrifice();

    const sacrificedView = new EliminationView(trio.sacrificed.page);

    /*
     * (a) L'éliminé voit le dialogue, avec son titre et SES DEUX issues — et aucune troisième.
     */
    await expect(sacrificedView.dialog).toBeVisible({ timeout: 30_000 });
    await expect(sacrificedView.heading).toHaveText("Vous êtes éliminé");
    await expect(sacrificedView.keepWatching).toHaveText("Continuer à regarder");
    await expect(sacrificedView.backToMenu).toHaveText("Retour au menu");
    await expect(sacrificedView.dialog.getByRole("button")).toHaveCount(2);
    // Et ce n'est pas l'écran de victoire : la partie continue à deux.
    await expect(trio.sacrificed.battleOver).toHaveCount(0);

    /*
     * (b) Tout le monde lit la ligne d'élimination — l'éliminé comme les deux survivants.
     * `toBeAttached` et non `toBeVisible` : le journal naît replié (`data-collapsed`).
     */
    for (const peer of trio.all) {
      await expect(new EliminationView(peer.page).logLine(3)).toBeAttached({ timeout: 30_000 });
    }

    /*
     * (c) 🔴 Les deux survivants NE voient PAS le dialogue. Assertion négative, donc un point de
     * synchronisation d'abord : le dialogue est ouvert APRÈS l'application du lot d'événements et
     * AVANT que la file ne rende la main (`battle-orchestrator.ts`). Voir la main revenue chez un
     * survivant prouve que chacun a dépassé l'endroit où il l'aurait ouvert.
     */
    await trio.peerWithHand([trio.host, trio.survivor]);
    for (const peer of [trio.host, trio.survivor]) {
      await expect(new EliminationView(peer.page).dialog).toHaveCount(0);
    }

    /*
     * (d) Échap ne le ferme pas. Un `<dialog>` natif émet `cancel` sur Échap et se fermerait sans que
     * le joueur ait choisi ; les deux issues sont des choix, et l'une quitte la partie.
     */
    await trio.sacrificed.page.keyboard.press("Escape");
    await expect(sacrificedView.dialog).toBeVisible();
    await trio.sacrificed.page.keyboard.press("Escape");
    await expect(sacrificedView.dialog).toBeVisible();

    /*
     * (d bis) 🔴 Les DEUX issues sont atteignables au clavier et à la manette, par de vraies pressions.
     *
     * Défaut trouvé par la passe multi-entrée mesurée du plan 210, que les trois tests passaient au
     * vert : le dialogue s'ouvre pendant un tour distant, donc en contexte `watching`, qui ne route
     * ni les flèches ni A ni B — le focus restait figé sur « Continuer à regarder ». Au pad, sans
     * `Tab`, le joueur ne pouvait jamais quitter. Corrigé dans `combat-screen.ts` : une modale ouverte
     * présente le contexte `menu` (décision #1049).
     */
    const page = trio.sacrificed.page;
    await expect.poll(() => focusedTestId(page)).toBe("eliminated-keep-watching");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => focusedTestId(page)).toBe("eliminated-back-to-menu");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => focusedTestId(page)).toBe("eliminated-keep-watching");

    await connectPad(page);
    await tapPadButton(page, PadButton.DpadRight);
    await expect.poll(() => focusedTestId(page)).toBe("eliminated-back-to-menu");
    await tapPadButton(page, PadButton.DpadLeft);
    await expect.poll(() => focusedTestId(page)).toBe("eliminated-keep-watching");
    // B, le retour de la manette, ne ferme pas plus le dialogue qu'Échap.
    await tapPadButton(page, PadButton.B);
    await expect(sacrificedView.dialog).toBeVisible();

    /*
     * (e) « Continuer à regarder » ferme le dialogue — et c'est tout : le combat continue derrière.
     */
    /*
     * Le bouton du menu de combat redevient utilisable à la FERMETURE (revue du plan 210, Major 2).
     *
     * Tant que le dialogue est ouvert, il est grisé : le passage au tour distant l'a rafraîchi alors
     * qu'une modale était là. Avant le correctif, rien ne le rafraîchissait à la fermeture — il
     * restait grisé jusqu'à l'action distante suivante, et au doigt c'est le seul accès à « Quitter ».
     * Les deux assertions sont nécessaires : la seconde seule passerait aussi si le bouton n'avait
     * jamais été grisé, et ne prouverait rien.
     */
    await expect(trio.sacrificed.combatMenu.openButton).toBeDisabled();
    await sacrificedView.keepWatching.click();
    await expect(sacrificedView.dialog).toHaveCount(0);
    await expect(trio.sacrificed.combatMenu.openButton).toBeEnabled();

    /*
     * (f) Le spectateur voit la suite : un survivant joue, et l'action ARRIVE dans le journal de
     * l'éliminé — son moteur l'a reçue, validée, appliquée. Le salon est donc toujours tenu.
     */
    const actor = await trio.peerWithHand([trio.host, trio.survivor]);
    await trio.actAndAwait(trio.sacrificed, () => actor.scene.endTurn());
    const next = await trio.peerWithHand([trio.host, trio.survivor]);
    await trio.actAndAwait(trio.sacrificed, () => next.scene.endTurn());

    // Et il n'a jamais la main : plus un seul Pokemon, donc plus un seul tour à lui.
    await expect(trio.sacrificed.wait).toHaveCount(0);
    for (const peer of trio.all) {
      await expect(peer.divergence).toHaveCount(0);
      await expect(peer.anyForfeit).toHaveCount(0);
    }
  } finally {
    await trio.close();
  }
});

test("§12.13 en ligne à 3 camps : « Retour au menu » quitte, et les deux survivants jouent encore", async ({
  browser,
}) => {
  const trio = await OnlineTrio.open(browser);
  try {
    await trio.startBattle();
    await trio.playUntilSacrificedHasHand();
    await trio.sacrifice();

    const sacrificedView = new EliminationView(trio.sacrificed.page);
    await expect(sacrificedView.dialog).toBeVisible({ timeout: 30_000 });

    // (a) L'éliminé part, et il est au menu principal.
    await sacrificedView.backToMenu.click();
    await expect(trio.sacrificed.menu.title).toBeVisible({ timeout: 30_000 });

    /*
     * (b) Chez les survivants, le départ est d'abord ATTENDU — le bandeau de reconnexion — puis
     * tranché : `forfeitSeat` efface le bandeau au moment où il sort la place du quorum. Voir le
     * bandeau s'effacer est le signal que la place n'est plus attendue ; les tours joués APRÈS
     * portent donc sur un quorum qui ne la compte plus.
     */
    for (const peer of [trio.host, trio.survivor]) {
      await expect(peer.notice.notice).toBeVisible({ timeout: 30_000 });
    }
    for (const peer of [trio.host, trio.survivor]) {
      await expect(peer.notice.notice).toBeHidden({ timeout: 60_000 });
    }

    /*
     * (c) Les deux survivants jouent chacun au moins un tour, sans se figer : chaque action jouée
     * d'un côté parvient de l'autre.
     */
    const played = new Set<OnlinePeer>();
    for (let turn = 0; turn < 6 && played.size < 2; turn += 1) {
      const actor = await trio.peerWithHand([trio.host, trio.survivor]);
      const observer = actor === trio.host ? trio.survivor : trio.host;
      await trio.actAndAwait(observer, () => actor.scene.endTurn());
      played.add(actor);
    }
    expect(played.size).toBe(2);
    // Et la main revient encore : la partie n'est pas figée après ces tours.
    await trio.peerWithHand([trio.host, trio.survivor]);

    /*
     * (d) Aucun forfait prononcé contre un survivant, aucune divergence, pas de fin de partie.
     */
    for (const peer of [trio.host, trio.survivor]) {
      await expect(peer.anyForfeit.filter({ hasText: /Joueur [12]\b/ })).toHaveCount(0);
      await expect(peer.divergence).toHaveCount(0);
      await expect(peer.battleOver).toHaveCount(0);
    }
  } finally {
    await trio.close();
  }
});

test("§12.14 hot-seat à 3 camps : la ligne de journal, et AUCUN dialogue d'élimination", async ({
  page,
}) => {
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const teams = new TeamSelectScreen(page);
  const scene = new CombatScene(page);
  const activePanel = new InfoPanel(page);
  const view = new EliminationView(page);
  const logEntries = page.getByTestId("battle-log-entry");
  const wait = page.getByRole("button", { name: "Attendre", exact: true });

  await seedSavedTeams(page, ELIMINATION_TEAM_STORAGE);
  await menu.goto();
  await menu.combat.click();
  await mode.local.click();
  await expect(teams.title).toBeVisible();

  // Trois camps, les trois HUMAINS : un vrai hot-seat, un seul écran pour tout le monde.
  await teams.formatSegmentForTeamCount(3).click();
  await teams.controllerButton(1, "human").click();
  await teams.controllerButton(2, "human").click();
  await teams.pickSavedTeam(0, ALAKAZAM_TEAM_ID);
  await teams.pickSavedTeam(1, ABRA_TEAM_ID);
  await teams.pickSavedTeam(2, SACRIFICE_TEAM_ID);
  await expect(teams.launch).toBeEnabled();
  await teams.launch.click();
  await scene.waitReady(30_000);

  // Les tours passent jusqu'à Mélodelfe — le panneau de gauche montre le Pokemon ACTIF.
  for (let turn = 0; turn < 6; turn += 1) {
    await expect(wait).toBeVisible({ timeout: 30_000 });
    if ((await activePanel.name.textContent())?.includes(SACRIFICE_NAME) === true) {
      break;
    }
    const before = await logEntries.count();
    await scene.endTurn();
    await expect.poll(() => logEntries.count(), { timeout: 30_000 }).toBeGreaterThan(before);
  }
  await expect(activePanel.name).toContainText(SACRIFICE_NAME);

  await castHealingWishOnEmptyNeighbour(page, scene);

  // (a) La ligne de journal : c'est tout ce que le hot-seat gagne, et il le gagne.
  await expect(view.logLine(3)).toBeAttached({ timeout: 30_000 });

  /*
   * (b) 🔴 Et AUCUN dialogue. Point de synchronisation d'abord : la main passée à un survivant prouve
   * que la file a dépassé l'endroit où le dialogue aurait été ouvert.
   */
  await expect(wait).toBeVisible({ timeout: 30_000 });
  await expect(activePanel.name).not.toContainText(SACRIFICE_NAME, { timeout: 30_000 });
  await expect(view.dialog).toHaveCount(0);
  await expect(page.getByTestId("battle-over")).toHaveCount(0);
});

test("§12.15 en ligne à 3 camps : la victoire referme le dialogue d'élimination, sans qu'aucune issue soit choisie", async ({
  browser,
}) => {
  /*
   * La troisième sortie du dialogue du plan 210, et la seule que le joueur ne choisit pas : la
   * partie se termine pendant qu'il lit encore le verdict, et `showVictory` referme l'élimination
   * pour ne pas empiler deux modales.
   *
   * 🔴 Ce que ce cas garde côté mesure (plan 212, Lot C) : `showEliminated` rapporte alors
   * `choice === null`, et **rien ne doit être compté**. Compter cette fermeture comme « a continué à
   * regarder » gonflerait le compteur de tous ceux qui n'ont rien décidé — soit exactement la
   * population dont on veut la taille. Le compteur lui-même n'est pas lisible ici (la télémétrie est
   * muette hors des hôtes de publication) ; ce scénario garde le FAIT qui le conditionne : ce
   * chemin existe, il ferme bien le dialogue, et il le fait sans passer par un bouton.
   *
   * Le camp 2 part par « Abandonner » plutôt que le camp 1 : c'est un INVITÉ, donc la partie ne se
   * met pas en migration d'hôte, qui est un autre sujet (cahier §12.11).
   */
  const trio = await OnlineTrio.open(browser);
  try {
    await trio.startBattle();
    await trio.playUntilSacrificedHasHand();
    await trio.sacrifice();

    const sacrificedView = new EliminationView(trio.sacrificed.page);
    await expect(sacrificedView.dialog).toBeVisible({ timeout: 30_000 });
    // Personne n'a touché aux deux issues, et la partie n'est pas finie : l'état de départ du cas.
    await expect(trio.sacrificed.battleOver).toHaveCount(0);

    /*
     * Le camp 2 abandonne : il ne reste qu'un camp debout, donc le moteur conclut. La confirmation
     * est celle de « Abandonner » (§4.20), qui détruit la partie.
     */
    const { combatMenu } = trio.survivor;
    await expect(combatMenu.openButton).toBeEnabled({ timeout: 30_000 });
    await combatMenu.openByButton();
    await combatMenu.abandon.click();
    await combatMenu.confirm.click();

    /*
     * Chez l'éliminé : le dialogue de fin de partie prend la place, et celui d'élimination a bien
     * DISPARU — deux modales empilées laisseraient fermer la mauvaise, et le joueur n'aurait de
     * toute façon rien choisi.
     */
    await expect(trio.sacrificed.battleOver).toBeVisible({ timeout: 60_000 });
    await expect(sacrificedView.dialog).toHaveCount(0);

    // Et le camp 1 conclut de la même façon : la partie est finie pour tout le monde.
    await expect(trio.host.battleOver).toBeVisible({ timeout: 60_000 });
  } finally {
    await trio.close();
  }
});
