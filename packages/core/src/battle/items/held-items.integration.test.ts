import { loadData, typeChart } from "@pokemon-tactic/data";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerController } from "../../enums/player-controller";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { TeamValidationError } from "../../enums/team-validation-error";
import { TerrainType } from "../../enums/terrain-type";
import { TurnSystemKind } from "../../enums/turn-system-kind";
import { buildItemTestEngine, MockBattle, MockPokemon } from "../../testing";
import { BattleEngine } from "../BattleEngine";
import { validateTeamSelection } from "../team-validator";

describe("Leftovers", () => {
  it("Given Pokemon avec Restes à HP incomplets, When fin de tour, Then HP augmente et event HpRestored émis", () => {
    const pokemon = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      heldItemId: HeldItemId.Leftovers,
      currentHp: 50,
    });
    const foe = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildItemTestEngine([pokemon, foe]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: pokemon.id,
      direction: Direction.East,
    });

    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HpRestored);
    const state = engine.getGameState(PlayerId.Player1);
    expect(state.pokemon.get(pokemon.id)?.currentHp).toBeGreaterThan(50);
  });

  it("Given Pokemon avec Restes à HP max, When fin de tour, Then pas de heal", () => {
    const pokemon = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      heldItemId: HeldItemId.Leftovers,
    });
    const foe = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildItemTestEngine([pokemon, foe]);
    const maxHp = pokemon.maxHp;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: pokemon.id,
      direction: Direction.East,
    });

    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.HpRestored);
    expect(engine.getGameState(PlayerId.Player1).pokemon.get(pokemon.id)?.currentHp).toBe(maxHp);
  });
});

describe("Life Orb", () => {
  it("Given attaquant avec Orbe-Vie, When inflige des dégâts, Then reçoit recoil", () => {
    const p1 = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      heldItemId: HeldItemId.LifeOrb,
    });
    const p2 = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildItemTestEngine([p1, p2]);
    const hpBefore = p1.maxHp;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: p1.id,
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const attackerState = engine.getGameState(PlayerId.Player1).pokemon.get(p1.id);
    expect(attackerState?.currentHp).toBeLessThan(hpBefore);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HeldItemActivated);
  });
});

describe("Focus Sash", () => {
  it("Given Pokemon avec Bandeau Focus à HP max, When prendrait KO, Then survit à 1 HP et item consommé", () => {
    const weakDefender = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      heldItemId: HeldItemId.FocusSash,
      currentHp: 99,
      maxHp: 99,
      combatStats: { hp: 99, attack: 5, defense: 1, spAttack: 5, spDefense: 1, speed: 10 },
    });
    const strongAttacker = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      combatStats: { hp: 104, attack: 200, defense: 70, spAttack: 55, spDefense: 69, speed: 100 },
    });
    const { engine } = buildItemTestEngine([strongAttacker, weakDefender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: strongAttacker.id,
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const defState = engine.getGameState(PlayerId.Player1).pokemon.get(weakDefender.id);
    expect(defState?.currentHp).toBe(1);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HeldItemActivated);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HeldItemConsumed);
    expect(defState?.heldItemId).toBeUndefined();
  });
});

describe("Rocky Helmet", () => {
  it("Given défenseur avec Casque Gonflant, When reçoit contact, Then attaquant prend dégâts", () => {
    const p1 = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const p2 = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      heldItemId: HeldItemId.RockyHelmet,
    });
    const { engine } = buildItemTestEngine([p1, p2]);
    const attackerHpBefore = p1.maxHp;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: p1.id,
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const attackerState = engine.getGameState(PlayerId.Player1).pokemon.get(p1.id);
    expect(attackerState?.currentHp).toBeLessThan(attackerHpBefore);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HeldItemActivated);
  });
});

describe("Weakness Policy", () => {
  it("Given Pokemon avec Politique Faiblesse, When touché super-efficace, Then Atk +2 et AtkSp +2, item consommé", () => {
    const p2 = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      heldItemId: HeldItemId.WeaknessPolicy,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const p1 = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const { engine } = buildItemTestEngine([p1, p2]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: p1.id,
      moveId: "water-gun",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const state = engine.getGameState(PlayerId.Player1).pokemon.get(p2.id);
    expect(state?.statStages.attack).toBe(2);
    expect(state?.statStages.spAttack).toBe(2);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HeldItemConsumed);
    expect(state?.heldItemId).toBeUndefined();
  });
});

describe("Scope Lens", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Given attaquant avec Lentille Nette, When random=0.05, Then coup critique", () => {
    // random 0.05: > 1/24=0.0417 (pas crit stage 0), < 1/8=0.125 (crit stage 1 via Scope Lens)
    vi.spyOn(Math, "random").mockReturnValue(0.05);
    const p1 = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      heldItemId: HeldItemId.ScopeLens,
    });
    const p2 = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildItemTestEngine([p1, p2]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: p1.id,
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.CriticalHit);
  });
});

describe("Light Ball", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Given Pikachu avec Orbe Lumière, When attaque, Then dégâts supérieurs à Pikachu sans item", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const defenderWith = MockPokemon.fresh(MockPokemon.base, {
      id: "def-with",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      currentHp: 300,
      maxHp: 300,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      combatStats: { hp: 300, attack: 50, defense: 100, spAttack: 50, spDefense: 50, speed: 10 },
    });
    const { engine: engineWith } = buildItemTestEngine([
      MockPokemon.fresh(MockPokemon.base, {
        id: "pika-with",
        definitionId: "pikachu",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        moveIds: ["thunderbolt"],
        currentPp: { thunderbolt: 15 },
        baseStats: { hp: 35, attack: 55, defense: 40, spAttack: 50, spDefense: 50, speed: 90 },
        combatStats: { hp: 70, attack: 58, defense: 45, spAttack: 55, spDefense: 55, speed: 95 },
        heldItemId: HeldItemId.LightBall,
      }),
      defenderWith,
    ]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "pika-with",
      moveId: "thunderbolt",
      targetPosition: { x: 1, y: 0 },
    });

    const defenderWithout = MockPokemon.fresh(MockPokemon.base, {
      id: "def-without",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      currentHp: 300,
      maxHp: 300,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      combatStats: { hp: 300, attack: 50, defense: 100, spAttack: 50, spDefense: 50, speed: 10 },
    });
    const { engine: engineWithout } = buildItemTestEngine([
      MockPokemon.fresh(MockPokemon.base, {
        id: "pika-without",
        definitionId: "pikachu",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        moveIds: ["thunderbolt"],
        currentPp: { thunderbolt: 15 },
        baseStats: { hp: 35, attack: 55, defense: 40, spAttack: 50, spDefense: 50, speed: 90 },
        combatStats: { hp: 70, attack: 58, defense: 45, spAttack: 55, spDefense: 55, speed: 95 },
      }),
      defenderWithout,
    ]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "pika-without",
      moveId: "thunderbolt",
      targetPosition: { x: 1, y: 0 },
    });

    const damageWith = 300 - defenderWith.currentHp;
    const damageWithout = 300 - defenderWithout.currentHp;
    expect(damageWith).toBeGreaterThan(damageWithout);
  });
});

describe("Choice lock", () => {
  it("Given Pokemon avec Choix + lockedMoveId, When tente autre move, Then move filtré de getLegalActions", () => {
    const p1 = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      heldItemId: HeldItemId.ChoiceBand,
      lockedMoveId: "tackle",
    });
    const p2 = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildItemTestEngine([p1, p2]);

    const actions = engine.getLegalActions(PlayerId.Player1);
    const useMoveActions = actions.filter((a) => a.kind === ActionKind.UseMove);
    for (const a of useMoveActions) {
      if (a.kind === ActionKind.UseMove) {
        expect(a.moveId).toBe("tackle");
      }
    }
  });

  it("Given attaquant avec Choix Écharpe, When utilise un move, Then lockedMoveId défini", () => {
    const p1 = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      heldItemId: HeldItemId.ChoiceScarf,
    });
    const p2 = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildItemTestEngine([p1, p2]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: p1.id,
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    const state = engine.getGameState(PlayerId.Player1);
    expect(state.pokemon.get(p1.id)?.lockedMoveId).toBe("tackle");
  });
});

describe("Critical hit", () => {
  it("CriticalHit event émis quand coup critique (random retourne 0)", () => {
    const data = loadData();
    const moveRegistry = new Map(data.moves.map((m) => [m.id, m]));
    const pokemonTypesMap = new Map(data.pokemon.map((p) => [p.id, p.types]));

    const p1 = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const p2 = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const state = MockBattle.stateFrom([p1, p2], 6, 6);

    const alwaysCrit = () => 0;
    const engine = new BattleEngine(
      state,
      moveRegistry,
      typeChart,
      pokemonTypesMap,
      undefined,
      alwaysCrit,
      0,
    );

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: p1.id,
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.events.map((e) => e.type)).toContain(BattleEventType.CriticalHit);
  });
});

describe("Heavy-Duty Boots — terrain", () => {
  it("Given Pokemon avec Grosses Bottes sur swamp, When fin de tour, Then pas de statut et aucun HeldItemActivated", () => {
    const pokemon = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      heldItemId: HeldItemId.HeavyDutyBoots,
    });
    const foe = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 3, y: 3 },
      orientation: Direction.West,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildItemTestEngine([pokemon, foe], 6);
    MockBattle.setTile(state, 0, 0, { terrain: TerrainType.Swamp });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: pokemon.id,
      direction: Direction.East,
    });

    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.HeldItemActivated);
    const pokemonState = engine.getGameState(PlayerId.Player1).pokemon.get(pokemon.id);
    expect(pokemonState?.statusEffects).toHaveLength(0);
  });

  it("Given Pokemon avec Grosses Bottes sur magma, When se déplace sur magma, Then pas de brûlure", () => {
    const pokemon = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      heldItemId: HeldItemId.HeavyDutyBoots,
      moveIds: [],
      currentPp: {},
    });
    const foe = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
      orientation: Direction.West,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildItemTestEngine([pokemon, foe], 6);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Magma });

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: pokemon.id,
      path: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    });

    const pokemonState = engine.getGameState(PlayerId.Player1).pokemon.get(pokemon.id);
    expect(pokemonState?.statusEffects.some((s) => s.type === StatusType.Burned)).toBe(false);
  });
});

describe("Expert Belt", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Given Squirtle avec Expert Belt, When Water Gun sur Charmander (super-efficace), Then dégâts supérieurs à sans item", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const targetWith = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-with",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      currentHp: 300,
      maxHp: 300,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      combatStats: { hp: 300, attack: 57, defense: 48, spAttack: 65, spDefense: 55, speed: 70 },
    });
    const { engine: engineWith } = buildItemTestEngine([
      MockPokemon.fresh(MockPokemon.squirtle, {
        id: "att-with",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.ExpertBelt,
      }),
      targetWith,
    ]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "att-with",
      moveId: "water-gun",
      targetPosition: { x: 1, y: 0 },
    });

    const targetWithout = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-without",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      currentHp: 300,
      maxHp: 300,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      combatStats: { hp: 300, attack: 57, defense: 48, spAttack: 65, spDefense: 55, speed: 70 },
    });
    const { engine: engineWithout } = buildItemTestEngine([
      MockPokemon.fresh(MockPokemon.squirtle, {
        id: "att-without",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      }),
      targetWithout,
    ]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "att-without",
      moveId: "water-gun",
      targetPosition: { x: 1, y: 0 },
    });

    const damageWith = 300 - targetWith.currentHp;
    const damageWithout = 300 - targetWithout.currentHp;
    expect(damageWith).toBeGreaterThan(damageWithout);
  });
});

describe("Sitrus Berry", () => {
  it("Given Pokemon avec Baie Sitrus, When HP tombe sous 50%, Then heal et item consommé", () => {
    const p1 = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      combatStats: { hp: 100, attack: 100, defense: 70, spAttack: 55, spDefense: 69, speed: 100 },
    });
    // p2 starts at 65% HP; tackle min damage (~39) → 91/200 = 45.5% → berry triggers
    const p2 = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      heldItemId: HeldItemId.SitrusBerry,
      currentHp: 130,
      maxHp: 200,
      combatStats: { hp: 200, attack: 52, defense: 40, spAttack: 60, spDefense: 50, speed: 65 },
    });
    const { engine } = buildItemTestEngine([p1, p2]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: p1.id,
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HpRestored);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HeldItemConsumed);
    const defState = engine.getGameState(PlayerId.Player1).pokemon.get(p2.id);
    expect(defState?.heldItemId).toBeUndefined();
  });
});

describe("Choice Band", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Given Squirtle avec Choix Poing, When Tackle (physique), Then dégâts supérieurs à sans item", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const targetWith = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-with",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      currentHp: 300,
      maxHp: 300,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      combatStats: { hp: 300, attack: 57, defense: 48, spAttack: 65, spDefense: 55, speed: 70 },
    });
    const { engine: engineWith } = buildItemTestEngine([
      MockPokemon.fresh(MockPokemon.squirtle, {
        id: "att-with",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
        heldItemId: HeldItemId.ChoiceBand,
      }),
      targetWith,
    ]);
    engineWith.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "att-with",
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    const targetWithout = MockPokemon.fresh(MockPokemon.charmander, {
      id: "target-without",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      orientation: Direction.West,
      currentHp: 300,
      maxHp: 300,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
      combatStats: { hp: 300, attack: 57, defense: 48, spAttack: 65, spDefense: 55, speed: 70 },
    });
    const { engine: engineWithout } = buildItemTestEngine([
      MockPokemon.fresh(MockPokemon.squirtle, {
        id: "att-without",
        playerId: PlayerId.Player1,
        position: { x: 0, y: 0 },
        orientation: Direction.East,
        derivedStats: { movement: 3, jump: 1, initiative: 100 },
      }),
      targetWithout,
    ]);
    engineWithout.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "att-without",
      moveId: "tackle",
      targetPosition: { x: 1, y: 0 },
    });

    const damageWith = 300 - targetWith.currentHp;
    const damageWithout = 300 - targetWithout.currentHp;
    expect(damageWith).toBeGreaterThan(damageWithout);
  });
});

describe("Choice Scarf", () => {
  it("Given Pokemon lent avec Choix Écharpe, When CT système actif, Then agit avant Pokemon rapide sans écharpe", () => {
    // P1 speed=45 (CT gain=106), avec Scarf × 1.5 = 159 → atteint 1000 en 3 ticks
    // P2 speed=100 (CT gain=122) → atteint 1000 en 4 ticks → P1 agit en premier
    const data = loadData();
    const moveRegistry = new Map(data.moves.map((m) => [m.id, m]));
    const pokemonTypesMap = new Map(data.pokemon.map((p) => [p.id, p.types]));

    const p1 = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "slow-with-scarf",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      derivedStats: { movement: 3, jump: 1, initiative: 45 },
      baseStats: { hp: 44, attack: 48, defense: 65, spAttack: 50, spDefense: 64, speed: 45 },
      heldItemId: HeldItemId.ChoiceScarf,
    });
    const p2 = MockPokemon.fresh(MockPokemon.charmander, {
      id: "fast-no-item",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 3 },
      orientation: Direction.West,
      derivedStats: { movement: 4, jump: 1, initiative: 100 },
      baseStats: { hp: 39, attack: 52, defense: 43, spAttack: 60, spDefense: 50, speed: 100 },
    });
    const state = MockBattle.stateFrom([p1, p2], 6, 6);
    const engine = new BattleEngine(
      state,
      moveRegistry,
      typeChart,
      pokemonTypesMap,
      undefined,
      undefined,
      0,
      TurnSystemKind.ChargeTime,
      undefined,
      null,
      data.itemRegistry,
    );

    expect(engine.getGameState(PlayerId.Player1).turnOrder[0]).toBe("slow-with-scarf");
  });
});

describe("Leftovers — pas de double déclenchement", () => {
  it("Given deux Pokemon dont un avec Restes, When P1 fait EndTurn, Then Restes proc une seule fois", () => {
    const p1 = MockPokemon.fresh(MockPokemon.squirtle, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      orientation: Direction.East,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      heldItemId: HeldItemId.Leftovers,
      currentHp: 50,
    });
    const p2 = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 3, y: 3 },
      orientation: Direction.West,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildItemTestEngine([p1, p2]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: p1.id,
      direction: Direction.East,
    });

    const hpRestoredEvents = result.events.filter((e) => e.type === BattleEventType.HpRestored);
    expect(hpRestoredEvents).toHaveLength(1);
  });
});

describe("Team validator — duplicate item", () => {
  it("Given équipe avec deux Restes, When valide, Then erreur DuplicateItem", () => {
    const result = validateTeamSelection(
      {
        playerId: PlayerId.Player1,
        pokemonDefinitionIds: ["bulbasaur", "charmander"],
        controller: PlayerController.Human,
        heldItems: {
          bulbasaur: HeldItemId.Leftovers,
          charmander: HeldItemId.Leftovers,
        },
      },
      ["bulbasaur", "charmander"],
      6,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(TeamValidationError.DuplicateItem);
  });

  it("Given équipe avec items différents, When valide, Then pas d'erreur duplicate", () => {
    const result = validateTeamSelection(
      {
        playerId: PlayerId.Player1,
        pokemonDefinitionIds: ["bulbasaur", "charmander"],
        controller: PlayerController.Human,
        heldItems: {
          bulbasaur: HeldItemId.Leftovers,
          charmander: HeldItemId.LifeOrb,
        },
      },
      ["bulbasaur", "charmander"],
      6,
    );
    expect(result.valid).toBe(true);
  });
});
