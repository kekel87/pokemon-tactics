import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { PlayerId } from "../enums/player-id";
import { PokemonGender } from "../enums/pokemon-gender";
import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
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
    const { engine, state } = buildMoveTestEngine([primeape, attacker]);
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
    const { engine, state } = buildMoveTestEngine([hypno, attacker]);
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
    const { engine, state } = buildMoveTestEngine([hitmonlee, attacker]);
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
});
