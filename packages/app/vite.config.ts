import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { visualizer } from "rollup-plugin-visualizer";
import type { Plugin, PluginOption } from "vite";
import { defineConfig } from "vite";
import {
  NARROW_SCREEN_BUCKET,
  SCREEN_BUCKETS,
  TELEMETRY_ENDPOINT,
  TELEMETRY_PLATFORM_HOSTS,
  VISIT_BEACON_FLAG,
} from "./src/analytics/telemetry-contract";
import { LANGUAGE_STORAGE_KEY } from "./src/i18n/storage-key";

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
    const version = execSync("git describe --tags --always --dirty", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    /*
     * Un build de CI part d'un `checkout` propre : `-dirty` y est donc anormal, et pollue
     * l'étiquette de version qui sert justement à ne pas mélanger deux versions du jeu (#748).
     * Observé le 2026-09-02 sur les lignes de télémétrie de production, cause inconnue — alors on
     * dit CE QUI est sale plutôt que de deviner. Un build qui estampille `-dirty` doit se justifier.
     */
    if (version.endsWith("-dirty")) {
      const changed = execSync("git status --porcelain", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      console.warn(`[version] arbre sale, version estampillée ${version}. Fichiers :\n${changed}`);
    }
    return version;
  } catch {
    return "dev";
  }
}

// Sprites ship as a 3-file bundle (`sprites.bin` + `sprites-manifest.json` +
// `portraits.png`, plan 135), loaded at boot and sliced per-Pokemon at runtime. The
// per-Pokemon source folders (`assets/sprites/pokemon/<name>/…`) are kept on disk as
// editable source/cache but must NOT ship: shipping 4-5 files per Pokemon blows the
// itch.io HTML5 zip 1000-file cap as the roster grows. Strip the whole folder from the
// build output. Attribution (the per-folder `credits.txt`) stays in the repo AND in the
// in-game Credits screen (PMDCollab SpriteCollab — CC BY-NC 4.0, with source link).
function stripPerPokemonSpriteFoldersPlugin(): Plugin {
  return {
    name: "strip-per-pokemon-sprite-folders",
    apply: "build",
    closeBundle() {
      const perPokemonDir = resolve(process.cwd(), "dist/assets/sprites/pokemon");
      if (existsSync(perPokemonDir)) {
        rmSync(perPokemonDir, { recursive: true, force: true });
      }
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

/**
 * Balise de visite, injectée dans `index.html` avant tout le reste (plan 196, décision #889).
 *
 * 🔴 Elle existe parce que `initTelemetry()`, dans le bundle, arrive TROP TARD pour une catégorie
 * entière de joueurs. `index.html` ne charge qu'un module, `babylon-boot.ts`, dont le graphe
 * d'imports statiques inclut Babylon : en ESM, tout ce graphe est téléchargé et évalué avant la
 * première instruction du corps du module. Un joueur qui referme pendant ces 4,3 Mo n'exécute donc
 * jamais une ligne de télémétrie — alors qu'itch.io a déjà compté son « Browser Play » (incident du
 * 2026-09-03 : 2 plays comptés par itch, zéro ligne en base).
 *
 * Elle ne sait faire qu'une chose : envoyer la ligne `first`, celle qui porte le comptage des
 * visites. Tous les compteurs d'écrans et d'actions restent au bundle.
 *
 * Le code est GÉNÉRÉ à partir de `src/analytics/telemetry-contract.ts` — endpoint, hôtes de
 * publication, paliers d'écran et nom du drapeau viennent tous de là. Il n'y a donc pas deux
 * sources de vérité, seulement deux émetteurs.
 */
function visitBeaconPlugin(): Plugin {
  const beacon = `(function(){try{
var host=location.hostname,platform=null,hosts=${JSON.stringify(TELEMETRY_PLATFORM_HOSTS)};
for(var i=0;i<hosts.length;i++){if(host.indexOf(hosts[i][0])!==-1){platform=hosts[i][1];break;}}
if(!platform)return;
var width=screen.width,bucket=${JSON.stringify(NARROW_SCREEN_BUCKET)},buckets=${JSON.stringify(SCREEN_BUCKETS)};
for(var j=0;j<buckets.length;j++){if(width>=buckets[j][0]){bucket=buckets[j][1];break;}}
var language=null;try{language=localStorage.getItem(${JSON.stringify(LANGUAGE_STORAGE_KEY)});}catch(e){}
var body=JSON.stringify({kind:"session",build:${JSON.stringify(resolveAppVersion())},platform:platform,payload:{uiLanguage:language,inputSource:null,screen:bucket,referrer:document.referrer||null,screens:{},actions:{},first:true}});
if(navigator.sendBeacon&&navigator.sendBeacon(${JSON.stringify(TELEMETRY_ENDPOINT)},body)){window[${JSON.stringify(VISIT_BEACON_FLAG)}]=true;}
}catch(e){}})();`;

  return {
    name: "visit-beacon",
    transformIndexHtml() {
      return [{ tag: "script", children: beacon, injectTo: "head" }];
    },
  };
}

export default defineConfig({
  /*
   * `/pokemon-tactics/` est le chemin des GitHub Pages, déduit de `GITHUB_ACTIONS`. Mais cette
   * variable dit « je tourne sur un runner », pas « je construis pour les Pages » — et depuis que
   * le harnais e2e construit l'application au lieu de servir le serveur de développement, il
   * construit LUI AUSSI sur un runner, alors qu'il sert à la RACINE. La suite du 2026-09-05 l'a
   * montré : les pages se chargeaient (vite preview redirige) mais un `fetch` direct du manifeste
   * tombait en 404. `VITE_E2E` tranche donc en premier — le harnais n'est jamais publié.
   */
  base: process.env.ITCH_DEPLOY
    ? "./"
    : process.env.GITHUB_ACTIONS && process.env.VITE_E2E !== "true"
      ? "/pokemon-tactics/"
      : "/",
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [visitBeaconPlugin(), stripPerPokemonSpriteFoldersPlugin(), ...bundleAuditPlugins()],
  server: {
    port: resolveDevPort(),
    /*
     * Vite refuse par défaut les requêtes dont l'en-tête `Host` n'est pas local (protection
     * anti-DNS-rebinding) — donc un tunnel de dev reçoit un 403 « This host is not allowed ».
     * Ouvert uniquement sur `PT_TUNNEL=1`, jamais par défaut : accepter n'importe quel `Host` en
     * permanence exposerait le serveur de dev à une attaque par rebinding depuis un simple onglet.
     *
     * Restreint au domaine du fournisseur de tunnel plutôt que `true` : la protection reste
     * entière pour tout autre `Host`, y compris quand la variable est posée. `undefined` quand elle
     * ne l'est pas → Vite garde sa liste blanche locale, aucun changement de comportement.
     *
     * Usage et pièges : `docs/references/test-sur-telephone.md`.
     */
    allowedHosts: process.env.PT_TUNNEL === "1" ? [".trycloudflare.com"] : undefined,
  },
  define: {
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
