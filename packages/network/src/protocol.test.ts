import { describe, expect, it } from "vitest";
import {
  deriveAiSeedsBySeat,
  isCompatibleVersion,
  isNetworkMessage,
  NETWORK_VERSION,
  type NetworkMessageType,
} from "./protocol.js";

function countingRandom(): () => number {
  let calls = 0;
  return () => {
    calls += 1;
    return calls;
  };
}

describe("isCompatibleVersion", () => {
  it("accepte la version identique", () => {
    expect(isCompatibleVersion(NETWORK_VERSION)).toBe(true);
  });

  it("refuse toute autre version, dans les deux sens", () => {
    expect(isCompatibleVersion(NETWORK_VERSION + 1)).toBe(false);
    expect(isCompatibleVersion(NETWORK_VERSION - 1)).toBe(false);
  });
});

const OPTIONS = { mapId: "plains", teamCount: 2, autoPlacement: true, damagePreview: false };
const SEEDS = { battle: 1, placement: 2, ai: 3 };
const SELECTION = { pokemonDefinitionIds: ["venusaur"] };

const VALID_MESSAGES: Record<NetworkMessageType, object> = {
  hello: { type: "hello", networkVersion: NETWORK_VERSION, seat: 2 },
  welcome: { type: "welcome", networkVersion: NETWORK_VERSION, occupiedSeats: [1, 2] },
  room_state: {
    type: "room_state",
    options: OPTIONS,
    seats: [{ seat: 1, occupancy: "human", ready: false }],
    locked: false,
  },
  team_select: { type: "team_select", seat: 2, selection: SELECTION },
  ready: { type: "ready", seat: 2, ready: true },
  start: {
    type: "start",
    options: OPTIONS,
    seeds: SEEDS,
    seats: [{ seat: 1, controller: "human", selection: SELECTION }],
  },
  start_ack: { type: "start_ack", seat: 2 },
  bye: { type: "bye", seat: 2 },
  action: {
    type: "action",
    seat: 2,
    actionIndex: 0,
    action: { kind: "end_turn", pokemonId: "p1-venusaur", direction: "north" },
  },
  forfeit: { type: "forfeit", seat: 2, forfeitedSeat: 1, reason: "diverged" },
  resync_request: { type: "resync_request", seat: 2, actionIndex: 4 },
  resync: {
    type: "resync",
    seat: 1,
    fromIndex: 4,
    actions: [{ kind: "end_turn", pokemonId: "p1-venusaur", direction: "north" }],
  },
};

describe("isNetworkMessage", () => {
  it("reconnaît chaque type du protocole, bien formé", () => {
    for (const [type, message] of Object.entries(VALID_MESSAGES)) {
      expect(isNetworkMessage(message), type).toBe(true);
    }
  });

  it("refuse ce qui n'est pas un objet — un pair peut envoyer n'importe quoi", () => {
    expect(isNetworkMessage(null)).toBe(false);
    expect(isNetworkMessage(undefined)).toBe(false);
    expect(isNetworkMessage("hello")).toBe(false);
    expect(isNetworkMessage(42)).toBe(false);
    expect(isNetworkMessage([])).toBe(false);
  });

  it("refuse un type inconnu ou absent", () => {
    expect(isNetworkMessage({})).toBe(false);
    expect(isNetworkMessage({ type: "attaque" })).toBe(false);
    expect(isNetworkMessage({ type: 7 })).toBe(false);
  });

  it("refuse un message réduit à son enveloppe", () => {
    for (const type of Object.keys(VALID_MESSAGES)) {
      expect(isNetworkMessage({ type }), type).toBe(false);
    }
  });

  it("refuse un message auquel il manque n'importe quel champ", () => {
    for (const [type, message] of Object.entries(VALID_MESSAGES)) {
      for (const field of Object.keys(message).filter((key) => key !== "type")) {
        const truncated = { ...message };
        delete (truncated as Record<string, unknown>)[field];
        expect(isNetworkMessage(truncated), `${type} sans ${field}`).toBe(false);
      }
    }
  });

  it("refuse un contenu du bon nom mais du mauvais type", () => {
    expect(isNetworkMessage({ ...VALID_MESSAGES.ready, ready: "oui" })).toBe(false);
    expect(isNetworkMessage({ ...VALID_MESSAGES.hello, seat: "2" })).toBe(false);
    expect(isNetworkMessage({ ...VALID_MESSAGES.welcome, occupiedSeats: 1 })).toBe(false);
    expect(isNetworkMessage({ ...VALID_MESSAGES.room_state, seats: {} })).toBe(false);
    expect(isNetworkMessage({ ...VALID_MESSAGES.forfeit, reason: "parce que" })).toBe(false);
    expect(isNetworkMessage({ ...VALID_MESSAGES.forfeit, forfeitedSeat: 0 })).toBe(false);
  });

  it("refuse une place qui n'est pas un entier positif — 1 est l'hôte, il n'y a pas de place 0", () => {
    for (const seat of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isNetworkMessage({ ...VALID_MESSAGES.ready, seat }), String(seat)).toBe(false);
    }
  });

  it("refuse une occupation ou un contrôleur hors énumération", () => {
    expect(
      isNetworkMessage({
        ...VALID_MESSAGES.room_state,
        seats: [{ seat: 1, occupancy: "spectateur", ready: false }],
      }),
    ).toBe(false);
    expect(
      isNetworkMessage({
        ...VALID_MESSAGES.start,
        seats: [{ seat: 1, controller: "remote", selection: SELECTION }],
      }),
    ).toBe(false);
  });

  it("refuse des places non contiguës dans un lancement", () => {
    const seats = [
      { seat: 1, controller: "human", selection: SELECTION },
      { seat: 3, controller: "ai", selection: SELECTION },
    ];
    expect(isNetworkMessage({ ...VALID_MESSAGES.start, seats })).toBe(false);
  });

  it("refuse des places en désordre dans un lancement", () => {
    const seats = [
      { seat: 2, controller: "human", selection: SELECTION },
      { seat: 1, controller: "ai", selection: SELECTION },
    ];
    expect(isNetworkMessage({ ...VALID_MESSAGES.start, seats })).toBe(false);
  });

  it("accepte un lancement à plusieurs places, croissantes et sans trou", () => {
    const seats = [
      { seat: 1, controller: "human", selection: SELECTION },
      { seat: 2, controller: "ai", selection: SELECTION },
      { seat: 3, controller: "ai", selection: SELECTION },
    ];
    expect(isNetworkMessage({ ...VALID_MESSAGES.start, seats })).toBe(true);
  });

  it("refuse une graine manquante — trois graines, ou aucune partie", () => {
    for (const seed of ["battle", "placement", "ai"]) {
      const seeds = { ...SEEDS };
      delete (seeds as Record<string, unknown>)[seed];
      expect(isNetworkMessage({ ...VALID_MESSAGES.start, seeds }), seed).toBe(false);
    }
  });

  it("accepte les emplacements complets d'une équipe venue du constructeur", () => {
    const slots = [
      {
        pokemonId: "venusaur",
        ability: "overgrow",
        nature: "adamant",
        moveIds: ["giga-drain"],
        statSpread: { attack: 100 },
        heldItemId: "leftovers",
        gender: "female",
      },
    ];
    expect(
      isNetworkMessage({
        ...VALID_MESSAGES.team_select,
        selection: { ...SELECTION, slots },
      }),
    ).toBe(true);
  });

  it("refuse un emplacement d'équipe difforme", () => {
    const badSlots = [
      { pokemonId: "venusaur", ability: "overgrow", nature: "adamant", moveIds: "giga-drain" },
      { pokemonId: "venusaur", ability: "overgrow", nature: "adamant", moveIds: [], statSpread: 3 },
      { pokemonId: 7, ability: "overgrow", nature: "adamant", moveIds: [], statSpread: {} },
    ];
    for (const [index, slot] of badSlots.entries()) {
      expect(
        isNetworkMessage({
          ...VALID_MESSAGES.team_select,
          selection: { ...SELECTION, slots: [slot] },
        }),
        String(index),
      ).toBe(false);
    }
  });
});

describe("isNetworkMessage — le message d'action", () => {
  const withAction = (action: unknown): unknown => ({
    type: "action",
    seat: 2,
    actionIndex: 3,
    action,
  });

  it("accepte les quatre genres d'action", () => {
    expect(
      isNetworkMessage(
        withAction({
          kind: "move",
          pokemonId: "p1-venusaur",
          path: [{ x: 1, y: 2 }],
        }),
      ),
    ).toBe(true);
    expect(
      isNetworkMessage(
        withAction({
          kind: "use_move",
          pokemonId: "p1-venusaur",
          moveId: "giga-drain",
          targetPosition: { x: 3, y: 4 },
        }),
      ),
    ).toBe(true);
    expect(
      isNetworkMessage(
        withAction({ kind: "end_turn", pokemonId: "p1-venusaur", direction: "west" }),
      ),
    ).toBe(true);
    expect(isNetworkMessage(withAction({ kind: "undo_move", pokemonId: "p1-venusaur" }))).toBe(
      true,
    );
  });

  it("accepte une attaque à retraite, avec ou sans case de retraite", () => {
    const hitAndRun = {
      kind: "use_move",
      pokemonId: "p1-crobat",
      moveId: "u-turn",
      targetPosition: { x: 3, y: 4 },
    };
    expect(isNetworkMessage(withAction(hitAndRun))).toBe(true);
    expect(isNetworkMessage(withAction({ ...hitAndRun, retreatPosition: { x: 5, y: 6 } }))).toBe(
      true,
    );
    expect(isNetworkMessage(withAction({ ...hitAndRun, retreatPosition: { x: 5 } }))).toBe(false);
  });

  it("refuse un genre d'action inconnu", () => {
    expect(isNetworkMessage(withAction({ kind: "forfeit", pokemonId: "p1-venusaur" }))).toBe(false);
    expect(isNetworkMessage(withAction({ pokemonId: "p1-venusaur" }))).toBe(false);
  });

  it("refuse une action dont le contenu propre à son genre manque", () => {
    expect(isNetworkMessage(withAction({ kind: "move", pokemonId: "p1-venusaur" }))).toBe(false);
    expect(
      isNetworkMessage(
        withAction({ kind: "use_move", pokemonId: "p1-venusaur", moveId: "tackle" }),
      ),
    ).toBe(false);
    expect(isNetworkMessage(withAction({ kind: "end_turn", pokemonId: "p1-venusaur" }))).toBe(
      false,
    );
    expect(
      isNetworkMessage(
        withAction({ kind: "end_turn", pokemonId: "p1-venusaur", direction: "nord-est" }),
      ),
    ).toBe(false);
  });

  it("refuse un chemin qui n'est pas une suite de positions", () => {
    for (const path of [[], "1,2", [{ x: 1 }], [{ x: 1, y: "2" }], [[1, 2]]]) {
      expect(
        isNetworkMessage(withAction({ kind: "move", pokemonId: "p1-venusaur", path })),
        JSON.stringify(path),
      ).toBe(false);
    }
  });

  it("refuse une position non entière — le plateau est une grille", () => {
    expect(
      isNetworkMessage(
        withAction({ kind: "move", pokemonId: "p1-venusaur", path: [{ x: 1.5, y: 2 }] }),
      ),
    ).toBe(false);
  });

  it("exige un index d'action entier et non négatif", () => {
    for (const actionIndex of [-1, 1.5, "3", null, Number.NaN]) {
      expect(
        isNetworkMessage({ ...(VALID_MESSAGES.action as object), actionIndex }),
        String(actionIndex),
      ).toBe(false);
    }
    expect(isNetworkMessage({ ...(VALID_MESSAGES.action as object), actionIndex: 0 })).toBe(true);
  });
});

describe("deriveAiSeedsBySeat", () => {
  it("consomme le générateur dans l'ordre croissant des places", () => {
    const seeds = deriveAiSeedsBySeat([1, 2, 3], countingRandom());
    expect(seeds.get(1)).toBe(1);
    expect(seeds.get(2)).toBe(2);
    expect(seeds.get(3)).toBe(3);
  });

  it("donne le même résultat quel que soit l'ordre d'énumération de l'appelant", () => {
    const fromAscending = deriveAiSeedsBySeat([1, 2, 3], countingRandom());
    const fromShuffled = deriveAiSeedsBySeat([3, 1, 2], countingRandom());
    expect([...fromShuffled.entries()].sort()).toEqual([...fromAscending.entries()].sort());
  });

  it("dérive toutes les places, humaines comprises — sinon la table dépendrait du nombre d'IA", () => {
    const seeds = deriveAiSeedsBySeat([1, 2, 3, 4], countingRandom());
    expect(seeds.size).toBe(4);
  });

  it("rend une table vide pour un salon sans place", () => {
    expect(deriveAiSeedsBySeat([], countingRandom()).size).toBe(0);
  });
});

describe("isNetworkMessage — rattrapage (plan 202)", () => {
  it("accepte un rattrapage vide — le revenant n'a peut-être rien manqué", () => {
    expect(isNetworkMessage({ type: "resync", seat: 1, fromIndex: 0, actions: [] })).toBe(true);
  });

  it("refuse un index de rattrapage négatif ou fractionnaire", () => {
    expect(isNetworkMessage({ type: "resync_request", seat: 2, actionIndex: -1 })).toBe(false);
    expect(isNetworkMessage({ type: "resync_request", seat: 2, actionIndex: 1.5 })).toBe(false);
  });

  it("refuse un rattrapage dont une action est mal formée", () => {
    expect(
      isNetworkMessage({
        type: "resync",
        seat: 1,
        fromIndex: 0,
        actions: [{ kind: "danse_de_la_pluie" }],
      }),
    ).toBe(false);
  });

  it("refuse un rattrapage sans liste d'actions", () => {
    expect(isNetworkMessage({ type: "resync", seat: 1, fromIndex: 0 })).toBe(false);
  });

  it("refuse un dépassement déclaré autrement que par `true`", () => {
    const base = {
      type: "action",
      seat: 2,
      actionIndex: 0,
      action: { kind: "end_turn", pokemonId: "p1-venusaur", direction: "north" },
    };
    expect(isNetworkMessage({ ...base, timedOut: true })).toBe(true);
    expect(isNetworkMessage({ ...base, timedOut: false })).toBe(false);
    expect(isNetworkMessage({ ...base, timedOut: "oui" })).toBe(false);
  });
});
