import { expect, test } from "../../fixtures";
import { OnlinePeer, OnlineSession } from "../../pages/online-session";
import { PlacementPhase } from "../../pages/placement";

/*
 * Cahier §11.11 à §11.14 — le placement à la main EN LIGNE, à deux VRAIS pairs (plan 211).
 *
 * 🔴 C'est le trou que ce plan solde, et il valait le coût de deux contextes de navigateur. Avant
 * lui, AUCUN test ne couvrait un placement en ligne entre deux joueurs : le seul spec qui décochait
 * « Placement auto » (`online-combat-menu.spec.ts`) mettait une IA en face, et une IA se place toute
 * seule — le défaut ne pouvait donc pas y apparaître. Le placement auto étant coché par défaut, la
 * recette manuelle passait elle aussi toujours par le chemin qui marche.
 *
 * Ce que le défaut donnait, et qu'aucun de ces scénarios ne doit laisser revenir : la phase de
 * placement ne savait pas qu'une partie pouvait être en ligne, donc elle faisait poser LES DEUX
 * camps sur CHAQUE écran — douze poses par machine — puis le détecteur de désynchronisation tuait la
 * partie avant le premier tour, sur un message que personne ne pouvait comprendre.
 *
 * Deux contextes, deux boots Babylon et une négociation WebRTC par scénario : d'où le délai large.
 */
test.setTimeout(180_000);

/**
 * Le plafond de Pokemon par camp, tous formats confondus : `⌊12 / nombre de camps⌋` vaut 6 au format
 * à deux camps, le plus généreux. Une borne de boucle, pas une attente — le scénario s'arrête dès que
 * le roster ne propose plus rien, une équipe tirée au hasard pouvant en compter moins.
 */
const MAX_TEAM_SIZE = 6;

/**
 * Pose tous les Pokemon d'un camp, et rend combien on en a posé.
 *
 * Le compte est RENDU parce que les scénarios en ont besoin : le hook de scène nomme les sprites par
 * leur espèce (« charizard »), jamais par leur camp, donc « est-ce que je vois le camp d'en face ? »
 * ne se lit pas sur un identifiant — il se lit sur un NOMBRE. Voir comment il sert à §11.14.
 */
async function placeWholeTeam(
  placement: PlacementPhase,
  scene: Parameters<PlacementPhase["placeNext"]>[0],
): Promise<number> {
  await expect(placement.instruction).toBeVisible({ timeout: 30_000 });
  // Une équipe tirée au hasard peut compter moins que le maximum du format : on pose tant que le
  // roster propose quelque chose, plutôt que de coder en dur un nombre que le test ne connaît pas.
  let placed = 0;
  for (let attempt = 0; attempt < MAX_TEAM_SIZE; attempt += 1) {
    if (!(await placement.instruction.isVisible())) {
      break;
    }
    await placement.placeNext(scene);
    placed += 1;
  }
  return placed;
}

test("§11.11 en ligne : chacun place son camp, et les deux parties concordent au lancement", async ({
  browser,
}) => {
  const session = await OnlineSession.open(browser, { interactivePlacement: true });

  try {
    await session.startBattle();
    const { host, guest } = session;
    const hostPlacement = new PlacementPhase(host.page);
    const guestPlacement = new PlacementPhase(guest.page);

    /*
     * Les deux posent EN MÊME TEMPS, et c'est le sujet : en simultané, personne n'attend son tour.
     * Les lancer en parallèle prouve aussi qu'aucun des deux flux n'attend une pose de l'autre pour
     * avancer — le cas qui bloquait à l'infini si le flux avait gardé l'alternance.
     */
    const [placedByHost, placedByGuest] = await Promise.all([
      placeWholeTeam(hostPlacement, host.scene),
      placeWholeTeam(guestPlacement, guest.scene),
    ]);

    /*
     * 🔴 L'assertion qui vaut tout le plan. Le combat démarre chez les DEUX : cela prouve d'un coup
     * que les poses ont voyagé, qu'elles ont été rangées dans le même ordre des deux côtés, et que
     * l'empreinte de lancement concorde. Avec le défaut, on n'arrivait jamais ici — le détecteur
     * prononçait un forfait bilatéral avant le premier tour.
     */
    const total = placedByHost + placedByGuest;
    await expect
      .poll(async () => (await host.scene.spriteStates()).length, { timeout: 60_000 })
      .toBe(total);
    await expect
      .poll(async () => (await guest.scene.spriteStates()).length, { timeout: 60_000 })
      .toBe(total);

    // Et le journal ne porte AUCUN constat de divergence : le vrai test du silence.
    await expect(host.divergence).toHaveCount(0);
    await expect(guest.divergence).toHaveCount(0);
    await expect(host.anyForfeit).toHaveCount(0);
  } finally {
    await session.close();
  }
});

test("§11.12 en ligne : on ne pose que SON camp, jamais celui d'en face", async ({ browser }) => {
  const session = await OnlineSession.open(browser, { interactivePlacement: true });

  try {
    await session.startBattle();
    const { host } = session;
    const placement = new PlacementPhase(host.page);
    await expect(placement.instruction).toBeVisible({ timeout: 30_000 });

    /*
     * Le compteur du roster dit `Placés : n/max` pour le camp qu'on pilote. Après avoir posé toute
     * son équipe, l'hôte n'a plus RIEN à poser — alors qu'avec le défaut, le flux enchaînait sur le
     * camp adverse et le roster réapparaissait pour lui.
     */
    await placeWholeTeam(placement, host.scene);

    await expect(placement.instruction).toBeHidden({ timeout: 30_000 });
    await expect(host.page.getByTestId("placement-waiting")).toBeVisible({ timeout: 30_000 });
  } finally {
    await session.close();
  }
});

test("§11.13 en ligne : le récapitulatif dit qui est prêt, sans rien dire du placement", async ({
  browser,
}) => {
  const session = await OnlineSession.open(browser, { interactivePlacement: true });

  try {
    await session.startBattle();
    const { host, guest } = session;
    const hostPlacement = new PlacementPhase(host.page);
    const guestPlacement = new PlacementPhase(guest.page);
    await expect(hostPlacement.instruction).toBeVisible({ timeout: 30_000 });

    await placeWholeTeam(hostPlacement, host.scene);
    const panel = host.page.getByTestId("placement-waiting");
    await expect(panel).toBeVisible({ timeout: 30_000 });

    // Moi : prêt. L'autre : encore en train de placer — il n'a pas commencé.
    await expect(host.page.getByTestId("placement-waiting-seat-1")).toHaveAttribute(
      "data-state",
      "ready",
    );
    await expect(host.page.getByTestId("placement-waiting-seat-2")).toHaveAttribute(
      "data-state",
      "placing",
    );

    /*
     * 🔴 Le panneau dit l'ÉTAT, jamais le contenu. Un décompte (« 4 sur 6 ») trahirait le rythme
     * d'en face, et à douze camps ce serait une grille d'information gratuite offerte à tous.
     */
    await expect(panel).not.toContainText(/\d+\s*\/\s*\d+/);

    /*
     * L'invité place à son tour. Tout le monde étant prêt, le combat démarre — et le panneau
     * disparaît avec la phase. On ne peut donc PAS observer sa ligne passer à « prêt » : l'instant où
     * elle basculerait est l'instant où le panneau cesse d'exister. Ce que le scénario garde, c'est
     * que l'attente se TERMINE quand le dernier camp a posé, au lieu de rester à l'écran.
     */
    await placeWholeTeam(guestPlacement, guest.scene);
    await expect(panel).toBeHidden({ timeout: 60_000 });
  } finally {
    await session.close();
  }
});

test("§11.14 en ligne : rien du camp adverse n'est visible avant le lancement", async ({
  browser,
}) => {
  const session = await OnlineSession.open(browser, { interactivePlacement: true });

  try {
    await session.startBattle();
    const { host, guest } = session;
    const hostPlacement = new PlacementPhase(host.page);
    const guestPlacement = new PlacementPhase(guest.page);

    // L'invité pose TOUT son camp le premier : ses poses sont donc déjà arrivées chez l'hôte.
    await expect(guestPlacement.instruction).toBeVisible({ timeout: 30_000 });
    const placedByGuest = await placeWholeTeam(guestPlacement, guest.scene);

    // L'hôte n'a encore rien posé : son plateau doit être VIDE malgré les poses reçues.
    await expect(hostPlacement.instruction).toBeVisible({ timeout: 30_000 });
    expect(await host.scene.spriteStates()).toHaveLength(0);

    /*
     * L'hôte pose UN SEUL Pokemon : il en voit exactement un. C'est la contre-épreuve du scénario —
     * sans elle, un plateau vide prouverait seulement que rien ne s'affiche jamais — et c'est la
     * mesure du masquage, puisque les six poses de l'invité sont dans son moteur depuis un moment.
     *
     * Un seul, et pas toute l'équipe : l'hôte étant le DERNIER à finir, sa dernière pose déclenche
     * le départ du combat et la révélation dans la foulée. Mesurer après aurait compté douze sprites
     * et fait croire à une fuite là où il n'y a qu'un enchaînement correct.
     */
    await hostPlacement.placeNext(host.scene);
    await expect
      .poll(async () => (await host.scene.spriteStates()).length, { timeout: 15_000 })
      .toBe(1);

    // Puis il finit : tout le monde est prêt, et les deux camps apparaissent d'un coup — TOUS, pas
    // « plus d'un », sinon l'assertion passerait sur une révélation partielle.
    const placedByHost = 1 + (await placeWholeTeam(hostPlacement, host.scene));
    await expect
      .poll(async () => (await host.scene.spriteStates()).length, { timeout: 60_000 })
      .toBe(placedByHost + placedByGuest);
  } finally {
    await session.close();
  }
});

test("§11.15 en ligne : le compte à rebours est visible PENDANT qu'on place, pas seulement après", async ({
  browser,
}) => {
  const session = await OnlineSession.open(browser, { interactivePlacement: true });

  try {
    await session.startBattle();
    const { host, guest } = session;
    const placement = new PlacementPhase(host.page);
    const guestPlacement = new PlacementPhase(guest.page);
    await expect(placement.instruction).toBeVisible({ timeout: 30_000 });

    /*
     * 🔴 Retour humain à la recette du 2026-09-15. Le compteur n'existait d'abord que dans le
     * récapitulatif d'attente, donc on ne le découvrait qu'APRÈS avoir tout posé — c'est-à-dire au
     * moment où il ne sert plus à rien. Il court pourtant dès la première case.
     */
    const clock = host.page.getByTestId("placement-clock");
    await expect(clock).toBeVisible();
    await expect(host.page.getByTestId("turn-clock-value")).toHaveText(/^\d+:\d{2}$/);

    // Et il DESCEND : un compteur figé serait pire que pas de compteur.
    const firstReading = await host.page.getByTestId("turn-clock-value").textContent();
    await expect
      .poll(async () => host.page.getByTestId("turn-clock-value").textContent(), {
        timeout: 15_000,
      })
      .not.toBe(firstReading);

    /*
     * Il SURVIT à ma propre fin de placement : tant que j'attends les autres, la fenêtre court
     * toujours, et le compteur dit dans combien de temps les retardataires seront servis d'office.
     */
    await placeWholeTeam(placement, host.scene);
    await expect(host.page.getByTestId("placement-waiting")).toBeVisible({ timeout: 30_000 });
    await expect(clock).toBeVisible();

    // Il ne disparaît qu'avec la PHASE : pendant le combat, c'est l'autre chrono qui prend le relais.
    await placeWholeTeam(guestPlacement, guest.scene);
    await expect(clock).toBeHidden({ timeout: 60_000 });
  } finally {
    await session.close();
  }
});

test("§11.16 en ligne avec une place IA : elle se place toute seule et le combat démarre", async ({
  page,
}) => {
  /*
   * 🔴 Le blocage trouvé en revue de code, et que rien ne voyait. `activePlayer()` ne rend que le
   * camp local, donc la branche IA du flux est inatteignable en ligne ; une IA n'émet aucun message
   * de placement, donc son camp n'était jamais compté fini, et le chrono ne sauve rien puisqu'il ne
   * pose que le camp local. La partie ne démarrait JAMAIS.
   *
   * Ce n'est pas un cas tordu : c'est « j'ouvre un salon, personne ne vient, je passe la place en
   * IA », le montage même de `online-combat-menu.spec.ts` — qui restait vert en s'arrêtant à l'écran
   * de placement, donc en masquant le blocage.
   *
   * Un seul contexte de navigateur suffit ici, comme pour §11.9 et §11.10 : la partie est « en
   * ligne » dès que `localSeat` existe.
   */
  const host = new OnlinePeer(page);
  await host.openRoom();
  await host.teams.autoPlacement.uncheck();
  await host.teams.pickRandomTeam(0);
  await host.teams.giveSlotToAi(1);
  await expect(host.room.ready).toBeEnabled();
  await host.room.ready.click();
  await expect(host.room.launch).toBeEnabled({ timeout: 30_000 });
  await host.room.launch.click();
  await host.scene.waitReady(30_000);

  const placement = new PlacementPhase(host.page);
  await expect(placement.instruction).toBeVisible({ timeout: 30_000 });

  // Le camp IA est déjà posé, et le récapitulatif le dit : on n'attend que moi.
  await expect(host.page.getByTestId("placement-clock")).toBeVisible();

  // Je pose le mien, et la partie DÉMARRE — c'est tout l'objet du scénario.
  const placedByHost = await placeWholeTeam(placement, host.scene);
  await expect
    .poll(async () => (await host.scene.spriteStates()).length, { timeout: 60_000 })
    .toBeGreaterThan(placedByHost);
  await expect(host.page.getByTestId("placement-waiting")).toBeHidden({ timeout: 30_000 });
});
