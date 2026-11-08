/*
 * Le code d'un replay (plan 242) : un combat terminé, réduit à une chaîne de texte qu'on colle.
 *
 * Comme la sauvegarde de reprise (plan 181), on ne stocke que les ENTRÉES du combat — carte, équipes,
 * placements, graine, journal d'actions. Rejouer ce journal sur un moteur neuf reconstruit tout le
 * reste, exactement. Le code est donc court, mais une mise à jour du jeu peut changer un calcul, et un
 * vieux code se rejouerait alors de travers sans que rien ne le dise.
 *
 * Le code porte donc l'empreinte de son déroulé (plan 250), cumulée sur l'état après chaque action :
 * l'écran de combat rejoue le journal sans rendu avant de le montrer, et refuse s'il ne retrouve pas la
 * même empreinte. Un code survit ainsi à toute mise à jour qui ne touche pas à l'état de SON combat, ce
 * que la version du jeu (qui change à chaque commit) ne savait pas dire. L'état comprend les statistiques
 * de base : un équilibrage d'une espèce présente périme les codes où elle joue, par prudence.
 *
 * Le format est dans le préfixe (`PTR2.`) pour qu'un export par événements, qui survivrait à tout,
 * puisse s'ajouter plus tard sans casser les codes existants.
 */

import {
  type Action,
  ForfeitReason,
  type PlacementEntry,
  type PlacementTeam,
  type ReplayForfeit,
} from "@pokemon-tactic/core";
import { mapIdFromUrl, mapUrlFromId } from "../maps/map-identity";
import type { CombatSetup } from "./screens";

/**
 * Marqueur `PTR<format>.` : distingue « ce n'est pas un code de replay » de « ce code est abîmé », et
 * dit le format avant toute lecture, donc aussi pour un format futur que ce build ne sait pas lire.
 */
const CODE_MARKER = /PTR(\d+)\./;
const CODE_FORMAT = 2;
const CODE_PREFIX = `PTR${CODE_FORMAT}.`;
/** Le format du plan 242, lié à la version exacte du jeu : il ne se rejoue plus. */
const LEGACY_FORMAT = 1;

/*
 * Bornes lues AVANT de décompresser et de parser un texte collé par un tiers. Un combat 6v6 de 600 actions
 * mesuré au plan 250 tient en 5 076 caractères : les bornes laissent un facteur 40 de marge.
 */
const MAX_CODE_LENGTH = 200_000;
const MAX_JSON_BYTES = 2_000_000;

/** Guillemets et accents graves qu'un chat ou un document met après un code copié. */
const TRAILING_QUOTES = /[`"'“”‘’«»]+$/;

/** Tout ce qu'il faut pour rebâtir la position de départ d'un combat, puis le rejouer. */
export interface ReplayData {
  mapUrl: string;
  setup: CombatSetup;
  placementTeams: PlacementTeam[];
  placements: PlacementEntry[];
  seed: number;
  actions: Action[];
  /** Les camps partis en cours de route, à leur place dans le journal (plan 243). */
  forfeits?: ReplayForfeit[];
}

/** Un replay partagé : les entrées du combat, et l'empreinte de leur déroulé. */
export interface SharedReplay {
  data: ReplayData;
  /** Empreinte cumulée de l'état après chaque action (`fastForwardBattle`), comparée au rejeu. */
  fingerprint: string;
}

export const ReplayCodeError = {
  /** Le texte ne commence pas par le marqueur : ce n'est pas un code de replay. */
  NotACode: "not-a-code",
  /** Le marqueur y est mais le contenu est tronqué ou abîmé. */
  Unreadable: "unreadable",
  /** Un format que cette version du jeu ne connaît pas. */
  UnknownFormat: "unknown-format",
  /** Un code du format 1, lié à une version précise du jeu : il ne se rejoue plus. */
  OtherVersion: "other-version",
} as const;
export type ReplayCodeError = (typeof ReplayCodeError)[keyof typeof ReplayCodeError];

/** Pourquoi un code décodé n'a pas pu être lu une fois l'écran de combat ouvert (plan 246). */
export const ReplayFailure = {
  /** Le moteur refuse une action ou un abandon du journal. */
  Rejected: "rejected",
  /** La carte ou les sprites n'ont pas pu se charger. */
  LoadFailed: "load-failed",
  /** Rejoué, le journal ne retrouve pas l'empreinte du code : cette version déroule le combat autrement. */
  Diverged: "diverged",
} as const;
export type ReplayFailure = (typeof ReplayFailure)[keyof typeof ReplayFailure];

export type ReplayDecodeResult =
  | { readonly ok: true; readonly replay: SharedReplay }
  | { readonly ok: false; readonly error: ReplayCodeError };

/**
 * Le setup tel qu'il voyage dans un code : les seuls champs que le rejeu lit, recopiés un par un.
 *
 * Une liste blanche et non une liste noire : un champ ajouté plus tard à `CombatSetup` ne part pas dans
 * les codes sans qu'on le décide, et le reste vide `unclassified` oblige à le décider : le typecheck
 * échoue tant que le champ n'est ni gardé ni écarté ici. Le code du salon et l'identifiant de
 * télémétrie n'y sont pas : un code partagé ne doit pas faire fuiter l'adresse d'un salon.
 * `localSeat` y est : il dit « partie en ligne » et pilote la règle de Vœu Soin, que le replay doit
 * reproduire à l'identique.
 */
export function shareableSetup(setup: CombatSetup): CombatSetup {
  const {
    teams,
    formatKey,
    autoPlacement,
    damagePreview,
    musicId,
    seeds,
    localSeat,
    musicChoiceId: _musicChoiceId,
    telemetryTeams: _telemetryTeams,
    roomCode: _roomCode,
    battleId: _battleId,
    ...unclassified
  } = setup;
  const _everyFieldClassified: Record<string, never> = unclassified;
  return {
    teams,
    formatKey,
    autoPlacement,
    damagePreview,
    ...(musicId === undefined ? {} : { musicId }),
    ...(seeds === undefined ? {} : { seeds }),
    ...(localSeat === undefined ? {} : { localSeat }),
  };
}

/** Décompresse en s'arrêtant dès que la sortie dépasse `MAX_JSON_BYTES` : `null` au-delà. */
async function inflateBounded(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array | null> {
  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"))
    .getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    total += read.value.length;
    if (total > MAX_JSON_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(read.value);
  }
  return new Uint8Array(await new Blob(chunks).arrayBuffer());
}

async function deflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const piped = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

const FORFEIT_REASONS: ReadonlySet<unknown> = new Set(Object.values(ForfeitReason));

/**
 * Des abandons rejouables : chacun vise un camp du combat, avec un motif connu (le journal de combat
 * en tire sa phrase), à un rang du journal, et dans l'ordre où le moteur les a enregistrés.
 */
function areReplayForfeits(
  value: unknown,
  actionCount: number,
  playerIds: ReadonlySet<unknown>,
): boolean {
  if (value === undefined) {
    return true;
  }
  if (!Array.isArray(value)) {
    return false;
  }
  let previous = 0;
  return value.every((item: unknown) => {
    if (typeof item !== "object" || item === null) {
      return false;
    }
    const { afterAction, playerId, reason } = item as Record<string, unknown>;
    if (
      typeof afterAction !== "number" ||
      !Number.isInteger(afterAction) ||
      afterAction < previous ||
      afterAction > actionCount
    ) {
      return false;
    }
    previous = afterAction;
    return playerIds.has(playerId) && (reason === undefined || FORFEIT_REASONS.has(reason));
  });
}

/**
 * Vrai si `value` a la forme d'un `ReplayData` — la structure, pas la légalité des actions.
 *
 * Partagé avec la sauvegarde de reprise (`battle-persistence.ts`), qui porte les mêmes champs : un
 * seul garde, pour qu'un champ ajouté à l'un ne soit pas oublié dans l'autre.
 */
export function isReplayData(value: unknown): value is ReplayData {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  if (typeof entry.mapUrl !== "string" || typeof entry.seed !== "number") {
    return false;
  }
  if (!Array.isArray(entry.actions) || !Array.isArray(entry.placements)) {
    return false;
  }
  if (!Array.isArray(entry.placementTeams) || entry.placementTeams.length === 0) {
    return false;
  }
  const setup = entry.setup;
  if (typeof setup !== "object" || setup === null) {
    return false;
  }
  const { teams } = setup as Record<string, unknown>;
  if (!Array.isArray(teams) || teams.length === 0) {
    return false;
  }
  const playerIds = new Set(
    entry.placementTeams.map((team: unknown) =>
      typeof team === "object" && team !== null ? (team as Record<string, unknown>).playerId : null,
    ),
  );
  return areReplayForfeits(entry.forfeits, entry.actions.length, playerIds);
}

export async function encodeReplayCode(replay: SharedReplay): Promise<string> {
  const envelope: SharedReplay = {
    fingerprint: replay.fingerprint,
    data: { ...replay.data, setup: shareableSetup(replay.data.setup) },
  };
  const json = new TextEncoder().encode(JSON.stringify(envelope));
  const compressed = await deflate(json);
  return `${CODE_PREFIX}${toBase64Url(compressed)}`;
}

export async function decodeReplayCode(text: string): Promise<ReplayDecodeResult> {
  /*
   * Un code collé depuis un chat arrive souvent coupé en lignes, entouré d'espaces, de guillemets ou
   * d'un bloc de code (` ```text `). Le marqueur se cherche donc partout : tout ce qui le précède est de
   * l'emballage, et l'alphabet base64url ne contient aucun guillemet.
   */
  const joined = text.replace(/\s+/g, "");
  const marker = CODE_MARKER.exec(joined);
  if (marker === null) {
    return { ok: false, error: ReplayCodeError.NotACode };
  }
  const cleaned = joined.slice(marker.index).replace(TRAILING_QUOTES, "");
  const format = Number(marker[1]);
  if (format === LEGACY_FORMAT) {
    return { ok: false, error: ReplayCodeError.OtherVersion };
  }
  if (format !== CODE_FORMAT) {
    return { ok: false, error: ReplayCodeError.UnknownFormat };
  }
  if (cleaned.length > MAX_CODE_LENGTH) {
    return { ok: false, error: ReplayCodeError.Unreadable };
  }
  let parsed: unknown;
  try {
    const json = await inflateBounded(fromBase64Url(cleaned.slice(marker[0].length)));
    if (json === null) {
      return { ok: false, error: ReplayCodeError.Unreadable };
    }
    parsed = JSON.parse(new TextDecoder().decode(json));
  } catch {
    return { ok: false, error: ReplayCodeError.Unreadable };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: ReplayCodeError.Unreadable };
  }
  const envelope = parsed as Partial<SharedReplay>;
  if (typeof envelope.fingerprint !== "string" || !isReplayData(envelope.data)) {
    return { ok: false, error: ReplayCodeError.Unreadable };
  }
  /*
   * La carte vient d'un texte collé : on ne la charge que si elle est au registre, et par l'URL du
   * registre — jamais par celle du code, qui pourrait viser n'importe quel hôte.
   */
  const mapId = mapIdFromUrl(envelope.data.mapUrl);
  const mapUrl = mapId === undefined ? undefined : mapUrlFromId(mapId);
  if (mapUrl === undefined) {
    return { ok: false, error: ReplayCodeError.Unreadable };
  }
  return {
    ok: true,
    replay: { fingerprint: envelope.fingerprint, data: { ...envelope.data, mapUrl } },
  };
}
