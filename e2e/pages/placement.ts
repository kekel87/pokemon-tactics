import type { Locator, Page } from "@playwright/test";
import type { CombatScene } from "./CombatScene";

/**
 * Page Object de la phase de placement interactive (`placement-flow.ts`).
 *
 * ⚠️ **Cette phase n'existe à l'écran que si « Placement auto » est DÉCOCHÉ** à la sélection
 * d'équipe : cochée par défaut, l'option pose toute l'équipe d'un coup puis enchaîne sur le combat,
 * si vite qu'aucun locator ne la voit passer. C'est le piège de tout test qui vise cette phase —
 * et la raison pour laquelle le trou du plan 187 (aucune sortie pendant le placement) a survécu si
 * longtemps sans être remarqué.
 *
 * Le roster est visé par son TEXTE (titre, compteur, bouton) et non par des testids : ses portraits
 * sont des boutons à `alt=""`, donc sans nom accessible, et personne n'a eu besoin de les cliquer —
 * {@link placeNext} passe par le curseur clavier, qui est de toute façon le chemin que le joueur
 * emprunte au clavier comme à la manette.
 */
export class PlacementPhase {
  /** Titre du roster (`placement.instruction`) — le signal « la phase interactive est montée ». */
  readonly instruction: Locator;
  /** Compteur `Placés : n/max` — le seul témoin DOM qu'un placement a été fait ou défait. */
  readonly counter: Locator;
  /** « ✓ Terminer », proposé dès qu'au moins un Pokemon est posé. */
  readonly finish: Locator;

  constructor(private readonly page: Page) {
    this.instruction = page.getByRole("heading", { name: /Placez un Pokemon/ });
    this.counter = page.getByText(/^Placés : /);
    this.finish = page.getByRole("button", { name: "✓ Terminer" });
  }

  /**
   * Pose le Pokemon présélectionné sur la case que le flux propose.
   *
   * Trois temps, ceux du joueur (décision #788) : *Confirmer* quitte le roster et sème le curseur
   * sur une case libre de la zone — c'est lui qui donne la case, aucun test n'a donc à connaître la
   * géométrie des zones d'apparition de la carte — puis la case est posée, puis l'orientation
   * confirmée.
   */
  async placeNext(scene: CombatScene): Promise<void> {
    await this.page.keyboard.press("Space");
    const tile = await scene.cursorTile();
    if (tile === null) {
      throw new Error("le flux de placement n'a semé aucun curseur dans la zone d'apparition");
    }
    await scene.clickTile(tile.x, tile.y);
    await scene.confirmDirection();
  }
}
