# Plan 060 — Silhouette d'occlusion iso + curseur FFTA

**Statut : partial done** — Section A livrée + committée. **Section B abandonnée** (implem stashée bancale, API `filters.external.addMask` Phaser 4 instable). Voir **[plan 061](./061-occlusion-silhouette.md)** qui reprend la silhouette from scratch avec un cadrage propre.
**Démarré le : 2026-04-17**

---

## Objectif

Deux améliorations visuelles du renderer isométrique :
1. **Curseur FFTA** : variantes de curseur flottant au-dessus de la tile survolée, choix en settings.
2. **Silhouette d'occlusion** : afficher la silhouette d'un Pokemon masqué par un obstacle/tile plus haute (X-ray style).

---

## Section A — Curseur FFTA (livré, commité)

- `HOVER_CURSOR_OPTIONS` dans `constants.ts` : 4 variantes (Flèche baseline + 3 curseurs pixellab : claw-arrow, teardrop, v-wings). Chaque option expose `key`, `label`, `scale`.
- `HoverCursor` (nouveau fichier `ui/HoverCursor.ts`) prend un `HoverCursorOption` et expose `setOption(option)`.
- Helper `resolveHoverCursorOption(storedKey)` pour lire le choix persisté.
- Choix persisté via le store settings existant (`pt-settings` / `getSettings()` / `updateSettings()`). Nouveau champ `hoverCursorKey` dans `GameSettings`.
- Nouvelle ligne "Curseur / Cursor" dans `SettingsScene` avec preview sprite live.
- Touche **H** dans `BattleScene` pour cycler entre les variantes.
- Nouvelle clé i18n `settings.cursor` (FR "Curseur", EN "Cursor").

**Bugfix depth curseur au sol** (inclus dans le même commit) :
- `IsometricGrid.showCursor` passe de `DEPTH_CURSOR_ISO_OFFSET = 0.25` (relatif à la tile) à `DEPTH_CURSOR_GROUND = 500` (global).
- Raison : le stroke diamant déborde sur les tiles adjacentes — un curseur iso-sorté est toujours battu par les overlays voisins sur leurs bords est/sud. Depth 500 passe au-dessus de tous les overlays iso (max ~150) et sous les sprites Pokemon (520).
- `DEPTH_CURSOR_ISO_OFFSET` supprimé de `constants.ts`, remplacé par `DEPTH_CURSOR_GROUND`.

### Checklist — Section A

- [x] `HOVER_CURSOR_OPTIONS` (4 variantes, key/label/scale) dans `constants.ts`
- [x] Suppression de `DEPTH_CURSOR_ISO_OFFSET`, ajout de `DEPTH_CURSOR_GROUND = 500`
- [x] `HoverCursor` : prend `HoverCursorOption`, expose `setOption(option)`, helper `resolveHoverCursorOption`
- [x] `GameSettings` étendu avec `hoverCursorKey`
- [x] `SettingsScene` : ligne "Curseur / Cursor" + preview sprite
- [x] Touche **H** dans `BattleScene` pour cycler
- [x] Clé i18n `settings.cursor` (FR + EN)
- [x] Assets curseurs dans `packages/renderer/public/assets/ui/cursor/`
- [x] `docs/design-system.md` mis à jour (tableau curseur, layering, historique)
- [x] `STATUS.md` mis à jour
- [x] Gate CI complète (build + lint + typecheck + test + test:integration)
- [x] Commit + push

---

## Section B — Silhouette d'occlusion (stashée, à reprendre)

Le travail occlusion a été fait en parallèle de la section A puis mis de côté via `git stash` pour garder un commit propre.

### Contenu fonctionnel visé

- `occlusion.ts` : détection des Pokemon occultés par ray-cast iso depuis la caméra vers chaque Pokemon, en traversant les tiles plus hautes qui bloquent la ligne de vue.
- `occlusion.test.ts` : tests unitaires de la détection (plusieurs configurations de terrain + hauteurs).
- Intégration rendu : `PokemonSprite` expose un mode silhouette (teinte couleur équipe semi-transparente, rendu au-dessus des tiles occultantes via depth élevée) ; `GameController` synchronise le mode par frame / par changement d'état de la caméra.
- Touche ou option settings pour désactiver (accessibilité).

### Checklist — Section B

- [ ] `occlusion.ts` : détection ray-cast iso (Pokemon ↔ caméra ↔ tiles hautes)
- [ ] `occlusion.test.ts` : cases unitaires (occultation par tile haute, par autre Pokemon, edge cases)
- [ ] `PokemonSprite` : mode silhouette (teinte + alpha + depth override)
- [ ] `GameController` : synchronisation du mode silhouette par état
- [ ] Tests visuels Playwright
- [ ] `docs/design-system.md` : section silhouette + constantes de teinte
- [ ] `docs/backlog.md` : retirer l'item "silhouette occlusion" si présent
- [ ] Gate CI complète

---

## Reprendre le stash dans une session clean

### Identifier le stash

```bash
git stash list
# stash@{0}: On main: plan-060-full-wip
```

Le stash a été créé **avant** le commit de la section A. Il contient donc à la fois :
- les fichiers occlusion (nouveaux, à garder)
- des anciennes versions des fichiers curseur/depth (à jeter au profit du commit déjà fait sur `main`)

### Contenu du stash

**Fichiers suivis modifiés dans le stash** :
- `docs/backlog.md` — probablement à garder (mise à jour backlog occlusion)
- `docs/design-system.md` — **CONFLIT attendu** (section A a déjà MAJ curseur/layering/historique)
- `docs/plans/README.md` — probablement à garder (entrée plan 060)
- `docs/roadmap.md` — **CONFLIT attendu** (section A a déjà marqué plan 060 en cours)
- `packages/renderer/src/constants.ts` — **CONFLIT attendu** (section A a refactoré cursor + renommé depth)
- `packages/renderer/src/game/GameController.ts` — à garder (intégration occlusion)
- `packages/renderer/src/grid/IsometricGrid.ts` — **CONFLIT attendu** (section A a modifié `showCursor`)
- `packages/renderer/src/scenes/BattleScene.ts` — **CONFLIT attendu** (section A a modifié preload + cycleHoverCursorVariant)
- `packages/renderer/src/sprites/PokemonSprite.ts` — à garder (mode silhouette)

**Fichiers non-suivis dans le stash** (certains sont déjà committés) :
- `packages/renderer/src/grid/occlusion.ts` — **à garder** (nouveau, clean add)
- `packages/renderer/src/grid/occlusion.test.ts` — **à garder** (nouveau, clean add)
- `packages/renderer/src/ui/HoverCursor.ts` — **à jeter** (déjà commité par section A, version plus récente)
- `packages/renderer/public/assets/ui/cursor/hover-cursor.png` — **à jeter** (déjà commité par section A)
- `docs/plans/060-occlusion-silhouette-cursor-ffta.md` — **à jeter** (déjà commité par section A, ce fichier)
- `docs/backlog.md` / `docs/design-system.md` / `docs/plans/README.md` / `docs/roadmap.md` — doublons du bloc "tracked" ci-dessus (le stash les liste dans les deux vues — voir `git stash show -u` vs `git stash show` : une fois "modified" et une fois "untracked" si le fichier avait été add-puis-modifié). Prendre la résolution "tracked" et ignorer les entrées untracked.
- `packages/renderer/src/constants.ts` / `.../grid/IsometricGrid.ts` / `.../scenes/BattleScene.ts` — même remarque, doublons.

### Procédure recommandée (worktree propre sur `main` au HEAD post-section-A)

**Option 1 — Pop + résoudre manuellement (fichier par fichier)** :

```bash
git stash pop --index stash@{0}
# Des fichiers seront marqués "both modified" (UU) par Git — résoudre à la main.
```

Pour chaque fichier en CONFLIT :
- `constants.ts`, `BattleScene.ts`, `IsometricGrid.ts` : **garder la version `main` (section A déjà propre)**, puis rajouter par-dessus uniquement les ajouts liés à l'occlusion (imports, usages d'`occlusion.ts`, champs PokemonSprite, etc.). Le plus simple : copier les diff occlusion à la main en les relisant depuis l'état stashé.
- `design-system.md`, `roadmap.md`, `docs/plans/README.md` : garder la version `main`, ajouter les sections occlusion.
- `docs/backlog.md` : merger normalement.

**Option 2 — Checkout sélectif du stash (plus safe)** :

```bash
# Récupérer uniquement les fichiers clean (nouveaux pour l'occlusion) :
git checkout stash@{0} -- packages/renderer/src/grid/occlusion.ts
git checkout stash@{0} -- packages/renderer/src/grid/occlusion.test.ts

# Pour les fichiers touchés par la section A, voir le diff stashé puis réappliquer
# les hunks occlusion à la main par-dessus la version main actuelle :
git stash show -p stash@{0} -- packages/renderer/src/sprites/PokemonSprite.ts
git stash show -p stash@{0} -- packages/renderer/src/game/GameController.ts
# puis Edit à la main pour recopier uniquement les hunks occlusion.

# Ne pas faire `stash pop` complet pour éviter les conflits massifs.
# Supprimer le stash une fois tout recopié :
git stash drop stash@{0}
```

**Option 2 est recommandée** : le stash contient suffisamment d'ancien code déjà résolu (version pré-section-A) pour que le `pop` crée plus de bruit que de valeur.

### État attendu après reprise

- Fichiers ajoutés : `packages/renderer/src/grid/occlusion.ts`, `packages/renderer/src/grid/occlusion.test.ts`
- Fichiers modifiés par rapport à `main` post-A : `PokemonSprite.ts`, `GameController.ts`, potentiellement `IsometricGrid.ts` (hook d'occlusion par frame), `constants.ts` (constantes teinte/alpha silhouette), `design-system.md`, `roadmap.md`, `backlog.md`, ce fichier (cocher section B).
- Pas de régression sur la section A (curseur + depth fix).

### Garde-fous avant de valider

1. `pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`
2. Lancer le jeu, vérifier manuellement :
   - curseurs paramétrables toujours fonctionnels (section A intacte)
   - silhouette visible à travers les obstacles
   - pas de régression sur les highlights/preview/enemy range
3. `doc-keeper` → `commit-message` comme d'habitude.

---

## Fichiers modifiés (section A, committé)

- `packages/renderer/src/constants.ts` — `HOVER_CURSOR_OPTIONS`, `DEPTH_CURSOR_GROUND`
- `packages/renderer/src/ui/HoverCursor.ts` — nouvelle classe + `resolveHoverCursorOption`
- `packages/renderer/src/grid/IsometricGrid.ts` — `showCursor` avec `DEPTH_CURSOR_GROUND`
- `packages/renderer/src/scenes/BattleScene.ts` — preload options, touche H, intégration settings
- `packages/renderer/src/scenes/SettingsScene.ts` — row Curseur + preview
- `packages/renderer/src/settings/index.ts` — champ `hoverCursorKey`
- `packages/renderer/src/i18n/{types,locales/fr,locales/en}.ts` — clé `settings.cursor`
- `packages/renderer/public/assets/ui/cursor/` — 4 PNG (baseline + 3 variantes pixellab)
- `docs/design-system.md`, `docs/roadmap.md`, `STATUS.md`
