import {
  type Browser,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import { localSignalling } from "../fixtures";
import { BattleResumeStore } from "./battle-resume";
import { CombatScene } from "./CombatScene";
import { CombatMenuOverlay } from "./combat-menu";
import { ConnectionNoticeHud, TurnClockHud } from "./combatHud";
import { LobbyScreen, WaitingRoom } from "./lobby";
import { MainMenu } from "./MainMenu";
import { OnlineDuel } from "./online-duel";
import { BattleModeScreen, TeamSelectScreen } from "./screens";

/**
 * La chorégraphie « deux contextes de navigateur jusqu'à un 1v1 en réseau vivant » (plans 201/202).
 *
 * 🔴 **Ce n'est pas un doublon de `dom/online-lobby.spec.ts`, et la différence est intentionnelle.**
 * Ce spec-là est le **contrat du salon** : il assertionne chaque étape de la traversée — le format
 * annoncé, la naissance du code, la ligne qui devient distante, « Lancer » qui reste inerte. Ici on
 * ne juge rien de tout ça : on veut seulement **arriver** à un combat en réseau pour éprouver ce qui
 * se passe quand un pair s'en va. Les seules attentes présentes sont celles qui SÉQUENCENT les
 * gestes ; toute assertion de robustesse appartient au spec qui l'appelle.
 *
 * Un salon coûte cher (négociation WebRTC + deux boots Babylon complets), donc un scénario qui l'a
 * payé enchaîne plusieurs faits plutôt que de rouvrir une session pour chacun.
 */

/**
 * Marge des attentes qui traversent le réseau (plan 213, lot A).
 *
 * 🔴 Nommée plutôt que recopiée, parce que c'est sa RECOPIE qui a produit une asymétrie : `joinRoom`
 * attendait `room.panel` avec trente secondes explicites, `openRoom` attendait **le même
 * localisateur** sur le défaut de cinq secondes. Même attente, même élément, six fois moins de marge
 * d'un côté — et c'était justement le côté qui attend la **naissance du code de salon**, donc une
 * prise d'identifiant chez l'annuaire, sur un serveur PeerJS qui peut démarrer à froid.
 *
 * ⚠️ Ce n'est PAS le diagnostic du rouge à froid de `backlog-flaky-famille-online-a-froid` : la
 * reproduction du 2026-09-16 (20/20 verts, `dist` supprimé, 2 workers) ne l'a pas retrouvé. C'est une
 * correction de cohérence, et la cause reste ouverte.
 */
const NETWORK_WAIT_MS = 30_000;
export class OnlinePeer {
  readonly menu: MainMenu;
  readonly mode: BattleModeScreen;
  readonly lobby: LobbyScreen;
  readonly room: WaitingRoom;
  readonly teams: TeamSelectScreen;
  readonly scene: CombatScene;
  readonly combatMenu: CombatMenuOverlay;
  readonly clock: TurnClockHud;
  readonly notice: ConnectionNoticeHud;
  /** La sauvegarde de combat de CE pair — chacun tient la sienne, et les deux doivent concorder. */
  readonly save: BattleResumeStore;
  readonly logEntries: Locator;
  /**
   * « Attendre » — visible **seulement** quand la main est de ce côté. C'est le signal qui dit qui
   * joue : le pair qui regarde a son menu d'action verrouillé (`localPlayerIds`, Lot B2).
   */
  readonly wait: Locator;
  /** La modale de fin de partie, reconnue à son verdict plutôt qu'à un testid (cf `combat-flow`). */
  readonly victory: Locator;
  /**
   * La même modale, prise par son testid — donc quel que soit le verdict.
   *
   * Nécessaire dès qu'un scénario ne peut pas prédire QUI l'emporte : à la divergence, chaque pair
   * élimine l'autre au même instant, et les deux constats se croisent (voir §11.8).
   */
  readonly battleOver: Locator;
  /**
   * Le constat de divergence, tel que le joueur le LIT — **le verdict de la modale de fin**, depuis
   * le 2026-09-15.
   *
   * 🔴 Il visait la ligne de JOURNAL du forfait `EtatDivergent` (plan 203, Lot B4). Cette ligne
   * n'existe plus en duel : un duel divergent ne prononce plus aucun forfait — il ARRÊTE la partie
   * sans résultat, parce que le faire forfaire des deux côtés faisait de chaque pair un vainqueur.
   * Rien ne passe donc plus par le moteur, et le journal ne s'alimente que d'événements du moteur.
   * L'explication est désormais portée par la modale, qui la met devant le joueur au lieu de
   * l'écrire dans un panneau replié.
   *
   * Vide est la seule valeur acceptable sur une partie honnête — c'est l'assertion du lot, et elle
   * porte le risque dominant : une empreinte qui diverge sans raison met fin à un vrai combat par un
   * message que le joueur ne peut ni comprendre ni contester.
   */
  readonly divergence: Locator;
  /**
   * N'IMPORTE quel forfait, quelle qu'en soit la raison (plan 203, corrigé en revue de code).
   *
   * 🔴 Les quatre phrasés sont distincts depuis la recette du plan 202 — une phrase par raison — et
   * deux d'entre eux ne contiennent PAS « quitte la partie » :
   * `battleLog.playerForfeited` « quitte la partie. », `.desynced` « quitte la partie — les parties
   * ne concordent plus. », `.resigned` « **abandonne** la partie. », `.disconnected` « **a perdu la
   * connexion**. ». Filtrer sur les seuls mots communs laissait passer un forfait pour absence, qui
   * émet pourtant les K.O. et l'écran de victoire : le scénario honnête passait au vert sans combat.
   */
  readonly anyForfeit: Locator;

  constructor(readonly page: Page) {
    this.menu = new MainMenu(page);
    this.mode = new BattleModeScreen(page);
    this.lobby = new LobbyScreen(page);
    this.room = new WaitingRoom(page);
    this.teams = new TeamSelectScreen(page);
    this.scene = new CombatScene(page);
    this.combatMenu = new CombatMenuOverlay(page);
    this.clock = new TurnClockHud(page);
    this.notice = new ConnectionNoticeHud(page);
    this.save = new BattleResumeStore(page);
    this.logEntries = page.getByTestId("battle-log-entry");
    this.wait = page.getByRole("button", { name: "Attendre", exact: true });
    this.victory = page.getByRole("dialog").filter({ hasText: /gagne/ });
    this.battleOver = page.getByTestId("battle-over");
    this.divergence = this.battleOver.filter({ hasText: "les parties ne concordent plus" });
    this.anyForfeit = this.logEntries.filter({
      hasText: /quitte la partie|abandonne la partie|a perdu la connexion/,
    });
  }

  /**
   * Menu → Combat → En ligne → « Créer une partie », jusqu'à la salle d'attente. Rend le code.
   *
   * Sur le PAIR et non sur la session : un scénario à trois joueurs ou plus n'a pas de « session »
   * au sens de {@link OnlineSession}, qui ne connaît que le duel — mais chacun de ses pairs traverse
   * exactement les mêmes écrans.
   */
  async openRoom(): Promise<string> {
    await this.menu.goto(localSignalling);
    await this.menu.combat.click();
    await this.mode.online.click();
    // « Créer une partie » entre droit dans la salle d'attente depuis le plan 208 : la carte vient
    // des préférences de l'hôte, et il la change en modale sans quitter l'écran.
    // Le code naît à l'entrée sur la salle d'attente, jamais avant.
    await this.lobby.create.click();
    // Même marge que `joinRoom` : c'est ICI qu'on attend la naissance du code, donc le plus long
    // aller-retour réseau de la traversée. Le laisser sur le défaut était l'asymétrie du lot A.
    await expect(this.room.panel).toBeVisible({ timeout: NETWORK_WAIT_MS });
    return ((await this.room.code.textContent()) ?? "").trim();
  }

  /** Menu → Combat → En ligne → code composé au clavier → « Rejoindre », jusqu'à la salle d'attente. */
  async joinRoom(code: string): Promise<void> {
    await this.menu.goto(localSignalling);
    await this.menu.combat.click();
    await this.mode.online.click();
    await expect(this.lobby.codeSlots).toHaveCount(5);
    await this.lobby.typeCode(code);
    await this.lobby.join.click();
    await expect(this.room.panel).toBeVisible({ timeout: NETWORK_WAIT_MS });
  }

  /**
   * Monte un combat EN LIGNE **seul dans son salon**, en dressant la place libre en IA (plan 213,
   * lot F).
   *
   * 🔴 Pourquoi elle vaut sa place ici : une partie est « en ligne » pour le code dès que
   * `setup.localSeat` existe, donc dès qu'elle est entrée par le salon — un second joueur n'y est
   * pour rien. Un hôte seul qui repasse la place libre en IA traverse exactement le même chemin
   * **sans payer la négociation WebRTC ni un second boot Babylon** : ~3 s, contre ~45 s pour une
   * session à deux pairs.
   *
   * Née dans `online-combat-menu.spec.ts`, remontée parce que le prochain spec qui voudra une partie
   * en ligne bon marché la recopierait — et que deux copies finissent toujours par diverger.
   *
   * ⚠️ Ne prouve PAS qu'un adversaire humain est de l'autre côté du canal. Tout scénario qui en a
   * besoin passe par {@link OnlineSession.startBattle}.
   */
  async launchAlone(options: { interactivePlacement?: boolean } = {}): Promise<void> {
    await this.openRoom();
    if (options.interactivePlacement === true) {
      // Décochée AVANT « Prêt » : les deux paramètres de partie appartiennent à l'hôte et se gèlent
      // sur sa propre confirmation (recette 2026-09-04). Cochée, la phase de placement n'existe pas.
      await this.teams.autoPlacement.uncheck();
    }
    await this.teams.pickRandomTeam(0);
    // La place 2 passe en IA : elle est alors prête d'office ET reçoit une équipe séance tenante,
    // donc « Lancer » s'allume sans qu'un second joueur ait à venir.
    await this.teams.giveSlotToAi(1);
    await expect(this.room.ready).toBeEnabled();
    await this.room.ready.click();
    await expect(this.room.launch).toBeEnabled({ timeout: NETWORK_WAIT_MS });
    await this.room.launch.click();
    await this.scene.waitReady(NETWORK_WAIT_MS);
  }

  hasHand(): Promise<boolean> {
    return this.wait.isVisible();
  }

  logTexts(): Promise<string[]> {
    return this.logEntries.allTextContents();
  }
}

/**
 * Ce qu'un scénario peut CHOISIR de la session, quand le hasard ne lui convient pas.
 *
 * Par défaut les deux camps prennent « 🎲 Aléatoire » : c'est le chemin le plus court vers un combat
 * en réseau, et il suffit à tout scénario qui n'a besoin que de tours qui s'échangent. Un scénario
 * qui pilote un combat jusqu'à son terme, lui, a besoin de savoir ce qui se bat — d'où le magasin
 * d'équipes posé avant le boot et le choix explicite par camp.
 */
export interface OnlineSessionOptions {
  /**
   * Magasin d'équipes de l'application (`pokemon-tactics:teams`), posé dans les DEUX contextes avant
   * le premier script de page. La clé et l'enveloppe `{ version, teams }` sont celles de
   * `packages/app/src/team/team-storage.ts` — un `version` qui ne vaut pas 1 est jeté en silence.
   */
  readonly savedTeams?: Readonly<Record<string, unknown>>;
  /** Identifiant de l'équipe sauvegardée que l'hôte assigne au camp 1. Défaut : « 🎲 Aléatoire ». */
  readonly hostTeamId?: string;
  /** Idem pour l'invité, au camp 2. */
  readonly guestTeamId?: string;
  /**
   * Point d'entrée sur le contexte de l'INVITÉ, avant l'ouverture de son premier onglet.
   *
   * 🔴 Existe pour une seule chose, et elle vaut d'être dite : faire **réellement** diverger l'état
   * d'un pair depuis le test, sans toucher au code de production. Un scénario qui veut éprouver le
   * détecteur de désynchronisation (plan 203) n'a aucun autre levier — le hook de scène est en
   * lecture seule par construction, et rien du jeu n'expose son moteur. En détournant ce que le
   * navigateur de l'invité TÉLÉCHARGE (`context.route`), on lui fait construire un état légitimement
   * différent : c'est une divergence vraie, pas une empreinte truquée.
   *
   * Sur le contexte et non sur la page : les onglets d'un pair qui revient sont ouverts plus tard.
   */
  readonly interceptGuest?: (context: BrowserContext) => Promise<void>;
  /**
   * Décoche « Placement auto » avant le lancement : les deux pairs posent leurs Pokemon à la main
   * (plan 211).
   *
   * `startBattle` s'arrête alors à la phase de PLACEMENT, pas au combat — c'est au scénario de la
   * dérouler. Le paramètre appartient à l'hôte et se gèle sur sa propre confirmation, donc il est
   * décoché avant qu'il ne se déclare prêt.
   */
  readonly interactivePlacement?: boolean;
}

/** Clé du magasin d'équipes de l'app (`packages/app/src/team/team-storage.ts`). */
export const TEAMS_STORAGE_KEY = "pokemon-tactics:teams";

export class OnlineSession {
  /** Construit à la première demande — voir le getter `duel`. */
  private duelPilot: OnlineDuel | undefined;

  private roomCode = "";
  private hostPeer: OnlinePeer;
  private guestPeer: OnlinePeer;

  private constructor(
    private readonly hostContext: BrowserContext,
    private readonly guestContext: BrowserContext,
    host: OnlinePeer,
    guest: OnlinePeer,
    private readonly options: OnlineSessionOptions,
  ) {
    this.hostPeer = host;
    this.guestPeer = guest;
  }

  static async open(browser: Browser, options: OnlineSessionOptions = {}): Promise<OnlineSession> {
    const hostContext = await browser.newContext({ locale: "fr-FR" });
    const guestContext = await browser.newContext({ locale: "fr-FR" });
    if (options.savedTeams !== undefined) {
      // Sur le CONTEXTE, pas sur la page : les onglets d'un pair qui revient sont ouverts plus tard
      // (voir `loseGuestTab`), et ils doivent trouver le même magasin.
      const seed = [TEAMS_STORAGE_KEY, JSON.stringify(options.savedTeams)] as [string, string];
      for (const context of [hostContext, guestContext]) {
        await context.addInitScript(([key, payload]: [string, string]) => {
          window.localStorage.setItem(key, payload);
        }, seed);
      }
    }
    await options.interceptGuest?.(guestContext);
    const host = new OnlinePeer(await hostContext.newPage());
    const guest = new OnlinePeer(await guestContext.newPage());
    return new OnlineSession(hostContext, guestContext, host, guest, options);
  }

  /**
   * L'hôte **courant** — l'onglet qui tient sa place maintenant. Mutable pour la même raison que
   * `guest` : un pair qui revient revient dans un onglet NEUF (voir {@link loseHostTab}).
   */
  get host(): OnlinePeer {
    return this.hostPeer;
  }

  /**
   * L'invité **courant** — l'onglet qui tient sa place maintenant.
   *
   * Mutable exprès : un pair qui revient revient dans un onglet NEUF (voir {@link loseGuestTab}), et
   * c'est lui qui joue la suite de la partie. Sa sauvegarde, elle, appartient au contexte de
   * navigateur et survit donc au changement d'onglet — c'est même ce qui rend le retour possible.
   */
  get guest(): OnlinePeer {
    return this.guestPeer;
  }

  /**
   * Le pilote de duel de cette session (plan 213, lot B).
   *
   * 🔴 Un getter plutôt qu'un `new OnlineDuel(session)` dans le corps des tests : la règle
   * « POM via fixtures » de `.claude/rules/e2e.md` veut qu'un test reçoive ses objets de page, jamais
   * qu'il les construise. Construit à la demande et retenu — un duel n'a pas d'état propre, mais en
   * rendre deux différents pour la même session serait une surprise gratuite.
   *
   * L'import est un import de VALEUR dans ce sens-là et un import de TYPE dans l'autre : aucun cycle
   * à l'exécution, les types étant effacés à la compilation.
   */
  get duel(): OnlineDuel {
    this.duelPilot ??= new OnlineDuel(this);
    return this.duelPilot;
  }

  /**
   * Menu → Combat → En ligne → créer / rejoindre → équipes → Prêt ×2 → Lancer, et les deux scènes
   * montées. Les deux pairs passent par l'annuaire de mise en relation LOCAL, jamais par le service
   * public de PeerJS.
   */
  async startBattle(): Promise<void> {
    const { host, guest } = this;

    this.roomCode = await host.openRoom();
    if (this.options.interactivePlacement === true) {
      await host.teams.autoPlacement.uncheck();
    }
    await this.pickTeam(host, 0, this.options.hostTeamId);

    await guest.joinRoom(this.roomCode);

    // L'invité compose SA ligne, la deuxième, puis confirme. Sans équipe sur chaque camp, « Lancer »
    // resterait inerte pour une raison qui n'a rien à voir avec le réseau.
    await this.pickTeam(guest, 1, this.options.guestTeamId);
    await expect(guest.room.ready).toBeEnabled();
    await guest.room.ready.click();

    // L'hôte confirme aussi : sa propre confirmation compte comme celle des autres (recette du
    // 2026-09-04), donc « Lancer » ne s'allume pas avant.
    await expect(host.room.ready).toBeEnabled();
    await host.room.ready.click();
    await expect(host.room.launch).toBeEnabled({ timeout: NETWORK_WAIT_MS });
    await host.room.launch.click();

    // Le lancement est ACCUSÉ (#903) : voir les DEUX scènes prêtes prouve la boucle complète.
    await host.scene.waitReady(NETWORK_WAIT_MS);
    await guest.scene.waitReady(NETWORK_WAIT_MS);
  }

  /** L'équipe demandée pour ce camp, ou le tirage aléatoire à défaut. */
  private async pickTeam(
    peer: OnlinePeer,
    slotIndex: number,
    teamId: string | undefined,
  ): Promise<void> {
    if (teamId === undefined) {
      await peer.teams.pickRandomTeam(slotIndex);
      return;
    }
    await peer.teams.pickSavedTeam(slotIndex, teamId);
  }

  /**
   * Qui a la main, et qui regarde.
   *
   * Cherché plutôt que supposé : l'ordre du premier tour dépend de la Vitesse des équipes TIRÉES,
   * qu'aucun test ne connaît d'avance.
   */
  async peerWithHand(): Promise<{ actor: OnlinePeer; observer: OnlinePeer }> {
    await expect
      .poll(async () => (await this.host.hasHand()) || (await this.guest.hasHand()), {
        timeout: NETWORK_WAIT_MS,
      })
      .toBe(true);
    return (await this.host.hasHand())
      ? { actor: this.host, observer: this.guest }
      : { actor: this.guest, observer: this.host };
  }

  /**
   * Le pair qui a la main passe son tour, et on attend que le journal de CELUI QUI REGARDE grandisse
   * — c'est-à-dire que son moteur ait reçu l'action, l'ait validée contre son propre
   * `getLegalActions()` et l'ait appliquée. La boucle réseau entière, vue de l'extérieur.
   */
  async playOneTurn(): Promise<OnlinePeer> {
    const { actor, observer } = await this.peerWithHand();
    await OnlineSession.playTurnOf(actor, observer);
    return actor;
  }

  private static async playTurnOf(actor: OnlinePeer, observer: OnlinePeer): Promise<void> {
    await OnlineSession.actAndAwait(observer, () => actor.scene.endTurn());
  }

  /**
   * `actor` joue l'action donnée, et on attend qu'elle soit PARVENUE chez celui qui regarde.
   *
   * Le pendant de {@link playOneTurn} pour une action qui n'est pas « passer son tour » — une
   * attaque, un Téléport. Le signal est le même, et c'est le seul qui vaille : le journal du pair
   * d'en face grandit quand SON moteur a reçu l'action, l'a validée contre son propre
   * `getLegalActions()` et l'a appliquée.
   */
  actAndPropagate(actor: OnlinePeer, action: () => Promise<void>): Promise<void> {
    return OnlineSession.actAndAwait(this.other(actor), action);
  }

  /** Celui qui REGARDE quand `peer` joue — le réseau étant verrouillé en 1v1 (#944), il est unique. */
  private other(peer: OnlinePeer): OnlinePeer {
    return peer === this.hostPeer ? this.guestPeer : this.hostPeer;
  }

  private static async actAndAwait(
    observer: OnlinePeer,
    action: () => Promise<void>,
  ): Promise<void> {
    const before = (await observer.logTexts()).length;
    await action();
    await expect
      .poll(async () => (await observer.logTexts()).length, { timeout: NETWORK_WAIT_MS })
      .toBeGreaterThan(before);
  }

  /**
   * Fait passer les tours jusqu'à ce que la main soit sur `target`.
   *
   * Utile pour un scénario qui a besoin que le pair RESTÉ puisse jouer pendant l'absence de l'autre :
   * en 1v1 un pair qui attend un tour distant ne peut rien faire, donc il n'y aurait rien à
   * rattraper au retour.
   */
  async playUntilHandIsOn(target: OnlinePeer, maxTurns = 6): Promise<void> {
    for (let turn = 0; turn <= maxTurns; turn += 1) {
      const { actor, observer } = await this.peerWithHand();
      if (actor === target) {
        return;
      }
      await OnlineSession.playTurnOf(actor, observer);
    }
    throw new Error(`La main n'est jamais revenue au pair attendu en ${maxTurns} tours`);
  }

  /**
   * Le canal de l'invité tombe — son onglet disparaît, comme une croix de fenêtre — et un onglet
   * FRAIS, déjà booté sur l'écran d'accueil, prend sa place. Rend ce dernier.
   *
   * 🔴 **L'onglet de retour est préparé AVANT la coupure, et c'est une exigence de déterminisme, pas
   * une commodité.** Une fermeture propre fait parvenir le `bye`, donc le pair resté n'accorde qu'une
   * fenêtre bornée, et passé ce délai un revenant n'est plus admis : `attachIncoming` n'ouvre qu'aux
   * places dont la grâce court encore.
   *
   * ⚠️ La fenêtre est `BATTLE_GRACE_SHORT_MS` = **30 s** (`packages/network/src/room-config.ts`), et
   * PAS les 10 s de `GRACE_AFTER_CLEAN_CLOSE_MS` que cette doc annonçait — corrigé en revue de code.
   * Les 10 s ne valent qu'en SALON, où une place se libère sans que personne ne perde de partie ; en
   * combat, seul cas où cette méthode sert, la recette du 2026-09-09 les a portées à 30 s (décision
   * #961) parce que fermer sa fenêtre poliment donnait moins de temps qu'arracher son câble.
   * Booter l'application DANS cette fenêtre y ferait entrer tout le coût du harnais (splash, bundle
   * de sprites, montage du menu), qui n'a rien à voir avec ce qu'on éprouve. Il est donc payé avant,
   * et il ne reste dans la fenêtre que ce qui s'y joue vraiment : rappeler le salon et se rebrancher.
   */
  async loseGuestTab(): Promise<OnlinePeer> {
    const returning = new OnlinePeer(await this.guestContext.newPage());
    await returning.menu.goto(localSignalling);
    // L'entrée de reprise est rendue au MONTAGE depuis la sauvegarde : l'attendre ici garantit que
    // l'onglet frais est prêt à cliquer, et pas seulement affiché.
    await expect(returning.menu.resume).toBeVisible();
    await this.guestPeer.page.close();
    this.guestPeer = returning;
    return returning;
  }

  /**
   * L'onglet de l'HÔTE tombe, et un onglet frais du même contexte prend sa place. Rend ce dernier.
   *
   * 🔴 **Un chemin différent de {@link loseGuestTab}, pas son symétrique.** Qui compose est
   * asymétrique : l'invité appelle l'hôte, jamais l'inverse. Un hôte qui revient reprend bien son
   * adresse — le code EST son adresse (#904) — puis se contente d'écouter ; c'est l'invité resté qui
   * le rappelle toutes les deux secondes (`scheduleHostRedial`, décision #957). Et son salon revenu
   * est NEUF, donc sans grâce en cours : sans les places attendues passées à `Room.rejoin`, il
   * referme le canal de son invité à chaque tentative (décision #960). Les deux trous n'existaient
   * QUE dans ce sens, et aucun test du retour de l'invité ne pouvait les voir.
   */
  async loseHostTab(): Promise<OnlinePeer> {
    const returning = new OnlinePeer(await this.hostContext.newPage());
    await returning.menu.goto(localSignalling);
    await expect(returning.menu.resume).toBeVisible();
    await this.hostPeer.page.close();
    this.hostPeer = returning;
    return returning;
  }

  async close(): Promise<void> {
    await this.hostContext.close();
    await this.guestContext.close();
  }
}
