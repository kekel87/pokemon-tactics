---
paths: e2e/**
---

# Règles e2e — Playwright (recette visuelle automatisée)

Spec testée = `docs/test-plan.md`. Principe (plan 127) : automatiser le **sens**, pas les
**pixels**. Du moins cher au plus coûteux : unit `view-core` → DOM → scene-graph → golden.

## Déterminisme (RÈGLE DURE)

- Le hasard vient **du seed du moteur** : config sandbox `seed` → `createPrng(seed)` injecté
  (`BattleEngine` dérive son PRNG du seed). Un test = **un seed fixe**.
- **JAMAIS** d'override de `Math.random` côté navigateur (`addInitScript` qui remplace
  `Math.random`) — faille de sécurité classique + inutile ici. Banni.
- Le hook de debug (scène) est **strippé du build prod** (`import.meta.env.VITE_E2E`,
  dead-code-elimination) et la surface exposée est `Object.freeze` (lecture seule).

## Structure

```
e2e/
  fixtures/        # test.extend composables (PAS de beforeEach nu)
    index.ts       # re-export { test, expect } enrichis
    scene.fixture.ts   # scène sandbox seedée prête (test-scoped)
    assets.fixture.ts  # boot lourd partagé (worker-scoped, immuable)
  pages/           # Page Objects (classes) : Dom*, GameScene
  tests/
    smoke/         # gate rapide (boot, navigation)
    combat/        # §3/§5 (DOM + scene-graph)
    visual/        # golden screenshots (petit)
  snapshots/       # baselines toHaveScreenshot (committées)
playwright.config.ts
```

## Page Objects via fixtures (pas de `new` dans les tests)

- POM = classes encapsulant les interactions ; **instanciées dans des fixtures** `test.extend`,
  pas avec `beforeEach`. Composables (une fixture peut dépendre d'une autre).
- Sélecteurs DOM : ordre de priorité **officiel Playwright** — `getByRole` (boutons, headings,
  `progressbar`, `listitem`…) > `getByText` / `getByLabel` / `getByPlaceholder` (texte user-facing)
  > **`getByTestId`** (fallback résilient quand aucun rôle/texte ne convient : lignes de données,
  divs cliquables). **Jamais de classe CSS** (`.bc-move-item`, `.battle-ui > div:nth-child(2)`) —
  couplée au DOM/au style, donc fragile.
- **`data-testid`** : kebab-case, ajouté à la source via le helper `el(tag, className, testId)`
  (ui-dom + screens) ou `node.dataset.testid = "…"`. Le testid est un **contrat de test** stable,
  indépendant du libellé i18n et du `text-transform` CSS (⚠️ un titre affiché en MAJUSCULES via CSS
  a un `textContent` non transformé → `getByText` exact casse ; préférer un testid).
- Scène 3D : interroger via `page.evaluate` sur le handle exposé (`__ptE2e__` : `isReady`,
  `clickTile`, `hoverTile`, `meshNames`/`countByName`/`meshInfo`), **extraire des primitives
  sérialisables** (les objets Babylon ne le sont pas).

## Vitesse

- **1 seul serveur Vite** : `webServer` + `reuseExistingServer: !process.env.CI` (réutilise le
  `pnpm dev` local, démarrage propre en CI). Réutiliser le serveur de l'humain, jamais le kill.
- **Booter par config sandbox**, pas par clics de menu : entrer droit dans l'état voulu via
  `pnpm dev:sandbox`-équivalent / URL + JSON seedé. Amortit le boot.
- **Grouper par `projects`** : `smoke` (gate rapide) → `combat` → `visual`. Lancer `smoke`
  d'abord en CI.
- **Worker-scoped fixtures** pour le setup **immuable** coûteux (assets) ; **test-scoped** pour
  tout état mutable (scène, combat) → isolation préservée. Jamais muter un fixture worker partagé.
- Port unique par worktree : `fullyParallel` OK (Vite gère N connexions, app stateless) ; sinon
  série. Sharding seulement si la suite dépasse ~5 min.

## Attente (anti-flaky)

- **Bannir `page.waitForTimeout(ms)`**.
- Boot : `page.waitForFunction(() => window.<flag>SceneReady === true)`.
- Assertion qui converge (anim en cours) : `expect.poll(() => page.evaluate(…), { timeout, intervals })`.

## Scene-graph (préféré au pixel)

- Hook exposé **sous `import.meta.env.VITE_E2E`** : `Object.freeze({ getMesh, isSettled, … })`.
- Asserter l'**intention** : position monde == centre de la tile, `renderingGroupId` (occlusion),
  `isVisible`/`isEnabled`, couleur matériau — **pas** des pixels.
- Attendre « scène stabilisée » (signal idle) avant d'asserter.

## Screenshots (`toHaveScreenshot`) — minimal

- Réservé au **vrai visuel** (couleur d'overlay, z-fighting) que le scene-graph ne capture pas.
  La logique → scene-graph/unit, **jamais** screenshot.
- `animations: 'disabled'`, `maxDiffPixelRatio` réglé, **`clip`** une région (pas la scène
  entière), `mask` les zones dynamiques. Baselines générées sur l'OS CI (Linux).
- **Plafond ~8 screenshots** sur tout le projet. 1 par scénario visuel distinct, pas 1 par test.
- Régénérer **intentionnellement** (`--update-snapshots`) après un changement visuel voulu.

## CI

- Job e2e **séparé du gate** rapide (plus lent). `smoke` bloquant d'abord.
- `retries: process.env.CI ? 2 : 0` — un retry n'est **pas** un correctif : un test qui ne passe
  qu'au retry est flaky, on corrige la cause (souvent un déterminisme manquant).
- Artefacts : `trace: 'on-first-retry'`, `video: 'retain-on-failure'`, `screenshot: 'only-on-failure'`.

## Anti-patterns bannis

`waitForTimeout` fixe · sélecteurs CSS fragiles · tests interdépendants/ordre · `toHaveScreenshot`
comme assertion fonctionnelle · fixture worker mutée · `retries` > 2 · hook debug en prod ·
override `Math.random`.
