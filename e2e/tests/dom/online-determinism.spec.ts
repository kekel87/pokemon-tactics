import type { BrowserContext } from "@playwright/test";
import { expect, test } from "../../fixtures";
import {
  DUEL_ATTACKER_TEAM_ID,
  DUEL_DEFENDER_TEAM_ID,
  DUEL_TEAM_STORAGE,
  OnlineDuel,
} from "../../pages/online-duel";
import { OnlineSession } from "../../pages/online-session";

/*
 * Cahier §11 — détection de désynchronisation (plan 203, Lot B4). Trois scénarios : deux parties
 * honnêtes où **rien** ne doit se déclencher, et une divergence **provoquée** où tout doit se
 * déclencher.
 *
 * 🔴 **Le risque dominant du lot est le FAUX POSITIF**, d'où deux assertions négatives : une
 * empreinte qui diverge sur une partie honnête met fin à un vrai combat par un message que le joueur
 * ne peut ni comprendre ni contester — pire que pas de détecteur du tout. §11.6 et §11.7 couvrent les
 * deux chemins où une empreinte pourrait se mettre à différer sans faute : un combat mené jusqu'à son
 * terme, K.O. compris, et un combat dont un pair a reconstruit son état par rejeu.
 *
 * 🔴 **Et une assertion négative ne vaut rien sans son symétrique**, ce qui n'est pas une précaution
 * de style : le passe-plat `stateChecksum` manquait dans `runBattle`, donc le détecteur était
 * **inerte dans l'application** — aucune empreinte ne quittait l'orchestrateur, et les deux scénarios
 * honnêtes passaient au vert en ne prouvant rien. Les 55 tests unitaires du lot ne le voyaient pas
 * non plus. C'est §11.8 qui l'a fait tomber, et c'est lui qui empêche le trou de se rouvrir.
 *
 * **Comment §11.8 provoque la divergence — sans toucher au code de production.** On détourne ce que
 * le navigateur de l'INVITÉ télécharge (`context.route`) pour lui servir une carte dont **une case**
 * diffère. Son moteur construit alors un état légitimement différent : c'est une divergence VRAIE,
 * pas une empreinte truquée. C'est aussi, mot pour mot, le cas que la sérialisation inclut toute la
 * grille pour attraper (« une carte chargée différemment »). Truquer l'empreinte émise, à l'inverse,
 * demanderait de modifier `packages/` : à ne jamais faire, même une minute — committé, ce sabotage
 * déclarerait une divergence sur chaque partie honnête, soit exactement la catastrophe que ce lot
 * existe pour éviter.
 *
 * ⚠️ **Deux profils de navigateur, jamais deux onglets d'un même profil** (recette du plan 202) : la
 * sauvegarde de reprise tient dans une seule clé, donc deux onglets d'un même profil s'y écrasent et
 * un onglet rouvert peut reprendre l'identité de l'autre. `OnlineSession` fournit les deux contextes.
 */

/*
 * Même budget que `online-resilience.spec.ts`, pour les mêmes raisons cumulées : deux contextes de
 * navigateur, une négociation WebRTC, deux (ou cinq) boots Babylon complets, et — pour le second
 * scénario — un délai de grâce réellement écoulé. Le duel lui-même est court : trois ou quatre
 * actions suffisent à conclure (voir `OnlineDuel`).
 */
test.setTimeout(240_000);

test("§11.6 en ligne : un duel honnête va jusqu'à la victoire sans qu'aucune empreinte ne diverge", async ({
  browser,
}) => {
  const session = await OnlineSession.open(browser, {
    savedTeams: DUEL_TEAM_STORAGE,
    hostTeamId: DUEL_ATTACKER_TEAM_ID,
    guestTeamId: DUEL_DEFENDER_TEAM_ID,
  });
  const duel = new OnlineDuel(session);

  try {
    await session.startBattle();

    /*
     * Le combat entier, joué des deux côtés : rapprochements par Téléport puis le coup qui conclut.
     * Chaque action complétée fait diffuser une empreinte de part et d'autre (cadence 1 action), et
     * une seule qui différerait terminerait la partie sur un forfait — ce que les assertions
     * ci-dessous refusent.
     */
    await duel.fightToKnockOut();

    // La partie s'est finie par un K.O., pas par un forfait — et les DEUX pairs disent la même
    // chose. C'est le K.O. qui compte le plus ici : `handleKo` remet une vingtaine de champs à
    // `undefined` au lieu de les supprimer, et confondre les deux est précisément ce que la
    // sérialisation canonique doit faire.
    for (const peer of [duel.attacker, duel.defender]) {
      await expect(peer.victory).toBeVisible({ timeout: 30_000 });
      await expect(peer.victory.getByRole("heading")).toHaveText("Joueur 1 gagne !");
      await expect(peer.logEntries.filter({ hasText: "Abra est K.O." })).toHaveCount(1);
    }

    /*
     * 🔴 L'assertion du lot : aucun constat de divergence, ni chez l'un ni chez l'autre.
     *
     * Doublée par « personne n'a quitté la partie » : la ligne de divergence est une déclinaison du
     * forfait, donc un forfait pour une AUTRE raison (trois refus d'action, absence) signalerait tout
     * autant que les deux moteurs se sont séparés — et il faut qu'il échoue aussi.
     */
    for (const peer of [duel.attacker, duel.defender]) {
      await expect(peer.divergence).toHaveCount(0);
      await expect(peer.logEntries.filter({ hasText: "quitte la partie" })).toHaveCount(0);
    }
  } finally {
    await session.close();
  }
});

test("§11.7 en ligne : un pair qui reconstruit son état par rejeu ne diverge pas pour autant", async ({
  browser,
}) => {
  const session = await OnlineSession.open(browser, {
    savedTeams: DUEL_TEAM_STORAGE,
    hostTeamId: DUEL_ATTACKER_TEAM_ID,
    guestTeamId: DUEL_DEFENDER_TEAM_ID,
  });
  const duel = new OnlineDuel(session);

  try {
    await session.startBattle();

    /*
     * 🔴 **Le faux positif le plus probable de tout le lot**, et la raison d'être de ce scénario.
     *
     * Un pair qui reprend sa partie ne reçoit aucun état : il rejoue son journal d'actions (Lot B3).
     * Sa `Map<id, PokemonInstance>` est donc reconstruite dans un ORDRE D'INSERTION différent de
     * celle d'en face — et l'ordre de parcours d'une `Map` suit l'insertion. Une sérialisation qui
     * ne trierait pas ses entrées rendrait deux empreintes différentes pour deux états identiques :
     * les deux joueurs se verraient éliminés à la première action suivant une reconnexion, sur une
     * partie parfaitement honnête.
     */
    await session.playOneTurn();
    await session.playUntilHandIsOn(duel.attacker);
    await expect
      .poll(() => duel.defender.save.actionCount(), { timeout: 20_000 })
      .toBeGreaterThan(0);
    const defenderActionsBeforeLoss = await duel.defender.save.actionCount();

    /*
     * Tout ce qui suit jusqu'au retour court dans le délai de grâce (30 s pour une fermeture propre,
     * #950 révisée en recette) : l'onglet de retour est booté AVANT la coupure, et seuls les gestes
     * qui doivent tenir dans la fenêtre y sont faits.
     */
    const returningDefender = await session.loseGuestTab();

    // L'hôte joue PENDANT l'absence : cette action part dans un canal fermé, donc c'est celle que le
    // revenant devra rattraper — et l'index auquel les deux empreintes devront concorder.
    await duel.attacker.scene.endTurn();
    await expect(duel.attacker.notice.notice).toBeVisible({ timeout: 15_000 });

    await returningDefender.menu.resume.click();
    await returningDefender.scene.waitReady(30_000);
    await expect(duel.attacker.notice.notice).toBeHidden({ timeout: 30_000 });

    // Les deux moteurs au même index : c'est ce qui dit que le rejeu a bien eu lieu, donc que la
    // `Map` du revenant a bien été reconstruite. Sans ça, l'absence de divergence ne prouverait rien.
    const attackerActions = await duel.attacker.save.actionCount();
    expect(attackerActions).toBeGreaterThan(defenderActionsBeforeLoss);
    await expect
      .poll(() => returningDefender.save.actionCount(), { timeout: 30_000 })
      .toBe(attackerActions);

    /*
     * Et la partie se termine normalement, sur l'état reconstruit : c'est là que les empreintes
     * suivantes se comparent, K.O. compris. Un tri manquant se verrait ICI.
     */
    await duel.fightToKnockOut();
    for (const peer of [duel.attacker, duel.defender]) {
      await expect(peer.victory).toBeVisible({ timeout: 30_000 });
      await expect(peer.victory.getByRole("heading")).toHaveText("Joueur 1 gagne !");
      await expect(peer.divergence).toHaveCount(0);
    }
  } finally {
    await session.close();
  }
});

/**
 * Le gid d'une case de **sable**, dans le jeu de tuiles de terrain partagé par toutes les cartes
 * (`assets/tilesets/terrain/tileset.tsj`, tuile 24 → gid 25 avec `firstgid: 1`).
 *
 * Choisi pour une raison précise : ses propriétés sont `{ terrain: "sand", height: 1 }`, donc la
 * **même hauteur** que la case normale qu'il remplace. La géométrie ne bouge pas d'un millimètre —
 * seul le terrain, qui vit dans `BattleState`, diffère. La divergence est ainsi la plus petite
 * possible : un champ, sur une case, dans un coin.
 */
const SAND_GID = 25;
/** Le gid d'une case normale, pour le cas où la case altérée serait déjà du sable. */
const NORMAL_GID = 1;

/**
 * Sert à ce contexte une carte dont la case (0,0) n'a pas le même terrain que celle des autres.
 *
 * Le coin (0,0) est choisi parce qu'il ne peut rien perturber d'autre : les zones de départ de
 * l'Arène Simple couvrent les colonnes 3 à 8, et le pilote de duel ne visite que le chemin le plus
 * court entre les deux camps. De toute façon la partie se termine sur l'empreinte de LANCEMENT,
 * avant la première action.
 */
async function serveDivergentMap(context: BrowserContext): Promise<void> {
  await context.route("**/assets/maps/*.tmj", async (route) => {
    const response = await route.fetch();
    const map = (await response.json()) as {
      layers: { name: string; data?: number[] }[];
    };
    const terrain = map.layers.find((layer) => layer.name === "terrain");
    if (terrain?.data === undefined) {
      // Échec FRANC : une carte encodée autrement (base64) rendrait le détournement silencieusement
      // inopérant, donc le scénario passerait au vert sans avoir rien provoqué.
      throw new Error("la carte servie n'a pas de couche « terrain » en tableau de gid");
    }
    terrain.data[0] = terrain.data[0] === SAND_GID ? NORMAL_GID : SAND_GID;
    await route.fulfill({ json: map });
  });
}

test("§11.8 en ligne : deux cartes qui diffèrent d'une case, et les deux joueurs lisent le constat", async ({
  browser,
}) => {
  /*
   * La contre-épreuve des deux scénarios précédents, et la seule qui prouve que le détecteur EXISTE.
   *
   * Aucune équipe n'est posée : la divergence est constatée sur l'empreinte de **lancement**, émise
   * après la phase de placement et avant la première action, donc ce qui se bat n'a aucune
   * importance. C'est aussi ce qui rend ce scénario rapide.
   */
  const session = await OnlineSession.open(browser, { interceptGuest: serveDivergentMap });

  try {
    await session.startBattle();

    /*
     * Ce que le JOUEUR lit, et c'est tout ce qui compte à l'écran : une phrase propre à la cause.
     * Pas « vous avez triché », pas un code d'erreur — en 1v1 personne ne peut dire qui s'est écarté
     * (#943), donc le constat n'est jamais une accusation.
     */
    for (const peer of [session.host, session.guest]) {
      /*
       * `toBeAttached` et non `toBeVisible`, comme partout où ce projet juge une ligne de journal :
       * le panneau naît REPLIÉ (`data-collapsed`), et à cet instant la modale de fin de partie rend
       * de toute façon inerte tout ce qui est derrière elle — le joueur déplie son journal quand il
       * veut relire. Ce qui est vérifiable ici est que la ligne existe et qu'elle DIT la cause.
       */
      await expect(peer.divergence.first()).toBeAttached({ timeout: 30_000 });
      await expect(peer.divergence.first()).toContainText(/^Le Joueur \d quitte la partie —/);
      // Et la partie s'arrête : le constat n'est pas un avertissement, c'est une fin de partie.
      await expect(peer.battleOver).toBeVisible({ timeout: 30_000 });
    }

    /*
     * Le verdict n'est PAS asserté, et c'est un choix : les deux pairs prononcent leur constat au
     * même instant et se le diffusent, donc chacun applique deux forfaits — l'issue dépend de l'ordre
     * d'arrivée. Ce que le lot promet est que l'écart soit **lisible**, pas qu'il désigne un
     * gagnant (le plan est explicite : constat et forfait, rien de plus).
     */
  } finally {
    await session.close();
  }
});
