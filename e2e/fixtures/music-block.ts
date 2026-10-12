import type { Browser, BrowserContext } from "@playwright/test";

/** Les pistes de musique livrées par le build : `assets/audio/music/<id>.mp3`, 1 à 2 Mo chacune. */
const MUSIC_FILES = /\/assets\/audio\/music\/[^/]+\.mp3$/;

/** Cette adresse est celle d'une piste de musique — ce que le harnais bloque. */
export function isMusicFile(url: string): boolean {
  return MUSIC_FILES.test(new URL(url).pathname);
}

/**
 * Coupe le TÉLÉCHARGEMENT des musiques pour un contexte de navigateur (plan 240).
 *
 * 🔴 **Pourquoi à la racine.** Aucun test n'écoute : une piste téléchargée puis décodée — des
 * dizaines de Mo en mémoire — ne sert à rien, et le thème des menus se charge derrière la barre de
 * démarrage, donc à chaque page ouverte. Le harnais semait auparavant `musicVolume: 0` pour
 * l'éviter : les réglages testés n'étaient alors plus ceux du produit, et trois scénarios des
 * Réglages devaient encore semer `volume: 0` par-dessus pour toucher à la ligne Musique sans rien
 * charger. Bloquer la requête laisse tous les volumes à leurs défauts.
 *
 * Une requête avortée rejette le `fetch` tout de suite : le lecteur rend une piste muette, la barre
 * de démarrage n'attend pas son plafond (prouvé en unitaire, `audio-preload.test.ts`) et rien ne
 * remonte en `pageerror` (`dom/music-blocked.spec.ts`). Les sons d'interface (`assets/audio/ui/`)
 * et le paquet de sons des combats ne sont PAS bloqués.
 *
 * Deux portes, et aucune autre : la fixture `context` pour le contexte par défaut, et
 * {@link newHarnessContext} pour tout contexte de plus.
 */
export async function blockMusicDownloads(context: BrowserContext): Promise<void> {
  await context.route(
    (url) => isMusicFile(url.href),
    (route) => route.abort(),
  );
}

/**
 * Un contexte de navigateur de plus (un pair en ligne, un profil du banc de mesure), aux réglages du
 * harnais : locale `fr-FR`, musiques bloquées. 🔴 La SEULE création de contexte de `e2e/` — un
 * contexte créé à la main téléchargerait ses musiques sans faire rougir aucun test.
 */
export async function newHarnessContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({ locale: "fr-FR" });
  await blockMusicDownloads(context);
  return context;
}
