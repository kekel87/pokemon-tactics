/**
 * Doubles de contrôles focalisables, pour la table de vérité de `applyToControl`.
 *
 * ## Pourquoi des doubles et pas de vrais éléments
 *
 * La suite unitaire tourne en environnement **node**, sans DOM : `document.createElement` n'existe
 * pas, et un `instanceof HTMLInputElement` y **lève** au lieu de renvoyer `false`. C'est précisément
 * pour ça que `applyToControl` est duck-typé (même motif que `isClaimedByFocusedControl`), et donc
 * pour ça que des objets suffisent à l'éprouver.
 *
 * ## Ce que la table vérifie
 *
 * `applyToControl` est le pendant MANETTE de `isClaimedByFocusedControl`. Au clavier, la couche
 * d'entrée se retire et le navigateur règle le curseur ou change l'option ; au pad il n'y a aucun
 * événement clavier derrière, donc se retirer ne fait *rien*. Les cas qui comptent : l'axe revendiqué
 * par chaque contrôle, la sortie possible sur l'autre axe, le comportement en butée, et le fait qu'un
 * champ texte ne revendique **rien** au pad (il ne peut pas taper).
 */

interface EmittedEvent {
  type: string;
}

export interface SliderDouble {
  tagName: string;
  type: string;
  disabled: boolean;
  value: string;
  events: EmittedEvent[];
  stepUp(): void;
  stepDown(): void;
  dispatchEvent(event: EmittedEvent): void;
}

export interface SelectDouble {
  tagName: string;
  disabled: boolean;
  selectedIndex: number;
  options: { length: number };
  events: EmittedEvent[];
  dispatchEvent(event: EmittedEvent): void;
}

export function sliderDouble(
  value: number,
  { min = 0, max = 10, disabled = false } = {},
): SliderDouble {
  const control: SliderDouble = {
    tagName: "INPUT",
    type: "range",
    disabled,
    value: String(value),
    events: [],
    stepUp() {
      control.value = String(Math.min(max, Number(control.value) + 1));
    },
    stepDown() {
      control.value = String(Math.max(min, Number(control.value) - 1));
    },
    dispatchEvent(event) {
      control.events.push(event);
    },
  };
  return control;
}

export function selectDouble(
  selectedIndex: number,
  optionCount = 3,
  disabled = false,
): SelectDouble {
  const control: SelectDouble = {
    tagName: "SELECT",
    disabled,
    selectedIndex,
    options: { length: optionCount },
    events: [],
    dispatchEvent(event) {
      control.events.push(event);
    },
  };
  return control;
}
