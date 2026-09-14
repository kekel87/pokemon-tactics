import { NetworkErrorCode } from "@pokemon-tactic/network";
import { describe, expect, it } from "vitest";
import { isRetryableRefusal } from "./network-error";

/**
 * Le partage des causes de refus entre « Réessayer » et « Retour au menu » (plan 207, étape 5).
 *
 * 🔴 Pourquoi ce test existe : `test-writer` a relevé que la règle n'avait **aucune** couverture.
 * Deux des six causes sont hors d'atteinte de l'e2e — `VersionIncompatible` exige un pair dont le
 * `NETWORK_VERSION` diffère, `ConnexionImpossible` est le repli de `networkErrorCodeOf`, non
 * provocable depuis un navigateur — et la modale touche le DOM, que le dépôt ne sait pas monter
 * (pas de jsdom). La règle a donc été sortie dans ce module sans DOM pour être couverte ici.
 */
describe("isRetryableRefusal", () => {
  /**
   * Ce qu'un joueur corrige en réessayant **sur place** : le code se retape, une partie pleine ou
   * déjà lancée peut se libérer, un pair muet peut répondre au coup suivant.
   */
  it.each([
    NetworkErrorCode.CodeIntrouvable,
    NetworkErrorCode.SalonPlein,
    NetworkErrorCode.PartieCommencee,
    NetworkErrorCode.DelaiDepasse,
  ])("propose de réessayer sur %s", (code) => {
    expect(isRetryableRefusal(code)).toBe(true);
  });

  /**
   * Ce qui ne se corrige PAS d'ici : l'une demande de recharger la page, l'autre tient à la
   * traversée de pare-feu entre deux réseaux. « Réessayer » y serait une invitation à refaire en
   * vain ce qui vient d'échouer.
   *
   * `FormatReduit` les rejoint pour une raison différente et plus nette encore : rien n'a échoué.
   * Un humain — l'hôte — a décidé du format de SA partie, et la place n'existe plus. Proposer de
   * réessayer laisserait croire à un aléa réparable en insistant.
   */
  it.each([
    NetworkErrorCode.VersionIncompatible,
    NetworkErrorCode.ConnexionImpossible,
    NetworkErrorCode.FormatReduit,
  ])("renvoie au menu sur %s", (code) => {
    expect(isRetryableRefusal(code)).toBe(false);
  });

  /**
   * 🔴 Le garde-fou qui compte vraiment : le jour où `NetworkErrorCode` gagne une cause, ce test
   * échoue au lieu de la laisser tomber dans un défaut silencieux. Sans lui, les deux `it.each`
   * ci-dessus resteraient verts en ignorant la nouvelle — et elle hériterait de « Retour au menu »
   * par omission, sans que personne ne l'ait décidé.
   */
  it("couvre les SEPT causes de l'énumération, et échoue si une s'ajoute", () => {
    const decidees = [
      NetworkErrorCode.CodeIntrouvable,
      NetworkErrorCode.SalonPlein,
      NetworkErrorCode.PartieCommencee,
      NetworkErrorCode.DelaiDepasse,
      NetworkErrorCode.VersionIncompatible,
      NetworkErrorCode.ConnexionImpossible,
      NetworkErrorCode.FormatReduit,
    ];
    expect([...Object.values(NetworkErrorCode)].sort()).toEqual([...decidees].sort());
  });
});
