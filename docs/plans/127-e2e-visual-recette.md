# Plan 127 — E2E & recette visuelle automatisée

**Statut : DRAFT (en rédaction, non validé). Pas de code avant GO humain.**
**Branche : à créer (worktree dédié au démarrage)**
**Spec source : `docs/test-plan.md` (cahier de recette). Suite de : plan 126.**
**Cible renderer : Babylon (seul moteur ; Phaser et render-three retirés). Pas de multi-moteur à tester.**

## But

Automatiser **le maximum** de la recette visuelle (`docs/test-plan.md`) pour que l'humain ne
teste à la main **que ce qui n'est pas automatisable** (le « feel » : fluidité, lisibilité,
esthétique). Le cahier reste la **spec** ; chaque case ☐ devient à terme un test auto ou une
case explicitement « œil humain ».

## Principe directeur — automatiser le SENS, pas les PIXELS

Le piège : tout passer en screenshot-diff → brittle, maintenance énorme (rejeté).
À la place, 4 couches du moins cher / plus robuste au plus coûteux :

| Couche | Teste | Robustesse | Maintenance |
|--------|-------|-----------|-------------|
| 1. Unit `view-core` | la **décision** (pattern, position, état, texte) | très haute | basse (déjà l'archi) |
| 2. Playwright DOM | écrans, HUD DOM, validations, i18n | haute | basse |
| 3. Playwright scene-graph | **sémantique 3D** (mesh à la bonne tile, groupe de profondeur, visibilité, couleur) | haute | moyenne |
| 4. Golden screenshots | **vrai pixel** (couleur overlay, z-fighting) — **petit set** | basse | haute → garder ~8 max |
| (œil humain) | feel / fluidité / lisibilité | — | smoke §10 du cahier |

L'idée clé : la logique qui *décide* positions/patterns/états a été sortie dans `view-core`
par le plan 126 (PmdAnimationController, aura-ground-layout, view-geometry, floating-text-
content…). Donc **la majorité de §3/§5 se teste en unit pur**, sans moteur. La couche 3
vérifie que le renderer **écrit** bien ces décisions sur des meshes (groupe/position/visibilité),
pas l'apparence pixel.

## État des lieux (faits vérifiés)

**Déjà là (atout majeur) :**
- Core **déterministe + replayable** : `createPrng(seed)` (`core/utils/prng.ts`),
  `BattleEngine` prend un `seed`, `BattleReplay { seed, actions }`, `replay-runner.ts`,
  `seededTickHandler`. → le déterminisme moteur est quasi acquis.
- Sandbox piloté par **JSON config** (`pnpm dev:sandbox '{…}'`) → base de scénario reproductible.
- `view-core` pur et déjà unit-testé (filet plan 126).

**Manquant (chantier) :**
- Aucune infra Playwright automatisée (pas de `playwright.config`, pas de dossier `e2e/`, pas de
  script `test:e2e`) — seulement l'agent `visual-tester` via MCP.
- La scène Babylon **n'est pas exposée** (pas de hook `window`) → impossible d'interroger le
  scene-graph depuis Playwright.
- La config sandbox **ne porte pas de `seed`** → il faut le threader jusqu'au `BattleEngine`.
- Pas de contrôle de pause/step des animations ni de signal « scène stabilisée ».

## Prérequis bloquant — déterminisme & hooks (Lot 0)

Sans ça, un e2e de combat est flaky. **Le déterminisme vient du seed du moteur (PRNG injecté),
jamais d'un hack navigateur.**

### Déterminisme (par le core, pas par override `Math.random`)
- [ ] **Coupler seed↔random dans `BattleEngine`** : `this.random = random ?? createPrng(seed)`
      (aujourd'hui `?? Math.random` — découplé du seed → replay ≠ live possible). Résultat :
      déterministe par construction, **zéro `Math.random` dans le moteur de combat**.
- [ ] **Une seule source d'entropie** : le live génère **un seed unique** à la création de la
      partie (variété + reproductible/auditable) ; plus de `Math.random` éparpillé. Vérifier que
      tout le chemin (précision, critique, effets secondaires, IA, placement) tire du `RandomFn`
      injecté — le pattern DI est déjà là, c'est le câblage qu'on garantit.
- [ ] **Seed dans la config sandbox** → `createPrng(seed)` injecté (comme `replay-runner`). Un
      test = un seed fixe.
- [ ] **Bannir l'override `Math.random` côté navigateur** (suggéré par la recherche Playwright) :
      faille classique + non nécessaire ici. Consigné dans `.claude/rules/e2e.md`.

### Sécurité du livrable (freeze / strip)
- [ ] **Hook scène** exposé **sous `import.meta.env.VITE_E2E`** → Vite le **supprime du build
      prod** (dead-code-elimination, pas un simple guard runtime). Jamais de surface debug en prod.
- [ ] **`Object.freeze`** sur ce qui est exposé au test (lecture seule, non réassignable). Le
      PRNG est déjà une closure privée non-altérable.

### Stabilité visuelle
- [ ] **Contrôle anim** : figer/avancer le temps d'animation + signal « scène stabilisée » (idle)
      pour screenshots et assertions stables (`waitForFunction`/`expect.poll`, pas de délai fixe).
- [ ] **Viewport fixe** + désactivation du bob/pulse cosmétique en mode test.

## Lots

### Lot 1 — Pilote (valider l'approche AVANT d'industrialiser)
- [ ] `playwright.config` + dossier `e2e/` + script `test:e2e` (hors gate, séparé).
- [ ] **1 test DOM** : boot menu → naviguer jusqu'à un combat sandbox (assert DOM : titres,
      boutons, journal).
- [ ] **1 test scene-graph** : sur une scène sandbox seedée, assert qu'une pastille de champ est
      au centre de la tile ancre + `renderingGroupId` = sprite (occultable). Prouve la couche 3.
- [ ] **Spike robustesse** : lancer le pilote ~10× d'affilée → cible **100% pass**. Tout
      échec intermittent = bug de déterminisme à corriger (Lot 0), **jamais** masqué par un retry.
- [ ] Chaque scénario = sa **propre config seedée** (isolation, pas d'état partagé entre tests).
- [ ] Bilan : flakiness ? coût ? → décision go/no-go industrialisation.

### Lot 2 — E2E DOM (couche 2)
- [ ] §6 navigation + écrans, §4 HUD (journal, timeline, tooltip, moves grisés, menus),
      §7.1 **validations d'équipe** (messages d'erreur), i18n FR/EN, boot/teardown sandbox.

### Lot 3 — Scene-graph sémantique (couche 3)
- [ ] §3 : champ (tiles couvertes, couleur matériau, pas de débordement), pastille/auras
      (position centrée, pattern, groupe occultable, visibilité au survol), sprite (tint KO,
      ombre, lift volant, état semi-invuln), highlights (groupes, preview au-dessus).
- [ ] §3.3 Champ Psychique : assertions d'état core (dash bloqué + dégâts) via replay seedé.

### Lot 4 — Golden screenshots (couche 4, PETIT)
- [ ] ~8 frames canoniques, scène figée + seed : overlays de champ (4 couleurs), z-fighting,
      silhouette X-ray, multi-niveaux. Tolérance de diff réglée. Doc : comment régénérer.
- [ ] Capturer une **région cadrée** (autour de la cible, sans HUD), pas la scène entière —
      réduit le bruit de diff.

### Lot 5 — CI
- [ ] Job e2e **séparé du gate** (plus lent), sur PR/main. Le gate reste rapide.

## Mapping cahier → couche d'automatisation

| Cahier | Couche dominante |
|--------|------------------|
| §3 (décision : pattern/position/état) | 1 (unit view-core) |
| §3 (écriture sur mesh : groupe/visibilité/position) | 3 (scene-graph) |
| §3 (couleur overlay, z-fighting réel) | 4 (golden) |
| §4, §6, §7 | 2 (DOM) |
| §5 (logique event→spec) | 1 (unit) |
| §5 (rendu effectif) | 3 (scene-graph) |
| §8 (terrain/placement : données + zones) | 1 (data unit) + 2/3 |
| « feel », fluidité, lisibilité | **œil humain** (smoke §10) |

## Ce qui RESTE manuel (assumé)

- Fluidité/easing des anims, lisibilité à distance, esthétique, « ça fait juste ».
- Ces cases du cahier seront **taguées « œil humain »** pour ne pas faire croire à une couverture.

## Risques / points de vigilance

- **Flakiness** = ennemi n°1 → tout repose sur déterminisme (Lot 0). Si une assertion est flaky,
  la descendre d'une couche (pixel → scene-graph → unit) plutôt que retry.
- **Maintenance golden** : strictement plafonné (~8). Tout le reste en scene-graph/unit.
- **Hook scène en prod** : interdit — gardé derrière flag test/dev.
- Ne pas dupliquer en e2e ce qui est déjà couvert en unit `view-core`.
- **Chargement async des sprites/atlas** : ne jamais asserter sur un délai fixe → s'appuyer sur
  le signal « scène stabilisée » (Lot 0). C'est l'ancre anti-flaky.
- **Port Vite unique par worktree** (déterministe) : démarrer Playwright en **série** au début ;
  parallélisme (port/shard) seulement si le temps CI l'exige (Lot 4), pas avant.

## Décisions ouvertes (à trancher avec l'humain)

- [ ] Runner : `@playwright/test` standalone vs intégration Vitest-browser ? (proposer Playwright
      test, déjà dans l'écosystème via visual-tester.)
- [ ] Le hook scène : objet debug dédié vs exposer l'instance directement ?
- [ ] Périmètre du pilote (Lot 1) avant de continuer.
