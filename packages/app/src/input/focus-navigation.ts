import type { ScreenDirection } from "./input-router.js";
import { LogicalAction } from "./logical-action.js";

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
const FOCUSABLE_SELECTOR =
  "button:not(:disabled), input:not(:disabled):not([type='hidden']), select:not(:disabled), textarea:not(:disabled), [tabindex='0']";

/**
 * Les contrôles focalisables sous un hôte donné, dans l'ordre du document.
 *
 * Exporté pour que `preserve-focus.ts` ne redéclare pas le sélecteur ni le filtre : la duplication
 * avait déjà divergé (revue de code 2026-08-26), la restauration ignorant `data-nav-skip`.
 *
 * `data-nav-skip` retire un contrôle de la navigation POUR UNE SOURCE d'entrée donnée (plan 186) :
 * les colonnes clavier de l'écran de contrôles n'ont rien à offrir à une manette, qui ne peut y écrire
 * que des touches qu'elle n'a pas. La source active est lue sur `<html>` — c'est là que l'`InputSystem`
 * la publie depuis le plan 188, pour que la règle CSS d'anneau de focus atteigne aussi les `<dialog>`,
 * qui vivent hors de `#game-root`.
 */
export function focusableWithin(host: ParentNode): HTMLElement[] {
  const source = document.documentElement.dataset.inputSource ?? "";
  return [...host.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (control) =>
      control.dataset.navSkip !== source &&
      (control.offsetParent !== null || control.getClientRects().length > 0),
  );
}

export function focusableControls(): HTMLElement[] {
  const host = topmostOpenDialog() ?? document.querySelector<HTMLElement>("#game-root");
  return host ? focusableWithin(host) : [];
}

/**
 * Le `<dialog>` ouvert le plus HAUT de la pile, ou `null`.
 *
 * Le dernier du document, et non le premier : deux `<dialog>` peuvent coexister (une confirmation
 * par-dessus un sélecteur), et c'est celui du dessus qui possède le focus comme les gestes. Une seule
 * définition pour `focusableControls` et `closeOpenModal`, qui divergeaient — l'une prenait le premier,
 * l'autre le dernier, donc B pouvait refermer la modale du dessus pendant que les directions
 * parcouraient celle du dessous (revue de code 2026-08-26).
 */
function topmostOpenDialog(): HTMLDialogElement | null {
  return [...document.querySelectorAll<HTMLDialogElement>("dialog[open]")].at(-1) ?? null;
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
  // Un `<select>` est le seul contrôle qu'un clic PIÈGE au pad (plan 188) : il déroule une liste
  // native que la manette ne sait pas parcourir, et dont elle ne sait pas sortir. Ses options se
  // changent en place par ↑ ↓ — cf. `applyToFocusedControl`. On consomme quand même l'appui : le
  // laisser filer au routeur ferait remonter un Confirm dans un menu par-dessus le `<select>`.
  if (active instanceof HTMLSelectElement) {
    return true;
  }
  active.click();
  return true;
}

/** Un dialogue modal est-il ouvert ? Il capte alors la navigation. */
export function isModalOpen(): boolean {
  return document.querySelector("dialog[open]") !== null;
}

/**
 * Referme le dialogue modal ouvert, en disant s'il y en avait un (plan 188).
 *
 * À réserver à la MANETTE, et pour la même raison que `activateFocusedControl` : `Échap` déclenche
 * la fermeture NATIVE d'un `<dialog>`, mais un appui de pad ne déclenche rien du tout — donc B
 * n'avait aucune sortie et on entrait dans un sélecteur du Team Builder sans pouvoir en ressortir.
 * Réclamer le geste au clavier en plus rejouerait le double traitement d'`Échap` que la décision
 * #822 a écarté (fermeture native PLUS action logique).
 */
export function closeOpenModal(): boolean {
  const top = topmostOpenDialog();
  if (top === null) {
    return false;
  }
  top.close();
  return true;
}

/**
 * Produit sur le contrôle focalisé l'effet que le NAVIGATEUR produirait au clavier — réservé à la
 * manette (plan 188).
 *
 * `isClaimedByFocusedControl` (`keyboard-source.ts`) dit quel axe un contrôle se réserve, et au
 * clavier il suffit de se retirer : le navigateur règle le slider et change l'option. Au pad il n'y
 * a aucun événement clavier derrière, donc se retirer ne fait *rien* — un slider de PS était
 * inréglable et la Nature inchangeable à la manette. Cette fonction est le pendant manette de cette
 * règle : là où le contrôle revendique l'axe, on applique nous-mêmes.
 *
 * Deux contrôles seulement, et c'est voulu :
 *   - un `<input type="range">` revendique l'horizontale → ← → règlent la valeur ;
 *   - un `<select>` revendique la verticale → ↑ ↓ changent l'option en place, sans dérouler la liste.
 * Un champ TEXTE revendique tout le clavier, mais une manette ne saisit pas de texte : on ne
 * revendique rien pour lui, sinon le focus y resterait piégé (le champ de recherche d'un sélecteur
 * serait un cul-de-sac). Les flèches y déplacent donc le focus, comme sur n'importe quel bouton.
 *
 * La cadence vient gratuitement de `gamepad-source.ts`, qui fait répéter une direction maintenue :
 * un ← tenu fait glisser le slider sans qu'un modèle d'entrée continu soit écrit ici.
 */
export function applyToFocusedControl(action: LogicalAction): boolean {
  return applyToControl(document.activeElement, action);
}

/**
 * Le contrôle sur lequel `applyToControl` sait agir, décrit par ce qu'il EXPOSE et non par sa classe.
 *
 * Duck-typé pour la même raison que `isClaimedByFocusedControl` (`keyboard-source.ts`) : la suite
 * unitaire tourne en environnement node, où `HTMLInputElement` n'existe pas — un `instanceof` contre
 * lui ne renvoie pas `false`, il lève. C'est aussi ce qui rend la règle testable sans jsdom.
 */
interface FocusableControlLike {
  tagName?: unknown;
  type?: unknown;
  disabled?: unknown;
  value?: unknown;
  selectedIndex?: number;
  options?: { length?: unknown } | unknown;
  stepUp?: () => void;
  stepDown?: () => void;
  dispatchEvent?: (event: unknown) => void;
}

/**
 * Cœur testable de `applyToFocusedControl` : l'élément est passé plutôt que lu sur le document.
 *
 * Émet un `Event` réel quand la plateforme en fournit un, et à défaut un objet minimal portant le
 * `type` — les consommateurs (`FormatPicker`, la Nature) ne lisent rien d'autre, et un test node n'a
 * pas de constructeur `Event`.
 */
export function applyToControl(target: unknown, action: LogicalAction): boolean {
  const control = target as FocusableControlLike | null;
  if (control === null || control === undefined || typeof control.tagName !== "string") {
    return false;
  }
  if (control.disabled === true) {
    return false;
  }
  const tag = control.tagName.toUpperCase();
  const horizontal = action === LogicalAction.CursorLeft || action === LogicalAction.CursorRight;
  const vertical = action === LogicalAction.CursorUp || action === LogicalAction.CursorDown;
  const forward = action === LogicalAction.CursorRight || action === LogicalAction.CursorDown;

  if (tag === "INPUT") {
    const type = typeof control.type === "string" ? control.type.toLowerCase() : "text";
    // Seul le slider revendique un axe qu'une manette peut servir. Une case à cocher n'en revendique
    // aucun (le pad l'active par A), un champ texte revendique tout le clavier mais la manette ne
    // saisit pas — dans les deux cas on ne revendique rien, pour que les flèches sortent du contrôle.
    if (type !== "range" || !horizontal) {
      return false;
    }
    if (typeof control.stepUp !== "function" || typeof control.stepDown !== "function") {
      return false;
    }
    const before = control.value;
    // Appelé COMME MÉTHODE, jamais extrait dans une variable : `stepUp` détaché de son receveur lève
    // `Illegal invocation` (le `this` natif est perdu). C'était le bug du curseur de PS bloqué — la
    // première pression levait, ce qui tuait la boucle du poller manette, donc TOUTE la manette.
    if (forward) {
      control.stepUp();
    } else {
      control.stepDown();
    }
    if (control.value === before) {
      // Déjà en butée : ne pas consommer, pour que le routeur puisse sortir du contrôle plutôt que
      // d'avaler l'appui dans le vide.
      return false;
    }
    // `stepUp`/`stepDown` respectent `min`, `max` et `step` — les rejouer à la main divergerait du
    // clavier le jour où un slider porte un `step` autre que 1 — mais n'émettent AUCUN événement.
    emit(control, "input");
    return true;
  }

  if (tag === "SELECT") {
    // ← → sortent du `<select>`, exactement comme au clavier : il faut toujours une issue.
    if (!vertical) {
      return false;
    }
    const optionCount = optionsLength(control.options);
    const { selectedIndex } = control;
    if (typeof selectedIndex !== "number" || optionCount === null) {
      return false;
    }
    const next = selectedIndex + (forward ? 1 : -1);
    if (next < 0 || next >= optionCount) {
      // Première ou dernière option : on rend l'appui au routeur, qui sortira du contrôle.
      return false;
    }
    control.selectedIndex = next;
    // `change` et non `input` : c'est l'événement qu'un `<select>` émet nativement, donc celui que
    // `FormatPicker` et la Nature du Team Builder écoutent.
    emit(control, "change");
    return true;
  }

  return false;
}

function optionsLength(options: unknown): number | null {
  if (options === null || typeof options !== "object") {
    return null;
  }
  const length = (options as { length?: unknown }).length;
  return typeof length === "number" ? length : null;
}

function emit(control: FocusableControlLike, type: string): void {
  if (typeof control.dispatchEvent !== "function") {
    return;
  }
  const event =
    typeof Event === "function" ? new Event(type, { bubbles: true }) : { type, bubbles: true };
  // Comme méthode, pour la même raison que `stepUp` : `dispatchEvent` détaché lève.
  control.dispatchEvent(event);
}
