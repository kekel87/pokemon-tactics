import type { TeamSlot } from "@pokemon-tactic/core";
import { getPortraitUrl } from "../../team/team-builder-data";

/**
 * Rangée de portraits d'une équipe — partagée par la liste du sélecteur et par la carte de camp
 * (plan 188, retour humain 2026-08-25).
 *
 * Extraite de `TeamListItem` quand la carte de camp en a eu besoin : #832 avait remplacé la liste
 * permanente par une modale, et la carte ne montrait plus qu'un **nom**. On perdait la lecture
 * visuelle de l'équipe assignée, que la liste donnait auparavant en continu.
 *
 * Le token `--ts-portrait-size` est déclaré sur `.ts-portraits` (le conteneur), pas sur un écran :
 * ces portraits vivent maintenant dans deux arbres différents — l'écran, et un `<dialog>` monté sur
 * `<body>`. Un token posé sur l'écran n'atteindrait pas le second.
 */
export function createTeamPortraitsElement(
  slots: readonly TeamSlot[] | null,
  options: { padTo?: number } = {},
): HTMLElement {
  const container = document.createElement("span");
  container.className = "ts-portraits";

  // `padTo` aligne les rangées d'une LISTE (colonnes de portraits qui se superposent d'une ligne à
  // l'autre). Sur une carte de camp on ne rembourre pas : à 12 camps, six emplacements vides par
  // carte coûteraient de la hauteur pour ne rien dire.
  const count = Math.max(slots?.length ?? 0, options.padTo ?? 0);
  for (let index = 0; index < count; index++) {
    const slot = slots?.[index];
    const portrait = document.createElement("span");
    portrait.className = "ts-portrait";
    if (slot === undefined) {
      portrait.dataset.empty = "true";
    } else {
      portrait.style.backgroundImage = `url(${getPortraitUrl(slot.pokemonId)})`;
    }
    container.appendChild(portrait);
  }
  return container;
}

/**
 * Rangée de six silhouettes — l'équipe n'est pas encore tirée (ligne « 🎲 Aléatoire »).
 *
 * Six, comme le rembourrage des lignes d'équipe : dans une liste, les colonnes de portraits doivent se
 * superposer d'une ligne à l'autre.
 */
export function createPlaceholderPortraitsElement(): HTMLElement {
  const container = document.createElement("span");
  container.className = "ts-portraits";
  for (let index = 0; index < 6; index++) {
    const portrait = document.createElement("span");
    portrait.className = "ts-portrait";
    portrait.dataset.placeholder = "true";
    container.appendChild(portrait);
  }
  return container;
}
