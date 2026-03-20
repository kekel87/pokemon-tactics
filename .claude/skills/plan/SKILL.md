---
name: plan
description: Crée ou review un plan d'exécution dans plans/
argument-hint: "[titre ou numéro du plan]"
user-invocable: true
---

Lance l'agent `plan-reviewer`.

- Si $ARGUMENTS est un numéro existant (ex: `001`), review le plan correspondant
- Si $ARGUMENTS est un titre (ex: `setup monorepo`), crée un nouveau plan
- Sans argument, liste les plans en cours et propose une action

Le plan-reviewer va :
1. Lire `plans/README.md` pour le contexte
2. Lire `STATUS.md` et `docs/roadmap.md` pour l'état actuel
3. Créer ou reviewer le plan demandé
4. Mettre à jour `plans/README.md` si nécessaire
