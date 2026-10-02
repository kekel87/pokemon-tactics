/**
 * Le vocabulaire FERMÉ des relations du graphe (plan 217).
 *
 * Avant lui, 886 relations portaient 49 verbes, dont des variantes d'orthographe d'un même
 * sens (« découle de » / « decoule-de », « révise » / « revise ») : aucune requête ne pouvait
 * suivre un lien sans connaître toutes ses graphies. Un verbe précis rend le lien
 * exploitable ; un verbe vague (« lié-à ») ne dit rien — d'où `voir-aussi` en dernier
 * recours, jamais suivi.
 *
 * Chaque relation est stockée dans UN seul sens (`de --verbe--> vers`), jamais avec son
 * inverse. `suivi` dit si le hook de rappel montre ce lien dans sa ligne de voisins ; les
 * verbes suivis sont rangés par force décroissante — c'est l'ordre de la ligne `↳`.
 */
export const VERBES = Object.freeze({
  contredit: { sens: "A affirme le contraire de B ; les deux faits sont gardés", suivi: true },
  remplace: { sens: "A rend B caduc (décision renversée, version périmée)", suivi: true },
  résout: {
    sens: "A solde B (plan, décision ou correctif qui clôt une dette, une question)",
    suivi: true,
  },
  "découle-de": { sens: "A est une conséquence de B (cause, décision mère, mesure)", suivi: true },
  révise: { sens: "A modifie, précise ou nuance B sans l'annuler", suivi: true },
  ouvre: { sens: "A fait naître B (dette, question, retour découverts en route)", suivi: true },
  livre: { sens: "A (release, session) livre B (plan, implémentation)", suivi: false },
  planifie: { sens: "A (agenda) ordonne B dans une file de travail", suivi: false },
  "succède-à": {
    sens: "A vient chronologiquement après B (sessions, pointeurs d'agenda)",
    suivi: false,
  },
  "fait-partie-de": { sens: "A est un morceau de B", suivi: false },
  détaille: { sens: "A développe B (section, compte rendu, documentation)", suivi: false },
  concerne: { sens: "A porte sur le sujet B, sans lien plus précis", suivi: false },
  cite: { sens: "A s'appuie sur B ou le mentionne (plan qui cite ses décisions)", suivi: false },
  "voir-aussi": { sens: "dernier recours : rapprochement sans verbe précis", suivi: false },
});

/** Les verbes montrés dans la ligne de voisins du hook, du plus fort au plus faible. */
export const VERBES_SUIVIS = Object.keys(VERBES).filter((verbe) => VERBES[verbe].suivi);

export function estVerbeAdmis(verbe) {
  return Object.hasOwn(VERBES, verbe);
}

/** Refus explicite d'un verbe hors tableau, avec la liste en retour. */
export function verifierVerbe(verbe) {
  if (estVerbeAdmis(verbe)) {
    return { ok: true };
  }
  const liste = Object.entries(VERBES)
    .map(([v, { sens }]) => `  ${v.padEnd(15)} ${sens}`)
    .join("\n");
  return {
    ok: false,
    message: `verbe hors vocabulaire : « ${verbe} ». Verbes admis (sens A --verbe--> B) :\n${liste}`,
  };
}
