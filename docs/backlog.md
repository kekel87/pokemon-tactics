# Backlog — Bugs et Feedback

Centralise les bugs connus et les retours de playtest non encore traités.

## Bugs

### Pas d'écran de victoire en mode IA vs IA
- **Source** : session 2026-04-03
- **Description** : quand les deux joueurs sont en mode IA, le combat se déroule mais l'écran de victoire ne s'affiche pas
- **Cause probable** : le flow de victoire (event BattleEnded → showVictory) n'est pas déclenché quand aucun humain ne joue
- **Statut** : ouvert

## Feedback visuel

### Distinguer alliés et ennemis sur la grille
- **Source** : playtest proche (2026-04-07)
- **Description** : pas assez clair visuellement qui est allié et qui est ennemi
- **Suggestion** : contour du carré vert fluo pour les alliés, rouge fluo pour les ennemis
- **Question ouverte** : couleurs par équipe (utile en hot-seat multi-équipes) ou simplification alliés/ennemis relatif au joueur actif ?
- **Statut** : ouvert

### Border blanc sur les badges de statut (InfoPanel)
- **Source** : observation interne
- **Description** : les badges de statut (burn, poison, etc.) manquent de contraste sur le fond sombre
- **Solution** : ajouter un `setStrokeStyle` blanc sur les rectangles de badges
- **Statut** : ouvert

## Feedback input

### Touche Espace pour passer le tour
- **Source** : playtest proche (2026-04-07)
- **Description** : convention standard des jeux tactiques sur PC, Espace devrait être mappé sur end turn
- **Statut** : ouvert

## Résolus

### ~~Dégâts Vampigraine pas reflétés sur la HP bar~~ (plan 024)
### ~~Status burn non affiché au spawn en sandbox~~ (plan 024)
### ~~Événements du tour Dummy non animés~~ (fix 2026-04-02)
