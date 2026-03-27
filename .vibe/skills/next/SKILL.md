---
name: next
description: Lit STATUS.md, roadmap et plan en cours pour proposer la prochaine etape de travail
user-invocable: true
allowed-tools:
  - read_file
  - grep
---

Lis les fichiers suivants dans cet ordre :
1. `STATUS.md` — etat actuel du projet
2. `docs/roadmap.md` — phases et taches
3. `plans/README.md` — index des plans
4. Le plan en cours s'il y en a un (statut `in-progress` ou `ready`)

Puis propose :
1. **Ce qu'on devrait faire maintenant** — la prochaine tache logique
2. **Pourquoi** — en quoi ca fait avancer le projet
3. **Comment** — les grandes etapes (pas un plan detaille, juste la direction)
4. **Bloquants eventuels** — questions a trancher avant de demarrer

Sois concis. 5-10 lignes max. **Ne cree rien, ne modifie rien** — propose seulement.
