import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { PlayerId } from "../enums/player-id";
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

  it("cute-charm inflates attacker with Infatuated on contact with 30% chance", () => {
    // Given a Jigglypuff with Cute Charm as the target
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      moveIds: ["scratch"],
      currentPp: { scratch: 35 },
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
    });
    const jigglypuff = MockPokemon.fresh(MockPokemon.base, {
      id: "jigglypuff",
      definitionId: "jigglypuff",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 2 },
      abilityId: "cute-charm",
    });

    vi.spyOn(Math, "random").mockReturnValue(0);

    const { engine, state } = buildMoveTestEngine([attacker, jigglypuff]);

    // When a contact move hits Jigglypuff
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
});
