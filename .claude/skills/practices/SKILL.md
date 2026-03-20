---
name: practices
description: Recherche les bonnes pratiques du marché pour un sujet donné
argument-hint: "[sujet technique]"
user-invocable: true
---

Lance l'agent `best-practices` pour rechercher : $ARGUMENTS

L'agent va :
1. Chercher sur le web comment ce sujet est traité dans l'industrie
2. Regarder comment nos projets de référence l'ont résolu (Showdown, PokeRogue, Grid Engine)
3. Comparer au moins 2 approches
4. Recommander la plus adaptée à notre contexte (monorepo TS, Phaser 4, core découplé)

Exemples :
- `/practices ECS vs composition pour un jeu tactique`
- `/practices state machine pour la gestion des tours`
- `/practices structure des tests Vitest dans un monorepo`
