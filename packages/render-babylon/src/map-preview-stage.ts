import { type CombatScene, createCombatScene } from "./combat-scene.js";

export interface MapPreviewStage {
  /** Swap the previewed map (disposes the previous Babylon scene). */
  setMap(mapUrl: string): void;
  dispose(): void;
}

/**
 * Live map preview for the map-select screen (plan 120 step 3): a combat scene
 * without Pokemon inside an arbitrary container. One Babylon engine per map —
 * simple and leak-free (the combat-scene dispose chain is already exercised by
 * the FSM); swap cost is acceptable for a selection list.
 */
export function createMapPreviewStage(container: HTMLElement): MapPreviewStage {
  const canvas = document.createElement("canvas");
  canvas.className = "ms-preview-canvas";
  container.append(canvas);

  /*
   * Voile de chargement (retour humain 2026-08-06, sur téléphone) : construire la scène prend
   * assez de temps pour que l'aperçu reste vide, et un cadre vide « donne l'impression que c'est
   * cassé ». On s'appuie sur `CombatScene.ready` — un vrai signal du contrat de rendu — plutôt que
   * sur un délai arbitraire.
   */
  const loader = document.createElement("div");
  loader.className = "ms-preview-loading";
  container.append(loader);

  let scene: CombatScene | null = null;
  /* Jeton anti-course : un survol rapide de la liste enchaîne les `setMap`, et seule la dernière
   * carte demandée doit avoir le droit de retirer le voile. */
  let pending = 0;

  return {
    setMap(mapUrl) {
      scene?.dispose();
      const token = ++pending;
      loader.dataset.state = "loading";
      scene = createCombatScene({
        canvas,
        mapUrl,
        pokemon: [],
        showHoverCursor: false,
      });
      const created = scene;
      const clearVeil = (): void => {
        if (token === pending) {
          loader.dataset.state = "idle";
        }
      };
      /* Retiré même si la scène échoue : `ready` rejette quand le chargement de carte échoue, et
       * sans branche de rejet on aurait un rejet non géré ET un voile qui tourne indéfiniment.
       * Échouer visiblement (aperçu vide) vaut mieux qu'un chargement sans fin. */
      void created.ready.then(clearVeil, clearVeil);
    },
    dispose() {
      scene?.dispose();
      scene = null;
      /* Invalide le jeton : une résolution tardive de `ready` ne doit plus rien toucher. Inoffensif
       * aujourd'hui (écrire sur un nœud détaché ne fait rien) mais l'invariant devient explicite. */
      pending += 1;
      loader.remove();
      canvas.remove();
    },
  };
}
