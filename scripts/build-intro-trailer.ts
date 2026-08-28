import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ACCENT_COLOR,
  type Beat,
  beatEndSeconds,
  beatStartSeconds,
  buildWindows,
  CAPTURE_DIR,
  DEFAULT_OFFSET_MS,
  escapeDrawText,
  findBeat,
  findFont,
  findVideo,
  H264_ARGS,
  type KeptWindow,
  numberOption,
  readManifest,
  runFfmpeg,
} from "./intro-beats";
import { type DrawnIcon, writeDrawnIcon } from "./trailer-icons";

/*
 * Bande-annonce montée de la séquence d'intro (plan 194).
 *
 * Découpage dicté plan par plan par l'humain (2026-08-28) : titre qui descend « comme le logo Nintendo
 * quand on allume une Game Boy », puis une alternance carton de texte → séquence de jeu, un écran de
 * plateformes en trois colonnes, et retour au titre pour finir. **Pas de son** (aucune source audio, et
 * on n'ajoute pas d'asset non libre).
 *
 * ⚠️ L'ordre du montage n'est PAS celui du tournage : le combat passe en premier, le constructeur
 * d'équipe en troisième. D'où la `TIMELINE` explicite — chaque plan y dit d'où il vient, et le script
 * va chercher les fenêtres correspondantes dans le manifeste. Un découpage chronologique, comme la
 * première version, ne peut pas exprimer ça.
 *
 * Différence avec `build-intro-video.ts` : celui-là recolle les instants nommés bout à bout, sans rien
 * ajouter — c'est l'outil de vérification, utile pour juger un plan. Celui-ci habille.
 *
 * Pourquoi des fichiers intermédiaires (`.captures/parts/`) plutôt qu'un seul `filter_complex` : la
 * chaîne complète ferait une vingtaine d'entrées et autant de `xfade` imbriqués, illisible et
 * indébogable. Chaque partie est ici un fichier qu'on peut ouvrir pour voir où ça casse.
 */

const PARTS_DIR = join(CAPTURE_DIR, "parts");

/** Durée d'un raccord, en secondes. Assez court pour ne pas endormir, assez long pour se voir. */
const TRANSITION_SECONDS = 0.55;
/**
 * `pixelize` plutôt qu'un fondu : le jeu est en pixel art, et cette transition le dit. Les 57 modes de
 * `xfade` sont disponibles (`fade`, `dissolve`, `wipeleft`, `circleopen`, `zoomin`…) — celui-ci a été
 * choisi pour le sujet, pas par défaut.
 */
const TRANSITION = "pixelize";
/** Le tout premier raccord est un FONDU : le titre doit s'effacer, pas se pixeliser. */
const OPENING_TRANSITION = "fade";

const CARD_SECONDS = 3;
const TITLE_DROP_SECONDS = 3.4;
const END_TITLE_SECONDS = 3;
const PLATFORMS_SECONDS = 4.2;

/** Fond des écrans de texte pleins — le bleu nuit de l'interface du jeu, pas un noir mort. */
const BACKDROP_COLOR = "0x0b0d1a";

/**
 * Planche de pictogrammes Kenney `input-prompts-pixel-1-bit` (CC0), déjà dans le dépôt et déjà utilisée
 * par le jeu : 34×24 tuiles de 16 px, glyphes blancs sur fond noir.
 *
 * On la réutilise plutôt que de dessiner : c'est le même dessin que le joueur voit en jeu, donc l'écran
 * de plateformes reste cohérent avec l'interface — et aucun asset nouveau n'entre dans le dépôt.
 */
const GLYPH_SHEET = resolve("packages/app/public/assets/ui/input-prompts/tilemap-1bit.png");
const GLYPH_TILE = 16;

/**
 * Tuiles utilisées, en (colonne, ligne), relevées dans
 * `docs/references/kenney-input-prompts-tileset.md` — jamais devinées.
 *
 * ⚠️ La planche n'a **ni silhouette de manette ni téléphone** (trou documenté du pack). On prend donc
 * les tenants-lieu que le jeu utilise déjà : le bouton A pour la manette, et la main-curseur pour le
 * tactile (choix humain du 2026-08-20, faute de glyphe de doigt dans le pack).
 */
const SHEET_GLYPHS = {
  mouse: { column: 9, row: 3 },
  keycap: { column: 17, row: 4 },
} as const;

/**
 * Source d'un pictogramme : une tuile de la planche Kenney, ou un dessin maison.
 *
 * Les deux coexistent parce que la planche ne couvre pas tout : elle a la souris et le capuchon de
 * touche, elle n'a **ni manette ni téléphone**. Les deux manquants sont dessinés en ASCII dans
 * `trailer-icons.ts`, sur la même grille de 16 px, pour que les quatre dessins aient la même densité.
 */
type IconSource =
  | { readonly kind: "sheet"; readonly name: keyof typeof SHEET_GLYPHS }
  | { readonly kind: "drawn"; readonly name: DrawnIcon };

const ICONS = {
  mouse: { kind: "sheet", name: "mouse" },
  keycap: { kind: "sheet", name: "keycap" },
  gamepad: { kind: "drawn", name: "gamepad" },
  phone: { kind: "drawn", name: "phone" },
} as const satisfies Record<string, IconSource>;

/** Une colonne de l'écran de plateformes. */
interface PlatformColumn {
  readonly title: string;
  readonly subtitle: string;
  readonly glyphs: readonly (keyof typeof ICONS)[];
}

const PLATFORM_COLUMNS: readonly PlatformColumn[] = [
  { title: "PC & MAC", subtitle: "Mouse and keyboard", glyphs: ["mouse", "keycap"] },
  { title: "GAMEPAD", subtitle: "Fully remappable", glyphs: ["gamepad"] },
  { title: "PHONE", subtitle: "Touch, pinch and drag", glyphs: ["phone"] },
];

/**
 * Un plan du montage. La `TIMELINE` en est la liste ORDONNÉE, indépendante de la chronologie du tournage.
 *
 * `fromBeat` / `toBeat` sont des noms de beats SANS leur rang (`combat`, pas `41-combat`) : les rangs
 * bougent dès qu'on ajoute un instant à la séquence, les noms non. Un nom absent du manifeste fait
 * échouer le montage — mieux vaut ça qu'un plan silencieusement vide.
 */
type Shot =
  | { readonly kind: "titleDrop"; readonly title: string; readonly subtitle: string }
  | { readonly kind: "endTitle"; readonly title: string; readonly subtitle: string }
  | { readonly kind: "platforms"; readonly title: string }
  | {
      readonly kind: "card";
      readonly title: string;
      readonly subtitle: string;
      /** Beat dont l'image sert de fond flouté. Par défaut, celui du plan de jeu qui suit. */
      readonly backdropBeat?: string;
    }
  | { readonly kind: "clip"; readonly fromBeat: string; readonly toBeat: string };

const GAME_TITLE = "POKÉMON TACTICS";
const GAME_TAGLINE = "Tactical battles on an isometric grid";

const TIMELINE: readonly Shot[] = [
  { kind: "titleDrop", title: GAME_TITLE, subtitle: GAME_TAGLINE },
  {
    kind: "card",
    title: "TURN-BASED TACTICS",
    subtitle: "Charge Time turn order, and the odds before you commit",
  },
  { kind: "clip", fromBeat: "combat", toBeat: "tour-suivant" },
  {
    kind: "card",
    title: "SEVERAL ARENAS",
    subtitle: "Each with its own terrain and its own spawn zones",
  },
  { kind: "clip", fromBeat: "choix-carte", toBeat: "carte-retenue" },
  {
    kind: "card",
    title: "BUILD YOUR TEAM",
    subtitle: "151 Pokémon, four moves, a held item, stat points",
  },
  { kind: "clip", fromBeat: "mes-equipes", toBeat: "build-applique" },
  {
    kind: "card",
    title: "LOCAL MULTIPLAYER",
    subtitle: "Up to twelve players, same screen",
  },
  { kind: "clip", fromBeat: "selection-equipe", toBeat: "camps-prets" },
  { kind: "platforms", title: "PLAY IT ANYWHERE" },
  { kind: "endTitle", title: GAME_TITLE, subtitle: GAME_TAGLINE },
];

interface Part {
  readonly path: string;
  readonly seconds: number;
  /** Raccord utilisé pour ARRIVER sur cette partie. */
  readonly transition: string;
}

/** Instant source où commence l'état qu'un beat nomme. */
function beatStart(beats: Beat[], name: string, offsetMs: number): number {
  return beatStartSeconds(findBeat(beats, name), offsetMs);
}

/** Instant source où s'achève l'état qu'un beat nomme. */
function beatEnd(beats: Beat[], name: string, offsetMs: number): number {
  return beatEndSeconds(findBeat(beats, name), offsetMs);
}

/** Un pictogramme, prêt à être posé : découpé de la planche ou dessiné, puis agrandi. */
async function renderIcon(name: keyof typeof ICONS, scale: number, output: string): Promise<void> {
  const icon: IconSource = ICONS[name];
  if (icon.kind === "drawn") {
    await writeDrawnIcon(icon.name, scale, output);
    return;
  }
  const { column, row } = SHEET_GLYPHS[icon.name];
  runFfmpeg([
    "-i",
    GLYPH_SHEET,
    "-vf",
    [
      `crop=${GLYPH_TILE}:${GLYPH_TILE}:${column * GLYPH_TILE}:${row * GLYPH_TILE}`,
      // Plus proche voisin : un rééchantillonnage lissé transforme un dessin de 16 px en bouillie.
      `scale=iw*${scale}:ih*${scale}:flags=neighbor`,
      // La planche est un MASQUE (glyphes blancs sur noir) : le noir devient transparent pour que le
      // dessin se pose sur le fond sans son carré.
      "colorkey=0x000000:0.01:0",
      "format=rgba",
    ].join(","),
    output,
  ]);
}

/**
 * Un carton animé, construit sur une IMAGE DU JEU floutée et assombrie.
 *
 * Un fond noir aurait été plus simple, mais il coupe le film en deux : ici le décor reste
 * reconnaissable derrière le texte, donc le carton se lit comme une respiration et non comme une
 * interruption.
 *
 * ⚠️ En DEUX étapes, et c'est structurel : le fond est une image fixe, mais le texte doit s'animer,
 * donc il faut un `t` qui avance. Tout faire d'un coup ne marche pas — `-frames:v 1` sortait un carton
 * d'UNE image (0,04 s), que `xfade` avalait entièrement, et la bande-annonce tombait de cent à
 * vingt-neuf secondes sans que rien ne le signale.
 */
function renderCard(
  video: string,
  atSeconds: number,
  title: string,
  subtitle: string,
  fontPath: string,
  output: string,
): void {
  const still = `${output}.png`;
  runFfmpeg([
    "-ss",
    atSeconds.toFixed(3),
    "-i",
    video,
    "-frames:v",
    "1",
    "-vf",
    // Flou franc + assombrissement : le décor doit rester lisible SANS concurrencer le texte.
    "gblur=sigma=18,eq=brightness=-0.15:saturation=0.75",
    still,
  ]);

  const fadeIn = 0.5;
  const subtitleDelay = 0.45;
  const rise = 20;
  /*
   * `y` est le HAUT de la boîte de texte, pas sa ligne de base : un titre de 96 px posé à `h/2 - 70`
   * descend jusqu'à `h/2 + 26` et recouvrait le sous-titre. Les hauteurs ci-dessous laissent une
   * trentaine de pixels entre les blocs.
   */
  const titleAlpha = `if(lt(t,${fadeIn}),t/${fadeIn},1)`;
  const titleY = `(h/2)-130+${rise}*(1-min(t/${fadeIn},1))`;
  const subtitleAlpha =
    `if(lt(t,${subtitleDelay}),0,` +
    `if(lt(t,${subtitleDelay + fadeIn}),(t-${subtitleDelay})/${fadeIn},1))`;
  const subtitleY = `(h/2)+15+${rise}*(1-min(max(t-${subtitleDelay},0)/${fadeIn},1))`;
  runFfmpeg([
    "-loop",
    "1",
    "-t",
    String(CARD_SECONDS),
    "-i",
    still,
    "-vf",
    [
      `drawtext=fontfile='${fontPath}':text='${escapeDrawText(title)}'` +
        `:fontsize=96:fontcolor=${ACCENT_COLOR}:borderw=4:bordercolor=black@0.8` +
        `:x=(w-text_w)/2:y='${titleY}':alpha='${titleAlpha}'`,
      `drawtext=fontfile='${fontPath}':text='${escapeDrawText(subtitle)}'` +
        `:fontsize=44:fontcolor=${ACCENT_COLOR}@0.9:borderw=3:bordercolor=black@0.8` +
        `:x=(w-text_w)/2:y='${subtitleY}':alpha='${subtitleAlpha}'`,
    ].join(","),
    "-r",
    "25",
    ...H264_ARGS,
    output,
  ]);
}

/**
 * Le titre qui DESCEND et s'arrête, comme le logo au démarrage d'une Game Boy.
 *
 * Trois temps, et c'est ce qui fait la citation : une chute **linéaire** (la Game Boy fait défiler le
 * logo, elle ne l'anime pas avec un ressort), un arrêt net au centre, puis une pause avant la suite. Le
 * sous-titre n'apparaît qu'APRÈS l'arrêt — sinon il descend avec le titre et le geste se lit comme un
 * simple glissé.
 *
 * Fond uni ici, pas une image de jeu : le premier plan pose le titre, il ne montre pas encore.
 */
function renderTitleDrop(title: string, subtitle: string, fontPath: string, output: string): void {
  const dropSeconds = 1.2;
  const startY = -160;
  const restY = "(h/2)-130";
  const titleY =
    `if(lt(t,${dropSeconds}),` +
    `${startY}+(t/${dropSeconds})*((h/2)-130-(${startY})),` +
    restY +
    ")";
  const subtitleDelay = dropSeconds + 0.35;
  const subtitleFade = 0.6;
  const subtitleAlpha =
    `if(lt(t,${subtitleDelay}),0,` +
    `if(lt(t,${subtitleDelay + subtitleFade}),(t-${subtitleDelay})/${subtitleFade},1))`;
  runFfmpeg([
    "-f",
    "lavfi",
    "-i",
    `color=c=${BACKDROP_COLOR}:s=1920x1080:r=25:d=${TITLE_DROP_SECONDS}`,
    "-vf",
    [
      `drawtext=fontfile='${fontPath}':text='${escapeDrawText(title)}'` +
        `:fontsize=110:fontcolor=${ACCENT_COLOR}:borderw=5:bordercolor=black@0.85` +
        `:x=(w-text_w)/2:y='${titleY}'`,
      `drawtext=fontfile='${fontPath}':text='${escapeDrawText(subtitle)}'` +
        `:fontsize=44:fontcolor=${ACCENT_COLOR}@0.9:borderw=3:bordercolor=black@0.8` +
        `:x=(w-text_w)/2:y=(h/2)+25:alpha='${subtitleAlpha}'`,
    ].join(","),
    ...H264_ARGS,
    output,
  ]);
}

/** Le titre de fin : le même, posé en fondu, sans la chute — on ne rejoue pas un gag d'ouverture. */
function renderEndTitle(title: string, subtitle: string, fontPath: string, output: string): void {
  const fadeIn = 0.8;
  const alpha = `if(lt(t,${fadeIn}),t/${fadeIn},1)`;
  runFfmpeg([
    "-f",
    "lavfi",
    "-i",
    `color=c=${BACKDROP_COLOR}:s=1920x1080:r=25:d=${END_TITLE_SECONDS}`,
    "-vf",
    [
      `drawtext=fontfile='${fontPath}':text='${escapeDrawText(title)}'` +
        `:fontsize=110:fontcolor=${ACCENT_COLOR}:borderw=5:bordercolor=black@0.85` +
        `:x=(w-text_w)/2:y=(h/2)-130:alpha='${alpha}'`,
      `drawtext=fontfile='${fontPath}':text='${escapeDrawText(subtitle)}'` +
        `:fontsize=44:fontcolor=${ACCENT_COLOR}@0.9:borderw=3:bordercolor=black@0.8` +
        `:x=(w-text_w)/2:y=(h/2)+25:alpha='${alpha}'`,
    ].join(","),
    ...H264_ARGS,
    output,
  ]);
}

/**
 * L'écran des plateformes : trois colonnes qui DESCENDENT du haut, en décalé.
 *
 * Le décalage (un quart de seconde entre les colonnes) est ce qui fait lire « trois choses », là où une
 * arrivée simultanée se lirait comme un seul bloc. Chaque colonne descend puis s'arrête, comme le titre
 * d'ouverture — le montage garde un seul vocabulaire de mouvement.
 *
 * Le pictogramme est un `overlay` (une image), le texte un `drawtext` : les deux suivent la MÊME
 * expression de position, sinon l'icône et son libellé se désynchronisent pendant la chute.
 */
async function renderPlatforms(title: string, fontPath: string, output: string): Promise<void> {
  const glyphScale = 6;
  const glyphSize = GLYPH_TILE * glyphScale;
  const columnGlyphs: string[][] = [];
  for (const [columnIndex, column] of PLATFORM_COLUMNS.entries()) {
    const paths: string[] = [];
    for (const [glyphIndex, glyph] of column.glyphs.entries()) {
      const path = `${output}.${columnIndex}${glyphIndex}.png`;
      await renderIcon(glyph, glyphScale, path);
      paths.push(path);
    }
    columnGlyphs.push(paths);
  }

  const dropSeconds = 0.7;
  const stagger = 0.25;
  const glyphTop = 400;
  const titleTop = glyphTop + glyphSize + 40;
  const subtitleTop = titleTop + 70;
  /** Position verticale d'un élément de la colonne `index`, chute décalée comprise. */
  const dropY = (target: number, index: number): string => {
    const delay = index * stagger;
    const start = -260;
    return (
      `if(lt(t,${delay}),${start},` +
      `if(lt(t,${delay + dropSeconds}),` +
      `${start}+((t-${delay})/${dropSeconds})*(${target}-(${start})),` +
      `${target}))`
    );
  };

  const inputs: string[] = [
    "-f",
    "lavfi",
    "-i",
    `color=c=${BACKDROP_COLOR}:s=1920x1080:r=25:d=${PLATFORMS_SECONDS}`,
  ];
  for (const paths of columnGlyphs) {
    for (const path of paths) {
      inputs.push("-loop", "1", "-t", String(PLATFORMS_SECONDS), "-i", path);
    }
  }

  const steps: string[] = [];
  let label = "0:v";
  let inputIndex = 1;
  columnGlyphs.forEach((paths, columnIndex) => {
    // Trois colonnes centrées sur les sixièmes de la largeur : 1/6, 3/6, 5/6.
    const columnCenter = (1920 * (2 * columnIndex + 1)) / 6;
    paths.forEach((_, glyphIndex) => {
      const spread =
        paths.length === 1 ? 0 : (glyphIndex - (paths.length - 1) / 2) * (glyphSize + 30);
      const x = Math.round(columnCenter + spread - glyphSize / 2);
      const out = `o${inputIndex}`;
      steps.push(
        `[${label}][${inputIndex}:v]overlay=x=${x}:y='${dropY(glyphTop, columnIndex)}'[${out}]`,
      );
      label = out;
      inputIndex += 1;
    });
  });

  const texts = PLATFORM_COLUMNS.flatMap((column, columnIndex) => {
    const columnCenter = (1920 * (2 * columnIndex + 1)) / 6;
    return [
      `drawtext=fontfile='${fontPath}':text='${escapeDrawText(column.title)}'` +
        `:fontsize=54:fontcolor=${ACCENT_COLOR}:borderw=4:bordercolor=black@0.85` +
        `:x=${columnCenter}-text_w/2:y='${dropY(titleTop, columnIndex)}'`,
      `drawtext=fontfile='${fontPath}':text='${escapeDrawText(column.subtitle)}'` +
        `:fontsize=34:fontcolor=${ACCENT_COLOR}@0.85:borderw=3:bordercolor=black@0.8` +
        `:x=${columnCenter}-text_w/2:y='${dropY(subtitleTop, columnIndex)}'`,
    ];
  });
  const headline =
    `drawtext=fontfile='${fontPath}':text='${escapeDrawText(title)}'` +
    `:fontsize=86:fontcolor=${ACCENT_COLOR}:borderw=5:bordercolor=black@0.85` +
    ":x=(w-text_w)/2:y=170:alpha='if(lt(t,0.5),t/0.5,1)'";
  steps.push(`[${label}]${[headline, ...texts].join(",")}[out]`);

  runFfmpeg([...inputs, "-filter_complex", steps.join(";"), "-map", "[out]", ...H264_ARGS, output]);
}

/** Un plan de jeu : les fenêtres du manifeste comprises dans l'intervalle demandé, recollées. */
function renderClip(video: string, windows: KeptWindow[], output: string): number {
  if (windows.length === 0) {
    throw new Error("plan de jeu sans aucune fenêtre à monter");
  }
  const select = windows
    .map((window) => `between(t,${window.from.toFixed(3)},${window.to.toFixed(3)})`)
    .join("+");
  runFfmpeg([
    "-i",
    video,
    "-vf",
    // `setpts` réécrit les horodatages : sans lui, ffmpeg garde ceux d'origine et le lecteur affiche
    // une vidéo de plusieurs minutes dont l'essentiel est figé.
    `select='${select}',setpts=N/FRAME_RATE/TB`,
    "-an",
    "-r",
    "25",
    ...H264_ARGS,
    output,
  ]);
  return windows.reduce((total, window) => total + (window.to - window.from), 0);
}

/**
 * Enchaîne les parties par `xfade`, deux à deux.
 *
 * ⚠️ `xfade` MANGE la durée du raccord : il superpose la fin de A et le début de B. La durée de sortie
 * vaut donc `offset + durée(B)`, et non la somme des deux. On accumule ici la durée réelle après chaque
 * fusion, au lieu de la recalculer depuis les durées d'origine.
 */
function crossfadeAll(parts: Part[], output: string): void {
  const inputs = parts.flatMap((part) => ["-i", part.path]);
  const steps: string[] = [];
  let label = "0:v";
  let elapsed = parts[0]?.seconds ?? 0;
  for (let index = 1; index < parts.length; index++) {
    const next = parts[index];
    if (!next) {
      continue;
    }
    const offset = Math.max(0, elapsed - TRANSITION_SECONDS);
    const out = index === parts.length - 1 ? "out" : `x${index}`;
    steps.push(
      `[${label}][${index}:v]xfade=transition=${next.transition}` +
        `:duration=${TRANSITION_SECONDS}:offset=${offset.toFixed(3)}[${out}]`,
    );
    label = out;
    elapsed = offset + next.seconds;
  }
  if (steps.length === 0) {
    throw new Error("rien à raccorder : une seule partie");
  }
  runFfmpeg([
    ...inputs,
    "-filter_complex",
    steps.join(";"),
    "-map",
    "[out]",
    "-an",
    ...H264_ARGS,
    output,
  ]);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const offsetMs = numberOption(argv, "offset-ms", DEFAULT_OFFSET_MS);

  const manifest = readManifest();
  const video = findVideo();
  const fontPath = findFont();
  const windows = buildWindows(manifest.beats, offsetMs);

  rmSync(PARTS_DIR, { recursive: true, force: true });
  mkdirSync(PARTS_DIR, { recursive: true });

  const parts: Part[] = [];
  for (const [index, shot] of TIMELINE.entries()) {
    const stem = join(PARTS_DIR, String(index).padStart(2, "0"));
    // Le tout premier raccord est un fondu (le titre s'efface) ; tous les autres pixelisent.
    const transition = index === 1 ? OPENING_TRANSITION : TRANSITION;

    if (shot.kind === "titleDrop") {
      const path = `${stem}-title.mp4`;
      renderTitleDrop(shot.title, shot.subtitle, fontPath, path);
      parts.push({ path, seconds: TITLE_DROP_SECONDS, transition });
      console.log(`titre qui descend : ${TITLE_DROP_SECONDS} s`);
      continue;
    }
    if (shot.kind === "endTitle") {
      const path = `${stem}-end.mp4`;
      renderEndTitle(shot.title, shot.subtitle, fontPath, path);
      parts.push({ path, seconds: END_TITLE_SECONDS, transition });
      console.log(`titre de fin : ${END_TITLE_SECONDS} s`);
      continue;
    }
    if (shot.kind === "platforms") {
      const path = `${stem}-platforms.mp4`;
      await renderPlatforms(shot.title, fontPath, path);
      parts.push({ path, seconds: PLATFORMS_SECONDS, transition });
      console.log(`écran plateformes : ${PLATFORMS_SECONDS} s`);
      continue;
    }
    if (shot.kind === "card") {
      /*
       * Le carton s'appuie sur la première image du plan de jeu QUI SUIT : le décor derrière le texte
       * est déjà celui de la suite, donc le raccord se lit comme un enchaînement, pas comme un collage.
       */
      const next = TIMELINE[index + 1];
      const backdropBeat = shot.backdropBeat ?? (next?.kind === "clip" ? next.fromBeat : undefined);
      if (backdropBeat === undefined) {
        throw new Error(
          `le carton « ${shot.title} » n'a pas de fond : il n'est pas suivi d'un plan de jeu, ` +
            "et aucun `backdropBeat` n'est précisé",
        );
      }
      const path = `${stem}-card.mp4`;
      renderCard(
        video,
        beatStart(manifest.beats, backdropBeat, offsetMs),
        shot.title,
        shot.subtitle,
        fontPath,
        path,
      );
      parts.push({ path, seconds: CARD_SECONDS, transition });
      console.log(`carton « ${shot.title} » : ${CARD_SECONDS} s`);
      continue;
    }

    const from = beatStart(manifest.beats, shot.fromBeat, offsetMs);
    /*
     * La borne haute est la fin du BEAT visé, pas celle de sa fenêtre fusionnée.
     *
     * Les fenêtres fusionnent : celle qui contient « fin du build » couvre aussi tout l'écran suivant,
     * donc s'arrêter à la fin de la fenêtre faisait déborder le plan sur le chapitre d'après —
     * « arrête la séquence quand t'as fini de setup Mewtwo » (retour humain 2026-08-28) n'était pas
     * respecté.
     */
    const to = beatEnd(manifest.beats, shot.toBeat, offsetMs);
    /*
     * Les bornes du plan sont RESSERRÉES sur l'intervalle demandé : une fenêtre fusionnée peut couvrir
     * plus large que les deux beats visés (tout le passage dans les menus tient dans une seule fenêtre
     * de trente secondes), et livrerait alors un plan qui déborde sur le chapitre voisin.
     */
    const clipWindows = windows
      .filter((window) => window.to > from + 0.001 && window.from < to - 0.001)
      .map((window) => ({
        from: Math.max(window.from, from),
        to: Math.min(window.to, to),
        captions: window.captions,
      }));
    const path = `${stem}-play.mp4`;
    const seconds = renderClip(video, clipWindows, path);
    parts.push({ path, seconds, transition });
    console.log(
      `plan « ${shot.fromBeat} → ${shot.toBeat} » : ${clipWindows.length} fenêtres, ` +
        `${seconds.toFixed(1)} s`,
    );
  }

  const output = join(CAPTURE_DIR, "intro-trailer.mp4");
  crossfadeAll(parts, output);
  console.log(`✅ ${output}`);
  console.log(
    `${parts.length} parties, raccords de ${TRANSITION_SECONDS} s. ` +
      `Parties intermédiaires : ${PARTS_DIR}`,
  );
}

main().catch((error: unknown) => {
  // Échec bruyant : un montage à moitié fait ne doit pas passer pour un succès.
  console.error(error);
  process.exit(1);
});
