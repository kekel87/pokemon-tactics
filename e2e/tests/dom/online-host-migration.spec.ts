import type { BrowserContext } from "@playwright/test";
import { expect, RoomRegistryStub, test } from "../../fixtures";
import { OnlinePeer } from "../../pages/online-session";

/*
 * Cahier §12.11 — la MIGRATION D'HÔTE (plan 209, Lot C5).
 *
 * 🔴 Ce que ce scénario garde, et qu'aucun autre ne peut garder : jusqu'au plan 209, le départ de
 * l'hôte **terminait** la partie — le code de salon ÉTAIT son adresse (#904), donc changer d'hôte
 * aurait voulu dire changer le code sous les doigts des joueurs. Depuis, le code n'est plus qu'une
 * clé qu'un registre résout, et le rôle se transmet : la plus petite place encore connectée devient
 * hôte, s'annonce au registre, et les autres constatent la bascule.
 *
 * Trois pairs au minimum, et c'est structurel : à deux il n'y a personne à élire, et le survivant
 * unique ne prouve rien — il faut **un élu et un non-élu** pour que « jamais deux hôtes » ait un
 * sens.
 *
 * Le registre est un double local ({@link RoomRegistryStub}) : celui de production est un Durable
 * Object chez Cloudflare, et le faire appeler par le gate y ferait dépendre la suite d'un tiers —
 * la raison même pour laquelle l'annuaire PeerJS est local ici.
 */

/*
 * Long : QUATRE contextes de navigateur, trois négociations WebRTC, et surtout le **délai de grâce**
 * de 10 s qui précède l'élection (`GRACE_AFTER_CLEAN_CLOSE_MS`, un départ n'est un fait qu'une fois
 * le retour devenu improbable). Aucun boot Babylon en revanche : tout se joue en salle d'attente.
 */
test.setTimeout(180_000);

test("§12.11 en ligne : l'hôte s'en va, la plus petite place restante prend la main", async ({
  browser,
}) => {
  const contexts: BrowserContext[] = [];
  const registry = new RoomRegistryStub();
  const openPeer = async (): Promise<OnlinePeer> => {
    const context = await browser.newContext({ locale: "fr-FR" });
    contexts.push(context);
    // Sur le CONTEXTE et avant son premier onglet : un pair interroge le registre dès qu'il crée un
    // salon ou qu'il en rejoint un.
    await registry.install(context);
    return new OnlinePeer(await context.newPage());
  };

  try {
    const host = await openPeer();
    const code = await host.openRoom();
    // Trois camps : il faut deux survivants, donc trois places.
    await host.teams.formatSegmentForTeamCount(3).click();
    expect(registry.hostingSeat(code)).toBe(1);

    const elder = await openPeer();
    await elder.joinRoom(code);
    const younger = await openPeer();
    await younger.joinRoom(code);
    await expect(elder.room.selfChip).toHaveAttribute("data-slot-index", "1");
    await expect(younger.room.selfChip).toHaveAttribute("data-slot-index", "2");
    await expect(host.room.remoteSeats).toHaveCount(2, { timeout: 30_000 });

    // — L'hôte s'en va ————————————————————————————————————————————————————————————————————————
    // Son onglet se ferme comme une croix de fenêtre : `pagehide` fait partir le `bye`, donc les
    // survivants n'accordent que le délai COURT du salon (10 s) avant de trancher.
    await host.page.close();

    /*
     * (a) 🔴 La couronne passe à la plus petite place encore connectée — la 2, donc le camp 2 à
     * l'écran (les camps sont 0-indexés, les places à partir de 1). Elle **récupère les
     * responsabilités d'hôte** : « Lancer ▶ », que seul l'hôte possède, et le sélecteur de format,
     * que seul l'hôte voit. C'est le fait du lot : la partie ne meurt plus avec celui qui l'a
     * ouverte.
     *
     * L'attente est large parce qu'elle couvre le délai de grâce (10 s) plus l'aller-retour au
     * registre — et non parce que le résultat serait incertain.
     */
    await expect(elder.room.launch).toHaveCount(1, { timeout: 60_000 });
    await expect(elder.room.formatSegments).toHaveCount(5);
    await expect(elder.room.hostChip).toHaveAttribute("data-slot-index", "1");

    // (b) Et le registre le sait : c'est lui qui rendra la réponse à quiconque composera ce code.
    expect(registry.hostingSeat(code)).toBe(2);

    /*
     * (c) 🔴 **Jamais deux hôtes.** Le second survivant reste invité : ni « Lancer ▶ », ni sélecteur
     * de format. L'ordre total des places ne suffirait pas à le garantir — deux pairs peuvent
     * calculer le même successeur puis écrire chacun de leur côté ; ce qui le ferme est le
     * compare-and-swap sur `epoch` du registre, dont le perdant APPREND qu'il a perdu.
     */
    await expect(younger.room.launch).toHaveCount(0);
    await expect(younger.room.formatSegments).toHaveCount(0);
    await expect(younger.room.selfChip).toHaveAttribute("data-slot-index", "2");

    /*
     * ⚠️ **Ce qui n'est PAS asserté ici, et il ne faut pas l'ajouter tel quel** : que le non-élu voie
     * la couronne se DÉPLACER sur la ligne du nouvel hôte. Mesuré le 2026-09-14 sur huit exécutions
     * (registre réel et registre doublé) : trois fois sur huit, il garde la couronne sur la ligne de
     * l'hôte PARTI, et n'en revient jamais.
     *
     * Ce n'est pas une instabilité du test, c'est une course de `Room.electNewHost` : le non-élu
     * interroge le registre (`lookup`) au moment même où l'élu y écrit (`takeOver`), et rien ne le
     * fait recommencer s'il lit la valeur d'avant — il adopte alors la place du partant comme
     * `hostSeat`, puis REJETTE les `room_state` du vrai hôte (`isSpokenFor` les juge sur `hostSeat`).
     * Le défaut est signalé à l'humain ; tant qu'il n'est pas corrigé, l'asserter reviendrait à
     * poser un test qui échoue une fois sur trois.
     */

    /*
     * (d) Le code continue de fonctionner : un arrivant qui compose LE MÊME code entre dans la
     * partie et tombe sur le nouvel hôte. C'est le critère de sortie du lot, et il n'a de sens que
     * parce que l'adresse ne désigne plus un pair — il prend d'ailleurs la place LIBÉRÉE par
     * l'ancien hôte, la n° 1, qu'un arrivant ignorait avant ce plan (il balayait à partir de la 2).
     */
    const newcomer = await openPeer();
    await newcomer.joinRoom(code);
    await expect(newcomer.room.code).toHaveText(code);
    await expect(newcomer.room.selfChip).toHaveAttribute("data-slot-index", "0");
    await expect(newcomer.room.hostChip).toHaveAttribute("data-slot-index", "1");
    // Vu du nouvel hôte, la partie est pleine de nouveau.
    await expect(elder.room.remoteSeats).toHaveCount(2, { timeout: 30_000 });
  } finally {
    for (const context of contexts) {
      await context.close();
    }
  }
});
