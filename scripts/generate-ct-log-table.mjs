/**
 * Génère la table de paliers de `computeCtGain` (plan 203, Lot B4, étape 2).
 *
 * `computeCtGain` calculait `30 + Math.floor(20 * Math.log(baseStat + 1))`. ECMAScript ne garantit
 * aucun résultat au bit près pour `Math.log` : sa précision est laissée à l'implémentation, donc
 * deux navigateurs peuvent différer sur le dernier bit et, le résultat passant par `Math.floor`,
 * basculer de part et d'autre d'un entier. Coût CT différent → ordre des tours différent → les deux
 * parties divergent.
 *
 * 🔴 MESURÉ : sur le domaine réel, la marge est de 1,7 × 10^10 fois l'erreur plausible, donc le
 * basculement est inatteignable AUJOURD'HUI. Ce n'est pas un correctif de bug. La marge est une
 * propriété du ROSTER (vitesse de base max 200), pas du code : une table figée rend permanent ce qui
 * n'est qu'une coïncidence heureuse, et rien ne surveillerait cette propriété autrement.
 *
 * 🔴 La table est écrite EN DUR dans la source, jamais calculée au chargement : la générer avec le
 * `Math.log` local remettrait exactement le problème en place. Ce script est conservé pour la
 * régénérer quand le roster bouge — `node scripts/generate-ct-log-table.mjs`.
 */

/** Borne haute de la table. Marge sur le domaine réel ; `ct-costs.test.ts` échoue si le roster la dépasse. */
const DOMAIN_MAX = 2048;

const logStep = (baseStat) => Math.floor(20 * Math.log(baseStat + 1));

const breakpoints = [];
let previous = null;
for (let baseStat = 1; baseStat <= DOMAIN_MAX; baseStat += 1) {
  const step = logStep(baseStat);
  if (step !== previous) {
    breakpoints.push([baseStat, step]);
    previous = step;
  }
}

const rows = breakpoints.map(([baseStat, step]) => `  [${baseStat}, ${step}],`).join("\n");
process.stdout.write(
  `const CT_LOG_STEPS: readonly (readonly [number, number])[] = [\n${rows}\n];\n`,
);
process.stderr.write(
  `${breakpoints.length} paliers sur 1..${DOMAIN_MAX} (premier ${JSON.stringify(breakpoints[0])}, dernier ${JSON.stringify(breakpoints.at(-1))})\n`,
);
