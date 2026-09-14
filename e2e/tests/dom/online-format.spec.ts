import type { BrowserContext } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { OnlinePeer } from "../../pages/online-session";

/*
 * Cahier §12.9 et §12.10 — le FORMAT d'une partie en ligne (plan 209, Lot C3).
 *
 * Ce que ces deux scénarios gardent, et qu'aucun autre ne garde : le format est redevenu un **choix
 * de salle d'attente**, après avoir été gravé au `lobby` pendant trois plans (#896, #944). Deux faits
 * en découlent, et les deux sont des promesses faites au joueur :
 *
 * 1. changer de format **ne change pas le code** — c'était l'objection qui avait fait poser le
 *    sélecteur au `lobby`, et elle ne tenait pas : `Room.setTeamCount` recompose les places sans
 *    toucher à l'adresse du salon. Un hôte qui a déjà dicté son code au téléphone ne le voit pas
 *    changer sous ses doigts ;
 * 2. rétrécir le format **éjecte les derniers arrivés**, jamais le premier — le numéro de place EST
 *    l'ordre d'arrivée (`claimFirstFreeSeat` balaie vers le haut) — et l'éjecté **apprend pourquoi**.
 *
 * Le premier scénario n'ouvre QU'UN contexte de navigateur : tout s'y joue sur l'écran de l'hôte,
 * seul dans son salon, donc sans négociation WebRTC. Le second en ouvre trois, ce qui est le prix
 * minimum d'une éjection : il faut quelqu'un à éjecter **et** quelqu'un qui reste, sans quoi rien ne
 * distingue « le dernier arrivé sort » de « un invité sort ».
 */

/*
 * Plus long que les 60 s du projet `dom`, comme les autres specs en ligne : le second scénario monte
 * TROIS contextes de navigateur et deux négociations WebRTC. Aucun boot Babylon en revanche — tout
 * se passe en salle d'attente, la partie n'est jamais lancée.
 */
test.setTimeout(120_000);

test("§12.9 en ligne : l'hôte change de format dans la salle d'attente, le code ne bouge pas", async ({
  page,
}) => {
  const host = new OnlinePeer(page);
  const code = await host.openRoom();
  expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);

  /*
   * (a) Les CINQ formats sont offerts — 2, 3, 4, 6 et 12 camps (`REQUIRED_TEAM_COUNTS`), que
   * `validateTiledMap` exige de chaque carte du roster. La rangée avait disparu de cet écran au plan
   * 199, puis le réseau s'était verrouillé au duel (#944) ; le plan 209 renverse les deux.
   */
  await expect(host.teams.formatSegmentButtons).toHaveCount(5);
  for (const teamCount of [2, 3, 4, 6, 12]) {
    await expect(host.teams.formatSegmentForTeamCount(teamCount)).toHaveCount(1);
  }

  // (b) On ouvre sur le duel, et la salle d'attente le DIT sur sa propre ligne (plan 207, étape 7).
  await expect(host.room.format).toContainText("1 contre 1");
  await expect(host.teams.activeFormatSegment).toHaveAttribute("data-format-key", /^2v/);
  // Deux camps, donc deux lignes : pas de troisième joueur à composer.
  await expect(page.getByText("Joueur 3", { exact: true })).toHaveCount(0);

  // — Le geste : passer à quatre camps —————————————————————————————————————————————————————————
  await host.teams.formatSegmentForTeamCount(4).click();

  // (c) Les lignes des joueurs 3 et 4 apparaissent, et elles sont composables — ce sont des places
  // libres, que le code sert justement à faire remplir.
  await expect(page.getByText("Joueur 3", { exact: true })).toBeVisible();
  await expect(page.getByText("Joueur 4", { exact: true })).toBeVisible();
  await expect(host.room.seatStatus(2)).toHaveText("⏳ Place libre");
  await expect(host.room.seatStatus(3)).toHaveText("⏳ Place libre");

  // (d) Le bandeau annonce le nouveau format en clair — « Format · 4 joueurs », le cas général de
  // `formatLabel` que le plan 207 avait failli supprimer comme code mort.
  await expect(host.room.format).toContainText("4 joueurs");

  /*
   * (e) 🔴 **Et le code n'a PAS changé.** C'est le point du lot : `Room.setTeamCount` ajoute et
   * retire des places puis rediffuse, sans refermer le salon ni en rouvrir un autre. L'adresse que
   * l'hôte a peut-être déjà dictée reste valable.
   */
  await expect(host.room.code).toHaveText(code);

  /*
   * (f) La rangée disparaît quand l'hôte se déclare « Prêt » — même règle que les autres paramètres
   * de partie (recette 2026-09-04) : on ne change pas la règle après s'y être engagé. Elle
   * **disparaît** plutôt que de s'afficher inerte, parce qu'il n'y a plus de décision en attente.
   */
  await host.teams.pickRandomTeam(0);
  await expect(host.room.ready).toBeEnabled();
  await host.room.ready.click();
  await expect(host.room.formatSegments).toHaveCount(0);

  // Et « Pas prêt » la rend : le gel est réversible, il ne détruit rien.
  await host.room.ready.click();
  await expect(host.room.formatSegments).toHaveCount(5);
  await expect(host.room.format).toContainText("4 joueurs");
});

test("§12.10 en ligne : réduire le format éjecte le DERNIER arrivé, et lui dit pourquoi", async ({
  browser,
}) => {
  const contexts: BrowserContext[] = [];
  const openPeer = async (): Promise<OnlinePeer> => {
    const context = await browser.newContext({ locale: "fr-FR" });
    contexts.push(context);
    return new OnlinePeer(await context.newPage());
  };

  try {
    const host = await openPeer();
    const code = await host.openRoom();
    await host.teams.formatSegmentForTeamCount(4).click();
    await expect(host.room.format).toContainText("4 joueurs");

    /*
     * 🔴 **L'ordre d'entrée est la donnée du scénario**, pas une commodité de rédaction : le premier
     * invité prend la place 2, le second la place 3, parce qu'un arrivant balaie les places vers le
     * haut et prend la première libre. Les faire entrer en parallèle rendrait le test sans objet.
     */
    const firstGuest = await openPeer();
    await firstGuest.joinRoom(code);
    const lastGuest = await openPeer();
    await lastGuest.joinRoom(code);

    // Chacun lit sa propre place sur sa propre ligne : « 🎮 Vous » au camp 2 pour le premier, au
    // camp 3 pour le second (les camps sont 0-indexés à l'écran, les places à partir de 1).
    await expect(firstGuest.room.selfChip).toHaveAttribute("data-slot-index", "1");
    await expect(lastGuest.room.selfChip).toHaveAttribute("data-slot-index", "2");
    // Un invité n'a AUCUN segment de format : c'est l'hôte qui tient le format, et la rangée
    // disparaît plutôt que de s'afficher inerte — il n'y a pas de décision en attente de son côté.
    await expect(firstGuest.room.formatSegments).toHaveCount(0);
    // L'hôte voit ses deux invités.
    await expect(host.room.remoteSeats).toHaveCount(2, { timeout: 30_000 });

    // — Le geste : l'hôte repasse à deux camps ————————————————————————————————————————————————
    await host.teams.formatSegmentForTeamCount(2).click();
    await expect(host.room.format).toContainText("1 contre 1");

    /*
     * (a) 🔴 C'est le DERNIER arrivé qui sort. Il quitte l'écran d'équipe — on ne reste pas sur la
     * salle d'attente d'un salon qui ne vous attend plus — et retombe sur « Jouer en ligne », où la
     * cause se prononce en MODALE (retour de recette du 2026-09-14 : une ligne rouge en pied de page
     * devant un écran de composition intact n'apprenait rien au joueur).
     */
    await expect(lastGuest.lobby.title).toBeVisible({ timeout: 30_000 });
    await expect(lastGuest.lobby.refusal).toBeVisible();
    await expect(lastGuest.lobby.refusalMessage).toHaveText(
      "L'hôte a changé le format de la partie : il n'y a plus de place pour toi.",
    );
    /*
     * (b) « Retour au menu », et surtout **pas « Réessayer »** : rien n'a échoué. Un humain a décidé
     * du format de sa partie, et insister ne rouvrira pas la place.
     */
    await expect(lastGuest.lobby.refusalDismiss).toHaveText("Retour au menu");

    /*
     * (c) 🔴 Et le PREMIER arrivé reste, à sa place. C'est l'autre moitié de la promesse : retirer
     * les places hautes fait sortir ceux qui viennent d'entrer, jamais celui qui attendait depuis le
     * début. La première rédaction du lot prenait cet ordre à l'envers.
     */
    await expect(firstGuest.room.panel).toBeVisible();
    await expect(firstGuest.room.code).toHaveText(code);
    await expect(firstGuest.room.selfChip).toHaveAttribute("data-slot-index", "1");

    // (d) Et il voit le troisième joueur DISPARAÎTRE de son écran : le format est un fait de salon,
    // pas un fait d'écran. Sans ça, deux pairs ne voyaient plus la même partie.
    await expect(firstGuest.room.format).toContainText("1 contre 1", { timeout: 30_000 });
    await expect(firstGuest.page.getByText("Joueur 3", { exact: true })).toHaveCount(0);

    // (e) Côté hôte, il ne reste qu'un joueur distant, et la partie est toujours la même.
    await expect(host.room.remoteSeats).toHaveCount(1, { timeout: 30_000 });
    await expect(host.room.code).toHaveText(code);
  } finally {
    for (const context of contexts) {
      await context.close();
    }
  }
});
