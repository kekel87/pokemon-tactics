# Agenda — Pokemon Tactics

Maintenu par Claude Code. Lu via `/next`.

## À faire maintenant

- **Phase 4 en cours.** Plans 069–077 terminés + bugfixes post-Batch C. Restants : Team Builder (sélection moves + items + SP par joueur). Méga-évolutions → Phase 9.
- **Prochain plan** : **Team Builder** — sélection moves + items + SP par joueur avant le combat. Ou **Roster Batch D** si des Pokemon Gen 1 tactiquement intéressants restent (haunter réintégrable, parasect, machoke, slowpoke, dodrio, muk, tauros…).
- **À valider visuellement** : floating text `AbilityActivated` jaune doré, émission Blaze/Torrent/Overgrow au seuil HP, blocage Confusion par Tempo Perso, Early Bird au réveil. Tester sandbox ou combat IA vs IA.
- **Bonus plan 064 différé — marquages arène + pokéball centrale** : 3 approches dans `docs/plans/064-decorations-obstacles.md` (PixelLab multi-tiles, peinture Aseprite, génération procédurale). Reco : approche 2 (manuelle) pour arène propre rapide, ou reporter post-Babylon via `DecalMap`.
- **Rewrite renderer Babylon (Phase 3.5) → déplacée APRÈS Phase 7** (décision 2026-04-20). Pistes à garder :
  - Shim type Inspector (`src/types/babylonjs-inspector.d.ts` → `declare module "@babylonjs/inspector" { export {}; }`) pour `skipLibCheck: false`.
  - Audit bundle `rollup-plugin-visualizer`, cible 180-220 kB gzip vs 273 kB spike.
  - Flat-shaded `ShaderMaterial` custom (cohérence pixel-art FFTA).
  - `GridMaterial.gridOffset = (0.5, 0, 0.5)` (shader local-space).

## Reporté / à refaire

- **Affichage nature dans InfoPanel** — reporté à la refonte InfoPanel globale. Mécanique core livrée (plan 072), UI absente. Reprendre étapes 4 + 5 du plan 072 quand InfoPanel revu.
- **UI (menus, panels, timeline, log)** — à décider : Phaser overlay 2D ou HTML/CSS par-dessus. Trancher après spike selon stack retenue.

## Fait récemment

- 2026-05-11 — **Bugfixes post-Batch C (hors plan)**. Haunter retiré du roster (sprites conservés) — roster 52 → 51. `DamageDealt.recoil?: boolean` : Self-Destruct/Explosion affiche "K.O.!" au lieu du nombre négatif quand recoil fatal. InfoPanel : badge "Verrouillé" (LockedOn) dans `VOLATILE_LABELS`. Backlog : bug overflow grille 51+ Pokemon ajouté.
- 2026-05-07 — **Roster Batch C terminé — plan 077**. 18 Pokemon ajoutés (sandslash, ninetales, wigglytuff, vileplume, golduck, tentacruel, magneton, dewgong, cloyster, haunter, kingler, electrode, jynx, electabuzz, magmar, lapras, porygon, omastar). Roster 34 → 52 (51 après retrait Haunter). 15 nouveaux moves (will-o-wisp, nasty-plot, sludge-wave, flash-cannon, discharge, screech, icicle-spear, lovely-kiss, crabhammer, self-destruct, tri-attack, lock-on, moonblast, ancient-power, shell-smash). 8 nouvelles abilities (effect-spore, cloud-nine, shell-armor, hyper-cutter, oblivious, flame-body, trace, swift-swim). `StatusType.LockedOn` + hook accuracy-check.
- 2026-05-06 — **Bugfixes hors plan post-Batch B**. 5 bugs résolus : natural-cure émet `StatusRemoved` avant `AbilityActivated` (icône statut retirée) ; noms Batch B manquants dans locales renderer (slug disparu) ; selects moves sandbox init + changement Pokemon (`rebuildMoveOptions` fallback `movepool[i]`) ; `dexNumber` sur `PokemonDefinition` + tri par dex dans SandboxPanel et TeamSelectScene ; `GRID_COLS = 7` TeamSelectScene (5 lignes, bouton Launch visible). CI : 1188 unit + 166 intégration verts.
- 2026-05-06 — **Roster Batch B terminé — plan 076**. 19 Pokemon ajoutés (nidoqueen, nidoking, primeape, arcanine, poliwrath, golem, slowbro, gengar, hypno, exeggutor, marowak, hitmonlee, hitmonchan, rhydon, starmie, scyther, pinsir, kabutops, aerodactyl). Roster 15 → 34. 10 nouveaux moves (cross-chop, rock-slide, confuse-ray, energy-ball, bonemerang, blaze-kick, thunder-punch, ice-punch, fire-punch, double-edge). 8 nouvelles abilities (vital-spirit, insomnia, cursed-body, rock-head, limber, iron-fist, natural-cure, battle-armor). 3 nouveaux hooks AbilityHandler : `blocksRecoil`, `preventsCrit`, `onEndTurn`. CI : 1188 unit + 166 intégration verts.
- 2026-05-05 — **Fixes post-plan 075 + playtest**. Sprites 12 Pokemon Batch A téléchargés via PMDCollab (extract-sprites). Tests intégration corrigés (pokemonTypesMap, compteurs roster). `BattleSetup.ts` : 4-move limit (4 premiers du movepool). Sandbox cohérente (4 premiers par défaut). i18n : anciens non-finaux retirés, 12 Batch A ajoutés. Biome format sprites JSON. Décision #300. CI : 1168 unit + 157 intégration verts.
- 2026-05-03 — **Plan 074 terminé — EV → Stat Points**. `StatSpread` type + `SP_TOTAL_MAX=66` / `SP_PER_STAT_MAX=32`. `validateStatSpread`. `computeCombatStats` étendu : `statSpread?` + **IV=31 fixe** (alignement Champions, +~15 stats non-HP à niveau 50 vs ancien IV=0). `PokemonInstance.statSpread?`. `BattleSetupConfig.statSpreadOverrides?`. Golden replay régénéré (82 → 103 actions seed=12345). Fix flakiness `DummyAiController.test.ts` (natures aléatoires). 9 nouveaux tests. CI : 1168 unit + 157 intégration verts. Décisions #296–299.
- 2026-04-29 — **Plan 072 terminé — Natures / Stat Alignment** (mécanique core uniquement). `Nature` enum 25 valeurs, table boost/lowered en dur (Gen 3+ Bulbapedia, 5 neutres + 20 non-neutres). `applyNatureModifier` floor(stat × 1.1 / 0.9), HP exclu. `computeCombatStats(baseStats, level, nature?)`. `rollNature(rng)` uniforme. `PokemonInstance.nature` non-optionnel. `BattleSetupConfig.genderRng` → `creationRng`, ajout `natureOverrides`. **Affichage UI InfoPanel reporté** à la refonte InfoPanel. 13 nouveaux tests. CI verte : 1154 unit + 137 intégration. Décisions #284-287.
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

**Phase 3 terminée (2026-04-26). Phase 4 en cours (plans 069–077 terminés + bugfixes post-Batch C).** Abilities, genres, natures, objets tenus, SP, Roster Batch A + B + C livrés. 51 Pokemon jouables. Prochains : Team Builder, éventuel Roster Batch D (Haunter réintégrable), Méga-évolutions (Phase 9). Voir "À faire maintenant" ci-dessus.

**Référence archive plan 061** : branche `plan-061-occlusion-before-3d-pivot`. Consulter si besoin de comprendre ce qui a été tenté en 2D iso avant pivot.

---

## Conventions de mise à jour (pour Claude)

- **À faire maintenant** : 1 à 3 items max. Item principal en premier.
- **Reporté** : `- [agent/action] — raison`. Ex: `- visual-tester plan 060 — dev server redémarré nécessaire`.
- **Fait récemment** : `- YYYY-MM-DD — ce qui a été fait`. Cap 10, vire les plus anciens.
- Mettre à jour fin de plan, fin d'étape significative, ou quand agent reporté.
- Item "À faire" → "Fait" : déplacer.
- Item "Reporté" impertinent : supprimer avec ligne dans "Fait".
