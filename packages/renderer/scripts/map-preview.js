#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const rendererRoot = join(import.meta.dirname, "..");
const callerCwd = process.env.INIT_CWD ?? process.cwd();
const arg = process.argv[2];

if (!arg) {
  console.error("Usage: pnpm dev:map <path-to-map.tmj>");
  console.error("Example: pnpm dev:map packages/renderer/public/assets/maps/test-arena.tmj");
  process.exit(1);
}

const filePath = resolve(callerCwd, arg);
if (!existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const relativePath = filePath.includes("/public/")
  ? filePath.split("/public/")[1]
  : `assets/maps/${arg.split("/").pop()}`;

const env = { ...process.env, VITE_MAP_PREVIEW: relativePath };

console.log(`Opening map preview: ${relativePath}`);
console.log(`Navigate to: http://localhost:5173/?map=${relativePath}`);

execSync(`pnpm exec vite --open '/?map=${relativePath}'`, {
  stdio: "inherit",
  env,
  cwd: rendererRoot,
});
