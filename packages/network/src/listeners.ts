/**
 * Un jeu d'abonnés, et rien d'autre.
 *
 * `Room` en tenait douze, chacun avec son `Set`, sa méthode `on*` de trois lignes identiques et sa
 * boucle d'émission recopiée — près de quatre-vingt-dix lignes de gabarit dans lesquelles la machine
 * à états du salon était noyée. Aucune de ces lignes ne connaissait le salon : c'est du mécanisme,
 * pas du domaine.
 *
 * **`emit` itère sur une COPIE**, délibérément : un abonné qui se désabonne — ou en abonne un autre —
 * pendant sa propre notification ne doit pas changer la liste de ceux qui vont être appelés. Onze des
 * treize boucles d'origine le faisaient déjà (`[...this.xListeners]`) ; les deux qui itéraient le
 * `Set` en direct — celles de `action` et de `forfeit` — sont alignées ici, dans le sens le plus sûr.
 * Le sens le moins sûr était livrable : le `Set` visite les éléments ajoutés en cours d'itération,
 * donc un abonné apparu pendant la notification aurait reçu une action déjà appliquée.
 */
export class Listeners<Args extends readonly unknown[] = []> {
  private readonly listeners = new Set<(...args: Args) => void>();

  /** Combien écoutent. Lu par le salon pour savoir s'il doit garder un message en tampon. */
  get size(): number {
    return this.listeners.size;
  }

  /** @returns de quoi se désabonner. C'est le seul moyen de partir : pas de `remove` public. */
  subscribe(listener: (...args: Args) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(...args: Args): void {
    for (const listener of [...this.listeners]) {
      listener(...args);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
