import { describe, expect, it } from "vitest";
import { formatBattleDuration } from "./battle-chrome.js";
import type { UiDomConfig } from "./config.js";

/**
 * Rend la clé et ses paramètres en clair, pour que les assertions portent sur ce que le formateur
 * DÉCIDE (quelle clé, quels nombres) et pas sur la formulation d'une locale.
 *
 * Typé `Pick<…, "translate">` plutôt qu'une assertion sur `UiDomConfig` entier : c'est la seule
 * dépendance réelle de la fonction, et le dire supprime le besoin de mentir au compilateur.
 */
const config: Pick<UiDomConfig, "translate"> = {
  translate: (key: string, params?: Record<string, string | number>) =>
    params === undefined ? key : `${key}(${Object.values(params).join(",")})`,
};

describe("formatBattleDuration — durée du récapitulatif de victoire (plan 197)", () => {
  it("passe par la clé « secondes seules » sous la minute", () => {
    expect(formatBattleDuration(45_000, config)).toBe("battle.summaryDurationSeconds(45)");
  });

  it("complète les secondes à deux chiffres au-delà de la minute", () => {
    expect(formatBattleDuration(185_000, config)).toBe("battle.summaryDurationMinutes(3,05)");
  });

  it("rend minutes et secondes séparément", () => {
    expect(formatBattleDuration(200_000, config)).toBe("battle.summaryDurationMinutes(3,20)");
  });

  it("arrondit à la seconde la plus proche", () => {
    expect(formatBattleDuration(59_600, config)).toBe("battle.summaryDurationMinutes(1,00)");
  });

  it("rend zéro seconde plutôt qu'un chiffre négatif", () => {
    expect(formatBattleDuration(-5_000, config)).toBe("battle.summaryDurationSeconds(0)");
  });

  it("bascule sur les heures au-delà de soixante minutes", () => {
    expect(formatBattleDuration(4_020_000, config)).toBe("battle.summaryDurationHours(1,07)");
  });

  it("reste en minutes juste sous l'heure", () => {
    expect(formatBattleDuration(3_540_000, config)).toBe("battle.summaryDurationMinutes(59,00)");
  });
});
