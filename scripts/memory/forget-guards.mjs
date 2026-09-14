/**
 * Les gardes du seul geste destructeur du dispositif de mémoire : `--forget` et `--forget-all`.
 *
 * 🔴 **Pourquoi ce fichier existe séparément de `query.mjs`.** Les gardes y vivaient en ligne, au
 * milieu d'un script top-level qui ouvre la base puis appelle `process.exit` — donc INTESTABLES :
 * les importer aurait exécuté la ligne de commande. Or ce sont elles, et pas l'accès au geste, qui
 * portent le risque : les deux défauts Critical relevés en revue le 2026-09-14 — arguments
 * surnuméraires jetés en silence, absence de plancher sur le fragment — étaient tous deux ici.
 * Ouvert par `backlog-query-mjs-sans-test-geste-destructeur`, arbitré par `decision-1039`.
 *
 * Ce module est **pur** : aucune base, aucune sortie standard, aucun code de sortie. Il reçoit ce
 * qu'une entité contient et rend un verdict. C'est `query.mjs` qui lit, imprime et sort.
 *
 * Le corollaire, et c'est lui qui rend `decision-1041` tenable : puisque rien ici ne touche au
 * disque, tout se vérifie par un test de table. La deny-list du hook a été écartée parce que ces
 * gardes-ci sont le vrai rempart — encore fallait-il pouvoir le montrer.
 */

/**
 * Longueur utile minimale du fragment.
 *
 * Un fragment d'un caractère correspond à presque tout : sans ce plancher, `--forget-all` devenait
 * un « vide cette entité » qui ne dit pas son nom.
 */
export const FRAGMENT_MIN = 10;

/**
 * Au-delà de combien de correspondances `--forget-all` refuse de servir.
 *
 * Un fragment qui attrape six observations est presque toujours une erreur de quotation, pas une
 * intention. Le refus coûte un second appel ; la sur-suppression coûte une entité.
 */
export const PLAFOND_FORGET_ALL = 5;

/**
 * Les motifs de refus, en const object plutôt qu'en littéraux dispersés (`.claude/rules/core.md`).
 *
 * Relevé en revue le 2026-09-14 : les sept valeurs étaient retapées à la main dans les assertions du
 * test, où une faute de frappe aurait rendu le test vert contre un verdict qui n'existe pas. Le
 * champ n'a d'autre consommateur que le test — `query.mjs` ne lit que `ok` et `message` — donc c'est
 * une prise de test, et elle vaut mieux nommée.
 *
 * `Object.freeze` et non `as const` : ce module est du JavaScript, pas du TypeScript (decision-1039).
 */
export const MotifRefus = Object.freeze({
  /** Autre chose que `<nom> <fragment>` : presque toujours une quotation ratée. */
  Arguments: "arguments",
  /** Fragment sous le plancher de {@link FRAGMENT_MIN} caractères utiles. */
  FragmentCourt: "fragment-court",
  EntiteIntrouvable: "entite-introuvable",
  AucuneCorrespondance: "aucune-correspondance",
  /** Le fragment prendrait TOUTES les observations, donc viderait l'entité. */
  Viderait: "viderait",
  /** Au-delà de {@link PLAFOND_FORGET_ALL} correspondances sous `--forget-all`. */
  Plafond: "plafond",
  /** Plusieurs correspondances sous `--forget` nu, qui n'en assume qu'une. */
  Ambigu: "ambigu",
});

/**
 * Décide ce qu'un `--forget` / `--forget-all` doit faire, sans rien faire.
 *
 * @param {object} demande
 * @param {boolean} demande.tout Vrai pour `--forget-all` : assumer toutes les correspondances.
 * @param {readonly string[]} demande.arguments Ce qui suit le drapeau, tel quel. Doit valoir
 *   exactement `[nom, fragment]` — voir le refus `arguments`.
 * @param {readonly string[] | null} demande.observations Les observations de l'entité visée, ou
 *   `null` si elle n'existe pas. Le module ne sait pas les lire, on les lui donne.
 * @returns {{ ok: true, nom: string, fragment: string, touchees: string[] }
 *   | { ok: false, motif: string, message: string }}
 */
export function planifierOubli({ tout, arguments: bruts, observations }) {
  /*
   * Refuser les arguments surnuméraires, plutôt que de les jeter en silence : sans guillemets,
   * « --forget-all agenda le plan 42 » réduisait le fragment à « le » et vidait l'entité EN
   * SORTANT 0. Le fragment DOIT être un seul argument.
   */
  if (bruts.length !== 2) {
    return {
      ok: false,
      motif: MotifRefus.Arguments,
      message:
        `usage : ${tout ? "--forget-all" : "--forget"} <nom> <fragment>\n` +
        `  le fragment doit être UN seul argument, entre guillemets — reçu ${bruts.length}.`,
    };
  }
  const [nom, fragment] = bruts;

  if (fragment.trim().length < FRAGMENT_MIN) {
    return {
      ok: false,
      motif: MotifRefus.FragmentCourt,
      message:
        `fragment trop court (${fragment.trim().length} caractères utiles, minimum ${FRAGMENT_MIN}).\n` +
        "  Copiez une phrase entière depuis --open : c'est une sous-chaîne exacte, pas un mot-clé.",
    };
  }

  if (observations === null) {
    return {
      ok: false,
      motif: MotifRefus.EntiteIntrouvable,
      message: `entité introuvable : ${nom}`,
    };
  }

  const touchees = observations.filter((observation) => observation.includes(fragment));

  if (touchees.length === 0) {
    /*
     * Dire POURQUOI ça ne correspond pas : sinon l'appelant élargit son fragment, et c'est comme ça
     * qu'on retombe sur une sur-suppression.
     *
     * Refus ASSUMÉ, donc non idempotent : rejouer un `--forget` déjà appliqué échoue. C'est voulu —
     * sur un geste destructeur, « rien à faire » et « je ne trouve pas ce que tu visais » se
     * ressemblent trop pour qu'on les confonde en silence.
     */
    return {
      ok: false,
      motif: MotifRefus.AucuneCorrespondance,
      message:
        `aucune observation de ${nom} ne contient : ${fragment}\n` +
        "  La recherche est une SOUS-CHAÎNE EXACTE, sensible à la casse et aux accents.\n" +
        "  Copiez le texte depuis --open plutôt que de le retaper.",
    };
  }

  /*
   * Vider une entité doit être un geste NOMMÉ, jamais l'effet de bord d'un fragment trop large :
   * une entité sans observation reste indexée et continue de sortir au classement, muette.
   */
  if (touchees.length === observations.length) {
    return {
      ok: false,
      motif: MotifRefus.Viderait,
      message:
        `refus : ce fragment retirerait les ${observations.length} observations de ${nom}, donc la viderait.\n` +
        "  Une entité vide reste indexée et ressort en recherche sans rien dire.\n" +
        "  Précisez le fragment, ou retirez les observations une à une.",
    };
  }

  if (tout && touchees.length > PLAFOND_FORGET_ALL) {
    return {
      ok: false,
      motif: MotifRefus.Plafond,
      message:
        `refus : ${touchees.length} observations correspondent, au-delà du plafond de ${PLAFOND_FORGET_ALL}.\n` +
        "  Un fragment aussi large est presque toujours une erreur de quotation.\n" +
        "  Retirez-les par lots avec des fragments plus précis.",
    };
  }

  if (touchees.length > 1 && !tout) {
    return {
      ok: false,
      motif: MotifRefus.Ambigu,
      message:
        `${touchees.length} observations contiennent ce fragment — refus.\n` +
        "Précisez le fragment, ou assumez-les toutes avec --forget-all :\n" +
        touchees.map((o) => `  · ${o.slice(0, 160)}${o.length > 160 ? " […]" : ""}`).join("\n"),
    };
  }

  return { ok: true, nom, fragment, touchees };
}
