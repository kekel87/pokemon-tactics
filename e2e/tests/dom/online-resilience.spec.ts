import { expect, test } from "../../fixtures";
import { OnlineSession } from "../../pages/online-session";
import { COMBAT_CHROME_ROOT, COMBAT_CHROME_SCROLLERS, Responsive } from "../../pages/responsive";

/*
 * Cahier §11 — robustesse du jeu en ligne (plan 202, Lot B3) : couper le canal d'un pair et revenir.
 *
 * Voisin de `online-lobby.spec.ts`, qui reste le contrat du SALON (allocation de places, code,
 * lancement accusé). Ici on ne teste que ce qui arrive **après** le lancement, quand un pair s'en
 * va : le compteur de chrono, le bandeau d'attente, le rattrapage du revenant, le forfait du chien
 * de garde et l'abandon volontaire.
 *
 * DEUX sessions seulement, et c'est un budget, pas une paresse : une session paie une négociation
 * WebRTC et **deux** boots Babylon complets, qui sont tout le coût. Un scénario qui l'a payée
 * enchaîne donc plusieurs faits — le même raisonnement que §11.1 quand le Lot B2 a greffé le combat
 * en réseau sur la traversée du salon plutôt que d'ouvrir un second contexte.
 *
 * 🔴 **Ce qui n'est PAS ici, et pourquoi.** Le chronomètre vaut 60 s et le chien de garde du silence
 * 75 s : aucun scénario n'attend ces délais en temps réel, et rien du harnais ne permet de les
 * avancer (les minuteurs de `Room` sont injectables en intégration, pas depuis le navigateur ;
 * `page.clock` figerait aussi la boucle de rendu Babylon et la négociation WebRTC). Sont donc
 * couverts en unitaire/intégration seulement : l'expiration du chrono (`battle-orchestrator.test`),
 * le forfait après trois tours manqués et son avertissement « 2/3 » (`online-battle.test`), et le
 * chien de garde du **silence** (`room.integration.test`). Les deux délais réellement joués ici sont
 * le court, et il ne dépend d'aucune supposition : les **30 s** que vaut en combat une fermeture
 * propre comme une seconde chute (`BATTLE_GRACE_SHORT_MS`, décision #950 révisée en recette le
 * 2026-09-09). Un onglet qui se ferme fait bien parvenir son `bye` — mesuré au décompte du bandeau,
 * qui lit 30 et non 75.
 */

/*
 * Bien plus long que les 60 s du projet `dom`, et pour trois raisons cumulées : deux contextes de
 * navigateur, cinq boots d'application (deux au lancement, trois onglets d'invité), et un délai de
 * grâce de 30 s réellement écoulé avant le forfait. Mesuré ~35 s isolé sur cette machine avant que
 * ce délai ne passe de 10 s à 30 s — la marge
 * absorbe la file d'attente du serveur partagé quand la suite entière tourne, où un spec `dom` peut
 * se dégrader de plus de 20×.
 */
test.setTimeout(240_000);

test("§11.3 en ligne : le canal tombe, le pair revient, rattrape, et se fait forfaiter s'il repart", async ({
  browser,
}) => {
  const session = await OnlineSession.open(browser);
  const { host } = session;

  try {
    await session.startBattle();

    /*
     * — Ce que le réseau ajoute à l'écran (plan 202, étape 1) ————————————————————————————————————
     *
     * Le compteur s'affiche des DEUX côtés, y compris pour le tour d'en face : deux cadrans de
     * pendule, pas le temps caché de Showdown — sinon l'attente d'un tour distant n'a pas de fin
     * visible. Son absence en solo est couverte à part (`combat/hud.spec`), là où elle est gratuite.
     */
    await expect(host.clock.hud).toBeVisible();
    await expect(session.guest.clock.hud).toBeVisible();
    await expect(host.clock.value).toHaveText(/^[01]:[0-5]\d$/);

    // La pastille du menu de combat : le menu n'est pas une pause (#819) et il grignote désormais du
    // temps mesuré. Ne pas le dire était la dette du plan 187.
    await host.combatMenu.openByButton();
    await expect(host.combatMenu.clockWarning).toContainText(
      "Le temps de votre tour continue de s'écouler",
    );
    await host.combatMenu.resume.click();
    await expect(host.combatMenu.dialog).toHaveCount(0);

    /*
     * — Passe responsive du compteur, MESURÉE ——————————————————————————————————————————————————————
     *
     * Les deux HUD neufs sont des enfants de flux de `.bc-top` (colonne flex centrée), donc ils ne
     * peuvent pas se chevaucher entre eux par construction. Ce qui n'allait PAS de soi est le
     * non-débordement : ils s'ajoutent à une pile qui portait déjà la bannière de tour, la météo et
     * le Vent Arrière, et le compteur a son propre référentiel en `cqw`.
     *
     * Balayé ici et non dans un test à part : la passe multi-entrée exige une mesure aux cinq
     * formats (`.claude/rules/multi-input.md`), et ces éléments n'existent QU'EN LIGNE — un test
     * dédié paierait une seconde session à deux contextes pour la même assertion. Ici la session
     * est déjà debout et aucun minuteur ne court encore.
     *
     * 🔴 Les quatre éléments du lot sont des AFFICHEURS, pas des contrôles : rien à atteindre au
     * clavier ni à la manette, rien à taper au doigt (la pastille du menu est un `<p>`, donc hors
     * de `FOCUSABLE_SELECTOR` — vérifié, la navigation aux flèches du menu est inchangée). Les axes
     * clavier/manette/tactile sont donc sans objet, et seul le responsive se mesure.
     */
    const VIEWPORTS = [
      { width: 568, height: 320 },
      { width: 667, height: 375 },
      { width: 1024, height: 768 },
      { width: 1920, height: 1080 },
      { width: 2560, height: 1440 },
    ];
    const initialViewport = host.page.viewportSize();
    const hostResponsive = new Responsive(host.page);
    for (const viewport of VIEWPORTS) {
      await host.page.setViewportSize(viewport);
      await expect(host.clock.hud).toBeVisible();
      await expect
        .poll(
          () => hostResponsive.elementsOutsideViewport(COMBAT_CHROME_ROOT, COMBAT_CHROME_SCROLLERS),
          { message: `compteur de chrono à ${viewport.width}×${viewport.height}` },
        )
        .toEqual([]);
    }
    if (initialViewport !== null) {
      await host.page.setViewportSize(initialViewport);
    }

    /*
     * — Un tour joué, puis la main à l'hôte ————————————————————————————————————————————————————————
     *
     * Le tour d'abord : sans action validée il n'y a aucune sauvegarde, donc rien à reprendre. La
     * main à l'hôte ensuite, sans quoi il ne pourrait rien jouer pendant l'absence de l'invité — et
     * un rattrapage sans rien à rattraper ne prouverait que le rechargement.
     */
    await session.playOneTurn();
    await session.playUntilHandIsOn(host);
    await expect
      .poll(() => session.guest.save.actionCount(), { timeout: 20_000 })
      .toBeGreaterThan(0);
    const guestActionsBeforeLoss = await session.guest.save.actionCount();

    /*
     * — Le canal tombe ——————————————————————————————————————————————————————————————————————————
     *
     * 🔴 **Tout ce qui suit jusqu'au retour court dans le délai de grâce** — 30 s, mesuré au
     * décompte du bandeau, parce qu'un onglet qui se ferme fait bien parvenir son `bye`. Passé ce
     * délai le revenant n'est plus admis, donc l'ordre des gestes n'est pas cosmétique : l'onglet de
     * retour est booté AVANT la coupure (voir `loseGuestTab`), l'hôte joue son tour tout de suite, et
     * seules les vérifications qui ne peuvent PAS attendre sont faites ici. Les autres — le compte
     * d'actions de l'hôte, le libellé et le décompte du bandeau — sont reprises plus bas, où plus
     * rien ne court.
     */
    const returningGuest = await session.loseGuestTab();

    // L'hôte joue pendant l'absence. Cette action-là part dans un canal fermé : l'invité ne la
    // recevra jamais par le réseau, c'est celle qu'il devra rattraper.
    await host.scene.endTurn();
    // Et il le CONSTATE, au lieu d'attendre un tour qui ne viendrait jamais : le bandeau remplace le
    // silence de la phase `waiting_remote`, qui ne disait rien de ce qui se passe.
    await expect(host.notice.notice).toBeVisible({ timeout: 15_000 });

    /*
     * — Le retour ——————————————————————————————————————————————————————————————————————————————————
     *
     * « Reprendre le combat » sur l'écran d'accueil : c'est l'entrée que le Lot B2 REFUSAIT à une
     * partie en ligne (`isOnlineSave`, décision D4 du plan 201), faute de pouvoir rappeler le salon.
     * Ce qui la débloque est le code de salon désormais porté par la sauvegarde — et le salon est
     * rejoint AVANT la navigation, sinon on monterait un combat en ligne sans salon derrière.
     */
    await returningGuest.menu.resume.click();
    await returningGuest.scene.waitReady(30_000);

    // Le bandeau s'efface chez l'hôte : le canal d'un revenant est NEUF, donc son état ICE ne
    // changera pas en s'ouvrant — sans `onPeerReturned` le bandeau resterait sur une partie reprise.
    await expect(host.notice.notice).toBeHidden({ timeout: 30_000 });

    /*
     * 🔴 **Le critère de sortie du lot** : les deux moteurs finissent au même index.
     *
     * C'est le rattrapage qui le prouve, pas l'écran affiché. Le compte d'actions de la sauvegarde
     * est l'index du moteur vu de l'extérieur : chaque pair réécrit la sienne à chaque action
     * VALIDÉE, la sienne comme celle qu'il reçoit. L'index de l'hôte a bougé pendant l'absence, donc
     * l'égalité ne peut pas être obtenue par un revenant qui n'aurait fait que rejouer sa propre
     * sauvegarde.
     */
    const hostActionsAfterAbsence = await host.save.actionCount();
    expect(hostActionsAfterAbsence).toBeGreaterThan(guestActionsBeforeLoss);
    await expect
      .poll(() => returningGuest.save.actionCount(), { timeout: 30_000 })
      .toBe(hostActionsAfterAbsence);
    // Et il l'a rattrapée à l'écran aussi : la dernière ligne du journal de l'hôte est chez lui.
    const hostLog = await host.logTexts();
    const lastHostLine = hostLog.at(-1) ?? "";
    expect(lastHostLine).not.toBe("");
    await expect.poll(() => returningGuest.logTexts(), { timeout: 30_000 }).toContain(lastHostLine);

    // La partie continue : le tour suivant s'échange comme si rien ne s'était passé.
    await session.playOneTurn();

    /*
     * — Il repart, et cette fois il ne revient pas ————————————————————————————————————————————————
     *
     * Le bandeau est jugé ICI, dans sa forme complète, plutôt que pendant la première absence :
     * c'est le même chemin (`onPeerAwaited`), mais rien ne court plus après — donc on peut lire le
     * libellé et le décompte sans dépenser la fenêtre de retour.
     */
    const lateGuest = await session.loseGuestTab();
    await expect(host.notice.notice).toBeVisible({ timeout: 15_000 });
    await expect(host.notice.label).toContainText("En attente de reconnexion du Joueur 2");
    // Le décompte est le propre de cet état — le seul des trois à en porter un.
    await expect(host.notice.countdown).toHaveText(/^\d+\s*s$/);

    /*
     * Le bandeau au format le plus dur, et à celui-là seulement : il ne s'affiche que pendant une
     * grâce, or celle-ci vaut 30 s (palier de la seconde chute, #950). Balayer cinq formats
     * dépenserait la fenêtre et rendrait la mesure du dernier format non déterministe. 568×320 est
     * le cas qui casse — c'est là que la pile du haut est la plus serrée, et le bandeau est le plus
     * large des cinq éléments de cette pile.
     */
    await host.page.setViewportSize({ width: 568, height: 320 });
    await expect(host.notice.notice).toBeVisible();
    expect(
      await new Responsive(host.page).elementsOutsideViewport(
        COMBAT_CHROME_ROOT,
        COMBAT_CHROME_SCROLLERS,
      ),
    ).toEqual([]);

    /*
     * Le chien de garde tranche, et il tranche VITE : une place qui a déjà disparu une fois n'a plus
     * droit à la présomption de lenteur, donc sa seconde chute vaut 30 s au lieu de 75 s (décision
     * #950). C'est ce qui rend ce dernier acte jouable en e2e — et le délai de 60 s de cette
     * assertion en est la preuve : à 75 s elle échouerait.
     */
    await expect(host.victory).toBeVisible({ timeout: 60_000 });
    await expect(host.victory.getByRole("heading")).toHaveText("Joueur 1 gagne !");
    // La partie est finie, donc il n'y a plus rien à reprendre : la sauvegarde est jetée.
    await expect.poll(() => host.save.raw(), { timeout: 20_000 }).toBeNull();

    /*
     * — Et le revenant trop tard tombe sur un chemin NORMAL, pas sur un écran figé ————————————————
     *
     * L'invité, lui, garde sa sauvegarde : personne ne lui a dit qu'il avait été éliminé. Elle ne
     * mène plus nulle part — le salon est parti avec la fin de la partie — donc sa reprise échoue,
     * et l'échec se dit puis se solde : message d'erreur, sauvegarde jetée, entrée disparue.
     *
     * La CAUSE n'est pas assertée exprès : grâce expirée, hôte parti pour de bon, pare-feu, poignée
     * de main sans réponse — toutes mènent au même comportement, et c'est précisément ce que le plan
     * demandait : plusieurs causes, un seul chemin.
     */
    await lateGuest.menu.resume.click();
    const resumeError = lateGuest.page.getByTestId("resume-error");
    await expect(resumeError).toBeVisible({ timeout: 45_000 });
    await expect(resumeError).not.toHaveText("");
    await expect(lateGuest.menu.resume).toHaveCount(0);
    await expect.poll(() => lateGuest.save.raw(), { timeout: 20_000 }).toBeNull();
  } finally {
    await session.close();
  }
});

test("§11.4 en ligne : « Abandonner » termine la partie chez les DEUX pairs", async ({
  browser,
}) => {
  /*
   * Le bug que ce lot répare, et que personne n'avait relevé avant d'écrire le plan 202 :
   * « Abandonner » existe depuis le plan 187, confirmation comprise, mais en ligne il rendait la
   * main au menu principal **sans prévenir l'adversaire** — qui restait devant un tour qui ne
   * viendrait jamais, jusqu'à ce que le chien de garde tombe. L'abandon n'était pas à créer, il
   * était à réparer.
   */
  const session = await OnlineSession.open(browser);
  const { host, guest } = session;

  try {
    await session.startBattle();

    // Un tour joué d'abord : sans action validée il n'existe aucune sauvegarde, et « la sauvegarde
    // est jetée » ne voudrait rien dire.
    await session.playOneTurn();
    await expect.poll(() => host.save.actionCount(), { timeout: 20_000 }).toBeGreaterThan(0);

    await guest.combatMenu.openByButton();
    await guest.combatMenu.abandon.click();
    await guest.combatMenu.confirm.click();

    // Chez celui qui reste : la partie se termine tout de suite, sans attendre aucun délai. C'est
    // dit AVANT d'être appliqué (`sendForfeit` puis `applyForfeit`) parce qu'après, il n'y a plus de
    // canal pour le dire.
    await expect(host.victory).toBeVisible({ timeout: 30_000 });
    await expect(host.victory.getByRole("heading")).toHaveText("Joueur 1 gagne !");
    await expect.poll(() => host.save.raw(), { timeout: 20_000 }).toBeNull();

    // Chez celui qui part : retour au menu principal, et aucune entrée de reprise — l'abandon purge
    // la sauvegarde, comme sa confirmation l'annonce.
    await expect(guest.menu.title).toBeVisible({ timeout: 30_000 });
    await expect(guest.menu.resume).toHaveCount(0);
  } finally {
    await session.close();
  }
});

test("§11.5 en ligne : c'est l'HÔTE qui tombe, et l'invité le rappelle jusqu'à son retour", async ({
  browser,
}) => {
  const session = await OnlineSession.open(browser);

  try {
    await session.startBattle();
    /*
     * Le sens que ni les tests ni la recette n'exerçaient, et qui cachait DEUX trous d'asymétrie —
     * les seuls bogues réels du lot, tous deux trouvés après coup :
     *
     * 1. **Personne ne rappelait l'hôte** (#957). Qui compose est asymétrique : l'invité appelle
     *    l'hôte, jamais l'inverse. Un hôte revenu reprenait son adresse et écoutait dans le vide,
     *    pendant que l'invité attendait son délai puis gagnait par forfait.
     * 2. **L'hôte revenu refusait son invité** (#960). Son salon est NEUF, donc sans grâce en cours,
     *    et `attachIncoming` n'admet sur un salon verrouillé que les places dont une grâce court : il
     *    refermait le canal à chaque rappel, l'invité rappelait en boucle.
     *
     * ⚠️ Ce scénario exige deux contextes de navigateur SÉPARÉS, ce que `OnlineSession` fournit. Deux
     * onglets d'un même profil partagent leur `localStorage`, donc la même clé `pt-battle-resume` :
     * les deux pairs s'y écrasent, et un onglet rouvert peut reprendre l'identité de l'autre. C'est
     * ce qui a fait échouer la recette à la main de ce scénario — un piège du banc d'essai, pas du
     * jeu, où deux joueurs sont sur deux appareils.
     */
    await session.playOneTurn();
    await session.playUntilHandIsOn(session.guest);
    await expect
      .poll(() => session.host.save.actionCount(), { timeout: 20_000 })
      .toBeGreaterThan(0);

    const returningHost = await session.loseHostTab();
    await expect(session.guest.notice.notice).toBeVisible({ timeout: 15_000 });

    await returningHost.menu.resume.click();
    await returningHost.scene.waitReady(30_000);

    // Le bandeau s'efface : l'invité a bien retrouvé l'hôte, sans qu'aucun forfait ne tombe.
    await expect(session.guest.notice.notice).toBeHidden({ timeout: 30_000 });
    await expect(session.guest.victory).toBeHidden();
    await expect(returningHost.victory).toBeHidden();

    // Et la partie continue : un tour de plus s'échange dans les deux sens.
    await session.playOneTurn();
  } finally {
    await session.close();
  }
});
