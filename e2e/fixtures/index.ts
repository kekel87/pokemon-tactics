// Composable test fixtures (extend here as the suite grows — never raw `beforeEach`).
import { test as base, expect, type Page } from "@playwright/test";
import { signallingPort } from "../../playwright.config";
import { CombatScene } from "../pages/CombatScene";
import { CombatMenuOverlay } from "../pages/combat-menu";
import { PlacementPhase } from "../pages/placement";

interface CombatFixtures {
  /**
   * Boot a sandbox battle already past the loader, ready to assert/drive. Pass a config object
   * (see ./sandbox-configs) for a precise state, or nothing for a default seeded battle. Folds
   * the goto + `waitReady()` gate into one call so no test re-implements the boot-and-wait dance.
   */
  bootSandbox: (config?: Record<string, unknown>) => Promise<CombatScene>;
  /** La modale du menu de combat et son bouton `☰` (plan 187) — locators seuls, état mutable nul. */
  combatMenu: CombatMenuOverlay;
  /** La phase de placement interactive (plan 189) — locators + le geste « poser un Pokemon ». */
  placement: PlacementPhase;
}

/**
 * La carte d'une partie créée par le harnais. **Fixe, et c'est une règle dure.**
 *
 * 🔴 Depuis le plan 208, il n'y a plus d'écran de choix du terrain : « Jeu en solo » entre droit dans
 * la sélection d'équipe avec la carte des préférences — et un `localStorage` vierge, ce qu'est tout
 * contexte Playwright neuf, vaut « Aléatoire », donc un TIRAGE PARMI NEUF à chaque exécution.
 *
 * Une douzaine de specs jouaient alors sur un terrain différent d'un run à l'autre : temps de
 * chargement Tiled, zones de spawn traversées en phase de placement, géométrie mesurée en combat.
 * Rien n'échouait, par chance — et une suite nocturne qui rougit un run sur vingt est le pire des
 * états (`.claude/rules/e2e.md`, « un test = un seed fixe »).
 *
 * Le tirage reste couvert, mais par les specs qui le VISENT (`dom/screens.spec.ts`), jamais en
 * arrière-plan de tests qui parlent d'autre chose.
 */
export const DEFAULT_TEST_MAP_ID = "simple-arena";

/**
 * Pose des préférences de jeu avant le boot, en **fusionnant** avec ce qui est déjà là.
 *
 * 🔴 Fusionner, jamais remplacer : les `addInitScript` s'exécutent dans l'ordre d'ajout, donc un test
 * qui écrirait `pt-settings` en entier effacerait le `lastMapId` que la fixture vient de poser — et
 * rendrait sa carte aléatoire sans que rien ne le signale. Tout test qui touche à `pt-settings`
 * passe par ici.
 */
export async function seedSettings(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.addInitScript((incoming: Record<string, unknown>) => {
    let current: Record<string, unknown> = {};
    try {
      const raw = localStorage.getItem("pt-settings");
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
          current = parsed as Record<string, unknown>;
        }
      }
    } catch {
      // Magasin illisible : on repart des défauts, comme le jeu lui-même.
    }
    localStorage.setItem("pt-settings", JSON.stringify({ ...current, ...incoming }));
  }, patch);
}

/**
 * Pose le magasin d'équipes de l'application (`pokemon-tactics:teams`) avant le boot.
 *
 * Le pendant à UN contexte de `OnlineSessionOptions.savedTeams`, qui ne sert que les scénarios à
 * deux navigateurs. L'enveloppe `{ version, teams }` est celle de `packages/app/src/team/
 * team-storage.ts` : un `version` autre que 1 est jeté EN SILENCE, donc le sélecteur s'ouvrirait
 * vide sans le moindre message.
 *
 * 🔴 Une équipe NOMMÉE, plutôt qu'un tirage, dès qu'un test doit prouver que la composition a
 * SURVÉCU à quelque chose : deux équipes aléatoires portent le même nom (« 🎲 Aléatoire »), donc
 * une équipe effacée puis retirée au hasard serait indiscernable de l'équipe d'origine.
 */
export async function seedSavedTeams(
  page: Page,
  storage: Readonly<Record<string, unknown>>,
): Promise<void> {
  await page.addInitScript((payload: string) => {
    localStorage.setItem("pokemon-tactics:teams", payload);
  }, JSON.stringify(storage));
}

export const test = base.extend<CombatFixtures>({
  /*
   * Toute page du harnais démarre avec une CARTE FIXE. Voir `DEFAULT_TEST_MAP_ID` pour le pourquoi.
   * Un test qui veut une autre carte la choisit dans la modale, ou repasse par `seedSettings`.
   */
  page: async ({ page }, use) => {
    await seedSettings(page, { lastMapId: DEFAULT_TEST_MAP_ID });
    await use(page);
  },
  bootSandbox: async ({ page }, use) => {
    const scene = new CombatScene(page);
    await use(async (config) => {
      if (config) {
        await scene.gotoSandboxConfig(config);
      } else {
        await scene.gotoSandbox();
      }
      await scene.waitReady();
      return scene;
    });
  },
  combatMenu: async ({ page }, use) => {
    await use(new CombatMenuOverlay(page));
  },
  placement: async ({ page }, use) => {
    await use(new PlacementPhase(page));
  },
});

export { expect };

/**
 * Chaîne de requête pointant l'annuaire de mise en relation LOCAL, celui que `playwright.config.ts`
 * démarre — jamais le service public de PeerJS.
 *
 * Sans elle, tout écran qui touche au jeu en ligne ferait dépendre la suite d'un tiers sans
 * engagement de service : une panne chez eux rendrait le gate rouge sans qu'une ligne de notre code
 * ait bougé. `peerIce=off` coupe STUN/TURN, propre au harnais (les deux pairs sont sur la boucle
 * locale) et volontairement PAS le défaut de `?peerPort=`, dont un humain qui teste a besoin.
 *
 * Ici plutôt que recopiée dans chaque spec : elle l'était déjà à deux endroits.
 */
export const localSignalling = `?peerPort=${signallingPort}&peerIce=off`;

/**
 * Le pendant de {@link localSignalling} pour le **registre des salons** : un double local, qui évite
 * d'appeler le Worker Cloudflare de production. Voir `room-registry.ts` pour le pourquoi.
 */
export { RoomRegistryStub } from "./room-registry";
