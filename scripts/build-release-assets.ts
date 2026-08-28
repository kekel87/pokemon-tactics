import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  beatEndSeconds,
  beatStartSeconds,
  CAPTURE_DIR,
  DEFAULT_OFFSET_MS,
  findBeat,
  findVideo,
  numberOption,
  readManifest,
  runFfmpeg,
  SCREENSHOTS_DIR,
} from "./intro-beats";

/*
 * Livrables de publication de la séquence d'intro (plan 194) : le GIF du combat et les captures fixes.
 *
 * Ce que l'humain publie, et où (demande du 2026-08-28) :
 * - la **vidéo** montée (`pnpm capture:trailer`) → YouTube, en non répertorié ;
 * - **un GIF du combat entier** → page itch.io ;
 * - **trois captures fixes** → page itch.io, wiki, README GitHub.
 *
 * ⚠️ **Limite itch.io : 3 Mo par image, GIF compris** (vérifié sur les fils d'aide itch.io, pas
 * supposé). Trente secondes de combat sous 3 Mo, ça fait 100 Ko/s : impossible à taille confortable.
 * D'où la recherche de réglage ci-dessous, qui descend en largeur et en cadence jusqu'à tenir dans le
 * budget — et qui DIT lequel a été retenu, pour que le compromis soit visible et non subi.
 */

const RELEASE_DIR = join(CAPTURE_DIR, "release");

/**
 * Budget de poids du GIF, en octets : **2,8 Mo pour une limite itch.io à 3 Mo**.
 *
 * La marge est volontaire. Le premier réglage retenu tombait à 2,99 Mo — sous la limite, mais l'upload
 * se fait à la main : un refus au téléversement coûte un aller-retour à l'humain, là où deux cents
 * kilooctets de marge ne coûtent que quelques couleurs.
 */
const GIF_BUDGET_BYTES = Math.round(2.8 * 1024 * 1024);

/**
 * Réglages candidats, du plus beau au plus économe.
 *
 * On descend d'abord la CADENCE, puis la largeur : sur un jeu au tour par tour, perdre des images se
 * remarque moins que perdre des pixels — le plateau est fixe la plupart du temps, et c'est la lisibilité
 * de l'interface qui porte l'information.
 */
interface GifSetting {
  readonly width: number;
  readonly fps: number;
  readonly colors: number;
  /** Facteur d'accélération. 1 = temps réel. */
  readonly speed: number;
}

const GIF_SETTINGS: readonly GifSetting[] = [
  { width: 960, fps: 15, colors: 256, speed: 1 },
  { width: 800, fps: 12, colors: 256, speed: 1 },
  { width: 720, fps: 12, colors: 192, speed: 1 },
  { width: 640, fps: 10, colors: 160, speed: 1 },
  { width: 560, fps: 10, colors: 128, speed: 1 },
  { width: 480, fps: 8, colors: 128, speed: 1 },
  { width: 420, fps: 8, colors: 96, speed: 1 },
  /*
   * Puis l'ACCÉLÉRATION, en dernier recours.
   *
   * Trente secondes de combat ne tiennent pas dans 3 Mo, mesuré : 4,48 Mo même en 420 px / 8 img/s.
   * Accélérer garde **tout** le combat — ce qui était la demande — là où tronquer en perdrait la moitié.
   * Un tour par tour accéléré reste lisible : les animations sont courtes, ce sont les poses et les
   * panneaux qui portent l'information.
   */
  { width: 480, fps: 10, colors: 128, speed: 1.5 },
  { width: 420, fps: 10, colors: 96, speed: 1.5 },
  { width: 420, fps: 8, colors: 96, speed: 2 },
  // 420 px / 96 couleurs tombait à 3,12 Mo — 4 % au-dessus du budget. Deux échelons plus fins avant de
  // descendre à 360 px : mieux vaut perdre des couleurs que des pixels sur une interface texte.
  { width: 420, fps: 8, colors: 80, speed: 2 },
  { width: 400, fps: 8, colors: 96, speed: 2 },
  { width: 360, fps: 8, colors: 96, speed: 2 },
];

/** Les trois captures fixes demandées, et le beat dont elles viennent. */
const SCREENSHOTS: readonly { name: string; fromBeat: string; what: string }[] = [
  { name: "01-map-select", fromBeat: "carte-retenue", what: "sélecteur de terrain (Arène Simple)" },
  /*
   * Deuxième variante du sélecteur, et c'est un ARBITRAGE à rendre, pas un doublon : Grotte Exiguë a un
   * relief autrement plus vendeur qu'un plateau plat, mais ses étiquettes s'affichent en FRANÇAIS même
   * en anglais (`maps-registry.ts` les code en dur — bug noté au backlog). Arène Simple, elle, n'a pas
   * d'étiquette du tout, donc sa fiche est propre en anglais.
   */
  {
    name: "01b-map-select-cave",
    fromBeat: "map-cramped-cave",
    what: "sélecteur de terrain (Grotte Exiguë, étiquettes FR)",
  },
  { name: "02-team-builder", fromBeat: "build-applique", what: "constructeur d'équipe" },
  { name: "03-twelve-players", fromBeat: "format-max", what: "sélection d'équipe en 12 joueurs" },
];

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`;
}

function main(): void {
  const argv = process.argv.slice(2);
  const offsetMs = numberOption(argv, "offset-ms", DEFAULT_OFFSET_MS);
  // `--budget-mb=3` colle à la limite itch.io au lieu de garder la marge : plus de pixels, mais un
  // téléversement qui peut être refusé de justesse.
  const budgetBytes = Math.round(
    numberOption(argv, "budget-mb", GIF_BUDGET_BYTES / 1024 / 1024) * 1024 * 1024,
  );

  const manifest = readManifest();
  const video = findVideo();
  mkdirSync(RELEASE_DIR, { recursive: true });

  /*
   * Les captures fixes sont COPIÉES depuis les PNG de la séquence, pas extraites de la vidéo.
   *
   * Elles sont déjà en 1920×1080 sans perte, prises par Playwright au moment exact du beat ; une image
   * tirée du mp4 traverserait en plus une compression H.264, qui fait baver le pixel art et les textes
   * fins de l'interface. Même instant, meilleure qualité, zéro travail.
   */
  for (const screenshot of SCREENSHOTS) {
    const beat = findBeat(manifest.beats, screenshot.fromBeat);
    const source = join(SCREENSHOTS_DIR, `${beat.slug}.png`);
    const target = join(RELEASE_DIR, `${screenshot.name}.png`);
    copyFileSync(source, target);
    console.log(`✅ ${target} — ${screenshot.what} (${megabytes(statSync(target).size)})`);
  }

  // --- Le GIF du combat entier, réglage cherché jusqu'à tenir dans le budget itch.io.
  const from = beatStartSeconds(findBeat(manifest.beats, "combat"), offsetMs);
  const duration = beatEndSeconds(findBeat(manifest.beats, "tour-suivant"), offsetMs) - from;
  const output = join(RELEASE_DIR, "combat.gif");

  let chosen: (typeof GIF_SETTINGS)[number] | null = null;
  for (const setting of GIF_SETTINGS) {
    runFfmpeg([
      "-ss",
      from.toFixed(3),
      "-t",
      duration.toFixed(3),
      "-i",
      video,
      "-filter_complex",
      // `setpts` d'abord : accélérer AVANT de rééchantillonner la cadence, sinon on jette des images
      // puis on les réétale, et le mouvement devient saccadé.
      `setpts=PTS/${setting.speed},` +
        // Plus proche voisin : un rééchantillonnage lissé transforme des pixels nets en bouillie.
        `fps=${setting.fps},scale=${setting.width}:-1:flags=neighbor,split[a][b];` +
        `[a]palettegen=max_colors=${setting.colors}[p];` +
        // `dither=bayer` avec une échelle basse : le tramage aléatoire par défaut ajoute du bruit qui
        // ruine la compression d'un GIF, donc du poids, sur une image pourtant à plats.
        "[b][p]paletteuse=dither=bayer:bayer_scale=3",
      "-loop",
      "0",
      output,
    ]);
    const size = statSync(output).size;
    console.log(
      `   essai ${setting.width} px / ${setting.fps} img/s / ${setting.colors} couleurs` +
        `${setting.speed === 1 ? "" : ` / ×${setting.speed}`} → ${megabytes(size)}`,
    );
    if (size <= budgetBytes) {
      chosen = setting;
      break;
    }
  }
  const finalSize = statSync(output).size;
  if (chosen === null) {
    /*
     * ÉCHEC, pas un avertissement : un GIF hors budget sera refusé par itch.io, donc le livrable
     * n'existe pas. Sortir en succès laissait un fichier inutilisable avec un message dans le flot.
     */
    throw new Error(
      `${output} pèse ${megabytes(finalSize)}, au-dessus du budget de ` +
        `${megabytes(budgetBytes)} même au réglage le plus économe. ` +
        "Options : raccourcir la séquence filmée, relever le budget (--budget-mb=), " +
        "ou publier la vidéo au lieu du GIF.",
    );
  } else {
    console.log(
      `✅ ${output} — ${megabytes(finalSize)} : ${chosen.width} px, ${chosen.fps} img/s, ` +
        `${chosen.colors} couleurs${chosen.speed === 1 ? "" : `, accéléré ×${chosen.speed}`} ` +
        `— ${duration.toFixed(1)} s de combat` +
        `${chosen.speed === 1 ? "" : ` jouées en ${(duration / chosen.speed).toFixed(1)} s`}`,
    );
  }
  console.log(`Livrables dans ${RELEASE_DIR}`);
}

main();
