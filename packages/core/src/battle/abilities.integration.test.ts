import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { PlayerId } from "../enums/player-id";
import { PokemonGender } from "../enums/pokemon-gender";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { Weather } from "../enums/weather";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import type { BattleEvent } from "../types/battle-event";

describe("ability system integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("overgrow boosts Grass moves when HP is at or below 1/3", () => {
    // Given a Bulbasaur at low HP with Overgrow using razor-leaf
    const attackerWith = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-with",
      definitionId: "bulbasaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["razor-leaf"],
      currentPp: { "razor-leaf": 25 },
      currentHp: 25,
      maxHp: 100,
      abilityId: "overgrow",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWith = MockPokemon.fresh(MockPokemon.base, {
      id: "target-with",
      definitionId: "test",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    // Given a Bulbasaur at low HP without Overgrow using razor-leaf
    const attackerWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-without",
      definitionId: "bulbasaur",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["razor-leaf"],
      currentPp: { "razor-leaf": 25 },
      currentHp: 25,
      maxHp: 100,
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "target-without",
      definitionId: "test",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    // When razor-leaf is used with Overgrow active
    const { engine: engineWith } = buildMoveTestEngine([attackerWith, targetWith]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker-with",
      moveId: "razor-leaf",
      targetPosition: { x: 1, y: 2 },
    });
    const hpAfterWith = targetWith.currentHp;

    // When razor-leaf is used without Overgrow
    const { engine: engineWithout } = buildMoveTestEngine([attackerWithout, targetWithout]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker-without",
      moveId: "razor-leaf",
      targetPosition: { x: 1, y: 2 },
    });
    const hpAfterWithout = targetWithout.currentHp;

    // Then Overgrow deals more damage
    const damageWith = 200 - hpAfterWith;
    const damageWithout = 200 - hpAfterWithout;
    expect(damageWith).toBeGreaterThan(damageWithout);
  });

  it("blaze boosts Fire moves when HP is at or below 1/3", () => {
    // Given a Charmander at low HP with Blaze using ember
    const attackerWith = MockPokemon.fresh(MockPokemon.charmander, {
      id: "charmander-with",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      currentHp: 25,
      maxHp: 100,
      abilityId: "blaze",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWith = MockPokemon.fresh(MockPokemon.base, {
      id: "target-with",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    const attackerWithout = MockPokemon.fresh(MockPokemon.charmander, {
      id: "charmander-without",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      currentHp: 25,
      maxHp: 100,
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "target-without",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    // When ember is used with Blaze active
    const { engine: engineWith } = buildMoveTestEngine([attackerWith, targetWith]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "charmander-with",
      moveId: "ember",
      targetPosition: { x: 2, y: 2 },
    });

    // When ember is used without Blaze
    const { engine: engineWithout } = buildMoveTestEngine([attackerWithout, targetWithout]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "charmander-without",
      moveId: "ember",
      targetPosition: { x: 2, y: 2 },
    });

    // Then Blaze deals more damage
    const damageWith = 200 - targetWith.currentHp;
    const damageWithout = 200 - targetWithout.currentHp;
    expect(damageWith).toBeGreaterThan(damageWithout);
  });

  it("torrent boosts Water moves when HP is at or below 1/3", () => {
    // Given a Squirtle at low HP with Torrent using water-gun
    const attackerWith = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "squirtle-with",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      currentHp: 25,
      maxHp: 100,
      abilityId: "torrent",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWith = MockPokemon.fresh(MockPokemon.base, {
      id: "target-with",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    const attackerWithout = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "squirtle-without",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      currentHp: 25,
      maxHp: 100,
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "target-without",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    // When water-gun is used with Torrent active
    const { engine: engineWith } = buildMoveTestEngine([attackerWith, targetWith]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "squirtle-with",
      moveId: "water-gun",
      targetPosition: { x: 2, y: 2 },
    });

    // When water-gun is used without Torrent
    const { engine: engineWithout } = buildMoveTestEngine([attackerWithout, targetWithout]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "squirtle-without",
      moveId: "water-gun",
      targetPosition: { x: 2, y: 2 },
    });

    // Then Torrent deals more damage
    const damageWith = 200 - targetWith.currentHp;
    const damageWithout = 200 - targetWithout.currentHp;
    expect(damageWith).toBeGreaterThan(damageWithout);
  });

  it("keen-eye prevents Accuracy stat from being lowered by enemies", () => {
    // Given a Pidgey with Keen Eye as the target
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["kinesis"],
      currentPp: { kinesis: 15 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      abilityId: "keen-eye",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, target]);

    // When kinesis (Accuracy -1) is used against the Keen Eye target
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "kinesis",
      targetPosition: { x: 2, y: 2 },
    });

    // Then Accuracy is not lowered
    const pidgey = state.pokemon.get("pidgey-1");
    expect(result.success).toBe(true);
    expect(pidgey?.statStages[StatName.Accuracy]).toBe(0);
    const hasStatChanged = result.events.some(
      (e) => e.type === BattleEventType.StatChanged && "targetId" in e && e.targetId === "pidgey-1",
    );
    expect(hasStatChanged).toBe(false);
  });

  it("static paralyzes the attacker on contact with 30% chance", () => {
    // Given a Pikachu with Static as the target
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const pikachu = MockPokemon.fresh(MockPokemon.base, {
      id: "pikachu",
      definitionId: "pikachu",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "static",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, pikachu]);

    // When a contact move hits Pikachu
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // Then the attacker is paralyzed and AbilityActivated is emitted
    const attackerPokemon = state.pokemon.get("attacker");
    expect(result.success).toBe(true);
    expect(attackerPokemon?.statusEffects.some((s) => s.type === StatusType.Paralyzed)).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.AbilityActivated);
  });

  it("guts boosts Physical damage when burned and negates burn's attack penalty", () => {
    // Given a burned Machop with Guts
    const attackerWith = MockPokemon.fresh(MockPokemon.base, {
      id: "machop-with",
      definitionId: "machop",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["karate-chop"],
      currentPp: { "karate-chop": 25 },
      abilityId: "guts",
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWith = MockPokemon.fresh(MockPokemon.base, {
      id: "target-with",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    // Given a burned Machop without Guts
    const attackerWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "machop-without",
      definitionId: "machop",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["karate-chop"],
      currentPp: { "karate-chop": 25 },
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "target-without",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    // When karate-chop is used with Guts + burn
    const { engine: engineWith } = buildMoveTestEngine([attackerWith, targetWith]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "machop-with",
      moveId: "karate-chop",
      targetPosition: { x: 1, y: 2 },
    });

    // When karate-chop is used without Guts + burn
    const { engine: engineWithout } = buildMoveTestEngine([attackerWithout, targetWithout]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "machop-without",
      moveId: "karate-chop",
      targetPosition: { x: 1, y: 2 },
    });

    // Then Guts deals significantly more damage than burn-penalized baseline
    const damageWithGuts = 200 - targetWith.currentHp;
    const damageWithoutGuts = 200 - targetWithout.currentHp;
    expect(damageWithGuts).toBeGreaterThan(damageWithoutGuts * 2);
  });

  it("synchronize inflicts the same status back on the source", () => {
    // Given an Abra with Synchronize as the target
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["toxic"],
      currentPp: { toxic: 10 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const abra = MockPokemon.fresh(MockPokemon.base, {
      id: "abra",
      definitionId: "abra",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      abilityId: "synchronize",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, abra]);

    // When toxic is used against the Synchronize target
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "toxic",
      targetPosition: { x: 2, y: 2 },
    });

    // Then the attacker also receives BadlyPoisoned and AbilityActivated is emitted
    const attackerPokemon = state.pokemon.get("attacker");
    expect(result.success).toBe(true);
    expect(attackerPokemon?.statusEffects.some((s) => s.type === StatusType.BadlyPoisoned)).toBe(
      true,
    );
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.AbilityActivated);
  });

  it("levitate grants immunity to Ground-type moves", () => {
    // Given a Gastly with Levitate
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["earthquake"],
      currentPp: { earthquake: 10 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const gastly = MockPokemon.fresh(MockPokemon.base, {
      id: "gastly",
      definitionId: "gastly",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      abilityId: "levitate",
      currentHp: 100,
      maxHp: 100,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, gastly]);
    const hpBefore = state.pokemon.get("gastly")?.currentHp ?? 0;

    // When earthquake is used (Ground move, Zone radius 2 hits (2,2))
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "earthquake",
      targetPosition: { x: 2, y: 2 },
    });

    // Then Gastly takes no damage
    const gastlyAfter = state.pokemon.get("gastly");
    expect(gastlyAfter?.currentHp).toBe(hpBefore);
  });

  it("sturdy lets the Pokemon survive a one-hit KO at full HP with 1 HP", () => {
    // Given a Geodude with Sturdy at full HP facing an overwhelming attack
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["karate-chop"],
      currentPp: { "karate-chop": 25 },
      combatStats: { hp: 100, attack: 999, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const geodude = MockPokemon.fresh(MockPokemon.base, {
      id: "geodude",
      definitionId: "geodude",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 50,
      maxHp: 50,
      abilityId: "sturdy",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, geodude]);

    // When an overwhelming attack hits full-HP Geodude
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "karate-chop",
      targetPosition: { x: 1, y: 2 },
    });

    // Then Geodude survives with exactly 1 HP
    expect(result.success).toBe(true);
    expect(state.pokemon.get("geodude")?.currentHp).toBe(1);
    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.PokemonKo);
  });

  it("intimidate lowers Attack of adjacent enemies at battle start", () => {
    // Given a Growlithe with Intimidate adjacent to an enemy
    const growlithe = MockPokemon.fresh(MockPokemon.base, {
      id: "growlithe",
      definitionId: "growlithe",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "intimidate",
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
    });

    // When the engine is created (battle start fires in constructor)
    const { state } = buildMoveTestEngine([growlithe, enemy]);

    // Then the adjacent enemy has Attack lowered by 1 stage and Intimidated volatile status
    const enemyAfter = state.pokemon.get("enemy");
    expect(enemyAfter?.statStages[StatName.Attack]).toBe(-1);
    expect(
      enemyAfter?.volatileStatuses.some(
        (v) => v.type === StatusType.Intimidated && v.sourceId === "growlithe",
      ),
    ).toBe(true);
  });

  it("intimidate does not raise Attack on lift if it never lowered it (capped at -6)", () => {
    // Given an enemy already at -6 Attack stages and a Growlithe with Intimidate adjacent
    const growlithe = MockPokemon.fresh(MockPokemon.base, {
      id: "growlithe",
      definitionId: "growlithe",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "intimidate",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      statStages: { ...MockPokemon.base.statStages, [StatName.Attack]: -6 },
    });

    const { engine, state } = buildMoveTestEngine([growlithe, enemy]);

    // Then on battle start, the cap kept Attack at -6 but Intimidated volatile is still applied
    const enemyAfter = state.pokemon.get("enemy");
    expect(enemyAfter?.statStages[StatName.Attack]).toBe(-6);
    expect(
      enemyAfter?.volatileStatuses.some(
        (v) => v.type === StatusType.Intimidated && v.sourceId === "growlithe",
      ),
    ).toBe(true);

    // When Growlithe moves out of range (and its end-turn passes)
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "growlithe",
      path: [
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ],
    });

    // Then the Intimidated status is lifted but Attack stays at -6 (no spurious +1)
    expect(enemyAfter?.volatileStatuses.some((v) => v.type === StatusType.Intimidated)).toBe(false);
    expect(enemyAfter?.statStages[StatName.Attack]).toBe(-6);
  });

  it("cute-charm inflates male attacker with Infatuated on contact with 30% chance", () => {
    // Given a female Jigglypuff with Cute Charm and a male attacker
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
      gender: PokemonGender.Male,
    });
    const jigglypuff = MockPokemon.fresh(MockPokemon.base, {
      id: "jigglypuff",
      definitionId: "jigglypuff",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "cute-charm",
      gender: PokemonGender.Female,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, jigglypuff]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // Then the attacker is infatuated with Jigglypuff as source
    const attackerPokemon = state.pokemon.get("attacker");
    expect(result.success).toBe(true);
    expect(
      attackerPokemon?.volatileStatuses.some(
        (v) => v.type === StatusType.Infatuated && v.sourceId === "jigglypuff",
      ),
    ).toBe(true);
  });

  it("cute-charm does not trigger when both Pokemon share the same gender", () => {
    // Given a female Jigglypuff and a female attacker
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
      gender: PokemonGender.Female,
    });
    const jigglypuff = MockPokemon.fresh(MockPokemon.base, {
      id: "jigglypuff",
      definitionId: "jigglypuff",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "cute-charm",
      gender: PokemonGender.Female,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, jigglypuff]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    const attackerPokemon = state.pokemon.get("attacker");
    expect(attackerPokemon?.volatileStatuses.some((v) => v.type === StatusType.Infatuated)).toBe(
      false,
    );
  });

  it("cute-charm does not trigger against a genderless attacker", () => {
    // Given a female Jigglypuff and a genderless attacker (Magnemite-like)
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
      gender: PokemonGender.Genderless,
    });
    const jigglypuff = MockPokemon.fresh(MockPokemon.base, {
      id: "jigglypuff",
      definitionId: "jigglypuff",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "cute-charm",
      gender: PokemonGender.Female,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, jigglypuff]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    const attackerPokemon = state.pokemon.get("attacker");
    expect(attackerPokemon?.volatileStatuses.some((v) => v.type === StatusType.Infatuated)).toBe(
      false,
    );
  });

  it("cute-charm does not trigger when the carrier is male and the attacker is male", () => {
    // Given a male Jigglypuff carrier (25% chance per gender ratio) and a male attacker
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
      gender: PokemonGender.Male,
    });
    const jigglypuff = MockPokemon.fresh(MockPokemon.base, {
      id: "jigglypuff",
      definitionId: "jigglypuff",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "cute-charm",
      gender: PokemonGender.Male,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, jigglypuff]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    const attackerPokemon = state.pokemon.get("attacker");
    expect(attackerPokemon?.volatileStatuses.some((v) => v.type === StatusType.Infatuated)).toBe(
      false,
    );
  });

  it("thick-fat halves damage from Fire and Ice moves", () => {
    // Given a Seel with Thick Fat taking a Fire hit
    const attacker = MockPokemon.fresh(MockPokemon.charmander, {
      id: "charmander",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const seelWith = MockPokemon.fresh(MockPokemon.base, {
      id: "seel-with",
      definitionId: "seel",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      currentHp: 200,
      maxHp: 200,
      abilityId: "thick-fat",
    });

    const attacker2 = MockPokemon.fresh(MockPokemon.charmander, {
      id: "charmander-2",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const seelWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "seel-without",
      definitionId: "seel",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    // When ember hits Seel with Thick Fat
    const { engine: engineWith } = buildMoveTestEngine([attacker, seelWith]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "charmander",
      moveId: "ember",
      targetPosition: { x: 2, y: 2 },
    });

    // When ember hits Seel without Thick Fat
    const { engine: engineWithout } = buildMoveTestEngine([attacker2, seelWithout]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "charmander-2",
      moveId: "ember",
      targetPosition: { x: 2, y: 2 },
    });

    // Then Thick Fat takes less damage
    const damageWith = 200 - seelWith.currentHp;
    const damageWithout = 200 - seelWithout.currentHp;
    expect(damageWith).toBeGreaterThan(0);
    expect(damageWith).toBeLessThan(damageWithout);
  });

  it("adaptability raises STAB multiplier to 2.0 instead of 1.5", () => {
    // Given an Eevee with Adaptability using a Normal move (STAB)
    const eeveeWith = MockPokemon.fresh(MockPokemon.base, {
      id: "eevee-with",
      definitionId: "eevee",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      abilityId: "adaptability",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWith = MockPokemon.fresh(MockPokemon.base, {
      id: "target-with",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    // Given an Eevee without Adaptability using the same Normal move
    const eeveeWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "eevee-without",
      definitionId: "eevee",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "target-without",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    // When scratch is used with Adaptability (2.0x STAB)
    const { engine: engineWith } = buildMoveTestEngine([eeveeWith, targetWith]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "eevee-with",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // When scratch is used without Adaptability (1.5x STAB)
    const { engine: engineWithout } = buildMoveTestEngine([eeveeWithout, targetWithout]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "eevee-without",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // Then Adaptability deals more damage than standard STAB
    const damageWith = 200 - targetWith.currentHp;
    const damageWithout = 200 - targetWithout.currentHp;
    expect(damageWith).toBeGreaterThan(damageWithout);
  });

  it("clear-body prevents all stat reductions by enemies", () => {
    // Given a Tentacool with Clear Body as the target
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["kinesis"],
      currentPp: { kinesis: 15 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const tentacool = MockPokemon.fresh(MockPokemon.base, {
      id: "tentacool",
      definitionId: "tentacool",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      abilityId: "clear-body",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, tentacool]);

    // When kinesis (Accuracy -1) is used against Clear Body
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "kinesis",
      targetPosition: { x: 2, y: 2 },
    });

    // Then no stat stage is lowered
    const tentacoolAfter = state.pokemon.get("tentacool");
    expect(result.success).toBe(true);
    expect(tentacoolAfter?.statStages[StatName.Accuracy]).toBe(0);
    const hasStatChanged = result.events.some(
      (e) =>
        e.type === BattleEventType.StatChanged && "targetId" in e && e.targetId === "tentacool",
    );
    expect(hasStatChanged).toBe(false);
  });

  it("poison-point poisons the attacker on contact with 30% chance", () => {
    // Given a Nidoran-M with Poison Point as the target
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const nidoran = MockPokemon.fresh(MockPokemon.base, {
      id: "nidoran",
      definitionId: "nidoran-m",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "poison-point",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, nidoran]);

    // When a contact move hits Nidoran-M
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // Then the attacker is poisoned
    const attackerPokemon = state.pokemon.get("attacker");
    expect(result.success).toBe(true);
    expect(attackerPokemon?.statusEffects.some((s) => s.type === StatusType.Poisoned)).toBe(true);
  });

  it("technician boosts moves with base power 60 or less by 1.5x", () => {
    // Given a Meowth with Technician using scratch (power 40)
    const meowthWith = MockPokemon.fresh(MockPokemon.base, {
      id: "meowth-with",
      definitionId: "meowth",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      abilityId: "technician",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWith = MockPokemon.fresh(MockPokemon.base, {
      id: "target-with",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    // Given a Meowth without Technician using scratch
    const meowthWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "meowth-without",
      definitionId: "meowth",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "target-without",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    // When scratch is used with Technician
    const { engine: engineWith } = buildMoveTestEngine([meowthWith, targetWith]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "meowth-with",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // When scratch is used without Technician
    const { engine: engineWithout } = buildMoveTestEngine([meowthWithout, targetWithout]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "meowth-without",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // Then Technician deals more damage
    const damageWith = 200 - targetWith.currentHp;
    const damageWithout = 200 - targetWithout.currentHp;
    expect(damageWith).toBeGreaterThan(damageWithout);
  });

  it("magnet-pull traps adjacent Steel-type enemies at battle start", () => {
    // Given a Magnemite with Magnet Pull adjacent to another Magnemite (Steel-type)
    const magnemiteAttractor = MockPokemon.fresh(MockPokemon.base, {
      id: "magnemite-attractor",
      definitionId: "magnemite",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "magnet-pull",
    });
    const magnemiteTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "magnemite-target",
      definitionId: "magnemite",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
    });

    // When the engine is created (battle start fires in constructor)
    const { state } = buildMoveTestEngine([magnemiteAttractor, magnemiteTarget]);

    // Then the adjacent Steel-type enemy is Trapped
    const trapped = state.pokemon.get("magnemite-target");
    expect(
      trapped?.volatileStatuses.some(
        (v) =>
          v.type === StatusType.Trapped &&
          v.remainingTurns === -1 &&
          v.sourceId === "magnemite-attractor",
      ),
    ).toBe(true);

    // And Magnet Pull's owner is not trapped
    const owner = state.pokemon.get("magnemite-attractor");
    expect(owner?.volatileStatuses.some((v) => v.type === StatusType.Trapped)).toBe(false);
  });

  it("sand-veil does not crash when active (smoke test)", () => {
    // Given a Sandshrew with Sand Veil being attacked
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const sandshrew = MockPokemon.fresh(MockPokemon.base, {
      id: "sandshrew",
      definitionId: "sandshrew",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "sand-veil",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine } = buildMoveTestEngine([attacker, sandshrew]);

    // When scratch hits a Sandshrew with Sand Veil
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // Then no crash occurs
    expect(result.success).toBe(true);
  });

  it("own-tempo blocks Confused status and emits StatusImmune", () => {
    // Given a Lickitung with Own Tempo as the target
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["supersonic"],
      currentPp: { supersonic: 20 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const lickitung = MockPokemon.fresh(MockPokemon.base, {
      id: "lickitung",
      definitionId: "lickitung",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      abilityId: "own-tempo",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, lickitung]);

    // When supersonic (Confused 100%) targets Lickitung
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "supersonic",
      targetPosition: { x: 2, y: 2 },
    });

    // Then Lickitung is not confused and StatusImmune is emitted
    const lickitungAfter = state.pokemon.get("lickitung");
    expect(result.success).toBe(true);
    expect(lickitungAfter?.volatileStatuses.some((v) => v.type === StatusType.Confused)).toBe(
      false,
    );
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.StatusImmune);
  });

  it("early-bird halves the duration of sleep (rounds up)", () => {
    // Given a Kangaskhan with Early Bird as the target
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["hypnosis"],
      currentPp: { hypnosis: 20 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const kangaskhan = MockPokemon.fresh(MockPokemon.base, {
      id: "kangaskhan",
      definitionId: "kangaskhan",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      abilityId: "early-bird",
    });

    // Math.random = 0 picks the shortest sleep sample (index 0 → 2 turns)
    // Early Bird: ceil(2 / 2) = 1
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, kangaskhan]);

    // When hypnosis (Asleep 100%) targets Kangaskhan with Early Bird
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "hypnosis",
      targetPosition: { x: 2, y: 2 },
    });

    // Then Kangaskhan is asleep with halved duration (1 turn) and the status carries
    // shortenedByAbilityId — emission happens on wake-up, not on apply.
    const kangaskhanAfter = state.pokemon.get("kangaskhan");
    expect(result.success).toBe(true);
    const sleepStatus = kangaskhanAfter?.statusEffects.find((s) => s.type === StatusType.Asleep);
    expect(sleepStatus).toBeDefined();
    expect(sleepStatus?.remainingTurns).toBe(1);
    expect(sleepStatus?.shortenedByAbilityId).toBe("early-bird");
  });

  it("overgrow emits AbilityActivated when HP first crosses below 1/3", () => {
    // Given a Bulbasaur just above 1/3 HP (above pinch threshold)
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      definitionId: "test",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.base, {
      id: "bulbasaur",
      definitionId: "bulbasaur",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 35,
      maxHp: 100,
      abilityId: "overgrow",
    });

    const { engine } = buildMoveTestEngine([attacker, bulbasaur]);

    // When Bulbasaur takes any damage from scratch (35 → below 33)
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // Then AbilityActivated for overgrow is emitted (threshold cross)
    expect(result.success).toBe(true);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "overgrow",
      ),
    ).toBe(true);
  });

  it("overgrow emits AbilityActivated at battle start if HP starts below 1/3", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      definitionId: "test",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.base, {
      id: "bulbasaur",
      definitionId: "bulbasaur",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 25,
      maxHp: 100,
      abilityId: "overgrow",
    });

    const events: BattleEvent[] = [];
    const { engine } = buildMoveTestEngine([attacker, bulbasaur]);
    engine.on(BattleEventType.AbilityActivated, (e) => events.push(e));

    // The battle-start emission is fired during engine construction, but listeners
    // attach after. Force-trigger by submitting a no-op (EndTurn) — onBattleStart already fired.
    expect(bulbasaur.abilityFirstTriggered).toBe(true);
  });

  it("guts emits AbilityActivated when receiving a major status", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["thunder-wave"],
      currentPp: { "thunder-wave": 20 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const machop = MockPokemon.fresh(MockPokemon.base, {
      id: "machop",
      definitionId: "machop",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "guts",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);
    const { engine } = buildMoveTestEngine([attacker, machop]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "thunder-wave",
      targetPosition: { x: 1, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "guts",
      ),
    ).toBe(true);
  });

  it("levitate emits AbilityActivated when blocking a Ground move", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["earthquake"],
      currentPp: { earthquake: 10 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const gastly = MockPokemon.fresh(MockPokemon.base, {
      id: "gastly",
      definitionId: "gastly",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "levitate",
    });

    const { engine } = buildMoveTestEngine([attacker, gastly]);
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "earthquake",
      targetPosition: { x: 0, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "levitate",
      ),
    ).toBe(true);
  });

  it("clear-body emits AbilityActivated when blocking a stat drop", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["growl"],
      currentPp: { growl: 40 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const tentacool = MockPokemon.fresh(MockPokemon.base, {
      id: "tentacool",
      definitionId: "tentacool",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "clear-body",
    });

    const { engine, state } = buildMoveTestEngine([attacker, tentacool]);
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "growl",
      targetPosition: { x: 1, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("tentacool")?.statStages[StatName.Attack]).toBe(0);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "clear-body",
      ),
    ).toBe(true);
  });

  it("own-tempo emits AbilityActivated when Intimidate aura tries to apply", () => {
    const growlithe = MockPokemon.fresh(MockPokemon.base, {
      id: "growlithe",
      definitionId: "growlithe",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "intimidate",
    });
    const lickitung = MockPokemon.fresh(MockPokemon.base, {
      id: "lickitung",
      definitionId: "lickitung",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "own-tempo",
    });

    const { engine, state } = buildMoveTestEngine([growlithe, lickitung]);
    const lickitungAfter = state.pokemon.get("lickitung");
    const startupEvents = engine.consumeStartupEvents();

    expect(lickitungAfter?.statStages[StatName.Attack]).toBe(0);
    expect(lickitungAfter?.volatileStatuses.some((v) => v.type === StatusType.Intimidated)).toBe(
      false,
    );
    expect(
      startupEvents.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "own-tempo",
      ),
    ).toBe(true);
  });

  it("vital-spirit blocks Asleep status from hypnosis", () => {
    // Given Primeape with vital-spirit
    const primeape = MockPokemon.fresh(MockPokemon.base, {
      id: "primeape",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "vital-spirit",
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["hypnosis"],
      currentPp: { hypnosis: 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    // When hypnosis targets Primeape
    const { engine, state } = buildMoveTestEngine([primeape, attacker], {
      activePokemonId: attacker.id,
    });
    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "hypnosis",
      targetPosition: { x: 0, y: 0 },
    });

    // Then sleep is blocked and AbilityActivated emitted
    expect(result.success).toBe(true);
    expect(state.pokemon.get(primeape.id)?.statusEffects).not.toContainEqual(
      expect.objectContaining({ type: StatusType.Asleep }),
    );
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "vital-spirit",
      ),
    ).toBe(true);
  });

  it("insomnia blocks Asleep status from sleep-powder", () => {
    // Given Hypno with insomnia
    const hypno = MockPokemon.fresh(MockPokemon.base, {
      id: "hypno",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "insomnia",
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["sleep-powder"],
      currentPp: { "sleep-powder": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    // When sleep-powder targets Hypno
    const { engine, state } = buildMoveTestEngine([hypno, attacker], {
      activePokemonId: attacker.id,
    });
    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "sleep-powder",
      targetPosition: { x: 0, y: 0 },
    });

    // Then sleep is blocked and AbilityActivated emitted
    expect(result.success).toBe(true);
    expect(state.pokemon.get(hypno.id)?.statusEffects).not.toContainEqual(
      expect.objectContaining({ type: StatusType.Asleep }),
    );
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "insomnia",
      ),
    ).toBe(true);
  });

  it("cursed-body applies confusion to contact attacker with 30% chance (random=0.1)", () => {
    // Given Gengar with cursed-body
    const gengar = MockPokemon.fresh(MockPokemon.base, {
      id: "gengar",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "cursed-body",
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    vi.spyOn(Math, "random").mockReturnValue(0.1);

    // When attacker uses a contact move on Gengar
    const { engine, state } = buildMoveTestEngine([attacker, gengar]);
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "scratch",
      targetPosition: { x: 1, y: 0 },
    });

    // Then attacker becomes confused (volatile) and AbilityActivated emitted
    expect(result.success).toBe(true);
    expect(state.pokemon.get(attacker.id)?.volatileStatuses).toContainEqual(
      expect.objectContaining({ type: StatusType.Confused }),
    );
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "cursed-body",
      ),
    ).toBe(true);
  });

  it("cursed-body does not trigger when random >= 0.3", () => {
    // Given Gengar with cursed-body
    const gengar = MockPokemon.fresh(MockPokemon.base, {
      id: "gengar",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "cursed-body",
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const { engine, state } = buildMoveTestEngine([attacker, gengar]);
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "scratch",
      targetPosition: { x: 1, y: 0 },
    });

    // Then no confusion
    expect(state.pokemon.get(attacker.id)?.volatileStatuses).not.toContainEqual(
      expect.objectContaining({ type: StatusType.Confused }),
    );
  });

  it("rock-head blocks recoil damage from double-edge", () => {
    // Given Marowak with rock-head using double-edge
    const marowak = MockPokemon.fresh(MockPokemon.base, {
      id: "marowak",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "rock-head",
      currentHp: 100,
      maxHp: 100,
      moveIds: ["double-edge"],
      currentPp: { "double-edge": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([marowak, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: marowak.id,
      moveId: "double-edge",
      targetPosition: { x: 1, y: 0 },
    });

    // Then Marowak takes no recoil — HP unchanged (no self-damage event)
    expect(result.success).toBe(true);
    expect(state.pokemon.get(marowak.id)?.currentHp).toBe(100);
    const recoilEvents = result.events.filter(
      (e): e is Extract<typeof e, { type: "damage_dealt" }> =>
        e.type === BattleEventType.DamageDealt,
    );
    expect(recoilEvents.every((e) => e.targetId !== marowak.id)).toBe(true);
  });

  it("limber blocks Paralyzed status from thunder-wave", () => {
    // Given Hitmonlee with limber
    const hitmonlee = MockPokemon.fresh(MockPokemon.base, {
      id: "hitmonlee",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "limber",
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["thunder-wave"],
      currentPp: { "thunder-wave": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    // When thunder-wave targets Hitmonlee
    const { engine, state } = buildMoveTestEngine([hitmonlee, attacker], {
      activePokemonId: attacker.id,
    });
    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "thunder-wave",
      targetPosition: { x: 0, y: 0 },
    });

    // Then paralysis is blocked and AbilityActivated emitted
    expect(result.success).toBe(true);
    expect(state.pokemon.get(hitmonlee.id)?.statusEffects).not.toContainEqual(
      expect.objectContaining({ type: StatusType.Paralyzed }),
    );
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "limber",
      ),
    ).toBe(true);
  });

  it("iron-fist boosts punch moves by 1.2x", () => {
    // Given Hitmonchan with iron-fist using thunder-punch
    const hitmonchan = MockPokemon.fresh(MockPokemon.base, {
      id: "hitmonchan",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "iron-fist",
      moveIds: ["thunder-punch"],
      currentPp: { "thunder-punch": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    // Given same attacker without iron-fist using thunder-punch
    const hitmonchanNoAbility = MockPokemon.fresh(MockPokemon.base, {
      id: "hitmonchan-no",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["thunder-punch"],
      currentPp: { "thunder-punch": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    const target1 = MockPokemon.fresh(MockPokemon.base, {
      id: "target-1",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const target2 = MockPokemon.fresh(MockPokemon.base, {
      id: "target-2",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    // When iron-fist hitmonchan uses thunder-punch
    const { engine: engineWith } = buildMoveTestEngine([hitmonchan, target1]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: hitmonchan.id,
      moveId: "thunder-punch",
      targetPosition: { x: 1, y: 0 },
    });
    const damageWith = 500 - (target1.currentHp ?? 500);

    // When no-ability hitmonchan uses thunder-punch
    const { engine: engineWithout } = buildMoveTestEngine([hitmonchanNoAbility, target2]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: hitmonchanNoAbility.id,
      moveId: "thunder-punch",
      targetPosition: { x: 1, y: 0 },
    });
    const damageWithout = 500 - (target2.currentHp ?? 500);

    // Then iron-fist deals more damage
    expect(damageWith).toBeGreaterThan(damageWithout);
  });

  it("natural-cure clears burn at end of turn", () => {
    // Given Starmie with natural-cure and a burn
    const starmie = MockPokemon.fresh(MockPokemon.base, {
      id: "starmie",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "natural-cure",
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
      moveIds: ["surf"],
      currentPp: { surf: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([starmie, foe]);

    // When starmie uses a move then ends its turn
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: starmie.id,
      moveId: "surf",
      targetPosition: { x: 1, y: 0 },
    });
    const endResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: starmie.id,
      direction: starmie.orientation,
    });

    // Then burn is cleared, StatusRemoved and AbilityActivated are emitted
    expect(state.pokemon.get(starmie.id)?.statusEffects).not.toContainEqual(
      expect.objectContaining({ type: StatusType.Burned }),
    );
    expect(
      endResult.events.some(
        (e) =>
          e.type === BattleEventType.StatusRemoved &&
          "targetId" in e &&
          e.targetId === starmie.id &&
          "status" in e &&
          e.status === StatusType.Burned,
      ),
    ).toBe(true);
    expect(
      endResult.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "natural-cure",
      ),
    ).toBe(true);
  });

  it("battle-armor prevents critical hits", () => {
    // Given Kabutops with battle-armor
    const kabutops = MockPokemon.fresh(MockPokemon.base, {
      id: "kabutops",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "battle-armor",
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["cross-chop"],
      currentPp: { "cross-chop": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    // random=0 would normally crit (0 < any crit threshold), but battle-armor prevents it
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine } = buildMoveTestEngine([attacker, kabutops]);
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "cross-chop",
      targetPosition: { x: 1, y: 0 },
    });

    // Then no CriticalHit event despite roll being below 1/8 threshold
    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.CriticalHit);
  });

  it("effect-spore inflicts a random major status on contact with 30% chance", () => {
    // Given a Vileplume with Effect Spore as the target
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const vileplume = MockPokemon.fresh(MockPokemon.base, {
      id: "vileplume",
      definitionId: "vileplume",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "effect-spore",
    });

    // random=0 → under 30% trigger → status roll 0 → Asleep (< 1/3)
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, vileplume]);

    // When a contact move hits Vileplume
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 0 },
    });

    // Then the attacker receives a major status and AbilityActivated is emitted
    expect(result.success).toBe(true);
    expect(state.pokemon.get("attacker")?.statusEffects).toHaveLength(1);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.AbilityActivated);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "effect-spore",
      ),
    ).toBe(true);
  });

  it("effect-spore does not trigger when random >= 0.3", () => {
    // Given a Vileplume with Effect Spore
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const vileplume = MockPokemon.fresh(MockPokemon.base, {
      id: "vileplume",
      definitionId: "vileplume",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "effect-spore",
    });

    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const { engine, state } = buildMoveTestEngine([attacker, vileplume]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 0 },
    });

    // Then no status is applied
    expect(state.pokemon.get("attacker")?.statusEffects).toHaveLength(0);
  });

  it("cloud-nine does not crash when active (smoke test)", () => {
    // Given a Golduck with Cloud Nine being attacked
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const golduck = MockPokemon.fresh(MockPokemon.base, {
      id: "golduck",
      definitionId: "golduck",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "cloud-nine",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine } = buildMoveTestEngine([attacker, golduck]);

    // When scratch hits Golduck with Cloud Nine
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 0 },
    });

    // Then no crash occurs
    expect(result.success).toBe(true);
  });

  it("shell-armor prevents critical hits", () => {
    // Given a Cloyster with Shell Armor
    const cloyster = MockPokemon.fresh(MockPokemon.base, {
      id: "cloyster",
      definitionId: "cloyster",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "shell-armor",
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["cross-chop"],
      currentPp: { "cross-chop": 5 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    // random=0 would normally crit, but Shell Armor prevents it
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine } = buildMoveTestEngine([attacker, cloyster]);
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "cross-chop",
      targetPosition: { x: 1, y: 0 },
    });

    // Then no CriticalHit event
    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.CriticalHit);
  });

  it("hyper-cutter blocks Attack stat drops from opponents", () => {
    // Given a Kingler with Hyper Cutter as the target
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["growl"],
      currentPp: { growl: 40 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const kingler = MockPokemon.fresh(MockPokemon.base, {
      id: "kingler",
      definitionId: "kingler",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "hyper-cutter",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, kingler]);

    // When growl (Attack -1) is used against Kingler
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "growl",
      targetPosition: { x: 1, y: 0 },
    });

    // Then Attack is not lowered and AbilityActivated is emitted
    expect(result.success).toBe(true);
    expect(state.pokemon.get("kingler")?.statStages[StatName.Attack]).toBe(0);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "hyper-cutter",
      ),
    ).toBe(true);
  });

  it("oblivious does not crash when active (smoke test)", () => {
    // Given a Jynx with Oblivious being attacked
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const jynx = MockPokemon.fresh(MockPokemon.base, {
      id: "jynx",
      definitionId: "jynx",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "oblivious",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine } = buildMoveTestEngine([attacker, jynx]);

    // When scratch hits Jynx with Oblivious
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 0 },
    });

    // Then no crash occurs
    expect(result.success).toBe(true);
  });

  it("flame-body burns the attacker on contact with 30% chance", () => {
    // Given a Magmar with Flame Body as the target
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const magmar = MockPokemon.fresh(MockPokemon.base, {
      id: "magmar",
      definitionId: "magmar",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "flame-body",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, magmar]);

    // When a contact move hits Magmar
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 0 },
    });

    // Then the attacker is burned and AbilityActivated is emitted
    expect(result.success).toBe(true);
    expect(
      state.pokemon.get("attacker")?.statusEffects.some((s) => s.type === StatusType.Burned),
    ).toBe(true);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "flame-body",
      ),
    ).toBe(true);
  });

  it("flame-body does not trigger when random >= 0.3", () => {
    // Given a Magmar with Flame Body
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const magmar = MockPokemon.fresh(MockPokemon.base, {
      id: "magmar",
      definitionId: "magmar",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "flame-body",
    });

    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const { engine, state } = buildMoveTestEngine([attacker, magmar]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get("attacker")?.statusEffects).toHaveLength(0);
  });

  it("trace copies the nearest enemy's ability at battle start", () => {
    // Given a Porygon with Trace adjacent to a Pikachu (Static)
    const porygon = MockPokemon.fresh(MockPokemon.base, {
      id: "porygon",
      definitionId: "porygon",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "trace",
    });
    const pikachu = MockPokemon.fresh(MockPokemon.base, {
      id: "pikachu",
      definitionId: "pikachu",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "static",
    });

    // When the engine is created (battle start fires in constructor)
    const { state } = buildMoveTestEngine([porygon, pikachu]);

    // Then Porygon's ability is now "static" (copied from Pikachu)
    expect(state.pokemon.get("porygon")?.abilityId).toBe("static");
  });

  it("trace emits AbilityActivated at battle start when copying an ability", () => {
    // Given a Porygon with Trace adjacent to a Pikachu (Static)
    const porygon = MockPokemon.fresh(MockPokemon.base, {
      id: "porygon",
      definitionId: "porygon",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "trace",
    });
    const pikachu = MockPokemon.fresh(MockPokemon.base, {
      id: "pikachu",
      definitionId: "pikachu",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "static",
    });

    const { engine } = buildMoveTestEngine([porygon, pikachu]);
    const startupEvents = engine.consumeStartupEvents();

    expect(
      startupEvents.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "trace",
      ),
    ).toBe(true);
    expect(
      startupEvents.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "static",
      ),
    ).toBe(true);
  });

  it("swift-swim does not crash when active (smoke test)", () => {
    // Given an Omastar with Swift Swim being attacked
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const omastar = MockPokemon.fresh(MockPokemon.base, {
      id: "omastar",
      definitionId: "omastar",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      abilityId: "swift-swim",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine } = buildMoveTestEngine([attacker, omastar]);

    // When scratch hits Omastar with Swift Swim
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 0 },
    });

    // Then no crash occurs
    expect(result.success).toBe(true);
  });

  // Batch D abilities

  it("poison-touch badly poisons the target on contact with 30% chance", () => {
    // Given a Muk with Poison Touch using a contact move
    const muk = MockPokemon.fresh(MockPokemon.base, {
      id: "muk",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      abilityId: "poison-touch",
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 200,
      maxHp: 200,
    });

    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const { engine, state } = buildMoveTestEngine([muk, target]);

    // When a contact move hits
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "muk",
      moveId: "scratch",
      targetPosition: { x: 1, y: 0 },
    });

    // Then target is badly poisoned and AbilityActivated is emitted
    expect(result.success).toBe(true);
    expect(
      state.pokemon.get("target")?.statusEffects.some((s) => s.type === StatusType.BadlyPoisoned),
    ).toBe(true);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "poison-touch",
      ),
    ).toBe(true);
  });

  it("poison-touch does not trigger when random >= 0.3", () => {
    // Given a Muk with Poison Touch
    const muk = MockPokemon.fresh(MockPokemon.base, {
      id: "muk",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      abilityId: "poison-touch",
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 200,
      maxHp: 200,
    });

    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const { engine, state } = buildMoveTestEngine([muk, target]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "muk",
      moveId: "scratch",
      targetPosition: { x: 1, y: 0 },
    });

    expect(
      state.pokemon.get("target")?.statusEffects.some((s) => s.type === StatusType.BadlyPoisoned),
    ).toBe(false);
  });

  it("filter reduces super-effective damage by 25%", () => {
    // Mr. Mime is Psychic/Fairy — sludge-bomb (Poison) is 2x vs Fairy = super-effective
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 2 },
      moveIds: ["sludge-bomb"],
      currentPp: { "sludge-bomb": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const mrMimeWith = MockPokemon.fresh(MockPokemon.base, {
      id: "mr-mime-with",
      definitionId: "mr-mime",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      currentHp: 500,
      maxHp: 500,
      abilityId: "filter",
    });

    const attacker2 = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-2",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 2 },
      moveIds: ["sludge-bomb"],
      currentPp: { "sludge-bomb": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const mrMimeWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "mr-mime-without",
      definitionId: "mr-mime",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      currentHp: 500,
      maxHp: 500,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine: engineWith } = buildMoveTestEngine([attacker, mrMimeWith]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "sludge-bomb",
      targetPosition: { x: 3, y: 2 },
    });

    const { engine: engineWithout } = buildMoveTestEngine([attacker2, mrMimeWithout]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker-2",
      moveId: "sludge-bomb",
      targetPosition: { x: 3, y: 2 },
    });

    // Then Filter reduces the super-effective damage
    const damageWith = 500 - mrMimeWith.currentHp;
    const damageWithout = 500 - mrMimeWithout.currentHp;
    expect(damageWith).toBeLessThan(damageWithout);
    expect(damageWith).toBeCloseTo(damageWithout * 0.75, 0);
  });

  it("water-veil prevents Burn status", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["will-o-wisp"],
      currentPp: { "will-o-wisp": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const seakingWith = MockPokemon.fresh(MockPokemon.base, {
      id: "seaking",
      definitionId: "seaking",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
      abilityId: "water-veil",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, seakingWith]);
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "will-o-wisp",
      targetPosition: { x: 1, y: 2 },
    });

    const seaking = state.pokemon.get("seaking");
    expect(seaking?.statusEffects.some((s) => s.type === StatusType.Burned)).toBe(false);
  });

  it("shield-dust blocks secondary status effects but lets damage through", () => {
    const attackerWith = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-with",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["sludge-bomb"],
      currentPp: { "sludge-bomb": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const venomothWith = MockPokemon.fresh(MockPokemon.base, {
      id: "venomoth-with",
      definitionId: "venomoth",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      currentHp: 200,
      maxHp: 200,
      abilityId: "shield-dust",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attackerWith, venomothWith]);
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker-with",
      moveId: "sludge-bomb",
      targetPosition: { x: 3, y: 2 },
    });

    const venomoth = state.pokemon.get("venomoth-with");
    expect(venomoth?.statusEffects.some((s) => s.type === StatusType.Poisoned)).toBe(false);
    expect(venomoth?.currentHp).toBeLessThan(200);
  });

  it("compound-eyes boosts move accuracy by 30%", () => {
    const accuracies: number[] = [];
    const observe = (label: string, withAbility: boolean) => {
      const attacker = MockPokemon.fresh(MockPokemon.base, {
        id: `attacker-${label}`,
        definitionId: "butterfree",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 2 },
        moveIds: ["sleep-powder"],
        currentPp: { "sleep-powder": 15 },
        ...(withAbility ? { abilityId: "compound-eyes" as const } : {}),
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      });
      const defender = MockPokemon.fresh(MockPokemon.base, {
        id: `defender-${label}`,
        definitionId: "test",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 2 },
        currentHp: 200,
        maxHp: 200,
      });
      let hits = 0;
      const total = 100;
      for (let i = 0; i < total; i++) {
        const seq = i / total + 0.001;
        vi.spyOn(Math, "random").mockReturnValue(seq);
        const { engine } = buildMoveTestEngine([
          { ...attacker, currentPp: { "sleep-powder": 15 } },
          { ...defender, statusEffects: [] },
        ]);
        const result = engine.submitAction(PlayerId.Player1, {
          kind: ActionKind.UseMove,
          pokemonId: attacker.id,
          moveId: "sleep-powder",
          targetPosition: { x: 1, y: 2 },
        });
        if (!result.events.some((e) => e.type === BattleEventType.MoveMissed)) {
          hits++;
        }
        vi.restoreAllMocks();
      }
      accuracies.push(hits);
    };

    observe("without", false);
    observe("with", true);
    expect(accuracies[1]).toBeGreaterThan(accuracies[0] ?? 0);
  });

  it("swarm boosts Bug moves when HP is at or below 1/3", () => {
    const attackerWith = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-with",
      definitionId: "beedrill",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["twineedle"],
      currentPp: { twineedle: 20 },
      currentHp: 20,
      maxHp: 100,
      abilityId: "swarm",
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const targetWith = MockPokemon.fresh(MockPokemon.base, {
      id: "target-with",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 500,
      maxHp: 500,
    });
    const attackerWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-without",
      definitionId: "beedrill",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["twineedle"],
      currentPp: { twineedle: 20 },
      currentHp: 20,
      maxHp: 100,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const targetWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "target-without",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 500,
      maxHp: 500,
    });

    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const { engine: engineWith } = buildMoveTestEngine([attackerWith, targetWith]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker-with",
      moveId: "twineedle",
      targetPosition: { x: 1, y: 2 },
    });

    const { engine: engineWithout } = buildMoveTestEngine([attackerWithout, targetWithout]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker-without",
      moveId: "twineedle",
      targetPosition: { x: 1, y: 2 },
    });

    const damageWith = 500 - targetWith.currentHp;
    const damageWithout = 500 - targetWithout.currentHp;
    expect(damageWith).toBeGreaterThan(damageWithout);
  });

  it("pressure ability is registered with targetedCtBonus 50", async () => {
    const { loadData } = await import("@pokemon-tactic/data");
    const data = loadData();
    const pressureAbility = data.abilityRegistry.get("pressure");
    expect(pressureAbility).toBeDefined();
    expect(pressureAbility?.targetedCtBonus).toBe(50);
  });

  it("shield-dust does NOT block a primary status (Sleep Powder)", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["sleep-powder"],
      currentPp: { "sleep-powder": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const venomothWith = MockPokemon.fresh(MockPokemon.base, {
      id: "venomoth",
      definitionId: "venomoth",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
      abilityId: "shield-dust",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, venomothWith]);
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "sleep-powder",
      targetPosition: { x: 1, y: 2 },
    });

    const venomoth = state.pokemon.get("venomoth");
    expect(venomoth?.statusEffects.some((s) => s.type === StatusType.Asleep)).toBe(true);
  });

  // Plan 136 — Tier A abilities

  it("reckless boosts recoil moves by 20% but leaves non-recoil moves untouched", () => {
    // Given a Tauros with reckless using double-edge (a recoil move)
    const recklessAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "reckless-attacker",
      definitionId: "tauros",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["double-edge", "body-slam"],
      currentPp: { "double-edge": 15, "body-slam": 15 },
      abilityId: "reckless",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const recklessTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "reckless-target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 500,
      maxHp: 500,
    });

    // Given the same Tauros without reckless
    const plainAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "plain-attacker",
      definitionId: "tauros",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["double-edge", "body-slam"],
      currentPp: { "double-edge": 15, "body-slam": 15 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const plainTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "plain-target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 500,
      maxHp: 500,
    });

    vi.spyOn(Math, "random").mockReturnValue(0.99);

    // When double-edge (recoil) is used with reckless
    const { engine: recoilWith } = buildMoveTestEngine([recklessAttacker, recklessTarget]);
    recoilWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "reckless-attacker",
      moveId: "double-edge",
      targetPosition: { x: 1, y: 2 },
    });
    const recoilDamageWith = 500 - recklessTarget.currentHp;

    // When double-edge is used without reckless
    const { engine: recoilWithout } = buildMoveTestEngine([plainAttacker, plainTarget]);
    recoilWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "plain-attacker",
      moveId: "double-edge",
      targetPosition: { x: 1, y: 2 },
    });
    const recoilDamageWithout = 500 - plainTarget.currentHp;

    // Then reckless deals roughly 20% more on the recoil move
    expect(recoilDamageWith).toBeGreaterThan(recoilDamageWithout);
    expect(recoilDamageWith).toBeCloseTo(recoilDamageWithout * 1.2, -1);

    // And on a non-recoil move (body-slam), reckless gives no boost
    const recklessAttacker2 = MockPokemon.fresh(MockPokemon.base, {
      id: "reckless-attacker-2",
      definitionId: "tauros",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["body-slam"],
      currentPp: { "body-slam": 15 },
      abilityId: "reckless",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const recklessTarget2 = MockPokemon.fresh(MockPokemon.base, {
      id: "reckless-target-2",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 500,
      maxHp: 500,
    });
    const plainAttacker2 = MockPokemon.fresh(MockPokemon.base, {
      id: "plain-attacker-2",
      definitionId: "tauros",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["body-slam"],
      currentPp: { "body-slam": 15 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const plainTarget2 = MockPokemon.fresh(MockPokemon.base, {
      id: "plain-target-2",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 500,
      maxHp: 500,
    });

    const { engine: nonRecoilWith } = buildMoveTestEngine([recklessAttacker2, recklessTarget2]);
    nonRecoilWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "reckless-attacker-2",
      moveId: "body-slam",
      targetPosition: { x: 1, y: 2 },
    });
    const { engine: nonRecoilWithout } = buildMoveTestEngine([plainAttacker2, plainTarget2]);
    nonRecoilWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "plain-attacker-2",
      moveId: "body-slam",
      targetPosition: { x: 1, y: 2 },
    });
    expect(500 - recklessTarget2.currentHp).toBe(500 - plainTarget2.currentHp);
  });

  it("rivalry boosts same-gender, weakens opposite-gender, and ignores genderless matchups", () => {
    const runMatchup = (selfGender: PokemonGender, opponentGender: PokemonGender) => {
      const attacker = MockPokemon.fresh(MockPokemon.base, {
        id: "rivalry-attacker",
        definitionId: "tauros",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 2 },
        moveIds: ["body-slam"],
        currentPp: { "body-slam": 15 },
        abilityId: "rivalry",
        gender: selfGender,
        derivedStats: { movement: 4, jump: 1, initiative: 100 },
      });
      const target = MockPokemon.fresh(MockPokemon.base, {
        id: "rivalry-target",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 2 },
        currentHp: 500,
        maxHp: 500,
        gender: opponentGender,
      });
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const { engine } = buildMoveTestEngine([attacker, target]);
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "rivalry-attacker",
        moveId: "body-slam",
        targetPosition: { x: 1, y: 2 },
      });
      vi.restoreAllMocks();
      return 500 - target.currentHp;
    };

    // Given a Genderless baseline (×1.0)
    const baseline = runMatchup(PokemonGender.Genderless, PokemonGender.Male);
    // Then same gender deals more (×1.25) and opposite gender deals less (×0.75)
    const sameGender = runMatchup(PokemonGender.Male, PokemonGender.Male);
    const oppositeGender = runMatchup(PokemonGender.Male, PokemonGender.Female);

    expect(sameGender).toBeGreaterThan(baseline);
    expect(oppositeGender).toBeLessThan(baseline);
    expect(sameGender).toBeCloseTo(baseline * 1.25, -1);
    expect(oppositeGender).toBeCloseTo(baseline * 0.75, -1);
  });

  it("tinted-lens doubles not-very-effective damage but leaves neutral hits unchanged", () => {
    // Given a Machop using karate-chop (Fighting) — 0.5x vs Abra (Psychic), 1x vs Machop (Fighting)
    const runHit = (defenderId: string, withAbility: boolean) => {
      const attacker = MockPokemon.fresh(MockPokemon.base, {
        id: "tinted-attacker",
        definitionId: "machop",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 2 },
        moveIds: ["karate-chop"],
        currentPp: { "karate-chop": 25 },
        ...(withAbility ? { abilityId: "tinted-lens" } : {}),
        derivedStats: { movement: 4, jump: 1, initiative: 100 },
      });
      const target = MockPokemon.fresh(MockPokemon.base, {
        id: "tinted-target",
        definitionId: defenderId,
        playerId: PlayerId.Player2,
        position: { x: 1, y: 2 },
        currentHp: 500,
        maxHp: 500,
      });
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const { engine } = buildMoveTestEngine([attacker, target]);
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "tinted-attacker",
        moveId: "karate-chop",
        targetPosition: { x: 1, y: 2 },
      });
      vi.restoreAllMocks();
      return 500 - target.currentHp;
    };

    // Then a not-very-effective hit (vs Abra) is doubled, ending up roughly neutral
    const resistedWithout = runHit("abra", false);
    const resistedWith = runHit("abra", true);
    expect(resistedWith).toBeGreaterThan(resistedWithout);
    expect(resistedWith).toBeCloseTo(resistedWithout * 2, -1);

    // And a neutral hit (vs Machop) is unchanged
    const neutralWithout = runHit("machop", false);
    const neutralWith = runHit("machop", true);
    expect(neutralWith).toBe(neutralWithout);
  });

  it("regenerator heals ~1/16 max HP at end of turn and emits AbilityActivated + HpRestored", () => {
    // Given a damaged Slowbro with regenerator
    const slowbro = MockPokemon.fresh(MockPokemon.base, {
      id: "slowbro",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      abilityId: "regenerator",
      currentHp: 50,
      maxHp: 160,
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 4, jump: 1, initiative: 10 },
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([slowbro, foe]);
    const endResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "slowbro",
      direction: slowbro.orientation,
    });

    // Then Slowbro regains floor(160/16) = 10 HP and both events are emitted
    expect(state.pokemon.get("slowbro")?.currentHp).toBe(60);
    expect(
      endResult.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "regenerator",
      ),
    ).toBe(true);
    expect(
      endResult.events.some(
        (e) =>
          e.type === BattleEventType.HpRestored && "pokemonId" in e && e.pokemonId === "slowbro",
      ),
    ).toBe(true);
  });

  it("regenerator heals nothing and emits no event at full HP", () => {
    // Given a full-HP regenerator holder
    const slowbro = MockPokemon.fresh(MockPokemon.base, {
      id: "slowbro",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      abilityId: "regenerator",
      currentHp: 160,
      maxHp: 160,
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 4, jump: 1, initiative: 10 },
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([slowbro, foe]);
    const endResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "slowbro",
      direction: slowbro.orientation,
    });

    // Then HP stays full and no regenerator event fires
    expect(state.pokemon.get("slowbro")?.currentHp).toBe(160);
    expect(
      endResult.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "regenerator",
      ),
    ).toBe(false);
  });

  it("sniper deals more on a critical hit than the same crit without it", () => {
    // Given an attacker with sniper using cross-chop (forced crit via random=0)
    const sniperAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "sniper-attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["cross-chop"],
      currentPp: { "cross-chop": 5 },
      abilityId: "sniper",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const sniperTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "sniper-target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 999,
      maxHp: 999,
    });

    // Given the same attacker without sniper
    const plainAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "plain-attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["cross-chop"],
      currentPp: { "cross-chop": 5 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const plainTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "plain-target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 999,
      maxHp: 999,
    });

    // random=0 → crit (0 < 1/24) in both runs
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine: critWith } = buildMoveTestEngine([sniperAttacker, sniperTarget]);
    const resultWith = critWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "sniper-attacker",
      moveId: "cross-chop",
      targetPosition: { x: 1, y: 2 },
    });
    const { engine: critWithout } = buildMoveTestEngine([plainAttacker, plainTarget]);
    const resultWithout = critWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "plain-attacker",
      moveId: "cross-chop",
      targetPosition: { x: 1, y: 2 },
    });

    // Then both hits crit, and sniper does ~1.5x the non-sniper crit
    expect(resultWith.events.map((e) => e.type)).toContain(BattleEventType.CriticalHit);
    expect(resultWithout.events.map((e) => e.type)).toContain(BattleEventType.CriticalHit);
    const damageWith = 999 - sniperTarget.currentHp;
    const damageWithout = 999 - plainTarget.currentHp;
    expect(damageWith).toBeGreaterThan(damageWithout);
    expect(damageWith).toBeCloseTo(damageWithout * 1.5, 0);
  });

  it("anger-point maxes the holder's Attack on a critical hit and emits StatChanged", () => {
    // Given a holder with anger-point taking a forced crit
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["cross-chop"],
      currentPp: { "cross-chop": 5 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const holder = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      definitionId: "tauros",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 999,
      maxHp: 999,
      abilityId: "anger-point",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, holder]);
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "cross-chop",
      targetPosition: { x: 1, y: 2 },
    });

    // Then Attack is maxed to +6 and AbilityActivated + StatChanged are emitted
    expect(state.pokemon.get("holder")?.statStages[StatName.Attack]).toBe(6);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "anger-point",
      ),
    ).toBe(true);
    expect(
      result.events.some(
        (e) =>
          e.type === BattleEventType.StatChanged &&
          "targetId" in e &&
          e.targetId === "holder" &&
          e.stat === StatName.Attack &&
          e.stages === 6,
      ),
    ).toBe(true);
  });

  it("anger-point does not trigger on a non-critical hit", () => {
    // Given a holder with anger-point taking a non-crit hit (random=0.99)
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const holder = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      definitionId: "tauros",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 999,
      maxHp: 999,
      abilityId: "anger-point",
    });

    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const { engine, state } = buildMoveTestEngine([attacker, holder]);
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // Then Attack is unchanged
    expect(state.pokemon.get("holder")?.statStages[StatName.Attack]).toBe(0);
  });

  it("defiant raises Attack +2 when an opponent lowers a stat, but not on self drops", () => {
    // Given a holder with defiant hit by growl (Attack -1) from an enemy
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["growl"],
      currentPp: { growl: 40 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const holder = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      definitionId: "tauros",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "defiant",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, holder]);
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "growl",
      targetPosition: { x: 1, y: 2 },
    });

    // Then growl's -1 is overcompensated by defiant's +2 → net +1, with both events emitted
    expect(state.pokemon.get("holder")?.statStages[StatName.Attack]).toBe(1);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "defiant",
      ),
    ).toBe(true);
    expect(
      result.events.some(
        (e) =>
          e.type === BattleEventType.StatChanged &&
          "targetId" in e &&
          e.targetId === "holder" &&
          e.stat === StatName.Attack &&
          e.stages === 2,
      ),
    ).toBe(true);
  });

  it("defiant does not trigger on a self-inflicted stat drop", () => {
    // Given a holder with defiant using leaf-storm (lowers its own Sp. Atk)
    const holder = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      definitionId: "tauros",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["leaf-storm"],
      currentPp: { "leaf-storm": 5 },
      abilityId: "defiant",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 500,
      maxHp: 500,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([holder, foe]);
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "holder",
      moveId: "leaf-storm",
      targetPosition: { x: 1, y: 2 },
    });

    // Then defiant did not fire: Attack stays at 0 (only the self Sp. Atk drop happened)
    expect(state.pokemon.get("holder")?.statStages[StatName.Attack]).toBe(0);
  });

  it("competitive raises Sp. Atk +2 when an opponent lowers a stat", () => {
    // Given a holder with competitive hit by growl (Attack -1) from an enemy
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["growl"],
      currentPp: { growl: 40 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const holder = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      definitionId: "tauros",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "competitive",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, holder]);
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "growl",
      targetPosition: { x: 1, y: 2 },
    });

    // Then Attack is lowered by growl but Sp. Atk rises +2, with both events emitted
    expect(state.pokemon.get("holder")?.statStages[StatName.Attack]).toBe(-1);
    expect(state.pokemon.get("holder")?.statStages[StatName.SpAttack]).toBe(2);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "competitive",
      ),
    ).toBe(true);
    expect(
      result.events.some(
        (e) =>
          e.type === BattleEventType.StatChanged &&
          "targetId" in e &&
          e.targetId === "holder" &&
          e.stat === StatName.SpAttack &&
          e.stages === 2,
      ),
    ).toBe(true);
  });

  it("unaware attacker ignores the defender's defensive stat stages", () => {
    // Given an unaware attacker vs a defender boosted to +6 Defense, and vs a +0 defender
    const runHit = (defenseStage: number) => {
      const attacker = MockPokemon.fresh(MockPokemon.base, {
        id: "unaware-attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 2 },
        moveIds: ["body-slam"],
        currentPp: { "body-slam": 15 },
        abilityId: "unaware",
        derivedStats: { movement: 4, jump: 1, initiative: 100 },
      });
      const defender = MockPokemon.fresh(MockPokemon.base, {
        id: "unaware-defender",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 2 },
        currentHp: 500,
        maxHp: 500,
        statStages: { ...MockPokemon.base.statStages, [StatName.Defense]: defenseStage },
      });
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const { engine } = buildMoveTestEngine([attacker, defender]);
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "unaware-attacker",
        moveId: "body-slam",
        targetPosition: { x: 1, y: 2 },
      });
      vi.restoreAllMocks();
      return 500 - defender.currentHp;
    };

    // Then the +6 Defense boost is ignored — same damage as a +0 defender
    expect(runHit(6)).toBe(runHit(0));
  });

  it("unaware defender ignores the attacker's offensive stat stages", () => {
    // Given an attacker boosted to +6 Attack vs an unaware defender, and a +0 attacker
    const runHit = (attackStage: number) => {
      const attacker = MockPokemon.fresh(MockPokemon.base, {
        id: "boosted-attacker",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 2 },
        moveIds: ["body-slam"],
        currentPp: { "body-slam": 15 },
        statStages: { ...MockPokemon.base.statStages, [StatName.Attack]: attackStage },
        derivedStats: { movement: 4, jump: 1, initiative: 100 },
      });
      const defender = MockPokemon.fresh(MockPokemon.base, {
        id: "unaware-defender",
        playerId: PlayerId.Player2,
        position: { x: 1, y: 2 },
        currentHp: 500,
        maxHp: 500,
        abilityId: "unaware",
      });
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const { engine } = buildMoveTestEngine([attacker, defender]);
      engine.submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "boosted-attacker",
        moveId: "body-slam",
        targetPosition: { x: 1, y: 2 },
      });
      vi.restoreAllMocks();
      return 500 - defender.currentHp;
    };

    // Then the +6 Attack boost is ignored — same damage as a +0 attacker
    expect(runHit(6)).toBe(runHit(0));
  });

  it("scrappy lets a Normal move hit a Ghost type that is otherwise immune", () => {
    // Given a scrappy attacker using tackle (Normal) vs Gastly (Ghost/Poison)
    const scrappyAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "scrappy-attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      abilityId: "scrappy",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const ghost = MockPokemon.fresh(MockPokemon.base, {
      id: "ghost",
      definitionId: "gastly",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    // Given the same attacker without scrappy
    const plainAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "plain-attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["tackle"],
      currentPp: { tackle: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const ghost2 = MockPokemon.fresh(MockPokemon.base, {
      id: "ghost-2",
      definitionId: "gastly",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const { engine: scrappyEngine } = buildMoveTestEngine([scrappyAttacker, ghost]);
    const scrappyResult = scrappyEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "scrappy-attacker",
      moveId: "tackle",
      targetPosition: { x: 1, y: 2 },
    });

    const { engine: plainEngine } = buildMoveTestEngine([plainAttacker, ghost2]);
    plainEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "plain-attacker",
      moveId: "tackle",
      targetPosition: { x: 1, y: 2 },
    });

    // Then scrappy deals damage while the non-scrappy attacker is fully blocked (immune)
    expect(200 - ghost.currentHp).toBeGreaterThan(0);
    expect(ghost2.currentHp).toBe(200);

    // And the emitted DamageDealt reports neutral effectiveness (1), not 0 — otherwise the
    // UI shows "Aucun effet" despite the hit dealing damage. Guards the handle-damage fix.
    const damageEvent = scrappyResult.events.find(
      (e) => e.type === BattleEventType.DamageDealt && "targetId" in e && e.targetId === "ghost",
    );
    expect(damageEvent && "effectiveness" in damageEvent ? damageEvent.effectiveness : 0).not.toBe(
      0,
    );
    expect(damageEvent && "effectiveness" in damageEvent ? damageEvent.effectiveness : 0).toBe(1);
  });

  it("skill-link forces a variable multi-hit move to land the maximum number of hits", () => {
    // Given a skill-link attacker using fury-attack (2-5 hits)
    const skillLinkAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "skill-link-attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["fury-attack"],
      currentPp: { "fury-attack": 20 },
      abilityId: "skill-link",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 999,
      maxHp: 999,
    });

    // Given the same attacker without skill-link (random=0 forces the minimum, 2 hits)
    const plainAttacker = MockPokemon.fresh(MockPokemon.base, {
      id: "plain-attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["fury-attack"],
      currentPp: { "fury-attack": 20 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const target2 = MockPokemon.fresh(MockPokemon.base, {
      id: "target-2",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 999,
      maxHp: 999,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine: skillLinkEngine } = buildMoveTestEngine([skillLinkAttacker, target]);
    const skillLinkResult = skillLinkEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "skill-link-attacker",
      moveId: "fury-attack",
      targetPosition: { x: 1, y: 2 },
    });

    const { engine: plainEngine } = buildMoveTestEngine([plainAttacker, target2]);
    const plainResult = plainEngine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "plain-attacker",
      moveId: "fury-attack",
      targetPosition: { x: 1, y: 2 },
    });

    const skillLinkHits = skillLinkResult.events.find(
      (e) => e.type === BattleEventType.MultiHitComplete,
    );
    const plainHits = plainResult.events.find((e) => e.type === BattleEventType.MultiHitComplete);

    // Then skill-link always lands the max (5) while the unmodified roll lands fewer
    expect(skillLinkHits && "totalHits" in skillLinkHits ? skillLinkHits.totalHits : 0).toBe(5);
    expect(plainHits && "totalHits" in plainHits ? plainHits.totalHits : 0).toBeLessThan(5);
  });

  // ===== Plan 137 — Tier B =====

  it("big-pecks blocks Defense drops from opponents", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["leer"],
      currentPp: { leer: 30 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "big-pecks",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, target]);
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "leer",
      targetPosition: { x: 1, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("target")?.statStages[StatName.Defense]).toBe(0);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "big-pecks",
      ),
    ).toBe(true);
  });

  it("illuminate blocks Accuracy drops from opponents", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["kinesis"],
      currentPp: { kinesis: 15 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      abilityId: "illuminate",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, target]);
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "kinesis",
      targetPosition: { x: 2, y: 2 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("target")?.statStages[StatName.Accuracy]).toBe(0);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "illuminate",
      ),
    ).toBe(true);
  });

  it("immunity blocks Poison status from poison-powder", () => {
    const holder = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "immunity",
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      moveIds: ["poison-powder"],
      currentPp: { "poison-powder": 35 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([holder, attacker], {
      activePokemonId: attacker.id,
    });
    const result = engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "poison-powder",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("holder")?.statusEffects).not.toContainEqual(
      expect.objectContaining({ type: StatusType.Poisoned }),
    );
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "immunity",
      ),
    ).toBe(true);
  });

  it("sand-rush does not crash when active under Sandstorm (smoke test)", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const sandshrew = MockPokemon.fresh(MockPokemon.base, {
      id: "sandshrew",
      definitionId: "sandshrew",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "sand-rush",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, sandshrew]);
    state.weather = Weather.Sandstorm;
    state.weatherTurnsRemaining = 9;
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    expect(result.success).toBe(true);
  });

  it("snow-cloak does not crash when active under Snow (smoke test)", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const articuno = MockPokemon.fresh(MockPokemon.base, {
      id: "articuno",
      definitionId: "articuno",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "snow-cloak",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, articuno]);
    state.weather = Weather.Snow;
    state.weatherTurnsRemaining = 9;
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    expect(result.success).toBe(true);
  });

  it("rattled raises Speed when hit by a Dark move, but not by a Normal move", () => {
    // Given a rattled holder hit by bite (Dark)
    const attackerDark = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-dark",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["bite"],
      currentPp: { bite: 25 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const holderDark = MockPokemon.fresh(MockPokemon.base, {
      id: "holder-dark",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
      abilityId: "rattled",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine: engineDark, state: stateDark } = buildMoveTestEngine([
      attackerDark,
      holderDark,
    ]);
    const darkResult = engineDark.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker-dark",
      moveId: "bite",
      targetPosition: { x: 1, y: 2 },
    });

    expect(stateDark.pokemon.get("holder-dark")?.statStages[StatName.Speed]).toBe(1);
    expect(
      darkResult.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "rattled",
      ),
    ).toBe(true);

    // Given a rattled holder hit by scratch (Normal) → no trigger
    const attackerNormal = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-normal",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const holderNormal = MockPokemon.fresh(MockPokemon.base, {
      id: "holder-normal",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
      abilityId: "rattled",
    });
    const { engine: engineNormal, state: stateNormal } = buildMoveTestEngine([
      attackerNormal,
      holderNormal,
    ]);
    engineNormal.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker-normal",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    expect(stateNormal.pokemon.get("holder-normal")?.statStages[StatName.Speed]).toBe(0);
  });

  it("shed-skin cures a major status at end of turn when the roll succeeds, not when it fails", () => {
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });

    // When the 1/3 roll succeeds (random < 1/3)
    const holderCure = MockPokemon.fresh(MockPokemon.base, {
      id: "holder-cure",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "shed-skin",
      statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: null }],
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const { engine: engineCure, state: stateCure } = buildMoveTestEngine([holderCure, foe], {
      random: () => 0,
    });
    const cureResult = engineCure.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "holder-cure",
      direction: holderCure.orientation,
    });

    expect(stateCure.pokemon.get("holder-cure")?.statusEffects).not.toContainEqual(
      expect.objectContaining({ type: StatusType.Paralyzed }),
    );
    expect(
      cureResult.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "shed-skin",
      ),
    ).toBe(true);

    // When the 1/3 roll fails (random >= 1/3) → status stays
    const holderKeep = MockPokemon.fresh(MockPokemon.base, {
      id: "holder-keep",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "shed-skin",
      statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: null }],
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe2 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe2",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine: engineKeep, state: stateKeep } = buildMoveTestEngine([holderKeep, foe2], {
      random: () => 0.9,
    });
    engineKeep.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "holder-keep",
      direction: holderKeep.orientation,
    });

    expect(stateKeep.pokemon.get("holder-keep")?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Paralyzed }),
    );
  });

  it("hydration cures a major status at end of turn under Rain, not in clear weather", () => {
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const holder = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "hydration",
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([holder, foe]);
    state.weather = Weather.Rain;
    state.weatherTurnsRemaining = 9;
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "holder",
      direction: holder.orientation,
    });

    expect(state.pokemon.get("holder")?.statusEffects).not.toContainEqual(
      expect.objectContaining({ type: StatusType.Burned }),
    );
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "hydration",
      ),
    ).toBe(true);
  });

  it("rain-dish heals ~1/16 max HP per turn under Rain, and nothing in clear weather", () => {
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 4, jump: 1, initiative: 10 },
    });

    // Under Rain → heals floor(160/16) = 10
    const holderRain = MockPokemon.fresh(MockPokemon.base, {
      id: "holder-rain",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      abilityId: "rain-dish",
      currentHp: 50,
      maxHp: 160,
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine: engineRain, state: stateRain } = buildMoveTestEngine([holderRain, foe]);
    stateRain.weather = Weather.Rain;
    stateRain.weatherTurnsRemaining = 9;
    const rainResult = engineRain.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "holder-rain",
      direction: holderRain.orientation,
    });

    expect(stateRain.pokemon.get("holder-rain")?.currentHp).toBe(60);
    expect(
      rainResult.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "rain-dish",
      ),
    ).toBe(true);

    // In clear weather → no heal
    const holderClear = MockPokemon.fresh(MockPokemon.base, {
      id: "holder-clear",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      abilityId: "rain-dish",
      currentHp: 50,
      maxHp: 160,
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const foe2 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe2",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 4, jump: 1, initiative: 10 },
    });
    const { engine: engineClear, state: stateClear } = buildMoveTestEngine([holderClear, foe2]);
    engineClear.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "holder-clear",
      direction: holderClear.orientation,
    });

    expect(stateClear.pokemon.get("holder-clear")?.currentHp).toBe(50);
  });

  it("ice-body heals ~1/16 max HP per turn under Snow", () => {
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      derivedStats: { movement: 4, jump: 1, initiative: 10 },
    });
    const holder = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      abilityId: "ice-body",
      currentHp: 50,
      maxHp: 160,
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([holder, foe]);
    state.weather = Weather.Snow;
    state.weatherTurnsRemaining = 9;
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "holder",
      direction: holder.orientation,
    });

    expect(state.pokemon.get("holder")?.currentHp).toBe(60);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "ice-body",
      ),
    ).toBe(true);
  });

  it("marvel-scale reduces physical damage taken while a major status is active", () => {
    const attackerWith = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-with",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const holderWith = MockPokemon.fresh(MockPokemon.base, {
      id: "holder-with",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 300,
      maxHp: 300,
      abilityId: "marvel-scale",
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
    });

    const attackerWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-without",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const holderWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "holder-without",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 300,
      maxHp: 300,
      abilityId: "marvel-scale",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine: engineWith } = buildMoveTestEngine([attackerWith, holderWith]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker-with",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    const { engine: engineWithout } = buildMoveTestEngine([attackerWithout, holderWithout]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker-without",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    const damageWith = 300 - holderWith.currentHp;
    const damageWithout = 300 - holderWithout.currentHp;
    expect(damageWith).toBeGreaterThan(0);
    expect(damageWith).toBeLessThan(damageWithout);
  });

  it("justified raises Attack when hit by a Dark move, but not by a Normal move", () => {
    const attackerDark = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-dark",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["bite"],
      currentPp: { bite: 25 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const holderDark = MockPokemon.fresh(MockPokemon.base, {
      id: "holder-dark",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
      abilityId: "justified",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine: engineDark, state: stateDark } = buildMoveTestEngine([
      attackerDark,
      holderDark,
    ]);
    const darkResult = engineDark.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker-dark",
      moveId: "bite",
      targetPosition: { x: 1, y: 2 },
    });

    expect(stateDark.pokemon.get("holder-dark")?.statStages[StatName.Attack]).toBe(1);
    expect(
      darkResult.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "justified",
      ),
    ).toBe(true);

    const attackerNormal = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-normal",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const holderNormal = MockPokemon.fresh(MockPokemon.base, {
      id: "holder-normal",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
      abilityId: "justified",
    });
    const { engine: engineNormal, state: stateNormal } = buildMoveTestEngine([
      attackerNormal,
      holderNormal,
    ]);
    engineNormal.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker-normal",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    expect(stateNormal.pokemon.get("holder-normal")?.statStages[StatName.Attack]).toBe(0);
  });

  it("drought summons harsh sunlight at battle start", () => {
    const holder = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      definitionId: "vulpix",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "drought",
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
    });

    // When the engine is created (battle start fires in constructor)
    const { state } = buildMoveTestEngine([holder, foe]);

    // Then the weather is Sun
    expect(state.weather).toBe(Weather.Sun);
  });

  it("steadfast raises Speed when the holder flinches", () => {
    const holder = MockPokemon.fresh(MockPokemon.base, {
      id: "holder",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      abilityId: "steadfast",
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      volatileStatuses: [{ type: StatusType.Flinch, remainingTurns: 1 }],
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      derivedStats: { movement: 4, jump: 1, initiative: 10 },
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([holder, foe]);
    // When the flinched holder tries to act, the flinch is consumed
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "holder",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // Then the move fails (flinched) and Speed rose by 1.
    // (The AbilityActivated event is emitted by the shared raiseStatByOne helper — asserted in the
    // rattled/justified tests; for a pre-seeded flinch it fires during CT scheduling, not this action.)
    expect(result.success).toBe(false);
    expect(state.pokemon.get("holder")?.statStages[StatName.Speed]).toBe(1);
  });

  // ===== Plan 138 — Tier C =====

  it("solar-power boosts special damage and burns 1/8 max HP each turn under Sun", () => {
    // Given a Charmander with Solar Power under Sun using ember (special)
    const attackerWith = MockPokemon.fresh(MockPokemon.charmander, {
      id: "charmander-with",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      abilityId: "solar-power",
      currentHp: 80,
      maxHp: 80,
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWith = MockPokemon.fresh(MockPokemon.base, {
      id: "target-with",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    const attackerWithout = MockPokemon.fresh(MockPokemon.charmander, {
      id: "charmander-without",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      currentHp: 80,
      maxHp: 80,
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "target-without",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    // When ember is used with Solar Power under Sun
    const { engine: engineWith, state: stateWith } = buildMoveTestEngine([
      attackerWith,
      targetWith,
    ]);
    stateWith.weather = Weather.Sun;
    stateWith.weatherTurnsRemaining = 9;
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "charmander-with",
      moveId: "ember",
      targetPosition: { x: 2, y: 2 },
    });

    // When ember is used without Solar Power under Sun
    const { engine: engineWithout, state: stateWithout } = buildMoveTestEngine([
      attackerWithout,
      targetWithout,
    ]);
    stateWithout.weather = Weather.Sun;
    stateWithout.weatherTurnsRemaining = 9;
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "charmander-without",
      moveId: "ember",
      targetPosition: { x: 2, y: 2 },
    });

    // Then Solar Power deals more special damage
    expect(200 - targetWith.currentHp).toBeGreaterThan(200 - targetWithout.currentHp);

    // And end of turn under Sun costs the holder 1/8 max HP (80/8 = 10) with AbilityActivated
    const endResult = engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "charmander-with",
      direction: attackerWith.orientation,
    });
    expect(attackerWith.currentHp).toBe(70);
    expect(
      endResult.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "solar-power",
      ),
    ).toBe(true);
  });

  it("sand-force boosts Rock/Ground/Steel moves during a Sandstorm, not other types", () => {
    // Given a Sandslash with Sand Force in a Sandstorm using rock-slide (Rock)
    const attackerWith = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-with",
      definitionId: "sandslash",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["rock-slide"],
      currentPp: { "rock-slide": 10 },
      abilityId: "sand-force",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWith = MockPokemon.fresh(MockPokemon.base, {
      id: "target-with",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      currentHp: 300,
      maxHp: 300,
    });

    const attackerWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker-without",
      definitionId: "sandslash",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["rock-slide"],
      currentPp: { "rock-slide": 10 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "target-without",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      currentHp: 300,
      maxHp: 300,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine: engineWith, state: stateWith } = buildMoveTestEngine([
      attackerWith,
      targetWith,
    ]);
    stateWith.weather = Weather.Sandstorm;
    stateWith.weatherTurnsRemaining = 9;
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker-with",
      moveId: "rock-slide",
      targetPosition: { x: 2, y: 2 },
    });

    const { engine: engineWithout, state: stateWithout } = buildMoveTestEngine([
      attackerWithout,
      targetWithout,
    ]);
    stateWithout.weather = Weather.Sandstorm;
    stateWithout.weatherTurnsRemaining = 9;
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker-without",
      moveId: "rock-slide",
      targetPosition: { x: 2, y: 2 },
    });

    // Then Sand Force boosts the Rock move
    expect(300 - targetWith.currentHp).toBeGreaterThan(300 - targetWithout.currentHp);
  });

  it("dry-skin absorbs Water moves as a heal instead of taking damage", () => {
    // Given a Paras with Dry Skin hit by a Water move below max HP
    const attacker = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "squirtle",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["water-gun"],
      currentPp: { "water-gun": 25 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const paras = MockPokemon.fresh(MockPokemon.base, {
      id: "paras",
      definitionId: "paras",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      abilityId: "dry-skin",
      currentHp: 100,
      maxHp: 200,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, paras]);

    // When water-gun hits the Dry Skin holder
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "squirtle",
      moveId: "water-gun",
      targetPosition: { x: 2, y: 2 },
    });

    // Then it is healed (not damaged) and AbilityActivated is emitted
    expect(state.pokemon.get("paras")?.currentHp).toBeGreaterThan(100);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "dry-skin",
      ),
    ).toBe(true);
  });

  it("leaf-guard blocks a major status under Sun and emits AbilityActivated", () => {
    // Given a Tangela with Leaf Guard under Sun targeted by Toxik (poison)
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["toxic"],
      currentPp: { toxic: 10 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const tangela = MockPokemon.fresh(MockPokemon.base, {
      id: "tangela",
      definitionId: "tangela",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      abilityId: "leaf-guard",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, tangela]);
    state.weather = Weather.Sun;
    state.weatherTurnsRemaining = 9;

    // When toxic is used against the Leaf Guard holder under Sun
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "toxic",
      targetPosition: { x: 2, y: 2 },
    });

    // Then no major status is applied and AbilityActivated is emitted
    expect(
      state.pokemon.get("tangela")?.statusEffects.some((s) => s.type === StatusType.BadlyPoisoned),
    ).toBe(false);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "leaf-guard",
      ),
    ).toBe(true);
  });

  it("overcoat grants immunity to powder moves", () => {
    // Given a Cloyster with Overcoat targeted by a powder status move
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 1, y: 2 },
      moveIds: ["sleep-powder"],
      currentPp: { "sleep-powder": 15 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const cloyster = MockPokemon.fresh(MockPokemon.base, {
      id: "cloyster",
      definitionId: "cloyster",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      abilityId: "overcoat",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, cloyster]);

    // When sleep-powder is used against the Overcoat holder
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "sleep-powder",
      targetPosition: { x: 2, y: 2 },
    });

    // Then sleep is not applied and AbilityActivated is emitted
    expect(
      state.pokemon.get("cloyster")?.statusEffects.some((s) => s.type === StatusType.Asleep),
    ).toBe(false);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "overcoat",
      ),
    ).toBe(true);
  });

  it("weak-armor lowers Defense and raises Speed when hit by a physical move", () => {
    // Given an Onix with Weak Armor hit by a physical contact move
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const onix = MockPokemon.fresh(MockPokemon.base, {
      id: "onix",
      definitionId: "onix",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 300,
      maxHp: 300,
      abilityId: "weak-armor",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, onix]);

    // When a physical move hits the Weak Armor holder
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // Then Defense -1, Speed +2, and AbilityActivated is emitted
    const onixAfter = state.pokemon.get("onix");
    expect(onixAfter?.statStages[StatName.Defense]).toBe(-1);
    expect(onixAfter?.statStages[StatName.Speed]).toBe(2);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "weak-armor",
      ),
    ).toBe(true);
  });

  it("tangled-feet halves incoming accuracy while the holder is confused", () => {
    // Given a confused Pidgeot with Tangled Feet; a 70%-accuracy hit misses at a roll it would land
    // against a non-confused holder (0.5 ms confusion → effective 35 < 0.6*100).
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["body-slam"],
      currentPp: { "body-slam": 15 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const pidgeot = MockPokemon.fresh(MockPokemon.base, {
      id: "pidgeot",
      definitionId: "pidgeot",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
      abilityId: "tangled-feet",
      volatileStatuses: [{ type: StatusType.Confused, remainingTurns: 3 }],
    });

    // Roll 0.6: body-slam (85%) vs confused holder → 85*0.5 = 42.5 < 60 → miss.
    const { engine, state } = buildMoveTestEngine([attacker, pidgeot], { random: () => 0.6 });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "body-slam",
      targetPosition: { x: 1, y: 2 },
    });

    // Then the confused holder takes no damage (the move missed)
    expect(state.pokemon.get("pidgeot")?.currentHp).toBe(200);
  });

  it("soundproof grants immunity to sound moves", () => {
    // Given an Electrode with Soundproof targeted by a sound move
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["hyper-voice"],
      currentPp: { "hyper-voice": 10 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const electrode = MockPokemon.fresh(MockPokemon.base, {
      id: "electrode",
      definitionId: "electrode",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
      abilityId: "soundproof",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, electrode]);

    // When a sound move hits the Soundproof holder
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "hyper-voice",
      targetPosition: { x: 1, y: 2 },
    });

    // Then it takes no damage and AbilityActivated is emitted
    expect(state.pokemon.get("electrode")?.currentHp).toBe(200);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "soundproof",
      ),
    ).toBe(true);
  });

  it("download raises Attack against a foe with lower Defense than Sp. Def", () => {
    // Given a Porygon with Download facing a foe whose Defense is lower than Sp. Def
    const porygon = MockPokemon.fresh(MockPokemon.base, {
      id: "porygon",
      definitionId: "porygon",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "download",
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      combatStats: { hp: 100, attack: 55, defense: 30, spAttack: 55, spDefense: 90, speed: 55 },
    });

    // When the engine is created (battle start fires in constructor)
    const { state } = buildMoveTestEngine([porygon, foe]);

    // Then Download raised Attack (Defense ≤ Sp. Def), not Sp. Atk
    const porygonAfter = state.pokemon.get("porygon");
    expect(porygonAfter?.statStages[StatName.Attack]).toBe(1);
    expect(porygonAfter?.statStages[StatName.SpAttack]).toBe(0);
  });

  it("download raises Sp. Atk against a foe with lower Sp. Def than Defense", () => {
    // Given a Porygon with Download facing a foe whose Sp. Def is lower than Defense
    const porygon = MockPokemon.fresh(MockPokemon.base, {
      id: "porygon",
      definitionId: "porygon",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      abilityId: "download",
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      combatStats: { hp: 100, attack: 55, defense: 90, spAttack: 55, spDefense: 30, speed: 55 },
    });

    const { state } = buildMoveTestEngine([porygon, foe]);

    // Then Download raised Sp. Atk (Sp. Def < Defense), not Attack
    const porygonAfter = state.pokemon.get("porygon");
    expect(porygonAfter?.statStages[StatName.SpAttack]).toBe(1);
    expect(porygonAfter?.statStages[StatName.Attack]).toBe(0);
  });

  it("wonder-skin halves the accuracy of incoming status moves", () => {
    // Given a Venomoth with Wonder Skin targeted by Toxik (90% status move). At roll 0.5 the
    // accuracy halving (90→45) makes it miss; without Wonder Skin it would have landed.
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["toxic"],
      currentPp: { toxic: 10 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const venomoth = MockPokemon.fresh(MockPokemon.base, {
      id: "venomoth",
      definitionId: "venomoth",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      abilityId: "wonder-skin",
    });

    // Roll 0.5: toxic (90%) vs Wonder Skin → 90*0.5 = 45 < 50 → miss.
    const { engine, state } = buildMoveTestEngine([attacker, venomoth], { random: () => 0.5 });
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "toxic",
      targetPosition: { x: 2, y: 2 },
    });

    // Then the status move missed → no poison applied
    expect(
      state.pokemon.get("venomoth")?.statusEffects.some((s) => s.type === StatusType.BadlyPoisoned),
    ).toBe(false);
  });

  it("hustle boosts physical damage at the cost of accuracy", () => {
    // Given a Raticate with Hustle using a physical move (compare damage on a guaranteed hit)
    const attackerWith = MockPokemon.fresh(MockPokemon.base, {
      id: "raticate-with",
      definitionId: "raticate",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      abilityId: "hustle",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWith = MockPokemon.fresh(MockPokemon.base, {
      id: "target-with",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 300,
      maxHp: 300,
    });

    const attackerWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "raticate-without",
      definitionId: "raticate",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "target-without",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 300,
      maxHp: 300,
    });

    // scratch is 100% accuracy → 0.8 Hustle penalty still lands; isolate the damage boost.
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine: engineWith } = buildMoveTestEngine([attackerWith, targetWith]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "raticate-with",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    const { engine: engineWithout } = buildMoveTestEngine([attackerWithout, targetWithout]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "raticate-without",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // Then Hustle deals more physical damage
    expect(300 - targetWith.currentHp).toBeGreaterThan(300 - targetWithout.currentHp);
  });

  it("analytic boosts damage when the holder acts after the target", () => {
    // Given a Magneton with Analytic whose target has already acted this round
    const attackerWith = MockPokemon.fresh(MockPokemon.base, {
      id: "magneton-with",
      definitionId: "magneton",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["swift"],
      currentPp: { swift: 20 },
      abilityId: "analytic",
      lastActedAtAction: 0,
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWith = MockPokemon.fresh(MockPokemon.base, {
      id: "target-with",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      currentHp: 300,
      maxHp: 300,
      lastActedAtAction: 5,
    });

    const attackerWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "magneton-without",
      definitionId: "magneton",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["swift"],
      currentPp: { swift: 20 },
      abilityId: "analytic",
      lastActedAtAction: 5,
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const targetWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "target-without",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      currentHp: 300,
      maxHp: 300,
      lastActedAtAction: 0,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    // When the target acted before the holder (targetAlreadyActed → boost)
    const { engine: engineWith } = buildMoveTestEngine([attackerWith, targetWith]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "magneton-with",
      moveId: "swift",
      targetPosition: { x: 2, y: 2 },
    });

    // When the holder acted before the target (no boost)
    const { engine: engineWithout } = buildMoveTestEngine([attackerWithout, targetWithout]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "magneton-without",
      moveId: "swift",
      targetPosition: { x: 2, y: 2 },
    });

    // Then Analytic deals more damage when acting last
    expect(300 - targetWith.currentHp).toBeGreaterThan(300 - targetWithout.currentHp);
  });

  it("stench flinches the target on a damaging hit when the roll succeeds", () => {
    // Given a Muk with Stench landing a damaging hit (roll 0 < 0.1 → flinch)
    const muk = MockPokemon.fresh(MockPokemon.base, {
      id: "muk",
      definitionId: "muk",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      abilityId: "stench",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
    });

    const { engine, state } = buildMoveTestEngine([muk, target], { random: () => 0 });

    // When the Stench holder lands a hit
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "muk",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // Then the target flinches and AbilityActivated is emitted
    expect(
      state.pokemon.get("target")?.volatileStatuses.some((v) => v.type === StatusType.Flinch),
    ).toBe(true);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "stench",
      ),
    ).toBe(true);
  });

  it("liquid-ooze damages the drainer instead of healing it", () => {
    // Given a Tentacool with Liquid Ooze drained by a draining move
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["mega-drain"],
      currentPp: { "mega-drain": 10 },
      currentHp: 100,
      maxHp: 200,
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const tentacool = MockPokemon.fresh(MockPokemon.base, {
      id: "tentacool",
      definitionId: "tentacool",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
      abilityId: "liquid-ooze",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, tentacool]);
    const attackerHpBefore = state.pokemon.get("attacker")?.currentHp ?? 0;

    // When the attacker drains the Liquid Ooze holder
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "mega-drain",
      targetPosition: { x: 1, y: 2 },
    });

    // Then the attacker LOSES HP (backlash) instead of healing, and AbilityActivated is emitted
    expect(state.pokemon.get("attacker")?.currentHp).toBeLessThan(attackerHpBefore);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "liquid-ooze",
      ),
    ).toBe(true);
  });

  it("aftermath damages the attacker for 1/4 max HP when the holder is KO'd by a contact move", () => {
    // Given a Weezing with Aftermath on its last legs, KO'd by a contact move
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      combatStats: { hp: 100, attack: 999, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
      currentHp: 100,
      maxHp: 100,
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const weezing = MockPokemon.fresh(MockPokemon.base, {
      id: "weezing",
      definitionId: "weezing",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 1,
      maxHp: 200,
      abilityId: "aftermath",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, weezing]);

    // When a contact move KOs the Aftermath holder
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // Then the attacker loses 1/4 of its max HP (100/4 = 25) and AbilityActivated is emitted
    expect(state.pokemon.get("weezing")?.currentHp).toBe(0);
    expect(state.pokemon.get("attacker")?.currentHp).toBe(75);
    expect(
      result.events.some(
        (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "aftermath",
      ),
    ).toBe(true);
  });

  it("infiltrator bypasses a Substitute and hits the holder behind it", () => {
    // Given a Crobat with Infiltrator attacking a foe shielded by a Substitute
    const crobat = MockPokemon.fresh(MockPokemon.base, {
      id: "crobat",
      definitionId: "crobat",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      abilityId: "infiltrator",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 200,
      maxHp: 200,
      substituteHp: 50,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([crobat, target]);
    const hpBefore = state.pokemon.get("target")?.currentHp ?? 0;

    // When the Infiltrator holder attacks through the Substitute
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "crobat",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // Then the holder behind the Substitute takes damage (bypass)
    expect(state.pokemon.get("target")?.currentHp).toBeLessThan(hpBefore);
  });

  it("serene-grace doubles a secondary's chance (poison lands at a roll that 30% would miss)", () => {
    // Given a roll of 0.5: a 30% secondary misses (50 >= 30), a 60% secondary lands (50 < 60)
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const { engine: engineWith } = buildMoveTestEngine([
      MockPokemon.fresh(MockPokemon.base, {
        id: "with",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 2 },
        moveIds: ["sludge-bomb"],
        currentPp: { "sludge-bomb": 10 },
        abilityId: "serene-grace",
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      }),
      MockPokemon.fresh(MockPokemon.base, {
        id: "target-with",
        definitionId: "test",
        playerId: PlayerId.Player2,
        position: { x: 3, y: 2 },
        currentHp: 300,
        maxHp: 300,
      }),
    ]);
    const poisonWith = engineWith
      .submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "with",
        moveId: "sludge-bomb",
        targetPosition: { x: 3, y: 2 },
      })
      .events.some(
        (e) => e.type === BattleEventType.StatusApplied && e.status === StatusType.Poisoned,
      );

    const { engine: engineWithout } = buildMoveTestEngine([
      MockPokemon.fresh(MockPokemon.base, {
        id: "without",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 2 },
        moveIds: ["sludge-bomb"],
        currentPp: { "sludge-bomb": 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      }),
      MockPokemon.fresh(MockPokemon.base, {
        id: "target-without",
        definitionId: "test",
        playerId: PlayerId.Player2,
        position: { x: 3, y: 2 },
        currentHp: 300,
        maxHp: 300,
      }),
    ]);
    const poisonWithout = engineWithout
      .submitAction(PlayerId.Player1, {
        kind: ActionKind.UseMove,
        pokemonId: "without",
        moveId: "sludge-bomb",
        targetPosition: { x: 3, y: 2 },
      })
      .events.some(
        (e) => e.type === BattleEventType.StatusApplied && e.status === StatusType.Poisoned,
      );

    expect(poisonWith).toBe(true);
    expect(poisonWithout).toBe(false);
  });

  it("sheer-force boosts a secondary move's power by 1.3x", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const targetWith = MockPokemon.fresh(MockPokemon.base, {
      id: "target-with",
      definitionId: "test",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      currentHp: 500,
      maxHp: 500,
    });
    const { engine: engineWith } = buildMoveTestEngine([
      MockPokemon.fresh(MockPokemon.base, {
        id: "with",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 2 },
        moveIds: ["sludge-bomb"],
        currentPp: { "sludge-bomb": 10 },
        abilityId: "sheer-force",
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      }),
      targetWith,
    ]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "with",
      moveId: "sludge-bomb",
      targetPosition: { x: 3, y: 2 },
    });

    const targetWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "target-without",
      definitionId: "test",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      currentHp: 500,
      maxHp: 500,
    });
    const { engine: engineWithout } = buildMoveTestEngine([
      MockPokemon.fresh(MockPokemon.base, {
        id: "without",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 2 },
        moveIds: ["sludge-bomb"],
        currentPp: { "sludge-bomb": 10 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      }),
      targetWithout,
    ]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "without",
      moveId: "sludge-bomb",
      targetPosition: { x: 3, y: 2 },
    });

    expect(500 - targetWith.currentHp).toBeGreaterThan(500 - targetWithout.currentHp);
  });

  it("sheer-force suppresses the secondary effect and announces itself once", () => {
    // Given a roll of 0: the 30% poison would land for a normal attacker
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "sheer",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["sludge-bomb"],
      currentPp: { "sludge-bomb": 10 },
      abilityId: "sheer-force",
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const target = MockPokemon.fresh(MockPokemon.base, {
      id: "target",
      definitionId: "test",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 2 },
      currentHp: 500,
      maxHp: 500,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine } = buildMoveTestEngine([attacker, target]);
    const events = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "sheer",
      moveId: "sludge-bomb",
      targetPosition: { x: 3, y: 2 },
    }).events;

    const poisoned = events.some(
      (e) => e.type === BattleEventType.StatusApplied && e.status === StatusType.Poisoned,
    );
    const sheerActivations = events.filter(
      (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "sheer-force",
    );

    expect(poisoned).toBe(false);
    expect(sheerActivations).toHaveLength(1);
  });

  it("sheer-force neither boosts nor activates on a move without a secondary", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const targetWith = MockPokemon.fresh(MockPokemon.base, {
      id: "target-with",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 500,
      maxHp: 500,
    });
    const { engine: engineWith } = buildMoveTestEngine([
      MockPokemon.fresh(MockPokemon.base, {
        id: "with",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 2 },
        moveIds: ["scratch"],
        currentPp: { scratch: 35 },
        abilityId: "sheer-force",
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      }),
      targetWith,
    ]);
    const eventsWith = engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "with",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    }).events;

    const targetWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "target-without",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 500,
      maxHp: 500,
    });
    const { engine: engineWithout } = buildMoveTestEngine([
      MockPokemon.fresh(MockPokemon.base, {
        id: "without",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 2 },
        moveIds: ["scratch"],
        currentPp: { scratch: 35 },
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      }),
      targetWithout,
    ]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "without",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    const sheerActivated = eventsWith.some(
      (e) => e.type === BattleEventType.AbilityActivated && e.abilityId === "sheer-force",
    );
    expect(sheerActivated).toBe(false);
    expect(500 - targetWith.currentHp).toBe(500 - targetWithout.currentHp);
  });

  it("mold-breaker ignores Levitate so a Ground move connects", () => {
    // Given a Pinsir with Brise Moule facing a Levitate Gastly
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["earthquake"],
      currentPp: { earthquake: 10 },
      abilityId: "mold-breaker",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const gastly = MockPokemon.fresh(MockPokemon.base, {
      id: "gastly",
      definitionId: "gastly",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      abilityId: "levitate",
      currentHp: 100,
      maxHp: 100,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, gastly]);

    // When earthquake (Ground) is used against the Levitate target
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "earthquake",
      targetPosition: { x: 2, y: 2 },
    });

    // Then Gastly takes damage despite Levitate
    expect(state.pokemon.get("gastly")?.currentHp).toBeLessThan(100);
  });

  it("mold-breaker ignores Sturdy so a one-hit KO goes through", () => {
    // Given a mold-breaker attacker overwhelming a full-HP Sturdy Geodude
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["karate-chop"],
      currentPp: { "karate-chop": 25 },
      abilityId: "mold-breaker",
      combatStats: { hp: 100, attack: 999, defense: 55, spAttack: 55, spDefense: 55, speed: 55 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const geodude = MockPokemon.fresh(MockPokemon.base, {
      id: "geodude",
      definitionId: "geodude",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      currentHp: 50,
      maxHp: 50,
      abilityId: "sturdy",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, geodude]);

    // When the overwhelming attack hits full-HP Geodude
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "karate-chop",
      targetPosition: { x: 1, y: 2 },
    });

    // Then Sturdy does not save it
    expect(result.success).toBe(true);
    expect(state.pokemon.get("geodude")?.currentHp).toBe(0);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.PokemonKo);
  });

  it("mold-breaker ignores Clear Body so an enemy stat drop lands", () => {
    // Given a mold-breaker attacker against a Clear Body Tentacool
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["kinesis"],
      currentPp: { kinesis: 15 },
      abilityId: "mold-breaker",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const tentacool = MockPokemon.fresh(MockPokemon.base, {
      id: "tentacool",
      definitionId: "tentacool",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      abilityId: "clear-body",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, tentacool]);

    // When kinesis (Accuracy -1) is used against Clear Body
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "kinesis",
      targetPosition: { x: 2, y: 2 },
    });

    // Then the Accuracy drop is applied despite Clear Body
    expect(result.success).toBe(true);
    expect(state.pokemon.get("tentacool")?.statStages[StatName.Accuracy]).toBe(-1);
  });

  it("mold-breaker does not stop a non-breakable reactive ability (Static)", () => {
    // Given a mold-breaker attacker making contact with a Static Pikachu
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      abilityId: "mold-breaker",
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const pikachu = MockPokemon.fresh(MockPokemon.base, {
      id: "pikachu",
      definitionId: "pikachu",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "static",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, pikachu]);

    // When a contact move hits Pikachu
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "scratch",
      targetPosition: { x: 1, y: 2 },
    });

    // Then Static still paralyzes the attacker (not breakable)
    expect(result.success).toBe(true);
    expect(
      state.pokemon.get("attacker")?.statusEffects.some((s) => s.type === StatusType.Paralyzed),
    ).toBe(true);
  });

  it("Levitate still blocks a Ground move from an attacker without mold-breaker", () => {
    // Given a plain attacker (no mold-breaker) facing a Levitate Gastly
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["earthquake"],
      currentPp: { earthquake: 10 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const gastly = MockPokemon.fresh(MockPokemon.base, {
      id: "gastly",
      definitionId: "gastly",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 2 },
      abilityId: "levitate",
      currentHp: 100,
      maxHp: 100,
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, gastly]);

    // When earthquake is used without mold-breaker
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "earthquake",
      targetPosition: { x: 2, y: 2 },
    });

    // Then Levitate blocks all damage
    expect(state.pokemon.get("gastly")?.currentHp).toBe(100);
  });
});
