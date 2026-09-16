import type { Locator } from "@playwright/test";
import { expect, test } from "../../fixtures";
import { manhattan, type Tile } from "../../pages/grid";
import {
  DUEL_ATTACKER_TEAM_ID,
  DUEL_DEFENDER_TEAM_ID,
  DUEL_TEAM_STORAGE,
} from "../../pages/online-duel";
import type { OnlinePeer } from "../../pages/online-session";
import { OnlineSession } from "../../pages/online-session";

/*
 * Cahier §11.21 — VOIR où le Pokemon d'en face peut aller, pendant qu'il joue (2026-09-16, première
 * partie en ligne réelle).
 *
 * 🔴 Ce que ce scénario garde : pendant un tour DISTANT, le pair qui attend peut survoler le Pokemon
 * qui joue et lire ses cases de déplacement atteignables, peintes en surbrillance « ennemie ». Il ne
 * voyait RIEN auparavant, et il ne pouvait pas non plus aller le chercher : la phase
 * `waiting_remote` était exclue des phases de planification de `updateEnemyRangeHover`, et une garde
 * supplémentaire refusait de peindre le Pokemon ACTIF — c'est-à-dire, pendant un tour distant,
 * exactement le seul qu'on ait à montrer.
 *
 * Purement local : rien ne transite sur le réseau, le pair interroge l'état déterministe qu'il
 * possède déjà. La portée d'ATTAQUE, elle, reste cachée — « déplacement seulement », arbitré par
 * l'humain le 2026-09-16, l'effet de surprise fait partie du jeu.
 *
 * 🔴 **Deux VRAIS pairs, et c'est inévitable — même raison qu'à §11.17.** Le raccourci de la famille
 * (`launchAlone`, un hôte seul qui dresse la place libre en IA) ne produit PAS ce contexte : le tour
 * d'une IA passe par `animating` chez les deux pairs, phase où le survol est gelé et où la portée
 * est justement effacée. Seul un tour attendu SUR LE RÉSEAU entre en `waiting_remote`.
 *
 * ⚠️ Deux profils de navigateur, jamais deux onglets d'un même profil (recette du plan 202) : la
 * sauvegarde de reprise tient dans une seule clé. `OnlineSession` fournit les deux contextes.
 *
 * Ce qui reste couvert en UNITAIRE et n'est pas redoublé ici (`battle-orchestrator.test.ts`,
 * describe « BattleOrchestrator — tour distant ») : l'extinction de la portée à l'entrée en phase
 * `animating`. Elle n'a pas de signal e2e propre — `afterActionAccepted` appelle `clearHighlights()`
 * dans la foulée, donc les cases disparaissent de la scène avec ou sans le correctif, et seul le
 * bookkeeping interne les distingue.
 */

/*
 * Même budget que le reste de la famille : deux contextes, une négociation WebRTC, deux boots
 * Babylon complets. Le scénario ne joue AUCUN tour — il tient dans la fenêtre du premier.
 */
test.setTimeout(240_000);

/**
 * Les équipes du pilote de duel : **un seul Pokemon par camp, deux espèces distinctes**.
 *
 * Réemployées ici pour ce qu'elles garantissent, pas pour le duel qu'elles savent mener : le hook de
 * scène nomme les sprites par leur ESPÈCE, donc deux équipes tirées au hasard pourraient poser la
 * même espèce des deux côtés et rendre « quel sprite est le sien ? » indécidable. Avec un Pokemon
 * par camp, le plateau ne porte que deux sprites et l'un est forcément celui d'en face.
 */
const DUEL_TEAMS = {
  savedTeams: DUEL_TEAM_STORAGE,
  hostTeamId: DUEL_ATTACKER_TEAM_ID,
  guestTeamId: DUEL_DEFENDER_TEAM_ID,
} as const;

/** Le menu d'actions du tour — démonté chez qui regarde (`chrome.hideMenus()`). */
function actionMenuEntry(peer: OnlinePeer): Locator {
  return peer.page.getByRole("button", { name: "Déplacement", exact: true });
}

/**
 * Le portrait épinglé en tête de la frise des tours : le Pokemon qui JOUE, vu de ce pair.
 *
 * C'est lui qui donne l'espèce active, et il la donne sans rien supposer du camp : le scénario ne
 * sait pas d'avance qui de l'hôte ou de l'invité ouvre le combat — l'ordre dépend de la Vitesse.
 */
function activePortrait(peer: OnlinePeer): Locator {
  return peer.page
    .getByTestId("timeline-entry")
    .and(peer.page.locator('[data-active="true"]'))
    .getByTestId("timeline-portrait");
}

/** Les deux cases qui comptent, vues du pair qui REGARDE : celle du Pokemon qui joue, et la sienne. */
async function watchedTiles(observer: OnlinePeer): Promise<{ acting: Tile; own: Tile }> {
  await expect(activePortrait(observer)).toHaveAttribute("data-pokemon-id", /.+/);
  const activeSpecies = await activePortrait(observer).getAttribute("data-pokemon-id");
  const sprites = await observer.scene.spriteStates();
  const acting = sprites.find((sprite) => sprite.pokemonId === activeSpecies);
  const own = sprites.find((sprite) => sprite.pokemonId !== activeSpecies);
  if (acting === undefined || own === undefined) {
    throw new Error(
      `le plateau ne montre pas les deux combattants (actif « ${activeSpecies} », sprites : ` +
        `${sprites.map((sprite) => sprite.pokemonId).join(", ") || "aucun"})`,
    );
  }
  return { acting: acting.tile, own: own.tile };
}

/** Les cases peintes en surbrillance « ennemie » sur la scène de ce pair (`highlight_enemy_range_x_y`). */
async function paintedRange(peer: OnlinePeer): Promise<Tile[]> {
  const names = await peer.scene.meshNamesStartingWith("highlight_enemy_range_");
  const tiles: Tile[] = [];
  for (const name of names) {
    const parsed = /^highlight_enemy_range_(\d+)_(\d+)$/.exec(name);
    if (parsed !== null) {
      tiles.push({ x: Number(parsed[1]), y: Number(parsed[2]) });
    }
  }
  return tiles;
}

/** Combien de cases sont peintes — la forme attendue par `expect.poll`. */
function paintedCount(peer: OnlinePeer): Promise<number> {
  return paintedRange(peer).then((tiles) => tiles.length);
}

test("§11.21 en ligne : pendant le tour d'en face, survoler le Pokemon qui joue montre ses cases de déplacement", async ({
  browser,
}) => {
  const session = await OnlineSession.open(browser, DUEL_TEAMS);

  try {
    await session.startBattle();
    const { observer } = await session.peerWithHand();

    /*
     * On est bien du côté qui REGARDE, et c'est dit par ce que le joueur voit : « Attendre » n'existe
     * que du côté qui joue, et le menu d'actions est démonté. Sans ce relevé, un test qui se
     * tromperait de pair prouverait seulement que la portée se peint pendant SON propre tour — ce qui
     * marchait déjà.
     */
    await expect(observer.wait).toHaveCount(0);
    await expect(actionMenuEntry(observer)).toHaveCount(0);

    const { acting, own } = await watchedTiles(observer);

    // Rien n'est peint tant que rien n'est survolé : la portée est une INFORMATION DEMANDÉE, pas un
    // décor permanent. Sans ce relevé, une surbrillance restée d'une phase précédente ferait passer
    // la suite au vert sans qu'aucun survol n'ait rien produit.
    expect(await paintedRange(observer)).toEqual([]);

    // — L'assertion du correctif ——————————————————————————————————————————————————————————————————
    await observer.scene.hoverTile(acting.x, acting.y);
    // Avant le correctif, ce compte restait à ZÉRO pour toujours : `waiting_remote` n'était pas une
    // phase de planification, et le Pokemon actif était exclu par-dessus le marché.
    await expect.poll(() => paintedCount(observer)).toBeGreaterThan(0);

    /*
     * Et ce sont bien SES cases : l'ensemble atteignable se calcule de proche en proche depuis la
     * case du Pokemon, donc s'il n'est pas vide il contient forcément une case adjacente — le premier
     * pas de n'importe quel chemin. Une portée peinte autour de quelqu'un d'autre (le Pokemon du
     * spectateur, par exemple) ne satisferait pas cette distance de 1.
     */
    const painted = await paintedRange(observer);
    expect(Math.min(...painted.map((tile) => manhattan(tile, acting)))).toBe(1);

    // — Le revers : la portée s'éteint, et elle ne montre JAMAIS son propre camp ————————————————————
    /*
     * Survoler son propre Pokemon n'apprend rien au spectateur — ses cases à lui sont peintes par le
     * menu « Déplacement » quand son tour vient. La garde porte donc sur le SPECTATEUR, et pas sur
     * celui qui agit : sans elle, un correctif trop large peindrait les deux camps indifféremment.
     */
    await observer.scene.hoverTile(own.x, own.y);
    await expect.poll(() => paintedCount(observer)).toBe(0);

    /*
     * Et on peut y revenir : la portée se repeint au second survol du même Pokemon. Ce n'est pas une
     * redite du premier survol — le rendu court-circuite le repaint quand le Pokemon survolé est déjà
     * celui qui est peint, donc un effacement qui oublierait de retenir qu'il n'y a plus rien de
     * peint laisserait le plateau vide pour le reste du tour.
     */
    await observer.scene.hoverTile(acting.x, acting.y);
    await expect.poll(() => paintedCount(observer)).toBeGreaterThan(0);

    /*
     * 🔴 La main n'a jamais changé de camp pendant tout ça — sans quoi rien de ce qui précède ne
     * parlerait d'un tour DISTANT. Le tour d'en face dure 60 s (`ONLINE_TURN_DURATION_MS`) et
     * personne n'a joué depuis le début du scénario.
     */
    await expect(observer.wait).toHaveCount(0);
    await expect(actionMenuEntry(observer)).toHaveCount(0);
  } finally {
    await session.close();
  }
});
