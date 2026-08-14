import { expect, type Page } from "@playwright/test";
import type { CombatScene } from "./CombatScene";
import { CursorPanel, InfoPanel } from "./combatHud";

const HP_POLL = { timeout: 10_000, intervals: [150, 250, 400] };

/**
 * La carte d'info affichant `name`, ou null.
 *
 * Depuis le plan 175 il y a DEUX cartes bâties sur le même composant : le panneau gauche montre le
 * Pokemon ACTIF (et lui seul), la carte curseur montre celui sous le curseur. Un survol déplace donc
 * la lecture d'une carte à l'autre selon que le mon visé est l'actif ou non — un test qui pilote
 * `hoverTile` demande la carte par son CONTENU plutôt que de parier sur un emplacement. La carte doit
 * être VISIBLE : la carte curseur masquée garde son dernier contenu, qui mentirait sinon.
 */
export async function cardShowing(page: Page, name: string): Promise<InfoPanel | null> {
  for (const card of [new InfoPanel(page), new CursorPanel(page)]) {
    if ((await card.panel.isVisible()) && (await card.name.textContent()) === name) {
      return card;
    }
  }
  return null;
}

/** Survole (x,y) jusqu'à ce qu'une carte d'info reflète `name`, et rend cette carte. Le survol est
 *  CONTINU dans le jeu réel (pointermove répété) → on re-survole à chaque itération du poll, sans
 *  course avec un re-render du HUD. */
export async function hoverCard(
  scene: CombatScene,
  page: Page,
  x: number,
  y: number,
  name: string,
): Promise<InfoPanel> {
  await expect
    .poll(async () => {
      await scene.hoverTile(x, y);
      return (await cardShowing(page, name)) !== null;
    }, HP_POLL)
    .toBe(true);
  const card = await cardShowing(page, name);
  if (!card) {
    throw new Error(`Aucune carte d'info n'affiche « ${name} »`);
  }
  return card;
}

/** Nom FR et PV du Pokemon ACTIF, lus sur le panneau d'info gauche — qui ne reflète que lui depuis le
 *  plan 175, donc SANS survol : la lecture est stable dès que la main est au joueur. Utile pour
 *  comparer un état de combat à lui-même de part et d'autre d'un rechargement (§6.11 reprise). */
export async function readActivePokemon(
  page: Page,
): Promise<{ name: string; hp: string; maxHp: string }> {
  const panel = new InfoPanel(page);
  await expect(panel.panel).toBeVisible();
  return {
    name: (await panel.name.textContent()) ?? "",
    hp: (await panel.hpBar.getAttribute("aria-valuenow")) ?? "",
    maxHp: (await panel.hpBar.getAttribute("aria-valuemax")) ?? "",
  };
}

/** Nombre d'occurrences de `badgeMatcher` (badge volatile, statut, aura…) sur la carte d'info qui
 *  montre `name` après un survol de la tuile — `-1` tant qu'aucune carte ne le montre, pour que le
 *  poll appelant réessaie au lieu de conclure « 0 badge » sur une carte qui n'est pas la bonne.
 *  On compte des ÉLÉMENTS DE LISTE (`role=listitem`) et non n'importe quel nœud portant le texte :
 *  quand le mon n'a qu'un badge, la liste `<ul>` qui le contient porte exactement le même texte que
 *  le badge et serait comptée deux fois. */
export async function badgeCountOnHover(
  scene: CombatScene,
  page: Page,
  tile: { x: number; y: number },
  expectedName: string,
  badgeMatcher: string | RegExp,
): Promise<number> {
  await scene.hoverTile(tile.x, tile.y);
  const card = await cardShowing(page, expectedName);
  return card ? card.panel.getByRole("listitem").filter({ hasText: badgeMatcher }).count() : -1;
}

/** Survole la tuile (x,y) jusqu'à ce qu'une carte d'info reflète `name`, puis lit sa barre de vie
 *  (`role="progressbar"`) via le POM. Le panneau est stable une fois le tour posé → lecture sans race.
 *  Les dégâts de terrain/chute n'étant pas journalisés, c'est le seul signal e2e de PV chiffrés. */
export async function readHp(
  scene: CombatScene,
  page: Page,
  x: number,
  y: number,
  name: string,
): Promise<{ now: number; max: number }> {
  const card = await hoverCard(scene, page, x, y, name);
  const now = Number(await card.hpBar.getAttribute("aria-valuenow"));
  const max = Number(await card.hpBar.getAttribute("aria-valuemax"));
  return { now, max };
}
