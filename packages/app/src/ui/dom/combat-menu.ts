import { t } from "../../i18n";
import type { TranslationKey } from "../../i18n/types";
import { activateFocusedControl, focusInDirection } from "../../input/focus-navigation";
import { InputSource } from "../../input/input-source";
import { getInputSystem } from "../../input/input-system";
import { createControlsPanel } from "./panels/controls-panel";
import type { Panel } from "./panels/panel";
import { createSettingsPanel } from "./panels/settings-panel";
import { el, menuButton } from "./screens/elements";

/**
 * Menu de combat (plan 187) — Reprendre / Paramètres / Recommencer / Quitter.
 *
 * **Ce n'est pas une pause.** Le combat continue de tourner derrière : l'IA joue, les animations se
 * déroulent, et le futur chronomètre du multijoueur tournera. En ligne une pause est structurellement
 * impossible ; plutôt que d'écrire un mécanisme de suspension à retirer en Phase 7, il n'existe qu'un
 * seul comportement, validé dès le solo. Rien n'est donc à « reprendre » à la fermeture, et le nom ne
 * promet rien de faux.
 *
 * Il existe parce que l'écran de contrôles du plan 186 n'était atteignable que depuis le menu
 * principal : changer une touche en pleine partie demandait de quitter le combat, donc — avec la
 * sémantique d'abandon de « Retour au menu » — de le perdre.
 *
 * ## Comment il prend l'entrée
 *
 * En **empilant sa propre registration** sur la pile de l'`InputSystem` (plan 184), dont le sommet est
 * l'actif. Pendant qu'il est ouvert il est donc le seul consommateur, **sans qu'une ligne des
 * consommateurs du combat ait changé** et sans priorité à arbitrer. Conséquence voulue : ni curseur,
 * ni caméra, ni zoom pendant ce temps — le plateau est derrière la modale.
 *
 * Il ne réutilise pas `bindScreenInput` : celui-ci abandonne *Annuler* dès qu'un `dialog[open]`
 * existe (« une modale possède `Échap` ») — or ici la modale, c'est nous.
 *
 * ## Ce qu'il ne fait jamais
 *
 * **Annuler quoi que ce soit.** Une visée en cours, un sélecteur d'orientation ouvert, une cible
 * choisie : tout est retrouvé intact à la fermeture, parce qu'on empile sans rien démonter. C'est ce
 * qui distingue son ouverture d'`Échap`, qui lui remonte d'un cran dans le flux d'attaque.
 */
export interface CombatMenuOptions {
  /** `screenLayer` du GameStage : la modale meurt avec l'écran de combat. */
  readonly host: HTMLElement;
  /**
   * ABANDONNER : rendre la main au menu principal **et** détruire la partie en cours (la sauvegarde
   * de reprise part avec elle). Derrière une confirmation.
   */
  readonly onAbandon: () => void;
  /** Abandonner et relancer le même combat depuis le placement (le `onReplay` du chrome). */
  readonly onRestart: () => void;
  /**
   * QUITTER : rendre la main au menu principal **en gardant la partie reprenable**.
   *
   * Optionnel, et c'est le point : l'entrée n'est rendue que là où une sauvegarde existe vraiment.
   * Le studio sandbox n'en a pas — l'y afficher promettrait une reprise qui n'aurait rien à reprendre.
   *
   * Ça referme au passage une incohérence relevée par la revue design : jusqu'ici **fermer l'onglet**
   * préservait la partie alors que le menu ne le proposait nulle part. Le chemin accidentel devient
   * un choix explicite. Pas de confirmation : rien n'est perdu, et une confirmation sur une action
   * réversible use le réflexe jusqu'à ce qu'on valide sans lire — y compris devant l'abandon.
   */
  readonly onQuitKeepingSave?: () => void;
}

export interface CombatMenu {
  /**
   * Ouvre le menu. Renvoie false quand l'ouverture est refusée — déjà ouvert, ou un autre `dialog`
   * est à l'écran (le dialogue de victoire, qui porte déjà ses propres sorties).
   */
  open(): boolean;
  close(): void;
  readonly isOpen: boolean;
  dispose(): void;
}

/** Les niveaux, du plus superficiel au plus profond. `Annuler` en dépile un. */
type Level =
  | { readonly kind: "root" }
  | { readonly kind: "settings" }
  | { readonly kind: "controls" }
  | { readonly kind: "confirm"; readonly action: "abandon" | "restart" };

export function createCombatMenu(options: CombatMenuOptions): CombatMenu {
  const { host, onAbandon, onRestart, onQuitKeepingSave } = options;

  let dialog: HTMLDialogElement | null = null;
  let body: HTMLElement | null = null;
  let panel: Panel | null = null;
  let unregisterInput: (() => void) | null = null;
  /** Pile de niveaux : `Annuler` en dépile un, et referme quand il ne reste que la racine. */
  let levels: Level[] = [];
  /** Ce qui avait le focus à l'ouverture — on le lui rend à la fermeture. */
  let openedFrom: HTMLElement | null = null;

  const disposePanel = (): void => {
    panel?.dispose();
    panel = null;
  };

  const renderRoot = (): HTMLElement => {
    const list = el("div", "cm-buttons");
    const entry = (
      labelKey: TranslationKey,
      testid: string,
      onClick: () => void,
    ): HTMLButtonElement => {
      const button = menuButton(t(labelKey), onClick);
      button.dataset.testid = testid;
      return button;
    };
    // Ordre voulu par l'humain (2026-08-25) : Reprendre, Paramètres, Recommencer, Abandonner, Quitter.
    list.append(
      // « Reprendre » d'abord : c'est l'action par défaut, et c'est la SEULE sortie d'un joueur au
      // doigt, qui n'a ni `Échap` ni B.
      entry("combatMenu.resume", "combat-menu-resume", close),
      entry("combatMenu.settings", "combat-menu-settings", () => push({ kind: "settings" })),
      // Les deux actions qui détruisent la partie, chacune derrière une confirmation.
      entry("combatMenu.restart", "combat-menu-restart", () =>
        push({ kind: "confirm", action: "restart" }),
      ),
      entry("combatMenu.abandon", "combat-menu-abandon", () =>
        push({ kind: "confirm", action: "abandon" }),
      ),
    );
    // La sortie sûre : sans confirmation, et seulement là où il y a une sauvegarde à garder.
    if (onQuitKeepingSave) {
      list.append(
        entry("combatMenu.quit", "combat-menu-quit", () => {
          close();
          onQuitKeepingSave();
        }),
      );
    }
    return list;
  };

  const renderConfirm = (action: "abandon" | "restart"): HTMLElement => {
    const wrapper = el("div", "cm-confirm");
    const question = el("p", "cm-confirm-text");
    // Un libellé par action (plan 187 décision 17) : « la partie sera perdue » est vrai des deux mais
    // imprécis pour Recommencer — même carte, mêmes équipes, c'est la TENTATIVE qui saute.
    question.textContent = t(
      action === "abandon" ? "combatMenu.confirmAbandon" : "combatMenu.confirmRestart",
    );
    const confirm = menuButton(t("combatMenu.confirm"), () => {
      close();
      if (action === "abandon") {
        onAbandon();
      } else {
        onRestart();
      }
    });
    confirm.dataset.testid = "combat-menu-confirm";
    const cancel = menuButton(t("combatMenu.cancel"), () => pop());
    cancel.dataset.testid = "combat-menu-confirm-cancel";
    const actions = el("div", "cm-confirm-actions");
    // « Annuler » en premier : le choix sûr se présente avant le choix irréversible.
    actions.append(cancel, confirm);
    wrapper.append(question, actions);
    return wrapper;
  };

  // Exhaustif sans `default` : un cinquième niveau ne pourra pas hériter du titre en silence.
  const titleFor = (level: Level): string => {
    switch (level.kind) {
      case "settings":
        return t("settings.title");
      case "controls":
        return t("controls.title");
      case "root":
      case "confirm":
        return t("combatMenu.title");
    }
  };

  const render = (): void => {
    const level = levels.at(-1);
    if (!dialog || !body || !level) {
      return;
    }
    disposePanel();
    let content: HTMLElement;
    switch (level.kind) {
      case "root":
        content = renderRoot();
        break;
      case "settings":
        panel = createSettingsPanel({
          onBack: () => pop(),
          onOpenControls: () => push({ kind: "controls" }),
          embedded: true,
        });
        content = panel.element;
        break;
      case "controls":
        panel = createControlsPanel({ onBack: () => pop(), embedded: true });
        content = panel.element;
        break;
      case "confirm":
        content = renderConfirm(level.action);
        break;
    }
    // Les panneaux portent déjà leur propre titre : en ajouter un second le doublerait — on ne le
    // construit donc que pour les deux niveaux qui en ont besoin.
    if (level.kind === "root" || level.kind === "confirm") {
      const title = el("h2", "cm-title");
      title.textContent = titleFor(level);
      body.replaceChildren(title, content);
    } else {
      body.replaceChildren(content);
    }
    focusFirst();
  };

  /**
   * Le focus entre dans la modale à chaque changement de niveau, mais SEULEMENT au clavier et à la
   * manette : un anneau de focus qui apparaît sous une souris immobile se lit comme un bug (plan 184).
   */
  const focusFirst = (): void => {
    if (getInputSystem()?.tracker.isFocusDriven() !== true) {
      return;
    }
    // `focusableControls()` privilégie déjà le `dialog[open]` : la navigation est piégée dedans.
    focusInDirection("down");
  };

  const push = (level: Level): void => {
    levels.push(level);
    render();
  };

  const pop = (): void => {
    if (levels.length <= 1) {
      close();
      return;
    }
    levels.pop();
    render();
  };

  function close(): void {
    disposePanel();
    unregisterInput?.();
    unregisterInput = null;
    levels = [];
    body = null;
    const closing = dialog;
    dialog = null;
    if (closing) {
      // `close()` déclenche l'événement `close`, pas `cancel` : rien à neutraliser ici.
      closing.close();
      closing.remove();
    }
    // Le focus revient à ce qui a ouvert la modale (règle projet `html.md`) : sans ça, il retombe sur
    // `<body>` et la navigation clavier / manette repart de zéro au lieu de reprendre où elle était.
    // `isConnected` parce que « Recommencer » démonte tout l'écran — il n'y a alors plus rien à viser.
    const trigger = openedFrom;
    openedFrom = null;
    if (trigger?.isConnected === true) {
      trigger.focus();
    }
  }

  const registerInput = (): void => {
    const system = getInputSystem();
    if (!system) {
      return;
    }
    unregisterInput = system.register({
      context: () => "screen",
      menu: {
        focusMove: (direction) => focusInDirection(direction),
        confirm: () => {
          // À la manette il faut activer soi-même : un appui de pad n'est pas un événement clavier,
          // donc aucune activation native ne suit. Au clavier c'est le navigateur qui active le
          // bouton focalisé, et réclamer la touche ici l'en empêcherait.
          if (system.tracker.current() !== InputSource.Gamepad) {
            return false;
          }
          return activateFocusedControl();
        },
        cancel: () => {
          // Une capture de touche en cours n'arrive jamais ici : l'`InputSystem` la sert avant le
          // routeur (voir `panels/panel.ts`), donc `Échap` y renonce à la capture sans nous consulter.
          pop();
          return true;
        },
      },
    });
  };

  return {
    open() {
      // Un dialogue déjà ouvert garde la main. En pratique c'est celui de la victoire, qui porte déjà
      // ses propres sorties (Rejouer / Retour au menu) — deux modales empilées n'auraient aucun sens,
      // et `focusableControls()` ne saurait laquelle servir.
      if (dialog !== null || document.querySelector("dialog[open]") !== null) {
        return false;
      }
      openedFrom = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const created = document.createElement("dialog");
      created.className = "cm-dialog";
      created.dataset.testid = "combat-menu";
      // `Échap` natif NEUTRALISÉ (plan 187 décision 10). Sans ça, une frappe d'`Échap` fermerait la
      // modale ET produirait l'action logique `Cancel` — laquelle, n'ayant plus rien à annuler,
      // rouvrirait aussitôt le menu. Une seule porte : l'action logique.
      created.addEventListener("cancel", (event) => event.preventDefault());
      body = el("div", "cm-body");
      created.append(body);
      host.append(created);
      dialog = created;
      created.showModal();
      levels = [{ kind: "root" }];
      registerInput();
      render();
      return true;
    },
    close,
    get isOpen() {
      return dialog !== null;
    },
    dispose() {
      close();
    },
  };
}
