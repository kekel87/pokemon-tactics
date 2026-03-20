import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@pokemon-tactic/core": new URL("../core/src", import.meta.url).pathname,
      "@pokemon-tactic/data": new URL("../data/src", import.meta.url).pathname,
    },
  },
  build: {
    target: "es2022",
  },
});
