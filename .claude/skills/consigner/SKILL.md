---
name: consigner
description: Consigne un lot terminé dans le graphe (décisions, implémentation, plan clos, retours soldés) et met à jour les documents qu'il touche, puis le wiki si le jeu change pour le joueur. À lancer par la case `consigner` du menu de finalisation, ou après une release (`/publish`, étape wiki seule).
user-invocable: true
---

Porte sur ce que le lot a produit. L'état de la session (`historique`, `agenda`) appartient à `/cloture`.
Outils du graphe : `scripts/memory/README.md` et `query.mjs --help`.

## Étapes

1. Lire le lot : le plan et son tableau d'écarts, `git show --stat <commits>`, ce que l'humain a tranché en
   recette. Chercher au graphe ce qui existe déjà (`--open plan-<n>`, recherche par sujet) et le confronter
   au code livré : un commit, un fichier ou un test cité qui ne correspond pas s'invalide puis se réécrit.
   Critère : la liste de ce qui manque ou est faux, au graphe et dans chaque document de la table.
2. Une entité `decision-<n>` par choix fait pendant le lot (numéro suivant le dernier de `--type decision`),
   observations `Date`, `Question`, `Décision`, `Contexte` ; le contexte porte le pourquoi. Une décision qui
   en change une autre se relie (`révise`, `remplace`) et l'ancienne garde son texte.
3. `plan-<n>` (objectif, contexte, trouvailles, pas le découpage en étapes) et `plan-<n>-implementation`
   (fichiers clés, ce qui a été livré autrement que prévu), reliés aux décisions par `cite` et `détaille`.
   Le fichier du plan reste dans `docs/plans/`, statut `done` et tableau d'écarts en tête.
4. Retours de joueurs soldés : `--resolve` (`retour` → `retour-traité`) ; un bug soldé de même. Un défaut
   trouvé en route : demander à l'humain, rien au backlog sans son accord.
5. Documents, selon la table ci-dessous ; un document décrit le jeu tel qu'il est, son historique va au
   graphe. Critère : `pnpm audit:flow` vert (plafond 150 Ko par document, alerte à 110 Ko).
6. Métriques de calibrage, en silence, dans `plan-<n>-implementation` : à l'arrêt 1, profondeur suggérée,
   réponse de l'humain et ce que la recette a trouvé (une recette qui trouve un bug alors que `Sauter` était
   suggéré : proposer de durcir un critère de `next/arret-1.md`) ; nombre de retours de l'humain en
   recette, correctifs dans les 24-48 h des lots précédents (`git log` depuis leur commit). Deux lots de suite
   avec un correctif : le signaler.
7. Le jeu change pour le joueur (mécanique, roster, contrôles, release) → wiki, en suivant `wiki.md`.
8. Rapport : une ligne par entité (nom, type, relations) et par document touché.

## Où va quoi

| Ce qui arrive | Où |
|---|---|
| Mécanique ajoutée ou changée | `docs/game-design.md` (+ `docs/architecture.md` si nouveau pattern) |
| Structure, paquet, pattern | `docs/architecture.md` |
| Constante visuelle, couleur, depth | `docs/design-system.md` |
| Réseau, protocole | `docs/multiplayer.md` |
| Étape de roadmap livrée | `docs/roadmap.md` : une ligne courte, le détail au graphe |
| Source de données, lib, outil | `README.md`, section Sources et crédits |
| Pokemon, move, talent ajouté | rien : la vérité est dans `packages/data` |
