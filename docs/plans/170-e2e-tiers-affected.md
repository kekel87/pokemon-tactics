# Plan 170 — Niveaux de test e2e + sélection « affected » du diff

**Statut** : done
**Date** : 2026-07-23
**Origine** : backlog technique « Perf des suites de test — unit + e2e deviennent longues » (`docs/next.md`).

## Constat (mesuré, pas supposé)

| Suite | Réel (wall) | Note |
|-------|-------------|------|
| unit (3532) | ~5s | `next.md` lisait le **cumul CPU multi-worker** (transform 33s + import 56s) comme du wall. Pas le problème. |
| integration (383) | ~6s | idem. |
| **e2e (349)** | **10.4 min** | le vrai coût. |

Décomposition e2e (mesures contrôlées, serveur Vite chaud, 1 worker) :
- 1 boot de scène ≈ **5.4 s** = chargement modules Vite + init app + `waitReady`. **Le GL n'y est pour rien** (SwiftShader 5.4 s vs GPU matériel 5.4 s en solo).
- `fullyParallel` était **absent** → les N tests d'un même fichier tournaient en **série** sur un worker (les 8 workers ne parallélisaient qu'entre fichiers). Activé : spec 9 tests 45→21 s (**2.1×**).
- GPU matériel sous contention (8 boots concurrents) : 36→30 s (~16 %, gratuit car e2e **local-only**, machine avec Radeon RX 7900 XT).
- Workers > 8 : **contre-productif** (34 s vs 30 s à 8) — contention CPU au boot.

Optim brute plafonnée : full suite 10.4 → **8.2 min** (fullyParallel + GPU matériel). Le boot 5.4 s × 349 est incompressible sans changer de **stratégie**. → niveaux + sélectif.

## Décisions

1. **fullyParallel + GPU matériel local** (gains mesurés, retenus). SwiftShader conservé **uniquement** sous `process.env.CI` (harnais reste local-only aujourd'hui, mais si l'e2e revient en CI headless un jour le fallback logiciel est prêt). Workers : **défaut 8** (choix humain — laisse 8/16 cores).
2. **3 niveaux** de test e2e :
   - **L1 `smoke`** — `--project=smoke` (boot + splash), ~20 s. Plancher à chaque commit.
   - **L2 `affected`** — sous-ensemble calculé depuis le diff (`scripts/e2e-affected.ts`). Défaut au commit.
   - **L3 `full`** — les 349. Pré-release (`/publish`) / à la demande / `ci-gate slow`.
3. **Escalade auto** : `e2e-affected` lit le diff et **recommande L3** dès que le changement est cross-cutting (impossible à scoper sûrement) au lieu de deviner un sous-ensemble faux-négatif.

## `scripts/e2e-affected.ts` — logique

Entrée : ref de base (défaut = arbre de travail vs `HEAD` : `git diff --name-only HEAD` + fichiers non suivis).

Classement des chemins changés → décision :

| Diff | Niveau | Specs lancés |
|------|--------|--------------|
| vide | L1 | smoke |
| **seulement** `docs/**`, `**/*.md`, `.claude/**` (non-code) | L1 | smoke |
| **seulement** `e2e/**` (specs/fixtures) | L2 | `--only-changed` (specs impactés) + smoke |
| config/build racine (`playwright.config`, `vitest.config`, `package.json`, `tsconfig*`, `vite.config`) | **L3** | full (escalade — infra) |
| `packages/core/**` **moteur cross-cutting** (`BattleEngine`, `effect-processor`, `targeting`, `damage*`, `turn-system`, grid) | **L3** | full combat + smoke (escalade — non scopable) |
| `packages/{render-*,renderer,ui-dom,view-core,app}/**` (rendu/UI, couplé au scene-graph des combat specs) | **L3** | full combat + dom + visual + smoke (escalade) |
| `packages/data/**` **confiné à du tuning de move** (`overrides/tactical.ts`, ids extraits des hunks `reference/moves.json`/`abilities.json`) | **L2** | combat specs qui **référencent ces ids** (grep e2e specs + `sandbox-configs.ts`, résolution config→spec en 2 sauts) + smoke ; **fallback full combat** si un id ne mappe vers aucun spec |
| mixte / inconnu | **L3** | full |

**Heuristique move-id (L2 resserré)** : pour un diff data confiné, extraire les clés de move top-level des hunks (`^[+-]\s{2}"([a-z0-9-]+)":` dans `tactical.ts`, `"id": "…"` dans les JSON de référence). Pour chaque id : grep `e2e/tests/combat/**` + `e2e/fixtures/sandbox-configs.ts`. Si trouvé dans un spec → inclure. Si trouvé seulement dans un config → remonter au(x) spec(s) important(s) la constante. **Si un id ne mappe vers rien → fallback L3 combat** (sûreté : jamais de faux négatif silencieux).

**Sortie** : imprime `NIVEAU: <L1|L2|L3> — <raison>` (stderr), lance `npx playwright test <args>`, propage le code de sortie. Flag `--print` = imprime la commande sans lancer. Arg positionnel = ref de base custom.

## Sûreté

- **Filet** : L3 full reste **obligatoire au `/publish`** (jamais release sur du L2). L'e2e n'étant pas en CI GitHub, c'est la discipline qui garantit — inchangé par ce plan, juste explicité.
- **Biais conservateur** : tout doute → escalade L3. Un faux positif (trop de specs) coûte du temps ; un faux négatif (spec manquant) cache une régression → interdit.

## Câblage

- `package.json` : `test:e2e` (full, inchangé), `test:e2e:smoke` (`playwright test --project=smoke`), `test:e2e:affected` (`tsx scripts/e2e-affected.ts`).
- `ci-gate/run.sh` : `full` → e2e = `test:e2e:affected` (escalade auto) ; `slow` → e2e = `test:e2e` (full).
- `docs/next.md` + `docs/decisions.md` : acter.

## Hors scope

- Optim du boot 5.4 s lui-même (pré-bundle Vite, snapshot scène) — piste future, gros chantier, pas ici.
- Vitest `--changed` (unit/integration déjà à ~5-6 s, pas prioritaire) — noté en piste.
