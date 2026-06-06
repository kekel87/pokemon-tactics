---
name: menu
description: Affiche le menu interactif post-implémentation (multi-select des étapes de chaîne) à tout moment, même mid-session. Raccourci pour la règle "Après impl" de CLAUDE.md.
user-invocable: true
---

Pop le menu post-implémentation multi-select **maintenant**, sans attendre la fin d'une impl.

**Déclencheurs** : `/menu`, ou le mot **`menu`** seul envoyé en message (même mid-session, hors run). Traiter "menu" nu comme "affiche le multi-select post-impl maintenant".

## Étapes

1. Calcule le contexte de pré-cochage :
   - `git status --porcelain` (fichiers modifiés ; rien → préviens et propose quand même le menu réduit).
   - `git diff --name-only HEAD` (pour détecter `packages/core/`, nouveaux fichiers, nb lignes).
2. Présente le multi-select via `AskUserQuestion` (`multiSelect: true`), question : **"Étapes à lancer ?"**

   | Option | Pré-coché si |
   |--------|--------------|
   | `core-guardian` | diff matche `packages/core/` |
   | `code-reviewer` | >50 lignes changées OU nouveau fichier source |
   | `doc-keeper` | STATUS/docs/decisions impactés, nouvelle mécanique, nouveau Pokemon/move/ability |
   | `visual-tester` | **JAMAIS auto-coché** (≥2 min Playwright, je teste moi-même) |
   | `human-testing` | **JAMAIS auto-coché** (je prépare, tu testes — voir § dédié) |
   | `gate CI` (`/ci-gate`) | Toujours coché sauf si déjà passé dans le tour |
   | `commit` (`/commit`) | Toujours coché |

   Spéciaux selon contexte :
   - **Plan en rédaction** (`docs/plans/*.md` draft non commit) : remplace par `[x] plan-reviewer`, `[ ] game-designer` (si mécaniques jeu).
   - **Session fin** ("fin", "/status") : ajoute `[x] session-closer`.

3. Attends la sélection humaine. Exécute en **ordre fixe** :
   `core-guardian → code-reviewer → doc-keeper → visual-tester → human-testing → /ci-gate → /commit`
4. **Stop sur fail bloquant** (`core-guardian` UI-dep, `code-reviewer` Critical, `/ci-gate` rouge, `visual-tester` régression).

## human-testing — plan de test manuel

Quand `human-testing` coché : **je ne teste pas**. Je produis un plan que **l'humain** exécute dans son navigateur. Étapes :

1. Analyse `git diff HEAD` → repère ce qui est **observable** par l'humain (nouveau move/ability/mécanique, changement UI, rendu, IA).
2. Produis une **checklist numérotée**. Chaque item :
   - **Quoi tester** (1 ligne) + **résultat attendu** (ce que l'humain doit voir).
   - Noms FR officiels obligatoires (ex: `Lame de Roche`), ID EN entre parenthèses si besoin technique.
3. Pour chaque scénario, fournis une **commande sandbox prête à coller** :
   ```
   pnpm dev:sandbox '{...}'
   ```
   - Config pré-remplie (Pokemon, moves, terrain) — **jamais** "puis clique sur X pour configurer".
   - **Valide que moves/Pokemon existent** avant de proposer (source `packages/data`). En cas de doute → agent `sandbox-json`.
   - 1 commande par scénario testable distinct (pas 1 fourre-tout).
4. Présente le tout en chat. **Pause** — l'humain teste, revient avec verdict.
5. Régression rapportée → on traite avant de continuer la chaîne (`/ci-gate`, `/commit`).

`visual-tester` vs `human-testing` : exclusifs en général. `visual-tester` = je pilote Playwright moi-même. `human-testing` = je prépare commandes + checklist, tu testes. L'humain coche l'un, l'autre, ou aucun.

## Règles

- Le menu reste **identique** à la règle "Après impl — OBLIGATOIRE" de `CLAUDE.md` — ce skill n'est qu'un raccourci pour le déclencher à la demande.
- `/commit` : propose le message en chat, attend validation, puis commit + push. Jamais commit sans validation.
- Changes purement config/doc sans code TS → menu réduit (juste `/commit`).
