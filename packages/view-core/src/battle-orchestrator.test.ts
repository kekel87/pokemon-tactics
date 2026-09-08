import {
  type Action,
  ActionError,
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
  type RemoteActionRejection,
  type TurnInfoView,
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
  localActions: { action: Action; actionIndex: number }[];
  rejections: RemoteActionRejection[];
  turnInfos: TurnInfoView[];
  reportedEvents: { type: string }[];
  forfeited: string[];
  actionMenuShownCount: number;
}

function setup(
  legalActions: Action[],
  move?: MoveDefinition,
  options?: {
    confirmAttack?: boolean;
    humanPlayerIds?: readonly string[];
    localPlayerIds?: readonly string[];
    /** Refus du moteur à la soumission, pour couvrir le 4e contrôle de `submitRemoteAction`. */
    engineRefuses?: boolean;
    /** Refus du moteur au forfait — camp déjà éliminé, ou combat déjà terminé. */
    forfeitRefused?: boolean;
  },
): Harness {
  const submitted: Action[] = [];
  const localActions: { action: Action; actionIndex: number }[] = [];
  const rejections: RemoteActionRejection[] = [];
  const turnInfos: TurnInfoView[] = [];
  const reportedEvents: { type: string }[] = [];
  const forfeited: string[] = [];
  let actionMenuShownCount = 0;
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
      if (options?.engineRefuses === true) {
        return { success: false, events: [], error: ActionError.InvalidAction };
      }
      submitted.push(action);
      return { success: true, events: [] };
    },
    get actionLogLength() {
      return submitted.length;
    },
    forfeit: (playerId: string) => {
      if (options?.forfeitRefused === true) {
        return { success: false, events: [] };
      }
      forfeited.push(playerId);
      return { success: true, events: [{ type: "battle_ended", winnerId: "player-2" }] };
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
      actionMenuShownCount += 1;
    },
    showAttackSubmenu: (view) => {
      submenu = view;
    },
    showSelectedMove: () => undefined,
    updateInstruction: () => undefined,
    showCancellableInstruction: () => undefined,
    hideMenus: () => undefined,
    updateTurnInfo: (info) => turnInfos.push(info),
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
    { report: (event) => reportedEvents.push(event as { type: string }) },
    {
      confirmAttack: options?.confirmAttack ?? false,
      getElapsedMs: () => 0,
      ...(options?.humanPlayerIds === undefined ? {} : { humanPlayerIds: options.humanPlayerIds }),
      ...(options?.localPlayerIds === undefined ? {} : { localPlayerIds: options.localPlayerIds }),
      onLocalAction: (action, actionIndex) => localActions.push({ action, actionIndex }),
      onRemoteActionRejected: (rejection) => rejections.push(rejection),
    },
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
    localActions,
    rejections,
    turnInfos,
    reportedEvents,
    forfeited,
    get actionMenuShownCount() {
      return actionMenuShownCount;
    },
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

const REMOTE = { seat: 2, playerId: "player-1" };

function endTurnAction(direction = Direction.South): Action {
  return { kind: ActionKind.EndTurn, pokemonId: ACTIVE_ID, direction };
}

function remoteHarness(options?: { engineRefuses?: boolean; forfeitRefused?: boolean }): Harness {
  const harness = setup([endTurnAction()], undefined, {
    humanPlayerIds: ["player-1"],
    localPlayerIds: ["player-2"],
    ...(options?.engineRefuses === undefined ? {} : { engineRefuses: options.engineRefuses }),
    ...(options?.forfeitRefused === undefined ? {} : { forfeitRefused: options.forfeitRefused }),
  });
  harness.orchestrator.onTurnReady = () => "pending";
  harness.orchestrator.start();
  return harness;
}

describe("BattleOrchestrator — tour distant", () => {
  it("n'ouvre pas le menu d'actions au tour d'un joueur distant", () => {
    const harness = remoteHarness();

    expect(harness.actionMenuShownCount).toBe(0);
    expect(harness.orchestrator.inputContext()).toBe("watching");
  });

  it("laisse regarder pendant le tour distant, au lieu de tout verrouiller", () => {
    const harness = remoteHarness();

    expect(harness.orchestrator.inputContext()).not.toBe("locked");
  });

  it("ouvre le menu quand le joueur actif est local", () => {
    const harness = setup([endTurnAction()], undefined, {
      humanPlayerIds: ["player-1"],
      localPlayerIds: ["player-1"],
    });
    harness.orchestrator.onTurnReady = () => false;
    harness.orchestrator.start();

    expect(harness.actionMenuShownCount).toBeGreaterThan(0);
  });

  it("applique une action distante légale", () => {
    const harness = remoteHarness();

    const applied = harness.orchestrator.submitRemoteAction({
      ...REMOTE,
      actionIndex: 0,
      action: endTurnAction(),
    });

    expect(applied).toBe(true);
    expect(harness.submitted).toEqual([endTurnAction()]);
    expect(harness.rejections).toEqual([]);
  });

  it("ne rediffuse jamais une action distante", () => {
    const harness = remoteHarness();

    harness.orchestrator.submitRemoteAction({
      ...REMOTE,
      actionIndex: 0,
      action: endTurnAction(),
    });

    expect(harness.localActions).toEqual([]);
  });

  it("refuse un index d'action décalé, en disant lequel", () => {
    const harness = remoteHarness();

    const applied = harness.orchestrator.submitRemoteAction({
      ...REMOTE,
      actionIndex: 7,
      action: endTurnAction(),
    });

    expect(applied).toBe(false);
    expect(harness.submitted).toEqual([]);
    expect(harness.rejections[0]?.cause).toEqual({
      kind: "desynced_index",
      expected: 0,
      received: 7,
    });
  });

  it("refuse une action pour un camp qui n'est pas celui qui joue", () => {
    const harness = remoteHarness();

    harness.orchestrator.submitRemoteAction({
      seat: 3,
      playerId: "player-9",
      actionIndex: 0,
      action: endTurnAction(),
    });

    expect(harness.rejections[0]?.cause).toEqual({ kind: "not_this_seat" });
  });

  it("refuse une action absente des actions légales", () => {
    const harness = remoteHarness();

    harness.orchestrator.submitRemoteAction({
      ...REMOTE,
      actionIndex: 0,
      action: { kind: ActionKind.UndoMove, pokemonId: ACTIVE_ID },
    });

    expect(harness.rejections[0]?.cause).toEqual({ kind: "not_legal" });
  });

  it("refuse une action que le moteur rejette malgré tout, avec sa cause", () => {
    const harness = remoteHarness({ engineRefuses: true });

    harness.orchestrator.submitRemoteAction({
      ...REMOTE,
      actionIndex: 0,
      action: endTurnAction(),
    });

    expect(harness.rejections[0]?.cause).toEqual({
      kind: "engine_refused",
      error: ActionError.InvalidAction,
    });
  });

  it("compte les refus par place, jusqu'au troisième qui élimine", () => {
    const harness = remoteHarness();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      harness.orchestrator.submitRemoteAction({
        ...REMOTE,
        actionIndex: 42,
        action: endTurnAction(),
      });
    }

    expect(harness.rejections.map((rejection) => rejection.strike)).toEqual([1, 2, 3]);
    expect(harness.rejections.map((rejection) => rejection.limit)).toEqual([3, 3, 3]);
    expect(harness.rejections.map((rejection) => rejection.seat)).toEqual([2, 2, 2]);
  });

  it("compte séparément les refus de deux camps distincts", () => {
    const harness = remoteHarness();

    harness.orchestrator.submitRemoteAction({
      ...REMOTE,
      actionIndex: 42,
      action: endTurnAction(),
    });
    harness.orchestrator.submitRemoteAction({
      seat: 3,
      playerId: "player-1",
      actionIndex: 42,
      action: endTurnAction(),
    });

    expect(harness.rejections.map((rejection) => rejection.strike)).toEqual([1, 1]);
  });

  it("remet le compteur à zéro dès qu'une action passe", async () => {
    const harness = remoteHarness();
    harness.orchestrator.submitRemoteAction({
      ...REMOTE,
      actionIndex: 42,
      action: endTurnAction(),
    });

    harness.orchestrator.submitRemoteAction({
      ...REMOTE,
      actionIndex: 0,
      action: endTurnAction(),
    });
    for (let hop = 0; hop < 20; hop += 1) {
      await Promise.resolve();
    }
    harness.orchestrator.submitRemoteAction({
      ...REMOTE,
      actionIndex: 42,
      action: endTurnAction(),
    });

    expect(harness.rejections.map((rejection) => rejection.strike)).toEqual([1, 1]);
  });
});

describe("BattleOrchestrator — diffusion des actions locales", () => {
  it("annonce l'action du joueur local avec son index", () => {
    const destination = { x: 5, y: 4 };
    const harness = setup([moveAction(destination)], undefined, {
      humanPlayerIds: ["player-1"],
      localPlayerIds: ["player-1"],
    });
    harness.orchestrator.start();
    harness.lastActionMenu().onMove();

    harness.orchestrator.onTileClick(destination);

    expect(harness.localActions.map((entry) => entry.actionIndex)).toEqual([0]);
    expect(harness.localActions[0]?.action.kind).toBe(ActionKind.Move);
  });

  it("n'annonce rien quand l'IA a joué elle-même", () => {
    const harness = setup([endTurnAction()], undefined, {
      humanPlayerIds: [],
      localPlayerIds: [],
    });
    let aiTurns = 0;
    harness.orchestrator.onTurnReady = () => {
      aiTurns += 1;
      return aiTurns === 1 ? [] : false;
    };
    harness.orchestrator.start();

    expect(aiTurns).toBeGreaterThan(0);
    expect(harness.localActions).toEqual([]);
  });
});

describe("BattleOrchestrator — à qui est le tour", () => {
  it("dit « à vous » quand une seule place est locale", () => {
    const harness = setup([endTurnAction()], undefined, {
      humanPlayerIds: ["player-1"],
      localPlayerIds: ["player-1"],
    });
    harness.orchestrator.onTurnReady = () => false;
    harness.orchestrator.start();

    expect(harness.turnInfos.at(-1)?.owner).toBe("you");
  });

  it("nomme le camp en hot-seat, où les deux places sont locales", () => {
    const harness = setup([endTurnAction()], undefined, {
      humanPlayerIds: ["player-1", "player-2"],
      localPlayerIds: ["player-1", "player-2"],
    });
    harness.orchestrator.onTurnReady = () => false;
    harness.orchestrator.start();

    expect(harness.turnInfos.at(-1)?.owner).toBe("player");
  });

  it("nomme le camp distant en ligne", () => {
    const harness = remoteHarness();

    expect(harness.turnInfos.at(-1)?.owner).toBe("player");
  });

  it("dit « IA » pour une place tenue par l'ordinateur", () => {
    const harness = setup([endTurnAction()], undefined, {
      humanPlayerIds: ["player-2"],
      localPlayerIds: ["player-2"],
    });
    harness.orchestrator.onTurnReady = () => false;
    harness.orchestrator.start();

    expect(harness.turnInfos.at(-1)?.owner).toBe("ai");
  });
});

describe("BattleOrchestrator — le forfait passe par la file d'animation", () => {
  it("joue les événements du forfait, au lieu de les perdre", () => {
    const harness = remoteHarness();

    const applied = harness.orchestrator.applyForfeit("player-1");

    expect(applied).toBe(true);
    expect(harness.forfeited).toEqual(["player-1"]);
    expect(harness.reportedEvents.some((event) => event.type === "battle_ended")).toBe(true);
  });

  it("reste sans effet quand le moteur refuse", () => {
    const harness = remoteHarness({ forfeitRefused: true });

    expect(harness.orchestrator.applyForfeit("player-1")).toBe(false);
    expect(harness.reportedEvents).toEqual([]);
  });
});

describe("BattleOrchestrator — une action distante hors de notre attente est gardée", () => {
  it("ne la refuse pas, et ne compte aucun refus", () => {
    const harness = setup([endTurnAction()], undefined, {
      humanPlayerIds: ["player-1"],
      localPlayerIds: ["player-1"],
    });
    harness.orchestrator.onTurnReady = () => false;
    harness.orchestrator.start();

    const applied = harness.orchestrator.submitRemoteAction({
      ...REMOTE,
      actionIndex: 0,
      action: endTurnAction(),
    });

    expect(applied).toBe(false);
    expect(harness.rejections).toEqual([]);
    expect(harness.submitted).toEqual([]);
  });

  it("la joue dès que l'attente commence", () => {
    let remote = false;
    const harness = setup([endTurnAction()], undefined, {
      humanPlayerIds: ["player-1"],
      localPlayerIds: ["player-2"],
    });
    harness.orchestrator.onTurnReady = () => (remote ? "pending" : false);
    harness.orchestrator.start();

    harness.orchestrator.submitRemoteAction({
      ...REMOTE,
      actionIndex: 0,
      action: endTurnAction(),
    });
    expect(harness.submitted).toEqual([]);

    remote = true;
    harness.orchestrator.onBoardConfirm(ACTIVE_POSITION);

    expect(harness.rejections).toEqual([]);
  });
});
