/**
 * Harnais d'evaluation de la restitution du graphe.
 *
 * 15 questions reelles -> l'entite attendue dans le TOP 3. Sert a deux choses :
 *   1. calibrer les parametres (recence, filtre de frequence) par la MESURE ;
 *   2. servir de verrou : on ne supprime une source du depot que si le graphe
 *      repond aussi bien qu'elle.
 *
 * Deux jeux de sondes depuis le plan 217 :
 *   - RECHERCHE (CAS ci-dessous) : la question -> l'entité attendue dans le top 3 ;
 *   - HOOK (hook-probes.tsv) : un prompt réel -> l'entité attendue dans l'injection,
 *     ou le SILENCE pour un prompt conversationnel. Le hook est lancé tel quel, en
 *     sous-processus, avec un état jetable (PT_MEMORY_STATE).
 *
 * Usage : node eval-search.mjs            les deux scores
 *         node eval-search.mjs --usage    rapport du log d'usage : injecté puis ouvert
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { etatMemoire, memoryHome, ouvrirStore } from "./paths.mjs";

const RACINE = path.join(import.meta.dirname, "..", "..");
const HOOK = path.join(RACINE, ".claude", "hooks", "inject-memory-recall.py");

// « attendu » = fragment devant apparaitre dans le nom d'une entite du top 3.
const CAS = [
  ["roue de caractères code de partie manette", ["decision-913", "decision-840", "-840"]],
  ["llvmpipe rasteriseur WebGL CI e2e", ["decision-924", "gate-est-trop-lent"]],
  // « le-gate-e2e-passe » ajouté le 2026-10-02 (plan 217) : l'entité porte mot pour mot la
  // réponse (« /ci-gate fast à 43 s »), consolidée après l'écriture de la sonde.
  [
    "ci-gate fast full durée gate local",
    ["gate-est-trop-lent", "decision-921", "le-gate-e2e-passe"],
  ],
  ["forfait multijoueur délai 45 secondes absence", ["lot-b2", "lot-b1", "forfait"]],
  [
    "battle_started partie en ligne télémétrie",
    ["battle_started", "ligne-német-pas", "telemetrie"],
  ],
  // « decision-914 » ajouté le 2026-10-02 (plan 217), vérifié à --open : c'est elle qui
  // tranche « Lancer » inerte et `setSeatOccupancy`.
  ["bouton Lancer inerte salon setSeatOccupancy", ["humain", "lancer", "salon", "decision-914"]],
  ["pendingLaunch leave promesse jamais résolue", ["dette-du-paquet", "pendinglaunch"]],
  ["reset CSS box-sizing tb-root écrans", ["reset-css"]],
  ["MESSAGE_TYPES exhaustivité Biome switch", ["revue-de-code", "dette-du-paquet"]],
  [
    "suite e2e GitHub tranches asynchrone publish rouge",
    ["decision-924", "decision-925", "gate-est-trop-lent"],
  ],
  [
    "workers Playwright plafond CPU machine humain",
    ["gate-est-trop-lent", "decision-921", "ressources"],
  ],
  ["218 specs mechanics couverture paramétrée réduire", ["decision-923", "specs-mechanics"]],
  ["isNetworkMessage valide seulement type garde", ["revue-de-code", "dette-du-paquet"]],
  ["humanIndex slot-state dernière équipe joueur local", ["humanindex", "slot-state"]],
  ["graine placement automatique déterminisme pairs", ["decision-902", "decision-901", "graine"]],
];

function evalue(store, top = 3) {
  let ok = 0;
  const rates = [];
  for (const [q, attendus] of CAS) {
    const r = store.searchNodes(q);
    const noms = r.entities.slice(0, top).map((e) => e.name.toLowerCase());
    const trouve = attendus.some((a) => noms.some((n) => n.includes(a.toLowerCase())));
    if (trouve) {
      ok++;
    } else {
      rates.push(`${q.slice(0, 44)} -> ${noms[0]?.slice(0, 50) ?? "rien"}`);
    }
  }
  return { ok, total: CAS.length, rates };
}

/** Les sondes du hook : `[attendus | null, prompt]`, `null` = le hook doit se taire. */
function lireSondesHook() {
  return fs
    .readFileSync(path.join(import.meta.dirname, "hook-probes.tsv"), "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim() && !ligne.startsWith("#"))
    .map((ligne) => {
      const [attendu = "", ...reste] = ligne.split("\t");
      return [attendu === "-" ? null : attendu.split("|"), reste.join("\t")];
    });
}

/** Noms injectés par le hook pour un prompt, dans un état de session neuf. */
function injecter(prompt, etat, numero) {
  const sortie = spawnSync("python3", [HOOK], {
    input: JSON.stringify({ prompt, session_id: `sonde-${numero}` }),
    encoding: "utf8",
    env: { ...process.env, PT_MEMORY_HOME: memoryHome(), PT_MEMORY_STATE: etat },
  });
  if (!sortie.stdout.trim()) {
    return [];
  }
  const contexte = JSON.parse(sortie.stdout).hookSpecificOutput.additionalContext;
  return [...contexte.matchAll(/^- `([^`]+)`/gm)].map((m) => m[1]);
}

function evalueHook() {
  const etat = fs.mkdtempSync(path.join(os.tmpdir(), "sondes-hook-"));
  const bilan = { positifs: 0, totalPositifs: 0, silences: 0, totalNegatifs: 0, rates: [] };
  try {
    lireSondesHook().forEach(([attendus, prompt], numero) => {
      const noms = injecter(prompt, etat, numero).map((n) => n.toLowerCase());
      if (attendus === null) {
        bilan.totalNegatifs++;
        if (noms.length === 0) {
          bilan.silences++;
        } else {
          bilan.rates.push(`BRUIT  ${prompt.slice(0, 40)} -> ${noms[0]?.slice(0, 50)}`);
        }
        return;
      }
      bilan.totalPositifs++;
      if (attendus.some((a) => noms.some((n) => n.includes(a.toLowerCase())))) {
        bilan.positifs++;
      } else {
        bilan.rates.push(`RATÉ   ${prompt.slice(0, 40)} -> ${noms[0]?.slice(0, 50) ?? "rien"}`);
      }
    });
  } finally {
    fs.rmSync(etat, { recursive: true, force: true });
  }
  return bilan;
}

/** Couples (entité, session) injectés, et combien ont été ouverts ensuite. */
function rapportUsage() {
  const journal = path.join(etatMemoire(), "memory-usage.jsonl");
  if (!fs.existsSync(journal)) {
    console.log("aucun log d'usage encore (.claude/.state/memory-usage.jsonl)");
    return;
  }
  const injectes = new Map();
  const ouverts = new Set();
  for (const ligne of fs.readFileSync(journal, "utf8").split("\n")) {
    if (!ligne.trim()) {
      continue;
    }
    const evenement = JSON.parse(ligne);
    for (const nom of evenement.names) {
      const cle = `${evenement.sid}\t${nom}`;
      if (evenement.event === "injected" && !injectes.has(cle)) {
        injectes.set(cle, evenement.ts);
      } else if (
        evenement.event === "opened" &&
        (injectes.get(cle) ?? Number.POSITIVE_INFINITY) <= evenement.ts
      ) {
        ouverts.add(cle);
      }
    }
  }
  const pourcentage = injectes.size ? Math.round((100 * ouverts.size) / injectes.size) : 0;
  console.log(
    `injecté puis ouvert : ${ouverts.size}/${injectes.size} couples (entité, session) — ${pourcentage} %`,
  );
}

if (process.argv.includes("--usage")) {
  rapportUsage();
  process.exit(0);
}

const store = await ouvrirStore();
const { ok, total, rates } = evalue(store);
const tag = `rec=${process.env.MEMORY_RECENCY_BOOST ?? "def"} df=${process.env.MEMORY_DF_MAX ?? "def"}`;
console.log(`RECHERCHE TOP-3 ${ok}/${total}   (${tag})`);
const hook = evalueHook();
console.log(
  `HOOK      positifs ${hook.positifs}/${hook.totalPositifs}   silences ${hook.silences}/${hook.totalNegatifs}`,
);
if (!process.env.EVAL_QUIET) {
  for (const r of rates) {
    console.log(`  RATÉ   ${r}`);
  }
  for (const r of hook.rates) {
    console.log(`  ${r}`);
  }
}
process.exit(0);
