import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@pokemon-tactic/network";

/**
 * La logique de la roue de caractères (plan 199, étape 4), sans DOM.
 *
 * Séparée de son affichage parce que le dépôt n'a pas de jsdom : ici se teste tout ce qui peut
 * casser — le défilement de l'alphabet, son bouclage, la saisie au clavier qui avance d'un
 * emplacement — et la couche DOM ne garde que le rendu, couvert en e2e.
 *
 * La roue est le **seul** widget de saisie du code, pour les quatre entrées : les flèches et les
 * lettres au clavier, les directions et `A` à la manette, la tape au doigt, le clic et la molette à
 * la souris. Un champ texte aurait été plus rapide au clavier, mais il n'est **pas saisissable à la
 * manette** (choix explicite du projet, `focus-navigation.ts`) : garder les deux aurait voulu dire
 * échanger un sous-arbre DOM selon la source active, donc perdre le focus à chaque bascule.
 */

export interface CodeWheelState {
  /** Un caractère par emplacement, toujours `ROOM_CODE_LENGTH` d'entre eux. */
  readonly characters: readonly string[];
  readonly activeSlot: number;
}

/** Les trois caractères visibles d'un emplacement : la roue montre ses voisins d'alphabet. */
export interface SlotNeighbours {
  readonly previous: string;
  readonly current: string;
  readonly next: string;
}

const FIRST_CHARACTER = ROOM_CODE_ALPHABET[0] ?? "A";

export function initialCodeWheelState(): CodeWheelState {
  return {
    characters: Array.from({ length: ROOM_CODE_LENGTH }, () => FIRST_CHARACTER),
    activeSlot: 0,
  };
}

export function codeOf(state: CodeWheelState): string {
  return state.characters.join("");
}

/**
 * Fait défiler l'alphabet sur l'emplacement actif. **Boucle** aux deux bouts : la roue n'a pas de
 * début ni de fin, sinon atteindre `9` depuis `A` demanderait de traverser les 31 autres dans un
 * seul sens.
 */
export function stepActiveSlot(state: CodeWheelState, delta: number): CodeWheelState {
  const current = state.characters[state.activeSlot];
  if (current === undefined) {
    return state;
  }
  const size = ROOM_CODE_ALPHABET.length;
  const nextIndex = (ROOM_CODE_ALPHABET.indexOf(current) + delta + size) % size;
  return replaceActiveCharacter(state, ROOM_CODE_ALPHABET[nextIndex] ?? current);
}

/**
 * Change d'emplacement. **Ne boucle pas** : les extrémités arrêtent le curseur, pour que la
 * navigation spatiale du clavier puisse sortir de la roue vers les boutons voisins — une roue qui
 * bouclerait retiendrait le focus prisonnier.
 */
export function moveActiveSlot(state: CodeWheelState, delta: number): CodeWheelState {
  return setActiveSlot(state, state.activeSlot + delta);
}

export function setActiveSlot(state: CodeWheelState, slot: number): CodeWheelState {
  const clamped = Math.min(Math.max(slot, 0), ROOM_CODE_LENGTH - 1);
  if (clamped === state.activeSlot) {
    return state;
  }
  return { ...state, activeSlot: clamped };
}

/**
 * Une lettre tapée au clavier. La pose sur l'emplacement actif puis **avance d'un cran**, pour qu'un
 * code se saisisse d'une traite comme dans n'importe quel champ.
 *
 * Rend `undefined` — et non l'état inchangé — quand le caractère n'est pas de l'alphabet : l'appelant
 * doit savoir qu'il n'a rien consommé, pour laisser la touche à qui la voudra.
 */
export function typeCharacter(
  state: CodeWheelState,
  character: string,
): CodeWheelState | undefined {
  const upper = character.toUpperCase();
  if (upper.length !== 1 || !ROOM_CODE_ALPHABET.includes(upper)) {
    return undefined;
  }
  const filled = replaceActiveCharacter(state, upper);
  return setActiveSlot(filled, filled.activeSlot + 1);
}

/**
 * Un code collé d'un coup. Ne prend pas d'état en entrée, et c'est le point : coller **remplace le
 * code entier**, ce n'est pas une insertion là où était le curseur.
 *
 * Tolérant à ce qu'un presse-papier contient réellement — espaces, tirets, minuscules, guillemets
 * autour, et un éventuel préfixe `pkmntac-` si quelqu'un a copié une adresse plutôt qu'un code. Ce
 * qui reste après nettoyage doit valoir exactement la longueur d'un code ; sinon on ne consomme rien
 * plutôt que de poser un code à moitié faux, qui serait refusé plus loin sans qu'on sache pourquoi.
 *
 * Demandé à la recette du 2026-09-04 : un code se reçoit par messagerie, donc il arrive au
 * presse-papier — le retaper à la main quand on vient de le copier est une corvée gratuite.
 */
export function pasteCode(pasted: string): CodeWheelState | undefined {
  const cleaned = [...pasted.toUpperCase().replace(/^.*PKMNTAC-/, "")].filter((character) =>
    ROOM_CODE_ALPHABET.includes(character),
  );
  if (cleaned.length !== ROOM_CODE_LENGTH) {
    return undefined;
  }
  return { characters: cleaned, activeSlot: ROOM_CODE_LENGTH - 1 };
}

/** Efface l'emplacement précédent et y revient — ce que fait une touche d'effacement arrière. */
export function eraseBeforeActiveSlot(state: CodeWheelState): CodeWheelState {
  const target = state.activeSlot === 0 ? 0 : state.activeSlot - 1;
  const moved = setActiveSlot(state, target);
  return replaceActiveCharacter(moved, FIRST_CHARACTER);
}

export function slotNeighbours(state: CodeWheelState, slot: number): SlotNeighbours {
  const current = state.characters[slot] ?? FIRST_CHARACTER;
  const size = ROOM_CODE_ALPHABET.length;
  const index = ROOM_CODE_ALPHABET.indexOf(current);
  return {
    previous: ROOM_CODE_ALPHABET[(index - 1 + size) % size] ?? current,
    current,
    next: ROOM_CODE_ALPHABET[(index + 1) % size] ?? current,
  };
}

function replaceActiveCharacter(state: CodeWheelState, character: string): CodeWheelState {
  const characters = [...state.characters];
  characters[state.activeSlot] = character;
  return { ...state, characters };
}
