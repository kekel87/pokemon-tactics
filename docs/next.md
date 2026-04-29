# Agenda — Pokemon Tactics

Maintenu par Claude Code. Lu par l'humain via `/next`.

## À faire maintenant

- **Phase 4 en cours.** Plans 069 + 070 (Talents complets) **terminés**. Items restants Phase 4 : Genres des Pokemon (prérequis Cute Charm/Charm), Objets tenus, Natures/Stat Alignment, EV→Stat Points, Méga-évolutions, Roster élargi (~30-40 Pokemon), Team Builder.
- **Prochain plan à discuter** : Genres des Pokemon (prérequis Cute Charm déjà implémentée mais incomplète sans genre) ou Objets tenus (impact stratégique immédiat). Discuter le scope avec l'humain.
- **À valider visuellement** : floating text `AbilityActivated` jaune doré, émission Blaze/Torrent/Overgrow au seuil HP, blocage Confusion par Tempo Perso, Early Bird au réveil. Tester sur sandbox ou en combat IA vs IA.
- **Bonus plan 064 différé — marquages arène + pokéball centrale** : 3 approches documentées dans `docs/plans/064-decorations-obstacles.md` (PixelLab multi-tiles découpé, peinture manuelle Aseprite, génération procédurale). Reco : approche 2 (manuelle) pour une arène propre rapide, ou reporter post-Babylon pour utiliser `DecalMap`. Ne pas oublier.
- **Rewrite renderer Babylon (Phase 3.5) → déplacée APRÈS Phase 7** (décision 2026-04-20, conditionnée par la réussite du plan 065). Plan numéroté au moment de sa rédaction. Pistes à garder sous le coude quand on l'ouvre :
  - Shim type Inspector (`src/types/babylonjs-inspector.d.ts` → `declare module "@babylonjs/inspector" { export {}; }`) pour tester `skipLibCheck: false`.
  - Audit bundle `rollup-plugin-visualizer`, cible 180-220 kB gzip vs 273 kB spike.
  - Flat-shaded `ShaderMaterial` custom (cohérence pixel-art FFTA).
  - `GridMaterial.gridOffset = (0.5, 0, 0.5)` (shader local-space).

## Reporté / à refaire

- **UI (menus, panels, timeline, log)** — à décider : rester en Phaser overlay 2D au-dessus du canvas 3D, ou passer en HTML/CSS par-dessus. À trancher après le spike selon la stack retenue.

## Fait récemment

- 2026-04-29 — **Plan 070 terminé — Polish talents/abilities**. Lévitation traversée lava/deep_water, Tempo Perso bloque Confusion+Intimidation, Engrais/Brasier/Torrent seuil 1/3, Cran sur statut majeur, Matinal au réveil. Refactor hooks passifs → return `{ ..., events }`. Buffer startup events + `consumeStartupEvents()` + `rerunBattleStartChecks()`. `isEffectivelyFlying` extrait. Battle log i18n `AbilityActivated`. `docs/abilities-system.md` créé. Suppression `onAccuracyModify`. CI : 1130 unit + 134 intégration verts.
- 2026-04-27 — **Plan 069 terminé — Système de talents/abilities + floating text**. `AbilityHandlerRegistry`, 20 abilities, `Intimidated`/`Infatuated` position-linked, `AbilityActivated` event, floating text jaune doré `#ffe066`. 20 tests d'intégration verts.
- 2026-04-26 — **Animations vol terminées (hors plan)**. `PokemonSprite` : `restingAnim` + `setRestingAnimation()`, FlyingGlide au repos/dégâts/knockback. 1130 unit + 107 integration verts.
- 2026-04-25 — **Plan 068 terminé — Fix IA terrain + pathfinding**. Pénalité `DANGEROUS_TERRAIN_PENALTY=8`, `scoreMove` BFS sans budget, 3 nouvelles méthodes publiques `BattleEngine`. CT scoring différé.
- 2026-04-24 — **Lint 92 warnings → 0**. Gate CI `biome ci` propre. **Toundra livrée** (12×12, 5 formats spawn).
- 2026-04-23 — **Plan 067 terminé — Écran sélection carte**. Flow TeamSelect → MapSelect → Placement → Battle. **Plan 066 terminé — 7 maps thématiques**. Pipeline tileset 78 tiles. Décision #276 layer-per-format.
- 2026-04-20 — **Plan 065 livré** — OcclusionFader, depth fixes, Alt-click picking. Phase 3.5 Babylon repoussée après Phase 7 (décision #272).
- 2026-04-19 — **Plan 064 livré** — Décorations Tiled, Ghost traverse obstacles, 4 sprites PixelLab, DecorationsLayer, 6 scénarios Gherkin.

---

## Contexte pour la prochaine session

**Phase 3 terminée (2026-04-26). Phase 4 en cours (plans 069 + 070 terminés).** 20 abilities implémentées + polish complet. Prochains items : Genres, Objets tenus, Natures, EV→SP, Roster élargi. Voir section "À faire maintenant" ci-dessus.

**Référence archive plan 061** : branche `plan-061-occlusion-before-3d-pivot`. À consulter si on veut comprendre ce qui a été tenté en 2D iso avant de pivoter.

---

## Conventions de mise à jour (pour Claude)

- **À faire maintenant** : 1 à 3 items max. L'item principal en premier.
- **Reporté** : format `- [agent/action] — raison`. Ex: `- visual-tester plan 060 — dev server redémarré nécessaire`.
- **Fait récemment** : format `- YYYY-MM-DD — ce qui a été fait`. Cap à 10, vire les plus anciens.
- Mettre à jour à la fin d'un plan, à la fin d'une étape significative, ou quand un agent est reporté.
- Si un item passe de "À faire" à "Fait", le déplacer.
- Si un item dans "Reporté" devient impertinent, le supprimer avec une ligne dans "Fait".
