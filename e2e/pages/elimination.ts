import {
  type Browser,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import { DEFAULT_TEST_MAP_ID } from "../fixtures";
import type { CombatScene } from "./CombatScene";
import { OnlinePeer, TEAMS_STORAGE_KEY } from "./online-session";

/**
 * Un camp qui tombe au combat alors que la partie continue (plan 210) — le pilote e2e.
 *
 * 🔴 **L'élimination n'est PAS provoquée par des dégâts.** Des dégâts demandent un rapprochement,
 * des jets et plusieurs échanges : lent, et soumis au hasard. Le camp sacrifié reçoit à la place UN
 * SEUL Pokemon qui ne connaît que **Vœu Soin** : le move sacrifie son lanceur (`selfKo`), donc le
 * camp tombe à coup sûr, dès son premier tour. Visée sur une case VIDE à côté de lui : le soin
 * « reste sans écho » (`ReviveOrHealFailed`), mais le sacrifice est payé d'avance — le lanceur
 * meurt quand même, et c'est tout ce qu'on lui demande. Aucun jet, aucun rapprochement.
 *
 * Il faut **trois camps** : à deux, l'élimination termine la partie et c'est le dialogue de victoire
 * qui s'affiche, pas celui d'élimination.
 */

/** Espèce du camp sacrifié — Mélodelfe apprend Vœu Soin, et elle est au roster jouable. */
export const SACRIFICE_SPECIES = "clefable";
export const SACRIFICE_NAME = "Mélodelfe";
/** Nom FR affiché de Vœu Soin. */
const HEALING_WISH = "Vœu Soin";

export const SACRIFICE_TEAM_ID = "elimination-sacrifice";
export const ALAKAZAM_TEAM_ID = "elimination-alakazam";
export const ABRA_TEAM_ID = "elimination-abra";

/**
 * Magasin d'équipes (`pokemon-tactics:teams`, enveloppe `{ version: 1, teams }` — un `version` autre
 * que 1 est jeté EN SILENCE). Les deux camps survivants ne portent que Téléport, qu'aucun test ne
 * lance : ils passent leur tour, donc personne ne blesse personne et la partie ne peut pas se
 * terminer par accident pendant qu'on observe ce qui suit l'élimination.
 */
export const ELIMINATION_TEAM_STORAGE = {
  version: 1,
  teams: {
    [SACRIFICE_TEAM_ID]: {
      id: SACRIFICE_TEAM_ID,
      name: "Élimination — Mélodelfe",
      slots: [
        {
          pokemonId: SACRIFICE_SPECIES,
          ability: "magic-guard",
          nature: "calm",
          moveIds: ["healing-wish"],
          statSpread: {},
        },
      ],
      createdAt: 0,
      updatedAt: 3,
    },
    [ALAKAZAM_TEAM_ID]: {
      id: ALAKAZAM_TEAM_ID,
      name: "Élimination — Alakazam",
      slots: [
        {
          pokemonId: "alakazam",
          ability: "synchronize",
          nature: "timid",
          moveIds: ["teleport"],
          statSpread: {},
        },
      ],
      createdAt: 0,
      updatedAt: 2,
    },
    [ABRA_TEAM_ID]: {
      id: ABRA_TEAM_ID,
      name: "Élimination — Abra",
      slots: [
        {
          pokemonId: "abra",
          ability: "synchronize",
          nature: "timid",
          moveIds: ["teleport"],
          statSpread: {},
        },
      ],
      createdAt: 0,
      updatedAt: 1,
    },
  },
} as const;

/**
 * Le dialogue « Vous êtes éliminé » (plan 210, lot D2), et les lignes de journal qui l'entourent.
 *
 * Les deux boutons sont visés par leur testid et **jamais** par leur libellé : « Retour au menu » est
 * aussi le libellé d'un bouton du dialogue de victoire (`battle-over`), donc un `getByRole` non
 * scopé deviendrait ambigu dès que les deux coexistent.
 */
export class EliminationView {
  readonly dialog: Locator;
  readonly heading: Locator;
  readonly keepWatching: Locator;
  readonly backToMenu: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByTestId("player-eliminated");
    this.heading = this.dialog.getByRole("heading");
    this.keepWatching = page.getByTestId("eliminated-keep-watching");
    this.backToMenu = page.getByTestId("eliminated-back-to-menu");
  }

  /** La ligne « Le Joueur N est éliminé. » (`battleLog.playerEliminated`). */
  logLine(playerNumber: number): Locator {
    return this.page
      .getByTestId("battle-log-entry")
      .filter({ hasText: `Le Joueur ${playerNumber} est éliminé.` });
  }
}

interface Tile {
  readonly x: number;
  readonly y: number;
}

/**
 * Le Pokemon sacrifié lance Vœu Soin sur une case VIDE adjacente, depuis la page de celui qui a la
 * main. Attaque → Vœu Soin → case → confirmation.
 *
 * Les deux garde-fous (`toBeEnabled`, `data-enabled`) sont ceux du pilote de duel, pour la même
 * raison : sans eux un clic sur un bouton grisé n'échoue pas, Playwright l'attend indéfiniment.
 * `data-enabled` porte le `hasTargets` calculé par le core — une cible `Single` accepte toute case à
 * portée, vide comprise (`getValidTargetPositions`), donc le move est lançable dès le premier tour.
 *
 * La case est choisie parmi les tuiles RÉELLES de la scène (`tile_<x>_<y>`), jamais supposée.
 */
export async function castHealingWishOnEmptyNeighbour(
  page: Page,
  scene: CombatScene,
): Promise<void> {
  const [tileNames, sprites] = await Promise.all([
    scene.meshNamesStartingWith("tile_"),
    scene.spriteStates(),
  ]);
  const caster = sprites.find((sprite) => sprite.pokemonId === SACRIFICE_SPECIES);
  if (caster === undefined) {
    throw new Error(
      `le plateau ne montre pas ${SACRIFICE_NAME} (${sprites.map((sprite) => sprite.pokemonId).join(", ") || "aucun sprite"})`,
    );
  }
  const tiles = new Set(tileNames);
  const occupied = new Set(sprites.map((sprite) => `${sprite.tile.x},${sprite.tile.y}`));
  const neighbours: Tile[] = [
    { x: caster.tile.x + 1, y: caster.tile.y },
    { x: caster.tile.x - 1, y: caster.tile.y },
    { x: caster.tile.x, y: caster.tile.y + 1 },
    { x: caster.tile.x, y: caster.tile.y - 1 },
  ];
  const target = neighbours.find(
    (tile) => tiles.has(`tile_${tile.x}_${tile.y}`) && !occupied.has(`${tile.x},${tile.y}`),
  );
  if (target === undefined) {
    throw new Error(
      `aucune case libre à côté de ${SACRIFICE_NAME} en (${caster.tile.x},${caster.tile.y})`,
    );
  }

  const attack = page.getByRole("button", { name: "Attaque", exact: true });
  await expect(attack).toBeEnabled();
  await attack.click();
  const move = page.getByTestId("move-item").filter({ hasText: HEALING_WISH });
  await expect(move).toHaveAttribute("data-enabled", "true");
  await move.click();
  await scene.clickTile(target.x, target.y);
  await scene.clickTile(target.x, target.y);
}

/**
 * Trois contextes de navigateur jusqu'à une partie en ligne à TROIS camps (plan 210).
 *
 * L'hôte tient le camp 1 (Alakazam), le premier invité le camp 2 (Abra), le second invité le camp 3
 * — **le camp sacrifié**. Le sacrifié est un INVITÉ, et c'est délibéré : si l'hôte partait par
 * « Retour au menu », la partie entrerait dans une migration d'hôte en combat, un autre sujet que
 * celui de ce plan (non joué en e2e, cahier §12.11).
 *
 * Trois profils séparés, jamais trois onglets d'un même profil : la sauvegarde de reprise tient dans
 * une seule clé (recette du plan 202).
 */
export class OnlineTrio {
  private constructor(
    private readonly contexts: readonly BrowserContext[],
    readonly host: OnlinePeer,
    readonly survivor: OnlinePeer,
    readonly sacrificed: OnlinePeer,
  ) {}

  static async open(browser: Browser): Promise<OnlineTrio> {
    const contexts: BrowserContext[] = [];
    const peers: OnlinePeer[] = [];
    for (let index = 0; index < 3; index += 1) {
      const context = await browser.newContext({ locale: "fr-FR" });
      contexts.push(context);
      /*
       * La carte FIXE du harnais, posée à la main : la fixture `page` ne sert que le contexte par
       * défaut, et un contexte vierge vaut « Aléatoire » — un tirage parmi neuf à chaque exécution.
       * Seule celle de l'hôte compte (la carte vient de lui), mais les trois profils restent pareils.
       */
      await context.addInitScript(
        ([teamsKey, teams, mapId]: [string, string, string]) => {
          window.localStorage.setItem(teamsKey, teams);
          // Fusion, jamais remplacement (même règle que `seedSettings`) : ce script rejoue à chaque
          // navigation, et écraser `pt-settings` effacerait ce que l'app y aurait écrit entre-temps.
          let current: Record<string, unknown> = {};
          try {
            const parsed: unknown = JSON.parse(window.localStorage.getItem("pt-settings") ?? "{}");
            if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
              current = parsed as Record<string, unknown>;
            }
          } catch {
            // Magasin illisible : on repart des défauts, comme le jeu lui-même.
          }
          window.localStorage.setItem(
            "pt-settings",
            JSON.stringify({ ...current, lastMapId: mapId }),
          );
        },
        [TEAMS_STORAGE_KEY, JSON.stringify(ELIMINATION_TEAM_STORAGE), DEFAULT_TEST_MAP_ID] as [
          string,
          string,
          string,
        ],
      );
      peers.push(new OnlinePeer(await context.newPage()));
    }
    const [host, survivor, sacrificed] = peers as [OnlinePeer, OnlinePeer, OnlinePeer];
    return new OnlineTrio(contexts, host, survivor, sacrificed);
  }

  get all(): readonly OnlinePeer[] {
    return [this.host, this.survivor, this.sacrificed];
  }

  /**
   * Salon à trois camps → équipes → Prêt ×3 → Lancer, et les trois scènes montées.
   *
   * 🔴 Les invités entrent l'un APRÈS l'autre : un arrivant prend la première place libre, donc
   * l'ordre d'entrée décide qui tient le camp 3 — le sacrifié.
   */
  async startBattle(): Promise<void> {
    const code = await this.host.openRoom();
    await this.host.teams.formatSegmentForTeamCount(3).click();
    await expect(this.host.room.format).toContainText("3 joueurs");
    await this.host.teams.pickSavedTeam(0, ALAKAZAM_TEAM_ID);

    await this.survivor.joinRoom(code);
    await expect(this.survivor.room.selfChip).toHaveAttribute("data-slot-index", "1");
    await this.survivor.teams.pickSavedTeam(1, ABRA_TEAM_ID);
    await expect(this.survivor.room.ready).toBeEnabled();
    await this.survivor.room.ready.click();

    await this.sacrificed.joinRoom(code);
    await expect(this.sacrificed.room.selfChip).toHaveAttribute("data-slot-index", "2");
    await this.sacrificed.teams.pickSavedTeam(2, SACRIFICE_TEAM_ID);
    await expect(this.sacrificed.room.ready).toBeEnabled();
    await this.sacrificed.room.ready.click();

    await expect(this.host.room.remoteSeats).toHaveCount(2, { timeout: 30_000 });
    await expect(this.host.room.ready).toBeEnabled();
    await this.host.room.ready.click();
    await expect(this.host.room.launch).toBeEnabled({ timeout: 30_000 });
    await this.host.room.launch.click();

    for (const peer of this.all) {
      await peer.scene.waitReady(30_000);
    }
  }

  /** Celui des `candidates` qui a la main — cherché, jamais supposé (l'ordre suit la Vitesse). */
  async peerWithHand(candidates: readonly OnlinePeer[]): Promise<OnlinePeer> {
    let found: OnlinePeer | undefined;
    await expect
      .poll(
        async () => {
          for (const peer of candidates) {
            if (await peer.hasHand()) {
              found = peer;
              return true;
            }
          }
          return false;
        },
        { timeout: 45_000, message: "aucun des pairs attendus n'a reçu la main" },
      )
      .toBe(true);
    if (found === undefined) {
      throw new Error("la main a été vue puis perdue avant d'être lue");
    }
    return found;
  }

  /**
   * `actor` joue `action`, et on attend qu'elle soit PARVENUE chez `observer` : son journal grandit
   * quand son moteur a reçu l'action, l'a validée et l'a appliquée.
   */
  async actAndAwait(observer: OnlinePeer, action: () => Promise<void>): Promise<void> {
    const before = await observer.logEntries.count();
    await action();
    await expect
      .poll(() => observer.logEntries.count(), { timeout: 30_000 })
      .toBeGreaterThan(before);
  }

  /** Les tours passent (« Attendre ») jusqu'à ce que la main soit chez le camp sacrifié. */
  async playUntilSacrificedHasHand(maxTurns = 6): Promise<void> {
    for (let turn = 0; turn <= maxTurns; turn += 1) {
      const actor = await this.peerWithHand(this.all);
      if (actor === this.sacrificed) {
        return;
      }
      await this.actAndAwait(this.sacrificed, () => actor.scene.endTurn());
    }
    throw new Error(`la main n'est jamais arrivée au camp 3 en ${maxTurns} tours`);
  }

  /** Le camp 3 lance Vœu Soin, et le sacrifice parvient chez les deux autres. */
  async sacrifice(): Promise<void> {
    await this.actAndAwait(this.host, () =>
      castHealingWishOnEmptyNeighbour(this.sacrificed.page, this.sacrificed.scene),
    );
  }

  async close(): Promise<void> {
    for (const context of this.contexts) {
      await context.close();
    }
  }
}
