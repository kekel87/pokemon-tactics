/**
 * Agrégation et rendu du relevé de télémétrie — module PARTAGÉ (plan 196, étape 8).
 *
 * Deux consommateurs, un seul générateur :
 *   - `scripts/telemetry-stats.ts` → rapport terminal + fichier local (`/stats`)
 *   - `worker.ts` → page live protégée par mot de passe (`GET /tableau`)
 *
 * Il vit dans le paquet du Worker et **ne dépend de rien** : ni `packages/data`, ni `packages/app`,
 * ni aucune globale de Cloudflare. C'est ce qui permet au Worker de servir la page sans importer un
 * paquet du jeu, et au script de la produire hors ligne.
 *
 * ⚠️ Les noms de cartes sont recopiés ici (`MAP_NAMES`) faute de pouvoir importer `maps-registry.ts`
 * du paquet `app`. Un test de parité (`report.test.ts`) casse si une carte est ajoutée sans mettre
 * cette table à jour — c'est le garde-fou contre la dérive, pas la bonne foi.
 *
 * Les statistiques d'usage (Pokemon, talents, objets, attaques) ne figurent PAS sur la page : elles
 * restent au rapport terminal, où le script les traduit depuis `packages/data`. Décision humaine du
 * 2026-09-02 — la page est un relevé de fréquentation, l'analyse d'usage est un autre sujet.
 */

export interface EventRow {
  id: number;
  /**
   * Horloge SERVEUR. La colonne SQL s'appelle `received_at` ; les deux requêtes l'aliasent en
   * `receivedAt` (`SELECT received_at AS receivedAt`) plutôt que de traîner un nom en serpent dans
   * tout le TypeScript — c'est la pratique normale, et ça évite de désactiver une règle de nommage
   * pour un détail de schéma.
   */
  receivedAt: number;
  kind: "session" | "battle_started" | "battle_ended";
  build: string;
  platform: string;
  visitor: string | null;
  country: string | null;
  browser: string | null;
  os: string | null;
  lang: string | null;
  payload: string;
}

export interface SessionPayload {
  first?: boolean;
  uiLanguage?: string;
  inputSource?: string | null;
  screen?: string;
  referrer?: string | null;
  screens?: Record<string, number>;
  actions?: Record<string, number>;
}

export interface TeamMemberPayload {
  species: string;
  ability: string;
  item: string | null;
  nature: string;
  moves: string[];
}

export interface TeamPayload {
  side: number;
  source: string;
  generated?: boolean;
  members?: TeamMemberPayload[];
}

export interface BattleStartedPayload {
  battleId: string;
  mode: string;
  map: string;
  format: string;
  humans: number;
  ai: number;
  autoPlacement: boolean;
  teams: TeamPayload[];
}

export interface MemberOutcomePayload {
  species: string;
  moves: Record<string, number>;
  knockedOutTurn: number | null;
  knockedOutCause: string | null;
}

export interface BattleEndedPayload {
  battleId: string;
  winnerSide: number | null;
  draw: boolean;
  durationMs: number;
  turns: number;
  outcomes: MemberOutcomePayload[];
}

/**
 * Fuseau d'affichage. Un Worker n'a **aucun fuseau local** : il tourne en UTC, donc `toLocaleString`
 * y rendait deux heures de moins que l'heure française (relevé le 2026-09-02 : « 18:27 » pour 20h27).
 * Le découpage par jour souffrait du même biais — un événement à 00h30 heure de Paris comptait pour
 * la veille.
 *
 * ⚠️ Le sel du haché de visiteur reste en **UTC** (`dayStamp`, `visitor.ts`) et ne doit PAS suivre ce
 * fuseau : c'est le mécanisme de confidentialité, il doit tourner à heure fixe indépendamment de qui
 * regarde le relevé.
 */
const TIME_ZONE = "Europe/Paris";

/** Fenêtres proposées en un clic. Le graphique journalier plafonne à 90 colonnes. */
const RANGES: readonly number[] = [7, 30, 90, 365];

/** `sv-SE` rend un format déjà ISO (`2026-09-02`), sans avoir à recomposer les morceaux. */
const DAY_FORMAT = new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE });
const STAMP_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  dateStyle: "short",
  timeStyle: "short",
});

/** Jour ISO dans le fuseau d'affichage : `2026-09-02`. */
function dayKeyOf(timestamp: number): string {
  return DAY_FORMAT.format(new Date(timestamp));
}

/**
 * Clé de seau selon le pas. La semaine est ramenée à son **lundi**, le mois à son premier jour.
 *
 * L'arithmétique se fait sur la date du calendrier de Paris traitée comme une date UTC : c'est sans
 * risque puisque la valeur ne sert que de clé de regroupement, jamais d'instant.
 */
function bucketKeyOf(timestamp: number, granularity: Granularity): string {
  const day = dayKeyOf(timestamp);
  if (granularity === Granularity.Day) {
    return day;
  }
  if (granularity === Granularity.Month) {
    return `${day.slice(0, 7)}-01`;
  }
  const date = new Date(`${day}T00:00:00Z`);
  // `getUTCDay()` rend 0 le dimanche : on le ramène à 6 pour que la semaine commence le lundi.
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

const MONTH_FORMAT = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", month: "short" });

/** Étiquette d'axe : `02/09` au jour et à la semaine, `sept. 26` au mois. */
function bucketLabelOf(key: string, granularity: Granularity): string {
  const [year, month, day] = key.split("-");
  if (granularity === Granularity.Month) {
    return `${MONTH_FORMAT.format(new Date(`${key}T00:00:00Z`))} ${year?.slice(2) ?? ""}`;
  }
  return `${day}/${month}`;
}

/** Nombre de seaux à afficher pour une fenêtre donnée. */
function bucketCountFor(days: number, granularity: Granularity): number {
  if (granularity === Granularity.Day) {
    return days;
  }
  if (granularity === Granularity.Week) {
    return Math.ceil(days / 7);
  }
  return Math.ceil(days / 30);
}

export type Tally = Map<string, number>;

export function bump(tally: Tally, key: string, by = 1): void {
  tally.set(key, (tally.get(key) ?? 0) + by);
}

export function top(tally: Tally, limit = 12): [string, number][] {
  return [...tally].sort((left, right) => right[1] - left[1]).slice(0, limit);
}

export interface Report {
  days: number;
  rows: number;
  visits: number;
  uniqueVisitors: number;
  visitsByPlatform: Tally;
  countries: Tally;
  browsers: Tally;
  systems: Tally;
  languages: Tally;
  screenSizes: Tally;
  inputSources: Tally;
  referrers: Tally;
  screens: Tally;
  actions: Tally;
  battlesStarted: number;
  battlesEnded: number;
  abandonRate: number | null;
  battlesByMap: Tally;
  battlesByFormat: Tally;
  battlesByMode: Tally;
  teamSources: Tally;
  /** Statistiques d'usage à la Showdown : présence dans une équipe bâtie par un humain. */
  speciesUsage: Tally;
  abilityUsage: Tally;
  itemUsage: Tally;
  movesetUsage: Tally;
  /** Attaques réellement lancées, tous combats terminés confondus. */
  movesCast: Tally;
  knockOutCauses: Tally;
  averageTurns: number | null;
  averageDurationMs: number | null;
  /** Versions du jeu, comptées par VISITE. Rapport terminal uniquement. */
  builds: Tally;
  /** Série temporelle continue, au pas de `granularity` — trous compris. */
  series: SeriesPoint[];
  granularity: Granularity;
}

/**
 * Pas de la série temporelle. **Dérivé de la fenêtre**, comme le font itch.io (son sélecteur
 * « Daily »), Plausible et GA4 : au-delà de quelques semaines, une colonne par jour devient
 * illisible et on agrège. Mon premier jet plafonnait à 90 colonnes, ce qui **perdait** les données
 * au-delà au lieu de les regrouper — relevé par l'humain le 2026-09-02.
 */
export const Granularity = {
  Day: "day",
  Week: "week",
  Month: "month",
} as const;
export type Granularity = (typeof Granularity)[keyof typeof Granularity];

export function granularityFor(days: number): Granularity {
  if (days <= 31) {
    return Granularity.Day;
  }
  if (days <= 120) {
    return Granularity.Week;
  }
  return Granularity.Month;
}

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: "par jour",
  week: "par semaine",
  month: "par mois",
};

export interface SeriesPoint {
  /** Clé du seau, du plus ancien au plus récent. */
  key: string;
  /** Étiquette d'axe, déjà lisible. */
  label: string;
  visits: number;
  started: number;
  ended: number;
}

/**
 * Étapes vers le combat, dans l'ordre du parcours.
 *
 * ⚠️ Ce sont des **cumuls d'atteintes**, pas un taux de conversion par visite : les compteurs
 * partent en deltas et ne sont rattachés à aucun identifiant de visite — c'est le prix assumé du
 * schéma sans suivi. Un même joueur qui revient au menu deux fois compte deux fois.
 */
const FUNNEL_STAGES: readonly string[] = ["main-menu", "battle-mode", "map-select", "team-select"];

export function buildReport(rows: EventRow[], days: number): Report {
  const report: Report = {
    days,
    rows: rows.length,
    visits: 0,
    uniqueVisitors: 0,
    visitsByPlatform: new Map(),
    countries: new Map(),
    browsers: new Map(),
    systems: new Map(),
    languages: new Map(),
    screenSizes: new Map(),
    inputSources: new Map(),
    referrers: new Map(),
    screens: new Map(),
    actions: new Map(),
    battlesStarted: 0,
    battlesEnded: 0,
    abandonRate: null,
    battlesByMap: new Map(),
    battlesByFormat: new Map(),
    battlesByMode: new Map(),
    teamSources: new Map(),
    speciesUsage: new Map(),
    abilityUsage: new Map(),
    itemUsage: new Map(),
    movesetUsage: new Map(),
    movesCast: new Map(),
    knockOutCauses: new Map(),
    averageTurns: null,
    averageDurationMs: null,
    builds: new Map(),
    series: [],
    granularity: granularityFor(days),
  };

  const visitors = new Set<string>();
  const granularity = granularityFor(days);
  const perBucket = new Map<string, SeriesPoint>();
  const dayEntry = (timestamp: number): SeriesPoint => {
    const key = bucketKeyOf(timestamp, granularity);
    const existing = perBucket.get(key);
    if (existing) {
      return existing;
    }
    const fresh: SeriesPoint = {
      key,
      label: bucketLabelOf(key, granularity),
      visits: 0,
      started: 0,
      ended: 0,
    };
    perBucket.set(key, fresh);
    return fresh;
  };
  let turnsTotal = 0;
  let durationTotal = 0;

  for (const row of rows) {
    if (row.kind === "session") {
      const payload = JSON.parse(row.payload) as SessionPayload;
      // 🔴 Les VISITES se comptent par le drapeau `first`, jamais par le nombre de lignes : les
      // compteurs partent en deltas, donc une visite produit une à plusieurs lignes (décision #883).
      if (payload.first === true) {
        report.visits += 1;
        bump(report.visitsByPlatform, row.platform);
        dayEntry(row.receivedAt).visits += 1;
        // 🔴 Par VISITE et non par ligne. Compté sur toutes les lignes, ce total valait le nombre
        // d'événements — « 8 versions » pour 4 visites, ce qui ne veut rien dire (relevé par
        // l'humain le 2026-09-02). Il ne sert qu'à repérer qu'on mélange deux versions du jeu.
        bump(report.builds, row.build);
      }
      if (row.visitor) {
        visitors.add(row.visitor);
      }
      if (row.country) {
        bump(report.countries, row.country);
      }
      if (row.browser) {
        // Famille sans version (« Firefox 154 » → « Firefox ») : à l'échelle du jeu, une ligne par
        // version noierait la liste pour une information qu'on n'exploite pas. Le regroupement se
        // fait ICI et non dans le Worker — la version reste en base, disponible le jour où elle
        // servirait (vérifier la compatibilité d'une API, par exemple).
        bump(report.browsers, row.browser.replace(/ \d+$/, ""));
      }
      if (row.os) {
        bump(report.systems, row.os);
      }
      if (row.lang) {
        bump(report.languages, row.lang);
      }
      if (payload.screen) {
        bump(report.screenSizes, payload.screen);
      }
      if (payload.inputSource) {
        bump(report.inputSources, payload.inputSource);
      }
      bump(report.referrers, payload.referrer ?? "(direct ou iframe)");
      for (const [screen, count] of Object.entries(payload.screens ?? {})) {
        bump(report.screens, screen, count);
      }
      for (const [action, count] of Object.entries(payload.actions ?? {})) {
        bump(report.actions, action, count);
      }
      continue;
    }

    if (row.kind === "battle_started") {
      const payload = JSON.parse(row.payload) as BattleStartedPayload;
      report.battlesStarted += 1;
      dayEntry(row.receivedAt).started += 1;
      bump(report.battlesByMap, payload.map);
      bump(report.battlesByFormat, payload.format);
      bump(report.battlesByMode, payload.mode);
      for (const team of payload.teams) {
        bump(report.teamSources, team.source);
        // Seules les équipes bâties par un humain portent une composition : c'est voulu, une équipe
        // aléatoire ne renseignerait que le générateur (décision du 2026-08-31).
        for (const member of team.members ?? []) {
          bump(report.speciesUsage, member.species);
          bump(report.abilityUsage, member.ability);
          if (member.item) {
            bump(report.itemUsage, member.item);
          }
          for (const move of member.moves) {
            bump(report.movesetUsage, move);
          }
        }
      }
      continue;
    }

    const payload = JSON.parse(row.payload) as BattleEndedPayload;
    report.battlesEnded += 1;
    dayEntry(row.receivedAt).ended += 1;
    turnsTotal += payload.turns;
    durationTotal += payload.durationMs;
    for (const outcome of payload.outcomes) {
      for (const [move, count] of Object.entries(outcome.moves)) {
        bump(report.movesCast, move, count);
      }
      if (outcome.knockedOutCause) {
        bump(report.knockOutCauses, outcome.knockedOutCause);
      }
    }
  }

  report.uniqueVisitors = visitors.size;
  // Axe CONTINU, seaux vides compris : un trou dans la fréquentation est une information, et une
  // série qui saute les périodes creuses déforme la lecture du rythme.
  //
  // On recule en millisecondes puis on formate DANS le fuseau : recomposer une date en UTC pour
  // l'afficher ensuite à Paris décalait la série d'un jour près des changements d'heure.
  const now = Date.now();
  const step = granularity === Granularity.Day ? 1 : granularity === Granularity.Week ? 7 : 30;
  const buckets = new Map<string, SeriesPoint>();
  for (let offset = bucketCountFor(days, granularity) - 1; offset >= 0; offset -= 1) {
    const key = bucketKeyOf(now - offset * step * 86_400_000, granularity);
    if (!buckets.has(key)) {
      buckets.set(
        key,
        perBucket.get(key) ?? {
          key,
          label: bucketLabelOf(key, granularity),
          visits: 0,
          started: 0,
          ended: 0,
        },
      );
    }
  }
  report.series = [...buckets.values()].sort((left, right) => left.key.localeCompare(right.key));
  if (report.battlesStarted > 0) {
    report.abandonRate = 1 - report.battlesEnded / report.battlesStarted;
  }
  if (report.battlesEnded > 0) {
    report.averageTurns = turnsTotal / report.battlesEnded;
    report.averageDurationMs = durationTotal / report.battlesEnded;
  }
  return report;
}

export const PLATFORM_LABELS: Record<string, string> = { itch: "itch.io", ghp: "GitHub Pages" };
export const SOURCE_LABELS: Record<string, string> = {
  "human-built": "bâtie à la main",
  "human-random": "aléatoire, choix humain",
  "ai-random": "aléatoire de l'IA",
  "ai-built": "sauvegardée, à l'IA",
};
export const CAUSE_LABELS: Record<string, string> = {
  damage: "dégâts",
  fall: "chute",
  "lethal-terrain": "terrain létal",
  "ring-out": "sortie d'arène",
};
/**
 * Noms FR des cartes. Recopiés de `packages/app/src/maps/maps-registry.ts`, que ce paquet n'a pas le
 * droit d'importer — un Worker ne tire aucun paquet du jeu. `report.test.ts` vérifie la parité, donc
 * ajouter une carte sans toucher à cette table fait échouer le gate.
 */
export const MAP_NAMES: Record<string, string> = {
  "simple-arena": "Arène Simple",
  forest: "Forêt Dense",
  "cramped-cave": "Grotte Exiguë",
  volcano: "Volcan Actif",
  swamp: "Tourbière",
  desert: "Dunes et Ruines",
  "naval-arena": "Archipel des Pontons",
  toundra: "Toundra",
  "le-mur": "Le Mur",
};
export const SCREEN_LABELS: Record<string, string> = {
  "main-menu": "Menu principal",
  "battle-mode": "Mode de combat",
  "team-builder": "Constructeur d'équipe",
  "map-select": "Sélection de carte",
  "team-select": "Sélection d'équipe",
  credits: "Crédits",
  controls: "Écran des contrôles",
};
export const ACTION_LABELS: Record<string, string> = {
  "showdown-modal": "Échange Showdown ouvert",
  "showdown-import-ok": "Import Showdown réussi",
  "showdown-import-fail": "Import Showdown ÉCHOUÉ",
  "showdown-export": "Export Showdown",
  "team-save": "Équipe créée",
  "team-delete": "Équipe supprimée",
  "team-generate": "Équipe générée",
  "language-change": "Langue changée",
  "fullscreen-toggle": "Plein écran basculé",
  "combat-menu-open": "Menu de combat ouvert",
  "combat-menu-restart": "Partie recommencée",
  "combat-menu-forfeit": "Partie abandonnée",
  "combat-menu-quit": "Quitté en gardant la sauvegarde",
  "resume-offered": "Reprise proposée",
  "resume-accepted": "Reprise acceptée",
  "remap-binding": "Touche réassignée",
};
export const INPUT_LABELS: Record<string, string> = {
  pointer: "Souris",
  keyboard: "Clavier",
  gamepad: "Manette",
  touch: "Tactile",
};
export const MODE_LABELS: Record<string, string> = {
  "local-vs-ai": "solo contre l'IA",
  "local-hotseat": "deux joueurs sur le même écran",
};

/**
 * Noms de pays et de langues en français, par `Intl.DisplayNames` — donc **sans embarquer de table**
 * de 250 pays dans le Worker. Les instances sont créées une fois par isolat, c'est bon marché.
 */
const REGION_NAMES = new Intl.DisplayNames(["fr"], { type: "region" });
const LANGUAGE_NAMES = new Intl.DisplayNames(["fr"], { type: "language" });

/** Codes que Cloudflare renvoie et qui ne sont pas des pays. */
const SPECIAL_REGIONS: Record<string, string> = { T1: "Réseau Tor", XX: "Origine inconnue" };

/** `FR` → `🇫🇷` : les deux lettres deviennent des indicateurs régionaux, aucune image à charger. */
function flagOf(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) {
    return "";
  }
  return String.fromCodePoint(...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

export function countryLabel(code: string): string {
  const special = SPECIAL_REGIONS[code];
  if (special) {
    return special;
  }
  try {
    const name = REGION_NAMES.of(code);
    return name && name !== code ? `${flagOf(code)} ${name}` : code;
  } catch {
    return code;
  }
}

/**
 * Langue en clair (`fr` → « français »). **Pas de drapeau** : une langue n'est pas un pays — le
 * français se parle en France, au Canada, en Belgique, en Suisse, en Afrique — et on ne stocke que
 * la langue principale, sans région (décision #879). Coller un drapeau reviendrait à inventer une
 * information qu'on a délibérément choisi de ne pas collecter.
 */
export function languageLabel(tag: string): string {
  try {
    const name = LANGUAGE_NAMES.of(tag);
    return name && name !== tag ? name : tag;
  } catch {
    return tag;
  }
}

export function label(dictionary: Record<string, string>, key: string): string {
  return dictionary[key] ?? key;
}

/* ------------------------------------------------------- tableau de bord HTML */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlBars(tally: Tally, translate: (key: string) => string = (k) => k): string {
  const entries = top(tally);
  if (entries.length === 0) {
    return `<p class="empty">Rien sur la période.</p>`;
  }
  const max = Math.max(...entries.map(([, count]) => count));
  const rows = entries
    .map(([key, count]) => {
      const width = ((count / max) * 100).toFixed(1);
      return `<li><span class="k">${escapeHtml(translate(key))}</span><span class="bar" role="presentation"><i style="inline-size:${width}%"></i></span><b class="v">${count}</b></li>`;
    })
    .join("");
  return `<ul class="bars">${rows}</ul>`;
}

/* ------------------------------------------------------------- graphiques */

/**
 * Couleurs de série : les deux premiers créneaux de la palette catégorielle validée du projet,
 * dans l'ORDRE FIXE (jamais cyclées, jamais réassignées selon le rang). Validées aux six contrôles
 * dans les deux modes — séparation CVD ΔE 24.7 en clair, 26.8 en sombre.
 *
 * L'ambre n'y figure pas : il reste hors des marques.
 */
const SERIES = {
  visits: { label: "Visites", token: "var(--s-visits)" },
  battles: { label: "Parties lancées", token: "var(--s-battles)" },
} as const;

const PLOT = { width: 640, height: 132, padLeft: 30, padRight: 10, padTop: 10, padBottom: 20 };

function shortDay(day: string): string {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

/**
 * Un graphique en colonnes par mesure, empilés — des **petits multiples**, à la manière du tableau
 * de bord d'itch.io.
 *
 * 🔴 C'est ce qui remplace un double axe : deux mesures d'amplitude différente sur une même échelle
 * écrasent la plus petite, et deux échelles sur un même cadre est le pire défaut d'un graphique.
 * Chaque mesure garde donc son cadre et son échelle, l'axe des dates étant commun et aligné.
 *
 * Une seule série par cadre, donc **aucune légende** : le titre nomme la mesure.
 */
function renderDailyChart(
  series: SeriesPoint[],
  key: "visits" | "started" | "ended",
  color: string,
  seriesClass: string,
): string {
  if (series.length === 0) {
    return `<p class="empty">Aucune période sur la fenêtre.</p>`;
  }

  const maxValue = Math.max(1, ...series.map((point) => point[key]));
  // Graduations sur des entiers atteints : un compte d'événements n'a pas de demi-valeur, et une
  // graduation doit nommer une valeur que le graphique touche.
  const ticks =
    maxValue <= 4 ? [...Array(maxValue + 1).keys()] : [0, Math.round(maxValue / 2), maxValue];
  const innerWidth = PLOT.width - PLOT.padLeft - PLOT.padRight;
  const innerHeight = PLOT.height - PLOT.padTop - PLOT.padBottom;
  const slot = innerWidth / series.length;
  // Écart de 2 px entre colonnes voisines, pris sur la surface — jamais deux aplats qui se touchent.
  const barWidth = Math.max(1.5, slot - 2);
  const baseline = PLOT.padTop + innerHeight;

  const grid = ticks
    .map((tick) => {
      const y = baseline - (tick / maxValue) * innerHeight;
      return (
        `<line x1="${PLOT.padLeft}" x2="${PLOT.width - PLOT.padRight}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="grid" />` +
        `<text x="${PLOT.padLeft - 7}" y="${(y + 3.5).toFixed(1)}" class="tick" text-anchor="end">${tick}</text>`
      );
    })
    .join("");

  const columns = series
    .map((point, index) => {
      const value = point[key];
      const x = PLOT.padLeft + index * slot + (slot - barWidth) / 2;
      if (value === 0) {
        return `<rect x="${x.toFixed(1)}" y="${(baseline - 1).toFixed(1)}" width="${barWidth.toFixed(1)}" height="1" class="zero" />`;
      }
      const height = Math.max(3, (value / maxValue) * innerHeight);
      // Extrémité arrondie côté donnée seulement : la base reste ancrée à la ligne de référence.
      const radius = Math.min(3, barWidth / 2);
      return `<rect x="${x.toFixed(1)}" y="${(baseline - height).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${height.toFixed(1)}" rx="${radius.toFixed(1)}" fill="${color}" />`;
    })
    .join("");

  const labelEvery = Math.max(1, Math.ceil(series.length / 6));
  const labels = series
    .map((point, index) =>
      index % labelEvery === 0 || index === series.length - 1
        ? `<text x="${(PLOT.padLeft + index * slot + slot / 2).toFixed(1)}" y="${PLOT.height - 6}" class="tick" text-anchor="middle">${escapeHtml(point.label)}</text>`
        : "",
    )
    .join("");

  const hotspots = series
    .map(
      (point, index) =>
        `<rect x="${(PLOT.padLeft + index * slot).toFixed(1)}" y="${PLOT.padTop}" width="${slot.toFixed(1)}" height="${innerHeight}" class="hot" data-day="${escapeHtml(point.label)}" data-value="${point[key]}" />`,
    )
    .join("");

  return `<div class="plotwrap ${seriesClass}">
    <svg viewBox="0 0 ${PLOT.width} ${PLOT.height}" role="img" aria-label="Série temporelle">
      ${grid}${labels}${columns}
      <g class="hots">${hotspots}</g>
    </svg>
    <div class="tip" hidden></div>
  </div>`;
}

/**
 * Entonnoir de progression vers le combat, en colonnes décroissantes — la forme qu'emploient
 * PostHog et Amplitude.
 *
 * 🔴 **Deux taux par étape, pas un** : c'est la convention du marché et c'est ce qui rend un
 * entonnoir utile.
 *   - « depuis le départ » donne la forme globale du parcours ;
 *   - « depuis l'étape précédente » montre OÙ ça fuit, donc où agir. Sans lui, une étape qui perd
 *     la moitié de son monde se lit comme n'importe quelle autre.
 *
 * On compte des **passages** d'écran et non des joueurs — les compteurs ne sont rattachés à aucune
 * visite. C'est dit par l'étiquette de l'axe, sans paragraphe d'avertissement.
 */
function renderFunnel(report: Report): string {
  const stages = FUNNEL_STAGES.map((stage) => ({
    key: stage,
    name: label(SCREEN_LABELS, stage),
    count: report.screens.get(stage) ?? 0,
  }));
  stages.push({ key: "battles", name: "Combat lancé", count: report.battlesStarted });

  const head = stages[0]?.count ?? 0;
  if (head === 0) {
    return `<p class="empty">Aucun parcours enregistré sur la période.</p>`;
  }
  const tallest = Math.max(...stages.map((entry) => entry.count));

  const columns = stages
    .map((entry, index) => {
      const height = tallest === 0 ? 0 : (entry.count / tallest) * 100;
      const fromStart = Math.round((entry.count / head) * 100);
      const previous = stages[index - 1];
      const step =
        previous === undefined || previous.count === 0
          ? ""
          : `<span class="fstep">${Math.round((entry.count / previous.count) * 100)} %<em> préc.</em></span>`;
      const lost =
        previous !== undefined && previous.count > entry.count
          ? `<span class="flost">−${previous.count - entry.count}</span>`
          : "";
      return `<li>
        <div class="fplot"><i style="block-size:${height.toFixed(1)}%"></i><b>${entry.count}</b></div>
        <span class="fname">${escapeHtml(entry.name)}</span>
        <span class="fstart">${fromStart} %<em> départ</em></span>
        ${step}${lost}
      </li>`;
    })
    .join("");

  return `<ol class="funnel" aria-label="Passages par écran, du menu au combat">${columns}</ol>`;
}

export function renderHtml(report: Report, generatedAt: Date): string {
  const abandon = report.abandonRate === null ? "—" : `${(report.abandonRate * 100).toFixed(0)} %`;
  const turns = report.averageTurns === null ? "—" : report.averageTurns.toFixed(1);
  const duration =
    report.averageDurationMs === null ? "—" : `${(report.averageDurationMs / 60_000).toFixed(1)}`;

  const block = (title: string, body: string): string =>
    `<section class="block"><h3>${escapeHtml(title)}</h3>${body}</section>`;

  return `<title>Pokemon Tactics · Télémétrie</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  :root {
    color-scheme: light;
    --ground: #eef1f4;
    --panel: #ffffff;
    --ink: #12161c;
    --muted: #5b6672;
    --line: #d6dce3;
    --line-soft: #e7ecf1;
    --accent: #2f6f6b;
    --accent-wash: #d8e6e4;
    /* Créneaux 1 et 2 de la palette catégorielle validée, en ordre fixe. Redéfinis pour le fond
       sombre avec les pas prévus pour lui — jamais un simple éclaircissement automatique. */
    --s-visits: #2a78d6;
    --s-battles: #eb6834;
    --ui: "Archivo", ui-sans-serif, system-ui, sans-serif;
    --data: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #0e1316;
      --panel: #151c20;
      --ink: #e8eeee;
      --muted: #8d9b9d;
      --line: #242f35;
      --line-soft: #1c252a;
      --accent: #4db6a4;
      --accent-wash: #1e3733;
      --s-visits: #3987e5;
      --s-battles: #d95926;
    }
  }
  :root[data-theme="dark"] {
    --ground: #0e1316;
    --panel: #151c20;
    --ink: #e8eeee;
    --muted: #8d9b9d;
    --line: #242f35;
    --line-soft: #1c252a;
    --accent: #4db6a4;
    --accent-wash: #1e3733;
    --s-visits: #3987e5;
    --s-battles: #d95926;
  }

  * { box-sizing: border-box; }
  body {
    background: var(--ground);
    color: var(--ink);
    font-family: var(--ui);
    font-size: 15px;
    line-height: 1.5;
    margin: 0;
    padding: 1.5rem 1.25rem 4rem;
  }
  .sheet { max-inline-size: 78rem; margin-inline: auto; }

  header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .4rem .9rem; padding-block-end: .5rem; border-block-end: 2px solid var(--ink); }
  .stamp { font-family: var(--data); font-size: .78rem; color: var(--muted); margin: 0; }
  .ranges { display: flex; gap: .1rem; font-family: var(--data); font-size: .78rem; }
  .ranges a, .ranges b { padding: .15rem .5rem; border-radius: 3px; text-decoration: none; }
  .ranges a { color: var(--muted); }
  .ranges a:hover { color: var(--ink); background: var(--line-soft); }
  .ranges a:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .ranges b { color: var(--panel); background: var(--accent); font-weight: 500; }

  .rail { display: grid; grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr)); background: var(--panel); border: 1px solid var(--line); border-block-start: none; }
  .rail div { padding: 1rem 1.1rem; border-inline-start: 1px solid var(--line-soft); }
  .rail div:first-child { border-inline-start: none; }
  .rail b { display: block; font-family: var(--data); font-size: 1.75rem; font-weight: 500; line-height: 1.05; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
  .rail span { display: block; font-size: .7rem; text-transform: uppercase; letter-spacing: .07em; color: var(--muted); margin-block-start: .35rem; }
  .rail em { font-style: normal; color: var(--muted); font-size: 1rem; font-family: var(--data); }

  /* --- graphiques --- */
  /* Deux colonnes EXPLICITES : auto-fit en créait trois sur écran large, ce qui comprimait
     chaque cadre à ~390 px — et le texte d'un SVG mis à l'échelle rétrécit avec lui, donc les
     graduations tombaient sous 6 px. À deux colonnes, l'échelle du SVG reste proche de 1. */
  .charts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem 2rem; margin-block-start: 2rem; }
  @media (width < 60rem) { .charts { grid-template-columns: minmax(0, 1fr); } }
  .charts.single { grid-template-columns: minmax(0, 44rem); }
  .chartbox h3 { display: flex; align-items: center; gap: .45rem; font-size: .8rem; font-weight: 600; color: var(--muted); margin: 0 0 .6rem; }
  .sw { inline-size: .6rem; block-size: .6rem; border-radius: 2px; flex: none; }
  .plotwrap { position: relative; }
  .plotwrap svg { display: block; inline-size: 100%; block-size: auto; overflow: visible; }
  .grid { stroke: var(--line-soft); stroke-width: 1; }
  .tick { fill: var(--muted); font-family: var(--data); font-size: 11px; }
  .zero { fill: var(--line); }
  .hot { fill: transparent; }
  .hots:hover .hot:hover { fill: var(--accent-wash); fill-opacity: .55; }
  .tip { position: absolute; inset-block-start: 0; pointer-events: none; background: var(--ink); color: var(--panel); font-family: var(--data); font-size: .72rem; padding: .25rem .45rem; border-radius: 3px; white-space: nowrap; transform: translate(-50%, -115%); }


  /* Colonnes décroissantes, façon PostHog / Amplitude. Deux taux par étape : depuis le départ
     (la forme) et depuis l'étape précédente (où ça fuit). */
  /* align-items:start et non end — AUCUN accent grave dans ces commentaires, ils vivent dans un
     littéral de gabarit et le fermeraient. Chaque colonne est une grille dont le nom peut tenir sur
     deux lignes : alignées par le bas, les cadres se décalaient et les barres ne partageaient plus
     de ligne de base. */
  .funnel { list-style: none; margin: 0; padding: 0; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: .5rem; align-items: start; }
  .funnel li { display: grid; gap: .15rem; text-align: center; }
  .fplot { position: relative; display: flex; align-items: end; justify-content: center; block-size: 6.5rem; background: linear-gradient(var(--line-soft), var(--line-soft)) no-repeat center / 100% 1px; }
  .fplot i { display: block; inline-size: 100%; max-inline-size: 3.5rem; background: var(--accent); border-radius: 3px 3px 0 0; min-block-size: 2px; }
  .fplot b { position: absolute; inset-block-start: 0; font-family: var(--data); font-size: .95rem; font-weight: 500; font-variant-numeric: tabular-nums; }
  .fname { font-size: .78rem; line-height: 1.25; text-wrap: balance; margin-block-start: .35rem; }
  .fstart, .fstep { font-family: var(--data); font-size: .72rem; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .fstart em, .fstep em { font-style: normal; font-family: var(--ui); font-size: .68rem; }
  .fstep { color: var(--ink); }
  .flost { font-family: var(--data); font-size: .7rem; color: var(--muted); }
  @media (width < 40rem) {
    .funnel { grid-auto-flow: row; grid-auto-columns: auto; }
    .funnel li { grid-template-columns: 1fr auto; text-align: start; align-items: center; }
    .fplot { block-size: 1.1rem; grid-column: 1 / -1; align-items: stretch; background: none; }
    .fplot i { inline-size: auto; max-inline-size: none; }
    .fplot b { position: static; margin-inline-start: .4rem; }
  }

  .columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(21rem, 1fr)); gap: 0 2.5rem; margin-block-start: 2.25rem; }
  .col h2 { font-family: var(--data); font-size: .75rem; font-weight: 500; text-transform: uppercase; letter-spacing: .12em; color: var(--accent); margin: 0 0 1rem; padding-block-end: .5rem; border-block-end: 1px solid var(--line); }
  .block { padding-block: .9rem; border-block-end: 1px solid var(--line-soft); }
  .block:last-child { border-block-end: none; }
  .block h3 { font-size: .8rem; font-weight: 600; margin: 0 0 .55rem; color: var(--muted); }

  .bars { list-style: none; margin: 0; padding: 0; display: grid; gap: .3rem; }
  .bars li { display: grid; grid-template-columns: minmax(5rem, 13rem) 1fr auto; align-items: center; gap: .7rem; }
  .k { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .88rem; }
  .bar { background: var(--line-soft); block-size: .42rem; overflow: hidden; }
  .bar i { display: block; background: var(--accent); block-size: 100%; }
  .v { font-family: var(--data); font-weight: 500; font-size: .85rem; font-variant-numeric: tabular-nums; color: var(--muted); min-inline-size: 2.2rem; text-align: end; }
  .empty { color: var(--muted); font-size: .85rem; margin: 0; font-style: italic; }

  footer { margin-block-start: 2.75rem; padding-block-start: 1rem; border-block-start: 1px solid var(--line); color: var(--muted); font-size: .8rem; display: grid; gap: .5rem; max-inline-size: 62ch; }
  footer code { font-family: var(--data); font-size: .95em; }
  footer strong { color: var(--ink); font-weight: 600; }
</style>
<div class="sheet">
  <header>
    <nav class="ranges">${RANGES.map((range) => (range === report.days ? `<b>${range} j</b>` : `<a href="?jours=${range}">${range} j</a>`)).join("")}</nav>
    <p class="stamp">${report.days} derniers jours · relevé le ${escapeHtml(STAMP_FORMAT.format(generatedAt))}</p>
  </header>

  <div class="rail">
    <div><b>${report.visits}</b><span>Visites</span></div>
    <div><b>${report.uniqueVisitors}</b><span>Visiteurs / jour</span></div>
    <div><b>${report.battlesStarted}</b><span>Parties lancées</span></div>
    <div><b>${report.battlesEnded}</b><span>Parties finies</span></div>
    <div><b>${abandon}</b><span>Abandon</span></div>
    <div><b>${turns}</b><span>Tours moyens</span></div>
    <div><b>${duration}<em> min</em></b><span>Durée moyenne</span></div>
  </div>

  <section class="charts">
    <div class="chartbox">
      <h3><i class="sw" style="background:${SERIES.visits.token}"></i>Visites ${GRANULARITY_LABELS[report.granularity]}</h3>
      ${renderDailyChart(report.series, "visits", SERIES.visits.token, "s-visits")}
    </div>
    <div class="chartbox">
      <h3><i class="sw" style="background:${SERIES.battles.token}"></i>Parties lancées ${GRANULARITY_LABELS[report.granularity]}</h3>
      ${renderDailyChart(report.series, "started", SERIES.battles.token, "s-battles")}
    </div>
  </section>

  <section class="charts single">
    <div class="chartbox">
      <h3>Progression vers le combat</h3>
      ${renderFunnel(report)}
    </div>
  </section>

  <div class="columns">
    <div class="col">
      <h2>Audience</h2>
      ${block(
        "Visites par plateforme",
        htmlBars(report.visitsByPlatform, (k) => label(PLATFORM_LABELS, k)),
      )}
      ${block("Pays", htmlBars(report.countries, countryLabel))}
      ${block("Navigateurs", htmlBars(report.browsers))}
      ${block("Systèmes", htmlBars(report.systems))}
      ${block("Langues", htmlBars(report.languages, languageLabel))}
      ${block("Tailles d'écran", htmlBars(report.screenSizes))}
      ${block(
        "Sources d'entrée",
        htmlBars(report.inputSources, (k) => label(INPUT_LABELS, k)),
      )}
      ${block("Référents", htmlBars(report.referrers))}
    </div>

    <div class="col">
      <h2>Usage</h2>
      ${block(
        "Actions d'interface",
        htmlBars(report.actions, (k) => label(ACTION_LABELS, k)),
      )}
      ${block(
        "Cartes",
        htmlBars(report.battlesByMap, (k) => label(MAP_NAMES, k)),
      )}
      ${block("Formats", htmlBars(report.battlesByFormat))}
      ${block(
        "Modes",
        htmlBars(report.battlesByMode, (k) => label(MODE_LABELS, k)),
      )}
      ${block(
        "Provenance des équipes",
        htmlBars(report.teamSources, (k) => label(SOURCE_LABELS, k)),
      )}
    </div>
  </div>

  <footer>
    <p><strong>${report.rows}</strong> ligne(s) lues sur la période. Les visiteurs uniques se
    comptent <strong>par jour</strong> et ne s'additionnent pas d'une journée à l'autre.</p>
  </footer>
</div>
<script>
  // Couche de survol : un graphique HTML est interactif par nature. Une seule délégation par cadre,
  // et le repère suit la colonne survolée plutôt qu'un point le plus proche calculé.
  for (const wrap of document.querySelectorAll(".plotwrap")) {
    const tip = wrap.querySelector(".tip");
    if (!tip) continue;
    wrap.addEventListener("pointermove", (event) => {
      const target = event.target;
      if (!(target instanceof SVGRectElement) || !target.classList.contains("hot")) {
        tip.hidden = true;
        return;
      }
      const box = wrap.getBoundingClientRect();
      tip.textContent = target.dataset.day + " · " + target.dataset.value;
      tip.style.insetInlineStart = (event.clientX - box.left) + "px";
      tip.style.insetBlockStart = (event.clientY - box.top) + "px";
      tip.hidden = false;
    });
    wrap.addEventListener("pointerleave", () => {
      tip.hidden = true;
    });
  }
</script>
`;
}
