---
name: review-local
description: Lance une review de code sur les changements locaux (git diff). Pour reviewer une PR GitHub, utilise le /review built-in.
user-invocable: true
context: fork
agent: code-reviewer
---

Tu reviews les changements locaux du repo (la review verbeuse reste confinée ici — seul ton rapport final remonte dans la conversation). Tu ne peux pas lancer d'autres agents : tout se fait dans ce run.

## Périmètre

1. `git diff` + `git diff --staged` pour identifier les changements.
2. Si aucun changement local : review le dernier commit (`git diff HEAD~1`).

## Review

Applique tes conventions habituelles (CLAUDE.md, TypeScript strict, `.claude/rules/*.md` selon les packages touchés).

**Si des fichiers `packages/core/` ont changé** : fais aussi la passe core-guardian dans ce run — vérifie zéro dépendance UI/rendu dans le core (imports Phaser/Babylon/DOM, types renderer). Règles : `.claude/rules/core.md`. Violation = finding **Critical**.

(La vérification visuelle renderer n'est PAS ton rôle : `visual-tester` se coche dans le menu post-impl.)

## Rapport final

Ton dernier message est le seul contenu visible par l'appelant :

- Findings classés Critical / Major / Minor, chacun avec `fichier:ligne` + fix en une ligne.
- Section core-guardian (si applicable) : ✅ clean ou liste des deps UI trouvées.
- Ligne finale stable : `REVIEW VERDICT: pass|fail — <n> critical, <n> major, <n> minor` (fail si ≥1 Critical).
