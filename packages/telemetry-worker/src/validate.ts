/**
 * Validation et catégorisation — fonctions PURES, testées en unitaire (plan 196, étape 2).
 *
 * Le Worker ne valide que l'enveloppe : le type d'événement, la taille, la plateforme et l'origine.
 * Il n'inspecte JAMAIS le contenu métier du payload — c'est le contrat de la décision #868, et ce
 * qui permet au jeu d'ajouter un champ sans migration ni redéploiement.
 *
 * Le contrôle d'accès (`checkAccess`) est séparé de l'analyse du corps (`validateEnvelope`) pour que
 * l'appelant puisse refuser une requête AVANT de bufferiser son corps : un garde-fou de quota placé
 * après la dépense qu'il prétend éviter ne sert à rien.
 */

/** Types d'événements acceptés (décision #878 révisée : trois, pas deux). */
export const EventKind = {
  Session: "session",
  BattleStarted: "battle_started",
  BattleEnded: "battle_ended",
} as const;
export type EventKind = (typeof EventKind)[keyof typeof EventKind];

/** Plateformes de publication, préfixe posé par le client (`platformPrefix()`). */
export const Platform = {
  Itch: "itch",
  GithubPages: "ghp",
} as const;
export type Platform = (typeof Platform)[keyof typeof Platform];

/** Motifs de refus. Const object plutôt qu'union nue : l'appelant compare une constante, pas une chaîne. */
export const ValidationFailure = {
  MethodNotAllowed: "method-not-allowed",
  OriginNotAllowed: "origin-not-allowed",
  BodyTooLarge: "body-too-large",
  BodyNotJson: "body-not-json",
  KindUnknown: "kind-unknown",
  BuildInvalid: "build-invalid",
  PlatformUnknown: "platform-unknown",
} as const;
export type ValidationFailure = (typeof ValidationFailure)[keyof typeof ValidationFailure];

/**
 * Origines autorisées — les deux valeurs MESURÉES au spike de l'étape 1 (décision #881),
 * jamais supposées. Le cas `Origin: null` ne peut pas se produire : il vient d'une iframe
 * sandboxée sans `allow-same-origin`, et celle d'itch ne porte aucun attribut `sandbox`.
 */
export const ALLOWED_ORIGINS: readonly string[] = [
  "https://html-classic.itch.zone",
  "https://kekel87.github.io",
];

/**
 * Plafond du corps, en octets. `sendBeacon` plafonne lui-même à 64 Kio ; on descend bien plus bas
 * parce que nos payloads réels en sont très loin (§ Ce qu'on mesure). Le risque couvert est le
 * quota D1, pas la triche.
 */
export const MAX_BODY_BYTES = 8192;

/**
 * Un build est une version applicative (`__APP_VERSION__`), pas du texte libre : la borner évite
 * qu'un retour à la ligne ou un emoji ne pollue durablement une colonne qu'on lira en tableau.
 */
const BUILD_PATTERN = /^[\w.-]{1,64}$/;

export interface Envelope {
  readonly kind: EventKind;
  readonly build: string;
  readonly platform: Platform;
  /** Contenu métier, non interprété par le Worker. */
  readonly payload: Record<string, unknown>;
}

export type AccessResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: ValidationFailure };

export type ValidationResult =
  | { readonly ok: true; readonly envelope: Envelope }
  | { readonly ok: false; readonly reason: ValidationFailure };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEventKind(value: unknown): value is EventKind {
  return typeof value === "string" && Object.values<string>(EventKind).includes(value);
}

function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && Object.values<string>(Platform).includes(value);
}

/**
 * Contrôle d'accès, sur les seuls en-têtes — donc décidable sans lire le corps.
 *
 * Le POST est la seule méthode acceptée : le repli GET `Image` n'a pas été retenu (décision #881),
 * puisque le spike a montré que le POST passe sur les deux plateformes.
 */
export function checkAccess(input: { method: string; origin: string | null }): AccessResult {
  if (input.method !== "POST") {
    return { ok: false, reason: ValidationFailure.MethodNotAllowed };
  }
  if (!isAllowedOrigin(input.origin)) {
    return { ok: false, reason: ValidationFailure.OriginNotAllowed };
  }
  return { ok: true };
}

export function isAllowedOrigin(origin: string | null): origin is string {
  return origin !== null && ALLOWED_ORIGINS.includes(origin);
}

/**
 * Analyse et valide le corps d'une requête déjà autorisée.
 *
 * Le corps arrive en `string` et non en objet déjà analysé : le client envoie une requête CORS
 * « simple », donc SANS `Content-Type: application/json`, et `request.json()` partirait du mauvais
 * présupposé. On passe par le texte, qui marche quel que soit le type reçu.
 */
export function validateEnvelope(body: string): ValidationResult {
  // Mesuré en octets et non en caractères : un emoji pèse 4 octets pour une seule unité de longueur.
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return { ok: false, reason: ValidationFailure.BodyTooLarge };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, reason: ValidationFailure.BodyNotJson };
  }
  if (!isPlainObject(parsed)) {
    return { ok: false, reason: ValidationFailure.BodyNotJson };
  }

  const { kind, build, platform, payload } = parsed;

  if (!isEventKind(kind)) {
    return { ok: false, reason: ValidationFailure.KindUnknown };
  }
  if (typeof build !== "string" || !BUILD_PATTERN.test(build)) {
    return { ok: false, reason: ValidationFailure.BuildInvalid };
  }
  if (!isPlatform(platform)) {
    return { ok: false, reason: ValidationFailure.PlatformUnknown };
  }

  return {
    ok: true,
    envelope: { kind, build, platform, payload: isPlainObject(payload) ? payload : {} },
  };
}

/**
 * Réduit l'agent utilisateur à une CATÉGORIE (« Firefox 121 »), jamais stocké brut — décision #879 :
 * la limite n'est pas « rien qui décrive l'appareil » mais « rien de brut ». Une catégorie ne
 * réidentifie personne.
 *
 * L'ordre des tests compte : Edge et Opera se déclarent aussi « Chrome », Chrome se déclare aussi
 * « Safari ». On va donc du plus spécifique au plus générique.
 */
export function categorizeBrowser(userAgent: string | null): string | null {
  if (!userAgent) {
    return null;
  }
  const families: readonly (readonly [name: string, token: string])[] = [
    ["Edge", "Edg/"],
    ["Opera", "OPR/"],
    ["Samsung Internet", "SamsungBrowser/"],
    ["Firefox", "Firefox/"],
    ["Chrome", "Chrome/"],
    ["Safari", "Version/"],
  ];
  for (const [name, token] of families) {
    const tokenIndex = userAgent.indexOf(token);
    if (tokenIndex === -1) {
      continue;
    }
    const major = /^(\d{1,4})/.exec(userAgent.slice(tokenIndex + token.length));
    return major ? `${name} ${major[1]}` : name;
  }
  return null;
}

/** Même principe pour le système : une catégorie, sans version ni détail matériel. */
export function categorizeOs(userAgent: string | null): string | null {
  if (!userAgent) {
    return null;
  }
  // Android avant Linux : tout Android se déclare aussi « Linux ».
  const systems: readonly (readonly [name: string, token: string])[] = [
    ["Android", "Android"],
    ["iOS", "iPhone"],
    ["iOS", "iPad"],
    ["Windows", "Windows"],
    ["macOS", "Mac OS X"],
    ["Linux", "Linux"],
  ];
  for (const [name, token] of systems) {
    if (userAgent.includes(token)) {
      return name;
    }
  }
  return null;
}

/**
 * Langue principale d'`Accept-Language`, sans la région : « fr-FR,fr;q=0.9,en;q=0.8 » → « fr ».
 * La région ferait un critère de recoupement de plus pour rien.
 */
export function primaryLanguage(acceptLanguage: string | null): string | null {
  if (!acceptLanguage) {
    return null;
  }
  const first = acceptLanguage.split(",")[0];
  if (first === undefined) {
    return null;
  }
  const tag = first.split(";")[0]?.trim().toLowerCase();
  if (!tag || tag === "*") {
    return null;
  }
  const language = tag.split("-")[0];
  return language && /^[a-z]{2,3}$/.test(language) ? language : null;
}
