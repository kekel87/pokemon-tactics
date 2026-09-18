---
name: menu
description: Affiche le menu de finalisation (multi-select des étapes de chaîne) à tout moment, même mid-session. Raccourci pour l'arrêt 2 du workflow de CLAUDE.md.
user-invocable: true
---

Pop le menu de finalisation **maintenant**, sans attendre la fin d'une impl.

**Déclencheurs** : `/menu`, ou le mot **`menu`** seul envoyé en message (même mid-session, hors run).

⚠️ Ce menu est l'**arrêt 2** du workflow. L'arrêt 1 (« Tu testes ? ») est une question séparée, une
seule option oui/non, posée dès que le code est écrit. Si la recette humaine n'a pas encore eu lieu
et que le changement est observable, pose d'abord cette question-là — sauf si l'humain demande
explicitement le menu.

## Étapes

1. Calcule le contexte de pré-cochage :
   - `git status --porcelain` (fichiers modifiés ; rien → préviens et propose quand même le menu réduit).
   - `git diff --name-only HEAD` (détecte `packages/core/`, nouveaux fichiers, nb lignes).
2. **Sans demander**, avant le menu :
   - **commit WIP** si des changements non commités existent (point de restauration propre avant que
     la chaîne touche au code — origine plan 166).
   - `core-guardian` si le diff matche `packages/core/`.
3. Présente **un seul** `AskUserQuestion`, **une seule question multiSelect**, 4 options :

   | Option | Pré-coché si |
   |--------|--------------|
   | `tests (test-writer)` | changement observable automatisable → tests unitaires restants (hors core, déjà faits pendant le dev) + scénario e2e + cahier de recette (graphe, entités `recette`). Décoché si purement pixel/anim |
   | `code-reviewer` | >50 lignes changées OU nouveau fichier source |
   | `doc-keeper` | documents `docs/` impactés, fait à consigner au graphe, nouvelle mécanique, nouveau Pokemon/move/talent |
   | `gate + commit` | **toujours coché** — `/ci-gate full` puis commit + push |

   Spéciaux selon contexte :
   - **Plan en rédaction** (`docs/plans/*.md` draft non commit) : menu remplacé par `[x] plan-reviewer`,
     `[ ] game-designer` (si mécaniques jeu). 🔴 **Jamais d'option « commiter le plan »** — on ne le
     fait jamais.
   - **Session fin** (« fin », `/status`) : ajoute `session-closer` à la place de l'option la moins
     pertinente (plafond de 4 options).
   - `visual-tester` n'est **jamais** dans le menu auto (≥2 min Playwright) — l'humain le demande.

4. Attends la sélection humaine. Exécute en **ordre fixe** :
   `tests (test-writer) → code-reviewer → doc-keeper → [re-test humain, conditionnel] → /ci-gate full → commit + push (amende le WIP)`
5. **Stop sur fail bloquant** (`core-guardian` UI-dep, `code-reviewer` Critical, `/ci-gate` rouge,
   contrôle injoignable au clavier ou au pad).

## Re-test humain — conditionnel

Ne redemande à l'humain de tester **que si la chaîne a retouché du code hors tests unitaires / e2e**
(correction de review, standardisation, refacto doc-keeper). Si la chaîne n'a ajouté que des tests →
droit au gate et au commit.

## Règles

- Le menu reste **identique** à la section « Le workflow — DEUX arrêts » de `CLAUDE.md` — ce skill
  n'est qu'un raccourci pour le déclencher à la demande.
- `/commit` : commit + push **directement**, sans proposer le message ni attendre validation.
- Changes purement config/doc sans code TS → menu réduit (commit direct).
- 🔴 Ne rien ajouter au backlog / à l'agenda du graphe sans accord explicite de l'humain.
