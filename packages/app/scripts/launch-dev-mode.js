import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Start Vite in a dev mode (sandbox studio, move workshop) with an optional JSON config, passed
 * inline (`'{...}'`) or as a file path relative to where the command was typed. The config is
 * baked into the env at boot, so a new config means a new launch.
 */
export function launchDevMode(modeEnv, configEnv) {
  const rendererRoot = join(import.meta.dirname, "..");
  const callerCwd = process.env.INIT_CWD ?? process.cwd();
  const arg = process.argv[2];

  const env = { ...process.env, [modeEnv]: "true" };

  if (arg) {
    let json;
    if (arg.startsWith("{")) {
      json = arg;
    } else {
      const filePath = resolve(callerCwd, arg);
      if (!existsSync(filePath)) {
        process.exit(1);
      }
      json = readFileSync(filePath, "utf-8");
    }

    try {
      JSON.parse(json);
    } catch {
      process.exit(1);
    }

    env[configEnv] = json;
  }

  execSync("pnpm exec vite", { stdio: "inherit", env, cwd: rendererRoot });
}
