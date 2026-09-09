import { describe, expect, it } from "vitest";
import {
  BATTLE_GRACE_AFTER_SILENCE_MS,
  BATTLE_GRACE_SHORT_MS,
  GRACE_AFTER_CLEAN_CLOSE_MS,
  GRACE_AFTER_SILENCE_MS,
  graceDelayFor,
} from "./room-config.js";

describe("graceDelayFor", () => {
  describe("en salon", () => {
    it("accorde le délai court après une fermeture propre", () => {
      expect(graceDelayFor({ locked: false, cleanClose: true, absentOnce: false })).toBe(
        GRACE_AFTER_CLEAN_CLOSE_MS,
      );
    });

    it("accorde le délai long après un silence", () => {
      expect(graceDelayFor({ locked: false, cleanClose: false, absentOnce: false })).toBe(
        GRACE_AFTER_SILENCE_MS,
      );
    });

    it("ignore une absence déjà constatée, dont le palier n'existe qu'en combat", () => {
      expect(graceDelayFor({ locked: false, cleanClose: false, absentOnce: true })).toBe(
        GRACE_AFTER_SILENCE_MS,
      );
    });
  });

  describe("en combat", () => {
    it("accorde chrono + marge après un silence", () => {
      expect(graceDelayFor({ locked: true, cleanClose: false, absentOnce: false })).toBe(
        BATTLE_GRACE_AFTER_SILENCE_MS,
      );
    });

    it("raccourcit après une fermeture d'onglet", () => {
      expect(graceDelayFor({ locked: true, cleanClose: true, absentOnce: false })).toBe(
        BATTLE_GRACE_SHORT_MS,
      );
    });

    it("raccourcit à la deuxième chute de la même place", () => {
      expect(graceDelayFor({ locked: true, cleanClose: false, absentOnce: true })).toBe(
        BATTLE_GRACE_SHORT_MS,
      );
    });
  });

  it("accorde plus de temps à une fermeture propre en combat qu'en salon", () => {
    expect(graceDelayFor({ locked: true, cleanClose: true, absentOnce: false })).toBeGreaterThan(
      graceDelayFor({ locked: false, cleanClose: true, absentOnce: false }),
    );
  });

  it("garde le délai court du combat en dessous de son délai long", () => {
    expect(BATTLE_GRACE_SHORT_MS).toBeLessThan(BATTLE_GRACE_AFTER_SILENCE_MS);
  });
});
