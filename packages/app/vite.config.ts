import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { visualizer } from "rollup-plugin-visualizer";
import type { IndexHtmlTransformContext, Plugin, PluginOption } from "vite";
import { defineConfig } from "vite";

// Dev server port. Lets N parallel worktree sessions run `pnpm dev` without
// clashing on 5173: each worktree gets a deterministic port via `PT_PORT` env
// or a `.worktree-port` file at the repo root (written by worktree.sh).
// Climb from cwd (the renderer package dir when pnpm runs vite) up to the file,
// rather than from import.meta.dirname — Vite bundles this config to a temp
// location, so its dirname is unreliable. Main checkout has no file → 5173.
function resolveDevPort(): number | undefined {
  const fromEnv = process.env.PT_PORT;
  const fromEnvPort = Number(fromEnv);
  if (fromEnv && Number.isFinite(fromEnvPort)) {
    return fromEnvPort;
  }
  let dir = process.cwd();
  for (let depth = 0; depth < 5; depth++) {
    const portFile = resolve(dir, ".worktree-port");
    if (existsSync(portFile)) {
      const parsed = Number(readFileSync(portFile, "utf8").trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return undefined;
}

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

// Per-Pokemon `credits.txt` are attribution artefacts emitted by the sprite pipeline,
// never loaded at runtime. Shipping one per Pokemon bloats the itch.io HTML5 zip (hard
// 1000-file cap). Strip them from the build — attribution stays in the repo AND in the
// in-game Credits screen (PMDCollab SpriteCollab — CC BY-NC 4.0, with source link), which
// satisfies the licence in the distributed work.
function stripShippedCreditsPlugin(): Plugin {
  return {
    name: "strip-shipped-credits",
    apply: "build",
    closeBundle() {
      const spritesDir = resolve(process.cwd(), "dist/assets/sprites/pokemon");
      if (!existsSync(spritesDir)) {
        return;
      }
      for (const entry of readdirSync(spritesDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }
        const creditsFile = resolve(spritesDir, entry.name, "credits.txt");
        if (existsSync(creditsFile)) {
          rmSync(creditsFile);
        }
      }
    },
  };
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

// Bundle audit (Jalon 1 DoD): `BUNDLE_VISUALIZE=1 pnpm build` writes
// `dist/stats.html` (treemap) to track the Babylon bundle vs the 180-220 kB gzip target.
function bundleAuditPlugins(): PluginOption[] {
  if (!process.env.BUNDLE_VISUALIZE) {
    return [];
  }
  return [
    visualizer({
      filename: "dist/stats.html",
      gzipSize: true,
      brotliSize: true,
    }) as PluginOption,
  ];
}

export default defineConfig({
  base: process.env.ITCH_DEPLOY ? "./" : process.env.GITHUB_ACTIONS ? "/pokemon-tactics/" : "/",
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [goatcounterPlugin(), stripShippedCreditsPlugin(), ...bundleAuditPlugins()],
  server: {
    port: resolveDevPort(),
  },
  define: {
    // biome-ignore lint/style/useNamingConvention: Vite define convention uses __VAR__ double-underscore syntax
    __APP_VERSION__: JSON.stringify(resolveAppVersion()),
  },
  build: {
    target: "es2022",
    rollupOptions: {
      // Single-page app: `index.html` boots the Babylon renderer (`babylon-boot.ts`).
      // Relative to Vite `root` (the renderer package dir) — avoids the bundled-config
      // dirname unreliability noted in resolveDevPort above.
      input: {
        main: resolve(process.cwd(), "index.html"),
      },
      output: {
        // itch.io HTML5 zips cap at 1000 files. Babylon dynamically imports each
        // shader (`*.fragment.js` / `*.vertex.js`) as its own chunk → ~1000 tiny JS
        // files alone. Collapse all of @babylonjs into one vendor chunk so the deploy
        // stays well under the cap (shaders then load eagerly with the vendor bundle).
        codeSplitting: {
          groups: [{ name: "babylon", test: /node_modules[\\/]@babylonjs/ }],
        },
      },
    },
  },
});
