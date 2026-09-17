import type { Browser, BrowserContext } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { OnlinePeer } from "../../pages/online-session";

/*
 * Cahier §11.22 et §11.23 — le NIVEAU de l'IA d'une place, EN LIGNE (plan 214, Lot C), à deux vrais
 * pairs.
 *
 * 🔴 Ce que ces deux scénarios gardent, et que rien d'autre ne peut garder.
 *
 * Le niveau a été rangé dans `NetworkSeatState` — l'état de place diffusé en continu — et non dans
 * le seul message de lancement. La raison tient en une phrase : **on ne découvre pas la difficulté
 * de la partie en entrant en combat**. C'est un choix de conception qui ne se voit nulle part
 * ailleurs ; sans §11.22, on pourrait le défaire (ne le mettre que dans le `start`) sans casser un
 * seul test, et personne ne s'en apercevrait avant un retour de joueur.
 *
 * §11.23 garde l'autre moitié : le défaut est appliqué **une seule fois, chez l'hôte**, dans
 * `composeStartSeats`, et le résultat est gravé dans le `start`. Les pairs reçoivent donc une valeur
 * explicite et n'appliquent jamais de repli eux-mêmes. Un défaut répliqué des deux côtés ferait
 * monter deux IA différentes **sans erreur et sans trace** — la classe de panne la plus coûteuse du
 * réseau, et celle que `NETWORK_VERSION` (11 → 12 à ce plan) existe pour refuser entre versions.
 *
 * Deux contextes de navigateur, une négociation WebRTC, et — pour §11.23 seulement — deux boots
 * Babylon complets : d'où le délai large, comme les autres specs de la famille en ligne.
 */
test.setTimeout(180_000);

/** Un salon, deux pairs, et la fermeture des contextes garantie. */
async function withTwoPeers(
  browser: Browser,
  scenario: (host: OnlinePeer, guest: OnlinePeer) => Promise<void>,
): Promise<void> {
  const contexts: BrowserContext[] = [];
  const openPeer = async (): Promise<OnlinePeer> => {
    const context = await browser.newContext({ locale: "fr-FR" });
    contexts.push(context);
    return new OnlinePeer(await context.newPage());
  };
  try {
    await scenario(await openPeer(), await openPeer());
  } finally {
    for (const context of contexts) {
      await context.close();
    }
  }
}

test("§11.22 en ligne : l'hôte règle une place sur Difficile, et le pair distant le lit dans le salon", async ({
  browser,
}) => {
  await withTwoPeers(browser, async (host, guest) => {
    /*
     * Trois camps : il en faut un TROISIÈME, que ni l'hôte ni l'invité ne tient, pour qu'il y ait
     * une place IA à régler. Le duel n'en offre aucune — les deux places y sont prises par des
     * humains. Le choix du format est le sujet de `online-format.spec.ts` ; ici c'est un moyen.
     */
    const code = await host.openRoom();
    await host.teams.formatSegmentForTeamCount(3).click();
    await expect(host.room.format).toContainText("3 joueurs");

    await guest.joinRoom(code);
    await expect(host.room.remoteSeats).toHaveCount(1, { timeout: 30_000 });

    /*
     * (a) L'état de départ : la place 3 est LIBRE, et l'invité n'y lit aucun niveau. Rien n'y est
     * décidé, et l'en-tête dit déjà « Place libre » — annoncer « Moyenne » y contredirait le badge
     * d'à côté (même règle qu'au segment de l'hôte, recette 2026-09-04).
     *
     * L'assertion est porteuse : sans elle, celle de (c) passerait au vert sur une puce qui aurait
     * toujours été là, et ne prouverait plus que quoi que ce soit a voyagé.
     */
    await expect(guest.room.seatStatus(2)).toHaveText("⏳ Place libre", { timeout: 30_000 });
    await expect(guest.teams.aiLevelChip(2)).toHaveCount(0);

    // — Le geste : l'hôte donne la place 3 à l'IA, en Difficile ————————————————————————————————
    await host.teams.controllerButton(2, "ai", "hard").click();

    // (b) Chez l'hôte, c'est le bouton « Difficile » qui porte la marque, et lui seul.
    expect(await host.teams.activeAiDifficulty(2)).toBe("hard");

    /*
     * (c) 🔴 Et l'invité le LIT, dans le salon, avant tout lancement. Il ne règle rien — seul l'hôte
     * compose les places que personne ne tient — donc il n'a pas le segment mais une puce, qui dit
     * l'état sans poser la question « pourquoi je ne peux pas ? ».
     */
    await expect(guest.teams.aiLevelChip(2)).toHaveAttribute("data-ai-difficulty", "hard", {
      timeout: 30_000,
    });
    // La place est prête d'office : il n'y a personne dont on attendrait la confirmation.
    await expect(guest.room.seatStatus(2)).toHaveText("Prêt");

    /*
     * (d) Le niveau SUIT les changements suivants, il n'est pas figé à la première bascule. C'est ce
     * qui distingue un état diffusé en continu d'une valeur posée une fois : l'hôte qui se ravise
     * avant de lancer doit être suivi, sinon les deux écrans se contredisent jusqu'au combat.
     */
    await host.teams.controllerButton(2, "ai", "easy").click();
    await expect(guest.teams.aiLevelChip(2)).toHaveAttribute("data-ai-difficulty", "easy", {
      timeout: 30_000,
    });
  });
});

test("§11.23 en ligne : le `start` grave le niveau de chaque place, et une place libre part en Moyenne", async ({
  browser,
}) => {
  await withTwoPeers(browser, async (host, guest) => {
    /*
     * Quatre camps, et les quatre cas du plan tiennent dans une seule partie : deux humains (aucun
     * niveau), une place IA réglée à la main sur **Difficile**, et une place que PERSONNE n'a jamais
     * touchée — c'est elle qui doit partir en **Moyenne** au lancement.
     *
     * Une seule partie plutôt que deux : le coût de ce scénario est la négociation WebRTC et les
     * deux boots Babylon, pas le nombre de camps.
     */
    const code = await host.openRoom();
    await host.teams.formatSegmentForTeamCount(4).click();
    await expect(host.room.format).toContainText("4 joueurs");

    await guest.joinRoom(code);
    await expect(host.room.remoteSeats).toHaveCount(1, { timeout: 30_000 });

    // La place 3 est réglée, la place 4 est laissée telle quelle — c'est tout le sujet.
    await host.teams.controllerButton(2, "ai", "hard").click();
    expect(await host.teams.activeAiDifficulty(2)).toBe("hard");
    await expect(host.room.seatStatus(3)).toHaveText("⏳ Place libre");

    // Chacun compose SA ligne, puis confirme. Les places IA et libres sont prêtes d'office.
    await host.teams.pickRandomTeam(0);
    await guest.teams.pickRandomTeam(1);
    await expect(guest.room.ready).toBeEnabled();
    await guest.room.ready.click();
    await expect(host.room.ready).toBeEnabled();
    await host.room.ready.click();
    await expect(host.room.launch).toBeEnabled({ timeout: 30_000 });
    await host.room.launch.click();

    // Le lancement est ACCUSÉ (#903) : voir les DEUX scènes prêtes prouve la boucle complète.
    await host.scene.waitReady(30_000);
    await guest.scene.waitReady(30_000);

    /*
     * La sauvegarde de reprise est écrite au montage de la boucle de combat, qui suit la scène prête
     * sans être annoncé par elle — d'où le `expect.poll` sur sa longueur avant de juger son contenu.
     */
    const expected = [null, null, "hard", "medium"];
    for (const peer of [host, guest]) {
      await expect.poll(() => peer.save.aiDifficulties(), { timeout: 30_000 }).toHaveLength(4);
    }

    /*
     * 🔴 L'assertion du lot. Les deux pairs lisent EXACTEMENT la même liste :
     *
     * - les places 1 et 2 sont humaines, donc sans niveau — le champ n'aurait aucun sens sur elles,
     *   et le laisser traîner ferait croire à un réglage qui ne s'applique pas ;
     * - la place 3 porte le **Difficile** que l'hôte a choisi, jusque dans le moteur de l'invité ;
     * - la place 4, que personne n'a réglée, porte **Moyenne** — `DEFAULT_AI_DIFFICULTY`, appliqué
     *   une seule fois par `composeStartSeats` et gravé dans le `start`. L'invité ne l'a pas
     *   déduit : il l'a reçu.
     */
    expect(await host.save.aiDifficulties()).toEqual(expected);
    expect(await guest.save.aiDifficulties()).toEqual(expected);

    // Et les deux parties concordent : aucun constat de divergence, aucun forfait.
    await expect(host.divergence).toHaveCount(0);
    await expect(guest.divergence).toHaveCount(0);
    await expect(host.anyForfeit).toHaveCount(0);
  });
});

/*
 * §11.24 — la RÉGRESSION d'un défaut trouvé en écrivant ce lot, et corrigé dans la foulée.
 *
 * Ce qui ne marchait pas : quand l'hôte ROUVRAIT à un joueur une place tenue par l'IA, l'invité ne
 * le voyait jamais. Sa ligne restait « Prêt » avec la puce « 🤖 Difficile », alors que l'hôte lisait
 * « ⏳ Place libre ». Les deux écrans se contredisaient jusqu'au lancement.
 *
 * La cause dépassait ce plan. `Room.setSeatOccupancy` effaçait le niveau en posant la propriété
 * **explicitement à `undefined`**. Le transport de PeerJS sérialise en BinaryPack, **pas en JSON** :
 * `{ a: undefined }` y fait l'aller-retour en `{ a: null }` (vérifié sur
 * `peerjs-js-binarypack@2.1.0`). Or `isSeatState` accepte `undefined` et **refuse `null`** — le
 * `room_state` entier était jeté **en silence** par l'invité. Les messages suivants passaient, donc
 * rien n'avait l'air cassé : c'est ce qui rendait le symptôme illisible.
 *
 * Le correctif RETIRE la clé au lieu de l'écrire vide, ce qui referme la classe entière et pas le
 * seul champ. Deux filets côté unitaire : `protocol.test.ts` tient la règle du garde, et
 * `room.integration.test.ts` vérifie l'ABSENCE de la clé par `Object.hasOwn` — `toEqual` ignore les
 * propriétés valant `undefined`, et c'est précisément pour ça que le test voisin restait vert.
 */
test("§11.24 en ligne : rouvrir une place IA à un joueur l'efface chez le pair distant", async ({
  browser,
}) => {
  await withTwoPeers(browser, async (host, guest) => {
    const code = await host.openRoom();
    await host.teams.formatSegmentForTeamCount(3).click();
    await expect(host.room.format).toContainText("3 joueurs");
    await guest.joinRoom(code);
    await expect(host.room.remoteSeats).toHaveCount(1, { timeout: 30_000 });

    // La place part à l'IA, et l'invité le voit — c'est §11.22, rejoué ici comme point de départ.
    await host.teams.controllerButton(2, "ai", "hard").click();
    await expect(guest.teams.aiLevelChip(2)).toHaveAttribute("data-ai-difficulty", "hard", {
      timeout: 30_000,
    });

    /*
     * Le geste : l'hôte la rouvre à un joueur. Une place qui attend un humain ne doit pas rester
     * marquée « Difficile » — ce serait annoncer un réglage que personne n'a demandé, et qui
     * reparaîtrait bel et bien au lancement si personne ne vient.
     */
    await host.teams.controllerButton(2, "human").click();
    // Chez l'hôte, c'est déjà bon : la place redevient libre.
    await expect(host.room.seatStatus(2)).toHaveText("⏳ Place libre");

    // Chez l'invité, rien ne bouge — le `room_state` a été jeté par son propre validateur.
    await expect(guest.room.seatStatus(2)).toHaveText("⏳ Place libre", { timeout: 15_000 });
    await expect(guest.teams.aiLevelChip(2)).toHaveCount(0);
  });
});
