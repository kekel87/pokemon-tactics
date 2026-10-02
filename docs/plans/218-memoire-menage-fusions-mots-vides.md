# Plan 218 — Mémoire : fusionner les morceaux, retirer le bruit, une seule liste de mots vides

**Statut** : done (2026-10-02, recette sautée)
**Ouvert le** : 2026-10-02, suites du plan 217 acceptées par l'humain (« essaie de tout faire »)
**Bloque la release ?** : non
**Taille** : petit à moyen — un geste d'écriture neuf (`--merge`), une migration de données relue,
un fichier partagé JS/Python

## Ce que tu verras à l'écran

1. Une question sur une section découpée par la migration du plan 200 ressort en **une** entité,
   pas en cinq morceaux qui se disputent les 4 places du hook.
2. Les 7 entrées `bruit-import` (titres vides de l'ancien `backlog.md`) ont disparu.
3. L'audit n'affiche plus de lignes de récence orphelines, ni de recopies « Section : … ».
4. Le hook et la recherche écartent exactement les mêmes mots vides.

## Constat (mesuré le 2026-10-02, après le plan 217)

- Audit : **42 groupes** d'entités partagent une observation « Section : … » identique — une même
  section du plan 200 découpée en morceaux (`…-p1`/`…-p2`, `…-01-…`/`…-02-…`). Les 137 candidats
  Jaccard incluent ces groupes et beaucoup de faux positifs (lots de contenu g5 ≈ g6) : **seuls les
  groupes « Section » sont fusionnés**.
- 7 entités `bruit-import`, 3-4 observations chacune, **0 relation**.
- **688 lignes de récence orphelines** : aucune règle ne retire la ligne de récence quand une entité
  est supprimée ou renommée.
- Deux listes de mots vides divergentes : `MOTS_VIDES` (fts.mjs, ~80 mots) et `STOP` (hook, ~150).

## Étapes

- [x] 1 — `scripts/memory/fusion.mjs` (pur) + `query.mjs --merge <cible> <source...>` : déplace les
  observations (quasi-doublons écartés par la garde normalisée), recâble les relations sur la cible
  — tant les relations sortantes (from=source → from=cible) qu'entrantes (to=source → to=cible).
  Après recâblage, retirer les doublets (mêmes from, to, type : contrainte UNIQUE du schéma) en
  gardant la relation la plus ancienne, puis rejeter toute boucle (from=to). Fusionner les lignes
  de `entity_recency` en gardant le timestamp le plus élevé. Supprimer les sources dans une
  transaction unique. Gardes : cible et sources existent, types identiques, cible ∉ sources.
  Tests unitaires (fusion.test.ts, base `node:sqlite` en mémoire comme fts.test.ts) : fusion simple, avec quasi-doublons d'observations, relations
  entrantes/sortantes, suppression des doublets de relations, refus de boucles, récence fusionnée.
- [x] 2 — Triggers de récence dans `SCHEMA` du fts.mjs : 
  - `AFTER DELETE ON entities` retire la ligne de `entity_recency` (WHERE entity_name = old.name).
  - `AFTER UPDATE OF name ON entities` renomme la ligne (UPDATE entity_recency SET entity_name = new.name WHERE entity_name = old.name).
  Tests : créer une entité, vérifier la ligne de récence, supprimer l'entité, vérifier suppression
  (fts.test.ts). Nettoyage des 688 orphelines à la migration (étape 4).
- [x] 3 — `scripts/memory/mots-vides.txt` : une seule liste partagée, un mot par ligne, UTF-8,
  lue par `fts.mjs` ET par le hook. Pas de liste de repli en dur (ce serait recréer la
  divergence) : si le fichier est illisible, le hook se tait (il est déjà enveloppé d'un
  `try/except` qui sort en 0) et la CLI échoue bruyamment. Test de
  contrat (fts.test.ts) : charger le fichier, vérifier qu'il contient les mots
  clés attendus, tester que `termes()` en fts.mjs et `terms()` en hook excluent les mêmes mots
  (récréer le fichier dans le test et vérifier l'accord). Mesure au harnais : après changement,
  `eval-search.mjs` doit montrer ≥ 13/15 en recherche ET hook-probes.tsv ≥ 11/13 positifs, 20/20
  négatifs (sondes du plan 217).
- [x] 4 — Migration, **table relue par l'humain avant application** : un script SQL qui (dans une
  transaction) exécute les 42 fusions (cible = entité de base si elle existe, sinon le nom commun
  des morceaux), supprime les 7 entités `bruit-import`, nettoie les 688 lignes orphelines de
  `entity_recency` (toute ligne dont entity_name n'existe pas en `entities`). Sauvegarde de la base
  avant lancement.
- [x] 5 — **Après que l'étape 4 soit exécutée** : retirer `TYPE_MUET` du code (hook, fts.mjs, audit,
  README) puisque le filtre n'a plus d'objet — les entités `bruit-import` ont disparu. Même lot,
  aucun commit avant le menu de finalisation.

## Écart au plan et résultats (2026-10-02)

🔴 **L'hypothèse « observation Section partagée = section découpée » était fausse.** Mesuré sur
la base : 91 groupes partagent un « Section : … », dont **5 seulement** sont un même texte coupé
(`-p1`, `-p2`…) ; **79 sont des listes** que la migration du plan 200 a éclatées en un fait par
entité (« Fait en Phase 4 » : 55 livrables distincts ; « Révisé au plan 189 » : des révisions de
décisions différentes). Les fusionner aurait écrasé 55 faits dans une entité. Remonté à l'humain,
qui a tranché : **5 fusions seulement**.

- 5 entités reconstituées depuis 26 morceaux, renommées sans suffixe
  (`implementation-récapitulatif`, `-attaques-393-implémentées`, `-pokemon-gen-1-151`,
  `-talents-77-implémentés`, `-objets-tenus-88-implémentés`), 22 quasi-doublons écartés.
- 7 `bruit-import` supprimées ; filtre `TYPE_MUET` retiré du code.
- 688 lignes de récence orphelines purgées ; audit : 0.
- Mots vides : liste unique de 185 mots (`mots-vides.txt`), union des deux anciennes.
- Sondes inchangées : recherche 13/15, hook 11/13 et 20/20. Index FTS cohérent (15 222 = 15 222).
- Trouvé en route : better-sqlite3 active les clés étrangères — renommer une entité exige
  `defer_foreign_keys` dans la transaction. Pour ne pas avoir à redécouvrir ce piège,
  `--merge` accepte désormais une cible **nouvelle**, créée au type des sources (passe
  `/simplify`) : recoller `x-p1`, `x-p2` sous `x` ne demande plus de renommage.

## Hors périmètre

- Les autres candidats Jaccard (faux positifs majoritaires) : l'audit continue de les proposer.
- Les règles `NUMEROTANTS` restent dupliquées JS/Python (contrat déjà testé).
