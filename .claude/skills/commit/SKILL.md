---
name: commit
description: Écrit le titre de commit dans le tour, puis commit et push sans validation. À lancer depuis le menu de finalisation, une fois le gate full vert.
user-invocable: true
---

Le tour principal écrit le message : il sait déjà ce que le lot a fait et pourquoi, un agent devrait le
reconstituer.

## Étapes

1. `git status --porcelain` et `git diff --stat HEAD` : rien à commiter → le dire et s'arrêter.
   Critère : la liste des fichiers du commit est connue.
2. Gate : seulement si le lot touche ce qu'il vérifie (`packages/`, `e2e/`, `scripts/` en TypeScript, config
   du monorepo : `package.json`, `tsconfig*`, `biome.json`, `pnpm-*`). Alors `/ci-gate full` vert dans le tour,
   sinon le lancer ; rouge → s'arrêter. Un lot de docs, de skills, d'assets ou de scripts de prototype
   (`assets-src/`) se commite sans gate : il ne prouverait rien et coûte des jetons à l'humain.
3. Rédiger le titre à partir de ce que le tour sait du lot (plan en cours, but du changement) ; le diff ne
   sert qu'à vérifier qu'il ne manque rien. `git log --oneline -5` donne le ton.
   Critère : chaque règle de la référence ci-dessous est tenue.
4. Lot trop varié pour un titre → plusieurs commits logiques, un `git add <fichiers>` par commit.
5. `git add` + `git commit -m "<titre>"` + `git push`. Échec → s'arrêter et le dire.
   Critère : `git log -1 --format=%s` affiche le titre et `git status` dit la branche à jour avec l'origine.
6. Une ligne en chat après coup : `Commité + pushé : <titre>`.

## Référence : le titre

- Conventional commits (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `build`), en français.
- Une seule ligne, 72 caractères max, pas de corps.
- Un scope au plus (`fix(core):`) ; plusieurs scopes → aucun (`fix:`), jamais `fix(a, b):`.
- Précis sur ce qui change pour le joueur ou le dépôt, jamais « mise à jour du code ».
- Le pourquoi détaillé va au graphe ou au plan avant le commit, pas dans le message.
- Pas de validation du message : l'humain ne veut plus arbitrer chaque titre.
