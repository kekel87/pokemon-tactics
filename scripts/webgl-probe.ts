#!/usr/bin/env tsx
/**
 * webgl-probe — dit quel rasteriseur Chromium a RÉELLEMENT pris, et s'il sait faire du WebGL2.
 *
 * Motif : les arguments de sélection du rasteriseur logiciel échouent EN SILENCE. `--disable-gpu`
 * réactive SwiftShader sans rien dire ; des paquets Mesa absents font retomber `--use-angle=gl` sur
 * le rasteriseur embarqué. Dans les deux cas on croit mesurer llvmpipe et on mesure SwiftShader —
 * la comparaison des deux rendrait alors deux fois le même chiffre sans qu'on le voie.
 *
 * La chaîne d'identité vient de `WEBGL_debug_renderer_info` : elle contient « SwiftShader » ou
 * « llvmpipe » selon le cas, et le nom du vrai GPU sur une machine qui en a un.
 *
 * Les arguments de lancement sont ceux de `playwright.config.ts` (même arbitrage `PT_GL`), pour que
 * la sonde mesure exactement ce que la suite lancera.
 *
 * Usage : PT_GL=llvmpipe tsx scripts/webgl-probe.ts
 * Sort en 1 si le contexte WebGL ne se crée pas du tout.
 */
import { chromium } from "@playwright/test";
import config from "../playwright.config";

interface WebglIdentity {
  vendor: string;
  renderer: string;
  version: string;
  webgl2: boolean;
  maxTextureSize: number;
}

async function main(): Promise<void> {
  const args = config.use?.launchOptions?.args ?? [];
  process.stderr.write(
    `\nwebgl-probe → PT_GL=${process.env.PT_GL ?? "(non défini)"}\n  arguments : ${
      args.length > 0 ? args.join(" ") : "(aucun — GPU matériel)"
    }\n`,
  );

  const browser = await chromium.launch({ args });
  const page = await browser.newPage();

  const identity = await page.evaluate<WebglIdentity | null>(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) {
      return null;
    }
    // `WEBGL_debug_renderer_info` est l'extension qui lève l'anonymisation du couple pilote/carte.
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      vendor: debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)) : "(masqué)",
      renderer: debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : "(masqué)",
      version: String(gl.getParameter(gl.VERSION)),
      webgl2: canvas.getContext("webgl2") !== null,
      maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
    };
  });

  await browser.close();

  if (identity === null) {
    process.stderr.write("\n  ✗ AUCUN contexte WebGL — le rendu Babylon ne peut pas démarrer.\n\n");
    process.exit(1);
  }

  const family = /swiftshader/i.test(identity.renderer)
    ? "SwiftShader (Google, embarqué)"
    : /llvmpipe/i.test(identity.renderer)
      ? "llvmpipe (Mesa)"
      : "GPU matériel ou pilote tiers";

  process.stderr.write(
    [
      "",
      `  rasteriseur effectif : ${family}`,
      `  vendeur              : ${identity.vendor}`,
      `  renderer             : ${identity.renderer}`,
      `  version              : ${identity.version}`,
      `  WebGL2               : ${identity.webgl2 ? "oui" : "NON — Babylon en a besoin"}`,
      `  MAX_TEXTURE_SIZE     : ${identity.maxTextureSize}`,
      "",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`webgl-probe : ${String(error)}\n`);
  process.exit(1);
});
