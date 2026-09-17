import { describe, expect, it } from "vitest";
import { AiDifficulty } from "../enums/ai-difficulty";
import {
  DEFAULT_AI_DIFFICULTY,
  EASY_PROFILE,
  HARD_PROFILE,
  MEDIUM_PROFILE,
  profileForDifficulty,
  resolveAiDifficulty,
} from "./ai-profiles";

describe("profileForDifficulty", () => {
  it("rend le profil de chacun des trois niveaux", () => {
    expect(profileForDifficulty(AiDifficulty.Easy)).toBe(EASY_PROFILE);
    expect(profileForDifficulty(AiDifficulty.Medium)).toBe(MEDIUM_PROFILE);
    expect(profileForDifficulty(AiDifficulty.Hard)).toBe(HARD_PROFILE);
  });

  it("rend un profil dont la difficulté est celle demandée", () => {
    for (const difficulty of Object.values(AiDifficulty)) {
      expect(profileForDifficulty(difficulty).difficulty).toBe(difficulty);
    }
  });
});

describe("DEFAULT_AI_DIFFICULTY", () => {
  /*
   * Test d'une ligne, et c'est la valeur dont tout le plan 214 dépend : le niveau que prend une place
   * IA que personne n'a réglée, en solo comme en ligne. Une main distraite qui la changerait sans
   * voir les conséquences casserait la partie en ligne (les deux pairs ne monteraient plus la même
   * IA) avant de casser quoi que ce soit de visible en solo.
   */
  it("vaut Moyenne", () => {
    expect(DEFAULT_AI_DIFFICULTY).toBe(AiDifficulty.Medium);
  });
});

describe("resolveAiDifficulty", () => {
  it("garde le niveau quand il est donné", () => {
    expect(resolveAiDifficulty(AiDifficulty.Easy)).toBe(AiDifficulty.Easy);
    expect(resolveAiDifficulty(AiDifficulty.Hard)).toBe(AiDifficulty.Hard);
  });

  /*
   * 🔴 LE point de normalisation du plan 214. Une sauvegarde d'avant le plan, une place « libre »
   * que personne n'a réglée, une config sandbox ancienne : tous arrivent ici sans niveau, et tous
   * doivent en ressortir avec LE MÊME. Un repli écrit ailleurs qu'ici est une divergence qui attend
   * son heure — en ligne, deux pairs qui répliquent différemment montent deux IA différentes sans
   * erreur et sans trace.
   */
  it("retombe sur le défaut quand il manque, et jamais sur autre chose", () => {
    expect(resolveAiDifficulty(undefined)).toBe(DEFAULT_AI_DIFFICULTY);
    expect(profileForDifficulty(resolveAiDifficulty(undefined))).toBe(MEDIUM_PROFILE);
  });
});

describe("les trois profils restent distincts", () => {
  /*
   * Le plan 214 expose ces trois niveaux au joueur comme trois choix. S'ils devenaient identiques
   * deux à deux — par une retouche de poids faite ailleurs —, l'interface mentirait sans que rien
   * n'échoue. Ce test n'ARBITRE pas les valeurs (hors périmètre, décision #1074) : il vérifie
   * seulement qu'un écart subsiste.
   */
  it("aucun profil n'en double un autre", () => {
    const profiles = [EASY_PROFILE, MEDIUM_PROFILE, HARD_PROFILE];
    const encoded = profiles.map((profile) => JSON.stringify(profile));
    expect(new Set(encoded).size).toBe(profiles.length);
  });

  it("le bruit de sélection décroît strictement d'Facile à Difficile", () => {
    expect(EASY_PROFILE.randomWeight).toBeGreaterThan(MEDIUM_PROFILE.randomWeight);
    expect(MEDIUM_PROFILE.randomWeight).toBeGreaterThan(HARD_PROFILE.randomWeight);
    expect(HARD_PROFILE.randomWeight).toBe(0);
  });
});
