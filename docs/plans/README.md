# Plans d'exécution

Plans numérotés par ordre chronologique. Chaque plan a un statut en en-tête.

## Statuts
- **draft** — en cours de rédaction / discussion
- **ready** — validé, prêt à exécuter
- **in-progress** — en cours d'exécution
- **done** — terminé
- **abandoned** — abandonné (garder pour l'historique)

## Index

| # | Titre | Statut | Créé |
|---|-------|--------|------|
| 001 | [Setup monorepo](./001-setup-monorepo.md) | done | 2026-03-20 |
| 002 | [Modèles de base du core](./002-core-models.md) | done | 2026-03-20 |
| 003 | [BattleEngine, data et validation](./003-battle-engine-data.md) | done | 2026-03-20 |
| 004 | [Résolution des effets d'attaque](./004-effect-resolution.md) | done | 2026-03-20 |
| 005 | [Refactor : phases de tour + effect registry](./005-turn-phases-effect-registry.md) | done | 2026-03-21 |
| 006 | [Boucle de combat complète](./006-battle-loop.md) | done | 2026-03-21 |
| 007 | [Renderer POC : grille iso + combat visuel](./007-renderer-poc.md) | done | 2026-03-21 |
| 008 | [Move + Act dans le même tour (FFTA-like)](./008-move-plus-act.md) | done | 2026-03-21 |
| 009 | [UI FFT-like : menu d'action, curseur, panel info, timeline](./009-ui-fft-like.md) | done | 2026-03-22 |
| 010 | [Sprites PMDCollab : pipeline d'extraction + intégration renderer](./010-pmdcollab-sprites.md) | done | 2026-03-24 |
| 011 | [KO définitif avec corps bloquant + suppression koCountdown](./011-ko-body-blocking.md) | done | 2026-03-24 |
| 012 | [Direction de fin de tour](./012-end-turn-direction.md) | done | 2026-03-24 |
| 013 | [Modèle de carte + phase de placement](./013-map-model-placement.md) | done | 2026-03-25 |
| 014 | [Patterns slash et blast + mise à jour tactical.ts](./014-slash-blast-patterns.md) | done | 2026-03-27 |
| 015 | [Stats niveau 50](./015-stats-level-50.md) | done | 2026-03-27 |
| 016 | [Infos attaques UI + type icons + fix cone](./016-attack-info-ui-type-icons-cone-fix.md) | done | 2026-03-27 |
| 017 | [Prévisualisation AoE sur la grille](./017-aoe-preview.md) | done | 2026-03-30 |
| 018 | [Status icons ZA + HP bar FFTIC + badges stat changes + sleep animation](./018-status-icons-hp-bar-sleep-anim.md) | done | 2026-03-30 |
| 019 | [Preview dégâts estimés avec random roll](./019-damage-estimate-preview.md) | done | 2026-03-30 |
| 020 | [Canvas responsive, proportions agrandies et camera zoom/pan](./020-responsive-scaling-camera.md) | done | 2026-03-30 |
| 021 | [Sprite offsets corrects via Shadow.png/Offsets.png PMDCollab + ombres sous sprites](./021-sprite-offsets-shadows.md) | done | 2026-03-31 |
| 022 | [Refonte timeline turn order](./022-timeline-turn-order.md) | done | 2026-03-31 |
| 023 | [Mode Sandbox : training dummy, carte mini, panels config, moves défensifs](./023-sandbox-mode.md) | done | 2026-03-31 |
| 024 | [Bugfixes sandbox + relocalisation menu d'attaque](./024-bugfixes-menu-relocation.md) | done | 2026-04-01 |
| 025 | [Tests d'intégration par move](./025-move-integration-tests.md) | done | 2026-04-01 |
| 026 | [Nouvelles mécaniques core : badly_poisoned, confusion, bind, knockback, multi-hit, recharge](./026-roster-expansion-phase1.md) | done | 2026-04-02 |
| 027 | [8 nouveaux Pokemon : données, sprites et documentation](./027-new-pokemon-roster.md) | done | 2026-04-02 |
| 028 | [Replay déterministe avec PRNG seedé](./028-deterministic-replay.md) | done | 2026-04-02 |
| 029 | [IA jouable avec niveaux de difficulté](./029-ai-difficulty-levels.md) | done | 2026-04-02 |
| 030 | [Internationalisation FR/EN](./030-i18n-fr-en.md) | done | 2026-04-03 |
| 031 | [Feedbacks visuels de combat et refactor statuts volatils](./031-battle-visual-feedback.md) | done | 2026-04-03 |
| 032 | [Portée de déplacement variable par Pokemon](./032-variable-movement-by-speed.md) | done | 2026-04-03 |
| 033 | [Écran de sélection d'équipe (Team Select)](./033-team-select.md) | done | 2026-04-03 |
| 034 | [Supprimer l'accès sandbox via URL (query params)](./034-remove-sandbox.md) | abandoned | 2026-04-03 |
| 035 | [Sandbox CLI : suppression query params + accès JSON](./035-sandbox-cli-json.md) | done | 2026-04-04 |
| 036 | [Menu principal, Settings et Disclaimer](./036-main-menu-settings.md) | done | 2026-04-04 |
| 037 | [Battle Log Panel](./037-battle-log.md) | done | 2026-04-04 |
| 038 | [Afficher la portée de déplacement des ennemis au hover](./038-enemy-move-range-hover.md) | done | 2026-04-05 |
| 039 | [Animations de combat : direction, catégorie de move, pipeline sprites](./039-battle-animations-direction-category.md) | done | 2026-04-05 |
| 040 | [Hot-seat multi-équipes (2 à 12 joueurs)](./040-multi-team-hot-seat.md) | done | 2026-04-05 |
| 041 | [Intégration Goatcounter (analytics)](./041-goatcounter-analytics.md) | done | 2026-04-07 |
| 042 | [Bugfixes et feedback playtest](./042-bugfixes-feedback-session.md) | done | 2026-04-07 |
| 043 | [Tileset arène Pokemon + intégration renderer](./043-arena-tileset-renderer.md) | done | 2026-04-07 |
| 044 | [Mode pixelArt global + police Pokemon Emerald Pro](./044-pixelart-mode-font.md) | done | 2026-04-08 |
| 045 | [Format de carte Tiled + parser + validation + preview](./045-tiled-map-format-parser-validation-preview.md) | done | 2026-04-08 |
| 046 | [Dénivelés, hauteur des tiles et dégâts de chute](./046-height-elevation-fall-damage.md) | done | 2026-04-09 |
| 047 | [Ligne de vue 3D et collisions terrain](./047-line-of-sight-3d-collisions.md) | done | 2026-04-11 |
| 048 | [Pokedex reference knowledge base](./048-pokedex-reference-knowledge-base.md) | done | 2026-04-12 |
| 049 | [Migrer les donnees de jeu vers la reference JSON](./049-migrate-game-data-to-reference.md) | done | 2026-04-12 |
| 050 | [Tileset custom (remplacer JAO)](./050-custom-tileset.md) | done | 2026-04-12 |
| 051 | [Types de terrain + modificateurs](./051-terrain-types-modifiers.md) | done | 2026-04-14 |
| 052 | [Orientation tactique (bonus/malus dégâts face/flanc/dos)](./052-orientation-tactique.md) | done | 2026-04-14 |
| 053 | [Undo déplacement](./053-undo-movement.md) | done | 2026-04-14 |
| 054 | [Système CT (Charge Time)](./054-ct-system.md) | done | 2026-04-15 |
| 055 | [Bug gatling](./055-bug-gatling.md) | done | 2026-04-15 |
| 056 | [Pipeline données Champions](./056-champions-data-pipeline.md) | done | 2026-04-16 |
| 057 | [Statuts Champions dans le runtime core](./057-champions-status-rules.md) | done | 2026-04-16 |
| 058 | [Preview CT Timeline au confirm attack](./058-ct-timeline-preview.md) | done | 2026-04-16 |
| 059 | [CT Timeline : séquence prédictive scrollable](./059-ct-timeline-preview.md) | done | 2026-04-16 |
