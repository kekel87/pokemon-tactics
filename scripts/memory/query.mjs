/**
 * Interroge le graphe de memoire depuis la ligne de commande.
 *
 * Usage : PT_MEMORY_HOME=<dir> PT_MEMORY_VENDOR=<dir> node query.mjs "ma question"
 *         ... --open <nom-entite>   pour lire une entite en entier
 */
import { ouvrirStore } from "./paths.mjs";

const argvReel = process.argv.slice(2);
const store = await ouvrirStore();

const args = argvReel;

if (!args.length || args[0] === "--help" || args[0] === "-h") {
  console.log(`Interroge le graphe de mémoire du projet.

  query.mjs "mots clés"        recherche classée (index compact)

  Aucune variable d'environnement requise : le chemin se déduit de CLAUDE_CONFIG_DIR.
  Surcharges : PT_MEMORY_HOME (racine du graphe), PT_MEMORY_VENDOR (enveloppe).

  query.mjs --open <nom> ...   observations COMPLÈTES d'une ou plusieurs entités
  query.mjs --stats            taille et composition du graphe
  query.mjs --add <type> <nom> <observation> [obs...]     crée ou complète une entité
  query.mjs --link <de> <relation> <vers>                 relie deux entités

Conseils mesurés le 2026-09-06 :
  · préférez 2-4 mots-clés DISTINCTIFS à une phrase — une requête longue se noie
    dans les mots communs ("roue" trouve du premier coup, pas "roue de caractères
    du salon en ligne quelle décision contredite") ;
  · le mode recherche TRONQUE les observations : dès qu'une entrée compte, relisez-la
    avec --open, sinon vous perdez la fin ;
  · en cas d'homonyme (« Lot B3 » multijoueur vs « batch B3 » du roster), ajoutez un
    mot du domaine.`);
  process.exit(0);
}

if (args[0] === "--add") {
  // Chemin d'ECRITURE. Sans lui le graphe serait en lecture seule, et supprimer
  // les fichiers-memoire laisserait la memoire neuve sans nulle part ou aller.
  // Les outils MCP font la meme chose, mais seulement apres un redemarrage :
  // ce client marche tout de suite, et depuis un script.
  const [type, nom, ...obs] = args.slice(1);
  if (!type || !nom || !obs.length) {
    console.error("usage : --add <type> <nom> <observation> [observation...]");
    process.exit(1);
  }
  const cree = store.createEntities([{ name: nom, entityType: type, observations: obs }]);
  if (cree.length) {
    console.log(`entité créée : ${nom} [${type}]`);
  } else {
    const r = store.addObservations([{ entityName: nom, contents: obs }]);
    const saut = r[0]?.skippedAsNearDuplicate?.length ?? 0;
    console.log(
      `entité existante complétée : ${nom}${saut ? ` (${saut} quasi-doublon(s) écarté(s))` : ""}`,
    );
  }
  process.exit(0);
}

if (args[0] === "--link") {
  const [de, relation, vers] = args.slice(1);
  if (!de || !relation || !vers) {
    console.error("usage : --link <de> <relation> <vers>");
    process.exit(1);
  }
  const c = store.createRelations([{ from: de, to: vers, relationType: relation }]);
  console.log(
    c.length ? `relation créée : (${de}) --${relation}--> (${vers})` : "relation déjà présente",
  );
  process.exit(0);
}

if (args[0] === "--stats") {
  const q = (sql) => store.db.prepare(sql).get();
  const e = q("SELECT COUNT(*) c FROM entities").c;
  const o = q("SELECT COUNT(*) c FROM observations").c;
  const r = q("SELECT COUNT(*) c FROM relations").c;
  console.log(`${e} entités, ${o} observations, ${r} relations`);
  for (const row of store.db
    .prepare("SELECT entity_type t, COUNT(*) c FROM entities GROUP BY t ORDER BY c DESC")
    .all()) {
    console.log(`  ${String(row.c).padStart(5)}  ${row.t}`);
  }
  process.exit(0);
}
const iOpen = args.indexOf("--open");
if (iOpen >= 0) {
  const noms = args.slice(iOpen + 1);
  if (!noms.length) {
    console.error("usage : --open <nom-entité> [autre-nom...]  (voir --help)");
    process.exit(1);
  }
  const r = store.openNodes(noms);
  for (const e of r.entities) {
    console.log(`\n### ${e.name}  [${e.entityType}]`);
    for (const o of e.observations) {
      console.log(`  - ${o}`);
    }
  }
  // openNodes ne rend que les relations INTERNES au lot demandé : ouvrir une seule
  // entité n'en montrait donc aucune, ce qui masque toute la grappe.
  const liens = store.db
    .prepare(
      "SELECT from_entity f, relation_type t, to_entity v FROM relations " +
        `WHERE from_entity IN (${noms.map(() => "?").join(",")}) ` +
        `OR to_entity IN (${noms.map(() => "?").join(",")})`,
    )
    .all(...noms, ...noms);
  if (liens.length) {
    console.log("\n--- relations ---");
    for (const l of liens) {
      console.log(`  (${l.f}) --${l.t}--> (${l.v})`);
    }
  }
} else {
  const requete = args.join(" ");
  const r = store.searchNodes(requete);

  // Quels termes de la question chaque résultat touche-t-il vraiment ? Sans ça, une
  // entité qui ne matche que des mots communs a l'air aussi solide qu'une autre —
  // et sur une requête sans bonne réponse, le moteur rend 10 entités arbitraires
  // qu'on lit au lieu de reformuler (constaté à la mesure du 2026-09-06).
  // Même contrat que le moteur : un mot-outil français est RARE dans ce graphe
  // (« comment », « truc »…), donc la rareté seule le prendrait pour un terme
  // distinctif. La liste d'arrêt est ce qui l'empêche — le filtre statistique ne
  // la remplace pas.
  const CREUX = new Set(
    (
      "alors avec bien bon car ce cela ces cette chose comme comment dans " +
      "des donc elle est eux fait faire faut ici il ils je la le les leur lui mais marche moi " +
      "nous ont ou par pas peut plus pour pourquoi quand que quel quelle qui quoi sans ses son " +
      "sont sur tout trop truc une vous"
    ).split(" "),
  );
  const mots = [
    ...new Set(
      requete
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .match(/[a-z0-9_-]+/g) ?? [],
    ),
  ].filter((m) => m.length > 2 && !CREUX.has(m));
  const total = store.db.prepare("SELECT COUNT(*) c FROM entities").get().c || 1;
  const rarete = new Map();
  for (const m of mots) {
    try {
      rarete.set(
        m,
        store.db
          .prepare(
            "SELECT COUNT(DISTINCT entity_name) c FROM memory_fts " + "WHERE memory_fts MATCH ?",
          )
          .get(`"${m}"`).c / total,
      );
    } catch {
      rarete.set(m, 1);
    }
  }
  const touches = (nom) =>
    mots.filter((m) => {
      try {
        return store.db
          .prepare(
            "SELECT 1 FROM memory_fts WHERE memory_fts MATCH ? " + "AND entity_name = ? LIMIT 1",
          )
          .get(`"${m}"`, nom);
      } catch {
        return false;
      }
    });

  if (!r.entities.length) {
    console.log(
      "aucun résultat — réessayez avec 2-3 mots-clés plus distinctifs " + "(voir --help)",
    );
  }
  let solides = 0;
  for (const e of r.entities) {
    const t = touches(e.name);
    // « distinctif » = présent dans moins de 4 % des entités. Un résultat qui n'en
    // touche aucun est du bruit, quelle que soit sa place au classement.
    const forts = t.filter((m) => (rarete.get(m) ?? 1) <= 0.04);
    if (forts.length) {
      solides++;
    }
    const marque = forts.length
      ? `✔ ${forts.join(", ")}`
      : `≈ faible (seulement : ${t.join(", ") || "rien"})`;
    console.log(`\n### ${e.name}  [${e.entityType}]  — ${marque}`);
    let coupe = false;
    for (const o of e.observations) {
      // Couper au milieu d'une phrase rend l'extrait illisible et fait perdre la
      // fin sans le signaler. On coupe sur une frontière de phrase et on le DIT.
      if (o.length > 600) {
        const p = o.lastIndexOf(". ", 600);
        console.log(`  - ${o.slice(0, p > 200 ? p + 1 : 600)} […]`);
        coupe = true;
      } else {
        console.log(`  - ${o}`);
      }
    }
    if (coupe) {
      console.log(`  ⚠️  tronqué — relire en entier : --open ${e.name}`);
    }
  }
  if (r.entities.length && !solides) {
    console.log(
      "\n⚠️  Aucun résultat ne touche un terme distinctif de la question : " +
        "c'est probablement du bruit. Reformulez avec 2-3 mots-clés plus spécifiques " +
        "(nom de fichier, identifiant, numéro de décision), ou un synonyme.",
    );
  }
  if (r.relations.length) {
    console.log("\n--- relations ---");
    for (const rel of r.relations) {
      console.log(`  (${rel.from}) --${rel.relationType}--> (${rel.to})`);
    }
  }
}
process.exit(0);
