# Plan 248 : l'arrêt 1 donne confiance et preuves

**Statut** : done

| Écart au plan | Raison |
|---|---|
| `remind-post-impl-menu.py` modifié | Relevé par `/relire-code` : le hook rappelait encore oui/non |
| Exemple du plan 247 classé « déduit » | Un échec non vu à l'époque ne compte pas « test vu rouge » |
| Pas d'arrêt 1 pour ce plan | Docs et skills seulement, menu réduit |
**Ouvert le** : 2026-11-07, demande de l'humain à la clôture du plan 247
**Bloque la release ?** : non

## Ce que tu verras à l'écran

- À « Tu testes ? », un bloc « Preuves » liste chaque comportement changé avec sa meilleure preuve, sur
  quatre rangs : observé en partie, test vu rouge puis vert, déduit (typecheck, lecture), non vérifié.
- Sous ce bloc : la liste de ce qui n'est pas vérifié, une confiance (haute, moyenne ou basse) tirée de
  la preuve la plus faible, puis la règle qui fixe la profondeur suggérée, en dernière ligne.
- La question a trois réponses : approfondie (N scénarios), rapide (1 scénario, nommé), sauter. La
  profondeur suggérée est l'option par défaut.
- « Rapide » lance le scénario le moins prouvé ; s'il fait apparaître un bug, la recette passe en
  approfondie.

## Recherche

Agent `best-practices` (Sonnet), 2026-11-07. Retenu :

| Point | Source |
|---|---|
| Pas de confiance au ressenti : les LLM sont surconfiants sur leur propre travail ; l'étiquette se déduit d'une grille | arxiv 2306.13063, 2404.13076 ; Anthropic, « effective harnesses for long-running agents » ; IPCC AR5 |
| Classer chaque comportement, pas la tâche ; un test unitaire n'est pas une observation | Willison, « code proven to work » ; Bach, testing vs checking ; Fowler, test pyramid |
| Une ligne « observé » porte son artefact, sinon elle retombe en « non vérifié » | Willison |
| Profondeur proportionnelle au risque, critères qui forcent l'approfondie | ISTQB / Rex Black (risk-based testing) |
| Passe rapide = le scénario de preuve la plus basse, escalade sur bug | Bach, session-based test management |
| Preuves d'abord, suggestion en dernier, contre l'ancrage sur l'avis de l'IA | arxiv 2603.11821 |

Écarté : un score chiffré (pourcentage de couverture ou de confiance), peu informatif et mal calibré.

## Règles

Source unique : `.claude/skills/next/arret-1.md` (rangs de preuve, grille de confiance, 6 critères qui
forcent l'approfondie, modèle du message). Choix faits ici : la confiance se déduit du comportement le
moins prouvé, jamais au ressenti ; un test, même `test:scenario`, n'est pas une observation ; Claude
tente lui-même l'observation avant l'arrêt quand une voie scriptable existe ; `/consigner` note la
suggestion et le verdict pour durcir les critères (calibration).

## Fichiers

| Fichier | Changement |
|---|---|
| `.claude/skills/next/arret-1.md` (nouveau) | Rangs, grille de confiance, critères, forme du message, exemple tiré du plan 247 |
| `.claude/skills/next/SKILL.md` | Étape 5 : pointeur vers `arret-1.md`, trois réponses au lieu de oui/non |
| `.claude/skills/recette/SKILL.md` | Branche « rapide » (un scénario, escalade sur bug) ; description |
| `.claude/skills/menu/SKILL.md` | Paragraphe sur l'arrêt 1 : trois réponses, « sauter » mène au menu |
| `.claude/skills/consigner/SKILL.md` | Ligne de calibration à l'étape 6 |
| `docs/methodology.md` | Étape 4 du workflow, une phrase |
| `.claude/hooks/remind-post-impl-menu.py` | Rappel de l'arrêt 1 : trois réponses au lieu de oui/non |

`CLAUDE.md` garde « Tu testes ? » et n'est pas touché.

## Critères

- `arret-1.md` contient les 4 rangs, la grille, les 6 critères, la forme du message et un exemple.
- `grep -rn "oui/non\|\`oui\` / \`non\`" .claude docs/methodology.md` ne trouve plus l'arrêt 1.
- Aucun tiret cadratin ajouté (hook).
- Premier usage réel : l'arrêt 1 du prochain plan suit la nouvelle forme.
