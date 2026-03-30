import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const STATUS_ICONS: Record<string, string> = {
  burned: "https://www.pokepedia.fr/images/5/51/Ic%C3%B4ne_Statut_Br%C3%BBlure_LPZA.png",
  frozen: "https://www.pokepedia.fr/images/8/80/Ic%C3%B4ne_Statut_Gel_LPZA.png",
  ko: "https://www.pokepedia.fr/images/6/67/Ic%C3%B4ne_Statut_K.O._LPZA.png",
  paralyzed: "https://www.pokepedia.fr/images/f/f4/Ic%C3%B4ne_Statut_Paralysie_LPZA.png",
  poisoned: "https://www.pokepedia.fr/images/5/53/Ic%C3%B4ne_Statut_Poison_LPZA.png",
  "badly-poisoned": "https://www.pokepedia.fr/images/0/0c/Ic%C3%B4ne_Statut_Poison_grave_LPZA.png",
  asleep: "https://www.pokepedia.fr/images/1/1f/Ic%C3%B4ne_Statut_Somnolence_LPZA.png",
};

const STATUS_LABELS: Record<string, string> = {
  burned: "https://www.pokepedia.fr/images/7/7a/Miniature_Statut_Br%C3%BBlure_LPZA.png",
  frozen: "https://www.pokepedia.fr/images/7/7f/Miniature_Statut_Gel_LPZA.png",
  ko: "https://www.pokepedia.fr/images/7/7e/Miniature_Statut_K.O._LPZA.png",
  paralyzed: "https://www.pokepedia.fr/images/a/a2/Miniature_Statut_Paralysie_LPZA.png",
  poisoned: "https://www.pokepedia.fr/images/7/71/Miniature_Statut_Poison_LPZA.png",
  "badly-poisoned": "https://www.pokepedia.fr/images/5/5f/Miniature_Statut_Poison_grave_LPZA.png",
  asleep: "https://www.pokepedia.fr/images/e/ec/Miniature_Statut_Somnolence_LPZA.png",
};

const OUTPUT_DIR = resolve("packages/renderer/public/assets/ui/statuses");

async function downloadFile(url: string, outputPath: string, label: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${label} (${url}): ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(outputPath, buffer);
  console.log(`  ${label}`);
}

async function main(): Promise<void> {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("Downloading status icons (ZA) from Pokepedia...\n");
  for (const [name, url] of Object.entries(STATUS_ICONS)) {
    await downloadFile(url, join(OUTPUT_DIR, `icon-${name}.png`), `icon-${name}`);
  }

  console.log("\nDownloading status labels (ZA) from Pokepedia...\n");
  for (const [name, url] of Object.entries(STATUS_LABELS)) {
    await downloadFile(url, join(OUTPUT_DIR, `label-${name}.png`), `label-${name}`);
  }

  console.log(
    `\nDone! ${Object.keys(STATUS_ICONS).length} icons + ${Object.keys(STATUS_LABELS).length} labels downloaded`,
  );
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
