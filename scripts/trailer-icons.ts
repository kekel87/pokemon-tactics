import sharp from "sharp";

/*
 * Pictogrammes pixel art dessinés pour la bande-annonce (plan 194).
 *
 * Pourquoi les dessiner : la planche Kenney du dépôt (`input-prompts-pixel-1-bit`, CC0) n'a **ni
 * silhouette de manette ni téléphone** — trou documenté du pack (`docs/references/kenney-input-prompts-tileset.md`).
 * L'écran des plateformes prenait donc un bouton A pour la manette et une main pour le tactile, ce que
 * l'humain a refusé le 2026-08-28 : « remplace l'icône du gamepad par une manette et le téléphone par
 * un téléphone ».
 *
 * Pourquoi en ASCII dans le code plutôt qu'en `.png` commité : la source de vérité reste **lisible et
 * révisable** en diff, personne n'a à ouvrir un éditeur d'image pour corriger un pixel, et aucun binaire
 * n'entre dans le dépôt. Le rendu se fait au montage.
 *
 * Grille 16×16, comme les tuiles Kenney : les deux familles se côtoient sur le même écran, elles doivent
 * partager la même densité de pixels.
 */

/** `#` = pixel plein, tout le reste = transparent. Seize lignes de seize caractères. */
const ART = {
  /*
   * Manette : silhouette PLEINE, creux évidés (croix directionnelle en plus, deux boutons).
   *
   * Un contour se lit mal à 16 px — la première version ressemblait à un ovale barré. Une silhouette
   * pleine dont on retire les commandes donne du contraste : le corps est blanc, les creux laissent
   * passer le fond sombre, et la forme reste reconnaissable même petite.
   */
  gamepad: [
    "................",
    "................",
    "...##########...",
    "..############..",
    "..############..",
    "..###.####.###..",
    "..##...####.##..",
    "..###.####.###..",
    "..############..",
    "..############..",
    "..############..",
    "..####....####..",
    "...###....###...",
    "................",
    "................",
    "................",
  ],
  /*
   * Téléphone : corps plein, écran évidé. Le creux fait l'écran (il montre le fond sombre), les bandes
   * pleines font les bordures haute et basse. Les deux versions précédentes — cadre creux, puis écran
   * plein — se lisaient l'une comme un rectangle vide, l'autre comme une plaque blanche.
   */
  phone: [
    "................",
    "................",
    "....########....",
    "....########....",
    "....##....##....",
    "....##....##....",
    "....##....##....",
    "....##....##....",
    "....##....##....",
    "....##....##....",
    "....##....##....",
    "....##....##....",
    "....########....",
    "....###..###....",
    "....########....",
    "................",
  ],
} as const;

export type DrawnIcon = keyof typeof ART;

const SIZE = 16;

/**
 * Écrit un pictogramme en PNG, agrandi au plus proche voisin.
 *
 * L'agrandissement se fait ICI et non par un filtre ffmpeg : `sharp` sait produire directement la
 * taille finale sans interpolation (`kernel: "nearest"`), donc le dessin reste net et le graphe de
 * filtres reste court.
 */
export async function writeDrawnIcon(
  icon: DrawnIcon,
  scale: number,
  output: string,
): Promise<void> {
  const art = ART[icon];
  if (art.length !== SIZE || art.some((row) => row.length !== SIZE)) {
    // Une grille mal formée décalerait tout le dessin d'un pixel sans que rien ne le dise.
    throw new Error(`le dessin « ${icon} » n'est pas une grille de ${SIZE}×${SIZE}`);
  }
  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const filled = art[y]?.[x] === "#";
      const offset = (y * SIZE + x) * 4;
      pixels[offset] = 255;
      pixels[offset + 1] = 255;
      pixels[offset + 2] = 255;
      pixels[offset + 3] = filled ? 255 : 0;
    }
  }
  await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 4 } })
    .resize(SIZE * scale, SIZE * scale, { kernel: "nearest" })
    .png()
    .toFile(output);
}
