import type { BattleState } from "../types/battle-state";

/**
 * Somme de contrôle de l'état de combat (plan 203, Lot B4).
 *
 * En ligne, aucun état ne transite : chaque pair fait tourner sa copie du moteur et ne reçoit que
 * les **actions** de l'autre. Quand le déterminisme casse, il casse **en silence** — le validateur
 * d'actions du Lot B2 n'attrape que la divergence qui produit une action *illégale*. Une divergence
 * d'état qui laisse toutes les actions légales (un point de vie d'écart, un compteur de météo qui
 * diffère) ne déclenche rien. Ce module produit l'empreinte que deux pairs comparent pour la voir.
 *
 * 🔴 **Ce n'est PAS un anti-triche, et aucune cadence n'y changerait rien.** Rien ne lie l'empreinte
 * émise à l'état réellement détenu : un client modifié fait tourner l'état honnête à côté de son
 * état triché et émet l'empreinte honnête. Ce module détecte la divergence **accidentelle** — un bug
 * de déterminisme, un `NETWORK_VERSION` oublié, deux versions du moteur qui se rencontrent. Ce qui
 * empêche réellement de tricher est la validation de chaque action reçue contre `getLegalActions()`
 * (décision #211). Cohérent avec #943 : rien n'est authentifié de toute façon.
 */

/**
 * Décimales conservées pour un nombre non entier. Absorbe une dérive du dernier bit sans effacer
 * d'écart réel : le plus fin des flottants de l'état est `tile.height`, qui va par pas de 0,5.
 */
export const CHECKSUM_FLOAT_DIGITS = 6;

/**
 * 🔴 **On quantifie D'ABORD, on décide de la forme ENSUITE**, et l'ordre est tout le point.
 *
 * La première version testait `Number.isInteger` avant de quantifier, donc `21` rendait `"21"` quand
 * `20.999999999999996` rendait `"21.000000"` — deux textes différents pour la seule dérive qui
 * compte. Presque tout l'état de combat est entier : une dérive du dernier bit s'y produit
 * **autour d'un entier**, jamais au milieu d'un intervalle. La règle « les non-entiers sont
 * quantifiés » ne protégeait donc que les valeurs qui ne risquaient rien. Relevé en revue de code.
 *
 * `toFixed` sert de quantificateur (il gère les grands nombres mieux qu'une multiplication par une
 * puissance de dix), puis la valeur revient en nombre : un entier après quantification rend sa forme
 * entière, courte et lisible, et `-0` y devient `0` en passant.
 */
function encodeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    // Aucun état de combat valide ne porte NaN ni Infinity : c'est un bug à faire remonter, pas à
    // hacher — le hacher le rendrait invisible, ou pire, le ferait passer pour une désync.
    throw new Error(`state-checksum : nombre non fini dans l'état de combat (${String(value)})`);
  }
  const quantized = Number(value.toFixed(CHECKSUM_FLOAT_DIGITS));
  return Number.isInteger(quantized)
    ? String(quantized === 0 ? 0 : quantized)
    : quantized.toFixed(CHECKSUM_FLOAT_DIGITS);
}

function compareCodePoints(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

/**
 * Met l'état en texte de façon **canonique** : deux états égaux rendent le même texte, deux états
 * différents en rendent deux différents.
 *
 * Chaque règle a son motif, et deux d'entre elles se contredisent en apparence — les `Map` sont
 * triées, les tableaux ne le sont pas :
 *
 * - **Objets** : clés triées. Deux moteurs peuvent construire le même objet par des chemins
 *   différents, donc dans un ordre d'insertion différent.
 * - **Clés à valeur `undefined` : omises.** Règle load-bearing : `handleKo` remet une vingtaine de
 *   champs de `PokemonInstance` à `undefined` au lieu de les supprimer, et un pair qui a reconstruit
 *   son état par rejeu peut n'avoir jamais posé la clé là où l'autre l'a posée puis annulée. Les
 *   distinguer produirait un faux positif à chaque K.O.
 * - **`Map` : entrées triées par clé.** L'ordre de parcours d'une `Map` suit l'insertion — or un
 *   pair qui a repris sa partie a reconstruit la sienne en rejouant son journal. C'est le piège le
 *   plus susceptible de produire un faux positif sur une partie honnête.
 * - **Tableaux : ordre PRÉSERVÉ.** Leur ordre **est** sémantique — `fieldTerrains` documente
 *   « latest wins per tile on overlap », `statusEffects`, `auras` et `pendingStrikes` portent leur
 *   chronologie. Trier effacerait une vraie divergence.
 * - **Types inconnus : erreur.** Un champ d'une forme qu'on n'a pas prévue doit échouer bruyamment
 *   dans les tests, jamais se hacher en silence.
 *
 * Chaque valeur porte un préfixe de type et chaque suite porte sa longueur : `"1"` et `1` ne peuvent
 * pas se confondre, et aucune concaténation de deux états ne peut en imiter un troisième.
 */
export function canonicalize(value: unknown): string {
  if (value === null) {
    return "z";
  }
  switch (typeof value) {
    case "boolean":
      return value ? "b1" : "b0";
    case "number":
      return `n${encodeNumber(value)}`;
    case "string":
      return `s${value.length}:${value}`;
    case "object":
      break;
    default:
      throw new Error(`state-checksum : type non sérialisable (${typeof value})`);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalize(item));
    return `a${items.length}:${items.join("")}`;
  }

  if (value instanceof Map) {
    const entries = [...value.entries()]
      .map(([key, entryValue]) => [canonicalize(key), canonicalize(entryValue)] as const)
      .sort((left, right) => compareCodePoints(left[0], right[0]));
    return `m${entries.length}:${entries.map(([key, entryValue]) => key + entryValue).join("")}`;
  }

  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new Error(
      `state-checksum : objet non sérialisable (${value.constructor?.name ?? "sans prototype"})`,
    );
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort(compareCodePoints);
  const pairs = keys.map((key) => `s${key.length}:${key}${canonicalize(record[key])}`);
  return `o${pairs.length}:${pairs.join("")}`;
}

/** L'état de combat entier, mis en texte canonique. Grille comprise — voir `battleStateChecksum`. */
export function canonicalizeBattleState(state: BattleState): string {
  return canonicalize(state);
}

function avalanche(hash: number): number {
  let mixed = hash;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x85ebca6b);
  mixed ^= mixed >>> 13;
  mixed = Math.imul(mixed, 0xc2b2ae35);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

/**
 * Hachage **non cryptographique** du texte canonique : deux voies FNV-1a de 32 bits, décorrélées par
 * la position, combinées en 64 bits.
 *
 * Pur TypeScript, aucune dépendance, synchrone. `crypto.subtle` est exclu pour deux raisons : c'est
 * une API de plateforme là où le core doit rester utilisable partout, et elle est asynchrone.
 *
 * Il détecte la divergence accidentelle ; il ne résiste pas à une contrefaçon. C'est assumé — rien
 * n'est authentifié dans ce modèle (#943), donc un hachage cryptographique n'achèterait rien.
 */
export function checksumOf(text: string): string {
  let lane1 = 0x811c9dc5;
  let lane2 = 0xc2b2ae35;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    lane1 = Math.imul(lane1 ^ code, 0x01000193);
    lane2 = Math.imul(lane2 ^ (code + index), 0x85ebca6b);
  }
  const high = avalanche(lane1 ^ text.length);
  const low = avalanche(lane2 ^ text.length);
  return high.toString(16).padStart(8, "0") + low.toString(16).padStart(8, "0");
}

/**
 * L'empreinte que deux pairs comparent. 16 caractères hexadécimaux.
 *
 * **Toute la grille est incluse**, y compris `height` et `terrain` qui ne changent pas en combat :
 * c'est ce qui attrape une carte chargée différemment.
 *
 * **Les champs recalculés à chaque tour restent dedans** — `abilitySuppressedByGas`, `arenaTrapped`.
 * Le tri des `Map` fait que l'ordre de parcours ne peut pas faire diverger l'empreinte ; si l'ordre
 * faisait diverger la **valeur** recalculée, ce serait un vrai bug de déterminisme du moteur, et
 * exactement ce que cette fonction existe pour révéler. Les exclure cacherait ce qu'on cherche.
 */
export function battleStateChecksum(state: BattleState): string {
  return checksumOf(canonicalizeBattleState(state));
}
