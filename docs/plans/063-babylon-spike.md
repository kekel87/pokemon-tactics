# Plan 063 — Spike renderer 2D-HD Babylon.js (comparatif vs Three.js)

**Statut** : terminé — verdict **Babylon.js** (décision #269)
**Créé** : 2026-04-18
**Terminé** : 2026-04-18
**Effort estimé** : 1-2 jours (spike exploratoire, même budget que plan 062)
**Branche** : `plan-063-babylon-spike`

## Verdict (2026-04-18)

**Stack retenue : Babylon.js 8**. Voir décision #269.

### Mesures réelles

| Critère | Three.js (062) | Babylon (063) | Écart |
|---|---|---|---|
| Bundle JS gzip initial (preload + main) | 129 kB | 273 kB | Babylon 2.1× |
| Bundle JS non compressé initial | 519 kB | 1.03 MB | Babylon 2× |
| `node_modules` runtime (pnpm store) | three 29 MB | core 74 MB + gui 4.3 MB | Babylon 2.7× |
| Point 1 pixel-art | ✅ `RenderPixelatedPass` natif | ✅ native res + `NEAREST` (approche lisibilité) | neutre |
| Point 2 billboards 8-dirs PMDCollab | ✅ | ✅ | neutre |
| Point 3 extrusion Tiled | ✅ | ✅ | neutre |
| Point 4 occlusion | ✅ depth buffer | ✅ depth buffer + `alphaCutOff = 0.5` | neutre |
| Point 5 Inspector | stats.js + lil-gui tiers à ajouter | Inspector v2 intégré, 1 touche | **Babylon** |
| Point 6 GUI Editor WYSIWYG | — | non testé (skipé, HUD codé en API) | n/a |
| Point 7 MCP communauté | — | `babylon-mcp` utilisé 3× (invertY, shader grid, interface) | **Babylon** |
| Point 8 TS strict sans `skipLibCheck` | passe (à reverifier) | **7 erreurs** `@babylonjs/inspector` (JSX, Scene, React) | Three.js |

### Bugs/friction découverts pendant le spike

1. **UV invertY** : TexturePacker atlas + Babylon `Texture` par défaut `invertY: true` → formule `vOffset = 1 - (y+h)/atlasH`. Confirmé via MCP lecture `texture.ts`.
2. **Occlusion cassée initialement** : `renderingGroupId = 1` sur le sprite → Babylon vide le depth buffer entre groupes. Fix : rester dans le groupe 0, ajouter `alphaCutOff = 0.5`, retirer `disableDepthWrite`.
3. **Grille désalignée** : `GridMaterial` utilise `vPosition = position` (local-space) dans `grid.vertex.fx`. Pour un `CreateBox({size: 1})`, local-space `0` = centre du cube → lignes au centre des tiles (option B). Fix : `gridOffset = new Vector3(0.5, 0, 0.5)`.
4. **Hardware scaling** : `engine.setHardwareScalingLevel(4)` rend le canvas entier pixelisé, y compris la GUI Babylon. Solution retenue : `setHardwareScalingLevel(1)` + assets/fonts pixel-art natifs (approche "lisibilité" validée par l'humain).
5. **TS strict** : `skipLibCheck: true` conservé (config du monorepo), Inspector ne compile pas sinon.

### Fichiers livrés

- `packages/renderer-babylon-spike/` (archive) : 654 LOC en 5 fichiers, tous les 4 points critiques validés visuellement via Chrome DevTools MCP.
- Verdict formalisé dans `docs/decisions.md` #269.

### Suite

- **Plan 064** : rewrite renderer Pokemon Tactics sur Babylon.js 8 (phase post-3).
- Archive `renderer-3d-spike/` et `renderer-babylon-spike/` gardés pour référence.

## Contexte

Le spike plan 062 Three.js a validé 4/4 points critiques (pixel-art, billboards 8-dirs PMDCollab, extrusion Tiled, occlusion depth buffer naturelle). Décision #266 actait Three.js comme stack retenue.

**Réouverture du choix** (décision #267) : les recherches `best-practices` du 2026-04-18 ont révélé des avantages Babylon.js qui n'avaient pas été suffisamment pesés :

- **Inspector v2 officiel** (React, maintenu activement en 2026, édition live scene graph)
- **GUI Editor WYSIWYG** officiel (https://gui.babylonjs.com/) — drag & drop UI, export JSON → `AdvancedDynamicTexture.ParseSerializedObject()`
- **UI native intégrée** (`@babylonjs/gui`) : Button, TextBlock, Grid, StackPanel, ScrollViewer, ~14 composants. Mode fullscreen (HUD) et mode mesh (UI attachée à un mesh 3D)
- **MCP communautaire** (forum Babylon) : vectorDB du source + docs, 4× plus rapide que web search pour Claude. MCP officiel annoncé "soonish"
- **Node Particle Editor** (9.0, mars 2026) + audio 3D natif plus complet que `THREE.PositionalAudio`

**Point critique inverse** : Babylon a plus de conflits `lib.dom` documentés avec TypeScript 6.0 (forum Babylon avril 2026) que Three.js — `skipLibCheck: true` recommandé par RaananW. L'humain n'aime pas cette solution.

**Objectif du spike** : reproduire exactement le contenu du spike Three.js en Babylon.js, mesurer tooling et TS strict réels, décider finalement.

## Décision opérationnelle

**Le pivot 2D-HD (renderer rewrite) démarrera APRÈS la phase 3.** Cf. décision #268.

Ce spike peut être lancé à tout moment. La phase 3 en cours (terrain & tactics) continue sans l'occlusion X-ray (plan 060 partial, item archivé avec plan 061).

## 4 points critiques — miroir du plan 062

Chaque point est un critère go/no-go individuel. Si Babylon échoue sur un seul, on reste sur Three.js (spike 062 valide).

### 1. Pixel-art fidèle (critère rédhibitoire — le plus à risque)

Babylon.js n'a **pas de `RenderPixelatedPass` officielle**. Deux options à tester :

- `SpriteManager.pixelPerfect = true` (v5.52+, hack bilinéaire) : fidélité vs `THREE.Sprite` + `NearestFilter` ?
- `ShaderMaterial` custom sur un plane billboard : comparer visuellement à la sortie Three.js
- Node Render Graph (8.0, mars 2025) pour reconstruire un pass pixel-art : faisabilité dans le budget spike ?

**Critère** : zéro différence visible de qualité pixel à côté d'un capture Three.js du même sprite PMDCollab (bulbasaur Idle-South, 32×40).

### 2. Billboards directionnels 8-dirs PMDCollab

Charger l'atlas bulbasaur. Implémenter `computeDisplayDirection(worldFacing, cameraAzimuth)` (même logique que Three.js). Porter `DirectionalBillboard` → Babylon. Idle animé.

- `SpriteManager` gère des sprites, mais orientation caméra + sélection UV par secteur = à coder à la main de toute façon
- Alternative : plane mesh + ShaderMaterial qui sélectionne la frame

**Critère** : rotation caméra ← / →, la frame du sprite change de secteur comme en Three.js. A/Z tourne le Pokemon dans le monde.

### 3. Extrusion Tiled

Porter `loadTiledMap` (parser plan 045 dans `@pokemon-tactic/data`, déjà découplé) + `extrudeTerrain` (Three.js BoxGeometry → Babylon `MeshBuilder.CreateBox` ou `CreateTiledBox`).

**Critère** : carte `sandbox-los.tmj` extrudée, couleurs par terrain identiques au spike 062.

### 4. Occlusion naturelle

Placer le Pokemon derrière un pilier 2-blocs. Vérifier que le depth buffer Babylon masque naturellement sans hack.

**Critère** : aucun code custom d'occlusion. Même comportement que Three.js.

## 4 points tooling Babylon — valeur ajoutée à évaluer

Ces points **ne sont pas rédhibitoires** individuellement. Ensemble, ils doivent justifier le bundle ~3-5× plus lourd.

### 5. Inspector v2

Activer `scene.debugLayer.show()`. Tester concrètement :
- Navigation scene graph (terrain + sprites + camera + lights)
- Édition live de propriétés (position sprite, matériaux, lumières)
- Performance overlay
- DX vs `stats.js` + `lil-gui` + Needle Inspector (notre setup Three.js équivalent)

**Critère** : jugement qualitatif. "Inspector Babylon me fait gagner du temps sur les bugs Three.js qu'on a vécus ?" oui/non/marginalement.

### 6. GUI Editor WYSIWYG

Prototyper un **action bar FFTA** dans https://gui.babylonjs.com/ : 4 boutons (Attaquer / Déplacer / Attendre / Annuler), un panel info en haut, une timeline CT en bas. Exporter JSON. Charger dans la scène spike.

- Qualité du workflow designer → dev ?
- Taille réelle du JSON exporté (forum rapporte ~45k lignes pour UI simple — mesurer)
- Chargement dynamique (`ParseSerializedObject`) + binding event observable → event bus core : intégration propre ou bricolée ?

**Critère** : combien d'heures économisées vs coder la même UI en HTML/CSS overlay sur Three.js ?

### 7. MCP Babylon (communauté)

Installer le MCP communautaire (Mike_Mainguy, vectorDB source + docs). Tester sur 3 questions :
- "Comment créer un orthographic camera dimetric en Babylon 8 ?"
- "Comment rendre un sprite PMDCollab pixel-perfect ?"
- "Quel composant GUI pour une timeline horizontale scrollable ?"

**Critère** : qualité des réponses vs web search / Context7 / mémoire Claude.

### 8. TypeScript strict sans `skipLibCheck`

**C'est le vrai test**. Créer `packages/renderer-babylon-spike/tsconfig.json` avec :

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "skipLibCheck": false,
    "noUncheckedIndexedAccess": true
  }
}
```

Lancer `tsc --noEmit`. **Noter le nombre et la nature exacts des erreurs** (source : `@babylonjs/core/*.d.ts` vs notre code). Comparer le même exercice côté Three.js (`packages/renderer-3d-spike` avec `skipLibCheck: false`).

**Critère** : Babylon compile cleanly ? Three.js compile cleanly ? Lequel exige le plus de workarounds (`as`, guards, `// @ts-expect-error`) ?

## Procédure

1. **Créer branche `plan-063-babylon-spike`** (l'humain gère le branching).
2. **Package neuf `packages/renderer-babylon-spike/`** (pnpm workspace). Versions : `@babylonjs/core` ^8, `@babylonjs/gui` ^8, Vite 6, TS strict. Symlink `public/assets` → `../../renderer/public/assets`.
3. **Point 1 (pixel-art)** : un sprite PMDCollab à l'écran + ortho dimetric + chaque technique pixel-perfect testée (SpriteManager, ShaderMaterial, Node Render Graph si budget). Screenshot comparatif côte à côte avec le spike 062.
4. **Point 2 (directional)** : port `DirectionalBillboard` en Babylon. Rotation caméra ← / →, touches A/Z pour `worldFacing`.
5. **Point 3 (Tiled)** : réutiliser `loadTiledMap` de `@pokemon-tactic/data`. Port `extrudeTerrain` en Babylon.
6. **Point 4 (occlusion)** : placer le Pokemon derrière un pilier. Vérifier depth buffer.
7. **Point 5 (Inspector)** : activer et tester pendant les points 1-4. Noter gains réels.
8. **Point 6 (GUI Editor)** : prototyper action bar. Mesurer JSON.
9. **Point 7 (MCP)** : installer communauté, 3 questions test.
10. **Point 8 (TS strict)** : `tsc --noEmit` sans skipLibCheck. Noter erreurs. Refaire l'exercice sur `renderer-3d-spike`.
11. **Verdict** : tableau final Three.js vs Babylon **avec mesures réelles** (pas seulement recherche web). Décision renderer plan 064.

## Livrable

- Dossier `packages/renderer-babylon-spike/` (gardé quel que soit le verdict, pour archive)
- Section "Mesures réelles" ajoutée à `docs/decisions.md` (décision #267 ou nouvelle)
- **Plan 064** : rewrite renderer complet (stack choisie), phases et ordre

## Ce que le spike NE FAIT PAS

- Migration du renderer en prod
- UI complète (seulement action bar prototypée pour le point 6)
- Intégration BattleEngine
- Animations de combat autres que Idle
- Performance benchmark (faisabilité, pas optim)

## Tableau comparatif actuel (pre-spike, à affiner post-spike)

| Critère | Three.js r171 (spike 062 ✅) | Babylon.js 9.1 (spike 063 à faire) |
|---|---|---|
| **Bundle min utile** | ~131 kB gzip mesuré | ~300 kB-1 MB+ (à mesurer) |
| **Pixel-art pixel-perfect** | `RenderPixelatedPass` + `NearestFilter` validé 4/4 | **Critère rédhibitoire à re-tester** (pas de pass natif) |
| **TS strict sans `skipLibCheck`** | À mesurer spike 063 | **Conflits `lib.dom` documentés TS 6.0** — à mesurer |
| **3D models rigged (long terme)** | `SkinnedMesh` + `AnimationMixer` | `Skeleton` + `AnimationGroup` + Havok |
| **UI intégrée** | Aucune (HTML/CSS overlay ou `pmndrs/uikit` tiers) | **`@babylonjs/gui` complet** |
| **Éditeur UI WYSIWYG** | FairyGUI tiers (limité) | **GUI Editor officiel** (alpha, JSON verbeux) |
| **Inspector scene** | Needle Inspector (tiers, maintenu) | **Inspector v2 intégré** (officiel, maintenu actif 2026) |
| **Audio 3D** | `PositionalAudio` basique | `Sound` spatial + streaming riche |
| **Particles** | `Points` + `three-nebula` tiers | Système natif + Node Particle Editor |
| **Physique** (pas besoin) | Rapier / cannon-es tiers | Havok natif |
| **MCP pour Claude** | Needle (debug), mcp-threejs (assets) | **MCP source+docs communauté** (4× plus rapide), officiel "soonish" |
| **Communauté / LLM context** | 180k+ stars, mieux couvert LLMs | Plus petite, forum dense |
| **Refs tactical RPG TS prod** | Wheee (2026), démos | Aucune tactical identifiée |

## Notes

- **Phase 3 de la roadmap continue sans l'occlusion X-ray** (plan 060 partial). Le pivot 2D-HD devient une nouvelle phase dédiée après le spike 063 + verdict.
- **Core / data / IA / LoS / CT / statuts intacts** : pas de migration logique quel que soit le choix.
- Archive plan 062 (Three.js spike) : branche `plan-062-3d-renderer-spike` commit à faire.
