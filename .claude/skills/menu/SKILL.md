---
name: menu
description: Affiche le menu de finalisation (multi-select des étapes de chaîne) à tout moment, même mid-session. Raccourci pour l'arrêt 2 du workflow de CLAUDE.md.
user-invocable: true
---

Pop le menu de finalisation **maintenant**, sans attendre la fin d'une impl.

**Déclencheurs** : `/menu`, ou le mot **`menu`** seul envoyé en message (même mid-session, hors run).

⚠️ Ce menu est l'**arrêt 2** du workflow. L'arrêt 1 (« Tu testes ? ») est une question séparée, une
seule option oui/non, posée dès que le code est écrit et que `/simplify` est passé dessus — en
annonçant le **nombre de scénarios**, jamais une durée. Si la recette humaine n'a pas encore eu lieu
et que le changement est observable, pose d'abord cette question-là — sauf si l'humain demande
explicitement le menu.

## Étapes

1. Calcule le contexte de pré-cochage :
   - `git status --porcelain` (fichiers modifiés ; rien → préviens et propose quand même le menu réduit).
   - `git diff --name-only HEAD` (détecte `packages/core/`, nouveaux fichiers, nb lignes).
2. **Sans rien demander**, avant le menu, dans cet ordre :
   - **commit WIP** si des changements non commités existent (point de restauration propre avant que
     la chaîne touche au code — origine plan 166).
   - Les vérifications **EN PARALLÈLE** (aucune dépendance, toutes en lecture seule) :
     `pnpm audit:core` si le diff matche `packages/core/` (une seconde, le gate le rejoue) ;
     `/relire-code <sha du WIP>`, toujours : la revue unique (conventions et bugs de correction), qui
     nomme le commit relu ; elle ne lance ni lint, ni typecheck, ni tests.
   Corriger les bloquants avant de continuer.
3. Présente **un seul** `AskUserQuestion`, **une seule question multiSelect**, 3 options :

   | Option | Pré-coché si |
   |--------|--------------|
   | `tests (test-writer)` | changement observable automatisable → tests unitaires restants (hors core, déjà faits pendant le dev) + scénario e2e + cahier de recette (graphe, entités `recette`), **puis `/simplify` sur ce code de test**. Décoché si purement pixel/anim |
   | `consigner` | documents `docs/` impactés, fait à consigner au graphe, nouvelle mécanique, nouveau Pokemon/move/talent |
   | `gate + commit` | **toujours coché** — `/ci-gate full` puis commit + push |

   Spéciaux selon contexte :
   - **Plan en rédaction** (`docs/plans/*.md` draft non commit) : menu remplacé par `[x] /relire-plan`,
     `[ ] game-designer` (si mécaniques jeu). 🔴 **Jamais d'option « commiter le plan »** — on ne le
     fait jamais.
   - **Session fin** (« fin », `/status`) : ajoute `/cloture` en 4e option (plafond `AskUserQuestion`).
   - `visual-tester` n'est **jamais** dans le menu auto (≥2 min Playwright) — l'humain le demande.

4. Attends la sélection humaine. Exécute en **ordre fixe** :
   `{test-writer → /simplify (sur les tests)} en arrière-plan ∥ /consigner dans le tour → [résumé du diff WIP→final] → /ci-gate full → commit + push (amende le WIP)`
   (`∥` = en parallèle : tests vs `docs/`, ensembles d'écriture disjoints. Borner chaque prompt.)
5. **Stop sur fail bloquant** (`pnpm audit:core` rouge, `/relire-code` Critical, `/ci-gate` rouge,
   contrôle injoignable au clavier ou au pad).

## Résumé du diff WIP→final — à la place du re-test systématique

Si la chaîne a retouché du code **hors tests unitaires / e2e** (correction de review,
standardisation, refacto de `/consigner`), montrer en **3 lignes en français ce qu'elle a changé**
(`git diff <commit WIP>..`) et **laisser l'humain décider** si ça mérite un coup d'œil. Si elle n'a
ajouté que des tests → droit au gate et au commit.

🔴 Le jugement revient à l'humain, pas à Claude : c'est sur une auto-évaluation de Claude que le
plan 166 a dérapé.

## Vocabulaire des rapports

Jamais « ✅ tout est bon ». Dire **« aucune anomalie détectée par les règles connues, non
exhaustif »** — contre-mesure au tampon automatique.

## Règles

- Ce skill est la **source de vérité** de l'arrêt 2. L'arrêt 1 et ce qui précède vivent dans `/next`.
- `/commit` : commit + push **directement**, sans proposer le message ni attendre validation.
- Changes purement config/doc sans code TS : pas d'arrêt recette, menu réduit (commit direct).
- Bug fix d'une ligne sans test : arrêt recette normal, `/relire-code` sauté.
- Deux agents en parallèle seulement si leurs ensembles d'écriture sont disjoints ; chaque prompt dit ce que
  l'agent ne doit PAS traiter. Table : `docs/methodology.md`, « Parallélisme des agents ».
- La suite e2e complète tourne sur GitHub après le push et ne bloque jamais : ne jamais l'attendre ni la
  sonder (décision #925). Verdict lu par `/next` via `/e2e-status`.
- 🔴 Ne rien ajouter au backlog / à l'agenda du graphe sans accord explicite de l'humain.
