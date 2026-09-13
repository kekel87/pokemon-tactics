import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAP_ID,
  drawRandomMapId,
  isRandomMapId,
  knownMapIdOrDefault,
  RANDOM_MAP_ID,
  resolveMapId,
} from "./map-choice";
import { MAPS_REGISTRY } from "./maps-registry";

/**
 * Le choix de carte est de la **logique de sélection pure** : elle décide sur quel terrain une
 * partie se joue, et elle se trompe en silence. C'est exactement le profil que le backlog du gate
 * e2e reprochait à `scripts/e2e-affected.ts` — trois lignes de décision sans un seul test.
 */
describe("choix de carte", () => {
  it("distingue la sentinelle « Aléatoire » d'un identifiant de carte", () => {
    expect(isRandomMapId(RANDOM_MAP_ID)).toBe(true);
    expect(isRandomMapId("volcano")).toBe(false);
  });

  it("ne tire jamais la sentinelle elle-même : « Aléatoire » n'est pas une carte", () => {
    const ids = MAPS_REGISTRY.map((entry) => entry.id);
    // 200 tirages : assez pour que le tirage d'une sentinelle glissée dans le registre ressorte,
    // pas assez pour ralentir la suite.
    for (let attempt = 0; attempt < 200; attempt += 1) {
      expect(ids).toContain(drawRandomMapId());
    }
  });

  it("finit par tirer plus d'une carte — un tirage figé passerait les autres assertions", () => {
    const drawn = new Set<string>();
    for (let attempt = 0; attempt < 200; attempt += 1) {
      drawn.add(drawRandomMapId());
    }
    expect(drawn.size).toBeGreaterThan(1);
  });

  it("résout la sentinelle en carte, et laisse tout le reste intact", () => {
    expect(resolveMapId("volcano")).toBe("volcano");
    expect(isRandomMapId(resolveMapId(RANDOM_MAP_ID))).toBe(false);
  });

  it("garde un identifiant connu du registre", () => {
    const first = MAPS_REGISTRY[0]?.id ?? "";
    expect(knownMapIdOrDefault(first)).toBe(first);
  });

  it("retombe sur la carte de découverte pour une carte disparue du registre", () => {
    // Le cas réel : une carte retirée du jeu dont l'identifiant dort encore dans le stockage du
    // navigateur. Elle ne doit pas ressusciter, et le repli ne doit pas planter.
    expect(knownMapIdOrDefault("carte-supprimee-en-2027")).toBe(DEFAULT_MAP_ID);
    expect(knownMapIdOrDefault("")).toBe(DEFAULT_MAP_ID);
  });

  it("garde « Aléatoire » tel quel : c'est un CHOIX, pas un identifiant inconnu", () => {
    expect(knownMapIdOrDefault(RANDOM_MAP_ID)).toBe(RANDOM_MAP_ID);
  });

  it("la carte de découverte existe vraiment dans le registre", () => {
    // Sans quoi le repli désignerait un terrain introuvable, et `mapUrlFromId` rendrait `undefined`
    // sur le chemin même qui est censé rattraper les identifiants inconnus.
    expect(MAPS_REGISTRY.some((entry) => entry.id === DEFAULT_MAP_ID)).toBe(true);
  });
});
