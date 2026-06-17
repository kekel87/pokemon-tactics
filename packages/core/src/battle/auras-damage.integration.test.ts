import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { AuraKind } from "../enums/aura-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { PlayerId } from "../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import { postAura } from "./aura-system";

const STRONG_PHYS_ATTACK = {
  hp: 100,
  attack: 200,
  defense: 50,
  spAttack: 50,
  spDefense: 50,
  speed: 50,
};

const STRONG_SPECIAL_ATTACK = {
  hp: 100,
  attack: 50,
  defense: 50,
  spAttack: 200,
  spDefense: 50,
  speed: 50,
};

// ---------------------------------------------------------------------------
// Reflect reduces Physical damage by ~half
// ---------------------------------------------------------------------------

describe("Reflect aura — Physical damage reduction", () => {
  it("halves damage from a Physical move when target sits in caster's Reflect aura", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const baselineAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      combatStats: STRONG_PHYS_ATTACK,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const baselineTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: 1000,
      maxHp: 1000,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: baselineEngine, state: baselineState } = buildMoveTestEngine(
      [baselineTarget, baselineAttacker],
      { activePokemonId: "attacker" },
    );
    baselineEngine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 0, y: 0 },
    });
    const baselineDamage = 1000 - (baselineState.pokemon.get("target")?.currentHp ?? 1000);

    const screenAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      combatStats: STRONG_PHYS_ATTACK,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const screenTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: 1000,
      maxHp: 1000,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: screenEngine, state: screenState } = buildMoveTestEngine(
      [screenTarget, screenAttacker],
      { activePokemonId: "attacker" },
    );
    postAura(screenState, screenTarget, AuraKind.Reflect);

    screenEngine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "tackle",
      targetPosition: { x: 0, y: 0 },
    });
    const reducedDamage = 1000 - (screenState.pokemon.get("target")?.currentHp ?? 1000);

    expect(reducedDamage).toBeLessThan(baselineDamage);
    expect(reducedDamage).toBeCloseTo(baselineDamage * 0.5, -1);
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// Light Screen reduces Special damage by ~half
// ---------------------------------------------------------------------------

describe("Light Screen aura — Special damage reduction", () => {
  it("halves damage from a Special move when target sits in caster's Light Screen aura", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const baselineAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["water-gun"],
      currentPp: { "water-gun": 25 },
      combatStats: STRONG_SPECIAL_ATTACK,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const baselineTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: 1000,
      maxHp: 1000,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: baselineEngine, state: baselineState } = buildMoveTestEngine(
      [baselineTarget, baselineAttacker],
      { activePokemonId: "attacker" },
    );
    baselineEngine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "water-gun",
      targetPosition: { x: 0, y: 0 },
    });
    const baselineDamage = 1000 - (baselineState.pokemon.get("target")?.currentHp ?? 1000);

    const screenAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["water-gun"],
      currentPp: { "water-gun": 25 },
      combatStats: STRONG_SPECIAL_ATTACK,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const screenTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: 1000,
      maxHp: 1000,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: screenEngine, state: screenState } = buildMoveTestEngine(
      [screenTarget, screenAttacker],
      { activePokemonId: "attacker" },
    );
    postAura(screenState, screenTarget, AuraKind.LightScreen);

    screenEngine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "water-gun",
      targetPosition: { x: 0, y: 0 },
    });
    const reducedDamage = 1000 - (screenState.pokemon.get("target")?.currentHp ?? 1000);

    expect(reducedDamage).toBeLessThan(baselineDamage);
    expect(reducedDamage).toBeCloseTo(baselineDamage * 0.5, -1);
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// Brick Break vs aura caster in melee — ×2 + breaks aura
// ---------------------------------------------------------------------------

describe("Brick Break vs caster of aura in melee", () => {
  it("deals ×2 damage and breaks the caster's aura with AuraBroken event", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const baselineAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["brick-break"],
      currentPp: { "brick-break": 15 },
      combatStats: STRONG_PHYS_ATTACK,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const baselineTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: 1000,
      maxHp: 1000,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: baselineEngine, state: baselineState } = buildMoveTestEngine(
      [baselineTarget, baselineAttacker],
      { activePokemonId: "attacker" },
    );
    baselineEngine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "brick-break",
      targetPosition: { x: 0, y: 0 },
    });
    const baselineDamage = 1000 - (baselineState.pokemon.get("caster")?.currentHp ?? 1000);

    const auraAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["brick-break"],
      currentPp: { "brick-break": 15 },
      combatStats: STRONG_PHYS_ATTACK,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const auraCaster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: 1000,
      maxHp: 1000,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: auraEngine, state: auraState } = buildMoveTestEngine(
      [auraCaster, auraAttacker],
      { activePokemonId: "attacker" },
    );
    postAura(auraState, auraCaster, AuraKind.Reflect);

    const brokenEvents: unknown[] = [];
    auraEngine.on(BattleEventType.AuraBroken, (e) => brokenEvents.push(e));

    auraEngine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "brick-break",
      targetPosition: { x: 0, y: 0 },
    });
    const boostedDamage = 1000 - (auraState.pokemon.get("caster")?.currentHp ?? 1000);

    expect(boostedDamage).toBeGreaterThan(baselineDamage);
    expect(boostedDamage).toBeCloseTo(baselineDamage * 2, -1);
    expect(auraState.auras.some((aura) => aura.casterPokemonId === "caster")).toBe(false);
    expect(brokenEvents).toHaveLength(1);
    expect(brokenEvents[0]).toMatchObject({
      casterId: "caster",
      kind: AuraKind.Reflect,
      breakerId: "attacker",
      breakerMoveId: "brick-break",
    });
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// Brick Break vs protected ally (not caster) — Reflect still applies, no break
// ---------------------------------------------------------------------------

describe("Brick Break vs protected ally of aura caster", () => {
  it("deals reduced damage (Reflect ×0.5) and leaves the ally aura intact", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const baselineAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      moveIds: ["brick-break"],
      currentPp: { "brick-break": 15 },
      combatStats: STRONG_PHYS_ATTACK,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const baselineTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 0 },
      currentHp: 1000,
      maxHp: 1000,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const baselineCaster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const { engine: baselineEngine, state: baselineState } = buildMoveTestEngine(
      [baselineCaster, baselineTarget, baselineAttacker],
      { activePokemonId: "attacker" },
    );
    baselineEngine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "brick-break",
      targetPosition: { x: 2, y: 0 },
    });
    const baselineDamage = 1000 - (baselineState.pokemon.get("ally")?.currentHp ?? 1000);

    const auraAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      moveIds: ["brick-break"],
      currentPp: { "brick-break": 15 },
      combatStats: STRONG_PHYS_ATTACK,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const auraTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 0 },
      currentHp: 1000,
      maxHp: 1000,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const auraCaster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const { engine: auraEngine, state: auraState } = buildMoveTestEngine(
      [auraCaster, auraTarget, auraAttacker],
      { activePokemonId: "attacker" },
    );
    postAura(auraState, auraCaster, AuraKind.Reflect);

    const brokenEvents: unknown[] = [];
    auraEngine.on(BattleEventType.AuraBroken, (e) => brokenEvents.push(e));

    auraEngine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "brick-break",
      targetPosition: { x: 2, y: 0 },
    });
    const reducedDamage = 1000 - (auraState.pokemon.get("ally")?.currentHp ?? 1000);

    expect(reducedDamage).toBeLessThan(baselineDamage);
    expect(reducedDamage).toBeCloseTo(baselineDamage * 0.5, -1);
    expect(auraState.auras.some((aura) => aura.casterPokemonId === "caster")).toBe(true);
    expect(brokenEvents).toHaveLength(0);
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// Brick Break vs target outside aura — normal damage, no break
// ---------------------------------------------------------------------------

describe("Brick Break vs unprotected target", () => {
  it("deals normal damage and does not touch any aura", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["brick-break"],
      currentPp: { "brick-break": 15 },
      combatStats: STRONG_PHYS_ATTACK,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: 1000,
      maxHp: 1000,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const farCaster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 11, y: 11 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const { engine, state } = buildMoveTestEngine([target, attacker, farCaster], {
      activePokemonId: "attacker",
    });
    postAura(state, farCaster, AuraKind.Reflect);

    const brokenEvents: unknown[] = [];
    engine.on(BattleEventType.AuraBroken, (e) => brokenEvents.push(e));

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "brick-break",
      targetPosition: { x: 0, y: 0 },
    });

    expect(state.auras.some((aura) => aura.casterPokemonId === "caster")).toBe(true);
    expect(brokenEvents).toHaveLength(0);
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// Brick Break vs double-protected caster — ×2 + breaks own aura, leaves ally aura
// ---------------------------------------------------------------------------

describe("Brick Break vs double-protected caster in melee", () => {
  it("breaks only the target's own aura, leaves ally aura intact", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      moveIds: ["brick-break"],
      currentPp: { "brick-break": 15 },
      combatStats: STRONG_PHYS_ATTACK,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 0 },
      currentHp: 1000,
      maxHp: 1000,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const ally = MockPokemon.fresh(MockPokemon.base, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const { engine, state } = buildMoveTestEngine([ally, target, attacker], {
      activePokemonId: "attacker",
    });
    postAura(state, ally, AuraKind.Reflect);
    postAura(state, target, AuraKind.Reflect);

    const brokenEvents: unknown[] = [];
    engine.on(BattleEventType.AuraBroken, (e) => brokenEvents.push(e));

    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "brick-break",
      targetPosition: { x: 2, y: 0 },
    });

    expect(state.auras.some((aura) => aura.casterPokemonId === "target")).toBe(false);
    expect(state.auras.some((aura) => aura.casterPokemonId === "ally")).toBe(true);
    expect(brokenEvents).toHaveLength(1);
    expect(brokenEvents[0]).toMatchObject({ casterId: "target" });
    vi.restoreAllMocks();
  });
});
