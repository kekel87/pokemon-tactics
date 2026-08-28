import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  beatStartSeconds,
  CAPTURE_DIR,
  DEFAULT_OFFSET_MS,
  findBeat,
  findVideo,
  numberOption,
  readManifest,
  runFfmpeg,
} from "./intro-beats";

/*
 * GIFs en boucle tirés de la séquence d'intro (plan 194) — pour Reddit, itch.io et le wiki, où une
 * vidéo ne se lit pas toujours mais où un GIF s'anime tout seul.
 *
 * Deux exigences propres au pixel art, et elles décident de tout :
 * - **agrandissement au plus proche voisin** (`flags=neighbor`) : un rééchantillonnage lissé transforme
 *   des pixels nets en bouillie, ce qui est exactement ce qu'on ne veut pas montrer d'un jeu pixel art ;
 * - **palette dédiée** (`palettegen` + `paletteuse`) : la palette générique de 256 couleurs de ffmpeg
 *   fait baver les dégradés de l'interface. La palette calculée sur le plan lui-même les garde.
 */

const GIF_DIR = join(CAPTURE_DIR, "gif");

/** Largeur de sortie. 960 px : lisible sur Reddit sans peser comme du 1920. */
const WIDTH = 960;
/** 15 images/s : le rendu est en pixel art, l'œil ne réclame pas plus, et le poids double vite. */
const FPS = 15;

interface GifSpec {
  /** Nom du fichier produit. */
  readonly name: string;
  /** Beat de départ, par son nom SANS rang (`impact`, pas `47-impact`). */
  readonly fromBeat: string;
  /** Durée à partir du début de l'état que ce beat nomme. */
  readonly seconds: number;
}

const GIFS: readonly GifSpec[] = [
  { name: "attaque", fromBeat: "prevision-degats", seconds: 6 },
  { name: "deplacement", fromBeat: "cases-accessibles", seconds: 5 },
  { name: "rotation-camera", fromBeat: "rotation-camera", seconds: 4 },
  { name: "constructeur-equipe", fromBeat: "pokemon-picker", seconds: 5 },
];

function main(): void {
  const argv = process.argv.slice(2);
  const offsetMs = numberOption(argv, "offset-ms", DEFAULT_OFFSET_MS);

  const manifest = readManifest();
  const video = findVideo();
  mkdirSync(GIF_DIR, { recursive: true });

  for (const spec of GIFS) {
    const beat = findBeat(manifest.beats, spec.fromBeat);
    const from = beatStartSeconds(beat, offsetMs);
    const output = join(GIF_DIR, `${spec.name}.gif`);
    /*
     * Une seule passe, avec `split` : la palette se calcule et s'applique dans le même graphe. Deux
     * passes avec un fichier de palette intermédiaire donneraient le même résultat pour deux fois plus
     * de code — et le risque d'appliquer la palette d'un autre plan.
     */
    runFfmpeg([
      "-ss",
      from.toFixed(3),
      "-t",
      String(spec.seconds),
      "-i",
      video,
      "-filter_complex",
      `fps=${FPS},scale=${WIDTH}:-1:flags=neighbor,split[a][b];` +
        "[a]palettegen=max_colors=256[p];[b][p]paletteuse=dither=bayer:bayer_scale=3",
      "-loop",
      "0",
      output,
    ]);
    console.log(`✅ ${output} (${spec.seconds} s depuis « ${beat.slug} »)`);
  }

  console.log(`${GIFS.length} GIF(s) dans ${GIF_DIR} — ${WIDTH} px de large, ${FPS} img/s.`);
}

main();
