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
  query.mjs --resolve <nom> <observation> [obs...]        SOLDE une entité : consigne
      la ou les observations de clôture ET bascule son type (backlog → backlog-résolu,
      question-ouverte → question-résolue). Un seul geste : c'est de la séparation des
      deux que venait la dérive — voir --retype.
  query.mjs --retype <nom> <type>                         change le type d'une entité
      (bascule brute, sans rien consigner ; préférez --resolve pour solder)
  query.mjs --forget <nom> <fragment>                     RETIRE une observation
      (la seule qui contienne <fragment> ; refuse s'il y en a plusieurs, et
      RÉIMPRIME en entier ce qu'elle retire — c'est le seul geste destructeur)
  query.mjs --forget-all <nom> <fragment>                 retire TOUTES celles qui
      contiennent <fragment>, chacune réimprimée

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

/**
 * Type d'arrivée quand on solde une entité. Sans cette table, la bascule se faisait
 * en SQL écrit à la main, hors de l'outil — et elle ne se faisait donc pas : les
 * entités soldées recevaient bien leur observation « RÉSOLU le … » (un AJOUT, le
 * seul geste que --add sache faire) mais gardaient leur type. Vingt-quatre entrées
 * de backlog étaient dans cet état le 2026-09-14.
 */
const TYPE_SOLDE = new Map([
  ["backlog", "backlog-résolu"],
  ["question-ouverte", "question-résolue"],
]);

/** Bascule le type ET la ligne `kind='type'` de l'index FTS, que le trigger tient à jour. */
function retyper(nom, type) {
  const avant = store.db.prepare("SELECT entity_type t FROM entities WHERE name = ?").get(nom);
  if (!avant) {
    console.error(`entité introuvable : ${nom}`);
    process.exit(1);
  }
  if (avant.t === type) {
    return { inchange: true, avant: avant.t };
  }
  store.db.prepare("UPDATE entities SET entity_type = ? WHERE name = ?").run(type, nom);
  return { inchange: false, avant: avant.t };
}

if (args[0] === "--retype") {
  const [nom, type] = args.slice(1);
  if (!nom || !type) {
    console.error("usage : --retype <nom> <type>");
    process.exit(1);
  }
  const r = retyper(nom, type);
  console.log(r.inchange ? `déjà de ce type : ${nom} [${type}]` : `${nom} : ${r.avant} → ${type}`);
  process.exit(0);
}

if (args[0] === "--resolve") {
  // Solder = consigner POURQUOI c'est clos, puis basculer le type. Les deux ensemble,
  // parce que séparés l'un se fait et l'autre s'oublie.
  const [nom, ...obs] = args.slice(1);
  if (!nom || !obs.length) {
    console.error(
      "usage : --resolve <nom> <observation> [observation...]\n" +
        "  l'observation dit ce qui l'a soldée (plan, décision, commit) — elle n'est pas optionnelle.",
    );
    process.exit(1);
  }
  const actuel = store.db.prepare("SELECT entity_type t FROM entities WHERE name = ?").get(nom);
  if (!actuel) {
    console.error(`entité introuvable : ${nom}`);
    process.exit(1);
  }
  const cible = TYPE_SOLDE.get(actuel.t);
  if (!cible) {
    // Distinguer « déjà soldée » de « type inconnu » : sur un rejeu après incident,
    // annoncer un type inconnu et pointer vers --retype enverrait retyper une entité
    // qui n'a besoin de rien.
    const dejaSolde = [...TYPE_SOLDE.values()].includes(actuel.t);
    console.error(
      dejaSolde
        ? `${nom} est déjà soldée [${actuel.t}] — rien à faire.`
        : `type « ${actuel.t} » sans forme soldée connue (attendu : ${[...TYPE_SOLDE.keys()].join(", ")}).\n` +
            "  Pour une bascule délibérée vers un autre type : --retype.",
    );
    process.exit(1);
  }
  // UNE SEULE transaction. Séparés, l'ajout pouvait passer et la bascule échouer
  // (busy_timeout de 5 s, et le hook de sauvegarde fait un wal_checkpoint sur Stop) :
  // on obtenait une entité portant « RÉSOLU » et toujours typée backlog, c'est-à-dire
  // le défaut même que cette commande existe pour empêcher.
  let ajoutees = 0;
  let saut = 0;
  store.db.transaction(() => {
    const r = store.addObservations([{ entityName: nom, contents: obs }]);
    // Le store REND ce qu'il a ajouté : le lire, plutôt que de le recalculer par
    // soustraction — la mesure existe, la reconstitution pourrait diverger d'elle.
    ajoutees = r[0]?.addedObservations?.length ?? 0;
    saut = r[0]?.skippedAsNearDuplicate?.length ?? 0;
    store.db.prepare("UPDATE entities SET entity_type = ? WHERE name = ?").run(cible, nom);
  })();
  console.log(
    `soldé : ${nom} — ${actuel.t} → ${cible}` +
      ` (+${ajoutees} observation(s)${saut ? `, ${saut} quasi-doublon(s) écarté(s)` : ""})`,
  );
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

if (args[0] === "--forget" || args[0] === "--forget-all") {
  // Le graphe était en AJOUT SEUL : --add complète, rien ne retire. Conséquence
  // mesurée, agenda-prochaine-etape-courante accumulait ses versions successives au
  // lieu de les remplacer, et le tri plaçait la PÉRIMÉE avant la bonne — la panne
  // exacte que ce pointeur au nom stable existait pour éviter.
  const tout = args[0] === "--forget-all";
  const reste = args.slice(1);
  // Refuser les arguments surnuméraires, plutôt que de les jeter en silence : sans
  // guillemets, « --forget-all agenda le plan 42 » réduisait le fragment à « le » et
  // vidait l'entité en sortant 0. Le fragment DOIT être un seul argument.
  if (reste.length !== 2) {
    console.error(
      `usage : ${args[0]} <nom> <fragment>\n` +
        `  le fragment doit être UN seul argument, entre guillemets — reçu ${reste.length}.`,
    );
    process.exit(1);
  }
  const [nom, fragment] = reste;
  // Plancher de longueur : un fragment d'un caractère correspond à presque tout.
  const FRAGMENT_MIN = 10;
  if (fragment.trim().length < FRAGMENT_MIN) {
    console.error(
      `fragment trop court (${fragment.trim().length} caractères utiles, minimum ${FRAGMENT_MIN}).\n` +
        "  Copiez une phrase entière depuis --open : c'est une sous-chaîne exacte, pas un mot-clé.",
    );
    process.exit(1);
  }
  const existe = store.db.prepare("SELECT 1 FROM entities WHERE name = ?").get(nom);
  if (!existe) {
    console.error(`entité introuvable : ${nom}`);
    process.exit(1);
  }
  const touchees = store.db
    .prepare("SELECT content FROM observations WHERE entity_name = ? AND instr(content, ?) > 0")
    .all(nom, fragment)
    .map((r) => r.content);

  if (!touchees.length) {
    // Dire POURQUOI ça ne correspond pas : sinon l'appelant élargit son fragment,
    // et c'est comme ça qu'on retombe sur une sur-suppression.
    // Code 1 ASSUMÉ, donc non idempotent : rejouer un --forget déjà appliqué échoue.
    // C'est voulu — sur un geste destructeur, « rien à faire » et « je ne trouve pas
    // ce que tu visais » se ressemblent trop pour qu'on les confonde en silence.
    console.error(
      `aucune observation de ${nom} ne contient : ${fragment}\n` +
        "  La recherche est une SOUS-CHAÎNE EXACTE, sensible à la casse et aux accents.\n" +
        "  Copiez le texte depuis --open plutôt que de le retaper.",
    );
    process.exit(1);
  }
  const total = store.db
    .prepare("SELECT COUNT(*) c FROM observations WHERE entity_name = ?")
    .get(nom).c;
  // Vider une entité doit être un geste NOMMÉ, jamais l'effet de bord d'un fragment
  // trop large : une entité sans observation reste indexée et continue de sortir au
  // classement, muette.
  if (touchees.length === total) {
    console.error(
      `refus : ce fragment retirerait les ${total} observations de ${nom}, donc la viderait.\n` +
        "  Une entité vide reste indexée et ressort en recherche sans rien dire.\n" +
        "  Précisez le fragment, ou retirez les observations une à une.",
    );
    process.exit(1);
  }
  const PLAFOND = 5;
  if (tout && touchees.length > PLAFOND) {
    console.error(
      `refus : ${touchees.length} observations correspondent, au-delà du plafond de ${PLAFOND}.\n` +
        "  Un fragment aussi large est presque toujours une erreur de quotation.\n" +
        "  Retirez-les par lots avec des fragments plus précis.",
    );
    process.exit(1);
  }
  if (touchees.length > 1 && !tout) {
    console.error(`${touchees.length} observations contiennent ce fragment — refus.`);
    console.error("Précisez le fragment, ou assumez-les toutes avec --forget-all :");
    for (const o of touchees) {
      console.error(`  · ${o.slice(0, 160)}${o.length > 160 ? " […]" : ""}`);
    }
    process.exit(1);
  }

  // Réimprimer EN ENTIER avant de retirer. Le graphe lui-même ne garde aucun
  // historique — mais la BASE est versionnée par le hook memory-git-sync.sh dans un
  // dépôt privé, donc le geste est rattrapable à la granularité de la sauvegarde.
  // On imprime la commande de rattrapage ici, au moment où elle sert.
  console.log(`retiré de ${nom} :`);
  for (const o of touchees) {
    console.log(`  --- ${o}`);
  }
  store.deleteObservations([{ entityName: nom, observations: touchees }]);
  const restantes = store.db
    .prepare("SELECT COUNT(*) c FROM observations WHERE entity_name = ?")
    .get(nom).c;
  console.log(`${touchees.length} observation(s) retirée(s) — il en reste ${restantes}.`);
  console.log(
    "  rattrapage si c'était une erreur (la base est versionnée par memory-git-sync.sh) :\n" +
      '    git -C "$CLAUDE_CONFIG_DIR/memory/sync" log --oneline -- memory.db\n' +
      '    git -C "$CLAUDE_CONFIG_DIR/memory/sync" show <commit>:memory.db > /tmp/avant.db',
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
