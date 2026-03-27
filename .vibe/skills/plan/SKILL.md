---
name: plan
description: Cree ou review un plan d'execution dans plans/
user-invocable: true
allowed-tools:
  - read_file
  - grep
  - write_file
  - search_replace
  - task
---

Lance le subagent `plan-reviewer`.

- Si $ARGUMENTS est un numero existant (ex: `001`), review le plan correspondant
- Si $ARGUMENTS est un titre (ex: `setup monorepo`), cree un nouveau plan
- Sans argument, liste les plans en cours et propose une action

Le plan-reviewer va :
1. Lire `plans/README.md` pour le contexte
2. Lire `STATUS.md` et `docs/roadmap.md` pour l'etat actuel
3. Creer ou reviewer le plan demande
4. Mettre a jour `plans/README.md` si necessaire
