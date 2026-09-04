/**
 * Codes de partie et adresses dérivées (plan 199, décision #898).
 *
 * Le code **est** l'adressage : l'hôte est `pkmntac-<CODE>-1`, la place *n* est `pkmntac-<CODE>-n`.
 * Personne n'annonce qu'il est l'hôte — c'est le fait d'avoir pris la place 1 qui le définit, et la
 * prise d'identifiant chez l'annuaire étant exclusive, deux pairs ne peuvent pas s'en croire
 * titulaires tous les deux. Trois propriétés tombent de ce seul choix : l'allocation de place sans
 * arbitre (le refus de l'annuaire *est* le mécanisme), le maillage complet (tout le monde joint tout
 * le monde en connaissant le seul code), et la reconnexion sans serveur (celui qui revient réclame la
 * même place, à une adresse que les autres connaissent déjà).
 */

/**
 * Alphabet de 32 sans ambiguïté à l'oral ni à l'œil : les 26 lettres moins `I` et `O` (confondus
 * avec `1` et `0`), les chiffres `2` à `9` (`0` et `1` retirés pour la même raison). Un code de 5
 * caractères donne 32^5 ≈ 33,5 millions de combinaisons.
 */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const ROOM_CODE_LENGTH = 5;

/**
 * Préfixe d'espace de noms. **Pas cosmétique** (décision #866) : l'espace de noms de l'annuaire
 * public gratuit est mondial et partagé entre toutes les applications qui l'utilisent — sans
 * préfixe, un code à 5 caractères entrerait en collision avec n'importe quelle autre application.
 */
export const PEER_ID_PREFIX = "pkmntac";

/** La place de l'hôte. C'est l'avoir prise qui fait l'hôte, rien d'autre ne le déclare. */
export const HOST_SEAT = 1;

/**
 * Tire un code de partie. Utilise `crypto.getRandomValues` — disponible dans le navigateur comme
 * dans Node ≥ 19 — plutôt que `Math.random`, pour qu'un code ne soit pas devinable depuis un autre.
 *
 * Le rejet des octets ≥ `limit` écarte le biais modulo. L'alphabet courant fait 32 caractères, un
 * diviseur de 256, donc aucun octet n'est rejeté en pratique ; la borne est calculée plutôt
 * qu'écrite en dur pour que la propriété survive à un alphabet de taille non divisante.
 */
export function generateRoomCode(
  randomBytes: (length: number) => Uint8Array = defaultRandomBytes,
): string {
  const alphabetSize = ROOM_CODE_ALPHABET.length;
  const limit = Math.floor(256 / alphabetSize) * alphabetSize;
  let code = "";

  while (code.length < ROOM_CODE_LENGTH) {
    for (const byte of randomBytes(ROOM_CODE_LENGTH)) {
      if (byte >= limit) {
        continue;
      }
      code += ROOM_CODE_ALPHABET[byte % alphabetSize];
      if (code.length === ROOM_CODE_LENGTH) {
        break;
      }
    }
  }

  return code;
}

function defaultRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Normalise une saisie humaine : espaces retirés, minuscules relevées.
 *
 * Aucun rabattement des caractères ambigus, et c'est volontaire : l'alphabet exclut `I`, `O`, `0` et
 * `1` **des deux côtés** de chaque confusion, donc aucun des quatre n'a de cible vers laquelle le
 * rabattre. Une saisie qui en contient est simplement invalide, ce que `isValidRoomCode` dit.
 */
export function normalizeRoomCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

export function isValidRoomCode(input: string): boolean {
  const normalized = normalizeRoomCode(input);
  if (normalized.length !== ROOM_CODE_LENGTH) {
    return false;
  }
  return [...normalized].every((character) => ROOM_CODE_ALPHABET.includes(character));
}

/**
 * L'adresse d'annuaire d'une place. C'est la seule fonction qui connaît la forme d'un identifiant de
 * pair : tout le reste du code passe par elle, y compris les tests.
 */
export function peerIdForSeat(roomCode: string, seat: number): string {
  return `${PEER_ID_PREFIX}-${normalizeRoomCode(roomCode)}-${seat}`;
}

export function hostPeerId(roomCode: string): string {
  return peerIdForSeat(roomCode, HOST_SEAT);
}

/**
 * Les adresses de toutes les places d'un format, dans l'ordre croissant. L'ordre importe : c'est lui
 * qui rend la dérivation des graines d'IA identique sur tous les pairs (décision #901).
 */
export function peerIdsForRoom(roomCode: string, teamCount: number): readonly string[] {
  return Array.from({ length: teamCount }, (_, index) =>
    peerIdForSeat(roomCode, index + HOST_SEAT),
  );
}

/**
 * Relit une place depuis une adresse. Renvoie `undefined` pour tout ce qui ne vient pas de ce salon —
 * un pair d'une autre application, un identifiant tronqué, une autre partie. Un pair qui se présente
 * avec une adresse illisible n'est pas une erreur à remonter à l'interface, c'est un pair à ignorer.
 */
export function seatFromPeerId(peerId: string, roomCode: string): number | undefined {
  const expectedPrefix = `${PEER_ID_PREFIX}-${normalizeRoomCode(roomCode)}-`;
  if (!peerId.startsWith(expectedPrefix)) {
    return undefined;
  }
  const seatPart = peerId.slice(expectedPrefix.length);
  if (!/^[1-9][0-9]*$/.test(seatPart)) {
    return undefined;
  }
  return Number(seatPart);
}
