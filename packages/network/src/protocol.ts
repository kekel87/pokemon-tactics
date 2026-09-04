import type { PlayerController, TeamSlot } from "@pokemon-tactic/core";

/**
 * Protocole du salon en ligne (plan 199, Lot B1). **Aucun message d'action de combat** : les actions
 * s'échangent au Lot B2, ce protocole s'arrête quand tous les pairs entrent en combat avec un état
 * identique.
 */

/**
 * Version de compatibilité réseau, comparée strictement à la poignée de main (décision #900).
 *
 * 🔴 **À incrémenter à la main dès que toucher au moteur, aux données de jeu ou à ce protocole peut
 * faire diverger deux pairs.** C'est la seule règle à retenir de ce fichier.
 *
 * Pourquoi pas `buildVersion` : `__APP_VERSION__` vient de `git describe --tags --always --dirty`
 * (`packages/app/vite.config.ts`), donc change à **chaque commit**, documentation comprise. Et les
 * déploiements Pages et itch.io sont deux workflows séparés qui ne portent pas la même valeur au même
 * moment — refuser dessus interdirait à un joueur itch de jouer avec un joueur Pages, c'est-à-dire
 * précisément le cas qu'on veut. Deux `git describe` ne s'ordonnent pas non plus, donc on ne pourrait
 * même pas dire lequel des deux doit recharger.
 *
 * Le filet du jour où on oubliera est la somme de contrôle d'état du Lot B4 : la divergence devient
 * une erreur lisible au lieu d'un combat qui part en silence.
 */
export const NETWORK_VERSION = 1;

/**
 * Causes de refus, en énumération **fermée**. Ce sont aussi les valeurs envoyées en télémétrie :
 * jamais de texte libre, sinon le rapport devient impossible à agréger.
 */
export const NetworkErrorCode = {
  /** Aucun hôte à cette adresse — code mal recopié, ou salon déjà refermé. */
  CodeIntrouvable: "code_introuvable",
  /** Toutes les places du format sont prises. */
  SalonPlein: "salon_plein",
  /** Le salon a été verrouillé par « Lancer » avant l'arrivée. */
  PartieCommencee: "partie_commencee",
  /** `NETWORK_VERSION` diffère. Message symétrique : on n'accuse aucun des deux camps. */
  VersionIncompatible: "version_incompatible",
  /** La traversée de pare-feu a échoué (NAT symétrique, réseau mobile). Assumé en V1. */
  ConnexionImpossible: "connexion_impossible",
  /** Le pair n'a pas répondu dans le délai imparti. */
  DelaiDepasse: "delai_depasse",
} as const;

export type NetworkErrorCode = (typeof NetworkErrorCode)[keyof typeof NetworkErrorCode];

/** Les trois graines qui rendent la partie rejouable à l'identique sur chaque pair (décision #902). */
export interface NetworkSeeds {
  /** Jets de combat. */
  battle: number;
  /**
   * Placement automatique. `PlacementPhase` retombe sur `Math.random` quand aucune graine n'est
   * fournie, et l'écran de combat lui passait jusqu'ici un tirage **local** : sans cette graine, deux
   * pairs obtiennent deux plateaux différents avant le premier tour.
   */
  placement: number;
  /**
   * IA. Semence **racine** : chaque place en dérive la sienne en consommant le générateur une fois
   * par place, dans l'ordre croissant des places. Jamais un générateur unique partagé — l'ordre de
   * consommation compterait alors, et il n'est pas garanti entre pairs.
   */
  ai: number;
}

/** Une place du salon, telle que tout le monde la voit. */
export interface NetworkSeatState {
  /** 1 = l'hôte. */
  seat: number;
  /**
   * `human` pour le joueur local, `ai` pour une ligne tenue par l'ordinateur, `remote` pour un joueur
   * distant connecté. Le troisième état est propre au réseau : le moteur ne connaît que les deux
   * premiers, et `remote` est rabattu sur `human` à la composition du setup.
   *
   * `waiting` est la place que personne ne tient encore. Elle devient `ai` à la composition du
   * setup, ce qui garde le salon **jouable même si personne ne vient**.
   */
  occupancy: NetworkSeatOccupancy;
  /** Vrai quand ce joueur a confirmé sa sélection d'équipe. Une place IA est prête d'office. */
  ready: boolean;
}

export const NetworkSeatOccupancy = {
  Human: "human",
  Ai: "ai",
  Remote: "remote",
  /**
   * Personne, et l'hôte n'a pas encore décidé quoi en faire (retour de recette 2026-09-04).
   *
   * Les places libres démarraient en `ai`, ce qui rendait un salon en ligne **indistinguable d'une
   * partie solo** au premier regard : on créait une partie pour jouer à deux et l'écran annonçait
   * un adversaire ordinateur. Une place libre dit maintenant qu'elle attend quelqu'un.
   *
   * Elle **ne bloque pas le lancement** — il n'y a personne dont on attendrait la confirmation — et
   * elle part en IA à la composition du setup, donc le salon reste jouable même si personne ne
   * vient. L'hôte peut aussi la basculer lui-même en IA ou en humain.
   */
  Waiting: "waiting",
} as const;

export type NetworkSeatOccupancy = (typeof NetworkSeatOccupancy)[keyof typeof NetworkSeatOccupancy];

/** L'équipe qu'un joueur a choisie, échangée au lancement. */
export interface NetworkTeamSelection {
  pokemonDefinitionIds: readonly string[];
  /** Les emplacements complets quand le joueur vient du Team Builder ; absents pour une équipe brute. */
  slots?: readonly TeamSlot[];
}

/**
 * Les paramètres de partie, fixés par l'hôte. Le format est gravé depuis l'écran `lobby` et
 * n'apparaît donc jamais comme modifiable ici (décision #896).
 */
export interface NetworkRoomOptions {
  /** Identifiant **stable** de carte (`MAPS_REGISTRY`), jamais une URL : une URL dépend de la base de déploiement et n'est pas un contrat entre deux pairs. */
  mapId: string;
  teamCount: number;
  autoPlacement: boolean;
  damagePreview: boolean;
}

/** Un arrivant se présente : version, et la place qu'il vient de prendre chez l'annuaire. */
export interface HelloMessage {
  type: "hello";
  networkVersion: number;
  seat: number;
}

/** L'hôte répond la liste des places occupées, ce qui donne à l'arrivant tout le maillage à joindre. */
export interface WelcomeMessage {
  type: "welcome";
  networkVersion: number;
  occupiedSeats: readonly number[];
}

/** L'hôte diffuse l'état complet du salon à chaque changement. Message idempotent, pas un delta. */
export interface RoomStateMessage {
  type: "room_state";
  options: NetworkRoomOptions;
  seats: readonly NetworkSeatState[];
  /** Vrai dès « Lancer » : plus aucune connexion acceptée. */
  locked: boolean;
}

/** Un joueur annonce l'équipe qu'il a composée. */
export interface TeamSelectMessage {
  type: "team_select";
  seat: number;
  selection: NetworkTeamSelection;
}

/** Un joueur confirme. Une place IA est prête d'office, elle n'envoie rien. */
export interface ReadyMessage {
  type: "ready";
  seat: number;
  ready: boolean;
}

/**
 * L'hôte grave la partie. Porte tout ce dont un pair a besoin pour monter le même combat sans
 * échanger un mot de plus : la carte par identifiant stable, le format, les options, la composition
 * de **chaque** place, et les trois graines.
 */
export interface StartMessage {
  type: "start";
  options: NetworkRoomOptions;
  seeds: NetworkSeeds;
  seats: readonly StartSeat[];
}

export interface StartSeat {
  seat: number;
  /** `human` ou `ai` seulement : `remote` est un état de salon, le moteur ne le connaît pas. */
  controller: PlayerController;
  selection: NetworkTeamSelection;
}

/**
 * 🔴 L'accusé qui rend le lancement sûr. Sans lui, un pair qui manque le `start` reste sur l'écran
 * d'équipe pendant que les autres jouent, et **aucun moment n'existe** où quelqu'un s'en aperçoit :
 * il attend un tour qui n'arrivera jamais. L'hôte n'entre en combat que lorsque tous ont accusé, et
 * annule le lancement sinon (décision #903).
 */
export interface StartAckMessage {
  type: "start_ack";
  seat: number;
}

/** Départ propre — le pair ferme son onglet ou quitte le salon. Déclenche le délai court, pas le long. */
export interface ByeMessage {
  type: "bye";
  seat: number;
}

export type NetworkMessage =
  | HelloMessage
  | WelcomeMessage
  | RoomStateMessage
  | TeamSelectMessage
  | ReadyMessage
  | StartMessage
  | StartAckMessage
  | ByeMessage;

export type NetworkMessageType = NetworkMessage["type"];

const MESSAGE_TYPES: readonly NetworkMessageType[] = [
  "hello",
  "welcome",
  "room_state",
  "team_select",
  "ready",
  "start",
  "start_ack",
  "bye",
];

/**
 * Reconnaît un message venu du réseau. Un pair peut envoyer n'importe quoi — un client modifié, une
 * autre application qui a pris une adresse voisine, une version future — donc rien n'est présumé
 * bien formé. Ce garde ne valide que la forme d'enveloppe ; le contenu est validé par le salon, qui
 * seul sait ce qui a du sens dans son état courant.
 */
export function isNetworkMessage(value: unknown): value is NetworkMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  return typeof type === "string" && MESSAGE_TYPES.includes(type as NetworkMessageType);
}

/**
 * Le refus de version est **symétrique** : les deux camps affichent le même message, aucun n'accuse
 * l'autre. On ne peut de toute façon pas dire lequel doit recharger — un entier plus petit peut être
 * le pair resté sur un vieux cache comme celui qui joue une version dont l'autre a le futur.
 */
export function isCompatibleVersion(remoteVersion: number): boolean {
  return remoteVersion === NETWORK_VERSION;
}

/**
 * Dérive la graine d'IA de chaque place depuis la graine racine du setup (décision #901).
 *
 * Consomme le générateur **une fois par place, dans l'ordre croissant des places**, et rend la table
 * complète. L'ordre des places étant le même partout, la dérivation l'est aussi — ce qui ne serait
 * pas vrai d'une dérivation par identifiant de joueur, dont l'ordre d'itération n'est pas garanti.
 *
 * Toutes les places sont dérivées d'un coup, y compris les humaines : dériver à la demande ferait
 * dépendre les valeurs de **qui** demande, donc du nombre d'IA de la partie — deux pairs qui
 * n'interrogent pas les mêmes places obtiendraient des graines différentes pour la même place.
 *
 * @param nextRandom générateur semé sur `seeds.ai`, fourni par l'appelant (`createPrng` du core) —
 * le paquet réseau ne dépend d'aucune implémentation d'aléa.
 */
export function deriveAiSeedsBySeat(
  seats: readonly number[],
  nextRandom: () => number,
): ReadonlyMap<number, number> {
  const ascending = [...seats].sort((left, right) => left - right);
  return new Map(ascending.map((seat) => [seat, nextRandom()]));
}
