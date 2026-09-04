import { describe, expect, it } from "vitest";
import {
  generateRoomCode,
  HOST_SEAT,
  hostPeerId,
  isValidRoomCode,
  normalizeRoomCode,
  PEER_ID_PREFIX,
  peerIdForSeat,
  peerIdsForRoom,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  seatFromPeerId,
} from "./room-code.js";

function bytesFrom(values: readonly number[]): (length: number) => Uint8Array {
  let cursor = 0;
  return (length) => {
    const slice = values.slice(cursor, cursor + length);
    cursor += length;
    return new Uint8Array(slice);
  };
}

describe("ROOM_CODE_ALPHABET", () => {
  it("exclut les quatre caractères ambigus à l'œil", () => {
    for (const ambiguous of ["I", "O", "0", "1"]) {
      expect(ROOM_CODE_ALPHABET).not.toContain(ambiguous);
    }
  });

  it("compte 32 caractères, tous distincts", () => {
    expect(ROOM_CODE_ALPHABET).toHaveLength(32);
    expect(new Set(ROOM_CODE_ALPHABET).size).toBe(32);
  });

  it("divise 256, ce qui est l'hypothèse du tirage sans biais", () => {
    expect(256 % ROOM_CODE_ALPHABET.length).toBe(0);
  });
});

describe("generateRoomCode", () => {
  it("tire un code de la longueur attendue, dans l'alphabet", () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    expect(isValidRoomCode(code)).toBe(true);
  });

  it("mappe les octets sur l'alphabet par le reste", () => {
    const code = generateRoomCode(bytesFrom([0, 1, 31, 32, 2]));
    expect(code).toBe(
      `${ROOM_CODE_ALPHABET[0]}${ROOM_CODE_ALPHABET[1]}${ROOM_CODE_ALPHABET[31]}${ROOM_CODE_ALPHABET[0]}${ROOM_CODE_ALPHABET[2]}`,
    );
  });

  it("redemande des octets tant que le code n'est pas complet", () => {
    const randomBytes = bytesFrom([0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
    const code = generateRoomCode((length) => randomBytes(length).slice(0, 3));
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
  });
});

describe("normalizeRoomCode", () => {
  it("relève la casse et retire les espaces d'une saisie humaine", () => {
    expect(normalizeRoomCode(" a7k 2m ")).toBe("A7K2M");
  });
});

describe("isValidRoomCode", () => {
  it("accepte un code bien formé, quelle que soit la casse saisie", () => {
    expect(isValidRoomCode("a7k2m")).toBe(true);
  });

  it("refuse une longueur autre que celle attendue", () => {
    expect(isValidRoomCode("A7K2")).toBe(false);
    expect(isValidRoomCode("A7K2MB")).toBe(false);
  });

  it("refuse un caractère ambigu — il n'a aucune cible sur laquelle le rabattre", () => {
    expect(isValidRoomCode("A7K2O")).toBe(false);
    expect(isValidRoomCode("A7K2I")).toBe(false);
    expect(isValidRoomCode("A7K20")).toBe(false);
    expect(isValidRoomCode("A7K21")).toBe(false);
  });

  it("refuse un caractère hors alphabet", () => {
    expect(isValidRoomCode("A7K2-")).toBe(false);
  });
});

describe("peerIdForSeat", () => {
  it("préfixe l'espace de noms — l'annuaire public est mondial et partagé", () => {
    expect(peerIdForSeat("A7K2M", 2)).toBe(`${PEER_ID_PREFIX}-A7K2M-2`);
  });

  it("normalise le code, pour qu'une saisie en minuscules joigne la même adresse", () => {
    expect(peerIdForSeat("a7k2m", 2)).toBe(peerIdForSeat("A7K2M", 2));
  });

  it("fait de la place 1 l'hôte", () => {
    expect(hostPeerId("A7K2M")).toBe(peerIdForSeat("A7K2M", HOST_SEAT));
    expect(HOST_SEAT).toBe(1);
  });
});

describe("peerIdsForRoom", () => {
  it("énumère les places du format dans l'ordre croissant", () => {
    expect(peerIdsForRoom("A7K2M", 3)).toEqual([
      `${PEER_ID_PREFIX}-A7K2M-1`,
      `${PEER_ID_PREFIX}-A7K2M-2`,
      `${PEER_ID_PREFIX}-A7K2M-3`,
    ]);
  });
});

describe("seatFromPeerId", () => {
  it("relit la place d'une adresse du salon", () => {
    expect(seatFromPeerId(`${PEER_ID_PREFIX}-A7K2M-4`, "A7K2M")).toBe(4);
  });

  it("relit une place à deux chiffres — le format à 12 en a", () => {
    expect(seatFromPeerId(`${PEER_ID_PREFIX}-A7K2M-12`, "A7K2M")).toBe(12);
  });

  it("ignore une adresse d'un autre salon", () => {
    expect(seatFromPeerId(`${PEER_ID_PREFIX}-B8L3N-2`, "A7K2M")).toBeUndefined();
  });

  it("ignore une adresse d'une autre application", () => {
    expect(seatFromPeerId("autrejeu-A7K2M-2", "A7K2M")).toBeUndefined();
  });

  it("ignore une place illisible plutôt que d'en faire une erreur d'interface", () => {
    expect(seatFromPeerId(`${PEER_ID_PREFIX}-A7K2M-`, "A7K2M")).toBeUndefined();
    expect(seatFromPeerId(`${PEER_ID_PREFIX}-A7K2M-abc`, "A7K2M")).toBeUndefined();
    expect(seatFromPeerId(`${PEER_ID_PREFIX}-A7K2M-0`, "A7K2M")).toBeUndefined();
    expect(seatFromPeerId(`${PEER_ID_PREFIX}-A7K2M-2x`, "A7K2M")).toBeUndefined();
  });
});
