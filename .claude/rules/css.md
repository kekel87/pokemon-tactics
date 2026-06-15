---
paths: packages/app/src/styles/**
---

# Règles CSS vanilla (2026)

Cible : evergreen browsers, pas de Sass/Tailwind/CSS-in-JS. CSS pur, vars natives, `@layer`, nesting natif.

## Variables CSS

- **Nommage** : `--[categorie]-[propriete]`. Ex. `--color-bg-surface`, `--spacing-md`, `--radius-sm`. Jamais `--primary` seul.
- **Deux niveaux** : primitives (`--blue-900: #111122`) → sémantiques (`--color-bg-surface: var(--blue-900)`). Les composants utilisent seulement les sémantiques.
- **`:root` pour le global**, scope sur composant pour l'override local uniquement.
- **Pas de fallback `var(--x, …)`** si la variable est garantie en `:root`. Fallback réservé aux vars dynamiques injectées par JS.
- **Tokens obligatoires** dès qu'une valeur (couleur, espacement, radius, z-index, ombre, durée) apparaît 2+ fois. Magic numbers interdits (`z-index: 100` → `var(--z-overlay)`).
- **Source couleurs DOM** : variables CSS dans `:root`. Coexistent avec `packages/renderer/src/constants.ts` (qui reste source pour Phaser/canvas). Garder noms cohérents entre les deux.
- **`@property`** pour animer une variable typée (gradients, opacités).
- **Dark mode** : variables CSS + `@media (prefers-color-scheme: …)`. Pas de `light-dark()` (moins lisible).

```css
:root {
  --color-bg-base: #1a1a2e;
  --color-accent: #ffdd44;
  --spacing-md: 12px;
  --z-overlay: 100;
}
```

## Architecture `@layer`

- **Déclarer l'ordre en tête de chaque fichier d'entrée** : `@layer reset, base, components, utilities;`
- Quatre couches :
  - `reset` — normalisation (`box-sizing: border-box`)
  - `base` — éléments HTML (`body`, `input`)
  - `components` — blocs nommés (`.tb-btn`, `.tb-modal`)
  - `utilities` — helpers one-shot (`.tb-text-accent`)
- Utilities **toujours** dans `@layer utilities` (sinon écrasement imprévisible).

## Classes réutilisables

- **Préfixe namespace par feature** (ex. `.tb-` pour team-builder). Pas de classes globales sans préfixe.
- **BEM adapté** : préfixe = block, suffixe = élément, modificateur = classe ou `data-*`.
  - `.tb-btn` (block-élément)
  - `.tb-btn-primary` OU `.tb-btn[data-variant="primary"]` — choisir UNE convention par fichier
- **`data-*` préféré** pour états contrôlés par JS (`data-state="active"`, `data-variant="primary"`). Plus propre que toggler des classes.
- **Jamais de `.active` / `.disabled` / `.visible` seuls** — toujours préfixé ou `[data-state]`.

## Imbrication native (`&`)

- **2 niveaux max.** Au-delà = spécificité explosée, debug pénible.
- **Imbriquer** : `:hover`, `:focus`, `:disabled`, `::before/::after`, modificateurs (`&.active`, `&[data-variant]`).
- **Pas imbriquer** : descendants sémantiquement éloignés (un `.tb-list-row` n'est pas imbriqué dans `.tb-modal`).
- **`&` explicite** pour pseudo-classes : `&:hover` pas `:hover` (évite ambiguïté).
- **Nesting à l'intérieur de `@layer`**, pas l'inverse.

```css
@layer components {
  .tb-btn {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-bg-btn);
    &:hover { filter: brightness(1.15); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
    &[data-variant="primary"] { background: var(--color-bg-btn-primary); }
  }
}
```

## Features modernes à utiliser

- **`color-mix(in oklch, …)`** pour variantes hover/disabled depuis une couleur de base. Évite de déclarer 3 nuances par composant.
- **Container queries** (`@container`) pour composants responsive à leur conteneur. Définir `container-type: inline-size` sur le wrapper.
- **`:has()`** pour styliser un parent selon contenu (ex. `.tb-slot-card:has(.portrait:not(:empty))`).
- **Logical properties** sur les nouveaux composants : `margin-inline`, `padding-block`, `inset-block-start`. Pas de migration forcée du legacy.
- **Pas** d'anchor positioning (Baseline Limited sur Safari 2026).

## Anti-patterns interdits

- **Style inline interdit** (`style="..."` HTML, `el.style.X = …` JS). Tout style → fichier CSS via classes ou `data-*`. Exception unique : valeur calculée runtime impossible à exprimer en CSS (ex. position dynamique d'un curseur en pixels). Dans ce cas, commenter pourquoi.
- Hex inline répété (`#ffdd44` à 12 endroits) → variable CSS.
- Double déclaration de classe → fusionner.
- Magic numbers (z-index, durées, paddings) → tokens.
- `font-family` / `font-size` dupliqués entre composants → centraliser dans `:root` ou wrapper feature, hériter.
- Utilities hors `@layer utilities`.
- Nesting > 2 niveaux.
- `!important` sans commentaire justifiant.
