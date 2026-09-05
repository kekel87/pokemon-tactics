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
- Mesh épinglé à un coin d'ÉCRAN (boussole, glyphe de rotation) : sa position monde est recalculée
  depuis la caméra à chaque frame → passer par `meshScreenBox(name)` (projection, CSS px) pour le
  situer, et par une vraie pression `page.mouse` pour l'actionner (`clickTile` ne joue que les tiles).

## Vitesse

- **L'app est servie en BUILD, pas par le serveur de développement** — c'est le gain principal du
  2026-09-05 (suite complète 24,3 min → 4,0 min, décision #921). En développement, Vite sert le
  graphe de modules non bundlé : des centaines de requêtes transformées à la volée **par
  navigation**, depuis un serveur partagé par tous les workers. `PT_E2E_DEV=1` rend le serveur de
  dev, pour DÉBOGUER (rechargement à chaud, sources lisibles) — jamais pour mesurer.
- 🔴 **`reuseExistingServer: Boolean(process.env.PT_E2E_DEV)`** — on ne réutilise QUE le serveur de
  développement. Réutiliser un `vite preview` déjà debout revient à sauter la commande, donc le
  BUILD, et à tester un bundle périmé : un vert qui ne prouve rien. C'est arrivé (revue du
  2026-09-05, orphelin d'un gate précédent). Un serveur de dev, lui, transforme à la demande.
- **Booter par config sandbox**, pas par clics de menu : entrer droit dans l'état voulu via
  `pnpm dev:sandbox`-équivalent / URL + JSON seedé. Amortit le boot.
- **Grouper par `projects`** : `smoke` (gate rapide) → `combat` → `visual`. Lancer `smoke`
  d'abord en CI.
- **Worker-scoped fixtures** pour le setup **immuable** coûteux (assets) ; **test-scoped** pour
  tout état mutable (scène, combat) → isolation préservée. Jamais muter un fixture worker partagé.
- Port unique par worktree : `fullyParallel` OK (Vite gère N connexions, app stateless) ; sinon
  série. Sharding seulement si la suite dépasse ~5 min.

## Ressources machine (RÈGLE DURE — 2026-08-25)

L'humain **travaille et joue sur cette machine pendant que la suite tourne**. Une suite qui prend les
16 cœurs lui coûte sa session — c'est arrivé deux fois le 2026-08-25.

- **Toujours passer par `pnpm test:e2e:affected`**, jamais `pnpm test:e2e` en cours de chantier. Le
  niveau (L1 smoke / L2 affected / L3 full) se **décide depuis le diff** (`scripts/e2e-affected.ts`,
  plan 170) ; le choisir soi-même « par sécurité », c'est lancer 478 tests pour un bouton.
- **Le plafond est posé par `scripts/with-cpu-cap.sh`**, branché sur `test:e2e`, `test:e2e:smoke` et
  `test:e2e:affected` : `systemd-run --user --scope` avec `CPUQuota=400%` (4 cœurs sur 16),
  `MemoryMax=8G` et `CPUWeight=20` (cède le CPU aux tâches interactives). C'est le **noyau** qui
  borne tout l'arbre de process, là où `--workers` n'est qu'une consigne que Playwright s'applique
  à lui-même.
- **`workers: 3`** dans `playwright.config.ts` (au lieu du défaut cœurs / 2 = 8) : 3 navigateurs dans
  4 cœurs avancent mieux que 8 qui se battent. Réglable par `PT_E2E_WORKERS`.
- **`PT_FULL_SPEED=1` débride** (plafond levé + workers par défaut). À réserver aux runs où **personne
  n'utilise la machine**, et à annoncer avant de lancer.
- **Ne jamais lancer un run long sans le dire**, et le lancer en tâche de fond pour pouvoir l'arrêter
  (`TaskStop`) dès que l'humain réclame sa machine.
- `test:e2e:ui` reste **non bridé** : c'est l'humain qui le pilote, il sait ce qu'il lance.

## Après avoir INTERROMPU une suite (piège vécu — 2026-09-02)

**En grande partie désamorcé depuis le 2026-09-05** : `reuseExistingServer` ne vaut plus que sous
`PT_E2E_DEV=1`, donc un run ordinaire démarre toujours son propre serveur et échoue franchement si
le port est pris (`--strictPort`) au lieu d'hériter d'un moribond. Le piège reste décrit ici parce
qu'il s'applique encore en mode débogage, et parce que sa signature vaut d'être reconnue.

Une suite tuée (`TaskStop`, SIGTERM, délai dépassé) laisse son serveur Vite **en train de mourir**.
Sous `PT_E2E_DEV=1`, le run suivant voit le port encore tenu, en conclut qu'un serveur sain tourne,
**ne démarre donc pas le sien** — puis l'ancien s'éteint et les tests tombent d'un bloc en
`net::ERR_CONNECTION_REFUSED`.

🔴 **Tuer un run Playwright se fait avec `SIGINT`, pas `SIGTERM`** : le runner n'installe un
gestionnaire que pour SIGINT. Sur SIGTERM, Node meurt sans jouer ses handlers de sortie et le
`webServer` détaché SURVIT (mesuré à la revue du 2026-09-05).

- **Signature à reconnaître** : *tous* les tests échouent, la plupart en **130-160 ms** (la page ne
  charge pas du tout), et le smoke de boot tombe en timeout. Ce n'est **jamais** une régression du
  code — un échec de code ne fait pas tomber `smoke/boot`.
- **Avant de relancer** : vérifier que le port e2e (port dev **+1000**, donc `6173` par défaut) est
  libre — `ss -ltnp | grep 6173`. Ne tuer que ses propres process ; jamais le serveur de dev de
  l'humain, jamais son navigateur.
- Ne pas lire le résultat à travers `| tail -N` : le tampon avale tout si le run est tué. Rediriger
  vers un fichier (`> run.log 2>&1`) et lire le fichier.

## Binaire Playwright manquant (piège vécu — 2026-09-02)

Le projet `visual` tourne sur **`chrome-headless-shell`**, une variante distincte du Chromium que
les autres projets utilisent. Une mise à jour de Playwright peut la laisser absente du cache : les
519 autres tests passent, et **les 5 du projet `visual` échouent en bloc** sur
`Executable doesn't exist at ~/.cache/ms-playwright/chromium_headless_shell-<n>/…`.

- **Signature à reconnaître** : *tous* les tests d'un **seul projet** tombent, avec un message de
  lancement de navigateur — jamais une différence de capture.
- **Remède** : `pnpm exec playwright install chromium-headless-shell` (~115 Mo dans le cache
  utilisateur, aucune installation globale). Puis rejouer **le seul projet** :
  `npx playwright test --project=visual`, pas les 524.
- 🔴 **Ne JAMAIS répondre par `--update-snapshots`.** Le réflexe est tentant quand des tests visuels
  échouent en masse ; ici il aurait réécrit cinq références saines sur la foi d'un faux positif, et
  la prochaine vraie régression visuelle serait passée inaperçue. Un échec de capture montre une
  **différence d'image** ; celui-ci montre un binaire absent — deux choses sans rapport.

## Attente (anti-flaky)

- **Bannir `page.waitForTimeout(ms)`**.
- Boot : `page.waitForFunction(() => window.<flag>SceneReady === true)`.
- Assertion qui converge (anim en cours) : `expect.poll(() => page.evaluate(…), { timeout, intervals })`.
- **Une attente qui converge trop vite est aussi suspecte qu'une attente qui timeout** (2026-08-29,
  décision #861) : `__ptE2e__` était posé sur `globalThis` sans `uninstall` au `dispose()` de la
  scène — l'aperçu de carte (`map-preview-stage.ts`) construit lui aussi un `createCombatScene`, donc
  après cet écran `isReady()` répondait `true` en pointant une scène **détruite**. Plusieurs specs
  (`normal-game`, `combat-menu`, `battle-resume`, `placement-menu`, `platform-chrome`,
  `responsive-chrome`) ne gataient sur rien : `waitReady()` était satisfait instantanément par le
  hook périmé, et le timeout de l'`expect` suivant absorbait tout le vrai boot du combat. Tout hook
  global de readiness doit être désinstallé (gardé par identité) à la destruction de ce qu'il décrit.

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

## Où tourne le harness

- **Deux endroits, deux rôles** (depuis le 2026-09-05, décision #924) :
  - **En local, bloquant et rapide** — `/ci-gate fast` (43 s) joue le **tour des écrans** en
    parallèle des vérifications statiques ; `/ci-gate full` joue `e2e:affected`.
  - **Sur GitHub, asynchrone et complet** — `.github/workflows/e2e.yml` : les 531 tests en
    8 tranches, **4 min 48 s de mur**, sur `push` vers `main`, une fois par nuit, ou à la main. Ne
    bloque **jamais**. Son verdict se lit par `pnpm e2e:status` (skill `/e2e-status`), qui signale
    les **transitions** vert↔rouge — une suite asynchrone qu'on laisse rouge cesse d'être un filet.
  - 🔴 **Pas de `/publish` si la dernière exécution est rouge.** C'est la contrepartie d'avoir sorti
    la suite complète du chemin bloquant.
- **Ce qui a débloqué la CI**, et ce n'est pas ce qu'on croyait : le harnais sert un **build** au
  lieu du serveur de développement. L'ancienne conclusion — « rendu Babylon instable en CI headless
  ubuntu, même avec SwiftShader → tous les tests combat timeout » — était juste sur les faits et
  fausse sur la cause. Le runner n'a que **4 vCPU**, et il devait les partager entre Chromium en
  rendu logiciel (SwiftShader coûte ~999 % de CPU sur une charge 3D, soit ~10 cœurs) **et** Vite qui
  retransformait le graphe de modules à chaque navigation. Sans Vite, SwiftShader passe.
  **Mesa llvmpipe, la piste que la littérature donnait gagnante, n'obtient AUCUN contexte WebGL** —
  ni sur le runner, ni en local. Question tranchée le 2026-09-05 ; ne pas la rouvrir sans mesure.
- `retries: process.env.CI ? 2 : 0` — **localement 0 retry**, règle inchangée : un test qui ne
  passe qu'au second essai est instable, et on corrige la cause (déterminisme manquant), on ne le
  rejoue pas. ⚠️ **En revanche la suite GitHub, elle, rejoue 2 fois** depuis qu'elle existe
  (2026-09-05) — ce qui MASQUE les instables que cette discipline veut voir. Assumé pour l'instant :
  un runner partagé sous SwiftShader a une gigue réelle, et un rouge sur gigue ferait ignorer le
  signal. À rouvrir si des tests instables passent au travers ; la vraie réponse serait une mise en
  quarantaine (détecter, isoler, rejouer à part), pas un rejeu silencieux.
- **Rasteriseur : `PT_GL` arbitre** (`playwright.config.ts`, fonction `rasterizerArgs`). 🔴 **Une
  liste d'arguments vide ne donne PAS le GPU** — Chromium headless retombe silencieusement sur
  SwiftShader. C'est ce que faisait ce projet : la suite locale tournait en rendu LOGICIEL sur une
  machine équipée d'une Radeon RX 7900 XT inutilisée. Sondé le 2026-09-05 avec
  `scripts/webgl-probe.ts`, qui lit `WEBGL_debug_renderer_info` et dit quel rasteriseur a
  réellement été pris :

  | `PT_GL` | arguments | rasteriseur obtenu ici |
  |---|---|---|
  | `system` (défaut local) | `--use-gl=angle --use-angle=gl` | ANGLE (AMD, Radeon RX 7900 XT, OpenGL 4.6) |
  | `swiftshader` (défaut CI) | `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` | ANGLE (Google, SwiftShader) |

  `--use-angle=gl` demande le pilote OpenGL **du système** : Mesa sert le GPU s'il y en a un, et
  llvmpipe sinon (avec `LIBGL_ALWAYS_SOFTWARE=1`). **Toujours sonder avant de conclure** — ces
  arguments échouent en silence, et `--disable-gpu` réactive SwiftShader sans rien dire.
- Artefacts en échec : `trace: 'on-first-retry'`, `video`/`screenshot` `on-failure`.

## Anti-patterns bannis

`waitForTimeout` fixe · sélecteurs CSS fragiles · tests interdépendants/ordre · `toHaveScreenshot`
comme assertion fonctionnelle · fixture worker mutée · `retries` > 2 · hook debug en prod ·
override `Math.random`.
