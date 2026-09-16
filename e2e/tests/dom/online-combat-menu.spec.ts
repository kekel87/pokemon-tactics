import { expect, test } from "../../fixtures";
import { OnlinePeer } from "../../pages/online-session";
import { PlacementPhase } from "../../pages/placement";

/*
 * Cahier §11.9 et §11.10 — « Recommencer » n'existe PAS en partie en ligne (revue du plan 204).
 *
 * 🔴 Ce que ces deux scénarios gardent est une ASYMÉTRIE refermée, pas une fonctionnalité neuve. Le
 * dialogue de victoire portait déjà la garde (`canReplay: localPlayerIds === undefined`,
 * `combat-screen.ts`) ; le menu de combat, lui, offrait l'entrée SANS CONDITION. Or son rappel est le
 * `onReplay` du chrome, qui remonte le setup **en local** : un joueur en ligne relançait un hot-seat
 * sur les deux camps, avec le salon toujours tenu et l'adversaire en attente d'un tour qui ne
 * viendrait jamais. Le trou valait aussi au PLACEMENT, où les deux camps posent leurs Pokemon.
 *
 * Le contre-exemple — l'entrée est bien là HORS LIGNE — est déjà tenu ailleurs, et il n'est pas
 * redoublé ici : `combat/combat-menu.spec.ts` (« Recommencer » passe par une confirmation, et relance
 * le combat depuis zéro) et `combat/placement-menu.spec.ts` (« Recommencer » du placement confirme…).
 * Les deux échoueraient si la garde se mettait à cacher l'entrée partout.
 *
 * 🔴 **UN SEUL contexte de navigateur, et c'est le point de méthode.** Une partie est « en ligne »
 * pour ce code dès que `setup.localSeat` existe — c'est-à-dire dès qu'elle est entrée par
 * `enterNetworkBattle`, salon vivant et code à l'appui. Un hôte SEUL dans son salon qui repasse la
 * place libre en IA (« il peut toujours forcer en repassant en IA les lignes qui traînent »,
 * `Room.setSeatOccupancy`) traverse exactement ce chemin, sans payer la négociation WebRTC ni un
 * second boot Babylon. Le même arbitrage que `online-format.spec.ts` §12.9.
 *
 * La contrepartie est assumée : ce montage ne prouve pas qu'un VRAI adversaire humain est de l'autre
 * côté. C'est pourquoi `online-resilience.spec.ts` §11.3, qui paie déjà deux contextes et ouvre déjà
 * le menu, porte la même assertion en une ligne sur une partie à deux pairs.
 */

/*
 * Plus long que les 60 s du projet `dom` : un salon (annuaire local) plus un boot Babylon complet
 * par scénario. Pas de négociation WebRTC en revanche — voir l'en-tête.
 */
test.setTimeout(120_000);

/** Menu → Combat → En ligne → Créer, la place libre passée à l'IA, jusqu'au lancement. */
test("§11.9 en ligne : le menu de combat n'offre pas « Recommencer », ses autres entrées oui", async ({
  page,
}) => {
  const host = new OnlinePeer(page);
  await host.launchAlone();

  // Le bouton `☰` naît grisé tant que le contexte est verrouillé (tour de l'autre camp) : attendre
  // qu'il soit actionnable, sinon le clic partirait dans le vide.
  await expect(host.combatMenu.openButton).toBeEnabled({ timeout: 30_000 });
  await host.combatMenu.openByButton();
  /*
   * La modale est là AVANT de juger son contenu. `toBeEnabled` puis le clic ne sont pas atomiques :
   * le `☰` se regrise quand le contexte se reverrouille, et un clic tombé dans cette fenêtre
   * n'ouvrirait rien. Sans cette ligne l'échec se lirait « Reprendre introuvable », qui envoie
   * chercher au mauvais endroit.
   */
  await expect(host.combatMenu.dialog).toBeVisible();

  /*
   * (a) 🔴 L'entrée est ABSENTE — la garde du lot. `toHaveCount(0)` et non `not.toBeVisible()` : le
   * correctif ne la rend pas cachée, il ne la construit pas du tout (`onRestart` optionnel), pour
   * qu'aucun appelant ne puisse masquer l'entrée en gardant le rappel vivant.
   */
  await expect(host.combatMenu.restart).toHaveCount(0);

  /*
   * (b) …et rien d'autre n'a disparu au passage. Sans ce volet, un menu qui ne monterait plus du tout
   * — une exception à la construction de la liste, par exemple — passerait pour un succès.
   */
  await expect(host.combatMenu.resume).toBeVisible();
  await expect(host.combatMenu.settings).toBeVisible();
  await expect(host.combatMenu.abandon).toBeVisible();
  // « Quitter » vit tant qu'une sauvegarde existe, et une partie en ligne en écrit une (elle est
  // reprenable, plan 202). Son absence signalerait qu'on ne juge pas le combat qu'on croit.
  await expect(host.combatMenu.quit).toBeVisible();

  /*
   * (c) La preuve qu'on est bien EN LIGNE, et pas dans une partie locale où l'absence serait un bug :
   * la pastille « le temps continue » n'est montée que quand un chronomètre de tour tourne, ce qui
   * n'arrive que sous `localSeat` (décision #946). C'est le même drapeau qui gouverne la garde.
   */
  await expect(host.combatMenu.clockWarning).toBeVisible();
  // Le compte exact, comme en §11.10 : quatre entrées et pas une de plus. Une assertion d'absence ne
  // voit jamais l'entrée EN TROP qu'une refonte du menu ajouterait.
  await expect(host.combatMenu.dialog.getByRole("button")).toHaveCount(4);
});

test("§11.10 en ligne : le menu du PLACEMENT n'offre pas « Recommencer » non plus", async ({
  page,
}) => {
  const host = new OnlinePeer(page);
  const placement = new PlacementPhase(page);
  await host.launchAlone({ interactivePlacement: true });

  await expect(placement.instruction).toBeVisible({ timeout: 30_000 });
  await host.combatMenu.openByButton();
  // Même raison qu'en §11.9 : nommer l'échec « la modale n'a pas ouvert » plutôt que « il manque une
  // entrée », qui enverrait soupçonner la garde.
  await expect(host.combatMenu.dialog).toBeVisible();

  // Le trou existait des DEUX côtés du passage de relais : `mountPlacementChrome` recevait `replay`
  // sans condition, alors qu'en ligne les deux camps posent leurs Pokemon sous un salon vivant.
  await expect(host.combatMenu.restart).toHaveCount(0);

  /*
   * La variante `placement` n'a que trois entrées une fois la garde posée — « Quitter » y EST la
   * sortie destructrice (une seule, qui confirme), et aucune pastille de chronomètre : le compteur
   * ne naît qu'avec le combat. Le compte exact est l'assertion qui verrait une entrée de trop.
   */
  await expect(host.combatMenu.resume).toBeVisible();
  await expect(host.combatMenu.settings).toBeVisible();
  await expect(host.combatMenu.quit).toBeVisible();
  await expect(host.combatMenu.abandon).toHaveCount(0);
  await expect(host.combatMenu.dialog.getByRole("button")).toHaveCount(3);
});
