/**
 * Vérifie que la configuration du flux (agents, skills, règles) est cohérente avec
 * la réalité du dépôt. À lancer après tout changement de structure.
 *
 * Pourquoi ce script existe : la « revue du flux » du 2026-09-06 a été faite au
 * jugé — on a cherché les conflits auxquels on pensait. Résultat, quatre trous
 * trouvés APRÈS coup, dont deux qui auraient annulé la migration en silence
 * (`session-closer` recréant STATUS.md, `analyze-op-sets` recréant son rapport).
 * Une inspection au jugé rate ce à quoi elle ne pense pas ; un contrôle mécanique
 * non. C'est la thèse du plan 200 appliquée à elle-même.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

const suivis = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
const existe = new Set(suivis.filter((f) => fs.existsSync(f)));

// Fichiers versés au graphe (plan 200). Les citer est légitime pour dire « n'y écris
// plus » ; leur donner une INSTRUCTION d'écriture ou de lecture ne l'est pas.
const DISPARUS = [
  "STATUS.md",
  "docs/decisions.md",
  "docs/next.md",
  "docs/backlog.md",
  "docs/backlog-archive.md",
  "docs/implementations.md",
  "docs/test-plan.md",
  "docs/roster-poc.md",
  "docs/capture-sequence.md",
  "docs/agent-orchestration.md",
  "docs/process-data-update.md",
  "docs/reflexion-patterns-attaques.md",
  "docs/reflexion-systeme-ct.md",
  "docs/headless-test-results.md",
  "docs/op-sets-gap-analysis.md",
];
const VERBES_ECRITURE =
  /(met[s]? à jour|mettre à jour|ajoute[rz]?|inscri|écri[st]|complète|coche[rz]?|déplace|maintien)/i;

// 🔴 PLAFONDS. C'est la CAUSE RACINE du plan 200 : les documents ont grossi ×113 en
// six mois (decisions.md 4,6 → 528 Ko) sans que rien ne le signale, jusqu'à ce que la
// table « quoi lire quand » de CLAUDE.md devienne inexécutable. Rien n'empêchait la
// dérive de recommencer tant qu'aucune machine ne mesurait.
//
// Deux dimensions, parce que la taille seule ne dit pas tout : `test-plan.md` faisait
// 349 Ko en restant navigable (97 o/ligne, 128 titres), alors que `decisions.md` à
// 528 Ko était hostile (499 o/ligne, 7 titres). Un fichier dense en prose est
// illisible bien avant d'être gros.
const PLAFOND_KO = 150; // au-delà : bloquant
const ALERTE_KO = 110; // au-delà : à surveiller
const DENSITE_MAX = 250; // octets par ligne — au-delà, des méga-paragraphes
const DENSITE_MIN_KO = 20; // en dessous, la densité n'a pas de sens

const problemes = [];
const ajoute = (gravite, fichier, ligne, message) =>
  problemes.push({ gravite, fichier, ligne, message });

const config = suivis.filter(
  (f) => (f.startsWith(".claude/") && f.endsWith(".md")) || f === "CLAUDE.md",
);

for (const f of config) {
  const lignes = fs.readFileSync(f, "utf8").split("\n");
  lignes.forEach((l, i) => {
    const n = i + 1;

    // 1. instruction d'écriture vers un fichier qui n'existe plus
    for (const mort of DISPARUS) {
      if (l.includes(mort) && VERBES_ECRITURE.test(l)) {
        ajoute(
          "CRITIQUE",
          f,
          n,
          `ordonne d'écrire dans « ${mort} », supprimé (plan 200) — l'agent le recréerait`,
        );
      }
    }

    // 2. lien ou chemin vers un fichier suivi qui n'existe pas
    const m = l.match(/`((?:docs|packages|scripts|e2e)\/[\w./-]+\.(?:md|ts|json))`/g) ?? [];
    for (const brut of m) {
      const chemin = brut.slice(1, -1);
      // « docs/plans/XXX-nom.md » et consorts sont des GABARITS dans la prose, pas
      // des renvois. Les signaler noierait les vrais écarts.
      if (/XXX|xxx|<[^>]+>|\{[^}]+\}/.test(chemin)) {
        continue;
      }
      if (!existe.has(chemin) && !DISPARUS.includes(chemin)) {
        ajoute("IMPORTANT", f, n, `chemin inexistant : ${chemin}`);
      }
    }
  });

  // 3. un agent qui doit consulter la mémoire sait-il l'interroger ?
  const texte = fs.readFileSync(f, "utf8");
  const parleMemoire =
    /graphe de mémoire|entités? `(decision|agenda|historique|plan|backlog|recette)`/.test(texte);
  const saitLire = texte.includes("query.mjs");
  if (parleMemoire && !saitLire && f.startsWith(".claude/agents/")) {
    ajoute(
      "IMPORTANT",
      f,
      0,
      "parle du graphe sans jamais donner la commande pour le lire (query.mjs)",
    );
  }
}

// 4. un script qui écrit un fichier supprimé le recréerait
for (const f of suivis.filter(
  // Ce script LISTE les fichiers supprimés, c'est son travail : s'auditer lui-même
  // sur cette règle n'a pas de sens.
  (x) => /\.(ts|mjs|js|py|sh)$/.test(x) && fs.existsSync(x) && x !== "scripts/audit-flow.mjs",
)) {
  const texte = fs.readFileSync(f, "utf8");
  for (const mort of DISPARUS) {
    const nom = mort; // chemin complet : « docs/x.md », pas « x.md »
    // Ne compte que si le nom apparaît HORS commentaire : expliquer pourquoi on
    // n'écrit plus un fichier ne doit pas déclencher l'alerte.
    const actif = texte
      .split("\n")
      .filter((l) => !/^\s*(\/\/|#|\*)/.test(l))
      .join("\n");
    if (actif.includes(nom) && /writeFileSync|open\([^)]*["']w|>\s*['"]?docs\//.test(actif)) {
      ajoute("CRITIQUE", f, 0, `écrit « ${nom} », supprimé — le script le recréerait`);
    }
  }
}

// 4b. plafonds de taille et de densité sur les documents
for (const f of suivis.filter((x) => x.endsWith(".md") && fs.existsSync(x))) {
  const octets = fs.statSync(f).size;
  const ko = Math.round(octets / 1024);
  if (ko > PLAFOND_KO) {
    ajoute(
      "CRITIQUE",
      f,
      0,
      `${ko} Ko — dépasse le plafond de ${PLAFOND_KO} Ko. Verse l'historique au graphe ` +
        "(node scripts/memory/query.mjs --add …) et garde le document court.",
    );
  } else if (ko > ALERTE_KO) {
    ajoute(
      "IMPORTANT",
      f,
      0,
      `${ko} Ko — approche le plafond de ${PLAFOND_KO} Ko. À dégonfler avant qu'il ne bloque.`,
    );
  }
  if (ko >= DENSITE_MIN_KO) {
    const lignes = fs.readFileSync(f, "utf8").split("\n").length;
    const densite = Math.round(octets / lignes);
    if (densite > DENSITE_MAX) {
      ajoute(
        "IMPORTANT",
        f,
        0,
        `${densite} octets par ligne — des méga-paragraphes. Un grep y rend un mur de texte ` +
          "et le fichier n'a pas d'ancre où pointer. Découpe en sous-titres.",
      );
    }
  }
}

// 5. les hooks déclarés existent-ils et sont-ils exécutables ?
const reglages = JSON.parse(fs.readFileSync(".claude/settings.json", "utf8"));
for (const [evt, entrees] of Object.entries(reglages.hooks ?? {})) {
  for (const e of entrees) {
    for (const h of e.hooks ?? []) {
      const chemin = h.command
        .split(" ")[0]
        .replace("$CLAUDE_PROJECT_DIR/", "")
        .replace(/^"|"$/g, "");
      // Une commande du PATH (rtk, jq…) n'est pas un fichier du dépôt.
      if (!chemin.includes("/")) {
        continue;
      }
      if (!fs.existsSync(chemin)) {
        ajoute("CRITIQUE", ".claude/settings.json", 0, `hook ${evt} introuvable : ${chemin}`);
      } else if (!(fs.statSync(chemin).mode & 0o111)) {
        ajoute("CRITIQUE", ".claude/settings.json", 0, `hook ${evt} non exécutable : ${chemin}`);
      }
    }
  }
}

// 6. les skills annoncés dans CLAUDE.md existent-ils ?
const claudeMd = fs.readFileSync("CLAUDE.md", "utf8");
for (const m of claudeMd.matchAll(/`\/([a-z-]+)`/g)) {
  const nom = m[1];
  if (
    [
      "next",
      "menu",
      "commit",
      "ci-gate",
      "review-local",
      "worktree",
      "publish",
      "e2e-status",
      "itch-devlog",
      "itch-feedback",
      "capture-intro",
    ].includes(nom)
  ) {
    if (!fs.existsSync(`.claude/skills/${nom}/SKILL.md`)) {
      ajoute("IMPORTANT", "CLAUDE.md", 0, `skill /${nom} annoncé mais sans fichier`);
    }
  }
}

const ordre = { CRITIQUE: 0, IMPORTANT: 1 };
problemes.sort((a, b) => ordre[a.gravite] - ordre[b.gravite]);
if (!problemes.length) {
  console.log("✓ flux cohérent — aucun écart détecté");
  process.exit(0);
}
for (const p of problemes) {
  console.log(
    `${p.gravite.padEnd(9)} ${p.fichier}${p.ligne ? `:${p.ligne}` : ""}\n            ${p.message}`,
  );
}
console.log(`\n${problemes.length} écart(s).`);
process.exit(problemes.some((p) => p.gravite === "CRITIQUE") ? 1 : 0);
