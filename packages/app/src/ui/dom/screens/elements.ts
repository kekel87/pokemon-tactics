import { t } from "../../../i18n";
import {
  activateFocusedControl,
  closeOpenModal,
  focusableControls,
  focusInDirection,
  isModalOpen,
} from "../../../input/focus-navigation";
import { InputSource } from "../../../input/input-source";
import { getInputSystem } from "../../../input/input-system";

/**
 * Shared DOM helpers for FSM menu screens (plan 120 step 2).
 * Screens are plain full-viewport DOM (no Babylon canvas); buttons reuse the
 * `.tb-btn` component with the `.mn-btn` size override (menu-screens.css).
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  testId?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (testId) {
    node.dataset.testid = testId;
  }
  return node;
}

export function menuButton(label: string, action?: () => void): HTMLButtonElement {
  const button = el("button", "tb-btn mn-btn");
  button.type = "button";
  button.textContent = label;
  if (action) {
    button.addEventListener("click", action);
  } else {
    button.disabled = true;
  }
  return button;
}

/**
 * L'en-tête d'un écran PLEIN : « ◀ Retour » puis le titre, sur une barre à bordure basse.
 *
 * 🔴 Le projet n'a que **deux** mises en page, et c'est un retour explicite de l'humain
 * (2026-09-11) : le *menu* — pile centrée, titre doré, retour en dernier de la pile
 * (`menu-screens.css`) — et l'*écran plein* à en-tête, celui-ci. Un écran qui mélange les deux « ne
 * correspond à rien ». L'appelant récupère le `<header>` et peut y ajouter ce qu'il veut après le
 * titre, que `flex: 1` pousse à droite.
 *
 * Partagé, et pas recopié : ces règles n'existaient que pour l'écran de sélection d'équipe, sous
 * son préfixe `ts-`. Les dupliquer pour le lobby aurait donné deux en-têtes jumeaux libres de
 * diverger — contre l'esprit même de la demande.
 */
export function screenHeader(onBack: () => void): HTMLElement {
  const header = el("header", "scr-header");

  const back = el("button", "tb-btn");
  back.type = "button";
  back.dataset.variant = "ghost";
  back.dataset.testid = "screen-back";
  back.textContent = t("screen.back");
  back.addEventListener("click", onBack);

  header.append(back);
  return header;
}

/**
 * Le titre de la barre. Séparé du `<header>` parce que tous les écrans n'en ont pas un : l'éditeur
 * d'équipe y met un champ de saisie renommable à la place.
 */
export function screenHeaderTitle(titleText: string): HTMLElement {
  const title = el("h1", "scr-header-title");
  title.textContent = titleText;
  return title;
}

/** L'espaceur qui repousse à droite ce qui le suit dans la barre. */
export function screenHeaderSpacer(): HTMLElement {
  return el("div", "scr-header-spacer");
}

/**
 * Le geste d'annulation d'un écran de menu : refermer la modale ouverte s'il y en a une, sinon
 * revenir en arrière.
 *
 * 🔴 Extrait pour être PARTAGÉ (plan 207, étape 6). `bindScreenInput` le portait en propre, mais
 * l'écran `lobby` déclare son propre consommateur — la roue de caractères lui prend les deux axes —
 * et annulait donc **inconditionnellement**. Une modale posée sur le lobby se refermait au clavier,
 * par la fermeture native du `<dialog>`, mais à la manette B quittait l'écran par-dessous elle.
 *
 * Tout écran à consommateur propre doit passer par ici, sous peine de rejouer ce trou. Le plan 208
 * en a besoin aussi, pour la carte en modale.
 */
export function cancelToModalOrBack(onBack?: () => void): boolean {
  const system = getInputSystem();
  // A modal dialog owns Escape: it must close, not navigate the screen away underneath it.
  if (isModalOpen()) {
    // ...mais `Échap` n'existe pas sur une manette, donc B n'avait AUCUNE sortie : on entrait
    // dans un sélecteur du Team Builder et on y restait (plan 188). Au clavier on continue de
    // rendre la main à la fermeture native du `<dialog>` — la réclamer ici doublerait le
    // traitement, cf. décision #822.
    if (system?.tracker.current() !== InputSource.Gamepad) {
      return false;
    }
    return closeOpenModal();
  }
  if (onBack === undefined) {
    return false;
  }
  onBack();
  return true;
}

/**
 * Registers a menu screen with the input layer (plan 184): the arrows walk the focus through the
 * screen's controls (navigation SPATIALE, cf. `focus-navigation.ts`), and Escape (or B on a gamepad)
 * goes back. Returns the unregister to call from `dispose()`.
 *
 * Replaces the per-screen `window.addEventListener("keydown")` this used to be — six screens each
 * binding their own listener, with no notion of who else was listening.
 *
 * `onBack` is optional because the MAIN MENU has nowhere to go back to. It was left unregistered for
 * that reason at first, which meant the arrows had no consumer there at all: the whole first screen
 * of the game ignored the keyboard (retour humain 2026-08-21).
 */
export function bindScreenInput(onBack?: () => void): () => void {
  const system = getInputSystem();
  if (!system) {
    return () => undefined;
  }
  // Écran monté alors que le joueur navigue au clavier / à la manette : on lui donne un point de
  // départ (retour humain 2026-08-21). Sans ça il devait presser une flèche « pour rien » à chaque
  // changement d'écran avant que quoi que ce soit ne réagisse.
  if (system.tracker.isFocusDriven()) {
    focusableControls()[0]?.focus();
  }

  return system.register({
    context: () => "screen",
    menu: {
      focusMove: (direction) => focusInDirection(direction),
      confirm: () => {
        // À la MANETTE il faut activer soi-même : un appui de pad n'est pas un événement clavier,
        // donc aucune activation native ne suit et A ne faisait rien du tout (retour humain
        // 2026-08-21). Au clavier au contraire, le navigateur active le bouton focalisé, et réclamer
        // la touche ici l'en empêcherait.
        if (system.tracker.current() !== InputSource.Gamepad) {
          return false;
        }
        return activateFocusedControl();
      },
      cancel: () => cancelToModalOrBack(onBack),
    },
  });
}
