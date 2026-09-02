/**
 * Route du relevé live — `GET /tableau` (plan 196, étape 8, volet distant).
 *
 * Le Worker agrège à la lecture et rend la page lui-même, en réutilisant `report.ts` — le même
 * module que `pnpm stats`. Aucune logique dupliquée : c'est ce qui a rendu le live acceptable, une
 * fois la page débarrassée des statistiques d'usage qui exigeaient `packages/data`.
 *
 * 🔴 **Privé par authentification HTTP basique.** Sans elle l'URL serait publique, et une URL de
 * `*.workers.dev` finit par être découverte. Le mot de passe vit dans `wrangler secret put`, jamais
 * dans le dépôt. Le navigateur le demande une fois et le retient — d'où un accès depuis n'importe
 * quelle machine sans rien installer.
 */

import { buildReport, type EventRow, renderHtml } from "./report";

/** Fenêtre par défaut, et plafond : au-delà, une lecture pourrait devenir coûteuse pour rien. */
const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

/**
 * Comparaison à temps constant. Un `===` sur un mot de passe fuit sa longueur et ses premiers
 * caractères par le temps de réponse — mesurable à distance, et gratuit à éviter.
 */
function constantTimeEquals(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

function unauthorized(): Response {
  return new Response(null, {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Relevé de télémétrie", charset="UTF-8"' },
  });
}

/**
 * Vérifie l'en-tête `Authorization`. Rend `false` aussi quand **aucun mot de passe n'est
 * configuré** : mieux vaut une route inaccessible qu'une route ouverte par omission.
 */
function isAuthorized(request: Request, expected: string | undefined): boolean {
  if (!expected) {
    return false;
  }
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Basic ")) {
    return false;
  }
  let decoded: string;
  try {
    decoded = atob(header.slice("Basic ".length));
  } catch {
    return false;
  }
  // Le nom d'utilisateur n'est pas vérifié : un seul lecteur, un seul secret à retenir.
  const password = decoded.slice(decoded.indexOf(":") + 1);
  return constantTimeEquals(password, expected);
}

function daysFrom(url: URL): number {
  const raw = Number(url.searchParams.get("jours"));
  if (!Number.isInteger(raw) || raw < 1) {
    return DEFAULT_DAYS;
  }
  return Math.min(raw, MAX_DAYS);
}

export async function handleDashboard(
  request: Request,
  database: D1Database,
  password: string | undefined,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(null, { status: 405 });
  }
  if (!isAuthorized(request, password)) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const days = daysFrom(url);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  const { results } = await database
    .prepare(
      `SELECT id, received_at AS receivedAt, kind, build, platform, visitor, country, browser, os, lang, payload
         FROM events WHERE received_at >= ?1 ORDER BY id`,
    )
    .bind(since)
    .all<EventRow>();

  const page = renderHtml(buildReport(results ?? [], days), new Date());
  return new Response(page, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Jamais mis en cache : un relevé servi depuis un cache serait un relevé faux, et il ne doit
      // pas rester sur le disque d'un navigateur partagé.
      "Cache-Control": "no-store",
      // La page ne charge que ses propres styles et une police Google : rien d'autre n'est autorisé.
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
