import { execSync } from "node:child_process";
import type { IndexHtmlTransformContext, Plugin } from "vite";
import { defineConfig } from "vite";

function resolveAppVersion(): string {
  try {
    return execSync("git describe --tags --always --dirty", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "dev";
  }
}

function goatcounterPlugin(): Plugin {
  return {
    name: "goatcounter",
    transformIndexHtml: {
      order: "post",
      handler(html: string, context: IndexHtmlTransformContext): string {
        if (context.server) {
          return html;
        }
        const tag = `<script data-goatcounter="https://kekel87.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>`;
        return html.replace("</body>", `${tag}\n</body>`);
      },
    },
  };
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/pokemon-tactics/" : "/",
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [goatcounterPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(resolveAppVersion()),
  },
  build: {
    target: "es2022",
  },
});
