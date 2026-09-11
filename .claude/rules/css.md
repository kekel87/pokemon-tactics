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
- **Source couleurs DOM** : variables CSS dans `:root`. Coexistent avec `packages/app/src/constants.ts` (source pour le rendu moteur Babylon). Garder noms cohérents entre les deux.
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

## Rationaliser les écrans — réutiliser avant de redéclarer

🔴 **Règle donnée par l'humain le 2026-09-11** : « essayer de rationaliser les écrans, réutiliser le
CSS ». Elle est née de trois copies du même patron trouvées en une seule recette.

- **Le projet n'a que DEUX mises en page, et on n'en invente pas une troisième** :
  - le **menu** — `menu-screens.css` : pile centrée, gros titre doré, boutons empilés, « Retour » en
    dernier de la pile. Menu principal, mode de combat, crédits ;
  - l'**écran plein** — `components/screen-shell.css` (`.scr-root`) plus
    `components/screen-header.css` (`.scr-header`) : racine ancrée au viewport, barre d'en-tête
    « ← Retour » + titre, contenu dessous. Team Builder, salle d'attente, « Jouer en ligne ».
  - Le DOM se construit par `screenHeader()` / `screenHeaderTitle()` / `screenHeaderSpacer()`
    (`ui/dom/screens/elements.ts`). **Un écran qui mélange les deux « ne correspond à rien »** —
    c'est le retour exact qui a déclenché cette règle.

- **Avant d'écrire une racine d'écran ou une barre de titre, chercher si elle existe.** Au plan 207,
  `.tb-root`, `.ts-root` et `.lb-screen` déclaraient la même coquille (`position: fixed`, colonne
  flex, fond, police) **et le même bloc de surcharges de tokens petit écran**, mot pour mot.

- 🔴 **Une liste de sélecteurs nommant les écrans un par un est un piège, pas une factorisation.**
  `base.css` portait `.tb-root, .tb-dialog, .ts-root { font-size: … }` et la liste jumelle pour
  `input/select/button/textarea`. Un quatrième écran est arrivé sans y être ajouté : son bouton de
  retour n'héritait pas de `--font-size-md`, et son en-tête était visiblement plus petit que ses deux
  jumeaux — défaut trouvé **à l'œil par l'humain**, après que deux passes de mesure l'avaient
  manqué, parce que chaque écran était correct pris isolément. **Ajouter le quatrième nom à la liste
  garantit que le cinquième rejouera le bug** : c'est la classe partagée qu'il faut, pas l'entrée de
  plus.

- **Une classe d'écran peut survivre sans aucune déclaration.** `.ts-root` n'a plus de bloc à elle,
  et reste posée dans le DOM : des dizaines de règles s'en servent comme **ancêtre**. Un sélecteur
  n'a pas besoin d'un corps pour être utile — ne pas supprimer la classe en croyant nettoyer.

- **Ce qui est propre à un écran reste chez lui.** `.tb-topbar-name-input`, `.tb-topbar-count` et
  `.tb-topbar-saved` sont restés au Team Builder ; seuls la coquille, la barre, le titre et
  l'espaceur ont été sortis. Factoriser n'est pas tout empiler dans un fichier commun.

- **Un espaceur explicite plutôt qu'un `flex: 1` sur le titre.** Le titre élastique marche tant qu'un
  écran ne met rien **à côté** de lui ; dès que l'éditeur d'équipe y pose « 1/6 Pokémon », le
  compteur part à l'autre bout de la barre. `.scr-header-spacer` laisse chaque écran décider où
  commence sa droite.

- **Quand deux implémentations divergent, prendre la meilleure comme référence, pas la sienne.** Ici
  le Team Builder : métriques ET glyphe de retour (« ← Retour », pas « ◀ Retour »), sur désignation
  de l'humain. Une seule clé i18n derrière (`screen.back`), les variantes supprimées.

## Anti-patterns interdits

- **Style inline interdit** (`style="..."` HTML, `el.style.X = …` JS). Tout style → fichier CSS via classes ou `data-*`. Exception unique : valeur calculée runtime impossible à exprimer en CSS (ex. position dynamique d'un curseur en pixels). Dans ce cas, commenter pourquoi.
- Hex inline répété (`#ffdd44` à 12 endroits) → variable CSS.
- Double déclaration de classe → fusionner.
- Magic numbers (z-index, durées, paddings) → tokens.
- `font-family` / `font-size` dupliqués entre composants → centraliser dans `:root` ou wrapper feature, hériter.
- Utilities hors `@layer utilities`.
- Nesting > 2 niveaux.
- `!important` sans commentaire justifiant.
- **Redéclarer une coquille d'écran ou une barre de titre** au lieu de `.scr-root` / `.scr-header`.
- **Une liste de sélecteurs qui énumère les écrans** (`.a-root, .b-root, .c-root { … }`) : c'est une
  classe partagée qui manque, et le prochain écran sera oublié.
