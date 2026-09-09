import { ONLINE_TURN_DURATION_MS } from "./protocol.js";

/**
 * Les délais du salon, et la politique qui choisit entre eux.
 *
 * Sorti de `room.ts` pour une raison : **c'est la table de réglages**, celle qu'on rouvre pour
 * changer un chiffre après une recette, pas pour lire une machine à états. Les motifs derrière
 * chaque valeur (#905, #950, #961) valent plus que les valeurs elles-mêmes — ils disent pourquoi la
 * ressemblance entre `GRACE_AFTER_SILENCE_MS` et `BATTLE_GRACE_AFTER_SILENCE_MS` est un piège, et
 * pourquoi un `bye` ne raccourcit pas autant en combat qu'en salon.
 *
 * Le modèle mental qui les explique tous est en tête de `room.ts` : **un départ n'est pas un
 * changement d'état, c'est un silence.** Ce qui suit, c'est quoi faire du silence.
 */

/** Après une fermeture propre — un `bye` est arrivé. Court : l'intention est connue, mais un rechargement de page passe par là. */
export const GRACE_AFTER_CLEAN_CLOSE_MS = 10_000;

/** Après un silence. Long : c'est le téléphone en arrière-plan, et il revient. */
export const GRACE_AFTER_SILENCE_MS = 45_000;

/**
 * Après un silence, **une fois la partie lancée** (plan 202, Lot B3, décision #950).
 *
 * 🔴 **Pas `GRACE_AFTER_SILENCE_MS`, et la ressemblance des valeurs est un piège.** 45 s de silence
 * en combat tomberait pile quand un chronomètre de tour honnête expire, donc faux positif sur chaque
 * tour joué à la dernière seconde — exactement ce contre quoi #865 met en garde. Cette valeur vaut
 * `ONLINE_TURN_DURATION_MS` **plus une marge de 15 s**, qui couvre l'animation d'une attaque de zone
 * à plusieurs cibles plus une latence honnête. Ancrage externe : le délai de reconnexion de Pokémon
 * Showdown est aussi de 60 s, et il a un serveur pour trancher.
 */
export const BATTLE_GRACE_AFTER_SILENCE_MS = ONLINE_TURN_DURATION_MS + 15_000;

/**
 * Le délai COURT du combat (plan 202, décision #950, révisée en recette le 2026-09-09).
 *
 * Il sert deux situations, et c'est délibérément **un seul chiffre** — l'humain a demandé à ne pas
 * en retenir deux :
 *
 * 1. **Une fermeture d'onglet** (`bye` reçu). Il valait 10 s, hérités du salon sans être réexaminés,
 *    et la recette a montré l'absurdité : fermer sa fenêtre poliment donnait **moins** de temps
 *    qu'arracher son câble réseau (10 s contre 75 s). Le motif de #905 — « l'intention est connue »
 *    — vaut dans une salle d'attente, où partir ne coûte rien ; en combat l'intention se déclare par
 *    le menu (« Abandonner », « Quitter »), jamais par la croix de la fenêtre. La croix, c'est
 *    l'accident, celui que la reprise existe pour absorber.
 * 2. **La deuxième chute de la même place.** Un pair déjà tombé une fois, revenu, puis retombé n'a
 *    plus droit à la présomption de lenteur : sans ce palier, une connexion qui clignote ferait
 *    attendre l'adversaire par tranches de 75 s indéfiniment.
 *
 * 30 s et non 75 : celui qui reste ne doit pas attendre une minute et quart pour gagner contre
 * quelqu'un qui est vraiment parti — et il peut toujours abandonner lui-même s'il ne veut pas
 * attendre.
 */
export const BATTLE_GRACE_SHORT_MS = 30_000;

/**
 * Entre deux tentatives de rappel de l'hôte, pendant son délai de grâce (plan 202, étape 5).
 *
 * 🔴 **Pourquoi ce rappel existe.** Qui appelle qui est asymétrique : l'invité compose l'adresse de
 * l'hôte, jamais l'inverse. Quand c'est **l'hôte** qui recharge, il reprend bien son adresse — le
 * code EST son adresse (#904) — et se met à écouter, mais **personne ne le rappelle** : l'invité
 * attendrait son délai en entier devant un hôte joignable, puis prononcerait un forfait. Le trou ne
 * se voit pas en testant la reconnexion de l'invité, qui, elle, compose.
 *
 * 2 s : assez lâche pour ne pas marteler l'annuaire, assez serré pour que le retour soit ressenti
 * comme immédiat dans une fenêtre de 75 s.
 */
export const HOST_REDIAL_INTERVAL_MS = 2_000;

/** Au-delà, un accusé de lancement manquant fait annuler le lancement. */
export const LAUNCH_ACK_TIMEOUT_MS = 15_000;

/** Au-delà, l'hôte n'a pas répondu à la présentation d'un arrivant. */
export const HANDSHAKE_TIMEOUT_MS = 10_000;

/** Ce que le salon sait d'un départ au moment de choisir combien de temps l'attendre. */
export interface GraceSituation {
  /** Vrai dès « Lancer » : on est en combat, plus en salon. C'est `Room.locked`. */
  readonly locked: boolean;
  /** Vrai si un `bye` a précédé la fermeture — l'intention a été annoncée. */
  readonly cleanClose: boolean;
  /** Vrai si cette place a **déjà** disparu une fois pendant cette partie. */
  readonly absentOnce: boolean;
}

/**
 * Combien de temps on attend ce retour (plan 202, décision #950).
 *
 * Trois régimes, et le troisième est celui que le Lot B3 ajoute :
 * - fermeture propre (un `bye` est arrivé) : court, l'intention est connue — mais un rechargement
 *   de page passe aussi par là, d'où 10 s et non zéro ;
 * - silence en **salon** : 45 s, le téléphone en arrière-plan qui revient ;
 * - silence en **combat** : `chrono + 15 s`, parce que 45 s tomberait pile sur l'expiration d'un
 *   chronomètre honnête. Et 30 s seulement si cette place a **déjà** disparu une fois.
 */
export function graceDelayFor(situation: GraceSituation): number {
  /*
   * En SALON, une fermeture propre vaut le délai court : la place se libère, personne ne perd de
   * partie, et l'intention annoncée par un `bye` est la seule information disponible (#905).
   */
  if (!situation.locked) {
    return situation.cleanClose ? GRACE_AFTER_CLEAN_CLOSE_MS : GRACE_AFTER_SILENCE_MS;
  }
  /*
   * En COMBAT, le `bye` ne raccourcit plus autant : fermer son onglet n'y est pas une déclaration
   * d'abandon — le menu l'est — mais 30 s suffisent à revenir, et laisser 75 s ferait attendre
   * pour rien celui qui est resté (révision de recette 2026-09-09).
   */
  if (situation.cleanClose || situation.absentOnce) {
    return BATTLE_GRACE_SHORT_MS;
  }
  return BATTLE_GRACE_AFTER_SILENCE_MS;
}
