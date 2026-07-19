# Plan 164 — Centralisation des design tokens (DOM ↔ 3D Babylon)

**Statut : abandoned** (2026-07-19)

## Verdict après audit (2026-07-19)

L'audit des valeurs réelles **invalide le postulat du plan**. La « duplication » côté TS était en quasi-totalité du **code mort** dans `packages/app/src/constants.ts` (0 usage) : `BACKGROUND_COLOR`, `BACKGROUND_COLOR_CSS`, `TYPE_COLORS` (6 types, valeurs divergentes obsolètes), `TEXT_COLOR_*` (6), `FONT_FAMILY` (copie app). Les valeurs vraiment **vivantes et partagées** existaient déjà en source unique dans `packages/view-core` (`FONT_FAMILY`, `TEXT_COLOR_PRIMARY`, `BATTLE_TEXT_COLOR_*`) et `packages/render-ports` (`TEAM_COLORS`), consommées par render-babylon. Le résidu de vrai chevauchement vivant DOM↔3D est minuscule.

→ Le codegen (Phase 2) était de la **sur-ingénierie**. Action réellement menée (décision humaine 2026-07-19) :
1. **Purge du bloc couleur/police mort** d'`app/constants.ts`.
2. **Test de parité** `packages/app/src/styles/tokens-parity.test.ts` : verrouille le résidu vivant (`FONT_FAMILY` view-core ↔ `--font-family`, `TEAM_COLORS` render-ports ↔ `--team-N`).

Plan conservé pour l'historique. Le plan original (source TS canonique + codegen) ci-dessous n'a **pas** été exécuté.

## Contexte (postulat initial — périmé, voir verdict ci-dessus)

Le jeu a deux couches de rendu qui lisent leurs couleurs/police dans **deux sources séparées et non synchronisées** :

- **Couche DOM** (chrome overlay `packages/ui-dom/`, écrans `packages/app/src/ui/`) → variables CSS de `packages/app/src/styles/tokens.css` (`--blue-850`, `--type-fire`, `--color-text-primary`, `@font-face`).
- **Couche 3D Babylon** (HUD peint sur `DynamicTexture` : barres PV, textes flottants, pastilles, surbrillances) → constantes TypeScript en hexa `0x…` (`packages/app/src/constants.ts`, `packages/view-core/src/constants.ts`, `packages/render-babylon/`).

**Duplication constatée** (même valeur déclarée à plusieurs endroits) :

| Valeur | Endroits |
|--------|----------|
| Fond `#1a1a2e` | `BACKGROUND_COLOR` (0x) · `BACKGROUND_COLOR_CSS` · `--blue-850` · fallbacks `splash.css` |
| Police `"PokemonEmeraldPro", monospace` | `FONT_FAMILY` (app/constants.ts **+** view-core/constants.ts) · `@font-face` + usages CSS |
| Couleurs de types | `TYPE_COLORS` (0x, app/constants.ts) · `--type-*` (tokens.css) |
| Couleurs de texte | `TEXT_COLOR_*` (app/constants.ts **+** view-core/constants.ts) · `--color-text-*` (tokens.css) |

Il y a même de la **duplication intra-TS** : `FONT_FAMILY` et `TEXT_COLOR_PRIMARY` sont définis identiquement dans `app/constants.ts` **et** `view-core/constants.ts`.

**Conséquence** : changer une teinte oblige à toucher 2-3 endroits ; risque d'incohérence visuelle DOM ↔ 3D.

## Le nœud technique : formats incompatibles

- CSS veut des chaînes : `#rrggbb`, `var(--x)`.
- Babylon veut des nombres : `0xRRGGBB`, ou `Color3` (composantes 0–1).

On **ne peut pas partager le même littéral**. Il faut UNE source canonique et **dériver les deux formats**.

**Décision : le nombre `0xRRGGBB` est la forme canonique.** C'est la plus riche : le CSS s'en dérive trivialement (`#${n.toString(16).padStart(6,"0")}`) et Babylon aussi (`Color3.FromInts` / `Color3` direct). L'inverse (CSS → nombre) forcerait le moteur à lire le DOM (`getComputedStyle`) → dépendance DOM fragile au boot, rejetée.

## Emplacement de la source

`packages/view-core/src/design-tokens.ts` — engine-agnostic, **zéro dépendance DOM/Babylon** (respecte `rules/core.md`-like pour view-core). C'est déjà là que vivent `FONT_FAMILY` / `TEXT_COLOR_PRIMARY` partagés (re-exportés par render-babylon). On y consolide tout.

Forme :

```ts
export const DESIGN_TOKENS = {
  colors: {
    "blue-850": 0x1a1a2e,
    "type-fire": 0xe02828,
    // … primitives : palette + 18 types + textes
  },
  fontFamily: '"PokemonEmeraldPro", monospace',
} as const;

export function toCssHex(n: number): string { return `#${n.toString(16).padStart(6, "0")}`; }
export function toColor3(n: number): Color3 { /* ou helper local render-babylon si import Babylon interdit ici */ }
```

⚠️ **À trancher** : `toColor3` importe `@babylonjs/core` — interdit dans view-core (engine-agnostic). → `toColor3` vit dans `render-babylon` (qui a déjà Babylon) ; view-core n'expose que `toCssHex` + les nombres bruts.

## Phase 1 — Source TS canonique + garde-fou (sûr)

Étapes :

- [ ] Créer `packages/view-core/src/design-tokens.ts` : structure `DESIGN_TOKENS` (couleurs + `fontFamily`) et helpers `toCssHex()`. Lister les **primitives** : palette (ex: `"blue-850"`, `"blue-100"`) + 18 types Pokémon + couleurs de texte (primary, secondary, dimmed). **Vérifier exhaustivité** en comparant `packages/app/src/styles/tokens.css` + `app/constants.ts` + `view-core/constants.ts` + `render-babylon`.
- [ ] Auditer **valeurs existantes** : relever tous les `0x…` et `#…` associés ; si divergence détectée (typo, oubli), corriger avant d'encoder dans la source.
- [ ] Migrer **imports + usages** :
  - `packages/app/src/constants.ts` : importer `DESIGN_TOKENS` ; remplacer `BACKGROUND_COLOR`, `BACKGROUND_COLOR_CSS`, `TYPE_COLORS`, `TEXT_COLOR_*`, `FONT_FAMILY` par dérivés ou ré-exports. Supprimer littéraux dupliqués. Vérifier que rien ne casse (tests locaux, imports de `app`).
  - `packages/view-core/src/constants.ts` : supprimer la 2e copie de `FONT_FAMILY` / `TEXT_COLOR_*` ; importer de `design-tokens.ts` en ré-export. Valider pas de cassure au build.
  - `packages/render-babylon/src/babylon-constants.ts` : créer `toColor3()` **ici** (importe Babylon, dérivé de `DESIGN_TOKENS.colors`). Remplacer `BABYLON_CLEAR_COLOR` et autres teintes.
- [ ] Écrire **test de parité** `packages/app/src/styles/tokens.parity.test.ts` : parser `tokens.css` (lire les variables CSS) ; pour chaque primitive, asserter `getComputedStyle("--blue-850") == toCssHex(DESIGN_TOKENS.colors["blue-850"])`. Valider que le test passe. Inclure dans CI.
- [ ] **Gate complet + humain-testing léger** : compile, lint, test. Vérifier visuellement que couleurs/police inchangées (combat + Team Builder).

**Livrable** : source TS unique, CSS manuel mais verrouillé par test. Zéro regret si Phase 2 ne se fait jamais (le refactor est déjà utile).  
**Effort** : ~45 min, très faible risque.

## Phase 2 — Codegen CSS (dette fermée)

Étapes :

- [ ] Créer script `packages/app/scripts/build-tokens.ts` (tsx, pattern i18n / build-reference) : importe `DESIGN_TOKENS`, générer `packages/app/src/styles/tokens.generated.css` avec les primitives :
  ```css
  :root {
    --blue-850: #1a1a2e;
    --type-fire: #e02828;
    --font-family: "PokemonEmeraldPro", monospace;
  }
  ```
  Valider la sortie (hex bien formaté).
- [ ] Installer le hook prebuild : ajouter `buildStart` dans `vite.config.ts` ou script `pnpm build:tokens` exécuté avant `vite build`. Vérifier qu'il génère à chaque build.
- [ ] Refactorer `packages/app/src/styles/tokens.css` : placer `@import "tokens.generated.css"` en tête, **supprimer les primitives écrites main** (`--blue-850`, `--type-*`, `--color-text-*`, `--font-family`), garder uniquement couche sémantique (`--color-bg-surface: var(--blue-850)`) + dark-mode `@media prefers-color-scheme`.
- [ ] Mettre à jour test de parité : changement trivial (parse le fichier généré au lieu du fichier main), ou il suffit juste que le test passe comme avant.
- [ ] Décider : `tokens.generated.css` **commité** (comme i18n) ou **gitignoré + régénéré au gate** ? Proposé : **commité** (source TS = vérité, artefact complet dans git pour audit). Ajouter à `.gitignore` ou retirer selon décision.
- [ ] **Gate complet + e2e** : build, lint, test, e2e CSS (Babylon + DOM couleurs visuellement identiques). Vérifier zéro FOUC, pas de cascade involontaire.

**Livrable** : primitives CSS générées, source TS unique de bout en bout, certitude complète de parité.  
**Effort** : ~1 h, risque modéré (changement CSS, mais couvert par test).  
**Peut être reportée** : Phase 1 seule est déjà très utile. Phase 2 améliore la robustesse mais n'est pas bloquante.

## Clarifications techniques

### Couleurs hors scope DESIGN_TOKENS

Le plan couvre **uniquement** les couleurs partagées DOM ↔ 3D (fond, types, textes). Les couleurs exclusives à un côté restent **locales** :

- **3D only** : rendering groups Babylon, debug overlays, overlays de profondeur, effets post-processing.
- **DOM only** : hover states (`color-mix()`), animations CSS, transitions, surbrillances d'UI, états actifs.

Elles ne rentrent **pas** dans `DESIGN_TOKENS` ; elles vivent dans leurs constantes/fichiers CSS locaux respectifs.

### Transparence / alpha

Actuellement, la palette utilise que des opaques (`0xRRGGBB`). Si une couleur partagée a besoin d'alpha :
- **Phase 1** : alpha séparé (ex: `DESIGN_TOKENS.colors["overlay"] = 0x000000`, `DESIGN_TOKENS.alpha.overlay = 0.3`), la dérivation CSS/Babylon l'assemble (`rgba(...)` / `Color3(...).scale(...)`).
- **Phase 2** : peut être raffinée, par exemple structure séparée `alphas: { overlay: 0.3 }`.

Pour Phase 1 : présumer que **aucune couleur partagée n'a d'alpha actuellement**. Valider avec humain ; si surprise → ajouter à la source TS, test de parité la couvre.

### Ordre CSS et dark-mode

Le `@import "tokens.generated.css"` dans `tokens.css` doit venir **en tête**, avant la couche sémantique ET avant les overrides dark-mode (`@media prefers-color-scheme`). Cela garantit que les primitives générées sont disponibles pour la couche sémantique et l'override dark-mode, sans être écrasées par elles.

Topologie attendue :
```css
/* tokens.css */
@import "tokens.generated.css"; ← Primitives (--blue-850, --type-fire…)

:root {
  --color-bg-surface: var(--blue-850);  ← Sémantique
  /* … */
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-text-primary: var(--blue-100); ← Override sémantique
  }
}
```

Les primitives générées **ne changent pas** selon dark-mode (elles sont juste des nombres) ; seule la couche sémantique peut les override.

## Arbitrages à valider (humain)

- [ ] Nombre `0x` comme forme canonique (vs CSS). → proposé : **oui**.
- [ ] `toColor3` dans render-babylon (pas view-core, qui reste sans Babylon). → proposé : **oui**.
- [ ] Phase 1 seule d'abord, ou Phase 1+2 d'un trait ? → proposé : **Phase 1 d'abord** (~45 min, faible risque, utile seule).
- [ ] `tokens.generated.css` commité (comme i18n) ou gitignoré ? → proposé : **commité** (cohérence source TS = source de vérité).
- [ ] `@font-face` (déclaration de la police) reste écrit main dans `tokens.css` (pas généré — c'est une règle CSS, pas un token) ; seul `--font-family` est dérivé. → proposé : **oui**.
- [ ] Y a-t-il des couleurs avec alpha dans la palette actuelle (partagées DOM↔3D) ? → à valider, présumer **non** pour Phase 1.

## Périmètre / non-objectifs

- **Pas** de refonte de la couche sémantique CSS ni du dark-mode (restent en CSS).
- **Pas** de migration des `--spacing-*` / `--radius-*` / z-index (pas dupliqués DOM↔3D — hors scope).
- **Pas** de changement visuel : sortie identique, c'est un refactor.

## Tests / validation

- Test parité/anti-drift (Phase 1 et 2).
- Gate CI complet (build + e2e : vérifie que le rendu DOM + Babylon n'a pas bougé).
- Human-testing léger : combat + Team Builder → couleurs/police inchangées.

## Critères de complétion

**Phase 1** :
- [ ] `packages/view-core/src/design-tokens.ts` existe avec `DESIGN_TOKENS` (couleurs + fontFamily) et `toCssHex()`.
- [ ] Tous les usages en `app/constants.ts`, `view-core/constants.ts`, `render-babylon` migrés et vérifiés (imports, ré-exports).
- [ ] Test de parité `packages/app/src/styles/tokens.parity.test.ts` passe (colors + fontFamily alignées CSS ↔ TS).
- [ ] Gate CI verte : build, lint, typecheck, test, e2e.
- [ ] Human-testing : combat + Team Builder ; couleurs/police visuellement identiques à la baseline.
- [ ] Zéro duplication intra-TS (une seule définition de `FONT_FAMILY`, `TEXT_COLOR_*`, etc.).

**Phase 2** :
- [ ] Script `packages/app/scripts/build-tokens.ts` génère `tokens.generated.css` avec primitives correctement formatées.
- [ ] Hook prebuild s'exécute automatiquement (Vite `buildStart` ou `pnpm build:tokens` intégré).
- [ ] `packages/app/src/styles/tokens.css` refactorisé : `@import` en tête, couche sémantique + dark-mode en place, primitives supprimées.
- [ ] Test de parité passe (parse fichier généré).
- [ ] Gate CI verte + e2e CSS (Babylon + DOM visuellement identiques, cascade OK, zéro FOUC).
- [ ] `tokens.generated.css` commité (ou gitignoré selon décision).

## Risques & mitigation

- **Ordre d'import CSS** : voir "Clarifications techniques" → le `@import tokens.generated.css` en tête. Vérifier dans la topologie final qu'il n'y a pas de cascade involontaire. Mitigation : test visuel (human-testing).
- **@font-face vs --font-family** : ne générer **que la variable** (`--font-family`), pas la règle `@font-face` (elle déclare un asset, pas un token). Reste écrite main dans `tokens.css`. Vérifier que le `@font-face` ne duplique pas la déclaration.
- **Divergence historique 0x ↔ #** : si un `0x` et un `#…` divergeaient **déjà avant** consolidation (ex: typo ancienne), le test de parité Phase 1 la révèle et force à trancher : corriger le `0x` ou le `#…`. Auditer au moment de la migration.
- **Oubli de `toColor3` usages** : si render-babylon importe `toCssHex` par erreur, ou view-core importe `toColor3`, le build le révèle. Les imports sont explicites, facile à auditer.
- **CSS cache/FOUC** : Phase 2 génère au prebuild Vite → le CSS est statique au chargement, zéro FOUC. Vérifier que le hook prebuild s'exécute **avant** Vite lit les fichiers CSS.

## Dépendances

**Blocage en amont** :
- Aucune. C'est un refactor isolé (pas de dépendance externe).

**Débloque ensuite** :
- Maintenance future des tokens (palette globale maintenant synchronisée DOM ↔ 3D).
- Évolutions de couleurs/police : une seule ligne à changer dans `design-tokens.ts`, cascade automatique.
- Fondations pour un theme-switcher futur (night-mode, high-contrast, etc. → dérivé de sources TS centralisées).
