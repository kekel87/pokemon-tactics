import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { OnlinePeer } from "../../pages/online-session";

/*
 * MESURE — le maillage WebRTC à 2, 3, 6 et 12 pairs (backlog-maillage-6-et-12-pairs-jamais-mesure).
 *
 * 🔴 Ce n'est PAS un test de non-régression et ce fichier ne garde rien. Il n'assertionne
 * quasiment rien : il MESURE, et imprime un tableau. Le critère de sortie du Lot C3 du plan 209
 * demandait des chiffres — temps d'entrée en partie, taux de liens établis — et personne ne les
 * avait jamais pris. La recette humaine du 2026-09-14 s'était arrêtée à 3 camps.
 *
 * Il vit dans son PROPRE projet Playwright, `bench`, qui n'existe que si PT_BENCH est posée
 * (voir playwright.config.ts). Motif : `npx playwright test` sans `--project` lance TOUS les
 * projets — la suite GitHub ouvrirait douze contextes de navigateur par tranche.
 *
 * ── CE QUE LA MESURE VAUT, ET CE QU'ELLE NE VAUT PAS ────────────────────────────────────────
 *
 * Le harnais tourne sous `localSignalling`, donc `peerIce=off` : ni STUN ni TURN, tout le monde
 * sur la boucle locale. Les chiffres obtenus sont donc un PLANCHER — le coût du montage tel que
 * notre code l'ordonne, sans une milliseconde de réseau réel. C'est délibéré, et c'est même le
 * plus utile des deux : le risque soupçonné est une propriété du CODE, pas du réseau. Voir
 * `Room.connectToMesh`, dont la boucle `await` les pairs UN PAR UN — sa docstring dit pourquoi
 * elle DOIT le rester, et pourquoi le `Promise.all` essayé le 2026-09-14 a été annulé.
 *
 * Ce que ces chiffres ne diront donc jamais : le temps d'entrée réel entre deux machines
 * distantes derrière deux NAT. Ça se mesure à deux postes, pas dans un harnais.
 *
 * ── LA SONDE ────────────────────────────────────────────────────────────────────────────────
 *
 * On enveloppe `RTCPeerConnection` au chargement du contexte, AVANT tout script de page. Rien
 * n'est ajouté au code de production pour cette mesure : `Room.channels` est privée et le restera.
 * Chaque lien du maillage compte pour DEUX connexions, une par extrémité.
 */

/** Ce que la sonde accumule dans chaque page. */
interface MeshProbe {
  origin: number;
  connections: { created: number; states: { state: string; at: number }[] }[];
}

declare global {
  interface Window {
    __meshProbe__?: MeshProbe;
  }
}

/** Les formats à mesurer. 2 et 3 servent de témoins : ce sont les seuls jamais éprouvés. */
const TEAM_COUNTS = [2, 3, 6, 12] as const;

/*
 * Le délai (600 s) vient du projet `bench` dans `playwright.config.ts` : douze contextes de
 * navigateur, chacun chargeant l'application entière, plus 66 négociations. Aucun boot Babylon en
 * revanche — tout se joue en salle d'attente, la partie n'est jamais lancée.
 */

async function installProbe(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const Native = window.RTCPeerConnection;
    const probe: MeshProbe = { origin: performance.now(), connections: [] };
    window.__meshProbe__ = probe;
    class Probed extends Native {
      constructor(...args: ConstructorParameters<typeof Native>) {
        super(...args);
        const record = {
          created: performance.now(),
          states: [] as { state: string; at: number }[],
        };
        probe.connections.push(record);
        this.addEventListener("connectionstatechange", () => {
          record.states.push({ state: this.connectionState, at: performance.now() });
        });
      }
    }
    window.RTCPeerConnection = Probed as unknown as typeof Native;
  });
}

/** Ce qu'un pair rapporte une fois tout le monde entré. */
interface PeerReport {
  /** Connexions ouvertes par ce pair, quelle qu'en soit l'issue. */
  opened: number;
  /** Celles qui ont atteint `connected` — le seul état qui vaut un lien. */
  connected: number;
  /** Celles tombées en `failed`. Un maillage incomplet entre en partie quand même : c'est le sujet. */
  failed: number;
  /** Millisecondes entre la première connexion ouverte et le dernier `connected`. 0 si aucun lien. */
  spanMs: number;
  /**
   * Par connexion et dans l'ordre d'ouverture : `[ouverte à, connectée à]`, en millisecondes
   * depuis la PREMIÈRE ouverture de ce pair.
   *
   * 🔴 C'est la seule colonne qui répond à la question de fond, et elle ne se déduit d'aucun total.
   * `Room.connectToMesh` `await` ses pairs UN PAR UN dans une boucle `for`, et DOIT le rester tant
   * que l'échec n'est pas imputable à sa connexion (voir sa docstring). Sur la boucle locale chaque
   * négociation coûte si peu que la sérialisation ne se voit pas dans le temps d'entrée — mais si
   * les intervalles ne se CHEVAUCHENT PAS, elle est bien là, et elle se paie au prix fort dès qu'un
   * pair est injoignable : `CONNECT_TIMEOUT_MS` vaut 15 s, et ils s'additionnent.
   */
  timeline: [openedAt: number, connectedAt: number | null][];
}

function readProbe(page: Page): Promise<PeerReport> {
  return page.evaluate(() => {
    const probe = window.__meshProbe__;
    if (probe === undefined) {
      return { opened: 0, connected: 0, failed: 0, spanMs: 0, timeline: [] };
    }
    const reached = (record: { states: { state: string; at: number }[] }, state: string) =>
      record.states.find((entry) => entry.state === state);
    const connectedAt = probe.connections
      .map((record) => reached(record, "connected")?.at)
      .filter((at): at is number => at !== undefined);
    const firstOpen = Math.min(...probe.connections.map((record) => record.created));
    return {
      opened: probe.connections.length,
      connected: connectedAt.length,
      failed: probe.connections.filter((record) => reached(record, "failed") !== undefined).length,
      spanMs: connectedAt.length === 0 ? 0 : Math.round(Math.max(...connectedAt) - firstOpen),
      timeline: probe.connections
        .filter((record) => reached(record, "connected") !== undefined)
        .map((record) => {
          const done = reached(record, "connected");
          return [
            Math.round(record.created - firstOpen),
            done === undefined ? null : Math.round(done.at - firstOpen),
          ] as [number, number | null];
        }),
    };
  });
}

for (const teamCount of TEAM_COUNTS) {
  test(`maillage à ${teamCount} pairs — montage, liens établis, temps d'entrée`, async ({
    browser,
  }) => {
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];
    const peers: OnlinePeer[] = [];
    /** Le temps que chaque invité met à voir la salle d'attente, dans l'ordre d'arrivée. */
    const joinMs: number[] = [];

    try {
      for (let index = 0; index < teamCount; index += 1) {
        const context = await browser.newContext({ locale: "fr-FR" });
        await installProbe(context);
        contexts.push(context);
        const page = await context.newPage();
        pages.push(page);
        peers.push(new OnlinePeer(page));
      }

      const [host, ...guests] = peers;
      if (host === undefined) {
        throw new Error("au moins un pair");
      }

      const code = await host.openRoom();

      /*
       * Le format se choisit dans la salle d'attente depuis le plan 209 (Lot C3), et il doit être
       * posé AVANT que les invités n'arrivent : rétrécir après coup éjecterait les derniers.
       */
      if (teamCount !== 2) {
        await host.teams.formatSegmentForTeamCount(teamCount).click();
        await expect(host.teams.activeFormatSegment).toHaveAttribute(
          "data-format-key",
          new RegExp(`^${teamCount}v`),
        );
      }

      /*
       * Un par un, comme de vrais joueurs à qui on dicte un code — jamais douze en parallèle. C'est
       * ce que le dernier arrivé paie qui nous intéresse : il se connecte à TOUS les précédents,
       * là où le premier n'avait que l'hôte à joindre.
       */
      for (const guest of guests) {
        const startedAt = Date.now();
        await guest.joinRoom(code);
        joinMs.push(Date.now() - startedAt);
      }

      /*
       * Le maillage se compose APRÈS l'entrée en salle d'attente (`connectToMesh` suit le
       * `welcome`), et il se compose en silence : un pair injoignable n'empêche personne d'entrer.
       * On laisse donc converger, puis on lit — sans jamais exiger que ce soit complet, puisque
       * c'est précisément la question posée.
       */
      const expectedLinks = (teamCount * (teamCount - 1)) / 2;
      /*
       * 🔴 Attendre une STABILISATION, pas un seuil. La première version demandait ici que le total
       * des liens soit « ≥ 0 » : une somme de compteurs l'est toujours, donc le matcher passait à la
       * première évaluation et le poll ne sondait RIEN — une attente décorative dans un fichier dont
       * le seul produit est un chiffre. Relevé en revue de code le 2026-09-14.
       *
       * Ce qu'il faut vraiment attendre : les extrémités ENTRANTES. `joinRoom` ne rend la main
       * qu'après `connectToMesh`, donc les extrémités sortantes sont déjà connectées quand la boucle
       * d'arrivée se termine — mais `attachIncoming` chez les pairs déjà assis n'a, lui, aucune
       * barrière. Deux lectures successives identiques valent convergence.
       */
      let precedent = -1;
      await expect
        .poll(
          async () => {
            const reports = await Promise.all(pages.map(readProbe));
            const total = reports.reduce((somme, report) => somme + report.connected, 0);
            const stable = total === precedent;
            precedent = total;
            return stable;
          },
          { timeout: 120_000, intervals: [500] },
        )
        .toBe(true);

      const reports = await Promise.all(pages.map(readProbe));
      const connectedEnds = reports.reduce((total, report) => total + report.connected, 0);
      const openedEnds = reports.reduce((total, report) => total + report.opened, 0);
      const failedEnds = reports.reduce((total, report) => total + report.failed, 0);
      const slowestJoin = joinMs.length === 0 ? 0 : Math.max(...joinMs);
      const lastJoin = joinMs.at(-1) ?? 0;

      /*
       * Sérialisé = chaque connexion s'ouvre APRÈS que la précédente soit connectée. Aujourd'hui
       * c'est l'état ATTENDU, pas une anomalie : `connectToMesh` est séquentiel à dessein. La
       * colonne sert à voir le jour où ça changera, dans un sens ou dans l'autre.
       */
      const derniere = reports.at(-1)?.timeline ?? [];
      const chevauchements = derniere.filter((entry, index) => {
        const precedente = derniere[index - 1];
        return precedente?.[1] != null && entry[0] < precedente[1];
      }).length;
      const serialisation =
        derniere.length < 2
          ? "n/a (moins de deux liens)"
          : chevauchements === 0
            ? `OUI — les ${derniere.length} négociations s'enchaînent, aucune en parallèle`
            : `non — ${chevauchements} des ${derniere.length - 1} se chevauchent`;

      const lines = [
        "",
        `┌─ MAILLAGE À ${teamCount} PAIRS ${"─".repeat(Math.max(0, 40 - String(teamCount).length))}`,
        `│ liens attendus (maillage complet)  ${expectedLinks}  (${expectedLinks * 2} extrémités)`,
        `│ extrémités ouvertes                ${openedEnds}`,
        `│ extrémités connectées              ${connectedEnds}  → ${
          expectedLinks === 0
            ? "n/a"
            : `${Math.round((connectedEnds / (expectedLinks * 2)) * 100)} %`
        }`,
        `│ extrémités en échec                ${failedEnds}`,
        `│ entrée en salle d'attente, dernier ${lastJoin} ms`,
        `│ entrée en salle d'attente, pire    ${slowestJoin} ms`,
        `│ entrées, dans l'ordre d'arrivée    ${joinMs.join(" / ")} ms`,
        "│",
        `│ DERNIER ARRIVÉ — c'est lui qui paie le maillage : il se connecte à tous les autres,`,
        `│ là où le premier n'avait que l'hôte à joindre. Intervalles [ouverture → connexion],`,
        "│ en ms depuis sa première ouverture. Qui ne se chevauche pas est sérialisé.",
        `│   ${
          (reports.at(-1)?.timeline ?? [])
            .map(([openedAt, connectedAt]) => `[${openedAt}→${connectedAt ?? "?"}]`)
            .join(" ") || "aucun lien"
        }`,
        `│ sérialisation                      ${serialisation}`,
        `└${"─".repeat(56)}`,
        "",
      ];
      console.log(lines.join("\n"));
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}
