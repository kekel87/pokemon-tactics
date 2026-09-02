import { describe, expect, it, vi } from "vitest";
import {
  createSaturatedRateLimiter,
  createTelemetryEnv,
  MockAudienceHeaders,
  MockEnvelope,
  MockOrigin,
} from "./testing/mock-telemetry";
import worker from "./worker";

const ENDPOINT = "https://telemetry.example/e";

function post(
  body: unknown,
  headers: Record<string, string> = {},
): Request<unknown, IncomingRequestCfProperties> {
  return new Request(ENDPOINT, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { Origin: MockOrigin.githubPages, ...headers },
  }) as Request<unknown, IncomingRequestCfProperties>;
}

describe("écriture en base", () => {
  it("écrit une ligne pour une enveloppe conforme et répond 204", async () => {
    const { env, spy } = createTelemetryEnv();
    const response = await worker.fetch(post(MockEnvelope.battleStarted), env);

    expect(response.status).toBe(204);
    expect(spy.rows).toHaveLength(1);
    expect(spy.rows[0]).toMatchObject({
      kind: "battle_started",
      build: "2026.9.1",
      platform: "ghp",
      payload: JSON.stringify({ map: "the-wall" }),
    });
  });

  it("horodate avec l'horloge SERVEUR et non une valeur envoyée par le client", async () => {
    const { env, spy } = createTelemetryEnv();
    const before = Date.now();
    await worker.fetch(post({ ...MockEnvelope.battleStarted, receivedAt: 42 }), env);

    expect(spy.rows[0]?.receivedAt).toBeGreaterThanOrEqual(before);
  });

  it("reflète l'origine autorisée dans l'en-tête CORS et déclare Vary", async () => {
    const { env } = createTelemetryEnv();
    const response = await worker.fetch(
      post(MockEnvelope.battleStarted, { Origin: MockOrigin.itch }),
      env,
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(MockOrigin.itch);
    expect(response.headers.get("Vary")).toBe("Origin");
  });
});

describe("garantie de confidentialité", () => {
  it("🔴 n'écrit JAMAIS l'adresse IP dans aucune colonne", async () => {
    const { env, spy } = createTelemetryEnv();
    await worker.fetch(
      post(MockEnvelope.session, {
        "CF-Connecting-IP": MockAudienceHeaders.ip,
        "User-Agent": MockAudienceHeaders.firefoxOnLinux,
      }),
      env,
    );

    const serialized = JSON.stringify(spy.rows);
    expect(serialized).not.toContain(MockAudienceHeaders.ip);
    expect(serialized).not.toContain("203.0.113");
  });

  it("🔴 n'écrit JAMAIS l'agent utilisateur brut, seulement des catégories", async () => {
    const { env, spy } = createTelemetryEnv();
    await worker.fetch(
      post(MockEnvelope.session, {
        "CF-Connecting-IP": MockAudienceHeaders.ip,
        "User-Agent": MockAudienceHeaders.firefoxOnLinux,
      }),
      env,
    );

    expect(JSON.stringify(spy.rows)).not.toContain(MockAudienceHeaders.firefoxOnLinux);
    expect(spy.rows[0]).toMatchObject({ browser: "Firefox 121", os: "Linux" });
  });

  it("ne renseigne l'audience QUE pour les lignes de fréquentation", async () => {
    const { env, spy } = createTelemetryEnv();
    const audienceHeaders = {
      "CF-Connecting-IP": MockAudienceHeaders.ip,
      "User-Agent": MockAudienceHeaders.chromeOnWindows,
      "Accept-Language": "fr-FR,fr;q=0.9",
    };

    await worker.fetch(post(MockEnvelope.battleStarted, audienceHeaders), env);

    expect(spy.rows[0]).toMatchObject({
      visitor: null,
      country: null,
      browser: null,
      os: null,
      language: null,
    });
  });

  it("renseigne l'audience pour une ligne de fréquentation", async () => {
    const { env, spy } = createTelemetryEnv();
    await worker.fetch(
      post(MockEnvelope.session, {
        "CF-Connecting-IP": MockAudienceHeaders.ip,
        "User-Agent": MockAudienceHeaders.chromeOnWindows,
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      }),
      env,
    );

    expect(spy.rows[0]).toMatchObject({
      browser: "Chrome 130",
      os: "Windows",
      language: "fr",
    });
    expect(spy.rows[0]?.visitor).toMatch(/^[0-9a-f]{32}$/);
  });

  it("laisse la colonne de visiteur vide sans secret configuré, sans faire tomber l'écriture", async () => {
    const { env, spy } = createTelemetryEnv({ secret: "" });
    await worker.fetch(
      post(MockEnvelope.session, { "CF-Connecting-IP": MockAudienceHeaders.ip }),
      env,
    );

    expect(spy.rows).toHaveLength(1);
    expect(spy.rows[0]?.visitor).toBe(null);
  });
});

describe("garde-fous d'entrée", () => {
  it("refuse un chemin autre que /e", async () => {
    const { env, spy } = createTelemetryEnv();
    const request = new Request("https://telemetry.example/analytics", {
      method: "POST",
      body: JSON.stringify(MockEnvelope.battleStarted),
      headers: { Origin: MockOrigin.githubPages },
    }) as Request<unknown, IncomingRequestCfProperties>;

    expect((await worker.fetch(request, env)).status).toBe(404);
    expect(spy.rows).toHaveLength(0);
  });

  it("refuse une origine étrangère sans rien écrire ni reflèter son origine", async () => {
    const { env, spy } = createTelemetryEnv();
    const response = await worker.fetch(
      post(MockEnvelope.battleStarted, { Origin: MockOrigin.foreign }),
      env,
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(null);
    expect(spy.rows).toHaveLength(0);
  });

  it("🔴 refuse une origine étrangère SANS lire son corps", async () => {
    const { env } = createTelemetryEnv();
    const request = post(MockEnvelope.battleStarted, { Origin: MockOrigin.foreign });
    const readBody = vi.spyOn(request, "text");

    await worker.fetch(request, env);

    expect(readBody).not.toHaveBeenCalled();
  });

  it("refuse un GET", async () => {
    const { env } = createTelemetryEnv();
    const request = new Request(ENDPOINT, {
      headers: { Origin: MockOrigin.githubPages },
    }) as Request<unknown, IncomingRequestCfProperties>;

    expect((await worker.fetch(request, env)).status).toBe(405);
  });

  it("répond au préflight OPTIONS en annonçant POST", async () => {
    const { env } = createTelemetryEnv();
    const request = new Request(ENDPOINT, {
      method: "OPTIONS",
      headers: { Origin: MockOrigin.githubPages },
    }) as Request<unknown, IncomingRequestCfProperties>;
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST");
  });

  it("refuse un corps trop gros sur son en-tête déclaré, sans le lire", async () => {
    const { env, spy } = createTelemetryEnv();
    const response = await worker.fetch(
      post(MockEnvelope.battleStarted, { "Content-Length": "99999" }),
      env,
    );

    expect(response.status).toBe(413);
    expect(spy.rows).toHaveLength(0);
  });

  it("refuse un type d'événement inconnu", async () => {
    const { env, spy } = createTelemetryEnv();
    const response = await worker.fetch(
      post({ ...MockEnvelope.battleStarted, kind: "battle_paused" }),
      env,
    );

    expect(response.status).toBe(400);
    expect(spy.rows).toHaveLength(0);
  });

  it("répond 429 quand le limiteur est saturé, sans rien écrire", async () => {
    const { env, spy } = createTelemetryEnv();
    const response = await worker.fetch(post(MockEnvelope.battleStarted), {
      ...env,
      rateLimiter: createSaturatedRateLimiter(),
    });

    expect(response.status).toBe(429);
    expect(spy.rows).toHaveLength(0);
  });
});

describe("échec d'écriture", () => {
  it("répond quand même 204, le client n'ayant aucun usage d'une erreur", async () => {
    const { env } = createTelemetryEnv({ failWrite: new Error("D1_ERROR: no such table: events") });
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await worker.fetch(post(MockEnvelope.battleStarted), env);

    expect(response.status).toBe(204);
    logged.mockRestore();
  });

  it("🔴 journalise l'échec, sans quoi une table absente serait indiscernable d'un succès", async () => {
    const { env } = createTelemetryEnv({ failWrite: new Error("D1_ERROR: no such table: events") });
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await worker.fetch(post(MockEnvelope.battleStarted), env);

    expect(logged).toHaveBeenCalledWith("telemetry insert failed", {
      name: "Error",
      message: "D1_ERROR: no such table: events",
    });
    logged.mockRestore();
  });

  it("ne journalise ni l'IP ni l'agent brut dans le message d'échec", async () => {
    const { env } = createTelemetryEnv({ failWrite: new Error("D1_ERROR: no such table: events") });
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await worker.fetch(
      post(MockEnvelope.session, {
        "CF-Connecting-IP": MockAudienceHeaders.ip,
        "User-Agent": MockAudienceHeaders.firefoxOnLinux,
      }),
      env,
    );

    const serialized = JSON.stringify(logged.mock.calls);
    expect(serialized).not.toContain(MockAudienceHeaders.ip);
    expect(serialized).not.toContain(MockAudienceHeaders.firefoxOnLinux);
    logged.mockRestore();
  });
});
