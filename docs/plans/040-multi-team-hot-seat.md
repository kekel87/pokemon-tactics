---
status: done
created: 2026-04-05
updated: 2026-04-05
---

# Plan 040 — Hot-seat multi-équipes (2 à 12 joueurs)

## Objectif

Étendre le jeu de 2 équipes fixes à 2, 3, 4, 6 ou 12 équipes jouables en hot-seat, avec une carte redimensionnée 12×20 et une UI de sélection d'équipe dynamique.

## Contexte

Le core supporte déjà N équipes (`MapFormat`, `PlacementPhase`, `BattleEngine.checkVictory`) mais `PlayerId` est limité à 2 valeurs et toute l'UI est câblée en dur sur 2 joueurs. La décision #115 avait explicitement scopé le plan 013 à 2 joueurs en attendant ce plan. Le game design documente les formats 2p/3p/4p/6p/12p depuis les décisions #100 et #3.

## Étapes

### Étape 1 — Étendre `PlayerId` à 12 valeurs (core)

- [ ] Dans `packages/core/src/enums/player-id.ts` : ajouter `Player3` à `Player12` dans le const object
- [ ] Vérifier que les 699 tests existants passent toujours (aucun test ne doit casser — l'enum est additif)
- [ ] Complexité : faible (~15 min)

### Étape 2 — Étendre la serpentine de placement pour N équipes (core)

- [ ] Dans `packages/core/src/battle/PlacementPhase.ts` : remplacer l'alternance P1-P2-P2-P1 par une serpentine généralisée à N équipes
  - Algorithme : `P1-P2-...-PN-PN-...-P2-P1-P1-P2-...` (round-robin puis inversion, répété)
  - Le cas N=2 doit produire le comportement actuel identique
- [ ] Tests unitaires : cas N=2 (comportement inchangé), N=3, N=4, N=6, N=12
- [ ] Complexité : moyenne (~1h)

### Étape 3 — `TeamSelectResult` : passer du tuple au tableau dynamique

- [ ] Dans `packages/renderer/src/scenes/TeamSelectScene.ts` ou type partagé : changer `TeamSelectResult` de `[Team, Team]` en `Team[]`
- [ ] Mettre à jour tous les consommateurs : `GameController.ts`, `BattleSetup.ts`, `BattleScene.ts`
- [ ] Vérifier que le build compile sans erreur
- [ ] Complexité : faible (~30 min)

### Étape 4 — Redimensionner `poc-arena` et ajouter les formats de spawn (data)

- [ ] Dans `packages/data/src/maps/poc-arena.ts` : changer `width` à 12, `height` à 20
- [ ] Mettre à jour le format 2 équipes existant avec les nouvelles zones de spawn :
  - P1 (haut) : y=0-1, x=2-9 (8 tiles × 2 rangées = 16 positions, max 6 utilisées)
  - P2 (bas) : y=18-19, x=2-9
- [ ] Ajouter le format 3 équipes :
  - P1 (bas) : y=18-19, x=4-7
  - P2 (haut) : y=0-1, x=4-7
  - P3 (gauche milieu) : x=0-1, y=10-13
- [ ] Ajouter le format 4 équipes (4 coins) :
  - P1 (BL) : x=0-2, y=18-19
  - P2 (BR) : x=9-11, y=18-19
  - P3 (TL) : x=0-2, y=0-1
  - P4 (TR) : x=9-11, y=0-1
- [ ] Ajouter le format 6 équipes (4 coins + 2 bords centre) :
  - P1 (BL) : x=0-1, y=19
  - P2 (BR) : x=10-11, y=19
  - P3 (TL) : x=0-1, y=0
  - P4 (TR) : x=10-11, y=0
  - P5 (TC) : x=5-6, y=0
  - P6 (BC) : x=5-6, y=19
- [ ] Ajouter le format 12 équipes (périmètre, 1 position chacun, espacées régulièrement)
  - 12 positions le long du périmètre de la carte 12×20
- [ ] Vérifier que `validate.ts` accepte les nouveaux formats (teamCount == spawnZones.length, total <= 12)
- [ ] Complexité : moyenne (~1h)

### Étape 5 — TEAM_COLORS : 12 couleurs distinctes (renderer)

- [ ] Dans `packages/renderer/src/constants.ts` : ajouter `TEAM_COLORS` tableau de 12 valeurs hex
  - Index 0 (P1) : bleu `#3B82F6` (couleur existante Player 1)
  - Index 1 (P2) : rouge `#EF4444` (couleur existante Player 2)
  - Index 2 (P3) : vert `#22C55E`
  - Index 3 (P4) : jaune `#EAB308`
  - Index 4 (P5) : violet `#A855F7`
  - Index 5 (P6) : orange `#F97316`
  - Index 6 (P7) : cyan `#06B6D4`
  - Index 7 (P8) : rose `#EC4899`
  - Index 8 (P9) : lime `#84CC16`
  - Index 9 (P10) : brun `#92400E`
  - Index 10 (P11) : bleu clair `#67E8F9`
  - Index 11 (P12) : gris `#9CA3AF`
- [ ] Mettre à jour `GRID_SIZE` si la hauteur 20 impacte les dimensions affichées
- [ ] Documenter `TEAM_COLORS` dans `docs/design-system.md`
- [ ] Complexité : faible (~20 min)

### Étape 6 — Remplacer les ternaires de couleur par `TEAM_COLORS` (renderer)

- [ ] Dans `packages/renderer/src/ui/InfoPanel.ts` : remplacer le ternaire `player1 ? BLUE : RED` par `TEAM_COLORS[playerIndex]`
- [ ] Dans `packages/renderer/src/ui/TurnTimeline.ts` : même remplacement
- [ ] Dans `packages/renderer/src/ui/BattleLogPanel.ts` : même remplacement
- [ ] Dans `packages/renderer/src/game/GameController.ts` : utiliser `TEAM_COLORS` pour colorier les zones de spawn dynamiquement
- [ ] Complexité : faible (~30 min)

### Étape 7 — Mise à jour `BattleScene` : IDs Pokemon dynamiques (renderer)

- [ ] Dans `packages/renderer/src/scenes/BattleScene.ts` : remplacer la génération d'ID `p1-${name}` / `p2-${name}` par une boucle sur `teams.length`
  - Format : `p${teamIndex + 1}-${name}` pour toutes les équipes
- [ ] Vérifier que le placement, le combat et l'écran de victoire fonctionnent avec 3+ équipes
- [ ] Complexité : faible (~20 min)

### Étape 8 — Sélecteur de nombre d'équipes dans `TeamSelectScene` (renderer)

- [ ] Ajouter un `teamCount` state (valeurs : 2, 3, 4, 6, 12)
- [ ] Afficher dans la bottom bar un sélecteur `[N équipes ▼]` aligné avec "Placement auto" et "Lancer"
  - Format : dropdown ou bouton cyclique (clic avance au format suivant : 2→3→4→6→12→2)
- [ ] Quand `teamCount` change :
  - Créer ou supprimer les encadrés d'équipe en conséquence
  - Conserver les équipes déjà construites si possible (tronquer si > `maxPokemonPerTeam`)
  - Recalculer `maxPokemonPerTeam` = 12 / teamCount
- [ ] Le bouton "Lancer" n'est actif que si **toutes** les équipes (pas seulement 2) sont validées
- [ ] Complexité : élevée (~2h)

### Étape 9 — Layout à 2 colonnes dynamique dans `TeamSelectScene` (renderer)

- [ ] Remplacer le layout 2-colonnes fixes (P1 gauche / P2 droite) par un layout dynamique :
  - Toujours 2 colonnes (gauche + droite), grille de portraits au centre
  - Les équipes s'empilent verticalement dans chaque colonne
  - Nombre impair → colonne gauche reçoit une équipe de plus
  - Nombre de slots par équipe = `maxPokemonPerTeam` (12/teamCount)
  - La hauteur d'un slot de portrait s'ajuste pour que toutes les équipes tiennent verticalement
- [ ] Cas 12 équipes (1 Pokemon chacune) : ligne compacte par équipe (nom + toggle Humain/IA + 1 portrait)
- [ ] Le toggle Humain/IA est disponible sur chaque encadré d'équipe quel que soit le `teamCount`
- [ ] Complexité : élevée (~2-3h)

### Étape 10 — Suppression des hypothèses 2-équipes dans `BattleSetup.ts` (renderer)

- [ ] Dans `packages/renderer/src/game/BattleSetup.ts` : retirer tout ce qui suppose exactement 2 équipes
  - Boucle générique sur `teams` pour créer les `PokemonInstance[]` par équipe
  - Passer le `teamCount` correct à `PlacementPhase`
- [ ] Complexité : faible (~30 min)

### Étape 11 — Tests visuels et smoke test multi-équipes

- [ ] Test visuel Playwright : vérifier que la `TeamSelectScene` affiche correctement 2, 3 et 4 équipes
- [ ] Smoke test headless : lancer un combat 4v3v3v2 (4 équipes), vérifier que la victoire est détectée et que le log est cohérent
- [ ] Complexité : moyenne (~1h)

## Critères de complétion

- `pnpm test` passe sans régression (≥ 699 tests)
- `pnpm build` compile sans erreur
- On peut sélectionner 2, 3, 4, 6 ou 12 équipes dans `TeamSelectScene` et lancer un combat
- Le combat 2 équipes est strictement identique au comportement d'avant ce plan
- La `poc-arena` affiche correctement les zones de spawn colorées pour chaque format
- La timeline, l'InfoPanel et le BattleLog utilisent les 12 couleurs distinctes selon l'équipe

## Risques / Questions

- **Lisibilité à 12 équipes** : 12 couleurs distinctes suffisamment contrastées sur fond sombre — à valider visuellement avec le `visual-tester`
- **Taille des portraits à 12 équipes** : à 1 Pokemon/équipe, 12 lignes compactes doivent tenir dans l'écran sans scroll — calculer la hauteur minimale acceptable
- **Compatibilité sandbox** : le bypass `?sandbox` dans `TeamSelectScene` ignore le sélecteur de nombre d'équipes — vérifier que le sandbox continue de fonctionner
- **InfoPanel et TurnTimeline** : ces composants supposent-ils 2 couleurs dans d'autres endroits non encore identifiés ? Faire un grep exhaustif avant l'étape 6
- **GRID_SIZE** : la grille passe de 12×12 à 12×20 — vérifier l'impact sur le zoom initial et le pan caméra dans `BattleScene`

## Dépendances

- **Requiert** : plan 033 terminé (TeamSelectScene de base, `validateTeamSelection`, flow placement) ✅
- **Requiert** : plan 039 terminé (animations, structure BattleScene stable) ✅
- **Débloque** : plan 029 (IA jouable) — permettra de tester l'IA contre plusieurs équipes humaines
- **Débloque** : repo public (la feature "multi-équipes" est listée dans la roadmap Phase 2 comme prérequis à la publication)
