import type { BattleEvent } from "@pokemon-tactic/core";
import type { BattleFeedback } from "@pokemon-tactic/view-core";
import {
  type BattleLogContext,
  type BattleLogEntry,
  formatBattleEvent,
} from "./BattleLogFormatter.js";
import type { UiDomConfig } from "./config.js";
import { el, scrollByStep } from "./dom-helpers.js";

/**
 * BattleLog — DOM/CSS battle log panel (plan 121 step
 * 4b-4). Collapsible panel, top-right, that formats each battle event through
 * the shared `formatBattleEvent` and appends a coloured line (team dot on the
 * first referenced Pokémon). Implements the orchestrator's `BattleFeedback`
 * port (`report`), replacing the 4a no-op. Native scroll, `aria-live` polite.
 */

/*
 * Le journal garde TOUTES les lignes du combat (retour humain 2026-09-16, première partie en ligne :
 * « faudrait pouvoir remonter le journal depuis le début du combat »).
 *
 * Il était plafonné à 50 lignes, et les plus anciennes n'étaient pas masquées mais DÉTRUITES du DOM :
 * remonter au début était impossible par construction, la donnée n'existait plus. Un combat est borné
 * en tours — 39 en moyenne sur la télémétrie des 30 derniers jours — donc quelques centaines de
 * lignes, ce qui ne justifie pas de virtualiser. Si un jour une mêlée à 12 rend la liste coûteuse, on
 * le MESURERA avant de compliquer.
 */

/**
 * Marge sous laquelle on considère la liste « collée en bas ». Non nulle parce qu'un défilement
 * fractionnaire (zoom navigateur, densité d'écran) laisse un reliquat de moins d'un pixel qui ferait
 * croire, à tort, que le joueur a remonté.
 */
const BOTTOM_STICK_TOLERANCE_PX = 4;

/** Ce qui reste à défiler sous la partie visible de la liste. */
function distanceFromBottom(list: HTMLElement): number {
  return list.scrollHeight - list.scrollTop - list.clientHeight;
}

export interface BattleLogOptions {
  /** Name/language resolvers for `formatBattleEvent`. */
  context: BattleLogContext;
  /** Instance id → 1-based team index (for the line's team-colour dot), or null. */
  teamOf: (pokemonId: string) => number | null;
  /** Localise the panel title (host-injected, plan 125 Phase 4). */
  translate: UiDomConfig["translate"];
  /**
   * Capuchons de défilement, construits par l'hôte (plan 189, décision 8).
   *
   * Ils vont en pied de liste et n'apparaissent que **quand elle déborde** : contrairement à la
   * timeline, qui déborde toujours, le journal naît **vide** et annoncerait un contrôle sans effet.
   *
   * ⚠️ La touche qui **ouvre** le journal n'est pas ici : le panneau est en `overflow: hidden` et,
   * replié, sa boîte EST celle de l'en-tête — un indice ajouté dedans se retrouvait *dans* le bouton
   * (retour humain 2026-08-26) et, sous l'en-tête, aurait été rogné. L'appelant l'accroche donc SOUS
   * le panneau via `withKeyHint`, dans la rangée.
   *
   * Construits par l'hôte parce que `ui-dom` ne lit pas les bindings — c'est `key-legend.ts` qui sait
   * quelle touche est liée à quoi.
   */
  keyHints?: {
    readonly scrollUp?: HTMLElement | null;
    readonly scrollDown?: HTMLElement | null;
  };
}

export interface BattleLog extends BattleFeedback {
  readonly element: HTMLElement;
  /** Step the entry list (keyboard / gamepad, plan 184 — it only scrolled by wheel and drag). */
  scrollByStep(delta: 1 | -1): void;
  /** Ouvrir / refermer le panneau — le repli n'existait qu'au clic sur l'en-tête (plan 186). */
  toggleCollapsed(): void;
  /**
   * Retraduit le titre et RÉÉCRIT chaque ligne déjà écrite dans la langue courante (plan 221).
   *
   * Les lignes sont du texte DOM figé : changer de langue en plein combat sans les réécrire donnait
   * un journal mi-français mi-anglais (décision #828, qui retirait le bouton pour cette raison).
   */
  relocalize(): void;
  destroy(): void;
}

/**
 * Rangée haut-droite du chrome de combat : `[bouton plein écran] [journal]` (plan 180-a).
 *
 * Vit ici, dans le package qui définit `.bl-log-row` et son ancrage au coin, plutôt que fabriquée à
 * la main côté app avec la classe en dur. Deux raisons : la classe est un contrat de `ui-dom`, et
 * surtout c'est la rangée qui déclare `--bl-header-size` — un journal monté hors d'elle perdrait
 * silencieusement la hauteur de son en-tête. Passer par cette fonction rend ce cas inatteignable.
 *
 * Les enfants sont ajoutés dans l'ordre reçu : le premier se retrouve à gauche du journal.
 */
export function createBattleLogRow(...children: readonly HTMLElement[]): HTMLElement {
  const row = el("div", "bl-log-row");
  row.append(...children);
  return row;
}

/**
 * Un bouton du chrome et, **sous** lui, le capuchon de sa touche (plan 189, décision 10).
 *
 * La règle est générale et pas un cas particulier du journal : un bouton du chrome annonce son
 * raccourci là où on le regarde. Avant, la seule façon d'apprendre que `J` ouvre le journal était
 * d'aller lire l'écran de contrôles — que rien n'invite à ouvrir.
 *
 * Renvoie le bouton **nu** quand il n'y a pas d'indice à montrer (aucune touche liée, ou un appareil
 * sans clavier) : pas de colonne vide qui décalerait la rangée pour rien.
 */
export function withKeyHint(button: HTMLElement, hint: HTMLElement | null): HTMLElement {
  if (hint === null) {
    return button;
  }
  const column = el("div", "bl-row-item");
  column.append(button, hint);
  return column;
}

export function createBattleLog(options: BattleLogOptions): BattleLog {
  const { context, teamOf, translate, keyHints } = options;

  const root = el("div", "bl-panel", "battle-log");
  root.dataset.collapsed = "true";

  const header = el("button", "bl-header", "battle-log-toggle");
  header.type = "button";
  const title = el("span", "bl-title", "battle-log-title");
  title.textContent = translate("log.title");
  const burger = el("span", "bl-burger");
  // `▤` (cadre + lignes) plutôt que le burger `☰` (plan 187) : le burger part au bouton du menu de
  // combat, dont il est le glyphe conventionnel, et un panneau de texte se décrit mieux par un cadre
  // ligné. Celui-ci est de toute façon étiqueté par le titre « Journal » juste à côté.
  burger.textContent = "▤";
  burger.setAttribute("aria-hidden", "true");
  header.append(title, burger);

  const list = el("ol", "bl-list");
  list.setAttribute("aria-live", "polite");

  /*
   * Indices de défilement (plan 189, décision 8) — un à CHAQUE extrémité de la liste, masqués par
   * défaut.
   *
   * `battle-log.css` garde sa barre en `thin`, mais rien ne dit AVEC QUOI défiler au clavier. Groupés
   * en pied, les deux se lisaient comme une rangée de quatre capuchons sans rapport avec la liste
   * (retour humain 2026-08-26) ; à chaque bout, la direction du capuchon désigne le bord vers lequel
   * il emmène — même disposition que l'ordre de jeu.
   */
  const scrollHintRow = (child: HTMLElement | null | undefined, testId: string): HTMLElement => {
    const row = el("div", "bl-scroll-hint", testId);
    row.hidden = true;
    row.setAttribute("aria-hidden", "true");
    if (child) {
      row.append(child);
    }
    return row;
  };
  const scrollHintTop = scrollHintRow(keyHints?.scrollUp, "battle-log-scroll-hint-top");
  const scrollHintBottom = scrollHintRow(keyHints?.scrollDown, "battle-log-scroll-hint-bottom");
  const hasScrollHint =
    scrollHintTop.childElementCount > 0 || scrollHintBottom.childElementCount > 0;

  /**
   * La liste déborde-t-elle ? Une comparaison, pas un sondage : appelée quand le contenu change et
   * quand la boîte change de taille — les deux seuls moments où la réponse peut bouger.
   */
  const refreshScrollHint = (): void => {
    if (!hasScrollHint) {
      return;
    }
    const overflowing = list.scrollHeight > list.clientHeight;
    scrollHintTop.hidden = !overflowing;
    scrollHintBottom.hidden = !overflowing;
  };

  /*
   * `clientHeight` vaut 0 tant que le panneau est replié ou hors flux : sans cet observateur, l'indice
   * resterait masqué au premier dépliage, moment où il est le plus utile.
   */
  const resizeObserver =
    hasScrollHint && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => refreshScrollHint())
      : null;
  resizeObserver?.observe(list);

  root.append(header, scrollHintTop, list, scrollHintBottom);

  const setCollapsed = (collapsed: boolean): void => {
    root.dataset.collapsed = String(collapsed);
    header.setAttribute("aria-expanded", String(!collapsed));
  };
  setCollapsed(true);
  header.addEventListener("click", () => setCollapsed(root.dataset.collapsed !== "true"));

  /**
   * Les événements reçus, dans l'ordre — la seule source dont `relocalize` peut réécrire les lignes.
   * Les formater une seconde fois est sûr : `formatBattleEvent` est pur.
   */
  const events: BattleEvent[] = [];

  function buildEntry(entry: BattleLogEntry): HTMLLIElement {
    const item = el("li", "bl-entry");
    // Runtime color from the formatter (data-driven per entry) — no CSS equivalent.
    item.style.color = entry.color;

    const firstPokemonId = entry.pokemonIds[0];
    const team = firstPokemonId ? teamOf(firstPokemonId) : null;
    if (team !== null) {
      const dot = el("span", "bl-dot");
      dot.dataset.team = String(team);
      item.append(dot);
    }

    const text = el("span", "bl-text", "battle-log-entry");
    text.textContent = entry.message;
    item.append(text);
    return item;
  }

  /** Les lignes d'un événement — aucune quand il n'en mérite pas. */
  const entriesOf = (event: BattleEvent): readonly BattleLogEntry[] => {
    const result = formatBattleEvent(event, context);
    if (!result) {
      return [];
    }
    return Array.isArray(result) ? result : [result];
  };

  function appendEntry(entry: BattleLogEntry): void {
    const item = buildEntry(entry);

    /*
     * On ne recolle en bas QUE si on y était déjà.
     *
     * Garder toutes les lignes ne suffisait pas : recoller inconditionnellement ramenait le joueur
     * en bas à chaque ligne écrite, donc remonter lire le début du combat était impossible dès que
     * l'adversaire agissait — or c'est exactement pendant le tour d'en face qu'on a le temps de
     * lire. Le besoin n'était traité qu'à moitié (revue de code, 2026-09-16).
     *
     * Mesuré AVANT l'insertion : après, `scrollHeight` a déjà grandi et la comparaison croit
     * toujours qu'on a décollé du bas.
     */
    const wasAtBottom = distanceFromBottom(list) <= BOTTOM_STICK_TOLERANCE_PX;
    list.append(item);
    if (wasAtBottom) {
      list.scrollTop = list.scrollHeight;
    }
    refreshScrollHint();
  }

  return {
    element: root,
    scrollByStep: (delta) => scrollByStep(list, delta),
    toggleCollapsed: () => setCollapsed(root.dataset.collapsed !== "true"),
    report: (event: BattleEvent) => {
      events.push(event);
      for (const entry of entriesOf(event)) {
        appendEntry(entry);
      }
    },
    relocalize: () => {
      title.textContent = translate("log.title");
      // Le joueur qui lisait le début du combat le retrouve : on rend la même distance au bas de la
      // liste, pas le même `scrollTop` — les lignes traduites n'ont pas la même hauteur.
      const distance = distanceFromBottom(list);
      const wasAtBottom = distance <= BOTTOM_STICK_TOLERANCE_PX;
      // Un seul remplacement : reposer les lignes une à une forçait une mise en page par ligne. La
      // région live est coupée le temps de la réécriture, sinon un lecteur d'écran relirait tout le
      // combat — ce ne sont pas des lignes nouvelles.
      list.removeAttribute("aria-live");
      list.replaceChildren(...events.flatMap(entriesOf).map(buildEntry));
      requestAnimationFrame(() => list.setAttribute("aria-live", "polite"));
      list.scrollTop = wasAtBottom
        ? list.scrollHeight
        : list.scrollHeight - list.clientHeight - distance;
      refreshScrollHint();
    },
    destroy: () => {
      resizeObserver?.disconnect();
      root.remove();
    },
  };
}
