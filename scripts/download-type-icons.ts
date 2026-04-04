import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const TYPE_ICONS: Record<string, string> = {
  normal: "https://www.pokepedia.fr/images/1/1f/Ic%C3%B4ne_Type_Normal_LPZA.png",
  fighting: "https://www.pokepedia.fr/images/1/1c/Ic%C3%B4ne_Type_Combat_LPZA.png",
  flying: "https://www.pokepedia.fr/images/9/91/Ic%C3%B4ne_Type_Vol_LPZA.png",
  poison: "https://www.pokepedia.fr/images/4/4b/Ic%C3%B4ne_Type_Poison_LPZA.png",
  ground: "https://www.pokepedia.fr/images/5/5f/Ic%C3%B4ne_Type_Sol_LPZA.png",
  rock: "https://www.pokepedia.fr/images/c/cc/Ic%C3%B4ne_Type_Roche_LPZA.png",
  bug: "https://www.pokepedia.fr/images/6/62/Ic%C3%B4ne_Type_Insecte_LPZA.png",
  ghost: "https://www.pokepedia.fr/images/b/b8/Ic%C3%B4ne_Type_Spectre_LPZA.png",
  steel: "https://www.pokepedia.fr/images/d/d6/Ic%C3%B4ne_Type_Acier_LPZA.png",
  fire: "https://www.pokepedia.fr/images/6/62/Ic%C3%B4ne_Type_Feu_LPZA.png",
  water: "https://www.pokepedia.fr/images/2/21/Ic%C3%B4ne_Type_Eau_LPZA.png",
  grass: "https://www.pokepedia.fr/images/3/3e/Ic%C3%B4ne_Type_Plante_LPZA.png",
  electric: "https://www.pokepedia.fr/images/a/a8/Ic%C3%B4ne_Type_%C3%89lectrik_LPZA.png",
  psychic: "https://www.pokepedia.fr/images/1/13/Ic%C3%B4ne_Type_Psy_LPZA.png",
  ice: "https://www.pokepedia.fr/images/e/e6/Ic%C3%B4ne_Type_Glace_LPZA.png",
  dragon: "https://www.pokepedia.fr/images/1/12/Ic%C3%B4ne_Type_Dragon_LPZA.png",
  dark: "https://www.pokepedia.fr/images/8/8c/Ic%C3%B4ne_Type_T%C3%A9n%C3%A8bres_LPZA.png",
  fairy: "https://www.pokepedia.fr/images/9/92/Ic%C3%B4ne_Type_F%C3%A9e_LPZA.png",
};

const CATEGORY_ICONS: Record<string, string> = {
  physical: "https://archives.bulbagarden.net/media/upload/b/b4/PhysicalIC_SV.png",
  special: "https://archives.bulbagarden.net/media/upload/5/5b/SpecialIC_SV.png",
  status: "https://archives.bulbagarden.net/media/upload/e/e0/StatusIC_SV.png",
};

const TYPES_DIR = resolve("packages/renderer/public/assets/ui/types");
const CATEGORIES_DIR = resolve("packages/renderer/public/assets/ui/categories");

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
  console.log("Downloading type icons (ZA) from Pokepedia...\n");

  mkdirSync(TYPES_DIR, { recursive: true });
  for (const [name, url] of Object.entries(TYPE_ICONS)) {
    await downloadFile(url, join(TYPES_DIR, `${name}.png`), name);
  }

  console.log("\nDownloading category icons (SV) from Bulbagarden...\n");

  mkdirSync(CATEGORIES_DIR, { recursive: true });
  for (const [name, url] of Object.entries(CATEGORY_ICONS)) {
    await downloadFile(url, join(CATEGORIES_DIR, `${name}.png`), name);
  }

  console.log(
    `\nDone! ${Object.keys(TYPE_ICONS).length} types + ${Object.keys(CATEGORY_ICONS).length} categories downloaded`,
  );
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
