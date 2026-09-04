import { ROOM_CODE_LENGTH } from "@pokemon-tactic/network";
import {
  type CodeWheelState,
  codeOf,
  eraseBeforeActiveSlot,
  initialCodeWheelState,
  pasteCode,
  setActiveSlot,
  slotNeighbours,
  stepActiveSlot,
  typeCharacter,
} from "./code-wheel-model";

/**
 * La roue de caractères (plan 199, étape 4) — le seul widget de saisie du code de partie, pour les
 * quatre entrées. Maquette validée avec l'humain le 2026-09-04 : **les cinq emplacements montrent
 * leurs voisins d'alphabet**, ce qui dit sans légende que chaque case défile.
 *
 * Un emplacement est **un seul `<button>` natif**, et l'emplacement actif est celui qui a le focus.
 * D'où deux propriétés qu'on n'a pas eu à coder : gauche/droite est la navigation spatiale
 * ordinaire, et le liseré de focus du projet marque déjà la case active.
 *
 * Le bouton est haut, découpé en **trois zones de tape** — voisin du haut, caractère courant, voisin
 * du bas. C'est ce qui donne au doigt et à la souris un moyen de changer de lettre sans ajouter dix
 * boutons que les flèches devraient ensuite traverser pour rien. Une seule contrainte en découle,
 * mesurée à la recette : chaque tiers doit tenir le plancher de 30 px sous `pointer: coarse`, donc le
 * bouton fait au moins 90 px de haut.
 */

export interface CodeWheelCallbacks {
  onChange?: (code: string) => void;
  /** `Entrée` au clavier ou `A` à la manette, quand le focus est dans la roue. */
  onConfirm?: () => void;
}

export interface CodeWheel {
  readonly element: HTMLElement;
  code(): string;
  /** Le haut/bas de l'appelant. Rend `false` s'il n'a rien à consommer. */
  step(direction: "up" | "down"): boolean;
  /** Vrai quand le focus est posé dans la roue — l'appelant s'en sert pour savoir si haut/bas lui revient. */
  holdsFocus(): boolean;
  focusActiveSlot(): void;
  dispose(): void;
}

export function createCodeWheel(callbacks: CodeWheelCallbacks = {}): CodeWheel {
  let state = initialCodeWheelState();

  const element = document.createElement("div");
  element.className = "lb-wheel";
  element.dataset.testid = "code-wheel";

  // Un `AbortController` par composant, comme partout ailleurs dans le projet : `dispose()` coupe
  // tous les écouteurs d'un coup, sans avoir à en garder les références une par une.
  const listeners = new AbortController();

  const slots = Array.from({ length: ROOM_CODE_LENGTH }, (_, slot) => createSlot(slot));

  for (const slot of slots) {
    element.append(slot.button);
  }

  function createSlot(slot: number): { button: HTMLButtonElement; render: () => void } {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lb-slot";
    // Testid présent même si aucun test ne le vise encore : `renderPreservingFocus` ne restaure le
    // focus que par famille de `data-testid`, et la roue se re-rend à chaque frappe.
    button.dataset.testid = "code-slot";
    button.dataset.slot = String(slot);

    const previous = document.createElement("span");
    previous.className = "lb-slot-neighbour";
    previous.ariaHidden = "true";

    const current = document.createElement("span");
    current.className = "lb-slot-current";
    // Testid et non classe CSS : c'est par là que l'e2e relit le code saisi, et une classe est
    // couplée au style (banni par `.claude/rules/e2e.md`).
    current.dataset.testid = "code-slot-character";

    const next = document.createElement("span");
    next.className = "lb-slot-neighbour";
    next.ariaHidden = "true";

    button.append(previous, current, next);

    button.addEventListener(
      "focus",
      () => {
        applyState(setActiveSlot(state, slot));
      },
      { signal: listeners.signal },
    );

    button.addEventListener(
      "click",
      (event) => {
        // Un clic synthétisé par le clavier ou par la manette (`activateFocusedControl` fait
        // `active.click()`) porte `detail === 0` et des coordonnées nulles : le prendre pour une tape
        // le rangerait dans la zone du haut, et `Entrée` reculerait d'une lettre au lieu de valider.
        if (event.detail === 0) {
          return;
        }
        applyState(setActiveSlot(state, slot));
        const region = regionOf(button, event.clientY);
        if (region !== 0) {
          applyState(stepActiveSlot(state, region));
        }
      },
      { signal: listeners.signal },
    );

    button.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        applyState(setActiveSlot(state, slot));
        applyState(stepActiveSlot(state, event.deltaY > 0 ? 1 : -1));
      },
      { passive: false, signal: listeners.signal },
    );

    const render = (): void => {
      const neighbours = slotNeighbours(state, slot);
      previous.textContent = neighbours.previous;
      current.textContent = neighbours.current;
      next.textContent = neighbours.next;
      button.ariaLabel = `${slot + 1} / ${ROOM_CODE_LENGTH} : ${neighbours.current}`;
      if (slot === state.activeSlot) {
        button.dataset.state = "active";
      } else {
        delete button.dataset.state;
      }
    };

    return { button, render };
  }

  /**
   * Quel tiers du bouton a été tapé. Rend `-1` pour le voisin du haut, `1` pour celui du bas, `0`
   * pour le caractère courant — qui ne fait que prendre le focus.
   */
  function regionOf(button: HTMLButtonElement, clientY: number): -1 | 0 | 1 {
    const bounds = button.getBoundingClientRect();
    const offset = clientY - bounds.top;
    if (offset < bounds.height / 3) {
      return -1;
    }
    if (offset > (bounds.height * 2) / 3) {
      return 1;
    }
    return 0;
  }

  function applyState(next: CodeWheelState): void {
    const codeChanged = codeOf(next) !== codeOf(state);
    state = next;
    render();
    if (codeChanged) {
      callbacks.onChange?.(codeOf(state));
    }
  }

  function render(): void {
    for (const slot of slots) {
      slot.render();
    }
  }

  /**
   * 🔴 **Une touche consommée ici doit être ARRÊTÉE**, pas seulement `preventDefault()`.
   *
   * Trouvé en recette e2e, et c'était un vrai piège : `KeyS` est lié à « bas » et `KeyD` à
   * « droite » (les bindings AZERTY de `bindings-store.ts`, remappables). L'`InputSystem` écoute le
   * clavier sur `window` en phase de bouillonnement, donc sans `stopPropagation` chaque lettre
   * partait AUSSI comme un mouvement : taper `SNSD2` posait `SNSDA` — le `S` faisait défiler la
   * lettre voisine d'un cran, et le `D` sortait le focus de la roue, si bien que le dernier
   * caractère n'avait plus de destinataire.
   *
   * La roue est posée dans le DOM sous les boutons d'emplacement, donc son écouteur voit l'événement
   * avant `window` : l'arrêter ici suffit, sans toucher au code d'entrée partagé. Les **flèches**,
   * elles, ne sont pas consommées et continuent leur route jusqu'au layer — c'est ce qui laisse
   * gauche/droite changer d'emplacement et haut/bas défiler par le consommateur de l'écran.
   */
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      callbacks.onConfirm?.();
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      applyState(eraseBeforeActiveSlot(state));
      focusActiveSlot();
      return;
    }
    const typed = typeCharacter(state, event.key);
    if (typed === undefined) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    applyState(typed);
    focusActiveSlot();
  };

  element.addEventListener("keydown", onKeyDown, { signal: listeners.signal });

  /*
   * Coller un code (recette 2026-09-04). Un code arrive par messagerie, donc par le presse-papier :
   * le retaper alors qu'on vient de le copier est une corvée gratuite.
   *
   * On écoute l'événement `paste` plutôt que d'intercepter `Ctrl+V` au clavier : c'est lui qui porte
   * les données, et il couvre du même coup le clic droit → Coller et le menu de collage du téléphone,
   * qui ne passent par aucune touche. Il faut pour cela que la roue soit focalisable — ses
   * emplacements sont des `<button>`, donc c'est acquis.
   */
  element.addEventListener(
    "paste",
    (event) => {
      const pasted = event.clipboardData?.getData("text") ?? "";
      const filled = pasteCode(pasted);
      if (filled === undefined) {
        return;
      }
      event.preventDefault();
      applyState(filled);
      focusActiveSlot();
    },
    { signal: listeners.signal },
  );

  function focusActiveSlot(): void {
    slots[state.activeSlot]?.button.focus();
  }

  render();

  return {
    element,
    code: () => codeOf(state),
    step(direction) {
      if (!holdsFocus()) {
        return false;
      }
      applyState(stepActiveSlot(state, direction === "down" ? 1 : -1));
      return true;
    },
    holdsFocus,
    focusActiveSlot,
    dispose() {
      listeners.abort();
      element.remove();
    },
  };

  /**
   * Gauche/droite n'a rien à faire ici : les cinq emplacements sont des `<button>` voisins, donc le
   * changement d'emplacement **est** la navigation spatiale du projet — la même au clavier et à la
   * manette, `focusInDirection` s'en chargeant pour les deux.
   */
  function holdsFocus(): boolean {
    const active = document.activeElement;
    return active instanceof HTMLElement && element.contains(active);
  }
}
