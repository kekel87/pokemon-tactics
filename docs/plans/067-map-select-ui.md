---
status: ready-for-visual-validation
created: 2026-04-23
updated: 2026-04-23
---

# Plan 067 — Écran de sélection de carte

> Suite directe du plan 066. Les 8 maps thématiques sont livrées, il faut maintenant permettre au joueur d'en choisir une avant le combat.

## Objectif

Insérer un écran de sélection de carte dans le flux de navigation, avec aperçu isométrique live de la carte survolée.

## Contexte

- Plan 066 terminé : 8 maps jouables (`simple-arena`, `forest`, `cramped-cave`, `le-mur`, `volcano`, `swamp`, `desert`, `naval-arena`), toutes multi-format.
- `BattleScene.startPlacementPhase()` hardcode `"assets/maps/simple-arena.tmj"` (ligne 273).
- `MapPreviewScene` + `MapPreviewUIScene` existent déjà — ils rendent une map iso en fullscreen. On s'en inspire sans les réutiliser directement.
- `TeamSelectResult` contient `teams`, `autoPlacement`, `turnSystemKind` — on y ajoute `mapUrl`.
- Toutes les maps supportent tous les formats (2/3/4/6/12 teams) → pas de filtrage par teamCount nécessaire.

## Flux de navigation cible

```
MainMenuScene
  → BattleModeScene (local)
    → MapSelectScene          ← NOUVEAU
      → TeamSelectScene (reçoit mapUrl)
        → BattleScene (lit mapUrl depuis teamSelectResult)
```

## Décisions à valider

1. **Preview live ou statique ?**
   - **Live (reco)** : `MapSelectPreviewScene` parallèle avec viewport contrainte (droite de l'écran). Réutilise `loadTiledMap` + `IsometricGrid` + `DecorationsLayer`. Fidèle visuellement, 0 asset supplémentaire.
   - Statique : thumbnails PNG — à générer, plus fragiles, mais plus rapides à afficher.

2. **Metadata des maps** : `maps-registry.ts` côté renderer ou côté data ?
   - **Renderer (reco)** : les URLs sont relatives au `public/` du renderer. La registry ne fait pas de sens dans `packages/data` sans couplage HTTP.
   - Data : si on veut que le core ou les tests y accèdent un jour.

## Étapes

### Étape 1 — Registry des maps (`maps-registry.ts`)

Fichier `packages/renderer/src/maps/maps-registry.ts` :

```ts
export interface MapEntry {
  id: string;
  url: string;
  displayName: { fr: string; en: string };
  description: { fr: string; en: string };
  size: string;      // "14×14"
  tags: string[];    // ["dénivelé", "eau", "poison"]
}

export const MAPS_REGISTRY: MapEntry[] = [
  {
    id: "simple-arena",
    url: "assets/maps/simple-arena.tmj",
    displayName: { fr: "Arène Simple", en: "Simple Arena" },
    description: { fr: "Terrain plat, idéal pour débuter.", en: "Flat terrain, ideal for beginners." },
    size: "12×20",
    tags: [],
  },
  // ... les 7 autres
];
```

Tags proposés (à valider) : `dénivelé`, `eau`, `poison`, `lave`, `herbe haute`, `couloirs`, `glace`.

### Étape 2 — `MapSelectPreviewScene`

Scène Phaser légère qui rend la carte en aperçu isométrique.

- Viewport : `cameras.main.setViewport(LEFT_PANEL_W, 0, CANVAS_WIDTH - LEFT_PANEL_W, CANVAS_HEIGHT)`
- Reçoit `loadMap(url: string)` via événement global ou `scene.get("MapSelectPreviewScene").events.emit("loadMap", url)`
- Au changement de map : détruit le grid précédent, charge la nouvelle, zoom auto pour caler dans le viewport
- Aucune interaction (pas de picking, pas d'overlay)
- Fond sombre pour isoler visuellement du panneau gauche

Constante : `LEFT_PANEL_W = 320` (ou 350 selon la typo).

### Étape 3 — `MapSelectScene`

Scène UI principale.

**Layout** :
```
┌──────────────────────────────────────────────────────┐
│ CHOIX DE LA CARTE                                    │
├─────────────────┬────────────────────────────────────┤
│                 │                                    │
│  simple-arena ◄ │        APERÇU ISO                  │
│  forest         │        (MapSelectPreviewScene)      │
│  cramped-cave   │                                    │
│  le-mur         │        Nom de la carte             │
│  volcano        │        14×14                       │
│  swamp          │        Tags : dénivelé, eau        │
│  desert         │        Description...              │
│  naval-arena    │                                    │
│                 │                                    │
├─────────────────┴────────────────────────────────────┤
│     [Retour]              [Choisir cette carte]      │
└──────────────────────────────────────────────────────┘
```

**Comportement** :
- Sélection initiale : première map de la registry (ou la dernière utilisée via `init({ mapUrl })`)
- Click / flèches ↑↓ pour changer de carte — l'aperçu se recharge
- "Retour" → `BattleModeScene`
- "Choisir cette carte" → `scene.start("TeamSelectScene", { mapUrl })`

**Init** : reçoit `{ mapUrl?: string }` pour pré-sélectionner si l'humain revient en arrière depuis TeamSelectScene.

### Étape 4 — Wiring navigation

**`BattleModeScene`** : "Local" → `MapSelectScene` (au lieu de `TeamSelectScene`).

**`TeamSelectScene`** :
- `init(data: { mapUrl: string })` — stocke `this.mapUrl`
- `TeamSelectResult` + `mapUrl: string`
- Au lancement du combat : `this.scene.start("BattleScene", { teamSelectResult: { ...result, mapUrl: this.mapUrl } })`

**`BattleScene`** :
- `startPlacementPhase` : remplace le hardcode `"assets/maps/simple-arena.tmj"` par `teamSelectResult.mapUrl`

**`main.ts`** : enregistre `MapSelectScene` et `MapSelectPreviewScene` dans la liste des scènes.

### Étape 5 — i18n

Clés à ajouter dans `fr.ts` et `en.ts` :

```ts
"mapSelect.title":   "Choix de la carte" / "Map Selection"
"mapSelect.confirm": "Choisir cette carte" / "Select this map"
"mapSelect.back":    "Retour" / "Back"
```

Les noms et descriptions de maps sont dans `maps-registry.ts` (bilingues directs) — pas via le système i18n.

## Fichiers touchés

| Fichier | Action |
|---------|--------|
| `packages/renderer/src/maps/maps-registry.ts` | Créer |
| `packages/renderer/src/scenes/MapSelectScene.ts` | Créer |
| `packages/renderer/src/scenes/MapSelectPreviewScene.ts` | Créer |
| `packages/renderer/src/scenes/BattleModeScene.ts` | Modifier (target `MapSelectScene`) |
| `packages/renderer/src/scenes/TeamSelectScene.ts` | Modifier (`init`, `TeamSelectResult`) |
| `packages/renderer/src/scenes/BattleScene.ts` | Modifier (lire `mapUrl` depuis result) |
| `packages/renderer/src/main.ts` | Modifier (enregistrer 2 nouvelles scènes) |
| `packages/renderer/src/i18n/locales/fr.ts` | Modifier |
| `packages/renderer/src/i18n/locales/en.ts` | Modifier |
| `packages/renderer/src/i18n/types.ts` | Modifier (nouvelles clés) |

## Hors scope

- Filtrage des maps par teamCount
- Random pick
- Thumbnails PNG statiques
- Tags filtrables (recherche/tri)
- Animation de transition entre cartes
- Sauvegarde de la dernière carte sélectionnée (localStorage)

## Gate CI

`pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

Aucun nouveau test unitaire core requis. Validation visuelle par l'humain ou `visual-tester`.
