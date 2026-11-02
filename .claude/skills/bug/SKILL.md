---
name: bug
description: Corrige un bug en le reproduisant d'abord par un test rouge sur le symptôme exact. À lancer quand l'humain signale un bug, quand une recette échoue, ou quand un comportement observé contredit le code.
user-invocable: true
---

Sources : méthode agents de l'humain, section 3 ; mattpocock/skills (diagnosing-bugs).

Aucune théorie avant la commande rouge.

1. **Reproduire.** Écrire le test qui montre le symptôme exact, au niveau le plus haut possible : scénario e2e
   (`e2e/`, conventions `.claude/rules/e2e.md`) si le bug se voit à l'écran, sinon intégration
   (`pnpm test:integration`), sinon unitaire (`pnpm test`). Critère : une commande rouge, dont l'échec décrit
   le symptôme rapporté, pas un symptôme voisin.
2. **Isoler.** Lire le code sur le chemin du test rouge jusqu'à la cause. Critère : la cause tient en une
   phrase et explique le rouge.
3. **Corriger.** Le plus petit changement qui traite la cause. Critère : la même commande passe au vert.
4. **Vérifier autour.** Relancer la suite voisine (`pnpm test` ; le fichier e2e du test). Critère : vert, et le
   résultat réel vérifié comme le symptôme avait été observé (valeur lue, écran regardé).
5. **Garder le test** comme régression. Puis le workflow normal : arrêt 1 (« Tu testes ? »), puis `/menu`.

Si la reproduction échoue après deux angles différents, le dire à l'humain avec ce qui a été essayé, plutôt que
corriger à l'aveugle. Bug qui résiste et demande un navigateur instrumenté : proposer l'agent `debugger`.
Deuxième occurrence d'un même type de bug : `/lesson`.
