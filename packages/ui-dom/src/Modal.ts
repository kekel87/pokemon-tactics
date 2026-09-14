/**
 * Le démontage de chaque modale vivante, adressé par son `<dialog>`.
 *
 * Il existe pour les appelants qui tiennent un `HTMLDialogElement` sans connaître la {@link Modal}
 * qui l'a bâti — la couche d'entrée referme « le dialogue du dessus », qu'elle trouve en
 * interrogeant le document. {@link closeModalDialog} leur rend le démontage SYNCHRONE que
 * {@link Modal.close} garantit ; `dialog.close()` seul le leur ferait manquer.
 *
 * Une `WeakMap` pour n'avoir rien à désinscrire : la modale démontée, plus personne ne tient son
 * `<dialog>` et l'entrée s'en va avec lui.
 */
const MODAL_TEARDOWNS = new WeakMap<HTMLDialogElement, () => void>();

/**
 * Referme un `<dialog>` de modale en garantissant son démontage IMMÉDIAT.
 *
 * À employer partout où l'on referme un dialogue qu'on n'a pas construit soi-même. Sur un `<dialog>`
 * qui n'appartient à aucune {@link Modal} — un dialogue bâti à la main —, elle se rabat sur
 * `close()` et se comporte donc comme avant.
 */
export function closeModalDialog(dialog: HTMLDialogElement): void {
  if (dialog.open) {
    dialog.close();
  }
  MODAL_TEARDOWNS.get(dialog)?.();
}

export interface ModalOptions {
  title: string;
  size?: "default" | "picker";
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  /** Localised aria-label for the close button (host-injected, plan 125 Phase 4). Defaults to "Close". */
  closeAriaLabel?: string;
}

export class Modal {
  private readonly dialog: HTMLDialogElement;
  private readonly body: HTMLDivElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly previousFocus: HTMLElement | null;
  private readonly onClose: (() => void) | undefined;
  /** Le démontage n'a lieu QU'UNE FOIS, quel que soit le chemin qui referme la modale. */
  private isTornDown = false;

  constructor(options: ModalOptions) {
    this.onClose = options.onClose;
    this.previousFocus = document.activeElement as HTMLElement | null;

    this.dialog = document.createElement("dialog");
    this.dialog.className = "tb-dialog";
    if (options.size !== undefined && options.size !== "default") {
      this.dialog.dataset.size = options.size;
    }

    const header = document.createElement("div");
    header.className = "tb-modal-header";
    this.titleEl = document.createElement("h2");
    this.titleEl.className = "tb-modal-title";
    this.titleEl.textContent = options.title;
    header.appendChild(this.titleEl);
    const closeBtn = document.createElement("button");
    closeBtn.className = "tb-modal-close";
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", options.closeAriaLabel ?? "Close");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);
    this.dialog.appendChild(header);

    this.body = document.createElement("div");
    this.body.className = "tb-modal-body";
    this.dialog.appendChild(this.body);

    if (options.closeOnBackdrop !== false) {
      this.dialog.addEventListener("click", (event) => {
        if (event.target === this.dialog) {
          this.close();
        }
      });
    }

    /*
     * `Échap` natif REPRIS EN MAIN, pour que ce geste-là aussi démonte sans délai.
     *
     * Laissé au navigateur, il referme le `<dialog>` par un chemin qui ne passe jamais par
     * `close()` : `open` tombe, et le démontage n'arrive qu'avec l'événement `close`, une tâche plus
     * tard. C'est très exactement la fenêtre décrite sur {@link teardown}, sur le geste le plus
     * courant. On annule donc la fermeture native et on rejoue la nôtre, qui a le même effet visible.
     */
    this.dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.close();
    });

    // Le filet des fermetures qui restent : un `form method="dialog"`, ou une fermeture décidée par
    // le navigateur. Elles gardent le régime différé, faute de pouvoir être interceptées — aucune
    // modale du jeu n'emprunte ces chemins aujourd'hui.
    this.dialog.addEventListener("close", () => this.teardown(), { once: true });

    MODAL_TEARDOWNS.set(this.dialog, () => this.teardown());

    document.body.appendChild(this.dialog);
    this.dialog.showModal();
  }

  setTitle(title: string): void {
    this.titleEl.textContent = title;
  }

  getBody(): HTMLDivElement {
    return this.body;
  }

  /** Referme la modale, et la démonte avant de rendre la main — voir {@link teardown}. */
  close(): void {
    if (this.dialog.open) {
      this.dialog.close();
    }
    this.teardown();
  }

  /**
   * Démontage de la modale : retrait du DOM, focus rendu, `onClose` prévenu.
   *
   * 🔴 Il a lieu TOUT DE SUITE, sans attendre l'événement `close`, et c'est l'invariant que cette
   * classe doit tenir : **l'appelant peut détenir des ressources adossées à la durée de vie de la
   * modale, et elles doivent être libérées au moment même où elle cesse d'être ouverte.**
   *
   * `dialog.close()` ne le donne pas : il efface `open` immédiatement mais se contente de
   * *programmer* l'événement `close`. Entre les deux, la modale n'est plus ouverte pour qui
   * l'observe — un test `dialog[open]`, par exemple — alors que ce que `onClose` devait libérer
   * court encore. Dans le jeu, cette fenêtre a coûté une touche : la couche d'entrée y voyait « plus
   * de modale » tandis que le consommateur empilé par le sélecteur de carte tenait toujours le
   * sommet de la pile, et son invariant « une action, un seul consommateur » interdisait à `Échap`
   * d'atteindre l'écran du dessous. Mesuré le 2026-09-14 sur `smoke/screen-tour.spec.ts` étape 5 :
   * la fenêtre ne dure d'ordinaire que quelques millisecondes, mais la confirmation de carte
   * enchaîne sur un chargement et un rendu complet, ce qui la tient ouverte assez longtemps pour
   * que l'échec devienne certain.
   *
   * Idempotent, parce que TROIS chemins y mènent — `close()`, l'interception de `cancel`, et
   * l'événement `close` en filet — et que le premier des trois déclenche les autres derrière lui.
   */
  private teardown(): void {
    if (this.isTornDown) {
      return;
    }
    this.isTornDown = true;
    this.dialog.remove();
    // La fermeture native a déjà rendu le focus au déclencheur ; on ne le refait que par sécurité,
    // et seulement s'il est encore là — refermer une modale peut avoir démonté l'écran qui la
    // portait, auquel cas il n'y a plus rien à viser (même garde que `combat-menu.ts`).
    if (this.previousFocus?.isConnected === true) {
      this.previousFocus.focus();
    }
    this.onClose?.();
  }
}
