#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const rendererRoot = join(import.meta.dirname, "..");
const callerCwd = process.env.INIT_CWD ?? process.cwd();
const arg = process.argv[2];

const env = { ...process.env, VITE_SANDBOX: "true" };

if (arg) {
  let json;
  if (arg.startsWith("{")) {
    json = arg;
  } else {
    const filePath = resolve(callerCwd, arg);
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      console.error("\nUsage:");
      console.error("  pnpm dev:sandbox                        # default config");
      console.error("  pnpm dev:sandbox config.json             # from file");
      console.error('  pnpm dev:sandbox \'{"pokemon":"charizard"}\' # inline JSON');
      process.exit(1);
    }
    json = readFileSync(filePath, "utf-8");
  }

  try {
    JSON.parse(json);
  } catch {
    console.error("Invalid JSON:", json);
    process.exit(1);
  }

  env.VITE_SANDBOX_CONFIG = json;
}

execSync("pnpm exec vite", { stdio: "inherit", env, cwd: rendererRoot });
