import { describe, expect, it } from "vitest";
import { handleDashboard } from "./dashboard";
import { createReadableDatabase } from "./testing/mock-telemetry";

const PASSWORD = "mot-de-passe-de-test";
const URL_DASHBOARD = "https://telemetry.example/tableau";

function basic(password: string, user = "kekel"): Headers {
  return new Headers({ Authorization: `Basic ${btoa(`${user}:${password}`)}` });
}

describe("authentification", () => {
  it("🔴 refuse sans en-tête d'autorisation, et annonce le défi", async () => {
    const { database } = createReadableDatabase([]);
    const response = await handleDashboard(new Request(URL_DASHBOARD), database, PASSWORD);

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Basic");
  });

  it("🔴 refuse quand AUCUN mot de passe n'est configuré, plutôt que d'ouvrir la route", async () => {
    const { database } = createReadableDatabase([]);
    const request = new Request(URL_DASHBOARD, { headers: basic(PASSWORD) });

    expect((await handleDashboard(request, database, undefined)).status).toBe(401);
    expect((await handleDashboard(request, database, "")).status).toBe(401);
  });

  it("refuse un mauvais mot de passe", async () => {
    const { database } = createReadableDatabase([]);
    const request = new Request(URL_DASHBOARD, { headers: basic("mauvais") });

    expect((await handleDashboard(request, database, PASSWORD)).status).toBe(401);
  });

  it("refuse un en-tête qui n'est pas du Basic", async () => {
    const { database } = createReadableDatabase([]);
    const request = new Request(URL_DASHBOARD, {
      headers: new Headers({ Authorization: `Bearer ${PASSWORD}` }),
    });

    expect((await handleDashboard(request, database, PASSWORD)).status).toBe(401);
  });

  it("refuse un Basic dont la charge n'est pas du base64", async () => {
    const { database } = createReadableDatabase([]);
    const request = new Request(URL_DASHBOARD, {
      headers: new Headers({ Authorization: "Basic ***pas-du-base64***" }),
    });

    expect((await handleDashboard(request, database, PASSWORD)).status).toBe(401);
  });

  it("accepte le bon mot de passe, quel que soit le nom d'utilisateur", async () => {
    const { database } = createReadableDatabase([]);
    for (const user of ["kekel", "", "peu-importe"]) {
      const request = new Request(URL_DASHBOARD, { headers: basic(PASSWORD, user) });
      expect((await handleDashboard(request, database, PASSWORD)).status).toBe(200);
    }
  });

  it("accepte un mot de passe contenant des deux-points", async () => {
    const { database } = createReadableDatabase([]);
    const password = "avec:des:deux-points";
    const request = new Request(URL_DASHBOARD, { headers: basic(password) });

    expect((await handleDashboard(request, database, password)).status).toBe(200);
  });

  it("refuse une méthode autre que GET, avant même de regarder le mot de passe", async () => {
    const { database } = createReadableDatabase([]);
    const request = new Request(URL_DASHBOARD, { method: "POST", headers: basic(PASSWORD) });

    expect((await handleDashboard(request, database, PASSWORD)).status).toBe(405);
  });
});

describe("réponse", () => {
  it("rend la page et interdit toute mise en cache", async () => {
    const { database } = createReadableDatabase([]);
    const request = new Request(URL_DASHBOARD, { headers: basic(PASSWORD) });
    const response = await handleDashboard(request, database, PASSWORD);

    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(await response.text()).toContain("Pokemon Tactics · Télémétrie");
  });

  it("agrège les lignes lues et les fait apparaître dans la page", async () => {
    const { database } = createReadableDatabase([
      {
        id: 1,
        receivedAt: Date.now(),
        kind: "session",
        build: "v2026.9.1",
        platform: "ghp",
        visitor: "abc",
        country: "FR",
        browser: "Firefox 154",
        os: "Linux",
        lang: "fr",
        payload: JSON.stringify({ first: true, screens: { "main-menu": 1 } }),
      },
    ]);
    const request = new Request(URL_DASHBOARD, { headers: basic(PASSWORD) });
    const page = await (await handleDashboard(request, database, PASSWORD)).text();

    expect(page).toContain("Firefox");
    expect(page).not.toContain("Firefox 154");
    expect(page).toContain("GitHub Pages");
  });

  it("lit la fenêtre demandée, la plafonne, et retombe sur 30 jours si elle est absurde", async () => {
    const { database, windows } = createReadableDatabase([]);
    const headers = basic(PASSWORD);

    await handleDashboard(new Request(`${URL_DASHBOARD}?jours=7`, { headers }), database, PASSWORD);
    await handleDashboard(new Request(`${URL_DASHBOARD}?jours=0`, { headers }), database, PASSWORD);
    await handleDashboard(
      new Request(`${URL_DASHBOARD}?jours=9999`, { headers }),
      database,
      PASSWORD,
    );

    const days = windows.map((since) => Math.round((Date.now() - since) / 86_400_000));
    expect(days).toEqual([7, 30, 365]);
  });
});
