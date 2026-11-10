/**
 * Le verrou du mode Aventure (plan 251, décision #1227) : le mode se développe dans `main`, lot par lot,
 * fermé aux joueurs. `?aventure=1` dans l'adresse l'ouvre pour l'humain et les testeurs, y compris en
 * production : c'est le « lien caché », sans réglage visible qui révélerait le mode.
 *
 * Lu une fois au chargement : l'adresse ne change pas sans recharger la page.
 */
const ADVENTURE_UNLOCKED = new URLSearchParams(window.location.search).get("aventure") === "1";

export function isAdventureUnlocked(): boolean {
  return ADVENTURE_UNLOCKED;
}
