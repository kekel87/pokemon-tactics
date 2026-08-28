import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * Lecture du manifeste de la séquence d'intro, et découpage en fenêtres (plan 194).
 *
 * Partagé par les deux montages : la coupe brute (`build-intro-video.ts`) et la bande-annonce à
 * chapitres (`build-intro-trailer.ts`). Le découpage est la seule chose qu'ils ont en commun, et c'est
 * aussi la plus subtile — la dupliquer garantirait que l'un des deux garde un bug corrigé dans l'autre.
 */

export const CAPTURE_DIR = resolve(".captures");
/**
 * Dossier des captures de la séquence. Nommé ici pour que le manifeste et les captures livrées ne
 * puissent pas diverger : le chemin était écrit en dur dans quatre fichiers, donc un renommage en
 * cassait trois en silence.
 */
export const SCREENSHOTS_DIR = resolve(".screenshots/intro");
export const BEATS_PATH = join(SCREENSHOTS_DIR, "beats.json");
const ARTIFACTS_DIR = join(CAPTURE_DIR, "artifacts");

/**
 * Fenêtre gardée autour d'un instant nommé, en secondes.
 *
 * Elle couvre **exactement la pause délibérée** que le beat nomme : de peu avant son début jusqu'à
 * peine après la capture. Un beat est horodaté au moment de la capture, donc à la fin de sa pause de
 * cadence (`leadMs`), et l'état qu'il nomme occupe l'intervalle qui la précède.
 *
 * ⚠️ Surtout : la fenêtre ne DÉBORDE PAS après la capture. Une queue de deux ou trois secondes faisait
 * spiller le dernier plan des menus dans le combat qui suit — on voyait la bataille intacte pendant
 * deux secondes, puis un saut brutal vers la bataille engagée (retour humain 2026-08-28).
 */
const LEAD_MARGIN_SECONDS = 0.4;
const FALLBACK_LEAD_SECONDS = 1.4;
const TAIL_SECONDS = 0.5;

/**
 * Décalage entre le zéro du manifeste et celui de la vidéo, en millisecondes.
 *
 * Playwright commence à filmer à la création du CONTEXTE, le manifeste compte depuis la création de
 * l'enregistreur — et la capture d'écran elle-même prend un instant. **Mesuré** (PSNR entre la capture
 * `45-journal.png` et la vidéo source, image par image) : le contenu apparaît **110 ms plus tôt** dans
 * la vidéo que ne le dit le manifeste.
 */
export const DEFAULT_OFFSET_MS = -110;

export interface Beat {
  slug: string;
  caption: string;
  atMs: number;
  /** Pause de cadence qui précède le beat. Absent des manifestes d'avant le 2026-08-28. */
  leadMs?: number;
}

export interface Manifest {
  seed: number;
  beats: Beat[];
}

/**
 * Nommée `KeptWindow` et non `Window` : le second masque le global du DOM. Les scripts n'ont pas la lib
 * DOM aujourd'hui, mais le piège se refermerait au premier qui l'ajoute.
 */
export interface KeptWindow {
  /** Bornes dans la vidéo SOURCE, en secondes. */
  readonly from: number;
  readonly to: number;
  /** Les cartons à poser dans cette fenêtre, avec leur instant source. */
  readonly captions: { text: string; atSeconds: number }[];
}

export function readManifest(): Manifest {
  if (!existsSync(BEATS_PATH)) {
    throw new Error(`manifeste absent (${BEATS_PATH}) : lance d'abord \`pnpm capture:intro\``);
  }
  return JSON.parse(readFileSync(BEATS_PATH, "utf8")) as Manifest;
}

/**
 * Lit une option numérique de la ligne de commande, ou rend le défaut.
 *
 * Échoue sur une valeur non numérique au lieu de propager un `NaN` : `--budget-mb=abc` donnait un
 * budget `NaN`, donc une comparaison toujours fausse, donc douze encodages ffmpeg enchaînés pour
 * finir sur un avertissement muet (revue de code du 2026-08-28).
 */
export function numberOption(argv: readonly string[], name: string, fallback: number): number {
  const found = argv.find((argument) => argument.startsWith(`--${name}=`));
  if (found === undefined) {
    return fallback;
  }
  const value = Number(found.split("=")[1]);
  if (!Number.isFinite(value)) {
    throw new Error(`option --${name} : « ${found.split("=")[1]} » n'est pas un nombre`);
  }
  return value;
}

/**
 * Retrouve un beat par son nom, ou échoue en listant ceux qui existent.
 *
 * Partagé par les trois montages : la même recherche y était recopiée cinq fois, avec trois messages
 * d'erreur différents dont un sans la liste des beats disponibles — celui qui sert justement à
 * comprendre l'erreur.
 */
export function findBeat(beats: readonly Beat[], name: string): Beat {
  const beat = beats.find((candidate) => beatName(candidate.slug) === name);
  if (!beat) {
    throw new Error(
      `le beat « ${name} » n'est pas dans le manifeste. ` +
        `Beats disponibles : ${beats.map((candidate) => beatName(candidate.slug)).join(", ")}`,
    );
  }
  return beat;
}

/** Nom du beat sans son rang : `41-combat` → `combat`. C'est la partie STABLE d'un slug. */
export function beatName(slug: string): string {
  return slug.replace(/^\d+-/, "");
}

/**
 * Couleur d'accent du jeu — le jaune doré des titres et de l'anneau de focus (`#ffdd44`, relevé dans
 * `docs/design-system.md`). Les textes du montage la reprennent : une bande-annonce en blanc à côté
 * d'une interface jaune se lit comme du sous-titrage collé après coup.
 */
export const ACCENT_COLOR = "0xffdd44";

/** Fin de l'état que le beat nomme : l'instant de la capture, plus un souffle. */
export function beatEndSeconds(beat: Beat, offsetMs: number): number {
  return Math.max(0, (beat.atMs + offsetMs) / 1000) + TAIL_SECONDS;
}

/** Début de l'état que le beat nomme, en secondes de la vidéo source. */
export function beatStartSeconds(beat: Beat, offsetMs: number): number {
  const lead = (beat.leadMs ?? FALLBACK_LEAD_SECONDS * 1000) / 1000;
  return Math.max(0, (beat.atMs + offsetMs) / 1000 - lead);
}

/**
 * Fenêtres à garder, fusionnées quand elles se chevauchent.
 *
 * TOUS les beats comptent, pas seulement ceux qui portent un carton : un beat est un instant qu'on a
 * jugé digne d'une capture, c'est donc exactement ce qui doit rester au montage. Filtrer sur la
 * présence d'un carton laissait tomber tout le volet combat le jour où les cartons sont devenus
 * optionnels — la vidéo est passée de 50 instants à 4 sans rien dire.
 */
export function buildWindows(beats: Beat[], offsetMs: number): KeptWindow[] {
  const windows: KeptWindow[] = [];
  for (const beat of beats) {
    const start = beatStartSeconds(beat, offsetMs);
    const at = Math.max(0, (beat.atMs + offsetMs) / 1000);
    const from = Math.max(0, start - LEAD_MARGIN_SECONDS);
    const to = at + TAIL_SECONDS;
    const caption =
      beat.caption.trim().length > 0 ? [{ text: beat.caption, atSeconds: start }] : [];
    const last = windows.at(-1);
    if (last && from <= last.to) {
      // Chevauchement : on étend la fenêtre courante au lieu de couper deux fois au même endroit,
      // ce qui produirait une saccade en plein plan.
      windows[windows.length - 1] = {
        from: last.from,
        to: Math.max(last.to, to),
        captions: [...last.captions, ...caption],
      };
      continue;
    }
    windows.push({ from, to, captions: caption });
  }
  return windows;
}

/** La vidéo brute la plus RÉCENTE sous les artefacts Playwright. */
export function findVideo(): string {
  if (!existsSync(ARTIFACTS_DIR)) {
    throw new Error("aucun dossier d'artefacts : lance d'abord `pnpm capture:intro`");
  }
  // On prend la plus récente : un dossier d'un run précédent peut traîner, et monter l'ancienne vidéo
  // sans le dire serait le pire des échecs (le montage aurait l'air d'avoir marché).
  const candidates: { path: string; mtimeMs: number }[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.name.endsWith(".webm")) {
        candidates.push({ path, mtimeMs: statSync(path).mtimeMs });
      }
    }
  };
  walk(ARTIFACTS_DIR);
  const newest = candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)[0];
  if (!newest) {
    throw new Error(`aucune vidéo .webm sous ${ARTIFACTS_DIR}`);
  }
  return newest.path;
}

/** Chemin d'une police réelle du système — `drawtext` exige un fichier, jamais un nom de famille. */
export function findFont(): string {
  /*
   * On cherche un vrai fichier GRAS avant de demander à fontconfig.
   *
   * `fc-match "sans-serif:bold"` renvoie ici une police VARIABLE (`NotoSans[wght].ttf`) dont
   * `drawtext` prend l'axe de poids par défaut, donc un titre maigre — vu à l'image sur le premier
   * carton. Une police dont le gras est un fichier à part n'a pas ce problème.
   */
  const preferred = [
    "/usr/share/fonts/google-droid-sans-fonts/DroidSans-Bold.ttf",
    "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/open-sans/OpenSans-Semibold.ttf",
  ];
  for (const path of preferred) {
    if (existsSync(path)) {
      return path;
    }
  }
  const matched = execFileSync("fc-match", ["-f", "%{file}", "sans-serif:bold"], {
    encoding: "utf8",
  }).trim();
  if (!existsSync(matched)) {
    throw new Error("aucune police trouvée pour les cartons (fontconfig n'a rien renvoyé)");
  }
  return matched;
}

/** Échappe le texte d'un carton pour la syntaxe de filtre ffmpeg. */
export function escapeDrawText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "’")
    .replace(/,/g, "\\,")
    .replace(/\[/g, "\\[")
    .replace(/]/g, "\\]");
}

/**
 * `libopenh264` et non `libx264` : le ffmpeg de la machine est bâti sans x264. OpenH264 sort un H.264
 * lisible par itch.io et par tous les navigateurs, ce que ni AV1 ni VP9 ne garantissent encore. Les
 * encodeurs matériels (`h264_nvenc`, `h264_vaapi`) seraient plus rapides mais lieraient la sortie au
 * GPU de la machine — un montage doit rester reproductible ailleurs.
 *
 * 4 Mb/s : le rendu est du pixel art à plats, il se comprime très bien. 8 sortait un fichier deux fois
 * plus lourd sans rien gagner à l'œil, et itch.io fait payer le poids en temps de chargement.
 */
export const H264_ARGS: readonly string[] = [
  "-c:v",
  "libopenh264",
  "-b:v",
  "4M",
  "-pix_fmt",
  "yuv420p",
  // `+faststart` : l'index passe en tête du fichier, donc la lecture démarre avant la fin du
  // téléchargement — c'est ce qui fait qu'une vidéo itch.io ne reste pas noire trois secondes.
  "-movflags",
  "+faststart",
];

export function runFfmpeg(args: readonly string[]): void {
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    stdio: ["ignore", "ignore", "inherit"],
  });
}
