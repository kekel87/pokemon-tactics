import type { TimelineEntryView, TimelineView } from "@pokemon-tactic/view-core";
import type { UiDomConfig } from "./config.js";
import { el, scrollByStep } from "./dom-helpers.js";

/**
 * TurnTimeline — DOM/CSS turn timeline (plan 121 step
 * 4b-3). Vertical strip on the left: the active Pokémon pinned on top, then the
 * upcoming order (predicted Charge-Time sequence, or the round order in
 * Round-Robin with a next-round separator). Scrolls natively (overflow). Pure
 * view: takes a `TimelineView` and renders it.
 *
 * Deferred to 4b-5: the move-CT preview highlight/scroll shown while picking a
 * target (`scrollToHighlight`), which depends on the selected move.
 */

export interface TurnTimeline {
  readonly element: HTMLElement;
  /**
   * Emplacement des contrôles caméra, au MILIEU de la colonne latérale (plan 189).
   *
   * Cette colonne est alignée sur la hauteur de la liste et porte `Page↑` en haut, cet emplacement au
   * milieu, `Page↓` en bas — les trois se lisent comme un seul bloc, à côté de ce qu'ils pilotent. La
   * légende y descend au passage : ancrée à la boussole, elle se superposait à elle.
   */
  readonly legendSlot: HTMLElement;
  update(view: TimelineView): void;
  /** Step the predicted-order list (keyboard / gamepad, plan 184 — it only scrolled by wheel). */
  scrollByStep(delta: 1 | -1): void;
  destroy(): void;
}

function entryElement(
  entry: TimelineEntryView,
  showCtBars: boolean,
  config: UiDomConfig,
): HTMLElement {
  const node = el("li", "tt-entry", "timeline-entry");
  node.dataset.team = String(entry.team);
  if (entry.isActive) {
    node.dataset.active = "true";
  }
  if (entry.isSelf) {
    // Move-cost preview: highlight where the deciding mon slots back in after acting.
    node.dataset.self = "true";
  }
  if (entry.dimmed) {
    node.dataset.dimmed = "true";
  }

  /*
   * La barre de CT tient sa place même sans jauge à montrer — mais **seulement dans la liste**
   * (retours humains 2026-08-27, deux passes).
   *
   * Le défaut : la barre n'était ajoutée que lorsqu'il y avait quelque chose à peindre, donc les
   * portraits perdaient ses 4 px plus les 2 px d'écart et glissaient vers la gauche. Deux causes,
   * qu'il fallait couvrir toutes les deux : le **ratio** d'une entrée qui tombe à `null` (le Pokemon
   * qui joue), et le **drapeau global** `showCtBars` qui passe à faux — celui-là vide la colonne
   * entière d'un coup, et c'est ce que montraient les captures du 2026-08-27. La place est donc
   * réservée dans tous les cas, indépendamment de l'un comme de l'autre.
   *
   * ⚠️ **La case active est exclue**, et c'est une demande explicite : son portrait reste collé au
   * bord de la colonne. Elle vit dans son propre conteneur, au-dessus de la liste — lui réserver une
   * barre l'avait décalée de 6 px, ce qui n'était pas le défaut à corriger.
   *
   * `visibility: hidden` plutôt que rien : la place est tenue, aucune jauge vide n'est peinte — une
   * barre à zéro se lirait comme une information, alors qu'il n'y en a pas.
   */
  if (!entry.isActive) {
    const bar = el("div", "tt-ctbar");
    // Peinte seulement quand il y a vraiment une jauge : ni en ordre par tour (`showCtBars` faux pour
    // toute la liste), ni pour un Pokemon dont le CT vient d'être consommé.
    if (showCtBars && entry.ctRatio !== null) {
      const fill = el("div", "tt-ctfill");
      // Runtime ratio → CSS var (no static-CSS equivalent); height derives from it.
      fill.style.setProperty("--tt-ct", String(entry.ctRatio));
      bar.append(fill);
    } else {
      bar.dataset.empty = "true";
    }
    node.append(bar);
  }

  const portrait = el("img", "tt-portrait", "timeline-portrait");
  portrait.alt = "";
  portrait.loading = "lazy";
  portrait.decoding = "async";
  // Species id as a stable data attribute: portraits are now cropped data URLs from the
  // bundle sheet (plan 135), so the src no longer carries the id. Tests + any consumer that
  // needs to identify a timeline slot key off this, not the URL.
  portrait.dataset.pokemonId = entry.definitionId;
  portrait.src = config.getPortraitUrl(entry.definitionId);
  node.append(portrait);

  return node;
}

/**
 * Capuchons de défilement, construits par l'hôte (plan 189) — `ui-dom` ne lit pas les bindings.
 *
 * Un à chaque **extrémité verticale de la liste** (retour humain 2026-08-26) : c'est là que le
 * défilement se produit, et la direction du capuchon désigne alors le bord vers lequel il emmène.
 * Regroupés sous la légende de la boussole, ils disaient quelle touche presser sans dire de quoi ils
 * parlaient.
 */
export interface TurnTimelineKeyHints {
  readonly scrollUp?: HTMLElement | null;
  readonly scrollDown?: HTMLElement | null;
}

export function createTurnTimeline(
  config: UiDomConfig,
  keyHints?: TurnTimelineKeyHints,
): TurnTimeline {
  const root = el("div", "tt-timeline", "timeline");
  const activeSlot = el("div", "tt-active");
  // Rien à montrer avant le premier `update` — mais la colonne latérale, elle, existe déjà.
  activeSlot.hidden = true;
  const list = el("ol", "tt-list");
  list.hidden = true;
  /*
   * Ils encadrent la LISTE, pas le composant : le slot actif reste le premier enfant, parce que
   * `chrome-insets` mesure sa vignette pour y accrocher la boussole ET la légende — un élément inséré
   * avant lui déplacerait les deux.
   *
   * Affichés en permanence (décision 7) : la liste déborde toujours, 4K comprise.
   */
  /*
   * Colonne latérale, en grille avec la liste (voir le CSS) : c'est la grille qui l'aligne sur la
   * HAUTEUR de `.tt-list`, sans mesurer quoi que ce soit en JS. `Page↑` en haut, la légende dessous
   * avec un écart, `Page↓` poussé en bas.
   */
  const sideColumn = el("div", "tt-side");
  if (keyHints?.scrollUp) {
    sideColumn.append(keyHints.scrollUp);
  }
  const legendSlot = el("div", "tt-side-legend");
  sideColumn.append(legendSlot);
  if (keyHints?.scrollDown) {
    sideColumn.append(keyHints.scrollDown);
  }
  root.append(activeSlot, list, sideColumn);

  return {
    element: root,
    legendSlot,
    update: (view: TimelineView) => {
      root.dataset.ct = String(view.showCtBars);
      activeSlot.replaceChildren();
      list.replaceChildren();

      /*
       * On masque le CONTENU, pas la racine (signalé en revue de code, 2026-08-26).
       *
       * Depuis le plan 189, la colonne latérale porte les contrôles caméra — qui n'ont rien à voir
       * avec l'ordre de jeu et ne doivent pas s'éteindre avec lui. `root.hidden` les emportait à
       * chaque instant où la liste est vide, à commencer par celui d'avant le premier `update`.
       */
      const empty = view.entries.length === 0;
      activeSlot.hidden = empty;
      list.hidden = empty;
      if (empty) {
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const entry of view.entries) {
        if (entry.isActive) {
          activeSlot.append(entryElement(entry, view.showCtBars, config));
        } else {
          fragment.append(entryElement(entry, view.showCtBars, config));
        }
      }
      list.append(fragment);
    },
    scrollByStep: (delta) => scrollByStep(list, delta),
    destroy: () => root.remove(),
  };
}
