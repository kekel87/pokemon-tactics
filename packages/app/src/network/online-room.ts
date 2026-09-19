import { REQUIRED_TEAM_COUNTS } from "@pokemon-tactic/data";
import {
  FallbackTransport,
  PeerJsTransport,
  RelayTransport,
  type Room,
  type RoomDeps,
  RoomRole,
} from "@pokemon-tactic/network";
import { countAction, TelemetryAction } from "../analytics/telemetry";
import { DEFAULT_ICE_SERVERS } from "./ice-servers";
import { createRendezvousClient, RELAY_ENDPOINT } from "./rendezvous-client";
import { signallingOverride } from "./signalling-override";

/**
 * Le salon en ligne de la session, détenu **hors des écrans** (plan 199, correctif de revue).
 *
 * 🔴 Motif, et c'est un bug de correction, pas une élégance : le salon appartenait à l'écran de
 * sélection d'équipe, donc entrer en combat le **détruisait** — `dispose()` appelait `leave()`, qui
 * détruit le pair. Or l'accusé de lancement de l'invité (`start_ack`) part juste avant cette
 * navigation, et `peerjs` **jette** le tampon d'un canal qu'on détruit :
 * `BufferedConnection.close()` fait `this._buffer = []`, et `close({ flush: true })` se contente
 * d'envoyer une sentinelle avant de rendre la main — il ne ferme rien et ne vide rien.
 *
 * L'accusé pouvait donc ne jamais partir. L'hôte attendait 15 s, annulait, et rediffusait un salon
 * déverrouillé **à un invité qui n'avait plus de salon pour l'entendre** : l'invité en combat seul,
 * l'hôte revenu en salle d'attente. C'est exactement la panne que l'accusé existe pour empêcher, et
 * elle était atteignable sans aucun pair malveillant — seulement de la chance de temporisation, que
 * ni l'intégration (le canal factice vide correctement sa file, lui) ni l'e2e (boucle locale,
 * transmission immédiate) ne pouvaient prendre en défaut.
 *
 * Un salon qui survit à la transition d'écran ne peut plus appartenir à l'écran qui le crée. C'est
 * aussi l'architecture dont le **Lot B2** a besoin, où les actions s'échangent pendant le combat.
 */

/**
 * Les dépendances d'un salon, au même endroit pour les trois chemins qui en montent un — créer,
 * rejoindre, et **revenir** (plan 202, étape 5).
 *
 * `maxSeats` vient de l'application et non du paquet réseau : `packages/network` ne dépend pas de
 * `@pokemon-tactic/data`, c'est à l'appelant de dire jusqu'où un arrivant balaie les places.
 */
export function onlineRoomDeps(): RoomDeps {
  return {
    transport: buildTransport(),
    maxSeats: Math.max(...REQUIRED_TEAM_COUNTS),
    /*
     * Le registre des salons (plan 209, Lot C4) : il dit quelle place héberge, ce qui rend la
     * migration d'hôte possible. Injecté ici comme `maxSeats` — `packages/network` ne connaît ni
     * l'URL du Worker, ni la façon de l'atteindre.
     */
    rendezvous: createRendezvousClient(),
  };
}

/**
 * Le transport du salon : le direct, doublé d'un relais de secours (plan 216, bug 1).
 *
 * 🔴 **L'ordre n'est pas négociable.** `peerjs` est tenté en premier, toujours : le pair-à-pair est
 * gratuit, plus rapide, et ne fait transiter les actions par aucun tiers. Le relais ne s'allume que
 * quand la traversée a échoué — ce qui, avant ce plan, était simplement la fin de la partie.
 *
 * ⚠️ **L'e2e n'a pas de relais**, et c'est la même règle que `signalling-override.ts` : une suite de
 * tests ne doit rien demander à Internet. Quand l'annuaire est surchargé (`?peerPort`), on rend un
 * transport direct nu — exactement ce qui tournait avant ce lot.
 */
function buildTransport(): RoomDeps["transport"] {
  const override = signallingOverride();
  const direct = new PeerJsTransport({
    ...override,
    // Les serveurs par défaut de `peerjs` portent deux hôtes TURN morts : voir `ice-servers.ts`.
    ...(override?.iceServers === undefined ? { iceServers: DEFAULT_ICE_SERVERS } : {}),
  });
  if (override !== undefined) {
    return direct;
  }
  return new FallbackTransport({
    direct,
    // Le relais apprend qui il est par `claim()`, comme le direct : il n'a besoin que de l'adresse
    // du Worker, le code de partie et la place lui viennent de l'identifiant qu'on prend.
    relay: new RelayTransport({ endpoint: RELAY_ENDPOINT }),
    onRelayUsed: () => countAction(TelemetryAction.RoomRelayUsed),
  });
}

let current: Room | null = null;
let closeOnPageHideInstalled = false;
/** Se désabonne du salon détenu. `null` quand aucun salon n'est tenu. */
let stopWatchingRole: (() => void) | null = null;

/**
 * Annonce notre départ quand l'onglet se ferme (plan 202, étape 6).
 *
 * 🔴 Ce que ça change pour l'autre joueur : le `bye` fait la différence entre **10 s** et **75 s**
 * d'attente avant que son forfait ne tombe (décision #950). Sans lui, fermer son onglet — le geste
 * le plus banal du monde — imposait à l'adversaire une minute et quart devant un écran qui n'attend
 * plus personne. « Quitter » l'envoyait déjà ; la croix de l'onglet, non.
 *
 * `pagehide` et non `beforeunload` : c'est celui qui part vraiment sur mobile, où l'onglet est
 * déchargé sans passer par `beforeunload` (le même choix que la télémétrie, cf. `telemetry.ts`).
 *
 * Best-effort assumé : `leave()` diffuse en synchrone puis détruit le pair, ce qui suffit dans les
 * cas ordinaires, mais un onglet tué net (pression mémoire iOS) ne dira rien — et c'est exactement
 * le cas que le délai long existe pour couvrir.
 */
function installCloseOnPageHide(): void {
  if (closeOnPageHideInstalled || typeof window === "undefined") {
    return;
  }
  closeOnPageHideInstalled = true;
  window.addEventListener("pagehide", () => releaseOnlineRoom());
}

/**
 * Compte le moment où ce pair **devient** hôte par migration (plan 212, Lot A).
 *
 * 🔴 Ici et pas dans `packages/network` : ce paquet ne connaît pas la télémétrie et ne doit pas
 * l'apprendre — même frontière que `maxSeats` et `rendezvous`, injectés depuis l'application. Et
 * ici plutôt que dans un écran : la migration peut survenir en salle d'attente **comme en plein
 * combat**, et ce fichier est le seul qui détienne le salon des deux côtés de la transition.
 *
 * ⚠️ La **transition** et non l'état : `onChange` émet à chaque changement du salon, donc un hôte
 * compterait à chaque événement si on lisait simplement `role === Host`. D'où le rôle mémorisé.
 *
 * L'hôte d'origine ne compte jamais : il est déjà hôte au premier instantané, et c'est
 * `room-created` qui le dit.
 */
function watchHostMigration(room: Room): () => void {
  let previousRole = room.view.role;
  return room.onChange((view) => {
    if (previousRole === RoomRole.Guest && view.role === RoomRole.Host) {
      countAction(TelemetryAction.HostMigrated);
    }
    previousRole = view.role;
  });
}

/** Confie le salon à la session. Un salon déjà détenu est fermé — on n'en garde jamais deux. */
export function holdOnlineRoom(room: Room): void {
  if (current !== null && current !== room) {
    current.leave();
  }
  if (current !== room) {
    stopWatchingRole?.();
    stopWatchingRole = watchHostMigration(room);
  }
  current = room;
  installCloseOnPageHide();
}

/**
 * Le salon de la session, ou `null` en partie locale (plan 201, Lot B2).
 *
 * Ce fichier n'avait que `hold` et `release` : **personne ne pouvait lire le salon depuis le
 * combat**, alors que c'est exactement ce pour quoi il a été sorti des écrans. L'écran de combat s'en
 * sert pour brancher l'échange d'actions, et rend `null` en local — donc le même code monte les deux
 * sortes de partie sans se demander laquelle il monte.
 */
export function getOnlineRoom(): Room | null {
  return current;
}

/**
 * Termine la session en ligne : `bye` puis fermeture. Sans effet s'il n'y a pas de salon, ce qui
 * permet de l'appeler depuis tout chemin de sortie sans avoir à savoir si on jouait en ligne.
 */
export function releaseOnlineRoom(): void {
  current?.leave();
  current = null;
  stopWatchingRole?.();
  stopWatchingRole = null;
}
