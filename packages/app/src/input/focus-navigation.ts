import type { ScreenDirection } from "./input-router.js";

/**
 * Navigation du focus DOM au clavier / à la manette (plan 184).
 *
 * Partagé par les écrans de menu et par le dialogue de victoire du combat — les deux ont le même
 * besoin : parcourir des contrôles disposés en deux dimensions, et les activer sans qu'un événement
 * clavier natif ne s'en charge.
 */

/**
 * Tous les contrôles nativement focalisables de la zone de jeu.
 *
 * Les boutons seuls ne suffisaient pas (retour humain 2026-08-21) : « Placement auto » est une case à
 * cocher, donc les flèches la sautaient et seul `Tab` l'atteignait — or une manette n'a pas de `Tab`.
 *
 * Un `<dialog>` ouvert est **prioritaire** : le navigateur y piège le focus, donc proposer les
 * contrôles derrière lui n'aurait aucun effet et donnerait l'impression que rien ne répond.
 */
export function focusableControls(): HTMLElement[] {
  const dialog = document.querySelector<HTMLElement>("dialog[open]");
  const root = document.querySelector<HTMLElement>("#game-root");
  const host = dialog ?? root;
  if (!host) {
    return [];
  }
  const selector =
    "button:not(:disabled), input:not(:disabled):not([type='hidden']), select:not(:disabled), textarea:not(:disabled), [tabindex='0']";
  // `data-nav-skip` retire un contrôle de la navigation POUR UNE SOURCE d'entrée donnée (plan 186) :
  // les colonnes clavier de l'écran de contrôles n'ont rien à offrir à une manette, qui ne peut y
  // écrire que des touches qu'elle n'a pas. La source active est celle publiée par `InputSystem`.
  const source = root?.dataset.inputSource ?? "";
  return [...host.querySelectorAll<HTMLElement>(selector)].filter(
    (control) =>
      control.dataset.navSkip !== source &&
      (control.offsetParent !== null || control.getClientRects().length > 0),
  );
}

/** Centre d'un élément, en coordonnées de viewport. */
function centreOf(element: HTMLElement): { x: number; y: number } {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/**
 * Pénalité appliquée à un candidat hors de l'axe pressé. Supérieure à 1 pour qu'un contrôle de la
 * MÊME colonne (ou rangée) l'emporte sur un plus proche de côté — sans elle, ↓ dans une mise en page
 * à deux colonnes saute en diagonale.
 */
const CROSS_AXIS_PENALTY = 2;

/**
 * Déplace le focus vers le contrôle le plus proche dans une direction ÉCRAN — navigation spatiale,
 * pas ordre DOM (retour humain 2026-08-21).
 *
 * L'ordre DOM zigzague dans une mise en page à deux dimensions : sur l'écran de sélection d'équipe,
 * ← et → ne faisaient rien et ↓ sautait d'une colonne à l'autre. Le voisin le plus proche dans la
 * direction lit la mise en page comme l'œil, sans câblage par écran.
 */
export function focusInDirection(direction: ScreenDirection): void {
  const controls = focusableControls();
  if (controls.length === 0) {
    return;
  }
  const active = document.activeElement;
  const current = active instanceof HTMLElement && controls.includes(active) ? active : null;
  if (current === null) {
    // Rien de focalisé : on entre par la fin quand on monte / va à gauche, par le début sinon.
    const entry = direction === "up" || direction === "left" ? controls.at(-1) : controls[0];
    entry?.focus();
    return;
  }

  const from = centreOf(current);
  const vertical = direction === "up" || direction === "down";
  const forward = direction === "down" || direction === "right";
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of controls) {
    if (candidate === current) {
      continue;
    }
    const to = centreOf(candidate);
    const along = vertical ? to.y - from.y : to.x - from.x;
    const cross = vertical ? to.x - from.x : to.y - from.y;
    // Strictement dans la direction pressée, sinon ce n'est pas un candidat.
    if (forward ? along <= 0 : along >= 0) {
      continue;
    }
    const score = Math.abs(along) + Math.abs(cross) * CROSS_AXIS_PENALTY;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  // Aucun candidat de ce côté : on laisse le focus en place plutôt que de boucler à l'autre bout de
  // l'écran, ce qui se lirait comme un saut.
  best?.focus();
}

/**
 * Active le contrôle focalisé, en disant s'il y en avait un.
 *
 * À réserver à la MANETTE : un appui de pad n'est pas un événement clavier, donc aucune activation
 * native ne suit et A ne faisait rien du tout sur un menu (retour humain 2026-08-21). Au clavier,
 * c'est le navigateur qui active le bouton focalisé — le faire ici en plus le doublerait.
 */
export function activateFocusedControl(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !focusableControls().includes(active)) {
    return false;
  }
  active.click();
  return true;
}

/** Un dialogue modal est-il ouvert ? Il capte alors la navigation. */
export function isModalOpen(): boolean {
  return document.querySelector("dialog[open]") !== null;
}
