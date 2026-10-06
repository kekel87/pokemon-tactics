/**
 * Audit du graphe de mémoire, à la demande (plan 217). LECTURE SEULE : il propose, il ne
 * modifie rien — la base est ouverte en `readOnly`, aucune écriture n'est possible.
 *
 *   node scripts/memory/audit.mjs
 *
 * Ce qu'il cherche :
 *   - secrets : chaque observation passe par `gitleaks stdin`, par un tuyau. Jamais de
 *     vidage du graphe sur disque — un fichier temporaire serait précisément « la liste
 *     de tous les secrets ». Le rapport donne la règle et l'entité, jamais la valeur ;
 *   - relations hors du vocabulaire fermé (relations.mjs) ;
 *   - candidats à la fusion : même type, noms proches, voisins communs ;
 *   - observations recopiées à l'identique sur plusieurs entités ;
 *   - observations INVALID sans date ni raison lisible ;
 *   - lignes de récence orphelines.
 *
 * Les fonctions de détection sont pures et exportées (audit.test.ts) ; seul le bloc
 * `import.meta.main` touche la base et gitleaks.
 */
import { spawnSync } from "node:child_process";
import { normaliser } from "./fts.mjs";
import { estInvalideBienFormee } from "./invalidation.mjs";
import { estVerbeAdmis } from "./relations.mjs";

const SEUIL_JACCARD = 0.7;
/**
 * En deçà, une observation commune à deux entités est une formule, pas une recopie.
 * Mesuré le 2026-10-02 : à 40, les lignes « Contexte : plan 119 jalon 1 (2026-06-08) »
 * partagées par les décisions d'un même lot faisaient l'essentiel du rapport.
 */
const LONGUEUR_RECOPIE = 80;
/** Mots de nom sans pouvoir distinctif : deux décisions ne se ressemblent pas par « decision ». */
const MOTS_GENERIQUES = new Set(
  (
    "decision plan backlog agenda historique resolu resolue question ouverte revision " +
    "reflexion statut feedback retour traite recette idee bis fait maj"
  ).split(" "),
);
/** Un nom réduit à un seul mot distinctif ne se compare à rien de façon fiable. */
const MOTS_DISTINCTIFS_MIN = 2;

function motsDuNom(nom) {
  return new Set(
    normaliser(nom)
      .split(" ")
      .filter((m) => m.length > 2 && !/^\d+$/.test(m) && !MOTS_GENERIQUES.has(m)),
  );
}

/** Sans allocation : la paire est comparée O(n²) fois par type. */
function jaccard(a, b) {
  let intersection = 0;
  for (const x of a) {
    if (b.has(x)) {
      intersection++;
    }
  }
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
}

/**
 * Paires d'entités de même type aux noms proches (Jaccard ≥ SEUIL_JACCARD sur les mots
 * distinctifs). Score = Jaccard + 0,1 par voisin commun.
 *
 * @param {{ name: string, type: string }[]} entites
 * @param {Map<string, Set<string>>} voisinage
 */
export function candidatsFusion(entites, voisinage) {
  const parType = new Map();
  for (const e of entites) {
    const liste = parType.get(e.type) ?? [];
    liste.push({ nom: e.name, mots: motsDuNom(e.name) });
    parType.set(e.type, liste);
  }
  const paires = [];
  for (const [type, liste] of parType) {
    for (let i = 0; i < liste.length; i++) {
      for (let j = i + 1; j < liste.length; j++) {
        const [a, b] = [liste[i], liste[j]];
        if (a.mots.size < MOTS_DISTINCTIFS_MIN || b.mots.size < MOTS_DISTINCTIFS_MIN) {
          continue;
        }
        const indice = jaccard(a.mots, b.mots);
        if (indice < SEUIL_JACCARD) {
          continue;
        }
        const voisinsA = voisinage.get(a.nom) ?? new Set();
        const communs = [...(voisinage.get(b.nom) ?? [])].filter((v) => voisinsA.has(v)).length;
        paires.push({ type, a: a.nom, b: b.nom, score: indice + 0.1 * communs });
      }
    }
  }
  return paires.sort((x, y) => y.score - x.score);
}

/** @typedef {{ entity: string, content: string }} Observation */

/**
 * Observations longues présentes, à la normalisation près, sur plusieurs entités.
 * @param {Observation[]} observations
 * @returns {{ texte: string, entites: string[] }[]}
 */
export function recopies(observations) {
  const parTexte = new Map();
  for (const { entity, content } of observations) {
    const cle = normaliser(content);
    if (cle.length < LONGUEUR_RECOPIE) {
      continue;
    }
    const entites = parTexte.get(cle) ?? new Set();
    entites.add(entity);
    parTexte.set(cle, entites);
  }
  return [...parTexte.entries()]
    .filter(([, entites]) => entites.size > 1)
    .map(([texte, entites]) => ({ texte, entites: [...entites] }));
}

/**
 * Observations marquées INVALID sans le format `INVALID AAAA-MM-JJ: raison — texte`.
 * @param {Observation[]} observations
 * @returns {Observation[]}
 */
export function invalidesMalFormees(observations) {
  return observations.filter(
    // « INVALID » sans l'espace du marqueur, exprès : un « INVALID: faux » écrit à la main
    // échappe au moteur ET au hook (il reste servi), c'est lui qu'il faut signaler.
    ({ content }) => /^INVALID\b/.test(content) && !estInvalideBienFormee(content),
  );
}

/**
 * @param {{ de: string, verbe: string, vers: string }[]} relations
 * @returns {{ de: string, verbe: string, vers: string }[]}
 */
export function relationsHorsVocabulaire(relations) {
  return relations.filter((r) => !estVerbeAdmis(r.verbe));
}

/** Une observation par ligne vers `gitleaks stdin` ; rend [{ regle, entite }]. */
function scannerSecrets(observations) {
  const texte = observations.map((o) => o.content.replace(/\s+/g, " ")).join("\n");
  const resultat = spawnSync(
    "gitleaks",
    [
      "stdin",
      "--no-banner",
      "--redact",
      "--report-format",
      "json",
      "--report-path",
      "-",
      "--exit-code",
      "0",
    ],
    { input: texte, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (resultat.error || resultat.status !== 0) {
    return null;
  }
  return JSON.parse(resultat.stdout || "[]").map((f) => ({
    regle: f.RuleID,
    entite: observations[f.StartLine - 1]?.entity ?? "?",
  }));
}

function section(titre, lignes, plafond = 15) {
  console.log(`\n## ${titre} — ${lignes.length}`);
  for (const l of lignes.slice(0, plafond)) {
    console.log(`  ${l}`);
  }
  if (lignes.length > plafond) {
    console.log(`  … et ${lignes.length - plafond} de plus`);
  }
}

if (import.meta.main) {
  process.removeAllListeners("warning"); // node:sqlite est « expérimental » : bruit seul
  const { DatabaseSync } = await import("node:sqlite");
  const { dbPath } = await import("./paths.mjs");
  const db = new DatabaseSync(dbPath(), { readOnly: true });

  const entites = db.prepare("SELECT name, entity_type AS type FROM entities").all();
  const observations = db
    .prepare("SELECT entity_name AS entity, content FROM observations ORDER BY id")
    .all();
  const relations = db
    .prepare("SELECT from_entity AS de, relation_type AS verbe, to_entity AS vers FROM relations")
    .all();
  const voisinage = new Map();
  for (const { de, vers } of relations) {
    voisinage.set(de, (voisinage.get(de) ?? new Set()).add(vers));
    voisinage.set(vers, (voisinage.get(vers) ?? new Set()).add(de));
  }

  console.log(
    `Audit du graphe — ${entites.length} entités, ${observations.length} observations, ` +
      `${relations.length} relations. Lecture seule : rien n'est modifié.`,
  );

  const secrets = scannerSecrets(observations);
  section(
    "Secrets (gitleaks, valeurs jamais affichées)",
    secrets === null
      ? ["gitleaks introuvable ou en échec — scan NON fait"]
      : secrets.map((s) => `${s.regle} dans ${s.entite}`),
  );
  section(
    "Relations hors vocabulaire",
    relationsHorsVocabulaire(relations).map((r) => `(${r.de}) --${r.verbe}--> (${r.vers})`),
  );
  section(
    "Candidats à la fusion",
    candidatsFusion(entites, voisinage).map(
      (p) => `[${p.type}] ${p.a}  ≈  ${p.b}  (${p.score.toFixed(2)})`,
    ),
  );
  section(
    "Observations recopiées sur plusieurs entités",
    recopies(observations).map((r) => `${r.entites.join(", ")} : ${r.texte.slice(0, 80)}`),
  );
  section(
    "INVALID mal formés",
    invalidesMalFormees(observations).map((o) => `${o.entity} : ${o.content.slice(0, 80)}`),
  );
  section(
    "Lignes de récence orphelines",
    db
      .prepare(
        "SELECT entity_name AS n FROM entity_recency " +
          "WHERE entity_name NOT IN (SELECT name FROM entities)",
      )
      .all()
      .map((r) => r.n),
    5,
  );
  console.log("\nAucune modification faite. Chaque correction se décide avec l'humain.");
}
