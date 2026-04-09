# Backlog — Bugs et Feedback

Centralise les bugs connus et les retours de playtest non encore traités.

## Bugs

### Police WOFF2 corrompue
- `public/assets/fonts/pokemon-emerald-pro.woff2` : problème CFF sur certains navigateurs — le TTF fallback fonctionne
- Fix mineur : re-générer le WOFF2 ou supprimer la déclaration WOFF2 du `@font-face` pour éviter la tentative de chargement

## Feedback visuel

*(rien d'ouvert)*

## Tâches futures identifiées (hors backlog actif)

### Marquages d'arène → tiles Tiled
- Les overlay Graphics (pokeball centrale, lignes latérales) devraient être des tiles Tiled dans le layer `decorations`, pas des Graphics Phaser dessinés au runtime
- À traiter dans un plan dédié (après tileset custom)

### Tileset custom pour remplacer les tiles JAO
- Les tiles ICON Isometric Pack (Jao) sont libres mais limitées — un tileset custom permettrait d'améliorer la lisibilité tactique
- À planifier après implémentation du rendu des dénivelés (height rendering)

## Résolus

### ~~Confusion wobble post-KO~~ (commit a0b0c0a)
- Tween confusion stoppé dans `playFaintAndStay`

### ~~Distinguer alliés et ennemis sur la grille~~ (plan 042)
- HP bars, InfoPanel, Timeline et BattleLog colorisés par couleur d'équipe (12 couleurs, `TEAM_COLORS` dans constants.ts)

### ~~Pas d'écran de victoire en mode IA vs IA~~ (plan 042)
- Fix dans `GameController.ts` — le flow BattleEnded → showVictory fonctionne désormais en mode spectateur IA vs IA

### ~~Border blanc sur les badges de statut (InfoPanel)~~ (plan 042)
- `setStrokeStyle` blanc ajouté sur les rectangles de badges dans `InfoPanel.ts`

### ~~Touche Espace pour passer le tour~~ (plan 042)
- Espace → end turn, touche C → recentrer la caméra (décision #219)

### ~~Dégâts Vampigraine pas reflétés sur la HP bar~~ (plan 024)
### ~~Status burn non affiché au spawn en sandbox~~ (plan 024)
### ~~Événements du tour Dummy non animés~~ (fix 2026-04-02)
