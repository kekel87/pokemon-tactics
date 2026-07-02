import { itemHandlers, loadData } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { BattleEventType } from "../../enums/battle-event-type";
import { EffectKind } from "../../enums/effect-kind";
import { HeldItemId } from "../../enums/held-item-id";
import { PokemonType } from "../../enums/pokemon-type";
import { StatusType } from "../../enums/status-type";
import { Weather } from "../../enums/weather";
import { MockMove, MockPokemon } from "../../testing";
import type { BattleState } from "../../types/battle-state";
import type { ItemAccuracyContext } from "../../types/held-item-definition";
import type { MoveDefinition } from "../../types/move-definition";
import type { PokemonInstance } from "../../types/pokemon-instance";
import { processEffects } from "../effect-processor";

function flinchContext(self: PokemonInstance, target: PokemonInstance): ItemAccuracyContext {
  return { self, target, move: MockMove.fresh(MockMove.physical) };
}

describe("Roche Royale (kings-rock)", () => {
  const handler = itemHandlers.find((h) => h.id === HeldItemId.KingsRock);

  it("Given any damaging move, When checking flinch, Then chance is 10", () => {
    const ctx = flinchContext(
      MockPokemon.fresh(MockPokemon.base, { id: "holder" }),
      MockPokemon.fresh(MockPokemon.base, { id: "foe" }),
    );
    expect(handler?.onFlinchChance?.(ctx)).toBe(10);
  });
});

describe("Croc Rasoir (razor-fang)", () => {
  const handler = itemHandlers.find((h) => h.id === HeldItemId.RazorFang);

  it("Given any damaging move, When checking flinch, Then chance is 10", () => {
    const ctx = flinchContext(
      MockPokemon.fresh(MockPokemon.base, { id: "holder" }),
      MockPokemon.fresh(MockPokemon.base, { id: "foe" }),
    );
    expect(handler?.onFlinchChance?.(ctx)).toBe(10);
  });
});

const itemRegistry = loadData().itemRegistry;
const simpleChart = {
  [PokemonType.Normal]: { [PokemonType.Normal]: 1 },
} as Record<PokemonType, Record<PokemonType, number>>;

function makeContext(
  attacker: PokemonInstance,
  target: PokemonInstance,
  move: MoveDefinition,
  random: () => number,
) {
  const state: BattleState = {
    grid: [],
    pokemon: new Map(),
    turnOrder: [],
    currentTurnIndex: 0,
    roundNumber: 1,
    predictedNextRoundOrder: [],
    weather: Weather.None,
    weatherTurnsRemaining: 0,
    auras: [],
    fieldTerrains: [],
    distortionZones: [],
    fieldGlobalZones: [],
    entryHazards: [],
    pendingStrikes: [],
  };
  return {
    attacker,
    targets: [target],
    move,
    state,
    typeChart: simpleChart,
    attackerTypes: [PokemonType.Normal] as PokemonType[],
    targetTypesMap: new Map([[target.id, [PokemonType.Normal] as PokemonType[]]]),
    random,
    heightModifier: 1.0,
    terrainModifier: 1.0,
    facingModifierMap: new Map<string, number>(),
    itemRegistry,
  };
}

function hasFlinch(pokemon: PokemonInstance): boolean {
  return pokemon.volatileStatuses.some((status) => status.type === StatusType.Flinch);
}

const damagingMove = MockMove.fresh(MockMove.physical, { effects: [{ kind: EffectKind.Damage }] });

describe("processEffects — flinch-on-hit items", () => {
  it("Given a Roche Royale holder lands a damaging move and the roll succeeds, Then the target flinches", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      heldItemId: HeldItemId.KingsRock,
    });
    const target = MockPokemon.fresh(MockPokemon.base, { id: "foe", currentHp: 100, maxHp: 100 });

    const events = processEffects(makeContext(attacker, target, damagingMove, () => 0.01));

    expect(hasFlinch(target)).toBe(true);
    expect(
      events.some(
        (e) => e.type === BattleEventType.StatusApplied && e.status === StatusType.Flinch,
      ),
    ).toBe(true);
  });

  it("Given a Roche Royale holder lands a damaging move but the roll fails, Then the target does not flinch", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      heldItemId: HeldItemId.KingsRock,
    });
    const target = MockPokemon.fresh(MockPokemon.base, { id: "foe", currentHp: 100, maxHp: 100 });

    processEffects(makeContext(attacker, target, damagingMove, () => 0.99));

    expect(hasFlinch(target)).toBe(false);
  });

  it("Given the move already inflicts flinch, Then the item adds no extra flinch", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      heldItemId: HeldItemId.KingsRock,
    });
    const target = MockPokemon.fresh(MockPokemon.base, { id: "foe", currentHp: 100, maxHp: 100 });
    const ownFlinchMove = MockMove.fresh(MockMove.physical, {
      effects: [
        { kind: EffectKind.Damage },
        { kind: EffectKind.Status, status: StatusType.Flinch, chance: 0 },
      ],
    });

    processEffects(makeContext(attacker, target, ownFlinchMove, () => 0.01));

    expect(hasFlinch(target)).toBe(false);
  });

  it("Given the target faints from the hit, Then no flinch is applied", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      heldItemId: HeldItemId.KingsRock,
    });
    const target = MockPokemon.fresh(MockPokemon.base, { id: "foe", currentHp: 1, maxHp: 100 });

    processEffects(makeContext(attacker, target, damagingMove, () => 0.01));

    expect(hasFlinch(target)).toBe(false);
  });
});
