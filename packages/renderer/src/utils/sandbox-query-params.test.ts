import { describe, expect, it } from "vitest";
import { Direction, StatName, StatusType } from "@pokemon-tactic/core";
import { parseSandboxQueryParams } from "./sandbox-query-params";

describe("parseSandboxQueryParams", () => {
  it("returns null when sandbox param is absent", () => {
    expect(parseSandboxQueryParams("")).toBeNull();
    expect(parseSandboxQueryParams("?random")).toBeNull();
  });

  it("returns defaults when only sandbox param is present", () => {
    const config = parseSandboxQueryParams("?sandbox");
    expect(config).not.toBeNull();
    expect(config!.pokemon).toBe("pikachu");
    expect(config!.moves).toEqual(["thunderbolt", "thunder-wave", "double-team", "volt-tackle"]);
    expect(config!.hp).toBe(100);
    expect(config!.status).toBeNull();
    expect(config!.statStages).toEqual({});
    expect(config!.dummyPokemon).toBe("machop");
    expect(config!.dummyMove).toBeNull();
    expect(config!.dummyDirection).toBe(Direction.West);
    expect(config!.dummyHp).toBe(100);
    expect(config!.dummyStatus).toBeNull();
    expect(config!.dummyStatStages).toEqual({});
  });

  it("parses full config from query params", () => {
    const search =
      "?sandbox&pokemon=bulbasaur&moves=razor-leaf,sleep-powder&hp=50&status=burned" +
      "&statStages=attack:2,defense:-1" +
      "&dummy=charmander&dummyMove=ember&dummyDirection=north&dummyHp=75&dummyStatus=paralyzed" +
      "&dummyStatStages=speed:-2";

    const config = parseSandboxQueryParams(search);
    expect(config).not.toBeNull();
    expect(config!.pokemon).toBe("bulbasaur");
    expect(config!.moves).toEqual(["razor-leaf", "sleep-powder"]);
    expect(config!.hp).toBe(50);
    expect(config!.status).toBe(StatusType.Burned);
    expect(config!.statStages).toEqual({ [StatName.Attack]: 2, [StatName.Defense]: -1 });
    expect(config!.dummyPokemon).toBe("charmander");
    expect(config!.dummyMove).toBe("ember");
    expect(config!.dummyDirection).toBe(Direction.North);
    expect(config!.dummyHp).toBe(75);
    expect(config!.dummyStatus).toBe(StatusType.Paralyzed);
    expect(config!.dummyStatStages).toEqual({ [StatName.Speed]: -2 });
  });

  it("falls back to defaults for invalid pokemon", () => {
    const config = parseSandboxQueryParams("?sandbox&pokemon=mewtwo&dummy=arceus");
    expect(config!.pokemon).toBe("pikachu");
    expect(config!.dummyPokemon).toBe("machop");
  });

  it("filters out invalid moves", () => {
    const config = parseSandboxQueryParams("?sandbox&pokemon=bulbasaur&moves=razor-leaf,hyper-beam,fake-move");
    expect(config!.moves).toEqual(["razor-leaf"]);
  });

  it("uses pokemon default moves when no moves param provided", () => {
    const config = parseSandboxQueryParams("?sandbox&pokemon=bulbasaur");
    expect(config!.moves).toEqual(["razor-leaf", "sleep-powder", "leech-seed", "sludge-bomb"]);
  });

  it("clamps HP between 1 and 100", () => {
    const config = parseSandboxQueryParams("?sandbox&hp=0&dummyHp=150");
    expect(config!.hp).toBe(1);
    expect(config!.dummyHp).toBe(100);
  });

  it("clamps stat stages between -6 and +6", () => {
    const config = parseSandboxQueryParams("?sandbox&statStages=attack:10,defense:-8");
    expect(config!.statStages).toEqual({ [StatName.Attack]: 6, [StatName.Defense]: -6 });
  });

  it("ignores invalid stat names", () => {
    const config = parseSandboxQueryParams("?sandbox&statStages=charisma:5");
    expect(config!.statStages).toEqual({});
  });

  it("ignores invalid dummyMove", () => {
    const config = parseSandboxQueryParams("?sandbox&dummyMove=fake-move");
    expect(config!.dummyMove).toBeNull();
  });

  it("ignores invalid dummyDirection", () => {
    const config = parseSandboxQueryParams("?sandbox&dummyDirection=northeast");
    expect(config!.dummyDirection).toBe(Direction.West);
  });
});
