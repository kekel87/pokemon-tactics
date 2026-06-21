---
name: menu
description: Affiche le menu interactif post-implémentation (multi-select des étapes de chaîne) à tout moment, même mid-session. Raccourci pour la règle "Après impl" de CLAUDE.md.
user-invocable: true
---

Pop le menu post-implémentation **maintenant**, sans attendre la fin d'une impl.

**Déclencheurs** : `/menu`, ou le mot **`menu`** seul envoyé en message (même mid-session, hors run). Traiter "menu" nu comme "affiche le multi-select post-impl maintenant".

## Étapes

1. Calcule le contexte de pré-cochage :
   - `git status --porcelain` (fichiers modifiés ; rien → préviens et propose quand même le menu réduit).
   - `git diff --name-only HEAD` (pour détecter `packages/core/`, nouveaux fichiers, nb lignes).
2. Présente le menu via `AskUserQuestion`.

   ⚠️ `AskUserQuestion` plafonne à **4 options par question**. Le menu est donc **découpé en 3 questions `multiSelect`** dans **un seul appel** (3 entrées dans `questions`), groupées par phase et dans l'ordre :

   **Q1 — `"Tests ?"`** (multiSelect)

   | Option | Pré-coché si |
   |--------|--------------|
   | `human-testing` | changement observable (move/ability/mécanique/UI/rendu/IA) — **mode interactif**, voir § dédié |
   | `visual-tester` | **JAMAIS auto-coché** (≥2 min Playwright, je pilote) |

   **Q2 — `"Validations locales ?"`** (multiSelect)

   | Option | Pré-coché si |
   |--------|--------------|
   | `core-guardian` | diff matche `packages/core/` |
   | `code-reviewer` | >50 lignes changées OU nouveau fichier source |
   | `doc-keeper` | STATUS/docs/decisions impactés, nouvelle mécanique, nouveau Pokemon/move/ability |

   **Q3 — `"Finalisation ?"`** (multiSelect)

   | Option | Pré-coché si |
   |--------|--------------|
   | `gate CI` (`/ci-gate`) | Toujours coché sauf si déjà passé dans le tour |
   | `commit` (`/commit`) | Toujours coché |

   Spéciaux selon contexte :
   - **Plan en rédaction** (`docs/plans/*.md` draft non commit) : Q2 remplacée par `[x] plan-reviewer`, `[ ] game-designer` (si mécaniques jeu).
   - **Session fin** ("fin", "/status") : ajoute `[x] session-closer`.

3. Attends la sélection humaine. Exécute en **ordre fixe** :
   `human-testing → visual-tester → core-guardian → code-reviewer → doc-keeper → /ci-gate → /commit`
4. **Stop sur fail bloquant** (`core-guardian` UI-dep, `code-reviewer` Critical, `/ci-gate` rouge, `visual-tester` régression).

## human-testing — test manuel interactif (mode par défaut)

Quand `human-testing` coché : déroulé **interactif, un scénario à la fois**. Je lance, tu regardes, tu valides. Je ne dump **pas** toute la checklist d'un bloc.

1. Analyse `git diff HEAD` → liste les scénarios **observables** par l'humain (nouveau move/ability/mécanique, changement UI, rendu, IA). Noms FR officiels (ex: `Lame de Roche`), ID EN entre parenthèses si besoin technique.
2. Par scénario, construit la config sandbox JSON **minimale** (seuls les champs utiles au scénario, le reste = défauts) :
   - Config pré-remplie (Pokemon, moves, terrain) — **jamais** "puis clique sur X pour configurer".
   - **Valide que moves/Pokemon existent** avant (source `packages/data`). Doute → agent `sandbox-json`.
   - **Jamais coller la commande à l'humain pour qu'il la lance.**
   - Si le scénario demande à l'humain d'agir/déplacer/attaquer **avec la cible (Dummy)** → `"dummyControl": "player"` (+ `dummyMoves`). **Jamais laisser le défaut `"ai"`** sinon l'humain ne contrôle pas la cible.
3. **Boucle interactive** :
   - **(a)** **Je lance moi-même** le serveur via `Bash run_in_background` : `pnpm dev:sandbox '{...}'`. Port du checkout : `PT_PORT` → `.worktree-port` → sinon `5173` (`vite.config.ts`) ; **en worktree ≠ 5173**. Config bakée à l'env au boot → HMR ne suffit pas, je relance mon process bg sandbox à chaque scénario. **Avant chaque relance : j'arrête MON process sandbox précédent** (`TaskStop` — indépendant du port ; en dernier recours kill PID du vite/node de CE checkout) → réutilise le même port, **jamais** laisser vite incrémenter (5174…). Cible **uniquement mon process sandbox** : jamais kill Firefox/navigateur, jamais le serveur dev global de l'humain.
   - **(b)** Résumé en chat : **URL** `http://localhost:<port résolu>` + **quoi tester** (1-2 lignes) + **résultat attendu** (noms FR).
   - **(c)** **Pause.** Tu testes dans le navigateur.
   - **(d)** Ta réponse :
     - `suivant` / `ok` / `next` → scénario suivant.
     - bug / retour → on traite **avant** de continuer la boucle.
4. Tous les scénarios passés → on enchaîne le reste de la chaîne (`/ci-gate`, `/commit`).

`visual-tester` vs `human-testing` : exclusifs en général. `visual-tester` = je pilote Playwright moi-même. `human-testing` = je lance moi-même le serveur sandbox (background), tu testes en interactif dans le navigateur. L'humain coche l'un, l'autre, ou aucun.

## Règles

- Le menu reste **identique** à la règle "Après impl — OBLIGATOIRE" de `CLAUDE.md` — ce skill n'est qu'un raccourci pour le déclencher à la demande.
- `/commit` : propose le message en chat, attend validation, puis commit + push. Jamais commit sans validation.
- Changes purement config/doc sans code TS → menu réduit (juste `/commit`).
