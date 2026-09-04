---
paths:
  - packages/app/src/ui/**
  - packages/app/src/styles/**
  - packages/ui-dom/**
---

# Règles multi-entrée — tout contrôle d'interface se vérifie sur 4 axes

Depuis la Phase 6.5 (plan-cadre 173), le jeu se joue à la **souris**, au **clavier**, à la **manette**
et au **doigt**, sur téléphone, tablette et 4K. Un contrôle ajouté ou déplacé n'est pas fini quand il
marche à la souris sur l'écran du développeur.

🔴 **Ces quatre vérifications sont OBLIGATOIRES dès qu'on ajoute, déplace ou supprime un contrôle
d'interface** (bouton, case à cocher, curseur, segment, ligne de menu, modale). Pas « si on y pense ».
Elles sont **mesurées**, jamais supposées : l'origine de cette règle est une media query ajoutée « au
cas où » au plan 198, que la mesure a montrée totalement inutile (240 px de marge restaient au
viewport le plus étroit).

**Où ça s'exécute** : ce n'est **pas** une étape de menu à part, c'est l'**étape 0 de
`human-testing`** — la passe que Claude fait seul, au chrome-devtools sur Chromium, *avant* de
dérouler les scénarios à l'humain. Ce qu'elle trouve se corrige ou se remonte avant, pour ne pas
faire tester un écran injoignable au pad. Voir `CLAUDE.md` § « Après impl » et
`.claude/skills/menu/SKILL.md`.

## 1. Clavier

- Le contrôle doit être atteint par les **flèches**, pas seulement par `Tab`. La navigation est
  spatiale (`focusInDirection`), donc un contrôle isolé dans un coin peut être injoignable même s'il
  est focalisable.
- Il doit passer **deux** filtres, pas un — les confondre fait croire qu'un contrôle est navigable
  alors qu'il ne l'est pas :
  1. `FOCUSABLE_SELECTOR` (`packages/app/src/input/focus-navigation.ts`) —
     `button:not(:disabled)`, `input:not(:disabled):not([type='hidden'])`, `select:not(:disabled)`,
     `textarea:not(:disabled)`, `[tabindex='0']` (celui-ci **sans** garde `:disabled`). Un
     `<div role="button">` n'y est **pas** : raison de plus d'utiliser l'élément natif.
  2. `focusableWithin()` — écarte en plus ce qui n'est **pas visible** (`offsetParent` /
     `getClientRects`) et ce que `data-nav-skip` retire pour la source active. Un contrôle en
     `display: none` satisfait le sélecteur et reste injoignable.
- L'activation est **native** au clavier (Entrée sur un bouton, Espace sur une case) : ne pas la
  réimplémenter, ça la doublerait.
- Le focus doit **survivre au re-rendu**. `renderPreservingFocus` ne restaure que par famille de
  `data-testid` — un contrôle qui n'en porte pas perd le focus vers `<body>` à chaque reconstruction
  du sous-arbre. **Donc : tout contrôle interactif porte un `data-testid`**, y compris quand aucun
  test ne le vise encore.

## 2. Manette

- Un appui de pad n'est **pas** un événement clavier : aucune activation native ne suit.
  `activateFocusedControl()` fait `active.click()` — ce qui bascule bien une case à cocher et fire
  `change`, mais **piège** un `<select>` (liste native que la manette ne sait pas parcourir, cas déjà
  traité en dur).
- `data-nav-skip="gamepad"` retire un contrôle de la navigation au pad quand il n'a rien à lui offrir
  (ex. les colonnes clavier de l'écran de contrôles).
- Un champ texte ne se saisit pas au pad : c'est un **choix explicite** (`focus-navigation.ts`), pas
  un oubli — ne pas le « corriger ».

## 3. Tactile

- **Plancher de 30 px sur la hit-area sous `pointer: coarse`** (rappelé par `html.md`), arbitré sur
  téléphone réel au plan 179. La hit-area, pas le rendu : un `<label>` qui enveloppe une case et son
  texte est tapable en entier, donc c'est **le label** qu'on mesure, pas la case.
- ⚠️ **Une case à cocher native fait 13 px** et son label une vingtaine — sous le plancher. C'est un
  écart connu et non résolu du pied de l'écran de sélection d'équipe (voir `docs/backlog.md`) : ne pas
  en ajouter d'autres sans le poser à l'humain.
- Vérifier qu'un geste ne demande pas de survol : il n'y a pas de `:hover` au doigt.

## 4. Responsive

Viewports de référence, à **mesurer** (voir la recette ci-dessous) :

| Cas | Viewport | Ce qu'on regarde |
|---|---|---|
| Téléphone paysage étroit | 568 × 320 | débordement, chevauchement, hit-areas |
| Téléphone paysage courant | 667 × 375 | idem |
| Tablette | 1024 × 768 | seuils de media query (`width < 900px` bascule ici) |
| Desktop | 1920 × 1080 | mise en page nominale |
| 4K | 2560 × 1440 et au-delà | l'interface ne doit pas être minuscule (retour humain récurrent) |

Le seuil « étroit » du projet est `@media (height < 500px), (width < 900px)`. Les tokens d'espacement
ont **déjà** des valeurs réduites sous ce seuil : ne pas en rajouter une couche sans avoir mesuré que
la marge manque réellement.

## Recette de mesure (chrome-devtools, pas à l'œil)

Serveur de dev lancé, puis, par viewport :

```js
// Débordement et géométrie réelle du conteneur suspect
const host = document.querySelector(".ts-footer");
({
  viewport: { w: innerWidth, h: innerHeight },
  gap: getComputedStyle(host).gap,
  debordement: host.scrollWidth > host.clientWidth,
  marge: Math.round(host.querySelector(".ts-footer-spacer")?.getBoundingClientRect().width ?? 0),
  hitAreas: [...host.querySelectorAll("label, button")].map((el) => {
    const r = el.getBoundingClientRect();
    return { testid: el.dataset.testid, w: Math.round(r.width), h: Math.round(r.height) };
  }),
})
```

Pour prouver qu'une media query **sert** : la neutraliser en ligne (`host.style.gap =
"var(--spacing-xl)"`) et re-mesurer. Si la marge reste positive et `debordement` reste `false`, la
règle est du bruit — la retirer.

Clavier : `element.focus()` sur un point de départ, puis de vraies pressions de touches, en relisant
`document.activeElement.dataset.testid` après chaque appui. Un test qui appelle `.focus()` sur la
cible ne prouve rien : c'est le **chemin** pour y arriver qui est en question.

## Ajouter un contrôle casse les localisateurs e2e génériques

Un second contrôle du même rôle rend ambigu tout `getByRole` non scopé — et Playwright échoue en
**mode strict**, donc le test tombe. Grep obligatoire après ajout, sur `e2e/` **entier** (specs
comprises, pas seulement `e2e/pages/`) :

```bash
grep -rn 'getByRole("checkbox")\|getByRole("radio")\|getByRole("combobox")\|getByRole("slider")\|getByRole("textbox")' e2e/
```

⚠️ Chercher par **nom de variable** ne suffit pas : au plan 198, greper `autoPlacement` avait trouvé
l'objet de page et un appel, mais raté `responsive-chrome.spec.ts` qui écrivait
`page.getByRole("checkbox").uncheck()` en dur dans le test. La suite est tombée dessus 488 tests plus
loin. C'est le **rôle** qu'on grep, pas le nom.

## Ce qui se couvre en e2e, ce qui reste à l'œil

- **e2e** : atteignabilité au clavier et au pad (manette synthétique, `pages/gamepad.ts`), seuils
  responsive (`dom/responsive-screens.spec.ts`), état persisté après bascule.
- **Œil / téléphone réel** : confort de la hit-area, lisibilité en 4K, gestes tactiles multi-doigts.
  Le harnais ne les remplace pas — voir `docs/test-plan.md` §6.10 et §6.13.
