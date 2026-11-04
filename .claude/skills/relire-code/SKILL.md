---
name: relire-code
description: Revue unique d'un commit avant le gate : conventions du projet et bugs de correction, dans un sous-agent `code-reviewer`. À lancer par le menu de finalisation sur le commit WIP, ou quand l'humain demande une revue (`/relire-code <commit>`, sinon `HEAD`).
user-invocable: true
context: fork
agent: code-reviewer
---

Tu relis un seul commit : celui passé en argument, sinon `HEAD`. Seul ton dernier message remonte à l'appelant.

## Étapes

1. `git show --stat <commit>` puis `git show <commit>` : la liste des fichiers et le diff.
   Critère : le SHA court relu est connu, il ouvre le rapport.
2. Conventions : tes règles (CLAUDE.md, `.claude/rules/*.md` selon les paquets touchés).
3. Bugs de correction, ligne par ligne du diff : condition inversée ou incomplète, cas limite oublié (liste
   vide, zéro, case hors carte, Pokemon K.O.), état muté au mauvais moment, appelant non mis à jour, test qui ne
   prouve pas ce qu'il nomme. Chaque bug se vérifie en lisant le code autour (appelants, types), pas sur le
   seul diff. Critère : chaque finding cite `fichier:ligne` et le scénario qui casse.
4. Diff dans `packages/core/` : `pnpm audit:core` ; une violation est Critical.

## Rapport

- Première ligne : `Commit relu : <sha court> <titre>`.
- Findings Critical / Major / Minor, chacun `fichier:ligne`, scénario, fix en une ligne.
- Ligne finale stable : `REVIEW VERDICT: pass|fail — <n> critical, <n> major, <n> minor` (fail dès un Critical).
