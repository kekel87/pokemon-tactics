import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InputSource } from "../input/input-source";
import { LogicalAction } from "../input/logical-action";
import { initBrowserBack } from "./browser-back";

const { getInputSystem, closeOpenModal } = vi.hoisted(() => ({
  getInputSystem: vi.fn(),
  /** Rend « il y avait une modale à fermer » — donc `false` par défaut : aucune modale ouverte. */
  closeOpenModal: vi.fn(() => false),
}));
vi.mock("../input/input-system", () => ({ getInputSystem }));
vi.mock("../input/focus-navigation", () => ({ closeOpenModal }));

/** La racine par défaut des tests : on N'Y est pas, sauf quand un test le dit. */
const NOT_AT_ROOT = () => false;
const AT_ROOT = () => true;

const SENTINEL = { ptBack: true };

/** L'historique du navigateur réduit à ce que le module en touche : l'état courant et deux verbes. */
function createHistoryStub() {
  const pushed: unknown[] = [];
  let backCalls = 0;
  const stub = {
    state: null as unknown,
    pushState(data: unknown): void {
      pushed.push(data);
      stub.state = data;
    },
    back(): void {
      backCalls += 1;
    },
  };
  return {
    stub,
    pushed,
    backCalls: () => backCalls,
    /** Ce que le navigateur fait vraiment d'un retour : dépiler, PUIS notifier. */
    popBack(state: unknown = null): void {
      stub.state = state;
      fireWindow("popstate");
    },
  };
}

type Listener = { type: string; handler: () => void; capture: boolean };
let listeners: Listener[] = [];

function createWindowStub() {
  return {
    addEventListener(type: string, handler: () => void, options?: { capture?: boolean }): void {
      listeners.push({ type, handler, capture: options?.capture === true });
    },
    removeEventListener(type: string, handler: () => void, options?: { capture?: boolean }): void {
      const capture = options?.capture === true;
      listeners = listeners.filter(
        (entry) => !(entry.type === type && entry.handler === handler && entry.capture === capture),
      );
    },
  };
}

function fireWindow(type: string): void {
  for (const entry of [...listeners]) {
    if (entry.type === type) {
      entry.handler();
    }
  }
}

/** `emit` rend « quelqu'un a pris l'annulation » — le seul bit qui décide de tout ici. */
function stubInputSystem(consumed: boolean) {
  const emit = vi.fn().mockReturnValue(consumed);
  getInputSystem.mockReturnValue({
    emit,
    tracker: { current: () => InputSource.Keyboard },
  });
  return emit;
}

describe("retour navigateur", () => {
  let history: ReturnType<typeof createHistoryStub>;

  beforeEach(() => {
    listeners = [];
    history = createHistoryStub();
    vi.stubGlobal("history", history.stub);
    vi.stubGlobal("window", createWindowStub());
    stubInputSystem(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    getInputSystem.mockReset();
    closeOpenModal.mockReset();
    closeOpenModal.mockReturnValue(false);
  });

  it("n'empile rien avant que le joueur ait interagi", () => {
    initBrowserBack(NOT_AT_ROOT);

    // Chrome fait SAUTER par le bouton précédent une entrée empilée sans activation utilisateur :
    // armer au démarrage, c'est armer une sentinelle que le navigateur ignore.
    expect(history.pushed).toHaveLength(0);
  });

  it("arme une seule entrée, quel que soit le nombre de gestes", () => {
    initBrowserBack(NOT_AT_ROOT);

    fireWindow("pointerdown");
    fireWindow("keydown");
    fireWindow("pointerdown");

    expect(history.pushed).toEqual([SENTINEL]);
  });

  it("réarme après un retour consommé par un écran", () => {
    initBrowserBack(NOT_AT_ROOT);
    fireWindow("pointerdown");

    history.popBack();

    expect(history.pushed).toEqual([SENTINEL, SENTINEL]);
    expect(history.backCalls()).toBe(0);
  });

  it("route le retour dans l'annulation, sans changer la modalité d'entrée", () => {
    const emit = stubInputSystem(true);
    initBrowserBack(NOT_AT_ROOT);
    fireWindow("pointerdown");

    history.popBack();

    // La modalité COURANTE est repassée telle quelle : déclarer « pointeur » effacerait l'anneau de
    // focus d'un joueur au clavier (décision #814).
    expect(emit).toHaveBeenCalledWith(LogicalAction.Cancel, InputSource.Keyboard);
  });

  it("laisse le retour sortir du jeu à la racine", () => {
    stubInputSystem(false);
    initBrowserBack(AT_ROOT);
    fireWindow("pointerdown");

    history.popBack();

    // Menu principal : rien au-dessus. On ne réarme pas et on POURSUIT vers l'extérieur, sinon le
    // geste ne ferait rien du tout — pire que de quitter.
    expect(history.pushed).toEqual([SENTINEL]);
    expect(history.backCalls()).toBe(1);
  });

  it("ne sort JAMAIS du jeu hors racine, même si personne ne consomme l'annulation", () => {
    // Le défaut trouvé en revue (2026-09-10) : déduire la racine de « personne n'a consommé ». Ça
    // arrive aussi pendant la fenêtre de montage ASYNCHRONE d'un écran, où la pile d'entrée est
    // vide — et `team-select` y attend un aller-retour réseau. L'invité qui trouvait que ça ramait
    // et faisait le geste de retour quittait la partie.
    stubInputSystem(false);
    initBrowserBack(NOT_AT_ROOT);
    fireWindow("pointerdown");

    history.popBack();

    expect(history.backCalls()).toBe(0);
    expect(history.pushed).toEqual([SENTINEL, SENTINEL]);
  });

  it("ne sort pas du jeu hors racine quand la couche d'entrée n'existe pas encore", () => {
    getInputSystem.mockReturnValue(null);
    initBrowserBack(NOT_AT_ROOT);
    fireWindow("pointerdown");

    history.popBack();

    expect(history.backCalls()).toBe(0);
    expect(history.pushed).toEqual([SENTINEL, SENTINEL]);
  });

  it("ferme la modale ouverte lui-même, au lieu de laisser le retour filer", () => {
    // 🔴 Mesuré le 2026-09-10 AVANT correctif : « Sélection d'équipe » → sélecteur d'équipe →
    // bouton précédent → le jeu était QUITTÉ. `bindScreenInput` rend `false` hors manette en
    // comptant sur la fermeture native du `<dialog>` (décision #822) ; un `popstate` n'a pas ce
    // repli. Trois gestes, partie perdue.
    closeOpenModal.mockReturnValue(true);
    const emit = stubInputSystem(false);
    initBrowserBack(NOT_AT_ROOT);
    fireWindow("pointerdown");

    history.popBack();

    // `emit` est bien tenté d'abord — c'est le repli qui est à nous, pas la primeur.
    expect(emit).toHaveBeenCalledWith(LogicalAction.Cancel, InputSource.Keyboard);
    expect(closeOpenModal).toHaveBeenCalledTimes(1);
    expect(history.backCalls()).toBe(0);
    expect(history.pushed).toEqual([SENTINEL, SENTINEL]);
  });

  it("ferme la modale même à la racine, plutôt que de quitter le jeu par-dessous", () => {
    closeOpenModal.mockReturnValue(true);
    stubInputSystem(false);
    initBrowserBack(AT_ROOT);
    fireWindow("pointerdown");

    history.popBack();

    expect(closeOpenModal).toHaveBeenCalledTimes(1);
    expect(history.backCalls()).toBe(0);
  });

  it("laisse une modale qui possède sa propre sortie se fermer elle-même", () => {
    // Le menu de combat EST un `<dialog>`, mais son `close()` désenregistre son entrée, dispose son
    // panneau et rend le focus. Un `dialog.close()` sec par-dessus laisserait une registration
    // fantôme au sommet de la pile — d'où le repli APRÈS `emit`, jamais avant.
    stubInputSystem(true);
    initBrowserBack(NOT_AT_ROOT);
    fireWindow("pointerdown");

    history.popBack();

    expect(closeOpenModal).not.toHaveBeenCalled();
    expect(history.pushed).toEqual([SENTINEL, SENTINEL]);
  });

  it("ne fait rien quand on atterrit SUR la sentinelle (pas en avant)", () => {
    const emit = stubInputSystem(true);
    initBrowserBack(AT_ROOT);
    fireWindow("pointerdown");

    // Le bouton « suivant » ramène sur notre propre entrée : ce n'est pas un retour. Sans cette
    // distinction, la sortie ci-dessus se rejouait à chaque appui.
    history.popBack({ ...SENTINEL });

    expect(emit).not.toHaveBeenCalled();
    expect(history.backCalls()).toBe(0);
    expect(history.pushed).toEqual([SENTINEL]);
  });

  it("réarme la sentinelle même si l'annulation lève", () => {
    getInputSystem.mockReturnValue({
      emit: () => {
        throw new Error("consommateur cassé");
      },
      tracker: { current: () => InputSource.Keyboard },
    });
    initBrowserBack(NOT_AT_ROOT);
    fireWindow("pointerdown");

    // L'exception traverse — mais la sentinelle survit, sinon le geste suivant (celui que le joueur
    // refait justement parce qu'il a vu quelque chose casser) sortirait du jeu.
    expect(() => history.popBack()).toThrow("consommateur cassé");
    expect(history.pushed).toEqual([SENTINEL, SENTINEL]);
  });

  it("n'empile pas une seconde entrée après un rechargement sur la sentinelle", () => {
    // L'entrée survit au rechargement : sans la reconnaître, il faudrait deux retours pour un écran.
    history.stub.state = { ...SENTINEL };
    initBrowserBack(NOT_AT_ROOT);

    fireWindow("pointerdown");

    expect(history.pushed).toHaveLength(0);
  });

  it("survit à un historique refusé", () => {
    vi.stubGlobal("history", {
      state: null,
      pushState: () => {
        throw new Error("SecurityError");
      },
      back: () => undefined,
    });
    initBrowserBack(NOT_AT_ROOT);

    // Iframe très restreinte : on perd le retour d'un écran, pas le jeu.
    expect(() => fireWindow("pointerdown")).not.toThrow();
  });

  it("retire tous ses écouteurs au débranchement", () => {
    const dispose = initBrowserBack(NOT_AT_ROOT);

    dispose();

    expect(listeners).toHaveLength(0);
  });
});
