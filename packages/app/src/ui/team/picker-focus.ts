import { InputSource } from "../../input/input-source";
import { getInputSystem } from "../../input/input-system";

/**
 * Focus d'entrée des sélecteurs (Pokemon / capacité / objet) — une décision à TROIS cas, une par
 * modalité, parce que les trois veulent des choses différentes du même écran.
 *
 * - **Souris** → le champ de recherche. On tape directement, c'est le confort d'origine.
 * - **Doigt** → rien. Le clavier virtuel surgit et recouvre la quasi-totalité de la modale, donc la
 *   liste de résultats qu'on venait consulter (retour humain 2026-08-06, sur un écran de 393px de
 *   haut). L'humain touche le champ lui-même s'il veut filtrer.
 * - **Manette** → le premier résultat (plan 188, trou D). Une manette ne saisit pas de texte :
 *   entrer avec le focus dans le champ de recherche était un cul-de-sac, le pad ne pouvant ni taper
 *   ni comprendre pourquoi rien ne répondait. Le champ porte d'ailleurs `data-nav-skip="gamepad"`
 *   depuis la décision humaine du 2026-08-26 — la navigation au pad ne s'y arrête plus du tout, et
 *   le filtrage passe par les chips.
 *
 * Le cas du doigt se teste sur le *pointeur* et non sur la taille : une fenêtre desktop étroite garde
 * le focus automatique, une tablette large ne l'a pas. Le cas de la manette se lit, lui, sur la
 * source active publiée par l'`InputSystem` — un pad branché mais inutilisé ne doit rien changer.
 */
export function focusPickerEntry(search: HTMLInputElement, firstResult: () => HTMLElement | null) {
  if (getInputSystem()?.tracker.current() === InputSource.Gamepad) {
    // À défaut de résultat (filtre trop restrictif, liste vide), le champ reprend la main : c'est le
    // seul contrôle qui permette encore d'agir, et `Cancel` reste la sortie.
    (firstResult() ?? search).focus();
    return;
  }
  if (window.matchMedia("(pointer: coarse)").matches) {
    return;
  }
  search.focus();
}
