# Plan 017 — Prévisualisation AoE

**Statut** : ready
**Créé** : 2026-03-27
**Objectif** : Permettre aux joueurs de visualiser la zone d'effet d'une attaque avant de la lancer.

## Contexte

La prévisualisation AoE (Area of Effect) est une fonctionnalité essentielle pour un jeu tactique. Elle permet aux joueurs de voir clairement quelles cases seront affectées par une attaque avant de la confirmer. Cela améliore la prise de décision et réduit les erreurs tactiques.

## Étapes d'implémentation

### 1. Core : Génération de la prévisualisation
- **Ajouter une méthode `getAoePreview`** dans `BattleEngine` ou un helper dédié.
  - **Entrées** : `casterPosition`, `moveId`, `direction` (si applicable).
  - **Sortie** : Liste des positions ciblées (`GridPosition[]`) ou une grille de prévisualisation (`PatternCell[][]`).
  - **Logique** : Utiliser les `targeting resolvers` existants pour déterminer les cases ciblées.
- **Tests unitaires** : Vérifier que la prévisualisation correspond aux cibles réelles pour chaque `targeting pattern`.

### 2. Renderer : Affichage de la prévisualisation
- **Intégrer la prévisualisation dans `GameController`** :
  - Ajouter un état `previewing_attack` à la state machine.
  - Appeler `getAoePreview` quand le joueur sélectionne une attaque et une direction.
- **Affichage visuel** :
  - Utiliser des highlights semi-transparents (ex : rouge pour les cibles, bleu pour la zone de déplacement).
  - Superposer une grille ou des icônes sur les cases ciblées.
  - Permettre au joueur de confirmer ou annuler l'attaque.

### 3. Interaction utilisateur
- **Flow utilisateur** :
  1. Le joueur sélectionne une attaque dans le sous-menu.
  2. Le joueur choisit une direction (si applicable).
  3. La prévisualisation AoE s'affiche sur la grille.
  4. Le joueur confirme ou annule l'attaque.
- **Feedback visuel** :
  - Afficher un bouton "Confirmer" ou "Annuler" près du curseur.
  - Utiliser des couleurs distinctes pour les cibles alliées/ennemies.

### 4. Tests et validation
- **Tests unitaires** : Vérifier que la prévisualisation est cohérente avec les cibles réelles.
- **Tests d'intégration** : Tester le flow complet (sélection → prévisualisation → confirmation).
- **Validation visuelle** : S'assurer que la prévisualisation est claire et intuitive.

## Livrables
- Méthode `getAoePreview` dans le core.
- Intégration de la prévisualisation dans le renderer.
- Flow utilisateur fluide pour confirmer/annuler une attaque.
- Tests unitaires et d'intégration.

## Dépendances
- Plan 016 (infos attaques UI) : Les infos détaillées des attaques sont déjà disponibles, ce qui facilite l'intégration de la prévisualisation.

## Risques
- **Complexité visuelle** : La prévisualisation pourrait encombrer l'UI si mal conçue. Solution : Utiliser des couleurs transparentes et des icônes discrètes.
- **Performance** : Le calcul de la prévisualisation pourrait être coûteux. Solution : Optimiser les `targeting resolvers` existants.

## Validation
- **Critères de succès** :
  - La prévisualisation s'affiche correctement pour tous les `targeting patterns`.
  - Le joueur peut confirmer ou annuler une attaque après avoir vu la prévisualisation.
  - L'UI reste claire et intuitive.
