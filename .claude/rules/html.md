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

## Accessibilité

- **Sémantique HTML > ARIA** — "no ARIA is better than bad ARIA". 90% du temps, le bon élément HTML suffit.

- **`aria-label` sur les boutons icône uniquement** — bouton avec texte visible = pas d'aria-label. Bouton `×` (fermer) = `aria-label="Fermer"`.
  ```ts
  closeBtn.setAttribute("aria-label", "Fermer");
  ```

- **États dynamiques obligatoires** :
  - Dropdown ouvert : `aria-expanded="true"` sur le déclencheur
  - Tab actif : `aria-selected="true"` sur `role="tab"`
  - Toggle : `aria-pressed`
  - Page courante : `aria-current="page"`

- **Focus management sur modale** — `<dialog showModal()>` gère le focus trap automatiquement. Après fermeture, le focus revient à l'élément déclencheur (garder une référence).
  ```ts
  const trigger = document.activeElement as HTMLElement;
  dialog.addEventListener("close", () => trigger?.focus(), { once: true });
  ```

- **`inert` pour désactiver un sous-arbre** — plus fiable qu'`aria-hidden` quand on veut bloquer focus + interactions.
  ```ts
  panelBehindModal.inert = true;
  ```

- **`tabindex="0"` / `tabindex="-1"` uniquement** — `tabindex` positif interdit. `-1` pour focus programmatique, `0` pour entrer dans l'ordre naturel.

- **`:focus-visible` en CSS** — ne jamais supprimer `outline` sans remplacer par `:focus-visible`.

- **Taille cible WCAG 2.5.8** — minimum 24×24px sur tout interactif. Viser 44×44px pour boutons principaux.

- **`aria-live="polite"`** pour les annonces non-urgentes (log de combat, toasts) — region injectée dans le DOM au chargement, pas à l'annonce.
  ```ts
  const liveRegion = document.createElement("div");
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.setAttribute("aria-atomic", "true");
  liveRegion.className = "sr-only";
  document.body.appendChild(liveRegion);
  ```

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
