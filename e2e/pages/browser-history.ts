import type { Page } from "@playwright/test";

/**
 * Page Object de l'historique du navigateur (plan 205), vu du côté du joueur.
 *
 * Le module n'expose rien : son seul état observable est celui du `History` de la page — une entrée
 * marquée `{ ptBack: true }` (« la sentinelle »), et la LONGUEUR de la pile, qui est ce qui prouve
 * qu'on réarme au lieu d'empiler. D'où un POM réduit à trois lectures et deux gestes.
 */
export class BrowserHistory {
  constructor(private readonly page: Page) {}

  /** Nombre d'entrées dans l'historique de session. Une pile qui GRANDIT à chaque retour est le
   *  défaut que la sentinelle évite : il faudrait alors N retours pour remonter d'un écran. */
  length(): Promise<number> {
    return this.page.evaluate(() => history.length);
  }

  /** L'entrée courante est-elle la sentinelle ? `false` couvre aussi bien « rien d'armé » que
   *  « armé par quelqu'un d'autre » — les deux se lisent pareil du dehors, et pour cause. */
  sentinelArmed(): Promise<boolean> {
    return this.page.evaluate(() => {
      const { state } = history;
      return (
        typeof state === "object" &&
        state !== null &&
        (state as { ptBack?: unknown }).ptBack === true
      );
    });
  }

  /**
   * Le PREMIER geste du joueur, celui qui arme la sentinelle — jamais le démarrage (Chrome fait
   * sauter une entrée empilée sans activation utilisateur).
   *
   * `KeyZ` parce qu'aucune action logique ne lui est liée (`DEFAULT_BINDINGS`) : la frappe prouve
   * l'activation et ne touche à rien d'autre. Un clic arme tout aussi bien — les tests qui en font
   * un de toute façon (naviguer dans les menus, ouvrir le menu de combat) n'ont pas besoin d'appeler
   * ceci.
   */
  async armByPlayerGesture(): Promise<void> {
    await this.page.keyboard.press("KeyZ");
  }

  /** Le geste de retour : bouton précédent, bouton latéral de la souris ou geste du téléphone —
   *  les trois arrivent ici, c'est-à-dire sur une navigation d'historique et rien d'autre. */
  async back(): Promise<void> {
    await this.page.goBack();
  }
}
