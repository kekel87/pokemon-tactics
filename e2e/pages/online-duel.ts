import { expect } from "@playwright/test";
import type { OnlinePeer, OnlineSession } from "./online-session";

/**
 * Un duel en ligne PILOTÉ jusqu'à l'écran de victoire (plan 203, Lot B4).
 *
 * 🔴 **Pourquoi deux équipes d'UN SEUL Pokemon, et non le tirage aléatoire des autres scénarios en
 * ligne.** Le format réseau est 2 joueurs, donc six Pokemon par camp : un combat mené à son terme
 * demanderait une douzaine de K.O., chacun précédé d'un rapprochement, sur des équipes tirées au
 * hasard — donc des attaques, des portées et des points de vie qu'aucun test ne connaît d'avance.
 * Ça ne tient pas dans un scénario e2e. Un Pokemon par camp rend le combat complet **atteignable**
 * en quelques actions, tout en le laissant HONNÊTE : rien n'est forcé, personne n'abandonne, la
 * partie se termine par un K.O. au terme d'une suite d'actions réellement échangées.
 *
 * Le K.O. n'est pas un détail du décor, c'est la cible : `handleKo` remet une vingtaine de champs de
 * `PokemonInstance` à `undefined` plutôt que de les supprimer, et c'est exactement là que la
 * sérialisation canonique du Lot B4 doit confondre « clé absente » et « clé à `undefined` » — faute
 * de quoi tout combat en ligne se terminerait sur un faux constat de divergence au premier K.O.
 *
 * **Le rapprochement passe par Téléport, jamais par la phase de déplacement**, et c'est un choix de
 * robustesse : une destination de déplacement hors de portée n'est pas seulement refusée, elle FAIT
 * SORTIR de la phase (leçon du pilote de la séquence d'intro, `e2e/capture/combat-pad.ts`), donc un
 * pilote doit deviner la portée du tour, le terrain et le relief pour ne pas s'y perdre. Téléport,
 * lui, n'exige que trois choses vérifiables de l'extérieur : la case existe, elle est libre, elle
 * est à 6 cases ou moins (`resolveTeleport`) — ni ligne de vue, ni terrain, ni relief. Le
 * rapprochement devient donc une attaque ordinaire de plus, pilotée par le même chemin que le coup
 * qui conclut.
 */

/** Clé de l'équipe de l'hôte dans le magasin — l'hôte tient le camp 1. */
export const DUEL_ATTACKER_TEAM_ID = "duel-attacker";
/** Clé de l'équipe de l'invité — camp 2. */
export const DUEL_DEFENDER_TEAM_ID = "duel-defender";

/**
 * Alakazam contre Abra, et le déséquilibre est le point : Ball'Ombre (Ténèbres, 80, précision 100)
 * lancée par une Attaque Spéciale de base 135 sur un Abra Psy (25 de PV de base, 55 de Défense
 * Spéciale) est super efficace — le K.O. tient en UN coup, même au jet de dégâts le plus faible.
 * Un duel qui demanderait trois échanges dépendrait, lui, des tirages.
 *
 * Abra ne porte que Téléport : il se rapproche, puis il attend. Il ne peut pas riposter, donc
 * l'issue ne dépend d'aucun jet — et le combat reste néanmoins un vrai combat, avec des actions
 * jouées des deux côtés.
 */
const ATTACKER_SPECIES = "alakazam";
const DEFENDER_SPECIES = "abra";

/** Nom FR affiché du coup qui conclut. Le pilote sélectionne les attaques par leur nom à l'écran. */
const SHADOW_BALL = "Ball";
/** Nom FR affiché de Téléport. */
const TELEPORT = "Téléport";

/** Portée de Ball'Ombre (`tactical.ts` : `Single`, 1 à 4 cases, distance de Manhattan). */
const SHADOW_BALL_RANGE = 4;
/** Portée de Téléport (`tactical.ts` : `Teleport`, 1 à 6). */
const TELEPORT_RANGE = 6;

/**
 * Magasin d'équipes à poser dans les deux contextes. L'enveloppe `{ version, teams }` et la clé sont
 * celles de `packages/app/src/team/team-storage.ts` : un `version` autre que 1 est jeté EN SILENCE,
 * ce qui donnerait un sélecteur sans aucune équipe et aucun message d'erreur.
 */
export const DUEL_TEAM_STORAGE = {
  version: 1,
  teams: {
    [DUEL_ATTACKER_TEAM_ID]: {
      id: DUEL_ATTACKER_TEAM_ID,
      name: "Duel — Alakazam",
      slots: [
        {
          pokemonId: ATTACKER_SPECIES,
          ability: "synchronize",
          nature: "timid",
          moveIds: ["shadow-ball", "teleport"],
          statSpread: {},
        },
      ],
      createdAt: 0,
      updatedAt: 2,
    },
    [DUEL_DEFENDER_TEAM_ID]: {
      id: DUEL_DEFENDER_TEAM_ID,
      name: "Duel — Abra",
      slots: [
        {
          pokemonId: DEFENDER_SPECIES,
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

interface Tile {
  readonly x: number;
  readonly y: number;
}

/** Les deux combattants, vus depuis la page de `peer`. */
interface DuelTiles {
  readonly attacker: Tile;
  readonly defender: Tile;
}

/** Qui joue — ou « la partie est finie ». Un seul point d'attente, voir {@link OnlineDuel.awaitTurn}. */
const TurnState = {
  Pending: "pending",
  Over: "over",
  Attacker: "attacker",
  Defender: "defender",
} as const;
type TurnState = (typeof TurnState)[keyof typeof TurnState];

function manhattan(from: Tile, to: Tile): number {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}

export class OnlineDuel {
  constructor(private readonly session: OnlineSession) {}

  /** L'hôte tient Alakazam (camp 1) : c'est lui qui conclut, donc lui qui gagne. */
  get attacker(): OnlinePeer {
    return this.session.host;
  }

  /** L'invité tient Abra (camp 2). */
  get defender(): OnlinePeer {
    return this.session.guest;
  }

  /**
   * Mène le duel jusqu'à ce qu'un camp tombe, en jouant les deux côtés : frapper si l'ennemi est à
   * portée, se téléporter au plus près sinon, et clore le tour dans tous les cas.
   *
   * 🔴 **Un tour = une action PUIS « Attendre »**, et ce n'est pas de la ceinture et des bretelles :
   * agir ne rend pas la main. Mesuré au premier run — après un Téléport, le menu revient avec
   * « Attaque » grisée (le Pokemon a agi) mais « Déplacement » et « Attendre » actifs : le tour est
   * toujours le sien, et il ne passe qu'une fois « Attendre » confirmé. Sans cette clôture, le
   * pilote croyait voir un nouveau tour, tentait une seconde action sur un bouton grisé, et
   * s'arrêtait là — pendant que les tours de l'autre camp expiraient au chronomètre les uns après
   * les autres (« Le Joueur 2 a manqué 2 tours sur 3 »).
   *
   * Le plafond de tours n'est pas cosmétique : les deux camps se rapprochent d'au plus 6 cases par
   * tour et les zones de départ de l'Arène Simple sont à une quinzaine de cases, donc une poignée de
   * tours suffit. Un plafond atteint est un vrai échec — un combat qui n'avance plus — et il échoue
   * par un message, pas par un délai dépassé sans explication.
   */
  async fightToKnockOut(maxTurns = 12): Promise<void> {
    for (let played = 0; played < maxTurns; played += 1) {
      const turn = await this.awaitTurn();
      if (turn === TurnState.Over) {
        // Une partie qui se termine peut se terminer d'un K.O. — ou d'un constat de divergence, et
        // il faut alors le DIRE plutôt que de rendre la main : l'appelant assertionnerait un verdict
        // et échouerait sur « Joueur 2 gagne ! au lieu de Joueur 1 », un message qui n'apprend rien.
        await this.refuseDivergence();
        return;
      }
      await this.refuseDivergence();
      const actor = turn === TurnState.Attacker ? this.attacker : this.defender;
      const tiles = await this.readTiles(actor);
      const distance = manhattan(tiles.attacker, tiles.defender);
      const mine = turn === TurnState.Attacker ? tiles.attacker : tiles.defender;
      const foe = turn === TurnState.Attacker ? tiles.defender : tiles.attacker;

      let acted = false;
      if (turn === TurnState.Attacker && distance <= SHADOW_BALL_RANGE) {
        await this.session.actAndPropagate(actor, () => this.cast(actor, SHADOW_BALL, foe));
        acted = true;
      } else {
        const landing = await this.bestLanding(actor, mine, foe);
        if (landing !== null) {
          await this.session.actAndPropagate(actor, () => this.cast(actor, TELEPORT, landing));
          acted = true;
        }
      }

      if (acted) {
        /*
         * Le coup a pu conclure la partie — il n'y a alors plus de tour à clore, ni de menu où
         * cliquer. Et il a pu, dans un autre cas, rendre la main tout seul. Les deux se lisent par la
         * même attente que la boucle, plutôt que d'être supposés : « Attendre » n'existe que du côté
         * dont c'est le tour, donc le cliquer à tort n'échouerait pas, il attendrait sans fin.
         */
        const after = await this.awaitTurn();
        if (after === TurnState.Over) {
          await this.refuseDivergence();
          return;
        }
        if (after !== turn) {
          continue;
        }
      }
      await this.session.actAndPropagate(actor, () => actor.scene.endTurn());
    }
    throw new Error(
      `le duel n'a pas trouvé sa conclusion en ${maxTurns} tours (aucun camp n'est tombé)`,
    );
  }

  /**
   * Un constat de divergence pendant le duel arrête tout, en le DISANT.
   *
   * Sans ce garde-fou, une divergence prononcée à l'empreinte de lancement termine la partie avant
   * la première action : le menu d'action disparaît, et le pilote échoue sur « bouton Attaque
   * introuvable » — un message qui envoie chercher un bug d'interface là où le sujet est le
   * détecteur de désynchronisation. Mesuré en vérifiant le rouge-vert de ce scénario.
   */
  private async refuseDivergence(): Promise<void> {
    for (const peer of [this.attacker, this.defender]) {
      if ((await peer.divergence.count()) > 0) {
        throw new Error(
          "constat de divergence pendant un duel HONNÊTE : « les parties ne concordent plus » " +
            "a été lu en cours de combat, c'est le faux positif que ce scénario existe pour refuser",
        );
      }
    }
  }

  /**
   * Attaque → la ligne du move nommé → la case visée → confirmation.
   *
   * Déroulé ici plutôt que par `CombatScene.castMoveNamed`, et pour une seule raison : les deux
   * garde-fous doivent s'insérer ENTRE les clics. `disabled` sur « Attaque » dit que le Pokemon peut
   * encore agir, `data-enabled` sur la ligne porte le `hasTargets` calculé par le core — donc c'est
   * le jeu lui-même qui dit si le tir est possible. Sans eux, un clic sur un bouton grisé n'échoue
   * pas : Playwright l'ATTEND indéfiniment (aucun `actionTimeout` n'est réglé), et le scénario meurt
   * sur un délai global sans jamais dire ce qui n'allait pas. C'est ce qui est arrivé au premier run.
   *
   * Aucune étape n'est sautée : `Single` comme `Teleport` réclament une case, donc la visée puis la
   * confirmation — deux clics sur la même case, exactement comme `castMove`.
   */
  private async cast(actor: OnlinePeer, moveName: string, target: Tile): Promise<void> {
    const attack = actor.page.getByRole("button", { name: "Attaque", exact: true });
    await expect(attack).toBeEnabled();
    await attack.click();
    const move = actor.page.getByTestId("move-item").filter({ hasText: moveName });
    await expect(move).toHaveAttribute("data-enabled", "true");
    await move.click();
    await actor.scene.clickTile(target.x, target.y);
    await actor.scene.clickTile(target.x, target.y);
  }

  /**
   * La case libre, à portée de Téléport, qui rapproche le plus de l'ennemi — ou `null` si aucune ne
   * rapproche.
   *
   * L'étendue de la grille est LUE sur la scène (`tile_<x>_<y>`) au lieu d'être supposée : le
   * scénario ne choisit pas sa carte, donc coder 12×20 en dur le rendrait faux le jour où la carte
   * par défaut change.
   */
  private async bestLanding(peer: OnlinePeer, from: Tile, foe: Tile): Promise<Tile | null> {
    const [tileNames, sprites] = await Promise.all([
      peer.scene.meshNamesStartingWith("tile_"),
      peer.scene.spriteStates(),
    ]);
    const occupied = new Set(sprites.map((sprite) => `${sprite.tile.x},${sprite.tile.y}`));
    let best: Tile | null = null;
    let bestDistance = manhattan(from, foe);
    for (const name of tileNames) {
      const parsed = /^tile_(\d+)_(\d+)$/.exec(name);
      if (parsed === null) {
        continue;
      }
      const candidate: Tile = { x: Number(parsed[1]), y: Number(parsed[2]) };
      const reach = manhattan(from, candidate);
      if (reach < 1 || reach > TELEPORT_RANGE || occupied.has(`${candidate.x},${candidate.y}`)) {
        continue;
      }
      const distance = manhattan(candidate, foe);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Les cases des deux combattants, reconnus à leur ESPÈCE — deux espèces distinctes par contrat. */
  private async readTiles(peer: OnlinePeer): Promise<DuelTiles> {
    const sprites = await peer.scene.spriteStates();
    const attacker = sprites.find((sprite) => sprite.pokemonId === ATTACKER_SPECIES);
    const defender = sprites.find((sprite) => sprite.pokemonId === DEFENDER_SPECIES);
    if (attacker === undefined || defender === undefined) {
      throw new Error(
        `le plateau ne montre pas les deux combattants (${sprites.map((s) => s.pokemonId).join(", ") || "aucun sprite"})`,
      );
    }
    return { attacker: attacker.tile, defender: defender.tile };
  }

  /**
   * Attend le prochain tour — ou la fin de la partie.
   *
   * Les deux dans la MÊME attente, et c'est ce qui rend la boucle jouable : le dialogue de fin
   * arrive après une animation, donc le lire aussitôt après le coup fatal répondrait « pas encore »,
   * et la boucle repartirait attendre une main qui ne reviendra jamais.
   */
  private async awaitTurn(): Promise<TurnState> {
    let latest: TurnState = TurnState.Pending;
    await expect
      .poll(
        async () => {
          latest = await this.readTurn();
          return latest;
        },
        { timeout: 45_000, message: "ni la main ni la fin de partie" },
      )
      .not.toBe(TurnState.Pending);
    return latest;
  }

  private async readTurn(): Promise<TurnState> {
    if ((await this.attacker.victory.isVisible()) || (await this.defender.victory.isVisible())) {
      return TurnState.Over;
    }
    if (await this.attacker.hasHand()) {
      return TurnState.Attacker;
    }
    return (await this.defender.hasHand()) ? TurnState.Defender : TurnState.Pending;
  }
}
