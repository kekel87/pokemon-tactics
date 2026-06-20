# Plan 135 — Sprite bundle packing + roster Gen 1 complet

**Statut : done (2026-06-20)** — implémenté, testé, validé. `disposeAtlasUrl` retiré (cache blob permanent par session, décision #541). Bundle réel Gen 1 ≈ 33 Mo.

Branche : `roster-gen1-sprites` (worktree, port 5179).

## Problème

Itch.io HTML5 plafonne à **1000 fichiers** par zip de jeu (nombre, pas taille).
Pipeline actuel = **4 fichiers shippés / Pokemon** (`atlas.png`, `atlas.json`,
`offsets.json`, `portrait-normal.png`). ~100 Pokemon = ~400 fichiers + ~126 fichiers
fixes ≈ 513 build (mesuré). Objectif long terme = **TOUS les Pokemon (1000+)** →
4000+ fichiers = 4× la limite. Mur infranchissable au rythme actuel.

Objectif court terme couplé : **compléter la Gen 1** (roster jouable passe de 80 à
**150** — les 70 pré-évolutions manquantes ; Métamorph exclu, décision roster final-stage
revue → on inclut tous les stades).

## Décision d'architecture (tranchée avec l'humain, 2026-06-20)

Self-contained, **pas de CDN** (offline + zéro dépendance tierce). Le mur = 2 problèmes
distincts résolus ensemble :

- **Distribution (nombre de fichiers)** → packer en **3 fichiers** quel que soit le roster.
- **VRAM runtime** → garder le lazy actuel (seuls les ~12 combattants uploadés GPU).

Faits mesurés qui valident l'approche :
- `atlas.png` moyen = **82 Ko** (PNG compressé). 1000 Pokemon ≈ **82 Mo** total sur le fil.
- Le mur = file count, pas la taille. La VRAM = textures décodées en GPU, pas les octets.

### Forme retenue : conteneur binaire + manifeste léger + atlas portraits

**3 fichiers shippés**, indépendants du nombre de Pokemon :

1. **`sprites.bin`** — tous les `atlas.png` **et** tous les `atlas.json` concaténés bruts
   (blobs). Les `offsets.json` (petits) remontent dans le manifeste.
2. **`sprites-manifest.json`** — index léger :
   ```jsonc
   {
     "version": 1,
     "atlasPage": { "pikachu": { "png": [offset, len], "json": [offset, len] }, ... },
     "offsets":   { "pikachu": { "footOffsetY": 4, "headOffsetY": -6, "shadowSize": 1 }, ... },
     "portraits": { "pikachu": 24, ... },          // index de case dans portraits.png
     "portraitGrid": { "cols": 32, "cell": 40 }
   }
   ```
   Ne contient PAS les frames (elles restent dans le `.bin`, parsées lazy par combattant
   → manifeste léger même à 1000 Pokemon).
3. **`portraits.png`** — sheet unique des portraits 40×40 (grille), lookup par index.

### Flux runtime

- **Boot (splash loader, voir §Splash)** : `fetch('sprites.bin')` complet + `sprites-manifest.json`
  + `portraits.png`, barre de progression. Octets gardés en RAM (`Uint8Array`). Le navigateur
  cache → reloads instantanés, offline OK après 1er load.
- **Par combattant (lazy, comme aujourd'hui)** : slice `bin` aux offsets → `Blob([slice], {type:'image/png'})`
  → `URL.createObjectURL` → `new Texture(blobUrl, scene, …, forcedExtension='.png')`. Parse aussi
  le `atlas.json` slicé. **Upload GPU seulement pour les combattants** → VRAM identique à
  aujourd'hui.
- **Partage VRAM** : Babylon cache l'`InternalTexture` par URL. Mais blob URLs sont uniques →
  on garde un cache applicatif `Map<pokemonId, Texture>` côté loader pour réutiliser la texture
  d'un Pokemon présent plusieurs fois (miroirs d'équipe), et dispose au teardown de scène.

### Pourquoi pas les pages méga-atlas 4096²

Les atlas PMD sont larges (Pikachu 2048×712) → ~10 Pokemon/page → 1000 mons = ~100 pages de
**67 Mo VRAM décodés** chacune. Lazy-load d'un combat toucherait plusieurs pages → VRAM lourde.
Le conteneur garde la granularité per-Pokemon (slice ciblé) → pas ce problème.

### Pourquoi pas HTTP Range

Esquivé : download complet du `.bin` au boot (l'humain a validé un splash loader). Pas de
dépendance au support Range du CDN itch (non garanti).

## Étapes

### 1. Build packer (`scripts/extract-sprites.ts` + nouvelle passe)

Après extraction per-Pokemon habituelle, **passe de packing** (nouvelle fonction, ou script
`scripts/pack-sprites.ts` chaîné) :
- Concatène les `atlas.png` + `atlas.json` de tous les Pokemon de `sprite-config` en `sprites.bin`,
  enregistre offsets/longueurs.
- Compose `portraits.png` via `sharp` (grille N×32, cases 40×40), enregistre index par Pokemon.
- Émet `sprites-manifest.json`.
- Sort les 3 fichiers dans `packages/app/public/assets/sprites/`. `extract-sprites` continue
  d'émettre les dossiers per-Pokemon (source/cache/inspection) ; `pack-sprites` packe par-dessus.
- **Gitignore** `packages/app/public/assets/sprites/pokemon/*/` (dossiers per-Pokemon non commités) ;
  seuls `sprites.bin` + `sprites-manifest.json` + `portraits.png` sont commités/shippés.
- **Cross-check** : `sprite-config.json` doit couvrir tous les Pokemon de `playable-pokemon.ts`
  (étape 6) — un sandbox/combat demandant un id absent du bundle = crash. Assertion au build.
- Déterministe (ordre stable = ordre `sprite-config`), pour des diffs git lisibles du manifeste.

Testable hors-jeu : test Vitest round-trip (slice manifeste aux offsets → PNG décodable via
`sharp.metadata()`, JSON parseable).

### 2. Loader runtime (`packages/view-core/src/sprite-bundle.ts`)

Module engine-agnostic (view-core, comme `sprite-preload.ts`) :
- `loadSpriteBundle(onProgress): Promise<void>` — fetch `.bin` (avec progression via
  `Response.body` reader) + manifeste + `portraits.png`. Singleton mémoire.
- `getAtlasBlobUrl(id): string` — slice + `createObjectURL` (caché par id).
- `getAtlasJson(id): AtlasJson` — slice + parse (caché).
- `getOffsets(id)`, `getPortraitDataUrl(id)` (ou rect dans la sheet pour `background-position`).
- `isBundleLoaded()` (lu par le hook e2e `isReady` — étape 5), `disposeAtlasUrl(id)`.

**Teardown (anti-fuite mémoire)** : le loader garde un `Map<pokemonId, { blobUrl, texture? }>`.
Les blob URLs sont créés à la demande et réutilisés (miroirs d'équipe = même id). Au teardown de
`combat-scene` (et map-preview), appeler `disposeAtlasUrl(id)` pour chaque billboard →
`URL.revokeObjectURL(blobUrl)` + `texture.dispose()`. Le `.bin` en RAM et le manifeste restent
(singleton, réutilisés au combat suivant). Gestion erreur réseau au boot : `loadSpriteBundle`
rejette → le splash affiche un message d'échec + bouton retry (pas de jeu sans sprites).

### 3. Brancher les consommateurs sur le loader

- **`DirectionalBillboardOptions`** : remplacer `atlasJsonUrl/atlasPngUrl/offsetsJsonUrl`
  (+ variantes substitute) par un **bundle pré-résolu** `{ atlasBlobUrl, atlasJson, offsets }`.
  `loadAtlas()` ne fetch plus — reçoit la donnée. UV/depth/silhouette inchangés.
- **`combat-scene.ts`** (l.246-251) + **`babylon-preview.ts`** (l.142-144) : résolvent via le
  loader au lieu de construire des chemins `assets/sprites/pokemon/${id}/…`.
- **Portraits DOM** (`getPortraitUrl` dans `team-builder-data.ts` → 6 appelants : `SlotCardsRow`,
  `EditLeftPanel`, `TeamListItem`, `TeamCard`, `PokemonPickerModal`, `placement-flow`, `combat-screen`) :
  passer de `url(.../portrait-normal.png)` à la sheet `portraits.png` + `background-position`
  calculé depuis l'index manifeste. Helper `getPortraitStyle(id): {backgroundImage, backgroundPosition, backgroundSize}`.

### 4. Splash loader initial (joli : titre + fondu + barre)

- **Insertion précise** : dans `babylon-boot.ts`, **avant** tout `manager.start(...)` / `mountSandboxStudio`
  / `createBabylonPreview` (les 3 sorties de boot l.124-141), `await loadSpriteBundle(onProgress)`
  derrière le `SplashScreen`. Une seule porte → couvre menu, `?combat`, `?preview`, sandbox
  (`pnpm dev:sandbox`), e2e. Aucune scène ne rend un Pokemon avant la résolution du bundle.
- **Nouveau composant `SplashScreen.ts`** (décision verrouillée #2) : titre du jeu + logo + fondu
  d'entrée/sortie + barre de progression réelle (octets `.bin` via `Response.body` reader), fond
  `--color-bg-base`. `LoadingOverlay` reste dédié aux transitions de combat (tips).
- Esthétique : soigné (cf. mémoire « app trop petite / responsive PokeRogue » → titre lisible,
  centré, scale écran).

### 5. Corriger les loaders existants (dépendent désormais du bundle)

- **`preloadCombatSprites`** (`view-core/sprite-preload.ts`) : ne fetch plus de fichiers
  per-Pokemon — garantit juste que les slices/textures des combattants sont prêtes depuis le
  bundle en mémoire (no-op réseau, possible warm du cache texture). Combat `LoadingOverlay`
  (combat-screen l.585) reste pour le map + warm, mais ne re-télécharge pas les sprites.
- **`MapSelectPreviewScene`** / preview : idem, tire du bundle.
- **Hook e2e** (`e2e-debug-hook.ts` + `installE2eSceneHook` dans `combat-scene.ts`) : `sceneIsReady`
  / `isReady()` doit aussi vérifier `isBundleLoaded() === true`, sinon les tests timeout sur l'attente
  scène avant que le bundle soit prêt.
- Vérifier qu'aucun chemin ne référence encore `assets/sprites/pokemon/${id}/…` (grep zéro).

### 6. Roster Gen 1 complet

- Ajouter les **70 pré-évos** à `packages/data/src/playable/playable-pokemon.ts`
  (19 ont déjà leurs sprites extraits ; 51 à ajouter à `scripts/sprite-config.json` + `pnpm extract-sprites`).
- Movepool **dérivé auto** (plan 087 : learnset ∩ moves implémentés). **Gag canon accepté** :
  pré-évos ajoutés tels quels même à movepool minuscule (Magicarpe ≈ Trempette/Barrage). Seul
  sanity-check : **aucun à 0 move jouable** (sinon crash combat → signaler). Pas d'OP set.
- Stats/poids/types/ability1 dérivés de `reference/pokemon.json` (déjà le cas).

### 7. Gate + validation

- `pnpm extract-sprites` régénère les 3 fichiers ; vérifier taille `.bin` raisonnable (Gen 1 ≈ 12 Mo).
- Gate CI complet (build, lint, typecheck, test, integration, e2e).
- e2e : mettre à jour les fixtures qui chargent des sprites ; vérifier que le hook scène attend le
  bundle et que les asserts (sprite prêt, portrait visible) passent.
- Validation visuelle humaine : combat (sprites + portraits), team-builder (portraits), splash.

## Décisions verrouillées (humain, 2026-06-20)

1. **Dossiers per-Pokemon** : `extract-sprites` les émet toujours (source/cache/inspection dev) ;
   `pack-sprites` les concatène. Seuls `sprites.bin` + `sprites-manifest.json` + `portraits.png`
   sont **commités/shippés** → **gitignore** les dossiers `public/assets/sprites/pokemon/*/`.
2. **Splash** : **nouveau composant `SplashScreen.ts`** (titre + logo + fondu soigné + barre).
   `LoadingOverlay` reste dédié aux transitions de combat (tips). Deux rôles distincts.
3. **Pré-évos à movepool minuscule (Magicarpe…)** : **accepter le gag canon** — ajoutés tels quels,
   pas d'ajustement, même quasi-injouables. Seul garde-fou : sanity-check qu'aucun n'a **0 move
   jouable** (sinon crash combat) ; si 0 → signaler à l'humain (cas extrême improbable).

## Notes

- `portraits.png` : 1000 × 40×40 grille 32 cols = 1280×1280 px. Gen 1 (150) ≈ 320×240.
- Versionner le manifeste (`version: 1`) pour invalider le cache navigateur au changement de format.

## Impact fichiers

- `scripts/extract-sprites.ts` (+ packing) / nouveau `scripts/pack-sprites.ts`
- `scripts/sprite-config.json` (+51 entrées)
- `packages/view-core/src/sprite-bundle.ts` (nouveau) + `sprite-preload.ts` (adapté)
- `packages/render-babylon/src/directional-billboard.ts` (bundle au lieu d'URLs)
- `packages/render-babylon/src/combat-scene.ts` + `packages/app/src/babylon/babylon-preview.ts`
- `packages/app/src/team/team-builder-data.ts` (`getPortraitUrl` → `getPortraitStyle`) + 6 appelants
- `packages/app/src/babylon-boot.ts` (splash gate)
- `packages/app/src/ui/SplashScreen.ts` (nouveau) ou `LoadingOverlay.ts` (refactor)
- `packages/data/src/playable/playable-pokemon.ts` (+70)
- e2e fixtures / scene hook
- `docs/decisions.md` (archi bundle), `docs/architecture.md` (pipeline sprites), `STATUS.md`,
  `docs/implementations.md` (roster 150)

## Ordre d'exécution (1 commit final, plan validé `ready` → full exec)

1 → 2 → 3 → 5 → 4 → 6 → 7. (Loader+branchement avant splash, pour tester le bundle hors splash
d'abord ; roster en dernier une fois le pipeline vert sur les 100 existants.)
