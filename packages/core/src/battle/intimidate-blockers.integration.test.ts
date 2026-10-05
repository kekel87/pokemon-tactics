import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { HeldItemId } from "../enums/held-item-id";
import { PlayerId } from "../enums/player-id";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { buildItemTestEngine, MockPokemon } from "../testing";
import type { PokemonInstance } from "../types/pokemon-instance";

/**
 * Intimidation (plan 227) : la baisse d'Attaque passe par les mêmes blocages qu'une baisse
 * infligée par une capacité — talent de la cible, objet, Brume — et réveille Acharné / Battant.
 */
function intimidator(): PokemonInstance {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "growlithe",
    definitionId: "growlithe",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    abilityId: "intimidate",
    derivedStats: { movement: 4, jump: 1, initiative: 100 },
  });
}

function adjacentEnemy(overrides: Partial<PokemonInstance>): PokemonInstance {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "enemy",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    ...overrides,
  });
}

function intimidateAt(enemyOverrides: Partial<PokemonInstance>) {
  const { engine, state } = buildItemTestEngine([intimidator(), adjacentEnemy(enemyOverrides)]);
  const enemy = state.pokemon.get("enemy");
  if (!enemy) {
    throw new Error("enemy missing from the battle state");
  }
  return { engine, enemy, startupEvents: engine.consumeStartupEvents() };
}

function intimidatorWalksAway(engine: ReturnType<typeof intimidateAt>["engine"]) {
  engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.Move,
    pokemonId: "growlithe",
    path: [
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ],
  });
}

function intimidatedStatus(enemy: PokemonInstance) {
  return enemy.volatileStatuses.find(
    (status) => status.type === StatusType.Intimidated && status.sourceId === "growlithe",
  );
}

describe("Intimidate blockers", () => {
  it.each(["clear-body", "hyper-cutter", "inner-focus", "oblivious", "scrappy", "own-tempo"])(
    "Given the target has %s, Then its Attack stays at 0 and its ability is announced",
    (abilityId) => {
      const { enemy, startupEvents } = intimidateAt({ abilityId });

      expect(enemy.statStages[StatName.Attack]).toBe(0);
      expect(
        startupEvents.some(
          (event) =>
            event.type === BattleEventType.AbilityActivated &&
            event.pokemonId === "enemy" &&
            event.abilityId === abilityId,
        ),
      ).toBe(true);
      // Statut posé sans baisse : Intimidation ne se redéclenche pas, et rien n'est rendu au départ.
      expect(intimidatedStatus(enemy)?.statChangeApplied).toBe(false);
    },
  );

  it("Given the target holds a Talisman Sain, Then its Attack stays at 0 and the item is announced", () => {
    const { enemy, startupEvents } = intimidateAt({ heldItemId: HeldItemId.ClearAmulet });

    expect(enemy.statStages[StatName.Attack]).toBe(0);
    expect(
      startupEvents.some(
        (event) =>
          event.type === BattleEventType.HeldItemActivated &&
          "itemId" in event &&
          event.itemId === HeldItemId.ClearAmulet,
      ),
    ).toBe(true);
    expect(intimidatedStatus(enemy)?.statChangeApplied).toBe(false);
  });

  it("Given the target has Acharné, Then Intimidate nets +1 Attack (-1 then +2)", () => {
    const { enemy } = intimidateAt({ abilityId: "defiant" });

    expect(enemy.statStages[StatName.Attack]).toBe(1);
    expect(intimidatedStatus(enemy)?.statChangeApplied).toBe(true);
  });

  it("Given the target has Battant, Then Intimidate lowers Attack and raises Sp. Atk by 2", () => {
    const { enemy } = intimidateAt({ abilityId: "competitive" });

    expect(enemy.statStages[StatName.Attack]).toBe(-1);
    expect(enemy.statStages[StatName.SpAttack]).toBe(2);
  });

  it("Given an Acharné target already at -6 Attack, Then nothing is lowered and nothing retaliates", () => {
    const { enemy } = intimidateAt({
      abilityId: "defiant",
      statStages: { ...MockPokemon.base.statStages, [StatName.Attack]: -6 },
    });

    expect(enemy.statStages[StatName.Attack]).toBe(-6);
    expect(intimidatedStatus(enemy)?.statChangeApplied).toBe(false);
  });

  it("Given an unprotected target, Then Intimidate still lowers Attack by 1", () => {
    const { enemy } = intimidateAt({});

    expect(enemy.statStages[StatName.Attack]).toBe(-1);
    expect(intimidatedStatus(enemy)?.statChangeApplied).toBe(true);
  });

  it.each([
    ["defiant", StatName.Attack],
    ["competitive", StatName.SpAttack],
  ])(
    "Given a %s target, When the intimidator walks away, Then its retaliation goes with the aura",
    (abilityId, retaliationStat) => {
      // Notre Intimidation est une aura : la baisse se rend à la sortie du contact. Sans rendre
      // aussi le +2, chaque aller-retour l'aurait cumulé (trouvé par /code-review, plan 227).
      const { engine, enemy } = intimidateAt({ abilityId });

      intimidatorWalksAway(engine);

      expect(intimidatedStatus(enemy)).toBeUndefined();
      expect(enemy.statStages[StatName.Attack]).toBe(0);
      expect(enemy.statStages[retaliationStat]).toBe(0);
    },
  );
});
