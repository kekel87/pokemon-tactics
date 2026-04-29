# Agenda — Pokemon Tactics

Maintenu par Claude Code. Lu via `/next`.

## À faire maintenant

- **Phase 4 en cours.** Plans 069 + 070 + 071 terminés. Restants : Objets tenus, Natures/Stat Alignment, EV→Stat Points, Méga-évolutions, Roster élargi (~30-40), Team Builder.
- **Prochain plan** : Objets tenus (impact stratégique immédiat) ou Natures/Stat Alignment. Discuter scope.
- **À valider visuellement** : floating text `AbilityActivated` jaune doré, émission Blaze/Torrent/Overgrow au seuil HP, blocage Confusion par Tempo Perso, Early Bird au réveil. Tester sandbox ou combat IA vs IA.
- **Bonus plan 064 différé — marquages arène + pokéball centrale** : 3 approches dans `docs/plans/064-decorations-obstacles.md` (PixelLab multi-tiles, peinture Aseprite, génération procédurale). Reco : approche 2 (manuelle) pour arène propre rapide, ou reporter post-Babylon via `DecalMap`.
- **Rewrite renderer Babylon (Phase 3.5) → déplacée APRÈS Phase 7** (décision 2026-04-20). Pistes à garder :
  - Shim type Inspector (`src/types/babylonjs-inspector.d.ts` → `declare module "@babylonjs/inspector" { export {}; }`) pour `skipLibCheck: false`.
  - Audit bundle `rollup-plugin-visualizer`, cible 180-220 kB gzip vs 273 kB spike.
  - Flat-shaded `ShaderMaterial` custom (cohérence pixel-art FFTA).
  - `GridMaterial.gridOffset = (0.5, 0, 0.5)` (shader local-space).

## Reporté / à refaire

- **UI (menus, panels, timeline, log)** — à décider : Phaser overlay 2D ou HTML/CSS par-dessus. Trancher après spike selon stack retenue.

## Fait récemment

- 2026-04-29 — **Plan 071 terminé — Genres Pokemon (♂/♀/genderless)**. `genderRatio` exposé via loaders, `PokemonGender` enum, `rollGender(ratio, rng)`. `PokemonInstance.gender` rolled à la création (`createPokemonInstance` accepte `genderRng` + `genderOverride` pour Team Builder futur). Cute Charm vérifie genre opposé non-genderless. Symboles ♂/♀ colorés (`#5fa8ff` / `#ff7fb4`) dans InfoPanel. CI verte : 1135 unit + 137 intégration. Bug data Kangaskhan (50/50 vs 0/100 canon) tracé en backlog.
- 2026-04-29 — **Plan 070 terminé — Polish talents/abilities**. Lévitation traversée lava/deep_water, Tempo Perso bloque Confusion+Intimidation, Engrais/Brasier/Torrent seuil 1/3, Cran sur statut majeur, Matinal au réveil. Refactor hooks passifs → return `{ ..., events }`. Buffer startup events + `consumeStartupEvents()` + `rerunBattleStartChecks()`. `isEffectivelyFlying` extrait. Battle log i18n `AbilityActivated`. `docs/abilities-system.md` créé. Suppression `onAccuracyModify`. CI : 1130 unit + 134 intégration verts.
- 2026-04-27 — **Plan 069 terminé — Talents/abilities + floating text**. `AbilityHandlerRegistry`, 20 abilities, `Intimidated`/`Infatuated` position-linked, `AbilityActivated` event, floating text jaune doré `#ffe066`. 20 tests intégration verts.
- 2026-04-26 — **Animations vol terminées (hors plan)**. `PokemonSprite` : `restingAnim` + `setRestingAnimation()`, FlyingGlide repos/dégâts/knockback. 1130 unit + 107 integration verts.
- 2026-04-25 — **Plan 068 terminé — Fix IA terrain + pathfinding**. Pénalité `DANGEROUS_TERRAIN_PENALTY=8`, `scoreMove` BFS sans budget, 3 nouvelles méthodes `BattleEngine`. CT scoring différé.
- 2026-04-24 — **Lint 92 warnings → 0**. Gate CI `biome ci` propre. **Toundra livrée** (12×12, 5 formats spawn).
- 2026-04-23 — **Plan 067 terminé — Sélection carte**. Flow TeamSelect → MapSelect → Placement → Battle. **Plan 066 terminé — 7 maps thématiques**. Pipeline tileset 78 tiles. Décision #276 layer-per-format.
- 2026-04-20 — **Plan 065 livré** — OcclusionFader, depth fixes, Alt-click picking. Phase 3.5 Babylon repoussée après Phase 7 (décision #272).
- 2026-04-19 — **Plan 064 livré** — Décorations Tiled, Ghost traverse obstacles, 4 sprites PixelLab, DecorationsLayer, 6 scénarios Gherkin.

---

## Contexte prochaine session

**Phase 3 terminée (2026-04-26). Phase 4 en cours (plans 069 + 070 terminés).** 20 abilities + polish. Prochains : Genres, Objets tenus, Natures, EV→SP, Roster élargi. Voir "À faire maintenant" ci-dessus.

**Référence archive plan 061** : branche `plan-061-occlusion-before-3d-pivot`. Consulter si besoin de comprendre ce qui a été tenté en 2D iso avant pivot.

---

## Conventions de mise à jour (pour Claude)

- **À faire maintenant** : 1 à 3 items max. Item principal en premier.
- **Reporté** : `- [agent/action] — raison`. Ex: `- visual-tester plan 060 — dev server redémarré nécessaire`.
- **Fait récemment** : `- YYYY-MM-DD — ce qui a été fait`. Cap 10, vire les plus anciens.
- Mettre à jour fin de plan, fin d'étape significative, ou quand agent reporté.
- Item "À faire" → "Fait" : déplacer.
- Item "Reporté" impertinent : supprimer avec ligne dans "Fait".
