import { closeOpenModal } from "../input/focus-navigation";
import { getInputSystem } from "../input/input-system";
import { LogicalAction } from "../input/logical-action";

/**
 * Le retour du navigateur remonte d'un écran, au lieu de quitter le jeu (plan 205).
 *
 * ## Ce qu'on intercepte, et ce qui n'est pas interceptable
 *
 * Trois gestes que le joueur vit comme « retour », et qui n'ont rien à voir techniquement :
 * le bouton latéral de la souris produit un `pointerdown` ; la flèche de la barre d'outils et le
 * geste de retour du téléphone n'émettent **aucun** événement DOM. Ces deux-là sont strictement des
 * navigations d'historique — sans entrée à dépiler, il n'y a rien à écouter, et le joueur sort du
 * jeu. Or c'est le geste du TÉLÉPHONE qui motive ce module : il y est un réflexe permanent, donc une
 * perte de partie accidentelle. Capturer des boutons ne pouvait pas suffire.
 *
 * ## La sentinelle
 *
 * **Une seule** entrée d'historique, toujours présente, réarmée après chaque retour consommé.
 * L'URL ne change jamais, aucun écran n'est associé à une entrée, et le bouton latéral de la souris
 * devient gratuit : il déclenche `history.back()`, donc il passe par ici comme les autres.
 *
 * Le mapping complet (un écran = une entrée) donnerait les liens profonds et le bouton *suivant*,
 * au prix de sérialiser `mapUrl`, `teamId` et un `CombatSetup` entier dans `history.state` — le mur
 * que `screen-persistence.ts` contourne délibérément. Personne ne demande ces deux gains.
 *
 * ## Le retour EST `Annuler`
 *
 * On ne réimplémente aucune navigation : le retour est routé dans le `cancel` de l'`InputSystem`,
 * là où arrivent `Échap` et le bouton B — à une exception près, relevée en revue : `Échap` a un
 * consommateur de PLUS en amont. `onKeyDown` sert la capture de touche avant le routeur
 * (`input-system.ts`), alors qu'`emit` entre directement dans le routeur. Pendant un remappage
 * (écran Contrôles, « pressez une touche »), `Échap` renonce à la capture ; le geste de retour, lui,
 * quitte l'écran. Divergence assumée, sans fuite (`controls-panel.dispose()` annule la capture) :
 * la corriger demanderait d'exposer « une capture est-elle en cours », donc d'élargir l'API
 * d'entrée, ce que ce plan refuse. La pile de registrations (plan 184) fait le
 * reste, sans qu'un seul écran ait à changer :
 *
 * - chaque écran de menu remonte là où son propre bouton « Retour » remonte, `bindScreenInput`
 *   ayant déjà reçu son `goBack` ;
 * - en combat, une visée en cours s'annule d'abord, puis le menu de combat s'ouvre — avec ses
 *   confirmations. **Jamais de sortie muette d'une partie**, ce qui était le vrai sujet.
 *
 * ## Les deux endroits où `cancel` ne suffit PAS
 *
 * Emprunter `cancel` marche parce que ses consommateurs répondent à une TOUCHE, qui a toujours un
 * repli natif du navigateur derrière elle. Un `popstate` n'en a aucun, et `false` n'y veut donc pas
 * dire la même chose. Deux cas s'en déduisent, tous deux traités ici plutôt que dans les écrans —
 * les corriger site par site aurait élargi l'API d'entrée, ce que ce plan a refusé :
 *
 * - **une modale que personne n'a fermée** : `bindScreenInput` rend `false` hors manette, en
 *   comptant sur la fermeture native du `<dialog>` (décision #822). On la ferme donc nous-mêmes,
 *   mais seulement en DERNIER recours — le menu de combat est un `<dialog>` qui possède sa propre
 *   sortie, et la court-circuiter laisserait sa registration d'entrée sur la pile ;
 * - **la racine** : elle se LIT (`isAtRoot`), au lieu de se déduire d'un `false` — voir le détail
 *   sur `onPopState`, où cette déduction faisait perdre la partie de deux façons.
 */

/**
 * Marque portée par NOTRE entrée d'historique.
 *
 * Elle sert au rechargement : l'entrée survit au `reload`, et sans la reconnaître on en empilerait
 * une seconde à chaque fois — il faudrait alors deux retours pour un écran.
 */
const SENTINEL_KEY = "ptBack";

/** Prend `unknown` : `history.state` est une valeur arbitraire, y compris écrite par autre chose. */
function isSentinel(state: unknown): boolean {
  if (typeof state !== "object" || state === null) {
    return false;
  }
  const { [SENTINEL_KEY]: marker } = state as Record<string, unknown>;
  return marker === true;
}

/**
 * Les événements qui prouvent une interaction du joueur.
 *
 * On n'arme PAS au démarrage : Chrome traite une entrée empilée sans activation utilisateur comme
 * une manipulation d'historique et la fait sauter par le bouton précédent — la sentinelle serait
 * ignorée précisément là où on l'attend. `pointerdown` couvre la souris et le doigt ; la manette ne
 * produit aucun événement DOM, mais un joueur à la manette n'appuie pas non plus sur le bouton
 * précédent du navigateur.
 */
const ARMING_EVENTS = ["pointerdown", "keydown"] as const;

/**
 * Branche le retour navigateur.
 *
 * `isAtRoot` dit s'il n'y a **plus rien au-dessus** — en pratique « l'écran courant est le menu
 * principal ». Il est passé de l'extérieur plutôt que déduit ici, pour la raison écrite sur
 * `onPopState` : la racine se lit, elle ne se devine pas.
 *
 * Renvoie de quoi débrancher (le boot ne s'en sert pas ; les tests si).
 */
export function initBrowserBack(isAtRoot: () => boolean): () => void {
  const arm = (): void => {
    if (isSentinel(globalThis.history?.state)) {
      return;
    }
    try {
      globalThis.history?.pushState({ [SENTINEL_KEY]: true }, "");
    } catch {
      // Historique refusé (iframe très restreinte, document opaque). On perd le retour d'un écran,
      // pas le jeu — même parti pris que le stockage local de `screen-persistence.ts`.
    }
  };

  const onPopState = (): void => {
    // On a atterri SUR notre sentinelle : c'est un pas en AVANT, pas un retour. Rien à annuler — et
    // ne pas le distinguer ferait rejouer la sortie ci-dessous à chaque appui sur « suivant ».
    //
    // ⚠️ Ce garde ne couvre PAS la cascade inverse (un `history.back()` de sortie qui retomberait
    // sur une entrée same-document et relancerait ce gestionnaire). Elle est inatteignable
    // aujourd'hui, mais par une propriété du RESTE de l'app, pas de ce module : la sentinelle est
    // la seule entrée same-document qui existe (aucun autre `pushState` / `replaceState` / hash
    // dans `packages/app` ni `packages/ui-dom`), et elle est toujours devant, jamais derrière. Le
    // jour où le mapping « un écran = une entrée » évoqué plus haut serait implémenté, la cascade
    // revient et ce garde ne la retiendra pas.
    if (isSentinel(globalThis.history?.state)) {
      return;
    }
    // Vrai tant qu'on part pour de bon : c'est la SEULE branche qui ne réarme pas.
    let leaving = false;
    try {
      const system = getInputSystem();
      // On repasse la modalité COURANTE au lieu d'en déclarer une : un retour navigateur n'en a pas.
      // Marquer « pointeur » effacerait l'anneau de focus d'un joueur au clavier (décision #814).
      if (system?.emit(LogicalAction.Cancel, system.tracker.current()) === true) {
        return;
      }
      // Personne n'a pris l'annulation ALORS QU'UNE MODALE EST OUVERTE : c'est à nous de la fermer.
      //
      // 🔴 `bindScreenInput` rend `false` ici hors manette, en comptant sur la fermeture NATIVE du
      // `<dialog>` qu'une frappe d'`Échap` déclenche derrière elle (décision #822). Un `popstate`
      // n'a pas ce repli. Faute de le voir, le retour sortait du jeu depuis n'importe quelle modale
      // d'écran de menu — mesuré le 2026-09-10 sur le sélecteur d'équipe, en trois gestes, partie
      // perdue.
      //
      // APRÈS `emit` et non avant : le menu de combat est lui aussi un `<dialog>`, mais sa sortie
      // propre (`combat-menu.ts`, `close()`) désenregistre son entrée, dispose son panneau et rend
      // le focus. Un `dialog.close()` sec par-dessus laisserait une registration fantôme au sommet
      // de la pile. On ne ferme donc soi-même que ce que personne n'a voulu fermer.
      if (closeOpenModal()) {
        return;
      }
      if (isAtRoot()) {
        // Plus rien au-dessus : on POURSUIT vers l'extérieur, pour que le geste fasse ce que le
        // joueur demande au lieu de ne rien faire. Sans entrée derrière (onglet neuf), c'est un
        // no-op, comme sur n'importe quel site.
        leaving = true;
        try {
          globalThis.history?.back();
        } catch {
          // Historique refusé : on reste, donc on réarme comme les autres branches.
          leaving = false;
        }
      }
    } finally {
      // 🔴 Réarmé partout SAUF en partant, et surtout PAS selon que quelqu'un ait consommé.
      //
      // « Personne n'a consommé » ne veut pas dire « on est à la racine » : ça arrive aussi pendant
      // la fenêtre de montage ASYNCHRONE d'un écran (`ScreenManager` démonte le sortant puis attend
      // `mount`, donc la pile d'entrée est vide — et `team-select` y attend un aller-retour réseau
      // en `joinAsGuest`, soit des secondes). Le déduire faisait quitter le jeu à l'invité qui
      // trouve que ça rame, en lançant le délai de grâce du plan 202 chez son adversaire. La racine
      // se LIT (`isAtRoot`), elle ne se devine pas.
      //
      // Dans un `finally` : si `emit` lève, la sentinelle doit survivre, sinon le geste suivant —
      // celui que le joueur refait justement parce qu'il a vu quelque chose casser — sort du jeu.
      if (!leaving) {
        arm();
      }
    }
  };

  window.addEventListener("popstate", onPopState);
  for (const event of ARMING_EVENTS) {
    // Capture + passif : on veut voir le geste quoi qu'il arrive, sans jamais peser sur lui.
    window.addEventListener(event, arm, { capture: true, passive: true });
  }

  return () => {
    window.removeEventListener("popstate", onPopState);
    for (const event of ARMING_EVENTS) {
      window.removeEventListener(event, arm, { capture: true });
    }
  };
}
