// `focusableWithin` porte le sélecteur ET le filtre `data-nav-skip` : les redéclarer ici avait déjà
// divergé (revue de code 2026-08-26), la restauration reposant le focus sur un champ de recherche que
// la navigation manette saute par ailleurs.
import { focusableWithin } from "../../input/focus-navigation";

/**
 * Garder le focus DOM au travers d'un re-rendu (plan 188, retours humains 2026-08-25 et 2026-08-26).
 *
 * Le motif du projet est de reconstruire un sous-arbre à chaque changement d'état
 * (`innerHTML = ""` puis `render()`, ou `replaceChildren`). C'est simple et sans surprise à la souris,
 * mais ça **éjecte le focus vers `<body>`** : au clavier et à la manette, la navigation repart du haut
 * de l'écran à chaque interaction. `.claude/rules/html.md` l'interdit et citait déjà un cas connu
 * (`settings-screen.ts`) ; le retour humain a montré que c'est en réalité **partout** — changer le
 * genre d'un Pokemon, cocher un talent, activer un filtre d'un sélecteur.
 *
 * Le remède est ici plutôt que recopié écran par écran : c'est le même bug, il mérite un seul endroit.
 *
 * ## Pourquoi une ADRESSE et pas une référence
 *
 * Le re-rendu détruit le nœud focalisé — le refocaliser est impossible, il n'existe plus. On retient
 * donc *comment le retrouver* : son `data-testid` et son rang parmi ses homonymes. Un contrôle sans
 * `testid`, ou disparu du nouveau rendu, ne récupère **rien** : mieux vaut un focus perdu qu'un focus
 * posé au hasard — a fortiori sur une action destructive (cf. `restore`).
 */

interface FocusAddress {
  /** `data-testid` du contrôle, quand il en porte un — l'ancre la plus stable. */
  testid: string | null;
  /** Rang parmi les contrôles qui partagent ce `testid` (ou parmi tous, si aucun testid). */
  ordinal: number;
}

function addressOf(host: HTMLElement, active: Element | null): FocusAddress | null {
  if (!(active instanceof HTMLElement) || !host.contains(active)) {
    return null;
  }
  const controls = focusableWithin(host);
  const testid = active.dataset.testid ?? null;
  if (testid !== null) {
    const sameTestId = controls.filter((control) => control.dataset.testid === testid);
    const ordinal = sameTestId.indexOf(active);
    if (ordinal !== -1) {
      return { testid, ordinal };
    }
  }
  const ordinal = controls.indexOf(active);
  return ordinal === -1 ? null : { testid: null, ordinal };
}

function restore(host: HTMLElement, address: FocusAddress): void {
  // Une adresse SANS `testid` n'est qu'un rang global : rien ne garantit que le n-ième focalisable
  // d'après reconstruction ait quoi que ce soit à voir avec celui d'avant. On ne restaure donc que
  // par famille de `testid` (revue de code 2026-08-26).
  //
  // Le cas qui a tranché : supprimer une équipe. `DeleteConfirmModal` ferme le `<dialog>` PUIS appelle
  // `onConfirm`, donc le focus est déjà revenu au bouton « Supprimer » de la carte au moment du
  // re-rendu — et `TeamCard` ne pose aucun `testid` sur ses boutons. Le repli global posait alors le
  // focus sur le « Supprimer » de la carte SUIVANTE. Poser le focus par défaut sur une action
  // destructive non visée est le pire résultat possible d'un repli.
  if (address.testid === null) {
    return;
  }
  const candidates = focusableWithin(host).filter(
    (control) => control.dataset.testid === address.testid,
  );
  // Dans une famille, se rabattre sur le dernier est sûr et utile : activer le dernier chip d'une
  // rangée qui raccourcit garde le focus sur un chip, au lieu de le renvoyer au `<body>`.
  const target = candidates[address.ordinal] ?? candidates.at(-1);
  target?.focus();
}

/**
 * Exécute `render` en rendant le focus au même contrôle logique ensuite.
 *
 * À utiliser partout où un handler reconstruit son sous-arbre. Ne fait rien de plus que ça : si le
 * focus n'était pas dans `host` (souris ailleurs, modale par-dessus), il n'est pas touché.
 */
export function renderPreservingFocus(host: HTMLElement, render: () => void): void {
  const address = addressOf(host, document.activeElement);
  render();
  if (address !== null) {
    restore(host, address);
  }
}
