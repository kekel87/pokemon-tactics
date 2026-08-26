import { LogicalAction } from "./logical-action.js";

/**
 * Magasin de bindings (plan 186).
 *
 * Source unique de « quelle entrée physique déclenche quelle `LogicalAction` », lue par la source
 * clavier, la source manette et la légende de contrôles, écrite par le seul écran de contrôles.
 *
 * Avant ce module, la réponse vivait dans quatre `Record` figés à la compilation (plan 184) : trois
 * dans `keyboard-source.ts`, un dans `gamepad-source.ts`. Ils sont ici, transposés **par action** —
 * c'est l'axe que l'écran de remapping manipule (« quelle touche pour Confirmer ? »), alors que le
 * chemin chaud a besoin de l'axe inverse (« que veut dire cette touche ? »). D'où les deux tables
 * dérivées, recalculées à chaque écriture et jamais à la frappe.
 */

/** Une touche, par POSITION physique (`KeyboardEvent.code`) + état de Maj (plan 184, décision 7). */
export interface KeyBinding {
  readonly code: string;
  readonly shift: boolean;
}

/**
 * Entrée brute lue pendant une capture — jamais routée, jamais convertie en `LogicalAction`. C'est
 * l'inverse exact d'une action logique, d'où sa place ici et non dans `logical-action.ts`.
 */
export type CapturedInput =
  | { readonly kind: "key"; readonly code: string; readonly shift: boolean }
  | { readonly kind: "pad"; readonly index: number };

/** Principal / secondaire. Deux, parce que c'est ce que les défauts du plan 184 utilisent déjà. */
export const BINDING_SLOT_COUNT = 2;
/** Les deux slots clavier, à parcourir sans indice ni assertion de type. */
export const BINDING_SLOTS: readonly BindingSlot[] = [0, 1];
export type BindingSlot = 0 | 1;
/**
 * Une case de l'écran de contrôles : un des deux slots clavier, ou l'unique colonne manette. Une
 * seule table à trois colonnes plutôt que deux onglets (retour humain 2026-08-25) — l'alignement
 * entre appareils devient structurel au lieu d'être à surveiller.
 */
export type BindingCell = BindingSlot | "pad";
export type BindingSlots<T> = readonly [T | null, T | null];

/**
 * Toute action logique se remappe (plan 189).
 *
 * Le panoramique caméra en était exclu (décisions #807, #811 — « il n'existe qu'en continu alors que
 * la couche d'entrée est en `keydown`, une touche qu'on lui assignerait ne ferait rien »). La prémisse
 * a changé : `keyboard-hold-source.ts` donne au clavier le maintien qui lui manquait, donc une touche
 * assignée au panoramique fait désormais quelque chose. L'alias reste — il documente l'intention et
 * évite de réécrire les vingt signatures qui le nomment.
 */
export type RemappableAction = LogicalAction;

export interface BindingSet {
  readonly keyboard: Readonly<Record<RemappableAction, BindingSlots<KeyBinding>>>;
  /**
   * UN seul bouton par action (retour humain 2026-08-25 : « pas besoin de secondaire pour la
   * manette »). Index en *mapping standard* W3C, AVANT l'échange Nintendo (fait matériel, pas réglage).
   */
  readonly gamepad: Readonly<Record<RemappableAction, number | null>>;
}

const key = (code: string, shift = false): KeyBinding => ({ code, shift });

/**
 * `Échap` et B annulent une capture en cours (décision 8) : il faut une sortie inconditionnelle, donc
 * ces deux entrées ne peuvent pas être capturées, donc l'action qu'elles servent ne se réassigne sur
 * aucun appareil. Sa ligne reste affichée — l'écran est aussi une liste de référence.
 */
export const FIXED_ACTIONS: readonly LogicalAction[] = [LogicalAction.Cancel];

/**
 * À la manette, le curseur est un AXE (croix directionnelle et stick gauche), pas un bouton : il n'y a
 * rien à réassigner, seulement à annoncer. Au clavier, ces quatre actions se remappent normalement.
 */
export const GAMEPAD_AXIS_ACTIONS: readonly LogicalAction[] = [
  LogicalAction.CursorUp,
  LogicalAction.CursorDown,
  LogicalAction.CursorLeft,
  LogicalAction.CursorRight,
];

/**
 * À la manette, ces actions sont un **modificateur maintenu + une direction**, pas un bouton : elles
 * s'annoncent au lieu de se remapper. Elles n'étaient affichées nulle part avant le plan 186, donc
 * indevinables (retour humain 2026-08-25).
 */
export const GAMEPAD_GESTURE_ACTIONS: readonly LogicalAction[] = [
  LogicalAction.ScrollLogUp,
  LogicalAction.ScrollLogDown,
  LogicalAction.ScrollTimelineUp,
  LogicalAction.ScrollTimelineDown,
];

/**
 * Sans équivalent manette (retour humain 2026-08-25) : trois crans de zoom absolus demanderaient trois
 * boutons pour ce que les gâchettes font déjà au cran par cran.
 */
export const GAMEPAD_UNAVAILABLE_ACTIONS: readonly LogicalAction[] = [
  LogicalAction.ZoomLevel1,
  LogicalAction.ZoomLevel2,
  LogicalAction.ZoomLevel3,
];

/**
 * À la manette, le panoramique est le **stick droit** — un axe analogique, pas un bouton (plan 189).
 * Comme le curseur (`GAMEPAD_AXIS_ACTIONS`), il s'annonce sans se réassigner : lui donner un bouton
 * échangerait un geste continu contre un cran par appui. Son seul réglage reste l'inversion du stick,
 * qui est une préférence (`pt-settings`), pas un binding. Au clavier, en revanche, ces quatre actions
 * se remappent normalement.
 */
export const GAMEPAD_STICK_ACTIONS: readonly LogicalAction[] = [
  LogicalAction.PanCameraUp,
  LogicalAction.PanCameraDown,
  LogicalAction.PanCameraLeft,
  LogicalAction.PanCameraRight,
];

export function isFixedAction(action: LogicalAction): boolean {
  return FIXED_ACTIONS.includes(action);
}

/** Cette action accepte-t-elle un bouton de manette ? (axe, stick et non-applicable exclus) */
export function acceptsGamepadBinding(action: LogicalAction): boolean {
  return (
    !isFixedAction(action) &&
    !GAMEPAD_AXIS_ACTIONS.includes(action) &&
    !GAMEPAD_STICK_ACTIONS.includes(action) &&
    !GAMEPAD_GESTURE_ACTIONS.includes(action) &&
    !GAMEPAD_UNAVAILABLE_ACTIONS.includes(action)
  );
}

/**
 * Les défauts du plan 184, transposés par action.
 *
 * ⚠️ Deux écarts assumés par le plan 186, et **seulement** deux :
 *   - `NumpadEnter` disparaît (Confirmer était la seule action à 3 bindings ; il n'y a que 2 slots) ;
 *   - `MenuNext` / `MenuPrevious` n'existent plus du tout (actions mortes, supprimées à l'étape B).
 *
 * Les variantes Maj ne sont pas un cas particulier : `Tab` et `Maj+Tab` servent deux actions
 * DIFFÉRENTES, donc chacune range la sienne dans son propre slot 0.
 */
export const DEFAULT_BINDINGS: BindingSet = {
  keyboard: {
    [LogicalAction.CursorUp]: [key("ArrowUp"), key("KeyW")],
    [LogicalAction.CursorDown]: [key("ArrowDown"), key("KeyS")],
    [LogicalAction.CursorLeft]: [key("ArrowLeft"), key("KeyA")],
    [LogicalAction.CursorRight]: [key("ArrowRight"), key("KeyD")],
    [LogicalAction.Confirm]: [key("Space"), key("Enter")],
    [LogicalAction.Cancel]: [key("Escape"), null],
    [LogicalAction.CycleTargetNext]: [key("Tab"), null],
    [LogicalAction.CycleTargetPrevious]: [key("Tab", true), null],
    [LogicalAction.RotateCameraLeft]: [key("KeyQ"), null],
    [LogicalAction.RotateCameraRight]: [key("KeyE"), null],
    [LogicalAction.ZoomIn]: [key("KeyR"), null],
    [LogicalAction.ZoomOut]: [key("KeyF"), null],
    // ⚠️ `Numpad1/2/3` ont quitté le slot secondaire (plan 189, décision 3) : le pavé numérique passe
    // tout entier au panoramique, la rangée de chiffres garde les crans de zoom. `Digit1/2/3` suffisent
    // — un cran de zoom n'a pas besoin de deux touches, un panoramique directionnel a besoin des quatre.
    [LogicalAction.ZoomLevel1]: [key("Digit1"), null],
    [LogicalAction.ZoomLevel2]: [key("Digit2"), null],
    [LogicalAction.ZoomLevel3]: [key("Digit3"), null],
    // Pavé numérique, en croix : 8/2/4/6 est la disposition directionnelle que le pavé dessine
    // physiquement (plan 189). Aucun slot secondaire — le repli des claviers sans pavé est
    // `FALLBACK_KEY_BINDINGS`, qui n'est pas un binding remappable.
    [LogicalAction.PanCameraUp]: [key("Numpad8"), null],
    [LogicalAction.PanCameraDown]: [key("Numpad2"), null],
    [LogicalAction.PanCameraLeft]: [key("Numpad4"), null],
    [LogicalAction.PanCameraRight]: [key("Numpad6"), null],
    // L'ordre de jeu prime sur le journal (retour humain 2026-08-25) : il se lit à chaque tour, le
    // journal se consulte après coup. Il prend donc `Page ↑/↓` nus, le journal passe sous Maj.
    [LogicalAction.ScrollTimelineUp]: [key("PageUp"), null],
    [LogicalAction.ScrollTimelineDown]: [key("PageDown"), null],
    [LogicalAction.ScrollLogUp]: [key("PageUp", true), null],
    [LogicalAction.ScrollLogDown]: [key("PageDown", true), null],
    [LogicalAction.ToggleBattleLog]: [key("KeyJ"), null],
    // Aucun défaut clavier (plan 187) : `Échap` ouvre le menu quand il n'a rien à annuler. La ligne
    // reste affichée — l'écran est aussi une liste de référence, et le joueur peut y assigner sa touche.
    [LogicalAction.OpenCombatMenu]: [null, null],
  },
  gamepad: {
    [LogicalAction.CursorUp]: null,
    [LogicalAction.CursorDown]: null,
    [LogicalAction.CursorLeft]: null,
    [LogicalAction.CursorRight]: null,
    [LogicalAction.Confirm]: 0,
    [LogicalAction.Cancel]: 1,
    [LogicalAction.CycleTargetNext]: 2,
    // Y (décision humaine 2026-08-25). ⚠️ Y est AUSSI le modificateur maintenu du défilement des
    // panneaux (`SCROLL_BY_CURSOR_ACTION`, décision humaine 2026-08-20) : l'appui émet donc « cible
    // précédente » avant que le maintien ne fasse défiler. Sans effet hors phase de confirmation
    // d'attaque, seule phase où le routeur consomme cette action — ailleurs elle est ignorée.
    [LogicalAction.CycleTargetPrevious]: 3,
    [LogicalAction.RotateCameraLeft]: 4,
    [LogicalAction.RotateCameraRight]: 5,
    [LogicalAction.ZoomIn]: 7,
    [LogicalAction.ZoomOut]: 6,
    [LogicalAction.ZoomLevel1]: null,
    [LogicalAction.ZoomLevel2]: null,
    [LogicalAction.ZoomLevel3]: null,
    [LogicalAction.ScrollTimelineUp]: null,
    [LogicalAction.ScrollTimelineDown]: null,
    [LogicalAction.ScrollLogUp]: null,
    [LogicalAction.ScrollLogDown]: null,
    // Select (décision humaine 2026-08-25) : avec `R3 + ↑/↓` pour le défilement, le journal devient
    // entièrement pilotable à la manette — l'ouvrir ne demandait sinon rien de moins que la souris.
    [LogicalAction.ToggleBattleLog]: 8,
    // Start — le seul bouton que le plan 186 a laissé libre, en prévision de ce menu (plan 187).
    [LogicalAction.OpenCombatMenu]: 9,
    // Stick DROIT, donc aucun bouton (plan 189, `GAMEPAD_STICK_ACTIONS`) : annoncé, jamais assignable.
    [LogicalAction.PanCameraUp]: null,
    [LogicalAction.PanCameraDown]: null,
    [LogicalAction.PanCameraLeft]: null,
    [LogicalAction.PanCameraRight]: null,
  },
};

/**
 * Jeu de secours **fixe** du panoramique, pour les claviers sans pavé numérique (plan 189, décision 2).
 *
 * Un portable doit pouvoir déplacer la caméra sans passer par l'écran de contrôles — sinon le
 * panoramique reste introuvable sur la moitié du matériel. Non remappable et non capturable : il ne
 * passe pas par `assign()`, l'écran de contrôles l'affiche en lecture seule.
 *
 * ⚠️ Ce n'est PAS le mécanisme de `FIXED_ACTIONS`, qui dit « cette *action* ne se réassigne nulle
 * part ». C'est un second jeu qui **coexiste** avec le binding remappable de la même action, et qui
 * lui **cède toujours la place** : voir la fusion dans `keyboardLookup()`. Si le joueur assigne
 * `Maj+↑` à autre chose, c'est son choix qui s'applique — le jeu ne vole pas une touche en silence.
 */
export const FALLBACK_KEY_BINDINGS: readonly (readonly [KeyBinding, LogicalAction])[] = [
  [key("ArrowUp", true), LogicalAction.PanCameraUp],
  [key("ArrowDown", true), LogicalAction.PanCameraDown],
  [key("ArrowLeft", true), LogicalAction.PanCameraLeft],
  [key("ArrowRight", true), LogicalAction.PanCameraRight],
];

/** Clé de recherche d'une touche : la position, préfixée quand Maj fait partie du binding. */
export function keyLookupKey(code: string, shift: boolean): string {
  return shift ? `Shift+${code}` : code;
}

const ALL_ACTIONS = Object.keys(DEFAULT_BINDINGS.keyboard) as RemappableAction[];

/** Résultat d'une tentative d'assignation. */
export type AssignResult =
  | { readonly status: "fixed" }
  | { readonly status: "wrong-device" }
  | {
      readonly status: "assigned";
      /** Ce que l'échange a délogé, quand la touche servait déjà ailleurs (décision 4). */
      readonly displaced: { readonly action: RemappableAction; readonly cell: BindingCell } | null;
    };

export interface BindingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BindingsStore {
  current(): BindingSet;
  /** `code`/`Shift+code` → action. Table dérivée, mise en cache : le chemin chaud n'itère jamais. */
  keyboardLookup(): ReadonlyMap<string, RemappableAction>;
  /** Index de bouton (mapping standard) → action. */
  gamepadLookup(): ReadonlyMap<number, RemappableAction>;
  /** Touche d'un slot clavier, ou `null`. Accesseur direct : `current()` reconstruisait deux
   * `Record` de 20 clés à chaque case rafraîchie, soit des centaines d'objets par rendu d'écran. */
  keyBinding(action: RemappableAction, slot: BindingSlot): KeyBinding | null;
  /** Bouton de manette d'une action, ou `null`. */
  gamepadButton(action: RemappableAction): number | null;
  assign(action: RemappableAction, cell: BindingCell, captured: CapturedInput): AssignResult;
  clear(action: RemappableAction, cell: BindingCell): void;
  reset(): void;
  resetActions(actions: readonly RemappableAction[]): void;
  /**
   * Ce slot a-t-il été vidé par un ÉCHANGE depuis le chargement ? Distinct d'un slot vide de
   * naissance, que la majorité des actions ont (décision 15) — sans quoi l'écran s'ouvrirait
   * couvert d'alertes avant que le joueur ait touché à quoi que ce soit. État de session : après un
   * rechargement, un slot vide est un slot vide.
   */
  isDisplaced(action: RemappableAction, cell: BindingCell): boolean;
  /** Cette case diffère-t-elle du défaut ? (repère « tu y as touché » de l'écran de contrôles) */
  isCustomised(action: RemappableAction, cell: BindingCell): boolean;
}

const STORAGE_KEY = "pt-bindings";
const STORAGE_VERSION = 1;

/** Écarts au défaut, jamais la table entière — un défaut révisé doit pouvoir atteindre le joueur. */
interface StoredBindings {
  version: number;
  keyboard: Partial<Record<string, BindingSlots<KeyBinding>>>;
  gamepad: Partial<Record<string, number | null>>;
}

function sameKey(left: KeyBinding | null, right: KeyBinding | null): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return left.code === right.code && left.shift === right.shift;
}

function isKeyBinding(value: unknown): value is KeyBinding {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const candidate = value as { code?: unknown; shift?: unknown };
  return typeof candidate.code === "string" && typeof candidate.shift === "boolean";
}

/** Deux slots exactement, quoi qu'ait écrit une version antérieure ou une main humaine. */
function readSlots<T>(
  value: unknown,
  isValid: (item: unknown) => item is T,
): BindingSlots<T> | null {
  if (!Array.isArray(value) || value.length !== BINDING_SLOT_COUNT) {
    return null;
  }
  const slots = value.map((item) => (isValid(item) ? item : null));
  return [slots[0] ?? null, slots[1] ?? null];
}

export function createBindingsStore(storage: BindingsStorage | null): BindingsStore {
  const keyboard = new Map<RemappableAction, BindingSlots<KeyBinding>>();
  const gamepad = new Map<RemappableAction, number | null>();
  const displaced = new Set<string>();
  let keyboardCache: Map<string, RemappableAction> | null = null;
  let gamepadCache: Map<number, RemappableAction> | null = null;

  const cellId = (action: RemappableAction, cell: BindingCell): string => `${action}#${cell}`;

  const loadDefaults = (): void => {
    for (const action of ALL_ACTIONS) {
      keyboard.set(action, DEFAULT_BINDINGS.keyboard[action]);
      gamepad.set(action, DEFAULT_BINDINGS.gamepad[action]);
    }
  };

  const load = (): void => {
    loadDefaults();
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<StoredBindings>;
      if (parsed.version !== STORAGE_VERSION) {
        // Une forme d'une autre version : on repart des défauts plutôt que de deviner. `version` ne
        // bouge que si la FORME change — un défaut révisé n'est pas une migration.
        return;
      }
      for (const [action, slots] of Object.entries(parsed.keyboard ?? {})) {
        // Action inconnue (supprimée depuis la sauvegarde) : ignorée, et purgée à la prochaine
        // écriture puisqu'on ne sérialise que ce qu'on connaît.
        if (!keyboard.has(action as RemappableAction)) {
          continue;
        }
        const read = readSlots(slots, isKeyBinding);
        if (read) {
          keyboard.set(action as RemappableAction, read);
        }
      }
      for (const [action, button] of Object.entries(parsed.gamepad ?? {})) {
        if (!gamepad.has(action as RemappableAction)) {
          continue;
        }
        if (button === null || typeof button === "number") {
          gamepad.set(action as RemappableAction, button);
        }
      }
    } catch {
      // Sauvegarde illisible : les défauts, plutôt qu'un jeu à moitié appliqué.
      loadDefaults();
    }
  };

  const save = (): void => {
    if (!storage) {
      return;
    }
    const stored: StoredBindings = { version: STORAGE_VERSION, keyboard: {}, gamepad: {} };
    for (const action of ALL_ACTIONS) {
      const keys = keyboard.get(action) ?? DEFAULT_BINDINGS.keyboard[action];
      if (
        !keys.every((slot, index) =>
          sameKey(slot, DEFAULT_BINDINGS.keyboard[action][index] ?? null),
        )
      ) {
        stored.keyboard[action] = keys;
      }
      const button = gamepad.get(action) ?? null;
      if (button !== DEFAULT_BINDINGS.gamepad[action]) {
        stored.gamepad[action] = button;
      }
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(stored));
  };

  const invalidate = (): void => {
    keyboardCache = null;
    gamepadCache = null;
  };

  const commit = (): void => {
    save();
    invalidate();
  };

  const withSlot = <T>(
    slots: BindingSlots<T>,
    slot: BindingSlot,
    value: T | null,
  ): BindingSlots<T> => (slot === 0 ? [value, slots[1]] : [slots[0], value]);

  load();

  return {
    current: () => ({
      keyboard: Object.fromEntries(keyboard) as BindingSet["keyboard"],
      gamepad: Object.fromEntries(gamepad) as BindingSet["gamepad"],
    }),

    keyBinding: (action, slot) => keyboard.get(action)?.[slot] ?? null,

    gamepadButton: (action) => gamepad.get(action) ?? null,

    keyboardLookup() {
      if (keyboardCache === null) {
        keyboardCache = new Map();
        /*
         * Le secours d'abord, les bindings du joueur ENSUITE et par-dessus (plan 189) : l'ordre est
         * le mécanisme. `Map.set` écrase, donc une touche assignée par le joueur reprend toujours sa
         * clé au repli — le secours ne survit que là où personne ne l'a réclamée.
         */
        for (const [binding, action] of FALLBACK_KEY_BINDINGS) {
          keyboardCache.set(keyLookupKey(binding.code, binding.shift), action);
        }
        for (const [action, slots] of keyboard) {
          for (const binding of slots) {
            if (binding !== null) {
              keyboardCache.set(keyLookupKey(binding.code, binding.shift), action);
            }
          }
        }
      }
      return keyboardCache;
    },

    gamepadLookup() {
      if (gamepadCache === null) {
        gamepadCache = new Map();
        for (const [action, index] of gamepad) {
          if (index !== null) {
            gamepadCache.set(index, action);
          }
        }
      }
      return gamepadCache;
    },

    assign(action, cell, captured) {
      if (isFixedAction(action)) {
        return { status: "fixed" };
      }
      // Une case manette n'accepte qu'un bouton, une case clavier qu'une touche : l'écran garde la
      // capture ouverte plutôt que d'écrire dans la colonne que le joueur ne visait pas.
      if ((cell === "pad") !== (captured.kind === "pad")) {
        return { status: "wrong-device" };
      }
      let displacedCell: { action: RemappableAction; cell: BindingCell } | null = null;

      if (captured.kind === "key" && cell !== "pad") {
        const binding = key(captured.code, captured.shift);
        // Le scan des propriétaires se fait AVANT toute écriture. Le faire en mutant laissait, sur
        // une sortie en cours de route, la mémoire modifiée sans `commit()` : cache de recherche
        // périmé et `pt-bindings` non écrit, donc trois vérités divergentes (revue 2026-08-25).
        const owners: { owner: RemappableAction; slot: BindingSlot }[] = [];
        for (const [owner, slots] of keyboard) {
          for (const slot of BINDING_SLOTS) {
            if (!sameKey(slots[slot] ?? null, binding)) {
              continue;
            }
            if (isFixedAction(owner)) {
              return { status: "fixed" };
            }
            owners.push({ owner, slot });
          }
        }
        for (const { owner, slot } of owners) {
          if (owner === action && slot === cell) {
            continue;
          }
          // Relire l'état courant plutôt que le tableau capturé à l'entrée de la boucle : une même
          // touche posée sur les DEUX slots d'une action se serait sinon nettoyée à moitié.
          keyboard.set(owner, withSlot(keyboard.get(owner) ?? [null, null], slot, null));
          // Déplacer une touche d'un slot à l'autre de la MÊME action n'est pas un échange : rien
          // n'est perdu, donc ni alerte rouge ni message (revue 2026-08-25).
          if (owner === action) {
            continue;
          }
          displaced.add(cellId(owner, slot));
          displacedCell = { action: owner, cell: slot };
        }
        keyboard.set(action, withSlot(keyboard.get(action) ?? [null, null], cell, binding));
      } else if (captured.kind === "pad") {
        if (!acceptsGamepadBinding(action)) {
          return { status: "fixed" };
        }
        const owners: RemappableAction[] = [];
        for (const [owner, button] of gamepad) {
          if (button !== captured.index || owner === action) {
            continue;
          }
          if (isFixedAction(owner)) {
            return { status: "fixed" };
          }
          owners.push(owner);
        }
        for (const owner of owners) {
          gamepad.set(owner, null);
          displaced.add(cellId(owner, "pad"));
          displacedCell = { action: owner, cell: "pad" };
        }
        gamepad.set(action, captured.index);
      }

      displaced.delete(cellId(action, cell));
      commit();
      return { status: "assigned", displaced: displacedCell };
    },

    clear(action, cell) {
      if (isFixedAction(action)) {
        return;
      }
      if (cell === "pad") {
        gamepad.set(action, null);
      } else {
        keyboard.set(action, withSlot(keyboard.get(action) ?? [null, null], cell, null));
      }
      displaced.delete(cellId(action, cell));
      commit();
    },

    reset() {
      loadDefaults();
      displaced.clear();
      commit();
    },

    resetActions(actions) {
      for (const action of actions) {
        keyboard.set(action, DEFAULT_BINDINGS.keyboard[action]);
        gamepad.set(action, DEFAULT_BINDINGS.gamepad[action]);
        displaced.delete(cellId(action, 0));
        displaced.delete(cellId(action, 1));
        displaced.delete(cellId(action, "pad"));
      }
      commit();
    },

    isDisplaced: (action, cell) => displaced.has(cellId(action, cell)),

    isCustomised(action, cell) {
      if (cell === "pad") {
        return (gamepad.get(action) ?? null) !== DEFAULT_BINDINGS.gamepad[action];
      }
      return !sameKey(
        keyboard.get(action)?.[cell] ?? null,
        DEFAULT_BINDINGS.keyboard[action][cell],
      );
    },
  };
}

let current: BindingsStore | null = null;

/** Entrée de boot — appelée une fois, à côté de `initSettings()`. */
export function initBindings(): BindingsStore {
  const storage = typeof localStorage === "undefined" ? null : localStorage;
  current = createBindingsStore(storage);
  return current;
}

/**
 * Le magasin de l'app. Créé sans persistance si personne n'a booté — c'est le cas des tests
 * unitaires du core d'entrée, qui tournent en environnement node (pas de `localStorage`).
 */
export function getBindings(): BindingsStore {
  current ??= createBindingsStore(null);
  return current;
}
