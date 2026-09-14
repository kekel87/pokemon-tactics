import type { BrowserContext } from "@playwright/test";

/**
 * Le **registre des salons**, tenu par le harnais au lieu du Worker Cloudflare (plan 209, Lot C4).
 *
 * 🔴 **Pourquoi il existe.** Le registre de production est un Durable Object déployé chez Cloudflare
 * (`pokemon-tactics-telemetry.kekel87.workers.dev/salon`), et il admet explicitement les origines
 * locales — donc, sans ce double, **toute la suite en ligne l'appellerait pour de vrai**. Deux choses
 * en découleraient, et aucune n'est acceptable dans un gate :
 *
 * - la suite dépendrait d'un tiers et d'une connexion Internet, exactement ce que l'annuaire PeerJS
 *   local existe pour éviter (`playwright.config.ts`) — une panne chez eux rendrait le gate rouge
 *   sans qu'une ligne du jeu ait bougé ;
 * - chaque exécution **écrirait** dans le registre de production (un objet par code, 6 h de rétention),
 *   au même titre que la télémétrie, qui, elle, est muette hors des hôtes de publication.
 *
 * Ce qui reste couvert pour de vrai : le client (`app/src/network/rendezvous-client.ts`) est exercé
 * tel quel — son URL, son verbe, son corps, sa lecture de `ok`/`peerId`/`epoch`. Ce qui ne l'est
 * PAS : le Worker lui-même, pris en unitaire (`rendezvous.test.ts`, `worker.test.ts` — origines,
 * préflight CORS et compare-and-swap compris), et le chemin réseau réel, qui reste une case 👁 du
 * cahier (§12.11).
 *
 * Le protocole reproduit est celui du plan 209, à trois messages et un compteur : `claim` prend un
 * code libre, `get` dit qui héberge, `takeOver` n'échange la place **que si l'`epoch` fourni est
 * celui courant** — le compare-and-swap qui interdit deux hôtes. La place voyage comme une chaîne,
 * parce que le registre ne connaît que des identifiants opaques.
 */
export class RoomRegistryStub {
  private readonly held = new Map<string, { seat: number; epoch: number }>();

  /**
   * Branche le double sur un contexte de navigateur. À appeler **avant** son premier onglet : un
   * pair interroge le registre dès la création ou l'entrée dans un salon.
   */
  async install(context: BrowserContext): Promise<void> {
    await context.route("**/salon/*", async (route) => {
      const request = route.request();
      /*
       * Le client pose un en-tête `content-type`, donc sa requête n'est pas « simple » au sens CORS.
       * On répond au préflight comme le Worker — c'est le défaut qui avait rendu le registre
       * injoignable depuis le jeu alors qu'il répondait parfaitement à `curl` (recette 2026-09-14).
       */
      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: RoomRegistryStub.HEADERS });
        return;
      }
      const code = (new URL(request.url()).pathname.split("/").pop() ?? "").toUpperCase();
      const body = request.postDataJSON() as {
        op: string;
        peerId?: string;
        epoch?: number;
      };
      await route.fulfill({
        status: 200,
        headers: RoomRegistryStub.HEADERS,
        body: JSON.stringify(this.answer(code, body)),
      });
    });
  }

  /** Qui héberge ce code, vu du registre — de quoi asserter la bascule côté serveur. */
  hostingSeat(code: string): number | undefined {
    return this.held.get(code.toUpperCase())?.seat;
  }

  private answer(
    code: string,
    body: { op: string; peerId?: string; epoch?: number },
  ): Record<string, unknown> {
    const held = this.held.get(code);
    const claimed = Number(body.peerId);
    if (body.op === "claim") {
      if (held !== undefined) {
        // Un code déjà pris rend l'identité du titulaire : sans ce refus, deux salons se croiraient
        // ouverts sur le même code.
        return { ok: false, peerId: String(held.seat), epoch: held.epoch };
      }
      this.held.set(code, { seat: claimed, epoch: 1 });
      return { ok: true, peerId: body.peerId, epoch: 1 };
    }
    if (body.op === "takeOver") {
      if (held === undefined || held.epoch !== body.epoch) {
        // Course perdue : le refus PORTE l'identité du vrai hôte, et c'est ce retour qui empêche le
        // perdant de se croire hôte.
        return { ok: false, peerId: String(held?.seat ?? claimed), epoch: held?.epoch ?? 0 };
      }
      const next = { seat: claimed, epoch: held.epoch + 1 };
      this.held.set(code, next);
      return { ok: true, peerId: String(next.seat), epoch: next.epoch };
    }
    return held === undefined ? { absent: true } : { peerId: String(held.seat), epoch: held.epoch };
  }

  private static readonly HEADERS = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "POST",
    "content-type": "application/json",
  } as const;
}
