/**
 * Données et doubles de test du Worker de télémétrie.
 *
 * Hors des fichiers `.test.ts` par convention (`.claude/rules/tests.md`) : les tests varient ces
 * bases par diffusion (`{ ...base, kind: "session" }`) plutôt que d'appeler une fabrique à
 * paramètres, qui ramènerait de la logique conditionnelle dans le test.
 *
 * Ce paquet ne tire PAS `packages/core/src/testing/` : un Worker Cloudflare ne doit dépendre
 * d'aucun paquet du jeu.
 */

import type { Env } from "../worker";

/** Les deux origines mesurées au spike de l'étape 1 (décision #881). */
export abstract class MockOrigin {
  static readonly itch = "https://html-classic.itch.zone";
  static readonly githubPages = "https://kekel87.github.io";
  static readonly foreign = "https://evil.example";
}

export abstract class MockEnvelope {
  /** Enveloppe conforme, événement de partie (donc sans données d'audience attendues). */
  static readonly battleStarted = {
    kind: "battle_started",
    build: "2026.9.1",
    platform: "ghp",
    payload: { map: "the-wall" },
  };

  /** Enveloppe conforme, événement de fréquentation (le seul qui porte l'audience). */
  static readonly session = {
    kind: "session",
    build: "2026.9.1",
    platform: "itch",
    payload: { first: true, screens: { "main-menu": 1 } },
  };
}

export abstract class MockAudienceHeaders {
  static readonly ip = "203.0.113.42";

  static readonly firefoxOnLinux =
    "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";

  static readonly chromeOnWindows =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

  static readonly edgeOnWindows =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";

  static readonly operaOnWindows =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/114.0.0.0";

  static readonly safariOnMac =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

  static readonly chromeOnAndroid =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36";

  static readonly safariOnIphone =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1";
}

/** Colonnes liées à la requête préparée, dans l'ordre du `INSERT` du Worker. */
export interface CapturedRow {
  receivedAt: number;
  kind: string;
  build: string;
  platform: string;
  visitor: string | null;
  country: string | null;
  browser: string | null;
  os: string | null;
  language: string | null;
  payload: string;
}

export interface DatabaseSpy {
  readonly rows: CapturedRow[];
  readonly statements: string[];
}

/**
 * Faux `D1Database` qui capture les valeurs liées. Aucun runtime Workers n'est nécessaire : `env`
 * n'est qu'un objet, et c'est ce qui rend testable la garantie centrale de la décision #879 —
 * « l'IP n'apparaît dans aucune écriture » porte sur le câblage des colonnes, donc sur le handler
 * et sur lui seul, hors de portée des fonctions pures.
 */
export function createTelemetryEnv(options: { failWrite?: Error; secret?: string } = {}): {
  env: Env;
  spy: DatabaseSpy;
} {
  const rows: CapturedRow[] = [];
  const statements: string[] = [];

  const database = {
    prepare(statement: string) {
      statements.push(statement);
      return {
        bind(...values: unknown[]) {
          return {
            run() {
              if (options.failWrite) {
                return Promise.reject(options.failWrite);
              }
              rows.push({
                receivedAt: values[0] as number,
                kind: values[1] as string,
                build: values[2] as string,
                platform: values[3] as string,
                visitor: values[4] as string | null,
                country: values[5] as string | null,
                browser: values[6] as string | null,
                os: values[7] as string | null,
                language: values[8] as string | null,
                payload: values[9] as string,
              });
              return Promise.resolve({});
            },
          };
        },
      };
    },
  } as unknown as Env["database"];

  const rateLimiter = {
    limit: () => Promise.resolve({ success: true }),
  } as unknown as Env["rateLimiter"];

  return {
    env: { database, rateLimiter, visitorSecret: options.secret ?? "secret-de-test" },
    spy: { rows, statements },
  };
}

/** Faux limiteur qui refuse tout, pour le chemin 429. */
export function createSaturatedRateLimiter(): Env["rateLimiter"] {
  return { limit: () => Promise.resolve({ success: false }) } as unknown as Env["rateLimiter"];
}
