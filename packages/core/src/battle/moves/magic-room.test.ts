import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { FieldGlobalKind } from "../../enums/field-global-kind";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildItemTestEngine, buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";
import { postFieldGlobalZone } from "../field-global-system";

// Zone Magique (magic-room) — move integration tests.

function buildScenario() {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 5 },
    moveIds: ["tackle"],
    currentPp: { tackle: 10 },
    heldItemId: HeldItemId.LifeOrb,
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 6, y: 5 },
    combatStats: { hp: 300, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
  });
  return buildItemTestEngine([caster, foe], 12, "caster");
}

describe("magic-room — zone posting", () => {
  it("posts a MagicRoom field-global zone", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 5, y: 5 },
      moveIds: ["magic-room"],
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 9, y: 9 },
    });
    const { engine, state } = buildMoveTestEngine([caster, foe], { gridSize: 12 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "magic-room",
      targetPosition: { x: 5, y: 5 },
    });

    expect(result.success).toBe(true);
    expect(state.fieldGlobalZones[0]?.kind).toBe(FieldGlobalKind.MagicRoom);
  });
});

describe("magic-room — suppresses held items", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("nullifies the attacker's Life Orb damage boost inside the zone", () => {
    // Deterministic roll (no crit, fixed damage factor) so the ×1.3 Life Orb boost is always visible:
    // an unseeded crit on either hit could otherwise flip the comparison.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const suppressed = buildScenario();
    const suppressedCaster = suppressed.state.pokemon.get("caster");
    if (!suppressedCaster) {
      throw new Error("missing caster");
    }
    postFieldGlobalZone(suppressed.state, suppressedCaster, FieldGlobalKind.MagicRoom);
    const suppressedHit = suppressed.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "tackle",
      targetPosition: { x: 6, y: 5 },
    });

    const boosted = buildScenario();
    const boostedHit = boosted.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "tackle",
      targetPosition: { x: 6, y: 5 },
    });

    expect(damageTo(boostedHit.events, "foe")).toBeGreaterThan(
      damageTo(suppressedHit.events, "foe"),
    );
  });

  it("cancels the attacker's Life Orb recoil inside the zone", () => {
    const suppressed = buildScenario();
    const suppressedCaster = suppressed.state.pokemon.get("caster");
    if (!suppressedCaster) {
      throw new Error("missing caster");
    }
    postFieldGlobalZone(suppressed.state, suppressedCaster, FieldGlobalKind.MagicRoom);
    suppressed.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "tackle",
      targetPosition: { x: 6, y: 5 },
    });
    expect(suppressed.state.pokemon.get("caster")?.currentHp).toBe(suppressedCaster.maxHp);

    const boosted = buildScenario();
    const boostedCaster = boosted.state.pokemon.get("caster");
    boosted.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "tackle",
      targetPosition: { x: 6, y: 5 },
    });
    expect(boosted.state.pokemon.get("caster")?.currentHp).toBeLessThan(boostedCaster?.maxHp ?? 0);
  });
});

// Zone Magique neutralises the live effect of five held items whose canon behaviour is otherwise
// invisible outside a real fight (secondary-block, trapping items, weight-based power). Each block
// pilots a full move end-to-end: the holder standing INSIDE the zone loses the item's effect, and a
// zone-less control ("out of the zone") proves the effect is restored. The unit chokepoints
// (effectiveHeldItem / effectiveWeight) are covered elsewhere; here we assert the battle outcome.

/** Attacker (5,5) and defender (6,5) sit adjacent inside the r3 diamond of a zone anchored on the
 *  attacker — so posting it covers both a holder-attacker (grip/binding) and a holder-defender
 *  (cloak/shell/stone). `inZone: false` skips the post → the item is live (control). */
function magicRoomItemScenario(config: {
  readonly attackerMove: string;
  readonly attackerItem?: HeldItemId;
  readonly defenderItem?: HeldItemId;
  readonly defenderWeight?: number;
  readonly inZone: boolean;
}) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 5, y: 5 },
    moveIds: [config.attackerMove],
    currentPp: { [config.attackerMove]: 10 },
    combatStats: { hp: 100, attack: 120, defense: 50, spAttack: 120, spDefense: 50, speed: 80 },
    ...(config.attackerItem ? { heldItemId: config.attackerItem } : {}),
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: 6, y: 5 },
    combatStats: { hp: 400, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 40 },
    ...(config.defenderWeight === undefined ? {} : { weight: config.defenderWeight }),
    ...(config.defenderItem ? { heldItemId: config.defenderItem } : {}),
  });
  const built = buildItemTestEngine([attacker, defender], 12, "attacker");
  if (config.inZone) {
    const zoneAttacker = built.state.pokemon.get("attacker");
    if (!zoneAttacker) {
      throw new Error("missing attacker");
    }
    postFieldGlobalZone(built.state, zoneAttacker, FieldGlobalKind.MagicRoom);
  }
  return built;
}

function useAttackerMove(built: ReturnType<typeof magicRoomItemScenario>, moveId: string) {
  return built.engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: "attacker",
    moveId,
    targetPosition: { x: 6, y: 5 },
  });
}

describe("magic-room — Cape Obscure (covert-cloak) neutralisation", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lets an incoming secondary land on the holder standing in the zone", () => {
    // Given a Cape Obscure holder standing inside a Zone Magique
    // When it is hit by Éclat Magique (moonblast, -1 SpAtk secondary)
    const scenario = magicRoomItemScenario({
      attackerMove: "moonblast",
      defenderItem: HeldItemId.CovertCloak,
      inZone: true,
    });
    const result = useAttackerMove(scenario, "moonblast");

    // Then the shield is suppressed and the SpAtk drop applies
    expect(scenario.state.pokemon.get("defender")?.statStages.spAttack).toBe(-1);
    expect(
      result.events.some(
        (event) =>
          event.type === BattleEventType.HeldItemActivated &&
          event.itemId === HeldItemId.CovertCloak,
      ),
    ).toBe(false);
  });

  it("shields the holder from the same secondary once out of the zone", () => {
    // Given the same holder with no Zone Magique in play
    const scenario = magicRoomItemScenario({
      attackerMove: "moonblast",
      defenderItem: HeldItemId.CovertCloak,
      inZone: false,
    });
    const result = useAttackerMove(scenario, "moonblast");

    // Then the Cape Obscure blocks the secondary again
    expect(scenario.state.pokemon.get("defender")?.statStages.spAttack).toBe(0);
    expect(
      result.events.some(
        (event) =>
          event.type === BattleEventType.HeldItemActivated &&
          event.itemId === HeldItemId.CovertCloak,
      ),
    ).toBe(true);
  });
});

describe("magic-room — Carapace Mue (shed-shell) neutralisation", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lets a trap take hold on the holder standing in the zone", () => {
    // Given a Carapace Mue holder standing inside a Zone Magique
    // When Ligotage (bind) hits it
    const scenario = magicRoomItemScenario({
      attackerMove: "bind",
      defenderItem: HeldItemId.ShedShell,
      inZone: true,
    });
    useAttackerMove(scenario, "bind");

    // Then the trapping immunity is suppressed and the target is bound
    expect(
      scenario.state.pokemon
        .get("defender")
        ?.volatileStatuses.some((status) => status.type === StatusType.Trapped),
    ).toBe(true);
  });

  it("keeps the holder untrappable once out of the zone", () => {
    // Given the same holder with no Zone Magique in play
    const scenario = magicRoomItemScenario({
      attackerMove: "bind",
      defenderItem: HeldItemId.ShedShell,
      inZone: false,
    });
    const result = useAttackerMove(scenario, "bind");

    // Then Carapace Mue blocks the trap
    expect(
      scenario.state.pokemon
        .get("defender")
        ?.volatileStatuses.some((status) => status.type === StatusType.Trapped),
    ).toBe(false);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.StatusBlocked);
  });
});

describe("magic-room — Accro Griffe (grip-claw) neutralisation", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lets the trap roll its natural duration when the attacker stands in the zone", () => {
    // Given an Accro Griffe attacker standing inside a Zone Magique (random roll -> min duration 4)
    // When it binds the target
    const scenario = magicRoomItemScenario({
      attackerMove: "bind",
      attackerItem: HeldItemId.GripClaw,
      inZone: true,
    });
    useAttackerMove(scenario, "bind");

    // Then the duration-maximising effect is suppressed (rolled value, not the forced 5)
    const trapped = scenario.state.pokemon
      .get("defender")
      ?.volatileStatuses.find((status) => status.type === StatusType.Trapped);
    expect(trapped?.remainingTurns).toBe(4);
  });

  it("forces the trap to its maximum duration once out of the zone", () => {
    // Given the same attacker with no Zone Magique in play
    const scenario = magicRoomItemScenario({
      attackerMove: "bind",
      attackerItem: HeldItemId.GripClaw,
      inZone: false,
    });
    useAttackerMove(scenario, "bind");

    // Then Accro Griffe pins the trap to its maximum duration again
    const trapped = scenario.state.pokemon
      .get("defender")
      ?.volatileStatuses.find((status) => status.type === StatusType.Trapped);
    expect(trapped?.remainingTurns).toBe(5);
  });
});

describe("magic-room — Bande Étreinte (binding-band) neutralisation", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("halves the trap chip back to base when the attacker stands in the zone", () => {
    // Given a Bande Étreinte attacker standing inside a Zone Magique
    // When it binds the target
    const scenario = magicRoomItemScenario({
      attackerMove: "bind",
      attackerItem: HeldItemId.BindingBand,
      inZone: true,
    });
    useAttackerMove(scenario, "bind");

    // Then the chip-doubling is suppressed (base 1/8 chip)
    const trapped = scenario.state.pokemon
      .get("defender")
      ?.volatileStatuses.find((status) => status.type === StatusType.Trapped);
    expect(trapped?.damagePerTurn).toBeCloseTo(0.125);
  });

  it("doubles the trap chip once out of the zone", () => {
    // Given the same attacker with no Zone Magique in play
    const scenario = magicRoomItemScenario({
      attackerMove: "bind",
      attackerItem: HeldItemId.BindingBand,
      inZone: false,
    });
    useAttackerMove(scenario, "bind");

    // Then Bande Étreinte doubles the chip again
    const trapped = scenario.state.pokemon
      .get("defender")
      ?.volatileStatuses.find((status) => status.type === StatusType.Trapped);
    expect(trapped?.damagePerTurn).toBeCloseTo(0.25);
  });
});

describe("magic-room — Pierrallégée (float-stone) neutralisation", () => {
  beforeEach(() => {
    // Fixed roll so the weight-power boundary (100 kg -> 100 BP vs halved 50 kg -> 80 BP) drives the
    // damage difference, not an unseeded crit/spread.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores the holder's full body weight when it stands in the zone", () => {
    // Given a 100 kg Pierrallégée holder standing inside a Zone Magique
    // When it is hit by Balayage (low-kick, power scales with target weight)
    const inZone = magicRoomItemScenario({
      attackerMove: "low-kick",
      defenderItem: HeldItemId.FloatStone,
      defenderWeight: 100,
      inZone: true,
    });
    const inZoneHit = useAttackerMove(inZone, "low-kick");

    // And the same holder out of the zone (Pierrallégée still halving its weight)
    const outOfZone = magicRoomItemScenario({
      attackerMove: "low-kick",
      defenderItem: HeldItemId.FloatStone,
      defenderWeight: 100,
      inZone: false,
    });
    const outOfZoneHit = useAttackerMove(outOfZone, "low-kick");

    // Then the un-halved weight pushes low-kick into a higher power bracket -> more damage
    expect(damageTo(inZoneHit.events, "defender")).toBeGreaterThan(
      damageTo(outOfZoneHit.events, "defender"),
    );
  });
});
