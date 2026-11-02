---
name: restate
description: Reformule le but de l'humain avant d'agir, et pose une question fermée sur le point le moins sûr. À lancer avant une demande floue ou large, ou quand une question pourrait passer pour un ordre ; appelé par /next quand un choix sort flou d'une discussion.
user-invocable: true
---

Sources : méthode agents de l'humain, section 3 ; backnotprop/pstack (in-your-own-words).

1. **Reformuler** en 2 à 4 lignes, en français simple : le but de l'humain et le problème derrière, avec un
   exemple concret. Sans chemin de fichier ni jargon. Critère : on pourrait le lire sans connaître le code.
2. **Une question fermée** (`AskUserQuestion`) sur le point le moins sûr, avec un défaut et sa raison.
   Critère : une seule question.
3. **Attendre le oui.** Rien n'est écrit ni lancé avant. Puis reprendre le workflow (`/next`, le plan).
