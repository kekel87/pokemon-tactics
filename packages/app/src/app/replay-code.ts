/*
 * Le code d'un replay (plan 242) : un combat terminé, réduit à une chaîne de texte qu'on colle.
 *
 * Comme la sauvegarde de reprise (plan 181), on ne stocke que les ENTRÉES du combat — carte, équipes,
 * placements, graine, journal d'actions. Rejouer ce journal sur un moteur neuf reconstruit tout le
 * reste, exactement. Le code est donc court, mais lié à la version du jeu qui l'a produit : une mise à
 * jour peut changer un calcul, et un vieux code se rejouerait alors de travers sans que rien ne le
 * dise. Un autre `buildVersion` est refusé avec un message clair plutôt que rejoué faux.
 *
 * Le format est versionné (`format`) pour qu'un export par événements, qui survivrait aux mises à
 * jour, puisse s'ajouter plus tard sans casser les codes existants.
 */

import type { Action, PlacementEntry, PlacementTeam } from "@pokemon-tactic/core";
import { mapIdFromUrl, mapUrlFromId } from "../maps/map-identity";
import type { CombatSetup } from "./screens";

/** Marqueur : distingue « ce n'est pas un code de replay » de « ce code est abîmé ». */
const CODE_PREFIX = "PTR1.";
const CODE_FORMAT = 1;

/** Tout ce qu'il faut pour rebâtir la position de départ d'un combat, puis le rejouer. */
export interface ReplayData {
  mapUrl: string;
  setup: CombatSetup;
  placementTeams: PlacementTeam[];
  placements: PlacementEntry[];
  seed: number;
  actions: Action[];
}

interface ReplayEnvelope {
  format: number;
  buildVersion: string;
  data: ReplayData;
}

export const ReplayCodeError = {
  /** Le texte ne commence pas par le marqueur : ce n'est pas un code de replay. */
  NotACode: "not-a-code",
  /** Le marqueur y est mais le contenu est tronqué ou abîmé. */
  Unreadable: "unreadable",
  /** Un format que cette version du jeu ne connaît pas. */
  UnknownFormat: "unknown-format",
  /** Produit par une autre version du jeu : rejoué, il raconterait peut-être un autre combat. */
  OtherVersion: "other-version",
} as const;
export type ReplayCodeError = (typeof ReplayCodeError)[keyof typeof ReplayCodeError];

export type ReplayDecodeResult =
  | { readonly ok: true; readonly data: ReplayData }
  | { readonly ok: false; readonly error: ReplayCodeError };

/**
 * Le setup tel qu'il voyage dans un code : sans ce qui n'a de sens que pour la partie vivante.
 *
 * Le code du salon et l'identifiant de télémétrie sont retirés — un code partagé ne doit pas faire
 * fuiter l'adresse d'un salon. `localSeat` reste : il dit « partie en ligne » et pilote la règle de
 * Vœu Soin, que le replay doit reproduire à l'identique.
 */
function shareableSetup(setup: CombatSetup): CombatSetup {
  const {
    roomCode: _roomCode,
    battleId: _battleId,
    telemetryTeams: _telemetryTeams,
    ...rest
  } = setup;
  return rest;
}

async function pipeThrough(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
  const piped = new Blob([bytes]).stream().pipeThrough(stream);
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
  return Array.isArray(teams) && teams.length > 0;
}

export async function encodeReplayCode(data: ReplayData, buildVersion: string): Promise<string> {
  const envelope: ReplayEnvelope = {
    format: CODE_FORMAT,
    buildVersion,
    data: { ...data, setup: shareableSetup(data.setup) },
  };
  const json = new TextEncoder().encode(JSON.stringify(envelope));
  const compressed = await pipeThrough(json, new CompressionStream("deflate-raw"));
  return `${CODE_PREFIX}${toBase64Url(compressed)}`;
}

export async function decodeReplayCode(
  text: string,
  buildVersion: string,
): Promise<ReplayDecodeResult> {
  // Un code collé depuis un chat arrive souvent coupé en lignes, ou entouré d'espaces.
  const cleaned = text.replace(/\s+/g, "");
  if (!cleaned.startsWith(CODE_PREFIX)) {
    return { ok: false, error: ReplayCodeError.NotACode };
  }
  let parsed: unknown;
  try {
    const compressed = fromBase64Url(cleaned.slice(CODE_PREFIX.length));
    const json = await pipeThrough(compressed, new DecompressionStream("deflate-raw"));
    parsed = JSON.parse(new TextDecoder().decode(json));
  } catch {
    return { ok: false, error: ReplayCodeError.Unreadable };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: ReplayCodeError.Unreadable };
  }
  const envelope = parsed as Partial<ReplayEnvelope>;
  if (envelope.format !== CODE_FORMAT) {
    return { ok: false, error: ReplayCodeError.UnknownFormat };
  }
  if (envelope.buildVersion !== buildVersion) {
    return { ok: false, error: ReplayCodeError.OtherVersion };
  }
  if (!isReplayData(envelope.data)) {
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
  return { ok: true, data: { ...envelope.data, mapUrl } };
}
