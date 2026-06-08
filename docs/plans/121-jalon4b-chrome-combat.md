# Plan 121 — Jalon 4b : chrome combat DOM + previews de ciblage

> **Statut : ✅ 4b TERMINÉ** (5 sous-paliers, 2026-06-12) — preview dégâts numérique + flash
> confirmation + icônes aura reportés à 4c (couplés barres PV/textes flottants). Suite : 4c.
> Démarré 2026-06-12. Worktree `phase5-babylon`, port 5220.
> Run autonome (humain : « finis jusqu'à l'iso-Phaser »). Chaîne par sous-palier :
> **bonne pratique (mirror Phaser) → code → code-review → simplify → ci-gate → commit**.
> L'humain teste à l'iso-Phaser (après 4b+4c+4d), pas avant.

## Objectif

Remplacer le `BattleChrome` minimal (4a, listes brutes) et le `BattleFeedback` no-op
par les **panneaux DOM réels**, à parité avec le renderer Phaser. Couvre la checklist
parité §7-13 + previews de ciblage §3 (déplacées depuis 3c).

Référence plan-maître : `119-phase5-babylon-master.md` §5 « Jalon 4 — 4b ».

## Contraintes

- **Contrat overlay** (plan 119 §4) : chrome ancré-écran, scaling cqw (`.ui-screen`),
  reflow mobile. Réutilise tokens `tokens.css` + modules CSS existants.
- **Découplage** : `BattleOrchestrator` construit les view-models (il possède l'état
  core) et les pousse aux ports DOM ; le DOM reste un renderer « bête ». Zéro import
  Phaser/Babylon dans l'orchestrateur.
- **Mirror Phaser** : chaque panneau porte le composant Phaser homonyme
  (`ui/InfoPanel.ts`, `ui/WeatherHud.ts`, `ui/ActionMenu.ts`, `ui/MoveTooltip.ts`,
  `ui/TurnTimeline.ts`, `ui/BattleLogPanel.ts`+`BattleLogFormatter.ts`).
- **Noms FR officiels** dans toute string affichée (via i18n existant).

## Sous-paliers (1 commit chacun)

### 4b-1 — InfoPanel complet + WeatherHud ✅ (2026-06-12)
- Adapter core→view-model `game/battle-views.ts` : `buildInfoPanelView(pokemon, state)`
  (nom/niveau/genre/PV/statut majeur/badges stats+volatils+charge+substitut+wish+auras)
  + `buildWeatherView(state)`. Mirror `ui/InfoPanel.ts` `updateBadges`/`addAuraBadges`.
- Composant DOM `ui/dom/combat/weather-hud.ts` (icône + label + tours restants).
- Ports `BattleChrome.updateInfoPanel(view|null)` + `updateWeather(view|null)`.
- Orchestrateur : `onTileHover(tile)` (survol → InfoPanel de la cible, sinon actif) ;
  refresh InfoPanel/Weather à chaque `refreshUI` + après chaque `syncBoard`.
- CSS `styles/components/weather-hud.css`. InfoPanel réutilise `info-panel.css` (2b).
- **Livré** : `game/battle-views.ts` (+ `battle-views.test.ts`, 9 cas parité),
  `ui/dom/combat/weather-hud.ts`, ports `updateInfoPanel`/`updateWeather` câblés,
  `onTileHover` orchestrateur, refresh InfoPanel/Weather live. Statut majeur = badge
  `debuff` (icône Phaser non câblée DOM). Gate vert (2666 unit + 269 intégration).

### 4b-2 — ActionMenu stylé + sous-menu attaque + MoveTooltip + pattern-preview ✅ (2026-06-12)
- Mirror `ui/ActionMenu.ts` (Move/Attack/Item-disabled/Wait/Status-disabled, Undo remplace Move).
- Sous-menu attaque : **tous** les `moveIds` (grisés si 0 PP/sans cible) + icône type + PP/CT
  + tags blocage Provoc/Entrave/Encore (`resolveBlockedTag`). Header move sélectionné.
- `MoveTooltip` DOM (`ui/dom/combat/move-tooltip.ts`) : catégorie, puissance/précision, pattern
  + range, ~20 tags conditionnels (parité 1:1 Phaser), grille pattern via `buildPatternPreview` réutilisé.
- View-models `AttackSubmenuMoveView`/`SelectedMoveView`/`BlockedMoveTag` + `turnSystemKind()`
  lu depuis `state`. CSS `battle-chrome.css` (panneau vertical) + `move-tooltip.css`. Gate vert.

### 4b-3 — TurnTimeline CT prédictive scrollable ✅ (2026-06-12)
- Mirror `ui/TurnTimeline.ts` : `ui/dom/combat/turn-timeline.ts` (actif épinglé + séquence
  scrollable nativement via `overflow`, séparateur prochain round, barres CT). View-model
  `buildTimelineView(state, ctSequence)` (`battle-views.ts`, +2 tests), port `updateTimeline`,
  `refreshTimeline` (predictCtTimeline(24) en CT) appelé dans `refreshUI`. CSS `turn-timeline.css`.
- **Différé 4b-5** : highlight/scroll move-CT-preview (`scrollToHighlight` pendant ciblage).
  Icônes statut sur entrées + fallback couleur-type omis (portraits présents). Gate vert.

### 4b-4 — BattleLog + formatter ✅ (2026-06-12)
- Mirror `ui/BattleLogPanel.ts` : `ui/dom/combat/battle-log.ts` (panneau repliable burger,
  liste scrollable `aria-live`, pastille couleur équipe, cap 50). Réutilise `BattleLogFormatter`
  (déjà découplé+testé). Implémente `BattleFeedback.report` → remplace le no-op console.debug
  dans `runBattle` (contexte name-resolvers depuis state+registries). CSS `battle-log.css`.
- **Différé** : boutons replay (feature absente), clic nom → pan caméra. Port `BattleFeedback`
  inchangé (zéro changement orchestrateur/tests). Gate vert.

### 4b-5 — Previews de ciblage ✅ (2026-06-12) ; preview dégâts/flash → 4c
- Previews suivant le move (port `GameController.handleTileHover`) : statiques (Self/Cross/Zone →
  footprint au lanceur, affiché à l'entrée), directionnels (Cône/Ligne/Slash/Dash → **direction
  via delta de tuiles `directionFromTo(caster, hoveredTile)`**, grid-based rotation-invariant —
  best-practices a validé vs angle écran Phaser), non-directionnels (tuile si cible légale),
  impact Blast (`resolveBlastImpactTile`). Couleur buff(bleu)/attaque(rouge) via `isBuffMove`.
- Babylon : 3 kinds `Preview*` + `BABYLON_TILE_PREVIEW_ALPHA_INDEX=3` (mesh alphaIndex → preview
  au-dessus highlights/grass/Champs). Port `BoardView.showPreview/clearPreview`. Auto-clear aux
  transitions (`clearHighlights`). Guard recompute direction.
- **Différé 4c** (couplé barres PV / textes flottants / pulse sprite) : preview dégâts numérique
  (barre PV dégradée + min-max + modif face), flash confirmation sprites cibles, icônes aura survol.
  `confirmAttack` reste off (preview au survol avant clic direct). Zones spawn = déjà fait (étape 6).
- best-practices : `directionFromTo` grid + alphaIndex explicite + DOM projeté pour dégâts (4c). Gate vert.
- Review : fix `selfRadiusOf` PostFieldTerrain (4 moves terrain → losange `FIELD_TERRAIN_RADIUS`) + self-cast
  `targetsAllyOrSelf`. **Différés** : garde charge-T1 (preview montre la cible dès le tour de charge — à porter en 4c avec les charges) ; outline persistant de portée pour moves ally/self sans allié proche (cosmétique).

## Gate

CI standard à chaque sous-palier (`pnpm build && lint:fix && typecheck && test &&
test:integration`) + `core-guardian` si `packages/core` touché (ne devrait pas l'être).
Repasse gate complète humaine à l'iso-Phaser (fin 4d).

## Hors scope

- Tweens déplacement/impacts + 30 textes flottants → **4c**.
- Team Builder réel, Team Select complet, Sandbox Studio → **4d**.
- Suppression Phaser → **J5**.
</content>
</invoke>
