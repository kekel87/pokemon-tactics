---
name: ci-gate
description: Run le gate CI local (lint, typecheck, build, tests, tests:integration). BLOQUANT avant commit. Fail-fast avec hint de fix.
argument-hint: "[fast|full|slow]"
user-invocable: true
context: fork
agent: general-purpose
---

Tu exécutes le gate CI local du projet (sortie verbeuse confinée ici — seul ton rapport final remonte dans la conversation).

## Pourquoi `audit:flow` est en tête

Il vérifie que la configuration du flux (agents, skills, règles) est cohérente avec la réalité du
dépôt : aucun ordre d'écrire dans un fichier versé au graphe, aucun renvoi vers un chemin
inexistant, aucun hook déclaré mais absent, tout agent qui parle du graphe sachant l'interroger.

Il coûte **une seconde** et il a été écrit après coup : la revue manuelle du flux du 2026-09-06
avait laissé passer quatre trous, dont deux qui auraient annulé la migration en silence — et trois
renvois de `CLAUDE.md` vers des fichiers **qui n'ont jamais existé**. Une inspection au jugé rate ce
à quoi elle ne pense pas.

## Exécution

Lance (tier passé en argument, défaut `full`) :

```bash
bash .claude/skills/ci-gate/run.sh ${ARGUMENTS:-full}
```

Tiers :

| Tier | Contenu | Budget |
|---|---|---|
| `fast` | **audit:flow** → lint:fix → typecheck → test → test:integration, **avec le tour des écrans lancé en parallèle** (`e2e/tests/smoke`) | **boucle d'itération** |
| `full` | + build + test:scenario + **e2e `affected --since-main`** (niveau choisi d'après le diff du LOT : L1 smoke / L2 affected / L3 full). L'étape `test` y devient **`test:coverage`** : mêmes tests unitaires, plus le seuil de non-recul du core (+2 s) | point de contrôle |
| `slow` | + test:all (scenario) + **e2e complet** (les 531) | filet pré-release |

`fast` superpose le tour des écrans aux vérifications statiques : le tour attend un navigateur
pendant que lint/typecheck/vitest prennent des cœurs, donc les deux attentes se recouvrent au lieu
de s'additionner. Un échec du tour arrête le gate comme n'importe quelle étape.

Depuis le 2026-09-05, `affected` route par **famille de code → famille de specs** au lieu de
n'avoir qu'un cran « je ne sais pas scoper → je lance tout » : toucher au salon en ligne ne rejoue
plus les 218 specs de mécanique. Le tour des écrans est le plancher, toujours joint.

🔴 **Pourquoi `full` passe `--since-main`** (corrigé le 2026-09-10). Par défaut le sélecteur se cadre
sur `HEAD`, c'est-à-dire sur le **dernier commit**. Or la règle du commit WIP avant la revue
(`feedback_wip_commit_retest_before_final`) fait qu'à l'heure du gate, `HEAD` contient déjà tout le
lot : le diff est presque vide et le gate valide une fraction du travail en annonçant du vert.
Mesuré le 2026-09-08 : **14 tests joués au lieu de 531** sur un lot qui touchait six paquets.
`--since-main` cadre sur le **point de divergence d'avec `origin/main`**, donc sur le lot entier,
commit WIP compris. Ne le retire pas du tier `full`.

Deuxième garde-fou du même jour : une famille retenue qui ne résout **aucun** spec (dossier renommé,
spec déplacé) escalade désormais en suite entière au lieu de disparaître en silence — auparavant le
plancher `tour` maintenait la sélection non vide et le message restait rassurant. La logique de
sélection est couverte par `scripts/e2e-affected.test.ts`.

`pnpm lint:fix` peut modifier des fichiers (autofix Biome) — c'est attendu, ne les revert pas.

## Ressources machine (2026-08-25)

L'humain travaille et joue sur cette machine pendant le gate. L'e2e passe donc par
`scripts/with-cpu-cap.sh` (plafond noyau : 4 cœurs sur 16, 8 Go, priorité basse) et 3 workers — le
tier `full` reste `affected`, jamais `pnpm test:e2e` en direct. Un run long se lance **en tâche de
fond** pour pouvoir être arrêté dès qu'il réclame sa machine. `PT_FULL_SPEED=1` débride, uniquement
s'il l'a demandé. Détails : `.claude/rules/e2e.md` § Ressources machine.

## Rapport final — format STRICT

Ton dernier message est le seul contenu visible par l'appelant. Il contient, dans cet ordre :

1. **Sur succès** : la ligne `CI VERDICT: pass — <tier>` et rien d'autre d'essentiel (1 ligne de durée OK).
2. **Sur échec** :
   - La ligne `CI VERDICT: fail — <step> (<tier>)`
   - L'extrait d'erreur pertinent **verbatim** (10-30 lignes max : le test cassé, l'erreur tsc, la règle Biome) — pas le log entier.
   - Le hint de fix imprimé par le script.
   - La ligne suggestion copy-paste : `/goal /ci-gate passes (CI VERDICT: pass), or stop after 15 turns`

Pas de retry, pas de fix toi-même : tu rapportes, l'appelant décide. Verdict `fail` → l'appelant **stoppe la chaîne** (pas de `/commit`).
