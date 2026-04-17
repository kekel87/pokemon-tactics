# Agenda — Pokemon Tactics

Maintenu par Claude Code. Lu par l'humain via `/next`.

## À faire maintenant

- **Validation visuelle plan 061** : proposer à l'humain de tester soi-même OU lancer `visual-tester` (Playwright) pour vérifier qu'un Pokemon derrière une tile élevée affiche bien la silhouette outline masquée à la face de l'obstacle, sans régression curseur / highlights / preview / enemy range / KO.
- Drop stash `plan-060-full-wip` après validation visuelle du plan 061.

## Reporté / à refaire

_(rien)_

## Fait récemment

- 2026-04-17 — **Plan 061 livré** : silhouette d'occlusion Tactics Ogre. Détection iso + outline knockout (`FilterList.addGlow`) + masque WebGL (`FilterList.addMask`, `GeometryMask` banni car Canvas-only). Orchestration `updateOcclusionForAll` dans `GameController`. Constantes `OCCLUSION_*` + `DEPTH_POKEMON_SILHOUETTE_ISO_OFFSET`. 1052 tests passants.
- 2026-04-17 — Plan 061 rédigé + reviewé + passé en `ready` (remplace section B abandonnée du plan 060).
- 2026-04-17 — Plan 060 Section B marquée `abandoned` — l'implem stashée était bancale (API `filters.external.addMask` Phaser 4 instable + refactor d'iso-depth non nécessaire).
- 2026-04-17 — Validation visuelle tileset régénéré (plan 055, commit d25dfbe) — OK en jeu.
- 2026-04-17 — Plan 060 Section A : curseur FFTA (4 variantes, touche H, settings) + fix depth curseur sol.
- 2026-04-17 — Cleanup orchestration `.claude/` (54baf2c).
- 2026-04-16 — Plan 059 : timeline CT prédictive scrollable.
- 2026-04-16 — CI : gate integration tests + fix PlacementPhase + tileset brightness uniforme.

---

## Conventions de mise à jour (pour Claude)

- **À faire maintenant** : 1 à 3 items max. L'item principal en premier.
- **Reporté** : format `- [agent/action] — raison`. Ex: `- visual-tester plan 060 — dev server redémarré nécessaire`.
- **Fait récemment** : format `- YYYY-MM-DD — ce qui a été fait`. Cap à 10, vire les plus anciens.
- Mettre à jour à la fin d'un plan, à la fin d'une étape significative, ou quand un agent est reporté.
- Si un item passe de "À faire" à "Fait", le déplacer.
- Si un item dans "Reporté" devient impertinent, le supprimer avec une ligne dans "Fait".
