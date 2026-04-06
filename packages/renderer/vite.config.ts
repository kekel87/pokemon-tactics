import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/pokemon-tactics/" : "/",
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    target: "es2022",
  },
});
