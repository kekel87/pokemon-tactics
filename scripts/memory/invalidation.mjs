/**
 * Les gardes de `--invalidate` : marquer un fait comme faux ou périmé SANS le supprimer.
 *
 * Plan 217. Le graphe raturait à la main — 115 observations portaient « PÉRIMÉ »,
 * « remplacé », « OBSOLÈTE » ou « ✅ RÉSOLU » au fil du texte, et la recherche les servait
 * comme des faits vivants. `--invalidate` préfixe l'observation d'un marqueur que le moteur
 * (`fts.mjs`) et le hook de rappel savent écarter, et garde le texte d'origine lisible par
 * `--open`.
 *
 * Une correction = invalider l'ancien fait + ajouter le nouveau. Jamais un rejet de
 * l'anti-doublon : un fait faux ne doit pas pouvoir bloquer sa propre correction (leçon
 * de Governed Shared Memory, arXiv 2606.24535).
 *
 * Module PUR, sur le modèle de `forget-guards.mjs` : il reçoit ce que l'entité contient et
 * rend un verdict. `query.mjs` lit, écrit, imprime et sort.
 */
import { refusFragmentCourt } from "./forget-guards.mjs";
import { estInvalide, MARQUEUR_INVALIDE } from "./fts.mjs";

/** Une raison de quelques mots au moins : « faux » seul n'apprend rien au lecteur suivant. */
const RAISON_MIN = 8;

export const MotifRefusInvalidation = Object.freeze({
  /** Autre chose que `<nom> <fragment> <raison>` : presque toujours une quotation ratée. */
  Arguments: "arguments",
  FragmentCourt: "fragment-court",
  RaisonCourte: "raison-courte",
  EntiteIntrouvable: "entite-introuvable",
  AucuneCorrespondance: "aucune-correspondance",
  /** Plusieurs observations vivantes contiennent le fragment : on n'en invalide qu'une. */
  Ambigu: "ambigu",
  /** Le fragment ne touche que des observations déjà invalidées. */
  DejaInvalidee: "deja-invalidee",
});

/** Le texte invalidé : marqueur daté, raison, puis le texte d'origine intact. */
export function texteInvalide(observation, raison, date) {
  return `${MARQUEUR_INVALIDE}${date}: ${raison.trim()} — ${observation}`;
}

const FORME_INVALIDE = new RegExp(
  `^${MARQUEUR_INVALIDE}\\d{4}-\\d{2}-\\d{2}: .{${RAISON_MIN},}? — `,
);

/** L'observation porte-t-elle le format exact que fabrique `texteInvalide` ? */
export function estInvalideBienFormee(observation) {
  return FORME_INVALIDE.test(observation);
}

/**
 * Décide ce qu'un `--invalidate` doit faire, sans rien faire.
 *
 * @param {object} demande
 * @param {readonly string[]} demande.arguments Ce qui suit le drapeau : exactement
 *   `[nom, fragment, raison]`.
 * @param {readonly string[] | null} demande.observations Celles de l'entité, ou `null` si elle
 *   n'existe pas.
 * @param {string} demande.date Date du jour, `AAAA-MM-JJ`.
 * @returns {{ ok: true, nom: string, avant: string, apres: string }
 *   | { ok: false, motif: (typeof MotifRefusInvalidation)[keyof typeof MotifRefusInvalidation],
 *       message: string }}
 */
export function planifierInvalidation({ arguments: bruts, observations, date }) {
  if (bruts.length !== 3) {
    return {
      ok: false,
      motif: MotifRefusInvalidation.Arguments,
      message:
        "usage : --invalidate <nom> <fragment> <raison>\n" +
        `  le fragment et la raison sont chacun UN argument, entre guillemets — reçu ${bruts.length}.`,
    };
  }
  const [nom, fragment, raison] = bruts;

  const tropCourt = refusFragmentCourt(fragment);
  if (tropCourt) {
    return { ok: false, motif: MotifRefusInvalidation.FragmentCourt, message: tropCourt };
  }
  if (raison.trim().length < RAISON_MIN) {
    return {
      ok: false,
      motif: MotifRefusInvalidation.RaisonCourte,
      message: `raison trop courte (minimum ${RAISON_MIN} caractères) : dites POURQUOI le fait ne tient plus, et ce qui le remplace.`,
    };
  }
  if (observations === null) {
    return {
      ok: false,
      motif: MotifRefusInvalidation.EntiteIntrouvable,
      message: `entité introuvable : ${nom}`,
    };
  }

  const touchees = observations.filter((o) => o.includes(fragment));
  const vivantes = touchees.filter((o) => !estInvalide(o));
  if (touchees.length === 0) {
    return {
      ok: false,
      motif: MotifRefusInvalidation.AucuneCorrespondance,
      message: `aucune observation de ${nom} ne contient ce fragment (sous-chaîne exacte, casse et accents compris).`,
    };
  }
  if (vivantes.length === 0) {
    return {
      ok: false,
      motif: MotifRefusInvalidation.DejaInvalidee,
      message: `déjà invalidée : rien à faire sur ${nom}.`,
    };
  }
  if (vivantes.length > 1) {
    return {
      ok: false,
      motif: MotifRefusInvalidation.Ambigu,
      message:
        `${vivantes.length} observations de ${nom} contiennent ce fragment — allongez-le pour n'en viser qu'une :\n` +
        vivantes.map((o) => `  · ${o.slice(0, 120)}`).join("\n"),
    };
  }
  const [avant] = vivantes;
  return { ok: true, nom, avant, apres: texteInvalide(avant, raison, date) };
}
