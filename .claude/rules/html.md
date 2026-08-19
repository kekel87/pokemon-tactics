---
paths: packages/app/src/ui/**
---

# Règles HTML vanilla (2026)

Cible : evergreen browsers, DOM construit en TypeScript, zéro framework. Compagnon de `css.md`.

## Sémantique

- **`<dialog>` pour toutes les modales** — `showModal()` donne focus trap, Esc, `::backdrop`, `aria-modal` gratuitement. `<div>` modale custom interdit.
  ```ts
  const dialog = document.createElement("dialog");
  dialog.showModal(); // focus trap + backdrop automatiques
  ```

- **`<button type="button">` pour toute action** — jamais `<div role="button">`. Donne focus, Enter/Space, `disabled` gratuitement.

- **`<h2>` / `<h3>` dans les modales et panneaux** — le titre d'une modale est un heading, pas un `<div class="title">`. Progression logique h1→h2→h3, pas de saut.

- **`<ul>` / `<li>` pour les listes** — cartes d'équipe, liste de moves, résultats picker = liste. `role="list"` inutile si l'élément est déjà `<ul>`.

- **`<section>` avec heading** — utiliser `<section>` seulement si elle a un `<h2>` ou `aria-labelledby`. Sinon `<div>`.

- **`<div>` acceptable** pour : wrappers de layout purs, conteneurs flex/grid sans sens sémantique propre, `<div data-state="...">` contrôlé par JS.

- **`<details>` / `<summary>` pour accordéons** — expansions natives sans JS supplémentaire.

- **`<input>` et `<select>` natifs en premier** — avant tout custom dropdown. `<datalist>` pour autocomplete simple.

## Focus, clavier et noms accessibles

> **Périmètre (décision #752, 2026-08-19)** : le support **lecteur d'écran** n'est **pas visé** — le combat est
> un canvas Babylon, non représentable dans l'arbre d'accessibilité. Les règles ci-dessous ne sont donc pas là
> pour la conformité WCAG, elles tiennent parce que : **(a)** le harnais e2e interroge le DOM par **rôle** et
> **nom accessible** (142 `getByRole`), **(b)** le clavier et la manette (Lot 2) ont besoin d'un focus qui ne
> saute pas, **(c)** les éléments natifs donnent gratuitement un comportement qu'on aurait sinon à réécrire.
> Ce qui ne sert **que** le lecteur d'écran (`aria-pressed`, `aria-live`) est **optionnel** — ne pas le
> réclamer en revue.

- **Sémantique HTML > ARIA** — "no ARIA is better than bad ARIA". 90% du temps, le bon élément HTML suffit,
  et il est déjà interrogeable par `getByRole`.

- **Nom accessible sur les boutons icône** — `aria-label` sur un bouton **sans texte visible**. C'est ce que lit
  `getByRole("button", { name })` : sans lui, le bouton n'est adressable que par `data-testid`. Bouton avec texte
  visible = **pas** d'`aria-label`.
  ```ts
  closeBtn.setAttribute("aria-label", "Fermer");
  ```

- **Focus management sur modale** *(requis — clavier/manette)* — `<dialog showModal()>` gère le focus trap
  automatiquement. Après fermeture, le focus revient à l'élément déclencheur (garder une référence).
  ```ts
  const trigger = document.activeElement as HTMLElement;
  dialog.addEventListener("close", () => trigger?.focus(), { once: true });
  ```

- **Ne pas détruire le focus au re-rendu** *(requis — clavier/manette)* — un handler qui reconstruit tout son
  sous-arbre (`root.remove()` puis `render()`) éjecte le focus vers `<body>` : au clavier ou à la manette, la
  navigation repart de zéro à chaque interaction. Muter l'élément existant, ou re-focaliser explicitement après
  le rendu. *Cas connu à corriger au Lot 2* : `packages/app/src/ui/dom/screens/settings-screen.ts` (les 3 lignes
  Langue / Prévisualisation dégâts / Plein écran).

- **`inert` pour désactiver un sous-arbre** — plus fiable qu'`aria-hidden` quand on veut bloquer focus +
  interactions.
  ```ts
  panelBehindModal.inert = true;
  ```

- **`tabindex="0"` / `tabindex="-1"` uniquement** — `tabindex` positif interdit. `-1` pour focus programmatique,
  `0` pour entrer dans l'ordre naturel.

- **`:focus-visible` en CSS** — ne jamais supprimer `outline` sans remplacer par `:focus-visible`.

- **Taille de cible tactile — plancher 30px sous `pointer: coarse`** (hit-area seule, pas le rendu ; arbitré sur
  téléphone réel au plan 179). Motif : jouabilité au pouce. Viser plus large sur les boutons principaux.

- **États ARIA dynamiques : seulement quand ils portent une info qu'un test ou le CSS lit** — `aria-expanded` sur
  un déclencheur d'accordéon, `aria-current="page"`, `aria-selected` sur `role="tab"`. **`aria-pressed` et
  `aria-live` ne sont pas exigés** (lecteur d'écran seul).

## Construction DOM en TypeScript

- **Helper `createElement` typé** pour réduire le boilerplate répétitif :
  ```ts
  function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  ): HTMLElementTagNameMap[K] {
    return Object.assign(document.createElement(tag), attrs);
  }
  ```

- **`AbortController` pour le cleanup des listeners** — une instance par composant, `.abort()` dans `destroy()`. Remplace les références manuelles `removeEventListener`.
  ```ts
  class MyPanel {
    private readonly abort = new AbortController();
    constructor() {
      document.addEventListener("keydown", this.onKey, { signal: this.abort.signal });
    }
    destroy() { this.abort.abort(); }
  }
  ```

- **`{ once: true }` pour les listeners one-shot** — fermeture de modale, confirmation unique.

- **`textContent` pour le texte** — jamais `innerHTML` pour injecter du texte. `innerHTML = ""` pour vider est acceptable (pas de contenu utilisateur).

- **`DocumentFragment` pour les insertions en lot** — construire dans un fragment avant d'insérer dans le live DOM (évite reflows multiples sur longues listes comme le picker Pokemon).
  ```ts
  const frag = document.createDocumentFragment();
  for (const item of items) frag.appendChild(createCard(item));
  container.appendChild(frag);
  ```

- **`dataset` pour les données liées à un élément** — `el.dataset.pokemonId = id`. Pas d'attributs `data-*` inline dans le HTML statique pour des IDs dynamiques.

- **Délégation d'événements** sur les longues listes (picker avec 1000+ Pokemon) — un listener sur le conteneur au lieu d'un par carte.

- **Pattern composant** : une fonction/classe par composant UI, retourne `element` (racine), expose `destroy()`. Pas de state global caché.

## Attributs modernes

- **`popover` API** (Baseline Widely Available depuis avril 2025) pour tooltips, menus contextuels non-modaux — préférer à un `<div>` custom avec z-index.
  ```ts
  const tooltip = document.createElement("div");
  tooltip.popover = "auto"; // ferme au clic extérieur automatiquement
  ```

- **`loading="lazy"` + `decoding="async"`** sur toutes les `<img>` non critiques (portraits, icônes de types).
  ```ts
  img.loading = "lazy";
  img.decoding = "async";
  ```

- **`hidden` vs `aria-hidden`** — `hidden` retire du DOM visuel ET de l'a11y tree. `aria-hidden="true"` retire de l'a11y tree uniquement (utiliser pour icônes décoratives). `display: none` via classe CSS préféré à `hidden` pour animations.

- **`<img alt="">`** pour images décoratives (icônes de type à côté du texte du type) — alt vide, pas absent.

## Sécurité

- **`innerHTML` interdit avec toute variable** — uniquement pour vider (`innerHTML = ""`). Texte dynamique → `textContent`. HTML dynamique → `createElement` + `appendChild`.

- **`textContent` pour toute valeur venant des données** — noms de Pokemon, noms d'équipe, descriptions de moves.

- **`rel="noopener noreferrer"`** sur tout `<a target="_blank">`.

- **Pas d'`eval`, pas de `new Function`**, pas de `setTimeout(string, ...)`.

## Anti-patterns interdits

- `<div role="button">` — utiliser `<button>`.
- `<div class="modal">` custom avec backdrop JS — utiliser `<dialog showModal()>`.
- `el.style.X = value` pour layout/spacing — tout style → fichier CSS via classes ou `data-*`. Exception : valeur calculée runtime impossible en CSS (position en pixels d'un curseur), commenter.
- `innerHTML` avec interpolation de variable — XSS vector.
- `tabindex` positif (> 0).
- `aria-label` dupliquant le texte visible.
- `removeEventListener` manuel sans référence stable — utiliser `AbortController`.
- `document.write()`.
