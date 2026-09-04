import { signallingPort } from "../../../playwright.config";
import { expect, test } from "../../fixtures";
import { CombatScene } from "../../pages/CombatScene";
import { LobbyScreen, WaitingRoom } from "../../pages/lobby";
import { MainMenu } from "../../pages/MainMenu";
import { BattleModeScreen, MapSelectScreen, TeamSelectScreen } from "../../pages/screens";

// Cahier §11 — jeu en ligne (plan 199). UN SEUL scénario à deux contextes de navigateur : la suite
// est déjà à ~520 tests sous plafond de processeur, et deux contextes qui négocient du WebRTC coûtent
// nettement plus qu'un test DOM ordinaire. Ce qui se teste sans réseau — allocation de places,
// départs, lancement accusé, lancement annulé — l'est en intégration (`packages/network`), sur le
// canal en mémoire.

/**
 * L'annuaire local du harnais, jamais le service public : la suite ne dépend d'aucun tiers.
 *
 * `peerIce=off` coupe STUN/TURN — **propre au harnais**, et pas le défaut de `?peerPort=` : les deux
 * pairs sont ici sur la boucle locale, alors qu'un humain qui teste sur un annuaire local en a besoin
 * (Firefox refuse la négociation sans STUN, retour de recette du 2026-09-04).
 */
const localSignalling = `?peerPort=${signallingPort}&peerIce=off`;

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
