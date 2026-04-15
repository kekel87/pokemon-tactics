/**
 * Helpers de fetch partagés entre build-reference.ts et fetch-champions.ts.
 *
 * Cache local gitignored : packages/data/.cache/
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const Dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(Dirname, "..");

export const CACHE_DIR = join(PACKAGE_ROOT, ".cache");
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 1000;

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function cachedFetch(url: string, cacheFile: string): Promise<unknown> {
  const cachePath = join(CACHE_DIR, cacheFile);
  try {
    const cached = await readFile(cachePath, "utf-8");
    return JSON.parse(cached);
  } catch {
    await ensureDir(dirname(cachePath));
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url);
        if (response.status === 429) {
          console.warn(`  Rate limited, waiting ${RETRY_DELAY_MS * (attempt + 1)}ms...`);
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }
        const data = await response.json();
        await writeFile(cachePath, JSON.stringify(data), "utf-8");
        return data;
      } catch (error) {
        lastError = error as Error;
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_DELAY_MS);
        }
      }
    }
    throw lastError;
  }
}

export async function cachedFetchText(url: string, cacheFile: string): Promise<string> {
  const cachePath = join(CACHE_DIR, cacheFile);
  try {
    return await readFile(cachePath, "utf-8");
  } catch {
    await ensureDir(dirname(cachePath));
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }
        const text = await response.text();
        await writeFile(cachePath, text, "utf-8");
        return text;
      } catch (error) {
        lastError = error as Error;
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_DELAY_MS);
        }
      }
    }
    throw lastError;
  }
}
