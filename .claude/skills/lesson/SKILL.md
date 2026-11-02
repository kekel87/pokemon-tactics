---
name: lesson
description: Transforme une erreur répétée en garde-fou qui la rend impossible. À lancer à la deuxième occurrence d'une même erreur, ou dès que l'humain corrige Claude.
user-invocable: true
---

Sources : méthode agents de l'humain, section 3 et 6 ; backnotprop/pstack (correct, principle-prove-it-works).

Une règle vue deux fois devient un garde-fou, pas une phrase de plus.

1. **Nommer l'erreur** en une phrase, avec l'exemple réel (commit, message, commande). Chercher au graphe si
   elle est déjà notée : `node scripts/memory/query.mjs "2-4 mots-clés"`. Première fois : la noter au graphe
   (entité `feedback`), s'arrêter là. Critère : l'occurrence est notée avec son exemple.
2. **Choisir le garde-fou**, le premier qui marche dans cet ordre : architecture (rendre l'erreur
   inexprimable), types, lint ou CI dont le message nomme le correctif, test, hook (`.claude/hooks/`), règle
   à `paths:` (`.claude/rules/`), doc en dernier. Critère : un choix et la raison d'écarter ceux d'avant.
3. **Le proposer à l'humain** en une question fermée avec défaut (règles Biome, hooks branchés dans
   `settings.json` et structure demandent son accord). Critère : réponse obtenue.
4. **Prouver qu'il échoue** sur l'erreur passée réelle (rejouer le commit, la commande, le texte), puis qu'il
   laisse passer le cas correct. Critère : sortie des deux essais gardée.
5. **Consigner** au graphe : l'erreur, le garde-fou, la preuve. Critère : entité reliée au `feedback` d'origine.
