// itch sert le jeu dans une iframe sandboxée qui bloque le script GoatCounter
// (`count.js`). On envoie donc les events via l'endpoint pixel `/count` (beacon
// Image), ce qui passe le sandbox. Cookieless/anonyme. No-op en dev et hôte
// inconnu pour ne pas polluer les stats. Le path est préfixé par la plateforme
// (`/itch/...` vs `/ghp/...`) pour lire les stats combinées ou séparées.

const ENDPOINT = "https://kekel87.goatcounter.com/count";

export const AnalyticsEvent = {
  GameLoaded: "game-loaded",
  MainMenu: "main-menu",
  BattleMode: "battle-mode",
  TeamBuilder: "team-builder",
  MapSelect: "map-select",
  BattleStart: "battle-start",
  BattleEnd: "battle-end",
} as const;
export type AnalyticsEvent = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

let gameLoadedTracked = false;

function platformPrefix(): string | null {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return null;
  }
  if (host.includes("itch.zone")) {
    return "itch";
  }
  if (host.includes("github.io")) {
    return "ghp";
  }
  return null;
}

export function trackEvent(event: AnalyticsEvent): void {
  const prefix = platformPrefix();
  if (!prefix) {
    return;
  }
  const path = `/${prefix}/${event}`;
  // rnd : cache-buster, sinon le navigateur peut servir le beacon depuis son cache.
  const url = `${ENDPOINT}?p=${encodeURIComponent(path)}&e=true&rnd=${Date.now()}`;
  try {
    const beacon = new Image();
    beacon.src = url;
  } catch {
    // L'analytics ne doit jamais casser le jeu.
  }
}

export function trackGameLoadedOnce(): void {
  if (gameLoadedTracked) {
    return;
  }
  gameLoadedTracked = true;
  trackEvent(AnalyticsEvent.GameLoaded);
}
