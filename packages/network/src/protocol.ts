import {
  type Action,
  ActionKind,
  Direction,
  Nature,
  PlayerController,
  PokemonGender,
  type Position,
  type TeamSlot,
} from "@pokemon-tactic/core";

/**
 * Protocole du salon en ligne (plan 199, Lot B1) **et du combat en réseau** (plan 201, Lot B2).
 *
 * Du moteur, ce fichier ne prenait que des types. Il en prend maintenant quelques **valeurs**
 * (`ActionKind`, `Direction`, `Nature`, `PlayerController`, `PokemonGender`) : ce sont des
 * énumérations fermées, et les valider au bord du réseau demande de connaître leurs valeurs. Même
 * exception que `composeStartSeats`, pas une porte ouverte à une dépendance de logique.
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
 *
 * 6 → 7 au plan 209 : aucun message n'a changé de forme, mais les RÈGLES de lecture, oui, et c'est
 * exactement ce que cette version protège. Un client d'avant refuse une action dont l'index est en
 * avance là où un client d'après la garde (Lot C1), et prononce un forfait bilatéral là où l'autre
 * vote à la minorité (Lot C2). Deux pairs de versions différentes élimineraient donc des joueurs
 * honnêtes sans qu'aucun message ne paraisse malformé — le pire mode d'échec, celui qui a l'air de
 * marcher.
 *
 * 7 → 8 au plan 210, pour une raison qui ne se voit dans aucun message : la somme de contrôle d'état.
 * `canonicalize` (`core/src/battle/state-checksum.ts`) sérialise TOUT l'état et n'omet que les
 * `undefined` — or un combat en ligne pose désormais `reviveDefeatedCamps: false`. Un build d'avant
 * n'a pas ce champ : deux pairs de versions différentes divergeraient DÈS LA PREMIÈRE somme, sans même
 * lancer Vœu Soin, et le vote de minorité éliminerait l'un des deux. La règle elle-même change aussi :
 * Vœu Soin sur le mort d'un camp rayé échoue d'un côté et ressuscite de l'autre. Relevé en revue de
 * code (Major 1) — l'incrément avait été oublié, ce qui est exactement le cas que ce commentaire décrit.
 *
 * 8 → 9 au plan 211, et pour une fois la forme d'un message change vraiment : `placement` n'existait
 * pas. Un pair d'avant ne sait pas l'émettre, donc un pair d'après attendrait indéfiniment un
 * placement qui ne vient jamais — et ne sait pas le lire, donc il le jetterait au bord du réseau et
 * bâtirait son moteur sans le camp d'en face. Les deux sens échouent, aucun ne le dit.
 *
 * 9 → 10 dans le même lot, sur retour de revue de code : le `start` porte désormais `formatKey`. Un
 * pair d'avant ne l'émet pas, donc un pair d'après lirait un format vide et repartirait sur le repli
 * qu'on vient de fermer — exactement le silence que ce champ existe pour supprimer.
 *
 * 10 → 11 le 2026-09-15, et c'est le MÊME cas que 6 → 7 : aucun message ne change de forme, les
 * RÈGLES DE LECTURE de `forfeit` changent. Un duel divergent ne prononce plus de forfait bilatéral —
 * il ARRÊTE la partie sans vainqueur (decision-1060), à l'émission comme à la réception. Deux pairs
 * de versions différentes se sépareraient donc ainsi : l'ancien reçoit `forfeit(place, diverged)`,
 * l'applique, et **se déclare vainqueur** ; le nouveau lit « Partie interrompue ». Un seul des deux
 * gagne, l'autre ne comprend pas — c'est le bug que ce lot éteint, réintroduit en version mixte.
 *
 * ⚠️ Aucun build publié n'est concerné, et l'incrément est fait quand même. `packages/network`
 * n'existe pas dans v2026.8.2 (2026-08-28), la dernière release : le multijoueur n'a jamais été
 * livré, donc personne ne parle la version 10 hors de nos builds locaux. On ne raisonne pas là-dessus
 * — c'est précisément ce que la règle en tête de ce commentaire demande d'éviter, et l'incrément
 * 7 → 8 a déjà été oublié une fois pour une raison de ce genre. Relevé en revue de code.
 */
export const NETWORK_VERSION = 11;

/**
 * Durée d'un tour en ligne — **déplacée dans `timings.ts`**, réexportée ici (plan 213).
 *
 * Elle reste du contrat réseau et se lit donc depuis ce module, comme avant : rien ne change pour
 * ses consommateurs. Mais elle VIT dans un fichier sans le moindre import, seule façon pour le
 * harnais e2e de l'importer au lieu de la recopier — voir le commentaire de tête de `timings.ts`.
 */
export { ONLINE_TURN_DURATION_MS } from "./timings.js";

/**
 * Combien de temps on laisse une action manquante arriver toute seule avant de la réclamer
 * (plan 209, Lot C1).
 *
 * Le quart du tour. À trois camps et plus, une action arrivée en avance est le cas NORMAL — les
 * canaux d'un maillage ne s'ordonnent pas entre eux — et le tampon de réordonnancement la résout
 * sans un octet de réseau. Réclamer tout de suite ferait un aller-retour à chaque désordre
 * ordinaire ; attendre un tour entier laisserait une vraie perte manger la fenêtre du joueur.
 */
export const RESYNC_GAP_DELAY_MS = 15_000;

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
  /**
   * L'hôte a réduit le nombre de camps, et cette place n'existe plus (plan 209, Lot C3).
   *
   * 🔴 Une cause À SOI, et pas un `CodeIntrouvable` de circonstance : le salon existe toujours, rien
   * n'a échoué, et le joueur n'a rien fait de mal. Lui servir « partie introuvable » le laisserait
   * croire à un bug ou à une mauvaise saisie, alors que la vraie réponse tient en une phrase — l'hôte
   * a changé le format. Arbitrage humain du 2026-09-14 : on éjecte, mais on DIT pourquoi.
   */
  FormatReduit: "format_reduit",
} as const;

export type NetworkErrorCode = (typeof NetworkErrorCode)[keyof typeof NetworkErrorCode];

/**
 * Pourquoi un camp est éliminé, en énumération **fermée** comme les causes de refus — et pour la
 * même raison : ce sont aussi des valeurs de télémétrie.
 */
export const NetworkForfeitReason = {
  /**
   * Les parties ne concordent plus : trois actions refusées de suite (plan 201, décisions D1/D5).
   *
   * 🔴 **Une divergence, pas une accusation de triche**, et c'est délibéré : en 1v1 personne ne peut
   * dire qui s'est écarté — un client modifié peut très bien *feindre* de constater une divergence.
   * On ne prétend donc pas savoir, on constate que les deux parties ne racontent plus la même chose,
   * exactement comme le refus de version reste symétrique (décision #900). Ce que le joueur lit dit
   * « vos parties ne concordent plus », jamais « vous avez triché ».
   */
  EtatDivergent: "diverged",
  /**
   * Le pair s'est tu (plan 202, Lot B3, décisions #950 et #952) : canal refermé sans retour pendant
   * le délai de grâce, silence pendant son tour, ou trois tours manqués d'affilée.
   *
   * 🔴 **N'accuse personne**, comme `EtatDivergent` : un forfait pour absence n'est pas plus
   * authentifiable que le reste (`backlog-forfait-sans-arbitre-non-authentifiable`), et de toute
   * façon un téléphone qui perd sa connexion n'a rien fait de mal. Ce que le joueur lit dit
   * « la connexion a été perdue », jamais « votre adversaire a fui ».
   */
  Absent: "absent",
  /** Le joueur a choisi d'abandonner (plan 202, Lot B3). `forfeitedSeat` vaut alors `seat`. */
  Abandon: "resigned",
} as const;

export type NetworkForfeitReason = (typeof NetworkForfeitReason)[keyof typeof NetworkForfeitReason];

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
/**
 * La valeur RÉSERVÉE de `NetworkRoomOptions.mapId` : « la carte n'est pas encore décidée ».
 *
 * 🔴 Déclarée ICI, dans le protocole, et non côté jeu : c'est une valeur que les deux pairs doivent
 * interpréter pareil, donc elle fait partie du contrat — au même titre que les noms de messages. Le
 * paquet réseau n'apprend rien du jeu au passage : il ne sait toujours pas ce qu'est une carte, il
 * sait seulement qu'une chaîne est réservée et ne désigne aucun terrain.
 *
 * Elle ne vaut qu'AVANT le lancement. Le `StartMessage` porte toujours un identifiant concret —
 * `Room.launch` refuse de publier celui-ci.
 */
export const RANDOM_MAP_ID = "random";

export interface NetworkRoomOptions {
  /**
   * Identifiant **stable** de carte (`MAPS_REGISTRY`), jamais une URL : une URL dépend de la base de
   * déploiement et n'est pas un contrat entre deux pairs.
   *
   * 🔴 Peut valoir la valeur sentinelle `random` **avant le lancement** (plan 208) : l'hôte a choisi
   * « Aléatoire », et le salon l'annonce tel quel pour que l'invité lise « Aléatoire » sans
   * apprendre le terrain. Le `StartMessage`, lui, porte toujours un identifiant CONCRET — l'hôte y
   * publie son tirage, fait une seule fois. C'est cette valeur nouvelle, que les deux pairs doivent
   * interpréter pareil, qui a fait passer `NETWORK_VERSION` de 5 à 6.
   */
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
  /**
   * Identifiant de la partie, tiré par l'hôte (plan 204).
   *
   * 🔴 **Opaque pour ce paquet** : `network` le transporte sans jamais le lire. Il sert à la
   * télémétrie, qui compte une partie par identifiant — les deux pairs émettent chacun leurs
   * événements, et sans identifiant commun une partie en ligne comptait pour deux dans TOUS les
   * agrégats par partie (parties, cartes, formats, durées, taux d'abandon).
   *
   * Champ propre et non quatrième membre de `NetworkSeeds` : celui-ci est un triplet de graines
   * aléatoires, et y glisser une chaîne casserait son sens comme sa validation.
   */
  battleId: string;
  /**
   * Le format de partie effectivement joué — « 2v6 », « 4v3 »… (plan 211, revue de code).
   *
   * 🔴 **Publié, jamais redérivé.** Chaque pair le reconstituait de son côté à partir du nombre de
   * camps, sur la carte de SON salon — et en mode carte « Aléatoire », l'invité dérivait depuis une
   * carte différente de celle qui allait être jouée. L'écran de combat repliait ensuite en silence
   * sur le premier format de la carte quand il ne retrouvait pas la clé : d'autres zones de départ
   * et une autre taille d'équipe, sans un mot.
   *
   * Inerte tant que toutes les cartes livrées s'accordent sur la taille d'équipe d'un nombre de
   * camps donné — ce qui est le cas des neuf actuelles, mesuré — mais la portée a grandi avec le
   * placement à la main : ce repli gouverne désormais les douze poses échangées sur le réseau, là où
   * il ne touchait qu'un tirage local.
   *
   * Même remède que la carte résolue du plan 208, et pour la même raison : ce que les pairs doivent
   * partager se publie, il ne se devine pas.
   */
  formatKey: string;
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

/**
 * L'hôte sort une place du salon, et lui dit pourquoi (plan 209, Lot C3).
 *
 * 🔴 **Envoyé AVANT la fermeture du canal**, sinon il n'y a plus de canal pour le porter — c'est la
 * même leçon que l'abandon du plan 202, qui rendait la main au menu sans prévenir l'adversaire.
 * La raison voyage dans l'énumération fermée des causes de refus : jamais de texte libre, sinon
 * chaque écran inventerait sa formulation et la télémétrie deviendrait inagrégeable.
 */
export interface KickMessage {
  type: "kick";
  seat: number;
  reason: NetworkErrorCode;
}

/**
 * Une action de combat, telle que son auteur l'a **déjà soumise à son propre moteur** (plan 201).
 *
 * 🔴 C'est ce « déjà » qui gouverne tout le traitement à la réception. `executeAction` soumet puis
 * diffuse : quand ce message arrive, l'émetteur a avancé. Refuser l'action ne le fait pas revenir en
 * arrière — un refus n'est donc pas une correction, c'est le constat d'une divergence. D'où le
 * barème (décision D1) plutôt que le « rejeter, redemander » que `docs/multiplayer.md` décrivait.
 */
export interface ActionMessage {
  type: "action";
  seat: number;
  /**
   * Nombre d'actions enregistrées chez l'émetteur **avant** celle-ci (décision D3).
   *
   * Détecteur de désync du pauvre : le canal est fiable et ordonné, donc un décalage ne vient pas du
   * transport mais des moteurs. Le dire tout de suite vaut mieux qu'appliquer une action au mauvais
   * acteur, et ça ne coûte pas d'attendre la somme de contrôle du Lot B4.
   */
  actionIndex: number;
  action: Action;
  /**
   * Posé par l'émetteur quand cette action vient de l'expiration de **son** chronomètre, et non
   * d'un choix (plan 202, Lot B3, décision #952).
   *
   * 🔴 Il existe parce qu'un `end_turn` reçu est **indiscernable** d'un « Attendre » joué
   * volontairement : sans ce drapeau, le compteur de tours manqués éliminerait quelqu'un qui finit
   * trois tours de suite sans agir, ce qui est une façon légitime de jouer.
   *
   * ⚠️ **Auto-déclaré et non authentifiable**, comme `forfeitedSeat` : un client patché peut ne
   * jamais le poser et échapper au compteur. C'est déjà la surface de triche assumée par #865 — « un
   * client qui s'octroie plus de temps n'est puni par rien d'automatique » — pas une brèche neuve.
   * Mentir dans l'autre sens ne fait que se nuire.
   */
  timedOut?: true;
}

/**
 * Un camp est éliminé. Barème épuisé au Lot B2 ; abandon volontaire et chien de garde au Lot B3.
 *
 * Tout le monde le reçoit, et c'est le point : **les autres joueurs doivent savoir pourquoi** un camp
 * disparaît de la partie, et **l'intéressé doit savoir qu'il est éliminé, et pourquoi**. Sans ce
 * message, un pair dont les actions sont refusées continue de jouer seul dans le vide.
 */
export interface ForfeitMessage {
  type: "forfeit";
  /** Qui l'annonce. Confronté à l'adresse d'annuaire par `Room.isSpokenFor`, donc fiable. */
  seat: number;
  /**
   * La place éliminée. Vaut `seat` pour un abandon volontaire (Lot B3), une **autre** place quand
   * l'émetteur constate une divergence (Lot B2).
   *
   * ⚠️ **Ce champ n'est pas authentifiable** — c'est la contrepartie assumée d'un modèle sans
   * arbitre : n'importe quel pair peut désigner n'importe qui. Sans effet dans le cadrage du jeu (on
   * joue entre gens qui se sont échangé un code, décision #863) ; à revoir seulement si une
   * communauté compétitive apparaît.
   */
  forfeitedSeat: number;
  reason: NetworkForfeitReason;
}

/**
 * « J'en suis là, donne-moi la suite » (plan 202, Lot B3, décision #955).
 *
 * Envoyé par un pair qui vient de **reprendre** sa partie : il a rejoué son propre journal
 * sauvegardé, et il lui manque ce qui s'est joué pendant son absence.
 */
export interface ResyncRequestMessage {
  type: "resync_request";
  seat: number;
  /** Nombre d'actions que l'émetteur a déjà appliquées. Il veut celles d'après. */
  actionIndex: number;
}

/**
 * La queue du journal, en réponse à un `resync_request` (plan 202, décision #955).
 *
 * ⚠️ Les actions voyagent **nues**, sans place d'auteur, et c'est délibéré : le revenant rejoue un
 * état déterministe, donc **son moteur sait déjà** qui doit agir à chaque index. Conséquence à
 * connaître — pendant un rattrapage, le contrôle « la place » de `submitRemoteAction` devient
 * tautologique ; ce sont la **légalité** et le **moteur** qui attrapent une divergence.
 */
export interface ResyncMessage {
  type: "resync";
  seat: number;
  /** Index de la première action de la liste, pour que le destinataire vérifie qu'il colle. */
  fromIndex: number;
  actions: readonly Action[];
}

/**
 * L'empreinte de l'état de combat local, à un point d'ancrage donné (plan 203, Lot B4).
 *
 * Les deux pairs l'émettent après chaque action et comparent : mêmes empreintes = les deux parties
 * racontent la même chose. C'est le seul filet contre une divergence qui laisse toutes les actions
 * **légales** — un point de vie d'écart, un compteur de météo qui diffère. Le validateur d'actions
 * du Lot B2 ne voit rien de ce cas, puisqu'il ne juge que la légalité.
 *
 * 🔴 **Ce n'est pas un anti-triche**, et aucune cadence n'y changerait rien : rien ne lie cette
 * empreinte à l'état réellement détenu, donc un client modifié émet celle de l'état honnête. Elle
 * détecte la divergence **accidentelle** — un `NETWORK_VERSION` oublié, un bug de déterminisme, deux
 * versions du moteur qui se rencontrent. Ce qui empêche de tricher reste la validation de chaque
 * action reçue (#211). Le seul gain contre un menteur : un pair qui **fabrique** un constat de
 * divergence alors que les empreintes concordent devient contredisable, ce qui restreint un peu le
 * trou assumé de #943.
 */
export interface ChecksumMessage {
  type: "checksum";
  seat: number;
  /**
   * Nombre d'actions appliquées chez l'émetteur au moment du calcul. **Le point d'ancrage** : on ne
   * compare que des empreintes de même index, un pair pouvant être une action en avance. Comparer
   * deux ancrages différents serait un faux positif garanti.
   */
  actionIndex: number;
  /** 16 caractères hexadécimaux — `battleStateChecksum` du core. */
  digest: string;
}

/** Une pose : quel Pokemon, sur quelle case, tourné dans quelle direction. */
export interface NetworkPlacement {
  /** Identifiant d'instance du combat (« p1-pikachu »), tel que le core le nomme. */
  pokemonId: string;
  position: Position;
  direction: Direction;
}

/**
 * Le placement à la main d'un camp, en un seul envoi (plan 211).
 *
 * **Un message par place, émis quand ce joueur a FINI** — pas une pose à la fois. Le placement en
 * ligne est simultané et CACHÉ jusqu'au lancement : il n'y a rien à montrer aux autres en cours de
 * route, donc le lot est plus simple, moins bavard, et ne crée aucun ordre d'arrivée à départager
 * pose par pose. Le repli du chrono emprunte le même chemin : à l'expiration, le client pose lui-même
 * ce qui reste et envoie ce message-ci.
 *
 * 🔴 **L'ordre de réception ne doit JAMAIS devenir l'ordre d'application.** Le récepteur range les
 * poses par place croissante avant de bâtir son moteur — c'est `getPlacements()` du core qui en porte
 * la garantie. Deux pairs qui appliqueraient les mêmes poses dans deux ordres différents
 * construiraient deux états différents, et le détecteur de désynchronisation tuerait la partie avant
 * le premier tour : exactement le défaut que ce plan répare.
 *
 * 🔴 **Ce n'est pas un secret cryptographique.** Le message part en clair dès qu'un joueur a fini,
 * donc un client modifié peut lire le placement adverse avant la révélation. Assumé, même modèle de
 * confiance que le fog (décision #863) — mais la fuite y est d'un tout autre ordre de grandeur, voir
 * le § Fog de `docs/multiplayer.md`.
 */
export interface PlacementMessage {
  type: "placement";
  seat: number;
  placements: readonly NetworkPlacement[];
}

export type NetworkMessage =
  | HelloMessage
  | WelcomeMessage
  | RoomStateMessage
  | TeamSelectMessage
  | ReadyMessage
  | StartMessage
  | StartAckMessage
  | ByeMessage
  | KickMessage
  | ActionMessage
  | ForfeitMessage
  | ResyncRequestMessage
  | ResyncMessage
  | ChecksumMessage
  | PlacementMessage;

export type NetworkMessageType = NetworkMessage["type"];

// --- Validation au bord du réseau -----------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArrayOf<T>(value: unknown, item: (entry: unknown) => entry is T): value is readonly T[] {
  return Array.isArray(value) && value.every(item);
}

function isNonEmptyArrayOf<T>(
  value: unknown,
  item: (entry: unknown) => entry is T,
): value is readonly T[] {
  return isArrayOf(value, item) && value.length > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Une place : 1 est l'hôte, il n'y a pas de place 0 ni de demi-place. */
function isSeat(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/**
 * Une version, **sans la comparer à la nôtre**, et c'est essentiel : `hello` et `welcome` venus d'un
 * pair incompatible doivent se lire, sinon on ne peut pas savoir que c'est la version qui cloche.
 * `isCompatibleVersion` est la politique ; ceci n'est que la forme.
 */
function isVersion(value: unknown): value is number {
  return Number.isInteger(value);
}

/** Le plateau est une grille : des entiers, jamais des flottants. */
function isPosition(value: unknown): value is Position {
  return isRecord(value) && Number.isInteger(value.x) && Number.isInteger(value.y);
}

function isMemberOf<T extends string>(
  enumeration: Record<string, T>,
): (value: unknown) => value is T {
  const values = new Set<string>(Object.values(enumeration));
  return (value): value is T => typeof value === "string" && values.has(value);
}

const isDirection = isMemberOf(Direction);

/**
 * Une pose venue du réseau (plan 211).
 *
 * L'identifiant non vide est la garde qui compte : une chaîne vide passerait le typage et ne
 * correspondrait à aucun Pokemon du setup, donc le moteur se bâtirait avec un camp incomplet — sans
 * erreur, et avec une divergence d'empreinte pour seul symptôme.
 */
function isPlacement(value: unknown): value is NetworkPlacement {
  return (
    isRecord(value) &&
    typeof value.pokemonId === "string" &&
    value.pokemonId.length > 0 &&
    isPosition(value.position) &&
    isDirection(value.direction)
  );
}
const isNature = isMemberOf(Nature);
const isPokemonGender = isMemberOf(PokemonGender);
const isForfeitReason = isMemberOf(NetworkForfeitReason);
const isErrorCode = isMemberOf(NetworkErrorCode);
const isSeatOccupancy = isMemberOf(NetworkSeatOccupancy);
/** Une place de `start` : `human` ou `ai` seulement — `remote` est un état de salon. */
const isStartController = isMemberOf(PlayerController);

/**
 * Une action de combat venue du réseau.
 *
 * ⚠️ `retreatPosition` est **facultative et jamais exigée** : elle n'apparaît pas dans
 * `getLegalActions()`, l'orchestrateur l'ajoute après coup et le moteur la valide à l'exécution
 * (`isValidHitAndRunRetreat`). L'exiger interdirait Demi-Tour, Change Éclair et Eau Revoir de
 * traverser le réseau.
 */
function isAction(value: unknown): value is Action {
  if (!isRecord(value) || !isNonEmptyString(value.pokemonId)) {
    return false;
  }
  switch (value.kind) {
    case ActionKind.Move:
      return isNonEmptyArrayOf(value.path, isPosition);
    case ActionKind.UseMove:
      return (
        isNonEmptyString(value.moveId) &&
        isPosition(value.targetPosition) &&
        (value.retreatPosition === undefined || isPosition(value.retreatPosition))
      );
    case ActionKind.EndTurn:
      return isDirection(value.direction);
    case ActionKind.UndoMove:
      return true;
    default:
      return false;
  }
}

/**
 * Forme d'un emplacement d'équipe. **Forme seulement** : qu'un talent existe ou qu'une répartition
 * de points soit légale n'est pas l'affaire du bord réseau, c'est celle du constructeur d'équipe —
 * et le paquet réseau ne dépend pas de `packages/data`.
 */
function isTeamSlot(value: unknown): value is TeamSlot {
  return (
    isRecord(value) &&
    isNonEmptyString(value.pokemonId) &&
    isNonEmptyString(value.ability) &&
    isNature(value.nature) &&
    isArrayOf(value.moveIds, isNonEmptyString) &&
    isRecord(value.statSpread) &&
    Object.values(value.statSpread).every((points) => Number.isFinite(points)) &&
    (value.heldItemId === undefined || isNonEmptyString(value.heldItemId)) &&
    (value.gender === undefined || isPokemonGender(value.gender))
  );
}

function isTeamSelection(value: unknown): value is NetworkTeamSelection {
  return (
    isRecord(value) &&
    isArrayOf(value.pokemonDefinitionIds, isNonEmptyString) &&
    (value.slots === undefined || isArrayOf(value.slots, isTeamSlot))
  );
}

function isRoomOptions(value: unknown): value is NetworkRoomOptions {
  return (
    isRecord(value) &&
    isNonEmptyString(value.mapId) &&
    typeof value.teamCount === "number" &&
    Number.isInteger(value.teamCount) &&
    value.teamCount >= 1 &&
    typeof value.autoPlacement === "boolean" &&
    typeof value.damagePreview === "boolean"
  );
}

function isSeatState(value: unknown): value is NetworkSeatState {
  return (
    isRecord(value) &&
    isSeat(value.seat) &&
    isSeatOccupancy(value.occupancy) &&
    typeof value.ready === "boolean"
  );
}

/** Trois graines, ou aucune partie : une seule manquante et les pairs divergent avant le tour 1. */
function isSeeds(value: unknown): value is NetworkSeeds {
  return (
    isRecord(value) &&
    Number.isFinite(value.battle) &&
    Number.isFinite(value.placement) &&
    Number.isFinite(value.ai)
  );
}

function isStartSeat(value: unknown): value is StartSeat {
  return (
    isRecord(value) &&
    isSeat(value.seat) &&
    isStartController(value.controller) &&
    isTeamSelection(value.selection)
  );
}

/**
 * Un valideur par variante du protocole.
 *
 * 🔴 **Ce fichier ne validait que le champ `type`** tout en promettant `value is NetworkMessage`, et
 * `Room.handleMessage` faisait confiance à cette promesse : `{"type":"room_state"}` nu passait le
 * garde, `applyRoomState(undefined, undefined, undefined)` jetait, et l'exception partait d'un
 * rappel `onMessage` — **le salon de l'invité mourait**. Aucun pair malveillant n'était nécessaire,
 * une version future suffisait.
 *
 * `satisfies Record<NetworkMessageType, …>` garde l'exhaustivité **dans les deux sens** : une
 * variante de l'union sans entrée ici ne compile pas, une entrée sans variante non plus.
 */
const MESSAGE_VALIDATORS = {
  hello: (message) => isVersion(message.networkVersion) && isSeat(message.seat),
  welcome: (message) =>
    isVersion(message.networkVersion) && isArrayOf(message.occupiedSeats, isSeat),
  room_state: (message) =>
    isRoomOptions(message.options) &&
    isNonEmptyArrayOf(message.seats, isSeatState) &&
    typeof message.locked === "boolean",
  team_select: (message) => isSeat(message.seat) && isTeamSelection(message.selection),
  ready: (message) => isSeat(message.seat) && typeof message.ready === "boolean",
  start: (message) =>
    isRoomOptions(message.options) &&
    isSeeds(message.seeds) &&
    // Non vide : une chaîne vide passerait le typage et rendrait toutes les parties d'un pair
    // indiscernables les unes des autres à l'agrégation (plan 204).
    typeof message.battleId === "string" &&
    message.battleId.length > 0 &&
    // Non vide, comme `battleId` : une chaîne vide passerait le typage et ferait retomber l'écran de
    // combat sur le premier format de la carte — le repli silencieux que ce champ existe pour fermer.
    typeof message.formatKey === "string" &&
    message.formatKey.length > 0 &&
    isNonEmptyArrayOf(message.seats, isStartSeat) &&
    // 🔴 Places 1..N, croissantes et sans trou. `composeStartSeats` le garantit déjà, mais rien ne le
    // VÉRIFIAIT — et tout l'aval en dépend : l'écran de combat mappe `start.seats` par INDEX sur
    // `PLAYER_IDS`, alors que la place locale est un NUMÉRO. L'égalité `index + 1 === seat` n'est
    // vraie que sous cette forme, et son échec ne se voyait nulle part : un invité en place 3 sur
    // deux places obtenait un joueur local introuvable, donc un combat rendu en hot-seat sur les
    // deux camps, sans erreur. Relevé en revue de code.
    message.seats.every((seat, index) => seat.seat === index + 1),
  start_ack: (message) => isSeat(message.seat),
  bye: (message) => isSeat(message.seat),
  kick: (message) => isSeat(message.seat) && isErrorCode(message.reason),
  action: (message) =>
    isSeat(message.seat) &&
    typeof message.actionIndex === "number" &&
    Number.isInteger(message.actionIndex) &&
    message.actionIndex >= 0 &&
    isAction(message.action) &&
    // `timedOut` est absent ou vaut exactement `true` — jamais `false`, qui voudrait dire la même
    // chose que l'absence et donnerait deux façons d'écrire le même message (plan 202).
    (message.timedOut === undefined || message.timedOut === true),
  forfeit: (message) =>
    isSeat(message.seat) && isSeat(message.forfeitedSeat) && isForfeitReason(message.reason),
  resync_request: (message) =>
    isSeat(message.seat) &&
    typeof message.actionIndex === "number" &&
    Number.isInteger(message.actionIndex) &&
    message.actionIndex >= 0,
  resync: (message) =>
    isSeat(message.seat) &&
    typeof message.fromIndex === "number" &&
    Number.isInteger(message.fromIndex) &&
    message.fromIndex >= 0 &&
    // Une liste VIDE est valide et fréquente : le revenant n'a peut-être rien manqué.
    isArrayOf(message.actions, isAction),
  checksum: (message) =>
    isSeat(message.seat) &&
    typeof message.actionIndex === "number" &&
    Number.isInteger(message.actionIndex) &&
    message.actionIndex >= 0 &&
    // Longueur et alphabet fixes : `battleStateChecksum` rend toujours 16 chiffres hexadécimaux.
    // Un pair qui enverrait autre chose n'est pas un pair dont on veut comparer les empreintes.
    typeof message.digest === "string" &&
    /^[0-9a-f]{16}$/.test(message.digest),
  placement: (message) => isSeat(message.seat) && isArrayOf(message.placements, isPlacement),
} as const satisfies Record<NetworkMessageType, (message: Record<string, unknown>) => boolean>;

/**
 * Reconnaît un message venu du réseau. Un pair peut envoyer n'importe quoi — un client modifié, une
 * autre application qui a pris une adresse voisine, une version future — donc rien n'est présumé
 * bien formé, **enveloppe et contenu**.
 *
 * Ce garde répond de la **forme**. Ce qui a du sens dans l'état courant du salon reste l'affaire du
 * salon, et la **légalité** d'une action reste celle du moteur (`getLegalActions`) : un message bien
 * formé n'est pas un message légitime.
 */
export function isNetworkMessage(value: unknown): value is NetworkMessage {
  if (!isRecord(value)) {
    return false;
  }
  const type = value.type;
  if (typeof type !== "string" || !Object.hasOwn(MESSAGE_VALIDATORS, type)) {
    return false;
  }
  return MESSAGE_VALIDATORS[type as NetworkMessageType](value);
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
