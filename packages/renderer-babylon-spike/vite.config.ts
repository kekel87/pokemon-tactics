import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    target: "es2022",
  },
  server: {
    port: 5191,
  },
});
