import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    projects: [
      {
        resolve: {
          tsconfigPaths: true,
        },
        test: {
          name: "unit",
          include: ["packages/*/src/**/*.test.ts"],
          exclude: ["**/*.integration.test.ts", "**/*.scenario.test.ts"],
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
              "packages/core/src/**": {
                statements: 100,
                branches: 100,
                functions: 100,
                lines: 100,
              },
            },
          },
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
