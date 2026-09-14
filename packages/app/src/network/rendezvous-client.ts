import type { RoomRendezvousClient } from "@pokemon-tactic/network";
import { HOST_SEAT } from "@pokemon-tactic/network";

/**
 * Le client du registre des salons (plan 209, Lot C4).
 *
 * 🔴 **Ce registre ne fait pas jouer, il fait se trouver.** Il dit quelle place héberge un code
 * donné, et arbitre les reprises. Aucune action de combat ne le traverse — le jeu reste pair-à-pair
 * (plan-cadre 195), et un registre injoignable ne coûte que la migration d'hôte, jamais la partie.
 *
 * Il vit sur le Worker déjà déployé pour la télémétrie : compte, `wrangler.toml` et étape de
 * déploiement CI sont la marche coûteuse, et elle était franchie depuis le plan 196.
 */
export const RENDEZVOUS_ENDPOINT = "https://pokemon-tactics-telemetry.kekel87.workers.dev/salon";

interface HostAnswer {
  ok?: boolean;
  absent?: boolean;
  peerId?: string;
  epoch?: number;
}

/**
 * La place voyage comme une chaîne, parce que le registre ne connaît que des identifiants opaques :
 * il n'a aucune idée de ce qu'est une place, et c'est très bien — un registre qui comprendrait les
 * règles du jeu serait un serveur de jeu.
 */
function parse(answer: HostAnswer): { ok: boolean; seat: number; epoch: number } | null {
  if (answer.absent === true || answer.peerId === undefined || answer.epoch === undefined) {
    return null;
  }
  const seat = Number(answer.peerId);
  if (!Number.isInteger(seat) || seat < HOST_SEAT) {
    return null;
  }
  return { ok: answer.ok === true, seat, epoch: answer.epoch };
}

async function ask(code: string, body: unknown): Promise<HostAnswer> {
  const response = await fetch(`${RENDEZVOUS_ENDPOINT}/${code}`, {
    method: "POST",
    mode: "cors",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`registre des salons : ${response.status}`);
  }
  return (await response.json()) as HostAnswer;
}

export function createRendezvousClient(): RoomRendezvousClient {
  return {
    claim: async (code, seat) => {
      const parsed = parse(await ask(code, { op: "claim", peerId: String(seat) }));
      // Un code déjà pris rend l'époque du titulaire : l'appelant doit pouvoir le distinguer d'un
      // succès, sinon deux salons se croiraient ouverts sur le même code.
      return parsed ?? { ok: false, seat, epoch: 0 };
    },
    lookup: async (code) => {
      const parsed = parse(await ask(code, { op: "get" }));
      return parsed === null ? null : { seat: parsed.seat, epoch: parsed.epoch };
    },
    takeOver: async (code, seat, epoch) => {
      const parsed = parse(await ask(code, { op: "takeOver", peerId: String(seat), epoch }));
      return parsed ?? { ok: false, seat, epoch };
    },
  };
}
