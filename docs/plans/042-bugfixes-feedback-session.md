---
status: done
created: 2026-04-07
updated: 2026-04-07
---

# Plan 042 — Bugfixes et feedback playtest

## Objectif

Corriger les bugs connus et intégrer les retours de playtest avant d'attaquer la Phase 3. Base propre pour la démo publiée.

## Contexte

Phase 2 vient d'être publiée. Le backlog contient 1 bug fonctionnel et 3 retours de playtest. On traite tout dans un seul plan car ce sont des changements localisés dans le renderer.

## Étapes

### Étape 1 — HP bar colorée par équipe

Remplacer le système vert/jaune/rouge par la couleur d'équipe du Pokemon.

- [x] Supprimer les constantes `HP_COLOR_HIGH`, `HP_COLOR_MEDIUM`, `HP_COLOR_LOW`, `HP_THRESHOLD_HIGH`, `HP_THRESHOLD_LOW` de `constants.ts`
- [x] Supprimer `getHpColor()` dans `InfoPanel.ts` et `PokemonSprite.ts`
- [x] Utiliser `getTeamColorByPlayerId(playerId)` pour colorer la HP bar dans `PokemonSprite.ts` (via `teamColor` stocké au constructeur, lu depuis `pokemon.playerId`)
- [x] Utiliser la couleur d'équipe pour la HP bar dans `InfoPanel.ts` (passée via `drawHpBar(hpRatio, teamColor)`)

### Étape 2 — Preview dégâts en noir semi-transparent

Remplacer les deux rouges du damage preview par du noir semi-transparent pour éviter les conflits avec les couleurs d'équipe.

- [x] Remplacer `DAMAGE_ESTIMATE_COLOR_GUARANTEED` et `DAMAGE_ESTIMATE_COLOR_POSSIBLE` par `DAMAGE_ESTIMATE_COLOR` (0x000000) avec alphas séparés (0.5 guaranteed, 0.3 possible)

### Étape 3 — Border blanc sur les badges de statut

- [x] Ajouter `lineStyle(1, 0xffffff, 0.5)` + `strokeRoundedRect` sur les badges dans `InfoPanel.ts`

### Étape 4 — Touche Espace pour end turn

- [x] Espace remappé de recentrage caméra → `handleSpaceKey()` (end turn uniquement en phase `action_menu`)
- [x] Touche `C` ajoutée pour le recentrage caméra (remplacement)

### Étape 5 — Bug IA vs IA : pas d'écran de victoire

- [x] Cause identifiée : le chemin AI (`onTurnReady` → `processEvents` → `refreshUI`) ne vérifiait pas `BattleEnded`
- [x] Ajout de la vérification `BattleEnded` dans le chemin AI de `refreshUI()`, identique à celle de `executeAction()`

## Critères de complétion

- [x] HP bar affiche la couleur d'équipe (pas vert/jaune/rouge)
- [x] Preview dégâts en noir semi-transparent (lisible sur toutes les couleurs d'équipe)
- [x] Badges de statut ont un border blanc
- [x] Espace passe le tour (uniquement en phase d'action)
- [x] IA vs IA affiche l'écran de victoire
- [x] `pnpm build` + `pnpm lint` + `pnpm typecheck` + `pnpm test` passent

## Risques

- Aucun risque majeur — changements localisés dans le renderer, aucun impact sur le core
