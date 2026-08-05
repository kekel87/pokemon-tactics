/**
 * Focus initial du champ de recherche des sélecteurs (Pokemon / capacité / objet).
 *
 * Au clavier-souris, ouvrir la modale avec le champ déjà actif est un confort : on tape
 * directement. Au doigt, c'est l'inverse — le clavier virtuel surgit et recouvre la quasi-totalité
 * de la modale, donc la liste de résultats qu'on venait consulter (retour humain, 2026-08-06, sur
 * un écran de 393px de haut). L'humain touche le champ lui-même s'il veut filtrer.
 *
 * Le test porte sur le *pointeur*, pas sur la taille : une fenêtre desktop étroite garde le focus
 * automatique, une tablette large ne l'a pas.
 */
export function focusSearchUnlessTouch(search: HTMLInputElement): void {
  if (window.matchMedia("(pointer: coarse)").matches) {
    return;
  }
  search.focus();
}
