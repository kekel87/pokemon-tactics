/**
 * Moteur de recherche du graphe de mémoire : FTS5 + BM25, classé et plafonné.
 *
 * Pourquoi il est ICI (plan 217) : il vivait dans `<config>/.claude/vendor/memory-fts.mjs`,
 * hors dépôt et non versionné — la synchro ne transporte que `memory.db`, donc chaque
 * machine avait sa copie, et le hook Python recopiait son SQL sans que rien ne garantisse
 * l'accord des deux. Rapatrié, il est versionné, relu et testé (`fts.test.ts`, sur
 * `node:sqlite` en mémoire).
 *
 * Module sans paquet : seul `mots-vides.txt` est lu au chargement. Les fonctions
 * prennent une base qui expose `exec` et `prepare(...).get/all/run` — better-sqlite3 en
 * production, `node:sqlite` en test. `installerMoteur` patche le prototype du store de
 * `@pepk/mcp-memory-sqlite` : rien n'est édité dans le paquet, et une mise à jour qui
 * casserait le patch échoue bruyamment au lieu de le perdre en silence.
 *
 * Le classement est un MAX par (entité, champ), jamais une SOMME sur les lignes : une
 * entité à 65 observations ne doit pas dépasser une touche précise en accumulant 65
 * scores faibles.
 */

import { readFileSync } from "node:fs";

const LIMITE = Number(process.env.MEMORY_SEARCH_LIMIT ?? 10) || 10;
const PLAFOND_OBSERVATIONS = Number(process.env.MEMORY_SEARCH_OBS_CAP ?? 12);
// Un plafond en nombre ne suffit pas : une observation dépasse souvent 1 000 caractères,
// donc 12 d'entre elles font encore ~3k tokens pour UNE entité. Le premier atteint gagne.
const PLAFOND_CARACTERES = Number(process.env.MEMORY_SEARCH_OBS_CHARS ?? 2000);
// Bonus de récence (0 = désactivé). Multiplicatif et borné : il départage deux entités
// de pertinence voisine, il ne fait pas remonter un hors-sujet récent.
const RECENCE = Number(process.env.MEMORY_RECENCY_BOOST ?? 0.15);
// Un terme présent dans plus de DF_MAX % des entités ne discrimine rien : gardé dans la
// requête, il NOIE le terme rare qui porte la question (« llvmpipe rasteriseur WebGL
// CI » -> seul « llvmpipe » compte). Même valeur que le hook — les deux DOIVENT
// chercher pareil.
export const DF_MAX = Number(process.env.MEMORY_DF_MAX ?? 0.02);

// Poids par TYPE d'entité. Une question posée à une mémoire est presque toujours un
// « pourquoi » ou un « qu'a-t-on décidé » : une décision doit alors battre une procédure
// qui parle du même sujet sous l'angle « comment vérifier ». Sans ce poids, « pourquoi
// llvmpipe a été écarté » tombait sur la section « Gate CI » du cahier de recette.
const POIDS_TYPE = {
  decision: 1.35,
  révision: 1.3,
  agenda: 1.2,
  backlog: 1.1,
  retour: 1.1,
  plan: 1.0,
  historique: 1.0,
  feedback: 1.15,
  "question-ouverte": 1.1,
  recette: 0.7,
  procédure: 0.7,
  réflexion: 0.85,
  index: 0.8,
};

/**
 * Mots sans signal thématique, en français et en anglais : `mots-vides.txt`, la liste
 * UNIQUE que lit aussi le hook de rappel. Deux listes divergeaient jusqu'au plan 218 —
 * une divergence de tokenisation entre les deux moitiés du système ne se voit pas.
 */
export const MOTS_VIDES = new Set(
  readFileSync(new URL("./mots-vides.txt", import.meta.url), "utf8")
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne && !ligne.startsWith("#")),
);

const JETON = /[A-Za-z0-9_-]+/g;

/**
 * Marqueurs de cycle de vie d'une observation (plan 217), en tête de texte.
 *
 * `INVALID AAAA-MM-JJ: raison — texte d'origine` : le fait est faux ou périmé. On
 * invalide au lieu de supprimer — le texte reste lisible par `--open`, mais la recherche
 * et le hook ne le servent plus. Avant ce marqueur, 115 observations portaient « PÉRIMÉ »,
 * « remplacé », « OBSOLÈTE » ou « ✅ RÉSOLU » à la main et remontaient comme des faits
 * vivants.
 *
 * `CONFIRMED AAAA-MM-JJ: …` : fait confirmé par l'HUMAIN, jamais posé par un agent de
 * lui-même. Il donne un bonus de classement à toute l'entité.
 *
 * Sensibles à la casse et suivis d'une espace, comme dans le GLOB du SQL : un mot
 * « invalid » au fil d'une phrase n'est pas un marqueur.
 */
export const MARQUEUR_INVALIDE = "INVALID ";
export const MARQUEUR_CONFIRME = "CONFIRMED ";
export const BONUS_CONFIRME = 1.5;

export function estInvalide(observation) {
  return String(observation).startsWith(MARQUEUR_INVALIDE);
}

// bm25() est illégal dans un agrégat au même niveau, et SQLite réaplatit une sous-requête
// simple : MATERIALIZED est ce qui rend la requête légale.
const SQL_RECHERCHE = `
  WITH m AS MATERIALIZED (
    SELECT entity_name AS n, kind AS k, -bm25(memory_fts) AS r
    FROM memory_fts WHERE memory_fts MATCH ?
      AND NOT (kind = 'obs' AND text GLOB '${MARQUEUR_INVALIDE}*')),
  best AS (SELECT n, k, MAX(r) AS r FROM m GROUP BY n, k),
  brut AS (SELECT n, SUM(CASE k WHEN 'name' THEN 3.0 WHEN 'type' THEN 0.5 ELSE 1.0 END * r) AS s
           FROM best GROUP BY n)
  -- Bonus de récence multiplicatif et BORNÉ (1.0 à 1.0 + RECENCE) ; bonus fixe pour une
  -- entité qui porte au moins un fait CONFIRMED par l'humain.
  SELECT brut.n AS n,
         brut.s * (1.0 + ? * COALESCE(rec.f, 0.0)) * COALESCE(p.w, 1.0)
                * CASE WHEN EXISTS (SELECT 1 FROM observations o WHERE o.entity_name = brut.n
                                    AND o.content GLOB '${MARQUEUR_CONFIRME}*')
                       THEN ${BONUS_CONFIRME} ELSE 1.0 END AS score
  FROM brut
  LEFT JOIN entities en ON en.name = brut.n
  LEFT JOIN poids_type p ON p.t = en.entity_type
  LEFT JOIN (
    SELECT entity_name, (ts - (SELECT MIN(ts) FROM entity_recency))
                        / MAX(1.0, (SELECT MAX(ts) - MIN(ts) FROM entity_recency)) AS f
    FROM entity_recency) rec ON rec.entity_name = brut.n
  ORDER BY score DESC LIMIT ?`;

/**
 * Index FTS, tables annexes et les triggers qui tiennent l'index aligné sur le graphe.
 * Tout est `IF NOT EXISTS` : le `initSchema()` du paquet ne fait lui aussi que des
 * CREATE ... IF NOT EXISTS, donc rien ne s'écrase. Le trigger d'UPDATE sur `observations`
 * sert `--invalidate`, qui réécrit le texte en place : sans lui l'index garderait
 * l'ancien texte, sans marqueur, et le fait invalidé resterait trouvable — en silence,
 * puisque le comptage de lignes de `assurerIndex` ne bouge pas. Les deux triggers d'UPDATE sur
 * `entities` vivaient dans `paths.mjs` parce que l'ancien propriétaire du schéma ne les
 * déclarait pas — voir le commentaire de `assurerIndex` sur leur absence invisible. Les deux
 * triggers de `entity_recency` (plan 218) suivent l'entité quand on la supprime ou la renomme :
 * sans eux, 688 lignes de récence pointaient vers des entités disparues.
 */
const SCHEMA = `
  CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
    entity_name UNINDEXED, kind UNINDEXED, text, tokenize = "porter unicode61 tokenchars '_-'");

  CREATE TABLE IF NOT EXISTS entity_recency (
    entity_name TEXT PRIMARY KEY, ts REAL NOT NULL);

  CREATE TABLE IF NOT EXISTS poids_type (t TEXT PRIMARY KEY, w REAL NOT NULL);

  CREATE TRIGGER IF NOT EXISTS memory_fts_ai_entity AFTER INSERT ON entities BEGIN
    INSERT INTO memory_fts(entity_name, kind, text)
      VALUES (new.name, 'name', REPLACE(new.name, '-', ' ')), (new.name, 'type', new.entity_type);
  END;
  CREATE TRIGGER IF NOT EXISTS memory_fts_ad_entity AFTER DELETE ON entities BEGIN
    DELETE FROM memory_fts WHERE entity_name = old.name;
  END;
  CREATE TRIGGER IF NOT EXISTS entity_recency_ad_entity AFTER DELETE ON entities BEGIN
    DELETE FROM entity_recency WHERE entity_name = old.name;
  END;
  CREATE TRIGGER IF NOT EXISTS entity_recency_au_entity_rename
  AFTER UPDATE OF name ON entities BEGIN
    UPDATE entity_recency SET entity_name = new.name WHERE entity_name = old.name;
  END;
  CREATE TRIGGER IF NOT EXISTS memory_fts_ai_obs AFTER INSERT ON observations BEGIN
    INSERT INTO memory_fts(entity_name, kind, text) VALUES (new.entity_name, 'obs', new.content);
  END;
  CREATE TRIGGER IF NOT EXISTS memory_fts_ad_obs AFTER DELETE ON observations BEGIN
    DELETE FROM memory_fts WHERE entity_name = old.entity_name AND kind = 'obs' AND text = old.content;
  END;
  CREATE TRIGGER IF NOT EXISTS memory_fts_au_obs
  AFTER UPDATE OF content ON observations BEGIN
    DELETE FROM memory_fts
      WHERE entity_name = old.entity_name AND kind = 'obs' AND text = old.content;
    INSERT INTO memory_fts(entity_name, kind, text) VALUES (new.entity_name, 'obs', new.content);
  END;
  CREATE TRIGGER IF NOT EXISTS memory_fts_au_entity
  AFTER UPDATE OF entity_type ON entities BEGIN
    DELETE FROM memory_fts WHERE entity_name = old.name AND kind = 'type';
    INSERT INTO memory_fts(entity_name, kind, text) VALUES (new.name, 'type', new.entity_type);
  END;
  CREATE TRIGGER IF NOT EXISTS memory_fts_au_entity_rename
  AFTER UPDATE OF name ON entities BEGIN
    UPDATE memory_fts SET entity_name = new.name WHERE entity_name = old.name;
    DELETE FROM memory_fts WHERE entity_name = new.name AND kind = 'name';
    INSERT INTO memory_fts(entity_name, kind, text)
      VALUES (new.name, 'name', REPLACE(new.name, '-', ' '));
  END;`;

/**
 * Forme normalisée, pour la seule détection de quasi-doublons — le texte stocké n'est
 * jamais modifié. Elle attrape les reformulations qui ne diffèrent que par la casse, la
 * ponctuation, les accents ou les espaces.
 */
export function normaliser(texte) {
  return String(texte)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Vrai si `contenu` n'a pas encore de quasi-doublon dans `vues`, qu'il y ajoute alors.
 * Seule règle anti-doublon du dispositif (ajout, création, fusion). Une forme normalisée
 * vide (ponctuation seule) n'est jamais un doublon : on ne jette pas en silence ce qu'on ne
 * sait pas comparer.
 *
 * @param {Set<string>} vues formes normalisées déjà présentes
 * @param {string} contenu
 */
export function estNouvelle(vues, contenu) {
  const cle = normaliser(contenu);
  if (cle && vues.has(cle)) {
    return false;
  }
  vues.add(cle);
  return true;
}

/**
 * Replie les accents, comme `unicode61` le fait dans l'index (« mémoire » y est stocké
 * « memoire »). Sans ce repliement côté requête, JETON — qui ne connaît que
 * [A-Za-z0-9_-] — fracasse chaque mot accentué : « mémoire » -> « m » + « moire ».
 */
export function plier(texte) {
  return String(texte).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * Les mots qui NUMÉROTENT une entité (« plan 209 », « décision 45 »). Un nombre seul ne
 * reste un terme de recherche que derrière l'un d'eux, ou écrit « #924 ». Sinon il touche
 * le NOM de `decision-45` ou `reflexion-45`, pondéré ×3 : mesuré le 2026-10-02, « forfait
 * multijoueur délai 45 secondes » rendait ces deux entités sans rapport en tête.
 */
export const NUMEROTANTS = [
  "plan",
  "plans",
  "decision",
  "decisions",
  "reflexion",
  "revision",
  "recette",
  "lot",
  "phase",
];
const NUMEROTE = new Set(NUMEROTANTS);

function ecarterNombresIsoles(bruts, requete) {
  const diese = new Set([...plier(requete).matchAll(/#(\d+)/g)].map((m) => m[1]));
  return bruts.filter(
    (t, i) => !/^\d+$/.test(t) || diese.has(t) || NUMEROTE.has(bruts[i - 1] ?? ""),
  );
}

/** Requête -> termes FTS. Les composés sont émis entiers ET éclatés. */
export function termes(requete) {
  const bruts = ecarterNombresIsoles(plier(requete).match(JETON) ?? [], requete);
  const eclates = bruts.flatMap((t) =>
    t.includes("-") || t.includes("_") ? [t, ...t.split(/[-_]/)] : [t],
  );
  const tous = [...new Set(eclates)].filter((t) => t.length > 1);
  const gardes = tous.filter((t) => !MOTS_VIDES.has(t));
  return gardes.length ? gardes : tous; // une requête faite de mots vides cherche quand même
}

/** Exécute `travail` dans une transaction, sur better-sqlite3 comme sur node:sqlite. */
export function enTransaction(db, travail) {
  db.exec("BEGIN");
  try {
    travail();
    db.exec("COMMIT");
  } catch (erreur) {
    db.exec("ROLLBACK");
    throw erreur;
  }
}

/**
 * Pose le schéma (index, tables annexes, triggers) et les poids par type. Une fois, à
 * l'ouverture : une écriture faite avant toute recherche doit déjà alimenter l'index, et
 * une recherche ne doit rien écrire — 12 écritures de poids à chaque recherche, c'était
 * 12 commits WAL et le verrou d'écriture pris contre les sessions parallèles.
 */
export function poserSchema(db) {
  db.exec(SCHEMA);
  const insertionPoids = db.prepare("INSERT OR REPLACE INTO poids_type (t, w) VALUES (?, ?)");
  enTransaction(db, () => {
    for (const [type, poids] of Object.entries(POIDS_TYPE)) {
      insertionPoids.run(type, poids);
    }
  });
}

/**
 * Reconstruit l'index dès que son nombre de lignes ne correspond
 * plus au graphe. C'est ce qui le rend auto-réparateur : des écritures antérieures aux
 * triggers, ou toute dérive, sont corrigées à la recherche suivante.
 *
 * Limite connue : la comparaison porte sur des NOMBRES de lignes. Une mise à jour qui
 * n'en change aucun (retypage, renommage) n'est rattrapée que par ses triggers — d'où
 * leur présence dans SCHEMA.
 */
export function assurerIndex(db) {
  const attendu =
    2 * db.prepare("SELECT COUNT(*) c FROM entities").get().c +
    db.prepare("SELECT COUNT(*) c FROM observations").get().c;
  const reel = db.prepare("SELECT COUNT(*) c FROM memory_fts").get().c;
  if (attendu === reel) {
    return;
  }
  enTransaction(db, () => {
    db.exec("DELETE FROM memory_fts");
    db.exec(`INSERT INTO memory_fts(entity_name, kind, text)
               SELECT name, 'name', REPLACE(name, '-', ' ') FROM entities`);
    db.exec(`INSERT INTO memory_fts(entity_name, kind, text)
               SELECT name, 'type', entity_type FROM entities`);
    db.exec(`INSERT INTO memory_fts(entity_name, kind, text)
               SELECT entity_name, 'obs', content FROM observations`);
  });
  console.error(`[Memory/FTS] rebuilt index: ${reel} -> ${attendu} rows`);
}

/**
 * Ne garde que les termes rares (≤ DF_MAX des entités). On ne vide jamais la requête :
 * si tout est commun, on garde les deux moins communs.
 */
function filtrerTermesRares(db, liste) {
  if (DF_MAX <= 0 || liste.length < 2) {
    return liste;
  }
  const total = db.prepare("SELECT COUNT(*) c FROM entities").get().c || 1;
  const frequence = db.prepare(
    "SELECT COUNT(DISTINCT entity_name) c FROM memory_fts WHERE memory_fts MATCH ?",
  );
  const notes = liste.map((terme) => {
    let compte = total;
    try {
      compte = frequence.get(`"${terme}"`).c;
    } catch {
      // terme illisible par FTS : traité comme commun
    }
    return { terme, ratio: compte / total };
  });
  const rares = notes.filter((n) => n.ratio <= DF_MAX);
  const retenus = rares.length ? rares : notes.sort((a, b) => a.ratio - b.ratio).slice(0, 2);
  return retenus.map((n) => n.terme);
}

/** Noms d'entités classés pour une requête. Index supposé à jour. */
export function classer(db, requete) {
  const liste = filtrerTermesRares(db, termes(requete));
  if (!liste.length) {
    return [];
  }
  // OR, pas AND. Mesuré le 2026-09-06 : rendre le terme le plus rare OBLIGATOIRE fait
  // chuter le harnais de 11/15 à 5/15 — c'est souvent un mot incident, pas le topique.
  const expression = liste.map((t) => `"${t}"`).join(" OR ");
  return db
    .prepare(SQL_RECHERCHE)
    .all(expression, RECENCE, LIMITE)
    .map((r) => r.n);
}

/**
 * Plafonne les observations d'une entité de résultat, avec un renvoi vers --open. Les
 * observations invalidées sont retirées et seulement comptées : un résultat de recherche
 * sert des faits vivants, l'historique se lit par --open.
 */
export function plafonner(toutes, nom) {
  const observations = toutes.filter((o) => !estInvalide(o));
  const invalidees = toutes.length - observations.length;
  const gardees = [];
  let caracteres = 0;
  for (const o of observations) {
    if (PLAFOND_OBSERVATIONS > 0 && gardees.length >= PLAFOND_OBSERVATIONS) {
      break;
    }
    if (PLAFOND_CARACTERES > 0 && caracteres && caracteres + o.length > PLAFOND_CARACTERES) {
      break;
    }
    gardees.push(o);
    caracteres += o.length;
  }
  const reste = observations.length - gardees.length;
  const masquees = [
    reste > 0 ? `${reste} de plus` : "",
    invalidees > 0 ? `${invalidees} invalidée(s)` : "",
  ].filter(Boolean);
  if (masquees.length) {
    gardees.push(`[… ${masquees.join(", ")} — --open ${nom}]`);
  }
  return gardees;
}

/**
 * Patche le store du paquet : recherche classée, et garde anti-doublon à l'écriture.
 */
export function installerMoteur(KnowledgeGraphStore) {
  const prototype = KnowledgeGraphStore.prototype;

  const rechercheOrigine = prototype.searchNodes;
  prototype.searchNodes = function (requete) {
    try {
      assurerIndex(this.db);
      const noms = classer(this.db, requete);
      if (!noms.length) {
        return { entities: [], relations: [] };
      }
      const resultat = this.openNodes(noms);
      // openNodes résout par `WHERE name IN (...)`, ce qui perd l'ordre BM25 : le
      // modèle lit de haut en bas, le classement doit survivre jusqu'à la sortie.
      const rang = new Map(noms.map((n, i) => [n, i]));
      resultat.entities.sort((a, b) => rang.get(a.name) - rang.get(b.name));
      for (const e of resultat.entities) {
        e.observations = plafonner(e.observations, e.name);
      }
      return resultat;
    } catch (erreur) {
      console.error(`[Memory/FTS] falling back to LIKE search: ${erreur.message}`);
      return rechercheOrigine.call(this, requete);
    }
  };

  // Les rejets sont RENDUS (`skippedAsNearDuplicate`), pas jetés en silence : l'appelant
  // doit apprendre que sa formulation existe déjà, sinon il reformule et recommence.
  const ajoutOrigine = prototype.addObservations;
  prototype.addObservations = function (lots) {
    const ecartes = new Map();
    let filtres;
    try {
      const existantes = this.db.prepare("SELECT content FROM observations WHERE entity_name = ?");
      filtres = lots.map((lot) => {
        const vues = new Set(existantes.all(lot.entityName).map((r) => normaliser(r.content)));
        const gardees = [];
        for (const contenu of lot.contents) {
          // `vues` grandit en route : les doublons internes au lot sont pris aussi.
          if (estNouvelle(vues, contenu)) {
            gardees.push(contenu);
            continue;
          }
          if (!ecartes.has(lot.entityName)) {
            ecartes.set(lot.entityName, []);
          }
          ecartes.get(lot.entityName).push(contenu);
        }
        return { ...lot, contents: gardees };
      });
    } catch (erreur) {
      console.error(`[Memory/FTS] duplicate guard skipped: ${erreur.message}`);
      return ajoutOrigine.call(this, lots);
    }
    const resultats = ajoutOrigine.call(this, filtres);
    for (const r of resultats) {
      const doublons = ecartes.get(r.entityName);
      if (doublons?.length) {
        r.skippedAsNearDuplicate = doublons;
      }
    }
    return resultats;
  };

  const creationOrigine = prototype.createEntities;
  prototype.createEntities = function (entites) {
    let dedoublonnees = entites;
    try {
      dedoublonnees = entites.map((e) => {
        const vues = new Set();
        return { ...e, observations: (e.observations ?? []).filter((o) => estNouvelle(vues, o)) };
      });
    } catch (erreur) {
      console.error(`[Memory/FTS] duplicate guard skipped on create: ${erreur.message}`);
    }
    return creationOrigine.call(this, dedoublonnees);
  };
}
