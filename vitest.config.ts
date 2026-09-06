import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // 🔴 La couverture se declare ICI, au niveau du run, et JAMAIS dans un projet inline :
    // Vitest 5 ignore silencieusement une section `coverage` posee dans `projects[]`. Elle y
    // etait, et le bump 4 → 5 a donc rendu `include`, `exclude` ET le seuil de 100 % sur le core
    // inoperants d'un coup, sans un mot : `pnpm test:coverage` rendait 0 en mesurant tout le
    // monorepo. Un filet qui tombe sans bruit est pire que pas de filet.
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.integration.test.ts",
        "**/*.scenario.test.ts",
        "**/index.ts",
        "**/types/**",
        "**/enums/**",
        "**/testing/**",
      ],
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      thresholds: {
        // Seuils alignes sur le RELEVE du 2026-09-06, pas sur une ambition : 81,51 % d'instructions,
        // 73,92 % de branches, 87,62 % de fonctions, 81,49 % de lignes. Ils sont poses juste dessous.
        //
        // Ils valaient 100 % avant, ce qui n'a jamais rien empeche : le core n'y a jamais ete
        // (`core/src/ai` est a ~49 %), et `test:coverage` n'etait branche ni au gate ni a la CI, donc
        // personne ne voyait le rouge. Un seuil decoratif ne protege rien.
        //
        // Le role de ces chiffres est d'empecher un RECUL, pas de decrire un idéal. On les remonte
        // quand la couverture monte ; on ne les baisse pas pour faire passer un diff.
        "packages/core/src/**": {
          statements: 81,
          branches: 73,
          functions: 87,
          lines: 81,
        },
      },
    },
    projects: [
      {
        resolve: {
          tsconfigPaths: true,
        },
        test: {
          name: "unit",
          isolate: false,
          pool: "threads",
          fsModuleCache: true,
          include: ["packages/*/src/**/*.test.ts", "packages/*/scripts/**/*.test.ts"],
          exclude: ["**/*.integration.test.ts", "**/*.scenario.test.ts"],
        },
      },
      {
        resolve: {
          tsconfigPaths: true,
        },
        test: {
          name: "integration",
          include: ["packages/*/src/**/*.integration.test.ts"],
        },
      },
      {
        resolve: {
          tsconfigPaths: true,
        },
        test: {
          name: "scenario",
          include: ["scenarios/**/*.scenario.test.ts"],
        },
      },
    ],
  },
});
