import { describe, expect, it } from "vitest";
import { BattleEventType } from "../../enums/battle-event-type";
import { EffectKind } from "../../enums/effect-kind";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { ScreenKind } from "../../enums/screen-kind";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { Effect } from "../../types/effect";
import { handlePostScreen } from "./handle-post-screen";

function buildPostScreenContext(
  caster: ReturnType<typeof MockPokemon.fresh>,
  screen: ScreenKind,
  state: ReturnType<typeof buildMoveTestEngine>["state"],
) {
  const effect: Extract<Effect, { kind: typeof EffectKind.PostScreen }> = {
    kind: EffectKind.PostScreen,
    screen,
  };
  return {
    attacker: caster,
    targets: [],
    move: {} as never,
    effect,
    state,
    typeChart: {} as never,
    attackerTypes: [],
    targetTypesMap: new Map(),
    targetPosition: caster.position,
    random: () => 0.5,
    heightModifier: 1,
    terrainModifier: 1,
    facingModifierMap: new Map(),
    shared: { lastDamageDealt: 0 },
  };
}

describe("handlePostScreen — Reflect", () => {
  it("inserts a Reflect aura with default duration (5) and emits ScreenPosted", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const { state } = buildMoveTestEngine([caster]);

    const events = handlePostScreen(buildPostScreenContext(caster, ScreenKind.Reflect, state));

    const aura = state.screens.find(
      (entry) => entry.casterPokemonId === caster.id && entry.kind === ScreenKind.Reflect,
    );
    expect(aura).toBeDefined();
    expect(aura?.remainingRounds).toBe(5);
    expect(aura?.casterPokemonId).toBe(caster.id);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: BattleEventType.ScreenPosted,
      casterId: caster.id,
      kind: ScreenKind.Reflect,
      durationRounds: 5,
    });
  });
});

describe("handlePostScreen — Light Screen", () => {
  it("inserts a Light Screen aura with default duration (5)", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const { state } = buildMoveTestEngine([caster]);

    handlePostScreen(buildPostScreenContext(caster, ScreenKind.LightScreen, state));

    const aura = state.screens.find(
      (entry) => entry.casterPokemonId === caster.id && entry.kind === ScreenKind.LightScreen,
    );
    expect(aura).toBeDefined();
    expect(aura?.remainingRounds).toBe(5);
  });
});

describe("handlePostScreen — Light Clay extends duration", () => {
  it("posts an aura for 8 rounds when caster holds Light Clay", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
      heldItemId: HeldItemId.LightClay,
    });
    const { state } = buildMoveTestEngine([caster]);

    const events = handlePostScreen(buildPostScreenContext(caster, ScreenKind.Reflect, state));

    const aura = state.screens.find(
      (entry) => entry.casterPokemonId === caster.id && entry.kind === ScreenKind.Reflect,
    );
    expect(aura?.remainingRounds).toBe(8);
    expect(events[0]).toMatchObject({ durationRounds: 8 });
  });
});

describe("handlePostScreen — same caster keeps both kinds simultaneously", () => {
  it("posts Reflect and Light Screen separately for one caster", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const { state } = buildMoveTestEngine([caster]);

    handlePostScreen(buildPostScreenContext(caster, ScreenKind.Reflect, state));
    handlePostScreen(buildPostScreenContext(caster, ScreenKind.LightScreen, state));

    expect(state.screens.length).toBe(2);
    expect(state.screens.filter((entry) => entry.casterPokemonId === caster.id)).toHaveLength(2);
  });
});

describe("handlePostScreen — recasting same kind overwrites duration", () => {
  it("replaces an existing Reflect aura with a fresh one when same caster recasts Reflect", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 2, y: 2 },
    });
    const { state } = buildMoveTestEngine([caster]);

    handlePostScreen(buildPostScreenContext(caster, ScreenKind.Reflect, state));
    const firstAura = state.screens.find(
      (entry) => entry.casterPokemonId === caster.id && entry.kind === ScreenKind.Reflect,
    );
    if (firstAura) {
      firstAura.remainingRounds = 2;
    }
    handlePostScreen(buildPostScreenContext(caster, ScreenKind.Reflect, state));

    const reflectsOnCaster = state.screens.filter(
      (entry) => entry.casterPokemonId === caster.id && entry.kind === ScreenKind.Reflect,
    );
    expect(reflectsOnCaster).toHaveLength(1);
    expect(reflectsOnCaster[0]?.remainingRounds).toBe(5);
  });
});
