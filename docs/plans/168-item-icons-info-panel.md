---
status: done
created: 2026-07-22
updated: 2026-07-22
---

# Plan 168 — Icônes officielles d'objets tenus dans l'InfoPanel

> **Décisions humain (2026-07-22)** :
> - **Source asset** : Showdown itemicons (`play.pokemonshowdown.com/sprites/itemicons/{id}.png`, 24×24).
>   Même stance fan-assets que les portraits/sprites déjà shippés. Id calculé via `toShowdownId`.
> - **Rendu** : icône **+ nom FR** (l'icône remplace l'emoji 🎒, le nom reste à côté).
> - Chantier tracé (plan doc) car transverse 5 packages + pipeline asset.

## Contexte — pourquoi

`docs/next.md` (§ Infra / process) : *« Icônes officielles d'objets dans l'InfoPanel — remplacer le
texte `🎒 {nom}` par l'icône sprite officielle »*. Feedback humain 2026-06-27.

Aujourd'hui l'InfoPanel rend l'objet tenu en texte pur :

```ts
// packages/ui-dom/src/info-panel.ts:102
itemEl.textContent = `🎒 ${data.heldItem}`;
```

## Seam existant à mirrorer — portraits

Le pipeline **portraits** est le modèle exact à copier (rien à inventer) :

| Étape | Portrait (existant) | Item icon (à créer) |
|-------|---------------------|---------------------|
| Sheet buildé | `portraits.png` (grid 40×40, sharp composite) | `item-icons.png` (grid 24×24) |
| Builder | `scripts/pack-sprites.ts` `portraitComposites` | même script, nouveau composite |
| Manifest | `portraitGrid` + `portraits: Record<name, index>` | `itemIconGrid` + `itemIcons: Record<id, index>` |
| view-core | `getPortraitSheetUrl` / `getPortraitCell` (`sprite-bundle.ts`) | `getItemIconSheetUrl` / `getItemIconCell` |
| app crop | `getPortraitUrl(id)` (`portrait-sheet.ts`) crop→dataURL cache | `getItemIconUrl(id)` (`item-icon-sheet.ts`) idem |
| render-ports | `portraitUrl` dans `InfoPanelData` | `heldItemId` dans `InfoPanelData` |
| ui-dom | `<img class="ip-portrait">` | `<img class="ip-item-icon">` |

**Faits vérifiés** :
- 117 objets — `packages/core/src/enums/held-item-id.ts`, ids kebab-case.
- `toShowdownId(kebab)` (`packages/core/src/team/showdown-id.ts`) → id Showdown alphanumérique
  (`life-orb`→`lifeorb`, `never-melt-ice`→`nevermeltice`, `kings-rock`→`kingsrock`, `stick` inchangé).
  = convention exacte des noms de fichiers Showdown itemicons.
- Adaptateur view-model : `packages/view-core/src/battle-views.ts:369` construit `heldItem` (nom).
  `pokemon.heldItemId` y est déjà disponible → propager tel quel.

## Hors périmètre

- **Masquage de l'objet ennemi en multi en ligne** (information cachée). Déjà noté dans `next.md`
  comme *« à traiter avec le backend matchmaking »*. En local/sandbox l'objet reste visible comme
  aujourd'hui — comportement inchangé. Le badge de révélation (`revealedItem`, `battle-views.ts:340`)
  reste tel quel.
- Icônes d'objets ailleurs que l'InfoPanel (Team Builder `EditLeftPanel`, SandboxPanel) — le seam
  `getItemIconUrl` sera réutilisable plus tard, mais pas câblé ici.

## Décisions figées (post plan-reviewer, 2026-07-22)

- **Script asset** : **nouveau** `scripts/extract-item-icons.ts` (pas d'extension d'`extract-sprites`) —
  assets, output path et boucle différents. Script npm `extract-item-icons` chaîné avant `pack-sprites`.
- **Grid** : `ITEM_ICON_COLS = 16`, `ITEM_ICON_CELL = 24` (portraits = 32/40 ; items plus petits →
  16 colonnes, 117 objets = 8 lignes). Adapter `CELL` si le fetch révèle une autre taille source.
- **View-model** : `InfoPanelData` porte **`itemIconUrl?: string` résolu** (PAS `heldItemId` brut) —
  symétrie stricte avec `portraitUrl`, ui-dom sans logique asset. `heldItem` (nom FR) conservé pour
  label/alt/title.
- **Context** : `I18nContext` gagne `getItemIconUrl(itemId: string): string`, câblé comme `getPortraitUrl`.
- **Compat manifest** : bump `MANIFEST_VERSION` 1→2, champs additifs. `getItemIconCell` **guard** :
  `if (!loaded.manifest.itemIconGrid) return null;` (tolère un vieux bundle en cache). Rebuild forcé
  via `pnpm extract-item-icons && pnpm pack-sprites` ; purge cache navigateur avant test visuel.
- **CSS** : icône rendue à `24px` de base × `--ui-scale`, `image-rendering: pixelated` (source 24×24,
  jamais lissée).

## Étapes

- [x] **Étape 1 — Asset : `scripts/extract-item-icons.ts` (117 icônes)** *(délégué `asset-manager`)*
  - Boucle sur `HeldItemId` → `https://play.pokemonshowdown.com/sprites/itemicons/{toShowdownId(id)}.png`.
  - Écrit `packages/app/public/assets/sprites/item-icons/<kebab-id>.png` (index par HeldItemId).
  - `.gitignore` += `packages/app/public/assets/sprites/item-icons/` (source régénérable, seul le sheet packé shippe).
  - Garde-fou : log + échec si 404/image vide ; confirmer taille réelle (24×24 attendu).

- [x] **Étape 2 — `scripts/pack-sprites.ts` : composite `item-icons.png`**
  - Bloc miroir de `portraitComposites`, grid `16 × ceil(117/16)` cellules de 24, index par id d'objet.
  - `SpriteManifest` += `itemIconGrid: { cols, cell }` + `itemIcons: Record<string, number>`.
  - Écrit `item-icons.png` à côté de `portraits.png`. Bump `MANIFEST_VERSION` 1→2. Log du compte.

- [x] **Étape 3 — `packages/view-core/src/sprite-bundle.ts` : accès**
  - `SpriteManifest` interface + `LoadedBundle` (`itemIconSheetUrl: ${basePath}/item-icons.png`).
  - `getItemIconSheetUrl(): string` + `getItemIconCell(itemId): PortraitCell | null` (mirror `getPortraitCell`,
    guard `!itemIconGrid`).
  - `sprite-bundle.test.ts` : cellule d'un id connu + `null` (id absent) + `null` (bundle sans itemIconGrid) + URL sheet.

- [x] **Étape 4 — `packages/app/src/team/item-icon-sheet.ts` : crop runtime**
  - Mirror `portrait-sheet.ts` : `prepareItemIconSheet()` (decode 1×), `getItemIconUrl(itemId)` (crop→dataURL,
    cache `Map`, fallback pixel transparent).
  - Re-export `getItemIconUrl` depuis `team/team-builder-data.ts` (comme `getPortraitUrl`).
  - Câblage boot : `packages/app/src/ui/SplashScreen.ts:66` — chaîner `.then(() => prepareItemIconSheet())`.

- [x] **Étape 5 — view-model + context**
  - `packages/render-ports/src/i18n-context.ts` : `getItemIconUrl(itemId: string): string`.
  - `packages/app/src/babylon/combat-screen.ts` (lignes ~198 & ~238) : ajouter `getItemIconUrl` au context
    (import depuis `team/team-builder-data.js`). Vérifier `placement-flow.ts:44` si même context requis.
  - `packages/render-ports/src/view-models.ts` `InfoPanelData` : += `itemIconUrl?: string`.
  - `packages/view-core/src/battle-views.ts:374-384` : `...(pokemon.heldItemId === undefined ? {} : { itemIconUrl: context.getItemIconUrl(pokemon.heldItemId) })`.

- [x] **Étape 6 — `packages/ui-dom/src/info-panel.ts` + CSS : rendu**
  - Ligne objet = `<img class="ip-item-icon">` (src = `itemIconUrl`, alt="") + `<span>` nom FR. Ligne masquée si pas d'objet.
  - `info-panel.css` : `.ip-item-icon` 24px × `--ui-scale`, `image-rendering: pixelated`.
  - Conserver `testid`/aria stable e2e (`info-panel-item`).

- [x] **Étape 7 — Tests**
  - Unit : `sprite-bundle.test.ts` (étape 3).
  - e2e (`test-writer`) : InfoPanel affiche l'icône (src non vide) + nom FR pour un Pokemon tenant un objet ;
    ligne masquée sinon. + `docs/test-plan.md`.

## Risques résiduels

- **404 Showdown** : id sans icône → fallback transparent + log (étape 1 échoue si silencieux).
- **Taille réelle Showdown** : à confirmer au fetch ; ajuster `ITEM_ICON_CELL` si ≠ 24.
- **Cache bundle** (`MANIFEST_VERSION` 2) : rebuild `pnpm extract-item-icons && pnpm pack-sprites` + purge cache navigateur au test.
- **Taille sheet** : 117 × 24×24 ≈ négligeable, pas d'impact bundle.

## Definition of done

- InfoPanel affiche l'icône officielle + nom FR de l'objet tenu (plus d'emoji 🎒).
- 117 objets couverts, aucun 404 silencieux.
- Pipeline reproductible (`pnpm extract-item-icons` + `pnpm pack-sprites`).
- Gate CI vert + e2e couvrant l'affichage.
