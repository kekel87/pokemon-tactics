import type { IndexHtmlTransformContext, Plugin } from "vite";
import { defineConfig } from "vite";

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
  build: {
    target: "es2022",
  },
});
