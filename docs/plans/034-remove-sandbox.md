---
status: draft
created: 2026-04-03
updated: 2026-04-03
---

# Plan 034 — Supprimer l'accès sandbox via URL (query params)

## Objectif

Retirer l'accès au mode sandbox via query params (`?sandbox=...`) avant la première sortie publique. Le mode sandbox reste accessible en interne (dev), mais plus via l'URL.

## Contexte

Le mode sandbox est accessible via `?sandbox=...` dans l'URL (plan 023). Avant la publication, cet accès public doit être retiré. Le sandbox lui-même peut rester dans le code pour le développement, mais ne doit plus être déclenchable par un utilisateur via l'URL.

## Étapes

- [ ] Étape 1 — Supprimer `parseSandboxQueryParams()` et le routage URL → sandbox
- [ ] Étape 2 — Supprimer le bypass sandbox dans `TeamSelectScene` / `BattleScene` (les chemins conditionnels basés sur les query params)
- [ ] Étape 3 — Nettoyer les tests et imports liés au parsing des query params sandbox
- [ ] Étape 4 — Vérifier `pnpm build && pnpm test`, aucune référence aux query params sandbox restante

## Critères de complétion

- Aucun query param `?sandbox=` ne déclenche de comportement spécial
- Le code sandbox interne (composants, carte, panels) reste disponible pour le dev
- Tous les tests passent

## Dépendances

- Dépend de : Plan 033 (team select comme point d'entrée)
- À exécuter avant : publication Phase 2
