/**
 * Doubles du DOM vu par `interface-sounds.ts` : la suite unitaire tourne en environnement node, sans
 * `document`, sans `Element` et sans `MutationObserver`. Juste ce que les trois observateurs lisent —
 * le contrôle focalisé, la cible d'un clic, l'attribut `open` d'un dialogue.
 *
 * `FakeElement.closest` ne connaît que les deux sélecteurs que l'écouteur de clic demande, et lève
 * sur tout autre : un sélecteur qui change dans le code doit casser le test, pas passer en silence.
 */

const KNOWN_SELECTORS: Readonly<Record<string, (element: FakeElement) => boolean>> = {
  "button:not(:disabled)": (element) => element.tagName === "BUTTON" && !element.disabled,
  "a[href]": (element) => element.tagName === "A" && element.href !== null,
};

export class FakeElement {
  disabled = false;
  href: string | null = null;

  constructor(
    readonly tagName: string,
    readonly parent: FakeElement | null = null,
  ) {}

  matches(selectorList: string): boolean {
    return selectorList.split(",").some((selector) => {
      const matcher = KNOWN_SELECTORS[selector.trim()];
      if (matcher === undefined) {
        throw new Error(`FakeElement ne sait pas évaluer le sélecteur « ${selector.trim()} »`);
      }
      return matcher(this);
    });
  }

  closest(selectorList: string): FakeElement | null {
    if (this.matches(selectorList)) {
      return this;
    }
    return this.parent?.closest(selectorList) ?? null;
  }
}

export class FakeDialogElement extends FakeElement {
  open = false;

  constructor() {
    super("DIALOG");
  }
}

interface FakeMutationRecord {
  target: unknown;
}

export class FakeMutationObserver {
  static readonly created: FakeMutationObserver[] = [];

  constructor(readonly callback: (records: FakeMutationRecord[]) => void) {
    FakeMutationObserver.created.push(this);
  }

  observe(): void {
    /* tout changement d'attribut `open` signalé par `FakeDocument` est remis à chaque observateur */
  }
}

interface FakeClickEvent {
  target: unknown;
  preventDefault(): void;
  stopPropagation(): void;
  stopImmediatePropagation(): void;
}

interface RegisteredListener {
  type: string;
  handler: (event: FakeClickEvent) => void;
}

export class FakeDocument {
  activeElement: FakeElement | null = null;
  readonly documentElement = new FakeElement("HTML");
  readonly listeners: RegisteredListener[] = [];
  /** Ce que l'écouteur de clic a fait de l'événement, au lieu de seulement l'écouter. */
  readonly interferences: string[] = [];

  addEventListener(type: string, handler: (event: FakeClickEvent) => void): void {
    this.listeners.push({ type, handler });
  }

  click(target: unknown): void {
    const event: FakeClickEvent = {
      target,
      preventDefault: () => this.interferences.push("preventDefault"),
      stopPropagation: () => this.interferences.push("stopPropagation"),
      stopImmediatePropagation: () => this.interferences.push("stopImmediatePropagation"),
    };
    for (const listener of this.listeners) {
      if (listener.type === "click") {
        listener.handler(event);
      }
    }
  }

  /** Un dialogue qui s'ouvre (`showModal()`) ou se ferme (`close()`) : son attribut `open` change. */
  setDialogOpen(dialog: FakeDialogElement, open: boolean): void {
    dialog.open = open;
    this.mutateOpenAttribute(dialog);
  }

  /** L'attribut `open` d'un élément a changé — un dialogue, ou autre chose (`<details>`). */
  mutateOpenAttribute(target: unknown): void {
    for (const observer of FakeMutationObserver.created) {
      observer.callback([{ target }]);
    }
  }
}
