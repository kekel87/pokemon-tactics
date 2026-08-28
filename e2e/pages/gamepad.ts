import type { Page } from "@playwright/test";

/**
 * Manette synthétique pour le harnais (extrait de `gamepad-menus.spec.ts` au plan 188, quand un
 * second fichier de tests en a eu besoin).
 *
 * Playwright ne pilote pas de vraie manette, mais `navigator.getGamepads()` est une simple fonction :
 * on la remplace par une manette dont le test pousse les boutons. Ça ne teste pas le matériel — ça
 * teste toute la chaîne qui vient après lui (poller → routeur → contrôle focalisé → DOM), c'est-à-dire
 * exactement ce qui casse.
 */

/** Index logiques de la disposition standard, tels que `gamepad-source.ts` les lit. */
export const PadButton = {
  A: 0,
  B: 1,
  /*
   * Bumpers et gâchettes : les index du mapping standard W3C, tels que `DEFAULT_BINDINGS`
   * (`packages/app/src/input/bindings-store.ts`) les assigne — rotation de caméra d'un quart de tour
   * (LB/RB), zoom d'un cran (LT/RT). Ajoutés au plan 194 : la séquence d'intro filme la rotation, qui
   * n'existe que sur les bumpers. X, Y, Select et Start ne sont pas listés : personne ne les presse.
   */
  LeftBumper: 4,
  RightBumper: 5,
  LeftTrigger: 6,
  RightTrigger: 7,
  DpadUp: 12,
  DpadDown: 13,
  DpadLeft: 14,
  DpadRight: 15,
} as const;

interface FakePad {
  buttons: { pressed: boolean; value: number }[];
}

/**
 * Installe la manette synthétique, contrôlable depuis la page via `__pad__`.
 *
 * `mapping: ""` est la réponse de **Firefox** pour une manette absente de sa table interne — Switch
 * Pro comprise (Bugzilla #952773). Les deux valeurs doivent se comporter pareil, d'où le paramètre.
 */
export async function withFakeGamepad(page: Page, mapping = "standard"): Promise<void> {
  await page.addInitScript((padMapping: string) => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    const fake = {
      index: 0,
      // Identifiant NEUTRE : un `057e` (Nintendo) déclencherait l'échange bas↔droite et un appui sur
      // l'index 2 s'enregistrerait en index logique 3. Cet échange a ses propres tests unitaires.
      id: "Xbox Wireless Controller (Vendor: 045e)",
      mapping: padMapping,
      buttons,
      axes: [0, 0, 0, 0],
      connected: true,
    };
    (globalThis as unknown as { __pad__: typeof fake }).__pad__ = fake;
    navigator.getGamepads = () => [fake] as unknown as ReturnType<Navigator["getGamepads"]>;
    globalThis.addEventListener("load", () =>
      globalThis.dispatchEvent(new Event("gamepadconnected")),
    );
  }, mapping);
}

/**
 * Émet `gamepadconnected` MAINTENANT, ce qui démarre le poller de l'app.
 *
 * `withFakeGamepad` l'émet aussi sur `load`, mais c'est une course : son écouteur est enregistré
 * avant tout script de page, donc il peut tirer avant que l'`InputSystem` n'ait posé le sien — et
 * alors le poller ne démarre jamais. À appeler après avoir atteint l'écran voulu : c'est idempotent
 * (`startGamepadPolling` ignore une seconde connexion).
 */
export async function connectPad(page: Page): Promise<void> {
  await page.evaluate(() => globalThis.dispatchEvent(new Event("gamepadconnected")));
  await waitForPadPoll(page);
}

/** Maintient un bouton. Le poller détecte le front au tour suivant. */
export async function pressPadButton(page: Page, index: number): Promise<void> {
  await page.evaluate((button: number) => {
    const pad = (globalThis as unknown as { __pad__: FakePad }).__pad__;
    const target = pad.buttons[button];
    if (target) {
      target.pressed = true;
    }
  }, index);
}

/** Relâche un bouton. */
export async function releasePadButton(page: Page, index: number): Promise<void> {
  await page.evaluate((button: number) => {
    const pad = (globalThis as unknown as { __pad__: FakePad }).__pad__;
    const target = pad.buttons[button];
    if (target) {
      target.pressed = false;
    }
  }, index);
}

/**
 * Une pression franche : appui puis relâchement.
 *
 * Indispensable dès qu'on presse DEUX FOIS la même direction — le poller ne réémet un front que
 * lorsque le bouton est repassé par l'état relâché, sinon le second appui n'est qu'une continuation
 * du premier (et n'arrive qu'après le délai de répétition).
 */
export async function tapPadButton(page: Page, index: number): Promise<void> {
  await pressPadButton(page, index);
  await waitForPadPoll(page);
  await releasePadButton(page, index);
  await waitForPadPoll(page);
}

/**
 * Laisse passer un tour de `requestAnimationFrame`, celui où le poller lit la manette.
 *
 * Deux frames plutôt qu'une : le front est détecté sur la frame qui suit le changement d'état, et son
 * effet (focus déplacé, valeur du slider) n'est observable qu'après. Ce n'est pas un délai fixe — la
 * règle e2e bannit `waitForTimeout` — mais l'attente du signal réel de la boucle de rendu.
 */
export async function waitForPadPoll(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

/**
 * MAINTIENT un bouton jusqu'à ce que `settled` soit vrai, puis le relâche.
 *
 * Maintenir, et non taper : le poller lit la manette dans un `requestAnimationFrame`, et un écran
 * sans boucle de rendu Babylon (le Team Builder, les menus) voit ses frames fortement ralenties par
 * le navigateur. Une pression brève tombait alors ENTRE deux lectures — le bouton n'était jamais vu
 * pressé, et l'action n'existait pas. Un bouton tenu finit toujours par être lu.
 *
 * Ne pas remplacer par une attente de N frames : la cadence n'est pas garantie, et `waitForTimeout`
 * est banni. On attend l'EFFET.
 */
export async function holdPadUntil(
  page: Page,
  index: number,
  settled: () => Promise<boolean>,
  attempts = 60,
): Promise<void> {
  await pressPadButton(page, index);
  try {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (await settled()) {
        return;
      }
      await waitForPadPoll(page);
    }
    throw new Error(`le bouton ${index}, maintenu, n'a produit aucun effet en ${attempts} frames`);
  } finally {
    // Toujours relâcher, même en échec : un bouton resté pressé ferait répéter l'action et
    // contaminerait l'assertion suivante.
    await releasePadButton(page, index);
    await waitForPadPoll(page);
  }
}

/** `data-testid` du contrôle qui a le focus, ou `null`. */
export function focusedTestId(page: Page): Promise<string | null> {
  return page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.dataset?.testid ?? null,
  );
}

/**
 * Valeur d'un `data-*` du contrôle focalisé (`name` en camelCase, tel que `dataset` l'expose).
 *
 * Complète {@link focusedTestId} là où le `testid` ne suffit pas : dans une FAMILLE de contrôles
 * homonymes (les segments de format, les cartes de camp), c'est l'attribut d'identité qui dit
 * *lequel* des frères porte le liseré.
 */
export function focusedDataValue(page: Page, name: string): Promise<string | null> {
  return page.evaluate(
    (key) => (document.activeElement as HTMLElement | null)?.dataset?.[key] ?? null,
    name,
  );
}

/** Nom de balise du contrôle focalisé — pour distinguer un champ texte d'un bouton. */
export function focusedTagName(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.tagName ?? null);
}
