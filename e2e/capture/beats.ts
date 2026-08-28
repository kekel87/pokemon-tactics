import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "@playwright/test";

/*
 * Beats de la séquence d'intro (plan 194).
 *
 * Un « beat » = un instant nommé de la séquence. Il sert deux sorties d'un coup :
 * - une **capture** fichier, réutilisable pour le README, le wiki et le devlog
 * - un **repère temporel** dans la vidéo, que le montage ffmpeg utilise pour découper et poser un
 *   carton de texte au bon endroit
 *
 * Les repères sont écrits dans un manifeste JSON à la fin du run : sans lui, il faudrait retrouver
 * les instants à l'œil dans la vidéo, ce qui rendrait le montage non reproductible.
 */

export const CAPTURE_DIR = ".screenshots/intro";

export interface Beat {
  /** Ordre + nom de fichier : `01-editeur-equipe.png`. */
  readonly slug: string;
  /** Texte du carton, tel qu'il apparaîtra à l'écran. Vide = pas de carton sur ce beat. */
  readonly caption: string;
  /** Millisecondes depuis le début de l'enregistrement. */
  readonly atMs: number;
  /**
   * Durée de la pause de cadence qui PRÉCÈDE immédiatement ce beat, en millisecondes.
   *
   * Sans elle, le montage se trompe de côté : un beat est horodaté au moment de la CAPTURE, donc à la
   * FIN de la pause — l'état qu'il nomme (le journal ouvert, l'infobulle affichée) occupe l'intervalle
   * qui le précède, et la séquence le referme juste après. Une fenêtre centrée sur le beat filmait
   * donc surtout l'écran d'après, carton compris. Mesuré sur la première vidéo montée.
   */
  readonly leadMs: number;
}

/**
 * Vide le dossier de sortie avant un run.
 *
 * Sans ça, un run qui change la numérotation laisse les fichiers du précédent : on se retrouve avec
 * `08-selection-equipe.png` (ancien) à côté de `12-selection-equipe.png` (nouveau), et le manifeste
 * ne décrit plus le contenu du dossier. La reproductibilité promise tombe.
 */
export async function resetCaptureDir(): Promise<void> {
  await rm(CAPTURE_DIR, { recursive: true, force: true });
  await mkdir(CAPTURE_DIR, { recursive: true });
}

/**
 * Enregistreur de beats : prend la capture et note l'instant, pour que le montage n'ait rien à deviner.
 *
 * `startedAt` est passé par l'appelant plutôt que lu ici : c'est l'instant où l'enregistrement vidéo
 * commence, et lui seul sert de zéro commun aux deux sorties.
 */
export class BeatRecorder {
  private readonly beats: Beat[] = [];
  private index = 0;
  /** Pause accumulée depuis le beat précédent — remise à zéro à chaque capture. */
  private pendingHoldMs = 0;
  /** Repère posé par {@link mark}, pour les beats dont l'état commence avant leur pause. */
  private markedAt: number | null = null;

  constructor(
    private readonly page: Page,
    private readonly startedAt: number,
  ) {}

  /**
   * Repère un instant : le prochain beat qui le demande couvrira **tout l'intervalle depuis ce repère**.
   *
   * Nécessaire dès qu'une action ANIME quelque chose avant la pause de cadence. Cas mesuré : le
   * déplacement d'un Pokemon. La fonction qui le pilote attend le retour du menu d'actions — donc la fin
   * du glissé — avant de rendre la main, et la pause ne démarre qu'après. Le montage, calé sur la
   * pause, ne filmait donc que l'APRÈS : « on ne voit pas les déplacements » (retour humain 2026-08-28).
   */
  mark(): void {
    this.markedAt = Date.now();
  }

  async capture(slug: string, caption = "", options: { sinceMark?: boolean } = {}): Promise<void> {
    this.index += 1;
    const numbered = `${String(this.index).padStart(2, "0")}-${slug}`;
    await mkdir(CAPTURE_DIR, { recursive: true });
    await this.page.screenshot({ path: join(CAPTURE_DIR, `${numbered}.png`) });
    const now = Date.now();
    const leadMs =
      options.sinceMark === true && this.markedAt !== null
        ? now - this.markedAt
        : this.pendingHoldMs;
    this.beats.push({ slug: numbered, caption, atMs: now - this.startedAt, leadMs });
    this.pendingHoldMs = 0;
    this.markedAt = null;
  }

  /**
   * Tient l'image un instant, pour la CADENCE de la vidéo — une bande-annonce qui enchaîne sans
   * respiration est illisible.
   *
   * ⚠️ `.claude/rules/e2e.md` bannit `waitForTimeout`, et à raison : dans un test, une attente fixe
   * masque une condition qu'on n'a pas su exprimer, et produit du flaky. Ici le raisonnement ne
   * s'applique pas — **aucune assertion ne dépend de cette pause**. La durée n'attend rien : elle
   * EST le livrable, comme la durée d'un plan au montage. Les vraies attentes de disponibilité, elles,
   * passent par `expect(...).toBeVisible()` dans le pilote.
   */
  async holdForPacing(ms: number): Promise<void> {
    this.pendingHoldMs += ms;
    await this.page.waitForTimeout(ms);
  }

  manifest(): readonly Beat[] {
    return this.beats;
  }
}
