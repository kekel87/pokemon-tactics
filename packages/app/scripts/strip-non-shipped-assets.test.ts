import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Plugin, PluginOption, ResolvedConfig } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import viteConfig from "../vite.config";

const PLUGIN_NAME = "strip-non-shipped-assets";
const OUT_DIR = "dist";

function isPlugin(option: PluginOption): option is Plugin {
  return (
    typeof option === "object" && option !== null && !Array.isArray(option) && "name" in option
  );
}

function findPlugin(): Plugin {
  const plugins = (viteConfig.plugins ?? []).flat(Number.POSITIVE_INFINITY);
  const plugin = (plugins as PluginOption[])
    .filter(isPlugin)
    .find((candidate) => candidate.name === PLUGIN_NAME);
  if (!plugin) {
    throw new Error(`plugin ${PLUGIN_NAME} absent de vite.config.ts`);
  }
  return plugin;
}

function hookHandler<Hook>(hook: Hook | { handler: Hook } | undefined): Hook {
  if (hook === undefined) {
    throw new Error("hook absent");
  }
  if (typeof hook === "object" && hook !== null && "handler" in hook) {
    return hook.handler;
  }
  return hook;
}

function runPlugin(root: string): void {
  const plugin = findPlugin();
  const configResolved = hookHandler(plugin.configResolved) as (config: ResolvedConfig) => void;
  const closeBundle = hookHandler(plugin.closeBundle) as () => void;
  configResolved({ root, build: { outDir: OUT_DIR } } as unknown as ResolvedConfig);
  closeBundle();
}

describe("strip-non-shipped-assets plugin", () => {
  let root: string;
  let distDir: string;

  function writeFile(relativePath: string): void {
    const absolutePath = join(distDir, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, "");
  }

  function writeFiller(count: number, directory = "filler"): void {
    for (let index = 0; index < count; index++) {
      writeFile(`${directory}/file-${index}.js`);
    }
  }

  function shipped(relativePath: string): boolean {
    return existsSync(join(distDir, relativePath));
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "pt-strip-assets-"));
    distDir = join(root, OUT_DIR);
    vi.stubEnv("VITE_E2E", undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it("removes the source sprite folders and the dev maps from a production build", () => {
    writeFile("assets/sprites/pokemon/bulbasaur/Idle-Anim.png");
    writeFile("assets/sprites/item-icons/leftovers.png");
    writeFile("assets/maps/dev/sandbox.tmj");
    writeFile("assets/sprites/item-icons.png");
    writeFile("assets/maps/forest.tmj");
    writeFile("index.html");

    runPlugin(root);

    expect(shipped("assets/sprites/pokemon")).toBe(false);
    expect(shipped("assets/sprites/item-icons")).toBe(false);
    expect(shipped("assets/maps/dev")).toBe(false);
    expect(shipped("assets/sprites/item-icons.png")).toBe(true);
    expect(shipped("assets/maps/forest.tmj")).toBe(true);
    expect(shipped("index.html")).toBe(true);
  });

  it("keeps the dev maps and skips the file cap on an e2e build", () => {
    vi.stubEnv("VITE_E2E", "true");
    writeFile("assets/sprites/pokemon/bulbasaur/Idle-Anim.png");
    writeFile("assets/maps/dev/sandbox.tmj");

    runPlugin(root);

    expect(shipped("assets/maps/dev/sandbox.tmj")).toBe(true);
    expect(shipped("assets/sprites/pokemon")).toBe(false);
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("fails a production build of more than 1000 files, naming itch.io", () => {
    writeFiller(1001);

    expect(() => runPlugin(root)).toThrow(/itch\.io/);
  });

  it("does not count the stripped folders against the cap", () => {
    writeFiller(5);
    writeFiller(3, "assets/sprites/pokemon");

    runPlugin(root);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("5 fichiers"));
  });

  it("accepts a production build of exactly 1000 files, with a warning", () => {
    writeFiller(1000);

    expect(() => runPlugin(root)).not.toThrow();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("1000 fichiers"));
  });

  it("warns from 900 files", () => {
    writeFiller(900);

    expect(() => runPlugin(root)).not.toThrow();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("900 fichiers"));
  });

  it("neither warns nor fails below 900 files", () => {
    writeFiller(899);

    expect(() => runPlugin(root)).not.toThrow();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
