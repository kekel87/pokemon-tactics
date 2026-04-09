#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const rendererRoot = join(import.meta.dirname, "..");
const mapsDir = join(rendererRoot, "public/assets/maps");
const callerCwd = process.env.INIT_CWD ?? process.cwd();
const arg = process.argv[2];

if (!arg) {
  console.error("Usage: pnpm dev:map <map-name-or-path>");
  console.error("Examples:");
  console.error("  pnpm dev:map highlands");
  console.error("  pnpm dev:map highlands.tmj");
  console.error("  pnpm dev:map packages/renderer/public/assets/maps/test-arena.tmj");
  process.exit(1);
}

function resolveMapPath(input) {
  const fileName = input.endsWith(".tmj") ? input : `${input}.tmj`;
  const candidates = [
    resolve(callerCwd, input),
    resolve(callerCwd, fileName),
    join(mapsDir, fileName),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

const filePath = resolveMapPath(arg);
if (!filePath) {
  console.error(`Map not found: ${arg}`);
  console.error(`Looked in: ${mapsDir}`);
  process.exit(1);
}

const relativePath = filePath.includes("/public/")
  ? filePath.split("/public/")[1]
  : `assets/maps/${filePath.split("/").pop()}`;

const env = { ...process.env, VITE_MAP_PREVIEW: relativePath };

console.log(`Opening map preview: ${relativePath}`);
console.log(`Navigate to: http://localhost:5173/?map=${relativePath}`);

execSync(`pnpm exec vite --open '/?map=${relativePath}'`, {
  stdio: "inherit",
  env,
  cwd: rendererRoot,
});
