# Plan 177 — Panneau d'info de case (terrain & modificateurs)

> **Statut** : done (2026-07-25)
> **Créé** : 2026-07-24
> **Phase** : 6.5 « Client jouable », Lot 3 (compléter l'UI). Suite du plan 174 (InfoPanel allié enrichi).
> **Cadre** : `docs/plans/173-phase-client-jouable-ui-controles.md` — item « Info terrain / modificateurs » + décision #4.

## Motivation

Backlog (« Afficher les modificateurs terrain actifs ») : le joueur ne voit nulle part ce qu'une case lui fait — coût de déplacement, brûlure au magma, poison au marécage, bonus de type, hazards posés, champ/zone active. Les effets **existent** (rendus en 3D : hazards voxel, champs, zones, ronds d'aura) mais **aucun texte** ne les nomme ni ne les chiffre.

## Décisions humaines actées (2026-07-24)

1. **Deuxième panneau distinct**, à **droite** du panneau Pokemon, **même hauteur**, **moins large** (pas une section dans l'InfoPanel Pokemon existant).
2. **Déclencheur** : survol d'une case (Pokemon ou vide) — le panneau décrit toujours **la case sous le curseur**, indépendamment de son occupant.
3. **Zéro rendu Babylon** : les effets sont déjà rendus en 3D. Ce plan est **100 % view-model + DOM** → **pas de `best-practices` rendu** (contrairement à l'hypothèse du cadre ; la carto a montré que le rendu existe déjà).

## Constat carto (2026-07-24)

- Donnée terrain **table-driven** et complète dans le core, rien à recalculer, juste exposer :
  - `terrain-effects.ts` ✓ : `getMovementPenalty(terrain, types, isFlying)`, `getTerrainDotFraction(terrain)`, `getTerrainStatusOnStop(terrain, types, isFlying)`, `getTerrainTypeBonusFactor(terrain, moveType, attackerTypes, isFlying)`, `getImmuneTerrains`/`isTerrainImmune` ✓.
  - `Grid.getTile(pos)` ✓ → `TileState { terrain: TerrainType; height: number; occupantId?: string | null }`.
  - `entry-hazard-system.ts` ✓ : `getEntryHazardsAt(state, pos)` → `EntryHazardCell[]` (chacun `{ kind, tile, layers }`) ✓.
  - `field-terrain-system.ts` ✓ : `getFieldTerrainAt(state, pos)` → `FieldTerrain | null` (Terrain Herbu/Électrifié/Brumeux/Psychique) ✓.
  - `field-global-system.ts` ✓ : `isInFieldGlobalZone(state, pos, kind)` → `boolean` (Gravité, Zone Magique, Zone Étrange + Distorsion) ✓.
- **Manque #1** : aucun view-model « info de case » ni query agrégée.
- **Manque #2** : `onTileHover`/`refreshInfoPanel` (`battle-orchestrator.ts` l.271-286) ne lit que le Pokemon, jamais le terrain — pas de query terrain côté orchestrateur.

## Étapes

- [ ] **Étape 1** — View-model + port : créer `TileInfoData` interface dans `packages/render-ports/src/view-models.ts` ; ajouter signature `updateTileInfo(view: TileInfoData | null)` au port `BattleChrome` dans `packages/render-ports/src/ports.ts`.
- [ ] **Étape 2** — Builder : implémenter `buildTileInfoView(context: PresentationContext, state: BattleState, position: Position): TileInfoData | null` dans `packages/view-core/src/battle-views.ts` — agrège les fonctions core (terrain-effects, hazards, field-terrains, field-global). Tests unitaires en même temps.
- [ ] **Étape 3** — Orchestrateur : ajouter `private refreshTileInfo(position: Position | null): void` dans `packages/view-core/src/battle-orchestrator.ts` ; l'appeler **juste après** `refreshInfoPanel()` dans `onTileHover()`. Valider le câblage.
- [ ] **Étape 4** — Composant DOM : créer `packages/ui-dom/src/tile-info-panel.ts` — `createTileInfoPanel()` → `{ element, update(view: TileInfoData | null), show(), hide() }`, dumb. Réutiliser patterns du 174 (info-panel.ts).
- [ ] **Étape 5** — CSS : créer `packages/ui-dom/src/styles/tile-info-panel.css` — tokens `--ip-px` partagés, largeur ~190-200px, hauteur alignée sur la rangée infoPanels.
- [ ] **Étape 6** — Restructuration du chrome : dans `packages/ui-dom/src/battle-chrome.ts` (l.86-94), transformer `.bc-left-col` : créer une rangée `infoPanelRow` pour contenir `[infoPanel, tileInfoPanel]` horizontalement ; timeline au-dessus. Mettre à jour les appels `updateInfoPanel()` et ajouter `updateTileInfo()`.
- [ ] **Étape 7** — i18n : ajouter toutes les clés FR+EN dans `packages/app/src/i18n/locales/{fr,en}.ts` (détail : voir section i18n ci-dessus). Valider les noms FR officiels vs. les enums core.
- [ ] **Étape 8** — Tests e2e : (`test-writer`) ajouter scénarios survol terrain magma/marécage/eau profonde, hazards, zone globale, terrain Normal vide. Cahier `docs/test-plan.md` §11 (TileInfoPanel).
- [ ] **Étape 9** — Human-testing : survol différents terrains, cas sans Pokemon, Pokemon sur terrain à effet. Vérifier lisibilité et overflow sur desktop.
- [ ] **Étape 10** — Cleanup : vérifier pas de code mort, linting, aucun `any` implicite.

## Périmètre — ce que le panneau affiche

Pour la case sous le curseur (défaut = case du Pokemon actif si rien n'est survolé) :

| Bloc | Source | Toujours affiché ? |
|------|--------|--------------------|
| **En-tête** : nom FR du terrain + niveau de hauteur (ex. « Magma · h2 ») | `Grid.getTile` + i18n | oui |
| **Coût de déplacement** (« +1 case », « +2 cases » — Eau/Sable/Neige +1, Marécage +2) | `getMovementPenalty` | si > 0 |
| **Dégâts à l'arrêt** : status (« Brûlure au passage », « Empoisonnement ») + fraction DOT (« 1/16 », « 1/1 fatale ») | `getTerrainStatusOnStop` + `getTerrainDotFraction` (combos : Magma=Burned+1/16, Lave=null+1/1, Marécage=Poisoned+null) | si applicable |
| **Bonus de type** (« Attaques *Eau* renforcées ×1.15 ») | `getTerrainTypeBonusFactor` | si > 1 |
| **Franchissabilité** (« Infranchissable » pour Obstacle/Eau profonde/Lave) | `isTerrainPassable` | si infranchissable |
| **Hazards posés** (Picots, Piège de Roc, Pics Toxik, Toile Gluante + n° de couche) | `getEntryHazardsAt` | si présent |
| **Champ actif** (Terrain Herbu/Électrifié/Brumeux/Psychique) | `getFieldTerrainAt` | si présent |
| **Zone globale** (Gravité, Zone Magique, Zone Étrange, Distorsion) | `isInFieldGlobalZone` | si dans la zone |

**Hors périmètre** (relèvent d'autres plans, dépendent de l'attaquant, pas de la case seule) :
- Modificateur de **dégâts/portée** de hauteur (relationnel attaquant↔cible) → preview combat, plan 175.
- Attaque **de dos +15 %** (dépend de l'orientation) → plan 175.
- **Météo** globale → déjà dans le HUD météo top-centre, non répété (non spécifique à la case).
- **Auras d'équipe** (Reflet/Mur Lumière/Brume/Rune Protectrice) : possibles mais liées à l'équipe, pas à la case ; **différées** (à décider si on les ajoute — laissées de côté v1).

## Retours human-testing (2026-07-25) — refonte visuelle « zéro texte »

Le v1 textuel (émoji + phrases) a été rejeté par l'humain : **illisible, moche, trop textuel, émoji au rendu incohérent selon les OS**. Bug corrigé au passage : `tile-info-panel.css` n'était pas chargé (l'app importe chaque CSS ui-dom individuellement dans `babylon-boot.ts`, pas via `styles/index.css` — import ajouté). Direction validée :

**Objectif : quasi zéro texte, tout en icônes + chiffres courts.**

- **Émoji → icônes.** Les émoji ne rendent pas pareil partout → à remplacer par un **pack d'icônes cohérent**. Traité dans un **point dédié** (voir § Point dédié — icônes). D'ici là, les émoji restent en **placeholder**.
- **Réutiliser les assets existants** (`packages/app/public/assets/ui/`) — pas besoin de nouveau pack pour ceux-là :
  - `types/<type>.png` (18) → **bonus de type** (tag de type + `×1.15`) ET **immunités** (tags des types épargnés).
  - `statuses/icon-{burned,poisoned,badly-poisoned,...}.png` → **statut à l'arrêt** (icône, pas de texte).
- **Déplacement = malus rouge** : afficher `−1` / `−2` en **rouge** (c'est un coût, pas un bonus), avec une icône botte.
- **Statut : différencier le trigger** — icône statut + glyphe **« marche »** (déclenche au passage) vs **« stop »** (déclenche à l'arrêt). Le DoT par tour = glyphe « en continu ».
- **Immunité : marqueur « sans effet »** plus parlant que le bouclier 🛡 (le bouclier suggère un bonus de Défense). Tags de type + marqueur d'annulation.
- **Hauteur** : remplacer le texte `hX` par une icône (montagne / couches) + numéro.

**Icônes manquantes (aucune 2D existante)** : hauteur, botte (déplacement), mur/interdit (infranchissable), crâne (chute fatale), marche/stop/continu (trigger), marqueur « sans effet » (immunité), hazards en 2D (seulement `.glb`). → **Point dédié — icônes.**

### Point dédié — icônes (à planifier séparément)
Sourcer un pack cohérent pour les glyphes manquants. **Piste notée par l'humain : game-icons.net** (~4000 icônes silhouette monochromes, recolorables par ton rouge/danger / vert/bonus, couvre botte/montagne/crâne/mur/pas/main-stop/pics… ; licence CC BY = libre de droits, attribution via fichier crédits). Alternatives : Kenney (CC0 mais couverture terrain/statut partielle), SVG maison. **Décision reportée à ce point** — ne pas sourcer maintenant.

### Nouveau scope core — Évasion herbe haute (décision humaine 2026-07-25)
Aujourd'hui **Herbe haute n'a aucun effet mécanique** (seulement « immunise Vol », cosmétique) ; l'« Évasion +1 » du backlog n'a jamais été codée. Décision : **l'implémenter dans le core**, puis l'afficher dans le panneau. Chantier core à part (mécanique + tests), à cadrer :
- **Magnitude / forme** : bonus d'esquive quand la cible se tient sur Herbe haute — cran d'Esquive (+1) ou modificateur d'accuracy dédié (−X %) ? Interaction avec les moves à précision garantie (jamais-rate), la pluie/soleil, Lentiscope/Œil Composé.
- **Où** : pipeline d'accuracy (mirroir du modificateur de hauteur / terrain). → `game-designer` + `best-practices` avant de coder.
- Puis exposer dans le view-model du panneau (ligne « esquive » avec son icône).

## Décisions design finales (human-testing 2026-07-25)

Le panneau a été itéré en direct avec l'humain. État livré :
- **Entête** : nom du terrain (gauche) + **altitude** `⛰N` poussée à droite. Terrain « normal » → **« Neutre »**.
- **Ligne 1** : effets **intrinsèques** du terrain groupés (traversal ⛔/⛔💀 ou malus déplacement 🥾 `−N` rouge · statut `👣`/`🛑` + sprite statut · DoT `🛑 −1/16` en **petit**).
- **Trigger par terrain (déjà en place côté core)** : magma = brûlure **au passage** (`👣`, `BattleEngine` boucle par pas l.3035-3059) ; marais = poison **à l'arrêt** (`🛑`, `terrain-tick-handler` fin de tour). Purement affichage, pas de modif core.
- **Effets stackés** (un par ligne) sous la ligne 1 : **hazards** (nom + `×couches`, **sans** glyphe ⚠), **champ/zones** (nom précédé d'un **badge durée** `[N]` remplaçant l'icône), **bonus** (`sprite type ×1.15`, vert), **immunité** (`🆓` + sprites des types épargnés).
- **Sprites réutilisés** : `assets/ui/types/*` (bonus + immunité), `assets/ui/statuses/icon-*` (statut, contraint en hauteur / largeur auto — 52×36, ne pas forcer carré).
- **Émoji = placeholders** (`⛰ 👣 🛑 🥾 ⛔💀 🆓`) → remplacés au **point icônes**.
- **Largeur réduite** (~140 design-px). **Hauteur** : comportement **A** (le panneau grandit, l'allié s'étire ; cas court → aligné sur la hauteur de l'allié). Cas extrême (~13 lignes) accepté.
- **Seed test-only** `SandboxConfig.debugTiles` (hazards/champ/zones/distortion sur une case) ajouté — sert la démo ET l'e2e du panneau.

## Chantiers séparés (notés, hors 177)

1. **Point icônes** — remplacer les émoji placeholder par un pack cohérent. Piste : **game-icons.net** (CC BY). Décision reportée à ce point.
2. **Évasion herbe haute (core)** — implémenter le bonus d'esquive, puis l'afficher (game-designer + best-practices avant).
3. **Hazards interdits dans les liquides (core)** — sauf **Piège de Roc** (flotte) ; les autres coulent → le placement doit **échouer** sur une tuile liquide.
4. **Rendu in-world** — marqueurs/anneaux d'effets **sur les tuiles** (feedback permanent sans survol), ex. « 1 rond par aura ». Rendu Babylon → best-practices, plan à part.

## Architecture

Respecte le découplage (input/UI hors `packages/core`).

### 1. `packages/render-ports` — nouveau view-model
`TileInfoData` (nouveau fichier ou dans `view-models.ts`) :
```ts
interface TileInfoData {
  terrainLabelKey: string;      // i18n key du terrain (ex: "tileInfo.terrain.magma")
  height: number;               // niveau
  passable: boolean;            // faux = infranchissable
  movementPenalty: number;      // 0 si aucun ; +1 ou +2 cases
  onStopStatusKey?: string;     // i18n key du statut à l'arrêt (ex: "tileInfo.onStop.burn") ; omis si aucun
  onStopDotFraction?: number;   // fraction DOT (ex: 16 = maxHp/16, 1 = insta-mort Lave/Eau profonde) ; omis si aucun
  typeBonusType?: PokemonType;  // type bénéficiant du bonus ×1.15 ; omis si aucun
  hazards: { kind: EntryHazardKind; layers: number }[];
  fieldTerrain?: FieldTerrain;  // Terrain Herbu/Électrifié/Brumeux/Psychique
  globalZones: FieldGlobalKind[]; // Gravité, Zone Magique, Zone Étrange + Distorsion si applicable
}
```
Port : ajouter `updateTileInfo(view: TileInfoData | null)` au contrat `BattleChrome`.

### 2. `packages/view-core` — builder
`buildTileInfoView(context: PresentationContext, state: BattleState, position: Position): TileInfoData | null` dans `battle-views.ts` — agrège les fonctions core ci-dessus (terrain/hazards/field/zones) pour une tuile. Pur, testable. Retourne `null` si la tuile est hors limites.

### 3. `packages/view-core` — orchestrateur
`battle-orchestrator.ts` : 
  - `onTileHover(tile)` reste inchangée (affiche le Pokemon) ; enchaîner l'appel de `refreshTileInfo(tile)` **juste après** `refreshInfoPanel()`.
  - Nouveau `refreshTileInfo(position | null): void` (privé) — construit un `TileInfoData` pour la case survolée et câble `chrome.updateTileInfo(...)`.
  - Défaut sans survol : affiche le terrain de la case du Pokemon actif (cohérence avec le défaut Pokemon).

### 4. `packages/ui-dom` — composant + CSS
- `tile-info-panel.ts` : `createTileInfoPanel()` → `{ element, update(view: TileInfoData | null), show(), hide() }`, dumb (zéro logique), i18n via `config`.
- `battle-chrome.ts` (l.86-94) : créer `tileInfoPanel` via `createTileInfoPanel()`. Restructurer `.bc-left-col` :
  ```
  .bc-left-col (flex column)
    ├─ timeline.element
    └─ infoPanelRow (flex row)
         ├─ infoPanel.element (flex: 1, largeur ~300px)
         └─ tileInfoPanel.element (flex: 0 0 auto, largeur ~190-200px)
  ```
  - Aligner la rangée `infoPanelRow` en bas de la colonne (position sticky ou épinglée) — même hauteur que l'ancien `infoPanel.element` (Ivy à vérifier via CSS existant).
- `styles/tile-info-panel.css` (token `--ip-px` partagé avec InfoPanel 174, coins arrondis, border, fond semi-transparent si équipe sombre).

### 5. i18n
Nouvelles clés FR+EN (i18n 030) : 
- `tileInfo.terrain.<type>` (11 terrains : Normal, Water, DeepWater, Sand, Snow, Magma, Lava, TallGrass, Ice, Swamp, Obstacle) FR = noms officiels terrain
- `tileInfo.movementPenalty` (« +1 case »/« +2 cases ») — paramètre `{cost}`
- `tileInfo.onStop.burn` (« Brûlure au passage ») + `tileInfo.onStop.poison` (« Empoisonnement »)
- `tileInfo.dotFraction` (« {fraction} dégâts à l'arrêt ») — paramètres `{fraction}` (ex: "1/16", "1/1")
- `tileInfo.typeBonus` (« Attaques {type} renforcées ×1.15 ») — paramètre `{type}` (utilisé depuis `teams/types`)
- `tileInfo.impassable` (« Infranchissable »)
- `tileInfo.hazard.<kind>` (Picots / Piège de Roc / Pics Toxik / Toile Gluante) — parameter `{layers}` optionnel pour plural/label complet
- `tileInfo.field.<kind>` (Terrain Herbu/Électrifié/Brumeux/Psychique)
- `tileInfo.zone.<kind>` (Gravité, Zone Magique, Zone Étrange, Distorsion)

## Maquette (ASCII, indicative)

```
┌───────────────────────┐  ┌───────────────┐
│ Pikachu  ♂  N.50       │  │ Magma · h2    │
│ [barre PV]  Électrik   │  │ 🔥 Brûlure    │
│ PV 100 %               │  │ ⚔ Feu ×1.15   │
│ Statut / talent / …    │  │ Picots ×2     │
│ (InfoPanel plan 174)   │  │ Gravité       │
└───────────────────────┘  └───────────────┘
        300px                    ~190px
```

## Critères de complétion

- ✅ Le panneau s'affiche à droite du panneau Pokemon, même hauteur, avec info terrain cohérente.
- ✅ Chaque type de modifier (coût mouvement, status, DOT, bonus type, hazards, champ, zones) s'affiche correctement.
- ✅ Survol Pokemon : panneau Pokemon + panneau terrain visibles simultanément.
- ✅ Survol case vide : panneau Pokemon caché, panneau terrain visible.
- ✅ Pas de code mort, linting 100 %, aucun `any` implicite, TypeScript strict.
- ✅ Tests unitaires du builder + e2e scénarios clés + human-testing validation.
- ✅ Desktop responsive OK (layout rangée ne déborde pas) ; mobile = sous-lot responsive.
- ✅ Tous les noms affichés en FR official (pas d'ID EN seul).

## Tests

- **Unit view-core** (Étape 2) : `buildTileInfoView` sur cases variées (magma, marécage, eau profonde, herbe, case avec hazard, case dans zone Gravité) → view-model attendu.
- **e2e** (Étape 8, `test-writer`) : survol d'une case terrain (magma) → panneau affiche brûlure + bonus type ; survol case vide → panneau visible sans Pokemon. Cahier `docs/test-plan.md` §11 (TileInfoPanel).
- **human-testing** (Étape 9) : survol magma/marécage/eau profonde, case avec hazard, case sous zone globale, case vide, Pokemon posé sur terrain à effet. Desktop layout stable.

## Risques / points ouverts

1. **Affichage des dégâts de terrain (DOT)** : Magma (1/16 + Brûlure), Marécage (Poison seul, pas DOT), Lave/Eau profonde (DOT 1/1 = insta-mort sans status). Comment étiqueter le cas « 1/1 » au panneau ? Options :
   - Afficher « 1/1 dégâts à l'arrêt — chute fatale » (via `onStopDotFraction` + label i18n)
   - Ou créer un enum `onStopFate: "faint"` distinct (plus simple visuellement, moins précis mécaniquement)
   - **Décision** : utiliser la fraction + label, c'est plus cohérent avec le core (pas de "faint" comme StatusType)

2. **Restructuration `.bc-left-col`** : passer d'une colonne à `[timeline / rangée]` — vérifier que timeline + rangée ne débordent pas en hauteur (petit écran). Responsive fin **différé au sous-lot responsive** du Lot 3 (comme plan 174) ; v1 desktop.

3. **Panneau vide** : sur terrain Normal sans hazard/zone → seul l'en-tête (« Normal · h0 »). Acceptable ; garder le panneau visible (cohérence) plutôt que le masquer.

4. **Trop d'info sur mobile** : reporté au sous-lot responsive.

## Dépendances

**Bloquants avant ce plan** :
- Plan 174 (InfoPanel enrichi allié) — patterns view-model, builder, composant, CSS tokens réutilisés ici pour cohérence UI.

**Débloqués après** :
- Plan 175 : preview combat & dégâts rélationnels (utilise les infos terrain pour factoriser les calculs de modificateurs).
- Plan 176 : affichage ennemi enrichi (peut aussi montrer types + éventuellement stats partielles sur hover ennemi).
- Sous-lot responsive (Lot 3) : adaptation du layout rangée sur petit écran.

**Indépendants** :
- Rendu Babylon (hazards voxel, champs, zones, aura) — ce plan est 100 % DOM view-model, rendu déjà en place.
