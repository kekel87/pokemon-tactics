---
name: practices
description: Recherche les bonnes pratiques du marche pour un sujet donne
user-invocable: true
allowed-tools:
  - read_file
  - grep
  - task
---

Lance le subagent `best-practices` pour rechercher : $ARGUMENTS

L'agent va :
1. Chercher sur le web comment ce sujet est traite dans l'industrie
2. Regarder comment nos projets de reference l'ont resolu (Showdown, PokeRogue, Grid Engine)
3. Comparer au moins 2 approches
4. Recommander la plus adaptee a notre contexte (monorepo TS, Phaser 4, core decouple)

Exemples :
- `/practices ECS vs composition pour un jeu tactique`
- `/practices state machine pour la gestion des tours`
- `/practices structure des tests Vitest dans un monorepo`
