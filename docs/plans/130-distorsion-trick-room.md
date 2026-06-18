# Plan 130 — Distorsion (Trick Room)

**Statut : DONE (2026-06-18)**
**Phase 4 — Mécaniques restantes (moves complexes), famille « Distorsion ».**

## But

**Distorsion** (`trick-room`, Psy, statut) : pendant 5 tours, l'ordre du Charge Time est **inversé pour les Pokemon situés dans une zone** — les lents jouent en premier. Re-lancer Distorsion annule la zone du lanceur (toggle canon).

**Décision de forme (2026-06-18)** : contrairement au canon (global field-wide), Distorsion est **localisée en zone statique** (diamant Manhattan r3, comme les Champs), pour rester cohérent avec le reste du projet qui localise tout (Reflet/Mur Lumière = auras mobiles, Champs = zones). Seuls les mons **dans la zone** ont leur tempo inversé → entrer/sortir devient un choix tactique.

## Mécanique cœur — inversion CT localisée (par inversion de la VITESSE en entrée)

Source unique de gain CT : `BattleEngine.getCtGainForPokemon(id)` (utilisée par le live **et** `predictCtTimeline` → timeline reflète l'inversion gratuitement).

- **Hors zone** : `gain = round(computeCtGain(baseSpeed, speedStages) × itemModifier)`.
- **Dans une zone Distorsion** (`isInDistortionZone(state, pokemon.position)`) : on inverse la **vitesse de base en entrée**, puis on repasse dans la courbe CT normale :
  - `vitesseEffective = max(1, DISTORTION_SPEED_PIVOT - baseSpeed)` (pivot **160**, > Vit max Gen 1 = Électrode 150).
  - `gain = round(computeCtGain(vitesseEffective, -speedStages) × itemModifier)` (crans de Vitesse inversés aussi : boost Vitesse = malus sous Distorsion).
  - Un mon rapide (Vit 150) → vitesse effective 10 → traîne ; un mon lent (Vit 55) → effective 105 → vite.
  - **Pourquoi pas la réflexion du gain (`PIVOT - gain`)** : essayée d'abord (pivot 700), rejetée — contre des gains normaux ~98-130 ça donnait des gains en-zone ~570-600 → tout mon en zone devenait ~5× plus rapide que hors zone au lieu d'inverser l'ordre. L'inversion de la vitesse en entrée garde les gains dans la même bande. (bug remonté au playtest 2026-06-18.)
  - Zones superposées = booléen (pas de double-inversion).

## Zone — modèle calqué sur les Champs (`FieldZone`)

- Type `DistortionZone { casterId, tiles, anchor, remainingTurns }` (`types/distortion-zone.ts`).
- `state.distortionZones: DistortionZone[]`.
- `distortion-system.ts` : `postDistortion` (**mirror exact de `postFieldTerrain`** : pose au centre du lanceur ; re-cast au **même épicentre** = remplace/rafraîchit ; ailleurs = 2ᵉ zone coexiste ; **pas de toggle/annulation** — décision playtest 2026-06-18, l'humain veut le comportement Champs), `isInDistortionZone`, `invertedDistortionSpeed`, `decrementDistortionTimer`. Réutilise `enumerateZoneTiles`. Constantes `DISTORTION_DEFAULT_DURATION = 5`, `DISTORTION_RADIUS = 3`, `DISTORTION_SPEED_PIVOT = 160`.
- **Durée « tours du lanceur » + horloge fantôme** : décompte à la fin du tour du lanceur (`distortionDecrementHandler`, priorité end-turn 268), + `hasEnvironmentalEffectSetBy` / `tickGhostTurn` étendus (survit au KO du lanceur). `DistortionExpired` émis à l'expiry naturelle / fantôme.
- Handler `EffectKind.PostDistortion` (`handle-post-distortion.ts`) : pose + event `DistortionPosted`.
- **Preview** : `selfPreviewRadius` retourne `DISTORTION_RADIUS` pour un move `PostDistortion` → le diamant r3 s'affiche au cast (sol + grille tooltip), comme les Champs.

## Fichiers touchés

**Core** : `types/distortion-zone.ts` (+ index), `battle/distortion-system.ts` (+ index), `enums/effect-kind.ts` (PostDistortion), `enums/battle-event-type.ts` (DistortionPosted/Expired), `types/battle-event.ts`, `types/effect.ts`, `types/battle-state.ts` (distortionZones), `battle/handlers/handle-post-distortion.ts`, `battle/handlers/distortion-tick-handler.ts`, `battle/effect-processor.ts` (register), `battle/BattleEngine.ts` (CT inversion + tick + ghost + register), `ai/action-scorer.ts` (scoreSelfMove PostDistortion).
**Data** : `overrides/tactical.ts` (`trick-room`), `op-sets/op-sets.json` (+2 sets : Noadkoko/Flagadoss Distorsion, 177→179).
**Renderer** : `render-ports` (CombatScene + BoardView `setDistortionZones`), `render-babylon/combat-scene.ts` (2e instance `createFieldTerrains`, couleur indigo), `render-babylon/battle-board-view.ts`, `view-core/battle-orchestrator.ts` (`refreshDistortionVisuals`), `view-core/constants.ts` (`DISTORTION_ZONE_COLOR = 0x7a5cff`), `view-core/floating-text-content.ts`, `ui-dom/BattleLogFormatter.ts`, `ui-dom/move-tooltip.ts` (tag).
**i18n** : `app/i18n/{fr,en,types}.ts` (`distortion.posted`, `moveTooltip.tag.distortion`).
**Init state** : BattleSetup + 6 fixtures de test (`distortionZones: []`).

## Indicateur

Pas de HUD global top-center (incohérent pour un effet localisé) : la **pill compteur in-world** au-dessus de l'ancre (réutilisée du rendu Champs) porte les tours restants, comme les Champs. Feedback secondaire = la timeline CT (ordre inversé visible).

## IA

`scoreSelfMove` PostDistortion : -1 si le lanceur **est déjà dans une zone** (re-pose inutile, mirror field-terrain) ; sinon `weights.statChanges × setterDurabilityMultiplier × (nb alliés lents dans la zone)`, 0 s'il n'y a pas de bénéficiaire lent vs vitesse médiane ennemie.

## Tests

- `distortion-system.test.ts` (8) : pivot monotone + clamp, post/cancel toggle, isInDistortionZone, overlap booléen, décompte caster-only + expiry.
- `moves/trick-room.test.ts` (5) : posting (event + 25 tuiles + 5t), recast annule, **inversion CT via predictCtTimeline** (lent avant rapide en zone), expiry 5 tours lanceur, survit au KO.
- Gate : **2699 unit + 249 intégration verts**, typecheck + build + biome clean.

## Hors scope

- Priorité −7 canon (modèle CT sans priorité intra-tour fine).
- Field global (Gravité, Vent Arrière) — familles séparées, plus tard.
