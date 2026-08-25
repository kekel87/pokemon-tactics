/*
 * Bouton d'ouverture du menu de combat (plan 187).
 *
 * Il existe pour une raison d'appareil : un téléphone n'a ni `Échap` ni `Start`. Sans lui, le menu —
 * et donc les réglages, et donc l'écran de contrôles — serait joignable au clavier et à la manette
 * mais pas au doigt, sur la plateforme où quitter une partie est justement le plus utile.
 *
 * Vit dans `.bl-log-row`, **entre** le plein écran et le journal (retour humain 2026-08-25) : la
 * rangée haut-droite existe déjà et rien n'y flotte de plus, ce qui compte dans un paysage de
 * téléphone déjà à l'étroit.
 *
 * Contrairement au bouton de plein écran, il reste visible **en permanence**, plein écran compris :
 * lui a toujours quelque chose à offrir.
 *
 * Engine- et platform-agnostique comme son voisin : l'appelant injecte tout, ce fichier n'importe
 * jamais `packages/app`.
 */

import { el } from "./dom-helpers.js";

export interface CombatMenuButtonOptions {
  /** Accessible name — the control is icon-only. */
  readonly label: string;
  /** Ouvre le menu. Renvoie false quand l'ouverture a été refusée (déjà ouvert, victoire à l'écran). */
  readonly onOpen: () => boolean;
}

export interface CombatMenuButton {
  readonly element: HTMLButtonElement;
  /**
   * Griser le bouton pendant un verrou d'animation (`locked`).
   *
   * Seul le tactile a besoin de ça (retour de revue design) : une touche inerte ne se remarque pas,
   * un bouton qui n'a AUCUN retour se fait taper trois fois de suite et se lit comme un bug.
   */
  setEnabled(enabled: boolean): void;
}

export function createCombatMenuButton(options: CombatMenuButtonOptions): CombatMenuButton {
  const button = el("button", "cmb-btn", "combat-menu-button");
  button.type = "button";
  button.setAttribute("aria-label", options.label);
  button.title = options.label;

  const glyph = el("span", "cmb-glyph");
  // Le burger, glyphe conventionnel de « menu ». Il servait au repli du journal, qui est un PANNEAU DE
  // TEXTE et prend `▤` — et qui, lui, est étiqueté par le titre « Journal » juste à côté, alors que ce
  // bouton-ci est icône seule : c'est donc lui qui a besoin du glyphe le moins ambigu.
  // Glyphe texte comme `⛶` : aucun asset, et ils partiront ensemble au futur pack d'icônes (plan 177).
  glyph.textContent = "☰";
  glyph.setAttribute("aria-hidden", "true");
  button.append(glyph);

  button.addEventListener("click", () => {
    options.onOpen();
  });

  return {
    element: button,
    setEnabled: (enabled) => {
      button.disabled = !enabled;
    },
  };
}
