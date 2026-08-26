import { LogicalAction } from "./logical-action.js";

/**
 * Maintien de touche au clavier (plan 189).
 *
 * Le clavier de l'app est en `keydown` sans répétition (plan 184) : un appui produit UNE action. Ça
 * convient à tout le jeu sauf au panoramique caméra, qui est la seule action continue
 * (`logical-action.ts`) — une touche qu'on lui assignait ne faisait donc rien, et c'est la raison pour
 * laquelle il n'existait qu'au stick droit et au glissé du doigt (décisions #807, #811).
 *
 * Ce module est le miroir clavier de ce que `gamepad-source.ts` fait déjà : une boucle
 * `requestAnimationFrame` qui réémet l'action tant que l'entrée est poussée. Il ne possède QUE l'état
 * et la boucle — `input-system.ts` reste le propriétaire des écouteurs, parce que le plan 184 a réduit
 * l'app à un seul `keydown` et que ce plan n'en ajoute pas un second.
 */

/**
 * Les actions émises en continu. C'est une propriété de l'ACTION, pas du binding : quelle que soit la
 * touche que le joueur y assigne, un panoramique se tient.
 */
const CONTINUOUS_ACTIONS: readonly LogicalAction[] = [
  LogicalAction.PanCameraUp,
  LogicalAction.PanCameraDown,
  LogicalAction.PanCameraLeft,
  LogicalAction.PanCameraRight,
];

/** Cette action se tient-elle, plutôt que de se déclencher ? */
export function isContinuousAction(action: LogicalAction): boolean {
  return CONTINUOUS_ACTIONS.includes(action);
}

export interface KeyboardHoldSource {
  /**
   * Prendre en charge un appui. Renvoie false quand l'action n'est pas continue — l'appelant la route
   * alors normalement, comme n'importe quelle autre touche.
   */
  press(code: string, action: LogicalAction): boolean;
  /** Relâchement d'une touche. Indexé par `code` SEUL : voir la note ci-dessous. */
  release(code: string): void;
  /** Tout relâcher — la fenêtre a perdu le focus ou l'onglet est passé en arrière-plan. */
  releaseAll(): void;
  dispose(): void;
}

/** Injectables pour la suite unitaire, qui tourne en environnement node (aucun `rAF` global). */
export interface KeyboardHoldSourceOptions {
  scheduleFrame?: (callback: () => void) => number;
  cancelFrame?: (handle: number) => void;
}

export function createKeyboardHoldSource(
  emit: (action: LogicalAction) => void,
  options: KeyboardHoldSourceOptions = {},
): KeyboardHoldSource {
  const scheduleFrame =
    options.scheduleFrame ?? ((callback: () => void) => requestAnimationFrame(callback));
  const cancelFrame = options.cancelFrame ?? ((handle: number) => cancelAnimationFrame(handle));

  /*
   * `code` → action, et non un simple jeu de codes : le relâchement doit savoir CE QU'IL relâche.
   *
   * L'indexation par `code` seul est un choix, pas un raccourci. Un binding porte un état de Maj
   * (`keyLookupKey`), mais rien n'oblige le joueur à relâcher les deux touches dans l'ordre : sur
   * `Maj+↑` tenu, lâcher Maj d'abord fait arriver le `keyup` de la flèche avec `shiftKey: false`. Une
   * clé qui embarquerait Maj ne retrouverait pas son entrée, et la touche resterait collée.
   */
  const held = new Map<string, LogicalAction>();
  let frame: number | null = null;

  const tick = (): void => {
    if (held.size === 0) {
      frame = null;
      return;
    }
    for (const action of held.values()) {
      emit(action);
    }
    // Replanifiée à chaque tour plutôt qu'une boucle qui tourne en permanence : rien ne consomme de
    // frame quand aucune touche n'est tenue.
    frame = scheduleFrame(tick);
  };

  const stop = (): void => {
    if (frame !== null) {
      cancelFrame(frame);
      frame = null;
    }
  };

  return {
    press(code, action) {
      if (!isContinuousAction(action)) {
        return false;
      }
      // La répétition automatique de l'OS rappelle `keydown` sur la même touche : la carte l'absorbe.
      held.set(code, action);
      if (frame === null) {
        frame = scheduleFrame(tick);
      }
      return true;
    },
    release(code) {
      held.delete(code);
      if (held.size === 0) {
        stop();
      }
    },
    releaseAll() {
      held.clear();
      stop();
    },
    dispose() {
      held.clear();
      stop();
    },
  };
}
