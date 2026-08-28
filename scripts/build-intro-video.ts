import { join } from "node:path";
import {
  type Beat,
  beatStartSeconds,
  buildWindows,
  CAPTURE_DIR,
  DEFAULT_OFFSET_MS,
  escapeDrawText,
  findFont,
  findVideo,
  H264_ARGS,
  type KeptWindow,
  numberOption,
  readManifest,
  runFfmpeg,
} from "./intro-beats";

/*
 * Coupe BRUTE de la séquence d'intro (plan 194) : les instants nommés du manifeste, recollés bout à
 * bout, sans habillage.
 *
 * C'est l'outil de VÉRIFICATION — celui qu'on ouvre pour juger un plan ou retrouver un beat raté. La
 * bande-annonce habillée (cartons animés, transitions) est `build-intro-trailer.ts`.
 *
 * Le découpage lui-même vit dans `intro-beats.ts`, partagé avec la bande-annonce : c'est la partie
 * subtile, et la dupliquer garantirait qu'un bug corrigé d'un côté survive de l'autre.
 */

/** Durée d'affichage d'un carton, et sa fondu d'entrée / sortie. */
const CAPTION_SECONDS = 2.6;
const FADE_SECONDS = 0.4;

/**
 * Un `drawtext` par carton, apparu et disparu en fondu.
 *
 * Le fondu passe par `alpha` et non par `enable` : `enable` fait apparaître le texte d'un coup, ce
 * qui, sur une bande-annonce, se voit comme un clignotement.
 */
function drawText(text: string, startSeconds: number, fontPath: string): string {
  const start = Math.max(0, startSeconds);
  const end = start + CAPTION_SECONDS;
  const alpha = [
    `if(lt(t,${start.toFixed(2)}),0,`,
    `if(lt(t,${(start + FADE_SECONDS).toFixed(2)}),(t-${start.toFixed(2)})/${FADE_SECONDS},`,
    `if(lt(t,${(end - FADE_SECONDS).toFixed(2)}),1,`,
    `if(lt(t,${end.toFixed(2)}),(${end.toFixed(2)}-t)/${FADE_SECONDS},0))))`,
  ].join("");
  return [
    "drawtext=",
    `fontfile='${fontPath}'`,
    `:text='${escapeDrawText(text)}'`,
    ":fontsize=54",
    ":fontcolor=white",
    ":borderw=3",
    ":bordercolor=black@0.85",
    ":x=(w-text_w)/2",
    // Bas de cadre, au-dessus des panneaux d'interface plutôt qu'en travers du plateau.
    ":y=h-190",
    `:alpha='${alpha}'`,
  ].join("");
}

/** Montage intégral : la vidéo brute, cartons posés à leur instant source si on en veut. */
function buildFullFilter(beats: Beat[], offsetMs: number, fontPath: string | null): string {
  if (fontPath === null) {
    return "null";
  }
  const drawTexts = beats
    .filter((beat) => beat.caption.trim().length > 0)
    .map((beat) => drawText(beat.caption, beatStartSeconds(beat, offsetMs), fontPath));
  return drawTexts.length === 0 ? "null" : drawTexts.join(",");
}

/**
 * Montage « temps forts » : on ne garde que les fenêtres nommées, recollées bout à bout.
 *
 * `select` garde les images voulues, `setpts` **réécrit leurs horodatages** — sans lui, ffmpeg
 * conserve les timestamps d'origine et le lecteur affiche une vidéo de trois minutes dont l'essentiel
 * est figé. Les cartons sont ensuite calés sur la NOUVELLE échelle de temps : l'instant source moins
 * le début de sa fenêtre, plus tout ce qui a été gardé avant elle.
 */
function buildHighlightFilter(windows: KeptWindow[], fontPath: string | null): string {
  const select = windows
    .map((window) => `between(t,${window.from.toFixed(3)},${window.to.toFixed(3)})`)
    .join("+");
  const drawTexts: string[] = [];
  let elapsed = 0;
  for (const window of windows) {
    for (const caption of window.captions) {
      if (fontPath !== null) {
        drawTexts.push(
          drawText(caption.text, elapsed + (caption.atSeconds - window.from), fontPath),
        );
      }
    }
    elapsed += window.to - window.from;
  }
  return [`select='${select}'`, "setpts=N/FRAME_RATE/TB", ...drawTexts].join(",");
}

function main(): void {
  const argv = process.argv.slice(2);
  const offsetMs = numberOption(argv, "offset-ms", DEFAULT_OFFSET_MS);
  const wantsWebm = argv.includes("--webm");
  /*
   * Par défaut on sort les TEMPS FORTS : c'est la vidéo de présentation. L'intégrale reste
   * accessible (`--full`) parce qu'elle sert à vérifier un plan qu'on croit raté — mais trois minutes
   * dont la moitié est du remplissage de tours ne se publient pas.
   */
  const wantsFull = argv.includes("--full");
  /*
   * Les cartons de texte ne s'incrustent **que sur demande** (retour humain 2026-08-28 : « c'est quoi
   * ces sous-titres dégueulasses »). Le montage propre viendra plus tard, sans doute avec un habillage
   * qui n'est pas trois lignes de `drawtext` ; en attendant, la sortie par défaut est l'image nue.
   *
   * Les instants nommés, eux, restent le squelette du montage : ce sont eux qui décident des coupes.
   */
  const wantsCaptions = argv.includes("--captions");

  const manifest = readManifest();
  const video = findVideo();
  const fontPath = wantsCaptions ? findFont() : "";
  const windows = buildWindows(manifest.beats, offsetMs);
  const keptSeconds = windows.reduce((total, window) => total + (window.to - window.from), 0);
  const filter = wantsFull
    ? buildFullFilter(manifest.beats, offsetMs, wantsCaptions ? fontPath : null)
    : buildHighlightFilter(windows, wantsCaptions ? fontPath : null);

  const suffix = wantsFull ? "-full" : "";
  const mp4 = join(CAPTURE_DIR, `intro${suffix}.mp4`);
  runFfmpeg(["-i", video, "-vf", filter, "-an", ...H264_ARGS, mp4]);
  console.log(`✅ ${mp4}`);

  if (wantsWebm) {
    const webm = join(CAPTURE_DIR, `intro${suffix}.webm`);
    runFfmpeg([
      "-i",
      video,
      "-vf",
      filter,
      "-an",
      "-c:v",
      "libvpx-vp9",
      "-b:v",
      "3M",
      "-row-mt",
      "1",
      webm,
    ]);
    console.log(`✅ ${webm}`);
  }

  console.log(
    [
      `Source : ${video}`,
      `Beats : ${manifest.beats.length} (seed ${manifest.seed}), décalage ${offsetMs} ms`,
      wantsFull
        ? "Montage : intégral"
        : `Montage : ${windows.length} temps forts, ~${Math.round(keptSeconds)} s gardés`,
      `Cartons : ${wantsCaptions ? "incrustés" : "aucun (--captions pour les remettre)"}`,
    ].join("\n"),
  );
}

main();
