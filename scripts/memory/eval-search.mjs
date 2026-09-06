/**
 * Harnais d'evaluation de la restitution du graphe.
 *
 * 15 questions reelles -> l'entite attendue dans le TOP 3. Sert a deux choses :
 *   1. calibrer les parametres (recence, filtre de frequence) par la MESURE ;
 *   2. servir de verrou : on ne supprime une source du depot que si le graphe
 *      repond aussi bien qu'elle.
 *
 * Usage : HOME=<graphe> PT_MEMORY_VENDOR=<vendor> node eval-search.mjs [--grille]
 */
import { ouvrirStore } from "./paths.mjs";

// « attendu » = fragment devant apparaitre dans le nom d'une entite du top 3.
const CAS = [
  ["roue de caractères code de partie manette", ["decision-913", "decision-840", "-840"]],
  ["llvmpipe rasteriseur WebGL CI e2e", ["decision-924", "gate-est-trop-lent"]],
  ["ci-gate fast full durée gate local", ["gate-est-trop-lent", "decision-921"]],
  ["forfait multijoueur délai 45 secondes absence", ["lot-b2", "lot-b1", "forfait"]],
  [
    "battle_started partie en ligne télémétrie",
    ["battle_started", "ligne-német-pas", "telemetrie"],
  ],
  ["bouton Lancer inerte salon setSeatOccupancy", ["humain", "lancer", "salon"]],
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

const store = await ouvrirStore();
const { ok, total, rates } = evalue(store);
const tag = `rec=${process.env.MEMORY_RECENCY_BOOST ?? "def"} df=${process.env.MEMORY_DF_MAX ?? "def"}`;
console.log(`TOP-3 ${ok}/${total}   (${tag})`);
if (!process.env.EVAL_QUIET) {
  for (const r of rates) {
    console.log(`  RATÉ  ${r}`);
  }
}
process.exit(0);
