export const PlacementMode = {
  Alternating: "alternating",
  Random: "random",
  /**
   * Le placement du multijoueur en ligne (plan 211) : chaque joueur pose ses Pokemon quand il
   * veut, sans attendre les autres, et ne pilote que son propre camp.
   *
   * L'alternance suppose un seul écran. En réseau, chacun a le sien — et le placement y est
   * CACHÉ jusqu'au lancement, donc la règle anti-réaction de `canUndo` n'a plus d'objet.
   */
  Simultaneous: "simultaneous",
} as const;

export type PlacementMode = (typeof PlacementMode)[keyof typeof PlacementMode];
