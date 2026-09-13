import { getSettings } from "../settings";
import { knownMapIdOrDefault } from "./map-choice";

/**
 * La carte d'entrée d'une nouvelle partie : la dernière jouée, sinon Arène Simple.
 *
 * Seul point d'entrée du défaut — solo comme hôte en ligne — parce que les deux chemins doivent
 * répondre pareil, et que c'est exactement le genre de règle qu'on recopie une fois de trop.
 *
 * 🔴 Il vit dans SON PROPRE module, et ce n'est pas du rangement : `settings/index.ts` a besoin de
 * `RANDOM_MAP_ID` pour son défaut, donc le mettre dans `map-choice.ts` — qui aurait alors lu les
 * préférences — fermait un CYCLE d'import. Le symptôme était sournois : `DEFAULT_SETTINGS.lastMapId`
 * valait `undefined` quand `map-choice` se chargeait en premier, donc la suite unitaire passait
 * fichier par fichier et tombait en bloc. `map-choice` reste pur, ce module fait la jonction.
 */
export function preferredMapId(): string {
  return knownMapIdOrDefault(getSettings().lastMapId);
}
