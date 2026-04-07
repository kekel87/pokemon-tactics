# Backlog — Bugs et Feedback

Centralise les bugs connus et les retours de playtest non encore traités.

## Bugs

### Confusion wobble post-KO
- **Source** : observation interne
- **Description** : un Pokemon confus qui est KO continue à osciller (tween confusion non stoppé dans `playFaintAndStay`)
- **Statut** : ouvert

## Feedback visuel

### Distinguer alliés et ennemis sur la grille
- **Source** : playtest proche (2026-04-07)
- **Description** : pas assez clair visuellement qui est allié et qui est ennemi
- **Suggestion** : contour du carré vert fluo pour les alliés, rouge fluo pour les ennemis
- **Question ouverte** : couleurs par équipe (utile en hot-seat multi-équipes) ou simplification alliés/ennemis relatif au joueur actif ?
- **Statut** : ouvert

## Résolus

### ~~Pas d'écran de victoire en mode IA vs IA~~ (plan 042)
- Fix dans `GameController.ts` — le flow BattleEnded → showVictory fonctionne désormais en mode spectateur IA vs IA

### ~~Border blanc sur les badges de statut (InfoPanel)~~ (plan 042)
- `setStrokeStyle` blanc ajouté sur les rectangles de badges dans `InfoPanel.ts`

### ~~Touche Espace pour passer le tour~~ (plan 042)
- Espace → end turn, touche C → recentrer la caméra (décision #219)

### ~~Dégâts Vampigraine pas reflétés sur la HP bar~~ (plan 024)
### ~~Status burn non affiché au spawn en sandbox~~ (plan 024)
### ~~Événements du tour Dummy non animés~~ (fix 2026-04-02)
