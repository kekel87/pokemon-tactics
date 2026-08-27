import {
  type Action,
  ActionKind,
  type BattleEngine,
  type BattleState,
  Direction,
  Grid,
  type MoveDefinition,
  Nature,
  type PokemonInstance,
  type Position,
  TargetingKind,
  Weather,
} from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import {
  type ActionMenuView,
  type AttackSubmenuView,
  type BattleChrome,
  BattleOrchestrator,
  type BoardHighlight,
  type BoardView,
  type DirectionPickerCallbacks,
  formatDamageRange,
  formatFacingSuffix,
} from "./battle-orchestrator.js";

const ACTIVE_ID = "p1-pikachu";
const ACTIVE_POSITION: Position = { x: 4, y: 4 };

function activePokemon(): PokemonInstance {
  return {
    id: ACTIVE_ID,
    definitionId: "pikachu",
    playerId: "player-1",
    level: 50,
    position: ACTIVE_POSITION,
    orientation: Direction.South,
    currentHp: 30,
    maxHp: 35,
    combatStats: { hp: 35, attack: 50, defense: 40, spAttack: 50, spDefense: 40, speed: 60 },
    nature: Nature.Hardy,
    moveIds: ["tackle"],
    statusEffects: [],
    statStages: {},
    volatileStatuses: [],
  } as unknown as PokemonInstance;
}

function fakeState(): BattleState {
  return {
    pokemon: new Map([[ACTIVE_ID, activePokemon()]]),
    activePokemonId: ACTIVE_ID,
    auras: [],
    fieldTerrains: [],
    distortionZones: [],
    fieldGlobalZones: [],
    entryHazards: [],
    pendingStrikes: [],
    weather: Weather.None,
    weatherTurnsRemaining: 0,
  } as unknown as BattleState;
}

interface Harness {
  orchestrator: BattleOrchestrator;
  submitted: Action[];
  highlights: { kind: BoardHighlight; tiles: readonly Position[] }[];
  outlines: (readonly Position[])[];
  previewFlash: string[][];
  damageEstimateCalls: number;
  pickerCallbacks: DirectionPickerCallbacks | null;
  lastActionMenu: () => ActionMenuView;
  lastSubmenu: () => AttackSubmenuView;
}

function setup(
  legalActions: Action[],
  move?: MoveDefinition,
  options?: { confirmAttack?: boolean },
): Harness {
  const submitted: Action[] = [];
  const highlights: { kind: BoardHighlight; tiles: readonly Position[] }[] = [];
  const outlines: (readonly Position[])[] = [];
  const previewFlash: string[][] = [];
  let damageEstimateCalls = 0;
  let pickerCallbacks: DirectionPickerCallbacks | null = null;
  let actionMenu: ActionMenuView | null = null;
  let submenu: AttackSubmenuView | null = null;

  const engine = {
    consumeStartupEvents: () => [],
    getLegalActions: () => legalActions,
    submitAction: (_playerId: string, action: Action) => {
      submitted.push(action);
      return { success: true, events: [] };
    },
    getEffectiveMove: () => move ?? null,
    getGrid: () => Grid.createFlat(9, 9),
    estimateDamage: () => null,
    getPokemonTypes: () => [],
    isAirborneIgnoringGravity: () => false,
    predictCtTimeline: () => [],
    previewMoveCtCost: () => ({ base: 600, pressureBonus: 0, total: 600 }),
    previewCasterMoveContext: () => null,
  } as unknown as BattleEngine;

  const board: BoardView = {
    setHighlights: (kind, tiles) => highlights.push({ kind, tiles }),
    setOutline: (tiles) => outlines.push(tiles),
    clearHighlights: () => undefined,
    showPreview: () => undefined,
    clearPreview: () => undefined,
    moveTo: () => undefined,
    moveAlongPath: () => Promise.resolve(),
    playAttack: () => Promise.resolve(),
    impactGlide: () => Promise.resolve(),
    impactShake: () => Promise.resolve(),
    setFacing: () => undefined,
    setActive: () => undefined,
    flashDamage: () => undefined,
    setPreviewFlash: (ids) => previewFlash.push([...ids]),
    setConfusionWobble: () => undefined,
    setDamageEstimates: () => {
      damageEstimateCalls += 1;
    },
    updateHp: () => undefined,
    updateStatus: () => undefined,
    setKnockedOut: () => undefined,
    setSemiInvulnerable: () => undefined,
    setSubstitute: () => undefined,
    setSpecies: () => undefined,
    setHudVisible: () => undefined,
    koAnimationDurationMs: () => 0,
    hurtAnimationDurationMs: () => 0,
    setFieldTerrains: () => undefined,
    setDistortionZones: () => undefined,
    setEntryHazards: () => undefined,
    setAuraIndicators: () => undefined,
    setAuraRings: () => undefined,
    panCameraTo: () => undefined,
    setGroundedByGravity: () => undefined,
    showDirectionPicker: (_center, _initial, callbacks) => {
      pickerCallbacks = callbacks;
      return { dispose: () => undefined };
    },
  };

  const chrome: BattleChrome = {
    showActionMenu: (view) => {
      actionMenu = view;
    },
    showAttackSubmenu: (view) => {
      submenu = view;
    },
    showSelectedMove: () => undefined,
    updateInstruction: () => undefined,
    showCancellableInstruction: () => undefined,
    hideMenus: () => undefined,
    updateTurnInfo: () => undefined,
    updateInfoPanel: () => undefined,
    updateTileInfo: () => undefined,
    updateCursorPanel: () => undefined,
    updateWeather: () => undefined,
    updateTailwind: () => undefined,
    updateTimeline: () => undefined,
    updateCameraAzimuth: () => undefined,
    focusMenuStep: () => false,
    isMenuFocused: () => false,
    activateFocusedMenuItem: () => false,
    scrollTimeline: () => undefined,
    showVictory: () => undefined,
  };

  const orchestrator = new BattleOrchestrator(
    engine,
    fakeState(),
    new Map<string, MoveDefinition>(move ? [[move.id, move]] : []),
    board,
    chrome,
    { report: () => undefined },
    { confirmAttack: options?.confirmAttack ?? false },
    {
      translate: (key) => key,
      getLanguage: () => "en",
      getPortraitUrl: () => "",
      getStatusLabelUrl: () => "",
      getItemIconUrl: () => "",
      getItemName: () => null,
      getAbilityName: () => null,
      getPokemonTypes: () => [],
      getTypeIconUrl: () => "",
      getStatusIconUrl: () => "",
      isDamagePreviewEnabled: () => true,
      isEnemyInfoHidden: () => false,
    },
  );

  return {
    orchestrator,
    submitted,
    highlights,
    outlines,
    previewFlash,
    get damageEstimateCalls() {
      return damageEstimateCalls;
    },
    get pickerCallbacks() {
      return pickerCallbacks;
    },
    lastActionMenu: () => {
      if (!actionMenu) {
        throw new Error("action menu not shown");
      }
      return actionMenu;
    },
    lastSubmenu: () => {
      if (!submenu) {
        throw new Error("attack submenu not shown");
      }
      return submenu;
    },
  } as Harness;
}

const moveAction = (end: Position): Action => ({
  kind: ActionKind.Move,
  pokemonId: ACTIVE_ID,
  path: [ACTIVE_POSITION, end],
});

const useMoveAction = (moveId: string, target: Position): Action => ({
  kind: ActionKind.UseMove,
  pokemonId: ACTIVE_ID,
  moveId,
  targetPosition: target,
});

describe("BattleOrchestrator", () => {
  it("opens the action menu with capabilities derived from legal actions", () => {
    const harness = setup([moveAction({ x: 5, y: 4 }), useMoveAction("tackle", { x: 4, y: 3 })]);
    harness.orchestrator.start();
    const menu = harness.lastActionMenu();
    expect(menu.canMove).toBe(true);
    expect(menu.canAct).toBe(true);
    expect(menu.canUndoMove).toBe(false);
  });

  it("highlights move destinations and submits the matching Move action", () => {
    const destination = { x: 5, y: 4 };
    const harness = setup([moveAction(destination)]);
    harness.orchestrator.start();
    harness.lastActionMenu().onMove();
    expect(harness.highlights.at(-1)).toEqual({ kind: "move", tiles: [destination] });
    harness.orchestrator.onTileClick(destination);
    expect(harness.submitted).toHaveLength(1);
    expect(harness.submitted[0]?.kind).toBe(ActionKind.Move);
  });

  it("runs the attack flow: submenu → target highlight → submit UseMove", () => {
    const target = { x: 4, y: 3 };
    const tackle = {
      id: "tackle",
      pp: 35,
      targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
      effects: [],
    } as unknown as MoveDefinition;
    const harness = setup([useMoveAction("tackle", target)], tackle);
    harness.orchestrator.start();
    harness.lastActionMenu().onAttack();
    expect(harness.lastSubmenu().moves.map((m) => m.definition.id)).toEqual(["tackle"]);
    harness.lastSubmenu().onSelect("tackle");
    expect(harness.outlines.at(-1)).toEqual([target]);
    expect(harness.highlights.some((h) => h.kind === "attack")).toBe(false);
    harness.orchestrator.onTileClick(target);
    expect(harness.submitted).toEqual([useMoveAction("tackle", target)]);
  });

  it("confirmAttack locks the target on first click and submits on the second", () => {
    const target = { x: 4, y: 3 };
    const tackle = {
      id: "tackle",
      pp: 35,
      targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
      effects: [],
    } as unknown as MoveDefinition;
    const harness = setup([useMoveAction("tackle", target)], tackle, { confirmAttack: true });
    harness.orchestrator.start();
    harness.lastActionMenu().onAttack();
    harness.lastSubmenu().onSelect("tackle");
    harness.orchestrator.onTileClick(target);
    expect(harness.submitted).toHaveLength(0);
    expect(harness.previewFlash.length).toBeGreaterThan(0);
    expect(harness.damageEstimateCalls).toBeGreaterThan(0);
    harness.orchestrator.onTileClick(target);
    expect(harness.submitted).toEqual([useMoveAction("tackle", target)]);
  });

  it("Escape from the confirm step clears the preview flash and returns to target selection", () => {
    const target = { x: 4, y: 3 };
    const tackle = {
      id: "tackle",
      pp: 35,
      targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
      effects: [],
    } as unknown as MoveDefinition;
    const harness = setup([useMoveAction("tackle", target)], tackle, { confirmAttack: true });
    harness.orchestrator.start();
    harness.lastActionMenu().onAttack();
    harness.lastSubmenu().onSelect("tackle");
    harness.orchestrator.onTileClick(target);
    harness.orchestrator.onEscape();
    expect(harness.previewFlash.at(-1)).toEqual([]);
    expect(harness.submitted).toHaveLength(0);
  });

  it("Escape from target selection returns to the attack submenu", () => {
    const harness = setup([useMoveAction("tackle", { x: 4, y: 3 })]);
    harness.orchestrator.start();
    harness.lastActionMenu().onAttack();
    harness.lastSubmenu().onSelect("tackle");
    harness.orchestrator.onEscape();
    harness.orchestrator.onTileClick({ x: 4, y: 3 });
    expect(harness.submitted).toHaveLength(0);
  });

  it("Wait opens the direction picker and submits EndTurn on confirm", () => {
    const harness = setup([]);
    harness.orchestrator.start();
    harness.orchestrator.onConfirmKey();
    expect(harness.pickerCallbacks).not.toBeNull();
    harness.pickerCallbacks?.onConfirm(Direction.North);
    expect(harness.submitted).toHaveLength(1);
    expect(harness.submitted[0]).toMatchObject({
      kind: ActionKind.EndTurn,
      direction: Direction.North,
    });
  });

  it("Hit&Run routes a target click to the retreat picker, then submits with retreatPosition", () => {
    const target = { x: 4, y: 3 };
    const hitAndRun = {
      id: "quickattack",
      pp: 15,
      targeting: {
        kind: TargetingKind.HitAndRun,
        hitRange: { min: 1, max: 1 },
        retreatRange: { min: 1, max: 2 },
      },
      effects: [],
    } as unknown as MoveDefinition;
    const harness = setup([useMoveAction("quickattack", target)], hitAndRun);
    harness.orchestrator.start();
    harness.lastActionMenu().onAttack();
    harness.lastSubmenu().onSelect("quickattack");
    harness.orchestrator.onTileClick(target);
    expect(harness.submitted).toHaveLength(0);
    const retreat = harness.highlights.at(-1);
    expect(retreat?.kind).toBe("retreat");
    const retreatTile = retreat?.tiles[0];
    expect(retreatTile).toBeDefined();
    if (retreatTile) {
      harness.orchestrator.onTileClick(retreatTile);
    }
    expect(harness.submitted).toHaveLength(1);
    expect(harness.submitted[0]).toMatchObject({
      kind: ActionKind.UseMove,
      retreatPosition: retreatTile,
    });
  });

  it("Escape from the retreat picker returns to target selection (Hit&Run)", () => {
    const target = { x: 4, y: 3 };
    const hitAndRun = {
      id: "quickattack",
      pp: 15,
      targeting: {
        kind: TargetingKind.HitAndRun,
        hitRange: { min: 1, max: 1 },
        retreatRange: { min: 1, max: 2 },
      },
      effects: [],
    } as unknown as MoveDefinition;
    const harness = setup([useMoveAction("quickattack", target)], hitAndRun);
    harness.orchestrator.start();
    harness.lastActionMenu().onAttack();
    harness.lastSubmenu().onSelect("quickattack");
    harness.orchestrator.onTileClick(target);
    harness.orchestrator.onEscape();
    harness.orchestrator.onTileClick(target);
    expect(harness.submitted).toHaveLength(0);
    expect(harness.highlights.at(-1)?.kind).toBe("retreat");
  });
});

/*
 * `onEscape` doit dire s'il a VRAIMENT annulé quelque chose (plan 187) : c'est ce booléen qui permet
 * à l'app de distinguer « j'ai reculé d'un cran » de « il n'y avait nulle part où reculer », le
 * second cas étant celui où `Échap` ouvre le menu de combat.
 *
 * Le risque que ces tests couvrent : `Échap` est la sortie de TOUT le flux d'attaque, et un `false`
 * rendu par erreur depuis une phase profonde ouvrirait le menu au lieu de reculer.
 */
describe("BattleOrchestrator.onEscape — a-t-il annulé quelque chose ?", () => {
  it("renvoie false au menu d'actions racine : il n'y a rien à annuler", () => {
    const harness = setup([useMoveAction("tackle", { x: 4, y: 3 })]);
    harness.orchestrator.start();
    expect(harness.orchestrator.onEscape()).toBe(false);
  });

  it("renvoie true depuis la liste d'attaques, et redescend au menu d'actions", () => {
    const harness = setup([useMoveAction("tackle", { x: 4, y: 3 })]);
    harness.orchestrator.start();
    harness.lastActionMenu().onAttack();
    expect(harness.orchestrator.onEscape()).toBe(true);
    // Revenu à la racine, la fois suivante n'a donc plus rien à annuler.
    expect(harness.orchestrator.onEscape()).toBe(false);
  });

  it("renvoie true depuis le choix de cible", () => {
    const harness = setup([useMoveAction("tackle", { x: 4, y: 3 })]);
    harness.orchestrator.start();
    harness.lastActionMenu().onAttack();
    harness.lastSubmenu().onSelect("tackle");
    expect(harness.orchestrator.onEscape()).toBe(true);
  });

  it("renvoie true depuis la confirmation d'attaque", () => {
    const target: Position = { x: 4, y: 3 };
    const tackle = {
      id: "tackle",
      pp: 35,
      targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
      effects: [],
    } as unknown as MoveDefinition;
    const harness = setup([useMoveAction("tackle", target)], tackle, { confirmAttack: true });
    harness.orchestrator.start();
    harness.lastActionMenu().onAttack();
    harness.lastSubmenu().onSelect("tackle");
    harness.orchestrator.onTileClick(target);
    expect(harness.orchestrator.onEscape()).toBe(true);
  });

  it("renvoie true depuis le choix de destination de déplacement", () => {
    const harness = setup([useMoveAction("tackle", { x: 4, y: 3 })]);
    harness.orchestrator.start();
    harness.lastActionMenu().onMove();
    expect(harness.orchestrator.onEscape()).toBe(true);
  });

  /*
   * La phase la plus à risque des six, et celle que la revue de code a eu raison de réclamer : c'est
   * la seule où DEUX annulations s'empilent côté app (`combat.cancelDirectionPicker()` d'abord, puis
   * `onEscape()`). Si l'orchestrateur y renvoyait `false`, le sélecteur d'orientation se refermerait
   * et le menu de combat s'ouvrirait par-dessus.
   */
  it("renvoie true depuis le sélecteur d'orientation ouvert par Attendre", () => {
    const harness = setup([]);
    harness.orchestrator.start();
    harness.orchestrator.onConfirmKey();
    expect(harness.pickerCallbacks).not.toBeNull();
    expect(harness.orchestrator.onEscape()).toBe(true);
    // Et on est bien redescendu au menu d'actions : le suivant n'a plus rien à annuler.
    expect(harness.orchestrator.onEscape()).toBe(false);
  });
});

describe("damage preview formatters", () => {
  it("collapses an equal range and joins a spread", () => {
    expect(formatDamageRange(12, 12)).toBe("12");
    expect(formatDamageRange(8, 12)).toBe("8-12");
  });

  it("formats the facing modifier suffix", () => {
    expect(formatFacingSuffix(1.25)).toBe(" (+25%)");
    expect(formatFacingSuffix(0.75)).toBe(" (-25%)");
    expect(formatFacingSuffix(1)).toBe("");
  });
});

describe("inputContext (plan 184)", () => {
  const tackle = {
    id: "tackle",
    pp: 35,
    targeting: { kind: TargetingKind.Single, range: { min: 1, max: 1 } },
    effects: [],
  } as unknown as MoveDefinition;

  it("is locked before the first turn is handed over", () => {
    const harness = setup([]);
    expect(harness.orchestrator.inputContext()).toBe("locked");
  });

  it("is menu on the action menu and on the attack submenu", () => {
    const harness = setup([useMoveAction("tackle", { x: 4, y: 3 })], tackle);
    harness.orchestrator.start();
    expect(harness.orchestrator.inputContext()).toBe("menu");

    harness.lastActionMenu().onAttack();
    expect(harness.orchestrator.inputContext()).toBe("menu");
  });

  it("is board on every phase that designates a tile", () => {
    const target = { x: 4, y: 3 };
    const harness = setup([moveAction({ x: 5, y: 4 }), useMoveAction("tackle", target)], tackle);
    harness.orchestrator.start();

    harness.lastActionMenu().onMove();
    expect(harness.orchestrator.inputContext()).toBe("board");

    harness.orchestrator.onEscape();
    harness.lastActionMenu().onAttack();
    harness.lastSubmenu().onSelect("tackle");
    expect(harness.orchestrator.inputContext()).toBe("board");
  });

  it("is board while choosing the end-of-turn facing", () => {
    const harness = setup([]);
    harness.orchestrator.start();
    harness.orchestrator.onConfirmKey();
    expect(harness.orchestrator.inputContext()).toBe("board");
  });

  it("notifies only when the context actually changes, not on every phase change", () => {
    const target = { x: 4, y: 3 };
    const harness = setup([useMoveAction("tackle", target)], tackle);
    const seen: string[] = [];
    harness.orchestrator.onInputContextChanged = (context) => seen.push(context);

    harness.orchestrator.start();
    harness.lastActionMenu().onAttack();
    harness.lastSubmenu().onSelect("tackle");

    expect(seen).toEqual(["menu", "board"]);
  });
});
