import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@pokemon-tactic/network";
import { describe, expect, it } from "vitest";
import {
  type CodeWheelState,
  codeOf,
  eraseBeforeActiveSlot,
  initialCodeWheelState,
  moveActiveSlot,
  pasteCode,
  setActiveSlot,
  slotNeighbours,
  stepActiveSlot,
  typeCharacter,
} from "./code-wheel-model";

const LAST_CHARACTER = ROOM_CODE_ALPHABET[ROOM_CODE_ALPHABET.length - 1] ?? "9";

function stateFrom(code: string, activeSlot = 0): CodeWheelState {
  return { characters: [...code], activeSlot };
}

describe("initialCodeWheelState", () => {
  it("remplit chaque emplacement du premier caractère de l'alphabet", () => {
    const state = initialCodeWheelState();

    expect(state.characters).toHaveLength(ROOM_CODE_LENGTH);
    expect(codeOf(state)).toBe(ROOM_CODE_ALPHABET[0]?.repeat(ROOM_CODE_LENGTH));
    expect(state.activeSlot).toBe(0);
  });
});

describe("stepActiveSlot", () => {
  it("avance d'un caractère dans l'alphabet", () => {
    expect(codeOf(stepActiveSlot(stateFrom("AAAAA"), 1))).toBe("BAAAA");
  });

  it("recule d'un caractère dans l'alphabet", () => {
    expect(codeOf(stepActiveSlot(stateFrom("BAAAA"), -1))).toBe("AAAAA");
  });

  it("saute les caractères ambigus, qui ne sont pas de l'alphabet", () => {
    expect(codeOf(stepActiveSlot(stateFrom("HAAAA"), 1))).toBe("JAAAA");
    expect(codeOf(stepActiveSlot(stateFrom("NAAAA"), 1))).toBe("PAAAA");
  });

  it("boucle du dernier caractère au premier", () => {
    expect(codeOf(stepActiveSlot(stateFrom(`${LAST_CHARACTER}AAAA`), 1))).toBe("AAAAA");
  });

  it("boucle du premier caractère au dernier", () => {
    expect(codeOf(stepActiveSlot(stateFrom("AAAAA"), -1))).toBe(`${LAST_CHARACTER}AAAA`);
  });

  it("n'agit que sur l'emplacement actif", () => {
    expect(codeOf(stepActiveSlot(stateFrom("AAAAA", 2), 1))).toBe("AABAA");
  });
});

describe("moveActiveSlot", () => {
  it("change d'emplacement", () => {
    expect(moveActiveSlot(stateFrom("AAAAA", 1), 1).activeSlot).toBe(2);
    expect(moveActiveSlot(stateFrom("AAAAA", 1), -1).activeSlot).toBe(0);
  });

  it("s'arrête aux extrémités plutôt que de boucler", () => {
    expect(moveActiveSlot(stateFrom("AAAAA", 0), -1).activeSlot).toBe(0);
    expect(moveActiveSlot(stateFrom("AAAAA", ROOM_CODE_LENGTH - 1), 1).activeSlot).toBe(
      ROOM_CODE_LENGTH - 1,
    );
  });

  it("ne touche pas aux caractères", () => {
    expect(codeOf(moveActiveSlot(stateFrom("A7K2M", 1), 1))).toBe("A7K2M");
  });
});

describe("setActiveSlot", () => {
  it("borne un emplacement hors plage", () => {
    expect(setActiveSlot(stateFrom("AAAAA"), -3).activeSlot).toBe(0);
    expect(setActiveSlot(stateFrom("AAAAA"), 99).activeSlot).toBe(ROOM_CODE_LENGTH - 1);
  });
});

describe("typeCharacter", () => {
  it("pose le caractère et avance d'un emplacement", () => {
    const state = typeCharacter(stateFrom("AAAAA"), "K");

    expect(state && codeOf(state)).toBe("KAAAA");
    expect(state?.activeSlot).toBe(1);
  });

  it("relève la casse", () => {
    const state = typeCharacter(stateFrom("AAAAA"), "k");

    expect(state && codeOf(state)).toBe("KAAAA");
  });

  it("accepte un chiffre de l'alphabet", () => {
    const state = typeCharacter(stateFrom("AAAAA"), "7");

    expect(state && codeOf(state)).toBe("7AAAA");
  });

  it("saisit un code entier d'une traite", () => {
    let state = initialCodeWheelState();
    for (const character of "A7K2M") {
      state = typeCharacter(state, character) ?? state;
    }

    expect(codeOf(state)).toBe("A7K2M");
  });

  it("n'avance pas au-delà du dernier emplacement", () => {
    const state = typeCharacter(stateFrom("AAAAA", ROOM_CODE_LENGTH - 1), "M");

    expect(state && codeOf(state)).toBe("AAAAM");
    expect(state?.activeSlot).toBe(ROOM_CODE_LENGTH - 1);
  });

  it("ne consomme pas un caractère ambigu", () => {
    for (const ambiguous of ["I", "O", "0", "1"]) {
      expect(typeCharacter(stateFrom("AAAAA"), ambiguous)).toBeUndefined();
    }
  });

  it("ne consomme ni une touche nommée ni un caractère hors alphabet", () => {
    expect(typeCharacter(stateFrom("AAAAA"), "Enter")).toBeUndefined();
    expect(typeCharacter(stateFrom("AAAAA"), "-")).toBeUndefined();
    expect(typeCharacter(stateFrom("AAAAA"), "")).toBeUndefined();
  });
});

describe("pasteCode", () => {
  it("pose un code collé depuis le premier emplacement", () => {
    const state = pasteCode("A7K2M");

    expect(state && codeOf(state)).toBe("A7K2M");
    expect(state?.activeSlot).toBe(ROOM_CODE_LENGTH - 1);
  });

  it("relève la casse", () => {
    expect(pasteCode("a7k2m")).toMatchObject({
      characters: [..."A7K2M"],
    });
  });

  it("tolère les espaces, tirets et guillemets d'un presse-papier réel", () => {
    for (const pasted of [" A7K2M ", "A7-K2M", "A7 K2 M", '"A7K2M"', "\nA7K2M\n"]) {
      const state = pasteCode(pasted);
      expect(state && codeOf(state)).toBe("A7K2M");
    }
  });

  it("accepte une adresse de pair collée à la place du code", () => {
    const state = pasteCode("pkmntac-A7K2M-1");

    expect(state && codeOf(state)).toBe("A7K2M");
  });

  it("ne consomme rien quand il ne reste pas exactement la longueur d'un code", () => {
    expect(pasteCode("A7K2")).toBeUndefined();
    expect(pasteCode("A7K2MB")).toBeUndefined();
    expect(pasteCode("")).toBeUndefined();
    expect(pasteCode("https://exemple.test/page")).toBeUndefined();
  });

  it("ne consomme rien quand le code collé porte un caractère ambigu", () => {
    expect(pasteCode("A7K2O")).toBeUndefined();
    expect(pasteCode("A7K21")).toBeUndefined();
  });
});

describe("eraseBeforeActiveSlot", () => {
  it("efface l'emplacement précédent et y revient", () => {
    const state = eraseBeforeActiveSlot(stateFrom("A7K2M", 2));

    expect(codeOf(state)).toBe("AAK2M");
    expect(state.activeSlot).toBe(1);
  });

  it("efface l'emplacement courant quand il est le premier", () => {
    const state = eraseBeforeActiveSlot(stateFrom("A7K2M", 0));

    expect(codeOf(state)).toBe("A7K2M".replace("A", ROOM_CODE_ALPHABET[0] ?? "A"));
    expect(state.activeSlot).toBe(0);
  });
});

describe("slotNeighbours", () => {
  it("donne les deux voisins d'alphabet d'un emplacement", () => {
    expect(slotNeighbours(stateFrom("A7K2M"), 2)).toEqual({
      previous: "J",
      current: "K",
      next: "L",
    });
  });

  it("boucle sur le premier caractère", () => {
    expect(slotNeighbours(stateFrom("A7K2M"), 0)).toEqual({
      previous: LAST_CHARACTER,
      current: "A",
      next: "B",
    });
  });

  it("boucle sur le dernier caractère", () => {
    expect(slotNeighbours(stateFrom(`${LAST_CHARACTER}7K2M`), 0)).toEqual({
      previous: "8",
      current: LAST_CHARACTER,
      next: "A",
    });
  });
});
