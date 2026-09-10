import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou de déterminisme (plan 203, Lot B4).
 *
 * Le multijoueur est en exécution dupliquée : chaque pair fait tourner sa copie du moteur et seules
 * les actions transitent. Le déterminisme du core est donc ce qui garantit que deux pairs arrivent
 * au même état — et ECMAScript laisse la **précision de ses fonctions transcendantes à
 * l'implémentation**, donc V8, SpiderMonkey et JavaScriptCore ont le droit de différer sur le
 * dernier bit. Un `Math.floor` en aval transforme cet écart en deux entiers différents, donc en deux
 * parties qui divergent.
 *
 * L'étape 2 du Lot B4 a sorti la seule occurrence qui existait (`Math.log` dans `computeCtGain`,
 * remplacé par une table figée). Ce test est ce qui empêche la liste de se rallonger en silence au
 * prochain plan : sans lui, la propriété qu'on vient d'établir se reperd sans que personne le voie.
 *
 * ⚠️ Les opérations `+ − × ÷` ne sont **pas** concernées et n'ont rien à faire ici : l'arrondi
 * correct exigé par IEEE 754, imposé par ECMAScript, rend leur résultat **unique** pour des entrées
 * données — il n'existe qu'un seul résultat correctement arrondi, un JIT n'a pas la liberté d'en
 * rendre un autre. Auditer les divisions du core serait du travail perdu.
 */

/**
 * ⚠️ `Math.fround` n'est PAS dans cette liste, et c'est volontaire : il est exactement spécifié
 * (arrondi au plus proche flottant 32 bits), donc déterministe. Il y figurait par excès de zèle —
 * relevé en revue de code. Un garde-fou qui se trompe sur son propre sujet perd son autorité.
 *
 * ⚠️ Le motif ne voit que la forme littérale `Math.log(` : un `const { log } = Math` ou un
 * `Math["log"]` passerait. Acceptable pour un garde-fou — il attrape l'écriture que quelqu'un
 * taperait naturellement, pas une tentative de contournement.
 */
const FORBIDDEN = [
  "log",
  "log2",
  "log10",
  "log1p",
  "exp",
  "expm1",
  "pow",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "atan2",
  "sinh",
  "cosh",
  "tanh",
  "asinh",
  "acosh",
  "atanh",
  "cbrt",
  "hypot",
] as const;

const FORBIDDEN_PATTERN = new RegExp(`Math\\.(?:${FORBIDDEN.join("|")})\\s*\\(`, "g");
/** `Math.pow` par son opérateur : même liberté d'implémentation, même risque. */
const EXPONENT_PATTERN = /[\w)\]] *\*\* */g;

/**
 * La seule exponentiation tolérée, et pourquoi : base 2 et exposant entier petit (la puissance de
 * Roulade est plafonnée), donc une puissance de deux exactement représentable que toute
 * implémentation rend juste. Listée nommément pour qu'une seconde apparition échoue.
 */
const EXPONENT_ALLOWED = new Map([["battle/rollout-streak.ts", 1]]);

const SOURCE_ROOT = fileURLToPath(new URL(".", import.meta.url));

function productionSources(directory: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory).sort()) {
    const absolute = join(directory, entry);
    const relative = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(absolute).isDirectory()) {
      // `testing/` monte des moteurs de test : hors chemin de production.
      if (entry !== "testing") {
        found.push(...productionSources(absolute, relative));
      }
      continue;
    }
    if (entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !entry.endsWith(".d.ts")) {
      found.push(relative);
    }
  }
  return found;
}

function withoutCommentsOrStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

describe("le core reste déterministe entre navigateurs", () => {
  const sources = productionSources(SOURCE_ROOT);

  it("scans a plausible number of files", () => {
    // Si le balayage se casse (racine déplacée, filtre trop large), il rendrait 0 fichier et tous
    // les tests suivants passeraient pour rien.
    expect(sources.length).toBeGreaterThan(100);
  });

  it("calls no Math function whose precision is implementation-defined", () => {
    const offenders: string[] = [];
    for (const relative of sources) {
      const code = withoutCommentsOrStrings(readFileSync(join(SOURCE_ROOT, relative), "utf8"));
      for (const hit of code.matchAll(FORBIDDEN_PATTERN)) {
        offenders.push(`${relative} → ${hit[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps exponentiation to the single exempt, exactly-representable case", () => {
    const counted = new Map<string, number>();
    for (const relative of sources) {
      const code = withoutCommentsOrStrings(readFileSync(join(SOURCE_ROOT, relative), "utf8"));
      const hits = [...code.matchAll(EXPONENT_PATTERN)].length;
      if (hits > 0) {
        counted.set(relative, hits);
      }
    }
    expect(Object.fromEntries(counted)).toEqual(Object.fromEntries(EXPONENT_ALLOWED));
  });
});
