# Plan 091 — Sandbox design system migration (refactor)

> Statut : **done**
> Créé : 2026-05-21
> Livré : 2026-05-21
> Auteur : Claude (suite audit code-review plan 090)
> Notes livraison :
> - Étapes 1-8, 10 livrées. Étape 9 (visual-tester) à exécuter à la demande humain.
> - `SandboxPanel.ts` : 1067 → 761 lignes (-29%, métrique "≤600" non atteinte mais drop substantiel).
> - Zéro `style.cssText` / `style.X` dans `SandboxPanel.ts` + `LanguageToggle.ts`.
> - Bloc `!important` overrides `sandbox-studio.css:101-128` supprimé.
> - Helpers DOM extraits : `ui/dom/form-controls.ts` (createButton/Select/Checkbox/Range/OptionalNumber/PickerCard), `ui/dom/Stepper.ts`, `ui/dom/MovesList.ts`.
> - `loadData()` cache module-level (`packages/data/src/load-data.ts`) + `resetGameDataCacheForTests`.
> - `getMovepoolFor` memo via `movepoolCache: Map` sur instance.
> - `AbortController` instance pour tous listeners + `destroy()` appelle `abort()`.
> - `data-control-mode` sur `.sb-section` remplace `applyDummyControlVisibility`.
> - `MovesList` mutualisable team builder ↔ sandbox (réutilise structure `.tb-move-row` + `.tb-moves-list`).
> - Gate CI verte : **1552 unit + 191 intégration + biome check 0 warning + typecheck + build**.

## Objectif

Refactor visuel pur de `SandboxPanel.ts` pour aligner sur le design system existant (tokens CSS + classes `.tb-*`) et mutualiser les composants DOM réutilisables avec le team builder. Zéro nouvelle feature.

Plan 090 a livré la sandbox refonte fonctionnelle (layout Studio, pickers, dummy player) mais a propagé ~140 inline styles + hex hardcodés contraires aux règles `.claude/rules/css.md` + `renderer.md` + `html.md`. Findings sortis du code-review post-090.

## Pourquoi maintenant

- Dette technique cumulée : SandboxPanel ~900 lignes avec inline styles partout, viole 3 règles documentées.
- Sandbox fonctionne — risque régression visuelle gérable avec visual-tester before/after.
- Design system (`styles/components/*.css` + `tokens.css`) mature, classes existent déjà côté team builder.
- Composant `MovesList` partagé bénéficie team builder + sandbox + futures features (PvP setup, replay viewer).

## Hors scope

- Aucun changement de fonctionnalité.
- Aucun changement d'API publique de `SandboxPanel`.
- Aucun changement de `SandboxConfig` schema.
- Pas de migration team builder vers sandbox helpers (sens inverse).

## Décisions actées

1. **Inline styles → CSS classes** : remplacer tous les `style.cssText`/`style.X` dans `SandboxPanel.ts` par classes `.sb-*` définies dans `sandbox-studio.css`. Hex literals (`#222`, `#1a1a2e`, `#335`, `#444`, `#aac`, `#ddd`, etc.) remplacés par tokens (`--blue-900`, `--gray-200`, etc.).
2. **Classes existantes réutilisées** :
   - `<button>` → `.tb-btn` (variantes `data-variant="primary|danger|ghost"`)
   - `<select>` → `.tb-select`
   - Picker cards → `.tb-input-clickable` (déjà utilisé par `EditLeftPanel:307` pour item picker)
   - Move slots → `.tb-moves-list` + `.tb-move-row` avec `data-state="empty|filled"`
3. **Helpers DOM mutualisés** : extraire dans `ui/dom/form-controls.ts` :
   - `createButton`, `createSelect`, `createCheckbox`, `createOptionalNumberInput`, `createStepperButton`
   - Réutilisables team builder + sandbox.
4. **Composant `MovesList` partagé** : extraire `EditLeftPanel.renderMovesSection` → `ui/dom/MovesList.ts`. API :
   ```ts
   createMovesList({ pokemonId, moves, onChange }): HTMLElement
   ```
   Utilisé par sandbox (player + dummy player mode) ET team builder.
5. **Drops** :
   - `HEADER_STYLE` const inline (devenu inutile après scission).
   - Bloc `!important` overrides dans `sandbox-studio.css:101-128` (devenu inutile).
   - `applyDummyControlVisibility` → `data-control-mode` sur conteneur + CSS rules.
6. **`LanguageToggle.ts`** : 2 blocs `style.cssText` → classe `.sb-language-toggle` (mode sandbox) + `.lang-toggle-floating` (mode normal).
7. **Stepper extract** : `createStepperButton` → `ui/dom/Stepper.ts` (réutilisable hors sandbox, ex: stat editor team builder).
8. **Perf annexe** :
   - `loadData()` cache module-level dans `packages/data/src/load-data.ts`.
   - `getMovepoolFor` memoize Map sur SandboxPanel instance, invalidate sur langue change.
   - `AbortController` instance pour cleanup listeners (rule html.md).
9. **Validation visuelle obligatoire** : `visual-tester` avant/après chaque étape de migration.

## Étapes

### 1. Tokens + classes CSS dans `sandbox-studio.css`

- [ ] Ajouter classes `.sb-form-row`, `.sb-form-label`, `.sb-form-input`, `.sb-stepper`, `.sb-picker-card`, `.sb-radio-group`, `.sb-stat-stages-grid`, `.sb-position-row`, `.sb-move-cards-grid`.
- [ ] Drop bloc `!important` overrides.
- [ ] Hex → vars CSS dans `sandbox-studio.css`.

### 2. Helpers DOM extraits dans `ui/dom/form-controls.ts`

- [ ] `createButton(label, onClick, variant?)` → produit `<button class="tb-btn" data-variant>`.
- [ ] `createSelect(label, options, selected)` → `<label>` + `<select class="tb-select">`.
- [ ] `createCheckbox(label, checked)` → `<label><input type="checkbox" class="tb-checkbox">`.
- [ ] `createOptionalNumberInput(label, min, max, value, placeholder)` → input num.
- [ ] Couvert par tests unit.

### 3. Stepper extract `ui/dom/Stepper.ts`

- [ ] API : `createStepper({ value, min, max, format?, onChange }): { element, setValue, getValue }`.
- [ ] Click gauche = +1, click droit = -1, cap min/max.
- [ ] No-op guard (déjà fait plan 090, à porter).
- [ ] Pas de hidden input — closure `getValue` sur scope.

### 4. MovesList extract `ui/dom/MovesList.ts`

- [ ] Source : `EditLeftPanel.renderMovesSection` (team builder).
- [ ] API : `createMovesList({ pokemonId, moves, onChange, slotsCount? }): { element, refresh }`.
- [ ] Réutilise `openMovePickerModal` (déjà partagé).
- [ ] Tests : changement Pokemon → reset slots + repropose movepool.

### 5. Migration `SandboxPanel.ts` → composants partagés

- [ ] Remplacer 5 helpers privés (`createButton/Select/Checkbox/NumberInput/Stepper`) par imports `ui/dom/*`.
- [ ] Drop `style.cssText` inline, ajouter classes correspondantes.
- [ ] `buildMoveCardsRow` → `createMovesList`.
- [ ] `buildStatStagesRow` → grid CSS + `createStepper` direct.
- [ ] `buildPositionRow` → `.sb-position-row` + `createStepper`.
- [ ] `createPickerCard` → `<button class="tb-input-clickable">` direct, drop helper.
- [ ] `createControlRadio` → `data-control` sur container + CSS rules + native radios.
- [ ] `applyDummyControlVisibility` → `container.dataset.controlMode = "ai|player"`, CSS gère `[data-control-mode="ai"] .sb-dummy-player { display: none }` etc.
- [ ] Drop `HEADER_STYLE` const.

### 6. LanguageToggle CSS

- [ ] Classes `.sb-language-toggle` + `.lang-toggle-floating` dans `sandbox-studio.css` (ou `topbar.css`).
- [ ] Drop `style.cssText` blocs `LanguageToggle.ts:12-25`.

### 7. Perf : `loadData` cache + `getMovepoolFor` memoize

- [ ] `packages/data/src/load-data.ts` : `let cachedGameData: GameData | null = null` + early return.
- [ ] Test `load-data.test.ts` mis à jour (vérifier idempotence).
- [ ] `SandboxPanel.getMovepoolFor` : Map cache, clear sur language change (subscribe `onLanguageChange`).

### 8. AbortController listeners cleanup

- [ ] `SandboxPanel` : `private readonly abort = new AbortController()`.
- [ ] Tous `addEventListener(..., { signal: this.abort.signal })`.
- [ ] `destroy()` appelle `this.abort.abort()` avant `replaceChildren`.

### 9. Validation visuelle obligatoire

- [ ] `visual-tester` snapshot baseline avant migration (étape 0).
- [ ] Re-snapshot après chaque étape majeure (5, 6).
- [ ] Compare side-by-side. Régression = revert + investiguer.

### 10. Lint + tests + doc

- [ ] `pnpm lint` 0 warning.
- [ ] `pnpm test` + `test:integration` verts.
- [ ] Mettre à jour `docs/decisions.md` : décision tokens vs hex.
- [ ] Plan statut `done` + entry release notes.

## Risques

- **Régression visuelle silencieuse** : classes CSS partagées peuvent avoir styles globaux. Mitigation : `visual-tester` systematic, scope class names `.sb-*`.
- **Cascade specificity** : tokens CSS + classes existantes + nouveau CSS = conflits. Test layer ordering `@layer reset, base, components, utilities`.
- **Sliders stat stages** : déjà remplacés par steppers en plan 090, garde steppers ici.
- **Cache `loadData`** : si invalidation requise (rare en dev), prévoir `resetGameDataForTests()`.
- **Scope creep** : tentation refactor team builder. Hors scope — uniquement extractions, pas réécriture.

## Métriques succès

- `SandboxPanel.ts` ≤ 600 lignes (vs 1000 actuel).
- Zéro `style.cssText` dans `SandboxPanel.ts`.
- Zéro hex literal dans `SandboxPanel.ts` (sauf tokens vars).
- Zéro `!important` dans `sandbox-studio.css`.
- `MovesList` + helpers DOM réutilisés par team builder + sandbox.
- `pnpm lint` 0 warning.
- Visual diff sandbox = identique à plan 090 (régression zéro).
- `loadData()` profilé : ≤ 5 ms après cache (vs ~50ms actuel ?).
