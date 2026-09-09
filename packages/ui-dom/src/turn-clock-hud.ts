import type { TurnClockView } from "@pokemon-tactic/view-core";
import { el } from "./dom-helpers.js";

/**
 * TurnClockHud — le compte à rebours du tour (plan 202, Lot B3).
 *
 * 🔴 **Il n'a pas de cadre à lui** (retour humain 2026-09-09). Ses deux morceaux sont posés DANS la
 * bannière de tour : le temps sur la même ligne que le camp qui joue, la barre juste en dessous. Un
 * encadré séparé empilait jusqu'à cinq boîtes en haut de l'écran dès qu'un climat était actif, et
 * c'est la pile — pas le compteur — qui devenait illisible.
 *
 * Vue pure : elle prend un `TurnClockView` (ou `null` pour se cacher) et le rend. Elle ne décide
 * rien — l'orchestrateur tient l'échéance, elle n'affiche que le reste.
 *
 * Caché par défaut, et il le reste sur toute partie hors ligne : le chrono n'existe qu'en réseau
 * (décision #946). `null` n'est pas un cas d'erreur ici, c'est le cas courant.
 */

/** Sous ce reste, le compteur passe en alerte. Assez tôt pour réagir, assez tard pour ne pas crier. */
const URGENT_BELOW_MS = 10_000;

export interface TurnClockHud {
  /** Le temps restant, à poser sur la ligne du camp qui joue. */
  readonly value: HTMLElement;
  /** La barre qui se vide, à poser sous cette ligne. */
  readonly bar: HTMLElement;
  update(view: TurnClockView | null): void;
  destroy(): void;
}

function formatRemaining(remainingMs: number): string {
  // Arrondi au PLAFOND : afficher « 0 » pendant presque une seconde alors que le tour court encore
  // ferait mentir le compteur au moment précis où on le regarde le plus.
  const totalSeconds = Math.ceil(remainingMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function createTurnClockHud(): TurnClockHud {
  const value = el("span", "tc-value", "turn-clock-value");
  value.hidden = true;
  // Le compteur descend tout seul : un lecteur d'écran qui l'annoncerait à chaque battement
  // couvrirait tout le reste. Il est donc décoratif, et la bannière de tour porte le sens.
  value.setAttribute("aria-hidden", "true");

  // `turn-clock` vit sur la BARRE : c'est le corps visible du compteur, et le seul des deux morceaux
  // qui soit un élément à lui. Le temps, lui, partage sa ligne avec le camp qui joue.
  const bar = el("div", "tc-bar", "turn-clock");
  bar.hidden = true;
  bar.setAttribute("aria-hidden", "true");
  const fill = el("div", "tc-fill");
  bar.append(fill);

  return {
    value,
    bar,
    update: (view: TurnClockView | null) => {
      if (!view) {
        value.hidden = true;
        bar.hidden = true;
        return;
      }
      value.textContent = formatRemaining(view.remainingMs);
      const ratio = view.durationMs > 0 ? view.remainingMs / view.durationMs : 0;
      fill.style.inlineSize = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
      /*
       * L'alerte porte sur la COULEUR et rien d'autre — plus de grossissement du chiffre.
       *
       * Le temps partage désormais sa ligne avec le nom du camp : le faire grandir sous 10 s
       * décalerait ce nom à chaque seconde, sur une ligne centrée. La teinte gagne au contraire en
       * force, puisqu'elle emporte aussi la barre et le liseré du cadre.
       */
      const urgent = view.remainingMs <= URGENT_BELOW_MS;
      value.classList.toggle("tc-urgent", urgent);
      bar.classList.toggle("tc-urgent", urgent);
      // `owner` distingue MON tour du tour d'en face : le même compteur ne se lit pas pareil selon
      // qu'il me menace ou qu'il me renseigne sur l'attente.
      value.classList.toggle("tc-mine", view.owner === "you");
      bar.classList.toggle("tc-mine", view.owner === "you");
      value.hidden = false;
      bar.hidden = false;
    },
    destroy: () => {
      value.remove();
      bar.remove();
    },
  };
}
