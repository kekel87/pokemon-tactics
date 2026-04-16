# Plan 059 — CT Timeline : séquence prédictive scrollable

**Statut : done**
**Date : 2026-04-16**
**Dépend de : plan 054 (CT system), plan 058 (preview CT ghost)**

## Contexte

Plan 058 avait introduit une preview "ghost" semi-transparente avec séparateur "Après action" dans la TurnTimeline CT. Plan 059 remplace complètement ce design par une séquence prédictive scrollable à la FFX, plus lisible et plus précise.

## Décision de design

- La TurnTimeline en mode CT affiche une **séquence prédictive de 24 entrées** simulées par le core engine.
- Slot 0 : acteur courant ancré en haut (non-scrollable).
- 11 slots scrollables en-dessous (molette de souris sur la zone timeline).
- Au `confirm_attack` : la séquence est recalculée avec le coût du move, le Pokemon actif est mis en évidence (bordure teal-vert), auto-scroll vers son prochain tour.
- Si un Pokemon n'apparaît pas dans les 24 slots prédits : entrée finale "tail" (portrait semi-transparent + "...").
- Espacement réduit de 10 → 6 pour que l'entrée tail tienne sous la zone scrollable.

## Changements implémentés

### Core

`BattleEngine.predictCtTimeline(count, moveId?)` — argument `moveId` désormais optionnel.
- Sans `moveId` : simule un `CT_WAIT` pour le Pokemon actif (fin de tour sans attaque).
- Avec `moveId` : calcule le `moveCost` réel et l'applique.

### Renderer TurnTimeline

Refonte complète du mode CT :
- 24 slots de prédiction calculés par le core (`TIMELINE_PREDICTION_SLOTS = 24`)
- Slot 0 toujours ancré en haut (acteur courant)
- 11 slots visibles scrollables (`TIMELINE_VISIBLE_SLOTS = 11`)
- Scroll à la molette sur la zone timeline
- Au `confirm_attack` : séquence recalculée avec le coût du move, bordure teal-vert sur le Pokemon actif (`TIMELINE_HIGHLIGHT_BORDER_COLOR`), auto-scroll vers son prochain tour
- Entrée tail : portrait semi-transparent + "..." si le Pokemon n'apparaît pas dans les 24 slots
- Espacement 10 → 6 pour faire tenir l'entrée tail

### Constants

Ajouts :
- `TIMELINE_BG_COLOR`
- `TIMELINE_HIGHLIGHT_BORDER_COLOR` (teal-vert, bordure Pokemon actif)
- `TIMELINE_PREDICTION_SLOTS = 24`
- `TIMELINE_VISIBLE_SLOTS = 11`
- (autres constantes de layout timeline)

Suppressions :
- `TIMELINE_GHOST_ALPHA` — plus de ghost (plan 058)
- `TIMELINE_PREVIEW_SEPARATOR_COLOR` — plus de séparateur (plan 058)
- `TIMELINE_PREVIEW_SEPARATOR_COLOR_CSS` — idem

### i18n

Supprimé : clé `timeline.afterAction` (FR "Après action" / EN "After action") — n'est plus utilisée.

## Fichiers modifiés

- `packages/core/src/battle/BattleEngine.ts`
- `packages/core/src/battle/BattleEngine.predict-ct.test.ts`
- `packages/renderer/src/constants.ts`
- `packages/renderer/src/ui/TurnTimeline.ts`
- `packages/renderer/src/game/GameController.ts`
- `packages/renderer/src/i18n/types.ts`
- `packages/renderer/src/i18n/locales/fr.ts`
- `packages/renderer/src/i18n/locales/en.ts`
