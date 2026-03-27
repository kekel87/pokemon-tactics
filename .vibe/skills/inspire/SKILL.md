---
name: inspire
description: Analyse des visuels de jeux pour trouver de l'inspiration (UI, grille, style)
user-invocable: true
allowed-tools:
  - read_file
  - grep
  - task
---

Lance le subagent `visual-analyst` avec la demande : $ARGUMENTS

L'agent va :
1. Chercher des visuels du jeu ou du style demande sur le web
2. Les analyser sous l'angle de notre projet (grille iso, UI tactique, style HD-2D)
3. Extraire ce qu'on peut reprendre, adapter, ou eviter
4. Proposer des applications concretes pour Pokemon Tactics

Exemples d'utilisation :
- `/inspire Triangle Strategy combat UI`
- `/inspire FFTA grille isometrique`
- `/inspire Fire Emblem Engage animations attaque`
