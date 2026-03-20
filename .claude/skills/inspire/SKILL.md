---
name: inspire
description: Analyse des visuels de jeux pour trouver de l'inspiration (UI, grille, style)
argument-hint: "[nom du jeu ou URL ou description]"
user-invocable: true
---

Lance l'agent `visual-analyst` avec la demande : $ARGUMENTS

L'agent va :
1. Chercher des visuels du jeu ou du style demandé sur le web
2. Les analyser sous l'angle de notre projet (grille iso, UI tactique, style HD-2D)
3. Extraire ce qu'on peut reprendre, adapter, ou éviter
4. Proposer des applications concrètes pour Pokemon Tactics

Exemples d'utilisation :
- `/inspire Triangle Strategy combat UI`
- `/inspire FFTA grille isométrique`
- `/inspire Fire Emblem Engage animations attaque`
