import { expect, test } from "../../fixtures";
import { BATTLE_LOG_LONG_HISTORY } from "../../fixtures/sandbox-configs";

/**
 * Cahier §4.9 — **le journal garde tout le combat, et ne reprend pas la main au lecteur**
 * (retour humain du 2026-09-16, en partie réelle : « faudrait pouvoir remonter le journal depuis le
 * début du combat »).
 *
 * Deux défauts se tenaient l'un derrière l'autre, d'où deux scénarios :
 *
 * 1. le journal était plafonné à **50 lignes** et DÉTRUISAIT les plus anciennes du DOM — remonter au
 *    début d'un combat un peu long ne montrait pas le début, il n'existait plus ;
 * 2. chaque nouvelle ligne recollait la liste **en bas**, sans condition — donc même en gardant tout,
 *    lire le début pendant que l'adversaire joue restait impossible : la ligne suivante ramenait le
 *    lecteur au pied de la liste. Garder l'historique sans ce second volet ne servait à rien.
 *
 * Aucun budget d'attente en dur : le journal se remplit au rythme des animations, donc tout ce qui
 * est compté converge par `expect.poll`.
 */

/** Sondages du journal : il se remplit ligne à ligne, au rythme des animations de tour. */
const LOG_POLL = { timeout: 15_000, intervals: [150, 250, 400] };

/**
 * Le plafond RETIRÉ. On dépasse 50 lignes pour prouver que plus rien ne coupe : s'arrêter à 50
 * laisserait le test vert avec l'ancien code, qui ne détruisait qu'à partir de la 51ᵉ.
 */
const REMOVED_LOG_CAP = 50;

/** Nombre de tours temporisés pour franchir le plafond. 19 lignes par tour → 4 tours ≈ 76 lignes. */
const ROUNDS_TO_OVERFLOW = 4;

/**
 * Marge sous laquelle on considère la liste « collée en bas », alignée sur celle de `battle-log.ts` :
 * un défilement fractionnaire (densité d'écran) laisse un reliquat inférieur au pixel.
 */
const BOTTOM_STICK_TOLERANCE_PX = 4;

test("§4.9 journal : passé 50 lignes, la PREMIÈRE ligne du combat est toujours là", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(BATTLE_LOG_LONG_HISTORY);
  const entries = page.getByTestId("battle-log-entry");

  // Premier tour temporisé : les six dummies jouent, le journal reçoit ses premières lignes.
  await scene.endTurn();
  await expect(entries.first()).toBeAttached({ timeout: 10_000 });

  /*
   * On épingle le NŒUD, pas son texte.
   *
   * L'ancien code retirait `list.firstElementChild` : compter les lignes ou relire le texte de la
   * tête de liste ne dirait pas si c'est bien la ligne d'origine qui est restée — le journal répète
   * les mêmes phrases d'un tour à l'autre, donc une tête de liste reconstituée aurait le même texte.
   * `elementHandle()` garde une prise sur l'élément lui-même ; `isConnected` répond à la seule
   * question qui compte : a-t-il été arraché du document ?
   */
  const oldestEntry = await entries.first().elementHandle();
  if (!oldestEntry) {
    throw new Error("Le journal n'a produit aucune ligne au premier tour.");
  }
  const oldestText = await oldestEntry.textContent();

  for (let round = 1; round < ROUNDS_TO_OVERFLOW; round++) {
    await scene.endTurn();
  }
  await expect.poll(() => entries.count(), LOG_POLL).toBeGreaterThan(REMOVED_LOG_CAP);

  expect(await oldestEntry.evaluate((node) => node.isConnected)).toBe(true);
  // Et elle est toujours EN TÊTE : rien n'a été retiré devant elle non plus.
  await expect(entries.first()).toHaveText(oldestText ?? "");

  /*
   * Pas d'assertion de VISIBILITÉ sur cette ligne : elle est hors de la zone de défilement de la
   * liste, et `toBeVisible` ne le voit pas (un élément sorti d'un conteneur `overflow` garde une
   * boîte non vide). Ce que l'œil doit confirmer — qu'on la retrouve en remontant — est une case 👁.
   */
});

test("§4.9 journal : une nouvelle ligne ne ramène pas en bas quand on a remonté", async ({
  page,
  bootSandbox,
}) => {
  const scene = await bootSandbox(BATTLE_LOG_LONG_HISTORY);
  const panel = page.getByTestId("battle-log");
  const entries = page.getByTestId("battle-log-entry");

  // Le journal démarre replié : déplié, sa liste est `display: none` et n'a aucune métrique.
  await page.getByTestId("battle-log-toggle").click();
  await expect(panel).toHaveAttribute("data-collapsed", "false");

  // `<ol>` → rôle `list`, le seul du panneau : aucun besoin d'accrocher une classe CSS pour lire
  // les métriques de défilement, que ni un rôle ni un texte ne sauraient exposer.
  const list = panel.getByRole("list");
  const readScroll = (): Promise<{ scrollTop: number; maxScrollTop: number }> =>
    list.evaluate((node) => ({
      scrollTop: node.scrollTop,
      maxScrollTop: node.scrollHeight - node.clientHeight,
    }));

  // Un tour temporisé suffit à faire déborder la liste (19 lignes pour ~9 visibles).
  await scene.endTurn();
  await expect.poll(async () => (await readScroll()).maxScrollTop, LOG_POLL).toBeGreaterThan(0);

  // Le suivi automatique EST conservé tant qu'on n'a pas remonté : c'est la moitié du comportement
  // qu'il ne fallait pas casser en réparant l'autre.
  await expect
    .poll(async () => {
      const { scrollTop, maxScrollTop } = await readScroll();
      return maxScrollTop - scrollTop;
    }, LOG_POLL)
    .toBeLessThanOrEqual(BOTTOM_STICK_TOLERANCE_PX);

  /*
   * On remonte avec la VRAIE touche du jeu (`Maj + Page ↑`, `ScrollLogUp`), pas en posant
   * `scrollTop` : c'est le geste du joueur qui doit être préservé, et le routeur d'entrées ignore
   * l'action pendant une animation (`locked`) — d'où la pression rejouée par le sondage plutôt qu'un
   * appui unique dont le moment serait un pari.
   */
  const bottomScrollTop = (await readScroll()).scrollTop;
  await expect
    .poll(async () => {
      await page.keyboard.press("Shift+PageUp");
      return (await readScroll()).scrollTop;
    }, LOG_POLL)
    .toBeLessThan(bottomScrollTop);
  const parkedScrollTop = (await readScroll()).scrollTop;

  // Le tour d'en face écrit 19 lignes de plus — le moment précis où le joueur se faisait ramener en
  // bas, et celui où il a le plus de temps pour lire.
  const entriesBefore = await entries.count();
  await scene.endTurn();
  await expect.poll(() => entries.count(), LOG_POLL).toBeGreaterThan(entriesBefore);

  expect((await readScroll()).scrollTop).toBe(parkedScrollTop);
});
