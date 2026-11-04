// Garde la pureté de packages/core (règle .claude/rules/core.md), lancé par /ci-gate.
// Liste blanche plutôt que liste noire de moteurs : un moteur oublié dans la liste passerait.
// Usage : node scripts/check-core-purity.mjs [racine du dépôt]
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const coreDir = path.join(root, "packages/core");
const sourceDir = path.join(coreDir, "src");

// Le code de jeu n'importe que des chemins relatifs ; les tests et le harnais (src/testing) ont droit à ceux-ci.
const TEST_IMPORTS = [/^vitest$/, /^node:/, /^@pokemon-tactic\/data$/];
// Le core est synchrone et sans DOM, et il émet des événements, pas du texte.
const FORBIDDEN_GLOBALS =
  /(?<![.\w$])(window|document|navigator|localStorage|HTMLElement|HTMLCanvasElement|setTimeout|setInterval|requestAnimationFrame|console\.\w+)(?![\w$])/g;

// Remplace commentaires (et chaînes si demandé) par des espaces, en gardant les retours à la ligne.
function blank(code, { strings }) {
  let out = "";
  let i = 0;
  const keep = (text) => {
    out += text;
  };
  const erase = (text) => {
    out += text.replace(/[^\n]/g, " ");
  };
  while (i < code.length) {
    const two = code.slice(i, i + 2);
    if (two === "//") {
      const end = code.indexOf("\n", i);
      const stop = end === -1 ? code.length : end;
      erase(code.slice(i, stop));
      i = stop;
    } else if (two === "/*") {
      const end = code.indexOf("*/", i + 2);
      const stop = end === -1 ? code.length : end + 2;
      erase(code.slice(i, stop));
      i = stop;
    } else if (code[i] === '"' || code[i] === "'" || code[i] === "`") {
      const quote = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== quote) {
        j += code[j] === "\\" ? 2 : 1;
      }
      const literal = code.slice(i, j + 1);
      if (strings) {
        keep(quote);
        erase(literal.slice(1, -1));
        keep(quote);
      } else {
        keep(literal);
      }
      i = j + 1;
    } else {
      keep(code[i]);
      i += 1;
    }
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

function listSources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listSources(full);
    }
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

const violations = [];
const report = (file, line, message) =>
  violations.push(`${path.relative(root, file)}:${line} ${message}`);

for (const file of listSources(sourceDir)) {
  const relative = path.relative(sourceDir, file);
  const isTestCode = file.endsWith(".test.ts") || relative.startsWith(`testing${path.sep}`);
  const code = fs.readFileSync(file, "utf8");
  const withoutComments = blank(code, { strings: false });

  const imports = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"']+)["']/g;
  for (const match of withoutComments.matchAll(imports)) {
    const specifier = match[1];
    if (specifier.startsWith(".")) {
      continue;
    }
    if (isTestCode && TEST_IMPORTS.some((allowed) => allowed.test(specifier))) {
      continue;
    }
    report(file, lineOf(withoutComments, match.index), `import interdit "${specifier}"`);
  }

  if (isTestCode) {
    continue;
  }
  const codeOnly = blank(code, { strings: true });
  for (const match of codeOnly.matchAll(FORBIDDEN_GLOBALS)) {
    report(file, lineOf(codeOnly, match.index), `${match[1]} interdit dans le core`);
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(coreDir, "package.json"), "utf8"));
for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
  const names = Object.keys(manifest[field] ?? {});
  if (names.length > 0) {
    report(
      path.join(coreDir, "package.json"),
      1,
      `${field} doit rester vide : ${names.join(", ")}`,
    );
  }
}

if (violations.length > 0) {
  console.error(`Core impur, ${violations.length} violation(s) :`);
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}
console.log("Core : aucune anomalie détectée par les règles connues (non exhaustif).");
