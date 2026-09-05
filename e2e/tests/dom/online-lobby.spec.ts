import { expect, localSignalling, test } from "../../fixtures";
import { CombatScene } from "../../pages/CombatScene";
import { LobbyScreen, WaitingRoom } from "../../pages/lobby";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, MapSelectScreen, TeamSelectScreen } from "../../pages/screens";

// Cahier §11 — jeu en ligne (plan 199). UN SEUL scénario à deux contextes de navigateur : la suite
// est déjà à ~520 tests sous plafond de processeur, et deux contextes qui négocient du WebRTC coûtent
// nettement plus qu'un test DOM ordinaire. Ce qui se teste sans réseau — allocation de places,
// départs, lancement accusé, lancement annulé — l'est en intégration (`packages/network`), sur le
// canal en mémoire.
//
// Le second scénario, lui, n'a qu'UN contexte : il se joue entièrement sur l'écran de l'hôte, seul
// dans son salon. Il ne paie donc pas la négociation WebRTC — seulement l'annuaire, qui lui donne son
// identité, donc son code.

/*
 * Plus long que les 60 s du projet `dom`, pour une raison propre à ce scénario : il fait DEUX
 * contextes de navigateur, une négociation WebRTC entre eux, et **deux** boots Babylon complets à
 * l'entrée en combat.
 *
 * Mesuré ~9 s isolé sur cette machine — la marge absorbe la file d'attente du serveur Vite partagé
 * quand la suite entière tourne, où un spec `dom` peut se dégrader de plus de 20× (voir le
 * commentaire du projet `dom` dans `playwright.config.ts`).
 */
test.setTimeout(120_000);

test("§11.1 en ligne : créer, rejoindre, et entrer en combat à deux", async ({ browser }) => {
  const hostContext = await browser.newContext({ locale: "fr-FR" });
  const guestContext = await browser.newContext({ locale: "fr-FR" });
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  try {
    // — L'hôte : menu → Combat → En ligne → format → Créer → terrain → salle d'attente —————————
    const hostMenu = new MainMenu(hostPage);
    const hostMode = new BattleModeScreen(hostPage);
    const hostLobby = new LobbyScreen(hostPage);
    const hostMaps = new MapSelectScreen(hostPage);
    const hostRoom = new WaitingRoom(hostPage);
    const hostTeams = new TeamSelectScreen(hostPage);

    await hostMenu.goto(localSignalling);
    await hostMenu.combat.click();
    await hostMode.online.click();
    await expect(hostLobby.title).toBeVisible();

    // Le format se choisit AVANT la création (décision #896) : « 2 joueurs », le premier segment.
    await hostLobby.formatSegments.first().click();
    await hostLobby.create.click();

    // L'hôte passe par l'écran de terrain — l'invité, lui, n'en verra que le nom.
    await expect(hostMaps.title).toBeVisible();
    await hostMaps.confirm.click();

    // Le code naît ICI, à l'entrée sur la salle d'attente, jamais avant.
    await expect(hostRoom.panel).toBeVisible();
    const code = (await hostRoom.code.textContent())?.trim() ?? "";
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);

    // Le format est gravé : sa rangée de segments a disparu de l'écran d'équipe.
    await expect(hostRoom.formatSegments).toHaveCount(0);

    // L'hôte compose SA ligne — la première, la sienne. Sans équipe, « Lancer » reste inerte.
    await hostTeams.pickRandomTeam(0);

    // — L'invité : menu → Combat → En ligne → saisie du code au clavier → Rejoindre ——————————————
    const guestMenu = new MainMenu(guestPage);
    const guestMode = new BattleModeScreen(guestPage);
    const guestLobby = new LobbyScreen(guestPage);
    const guestRoom = new WaitingRoom(guestPage);

    await guestMenu.goto(localSignalling);
    await guestMenu.combat.click();
    await guestMode.online.click();
    await expect(guestLobby.title).toBeVisible();

    await expect(guestLobby.codeSlots).toHaveCount(5);
    await guestLobby.typeCode(code);
    expect(await guestLobby.readCode()).toBe(code);
    await guestLobby.join.click();

    // L'invité arrive dans la salle d'attente sans avoir choisi de carte : elle vient de l'hôte.
    await expect(guestRoom.panel).toBeVisible({ timeout: 30_000 });
    await expect(guestRoom.code).toHaveText(code);
    // Il ne décide de rien : son bouton est « Prêt », pas « Lancer ».
    await expect(guestRoom.ready).toBeVisible();

    // — L'hôte voit la ligne devenir distante ————————————————————————————————————————————————————
    await expect(hostRoom.remoteSeats).toHaveCount(1, { timeout: 30_000 });
    // Et il ne peut pas encore lancer : personne n'est prêt.
    await expect(hostRoom.launch).toBeDisabled();

    // — L'invité compose SA ligne, la deuxième, puis confirme ————————————————————————————————————
    const guestTeams = new TeamSelectScreen(guestPage);
    await guestTeams.teamButton(1).click({ timeout: 8_000 });
    await guestPage
      .getByRole("dialog")
      .getByRole("button", { name: "🎲 Aléatoire", exact: true })
      .click({ timeout: 8_000 });
    await expect(guestRoom.ready).toBeEnabled();
    await guestRoom.ready.click();
    // Son propre bouton bascule : la confirmation a bien été prise en local.
    await expect(guestRoom.ready).toHaveText("Pas prêt");

    /*
     * — L'hôte confirme aussi ——————————————————————————————————————————————————————————————————————
     *
     * Il a son propre « Prêt » depuis la recette du 2026-09-04, et sa confirmation compte comme celle
     * des autres : `isEveryoneReady` n'exempte plus personne. « Lancer » reste donc inerte tant que
     * l'hôte ne s'est pas déclaré prêt, même quand tous les invités le sont.
     */
    await expect(hostRoom.launch).toBeDisabled();
    await expect(hostRoom.ready).toBeEnabled();
    await hostRoom.ready.click();

    await expect(hostRoom.launch).toBeEnabled({ timeout: 30_000 });
    await hostRoom.launch.click();

    // — Les deux entrent en combat ————————————————————————————————————————————————————————————————
    /*
     * Le lancement est ACCUSÉ (décision #903) : l'hôte n'entre en combat que lorsque l'invité a
     * confirmé avoir reçu le `start`. Voir les DEUX scènes prêtes est donc ce qui prouve la boucle
     * complète — et c'est précisément le cas que l'accusé existe pour attraper, un pair resté sur
     * l'écran d'équipe à attendre un tour qui n'arriverait jamais.
     *
     * On passe par le signal de disponibilité de la scène, pas par la présence d'un `<canvas>` :
     * l'élément existe dès le montage, alors que `isReady()` attend la carte et les atlas chargés.
     */
    await expect(hostTeams.title).toBeHidden({ timeout: 30_000 });
    await new CombatScene(hostPage).waitReady(30_000);
    await new CombatScene(guestPage).waitReady(30_000);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test("§11.2 en ligne : « Humain » sur une place libre laisse le salon jouable", async ({
  page,
}) => {
  /*
   * Régression du 2026-09-05. L'hôte pouvait poser « Humain » sur une place que PERSONNE ne tient :
   * `setSeatOccupancy` y écrivait `ready: false` pour une confirmation que personne ne pouvait
   * donner, donc « Lancer » — qui exige toutes les places prêtes — devenait inerte pour toujours. Et
   * le retour en arrière était fermé : `canEditSlot` ne rend la main que sur une place IA ou libre,
   * donc le segment disparaissait de la ligne. Le salon n'avait plus d'autre issue que d'être quitté.
   *
   * Correctif à deux étages : `Room.setSeatOccupancy` refuse `Human`, et l'écran envoie `Waiting` —
   * « je rouvre cette place à un joueur » — quand l'hôte presse « Humain ».
   *
   * Partie à QUATRE places : c'est le format qui donne trois lignes libres à basculer, là où le
   * deux joueurs n'en offre qu'une.
   */
  const menu = new MainMenu(page);
  const mode = new BattleModeScreen(page);
  const lobby = new LobbyScreen(page);
  const maps = new MapSelectScreen(page);
  const room = new WaitingRoom(page);
  const teams = new TeamSelectScreen(page);

  await menu.goto(localSignalling);
  await menu.combat.click();
  await mode.online.click();
  await lobby.formatSegment(4).click();
  await lobby.create.click();
  await maps.confirm.click();
  await expect(room.panel).toBeVisible();

  // L'hôte compose SA ligne : sans équipe sur chaque camp, « Lancer » est inerte pour une raison qui
  // n'a rien à voir avec ce qu'on teste ici.
  await teams.pickRandomTeam(0);

  // La deuxième ligne, que personne ne tient : « ⏳ Place libre » avant qu'on y touche.
  const freeSeat = room.seatStatus(1);
  await expect(freeSeat).toHaveText("⏳ Place libre");

  // — Le geste qui figeait tout ————————————————————————————————————————————————————————————————
  await teams.controllerButton(1, "human").click();

  // (a) La ligne dit toujours la même chose. Avant le correctif elle passait à « En attente » : elle
  // attendait la confirmation de quelqu'un qui n'existe pas.
  await expect(freeSeat).toHaveAttribute("data-state", "open");
  await expect(freeSeat).toHaveText("⏳ Place libre");

  // (b) Le segment est toujours là ET actionnable. Avant le correctif, la ligne n'étant plus ni libre
  // ni IA, `canEditSlot` la refusait et le segment sortait VIDE — plus un bouton à presser.
  await expect(teams.controllerButton(1, "human")).toBeEnabled();
  await expect(teams.controllerButton(1, "ai")).toBeEnabled();

  // Aller : la ligne part à l'IA, qui est prête d'office et reçoit une équipe aléatoire.
  await teams.controllerButton(1, "ai").click();
  await expect(freeSeat).toHaveText("Prêt");
  await expect(teams.controllerButton(1, "ai")).toHaveAttribute("data-state", "active");

  // Retour : elle redevient libre, et aucun des deux boutons n'est marqué — rien n'y est décidé.
  await teams.controllerButton(1, "human").click();
  await expect(freeSeat).toHaveAttribute("data-state", "open");
  await expect(teams.controllerButton(1, "ai")).not.toHaveAttribute("data-state", "active");

  /*
   * (c) Une place libre GARDE une équipe — celle qui joue si personne ne vient, `composeStartSeats`
   * la rendant en IA au lancement. C'est ce que le reste de l'écran suppose déjà : `canEditSlot` la
   * rend composable « dont l'équipe servira ».
   *
   * Sans ça, « Humain » vidait la ligne, et « Lancer » s'éteignait sur la règle LOCALE « aucun camp
   * vide » pour une place que le salon déclare pourtant prête — trois widgets de la même ligne se
   * contredisaient, et le salon partait en combat avec l'équipe périmée que l'écran venait de montrer
   * comme retirée (`announceSelection` sortant sur une équipe nulle).
   */
  await expect(teams.teamButton(1)).toHaveAttribute("data-state", "ephemeral");

  // (d) Il ne reste donc que la confirmation de l'hôte : places libres et IA sont prêtes d'office.
  await expect(room.ready).toBeEnabled();
  await room.ready.click();
  await expect(room.launch).toBeEnabled();
});
