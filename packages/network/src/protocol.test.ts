import { describe, expect, it } from "vitest";
import {
  deriveAiSeedsBySeat,
  isCompatibleVersion,
  isNetworkMessage,
  NETWORK_VERSION,
  NetworkErrorCode,
  type NetworkMessage,
} from "./protocol.js";

function countingRandom(): () => number {
  let calls = 0;
  return () => {
    calls += 1;
    return calls;
  };
}

describe("NETWORK_VERSION", () => {
  it("est un entier — deux versions doivent se comparer strictement", () => {
    expect(Number.isInteger(NETWORK_VERSION)).toBe(true);
  });
});

describe("isCompatibleVersion", () => {
  it("accepte la version identique", () => {
    expect(isCompatibleVersion(NETWORK_VERSION)).toBe(true);
  });

  it("refuse toute autre version, dans les deux sens", () => {
    expect(isCompatibleVersion(NETWORK_VERSION + 1)).toBe(false);
    expect(isCompatibleVersion(NETWORK_VERSION - 1)).toBe(false);
  });
});

describe("NetworkErrorCode", () => {
  it("reste une énumération fermée — ce sont les valeurs envoyées en télémétrie", () => {
    expect(Object.values(NetworkErrorCode)).toEqual([
      "code_introuvable",
      "salon_plein",
      "partie_commencee",
      "version_incompatible",
      "connexion_impossible",
      "delai_depasse",
    ]);
  });
});

describe("isNetworkMessage", () => {
  it("reconnaît chaque type du protocole", () => {
    const types: readonly NetworkMessage["type"][] = [
      "hello",
      "welcome",
      "room_state",
      "team_select",
      "ready",
      "start",
      "start_ack",
      "bye",
    ];
    for (const type of types) {
      expect(isNetworkMessage({ type })).toBe(true);
    }
  });

  it("refuse ce qui n'est pas un objet — un pair peut envoyer n'importe quoi", () => {
    expect(isNetworkMessage(null)).toBe(false);
    expect(isNetworkMessage(undefined)).toBe(false);
    expect(isNetworkMessage("hello")).toBe(false);
    expect(isNetworkMessage(42)).toBe(false);
  });

  it("refuse un type inconnu ou absent", () => {
    expect(isNetworkMessage({})).toBe(false);
    expect(isNetworkMessage({ type: "attaque" })).toBe(false);
    expect(isNetworkMessage({ type: 7 })).toBe(false);
  });

  it("ne refuse pas un message dont le contenu est absent — la forme seule est son affaire", () => {
    expect(isNetworkMessage({ type: "start" })).toBe(true);
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
