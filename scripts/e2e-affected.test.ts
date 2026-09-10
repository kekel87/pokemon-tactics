import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  configConstsForId,
  decide,
  type Family,
  INPUT_SPEC_NAMES,
  type LotRefs,
  parseConstBlocks,
  resolveBaseRef,
  route,
  selectionDefects,
  specsByFamily,
  unknownFlag,
} from "./e2e-affected";

const SPECS = [
  "e2e/tests/smoke/screen-tour.spec.ts",
  "e2e/tests/smoke/splash.spec.ts",
  "e2e/tests/dom/main-menu.spec.ts",
  "e2e/tests/dom/online-lobby.spec.ts",
  "e2e/tests/dom/online-resilience.spec.ts",
  "e2e/tests/dom/online-determinism.spec.ts",
  "e2e/tests/dom/gamepad-menus.spec.ts",
  "e2e/tests/dom/gamepad-pickers.spec.ts",
  "e2e/tests/dom/screen-keyboard.spec.ts",
  "e2e/tests/dom/controls-remapping.spec.ts",
  "e2e/tests/combat/hud.spec.ts",
  "e2e/tests/combat/keyboard-controls.spec.ts",
  "e2e/tests/combat/touch-controls.spec.ts",
  "e2e/tests/combat/input-prompt-glyph.spec.ts",
  "e2e/tests/combat/controls-remapping.spec.ts",
  "e2e/tests/combat/camera-pan-keyboard.spec.ts",
  "e2e/tests/combat/chrome-key-hints.spec.ts",
  "e2e/tests/combat/compass-and-legend.spec.ts",
  "e2e/tests/combat/mechanics-status.spec.ts",
  "e2e/tests/combat/mechanics-terrain.spec.ts",
  "e2e/tests/visual/screens.spec.ts",
] as const;

const selected = (files: readonly string[], specs: readonly string[] = SPECS) =>
  decide(undefined, { files, specs });

describe("route — chemin de source → familles", () => {
  it("route le réseau vers la seule famille online", () => {
    const { families, unclassified } = route(["packages/network/peer.ts"]);
    expect([...families]).toEqual(["online"]);
    expect(unclassified).toEqual([]);
  });

  it("route app/src/network vers online lui aussi", () => {
    expect([...route(["packages/app/src/network/session.ts"]).families]).toEqual(["online"]);
  });

  it("ne classe pas un chemin inconnu, au lieu de l'ignorer", () => {
    expect(route(["packages/inconnu/x.ts"]).unclassified).toEqual(["packages/inconnu/x.ts"]);
  });

  it("laisse le worker de télémétrie sans famille e2e", () => {
    const { families, unclassified } = route(["packages/telemetry-worker/index.ts"]);
    expect([...families]).toEqual([]);
    expect(unclassified).toEqual([]);
  });

  it("prend la règle la plus spécifique avant le repli du paquet", () => {
    expect([...route(["packages/core/battle/turn.ts"]).families]).toEqual(["mechanics"]);
    expect([...route(["packages/core/ai/scoring.ts"]).families]).toEqual(["combat"]);
  });
});

describe("specsByFamily — le détail qui rend une famille muette visible", () => {
  it("résout chaque famille séparément", () => {
    const byFamily = specsByFamily(new Set<Family>(["online", "tour"]), SPECS);
    expect(byFamily.get("online")).toEqual([
      "e2e/tests/dom/online-lobby.spec.ts",
      "e2e/tests/dom/online-resilience.spec.ts",
      "e2e/tests/dom/online-determinism.spec.ts",
    ]);
    expect(byFamily.get("tour")).toHaveLength(2);
  });

  it("rend un tableau vide pour une famille dont le motif ne matche plus", () => {
    const orphelins = SPECS.filter((spec) => !spec.startsWith("e2e/tests/dom/online-"));
    expect(specsByFamily(new Set<Family>(["online"]), orphelins).get("online")).toEqual([]);
  });
});

describe("decide — niveaux et périmètre", () => {
  it("descend au tour des écrans quand rien n'a changé", () => {
    expect(selected([]).level).toBe("smoke");
  });

  it("descend au tour des écrans sur un diff purement documentaire", () => {
    const decision = selected(["docs/roadmap.md", ".claude/rules/e2e.md"]);
    expect(decision.level).toBe("smoke");
    expect(decision.runs).toEqual([["e2e/tests/smoke"]]);
  });

  it("escalade en suite entière sur un chemin non classé", () => {
    const decision = selected(["packages/inconnu/x.ts"]);
    expect(decision.level).toBe("full");
    expect(decision.runs).toEqual([[]]);
  });

  it("cible les specs en ligne, plus le plancher, sur un changement réseau", () => {
    const decision = selected(["packages/network/peer.ts"]);
    expect(decision.level).toBe("affected");
    expect([...(decision.runs[0] ?? [])].sort()).toEqual([
      "e2e/tests/dom/online-determinism.spec.ts",
      "e2e/tests/dom/online-lobby.spec.ts",
      "e2e/tests/dom/online-resilience.spec.ts",
      "e2e/tests/smoke/screen-tour.spec.ts",
      "e2e/tests/smoke/splash.spec.ts",
    ]);
  });

  it("ne rejoue pas les mécaniques pour un changement réseau", () => {
    expect(selected(["packages/network/peer.ts"]).runs[0]).not.toContain(
      "e2e/tests/combat/mechanics-status.spec.ts",
    );
  });

  it("joint toujours le tour des écrans, même quand la famille n'en demande pas", () => {
    expect(selected(["packages/app/src/input/gamepad.ts"]).runs[0]).toContain(
      "e2e/tests/smoke/splash.spec.ts",
    );
  });

  it("élargit sur un fichier de config sans perdre le reste du diff", () => {
    const runs = selected(["package.json", "packages/core/battle/turn.ts"]).runs[0];
    expect(runs).toContain("e2e/tests/combat/mechanics-status.spec.ts");
    expect(runs).toContain("e2e/tests/dom/main-menu.spec.ts");
  });

  it("rejoue un spec e2e modifié quoi qu'en dise la table", () => {
    expect(selected(["e2e/tests/visual/screens.spec.ts"]).runs[0]).toContain(
      "e2e/tests/visual/screens.spec.ts",
    );
  });

  it("ajoute une passe --only-changed quand une fixture e2e bouge", () => {
    const decision = decide("base-du-lot", {
      files: ["e2e/fixtures/sandbox-configs.ts"],
      specs: SPECS,
    });
    expect(decision.runs.at(-1)).toEqual(["--only-changed=base-du-lot"]);
  });
});

describe("decide — la famille muette ne passe plus en silence", () => {
  it("escalade en suite entière quand une famille retenue ne résout aucun spec", () => {
    const renomme = SPECS.filter((spec) => !spec.startsWith("e2e/tests/dom/online-"));
    const decision = decide(undefined, { files: ["packages/network/peer.ts"], specs: renomme });
    expect(decision.level).toBe("full");
    expect(decision.reason).toContain("online");
    expect(decision.runs).toEqual([[]]);
  });

  it("nomme toutes les familles muettes, pas seulement la première", () => {
    const decision = decide(undefined, {
      files: ["packages/render-babylon/scene.ts"],
      specs: ["e2e/tests/smoke/splash.spec.ts"],
    });
    expect(decision.level).toBe("full");
    expect(decision.reason).toContain("combat");
    expect(decision.reason).toContain("visual");
  });

  it("ne se déclenche pas tant que chaque famille retenue a ses specs", () => {
    expect(selected(["packages/render-babylon/scene.ts"]).level).toBe("affected");
  });
});

describe("unknownFlag", () => {
  it("laisse passer les drapeaux connus", () => {
    expect(unknownFlag(["--print", "--since-main", "--level=full", "origin/main"])).toBeUndefined();
  });

  it("attrape une faute de frappe au lieu de l'ignorer", () => {
    expect(unknownFlag(["--since-mian"])).toContain("--since-mian");
  });

  it("ne prend pas une base explicite pour un drapeau", () => {
    expect(unknownFlag(["abc1234"])).toBeUndefined();
  });
});

describe("resolveBaseRef", () => {
  const refs =
    (base: string | undefined, head: string | undefined, ref = "origin/main"): (() => LotRefs) =>
    () => ({ base, ref: base === undefined ? undefined : ref, head });

  it("rend undefined sans drapeau ni base explicite", () => {
    const choice = resolveBaseRef([], refs("base", "tete"));
    expect(choice.baseRef).toBeUndefined();
    expect(choice.warnings).toEqual([]);
  });

  it("prend la base du lot sur --since-main", () => {
    const choice = resolveBaseRef(["--since-main"], refs("base-du-lot", "tete"));
    expect(choice.baseRef).toBe("base-du-lot");
    expect(choice.warnings).toEqual([]);
  });

  it("ne résout pas la base du lot quand --since-main est absent", () => {
    let appels = 0;
    resolveBaseRef([], () => {
      appels += 1;
      return { base: "base", ref: "origin/main", head: "tete" };
    });
    expect(appels).toBe(0);
  });

  it("laisse une base explicite l'emporter, et le dit", () => {
    const choice = resolveBaseRef(["origin/main", "--since-main"], refs("base", "tete"));
    expect(choice.baseRef).toBe("origin/main");
    expect(choice.warnings.join(" ")).toContain("--since-main ignoré");
  });

  it("avertit quand aucune base de lot n'existe, et retombe sur le défaut", () => {
    const choice = resolveBaseRef(["--since-main"], refs(undefined, "tete"));
    expect(choice.baseRef).toBeUndefined();
    expect(choice.warnings.join(" ")).toContain("repli sur HEAD");
  });

  it("avertit quand la base du lot vaut HEAD, au lieu d'annoncer une victoire", () => {
    const choice = resolveBaseRef(["--since-main"], refs("meme-sha", "meme-sha"));
    expect(choice.baseRef).toBe("meme-sha");
    expect(choice.warnings.join(" ")).toContain("aucun commit local en avance");
  });

  it("avertit quand la base vient de `main` local faute d'origin/main", () => {
    const choice = resolveBaseRef(["--since-main"], refs("base", "tete", "main"));
    expect(choice.baseRef).toBe("base");
    expect(choice.warnings.join(" ")).toContain("`main` local");
  });

  it("ne dit rien de la ref quand origin/main a répondu", () => {
    expect(resolveBaseRef(["--since-main"], refs("base", "tete")).warnings).toEqual([]);
  });

  it("refuse deux bases positionnelles au lieu d'en avaler une", () => {
    const choice = resolveBaseRef(["origin/main", "HEAD"], refs("base", "tete"));
    expect(choice.error).toContain("une seule base attendue");
    expect(choice.baseRef).toBeUndefined();
  });
});

describe("selectionDefects", () => {
  it("ne rapporte rien quand chaque famille résout ses specs", () => {
    expect(selectionDefects(new Set<Family>(["online", "tour"]), SPECS)).toEqual([]);
  });

  it("attrape la dérive PARTIELLE de la famille input", () => {
    const ampute = SPECS.filter((spec) => spec !== "e2e/tests/dom/gamepad-menus.spec.ts");
    const defauts = selectionDefects(new Set<Family>(["input"]), ampute);
    expect(defauts.join(" ")).toContain("e2e/tests/dom/gamepad-menus.spec.ts");
  });

  it("ne contrôle la liste de saisie que si la famille input est retenue", () => {
    const ampute = SPECS.filter((spec) => spec !== "e2e/tests/dom/gamepad-menus.spec.ts");
    expect(selectionDefects(new Set<Family>(["tour"]), ampute)).toEqual([]);
  });
});

describe("decide — dérive partielle de la famille input", () => {
  it("escalade en suite entière quand un spec de saisie nommé a disparu", () => {
    const ampute = SPECS.filter((spec) => spec !== "e2e/tests/combat/keyboard-controls.spec.ts");
    const decision = decide(undefined, {
      files: ["packages/app/src/input/gamepad.ts"],
      specs: ampute,
    });
    expect(decision.level).toBe("full");
    expect(decision.reason).toContain("keyboard-controls.spec.ts");
  });
});

describe("INPUT_SPEC_NAMES confrontée au dépôt", () => {
  it("ne nomme que des specs qui existent vraiment", () => {
    expect([...INPUT_SPEC_NAMES].filter((name) => !existsSync(name))).toEqual([]);
  });
});

describe("parseConstBlocks", () => {
  it("capte les constantes exportées comme les privées", () => {
    const blocks = parseConstBlocks("const A = { x: 1 };\nexport const B = { y: 2 };\n");
    expect([...blocks.keys()]).toEqual(["A", "B"]);
  });

  it("garde le corps de chaque constante", () => {
    const blocks = parseConstBlocks('const DUEL = { moves: ["lame-de-roche"] };\n');
    expect(blocks.get("DUEL")).toContain('"lame-de-roche"');
  });
});

describe("configConstsForId", () => {
  const blocks = () =>
    parseConstBlocks(
      [
        'const DUEL = { moves: ["lame-de-roche"] };',
        "const POISONED = { ...DUEL, status: 1 };",
        "const CHAINED = { ...POISONED };",
        'const AILLEURS = { moves: ["provoc"] };',
        "",
      ].join("\n"),
    );

  it("retient la constante qui porte l'identifiant", () => {
    expect(configConstsForId("lame-de-roche", blocks())).toContain("DUEL");
  });

  it("suit l'héritage par spread, transitivement", () => {
    const consts = configConstsForId("lame-de-roche", blocks());
    expect(consts).toContain("POISONED");
    expect(consts).toContain("CHAINED");
  });

  it("laisse de côté une constante étrangère à l'identifiant", () => {
    expect(configConstsForId("lame-de-roche", blocks())).not.toContain("AILLEURS");
  });

  it("ne retient rien pour un identifiant absent", () => {
    expect(configConstsForId("attaque-inexistante", blocks())).toEqual([]);
  });
});
