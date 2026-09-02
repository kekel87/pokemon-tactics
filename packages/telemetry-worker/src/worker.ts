/**
 * Worker de télémétrie — endpoint unique `POST /e` (plan 196).
 *
 * Le chemin est volontairement anodin : `/track`, `/collect`, `/analytics` et `/count` sont des
 * motifs d'URL que les listes de filtrage visent directement. Le spike de l'étape 1 a montré que
 * le vrai — et seul — adversaire est le bloqueur installé chez le joueur, pas la plateforme
 * (décision #881 : itch n'impose ni CSP ni sandbox).
 */

import { handleDashboard } from "./dashboard";
import {
  categorizeBrowser,
  categorizeOs,
  checkAccess,
  EventKind,
  isAllowedOrigin,
  MAX_BODY_BYTES,
  primaryLanguage,
  ValidationFailure,
  validateEnvelope,
} from "./validate";
import { dayStamp, visitorHash } from "./visitor";

export interface Env {
  database: D1Database;
  rateLimiter: RateLimit;
  /** Sel du haché de visiteur. Posé par `wrangler secret put visitorSecret`, absent du dépôt. */
  visitorSecret?: string;
  /** Mot de passe du relevé live. Posé par `wrangler secret put dashboardPassword`. Sans lui, la
   *  route `/tableau` reste inaccessible — jamais ouverte par omission. */
  dashboardPassword?: string;
}

const ENDPOINT_PATH = "/e";
const DASHBOARD_PATH = "/tableau";

function statusFor(reason: ValidationFailure): number {
  switch (reason) {
    case ValidationFailure.MethodNotAllowed:
      return 405;
    case ValidationFailure.BodyTooLarge:
      return 413;
    case ValidationFailure.OriginNotAllowed:
    case ValidationFailure.BodyNotJson:
    case ValidationFailure.KindUnknown:
    case ValidationFailure.BuildInvalid:
    case ValidationFailure.PlatformUnknown:
      return 400;
  }
}

/**
 * Toute réponse porte l'en-tête CORS, y compris les refus : sans lui le repli `fetch` du client
 * voit sa promesse rejetée et remplit la console — un bruit qu'on ne veut pas plus sur les chemins
 * d'erreur que sur le chemin normal. `sendBeacon`, lui, ne lit jamais la réponse.
 *
 * L'origine est **vérifiée** avant d'être reflétée, et non simplement recopiée : refléter une
 * origine arbitraire ferait de cette fonction un piège dès qu'on la réutilise ailleurs.
 * `Vary: Origin` évite qu'un cache intermédiaire ne serve la réponse d'une origine à une autre.
 */
function respond(status: number, origin: string | null): Response {
  const headers = new Headers({ Vary: "Origin" });
  if (isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return new Response(null, { status, headers });
}

export default {
  async fetch(request: Request<unknown, IncomingRequestCfProperties>, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");

    const { pathname } = new URL(request.url);

    // Relevé live, protégé par mot de passe. Traité avant tout le reste : ce n'est pas une
    // collecte, donc ni l'origine, ni le limiteur, ni la validation d'enveloppe ne le concernent.
    if (pathname === DASHBOARD_PATH) {
      return handleDashboard(request, env.database, env.dashboardPassword);
    }

    if (pathname !== ENDPOINT_PATH) {
      return respond(404, origin);
    }

    // Le client est écrit pour rester une requête CORS « simple », donc sans préflight. Répondre
    // quand même à OPTIONS supprime une classe entière de défaillance silencieuse plutôt que de la
    // confier à une consigne côté appelant.
    if (request.method === "OPTIONS") {
      const preflight = respond(204, origin);
      preflight.headers.set("Access-Control-Allow-Methods", "POST");
      preflight.headers.set("Access-Control-Max-Age", "86400");
      return preflight;
    }

    // 🔴 Méthode et origine AVANT de toucher au corps. `request.text()` bufferise la totalité de la
    // requête : le faire pour une origine qu'on refuse de toute façon placerait le garde-fou de
    // quota en aval de la dépense qu'il prétend éviter.
    const access = checkAccess({ method: request.method, origin });
    if (!access.ok) {
      return respond(statusFor(access.reason), origin);
    }

    // Refus au vu de l'en-tête déclaré, avant lecture. Il est déclaratif donc non fiable — le
    // plafond réel reste mesuré sur le corps lu par `validateEnvelope`.
    const declaredLength = Number(request.headers.get("Content-Length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return respond(413, origin);
    }

    // Clé de limitation : l'IP de la connexion. Elle sert de clé en mémoire chez Cloudflare et
    // n'est NI écrite en base NI journalisée — la garantie de la décision #879 porte sur les
    // écritures, et celle-ci n'en est pas une.
    const ip = request.headers.get("CF-Connecting-IP");
    const { success } = await env.rateLimiter.limit({ key: ip ?? "unknown" });
    if (!success) {
      return respond(429, origin);
    }

    const validation = validateEnvelope(await request.text());
    if (!validation.ok) {
      // On ne renvoie jamais le motif au client : il n'en a aucun usage, et le taire évite de
      // documenter gratuitement les garde-fous à qui voudrait les contourner.
      return respond(statusFor(validation.reason), origin);
    }

    const { kind, build, platform, payload } = validation.envelope;

    // Les données d'audience ne concernent que la fréquentation : les deux événements de partie
    // n'en ont pas besoin, et ne pas les renseigner est aussi une façon de ne pas les collecter.
    const userAgent = request.headers.get("User-Agent");
    const audience =
      kind === EventKind.Session
        ? {
            visitor: await visitorHash({
              secret: env.visitorSecret,
              ip,
              userAgent,
              day: dayStamp(new Date()),
            }),
            country: request.cf?.country ?? null,
            browser: categorizeBrowser(userAgent),
            os: categorizeOs(userAgent),
            language: primaryLanguage(request.headers.get("Accept-Language")),
          }
        : { visitor: null, country: null, browser: null, os: null, language: null };

    try {
      await env.database
        .prepare(
          `INSERT INTO events
             (received_at, kind, build, platform, visitor, country, browser, os, lang, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          Date.now(),
          kind,
          build,
          platform,
          audience.visitor,
          audience.country,
          audience.browser,
          audience.os,
          audience.language,
          JSON.stringify(payload),
        )
        .run();
    } catch (error) {
      // Une base indisponible ne doit pas produire une réponse d'erreur : le client n'en ferait
      // rien (il n'y a ni file d'attente ni réessai côté jeu, par choix) et un 500 ne servirait
      // qu'à remplir sa console. On perd l'événement, sciemment.
      //
      // 🔴 Mais on le DIT. Sans cette trace, une erreur de programmation — table absente parce que
      // la migration n'a pas été appliquée, binding mal nommé — se traduirait par un Worker qui
      // répond 204 à tout sans jamais rien écrire, et rien nulle part ne le signalerait. C'est le
      // mode de défaillance le plus probable d'un premier déploiement.
      //
      // Ne journalise que le nom et le message de l'erreur D1, jamais la requête ni les valeurs
      // liées : celles-ci ne contiennent ni IP ni agent brut (garantie #879, testée), mais la règle
      // reste de ne pas élargir la surface.
      console.error("telemetry insert failed", {
        name: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    return respond(204, origin);
  },
} satisfies ExportedHandler<Env>;
