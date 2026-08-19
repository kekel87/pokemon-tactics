import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("knock-off", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("removes the target's held item and is not recyclable by the victim", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["knock-off"],
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      heldItemId: HeldItemId.Leftovers,
    });
    const { engine, state } = buildItemTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "knock-off",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.ItemKnockedOff);
    expect(state.pokemon.get(defender.id)?.heldItemId).toBeUndefined();
    expect(state.pokemon.get(defender.id)?.consumedItemId).toBeUndefined();
  });

  it("deals more damage when the target carries an item", () => {
    // Les deux moteurs doivent tirer le MÊME jet, sinon la comparaison mesure l'aléa (variance de
    // dégâts + coup critique) au lieu du bonus d'objet : un critique sur le run sans objet inverse
    // le résultat ~2 % des exécutions. 0.5 touche, ne critique pas, jet médian de part et d'autre.
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const makeAttacker = () =>
      MockPokemon.fresh(MockPokemon.base, {
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        moveIds: ["knock-off"],
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
    const makeDefender = (heldItemId?: HeldItemId) =>
      MockPokemon.fresh(MockPokemon.charmander, {
        id: "defender",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 0 },
        heldItemId,
      });

    const withItem = buildItemTestEngine([makeAttacker(), makeDefender(HeldItemId.Leftovers)]);
    const beforeWith = withItem.state.pokemon.get("defender")?.currentHp ?? 0;
    withItem.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "pokemon-1",
      moveId: "knock-off",
      targetPosition: { x: 1, y: 0 },
    });
    const dealtWith = beforeWith - (withItem.state.pokemon.get("defender")?.currentHp ?? 0);

    const without = buildItemTestEngine([makeAttacker(), makeDefender(undefined)]);
    const beforeWithout = without.state.pokemon.get("defender")?.currentHp ?? 0;
    without.engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "pokemon-1",
      moveId: "knock-off",
      targetPosition: { x: 1, y: 0 },
    });
    const dealtWithout = beforeWithout - (without.state.pokemon.get("defender")?.currentHp ?? 0);

    expect(dealtWith).toBeGreaterThan(dealtWithout);
  });
});
