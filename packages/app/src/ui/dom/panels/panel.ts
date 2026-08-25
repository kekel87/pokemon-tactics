/**
 * Un panneau de réglages, détaché de son hôte (plan 187).
 *
 * Pourquoi ce contrat existe : `ScreenManager` fait *dispose puis mount*, donc naviguer
 * `combat → settings` **tue la partie en cours**. Or c'est précisément en combat qu'un joueur veut
 * changer une touche. Les deux écrans concernés portaient à la fois leur mise en page ET le fait
 * d'être un écran plein cadre ; on sépare les deux, et la mise en page se monte indifféremment dans
 * un écran de la FSM ou dans la modale du menu de combat.
 *
 * Ce n'est PAS une abstraction spéculative : elle a exactement deux implémentations et exactement
 * deux hôtes, tous les quatre écrits dans le même plan.
 */
export interface Panel {
  readonly element: HTMLElement;
  dispose(): void;
}

/*
 * Pas de `cancelCapture()` sur ce contrat, et c'est délibéré (revue de code 2026-08-25).
 *
 * On avait cru qu'un hôte devait annuler une capture de touche avant de traiter son propre *Annuler*.
 * C'est inutile : pendant une capture, **aucune action logique n'atteint le routeur** — l'écouteur
 * clavier de l'`InputSystem` intercepte la frappe avant `resolveKeyboardAction`, et le sondeur de
 * manette « ne route RIEN ». `Échap` et `B` partent donc directement dans le puits de capture, qui
 * porte déjà sa sortie inconditionnelle (plan 186 décision 8). Un membre d'interface de plus n'aurait
 * jamais été exécuté.
 */

export interface PanelOptions {
  /** Remonter d'un cran : vers l'écran précédent, ou vers le niveau précédent de la modale. */
  readonly onBack: () => void;
  /**
   * Monté dans la modale du menu de combat plutôt qu'en écran plein cadre.
   *
   * Les classes du panneau ne changent pas d'un hôte à l'autre — tout le CSS existant continue de
   * s'appliquer — seul le `position: absolute; inset: 0` de `.mn-screen` est neutralisé, puisque
   * dans un `<dialog>` il recouvrirait le viewport au lieu de remplir la boîte.
   */
  readonly embedded?: boolean;
}

/** La classe qui neutralise le plein cadre. Un seul endroit la nomme, le CSS la définit. */
export const EMBEDDED_PANEL_CLASS = "mn-embedded";
