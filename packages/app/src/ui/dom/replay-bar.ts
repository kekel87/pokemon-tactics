import { getLanguage, onLanguageChange, t } from "../../i18n";
import type { TranslationKey } from "../../i18n/types";
import { el } from "./screens/elements";

/**
 * Barre de lecture d'un replay (plan 242) : début, pas arrière, lecture/pause, pas avant, vitesse,
 * position, quitter.
 *
 * Que des `<button>` natifs, chacun avec son `data-testid` : le clavier, la manette et le doigt les
 * atteignent comme n'importe quel bouton du jeu, sans réimplémenter d'activation (règle multi-entrée).
 * La vitesse est un bouton qui fait défiler les crans plutôt qu'un `<select>`, que la manette ne
 * sait pas parcourir.
 */

interface ReplayBarModel {
  /** Nombre d'actions déjà jouées. */
  position: number;
  total: number;
  playing: boolean;
  /** Multiplicateur de vitesse en cours (1 = normal). */
  speed: number;
}

interface ReplayBarHandlers {
  onRestart: () => void;
  onStepBack: () => void;
  onTogglePlay: () => void;
  onStepForward: () => void;
  /** Cran suivant (`1`, clic) ou précédent (`-1`, clic droit) — en boucle dans les deux sens. */
  onCycleSpeed: (delta: 1 | -1) => void;
  onQuit: () => void;
}

export interface ReplayBar {
  /** Le nœud monté — le recul d'un replay vide le `screenLayer` de tout le reste, pas de lui. */
  readonly element: HTMLElement;
  update(model: ReplayBarModel): void;
  dispose(): void;
}

/** `×0,5` en français, `×0.5` en anglais : le séparateur décimal suit la langue du jeu. */
function speedLabel(speed: number): string {
  return `×${new Intl.NumberFormat(getLanguage()).format(speed)}`;
}

export function mountReplayBar(
  host: HTMLElement,
  handlers: ReplayBarHandlers,
  initial: ReplayBarModel,
): ReplayBar {
  const root = el("div", "rp-bar", "replay-bar");

  const control = (testId: string, glyph: string, action: () => void) => {
    const button = el("button", "tb-btn rp-btn", testId);
    button.type = "button";
    button.textContent = glyph;
    button.addEventListener("click", action);
    return button;
  };

  const restart = control("replay-restart", "⏮", handlers.onRestart);
  const stepBack = control("replay-step-back", "◀", handlers.onStepBack);
  const toggle = control("replay-toggle", "▶", handlers.onTogglePlay);
  const stepForward = control("replay-step-forward", "▶|", handlers.onStepForward);
  const speed = el("button", "tb-btn rp-btn rp-speed", "replay-speed");
  speed.type = "button";
  speed.addEventListener("click", () => handlers.onCycleSpeed(1));
  // Clic droit pour ralentir (retour de recette). Le doigt et la manette n'ont pas de clic droit :
  // la boucle les ramène aux crans lents par le clic seul.
  speed.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    handlers.onCycleSpeed(-1);
  });
  const position = el("span", "rp-position", "replay-position");
  position.setAttribute("aria-live", "polite");
  const quit = el("button", "tb-btn rp-btn rp-quit", "replay-quit");
  quit.type = "button";
  quit.addEventListener("click", handlers.onQuit);

  root.append(restart, stepBack, toggle, stepForward, speed, position, quit);
  host.append(root);

  const label = (button: HTMLElement, key: TranslationKey): void => {
    button.setAttribute("aria-label", t(key));
    button.title = t(key);
  };

  let current = initial;
  // TOUS les textes sont réécrits à chaque mise à jour, pas seulement ceux qui bougent : la langue se
  // change en plein combat (plan 221), et la barre doit suivre comme le reste du chrome.
  const update = (model: ReplayBarModel): void => {
    current = model;
    label(restart, "replay.bar.restart");
    label(stepBack, "replay.bar.stepBack");
    label(stepForward, "replay.bar.stepForward");
    label(toggle, model.playing ? "replay.bar.pause" : "replay.bar.play");
    toggle.textContent = model.playing ? "⏸" : "▶";
    toggle.dataset.state = model.playing ? "playing" : "paused";
    speed.textContent = speedLabel(model.speed);
    speed.title = t("replay.bar.speedHint");
    speed.setAttribute("aria-label", `${t("replay.bar.speed")} ${speedLabel(model.speed)}`);
    quit.textContent = t("replay.bar.quit");
    position.textContent = t("replay.bar.position", {
      current: model.position,
      total: model.total,
    });
    const atStart = model.position === 0;
    const atEnd = model.position >= model.total;
    /*
     * Un bouton focalisé qui devient inactif perd le focus vers `<body>` : au clavier, revenir au
     * début renverrait au haut de la page. Le focus passe alors sur Lecture, qui ne l'est jamais.
     */
    const focused = document.activeElement;
    if (
      (atStart && (focused === restart || focused === stepBack)) ||
      (atEnd && focused === stepForward)
    ) {
      toggle.focus();
    }
    stepBack.disabled = atStart;
    restart.disabled = atStart;
    stepForward.disabled = atEnd;
  };
  update(initial);
  const stopLanguageWatch = onLanguageChange(() => update(current));

  return {
    element: root,
    update,
    dispose: () => {
      stopLanguageWatch();
      root.remove();
    },
  };
}
